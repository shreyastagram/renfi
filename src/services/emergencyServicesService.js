/**
 * Emergency Services API Service
 * Handles emergency service requests (Snake Catcher, Ambulance, Mortuary Van)
 * and static emergency numbers (Fire Brigade, Police, Hospital)
 * 
 * @version 1.0.0
 */

import { NODE_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';

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
 * Government helpline categories (static numbers — no provider matching)
 */
export const GOVERNMENT_HELPLINE_SERVICES = [
  'general', 'women_child', 'traffic_transport', 'cyber_crime', 'public_services'
];

/**
 * Service labels for display
 */
export const EMERGENCY_SERVICE_LABELS = {
  snake_catcher: 'Snake Catcher',
  private_ambulance: 'Private Ambulance',
  mortuary_van: 'Mortuary Van',
  fire_brigade: 'Fire Brigade',
  police: 'Police',
  hospital: 'Hospital',
  general: 'General Emergency',
  women_child: 'Women & Child',
  traffic_transport: 'Traffic & Transport',
  cyber_crime: 'Cyber & Security',
  public_services: 'Public Services',
};

/**
 * Service icons - MaterialIcon names for production-grade UI
 */
export const EMERGENCY_SERVICE_ICONS = {
  snake_catcher: 'pest-control',
  private_ambulance: 'local-hospital',
  mortuary_van: 'airport-shuttle',
  fire_brigade: 'local-fire-department',
  police: 'local-police',
  hospital: 'medical-services',
  general: 'emergency',
  women_child: 'family-restroom',
  traffic_transport: 'directions-car',
  cyber_crime: 'security',
  public_services: 'account-balance',
};

/**
 * Offline fallback data for government helpline numbers.
 * These are static government numbers that never change — safe to hardcode.
 * The app tries the API first; if offline, falls back to these.
 */
const OFFLINE_HELPLINE_NUMBERS = {
  fire_brigade: [
    { name: 'Fire Brigade Emergency', number: '101', description: 'National Fire Emergency Number' },
    { name: 'Mumbai Fire Brigade', number: '1800220101', description: 'Mumbai Fire Brigade Toll-Free' },
    { name: 'Delhi Fire Service', number: '23416666', description: 'Delhi Fire Control Room' },
  ],
  police: [
    { name: 'Police Emergency', number: '100', description: 'National Police Emergency Number' },
    { name: 'Women Helpline', number: '1091', description: 'Women Emergency Helpline' },
    { name: 'Child Helpline', number: '1098', description: 'CHILDLINE India Foundation' },
  ],
  hospital: [
    { name: 'Ambulance', number: '102', description: 'Government Ambulance Service' },
    { name: 'Ambulance (Pan India)', number: '108', description: 'Emergency Medical Service' },
    { name: 'Blood Bank', number: '1910', description: 'Health & Family Welfare' },
    { name: 'Anti-Poison Centre', number: '1066', description: 'AIIMS Poison Information Centre' },
  ],
  general: [
    { name: 'National Emergency', number: '112', description: 'Integrated Emergency Response (Police, Fire, Ambulance)' },
    { name: 'Disaster Management', number: '1096', description: 'NDMA / National Disaster Management' },
    { name: 'Highway Accident', number: '1073', description: 'NHAI Control Room' },
  ],
  women_child: [
    { name: 'Women Helpline', number: '181', description: 'Women & Child Development' },
    { name: 'Women Emergency', number: '1091', description: 'Women Emergency Helpline' },
    { name: 'Child Helpline', number: '1098', description: 'CHILDLINE India Foundation' },
  ],
  traffic_transport: [
    { name: 'Traffic Police', number: '103', description: 'Maharashtra Traffic Control' },
    { name: 'Railway Enquiry', number: '139', description: 'Indian Railways Enquiry' },
    { name: 'Railway Security', number: '1322', description: 'Railway Protection Force' },
    { name: 'Tourist Helpline', number: '1363', description: 'Ministry of Tourism' },
  ],
  cyber_crime: [
    { name: 'Cyber Crime Helpline', number: '1930', description: 'MHA Cyber Security Wing' },
    { name: 'Anti-Terror Helpline', number: '1090', description: 'ATS / Ministry of Home Affairs' },
    { name: 'Anti-Corruption', number: '1064', description: 'CBI / ACB Maharashtra' },
    { name: 'Narcotics Control', number: '1933', description: 'NCB National Control Bureau' },
  ],
  public_services: [
    { name: 'Kisan Call Centre', number: '18001801551', description: 'Agriculture & Farmers Welfare' },
    { name: 'Public Distribution', number: '18002244950', description: 'Food & Civil Supplies Maharashtra' },
    { name: 'NIC Technical Support', number: '1800111555', description: 'NIC e-Governance Support' },
  ],
};

/**
 * Get static emergency numbers
 * Tries API first; falls back to hardcoded numbers if offline.
 * @param {string} type - Optional: filter by type (fire_brigade, police, hospital, etc.)
 * @returns {Promise<Object>}
 */
/**
 * Synchronous offline accessor — returns the bundled helpline numbers for a
 * category INSTANTLY (no network). Used to render the numbers sheet immediately
 * while the API refresh happens in the background, avoiding the visible delay.
 * @param {string} type
 * @returns {Array} numbers (possibly empty)
 */
export const getOfflineEmergencyNumbers = (type) => {
  if (type && OFFLINE_HELPLINE_NUMBERS[type]) return OFFLINE_HELPLINE_NUMBERS[type];
  return [];
};


export const getStaticEmergencyNumbers = async (type = null) => {
  try {
    let url = `${API_BASE}/static-numbers`;
    if (type) {
      url += `?type=${encodeURIComponent(type)}`;
    }

    const response = await authFetch(url, {
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
    console.error('[EmergencyService] Get numbers error, using offline fallback:', error);
    // Offline fallback — return hardcoded government helpline numbers
    if (type && OFFLINE_HELPLINE_NUMBERS[type]) {
      return {
        success: true,
        data: OFFLINE_HELPLINE_NUMBERS[type],
      };
    }
    // Return all numbers if no type specified
    if (!type) {
      return {
        success: true,
        data: OFFLINE_HELPLINE_NUMBERS,
      };
    }
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

    const response = await authFetch(`${API_BASE}/create`, {
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
        retryAfter: data.retryAfter || null,
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
    const response = await authFetch(`${API_BASE}/${requestId}/providers`, {
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
    const response = await authFetch(`${API_BASE}/${requestId}/assign-provider`, {
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
    const response = await authFetch(`${API_BASE}/${requestId}/accept`, {
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
    const response = await authFetch(`${API_BASE}/${requestId}/reject-provider`, {
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
    const response = await authFetch(`${API_BASE}/${requestId}`, {
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
    const response = await authFetch(`${API_BASE}/${requestId}/arrived`, {
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
    const response = await authFetch(`${API_BASE}/${requestId}/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        code: data.code || null,
        error: data.error || 'Failed to verify OTP'
      };
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
    const response = await authFetch(`${API_BASE}/${requestId}/cancel`, {
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

    const response = await authFetch(url, {
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

    const response = await authFetch(url, {
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
