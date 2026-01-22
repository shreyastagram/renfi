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
};

/**
 * Securely store authentication tokens
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - Refresh token
 */
export const storeTokens = async (accessToken, refreshToken) => {
  try {
    // Store tokens securely in keychain
    await Keychain.setGenericPassword(
      'auth_tokens',
      JSON.stringify({ accessToken, refreshToken }),
      { service: 'fixhomi_auth' }
    );
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
 * Clear stored authentication tokens
 */
export const clearTokens = async () => {
  try {
    await Keychain.resetGenericPassword({ service: 'fixhomi_auth' });
    return true;
  } catch (error) {
    console.error('❌ [Storage] Failed to clear tokens:', error);
    return false;
  }
};

/**
 * Store user data in AsyncStorage
 * @param {Object} userData - User data object
 */
export const storeUserData = async (userData) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
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
  storeUserData,
  getUserData,
  storeUserType,
  getUserType,
  clearAllData,
};
