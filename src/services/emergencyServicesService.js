/**
 * Emergency Services API Service
 * Handles emergency service requests (Snake Catcher, Ambulance, Mortuary Van)
 * and static emergency numbers (Fire Brigade, Police, Hospital)
 * 
 * @version 1.0.0
 */

import { NODE_BASE_URL } from '../config/api';

const API_BASE = `${NODE_BASE_URL}/api/emergency-services`;

/**
 * Emergency service type constants
 */
export const EMERGENCY_SERVICE_TYPES = {
  SNAKE_CATCHER: 'snake_catcher',
  PRIVATE_AMBULANCE: 'private_ambulance',
  MORTUARY_VAN: 'mortuary_van',
  FIRE_BRIGADE: 'fire_brigade',
  POLICE: 'police',
  HOSPITAL: 'hospital'
};

/**
 * Location-based services (use provider search flow)
 */
export const LOCATION_BASED_SERVICES = ['snake_catcher', 'private_ambulance', 'mortuary_van'];

/**
 * Static number services (show emergency numbers only)
 */
export const STATIC_NUMBER_SERVICES = ['fire_brigade', 'police', 'hospital'];

/**
 * Service labels for display
 */
export const EMERGENCY_SERVICE_LABELS = {
  snake_catcher: 'Snake Catcher',
  private_ambulance: 'Private Ambulance',
  mortuary_van: 'Mortuary Van',
  fire_brigade: 'Fire Brigade',
  police: 'Police',
  hospital: 'Hospital'
};

/**
 * Service icons - MaterialIcon names for production-grade UI
 */
export const EMERGENCY_SERVICE_ICONS = {
  snake_catcher: 'pest-control', // Material icon for pest/snake
  private_ambulance: 'local-hospital', // Ambulance/medical icon
  mortuary_van: 'airport-shuttle', // Van/transport icon
  fire_brigade: 'local-fire-department', // Fire icon
  police: 'local-police', // Police icon
  hospital: 'medical-services' // Hospital icon
};

/**
 * Get static emergency numbers
 * @param {string} type - Optional: filter by type (fire_brigade, police, hospital)
 * @returns {Promise<Object>}
 */
export const getStaticEmergencyNumbers = async (type = null) => {
  try {
    let url = `${API_BASE}/static-numbers`;
    if (type) {
      url += `?type=${encodeURIComponent(type)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch emergency numbers');
    }

    return {
      success: true,
      data: data.data || data.numbers
    };
  } catch (error) {
    console.error('[EmergencyService] Get numbers error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch emergency numbers'
    };
  }
};

/**
 * Create emergency service request (for location-based services)
 * @param {Object} params - Request parameters
 * @param {string} params.userId - User ID
 * @param {string} params.serviceType - Service type (snake_catcher, private_ambulance, mortuary_van)
 * @param {Object} params.location - { latitude, longitude, address?, landmark? }
 * @param {string} params.notes - Optional notes
 * @returns {Promise<Object>}
 */
export const createEmergencyRequest = async ({ userId, serviceType, location, notes }) => {
  try {
    if (!LOCATION_BASED_SERVICES.includes(serviceType)) {
      return {
        success: false,
        error: 'This service type only shows static numbers. Use getStaticEmergencyNumbers instead.'
      };
    }

    const response = await fetch(`${API_BASE}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        serviceType,
        location,
        notes
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[EmergencyService] Create failed:', data);
      // Propagate error code (e.g., OUTSIDE_SERVICE_ZONE) so screens can show contextual UI
      const errorCode = data.code || null;
      const errorMessage = data.error || 'Failed to create emergency request';
      const suggestion = data.details?.suggestion || null;
      return {
        success: false,
        error: errorMessage,
        code: errorCode,
        suggestion,
        statusCode: response.status,
      };
    }

    return {
      success: true,
      data: data.data,
      message: data.message
    };
  } catch (error) {
    console.error('[EmergencyService] Create error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create emergency request'
    };
  }
};

/**
 * Get nearby providers for emergency request
 * @param {string} requestId - Request ID (MongoDB _id)
 * @param {number} limit - Maximum providers to return
 * @returns {Promise<Object>}
 */
