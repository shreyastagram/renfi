/**
 * API Client
 * 
 * Centralized HTTP client with error handling and interceptors
 * Includes separate clients for Node.js backend and Java Auth service
 * 
 * @version 2.0.0
 */

import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { getTokens, storeTokens, clearTokens, isTokenExpired } from '../utils/storage';

// Track if we're currently refreshing tokens to avoid infinite loops
let isRefreshing = false;
let refreshSubscribers = [];
let refreshPromise = null;

/**
 * Subscribe to token refresh
 */
const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

/**
 * Notify all subscribers that token was refreshed
 */
const onTokenRefreshed = (accessToken) => {
  refreshSubscribers.forEach((callback) => callback(accessToken));
  refreshSubscribers = [];
};

/**
 * Proactively refresh token if expired or about to expire
 * This is called before making requests to ensure we have a valid token
 * @returns {Promise<string|null>} New access token or null if refresh fails
 */
const proactiveTokenRefresh = async () => {
  // Check if token is expired or expiring soon (5 minute buffer)
  const expired = await isTokenExpired(5 * 60 * 1000);
  
  if (!expired) {
    const tokens = await getTokens();
    return tokens?.accessToken || null;
  }
  
  console.log('🔄 [API] Token expired/expiring, proactive refresh needed');
  
  // If already refreshing, wait for the existing refresh to complete
  if (isRefreshing && refreshPromise) {
    console.log('🔄 [API] Waiting for existing refresh...');
    return refreshPromise;
  }
  
  isRefreshing = true;
  
  refreshPromise = (async () => {
    try {
      const tokens = await getTokens();
      if (!tokens?.refreshToken) {
        console.log('❌ [API] No refresh token available');
        await clearTokens();
        if (global.onAuthExpired) {
          global.onAuthExpired();
        }
        return null;
      }
      
      console.log('🔄 [API] Refreshing tokens proactively...');
      
      const response = await axios.post(
        `${API_CONFIG.JAVA_AUTH_URL}/api/auth/refresh`,
        { refreshToken: tokens.refreshToken },
        { headers: API_CONFIG.HEADERS }
      );
      
      const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
      await storeTokens(accessToken, newRefreshToken, expiresIn || 86400);
      
      console.log('✅ [API] Proactive token refresh successful');
      onTokenRefreshed(accessToken);
      
      return accessToken;
    } catch (error) {
      console.error('❌ [API] Proactive token refresh failed:', error.message);
      
      // Clear tokens and notify app
      await clearTokens();
      if (global.onAuthExpired) {
        global.onAuthExpired();
      }
      
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
};

/**
 * Create axios instance for Node.js backend (registration, profiles)
 */
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
});

/**
 * Create axios instance for Java Auth service (login, logout, verification)
 */
export const authClient = axios.create({
  baseURL: API_CONFIG.JAVA_AUTH_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
});

/**
 * Add auth header to config with proactive token refresh
 */
const addAuthHeader = async (config) => {
  // Skip token check for auth endpoints that don't need tokens
  const skipRefreshUrls = ['/refresh', '/login', '/register', '/forgot-password', '/reset-password', '/oauth2', '/google'];
  const shouldSkip = skipRefreshUrls.some(url => config.url?.includes(url));
  
  if (shouldSkip) {
    // For login/register, just add existing token if available (optional)
    const tokens = await getTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  }
  
  // For protected endpoints, do proactive token refresh
  const accessToken = await proactiveTokenRefresh();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else {
    console.warn('⚠️ [API] No valid token available for request');
  }
  return config;
};

/**
 * Request interceptor for Node.js backend
 */
apiClient.interceptors.request.use(
  async (config) => {
    console.log(`📤 [API] ${config.method?.toUpperCase()} ${config.url}`);
    return addAuthHeader(config);
  },
  (error) => {
    console.error('❌ [API] Request error:', error);
    return Promise.reject(error);
  }
);

/**
 * Request interceptor for Java Auth client
 */
authClient.interceptors.request.use(
  async (config) => {
    console.log(`📤 [AUTH] ${config.method?.toUpperCase()} ${config.url}`);
    return addAuthHeader(config);
  },
  (error) => {
    console.error('❌ [AUTH] Request error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response error handler with token refresh
 */
const handleResponseError = async (error, client) => {
  const originalRequest = error.config;
  
  // Detailed error logging
  const errorInfo = {
    url: error.config?.url,
    baseURL: error.config?.baseURL,
    method: error.config?.method,
    status: error.response?.status,
    statusText: error.response?.statusText,
    message: error.response?.data?.message || error.message,
    data: error.response?.data,
    code: error.code,
  };
  console.error('❌ [API] Response error:', errorInfo);
  
  // Log network errors specifically
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    console.error('🚫 [API] Cannot connect to server. Is the backend running?');
  }
  
  // Handle 401 Unauthorized - Token expired
  if (error.response?.status === 401 && !originalRequest._retry) {
    // Don't retry refresh/logout endpoints
    if (originalRequest.url?.includes('/refresh') || originalRequest.url?.includes('/logout')) {
      return Promise.reject(error);
    }
    
    originalRequest._retry = true;
    
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = (async () => {
        try {
          const tokens = await getTokens();
          if (tokens?.refreshToken) {
            console.log('🔄 [API] Attempting token refresh (401 handler)...');
            
            const response = await axios.post(
              `${API_CONFIG.JAVA_AUTH_URL}/api/auth/refresh`,
              { refreshToken: tokens.refreshToken },
              { headers: API_CONFIG.HEADERS }
            );
            
            const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
            await storeTokens(accessToken, newRefreshToken, expiresIn || 86400);
            
            console.log('✅ [API] Token refresh successful');
            isRefreshing = false;
            refreshPromise = null;
            onTokenRefreshed(accessToken);
            
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return client(originalRequest);
          } else {
            throw new Error('No refresh token available');
          }
        } catch (refreshError) {
          console.error('❌ [API] Token refresh failed:', refreshError.message);
          isRefreshing = false;
          refreshPromise = null;
          
          // Clear tokens and force re-login
          await clearTokens();
          
          // Emit event for app to handle logout
          // This will be caught by the AppContext
          if (global.onAuthExpired) {
            global.onAuthExpired();
          }
          
          return Promise.reject(refreshError);
        }
      })();
      
      return refreshPromise;
    } else {
      // Wait for refresh to complete
      return new Promise((resolve) => {
        subscribeTokenRefresh((accessToken) => {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          resolve(client(originalRequest));
        });
      });
    }
  }
  
  return Promise.reject(error);
};

/**
 * Response interceptor for Node.js backend
 */
apiClient.interceptors.response.use(
  (response) => {
    console.log(`📥 [API] Response ${response.status}:`, response.config.url);
    return response;
  },
  (error) => handleResponseError(error, apiClient)
);

/**
 * Response interceptor for Java Auth client
 */
authClient.interceptors.response.use(
  (response) => {
    console.log(`📥 [AUTH] Response ${response.status}:`, response.config.url);
    return response;
  },
  (error) => handleResponseError(error, authClient)
);

/**
 * Parse API error response
 * @param {Error} error - Axios error object
 * @returns {Object} Parsed error object
 */
export const parseApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { data, status } = error.response;
    return {
      status,
      code: data.code || data.error || 'UNKNOWN_ERROR',
      message: data.message || 'An error occurred',
      errors: data.errors || null,
      hint: data.hint || null,
      success: data.success ?? false,
    };
  } else if (error.request) {
    // Request made but no response
    let message = 'Unable to connect to server.';
    let hint = 'Please check your internet connection';
    
    // Check for specific network errors
    if (error.code === 'ECONNREFUSED') {
      message = 'Cannot connect to backend server.';
      hint = 'Make sure the backend is running';
    } else if (error.code === 'ENOTFOUND') {
      message = 'Cannot find backend server.';
      hint = 'Check your network connection and backend URL';
    } else if (error.code === 'ETIMEDOUT') {
      message = 'Connection timed out.';
      hint = 'The server is taking too long to respond';
    }
    
    return {
      status: 0,
      code: 'NETWORK_ERROR',
      message,
      errors: null,
      hint,
      errorCode: error.code,
    };
  } else {
    // Error in request setup
    return {
      status: 0,
      code: 'REQUEST_ERROR',
      message: error.message || 'An unexpected error occurred',
      errors: null,
      hint: null,
    };
  }
};

