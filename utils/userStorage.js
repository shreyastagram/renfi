import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = 'userId';
const USER_DATA_KEY = 'userData';
const USER_TOKEN_KEY = 'userToken';

export const userStorage = {
  // Save user ID
  saveUserId: async (userId) => {
    try {
      if (userId === undefined || userId === null) {
        console.error('❌ Cannot save undefined or null user ID');
        return;
      }
      await AsyncStorage.setItem(USER_ID_KEY, String(userId));
      console.log('✅ User ID saved:', userId);
    } catch (error) {
      console.error('❌ Failed to save user ID:', error);
    }
  },

  // Get user ID
  getUserId: async () => {
    try {
      const userId = await AsyncStorage.getItem(USER_ID_KEY);
      console.log('📱 Retrieved user ID:', userId);
      return userId;
    } catch (error) {
      console.error('❌ Failed to get user ID:', error);
      return null;
    }
  },

  // Save user authentication token
  saveUserToken: async (token) => {
    try {
      if (token === undefined || token === null) {
        console.error('❌ Cannot save undefined or null token');
        return;
      }
      await AsyncStorage.setItem(USER_TOKEN_KEY, String(token));
      console.log('✅ User token saved');
    } catch (error) {
      console.error('❌ Failed to save user token:', error);
    }
  },

  // Get user authentication token
  getUserToken: async () => {
    try {
      const token = await AsyncStorage.getItem(USER_TOKEN_KEY);
      console.log('📱 Retrieved user token:', token ? 'Present' : 'Not found');
      return token;
    } catch (error) {
      console.error('❌ Failed to get user token:', error);
      return null;
    }
  },

  // Save user profile data
  saveUserData: async (userData) => {
    try {
      if (userData === undefined || userData === null) {
        console.error('❌ Cannot save undefined or null user data');
        return;
      }
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
      console.log('✅ User data saved:', userData);
    } catch (error) {
      console.error('❌ Failed to save user data:', error);
    }
  },

  // Get user profile data
  getUserData: async () => {
    try {
      const data = await AsyncStorage.getItem(USER_DATA_KEY);
      const userData = data ? JSON.parse(data) : null;
      console.log('📱 Retrieved user data:', userData);
      return userData;
    } catch (error) {
      console.error('❌ Failed to get user data:', error);
      return null;
    }
  },

  // Clear all user data (for logout)
  clearUserData: async () => {
    try {
      await AsyncStorage.multiRemove([USER_ID_KEY, USER_DATA_KEY, USER_TOKEN_KEY]);
      console.log('✅ User data cleared');
    } catch (error) {
      console.error('❌ Failed to clear user data:', error);
    }
  },

  // Check if user is logged in
  isUserLoggedIn: async () => {
    try {
      const userId = await AsyncStorage.getItem(USER_ID_KEY);
      const token = await AsyncStorage.getItem(USER_TOKEN_KEY);
      return !!(userId && token);
    } catch (error) {
      console.error('❌ Failed to check user login status:', error);
      return false;
    }
  }
};