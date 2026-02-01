/**
 * Auth Infrastructure Service
 * 
 * Phase 4: Authentication Infrastructure
 * Provides advanced auth features for production:
 * 
 * Key Features:
 * - Multi-device session management
 * - Session tracking and device info
 * - Auth state monitoring
 * - Secure token storage validation
 * - Auth health checks
 * - Device trust management
 * 
 * @version 1.0.0
 */

import { authClient, parseApiError } from './apiClient';
import apiClient from './apiClient';
import { ENDPOINTS, API_CONFIG } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { getTokens, storeTokens, clearTokens, isTokenExpired } from '../utils/storage';

// ==================== CONSTANTS ====================

const DEVICE_ID_KEY = '@device_id';
const SESSIONS_KEY = '@active_sessions';
const AUTH_HEALTH_KEY = '@auth_health_check';
const TRUSTED_DEVICES_KEY = '@trusted_devices';

/**
 * Session status codes
 */
export const SESSION_STATUS = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Auth health status
 */
export const AUTH_HEALTH = {
  HEALTHY: 'HEALTHY',
  TOKEN_EXPIRING: 'TOKEN_EXPIRING',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  NO_SESSION: 'NO_SESSION',
  SERVICE_ERROR: 'SERVICE_ERROR',
};

// ==================== DEVICE MANAGEMENT ====================

/**
 * Get or create a unique device ID
 * This ID persists across app reinstalls where possible
 * @returns {Promise<string>} Device ID
 */
