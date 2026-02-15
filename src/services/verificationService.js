/**
 * Verification Service
 * 
 * Handles verification dashboard API calls:
 * - Fetch verification dashboard (5-step checklist)
 * - Sync verification status from Java Auth
 * 
 * @version 1.0.0
 */

import { NODE_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';

/**
 * Fetch the full verification dashboard for a provider
 * Returns 5-step checklist: phone, email, aadhaar, service_approval, premium
 * Plus capabilities (canAppearInTraditionalSearch, canAppearInEventSearch, canAppearInEmergencySearch)
 * 
 * @param {string} providerId - MongoDB provider _id
 * @returns {Promise<Object>} { success, data: { steps, capabilities, isFullyVerified, ... } }
 */
export const getVerificationDashboard = async (providerId) => {
  try {
    if (!providerId) {
      return {
        success: false,
        error: { message: 'Provider ID is required', code: 'MISSING_PROVIDER_ID' },
      };
    }

    const tokens = await getTokens();
    if (!tokens?.accessToken) {
      return {
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' },
      };
    }

    console.log('🔍 [VerificationService] Fetching verification dashboard for:', providerId);

    const response = await fetch(
      `${NODE_BASE_URL}/api/provider/${providerId}/verification-dashboard`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens.accessToken}`,
        },
      }
    );

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ [VerificationService] Dashboard fetched successfully');
      return {
        success: true,
        data: result.data,
      };
    }

    console.error('❌ [VerificationService] Dashboard fetch failed:', result.message);
    return {
      success: false,
      error: { message: result.message || 'Failed to fetch verification dashboard' },
    };
  } catch (error) {
    console.error('❌ [VerificationService] Network error:', error.message);
    return {
      success: false,
      error: { message: 'Network error. Please check your connection.' },
    };
  }
};

/**
 * Sync verification status from Java Auth (phone + email) and recompute isFullyVerified
 * Call this after a phone/email verification completes on the frontend
 * 
 * @param {string} providerId - MongoDB provider _id
 * @returns {Promise<Object>} { success, data: { steps, capabilities, isFullyVerified, ... } }
 */
export const syncVerificationStatus = async (providerId) => {
  try {
    if (!providerId) {
      return {
        success: false,
        error: { message: 'Provider ID is required', code: 'MISSING_PROVIDER_ID' },
      };
    }

    const tokens = await getTokens();
    if (!tokens?.accessToken) {
      return {
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' },
      };
    }

    console.log('🔄 [VerificationService] Syncing verification status for:', providerId);

    const response = await fetch(
      `${NODE_BASE_URL}/api/provider/${providerId}/sync-verification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens.accessToken}`,
        },
      }
    );

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ [VerificationService] Sync completed successfully');
      return {
        success: true,
        data: result.data,
      };
    }

    console.error('❌ [VerificationService] Sync failed:', result.message);
    return {
      success: false,
      error: { message: result.message || 'Failed to sync verification status' },
    };
  } catch (error) {
    console.error('❌ [VerificationService] Network error:', error.message);
    return {
      success: false,
      error: { message: 'Network error. Please check your connection.' },
    };
  }
};

export default {
  getVerificationDashboard,
  syncVerificationStatus,
};
