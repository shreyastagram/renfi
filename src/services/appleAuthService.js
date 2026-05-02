/**
 * Apple Auth Service
 *
 * Handles Apple Sign-In for both Users and Service Providers.
 * Mirrors googleAuthService.js pattern for consistency.
 *
 * - Uses @invertase/react-native-apple-authentication SDK
 * - Sends Apple identity token to Java Auth backend for verification
 * - Supports role selection and login/signup mode separation
 * - Manages profile sync with MongoDB via Node.js backend
 *
 * IMPORTANT: Apple provides name and email ONLY on the FIRST sign-in.
 * We must capture and send them immediately — they are never returned again.
 *
 * @version 1.0.0
 */

import { Platform } from 'react-native';
import { authClient, parseApiError } from './apiClient';
import apiClient from './apiClient';
import { ENDPOINTS } from '../config/api';

// ==================== ERROR CODES (mirrors Google pattern) ====================

export const APPLE_AUTH_CODES = {
  SIGN_IN_SUCCESS: 'APPLE_SIGN_IN_SUCCESS',
  SIGN_IN_CANCELLED: 'APPLE_SIGN_IN_CANCELLED',
  NOT_AVAILABLE: 'APPLE_SIGN_IN_NOT_AVAILABLE',
  NO_IDENTITY_TOKEN: 'NO_APPLE_IDENTITY_TOKEN',
  ROLE_CONFLICT: 'APPLE_AUTH_ROLE_CONFLICT',
  NOT_REGISTERED: 'APPLE_AUTH_NOT_REGISTERED',
  ALREADY_REGISTERED: 'APPLE_AUTH_ALREADY_REGISTERED',
  EMAIL_REQUIRED: 'APPLE_AUTH_EMAIL_REQUIRED',
  SIGN_IN_FAILED: 'APPLE_SIGN_IN_FAILED',
  BACKEND_ERROR: 'APPLE_AUTH_BACKEND_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
};

export const APPLE_AUTH_ROLES = {
  USER: 'USER',
  SERVICE_PROVIDER: 'SERVICE_PROVIDER',
};

// ==================== SIGN IN ====================

/**
 * Sign in with Apple and authenticate with FixHomi backend.
 *
 * Flow:
 * 1. User taps Apple Sign-In button
 * 2. iOS shows Apple auth sheet (Face ID / Touch ID / password)
 * 3. We get identity token + authorization code + (first time only) name/email
 * 4. Send identity token + user info to Java Auth backend
 * 5. Backend verifies token with Apple's JWKS keys, creates/finds user
 * 6. Backend returns FixHomi JWT tokens
 *
 * @param {string} role - 'USER' or 'SERVICE_PROVIDER' (defaults to 'USER')
 * @param {string|null} mode - 'login' or 'signup'
 * @returns {Promise<Object>} Auth response with tokens and user info
 */
export const signInWithApple = async (role = APPLE_AUTH_ROLES.USER, mode = null) => {
  // Apple Sign-In is iOS only
  if (Platform.OS !== 'ios') {
    return {
      success: false,
      error: {
        code: APPLE_AUTH_CODES.NOT_AVAILABLE,
        message: 'Apple Sign-In is only available on iOS.',
      },
    };
  }

  try {
    // Lazy-load the Apple auth module (iOS only, avoids Android crash)
    const appleAuth = require('@invertase/react-native-apple-authentication').default;

    // Check if Apple Sign-In is available on this device
    if (!appleAuth.isSupported) {
      return {
        success: false,
        error: {
          code: APPLE_AUTH_CODES.NOT_AVAILABLE,
          message: 'Apple Sign-In is not available on this device.',
        },
      };
    }

    // Perform Apple Sign-In request
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });

    // Get credential state to verify it's authorized
    const credentialState = await appleAuth.getCredentialStateForUser(
      appleAuthRequestResponse.user
    );

    if (credentialState !== appleAuth.State.AUTHORIZED) {
      return {
        success: false,
        error: {
          code: APPLE_AUTH_CODES.SIGN_IN_CANCELLED,
          message: 'Apple Sign-In was not authorized.',
          isCancelled: true,
        },
      };
    }

    const { identityToken, authorizationCode, fullName, email, user: appleUserId } =
      appleAuthRequestResponse;

    if (!identityToken) {
      return {
        success: false,
        error: {
          code: APPLE_AUTH_CODES.NO_IDENTITY_TOKEN,
          message: 'Failed to get Apple identity token. Please try again.',
        },
      };
    }

    // Build the user's full name from Apple's name components
    // Apple only provides this on FIRST sign-in — capture it now
    let userFullName = null;
    if (fullName) {
      const parts = [fullName.givenName, fullName.familyName].filter(Boolean);
      if (parts.length > 0) {
        userFullName = parts.join(' ');
      }
    }

    // Exchange Apple token for FixHomi tokens
    const authResult = await exchangeAppleTokenForAuth({
      identityToken,
      authorizationCode,
      fullName: userFullName,
      email,
      appleUserId,
      role,
      mode,
    });

    return authResult;
  } catch (error) {
    return handleAppleSignInError(error);
  }
};

