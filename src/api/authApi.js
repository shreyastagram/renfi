/**
 * Auth API Service - Direct API Functions
 * 
 * This module provides direct API functions for authentication.
 * Uses the client.js for HTTP requests with automatic token refresh.
 * 
 * For most use cases, use client.js directly. This file provides
 * additional auth-related functions not covered by client.js.
 * 
 * NO FALLBACKS - If something fails, it fails. This ensures we always know the real problem.
 * 
 * @version 2.0.0
 * @author FixHomi Team
 */

import { authClient } from './client';
import tokenService from '../services/tokenService';

// ============================================================================
// Password Validation Helper
// ============================================================================

/**
 * Validate password meets JARBAC requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 digit (0-9)
 * - At least 1 special character (!@#$%^&*)
 * 
 * @param {string} password - Password to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export const validatePassword = (password) => {
  const errors = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least 1 uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least 1 lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least 1 digit');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least 1 special character (!@#$%^&*)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ============================================================================
// OTP Verification Functions
// ============================================================================

/**
 * Validate phone number format
 * Supports international format with country code
 * 
 * @param {string} phoneNumber - Phone number to validate
 * @returns {Object} - { isValid: boolean, formatted: string, error?: string }
 */
export const validatePhoneNumber = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return { isValid: false, formatted: null, error: 'Phone number is required' };
  }
  
  // Remove all whitespace and dashes
  let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // Add + if missing and starts with country code
  if (!cleaned.startsWith('+')) {
    // Assume Indian number if 10 digits
    if (/^\d{10}$/.test(cleaned)) {
      cleaned = '+91' + cleaned;
    } else if (/^\d{11,15}$/.test(cleaned)) {
      cleaned = '+' + cleaned;
    }
  }
  
  // Validate international phone format: +[country code][number]
  // Minimum: +1XXXXXXXXXX (11 chars), Maximum: +XXXXXXXXXXXXXXX (16 chars)
  const phoneRegex = /^\+[1-9]\d{9,14}$/;
  
  if (!phoneRegex.test(cleaned)) {
    return { 
      isValid: false, 
      formatted: null, 
      error: 'Please enter a valid phone number with country code (e.g., +91XXXXXXXXXX)' 
    };
  }
  
  return { isValid: true, formatted: cleaned, error: null };
};

/**
 * Validate OTP format
 * 
 * @param {string} otp - OTP to validate
 * @returns {Object} - { isValid: boolean, error?: string }
 */
