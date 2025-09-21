import AsyncStorage from '@react-native-async-storage/async-storage';

const PROVIDER_ID_KEY = 'providerId';
const PROVIDER_DATA_KEY = 'providerData';
const PROVIDER_TOKEN_KEY = 'providerToken';

export const providerStorage = {
  // Save provider ID
  saveProviderId: async (providerId) => {
    try {
      await AsyncStorage.setItem(PROVIDER_ID_KEY, providerId);
      console.log('✅ Provider ID saved:', providerId);
    } catch (error) {
      console.error('❌ Failed to save provider ID:', error);
    }
  },

  // Get provider ID
  getProviderId: async () => {
    try {
      const providerId = await AsyncStorage.getItem(PROVIDER_ID_KEY);
      console.log('📱 Retrieved provider ID:', providerId);
      return providerId;
    } catch (error) {
      console.error('❌ Failed to get provider ID:', error);
      return null;
    }
  },

  // Save provider authentication token
  saveProviderToken: async (token) => {
    try {
      await AsyncStorage.setItem(PROVIDER_TOKEN_KEY, token);
      console.log('✅ Provider token saved');
    } catch (error) {
      console.error('❌ Failed to save provider token:', error);
    }
  },

  // Get provider authentication token
  getProviderToken: async () => {
    try {
      const token = await AsyncStorage.getItem(PROVIDER_TOKEN_KEY);
      console.log('📱 Retrieved provider token:', token ? 'Present' : 'Not found');
      return token;
    } catch (error) {
      console.error('❌ Failed to get provider token:', error);
      return null;
    }
  },

  // Save provider profile data
  saveProviderData: async (providerData) => {
    try {
      await AsyncStorage.setItem(PROVIDER_DATA_KEY, JSON.stringify(providerData));
      console.log('✅ Provider data saved:', providerData);
    } catch (error) {
      console.error('❌ Failed to save provider data:', error);
    }
  },

  // Get provider profile data
  getProviderData: async () => {
    try {
      const data = await AsyncStorage.getItem(PROVIDER_DATA_KEY);
      const providerData = data ? JSON.parse(data) : null;
      console.log('📱 Retrieved provider data:', providerData);
      return providerData;
    } catch (error) {
      console.error('❌ Failed to get provider data:', error);
      return null;
    }
  },

  // Clear all provider data (for logout)
  clearProviderData: async () => {
    try {
      await AsyncStorage.multiRemove([PROVIDER_ID_KEY, PROVIDER_DATA_KEY, PROVIDER_TOKEN_KEY]);
      console.log('✅ Provider data cleared');
    } catch (error) {
      console.error('❌ Failed to clear provider data:', error);
    }
  },

  // Check if provider is logged in
  isProviderLoggedIn: async () => {
    try {
      const providerId = await AsyncStorage.getItem(PROVIDER_ID_KEY);
      const token = await AsyncStorage.getItem(PROVIDER_TOKEN_KEY);
      return !!(providerId && token);
    } catch (error) {
      console.error('❌ Failed to check provider login status:', error);
      return false;
    }
  }
};