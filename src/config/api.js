/**
 * API Configuration
 * 
 * Centralized configuration for API endpoints and base URLs
 * Supports: Emulator, Physical Device (USB), Physical Device (WiFi)
 * 
 * Uses react-native-device-info for reliable emulator detection
 * 
 * ENVIRONMENT SWITCHING:
 * - Import USE_PRODUCTION_API from './environment' and toggle to switch
 * - true  = Railway hosted backend (for Razorpay, webhooks)
 * - false = Local development server
 * 
 * @version 6.0.0
 */

import { Platform, NativeModules } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { 
  USE_PRODUCTION_NODE_API,
  USE_PRODUCTION_JAVA_AUTH, 
  PRODUCTION_CONFIG, 
  LOCAL_CONFIG,
  getEnvironmentName 
} from './environment';

/**
 * Synchronous emulator detection (fast, less reliable)
 * This is used for initial config, then we verify with async check
 */
const isEmulatorSync = () => {
  if (Platform.OS === 'android') {
    // Android emulator detection using PlatformConstants (sync)
    const { PlatformConstants } = NativeModules;
    const isAndroidEmulator = PlatformConstants?.Fingerprint?.includes('generic') ||
                              PlatformConstants?.Fingerprint?.includes('sdk') ||
                              PlatformConstants?.Model?.includes('sdk') ||
                              PlatformConstants?.Model?.includes('Emulator') ||
                              PlatformConstants?.Model?.includes('Android SDK') ||
                              PlatformConstants?.Brand === 'google' && PlatformConstants?.Model?.startsWith('sdk_gphone');
    return isAndroidEmulator;
  } else if (Platform.OS === 'ios') {
    // iOS simulator detection
    return Platform.isPad === false && Platform.isTV === false && !NativeModules.PlatformConstants?.interfaceIdiom;
  }
  return false;
};

/**
 * Async emulator detection using react-native-device-info (more reliable)
 * Call this to verify emulator status
 */
