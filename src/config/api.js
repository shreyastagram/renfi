/**
 * API Configuration
 * 
 * Centralized configuration for API endpoints and base URLs
 * Supports: Emulator, Physical Device (USB), Physical Device (WiFi)
 * 
 * @version 4.0.0
 */

import { Platform, NativeModules } from 'react-native';

/**
 * Auto-detect if running on emulator or physical device
 * This works for both Android and iOS
 */
const isEmulator = () => {
  if (Platform.OS === 'android') {
    // Android emulator detection
    const { PlatformConstants } = NativeModules;
    const isAndroidEmulator = PlatformConstants?.Fingerprint?.includes('generic') ||
                              PlatformConstants?.Fingerprint?.includes('sdk') ||
                              PlatformConstants?.Model?.includes('sdk') ||
                              PlatformConstants?.Model?.includes('Emulator') ||
                              PlatformConstants?.Model?.includes('Android SDK');
    return isAndroidEmulator;
  } else if (Platform.OS === 'ios') {
    // iOS simulator detection
    return Platform.isPad === false && Platform.isTV === false && !NativeModules.PlatformConstants?.interfaceIdiom;
  }
  return false;
};

/**
 * Configuration for different environments
 * 
 * For USB-connected physical devices, you MUST run:
 *   adb reverse tcp:5001 tcp:5001
 *   adb reverse tcp:8080 tcp:8080
 * 
 * For WiFi-connected devices, use your machine's IP address
 */
const LOCAL_MACHINE_IP = '192.168.29.71';  // UPDATE THIS to your computer's IP

/**
 * Determine the correct host based on device type
 */
const getDevServerHost = () => {
  if (!__DEV__) {
    return null; // Production uses full URLs
  }

  if (Platform.OS === 'ios') {
    // iOS simulator can always use localhost
    return 'localhost';
  }

  // For Android:
  // 1. Emulator: Use 10.0.2.2 (special alias for host machine)
  // 2. Physical device with USB (adb reverse): Use localhost  
  // 3. Physical device on WiFi: Use machine IP
  
  // Check if we're likely on an emulator
  const emulator = isEmulator();
  
  if (emulator) {
    console.log('🔧 [API] Android Emulator detected - using 10.0.2.2');
    return '10.0.2.2';
  }
  
  // Physical device - try localhost first (assumes adb reverse is set up)
  // If connection fails, the app should fall back to WiFi IP
  console.log('🔧 [API] Physical device detected - using localhost (adb reverse)');
  console.log('📱 [API] If connection fails, run: adb reverse tcp:5001 tcp:5001 && adb reverse tcp:8080 tcp:8080');
  return 'localhost';
};

/**
 * Alternative host for WiFi connection (when adb reverse not available)
 */
const getWiFiHost = () => LOCAL_MACHINE_IP;

const DEV_HOST = getDevServerHost();
const WIFI_HOST = getWiFiHost();

// Primary API URLs (using adb reverse / emulator)
const API_BASE_URL = __DEV__ 
  ? `http://${DEV_HOST}:5001`
  : 'https://your-production-api.com';

const JAVA_AUTH_BASE_URL = __DEV__
  ? `http://${DEV_HOST}:8080`
  : 'https://your-production-auth-api.com';

// Fallback API URLs (for WiFi connection)
const WIFI_API_BASE_URL = __DEV__ 
  ? `http://${WIFI_HOST}:5001`
  : 'https://your-production-api.com';

const WIFI_JAVA_AUTH_BASE_URL = __DEV__
  ? `http://${WIFI_HOST}:8080`
  : 'https://your-production-auth-api.com';

// Log configuration in dev mode
if (__DEV__) {
  console.log('🔧 [API Config] Environment:', { 
    platform: Platform.OS,
    isEmulator: isEmulator(),
    primaryHost: DEV_HOST,
    fallbackHost: WIFI_HOST,
    nodeUrl: API_BASE_URL,
    javaUrl: JAVA_AUTH_BASE_URL,
  });
}

// Export base URLs for services
export const NODE_BASE_URL = API_BASE_URL;
export const JAVA_BASE_URL = JAVA_AUTH_BASE_URL;
export const WIFI_NODE_BASE_URL = WIFI_API_BASE_URL;
export const WIFI_JAVA_BASE_URL = WIFI_JAVA_AUTH_BASE_URL;

/**
 * API Endpoints
 * 
 * Registration goes through Node.js → Java Auth → MongoDB
 * Login goes directly to Java Auth
 */
