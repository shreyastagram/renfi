/**
 * App Context
 * 
 * Global application state management using React Context
 * Handles authentication state, user data, and app-wide state
 * 
 * @version 3.0.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import { 
  storeTokens, 
  storeUserData, 
  getUserData, 
  getTokens, 
  clearAllData,
  storeUserType,
  getUserType,
  isTokenExpired 
} from '../utils/storage';
import { logout as apiLogout } from '../services/authService';
import { syncPhoneToMongoDB } from '../services/authService';
import { fetchFullProfile, getCurrentUser, updateProviderOnlineStatus as apiUpdateOnlineStatus, updateProviderProfile as apiUpdateProviderProfile } from '../services/profileService';
import { saveFcmTokenForUser, saveFcmTokenForProvider, setupForegroundMessageListener, setupTokenRefreshListener, deleteFcmToken } from '../services/fcmService';
import { validateAndRefreshTokens, warmUpNetworkStack } from '../services/apiClient';
import { signOutFromGoogle } from '../services/googleAuthService';
// Note: Apple Sign-In doesn't have a client-side signOut — revocation happens server-side
import { performFullSync, processSyncQueue, isSyncDue, updateProfileWithSync, SYNC_STATUS } from '../services/profileSyncService';
import { checkAuthHealth, addAuthStateListener, getDeviceInfo, AUTH_HEALTH } from '../services/authInfraService';
import { initializeSocket, disconnectSocket } from '../services/socketService';
import { Analytics, EV, onceEver } from '../services/analytics';

/**
 * App Context
 */
const AppContext = createContext(null);

/**
 * App Provider Component
 * Wraps the app with global state and auth management
 */
