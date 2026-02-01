/**
 * Google Auth Service
 * 
 * Handles Google OAuth Sign-In for both Users and Service Providers
 * - Configures Google Sign-In SDK
 * - Handles Google token exchange with Java Auth backend
 * - Supports role selection during signup (USER or SERVICE_PROVIDER)
 * - Manages profile sync with MongoDB via Node.js backend
 * 
 * IMPORTANT: One email = One account type
 * - If a user registers as USER, they cannot later register as PROVIDER
 * - The Java Auth backend enforces this constraint
 * 
 * @version 1.0.0
 */

import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { authClient, parseApiError } from './apiClient';
import apiClient from './apiClient';
import { ENDPOINTS } from '../config/api';

// ==================== CONFIGURATION ====================

/**
 * Google Sign-In Web Client ID
 * This is the Web Client ID from Google Cloud Console
 * Required for getting ID token that Java backend can verify
 * 
 * Web Client ID is used by the mobile app to request an ID token
 * that can be verified by the Java backend
 */
const GOOGLE_WEB_CLIENT_ID = '524781184814-nkbud6c3r44b1plqpm77p27ejfi3de3j.apps.googleusercontent.com';

/**
 * iOS Client ID - Used for iOS Google Sign-In
 * This should also be configured in ios/renfi/Info.plist
 */
const GOOGLE_IOS_CLIENT_ID = '524781184814-381pquihbspvu31si5ea2ecreqs3d824.apps.googleusercontent.com';

/**
 * Role types for Google OAuth registration
 */
export const GOOGLE_AUTH_ROLES = {
  USER: 'USER',
  SERVICE_PROVIDER: 'SERVICE_PROVIDER',
};

/**
 * Error codes specific to Google Auth
 */
export const GOOGLE_AUTH_CODES = {
  // Success
  SIGN_IN_SUCCESS: 'GOOGLE_SIGN_IN_SUCCESS',
  
  // User cancelled
  SIGN_IN_CANCELLED: 'GOOGLE_SIGN_IN_CANCELLED',
  
  // Play Services not available
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  
  // Already in progress
  IN_PROGRESS: 'GOOGLE_SIGN_IN_IN_PROGRESS',
  
  // No ID token received
  NO_ID_TOKEN: 'NO_GOOGLE_ID_TOKEN',
  
  // Role conflict - email already registered as different role
  ROLE_CONFLICT: 'GOOGLE_AUTH_ROLE_CONFLICT',
  
  // Account already exists with password
  ACCOUNT_EXISTS_WITH_PASSWORD: 'ACCOUNT_EXISTS_WITH_PASSWORD',
  
  // General error
  SIGN_IN_FAILED: 'GOOGLE_SIGN_IN_FAILED',
  
  // Backend errors
  BACKEND_ERROR: 'GOOGLE_AUTH_BACKEND_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
};

// ==================== INITIALIZATION ====================

let isConfigured = false;

/**
 * Configure Google Sign-In SDK
 * Must be called once before using any Google Sign-In methods
 * Typically called in App.js or during app initialization
 * 
 * @returns {void}
 */
export const configureGoogleSignIn = () => {
  if (isConfigured) {
    console.log('🔵 [GoogleAuth] Already configured');
    return;
  }

  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID, // Required for iOS
      offlineAccess: true, // For refresh tokens
      forceCodeForRefreshToken: true, // Get authorization code for refresh
    });
    
    isConfigured = true;
    console.log('✅ [GoogleAuth] Google Sign-In configured');
  } catch (error) {
    console.error('❌ [GoogleAuth] Configuration failed:', error);
  }
};

/**
 * Check if user is already signed in to Google
 * 
 * @returns {Promise<boolean>} True if user has an active Google session
 */
export const isGoogleSignedIn = async () => {
  try {
    const currentUser = await GoogleSignin.getCurrentUser();
    return currentUser !== null;
  } catch (error) {
    console.log('🔵 [GoogleAuth] No current Google user');
    return false;
  }
};

/**
 * Get current Google user info (if signed in)
 * 
 * @returns {Promise<Object|null>} User info or null
 */
export const getCurrentGoogleUser = async () => {
  try {
    const currentUser = await GoogleSignin.getCurrentUser();
    return currentUser;
  } catch (error) {
    return null;
  }
};

// ==================== SIGN IN ====================