export const ENDPOINTS = {
  // Registration endpoints (via Node.js backend)
  AUTH: {
    REGISTER: '/api/auth/register',
    PROVIDER_REGISTER: '/api/auth/provider/register',
  },
  
  // Login endpoints (direct to Java Auth)
  LOGIN: {
    // Email/Password login
    EMAIL: '/api/auth/login',
    // Phone/Password login
    PHONE: '/api/auth/login/phone',
    // Logout
    LOGOUT: '/api/auth/logout',
    // Token refresh
    REFRESH: '/api/auth/refresh',
  },
  
  // OTP-based passwordless login (direct to Java Auth)
  OTP_LOGIN: {
    // Phone OTP login
    PHONE_SEND_OTP: '/api/auth/login/phone/send-otp',
    PHONE_VERIFY: '/api/auth/login/phone/verify',
    // Email OTP login
    EMAIL_SEND_OTP: '/api/auth/login/email/send-otp',
    EMAIL_VERIFY: '/api/auth/login/email/verify',
  },
  
  // Account verification (direct to Java Auth, requires auth token)
  VERIFICATION: {
    // Phone verification
    SEND_PHONE_OTP: '/api/auth/otp/send',
    VERIFY_PHONE_OTP: '/api/auth/otp/verify',
    // Email verification
    SEND_EMAIL_VERIFICATION: '/api/auth/email/send-verification',
    VERIFY_EMAIL: '/api/auth/email/verify', // GET with ?token=xxx
  },
  
  // Password reset (direct to Java Auth)
  PASSWORD: {
    FORGOT: '/api/auth/forgot-password',
    RESET: '/api/auth/reset-password',
    VALIDATE_TOKEN: '/api/auth/reset-password/validate',
  },
  
  // Profile endpoints
  PROFILE: {
    // Java Auth - Get current user with verification status (requires access token)
    ME: '/api/users/me',
    // Java Auth - Update user profile (name, phone) - PUT
    UPDATE_ME: '/api/users/profile',
    // Node.js - Get user profile from MongoDB (requires userId which is MongoDB _id)
    USER: '/api/user/profile', // + /:userId
    // Node.js - Get provider profile from MongoDB (requires providerId which is MongoDB _id)
    PROVIDER: '/api/auth/provider/profile', // + /:providerId
    // Node.js - Update user profile (PUT)
    UPDATE_USER: '/api/user/profile', // + /:userId
    // Node.js - Update provider profile (PUT)
    UPDATE_PROVIDER: '/api/auth/provider/profile',
    // Node.js - Update provider online status (PATCH)
    UPDATE_PROVIDER_ONLINE: '/api/provider', // + /:providerId/online
  },

  // Saved Addresses endpoints (via Node.js backend)
  ADDRESS: {
    // Get all saved addresses for user
    GET_ALL: '/api/user/addresses', // + /:userId
    // Add new address
    ADD: '/api/user/addresses', // + /:userId
    // Update address
    UPDATE: '/api/user/addresses', // + /:userId/:addressId
    // Delete address
    DELETE: '/api/user/addresses', // + /:userId/:addressId
    // Set default address
    SET_DEFAULT: '/api/user/addresses', // + /:userId/:addressId/default
  },

  // Traditional Service endpoints (via Node.js backend)
  TRADITIONAL_SERVICE: {
    // Create a new service request
    CREATE: '/api/traditional-services/create',
    // Get nearby providers for a request (POST with requestId in params)
    NEARBY_PROVIDERS: '/api/traditional-services', // + /:id/providers
    // Get request details
    GET_REQUEST: '/api/traditional-services', // + /:id
    // Cancel a request
    CANCEL: '/api/traditional-services', // + /:id/cancel
    // Get user's service requests
    USER_REQUESTS: '/api/traditional-services/user', // + /:userId
    // Send request to a specific provider (POST /:id/send-to-provider)
    SEND_TO_PROVIDER: '/api/traditional-services', // + /:id/send-to-provider
    // Provider accepts request (POST /:id/accept-provider)
    ACCEPT_PROVIDER: '/api/traditional-services', // + /:id/accept-provider
    // Get provider's service requests (GET /provider/:providerId)
    PROVIDER_REQUESTS: '/api/traditional-services/provider', // + /:providerId
    // Verify completion OTP (POST /:id/verify-otp)
    VERIFY_OTP: '/api/traditional-services', // + /:id/verify-otp
    // Resend OTP (POST /:id/resend-otp)
    RESEND_OTP: '/api/traditional-services', // + /:id/resend-otp
  },
};

// Alias for backward compatibility
export const API_ENDPOINTS = ENDPOINTS;

/**
 * API Configuration object
 */
export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  JAVA_AUTH_URL: JAVA_AUTH_BASE_URL,
  TIMEOUT: 30000, // 30 seconds
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

/**
 * Deep link configuration for email verification
 */
export const DEEP_LINK_CONFIG = {
  SCHEME: 'fixhomi',
  HOST: 'auth',
  EMAIL_VERIFY_PATH: 'email-verify',
  // Full deep link: fixhomi://auth/email-verify?token=xxx
};

export default API_CONFIG;
