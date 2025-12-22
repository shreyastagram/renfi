/**
 * API Client - Axios Instance with Automatic Token Refresh
 * 
 * This module creates an Axios instance that:
 * ✅ Automatically adds Authorization: Bearer <token> to protected requests
 * ✅ Automatically refreshes token on 401 errors
 * ✅ Handles network errors gracefully
 * 
 * NO FALLBACKS - If something fails, it fails. This ensures we always know the real problem.
 * 
 * @version 1.0.0
 * @author FixHomi Team
 */

import axios from 'axios';
import { API_CONFIG } from '../../utils/apiConfig';
import tokenService from '../services/tokenService';

// ============================================================================
// Create Axios Instance for JARBAC Auth Service
// ============================================================================

const authClient = axios.create({
  baseURL: API_CONFIG.AUTH_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// Create Axios Instance for Node.js Business Logic Service
// ============================================================================

const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// Token Refresh State (to prevent multiple simultaneous refresh calls)
// ============================================================================

let isRefreshing = false;
let refreshSubscribers = [];

/**
 * Subscribe to token refresh completion
 * @param {Function} callback - Called with new access token when refresh completes
 */
const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

/**
 * Notify all subscribers that token refresh is complete
 * @param {string} accessToken - New access token
 */
const onRefreshComplete = (accessToken) => {
  refreshSubscribers.forEach((callback) => callback(accessToken));
  refreshSubscribers = [];
};

/**
 * Notify all subscribers that token refresh failed
 * @param {Error} error - Refresh error
 */
const onRefreshFailed = (error) => {
  refreshSubscribers.forEach((callback) => callback(null, error));
  refreshSubscribers = [];
};

// ============================================================================
// Request Interceptor - Add Authorization Header
// ============================================================================

/**
 * Add auth token to requests (for both clients)
 */
const addAuthHeader = async (config) => {
  // Skip adding token for auth endpoints that don't need it
  const noAuthEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/health',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/oauth2/google/mobile',
  ];
  
  const isNoAuthEndpoint = noAuthEndpoints.some(endpoint => 
    config.url?.includes(endpoint)
  );
  
  if (isNoAuthEndpoint) {
    console.log(`🔓 [Client] No auth needed for: ${config.url}`);
    return config;
  }
  
  try {
    const accessToken = await tokenService.getAccessToken();
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
      console.log(`🔐 [Client] Added auth header for: ${config.url}`);
    } else {
      console.log(`⚠️ [Client] No access token available for: ${config.url}`);
    }
  } catch (error) {
    console.error('❌ [Client] Error getting access token:', error);
  }
  
  return config;
};

// Apply request interceptor to both clients
authClient.interceptors.request.use(addAuthHeader, (error) => Promise.reject(error));
apiClient.interceptors.request.use(addAuthHeader, (error) => Promise.reject(error));

// ============================================================================
// Response Interceptor - Handle 401 and Token Refresh
// ============================================================================

/**
 * Handle 401 errors and refresh token automatically
 */
