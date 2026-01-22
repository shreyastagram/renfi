/**
 * App Context
 * 
 * Global application state management using React Context
 * Handles authentication state, user data, and app-wide state
 * 
 * @version 3.0.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  storeTokens, 
  storeUserData, 
  getUserData, 
  getTokens, 
  clearAllData,
  storeUserType,
  getUserType 
} from '../utils/storage';
import { logout as apiLogout } from '../services/authService';
import { fetchFullProfile, getCurrentUser } from '../services/profileService';
import { saveFcmTokenForUser, saveFcmTokenForProvider, setupForegroundMessageListener, setupTokenRefreshListener } from '../services/fcmService';

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

  /**
   * Initialize auth state on app load
   */
  useEffect(() => {
    initializeAuth();
    
    // Set up global handler for auth expiry (called from apiClient)
    global.onAuthExpired = handleAuthExpired;
    
    return () => {
      global.onAuthExpired = null;
    };
  }, []);

  /**
   * Handle auth expiry (token refresh failed)
   */
  const handleAuthExpired = useCallback(async () => {
    console.log('⚠️ [AppContext] Auth expired, logging out...');
    await clearAllData();
    setUser(null);
    setUserTypeState(null);
    setProfile(null);
    setIsAuthenticated(false);
  }, []);

  /**
   * Refresh profile data from APIs
   * @param {string} type - User type ('user' or 'provider')
   * @param {string} mongoId - MongoDB document ID
   */
  const refreshProfile = useCallback(async (type, mongoId) => {
    try {
      console.log('🔄 [AppContext] Refreshing profile...');
      setIsProfileLoading(true);
      
      const result = await fetchFullProfile(type, mongoId);
      
      if (result.success) {
        setProfile(result.data);
        
        // Update user state with verification status
        setUser(prev => ({
          ...prev,
          isEmailVerified: result.data.isEmailVerified,
          isPhoneVerified: result.data.isPhoneVerified,
        }));
        
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
      setIsProfileLoading(false);
    }
  }, []);

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
        }));
        
        // Also update profile state
        setProfile(prev => ({
          ...prev,
          email: data.email || prev?.email,
          fullName: data.fullName || prev?.fullName,
          phone: data.phoneNumber || prev?.phone, // Map phoneNumber to phone
          isEmailVerified: data.isEmailVerified ?? false,
          isPhoneVerified: data.isPhoneVerified ?? false,
          isActive: data.isActive ?? true,
          role: data.role || prev?.role,
        }));
        
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
   * Check stored tokens and restore auth state
   */
  const initializeAuth = async () => {
    try {
      console.log('🔄 [AppContext] Initializing auth state...');
      
      const [tokens, storedUserData, storedUserType] = await Promise.all([
        getTokens(),
        getUserData(),
        getUserType(),
      ]);

      if (tokens?.accessToken && storedUserData) {
        console.log('✅ [AppContext] Found stored session');
        setUser(storedUserData);
        setUserTypeState(storedUserType);
        setIsAuthenticated(true);
        
        // Fetch fresh profile data in background
        if (storedUserData.mongoId) {
          refreshProfile(storedUserType, storedUserData.mongoId);
        } else {
          // At least refresh verification status
          refreshVerificationStatus();
        }
      } else {
        console.log('ℹ️ [AppContext] No stored session found');
      }
    } catch (error) {
      console.error('❌ [AppContext] Auth initialization failed:', error);
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
      console.log('🔐 [AppContext] Processing auth success...', authData);
      
      // Store tokens securely
      await storeTokens(authData.accessToken, authData.refreshToken);
      
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
      } else {
        // No ID available - just fetch verification status from Java Auth
        refreshVerificationStatus();
      }
      
      console.log('✅ [AppContext] Auth state updated successfully');
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
   * @param {boolean} callApi - Whether to call logout API (default: true)
   */
  const logout = useCallback(async (callApi = true) => {
    try {
      console.log('🚪 [AppContext] Logging out...');
      
      // Call logout API to revoke refresh token
      if (callApi) {
        const tokens = await getTokens();
        if (tokens?.refreshToken) {
          try {
            await apiLogout(tokens.refreshToken);
          } catch (apiError) {
            // Continue with local logout even if API fails
            console.warn('⚠️ [AppContext] API logout failed:', apiError.message);
          }
        }
      }
      
      // Clear all local data
      await clearAllData();
      
      // Reset state
      setUser(null);
      setUserTypeState(null);
      setProfile(null);
      setIsAuthenticated(false);
      
      console.log('✅ [AppContext] Logout successful');
    } catch (error) {
      console.error('❌ [AppContext] Logout failed:', error);
      
      // Force reset state even on error
      setUser(null);
      setUserTypeState(null);
      setProfile(null);
      setIsAuthenticated(false);
    }
  }, []);

  /**
   * Context value
   */
  const value = {
    // Auth state
    isAuthenticated,
    isAuthLoading,
    user,
    userType,
    
    // Profile state
    profile,
    isProfileLoading,
    
    // Auth actions
    handleAuthSuccess,
    selectUserType,
    logout,
    
    // Profile actions
    refreshProfile,
    refreshVerificationStatus,
    
    // Re-initialize (useful for token refresh)
    initializeAuth,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

/**
 * Hook to access app context
 * @returns {Object} App context value
 */
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export default AppContext;