export const AppProvider = ({ children }) => {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userType, setUserTypeState] = useState(null); // 'user' or 'provider'
  const [profile, setProfile] = useState(null); // Full profile data
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [aadhaarStatus, setAadhaarStatus] = useState({ isVerified: false, isNameLocked: false, aadhaarName: null, aadhaarLoaded: false });
  const [premiumStatus, setPremiumStatus] = useState({ isPremiumActive: false, premiumDaysLeft: 0, premiumLoaded: false });
  const profileLastFetched = useRef(0); // timestamp of last successful fetch
  const STALE_THRESHOLD = 30000; // 30 seconds — skip re-fetch if data is fresh
  const [authHealth, setAuthHealth] = useState(null); // Auth service health status
  const [activeSessions, setActiveSessions] = useState([]); // Multi-device sessions
  const logoutInProgressRef = useRef(false); // Prevent concurrent logout calls
  const isInitialLoadRef = useRef(true); // True during first launch, false after splash completes
  const profileFetchInFlight = useRef(false); // Prevent concurrent profile fetches
  const availabilityUpdateInFlight = useRef(false); // Prevent profile refresh from overwriting optimistic availability

  /**
   * Initialize auth state on app load
   */
  useEffect(() => {
    initializeAuth();
    
    // Set up global handler for auth expiry (called from apiClient)
    global.onAuthExpired = handleAuthExpired;

    // Set up global handler for email verification (called from App.tsx deep link handler)
    global.onEmailVerified = async () => {
      try {
        console.log('📧 [AppContext] Email verified deep link — refreshing status...');
        await refreshVerificationStatus();
        const id = user?.mongoId || user?._id;
        if (id && userType) {
          await refreshProfile(userType, id, { force: true });
        }
      } catch (err) {
        console.warn('⚠️ [AppContext] Email verification refresh failed:', err.message);
      }
    };
    
    // Subscribe to auth state changes from authInfraService
    const unsubscribeAuthState = addAuthStateListener((state, data) => {
      console.log('📢 [AppContext] Auth state notification:', state, data);
      if (state === 'LOGGED_OUT') {
        handleAuthExpired();
      }
    });
    
    return () => {
      global.onAuthExpired = null;
      global.onEmailVerified = null;
      unsubscribeAuthState();
    };
  }, []);

  /**
   * Handle auth expiry (token refresh failed)
   * Guarded against concurrent calls to prevent cascading state resets
   */
  const handleAuthExpired = useCallback(async () => {
    if (logoutInProgressRef.current) {
      console.log('⚠️ [AppContext] Auth expiry already being handled, skipping duplicate');
      return;
    }
    logoutInProgressRef.current = true;
    console.log('⚠️ [AppContext] Auth expired, logging out...');
    try {
      await clearAllData();
    } catch (e) {
      console.warn('⚠️ [AppContext] clearAllData error during auth expiry:', e.message);
    }
    setUser(null);
    setUserTypeState(null);
    setProfile(null);
    setIsAuthenticated(false);
    setIsAuthLoading(false);
    setAuthHealth(null);
    setActiveSessions([]);
    setAadhaarStatus({ isVerified: false, isNameLocked: false, aadhaarName: null, aadhaarLoaded: false });
    setPremiumStatus({ isPremiumActive: false, premiumDaysLeft: 0, premiumLoaded: false });
    logoutInProgressRef.current = false;
  }, []);

  /**
   * Check auth health status
   * @returns {Promise<Object>} Auth health status
   */
  const checkHealth = useCallback(async () => {
    try {
      console.log('🏥 [AppContext] Checking auth health...');
      const health = await checkAuthHealth();
      setAuthHealth(health);
      return health;
    } catch (error) {
      console.error('❌ [AppContext] Health check failed:', error);
      return { status: AUTH_HEALTH.SERVICE_ERROR, healthy: false };
    }
  }, []);

  /**
   * Perform profile sync if needed
   * Called on app resume or periodically
   * @returns {Promise<Object>} Sync result
   */
  const syncProfileIfNeeded = useCallback(async () => {
    try {
      // Check if sync is due based on time
      const syncNeeded = await isSyncDue();
      if (!syncNeeded) {
        console.log('⏭️ [AppContext] Sync not due yet');
        return { skipped: true };
      }

      // Process any pending sync items first
      const queueResult = await processSyncQueue();
      
      // Perform full sync if we have user data
      if (user?.mongoId && userType) {
        const syncResult = await performFullSync({
          type: userType,
          mongoId: user.mongoId,
        });
        
        if (syncResult.success && syncResult.data) {
          setProfile(syncResult.data);
        }
        
        return syncResult;
      }
      
      return { queueResult };
    } catch (error) {
      console.error('❌ [AppContext] Profile sync failed:', error);
      return { success: false, error: error.message };
    }
  }, [user?.mongoId, userType]);

  /**
   * Update profile with automatic sync to both databases
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} Update result
   */
  const updateProfileWithAutoSync = useCallback(async (updates) => {
    if (!user?.mongoId || !userType) {
      return { success: false, error: 'No user session' };
    }
    
    const result = await updateProfileWithSync({
      type: userType,
      mongoId: user.mongoId,
      updates,
    });
    
    if (result.success && result.data) {
      // Preserve verification fields from previous state — sync result (MongoDB) doesn't include them
      setProfile(prev => ({
        ...prev,
        ...result.data,
        isEmailVerified: result.data.isEmailVerified ?? prev?.isEmailVerified,
        isPhoneVerified: result.data.isPhoneVerified ?? prev?.isPhoneVerified,
      }));
      setUser(prev => ({
        ...prev,
        fullName: updates.name || updates.fullName || prev?.fullName,
        phone: updates.phone || updates.phoneNumber || prev?.phone,
      }));
    }
    
    return result;
  }, [user?.mongoId, userType]);

  /**
   * Refresh profile data from APIs
   * @param {string} [type] - User type ('user' or 'provider'). Falls back to current userType.
   * @param {string} [mongoId] - MongoDB document ID. Falls back to current user's mongoId.
   */
  const refreshProfile = useCallback(async (type, mongoId, { force = false } = {}) => {
    // Default to stored context values if not provided — allows calling refreshProfile() with no args
    const effectiveType = type || userType;
    const effectiveMongoId = mongoId || user?.mongoId || user?._id;
    
    if (!effectiveType || !effectiveMongoId) {
      console.warn('⚠️ [AppContext] Cannot refresh profile — missing type or mongoId');
      return null;
    }

    // Prevent concurrent profile fetches — if one is already in flight, skip
    if (profileFetchInFlight.current) {
      console.log('⏭️ [AppContext] Profile fetch already in flight, skipping');
      return profile;
    }

    // SWR: Skip fetch if data is fresh (< 30s old) unless forced
    const now = Date.now();
    if (!force && profile && (now - profileLastFetched.current) < STALE_THRESHOLD) {
      console.log('⏭️ [AppContext] Profile is fresh, skipping re-fetch');
      return profile;
    }
    
    profileFetchInFlight.current = true;
    try {
      // Only show loading spinner on first load (no cached data yet)
      const isFirstLoad = !profile;
      if (isFirstLoad) {
        setIsProfileLoading(true);
      }
      console.log('🔄 [AppContext] Refreshing profile...');
      
      const result = await fetchFullProfile(effectiveType, effectiveMongoId);

      // Detect deleted/deactivated account — force logout
      // Skip during initial load to prevent race conditions with splash screen.
      // The background account check in validateAndRefreshTokens handles this safely.
      if (result.success && result.data?.isActive === false) {
        if (isInitialLoadRef.current) {
          console.warn('🚫 [AppContext] Account deactivated (detected during init) — deferring to background check');
          return null;
        }
        console.warn('🚫 [AppContext] Account is deactivated — forcing logout');
        const showDlg = global.showStyledDialog || Alert.alert;
        showDlg(
          'Account Deleted',
          'Your account has been deleted. You will be logged out.',
          [{ text: 'OK', onPress: () => logout(false) }]
        );
        return null;
      }

      // If profile fetch failed, distinguish between network errors and account deletion
      if (!result.success) {
        const errStatus = result.error?.status;
        const errCode = result.error?.code;

        // Network error — don't logout, just skip this refresh cycle
        const networkCodes = ['NETWORK_ERROR', 'SERVER_UNREACHABLE', 'NO_INTERNET', 'SERVER_TIMEOUT'];
        if (networkCodes.includes(errCode)) {
          console.warn('⚠️ [AppContext] Profile fetch failed due to network — keeping session');
          return profile; // Return cached profile, don't logout
        }

        // Definitive 404 — account was deleted on the backend
        if (errStatus === 404 || errCode === 'USER_NOT_FOUND' || errCode === 'PROVIDER_NOT_FOUND') {
          if (isInitialLoadRef.current) {
            console.warn('🚫 [AppContext] Account not found (detected during init) — deferring to background check');
            return null;
          }
          console.warn('🚫 [AppContext] Account not found on backend — forcing logout');
          const showDlg = global.showStyledDialog || Alert.alert;
          showDlg(
            'Account Not Found',
            'Your account no longer exists. You will be logged out.',
            [{ text: 'OK', onPress: () => logout(false) }]
          );
          return null;
        }
      }

      if (result.success) {
        // Analytics: document_verified — detect newly-approved service categories.
        // No push notification exists for approval, so this fires when the app
        // next observes the change (documented limitation). Deduped per category.
        // Baseline guard: on the FIRST observation for this provider, existing
        // verified categories are marked silently so historical approvals don't
        // burst stale conversion events after the app update.
        if (effectiveType === 'provider' && Array.isArray(result.data?.verifiedServiceCategories)) {
          const uid = result.data._id || result.data.mongoId || '';
          const categories = result.data.verifiedServiceCategories;
          onceEver(`doc_verified_baseline:${uid}`).then((isFirstObservation) => {
            categories.forEach((category) => {
              onceEver(`doc_verified:${uid}:${category}`).then((first) => {
                if (first && !isFirstObservation) {
                  Analytics.track(EV.DOCUMENT_VERIFIED, { role: 'provider', service_category: category });
                }
              });
            });
          });
        }

        // Preserve verification fields — they come from Java Auth and must not be lost
        // Preserve availability if a toggle update is in flight — prevents stale DB data from
        // overwriting the optimistic value the user just set
        setProfile(prev => ({
          ...result.data,
          isEmailVerified: result.data.isEmailVerified ?? prev?.isEmailVerified ?? false,
          isPhoneVerified: result.data.isPhoneVerified ?? prev?.isPhoneVerified ?? false,
          ...(availabilityUpdateInFlight.current ? { isAvailable: prev?.isAvailable, isOnline: prev?.isOnline } : {}),
        }));

        // Update user state with verification status
        setUser(prev => ({
          ...prev,
          isEmailVerified: result.data.isEmailVerified ?? prev?.isEmailVerified ?? false,
          isPhoneVerified: result.data.isPhoneVerified ?? prev?.isPhoneVerified ?? false,
          ...(availabilityUpdateInFlight.current ? { isAvailable: prev?.isAvailable, isOnline: prev?.isOnline } : {}),
        }));
        
        profileLastFetched.current = Date.now();

        // Sync premium status from profile for providers
        if (effectiveType === 'provider' && result.data) {
          const p = result.data;
          if (p.isPremium !== undefined) {
            const daysLeft = p.premiumExpiresAt
              ? Math.max(0, Math.ceil((new Date(p.premiumExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
              : 0;
            setPremiumStatus({
              isPremiumActive: p.isPremium === true && daysLeft > 0,
              premiumDaysLeft: daysLeft,
              premiumLoaded: true,
            });
          }
        }

        console.log('✅ [AppContext] Profile refreshed');
        return result.data;
      } else {
        console.warn('⚠️ [AppContext] Profile refresh failed:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ [AppContext] Profile refresh error:', error);
      return null;
    } finally {
      profileFetchInFlight.current = false;
      setIsProfileLoading(false);
    }
  }, [userType, user?.mongoId, user?._id, profile]);

  /**
   * Refresh just the verification status from Java Auth
   * Also updates other profile fields from the API response
   */
  const refreshVerificationStatus = useCallback(async () => {
    try {
      console.log('🔄 [AppContext] Refreshing verification status...');
      setIsProfileLoading(true);
      
      const result = await getCurrentUser();
      
      if (result.success) {
        const data = result.data;
        
        // Update user state with all returned fields
        // Note: API returns 'phoneNumber' but we use 'phone' in our state
        setUser(prev => ({
          ...prev,
          email: data.email || prev?.email,
          fullName: data.fullName || prev?.fullName,
          phone: data.phoneNumber || prev?.phone, // Map phoneNumber to phone
          isEmailVerified: data.isEmailVerified ?? false,
          isPhoneVerified: data.isPhoneVerified ?? false,
          isActive: data.isActive ?? true,
          role: data.role || prev?.role,
          hasPassword: data.hasPassword ?? prev?.hasPassword,
        }));
        
        // Also update profile state
        setProfile(prev => ({
          ...prev,
          email: data.email || prev?.email,
          fullName: data.fullName || prev?.fullName,
          phone: data.phoneNumber || prev?.phone, // Map phoneNumber to phone
          hasPassword: data.hasPassword ?? prev?.hasPassword,
          isEmailVerified: data.isEmailVerified ?? false,
          isPhoneVerified: data.isPhoneVerified ?? false,
          isActive: data.isActive ?? true,
          role: data.role || prev?.role,
        }));

        // === SYNC PHONE TO MONGODB ===
        // After OTP verification, Java Auth has the latest phone data
        // but MongoDB still has the old/empty data. Sync it now.
        const mongoId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
        if (mongoId && data.phoneNumber) {
          console.log('📱 [AppContext] Syncing verified phone to MongoDB...');
          syncPhoneToMongoDB({
            mongoId,
            userType: userType || 'provider',
            phoneNumber: data.phoneNumber,
            isPhoneVerified: data.isPhoneVerified,
          }).then(syncResult => {
            if (syncResult.success) {
              console.log('✅ [AppContext] Phone synced to MongoDB');
            } else {
              console.warn('⚠️ [AppContext] Phone sync to MongoDB failed:', syncResult.error);
            }
          }).catch(err => {
            console.warn('⚠️ [AppContext] Phone sync error:', err.message);
          });
        }
        
        console.log('✅ [AppContext] Verification status updated');
        return { isEmailVerified: data.isEmailVerified, isPhoneVerified: data.isPhoneVerified };
      }
      
      return null;
    } catch (error) {
      console.error('❌ [AppContext] Verification status refresh error:', error);
      return null;
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  /**
   * Update provider availability (isAvailable/isOnline) - Single source of truth
   * This function updates both the backend AND the local state
   * Should be used by all screens that toggle availability
   * 
   * @param {boolean} isAvailable - New availability status
   * @returns {Promise<Object>} Result with success status
   */
  const setAvailabilityOptimistic = useCallback((value) => {
    setUser(prev => ({ ...prev, isAvailable: value, isOnline: value }));
    setProfile(prev => ({ ...prev, isAvailable: value, isOnline: value }));
  }, []);

  const updateProviderAvailability = useCallback(async (isAvailable, optimistic) => {
    // Optimistic-only call — just update local state, no API
    if (optimistic) {
      setAvailabilityOptimistic(isAvailable);
      return { success: true };
    }

    const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

    if (!providerId) {
      console.error('❌ [AppContext] Cannot update availability - no provider ID');
      return { success: false, error: 'Provider ID not found' };
    }

    console.log(`🔄 [AppContext] Updating provider availability: ${isAvailable}`);

    availabilityUpdateInFlight.current = true;
    try {
      const result = await apiUpdateOnlineStatus(providerId, isAvailable);

      if (result.success) {
        setAvailabilityOptimistic(isAvailable);

        console.log('✅ [AppContext] Availability updated successfully');

        // Analytics: fires only after the API confirmed the toggle
        Analytics.track(
          isAvailable ? EV.ONLINE_STATUS_ENABLED : EV.ONLINE_STATUS_DISABLED,
          { role: 'provider' }
        );

        return {
          success: true,
          visibilityWarnings: result.data?.visibilityWarnings,
          searchReady: result.data?.searchReady,
        };
      } else {
        console.error('❌ [AppContext] API failed to update availability');
        return { success: false, error: result.error?.message || 'Failed to update availability' };
      }
    } catch (error) {
      console.error('❌ [AppContext] Error updating availability:', error);
      return { success: false, error: error.message || 'Failed to update availability' };
    } finally {
      availabilityUpdateInFlight.current = false;
    }
  }, [user?.mongoId, profile?.mongoId, user?._id, profile?._id, setAvailabilityOptimistic]);

  /**   * Update provider location tracking - Single source of truth
   * This function updates both the backend AND the local state
   * Should be used by all screens that toggle location tracking
   * 
   * @param {boolean} enabled - New location tracking status
   * @returns {Promise<Object>} Result with success status
   */
  const setLocationTrackingOptimistic = useCallback((value) => {
    setProfile(prev => ({
      ...prev,
      locationTracking: { ...(prev?.locationTracking || {}), enabled: value },
    }));
  }, []);

  const updateProviderLocationTracking = useCallback(async (enabled, optimistic) => {
    if (optimistic) {
      setLocationTrackingOptimistic(enabled);
      return { success: true };
    }

    const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

    if (!providerId) {
      console.error('❌ [AppContext] Cannot update location tracking - no provider ID');
      return { success: false, error: 'Provider ID not found' };
    }

    console.log(`🔄 [AppContext] Updating provider location tracking: ${enabled}`);

    try {
      const result = await apiUpdateProviderProfile(providerId, {
        locationTracking: { enabled },
      });

      if (result.success) {
        setLocationTrackingOptimistic(enabled);
        console.log('✅ [AppContext] Location tracking updated successfully');
        return { success: true };
      } else {
        console.error('❌ [AppContext] API failed to update location tracking');
        return { success: false, error: result.error?.message || 'Failed to update location tracking' };
      }
    } catch (error) {
      console.error('❌ [AppContext] Error updating location tracking:', error);
      return { success: false, error: error.message || 'Failed to update location tracking' };
    }
  }, [user?.mongoId, profile?.mongoId, user?._id, profile?._id, setLocationTrackingOptimistic]);

  /**   * Check stored tokens and restore auth state
   * Now with proactive token validation and refresh
   */
  const initializeAuth = async () => {
    try {
      console.log('🔄 [AppContext] Initializing auth state...');

      // Warm up networking stack in the background (non-blocking).
      // This initialises DNS, TLS sessions, and connection pools so the
      // first user-triggered request (e.g. registration) doesn't fail.
      warmUpNetworkStack();

      const [storedUserData, storedUserType] = await Promise.all([
        getUserData(),
        getUserType(),
      ]);

      // Check if we have stored user data
      if (!storedUserData) {
        console.log('ℹ️ [AppContext] No stored session found');
        setIsAuthLoading(false);
        return;
      }

      // Validate and refresh tokens BEFORE setting auth state
      console.log('🔐 [AppContext] Validating stored tokens...');
      let tokenResult;
      try {
        tokenResult = await validateAndRefreshTokens();
      } catch (validateErr) {
        console.error('❌ [AppContext] validateAndRefreshTokens threw:', validateErr?.message);
        tokenResult = { valid: false, accessToken: null };
      }

      if (!tokenResult?.valid) {
        console.log('❌ [AppContext] Tokens invalid or expired, clearing session...');
        await clearAllData();
        setUser(null);
        setUserTypeState(null);
        setProfile(null);
        setIsAuthenticated(false);
        setIsAuthLoading(false);
        return;
      }

      // Tokens are valid, restore session
      console.log('✅ [AppContext] Tokens valid, restoring session');
      setUser(storedUserData);
      setUserTypeState(storedUserType);
      setIsAuthenticated(true);
      
      // Re-initialize socket on session restore (users AND providers)
      if (storedUserData.mongoId) {
        const tokens = await getTokens();
        if (tokens?.accessToken) {
          if (storedUserType === 'user') {
            console.log('🔌 [AppContext] Re-initializing socket for user on session restore');
            initializeSocket('user', storedUserData.mongoId, tokens.accessToken);
          }
          // Note: Provider socket is initialized in ProviderHomeScreen (after mount)

          // Re-save FCM token on every session restore so backend always has the latest
          const resaveFcm = async () => {
            try {
              if (storedUserType === 'provider') {
                await saveFcmTokenForProvider(storedUserData.mongoId, tokens.accessToken);
              } else {
                await saveFcmTokenForUser(storedUserData.mongoId, tokens.accessToken);
              }
              console.log('✅ [AppContext] FCM token re-saved on session restore');
            } catch (err) {
              console.warn('⚠️ [AppContext] FCM token re-save failed:', err.message);
            }
          };
          resaveFcm();
        }
      }
      
      // Restore cached Aadhaar status instantly (no shimmer on cold start)
      if (storedUserType === 'provider') {
        try {
          const cachedAadhaar = await AsyncStorage.getItem('cached_aadhaar_status');
          if (cachedAadhaar) {
            const parsed = JSON.parse(cachedAadhaar);
            setAadhaarStatus({ ...parsed, aadhaarLoaded: true });
          }
        } catch {} // ignore — will fetch fresh on ProfileScreen
      }

      // Fetch fresh profile data in background
      if (storedUserData.mongoId) {
        refreshProfile(storedUserType, storedUserData.mongoId);
      } else {
        // At least refresh verification status
        refreshVerificationStatus();
      }
    } catch (error) {
      console.error('❌ [AppContext] Auth initialization failed:', error);
      // On error, clear potentially corrupted state
      await clearAllData();
      setUser(null);
      setUserTypeState(null);
      setProfile(null);
      setIsAuthenticated(false);
    } finally {
      setIsAuthLoading(false);
    }
  };

  /**
   * Handle successful authentication
   * @param {Object} authData - Auth response data from API
   */
  const handleAuthSuccess = useCallback(async (authData) => {
    try {
      console.log('🔐 [AppContext] Processing auth success...', { email: authData.email, role: authData.role, userType: authData.userType });
      
      // Validate required auth data before proceeding
      if (!authData.accessToken || typeof authData.accessToken !== 'string') {
        console.error('❌ [AppContext] Missing or invalid access token in auth response');
        return false;
      }
      if (!authData.refreshToken || typeof authData.refreshToken !== 'string') {
        console.error('❌ [AppContext] Missing or invalid refresh token in auth response');
        return false;
      }

      // Store tokens securely with expiry time
      // expiresIn is in seconds (default 24 hours = 86400)
      const expiresIn = authData.expiresIn || 86400;
      await storeTokens(authData.accessToken, authData.refreshToken, expiresIn);
      
      // Determine user type
      const isProvider = authData.userType === 'provider' || authData.role === 'SERVICE_PROVIDER' || authData.providerId;
      
      // ✅ UNIFIED ID SYSTEM:
      // After the backend update, MongoDB _id = Java Auth userId
      // So we can use javaUserId OR userId for ALL queries (both PostgreSQL and MongoDB)
      // 
      // Sources for the unified ID:
      // - authData.mongoId (explicit from new registration)
      // - authData.javaUserId (from registration)
      // - authData.userId (from login - this is the PostgreSQL ID which now equals MongoDB _id)
      // - authData.providerId (for providers from registration)
      // - authData.data?._id (from nested data object)
      
      const unifiedId = authData.mongoId 
        || authData.javaUserId?.toString() 
        || authData.userId?.toString() 
        || authData.providerId?.toString()
        || authData.data?._id?.toString();
      
      console.log('🆔 [AppContext] Unified ID resolved:', unifiedId);

      if (!unifiedId) {
        console.error('❌ [AppContext] No unified ID resolved from auth response');
        return false;
      }

      // Build user data object
      const userData = {
        // Unified ID - works for both PostgreSQL and MongoDB
        javaUserId: unifiedId,
        mongoId: unifiedId, // Same ID now!
        // Core profile
        email: authData.email || authData.data?.email,
        fullName: authData.fullName || authData.data?.fullName || authData.data?.name,
        phone: authData.phone || authData.phoneNumber || authData.data?.phone,
        role: authData.role,
        tokenType: authData.tokenType || 'Bearer',
        expiresIn: authData.expiresIn,
        // Address info from registration (include for immediate display)
        address: authData.address || authData.data?.address,
        city: authData.city || authData.data?.city,
        pincode: authData.pincode || authData.data?.pincode,
        // Verification status (may be updated later from profile fetch)
        isEmailVerified: authData.isEmailVerified ?? false,
        isPhoneVerified: authData.isPhoneVerified ?? false,
      };
      
      await storeUserData(userData);
      
      // Store user type
      const type = isProvider ? 'provider' : 'user';
      await storeUserType(type);
      
      // Update state
      setUser(userData);
      setUserTypeState(type);
      setIsAuthenticated(true);
      
      // Fetch fresh profile data
      if (unifiedId) {
        // We have unified ID - can fetch full profile (works for both users and providers)
        refreshProfile(type, unifiedId);
        
        // Save FCM token for push notifications
        const saveFcmToken = async () => {
          try {
            if (type === 'provider') {
              await saveFcmTokenForProvider(unifiedId, authData.accessToken);
            } else {
              await saveFcmTokenForUser(unifiedId, authData.accessToken);
            }
          } catch (err) {
            console.warn('⚠️ [AppContext] FCM token save failed:', err.message);
          }
        };
        saveFcmToken();
        
        // Initialize Socket.IO for real-time updates (users AND providers)
        // Providers also init socket in ProviderHomeScreen, but users need it here
        if (type === 'user') {
          console.log('🔌 [AppContext] Initializing socket for user:', unifiedId);
          initializeSocket('user', unifiedId, authData.accessToken);
        }
      } else {
        // No ID available - just fetch verification status from Java Auth
        refreshVerificationStatus();
      }
      
      console.log('✅ [AppContext] Auth state updated successfully');

      // ── Analytics: registration vs login (all auth methods converge here;
      // isNewUser is set by every interactive auth call site). unifiedId is
      // guaranteed non-empty at this point (hard-return above) — never send
      // email/PII as the Meta user ID.
      Analytics.setUser(unifiedId);
      if (authData.isNewUser === true) {
        const regKey = `registered:${unifiedId}`;
        onceEver(regKey).then((first) => {
          if (first) {
            Analytics.track(EV.USER_REGISTERED, {
              role: type,
              method: authData.authMethod || 'unknown',
            });
            // Provider registration IS the profile submission (single-submit
            // form with services/experience/location) — no separate
            // "complete profile" state exists in the app.
            if (type === 'provider') {
              Analytics.track(EV.PROFILE_COMPLETED, { role: 'provider' });
            }
            Analytics.flush(); // conversion event — push immediately
          }
        });
      } else {
        Analytics.track(EV.LOGIN_SUCCESS, {
          role: type,
          method: authData.authMethod || 'unknown',
        });
      }

      return true;
    } catch (error) {
      console.error('❌ [AppContext] Failed to process auth success:', error);
      return false;
    }
  }, [refreshProfile, refreshVerificationStatus]);

  /**
   * Set user type during onboarding (before auth)
   * @param {string} type - 'user' or 'provider'
   */
  const selectUserType = useCallback(async (type) => {
    console.log(`📋 [AppContext] User type selected: ${type}`);
    setUserTypeState(type);
    await storeUserType(type);
  }, []);

  /**
   * Logout user and clear all data
   * Guarded against concurrent calls to prevent cascading resets during startup
   * @param {boolean} callApi - Whether to call logout API (default: true)
   */
  const logout = useCallback(async (callApi = true) => {
    if (logoutInProgressRef.current) {
      console.log('⚠️ [AppContext] Logout already in progress, skipping duplicate call');
      return;
    }
    logoutInProgressRef.current = true;
    try {
      console.log('🚪 [AppContext] Logging out...');

      // Analytics: detach user association from future events
      Analytics.clearUser();

      // Disconnect socket before clearing auth
      disconnectSocket();

      // Clear FCM token from backend so device stops receiving notifications (with retry)
      if (callApi) {
        const mongoId = user?.mongoId || user?._id || profile?.mongoId || profile?._id;
        if (mongoId && userType) {
          const { authFetch } = require('../utils/authFetch');
          const { NODE_BASE_URL } = require('../config/api');
          const endpoint = userType === 'provider'
            ? `${NODE_BASE_URL}/api/provider/${mongoId}/fcm-token`
            : `${NODE_BASE_URL}/api/user/${mongoId}/fcm-token`;
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const res = await authFetch(endpoint, {
                method: 'PATCH',
                body: JSON.stringify({ fcmToken: null }),
              });
              if (res.ok) break;
            } catch (e) {
              if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
            }
          }
        }
      }

      // Delete FCM token from device (unregisters from Firebase)
      try {
        await deleteFcmToken();
      } catch (fcmErr) {
        console.warn('⚠️ [AppContext] FCM token delete failed:', fcmErr.message);
      }

      // Sign out from Google to clear cached session
      try {
        await signOutFromGoogle();
      } catch (googleErr) {
        console.warn('⚠️ [AppContext] Google sign-out failed:', googleErr.message);
      }

      // Call logout API to revoke refresh token
      if (callApi) {
        const tokens = await getTokens();
        if (tokens?.refreshToken) {
          try {
            await apiLogout(tokens.refreshToken);
          } catch (apiError) {
            console.warn('⚠️ [AppContext] API logout failed:', apiError.message);
          }
        }
      }

      // Clear all local data
      await clearAllData();

      // Clear the persisted in-progress OTP step so a phone-OTP login + logout
      // does NOT reopen the OTP screen (instead of the login screen) on re-entry.
      try {
        const { clearPersistedAuthFlow } = require('../hooks/usePersistedAuthFlow');
        await clearPersistedAuthFlow();
      } catch (e) {
        // best-effort
      }

      // Reset state
      setUser(null);
      setUserTypeState(null);
      setProfile(null);
      setIsAuthenticated(false);
      setAadhaarStatus({ isVerified: false, isNameLocked: false, aadhaarName: null, aadhaarLoaded: false });
      setPremiumStatus({ isPremiumActive: false, premiumDaysLeft: 0, premiumLoaded: false });
      
      console.log('✅ [AppContext] Logout successful');
    } catch (error) {
      console.error('❌ [AppContext] Logout failed:', error);

      // Force reset state even on error
      setUser(null);
      setUserTypeState(null);
      setProfile(null);
      setIsAuthenticated(false);
      setAadhaarStatus({ isVerified: false, isNameLocked: false, aadhaarName: null, aadhaarLoaded: false });
      setPremiumStatus({ isPremiumActive: false, premiumDaysLeft: 0, premiumLoaded: false });
    } finally {
      logoutInProgressRef.current = false;
    }
  }, []);

  /**
   * Mark initial load as complete (called after splash screen finishes).
   * This enables aggressive account-not-found logout in refreshProfile
   * which is suppressed during startup to prevent race conditions.
   */
  const markInitialLoadComplete = useCallback(() => {
    isInitialLoadRef.current = false;
    console.log('✅ [AppContext] Initial load complete — account checks now active');
  }, []);

  /**
   * Context value
   */
  const value = useMemo(() => ({
    // Auth state
    isAuthenticated,
    isAuthLoading,
    user,
    userType,

    // Profile state
    profile,
    isProfileLoading,

    // Auth infrastructure state (Phase 4)
    authHealth,
    activeSessions,

    // Auth actions
    handleAuthSuccess,
    selectUserType,
    logout,

    // Profile actions
    refreshProfile,
    refreshVerificationStatus,
    updateProviderAvailability,
    updateProviderLocationTracking,

    // Profile sync actions (Phase 3)
    syncProfileIfNeeded,
    updateProfileWithAutoSync,

    // Auth health actions (Phase 4)
    checkHealth,

    // Aadhaar / KYC status (cached in context to prevent flicker)
    aadhaarStatus,
    setAadhaarStatus,

    // Premium subscription status (cached in context to prevent flicker)
    premiumStatus,
    setPremiumStatus,

    // Re-initialize (useful for token refresh)
    initializeAuth,

    // Lifecycle
    markInitialLoadComplete,
  }), [
    isAuthenticated, isAuthLoading, user, userType,
    profile, isProfileLoading,
    authHealth, activeSessions,
    handleAuthSuccess, selectUserType, logout,
    refreshProfile, refreshVerificationStatus,
    updateProviderAvailability, updateProviderLocationTracking,
    syncProfileIfNeeded, updateProfileWithAutoSync,
    checkHealth,
    aadhaarStatus, setAadhaarStatus,
    premiumStatus, setPremiumStatus,
    initializeAuth, markInitialLoadComplete,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

/**
 * @typedef {object} AppContextValue
 * @property {boolean} isAuthenticated
 * @property {boolean} isAuthLoading
 * @property {object|null} user
 * @property {string|null} userType
 * @property {object|null} profile
 * @property {boolean} isProfileLoading
 * @property {object|null} authHealth
 * @property {Array} activeSessions
 * @property {(authData: object) => Promise<boolean>} handleAuthSuccess
 * @property {(type: string) => Promise<void>} selectUserType
 * @property {(clearTokens?: boolean) => Promise<void>} logout
 * @property {(type?: string, mongoId?: string, opts?: {force?: boolean}) => Promise<object|null>} refreshProfile
 * @property {() => Promise<void>} refreshVerificationStatus
 * @property {(isAvailable: boolean, optimistic?: boolean) => Promise<{success: boolean}>} updateProviderAvailability
 * @property {(enabled: boolean) => Promise<void>} updateProviderLocationTracking
 * @property {() => Promise<object>} syncProfileIfNeeded
 * @property {(type: string, mongoId: string, updates: object) => Promise<object>} updateProfileWithAutoSync
 * @property {() => Promise<object>} checkHealth
 * @property {{isVerified: boolean, isNameLocked: boolean, aadhaarName: string|null, aadhaarLoaded: boolean}} aadhaarStatus
 * @property {(status: object) => void} setAadhaarStatus
 * @property {{isPremiumActive: boolean, premiumDaysLeft: number, premiumLoaded: boolean}} premiumStatus
 * @property {(status: object) => void} setPremiumStatus
 * @property {() => Promise<void>} initializeAuth
 * @property {() => void} markInitialLoadComplete
 */

/**
 * Hook to access app context
 * @returns {AppContextValue} App context value
 */
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export default AppContext;
