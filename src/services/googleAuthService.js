/**
 * Google Authentication Service
 * 
 * Handles Google Sign-In using @react-native-google-signin/google-signin SDK.
 * 
 * Flow:
 * 1. Initialize Google Sign-In with client IDs
 * 2. User taps "Sign in with Google"
 * 3. Google Sign-In UI appears
 * 4. User authenticates with Google
 * 5. SDK returns Google ID token
 * 6. Send ID token to JARBAC backend: POST /api/auth/oauth2/google/mobile
 * 7. Backend verifies token and returns FixHomi JWT tokens
 * 8. Store tokens and navigate to main app
 * 
 * @module googleAuthService
 */

import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import client from '../api/client';
import tokenService from './tokenService';

// Google Cloud Console Client IDs
// IMPORTANT: Replace these with your actual client IDs from Google Cloud Console
const GOOGLE_WEB_CLIENT_ID = '524781184814-nkbud6c3r44b1plqpm77p27ejfi3de3j.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '524781184814-381pquihbspvu31si5ea2ecreqs3d824.apps.googleusercontent.com';

/**
 * Service state
 */
let isInitialized = false;
let initializationError = null;

/**
 * Initialize Google Sign-In SDK
 * Must be called before any sign-in attempts
 * 
 * @returns {Promise<boolean>} - True if initialization successful
 */
export const initializeGoogleSignIn = async () => {
  try {
    console.log('🔧 [GoogleAuth] Initializing Google Sign-In...');
    
    GoogleSignin.configure({
      // Web Client ID (required for server-side verification)
      webClientId: GOOGLE_WEB_CLIENT_ID,
      
      // iOS Client ID (required for iOS)
      ...(Platform.OS === 'ios' && GOOGLE_IOS_CLIENT_ID !== 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com' && {
        iosClientId: GOOGLE_IOS_CLIENT_ID,
      }),
      
      // Request offline access for refresh tokens
      offlineAccess: true,
      
      // Force account selection even if one account is already signed in
      forceCodeForRefreshToken: true,
      
      // Scopes we need
      scopes: ['email', 'profile'],
    });
    
    isInitialized = true;
    initializationError = null;
    console.log('✅ [GoogleAuth] Google Sign-In initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ [GoogleAuth] Failed to initialize Google Sign-In:', error);
    isInitialized = false;
    initializationError = error;
    return false;
  }
};

/**
 * Check if Google Sign-In is available and properly configured
 * 
 * @returns {Promise<boolean>} - True if Google Sign-In is available
 */
export const isGoogleSignInAvailable = async () => {
  try {
    // Check if Google Play Services is available (Android only)
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    return true;
  } catch (error) {
    console.warn('⚠️ [GoogleAuth] Google Sign-In not available:', error.message);
    return false;
  }
};

/**
 * Sign in with Google
 * 
 * @param {Object} options - Sign-in options
 * @param {string} options.userType - 'user' or 'provider' (for role assignment on first login)
 * @returns {Promise<Object>} - Login response with tokens and user info
 * @throws {Error} - If sign-in fails
 */
export const signInWithGoogle = async ({ userType = 'user' } = {}) => {
  console.log('🔐 [GoogleAuth] Starting Google Sign-In...');
  
  // Ensure SDK is initialized
  if (!isInitialized) {
    const initialized = await initializeGoogleSignIn();
    if (!initialized) {
      throw new Error('Google Sign-In is not properly configured. Please try again later.');
    }
  }
  
  try {
    // Check Google Play Services availability
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Attempt sign-in
    console.log('📱 [GoogleAuth] Opening Google Sign-In dialog...');
    const userInfo = await GoogleSignin.signIn();
    
    console.log('✅ [GoogleAuth] Google Sign-In successful');
    console.log('👤 [GoogleAuth] User:', userInfo.data?.user?.email);
    
    // Get the ID token
    const idToken = userInfo.data?.idToken;
    
    if (!idToken) {
      console.error('❌ [GoogleAuth] No ID token received from Google');
      throw new Error('Failed to get authentication token from Google. Please try again.');
    }
    
    console.log('🔑 [GoogleAuth] ID token received, authenticating with backend...');
    
    // Send ID token to JARBAC backend for verification and JWT issuance
    const response = await client.googleMobileAuth(idToken);
    
    console.log('✅ [GoogleAuth] Backend authentication successful');
    console.log('👤 [GoogleAuth] User ID:', response.userId);
    console.log('📧 [GoogleAuth] Email:', response.email);
    console.log('🎭 [GoogleAuth] Role:', response.role);
    
    return {
      ...response,
      isNewUser: !response.lastLoginAt, // First-time Google user
      googleUser: userInfo.data?.user,
    };
    
  } catch (error) {
    console.error('❌ [GoogleAuth] Sign-in error:', error);
    
    // Handle specific error codes
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Sign-in cancelled');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Sign-in already in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services not available. Please update or install Google Play Services.');
    } else {
      // Re-throw the error with a user-friendly message
      throw new Error(error.message || 'Failed to sign in with Google. Please try again.');
    }
  }
};

/**
 * Sign out from Google
 * This only signs out from Google, not from the app
 * 
 * @returns {Promise<void>}
 */
export const signOutFromGoogle = async () => {
  try {
    const isSignedIn = await GoogleSignin.isSignedIn();
    if (isSignedIn) {
      await GoogleSignin.signOut();
      console.log('✅ [GoogleAuth] Signed out from Google');
    }
  } catch (error) {
    console.warn('⚠️ [GoogleAuth] Error signing out from Google:', error.message);
    // Don't throw - sign out should not fail the app logout
  }
};

/**
 * Revoke Google access
 * This removes the app's access to the user's Google account
 * 
 * @returns {Promise<void>}
 */
export const revokeGoogleAccess = async () => {
  try {
    const isSignedIn = await GoogleSignin.isSignedIn();
    if (isSignedIn) {
      await GoogleSignin.revokeAccess();
      console.log('✅ [GoogleAuth] Google access revoked');
    }
  } catch (error) {
    console.warn('⚠️ [GoogleAuth] Error revoking Google access:', error.message);
  }
};

/**
 * Get currently signed-in Google user
 * 
 * @returns {Promise<Object|null>} - Google user info or null
 */
export const getCurrentGoogleUser = async () => {
  try {
    const isSignedIn = await GoogleSignin.isSignedIn();
    if (isSignedIn) {
      const currentUser = await GoogleSignin.getCurrentUser();
      return currentUser?.data?.user || null;
    }
    return null;
  } catch (error) {
    console.warn('⚠️ [GoogleAuth] Error getting current user:', error.message);
    return null;
  }
};

/**
 * Check if user is signed in with Google
 * 
 * @returns {Promise<boolean>}
 */
export const isGoogleSignedIn = async () => {
  try {
    return await GoogleSignin.isSignedIn();
  } catch (error) {
    return false;
  }
};

/**
 * Get initialization status
 * 
 * @returns {{ isInitialized: boolean, error: Error|null }}
 */
export const getInitializationStatus = () => ({
  isInitialized,
  error: initializationError,
});

// Export as default object for convenience
const googleAuthService = {
  initialize: initializeGoogleSignIn,
  isAvailable: isGoogleSignInAvailable,
  signIn: signInWithGoogle,
  signOut: signOutFromGoogle,
  revokeAccess: revokeGoogleAccess,
  getCurrentUser: getCurrentGoogleUser,
  isSignedIn: isGoogleSignedIn,
  getStatus: getInitializationStatus,
};

export default googleAuthService;
