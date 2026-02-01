/**
 * Aadhaar Verification Service (DigiLocker Via Link)
 * 
 * Handles Aadhaar verification for providers using DigiLocker.
 * Direct OTP flow is NOT used due to government compliance restrictions.
 * 
 * FLOW:
 * 1. Call initiateVerification() to get DigiLocker URL
 * 2. Open URL in browser/WebView
 * 3. User completes verification in DigiLocker
 * 4. DigiLocker redirects back to app via deep link
 * 5. Poll checkVerificationStatus() to confirm
 * 
 * COMPLIANCE NOTES:
 * - NO Aadhaar number collected
 * - NO OTP handled by our app
 * - DigiLocker handles all sensitive authentication
 * - Only verification status is tracked
 * 
 * @version 2.0.0 - DigiLocker Via Link implementation
 */

import { NODE_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';
import { Linking } from 'react-native';

/**
 * Initiate DigiLocker verification session
 * Returns a URL that should be opened in browser/WebView
 * 
 * @returns {Promise<Object>} - { success, verificationUrl, sessionId, expiresAt }
 */
export const initiateVerification = async () => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const response = await fetch(`${NODE_BASE_URL}/api/aadhaar/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        verificationUrl: data.verificationUrl,
        sessionId: data.sessionId,
        expiresAt: data.expiresAt,
        message: data.message || 'Verification session created',
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to initiate verification',
      code: data.code,
    };
    
  } catch (error) {
    console.error('Initiate verification error:', error);
    return { 
      success: false, 
      error: 'Network error. Please check your connection and try again.' 
    };
  }
};

/**
 * Open DigiLocker verification URL
 * Opens the URL in the device's default browser
 * 
 * @param {string} verificationUrl - URL from initiateVerification
 * @returns {Promise<boolean>} - Whether URL was opened successfully
 */
export const openVerificationUrl = async (verificationUrl) => {
  try {
    const canOpen = await Linking.canOpenURL(verificationUrl);
    
    if (canOpen) {
      await Linking.openURL(verificationUrl);
      return true;
    }
    
    console.error('Cannot open verification URL:', verificationUrl);
    return false;
    
  } catch (error) {
    console.error('Open verification URL error:', error);
    return false;
  }
};

/**
 * Check verification status by polling
 * Call this after user returns from DigiLocker
 * 
 * @param {string} sessionId - Session ID from initiateVerification
 * @returns {Promise<Object>} - { success, verified, status, message }
 */
export const checkVerificationStatus = async (sessionId) => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const response = await fetch(`${NODE_BASE_URL}/api/aadhaar/check-status/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        verified: data.verified,
        status: data.status,
        verifiedAt: data.verifiedAt,
        message: data.message,
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to check status',
      code: data.code,
    };
    
  } catch (error) {
    console.error('Check verification status error:', error);
    return { 
      success: false, 
      error: 'Network error. Please check your connection.' 
    };
  }
};

/**
 * Get current Aadhaar verification status
 * @returns {Promise<Object>} - { success, aadhaar: { isVerified, verifiedAt }, overall }
 */
export const getAadhaarStatus = async () => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const response = await fetch(`${NODE_BASE_URL}/api/aadhaar/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        aadhaar: data.aadhaar,
        overall: data.overall,
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to get verification status',
    };
    
  } catch (error) {
    console.error('Get Aadhaar status error:', error);
    return { 
      success: false, 
      error: 'Network error. Please check your connection.' 
    };
  }
};

/**
 * Validate Aadhaar format (optional pre-check)
 * This is basic format validation only, NOT identity verification
 * 
 * @param {string} aadhaarNumber - 12-digit Aadhaar number
 * @returns {Promise<Object>} - { success, valid, ageRange, state, gender }
 */
export const validateAadhaarFormat = async (aadhaarNumber) => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    // Clean the Aadhaar number
    const cleanAadhaar = aadhaarNumber.replace(/[\s-]/g, '');
    
    // Basic format check
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      return { 
        success: false, 
        valid: false,
        error: 'Invalid Aadhaar format. Must be 12 digits.' 
      };
    }
    
    const response = await fetch(`${NODE_BASE_URL}/api/aadhaar/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ aadhaarNumber: cleanAadhaar }),
    });
    
    const data = await response.json();
    
    return data;
    
  } catch (error) {
    console.error('Validate Aadhaar error:', error);
    return { 
      success: false, 
      error: 'Network error. Please check your connection.' 
    };
  }
};

/**
 * Poll for verification completion
 * Polls the check-status endpoint until verified or timeout
 * 
 * @param {string} sessionId - Session ID from initiateVerification
 * @param {Object} options - { maxAttempts, intervalMs, onStatusChange }
 * @returns {Promise<Object>} - Final verification status
 */
export const pollVerificationStatus = async (sessionId, options = {}) => {
  const {
    maxAttempts = 30,        // 30 attempts
    intervalMs = 3000,       // 3 seconds between polls
    onStatusChange = null,   // Callback for status updates
  } = options;
  
  let attempts = 0;
  
  return new Promise((resolve) => {
    const poll = async () => {
      attempts++;
      
      const result = await checkVerificationStatus(sessionId);
      
      if (onStatusChange) {
        onStatusChange(result, attempts);
      }
      
      if (result.verified) {
        resolve({
          success: true,
          verified: true,
          message: 'Aadhaar verified successfully',
        });
        return;
      }
      
      if (result.status === 'failed' || result.status === 'expired') {
        resolve({
          success: false,
          verified: false,
          error: result.message || 'Verification failed',
        });
        return;
      }
      
      if (attempts >= maxAttempts) {
        resolve({
          success: false,
          verified: false,
          error: 'Verification timeout. Please try again.',
        });
        return;
      }
      
      // Continue polling
      setTimeout(poll, intervalMs);
    };
    
    poll();
  });
};

// ============================================
// DEPRECATED EXPORTS (for backward compatibility)
// These will log warnings and return errors
// ============================================

/**
 * @deprecated Use initiateVerification() instead
 */
export const generateAadhaarOtp = async () => {
  console.warn('generateAadhaarOtp is deprecated. Use initiateVerification() for DigiLocker flow.');
  return {
    success: false,
    error: 'Direct OTP flow is no longer supported. Please use DigiLocker verification.',
    code: 'DEPRECATED',
  };
};

/**
 * @deprecated Use DigiLocker flow instead
 */
export const verifyAadhaarOtp = async () => {
  console.warn('verifyAadhaarOtp is deprecated. Use DigiLocker flow instead.');
  return {
    success: false,
    error: 'Direct OTP flow is no longer supported. Please use DigiLocker verification.',
    code: 'DEPRECATED',
  };
};
