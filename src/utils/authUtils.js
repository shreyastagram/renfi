/**
 * Authentication Utilities
 * 
 * Common utility functions for authentication operations.
 * Works with tokenService for token management.
 * 
 * @module authUtils
 */

import tokenService from '../services/tokenService';

/**
 * Check if a JWT token is expired by decoding it
 * @param {string} token - JWT token to check
 * @returns {boolean} True if token is expired
 */
const isJwtExpired = (token) => {
  if (!token) return true;
  
  const decoded = tokenService.decodeToken(token);
  if (!decoded?.exp) return true;
  
  // Check if expired (with 5 minute buffer)
  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = 5 * 60; // 5 minutes
  
  return now >= (decoded.exp - bufferSeconds);
};

/**
 * Check if user session is valid
 * @returns {Promise<boolean>} True if session is valid
 */
export const isSessionValid = async () => {
  const accessToken = await tokenService.getAccessToken();
  if (!accessToken) {
    return false;
  }
  
  // Check if token is expired
  if (isJwtExpired(accessToken)) {
    // Try to refresh
    const refreshToken = await tokenService.getRefreshToken();
    if (refreshToken && !isJwtExpired(refreshToken)) {
      return true; // Can be refreshed
    }
    return false;
  }
  
  return true;
};

/**
 * Get authenticated user's ID from token
 * @returns {Promise<string|null>} User ID or null
 */
export const getAuthenticatedUserId = async () => {
  const accessToken = await tokenService.getAccessToken();
  if (!accessToken) {
    return null;
  }
  
  const decoded = tokenService.decodeToken(accessToken);
  return decoded?.sub || decoded?.userId || null;
};

/**
 * Get authenticated user's email from token
 * @returns {Promise<string|null>} User email or null
 */
export const getAuthenticatedUserEmail = async () => {
  const accessToken = await tokenService.getAccessToken();
  if (!accessToken) {
    return null;
  }
  
  const decoded = tokenService.decodeToken(accessToken);
  return decoded?.email || null;
};

/**
 * Get authenticated user's role from token
 * @returns {Promise<string|null>} User role or null
 */
export const getAuthenticatedUserRole = async () => {
  const accessToken = await tokenService.getAccessToken();
  if (!accessToken) {
    return null;
  }
  
  const decoded = tokenService.decodeToken(accessToken);
  return decoded?.role || null;
};

/**
 * Check if user has a specific role
 * @param {string} requiredRole - Role to check
 * @returns {Promise<boolean>} True if user has role
 */
export const hasRole = async (requiredRole) => {
  const role = await getAuthenticatedUserRole();
  return role === requiredRole;
};

/**
 * Calculate session time remaining in seconds
 * @returns {Promise<number>} Seconds until access token expires, 0 if expired
 */
export const getSessionTimeRemaining = async () => {
  const accessToken = await tokenService.getAccessToken();
  if (!accessToken) {
    return 0;
  }
  
  const decoded = tokenService.decodeToken(accessToken);
  if (!decoded?.exp) {
    return 0;
  }
  
  const now = Math.floor(Date.now() / 1000);
  const remaining = decoded.exp - now;
  
  return remaining > 0 ? remaining : 0;
};

/**
 * Format session time remaining as human readable string
 * @returns {Promise<string>} Formatted time (e.g., "23 min", "1 hr 30 min")
 */
export const getFormattedSessionTime = async () => {
  const seconds = await getSessionTimeRemaining();
  
  if (seconds <= 0) {
    return 'Expired';
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  
  return `${minutes} min`;
};

/**
 * Clear all authentication data
 * Used for complete logout or session invalidation
 * @returns {Promise<void>}
 */
export const clearAuthData = async () => {
  await tokenService.clearTokens();
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validatePasswordStrength = (password) => {
  const errors = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength: getPasswordStrength(password),
  };
};

/**
 * Get password strength score
 * @param {string} password - Password to evaluate
 * @returns {'weak'|'fair'|'good'|'strong'} Strength level
 */
const getPasswordStrength = (password) => {
  if (!password) return 'weak';
  
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  
  if (score <= 2) return 'weak';
  if (score <= 4) return 'fair';
  if (score <= 5) return 'good';
  return 'strong';
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (Indian format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
export const isValidPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  // Indian mobile numbers: 10 digits starting with 6-9
  return /^[6-9]\d{9}$/.test(cleaned);
};

/**
 * Mask email for display (e.g., t***@example.com)
 * @param {string} email - Email to mask
 * @returns {string} Masked email
 */
export const maskEmail = (email) => {
  if (!email || !isValidEmail(email)) return '';
  
  const [local, domain] = email.split('@');
  const maskedLocal = local.charAt(0) + '***';
  
  return `${maskedLocal}@${domain}`;
};

/**
 * Mask phone number for display (e.g., ******1234)
 * @param {string} phone - Phone to mask
 * @returns {string} Masked phone
 */
export const maskPhone = (phone) => {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return '****';
  
  const lastFour = cleaned.slice(-4);
  return `******${lastFour}`;
};

export default {
  isSessionValid,
  getAuthenticatedUserId,
  getAuthenticatedUserEmail,
  getAuthenticatedUserRole,
  hasRole,
  getSessionTimeRemaining,
  getFormattedSessionTime,
  clearAuthData,
  validatePasswordStrength,
  isValidEmail,
  isValidPhone,
  maskEmail,
  maskPhone,
};