/**
 * Validate and refresh tokens on app startup
 * Call this from AppContext during initialization
 * @returns {Promise<{valid: boolean, accessToken: string|null}>}
 */
export const validateAndRefreshTokens = async () => {
  console.log('🔄 [API] Validating tokens on startup...');
  
  const tokens = await getTokens();
  
  if (!tokens?.refreshToken) {
    console.log('❌ [API] No refresh token found');
    return { valid: false, accessToken: null };
  }
  
  // Check if access token is expired
  const expired = await isTokenExpired(0); // No buffer for startup check
  
  if (!expired && tokens.accessToken) {
    console.log('✅ [API] Access token is still valid');
    return { valid: true, accessToken: tokens.accessToken };
  }
  
  // Token is expired or expiring, try to refresh
  console.log('🔄 [API] Access token expired, refreshing...');
  
  try {
    const response = await axios.post(
      `${API_CONFIG.JAVA_AUTH_URL}/api/auth/refresh`,
      { refreshToken: tokens.refreshToken },
      { headers: API_CONFIG.HEADERS }
    );
    
    const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
    await storeTokens(accessToken, newRefreshToken, expiresIn || 86400);
    
    console.log('✅ [API] Token refresh successful on startup');
    return { valid: true, accessToken };
  } catch (error) {
    console.error('❌ [API] Token refresh failed on startup:', error.message);
    
    // Clear invalid tokens
    await clearTokens();
    
    return { valid: false, accessToken: null };
  }
};

export default apiClient;
