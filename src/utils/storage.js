/**
 * Secure Storage Utility
 * 
 * Handles secure storage of sensitive data like tokens
 * Uses react-native-keychain for secure storage
 * 
 * @version 1.0.0
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
  USER_TYPE: 'userType',
  TOKEN_EXPIRY: 'tokenExpiry',
};

/**
 * Securely store authentication tokens
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - Refresh token
 * @param {number} expiresIn - Token expiry in seconds (optional, default 24 hours)
 */
export const storeTokens = async (accessToken, refreshToken, expiresIn = 86400) => {
  try {
    // Calculate absolute expiry time
    const expiryTime = Date.now() + (expiresIn * 1000);
    
    // Store tokens and expiry securely in Keychain only (not AsyncStorage)
    await Keychain.setGenericPassword(
      'auth_tokens',
      JSON.stringify({ accessToken, refreshToken, expiryTime }),
      { service: 'fixhomi_auth' }
    );
    
    console.log('✅ [Storage] Tokens stored, expires at:', new Date(expiryTime).toISOString());
    return true;
  } catch (error) {
    console.error('❌ [Storage] Failed to store tokens:', error);
    return false;
  }
};

/**
 * Retrieve stored authentication tokens
 * @returns {Object|null} Token object or null
 */
export const getTokens = async () => {
  try {
    const credentials = await Keychain.getGenericPassword({ service: 'fixhomi_auth' });
    if (credentials) {
      return JSON.parse(credentials.password);
    }
    return null;
  } catch (error) {
    console.error('❌ [Storage] Failed to get tokens:', error);
    return null;
  }
};

/**
 * Check if the access token is expired or about to expire
 * @param {number} bufferMs - Buffer time in milliseconds (default: 5 minutes)
 * @returns {boolean} True if expired or about to expire
 */
export const isTokenExpired = async (bufferMs = 5 * 60 * 1000) => {
  try {
    const tokens = await getTokens();
    if (!tokens?.expiryTime) {
      // No expiry stored, assume expired to force refresh
      console.log('⚠️ [Storage] No token expiry found, assuming expired');
      return true;
    }
    
    const isExpired = Date.now() + bufferMs >= tokens.expiryTime;
    if (isExpired) {
      console.log('⏰ [Storage] Token expired or expiring soon');
    }
    return isExpired;
  } catch (error) {
    console.error('❌ [Storage] Failed to check token expiry:', error);
    return true; // Assume expired on error
  }
};

/**
 * Get token expiry time
 * @returns {number|null} Expiry timestamp or null
 */
export const getTokenExpiry = async () => {
  try {
    const tokens = await getTokens();
    return tokens?.expiryTime || null;
  } catch (error) {
    console.error('❌ [Storage] Failed to get token expiry:', error);
    return null;
  }
};

/**
 * Clear stored authentication tokens
 */
export const clearTokens = async () => {
  try {
    await Keychain.resetGenericPassword({ service: 'fixhomi_auth' });
    console.log('✅ [Storage] Tokens cleared');
    return true;
  } catch (error) {
    console.error('❌ [Storage] Failed to clear tokens:', error);
    return false;
  }
};

/**
 * Store user data in AsyncStorage.
 * Only stores essential, non-sensitive fields to minimize PII exposure.
 * Sensitive data (tokens, passwords) are stored in Keychain.
 * @param {Object} userData - User data object
 */
export const storeUserData = async (userData) => {
  try {
    // Strip sensitive PII — only keep fields needed for app navigation/state
    const safeData = {
      id: userData.id || userData._id || userData.mongoId,
      mongoId: userData.mongoId,
      javaUserId: userData.javaUserId,
      role: userData.role,
      userType: userData.userType,
      fullName: userData.fullName || userData.name,
      isEmailVerified: userData.isEmailVerified,
      isPhoneVerified: userData.isPhoneVerified,
      isAadhaarVerified: userData.isAadhaarVerified,
      isPremium: userData.isPremium,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(safeData));
    return true;
  } catch (error) {
    console.error('❌ [Storage] Failed to store user data:', error);
    return false;
  }
};

/**
 * Get user data from AsyncStorage
 * @returns {Object|null} User data or null
 */
export const getUserData = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('❌ [Storage] Failed to get user data:', error);
    return null;
  }
};

/**
 * Store user type (user/provider)
 * @param {string} userType - 'user' or 'provider'
 */
export const storeUserType = async (userType) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_TYPE, userType);
    return true;
  } catch (error) {
    console.error('❌ [Storage] Failed to store user type:', error);
    return false;
  }
};

/**
 * Get user type
 * @returns {string|null} User type or null
 */
export const getUserType = async () => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.USER_TYPE);
  } catch (error) {
    console.error('❌ [Storage] Failed to get user type:', error);
    return null;
  }
};

/**
 * Clear all stored data (logout)
 */
export const clearAllData = async () => {
  try {
    await clearTokens();
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.USER_TYPE,
    ]);
    return true;
  } catch (error) {
    console.error('❌ [Storage] Failed to clear all data:', error);
    return false;
  }
};

export default {
  storeTokens,
  getTokens,
  clearTokens,
  isTokenExpired,
  getTokenExpiry,
  storeUserData,
  getUserData,
  storeUserType,
  getUserType,
  clearAllData,
};
