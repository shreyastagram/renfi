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
  PASSWORD_RESET_SENT: 'PASSWORD_RESET_SENT',
  PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  
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
  RESET_TOKEN_EXPIRED: 'RESET_TOKEN_EXPIRED',
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
  
  // Password errors
  INVALID_CURRENT_PASSWORD: 'INVALID_CURRENT_PASSWORD',
  SAME_PASSWORD: 'SAME_PASSWORD',
  
  // Conflict errors
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  PHONE_ALREADY_EXISTS: 'PHONE_ALREADY_EXISTS',
  
  // Server errors
  AUTH_SERVICE_UNAVAILABLE: 'AUTH_SERVICE_UNAVAILABLE',
  AUTH_SERVICE_ERROR: 'AUTH_SERVICE_ERROR',
  MONGODB_SYNC_FAILED: 'MONGODB_SYNC_FAILED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_UNREACHABLE: 'SERVER_UNREACHABLE',
  SERVER_TIMEOUT: 'SERVER_TIMEOUT',
  NO_INTERNET: 'NO_INTERNET',
};

// ==================== PRE-REGISTRATION CHECKS ====================

/**
 * Check if an email or phone number is already registered.
 * Returns conflict details including account type (user/provider).
 *
 * @param {Object} params
 * @param {string} [params.email] - Email to check
 * @param {string} [params.phone] - Phone to check (raw 10 digits)
 * @returns {Promise<Object>} { available, conflicts: [{ field, accountType }] }
 */
