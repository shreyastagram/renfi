// API Configuration for different environments

// Base URL for Android Emulator
const ANDROID_BASE_URL = 'http://10.0.2.2:5050';

// Base URL for iOS Simulator  
const IOS_BASE_URL = 'http://localhost:5050';

// Base URL for Physical Device (replace with your computer's IP)
const DEVICE_BASE_URL = 'http://192.168.1.100:5050';

// Automatically detect platform and use appropriate URL
import { Platform } from 'react-native';

let BASE_URL;
if (Platform.OS === 'android') {
  BASE_URL = ANDROID_BASE_URL;
} else if (Platform.OS === 'ios') {
  BASE_URL = IOS_BASE_URL;
} else {
  BASE_URL = DEVICE_BASE_URL;
}

export const API_CONFIG = {
  BASE_URL,
  
  // Auth endpoints
  AUTH: {
    USER_LOGIN: `${BASE_URL}/auth/login`,
    USER_REGISTER: `${BASE_URL}/auth/register`,
    PROVIDER_LOGIN: `${BASE_URL}/auth/provider/login`,
    PROVIDER_REGISTER: `${BASE_URL}/auth/provider/register`,
    PROVIDER_PROFILE: `${BASE_URL}/auth/provider/profile`,
  },
  
  // User endpoints
  USER: {
    PROFILE: (userId) => `${BASE_URL}/api/user/profile/${userId}`,
    SERVICE_HISTORY: (userId) => `${BASE_URL}/api/user/service-history/${userId}`,
  },
  
  // Provider endpoints  
  PROVIDER: {
    PROFILE: (providerId) => `${BASE_URL}/auth/provider/profile/${providerId}`,
    ACCEPTED_REQUESTS: (providerId) => `${BASE_URL}/api/provider/accepted-requests/${providerId}`,
    COMPLETE_REQUEST: `${BASE_URL}/api/provider/complete-request`,
  },
  
  // Common headers
  HEADERS: {
    JSON: {
      'Content-Type': 'application/json',
    },
    AUTH: (token) => ({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
  },
};

console.log('🌐 API Base URL:', BASE_URL);