export const validateOtp = (otp) => {
  if (!otp || typeof otp !== 'string') {
    return { isValid: false, error: 'OTP is required' };
  }
  
  const cleaned = otp.trim();
  
  if (!/^\d{6}$/.test(cleaned)) {
    return { isValid: false, error: 'OTP must be exactly 6 digits' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Send OTP to authenticated user's phone number for verification
 * JARBAC Endpoint: POST /api/auth/otp/send
 * 
 * NOTE: This endpoint requires authentication (JWT token).
 * The backend gets the user's phone from their profile.
 * 
 * OTP Settings:
 * - Expires in: 5 minutes (300 seconds)
 * - Max attempts: 3
 * - Rate limit: 1 request per minute
 * 
 * @returns {Promise<Object>} - { message: string, maskedPhone: string }
 * @throws {Error} - With user-friendly message
 */
export const sendOtp = async () => {
  console.log('📱 [AuthAPI] Sending OTP to user phone');
  
  try {
    // No body needed - backend uses JWT to identify user and their phone
    const response = await authClient.post('/api/auth/otp/send');
    
    console.log('✅ [AuthAPI] OTP sent successfully');
    console.log('📱 [AuthAPI] Sent to:', response.data.maskedPhone || response.data.maskedIdentifier);
    
    return {
      success: true,
      message: response.data.message || 'OTP sent successfully',
      expiresInSeconds: 300, // 5 minutes default
      maskedPhone: response.data.maskedPhone || response.data.maskedIdentifier,
    };
  } catch (error) {
    console.error('❌ [AuthAPI] Send OTP failed:', error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.status === 429) {
      const retryAfter = error.response.data?.retryAfterSeconds || 60;
      const customError = new Error(`Please wait ${retryAfter} seconds before requesting another OTP`);
      customError.isRateLimitError = true;
      customError.retryAfterSeconds = retryAfter;
      throw customError;
    }
    
    if (error.response?.status === 400) {
      const message = error.response.data?.message || 'No phone number registered for this account';
      const customError = new Error(message);
      customError.isValidationError = true;
      throw customError;
    }
    
    throw error;
  }
};

/**
 * Verify phone OTP for authenticated user
 * JARBAC Endpoint: POST /api/auth/otp/verify
 * 
 * NOTE: This endpoint requires authentication (JWT token).
 * The backend uses the JWT to identify the user.
 * 
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<Object>} - { message: string, phoneVerified: boolean }
 * @throws {Error} - With user-friendly message
 */
export const verifyOtp = async (otp) => {
  console.log('🔢 [AuthAPI] Verifying OTP');
  
  // Validate OTP format
  const otpValidation = validateOtp(otp);
  if (!otpValidation.isValid) {
    const error = new Error(otpValidation.error);
    error.isValidationError = true;
    throw error;
  }
  
  try {
    const response = await authClient.post('/api/auth/otp/verify', { 
      otp: otp.trim(),
    });
    
    console.log('✅ [AuthAPI] OTP verification successful');
    
    return {
      success: true,
      message: response.data.message || 'Phone verified successfully',
      phoneVerified: true,
    };
  } catch (error) {
    console.error('❌ [AuthAPI] Verify OTP failed:', error.response?.data || error.message);
    
    // Handle specific error cases
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message?.toLowerCase() || '';
    
    if (status === 400) {
      if (serverMessage.includes('expired')) {
        const customError = new Error('OTP has expired. Please request a new one.');
        customError.isExpiredError = true;
        throw customError;
      }
      if (serverMessage.includes('invalid') || serverMessage.includes('incorrect')) {
        const customError = new Error('Invalid OTP. Please check and try again.');
        customError.isInvalidOtpError = true;
        throw customError;
      }
      // Default 400 error
      const customError = new Error(error.response.data?.message || 'Invalid OTP. Please try again.');
      customError.isValidationError = true;
      throw customError;
    }
    
    if (status === 429) {
      const customError = new Error('Too many attempts. Please request a new OTP.');
      customError.isMaxAttemptsError = true;
      throw customError;
    }
    
    if (status === 404) {
      const customError = new Error('OTP not found. Please request a new one.');
      customError.isNotFoundError = true;
      throw customError;
    }
    
    throw error;
  }
};

/**
 * Resend OTP to phone number
 * Convenience wrapper around sendOtp with resend-specific messaging
 * 
 * @param {string} phoneNumber - Phone number with country code
 * @returns {Promise<Object>} - Same as sendOtp
 */
export const resendOtp = async (phoneNumber) => {
  console.log('🔄 [AuthAPI] Resending OTP to:', phoneNumber);
  return sendOtp(phoneNumber);
};

// ============================================================================
// OTP-Based Passwordless Login Functions
// ============================================================================

/**
 * Send OTP for passwordless phone login
 * JARBAC Endpoint: POST /api/auth/login/phone/send-otp
 * 
 * NOTE: This is for LOGIN (user must exist). For verification during signup,
 * use sendOtp() which hits /api/verification/otp/send
 * 
 * @param {string} phoneNumber - Phone number with country code
 * @returns {Promise<Object>} - { success, message, maskedPhone, expiresInMinutes }
 */
export const sendPhoneLoginOtp = async (phoneNumber) => {
  console.log('📱 [AuthAPI] Sending phone login OTP to:', phoneNumber);
  
  // Validate phone number
  const validation = validatePhoneNumber(phoneNumber);
  if (!validation.isValid) {
    const error = new Error(validation.error);
    error.isValidationError = true;
    throw error;
  }
  
  try {
    const response = await authClient.post('/api/auth/login/phone/send-otp', { 
      phoneNumber: validation.formatted 
    });
    
    console.log('✅ [AuthAPI] Phone login OTP sent successfully');
    
    return {
      success: true,
      message: response.data.message || 'OTP sent successfully',
      maskedPhone: response.data.maskedPhone,
      expiresInMinutes: response.data.expiresInMinutes || 5,
      phoneNumber: validation.formatted,
    };
  } catch (error) {
    console.error('❌ [AuthAPI] Send phone login OTP failed:', error.response?.data || error.message);
    
    if (error.response?.status === 429) {
      const customError = new Error('Too many OTP requests. Please wait before trying again.');
      customError.isRateLimitError = true;
      throw customError;
    }
    
    if (error.response?.status === 404) {
      const customError = new Error('Phone number not registered. Please sign up first.');
      customError.isNotFoundError = true;
      throw customError;
    }
    
    throw error;
  }
};

/**
 * Verify phone login OTP and complete login
 * JARBAC Endpoint: POST /api/auth/login/phone/verify
 * 
 * @param {string} phoneNumber - Phone number that received the OTP
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<Object>} - LoginResponse { accessToken, refreshToken, userId, email, fullName, role, expiresIn }
 */
export const verifyPhoneLoginOtp = async (phoneNumber, otp) => {
  console.log('🔢 [AuthAPI] Verifying phone login OTP for:', phoneNumber);
  
  // Validate phone number
  const phoneValidation = validatePhoneNumber(phoneNumber);
  if (!phoneValidation.isValid) {
    const error = new Error(phoneValidation.error);
    error.isValidationError = true;
    throw error;
  }
  
  // Validate OTP format
  const otpValidation = validateOtp(otp);
  if (!otpValidation.isValid) {
    const error = new Error(otpValidation.error);
    error.isValidationError = true;
    throw error;
  }
  
  try {
    const response = await authClient.post('/api/auth/login/phone/verify', { 
      phoneNumber: phoneValidation.formatted,
      otp: otp.trim(),
    });
    
    console.log('✅ [AuthAPI] Phone login OTP verification successful');
    
    // Returns full LoginResponse with tokens
    return response.data;
  } catch (error) {
    console.error('❌ [AuthAPI] Verify phone login OTP failed:', error.response?.data || error.message);
    
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message?.toLowerCase() || '';
    
    if (status === 400) {
      if (serverMessage.includes('expired')) {
        const customError = new Error('OTP has expired. Please request a new one.');
        customError.isExpiredError = true;
        throw customError;
      }
      if (serverMessage.includes('invalid') || serverMessage.includes('incorrect')) {
        const customError = new Error('Invalid OTP. Please check and try again.');
        customError.isInvalidOtpError = true;
        throw customError;
      }
      if (serverMessage.includes('attempt')) {
        const customError = new Error('Maximum attempts exceeded. Please request a new OTP.');
        customError.isMaxAttemptsError = true;
        throw customError;
      }
    }
    
    if (status === 404) {
      const customError = new Error('User not found. Please check your phone number.');
      customError.isNotFoundError = true;
      throw customError;
    }
    
    throw error;
  }
};

/**
 * Send OTP for passwordless email login
 * JARBAC Endpoint: POST /api/auth/login/email/send-otp
 * 
 * @param {string} email - Email address
 * @returns {Promise<Object>} - { success, message, maskedEmail, expiresInMinutes }
 */
export const sendEmailLoginOtp = async (email) => {
  console.log('📧 [AuthAPI] Sending email login OTP to:', email);
  
  if (!email || !email.includes('@')) {
    const error = new Error('Please enter a valid email address');
    error.isValidationError = true;
    throw error;
  }
  
  try {
    const response = await authClient.post('/api/auth/login/email/send-otp', { email });
    
    console.log('✅ [AuthAPI] Email login OTP sent successfully');
    
    return {
      success: true,
      message: response.data.message || 'OTP sent successfully',
      maskedEmail: response.data.maskedEmail,
      expiresInMinutes: response.data.expiresInMinutes || 5,
      email: email,
    };
  } catch (error) {
    console.error('❌ [AuthAPI] Send email login OTP failed:', error.response?.data || error.message);
    
    if (error.response?.status === 429) {
      const customError = new Error('Too many OTP requests. Please wait before trying again.');
      customError.isRateLimitError = true;
      throw customError;
    }
    
    if (error.response?.status === 404) {
      const customError = new Error('Email not registered. Please sign up first.');
      customError.isNotFoundError = true;
      throw customError;
    }
    
    throw error;
  }
};

/**
 * Verify email login OTP and complete login
 * JARBAC Endpoint: POST /api/auth/login/email/verify
 * 
 * @param {string} email - Email address that received the OTP
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<Object>} - LoginResponse { accessToken, refreshToken, userId, email, fullName, role, expiresIn }
 */
export const verifyEmailLoginOtp = async (email, otp) => {
  console.log('🔢 [AuthAPI] Verifying email login OTP for:', email);
  
  if (!email || !email.includes('@')) {
    const error = new Error('Please enter a valid email address');
    error.isValidationError = true;
    throw error;
  }
  
  // Validate OTP format
  const otpValidation = validateOtp(otp);
  if (!otpValidation.isValid) {
    const error = new Error(otpValidation.error);
    error.isValidationError = true;
    throw error;
  }
  
  try {
    const response = await authClient.post('/api/auth/login/email/verify', { 
      email,
      otp: otp.trim(),
    });
    
    console.log('✅ [AuthAPI] Email login OTP verification successful');
    
    // Returns full LoginResponse with tokens
    return response.data;
  } catch (error) {
    console.error('❌ [AuthAPI] Verify email login OTP failed:', error.response?.data || error.message);
    
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message?.toLowerCase() || '';
    
    if (status === 400) {
      if (serverMessage.includes('expired')) {
        const customError = new Error('OTP has expired. Please request a new one.');
        customError.isExpiredError = true;
        throw customError;
      }
      if (serverMessage.includes('invalid') || serverMessage.includes('incorrect')) {
        const customError = new Error('Invalid OTP. Please check and try again.');
        customError.isInvalidOtpError = true;
        throw customError;
      }
      if (serverMessage.includes('attempt')) {
        const customError = new Error('Maximum attempts exceeded. Please request a new OTP.');
        customError.isMaxAttemptsError = true;
        throw customError;
      }
    }
    
    if (status === 404) {
      const customError = new Error('User not found. Please check your email.');
      customError.isNotFoundError = true;
      throw customError;
    }
    
    throw error;
  }
};

// ============================================================================
// Email Verification Functions
// ============================================================================

/**
 * Send email verification link
 * 
 * @param {string} email - Email address to verify
 * @returns {Promise<Object>} - Message response
 */
export const sendEmailVerification = async (email) => {
  console.log('📧 [AuthAPI] Sending email verification to:', email);
  
  const response = await authClient.post('/api/auth/email/send-verification', { email });
  
  console.log('✅ [AuthAPI] Email verification sent');
  return response.data;
};

// ============================================================================
// Password Reset Functions
// ============================================================================

/**
 * Request password reset (forgot password)
 * Sends a reset link to the email address
 * 
 * @param {string} email - Email address
 * @returns {Promise<Object>} - Message response
 */
export const forgotPassword = async (email) => {
  console.log('🔑 [AuthAPI] Requesting password reset for:', email);
  
  const response = await authClient.post('/api/auth/forgot-password', { email });
  
  console.log('✅ [AuthAPI] Password reset email sent');
  return response.data;
};

/**
 * Reset password with token (from email link)
 * 
 * @param {string} token - Password reset token from email
 * @param {string} newPassword - New password (must meet requirements)
 * @returns {Promise<Object>} - Message response
 */
export const resetPassword = async (token, newPassword) => {
  console.log('🔐 [AuthAPI] Resetting password');
  
  // Validate password before sending
  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    const error = new Error(validation.errors.join('. '));
    error.isValidationError = true;
    throw error;
  }
  
  const response = await authClient.post('/api/auth/reset-password', { token, newPassword });
  
  console.log('✅ [AuthAPI] Password reset successful');
  return response.data;
};

/**
 * Validate password reset token before showing reset form
 * 
 * @param {string} token - Password reset token from email link
 * @returns {Promise<Object>} - { valid: boolean, email: string (masked) }
 */
export const validateResetToken = async (token) => {
  console.log('🔍 [AuthAPI] Validating reset token');
  
  const response = await authClient.get(`/api/auth/reset-password/validate?token=${token}`);
  
  console.log('✅ [AuthAPI] Reset token validation result:', response.data.valid);
  return response.data;
};

// ============================================================================
// Token Validation Functions
// ============================================================================

/**
 * Validate access token
 * 
 * @returns {Promise<Object>} - Token validation result with user info
 */
export const validateToken = async () => {
  console.log('🔍 [AuthAPI] Validating access token');
  
  const response = await authClient.get('/api/token/validate');
  
  console.log('✅ [AuthAPI] Token is valid');
  return response.data;
};

/**
 * Get current user info from token
 * 
 * @returns {Promise<Object>} - User information
 */
export const getCurrentUser = async () => {
  console.log('👤 [AuthAPI] Getting current user');
  
  const response = await authClient.get('/api/token/me');
  
  console.log('✅ [AuthAPI] Current user retrieved');
  return response.data;
};

// ============================================================================
// User Profile Functions (via JARBAC)
// ============================================================================

/**
 * Get current user's full profile
 * 
 * @returns {Promise<Object>} - User profile data
 */
export const getUserProfile = async () => {
  console.log('👤 [AuthAPI] Getting user profile');
  
  const response = await authClient.get('/api/users/me');
  
  console.log('✅ [AuthAPI] User profile retrieved');
  return response.data;
};

/**
 * Change user's password (when logged in)
 * JARBAC Endpoint: POST /api/users/me/change-password
 * 
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password (must meet requirements)
 * @returns {Promise<Object>} - Message response
 */
export const changePassword = async (currentPassword, newPassword) => {
  console.log('🔐 [AuthAPI] Changing password');
  
  // Validate new password before sending
  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    const error = new Error(validation.errors.join('. '));
    error.isValidationError = true;
    throw error;
  }
  
  const response = await authClient.post('/api/users/me/change-password', { 
    currentPassword, 
    newPassword 
  });
  
  console.log('✅ [AuthAPI] Password changed successfully');
  return response.data;
};

/**
 * Get token information (quick user info from token)
 * JARBAC Endpoint: GET /api/auth/token/me
 * 
 * @returns {Promise<Object>} - Token info with userId, email, role
 */
export const getTokenInfo = async () => {
  console.log('🎫 [AuthAPI] Getting token info');
  
  const response = await authClient.get('/api/auth/token/me');
  
  console.log('✅ [AuthAPI] Token info retrieved');
  return response.data;
};

// ============================================================================
// Error Message Helpers
// ============================================================================

/**
 * Get user-friendly error message from API error
 * Production-grade error handling with detailed logging
 * 
 * @param {Error} error - Error from API call
 * @returns {string} - User-friendly error message
 */
export const getErrorMessage = (error) => {
  // Log full error for debugging
  console.log('🔍 [AuthAPI] Parsing error:', {
    message: error.message,
    status: error.response?.status,
    data: error.response?.data,
    url: error.config?.url,
  });

  // Network/Connection error (no response from server)
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'Request timed out. Please check your internet connection and try again.';
    }
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      return 'Cannot connect to server. Please check if JARBAC auth service is running on port 8080.';
    }
    if (error.message?.includes('ECONNREFUSED')) {
      return 'Connection refused. Auth server is not running. Start JARBAC service first.';
    }
    return error.message || 'An unexpected network error occurred.';
  }
  
  const status = error.response.status;
  const data = error.response.data || {};
  
  // Extract error message from various JARBAC response formats
  const serverMessage = data.message || data.error || data.detail || null;
  
  // Handle specific status codes with JARBAC-specific messages
  switch (status) {
    case 400:
      // Validation error - return server message if available
      if (serverMessage) {
        return serverMessage;
      }
      if (data.errors && Array.isArray(data.errors)) {
        return data.errors.map(e => e.message || e).join('. ');
      }
      return 'Invalid request. Please check your input and try again.';
    
    case 401:
      // Authentication failed
      if (serverMessage?.toLowerCase().includes('disabled')) {
        return 'Your account has been disabled. Please contact support.';
      }
      if (serverMessage?.toLowerCase().includes('not found') || 
          serverMessage?.toLowerCase().includes('does not exist')) {
        return 'Account not found. Please register first or check your email.';
      }
      if (serverMessage?.toLowerCase().includes('password')) {
        return 'Incorrect password. Please try again.';
      }
      if (serverMessage?.toLowerCase().includes('verified')) {
        return 'Please verify your email before logging in.';
      }
      // Default 401 message
      return serverMessage || 'Invalid email or password. Please check your credentials.';
    
    case 403:
      if (serverMessage?.toLowerCase().includes('role')) {
        return 'You do not have the required role to access this feature.';
      }
      return serverMessage || 'Access denied. You do not have permission for this action.';
    
    case 404:
      if (error.config?.url?.includes('/users')) {
        return 'User not found. Please check the email or register a new account.';
      }
      return serverMessage || 'The requested resource was not found.';
    
    case 409:
      if (serverMessage?.toLowerCase().includes('email')) {
        return 'This email is already registered. Please login or use a different email.';
      }
      if (serverMessage?.toLowerCase().includes('phone')) {
        return 'This phone number is already registered.';
      }
      return serverMessage || 'This account already exists. Please try logging in.';
    
    case 422:
      // Unprocessable entity - validation failed
      return serverMessage || 'Validation failed. Please check your input.';
    
    case 429:
      return 'Too many attempts. Please wait a few minutes before trying again.';
    
    case 500:
      console.error('❌ [AuthAPI] Server error 500:', data);
      return 'Server error occurred. Please try again later or contact support.';
    
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable. Please try again in a few moments.';
    
    default:
      console.warn('⚠️ [AuthAPI] Unhandled status code:', status, data);
      return serverMessage || `An error occurred (${status}). Please try again.`;
  }
};

// ============================================================================
// Default Export
// ============================================================================

const authApi = {
  // Validation helpers
  validatePassword,
  validatePhoneNumber,
  validateOtp,
  
  // OTP verification (for signup)
  sendOtp,
  verifyOtp,
  resendOtp,
  
  // OTP login (passwordless)
  sendPhoneLoginOtp,
  verifyPhoneLoginOtp,
  sendEmailLoginOtp,
  verifyEmailLoginOtp,
  
  // Email verification
  sendEmailVerification,
  
  // Password reset
  forgotPassword,
  resetPassword,
  validateResetToken,
  
  // Token validation
  validateToken,
  getCurrentUser,
  getTokenInfo,
  
  // User profile
  getUserProfile,
  changePassword,
  
  // Error handling
  getErrorMessage,
};

export default authApi;