/**
 * Sign in with Google and authenticate with FixHomi backend
 * 
 * Flow:
 * 1. User clicks Google Sign-In button
 * 2. Google SDK shows account picker
 * 3. User selects account, grants permissions
 * 4. We get Google ID token
 * 5. Send ID token + role to Java Auth backend
 * 6. Backend verifies token, creates/finds user, returns FixHomi JWT tokens
 * 7. If new user, sync profile to MongoDB via Node.js backend
 * 
 * @param {string} role - 'USER' or 'SERVICE_PROVIDER' (defaults to 'USER')
 * @returns {Promise<Object>} Auth response with tokens and user info
 */
export const signInWithGoogle = async (role = GOOGLE_AUTH_ROLES.USER) => {
  try {
    // Ensure Google Sign-In is configured
    if (!isConfigured) {
      configureGoogleSignIn();
    }

    console.log('🔐 [GoogleAuth] Starting Google Sign-In for role:', role);

    // Check for Google Play Services
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Perform sign in
    const signInResult = await GoogleSignin.signIn();
    
    console.log('📧 [GoogleAuth] Google Sign-In successful:', signInResult.data?.user?.email);

    // Get ID token - this is what the backend needs
    const idToken = signInResult.data?.idToken;
    
    if (!idToken) {
      console.error('❌ [GoogleAuth] No ID token in sign-in result');
      return {
        success: false,
        error: {
          code: GOOGLE_AUTH_CODES.NO_ID_TOKEN,
          message: 'Failed to get Google ID token. Please try again.',
        },
      };
    }

    // Exchange Google token for FixHomi tokens
    const authResult = await exchangeGoogleTokenForAuth(idToken, role);
    
    return authResult;

  } catch (error) {
    return handleGoogleSignInError(error);
  }
};

/**
 * Sign in with Google as a User (regular customer)
 * Convenience wrapper for signInWithGoogle('USER')
 * 
 * @returns {Promise<Object>} Auth response
 */
export const signInWithGoogleAsUser = async () => {
  return signInWithGoogle(GOOGLE_AUTH_ROLES.USER);
};

/**
 * Sign in with Google as a Service Provider
 * Convenience wrapper for signInWithGoogle('SERVICE_PROVIDER')
 * 
 * @returns {Promise<Object>} Auth response
 */
export const signInWithGoogleAsProvider = async () => {
  return signInWithGoogle(GOOGLE_AUTH_ROLES.SERVICE_PROVIDER);
};

// ==================== TOKEN EXCHANGE ====================

/**
 * Exchange Google ID token for FixHomi JWT tokens
 * Calls the Java Auth backend endpoint
 * 
 * @param {string} idToken - Google ID token
 * @param {string} role - 'USER' or 'SERVICE_PROVIDER'
 * @returns {Promise<Object>} Auth response with tokens
 */
const exchangeGoogleTokenForAuth = async (idToken, role) => {
  try {
    console.log('🔄 [GoogleAuth] Exchanging Google token for FixHomi auth...');

    const response = await authClient.post(ENDPOINTS.OAUTH.GOOGLE_MOBILE, {
      idToken,
      role, // Backend will use this for new user creation
    });

    // Java Auth returns user data at top level, not nested in 'user' object
    const { accessToken, refreshToken, userId, email, fullName, role: userRole, isNewUser } = response.data;

    // Build user object from flat response
    const user = {
      userId,
      email,
      fullName,
      role: userRole,
    };

    console.log('✅ [GoogleAuth] Token exchange successful');
    console.log('   - Is new user:', isNewUser);
    console.log('   - User role:', user?.role);
    console.log('   - User ID:', user?.userId);

    // If this is a new user, we may need to create their MongoDB profile
    if (isNewUser) {
      console.log('🆕 [GoogleAuth] New user registered via Google');
      // The MongoDB profile sync should be handled by the caller
      // They'll need additional info like phone, address for providers
    }

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        user,
        isNewUser: isNewUser || false,
        authMethod: 'google',
      },
    };

  } catch (error) {
    console.error('❌ [GoogleAuth] Token exchange failed:', error);
    
    const parsedError = parseApiError(error);
    
    // Check for specific role conflict error
    if (error.response?.data?.code === 'ROLE_CONFLICT' || 
        error.response?.data?.message?.includes('already registered')) {
      const existingRole = error.response?.data?.existingRole || 'different account type';
      return {
        success: false,
        error: {
          code: GOOGLE_AUTH_CODES.ROLE_CONFLICT,
          message: `This email is already registered as a ${existingRole}. Each email can only be used for one account type.`,
          existingRole: existingRole,
        },
      };
    }

    // Check for account exists with password
    if (error.response?.data?.code === 'ACCOUNT_EXISTS' || 
        error.response?.data?.message?.includes('password')) {
      return {
        success: false,
        error: {
          code: GOOGLE_AUTH_CODES.ACCOUNT_EXISTS_WITH_PASSWORD,
          message: 'An account with this email already exists. Please login with your password instead.',
        },
      };
    }

    return {
      success: false,
      error: {
        code: GOOGLE_AUTH_CODES.BACKEND_ERROR,
        message: parsedError.message || 'Authentication failed. Please try again.',
        originalError: parsedError,
      },
    };
  }
};

