/**
 * Authentication Module
 * 
 * Centralized exports for all authentication-related services, hooks, and utilities.
 * 
 * @module auth
 * 
 * @example
 * // Import everything you need from one place
 * import { authAPI, tokenService, useAuth, authUtils } from './src/auth';
 * 
 * // Or import specific items
 * import { login, validateResetToken, refreshToken } from './src/auth';
 */

// API Services
export { default as authAPI } from './api/authApi';
export { default as tokenService } from './services/tokenService';
export { default as googleAuthService } from './services/googleAuthService';

// Client (for direct API access)
export { default as client } from './api/client';
export {
  login,
  loginWithPhone,
  smartLogin,
  register,
  logout,
  refreshToken,
  googleMobileAuth,
  healthCheck,
  isJarbacAvailable,
} from './api/client';

// Hooks
export { useAuth } from './hooks/useAuth';

// Utilities
export { default as authUtils } from './utils/authUtils';
export {
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
} from './utils/authUtils';

// Re-export authApi methods for convenience
export {
  validatePassword,
  validatePhoneNumber,
  validateOtp,
  sendOtp,
  verifyOtp,
  resendOtp,
  sendPhoneLoginOtp,
  verifyPhoneLoginOtp,
  sendEmailLoginOtp,
  verifyEmailLoginOtp,
  sendEmailVerification,
  forgotPassword,
  resetPassword,
  validateResetToken,
  validateToken,
  getCurrentUser,
  getTokenInfo,
  getUserProfile,
  changePassword,
  getErrorMessage,
} from './api/authApi';

// Re-export tokenService methods for convenience
export {
  storeTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  isLoggedIn,
  isTokenExpired,
  decodeToken,
} from './services/tokenService';

// Re-export googleAuthService methods for convenience
export {
  initializeGoogleSignIn,
  signInWithGoogle,
  signOutFromGoogle,
  isGoogleSignInAvailable,
} from './services/googleAuthService';