export const getDeviceId = async () => {
  try {
    // Try to get stored device ID first
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Generate new device ID using device info
      const uniqueId = await DeviceInfo.getUniqueId();
      deviceId = `${Platform.OS}_${uniqueId}_${Date.now()}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      console.log('📱 [AuthInfra] New device ID created:', deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('❌ [AuthInfra] Failed to get device ID:', error);
    // Fallback to timestamp-based ID
    const fallbackId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, fallbackId);
    return fallbackId;
  }
};

/**
 * Get device info for session tracking
 * @returns {Promise<Object>} Device information
 */
export const getDeviceInfo = async () => {
  try {
    const deviceId = await getDeviceId();
    const deviceName = await DeviceInfo.getDeviceName();
    const deviceModel = DeviceInfo.getModel();
    const systemVersion = DeviceInfo.getSystemVersion();
    const appVersion = DeviceInfo.getVersion();
    const buildNumber = DeviceInfo.getBuildNumber();
    
    return {
      deviceId,
      deviceName,
      deviceModel,
      platform: Platform.OS,
      systemVersion,
      appVersion,
      buildNumber,
      lastActive: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ [AuthInfra] Failed to get device info:', error);
    return {
      deviceId: await getDeviceId(),
      platform: Platform.OS,
      lastActive: new Date().toISOString(),
    };
  }
};

// ==================== SESSION MANAGEMENT ====================

/**
 * Get all active sessions for the current user
 * Fetches from Java Auth backend
 * @returns {Promise<Object>} Sessions result
 */
export const getActiveSessions = async () => {
  try {
    console.log('📋 [AuthInfra] Fetching active sessions...');
    
    const response = await authClient.get(ENDPOINTS.AUTH.SESSIONS);
    
    console.log('✅ [AuthInfra] Active sessions fetched:', response.data);
    
    // Cache locally
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify({
      sessions: response.data.sessions || response.data,
      fetchedAt: Date.now(),
    }));
    
    return {
      success: true,
      data: response.data.sessions || response.data,
    };
  } catch (error) {
    console.error('❌ [AuthInfra] Failed to fetch sessions:', error.message);
    
    // Try to return cached data
    const cached = await AsyncStorage.getItem(SESSIONS_KEY);
    if (cached) {
      const parsedCache = JSON.parse(cached);
      return {
        success: true,
        data: parsedCache.sessions,
        cached: true,
      };
    }
    
    return {
      success: false,
      error: parseApiError(error),
    };
  }
};

/**
 * Get current session info
 * @returns {Promise<Object>} Current session
 */
export const getCurrentSession = async () => {
  try {
    const deviceId = await getDeviceId();
    const sessions = await getActiveSessions();
    
    if (!sessions.success) {
      return { success: false, error: sessions.error };
    }
    
    const currentSession = sessions.data.find(s => s.deviceId === deviceId);
    
    return {
      success: true,
      data: currentSession || null,
    };
  } catch (error) {
    return {
      success: false,
      error: { message: error.message },
    };
  }
};

/**
 * Revoke a specific session
 * @param {string} sessionId - Session ID to revoke
 * @returns {Promise<Object>} Revocation result
 */
export const revokeSession = async (sessionId) => {
  try {
    console.log(`🔒 [AuthInfra] Revoking session: ${sessionId}`);
    
    const response = await authClient.delete(`${ENDPOINTS.AUTH.SESSIONS}/${sessionId}`);
    
    console.log('✅ [AuthInfra] Session revoked');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('❌ [AuthInfra] Failed to revoke session:', error.message);
    return {
      success: false,
      error: parseApiError(error),
    };
  }
};

/**
 * Revoke all sessions except current
 * Useful for "Sign out from all devices"
 * @returns {Promise<Object>} Revocation result
 */
export const revokeAllOtherSessions = async () => {
  try {
    console.log('🔒 [AuthInfra] Revoking all other sessions...');
    
    const deviceId = await getDeviceId();
    const response = await authClient.post(ENDPOINTS.AUTH.REVOKE_ALL, {
      exceptDeviceId: deviceId,
    });
    
    console.log('✅ [AuthInfra] All other sessions revoked');
    
    return {
      success: true,
      data: response.data,
      revokedCount: response.data.revokedCount || 0,
    };
  } catch (error) {
    console.error('❌ [AuthInfra] Failed to revoke sessions:', error.message);
    return {
      success: false,
      error: parseApiError(error),
    };
  }
};

// ==================== AUTH HEALTH ====================

/**
 * Check authentication health
 * Verifies token validity and service availability
 * @returns {Promise<Object>} Health status
 */
export const checkAuthHealth = async () => {
  try {
    console.log('🏥 [AuthInfra] Checking auth health...');
    
    // Check if we have tokens
    const tokens = await getTokens();
    if (!tokens?.accessToken) {
      return {
        status: AUTH_HEALTH.NO_SESSION,
        healthy: false,
        message: 'No active session',
      };
    }
    
    // Check if token is expired or expiring soon
    const isExpired = await isTokenExpired(0);
    const isExpiringSoon = await isTokenExpired(5 * 60 * 1000); // 5 min buffer
    
    if (isExpired) {
      // Try to refresh
      try {
        const response = await authClient.get(ENDPOINTS.PROFILE.ME);
        // If this succeeds, token was refreshed by interceptor
        return {
          status: AUTH_HEALTH.HEALTHY,
          healthy: true,
          message: 'Token refreshed successfully',
          refreshed: true,
        };
      } catch {
        return {
          status: AUTH_HEALTH.TOKEN_EXPIRED,
          healthy: false,
          message: 'Token expired and refresh failed',
        };
      }
    }
    
    if (isExpiringSoon) {
      return {
        status: AUTH_HEALTH.TOKEN_EXPIRING,
        healthy: true,
        message: 'Token expiring soon, will refresh automatically',
      };
    }
    
    // Verify with backend
    try {
      const response = await authClient.get(ENDPOINTS.AUTH.HEALTH);
      
      const result = {
        status: AUTH_HEALTH.HEALTHY,
        healthy: true,
        message: 'Auth service healthy',
        serviceStatus: response.data,
      };
      
      // Cache health check result
      await AsyncStorage.setItem(AUTH_HEALTH_KEY, JSON.stringify({
        ...result,
        checkedAt: Date.now(),
      }));
      
      return result;
    } catch (error) {
      // Service might be down but tokens could still be valid locally
      return {
        status: AUTH_HEALTH.SERVICE_ERROR,
        healthy: true, // Local tokens are valid
        message: 'Auth service unreachable, local tokens valid',
        error: error.message,
      };
    }
  } catch (error) {
    console.error('❌ [AuthInfra] Auth health check failed:', error);
    return {
      status: AUTH_HEALTH.SERVICE_ERROR,
      healthy: false,
      message: error.message,
    };
  }
};

/**
 * Get last health check result from cache
 * @returns {Promise<Object|null>} Cached health status
 */
export const getCachedAuthHealth = async () => {
  try {
    const cached = await AsyncStorage.getItem(AUTH_HEALTH_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

// ==================== TRUSTED DEVICES ====================

/**
 * Mark current device as trusted
 * Trusted devices may have longer session durations
 * @param {string} deviceName - Optional custom name for device
 * @returns {Promise<Object>} Trust result
 */
export const trustCurrentDevice = async (deviceName = null) => {
  try {
    const deviceInfo = await getDeviceInfo();
    if (deviceName) {
      deviceInfo.customName = deviceName;
    }
    
    console.log('🔐 [AuthInfra] Trusting device:', deviceInfo.deviceId);
    
    const response = await authClient.post(ENDPOINTS.AUTH.TRUST_DEVICE, deviceInfo);
    
    // Store locally
    const trustedDevices = await getTrustedDevices();
    trustedDevices.push({
      ...deviceInfo,
      trustedAt: Date.now(),
    });
    await AsyncStorage.setItem(TRUSTED_DEVICES_KEY, JSON.stringify(trustedDevices));
    
    console.log('✅ [AuthInfra] Device trusted');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('❌ [AuthInfra] Failed to trust device:', error.message);
    return {
      success: false,
      error: parseApiError(error),
    };
  }
};

/**
 * Get list of trusted devices
 * @returns {Promise<Array>} Trusted devices
 */
export const getTrustedDevices = async () => {
  try {
    const stored = await AsyncStorage.getItem(TRUSTED_DEVICES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * Check if current device is trusted
 * @returns {Promise<boolean>} True if trusted
 */
export const isCurrentDeviceTrusted = async () => {
  try {
    const deviceId = await getDeviceId();
    const trustedDevices = await getTrustedDevices();
    return trustedDevices.some(d => d.deviceId === deviceId);
  } catch {
    return false;
  }
};

/**
 * Remove device trust
 * @param {string} deviceId - Device ID to untrust
 * @returns {Promise<Object>} Result
 */
export const untrustDevice = async (deviceId) => {
  try {
    console.log(`🔓 [AuthInfra] Removing trust for device: ${deviceId}`);
    
    const response = await authClient.delete(`${ENDPOINTS.AUTH.TRUST_DEVICE}/${deviceId}`);
    
    // Update local storage
    const trustedDevices = await getTrustedDevices();
    const filtered = trustedDevices.filter(d => d.deviceId !== deviceId);
    await AsyncStorage.setItem(TRUSTED_DEVICES_KEY, JSON.stringify(filtered));
    
    console.log('✅ [AuthInfra] Device trust removed');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('❌ [AuthInfra] Failed to untrust device:', error.message);
    return {
      success: false,
      error: parseApiError(error),
    };
  }
};

// ==================== TOKEN VALIDATION ====================

/**
 * Validate current access token with backend
 * Does not refresh, just validates
 * @returns {Promise<Object>} Validation result
 */
export const validateToken = async () => {
  try {
    console.log('🔍 [AuthInfra] Validating token...');
    
    const tokens = await getTokens();
    if (!tokens?.accessToken) {
      return {
        valid: false,
        reason: 'No token stored',
      };
    }
    
    const response = await authClient.get(ENDPOINTS.AUTH.VALIDATE);
    
    console.log('✅ [AuthInfra] Token valid');
    
    return {
      valid: true,
      user: response.data,
    };
  } catch (error) {
    console.error('❌ [AuthInfra] Token validation failed:', error.message);
    return {
      valid: false,
      reason: error.response?.data?.message || error.message,
    };
  }
};

/**
 * Force token refresh
 * Use when you need a fresh token (e.g., before sensitive operations)
 * @returns {Promise<Object>} Refresh result
 */
export const forceTokenRefresh = async () => {
  try {
    console.log('🔄 [AuthInfra] Forcing token refresh...');
    
    const tokens = await getTokens();
    if (!tokens?.refreshToken) {
      return {
        success: false,
        error: 'No refresh token available',
      };
    }
    
    const response = await authClient.post(ENDPOINTS.AUTH.REFRESH, {
      refreshToken: tokens.refreshToken,
    });
    
    const { accessToken, refreshToken, expiresIn } = response.data;
    await storeTokens(accessToken, refreshToken, expiresIn || 86400);
    
    console.log('✅ [AuthInfra] Token force refreshed');
    
    return {
      success: true,
      expiresIn,
    };
  } catch (error) {
    console.error('❌ [AuthInfra] Force refresh failed:', error.message);
    return {
      success: false,
      error: parseApiError(error),
    };
  }
};

// ==================== AUTH STATE OBSERVER ====================

let authStateListeners = [];

/**
 * Add listener for auth state changes
 * @param {Function} listener - Callback for auth state changes
 * @returns {Function} Unsubscribe function
 */
export const addAuthStateListener = (listener) => {
  authStateListeners.push(listener);
  return () => {
    authStateListeners = authStateListeners.filter(l => l !== listener);
  };
};

/**
 * Notify all listeners of auth state change
 * @param {string} state - New auth state
 * @param {Object} data - Additional data
 */
export const notifyAuthStateChange = (state, data = {}) => {
  console.log(`📢 [AuthInfra] Auth state changed: ${state}`, data);
  authStateListeners.forEach(listener => {
    try {
      listener(state, data);
    } catch (error) {
      console.error('❌ [AuthInfra] Listener error:', error);
    }
  });
};

// ==================== ENHANCED LOGIN ====================

/**
 * Login with device info tracking
 * Wraps the standard login to add device tracking
 * 
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Object} options - Login options
 * @param {boolean} options.trustDevice - Trust this device for future logins
 * @returns {Promise<Object>} Login result
 */
export const loginWithDeviceTracking = async (email, password, options = {}) => {
  try {
    const deviceInfo = await getDeviceInfo();
    
    console.log('🔐 [AuthInfra] Login with device tracking...');
    
    const response = await authClient.post(ENDPOINTS.AUTH.LOGIN, {
      email,
      password,
      deviceInfo,
      trustDevice: options.trustDevice || false,
    });
    
    const { accessToken, refreshToken, expiresIn, user } = response.data;
    await storeTokens(accessToken, refreshToken, expiresIn || 86400);
    
    // Trust device if requested
    if (options.trustDevice) {
      await trustCurrentDevice();
    }
    
    notifyAuthStateChange('LOGGED_IN', { user, deviceInfo });
    
    console.log('✅ [AuthInfra] Login successful');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('❌ [AuthInfra] Login failed:', error.message);
    return {
      success: false,
      error: parseApiError(error),
    };
  }
};

/**
 * Logout from current device
 * @param {boolean} revokeAll - Also revoke all other sessions
 * @returns {Promise<Object>} Logout result
 */
export const logoutWithCleanup = async (revokeAll = false) => {
  try {
    console.log('🔓 [AuthInfra] Logging out...');
    
    const tokens = await getTokens();
    
    if (tokens?.refreshToken) {
      try {
        if (revokeAll) {
          await revokeAllOtherSessions();
        }
        
        await authClient.post(ENDPOINTS.AUTH.LOGOUT, {
          refreshToken: tokens.refreshToken,
        });
      } catch (error) {
        // Continue with local cleanup even if server request fails
        console.warn('⚠️ [AuthInfra] Server logout failed, cleaning up locally');
      }
    }
    
    // Clear all auth-related storage
    await clearTokens();
    await AsyncStorage.multiRemove([
      SESSIONS_KEY,
      AUTH_HEALTH_KEY,
    ]);
    
    notifyAuthStateChange('LOGGED_OUT', {});
    
    console.log('✅ [AuthInfra] Logout complete');
    
    return { success: true };
  } catch (error) {
    console.error('❌ [AuthInfra] Logout error:', error.message);
    // Still clear local tokens
    await clearTokens();
    return { success: true, warning: 'Local cleanup completed with errors' };
  }
};

// ==================== EXPORTS ====================

export default {
  // Device management
  getDeviceId,
  getDeviceInfo,
  
  // Session management
  getActiveSessions,
  getCurrentSession,
  revokeSession,
  revokeAllOtherSessions,
  
  // Auth health
  checkAuthHealth,
  getCachedAuthHealth,
  AUTH_HEALTH,
  
  // Trusted devices
  trustCurrentDevice,
  getTrustedDevices,
  isCurrentDeviceTrusted,
  untrustDevice,
  
  // Token operations
  validateToken,
  forceTokenRefresh,
  
  // Auth state
  addAuthStateListener,
  notifyAuthStateChange,
  
  // Enhanced auth
  loginWithDeviceTracking,
  logoutWithCleanup,
  
  SESSION_STATUS,
};
