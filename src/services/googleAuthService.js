/**
 * Google Auth Service
 * 
 * Handles Google Sign-In integration for React Native
 * Uses @react-native-google-signin/google-signin
 * 
 * @version 1.0.0
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In
const configureGoogleSignIn = () => {
  try {
    GoogleSignin.configure({
      // Get webClientId from Google Cloud Console
      webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Replace with actual client ID
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
    console.log('✅ [GoogleAuth] Configured successfully');
  } catch (error) {
    console.error('❌ [GoogleAuth] Configuration failed:', error);
  }
};

// Initialize on module load
configureGoogleSignIn();

const googleAuthService = {
  /**
   * Sign in with Google
   * @returns {Promise<Object>} - User info and ID token
   */
  signIn: async () => {
    try {
      console.log('🔐 [GoogleAuth] Starting sign-in...');

      // Check if Google Play Services are available (Android only)
      await GoogleSignin.hasPlayServices();

      // Perform sign-in
      const userInfo = await GoogleSignin.signIn();
      
      console.log('✅ [GoogleAuth] Sign-in successful:', userInfo.user.email);

      // Get ID token for backend verification
      const tokens = await GoogleSignin.getTokens();

      return {
        user: userInfo.user,
        idToken: tokens.idToken,
        accessToken: tokens.accessToken,
      };
    } catch (error) {
      console.error('❌ [GoogleAuth] Sign-in failed:', error);

      // Handle specific error codes
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Sign-in was cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        throw new Error('Sign-in already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services not available');
      }

      throw error;
    }
  },

  /**
   * Sign out from Google
   */
  signOut: async () => {
    try {
      await GoogleSignin.signOut();
      console.log('✅ [GoogleAuth] Sign-out successful');
    } catch (error) {
      console.error('❌ [GoogleAuth] Sign-out failed:', error);
      throw error;
    }
  },

  /**
   * Check if user is currently signed in with Google
   */
  isSignedIn: async () => {
    try {
      return await GoogleSignin.isSignedIn();
    } catch (error) {
      console.error('❌ [GoogleAuth] Error checking sign-in status:', error);
      return false;
    }
  },

  /**
   * Get current user info
   */
  getCurrentUser: async () => {
    try {
      return await GoogleSignin.getCurrentUser();
    } catch (error) {
      console.error('❌ [GoogleAuth] Error getting current user:', error);
      return null;
    }
  },

  /**
   * Revoke access (sign out + revoke tokens)
   */
  revokeAccess: async () => {
    try {
      await GoogleSignin.revokeAccess();
      console.log('✅ [GoogleAuth] Access revoked');
    } catch (error) {
      console.error('❌ [GoogleAuth] Error revoking access:', error);
      throw error;
    }
  },
};

export default googleAuthService;