/**
 * Sign in with Apple as a User (regular customer)
 * @param {string} mode - 'login' or 'signup' (optional)
 */
export const signInWithAppleAsUser = async (mode = null) => {
  return signInWithApple(APPLE_AUTH_ROLES.USER, mode);
};

/**
 * Sign in with Apple as a Service Provider
 * @param {string} mode - 'login' or 'signup' (optional)
 */
export const signInWithAppleAsProvider = async (mode = null) => {
  return signInWithApple(APPLE_AUTH_ROLES.SERVICE_PROVIDER, mode);
};

// ==================== TOKEN EXCHANGE ====================

/**
 * Exchange Apple identity token for FixHomi JWT tokens.
 * Calls the Java Auth backend endpoint (mirrors Google pattern).
 */
const exchangeAppleTokenForAuth = async ({
  identityToken,
  authorizationCode,
  fullName,
  email,
  appleUserId,
  role,
  mode,
  verificationToken,
}) => {
  try {
    const requestBody = {
      identityToken,
      authorizationCode,
      fullName,
      email,
      appleUserId,
      role,
    };

    if (mode) {
      requestBody.mode = mode;
    }

    if (verificationToken) {
      requestBody.verificationToken = verificationToken;
    }

    const response = await authClient.post(ENDPOINTS.OAUTH.APPLE_MOBILE, requestBody);

    // Java Auth returns same LoginResponse format as Google
    const {
      accessToken,
      refreshToken,
      userId,
      email: userEmail,
      fullName: userName,
      role: userRole,
      isNewUser,
    } = response.data;

    const user = {
      userId,
      email: userEmail,
      fullName: userName,
      role: userRole,
    };

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        user,
        isNewUser: isNewUser || false,
        authMethod: 'apple',
      },
    };
  } catch (error) {
    const parsedError = parseApiError(error);

    // Parse structured error codes from Java Auth (same format as Google)
    const validationErrors = error.response?.data?.validationErrors || {};
    const errorCode = validationErrors.code || '';
    const existingRole = validationErrors.existingRole || '';

    // Role conflict
    if (
      errorCode === 'ROLE_CONFLICT' ||
      error.response?.data?.code === 'ROLE_CONFLICT' ||
      error.response?.data?.message?.includes('already registered')
    ) {
      const existingRoleDisplay =
        existingRole === 'SERVICE_PROVIDER'
          ? 'Service Provider'
          : existingRole === 'USER'
          ? 'User'
          : 'different account type';
      return {
        success: false,
        error: {
          code: APPLE_AUTH_CODES.ROLE_CONFLICT,
          message: `This account is already registered as a ${existingRoleDisplay}.`,
          existingRole,
        },
      };
    }

    // Not registered
    if (errorCode === 'NOT_REGISTERED') {
      return {
        success: false,
        error: {
          code: APPLE_AUTH_CODES.NOT_REGISTERED,
          message:
            error.response?.data?.message ||
            'No account found. Please register first.',
          requestedRole: existingRole,
        },
      };
    }

    // Email required (Apple hid the email)
    if (errorCode === 'EMAIL_REQUIRED') {
      return {
        success: false,
        error: {
          code: APPLE_AUTH_CODES.EMAIL_REQUIRED,
          message: 'Please provide your email to complete Apple Sign-In.',
          appleUserId: validationErrors.existingRole || appleUserId,
        },
      };
    }

    // Already registered
    if (errorCode === 'ALREADY_REGISTERED') {
      return {
        success: false,
        error: {
          code: APPLE_AUTH_CODES.ALREADY_REGISTERED,
          message:
            error.response?.data?.message ||
            'This account is already registered. Please login instead.',
          existingRole,
        },
      };
    }

    return {
      success: false,
      error: {
        code: APPLE_AUTH_CODES.BACKEND_ERROR,
        message: parsedError.message || 'Sign in failed. Please try again.',
        originalError: parsedError,
      },
    };
  }
};

// ==================== MONGODB PROFILE SYNC ====================
// Reuses the same Node.js endpoints as Google OAuth

/**
 * Sync Apple user profile to MongoDB (same endpoint as Google)
 */
export const syncAppleUserToMongoDB = async (userData, accessToken = null) => {
  try {
    const config = {};
    if (accessToken) {
      config.headers = { Authorization: `Bearer ${accessToken}` };
    }

    const response = await apiClient.post(
      '/api/auth/google/sync-user',
      {
        javaUserId: userData.javaUserId,
        email: userData.email,
        fullName: userData.fullName,
        profilePicture: userData.profilePicture,
        authProvider: 'apple',
        referralCode: userData.referralCode || undefined,
        // Backend enforces T&C for new-user creation. Existing users skip the check.
        termsAccepted: userData.termsAccepted === true,
        privacyAccepted: userData.privacyAccepted === true,
      },
      config
    );

    return { success: true, data: response.data };
  } catch (error) {
    const parsedError = parseApiError(error);
    return { success: false, error: parsedError };
  }
};

/**
 * Sync Apple provider profile to MongoDB (same endpoint as Google)
 */