// ==================== SIGN OUT ====================

/**
 * Sign out from Google
 * This only signs out from Google, not from FixHomi
 * Use the regular logout function in authService for full logout
 * 
 * @returns {Promise<void>}
 */
export const signOutFromGoogle = async () => {
  try {
    await GoogleSignin.signOut();
    console.log('✅ [GoogleAuth] Signed out from Google');
  } catch (error) {
    console.error('❌ [GoogleAuth] Sign out failed:', error);
  }
};

/**
 * Revoke Google access
 * Completely removes the app's access to the user's Google account
 * User will need to grant permissions again on next sign-in
 * 
 * @returns {Promise<void>}
 */
export const revokeGoogleAccess = async () => {
  try {
    await GoogleSignin.revokeAccess();
    console.log('✅ [GoogleAuth] Google access revoked');
  } catch (error) {
    console.error('❌ [GoogleAuth] Revoke access failed:', error);
  }
};

// ==================== MONGODB PROFILE SYNC ====================

/**
 * Sync Google user profile to MongoDB
 * Called after successful Google Sign-In for new users
 * 
 * @param {Object} userData - User data from Google Sign-In + Java Auth
 * @param {string} userData.javaUserId - Java Auth user ID (required)
 * @param {string} userData.email - User email (required)
 * @param {string} userData.fullName - User's full name from Google
 * @param {string} userData.googleId - Google user ID
 * @param {string} userData.profilePicture - Google profile picture URL
 * @returns {Promise<Object>} MongoDB profile creation response
 */
export const syncGoogleUserToMongoDB = async (userData) => {
  try {
    console.log('📝 [GoogleAuth] Syncing user profile to MongoDB...');

    const response = await apiClient.post('/api/auth/google/sync-user', {
      javaUserId: userData.javaUserId,
      email: userData.email,
      fullName: userData.fullName,
      googleId: userData.googleId,
      profilePicture: userData.profilePicture,
    });

    console.log('✅ [GoogleAuth] User profile synced to MongoDB');
    return {
      success: true,
      data: response.data,
    };

  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [GoogleAuth] Failed to sync user profile:', parsedError);
    
    return {
      success: false,
      error: parsedError,
      // Don't fail the auth - user can still use the app
      // Profile can be synced later
    };
  }
};

/**
 * Create user profile in MongoDB for Google OAuth user
 * @deprecated Use syncGoogleUserToMongoDB instead
 */
export const createUserProfileFromGoogle = async (userData) => {
  return syncGoogleUserToMongoDB(userData);
};

/**
 * Sync Google provider profile to MongoDB
 * Called after successful Google Sign-In for new providers
 * Requires additional provider info (address, service categories, etc.)
 * 
 * @param {Object} providerData - Provider data
 * @param {string} providerData.javaUserId - Java Auth user ID (required)
 * @param {string} providerData.email - Provider email (required)
 * @param {string} providerData.name - Business name (required)
 * @param {string} providerData.address - Business address (required)
 * @param {string} providerData.googleId - Google user ID
 * @param {string} providerData.profilePicture - Google profile picture URL
 * @param {Array} providerData.serviceCategories - Service categories (optional)
 * @param {string} providerData.phone - Phone number (optional)
 * @param {Object} providerData.location - Location coordinates (optional)
 * @returns {Promise<Object>} MongoDB profile creation response
 */
