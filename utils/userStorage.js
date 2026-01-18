/**
 * User Storage - AsyncStorage wrapper for user data
 * 
 * Handles persistent storage of user data using AsyncStorage
 * 
 * @version 1.0.0
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  USER_DATA: '@fixhomi_user_data',
  USER_TOKEN: '@fixhomi_user_token',
  USER_ID: '@fixhomi_user_id',
  IS_LOGGED_IN: '@fixhomi_user_logged_in',
};

export const userStorage = {
  /**
   * Save user data
   */
  saveUserData: async (userData) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_DATA,
        JSON.stringify(userData)
      );
      await AsyncStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, 'true');
      console.log('✅ [UserStorage] User data saved');
    } catch (error) {
      console.error('❌ [UserStorage] Error saving user data:', error);
      throw error;
    }
  },

  /**
   * Get user data
   */
  getUserData: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ [UserStorage] Error getting user data:', error);
      return null;
    }
  },

  /**
   * Save user token
   */
  saveUserToken: async (token) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_TOKEN, token);
      console.log('✅ [UserStorage] User token saved');
    } catch (error) {
      console.error('❌ [UserStorage] Error saving user token:', error);
      throw error;
    }
  },

  /**
   * Get user token
   */
  getUserToken: async () => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    } catch (error) {
      console.error('❌ [UserStorage] Error getting user token:', error);
      return null;
    }
  },

  /**
   * Save user ID
   */
  saveUserId: async (userId) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, String(userId));
      console.log('✅ [UserStorage] User ID saved');
    } catch (error) {
      console.error('❌ [UserStorage] Error saving user ID:', error);
      throw error;
    }
  },

  /**
   * Get user ID
   */
  getUserId: async () => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
    } catch (error) {
      console.error('❌ [UserStorage] Error getting user ID:', error);
      return null;
    }
  },

  /**
   * Check if user is logged in
   */
  isUserLoggedIn: async () => {
    try {
      const isLoggedIn = await AsyncStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN);
      return isLoggedIn === 'true';
    } catch (error) {
      console.error('❌ [UserStorage] Error checking login status:', error);
      return false;
    }
  },

  /**
   * Clear all user data (logout)
   */
  clearUserData: async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.USER_TOKEN,
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.IS_LOGGED_IN,
      ]);
      console.log('✅ [UserStorage] User data cleared');
    } catch (error) {
      console.error('❌ [UserStorage] Error clearing user data:', error);
      throw error;
    }
  },
};

export default userStorage;