export const syncAppleProviderToMongoDB = async (providerData, accessToken = null) => {
  try {
    const config = {};
    if (accessToken) {
      config.headers = { Authorization: `Bearer ${accessToken}` };
    }

    const response = await apiClient.post(
      '/api/auth/google/sync-provider',
      {
        javaUserId: providerData.javaUserId,
        email: providerData.email,
        name: providerData.name,
        address: providerData.address,
        serviceCategories: providerData.serviceCategories,
        phone: providerData.phone,
        city: providerData.city,
        pincode: providerData.pincode,
        latitude: providerData.latitude,
        longitude: providerData.longitude,
        profilePicture: providerData.profilePicture,
        authProvider: 'apple',
        referralCode: providerData.referralCode || undefined,
        // Backend enforces T&C for new-provider creation. Existing providers skip the check.
        termsAccepted: providerData.termsAccepted === true,
        privacyAccepted: providerData.privacyAccepted === true,
      },
      config
    );

    return { success: true, data: response.data };
  } catch (error) {
    const parsedError = parseApiError(error);
    return { success: false, error: parsedError };
  }
};

// ==================== ERROR HANDLING ====================

const handleAppleSignInError = (error) => {
  // Apple Sign-In cancelled by user (error code 1001)
  if (error.code === '1001' || error.code === 1001 || error.message?.includes('canceled')) {
    return {
      success: false,
      error: {
        code: APPLE_AUTH_CODES.SIGN_IN_CANCELLED,
        message: 'Sign-in was cancelled.',
        isCancelled: true,
      },
    };
  }

  // Apple Sign-In not available
  if (error.code === '1000' || error.code === 1000) {
    return {
      success: false,
      error: {
        code: APPLE_AUTH_CODES.NOT_AVAILABLE,
        message: 'Apple Sign-In is not available on this device.',
      },
    };
  }

  return {
    success: false,
    error: {
      code: APPLE_AUTH_CODES.SIGN_IN_FAILED,
      message: error.message || 'Apple Sign-In failed. Please try again.',
    },
  };
};

// ==================== USER-FRIENDLY MESSAGES ====================

export const getAppleAuthErrorMessage = (code, defaultMessage) => {
  const messages = {
    [APPLE_AUTH_CODES.SIGN_IN_CANCELLED]: 'You cancelled the sign-in.',
    [APPLE_AUTH_CODES.NOT_AVAILABLE]: 'Apple Sign-In is not available on this device.',
    [APPLE_AUTH_CODES.NO_IDENTITY_TOKEN]:
      'Could not get your Apple account information. Please try again.',
    [APPLE_AUTH_CODES.ROLE_CONFLICT]:
      'This account is already registered with a different account type.',
    [APPLE_AUTH_CODES.NOT_REGISTERED]: 'No account found. Please register first.',
    [APPLE_AUTH_CODES.ALREADY_REGISTERED]:
      'This account is already registered. Please login instead.',
    [APPLE_AUTH_CODES.EMAIL_REQUIRED]:
      'Please provide your email address to complete Apple Sign-In.',
    [APPLE_AUTH_CODES.SIGN_IN_FAILED]: 'Apple Sign-In failed. Please try again.',
    [APPLE_AUTH_CODES.BACKEND_ERROR]: 'Could not complete sign-in. Please try again.',
    [APPLE_AUTH_CODES.NETWORK_ERROR]: 'Something went wrong. Please try again.',
  };

  return messages[code] || defaultMessage || 'An error occurred. Please try again.';
};

// ==================== APPLE EMAIL VERIFICATION ====================

/**
 * Send OTP to an email address for Apple Sign-In email verification.
 * Used when Apple hides the user's email and we need to collect + verify it.
 */
export const sendAppleEmailOtp = async (email, appleUserId) => {
  const response = await authClient.post(ENDPOINTS.OAUTH.APPLE_SEND_EMAIL_OTP, { email, appleUserId });
  return response.data;
};

/**
 * Verify an OTP sent to the user's email during Apple Sign-In flow.
 * Returns a verificationToken on success.
 */
export const verifyAppleEmailOtp = async (email, appleUserId, otp) => {
  const response = await authClient.post(ENDPOINTS.OAUTH.APPLE_VERIFY_EMAIL_OTP, { email, appleUserId, otp });
  return response.data;
};

/**
 * Complete Apple Sign-In after email has been verified.
 * Retries the original auth request with the verification token.
 */
export const completeAppleSignInWithVerifiedEmail = async ({
  identityToken, authorizationCode, appleUserId, fullName, role, mode, email, verificationToken
}) => {
  return exchangeAppleTokenForAuth({
    identityToken, authorizationCode, fullName, email, appleUserId, role, mode, verificationToken
  });
};

// ==================== EXPORTS ====================

export default {
  signInWithApple,
  signInWithAppleAsUser,
  signInWithAppleAsProvider,
  syncAppleUserToMongoDB,
  syncAppleProviderToMongoDB,
  getAppleAuthErrorMessage,
  sendAppleEmailOtp,
  verifyAppleEmailOtp,
  completeAppleSignInWithVerifiedEmail,
  APPLE_AUTH_ROLES,
  APPLE_AUTH_CODES,
};
