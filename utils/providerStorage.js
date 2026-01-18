/**
 * Provider Storage - AsyncStorage wrapper for provider data
 * 
 * Handles persistent storage of provider data using AsyncStorage
 * 
 * @version 1.0.0
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  PROVIDER_DATA: '@fixhomi_provider_data',
  PROVIDER_TOKEN: '@fixhomi_provider_token',
  PROVIDER_ID: '@fixhomi_provider_id',
  IS_LOGGED_IN: '@fixhomi_provider_logged_in',
};

export const providerStorage = {
  /**
   * Save provider data
   */
  saveProviderData: async (providerData) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PROVIDER_DATA,
        JSON.stringify(providerData)
      );
      await AsyncStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, 'true');
      console.log('✅ [ProviderStorage] Provider data saved');
    } catch (error) {
      console.error('❌ [ProviderStorage] Error saving provider data:', error);
      throw error;
    }
  },

  /**
   * Get provider data
   */
  getProviderData: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PROVIDER_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ [ProviderStorage] Error getting provider data:', error);
      return null;
    }
  },

  /**
   * Save provider token
   */
  saveProviderToken: async (token) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PROVIDER_TOKEN, token);
      console.log('✅ [ProviderStorage] Provider token saved');
    } catch (error) {
      console.error('❌ [ProviderStorage] Error saving provider token:', error);
      throw error;
    }
  },

  /**
   * Get provider token
   */
  getProviderToken: async () => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PROVIDER_TOKEN);
    } catch (error) {
      console.error('❌ [ProviderStorage] Error getting provider token:', error);
      return null;
    }
  },

  /**
   * Save provider ID
   */
  saveProviderId: async (providerId) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PROVIDER_ID, String(providerId));
      console.log('✅ [ProviderStorage] Provider ID saved');
    } catch (error) {
      console.error('❌ [ProviderStorage] Error saving provider ID:', error);
      throw error;
    }
  },

  /**
   * Get provider ID
   */
  getProviderId: async () => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PROVIDER_ID);
    } catch (error) {
      console.error('❌ [ProviderStorage] Error getting provider ID:', error);
      return null;
    }
  },

  /**
   * Check if provider is logged in
   */
  isProviderLoggedIn: async () => {
    try {
      const isLoggedIn = await AsyncStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN);
      return isLoggedIn === 'true';
    } catch (error) {
      console.error('❌ [ProviderStorage] Error checking login status:', error);
      return false;
    }
  },

  /**
   * Clear all provider data (logout)
   */
  clearProviderData: async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.PROVIDER_DATA,
        STORAGE_KEYS.PROVIDER_TOKEN,
        STORAGE_KEYS.PROVIDER_ID,
        STORAGE_KEYS.IS_LOGGED_IN,
      ]);
      console.log('✅ [ProviderStorage] Provider data cleared');
    } catch (error) {
      console.error('❌ [ProviderStorage] Error clearing provider data:', error);
      throw error;
    }
  },
};

export default providerStorage;