export const checkAvailability = async ({ email, phone } = {}) => {
  try {
    const body = {};
    if (email) body.email = email.trim().toLowerCase();
    if (phone) body.phone = normalizePhoneForApi(phone);

    const response = await apiClient.post(ENDPOINTS.AUTH.CHECK_AVAILABILITY, body);

    return {
      success: true,
      available: response.data.available,
      conflicts: response.data.conflicts || [],
    };
  } catch (error) {
    // Silently fail — this is a convenience check, not blocking
    console.warn('[AuthService] checkAvailability failed:', error.message);
    return { success: false, available: true, conflicts: [] };
  }
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
      phone: userData.phone?.trim() ? normalizePhoneForApi(userData.phone) : undefined,
      location: userData.location || undefined,
      referralCode: userData.referralCode || undefined,
      // Backend enforces T&C — backend rejects 400 if these are not true.
      termsAccepted: userData.termsAccepted === true,
      privacyAccepted: userData.privacyAccepted === true,
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
    if (providerData.phone?.trim()) requestBody.phone = normalizePhoneForApi(providerData.phone);
    if (providerData.city?.trim()) requestBody.city = providerData.city.trim();
    if (providerData.pincode?.trim()) requestBody.pincode = providerData.pincode.trim();
    if (providerData.serviceCategories?.length > 0) requestBody.serviceCategories = providerData.serviceCategories;
    if (providerData.experience?.trim()) requestBody.experience = providerData.experience.trim();
    if (providerData.latitude !== undefined && providerData.longitude !== undefined) {
      requestBody.latitude = providerData.latitude;
      requestBody.longitude = providerData.longitude;
    }
    if (providerData.referralCode) requestBody.referralCode = providerData.referralCode;
    // Backend enforces T&C — backend rejects 400 if these are not true.
    requestBody.termsAccepted = providerData.termsAccepted === true;
    requestBody.privacyAccepted = providerData.privacyAccepted === true;

    const response = await apiClient.post(ENDPOINTS.AUTH.PROVIDER_REGISTER, requestBody);
    
    console.log('✅ [AuthService] Provider registration successful');
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Provider registration failed:', parsedError);

    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== PHONE SIGNUP (USERS ONLY) ====================

/**
 * Start a phone-only USER signup. Goes via Node.js → Java Auth (no Mongo write yet —
 * the user row is created only on verify). Providers are out of scope; the JAuth
 * service hard-codes role = USER and rejects any other role.
 *
 * @param {string} phoneNumber - Raw phone (any format; normalized by api wrapper).
 * @param {string} fullName - Captured here, carried through the OTP window, written
 *                            onto the user row at verify-time.
 * @returns {Promise<{success:boolean, maskedPhone?:string, expiresInMinutes?:number, error?:Object}>}
 */
export const sendPhoneSignupOtp = async (phoneNumber, fullName) => {
  try {
    console.log('📱 [AuthService] Sending phone signup OTP');
    const response = await apiClient.post(ENDPOINTS.OTP_SIGNUP.PHONE_SEND_OTP, {
      phoneNumber: normalizePhoneForApi(phoneNumber),
      fullName: (fullName || '').trim(),
    });
    return {
      success: true,
      data: response.data,
      maskedPhone: response.data.maskedPhone,
      expiresInMinutes: response.data.expiresInMinutes || 5,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Send phone signup OTP failed:', parsedError);
    return { success: false, error: parsedError };
  }
};

/**
 * Verify a phone signup OTP. On success, the new USER row exists in JAuth
 * (email = NULL) and the matching Mongo user doc is created/upserted by NoeFix
 * via ensureProfileFromJavaAuth. Tokens are returned in the same envelope as the
 * existing login flows so the caller can hand them straight to handleAuthSuccess.
 *
 * @param {string} phoneNumber
 * @param {string} otp - 4–10 digit OTP code.
 * @param {Object} [extras] - termsAccepted / privacyAccepted (required by NoeFix),
 *                            and any optional location/address overrides forwarded
 *                            into the Mongo doc.
 * @returns {Promise<{success:boolean, data?:Object, error?:Object}>}
 */
export const verifyPhoneSignupOtp = async (phoneNumber, otp, extras = {}) => {
  try {
    console.log('🔐 [AuthService] Verifying phone signup OTP');
    const response = await apiClient.post(ENDPOINTS.OTP_SIGNUP.PHONE_VERIFY, {
      phoneNumber: normalizePhoneForApi(phoneNumber),
      otp: (otp || '').trim(),
      // NoeFix rejects 400 LEGAL_ACCEPTANCE_REQUIRED if these are not true.
      termsAccepted: extras.termsAccepted === true,
      privacyAccepted: extras.privacyAccepted === true,
      termsVersion: extras.termsVersion,
      privacyVersion: extras.privacyVersion,
      location: extras.location,
      address: extras.address,
      city: extras.city,
      pincode: extras.pincode,
      emergencyContact: extras.emergencyContact,
      referralCode: extras.referralCode,
    });
    return { success: true, data: response.data };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Phone signup verification failed:', parsedError);
    return { success: false, error: parsedError };
  }
};

// ==================== UNIFIED PHONE AUTH (USERS ONLY) ====================

/**
 * Unified phone OTP — single entry point for both login and signup.
 * NoeFix decides the flow server-side: existing accounts get a login OTP,
 * unknown numbers get a signup OTP (auto-registration on verify).
 *
 * @param {string} phoneNumber - Raw phone (any format; normalized here).
 * @returns {Promise<{success:boolean, flow?:'login'|'signup', maskedPhone?:string,
 *                    expiresInMinutes?:number, error?:Object}>}
 *          error.code === 'ROLE_CONFLICT' (with error.existingRole) when the
 *          number belongs to a provider account.
 */
export const sendUnifiedPhoneOtp = async (phoneNumber) => {
  try {
    console.log('📱 [AuthService] Sending unified phone OTP');
    const response = await apiClient.post(ENDPOINTS.OTP_UNIFIED.PHONE_SEND_OTP, {
      phoneNumber: normalizePhoneForApi(phoneNumber),
    });
    return {
      success: true,
      data: response.data,
      flow: response.data.flow,
      maskedPhone: response.data.maskedPhone,
      expiresInMinutes: response.data.expiresInMinutes || 5,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    // Surface the conflicting role (409 ROLE_CONFLICT) for the UI message.
    parsedError.existingRole = error.response?.data?.existingRole;
    console.error('❌ [AuthService] Send unified phone OTP failed:', parsedError);
    return { success: false, error: parsedError };
  }
};

/**
 * Verify a unified phone OTP. Echoes back the `flow` returned by send-otp.
 * On a signup flow the USER row + Mongo doc are created server-side; either
 * way the response carries the same token/user envelope as the phone-signup
 * verify, plus `isNewUser`, so it can be handed straight to handleAuthSuccess.
 *
 * @param {string} phoneNumber
 * @param {string} otp
 * @param {'login'|'signup'} flow - Flow reported by sendUnifiedPhoneOtp.
 * @param {Object} [extras] - termsAccepted / privacyAccepted (required true for
 *                            signup flows) and optional referralCode.
 * @returns {Promise<{success:boolean, data?:Object, error?:Object}>}
 */
export const verifyUnifiedPhoneOtp = async (phoneNumber, otp, flow, extras = {}) => {
  try {
    console.log('🔐 [AuthService] Verifying unified phone OTP (flow:', flow, ')');
    const response = await apiClient.post(ENDPOINTS.OTP_UNIFIED.PHONE_VERIFY, {
      phoneNumber: normalizePhoneForApi(phoneNumber),
      otp: (otp || '').trim(),
      flow,
      termsAccepted: extras.termsAccepted === true,
      privacyAccepted: extras.privacyAccepted === true,
      referralCode: extras.referralCode || undefined,
    });
    return { success: true, data: response.data };
  } catch (error) {
    const parsedError = parseApiError(error);
    parsedError.existingRole = error.response?.data?.existingRole;
    console.error('❌ [AuthService] Unified phone verification failed:', parsedError);
    return { success: false, error: parsedError };
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
      phoneNumber: normalizePhoneForApi(phoneNumber),
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
 * Normalize phone number for backend API.
 * PhoneInput stores raw 10-digit number — prepend +91 for API.
 * Also handles legacy formats (already has +91 or 91 prefix).
 * Backend regex: ^\\+?[1-9]\\d{6,14}$
 */
const normalizePhoneForApi = (phone) => {
  if (!phone) return phone;
  const digits = phone.trim().replace(/[^0-9]/g, '');

  // Already has 91 prefix (12 digits)
  if (digits.length === 12 && digits.startsWith('91')) {
    return '+' + digits;
  }

  // Raw 10-digit number from PhoneInput
  if (digits.length === 10) {
    return '+91' + digits;
  }

  // Fallback: return with + if not already present
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.substring(1).replace(/[^0-9]/g, '');
  }
  return '+' + digits;
};

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
      phoneNumber: normalizePhoneForApi(phoneNumber),
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
      phoneNumber: normalizePhoneForApi(phoneNumber),
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

// ==================== PASSWORD MANAGEMENT ====================

/**
 * Request password reset email
 * Sends an email with a reset link to the user
 * 
 * Flow:
 * 1. User enters their email on Forgot Password screen
 * 2. Backend sends email with reset link containing token
 * 3. User clicks link, opens Reset Password screen
 * 4. User enters new password
 * 5. Token is validated and password is reset
 * 
 * @param {string} email - User's email address
 * @returns {Promise<Object>} Response with masked email
 */
export const forgotPassword = async (email) => {
  try {
    console.log('🔑 [AuthService] Requesting password reset for:', email);
    
    const response = await authClient.post(ENDPOINTS.PASSWORD.FORGOT, {
      email: email.trim().toLowerCase(),
    });
    
    console.log('✅ [AuthService] Password reset email sent');
    
    return {
      success: true,
      data: response.data,
      maskedEmail: response.data.maskedEmail || email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Forgot password failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== OTP-BASED PASSWORD RESET ====================

/**
 * Request password reset OTP via phone
 * Sends OTP to the phone number associated with the account
 * 
 * Flow:
 * 1. User enters their phone number on Forgot Password screen
 * 2. Backend sends OTP to the phone via SMS
 * 3. User receives OTP and enters it along with new password
 * 4. OTP is verified and password is reset
 * 
 * @param {string} phoneNumber - User's phone number (with or without country code)
 * @returns {Promise<Object>} Response with masked phone number
 */
export const forgotPasswordPhone = async (phoneNumber) => {
  try {
    console.log('🔑 [AuthService] Requesting password reset OTP for phone');
    
    const response = await authClient.post(ENDPOINTS.PASSWORD.FORGOT_PHONE, {
      phoneNumber: normalizePhoneForApi(phoneNumber),
    });
    
    console.log('✅ [AuthService] Password reset OTP sent');
    
    return {
      success: true,
      data: response.data,
      maskedPhone: response.data.maskedPhone || response.data.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Forgot password phone failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Verify OTP and reset password
 * Completes the OTP-based password reset flow
 * 
 * @param {string} phoneNumber - User's phone number
 * @param {string} otp - OTP received via SMS
 * @param {string} newPassword - New password (min 8 characters, with special char, number, etc.)
 * @returns {Promise<Object>} Reset response
 */
export const verifyOtpAndResetPassword = async (phoneNumber, otp, newPassword) => {
  try {
    console.log('🔐 [AuthService] Verifying OTP and resetting password');
    
    const response = await authClient.post(ENDPOINTS.PASSWORD.FORGOT_PHONE_VERIFY, {
      phoneNumber: normalizePhoneForApi(phoneNumber),
      otp: otp.trim(),
      newPassword,
    });
    
    console.log('✅ [AuthService] OTP password reset successful');
    
    return {
      success: true,
      data: response.data,
      message: 'Password reset successfully. Please login with your new password.',
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] OTP password reset failed:', parsedError);
    
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Request password reset OTP via email
 * Sends OTP to the email associated with the account
 *
 * @param {string} email - User's email address
 * @returns {Promise<Object>} Response
 */
export const forgotPasswordEmail = async (email) => {
  try {
    console.log('🔑 [AuthService] Requesting password reset OTP for email');

    const response = await authClient.post(ENDPOINTS.PASSWORD.FORGOT_EMAIL, {
      email: email.trim().toLowerCase(),
    });

    console.log('✅ [AuthService] Password reset email OTP sent');

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Forgot password email failed:', parsedError);

    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Verify email OTP and reset password
 *
 * @param {string} email - User's email address
 * @param {string} otp - OTP received via email
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Reset response
 */
export const verifyEmailOtpAndResetPassword = async (email, otp, newPassword) => {
  try {
    console.log('🔐 [AuthService] Verifying email OTP and resetting password');

    const response = await authClient.post(ENDPOINTS.PASSWORD.FORGOT_EMAIL_VERIFY, {
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
      newPassword,
    });

    console.log('✅ [AuthService] Email OTP password reset successful');

    return {
      success: true,
      data: response.data,
      message: 'Password reset successfully. Please login with your new password.',
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Email OTP password reset failed:', parsedError);

    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Change or set password for authenticated user
 * Requires user to be logged in with valid access token
 * 
 * For OAuth users (no existing password), currentPassword can be empty string.
 * For users with existing password, currentPassword is required.
 * 
 * @param {string} currentPassword - User's current password (empty for OAuth users)
 * @param {string} newPassword - New password (min 8 characters)
 * @returns {Promise<Object>} Change password response
 */
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const isSettingPassword = !currentPassword;
    console.log(`🔐 [AuthService] ${isSettingPassword ? 'Setting' : 'Changing'} password`);
    
    const response = await authClient.post(ENDPOINTS.PASSWORD.CHANGE, {
      currentPassword: currentPassword || '',
      newPassword,
    });
    
    console.log(`✅ [AuthService] Password ${isSettingPassword ? 'set' : 'changed'} successfully`);
    
    return {
      success: true,
      data: response.data,
      message: `Password ${isSettingPassword ? 'set' : 'changed'} successfully.`,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Password change failed:', parsedError);
    
    // Specific error handling
    if (parsedError.code === 'INVALID_CURRENT_PASSWORD' || 
        error.response?.data?.message?.includes('current password')) {
      return {
        success: false,
        error: {
          ...parsedError,
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect.',
        },
      };
    }
    
    if (parsedError.code === 'SAME_PASSWORD' || 
        error.response?.data?.message?.includes('different')) {
      return {
        success: false,
        error: {
          ...parsedError,
          code: 'SAME_PASSWORD',
          message: 'New password must be different from current password.',
        },
      };
    }
    
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
    [AUTH_CODES.WEAK_PASSWORD]: 'Password must be at least 8 characters with an uppercase letter, lowercase letter, number, and special character.',
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
    [AUTH_CODES.RESET_TOKEN_EXPIRED]: 'Reset link has expired. Please request a new one.',
    [AUTH_CODES.RESET_TOKEN_INVALID]: 'Invalid reset link. Please request a new one.',
    
    // Password errors
    [AUTH_CODES.INVALID_CURRENT_PASSWORD]: 'Current password is incorrect.',
    [AUTH_CODES.SAME_PASSWORD]: 'New password must be different from current password.',
    
    // Server errors
    [AUTH_CODES.AUTH_SERVICE_UNAVAILABLE]: 'We\'re having trouble right now. Please try again in a moment.',
    [AUTH_CODES.NETWORK_ERROR]: 'Something went wrong. Please try again.',
    [AUTH_CODES.SERVER_UNREACHABLE]: 'We\'re having trouble connecting. Please try again in a moment.',
    [AUTH_CODES.SERVER_TIMEOUT]: 'This is taking longer than usual. Please try again.',
    [AUTH_CODES.NO_INTERNET]: 'No internet connection. Please check your WiFi or mobile data.',
    [AUTH_CODES.VALIDATION_FAILED]: 'Please check your input and try again.',
  };
  
  return messages[code] || defaultMessage || 'An unexpected error occurred. Please try again.';
};

/**
 * Sync phone number from Java Auth to MongoDB
 * Called after OTP phone verification to bridge the gap between Java Auth and MongoDB.
 * Java Auth stores verified phone, but MongoDB (used for business logic) doesn't get it automatically.
 * 
 * @param {Object} params - Sync parameters
 * @param {string} params.mongoId - MongoDB document ID (provider or user _id)
 * @param {string} params.userType - 'user' or 'provider'
 * @param {string} params.phoneNumber - Phone number to sync
 * @param {boolean} params.isPhoneVerified - Whether the phone is verified
 * @param {string} [params.accessToken] - Access token for Java Auth fallback fetch
 * @returns {Promise<Object>} Sync result
 */
export const syncPhoneToMongoDB = async ({ mongoId, userType, phoneNumber, isPhoneVerified, accessToken }) => {
  try {
    console.log('📱 [AuthService] Syncing phone to MongoDB:', { mongoId, userType, hasPhone: !!phoneNumber, isPhoneVerified });
    
    const response = await apiClient.post(ENDPOINTS.AUTH.SYNC_PHONE, {
      mongoId,
      userType,
      phoneNumber,
      isPhoneVerified,
      accessToken,
    });

    console.log('✅ [AuthService] Phone synced to MongoDB successfully');
    
    return {
      success: true,
      data: response.data?.data || response.data,
    };
  } catch (error) {
    const parsedError = parseApiError(error);
    console.error('❌ [AuthService] Phone sync to MongoDB failed:', parsedError);
    
    // Don't fail the whole flow - phone sync is best-effort
    return {
      success: false,
      error: parsedError,
    };
  }
};

export default {
  // Pre-registration checks
  checkAvailability,

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

  // Phone SIGNUP (USERS only)
  sendPhoneSignupOtp,
  verifyPhoneSignupOtp,

  // UNIFIED phone auth (USERS only — login or signup, server-decided)
  sendUnifiedPhoneOtp,
  verifyUnifiedPhoneOtp,
  
  // Verification
  sendPhoneVerificationOtp,
  verifyPhoneOtp,
  sendEmailVerification,
  verifyEmailToken,
  
  // Password Management
  forgotPassword,
  forgotPasswordPhone,
  forgotPasswordEmail,
  verifyOtpAndResetPassword,
  verifyEmailOtpAndResetPassword,
  changePassword,
  
  // Logout & Tokens
  logout,
  refreshTokens,
  
  // Sync
  syncPhoneToMongoDB,
  
  // Helpers
  getErrorMessage,
  AUTH_CODES,
  SERVICE_CATEGORIES,
};