export const syncGoogleProviderToMongoDB = async (providerData) => {
  try {
    console.log('📝 [GoogleAuth] Syncing provider profile to MongoDB...');

    const response = await apiClient.post('/api/auth/google/sync-provider', {
      javaUserId: providerData.javaUserId,
      email: providerData.email,
      name: providerData.name,
      address: providerData.address,
      serviceCategories: providerData.serviceCategories,
      phone: providerData.phone,
      city: providerData.city,
      pincode: providerData.pincode,
      latitude: providerData.latitude,
      longitude: providerData.longitude,
      googleId: providerData.googleId,
      profilePicture: providerData.profilePicture,
    });

    console.log('✅ [GoogleAuth] Provider profile synced to MongoDB');
    return {
      success: true,
      data: response.data,
    };

  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [GoogleAuth] Failed to sync provider profile:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Create provider profile in MongoDB for Google OAuth provider
 * @deprecated Use syncGoogleProviderToMongoDB instead
 */
export const createProviderProfileFromGoogle = async (providerData) => {
  return syncGoogleProviderToMongoDB(providerData);
};

// ==================== ERROR HANDLING ====================

/**
 * Handle Google Sign-In errors and return standardized response
 * 
 * @param {Error} error - Google Sign-In error
 * @returns {Object} Standardized error response
 */
const handleGoogleSignInError = (error) => {
  console.error('❌ [GoogleAuth] Sign-in error:', error);

  // User cancelled the sign-in
  if (error.code === statusCodes.SIGN_IN_CANCELLED) {
    return {
      success: false,
      error: {
        code: GOOGLE_AUTH_CODES.SIGN_IN_CANCELLED,
        message: 'Sign-in was cancelled.',
        isCancelled: true,
      },
    };
  }

  // Sign-in already in progress
  if (error.code === statusCodes.IN_PROGRESS) {
    return {
      success: false,
      error: {
        code: GOOGLE_AUTH_CODES.IN_PROGRESS,
        message: 'Sign-in already in progress. Please wait.',
      },
    };
  }

  // Play services not available (Android only)
  if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return {
      success: false,
      error: {
        code: GOOGLE_AUTH_CODES.PLAY_SERVICES_NOT_AVAILABLE,
        message: 'Google Play Services is not available. Please update or install Google Play Services.',
      },
    };
  }

  // Generic error
  return {
    success: false,
    error: {
      code: GOOGLE_AUTH_CODES.SIGN_IN_FAILED,
      message: error.message || 'Google Sign-In failed. Please try again.',
    },
  };
};

// ==================== USER-FRIENDLY MESSAGES ====================

/**
 * Get user-friendly error message for Google Auth errors
 * 
 * @param {string} code - Error code
 * @param {string} defaultMessage - Default message if code not found
 * @returns {string} User-friendly error message
 */
export const getGoogleAuthErrorMessage = (code, defaultMessage) => {
  const messages = {
    [GOOGLE_AUTH_CODES.SIGN_IN_CANCELLED]: 'You cancelled the sign-in.',
    [GOOGLE_AUTH_CODES.PLAY_SERVICES_NOT_AVAILABLE]: 'Google Play Services is not available. Please update your device.',
    [GOOGLE_AUTH_CODES.IN_PROGRESS]: 'Please wait, sign-in is in progress.',
    [GOOGLE_AUTH_CODES.NO_ID_TOKEN]: 'Could not get your Google account information. Please try again.',
    [GOOGLE_AUTH_CODES.ROLE_CONFLICT]: 'This email is already registered with a different account type.',
    [GOOGLE_AUTH_CODES.ACCOUNT_EXISTS_WITH_PASSWORD]: 'An account with this email already exists. Please login with your password.',
    [GOOGLE_AUTH_CODES.SIGN_IN_FAILED]: 'Google Sign-In failed. Please try again.',
    [GOOGLE_AUTH_CODES.BACKEND_ERROR]: 'Could not complete sign-in. Please try again.',
    [GOOGLE_AUTH_CODES.NETWORK_ERROR]: 'No internet connection. Please check your network.',
  };

  return messages[code] || defaultMessage || 'An error occurred. Please try again.';
};

// ==================== EXPORTS ====================

export default {
  // Configuration
  configureGoogleSignIn,
  GOOGLE_WEB_CLIENT_ID,
  
  // Status checks
  isGoogleSignedIn,
  getCurrentGoogleUser,
  
  // Sign In
  signInWithGoogle,
  signInWithGoogleAsUser,
  signInWithGoogleAsProvider,
  
  // Sign Out
  signOutFromGoogle,
  revokeGoogleAccess,
  
  // MongoDB Profile Sync (new)
  syncGoogleUserToMongoDB,
  syncGoogleProviderToMongoDB,
  
  // MongoDB Profile Sync (deprecated - kept for backward compatibility)
  createUserProfileFromGoogle,
  createProviderProfileFromGoogle,
  
  // Error handling
  getGoogleAuthErrorMessage,
  
  // Constants
  GOOGLE_AUTH_ROLES,
  GOOGLE_AUTH_CODES,
};