export const checkIsEmulator = async () => {
  try {
    const emulator = await DeviceInfo.isEmulator();
    console.log(`📱 [API] Device Info: ${emulator ? 'Emulator' : 'Physical Device'}`);
    return emulator;
  } catch (error) {
    console.log('[API] DeviceInfo check failed, using sync method');
    return isEmulatorSync();
  }
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
  
  // Check if we're likely on an emulator (sync check for initial config)
  const emulator = isEmulatorSync();
  
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

// ============================================
// PRIMARY API URLS - Environment Aware (Separate toggles)
// ============================================

// Node.js Backend URL - controlled by USE_PRODUCTION_NODE_API
const API_BASE_URL = USE_PRODUCTION_NODE_API
  ? PRODUCTION_CONFIG.NODE_API_URL
  : (__DEV__ ? `http://${DEV_HOST}:5001` : PRODUCTION_CONFIG.NODE_API_URL);

// Java Auth URL - controlled by USE_PRODUCTION_JAVA_AUTH
const JAVA_AUTH_BASE_URL = USE_PRODUCTION_JAVA_AUTH
  ? PRODUCTION_CONFIG.JAVA_AUTH_URL
  : (__DEV__ ? `http://${DEV_HOST}:8080` : PRODUCTION_CONFIG.JAVA_AUTH_URL);

// Fallback API URLs (for WiFi connection - only used when not in production mode)
const WIFI_API_BASE_URL = USE_PRODUCTION_NODE_API
  ? PRODUCTION_CONFIG.NODE_API_URL
  : (__DEV__ ? `http://${WIFI_HOST}:5001` : PRODUCTION_CONFIG.NODE_API_URL);

const WIFI_JAVA_AUTH_BASE_URL = USE_PRODUCTION_JAVA_AUTH
  ? PRODUCTION_CONFIG.JAVA_AUTH_URL
  : (__DEV__ ? `http://${WIFI_HOST}:8080` : PRODUCTION_CONFIG.JAVA_AUTH_URL);

// Log configuration in dev mode
if (__DEV__) {
  console.log('🔧 [API Config] Environment:', getEnvironmentName());
  console.log('🔧 [API Config] Settings:', { 
    useProductionNode: USE_PRODUCTION_NODE_API,
    useProductionJava: USE_PRODUCTION_JAVA_AUTH,
    platform: Platform.OS,
    isEmulator: isEmulatorSync(),
    nodeUrl: API_BASE_URL,
    javaUrl: JAVA_AUTH_BASE_URL,
  });
  
  // Async verification with device-info
  checkIsEmulator().then(isEmu => {
    if (isEmu !== isEmulatorSync()) {
      console.log('⚠️ [API Config] Emulator detection mismatch! Sync:', isEmulatorSync(), 'Async:', isEmu);
    }
  });
}

// Export base URLs for services
export const NODE_BASE_URL = API_BASE_URL;
export const JAVA_BASE_URL = JAVA_AUTH_BASE_URL;
export const WIFI_NODE_BASE_URL = WIFI_API_BASE_URL;
export const WIFI_JAVA_BASE_URL = WIFI_JAVA_AUTH_BASE_URL;

/**
 * Get Node.js backend URL
 * For services that need the base URL as a function
 * @returns {string} Node.js backend base URL
 */
export const getNodeBackendUrl = () => API_BASE_URL;

/**
 * Get Java Auth backend URL  
 * For services that need the base URL as a function
 * @returns {string} Java Auth backend base URL
 */
export const getJavaBackendUrl = () => JAVA_AUTH_BASE_URL;

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
    // Phone sync (Node.js - sync phone from Java Auth to MongoDB after OTP verification)
    SYNC_PHONE: '/api/auth/sync-phone',
    // Check if email/phone is already registered (Node.js, public)
    CHECK_AVAILABILITY: '/api/auth/check-availability',
    // Session management (Java Auth)
    SESSIONS: '/api/auth/sessions',
    REVOKE_ALL: '/api/auth/sessions/revoke-all',
    // Token operations
    VALIDATE: '/api/auth/validate',
    REFRESH: '/api/auth/refresh',
    // Health check
    HEALTH: '/actuator/health',
    // Device trust
    TRUST_DEVICE: '/api/auth/devices/trust',
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
    FORGOT_PHONE: '/api/auth/forgot-password/phone',
    FORGOT_PHONE_VERIFY: '/api/auth/forgot-password/phone/verify',
    FORGOT_EMAIL: '/api/auth/forgot-password/email',
    FORGOT_EMAIL_VERIFY: '/api/auth/forgot-password/email/verify',
    CHANGE: '/api/users/change-password',
  },

  // Google OAuth (direct to Java Auth)
  OAUTH: {
    GOOGLE_MOBILE: '/api/auth/oauth2/google/mobile',
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
    // Get provider's service requests (GET /provider/:providerId/requests)
    PROVIDER_REQUESTS: '/api/traditional-services/provider', // + /:providerId/requests
    // Get provider details (GET /provider/:providerId/details)
    PROVIDER_DETAILS: '/api/traditional-services/provider', // + /:providerId/details
    // Verify completion OTP (POST /:id/verify-otp)
    VERIFY_OTP: '/api/traditional-services', // + /:id/verify-otp
    // Resend OTP (POST /:id/resend-otp)
    RESEND_OTP: '/api/traditional-services', // + /:id/resend-otp
  },

  // Cloudinary upload signature (via Node.js backend, authenticated)
  UPLOAD: {
    SIGNATURE: '/api/upload/signature',
  },

  // App Version Check (via Node.js backend, public endpoint)
  APP_VERSION: {
    CHECK: '/api/admin/app-version/check',
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
 * Deep link configuration for authentication flows
 *
 * Supported deep links:
 * - fixhomi://auth/email-verify?token=xxx  - Email verification
 *
 * Note: Password reset now uses OTP (not deep links) for security.
 */
export const DEEP_LINK_CONFIG = {
  SCHEME: 'fixhomi',
  HOST: 'auth',
  // Email verification
  EMAIL_VERIFY_PATH: 'email-verify',
};

export default API_CONFIG;
