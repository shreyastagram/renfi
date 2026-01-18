/**
 * Token Service - Secure Storage for JWT Tokens
 * 
 * Uses react-native-keychain for secure token storage on iOS Keychain / Android Keystore
 * 
 * @version 1.0.0
 */

import * as Keychain from 'react-native-keychain';

// Keychain service keys
const ACCESS_TOKEN_SERVICE = 'com.fixhomi.accessToken';
const REFRESH_TOKEN_SERVICE = 'com.fixhomi.refreshToken';
const USER_DATA_SERVICE = 'com.fixhomi.userData';

const tokenService = {
  /**
   * Save the access token securely
   */
  saveAccessToken: async (token) => {
    try {
      await Keychain.setGenericPassword('accessToken', token, {
        service: ACCESS_TOKEN_SERVICE,
      });
      console.log('✅ [TokenService] Access token saved');
    } catch (error) {
      console.error('❌ [TokenService] Error saving access token:', error);
      throw error;
    }
  },

  /**
   * Get the access token
   */
  getAccessToken: async () => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: ACCESS_TOKEN_SERVICE,
      });
      if (credentials) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      console.error('❌ [TokenService] Error getting access token:', error);
      return null;
    }
  },

  /**
   * Save the refresh token securely
   */
  saveRefreshToken: async (token) => {
    try {
      await Keychain.setGenericPassword('refreshToken', token, {
        service: REFRESH_TOKEN_SERVICE,
      });
      console.log('✅ [TokenService] Refresh token saved');
    } catch (error) {
      console.error('❌ [TokenService] Error saving refresh token:', error);
      throw error;
    }
  },

  /**
   * Get the refresh token
   */
  getRefreshToken: async () => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: REFRESH_TOKEN_SERVICE,
      });
      if (credentials) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      console.error('❌ [TokenService] Error getting refresh token:', error);
      return null;
    }
  },

  /**
   * Save user data (JSON serialized)
   */
  saveUserData: async (userData) => {
    try {
      const dataString = JSON.stringify(userData);
      await Keychain.setGenericPassword('userData', dataString, {
        service: USER_DATA_SERVICE,
      });
      console.log('✅ [TokenService] User data saved');
    } catch (error) {
      console.error('❌ [TokenService] Error saving user data:', error);
      throw error;
    }
  },

  /**
   * Get user data
   */
  getUserData: async () => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: USER_DATA_SERVICE,
      });
      if (credentials) {
        return JSON.parse(credentials.password);
      }
      return null;
    } catch (error) {
      console.error('❌ [TokenService] Error getting user data:', error);
      return null;
    }
  },

  /**
   * Save complete auth state from registration/login response
   */
  saveAuthState: async (authResponse) => {
    try {
      const { accessToken, refreshToken, userId, javaUserId, data, userType } = authResponse;
      
      if (accessToken) {
        await tokenService.saveAccessToken(accessToken);
      }
      
      if (refreshToken) {
        await tokenService.saveRefreshToken(refreshToken);
      }
      
      // Save user data for session restoration
      const userData = {
        userId: userId || data?._id,
        javaUserId: javaUserId || data?.javaUserId,
        email: data?.email,
        fullName: data?.fullName,
        phone: data?.phone,
        role: userType === 'provider' ? 'SERVICE_PROVIDER' : 'USER',
        userType: userType || 'user',
      };
      
      await tokenService.saveUserData(userData);
      
      console.log('✅ [TokenService] Auth state saved successfully');
    } catch (error) {
      console.error('❌ [TokenService] Error saving auth state:', error);
      throw error;
    }
  },

  /**
   * Update tokens after refresh
   */
  updateTokensAfterRefresh: async ({ accessToken, refreshToken }) => {
    try {
      if (accessToken) {
        await tokenService.saveAccessToken(accessToken);
      }
      if (refreshToken) {
        await tokenService.saveRefreshToken(refreshToken);
      }
      console.log('✅ [TokenService] Tokens updated after refresh');
    } catch (error) {
      console.error('❌ [TokenService] Error updating tokens:', error);
      throw error;
    }
  },

  /**
   * Clear all auth state (logout)
   */
  clearAuthState: async () => {
    try {
      await Keychain.resetGenericPassword({ service: ACCESS_TOKEN_SERVICE });
      await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE });
      await Keychain.resetGenericPassword({ service: USER_DATA_SERVICE });
      console.log('✅ [TokenService] Auth state cleared');
    } catch (error) {
      console.error('❌ [TokenService] Error clearing auth state:', error);
    }
  },

  /**
   * Check if user is logged in
   */
  isLoggedIn: async () => {
    try {
      const accessToken = await tokenService.getAccessToken();
      return !!accessToken;
    } catch (error) {
      return false;
    }
  },
};

export default tokenService;
