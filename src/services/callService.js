/**
 * Call Service (Exotel Call Masking)
 * 
 * Replaces direct phone dialing with Exotel masked calls.
 * Users and providers NEVER see each other's real phone numbers.
 * 
 * FLOW:
 * 1. User taps "Call" on a provider card
 * 2. Frontend calls initiateCall() → Backend API
 * 3. Backend triggers Exotel Connect API
 * 4. Exotel calls the user's phone first
 * 5. Once user picks up, Exotel calls the provider
 * 6. Both connected through Exotel's virtual number
 * 7. Webhook updates call status in background
 * 
 * FEATURES:
 * - initiateCall: Start a masked call
 * - getCallStatus: Poll for call status
 * - getContactedProviders: Check which providers user has called
 * - checkContacted: Check if a specific provider was contacted
 * 
 * @version 1.0.0
 */

import { NODE_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';
import { getTokens } from '../utils/storage';

// ============================================
// HELPERS
// ============================================

/**
 * Get auth headers for API requests
 */
const getAuthHeaders = async () => {
  const { accessToken } = await getTokens();
  if (!accessToken) {
    throw new Error('Not authenticated. Please log in again.');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };
};

// ============================================
// INITIATE MASKED CALL
// ============================================

/**
 * Initiate a masked call between the authenticated user/provider and a receiver.
 * 
 * The caller's phone will ring first. Once they pick up,
 * the receiver's phone will ring. Both are connected through
 * a virtual number — no real numbers exposed.
 * 
 * @param {Object} params - Call parameters
 * @param {string} params.receiverId - ID of the person to call (provider or user)
 * @param {string} params.callerType - 'user' or 'provider'
 * @param {string} [params.serviceRequestId] - Optional service request context
 * @param {string} [params.serviceType] - 'traditional' | 'emergency' | 'event' | 'pre_booking'
 * @returns {Promise<Object>} Call initiation result
 */
export const initiateCall = async ({
  receiverId,
  callerType,
  serviceRequestId = null,
  serviceType = 'pre_booking',
}) => {
  try {
    if (!receiverId) {
      return { success: false, error: 'Receiver ID is required' };
    }
    if (!callerType || !['user', 'provider'].includes(callerType)) {
      return { success: false, error: 'callerType must be "user" or "provider"' };
    }

    const headers = await getAuthHeaders();

    const response = await authFetch(`${NODE_BASE_URL}/api/calls/initiate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        receiverId,
        callerType,
        serviceRequestId,
        serviceType,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.warn('[CallService] Initiate call failed:', data.message);
      return {
        success: false,
        error: data.message || 'Failed to connect the call',
      };
    }

    console.log('[CallService] Call initiated:', data.call?.callSid);

    return {
      success: true,
      call: data.call,
      message: data.message,
    };
  } catch (error) {
    console.error('[CallService] Initiate call error:', error);
    return {
      success: false,
      error: error.message || 'Network error. Please check your connection.',
    };
  }
};

// ============================================
// GET CALL STATUS
// ============================================

/**
 * Get the current status of a call.
 * Used for polling to show real-time call status to the user.
 * 
 * @param {string} callId - Call log ID
 * @returns {Promise<Object>} Current call status
 */
export const getCallStatus = async (callId) => {
  try {
    if (!callId) {
      return { success: false, error: 'Call ID is required' };
    }

    const headers = await getAuthHeaders();

    const response = await authFetch(`${NODE_BASE_URL}/api/calls/status/${callId}`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.message || 'Failed to get call status' };
    }

    return {
      success: true,
      call: data.call,
    };
  } catch (error) {
    console.error('[CallService] Get call status error:', error);
    return { success: false, error: 'Network error' };
  }
};

// ============================================
// CHECK CONTACTED STATUS
// ============================================

/**
 * Check if the authenticated user has contacted a specific provider.
 * Used to show "Contacted" badge on provider cards.
 * 
 * @param {string} providerId - Provider ID to check
 * @param {string} [serviceRequestId] - Optional service request scope
 * @returns {Promise<Object>} Contacted status
 */
export const checkContacted = async (providerId, serviceRequestId = null) => {
  try {
    if (!providerId) {
      return { success: false, contacted: false };
    }

    const headers = await getAuthHeaders();
    let url = `${NODE_BASE_URL}/api/calls/contacted/${providerId}`;
    if (serviceRequestId) {
      url += `?serviceRequestId=${serviceRequestId}`;
    }

    const response = await authFetch(url, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    return {
      success: true,
      contacted: data.contacted || false,
    };
  } catch (error) {
    console.error('[CallService] Check contacted error:', error);
    return { success: false, contacted: false };
  }
};

// ============================================
// GET CONTACTED PROVIDERS
// ============================================

/**
 * Get all providers the user has contacted for a specific service request.
 * Returns a Set of provider IDs for O(1) lookup in the provider list.
 * 
 * @param {string} serviceRequestId - Service request ID
 * @returns {Promise<Object>} Set of contacted provider IDs
 */
export const getContactedProviders = async (serviceRequestId) => {
  try {
    if (!serviceRequestId) {
      return { success: true, contactedIds: new Set() };
    }

    const headers = await getAuthHeaders();

    const response = await authFetch(
      `${NODE_BASE_URL}/api/calls/contacted-providers/${serviceRequestId}`,
      { method: 'GET', headers }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, contactedIds: new Set() };
    }

    // Convert to Set for O(1) lookup
    const contactedIds = new Set(
      (data.contactedProviders || []).map(cp => cp.providerId)
    );

    return {
      success: true,
      contactedIds,
      details: data.contactedProviders || [],
    };
  } catch (error) {
    console.error('[CallService] Get contacted providers error:', error);
    return { success: false, contactedIds: new Set() };
  }
};

// ============================================
// GET CALL HISTORY
// ============================================

/**
 * Get call history for the authenticated user or provider.
 * 
 * @param {Object} options - Options
 * @param {string} options.role - 'user' or 'provider'
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @returns {Promise<Object>} Call history
 */
export const getCallHistory = async ({ role = 'user', page = 1, limit = 20 } = {}) => {
  try {
    const headers = await getAuthHeaders();

    const response = await authFetch(
      `${NODE_BASE_URL}/api/calls/history?role=${role}&page=${page}&limit=${limit}`,
      { method: 'GET', headers }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, calls: [] };
    }

    return {
      success: true,
      calls: data.calls || [],
      page: data.page,
      limit: data.limit,
    };
  } catch (error) {
    console.error('[CallService] Get call history error:', error);
    return { success: false, calls: [] };
  }
};

export default {
  initiateCall,
  getCallStatus,
  checkContacted,
  getContactedProviders,
  getCallHistory,
};