export const getNearbyEmergencyProviders = async (requestId, limit = 10) => {
  try {
    const response = await fetch(`${API_BASE}/${requestId}/providers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch providers');
    }

    return {
      success: true,
      providers: data.providers || [],
      meta: data.meta
    };
  } catch (error) {
    console.error('[EmergencyService] Get providers error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch providers',
      providers: []
    };
  }
};

/**
 * User assigns/selects a provider for the emergency request
 * This is called when the USER selects a provider from the list
 * The request goes to "awaiting_confirmation" - provider must still accept
 * @param {string} requestId - Request ID
 * @param {string} providerId - Provider ID
 * @param {string} userEmail - User email (optional)
 * @returns {Promise<Object>}
 */
export const assignEmergencyProvider = async (requestId, providerId, userEmail) => {
  try {
    const response = await fetch(`${API_BASE}/${requestId}/assign-provider`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providerId,
        userEmail
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to assign provider');
    }

    return {
      success: true,
      data: data.data,
      message: data.message
    };
  } catch (error) {
    console.error('[EmergencyService] Assign provider error:', error);
    return {
      success: false,
      error: error.message || 'Failed to assign provider'
    };
  }
};

/**
 * Provider accepts/confirms emergency request assigned to them
 * This is called when the PROVIDER confirms the request
 * @param {string} requestId - Request ID
 * @param {string} providerId - Provider ID
 * @param {number} estimatedArrival - Estimated arrival time in minutes
 * @param {string} userEmail - User email for OTP
 * @returns {Promise<Object>}
 */
export const acceptEmergencyRequest = async (requestId, providerId, estimatedArrival, userEmail) => {
  try {
    const response = await fetch(`${API_BASE}/${requestId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providerId,
        estimatedArrival,
        userEmail
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to accept request');
    }

    return {
      success: true,
      data: data.data,
      message: data.message
    };
  } catch (error) {
    console.error('[EmergencyService] Accept error:', error);
    return {
      success: false,
      error: error.message || 'Failed to accept request'
    };
  }
};

/**
 * User rejects a provider from list
 * @param {string} requestId - Request ID
 * @param {string} providerId - Provider ID to reject
 * @returns {Promise<Object>}
 */
export const rejectEmergencyProvider = async (requestId, providerId) => {
  try {
    const response = await fetch(`${API_BASE}/${requestId}/reject-provider`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ providerId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reject provider');
    }

    return {
      success: true,
      message: data.message,
      rejectedCount: data.rejectedCount
    };
  } catch (error) {
    console.error('[EmergencyService] Reject provider error:', error);
    return {
      success: false,
      error: error.message || 'Failed to reject provider'
    };
  }
};

/**
 * Get provider's current location for tracking
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>}
 */
export const getProviderLocation = async (requestId) => {
  try {
    const response = await fetch(`${API_BASE}/${requestId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch request details');
    }

    return {
      success: true,
      request: data.request,
      providerLocation: data.request?.providerLocation,
      status: data.request?.status
    };
  } catch (error) {
    console.error('[EmergencyService] Get location error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch location'
    };
  }
};

/**
 * Provider marks as arrived
 * @param {string} requestId - Request ID
 * @param {string} providerId - Provider ID
 * @returns {Promise<Object>}
 */
export const markArrived = async (requestId, providerId) => {
  try {
    const response = await fetch(`${API_BASE}/${requestId}/arrived`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ providerId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to mark as arrived');
    }

    return {
      success: true,
      data: data.data,
      message: data.message
    };
  } catch (error) {
    console.error('[EmergencyService] Mark arrived error:', error);
    return {
      success: false,
      error: error.message || 'Failed to mark as arrived'
    };
  }
};

/**
 * Verify completion OTP
 * @param {string} requestId - Request ID
 * @param {string} otp - 6-digit OTP
 * @returns {Promise<Object>}
 */
export const verifyEmergencyOtp = async (requestId, otp) => {
  try {
    const response = await fetch(`${API_BASE}/${requestId}/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to verify OTP');
    }

    return {
      success: true,
      data: data.data,
      message: data.message
    };
  } catch (error) {
    console.error('[EmergencyService] Verify OTP error:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify OTP'
    };
  }
};

/**
 * Cancel emergency request
 * @param {string} requestId - Request ID
 * @param {string} reason - Cancellation reason
 * @param {string} cancelledBy - 'user' or 'provider'
 * @returns {Promise<Object>}
 */
export const cancelEmergencyRequest = async (requestId, reason, cancelledBy = 'user') => {
  try {
    const response = await fetch(`${API_BASE}/${requestId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, cancelledBy }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to cancel request');
    }

    return {
      success: true,
      data: data.data,
      message: data.message
    };
  } catch (error) {
    console.error('[EmergencyService] Cancel error:', error);
    return {
      success: false,
      error: error.message || 'Failed to cancel request'
    };
  }
};

/**
 * Get user's emergency requests
 * @param {string} userId - User ID
 * @param {string} status - Optional status filter
 * @returns {Promise<Object>}
 */
export const getUserEmergencyRequests = async (userId, status = null) => {
  try {
    let url = `${API_BASE}/user/${userId}`;
    if (status) {
      url += `?status=${encodeURIComponent(status)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch requests');
    }

    return {
      success: true,
      count: data.count,
      requests: data.requests || []
    };
  } catch (error) {
    console.error('[EmergencyService] Get user requests error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch requests',
      requests: []
    };
  }
};

/**
 * Get provider's emergency requests
 * @param {string} providerId - Provider ID
 * @param {string} status - Optional status filter
 * @returns {Promise<Object>}
 */
export const getProviderEmergencyRequests = async (providerId, status = null) => {
  try {
    let url = `${API_BASE}/provider/${providerId}`;
    if (status) {
      url += `?status=${encodeURIComponent(status)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch requests');
    }

    return {
      success: true,
      count: data.count,
      requests: data.requests || []
    };
  } catch (error) {
    console.error('[EmergencyService] Get provider requests error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch requests',
      requests: []
    };
  }
};

/**
 * Check if service type is location-based
 * @param {string} serviceType - Service type
 * @returns {boolean}
 */
export const isLocationBasedService = (serviceType) => {
  return LOCATION_BASED_SERVICES.includes(serviceType);
};

/**
 * Check if service type uses static numbers
 * @param {string} serviceType - Service type
 * @returns {boolean}
 */
export const isStaticNumberService = (serviceType) => {
  return STATIC_NUMBER_SERVICES.includes(serviceType);
};

export default {
  EMERGENCY_SERVICE_TYPES,
  LOCATION_BASED_SERVICES,
  STATIC_NUMBER_SERVICES,
  EMERGENCY_SERVICE_LABELS,
  EMERGENCY_SERVICE_ICONS,
  getStaticEmergencyNumbers,
  createEmergencyRequest,
  getNearbyEmergencyProviders,
  assignEmergencyProvider,
  acceptEmergencyRequest,
  rejectEmergencyProvider,
  getProviderLocation,
  markArrived,
  verifyEmergencyOtp,
  cancelEmergencyRequest,
  getUserEmergencyRequests,
  getProviderEmergencyRequests,
  isLocationBasedService,
  isStaticNumberService
};