const handle401Error = async (error, client) => {
  const originalRequest = error.config;
  
  // Check if this is a 401 error and we haven't already tried to refresh
  if (error.response?.status === 401 && !originalRequest._retry) {
    console.log('🔄 [Client] 401 received, attempting token refresh');
    
    // Skip refresh for auth endpoints
    const isAuthEndpoint = originalRequest.url?.includes('/api/auth/');
    if (isAuthEndpoint && !originalRequest.url?.includes('/api/users/')) {
      console.log('❌ [Client] 401 on auth endpoint, not refreshing');
      return Promise.reject(error);
    }
    
    originalRequest._retry = true;
    
    // If already refreshing, wait for it to complete
    if (isRefreshing) {
      console.log('⏳ [Client] Token refresh in progress, waiting...');
      
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((accessToken, refreshError) => {
          if (refreshError || !accessToken) {
            reject(refreshError || new Error('Token refresh failed'));
          } else {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            resolve(client(originalRequest));
          }
        });
      });
    }
    
    isRefreshing = true;
    
    try {
      // Get refresh token from storage
      const refreshToken = await tokenService.getRefreshToken();
      
      if (!refreshToken) {
        console.log('❌ [Client] No refresh token available');
        throw new Error('No refresh token available');
      }
      
      console.log('🔄 [Client] Calling refresh token API');
      
      // Call refresh endpoint (use a fresh axios instance to avoid interceptor loops)
      const response = await axios.post(
        `${API_CONFIG.AUTH_BASE_URL}/api/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      const { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
      
      console.log('✅ [Client] Token refresh successful');
      
      // Save new tokens (token rotation - old refresh token is now invalid)
      await tokenService.updateTokensAfterRefresh({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
      });
      
      isRefreshing = false;
      onRefreshComplete(newAccessToken);
      
      // Retry original request with new token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return client(originalRequest);
      
    } catch (refreshError) {
      console.error('❌ [Client] Token refresh failed:', refreshError.message);
      
      isRefreshing = false;
      onRefreshFailed(refreshError);
      
      // Clear auth state - user needs to login again
      await tokenService.clearAuthState();
      
      // Create a clear error for the caller
      const authError = new Error('Session expired. Please login again.');
      authError.isAuthError = true;
      authError.requiresLogin = true;
      
      return Promise.reject(authError);
    }
  }
  
  return Promise.reject(error);
};

// Apply response interceptor to both clients
authClient.interceptors.response.use(
  (response) => response,
  (error) => handle401Error(error, authClient)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => handle401Error(error, apiClient)
);

// ============================================================================
// Auth Service Functions (using authClient)
// ============================================================================

/**
 * Check if JARBAC auth service is healthy and reachable
 * Use this before login/register to provide better UX
 * 
 * @returns {Promise<Object>} - Health status object
 * @throws {Error} - If service is not reachable
 */
export const healthCheck = async () => {
  console.log('🏥 [Client] Checking auth service health');
  
  try {
    const response = await authClient.get('/api/auth/health', { timeout: 5000 });
    console.log('✅ [Client] Auth service is healthy:', response.data);
    return {
      isHealthy: true,
      status: response.data.status || 'UP',
      message: response.data.message || 'Auth service is running',
    };
  } catch (error) {
    console.error('❌ [Client] Auth service health check failed:', error.message);
    return {
      isHealthy: false,
      status: 'DOWN',
      message: error.code === 'ECONNREFUSED' 
        ? 'JARBAC auth service is not running. Start it with: ./mvnw spring-boot:run'
        : error.message,
      error: error,
    };
  }
};

/**
 * Check JARBAC availability before operations
 * @returns {Promise<boolean>} - True if JARBAC is available
 */
export const isJarbacAvailable = async () => {
  try {
    const health = await healthCheck();
    return health.isHealthy;
  } catch {
    return false;
  }
};

/**
 * Login with email and password
 * Production-grade login with validation and detailed error handling
 * 
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<Object>} - Login response with tokens and user info
 * @throws {Error} - Detailed error with context
 */
export const login = async (email, password) => {
  console.log('🔐 [Client] Attempting login for:', email);
  
  // Input validation
  if (!email || !email.trim()) {
    const error = new Error('Email is required');
    error.isValidationError = true;
    throw error;
  }
  
  if (!password) {
    const error = new Error('Password is required');
    error.isValidationError = true;
    throw error;
  }
  
  try {
    const response = await authClient.post('/api/auth/login', { 
      email: email.trim().toLowerCase(), 
      password 
    });
    
    // Validate response structure
    if (!response.data?.accessToken || !response.data?.userId) {
      console.error('❌ [Client] Invalid login response structure:', response.data);
      throw new Error('Invalid server response. Please try again.');
    }
    
    // Save auth state
    await tokenService.saveAuthState(response.data);
    
    console.log('✅ [Client] Login successful for user:', response.data.userId);
    console.log('📧 [Client] User email:', response.data.email);
    console.log('👤 [Client] User role:', response.data.role);
    
    return response.data;
    
  } catch (error) {
    // Add context to the error
    console.error('❌ [Client] Login failed for:', email);
    console.error('❌ [Client] Error details:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      url: error.config?.url,
    });
    
    // Re-throw for caller to handle
    throw error;
  }
};

/**
 * Login with phone number and password
 * JARBAC Endpoint: POST /api/auth/login/phone
 * 
 * @param {string} phoneNumber - User's phone number (with country code)
 * @param {string} password - User's password
 * @returns {Promise<Object>} - Login response with tokens and user info
 * @throws {Error} - Detailed error with context
 */
export const loginWithPhone = async (phoneNumber, password) => {
  console.log('🔐 [Client] Attempting phone login for:', phoneNumber);
  
  // Input validation
  if (!phoneNumber || !phoneNumber.trim()) {
    const error = new Error('Phone number is required');
    error.isValidationError = true;
    throw error;
  }
  
  if (!password) {
    const error = new Error('Password is required');
    error.isValidationError = true;
    throw error;
  }
  
  // Normalize phone number - add +91 if missing country code
  let normalizedPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
  if (!normalizedPhone.startsWith('+')) {
    if (/^\d{10}$/.test(normalizedPhone)) {
      normalizedPhone = '+91' + normalizedPhone;
    } else if (/^\d{11,15}$/.test(normalizedPhone)) {
      normalizedPhone = '+' + normalizedPhone;
    }
  }
  
  try {
    const response = await authClient.post('/api/auth/login/phone', { 
      phoneNumber: normalizedPhone, 
      password 
    });
    
    // Validate response structure
    if (!response.data?.accessToken || !response.data?.userId) {
      console.error('❌ [Client] Invalid phone login response structure:', response.data);
      throw new Error('Invalid server response. Please try again.');
    }
    
    // Save auth state
    await tokenService.saveAuthState(response.data);
    
    console.log('✅ [Client] Phone login successful for user:', response.data.userId);
    console.log('📱 [Client] User phone:', response.data.phoneNumber);
    console.log('👤 [Client] User role:', response.data.role);
    
    return response.data;
    
  } catch (error) {
    // Add context to the error
    console.error('❌ [Client] Phone login failed for:', phoneNumber);
    console.error('❌ [Client] Error details:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      url: error.config?.url,
    });
    
    // Re-throw for caller to handle
    throw error;
  }
};

/**
 * Smart login - automatically detects email vs phone and uses appropriate endpoint
 * 
 * @param {string} identifier - Email or phone number
 * @param {string} password - User's password
 * @returns {Promise<Object>} - Login response with tokens and user info
 */
export const smartLogin = async (identifier, password) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (emailRegex.test(identifier)) {
    console.log('📧 [Client] Detected email login');
    return login(identifier, password);
  } else {
    console.log('📱 [Client] Detected phone login');
    return loginWithPhone(identifier, password);
  }
};

/**
 * Register a new user
 * Production-grade registration with validation and detailed error handling
 * 
 * @param {Object} userData - Registration data
 * @param {string} userData.email - User's email
 * @param {string} userData.password - User's password (min 8 chars, 1 upper, 1 lower, 1 digit, 1 special)
 * @param {string} userData.fullName - User's full name
 * @param {string} userData.phoneNumber - User's phone number (optional)
 * @param {string} userData.role - 'USER' or 'SERVICE_PROVIDER'
 * @returns {Promise<Object>} - Registration response with tokens and user info
 * @throws {Error} - Detailed error with context
 */
export const register = async (userData) => {
  console.log('📝 [Client] Attempting registration for:', userData.email);
  
  // Input validation
  if (!userData.email || !userData.email.trim()) {
    const error = new Error('Email is required');
    error.isValidationError = true;
    throw error;
  }
  
  if (!userData.password) {
    const error = new Error('Password is required');
    error.isValidationError = true;
    throw error;
  }
  
  if (!userData.fullName || !userData.fullName.trim()) {
    const error = new Error('Full name is required');
    error.isValidationError = true;
    throw error;
  }
  
  // Validate role
  const validRoles = ['USER', 'SERVICE_PROVIDER'];
  const role = userData.role || 'USER';
  if (!validRoles.includes(role)) {
    const error = new Error(`Invalid role: ${role}. Must be USER or SERVICE_PROVIDER`);
    error.isValidationError = true;
    throw error;
  }
  
  try {
    const requestBody = {
      email: userData.email.trim().toLowerCase(),
      password: userData.password,
      fullName: userData.fullName.trim(),
      phoneNumber: userData.phoneNumber || userData.phone || null,
      role: role,
    };
    
    console.log('📤 [Client] Registration request:', { ...requestBody, password: '***' });
    
    const response = await authClient.post('/api/auth/register', requestBody);
    
    // Validate response structure
    if (!response.data?.accessToken || !response.data?.userId) {
      console.error('❌ [Client] Invalid register response structure:', response.data);
      throw new Error('Invalid server response. Please try again.');
    }
    
    // Save auth state
    await tokenService.saveAuthState(response.data);
    
    console.log('✅ [Client] Registration successful for user:', response.data.userId);
    console.log('📧 [Client] User email:', response.data.email);
    console.log('👤 [Client] User role:', response.data.role);
    
    return response.data;
    
  } catch (error) {
    // Add context to the error
    console.error('❌ [Client] Registration failed for:', userData.email);
    console.error('❌ [Client] Error details:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    
    // Re-throw for caller to handle
    throw error;
  }
};

/**
 * Logout and invalidate refresh token
 * Clears local tokens even if API call fails
 */
export const logout = async () => {
  console.log('👋 [Client] Logging out');
  
  try {
    // Get refresh token to invalidate on server
    const refreshToken = await tokenService.getRefreshToken();
    
    if (refreshToken) {
      // Call logout API to revoke server-side refresh token
      await authClient.post('/api/auth/logout', { refreshToken });
      console.log('✅ [Client] Server-side logout successful');
    }
  } catch (error) {
    // Log error but continue with local logout
    console.warn('⚠️ [Client] Server-side logout failed:', error.message);
  }
  
  // Always clear local tokens (even if API call failed)
  await tokenService.clearAuthState();
  
  console.log('✅ [Client] Local logout complete');
};

/**
 * Refresh access token
 * Note: This is typically called automatically by the 401 interceptor
 * 
 * @returns {Promise<Object>} - New tokens and user info
 */
export const refreshToken = async () => {
  console.log('🔄 [Client] Manually refreshing token');
  
  const currentRefreshToken = await tokenService.getRefreshToken();
  
  if (!currentRefreshToken) {
    throw new Error('No refresh token available');
  }
  
  const response = await authClient.post('/api/auth/refresh', { 
    refreshToken: currentRefreshToken 
  });
  
  // Save new tokens (token rotation)
  await tokenService.updateTokensAfterRefresh(response.data);
  
  console.log('✅ [Client] Token refresh successful');
  return response.data;
};

/**
 * Google Sign-In for mobile (React Native)
 * 
 * @param {string} idToken - Google ID token from @react-native-google-signin
 * @returns {Promise<Object>} - Login response with tokens and user info
 */
export const googleMobileAuth = async (idToken) => {
  console.log('🔐 [Client] Attempting Google mobile authentication');
  
  const response = await authClient.post('/api/auth/oauth2/google/mobile', { idToken });
  
  // Save auth state
  await tokenService.saveAuthState(response.data);
  
  console.log('✅ [Client] Google auth successful for user:', response.data.userId);
  return response.data;
};

// ============================================================================
// Export Clients and Functions
// ============================================================================

export {
  authClient,  // For auth-related requests
  apiClient,   // For business logic requests (Node.js backend)
};

const client = {
  // Health check
  healthCheck,
  isJarbacAvailable,
  
  // Auth operations
  login,
  loginWithPhone,
  smartLogin,
  register,
  logout,
  refreshToken,
  googleMobileAuth,
  
  // Axios instances for direct use
  auth: authClient,
  api: apiClient,
};

export default client;