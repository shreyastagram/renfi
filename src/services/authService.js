/**
 * Auth Service
 * 
 * Handles all authentication-related API calls
 * - Registration (via Node.js → Java Auth → MongoDB)
 * - Login (via Java Auth directly)
 * - OTP-based passwordless login
 * - Account verification
 * - Logout and token management
 * 
 * @version 2.0.0
 */

import apiClient, { authClient, parseApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

/**
 * Allowed service categories for providers
 * These match the MongoDB model validation
 */
export const SERVICE_CATEGORIES = [
  { id: 'electrician', label: 'Electrician' },
  { id: 'plumber', label: 'Plumber' },
  { id: 'electronics_technician', label: 'Electronics Technician' },
  { id: 'carpenter', label: 'Carpenter' },
  { id: 'painter', label: 'Painter' },
  { id: 'solar_repairing', label: 'Solar Repairing' },
  { id: 'welder', label: 'Welder' },
  { id: 'salon', label: 'Salon' },
  { id: 'vehicle_cleaning', label: 'Vehicle Cleaning' },
  { id: 'mason_tiler', label: 'Mason & Tiler' },
  { id: 'driver', label: 'Driver' },
  { id: 'ac_repair', label: 'AC Repair' },
  { id: 'cleaning', label: 'Cleaning' },
];

/**
 * Authentication Response Codes
 * These match the backend response codes for proper UI handling
 */
export const AUTH_CODES = {
  // Success codes
  REGISTRATION_SUCCESS: 'REGISTRATION_SUCCESS',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  OTP_SENT: 'OTP_SENT',
  OTP_VERIFIED: 'OTP_VERIFIED',
  VERIFICATION_SENT: 'VERIFICATION_SENT',
  LOGOUT_SUCCESS: 'LOGOUT_SUCCESS',
  
  // User existence
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  PROVIDER_ALREADY_EXISTS: 'PROVIDER_ALREADY_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  
  // Validation errors
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
  INVALID_EMAIL_FORMAT: 'INVALID_EMAIL_FORMAT',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  PASSWORD_TOO_LONG: 'PASSWORD_TOO_LONG',
  INVALID_FULL_NAME: 'INVALID_FULL_NAME',
  FULL_NAME_TOO_LONG: 'FULL_NAME_TOO_LONG',
  INVALID_PROVIDER_NAME: 'INVALID_PROVIDER_NAME',
  PROVIDER_NAME_TOO_LONG: 'PROVIDER_NAME_TOO_LONG',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  
  // Auth errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  PHONE_NOT_VERIFIED: 'PHONE_NOT_VERIFIED',
  
  // OTP errors
  INVALID_OTP: 'INVALID_OTP',
  OTP_EXPIRED: 'OTP_EXPIRED',
  MAX_ATTEMPTS_EXCEEDED: 'MAX_ATTEMPTS_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  
  // Token errors
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  
  // Conflict errors
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  PHONE_ALREADY_EXISTS: 'PHONE_ALREADY_EXISTS',
  
  // Server errors
  AUTH_SERVICE_UNAVAILABLE: 'AUTH_SERVICE_UNAVAILABLE',
  AUTH_SERVICE_ERROR: 'AUTH_SERVICE_ERROR',
  MONGODB_SYNC_FAILED: 'MONGODB_SYNC_FAILED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
};

// ==================== REGISTRATION ====================

/**
 * Register a new user
 * Goes through Node.js → Java Auth → MongoDB
 * 
 * @param {Object} userData - User registration data
 * @param {string} userData.email - User email (required)
 * @param {string} userData.password - User password (required, min 8 chars)
 * @param {string} userData.fullName - User full name (required, min 2 chars)
 * @param {string} userData.phone - User phone number (optional)
 * @param {Object} userData.location - User location (optional)
 * @returns {Promise<Object>} Registration response
 */
export const registerUser = async (userData) => {
  try {
    console.log('📝 [AuthService] Registering user:', { email: userData.email });
    
    const response = await apiClient.post(ENDPOINTS.AUTH.REGISTER, {
      email: userData.email.trim().toLowerCase(),
      password: userData.password,
      fullName: userData.fullName.trim(),
      phone: userData.phone?.trim() || undefined,
      location: userData.location || undefined,
    });
    
    console.log('✅ [AuthService] Registration successful');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Registration failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Register a new provider
 * Goes through Node.js → Java Auth → MongoDB
 * 
 * @param {Object} providerData - Provider registration data
 * @returns {Promise<Object>} Registration response
 */
export const registerProvider = async (providerData) => {
  try {
    console.log('📝 [AuthService] Registering provider:', { email: providerData.email, name: providerData.name });
    
    const requestBody = {
      email: providerData.email.trim().toLowerCase(),
      password: providerData.password,
      name: providerData.name.trim(),
      address: providerData.address.trim(),
    };
    
    // Add optional fields
    if (providerData.phone?.trim()) requestBody.phone = providerData.phone.trim();
    if (providerData.city?.trim()) requestBody.city = providerData.city.trim();
    if (providerData.pincode?.trim()) requestBody.pincode = providerData.pincode.trim();
    if (providerData.serviceCategories?.length > 0) requestBody.serviceCategories = providerData.serviceCategories;
    if (providerData.experience?.trim()) requestBody.experience = providerData.experience.trim();
    if (providerData.latitude !== undefined && providerData.longitude !== undefined) {
      requestBody.latitude = providerData.latitude;
      requestBody.longitude = providerData.longitude;
    }
    
    const response = await apiClient.post(ENDPOINTS.AUTH.PROVIDER_REGISTER, requestBody);
    
    console.log('✅ [AuthService] Provider registration successful');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Provider registration failed:', parsedError);
    
    // Handle MONGODB_SYNC_FAILED - provider created in Java Auth
    if (error.response?.data?.code === 'MONGODB_SYNC_FAILED' && error.response?.data?.accessToken) {
      console.warn('⚠️ [AuthService] MongoDB sync failed but auth succeeded - proceeding with tokens');
      return {
        success: true,
        data: error.response.data,
        warning: 'Profile sync pending. Some features may be limited.',
      };
    }
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== LOGIN ====================

/**
 * Login with email and password
 * Direct call to Java Auth
 * 
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Login response with tokens
 */
export const loginWithEmail = async (email, password) => {
  try {
    console.log('🔐 [AuthService] Logging in with email:', email);
    
    const response = await authClient.post(ENDPOINTS.LOGIN.EMAIL, {
      email: email.trim().toLowerCase(),
      password,
    });
    
    console.log('✅ [AuthService] Email login successful');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Email login failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Login with phone number and password
 * Direct call to Java Auth
 * 
 * @param {string} phoneNumber - User phone number (with country code)
 * @param {string} password - User password
 * @returns {Promise<Object>} Login response with tokens
 */
export const loginWithPhone = async (phoneNumber, password) => {
  try {
    console.log('🔐 [AuthService] Logging in with phone:', phoneNumber);
    
    const response = await authClient.post(ENDPOINTS.LOGIN.PHONE, {
      phoneNumber: phoneNumber.trim(),
      password,
    });
    
    console.log('✅ [AuthService] Phone login successful');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Phone login failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== OTP-BASED PASSWORDLESS LOGIN ====================

/**
 * Send OTP for phone-based passwordless login
 * 
 * @param {string} phoneNumber - Phone number to send OTP to
 * @returns {Promise<Object>} Response with masked phone and expiry
 */
export const sendPhoneLoginOtp = async (phoneNumber) => {
  try {
    console.log('📱 [AuthService] Sending phone login OTP');
    
    const response = await authClient.post(ENDPOINTS.OTP_LOGIN.PHONE_SEND_OTP, {
      phoneNumber: phoneNumber.trim(),
    });
    
    console.log('✅ [AuthService] Phone OTP sent');
    
    return {
      success: true,
      data: response.data,
      maskedPhone: response.data.maskedPhone,
      expiresInMinutes: response.data.expiresInMinutes || 5,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Send phone OTP failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Verify phone OTP and complete passwordless login
 * 
 * @param {string} phoneNumber - Phone number
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<Object>} Login response with tokens
 */
export const verifyPhoneLoginOtp = async (phoneNumber, otp) => {
  try {
    console.log('🔐 [AuthService] Verifying phone login OTP');
    
    const response = await authClient.post(ENDPOINTS.OTP_LOGIN.PHONE_VERIFY, {
      phoneNumber: phoneNumber.trim(),
      otp: otp.trim(),
    });
    
    console.log('✅ [AuthService] Phone OTP login successful');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Phone OTP verification failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Send OTP for email-based passwordless login
 * 
 * @param {string} email - Email to send OTP to
 * @returns {Promise<Object>} Response with masked email and expiry
 */
export const sendEmailLoginOtp = async (email) => {
  try {
    console.log('📧 [AuthService] Sending email login OTP');
    
    const response = await authClient.post(ENDPOINTS.OTP_LOGIN.EMAIL_SEND_OTP, {
      email: email.trim().toLowerCase(),
    });
    
    console.log('✅ [AuthService] Email OTP sent');
    
    return {
      success: true,
      data: response.data,
      maskedEmail: response.data.maskedEmail,
      expiresInMinutes: response.data.expiresInMinutes || 5,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Send email OTP failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Verify email OTP and complete passwordless login
 * 
 * @param {string} email - Email address
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<Object>} Login response with tokens
 */
export const verifyEmailLoginOtp = async (email, otp) => {
  try {
    console.log('🔐 [AuthService] Verifying email login OTP');
    
    const response = await authClient.post(ENDPOINTS.OTP_LOGIN.EMAIL_VERIFY, {
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
    });
    
    console.log('✅ [AuthService] Email OTP login successful');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Email OTP verification failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== ACCOUNT VERIFICATION ====================

/**
 * Send OTP to verify user's phone number (requires auth token)
 * 
 * @returns {Promise<Object>} Response with masked phone
 */
export const sendPhoneVerificationOtp = async () => {
  try {
    console.log('📱 [AuthService] Sending phone verification OTP');
    
    const response = await authClient.post(ENDPOINTS.VERIFICATION.SEND_PHONE_OTP);
    
    console.log('✅ [AuthService] Phone verification OTP sent');
    
    return {
      success: true,
      data: response.data,
      maskedPhone: response.data.maskedValue,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Send phone verification OTP failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Verify OTP to confirm phone number (requires auth token)
 * 
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<Object>} Verification response
 */
export const verifyPhoneOtp = async (otp) => {
  try {
    console.log('✓ [AuthService] Verifying phone OTP');
    
    const response = await authClient.post(ENDPOINTS.VERIFICATION.VERIFY_PHONE_OTP, {
      otp: otp.trim(),
    });
    
    console.log('✅ [AuthService] Phone verified successfully');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Phone verification failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Send email verification link (requires auth token)
 * 
 * @returns {Promise<Object>} Response with masked email
 */
export const sendEmailVerification = async () => {
  try {
    console.log('📧 [AuthService] Sending email verification');
    
    const response = await authClient.post(ENDPOINTS.VERIFICATION.SEND_EMAIL_VERIFICATION);
    
    console.log('✅ [AuthService] Email verification sent');
    
    return {
      success: true,
      data: response.data,
      maskedEmail: response.data.maskedValue,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Send email verification failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Verify email using token from deep link
 * This is called when user clicks the email verification link
 * 
 * @param {string} token - Verification token from email link
 * @returns {Promise<Object>} Verification response
 */
export const verifyEmailToken = async (token) => {
  try {
    console.log('✓ [AuthService] Verifying email token');
    
    const response = await authClient.get(ENDPOINTS.VERIFICATION.VERIFY_EMAIL, {
      params: { token },
    });
    
    console.log('✅ [AuthService] Email verified successfully');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Email verification failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== LOGOUT & TOKEN MANAGEMENT ====================

/**
 * Logout user by revoking refresh token
 * 
 * @param {string} refreshToken - Refresh token to revoke
 * @returns {Promise<Object>} Logout response
 */
export const logout = async (refreshToken) => {
  try {
    console.log('🚪 [AuthService] Logging out');
    
    const response = await authClient.post(ENDPOINTS.LOGIN.LOGOUT, {
      refreshToken,
    });
    
    console.log('✅ [AuthService] Logout successful');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Logout failed:', parsedError);
    
    // Even if server logout fails, we should clear local tokens
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Refresh access token using refresh token
 * 
 * NOTE: In production, token refresh is typically handled automatically
 * by the API client interceptor. This function is exposed for manual refresh
 * if needed, but the apiClient already handles 401 responses with auto-refresh.
 * 
 * @param {string} refreshToken - Current refresh token
 * @returns {Promise<Object>} New tokens
 */
export const refreshTokens = async (refreshToken) => {
  try {
    console.log('🔄 [AuthService] Refreshing tokens');
    
    const response = await authClient.post(ENDPOINTS.LOGIN.REFRESH, {
      refreshToken,
    });
    
    console.log('✅ [AuthService] Tokens refreshed');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Token refresh failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== ERROR MESSAGES ====================

/**
 * Get user-friendly error message based on error code
 * @param {string} code - Error code from API
 * @param {string} defaultMessage - Default message to use
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (code, defaultMessage) => {
  const messages = {
    // Registration errors
    [AUTH_CODES.EMAIL_ALREADY_EXISTS]: 'An account with this email already exists. Please login instead.',
    [AUTH_CODES.PHONE_ALREADY_EXISTS]: 'This phone number is already registered.',
    [AUTH_CODES.WEAK_PASSWORD]: 'Password must be at least 8 characters long.',
    [AUTH_CODES.INVALID_EMAIL_FORMAT]: 'Please enter a valid email address.',
    [AUTH_CODES.INVALID_FULL_NAME]: 'Please enter your full name (at least 2 characters).',
    [AUTH_CODES.INVALID_PROVIDER_NAME]: 'Please enter your business name (at least 2 characters).',
    [AUTH_CODES.INVALID_ADDRESS]: 'Please enter a valid address (at least 5 characters).',
    
    // Login errors
    [AUTH_CODES.INVALID_CREDENTIALS]: 'Invalid email or password. Please try again.',
    [AUTH_CODES.USER_NOT_FOUND]: 'No account found with this email. Please register first.',
    [AUTH_CODES.ACCOUNT_DISABLED]: 'Your account has been disabled. Please contact support.',
    [AUTH_CODES.ACCOUNT_LOCKED]: 'Your account is locked due to too many failed attempts. Please try again later.',
    [AUTH_CODES.EMAIL_NOT_VERIFIED]: 'Please verify your email address before logging in.',
    [AUTH_CODES.PHONE_NOT_VERIFIED]: 'Please verify your phone number before logging in.',
    
    // OTP errors
    [AUTH_CODES.INVALID_OTP]: 'Invalid OTP code. Please check and try again.',
    [AUTH_CODES.OTP_EXPIRED]: 'OTP has expired. Please request a new one.',
    [AUTH_CODES.MAX_ATTEMPTS_EXCEEDED]: 'Maximum attempts exceeded. Please request a new OTP.',
    [AUTH_CODES.TOO_MANY_REQUESTS]: 'Too many requests. Please wait before trying again.',
    
    // Token errors
    [AUTH_CODES.TOKEN_EXPIRED]: 'Your session has expired. Please login again.',
    [AUTH_CODES.INVALID_TOKEN]: 'Invalid verification token.',
    [AUTH_CODES.REFRESH_TOKEN_EXPIRED]: 'Your session has expired. Please login again.',
    
    // Server errors
    [AUTH_CODES.AUTH_SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',
    [AUTH_CODES.NETWORK_ERROR]: 'Unable to connect. Please check your internet connection.',
    [AUTH_CODES.VALIDATION_FAILED]: 'Please check your input and try again.',
  };
  
  return messages[code] || defaultMessage || 'An unexpected error occurred. Please try again.';
};

export default {
  // Registration
  registerUser,
  registerProvider,
  
  // Login
  loginWithEmail,
  loginWithPhone,
  
  // OTP Login
  sendPhoneLoginOtp,
  verifyPhoneLoginOtp,
  sendEmailLoginOtp,
  verifyEmailLoginOtp,
  
  // Verification
  sendPhoneVerificationOtp,
  verifyPhoneOtp,
  sendEmailVerification,
  verifyEmailToken,
  
  // Logout & Tokens
  logout,
  refreshTokens,
  
  // Helpers
  getErrorMessage,
  AUTH_CODES,
  SERVICE_CATEGORIES,
};
