/**
 * Traditional Service API Service
 * Handles service request creation, provider booking, and request management
 * @version 2.0.0
 * 
 * Backend API Reference:
 * - POST /api/traditional-service/create - Create service request
 * - POST /api/traditional-service/:id/providers - Get nearby providers
 * - GET /api/traditional-service/:id - Get request details
 * - PUT /api/traditional-service/:id/cancel - Cancel request
 * - GET /api/traditional-service/user/:userId - Get user's requests
 * - POST /api/traditional-service/:id/send-to-provider - Send request to provider (book)
 * - POST /api/traditional-service/:id/accept-provider - Provider accepts request
 * - GET /api/traditional-service/provider/:providerId - Get provider's requests
 */

import { NODE_BASE_URL, API_ENDPOINTS } from '../config/api';

// Allowed service types (matches backend enum)
export const SERVICE_TYPES = {
  ELECTRICIAN: 'electrician',
  PLUMBER: 'plumber',
  ELECTRONICS_TECHNICIAN: 'electronics_technician',
  CARPENTER: 'carpenter',
  PAINTER: 'painter',
  SOLAR_REPAIRING: 'solar_repairing',
  WELDER: 'welder',
  SALON: 'salon',
  VEHICLE_CLEANING: 'vehicle_cleaning',
  MASON_TILER: 'mason_tiler',
  DRIVER: 'driver',
  AC_REPAIR: 'ac_repair',
  CLEANING: 'cleaning',
};

// Service type display names for UI
export const SERVICE_TYPE_LABELS = {
  electrician: 'Electrician',
  plumber: 'Plumber',
  electronics_technician: 'Electronics Technician',
  carpenter: 'Carpenter',
  painter: 'Painter',
  solar_repairing: 'Solar Repairing',
  welder: 'Welder',
  salon: 'Salon',
  vehicle_cleaning: 'Vehicle Cleaning',
  mason_tiler: 'Mason & Tiler',
  driver: 'Driver',
  ac_repair: 'AC Repair',
  cleaning: 'Cleaning',
  // Event services
  photographer: 'Photographer',
  influencer: 'Influencer',
  // Emergency services
  snake_catcher: 'Snake Catcher',
  private_ambulance: 'Private Ambulance',
  mortuary_van: 'Mortuary Van',
};

// Request status enum
export const REQUEST_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
};

/**
 * Transform frontend location format to backend GeoJSON format
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Object} GeoJSON Point object
 */
const toGeoJSON = (latitude, longitude) => ({
  type: 'Point',
  coordinates: [longitude, latitude], // GeoJSON uses [lng, lat] order
});

/**
 * Create a new service request
 * 
 * Backend expects:
 * {
 *   userId: string (MongoDB _id),
 *   serviceType: string (from enum),
 *   location: { type: "Point", coordinates: [lng, lat] },
 *   serviceDate: Date
 * }
 * 
 * @param {Object} params - Request parameters
 * @param {string} params.userId - User's MongoDB _id
 * @param {string} params.serviceType - Type of service (from SERVICE_TYPES)
 * @param {number} params.latitude - Service location latitude
 * @param {number} params.longitude - Service location longitude
 * @param {Date|string} params.serviceDate - Preferred service date (ISO string or Date object)
 * @param {string} params.serviceTime - Preferred service time (HH:mm format)
 * @param {string} params.serviceAddress - Human-readable address
 * @param {boolean} params.isOtherLocation - Whether booking is for a different location
 * @param {string} params.description - Optional description
 * @returns {Promise<Object>} Created service request
 */
export const createServiceRequest = async ({
  userId,
  serviceType,
  latitude,
  longitude,
  serviceDate,
  serviceTime,
  serviceAddress,
  isOtherLocation = false,
  description = '',
}) => {
  try {
    // Validate required fields
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!serviceType) {
      throw new Error('Service type is required');
    }
    if (!Object.values(SERVICE_TYPES).includes(serviceType)) {
      throw new Error(`Invalid service type: ${serviceType}`);
    }
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      throw new Error('Location coordinates are required');
    }
    if (!serviceDate) {
      throw new Error('Service date is required');
    }

    // Validate coordinates are numbers
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('Invalid coordinates format');
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (lng < -180 || lng > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }

    // Prepare request body
    const requestBody = {
      userId,
      serviceType,
      location: toGeoJSON(lat, lng),
      serviceDate: new Date(serviceDate).toISOString(),
      serviceTime: serviceTime || null,
      serviceAddress: serviceAddress || '',
      isOtherLocation: isOtherLocation || false,
      description: description || '',
    };

    console.log('[TraditionalService] Creating request:', {
      userId,
      serviceType,
      location: `[${lng}, ${lat}]`,
      serviceDate: requestBody.serviceDate,
      serviceTime: requestBody.serviceTime,
      isOtherLocation: requestBody.isOtherLocation,
    });

    const url = `${NODE_BASE_URL}${API_ENDPOINTS.TRADITIONAL_SERVICE.CREATE}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] Create failed:', data);
      throw new Error(data.message || data.error || 'Failed to create service request');
    }

    // Backend returns { success, message, data: service }
    const serviceRequest = data.data || data.request || data;

    console.log('[TraditionalService] Request created successfully:', {
      requestId: serviceRequest._id,
      status: serviceRequest.status,
    });

    return {
      success: true,
      request: serviceRequest,
      message: data.message || 'Service request created successfully',
    };
  } catch (error) {
    console.error('[TraditionalService] Create error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to create service request',
    };
  }
};

/**
 * Get nearby providers for a service request
 * Uses progressive distance search (5km -> 10km)
 * 
 * @param {string} requestId - Service request MongoDB _id
 * @param {number} [limit=20] - Maximum providers to return
 * @returns {Promise<Object>} Nearby providers list
 */
export const getNearbyProviders = async (requestId, limit = 20) => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    console.log('[TraditionalService] Fetching nearby providers for request:', requestId);

    const url = `${NODE_BASE_URL}${API_ENDPOINTS.TRADITIONAL_SERVICE.NEARBY_PROVIDERS}/${requestId}/providers`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] Get providers failed:', data);
      // Backend returns error in { error: { code, message } } format
      const errorMessage = data.error?.message || data.message || data.error || 'Failed to fetch nearby providers';
      throw new Error(errorMessage);
    }

    console.log('[TraditionalService] Providers found:', {
      count: data.providers?.length || 0,
      searchRadius: data.searchRadius,
      progressiveSearch: data.progressiveSearch,
    });

    // Backend returns { message, providers, count, searchRadius, progressiveSearch, searchDetails }
    return {
      success: true,
      providers: data.providers || [],
      count: data.count || 0,
      searchRadius: data.searchRadius || 0,
      progressiveSearch: data.progressiveSearch || false,
      searchDetails: data.searchDetails || null,
      message: data.message || 'Providers fetched successfully',
    };
  } catch (error) {
    console.error('[TraditionalService] Get providers error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch nearby providers',
      providers: [],
      count: 0,
    };
  }
};

/**
 * Skip (remove) a provider and get a replacement from the backend queue.
 * 
 * The backend:
 * 1. Adds the provider to rejectedProviders
 * 2. Runs the same geo-search, excluding all rejected + currently displayed IDs
 * 3. Returns exactly 1 replacement provider (or null if queue exhausted)
 * 
 * @param {string} requestId - Service request MongoDB _id
 * @param {string} providerId - Provider being skipped
 * @param {string[]} currentProviderIds - All provider IDs currently visible in the list
 * @returns {Promise<Object>} { success, skippedProviderId, replacement, meta }
 */
export const skipProvider = async (requestId, providerId, currentProviderIds = []) => {
  try {
    if (!requestId) throw new Error('Request ID is required');
    if (!providerId) throw new Error('Provider ID is required');

    console.log('[TraditionalService] Skipping provider:', { requestId, providerId });

    const url = `${NODE_BASE_URL}/api/traditional-services/${requestId}/skip-provider`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, currentProviderIds }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] Skip provider failed:', data);
      throw new Error(data.message || data.error || 'Failed to skip provider');
    }

    console.log('[TraditionalService] Skip result:', {
      skipped: data.skippedProviderId,
      hasReplacement: !!data.replacement,
      remaining: data.meta?.remainingInQueue,
    });

    return {
      success: true,
      skippedProviderId: data.skippedProviderId,
      replacement: data.replacement || null,
      meta: data.meta || {},
      message: data.message,
    };
  } catch (error) {
    console.error('[TraditionalService] Skip provider error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to skip provider',
    };
  }
};

/**
 * Retry search for providers after rejecting all
 * Clears the rejected providers list and re-fetches nearby providers
 * 
 * @param {string} requestId - Service request MongoDB _id
 * @param {string} userId - User's MongoDB _id (required)
 * @returns {Promise<Object>} Updated providers list
 */
export const retryProviderSearch = async (requestId, userId) => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log('[TraditionalService] Retrying provider search for request:', requestId);

    const url = `${NODE_BASE_URL}/api/traditional-services/${requestId}/retry-search`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] Retry search failed:', data);
      const errorMessage = data.error?.message || data.message || data.error || 'Failed to retry search';
      throw new Error(errorMessage);
    }

    console.log('[TraditionalService] Retry search successful:', {
      count: data.providers?.length || 0,
      searchRadius: data.searchRadius,
    });

    return {
      success: true,
      providers: data.providers || [],
      count: data.count || 0,
      searchRadius: data.searchRadius || 0,
      message: data.message || 'Search retried successfully',
    };
  } catch (error) {
    console.error('[TraditionalService] Retry search error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to retry search',
      providers: [],
      count: 0,
    };
  }
};

/**
 * Get service request details by ID
 * 
 * @param {string} requestId - Service request MongoDB _id
 * @returns {Promise<Object>} Request details
 */
export const getRequestDetails = async (requestId) => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    console.log('[TraditionalService] Fetching request details:', requestId);

    const url = `${NODE_BASE_URL}${API_ENDPOINTS.TRADITIONAL_SERVICE.GET_REQUEST}/${requestId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] Get details failed:', data);
      throw new Error(data.message || data.error || 'Failed to fetch request details');
    }

    console.log('[TraditionalService] Request details fetched:', {
      requestId: data.request?._id || data._id,
      status: data.request?.status || data.status,
    });

    return {
      success: true,
      request: data.request || data,
      message: data.message || 'Request details fetched successfully',
    };
  } catch (error) {
    console.error('[TraditionalService] Get details error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch request details',
    };
  }
};

/**
 * Cancel a service request
 * 
 * Backend expects: POST /:id/cancel
 * Body: { userId, reason, cancelledBy }
 * 
 * @param {string} requestId - Service request MongoDB _id
 * @param {string} userId - User's MongoDB _id (required)
 * @param {string} [reason] - Optional cancellation reason
 * @returns {Promise<Object>} Cancellation result
 */
export const cancelRequest = async (requestId, userId, reason = '') => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log('[TraditionalService] Cancelling request:', requestId);

    const url = `${NODE_BASE_URL}${API_ENDPOINTS.TRADITIONAL_SERVICE.CANCEL}/${requestId}/cancel`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        userId,
        reason: reason || 'User cancelled',
        cancelledBy: 'user'
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] Cancel failed:', data);
      // Handle nested error format from backend
      const errorMessage = data.error?.message || data.message || data.error || 'Failed to cancel request';
      throw new Error(errorMessage);
    }

    console.log('[TraditionalService] Request cancelled successfully');

    return {
      success: true,
      request: data.data || data.request || data,
      message: data.message || 'Request cancelled successfully',
    };
  } catch (error) {
    console.error('[TraditionalService] Cancel error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to cancel request',
    };
  }
};

/**
 * Provider cancels a request they accepted
 * 
 * Backend expects: POST /:id/provider-cancel
 * Body: { providerId, reason }
 * 
 * @param {string} requestId - Service request MongoDB _id
 * @param {string} providerId - Provider's MongoDB _id (required)
 * @param {string} [reason] - Optional cancellation reason
 * @returns {Promise<Object>} Cancellation result
 */
export const providerCancelRequest = async (requestId, providerId, reason = '') => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    if (!providerId) {
      throw new Error('Provider ID is required');
    }

    console.log('[TraditionalService] Provider cancelling request:', requestId);

    const url = `${NODE_BASE_URL}${API_ENDPOINTS.TRADITIONAL_SERVICE.CANCEL}/${requestId}/provider-cancel`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        providerId,
        reason: reason || 'Provider cancelled',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] Provider cancel failed:', data);
      const errorMessage = data.error?.message || data.message || data.error || 'Failed to cancel request';
      throw new Error(errorMessage);
    }

    console.log('[TraditionalService] Request cancelled by provider successfully');

    return {
      success: true,
      data: data.data || data,
      message: data.message || 'Request cancelled successfully',
    };
  } catch (error) {
    console.error('[TraditionalService] Provider cancel error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to cancel request',
    };
  }
};

/**
 * Get all service requests for a user
 * 
 * @param {string} userId - User's MongoDB _id
 * @param {Object} [filters] - Optional filters
 * @param {string} [filters.status] - Filter by status
 * @returns {Promise<Object>} User's service requests
 */
export const getUserRequests = async (userId, filters = {}) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log('[TraditionalService] Fetching user requests:', userId);

    let url = `${NODE_BASE_URL}${API_ENDPOINTS.TRADITIONAL_SERVICE.USER_REQUESTS}/${userId}`;
    
    // Add query params if filters provided
    const queryParams = new URLSearchParams();
    if (filters.status) {
      queryParams.append('status', filters.status);
    }
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] Get user requests failed:', data);
      throw new Error(data.message || data.error || 'Failed to fetch user requests');
    }

    // Backend returns: { success, data, pagination, stats }
    const requestsData = data.data || data.requests || [];

    console.log('[TraditionalService] User requests fetched:', {
      count: requestsData.length || 0,
      hasStats: !!data.stats,
      hasPagination: !!data.pagination,
    });

    return {
      success: true,
      requests: requestsData,
      stats: data.stats || null,
      pagination: data.pagination || null,
      count: data.pagination?.totalRequests || requestsData.length || 0,
      message: data.message || 'Requests fetched successfully',
    };
  } catch (error) {
    console.error('[TraditionalService] Get user requests error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch user requests',
      requests: [],
      stats: null,
      pagination: null,
      count: 0,
    };
  }
};

/**
 * Send request to a specific provider (book provider)
 * This notifies the provider about the service request
 * 
 * @param {string} requestId - Service request MongoDB _id
 * @param {string} providerId - Provider's MongoDB _id
 * @param {number} distance - Distance in meters from provider to request location (optional)
 * @returns {Promise<Object>} Result of sending request
 */
export const sendRequestToProvider = async (requestId, providerId, distance = null) => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    if (!providerId) {
      throw new Error('Provider ID is required');
    }

    console.log('[TraditionalService] Sending request to provider:', { requestId, providerId, distance });

    const url = `${NODE_BASE_URL}${API_ENDPOINTS.TRADITIONAL_SERVICE.SEND_TO_PROVIDER}/${requestId}/send-to-provider`;
    
    const requestBody = { providerId };
    if (distance) {
      requestBody.distance = distance;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] Send to provider failed:', data);
      const errorMessage = data.error?.message || data.message || 'Failed to send request to provider';
      throw new Error(errorMessage);
    }

    console.log('[TraditionalService] Request sent to provider successfully:', {
      requestId: data.data?.requestId,
      providerId: data.data?.providerId,
      providerName: data.data?.providerName,
    });

    return {
      success: true,
      data: data.data,
      message: data.message || 'Request sent to provider successfully',
      notificationSent: data.meta?.notificationDelivered || false,
    };
  } catch (error) {
    console.error('[TraditionalService] Send to provider error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to send request to provider',
    };
  }
};

/**
 * Provider accepts a service request
 * 
 * @param {string} requestId - Service request MongoDB _id
 * @param {string} providerId - Provider's MongoDB _id
 * @param {string} [userEmail] - User's email for OTP delivery
 * @returns {Promise<Object>} Result of accepting request
 */
export const acceptRequestAsProvider = async (requestId, providerId, userEmail = '') => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    if (!providerId) {
      throw new Error('Provider ID is required');
    }

    console.log('[TraditionalService] Provider accepting request:', { requestId, providerId });

    const url = `${NODE_BASE_URL}${API_ENDPOINTS.TRADITIONAL_SERVICE.ACCEPT_PROVIDER}/${requestId}/accept-provider`;
    
    // Timeout: abort if server doesn't respond within 45 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ providerId, userEmail }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] Accept request failed:', data);
      const errorMessage = data.error?.message || data.message || 'Failed to accept request';
      throw new Error(errorMessage);
    }

    console.log('[TraditionalService] Request accepted successfully:', {
      requestId: data.data?.requestId,
      providerId: data.data?.providerId,
      status: data.data?.status,
    });

    return {
      success: true,
      data: data.data,
      message: data.message || 'Request accepted successfully',
      warning: data.warning || null,
    };
  } catch (error) {
    console.error('[TraditionalService] Accept request error:', error.message);
    const isTimeout = error.name === 'AbortError';
    return {
      success: false,
      error: isTimeout
        ? 'Request timed out. Please check your connection and try again.'
        : (error.message || 'Failed to accept request'),
    };
  }
};

/**
 * Get provider's service requests (incoming requests sent to them)
 * 
 * @param {string} providerId - Provider's MongoDB _id
 * @param {Object} [options] - Query options
 * @param {string} [options.status] - Filter by status
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Items per page
 * @param {string} [options.sortBy='createdAt'] - Sort field
 * @param {string} [options.sortOrder='desc'] - Sort order
 * @returns {Promise<Object>} Provider's service requests
 */
export const getProviderRequests = async (providerId, options = {}) => {
  try {
    if (!providerId) {
      throw new Error('Provider ID is required');
    }

    console.log('[TraditionalService] Fetching provider requests:', providerId);

    const {
      status,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    let url = `${NODE_BASE_URL}${API_ENDPOINTS.TRADITIONAL_SERVICE.PROVIDER_REQUESTS}/${providerId}/requests`;
    
    // Add query params
    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', status);
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    queryParams.append('sortBy', sortBy);
    queryParams.append('sortOrder', sortOrder);
    
    url += `?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] Get provider requests failed:', data);
      throw new Error(data.message || data.error || 'Failed to fetch provider requests');
    }

    console.log('[TraditionalService] Provider requests fetched:', {
      count: data.data?.length || 0,
      stats: data.stats,
    });

    return {
      success: true,
      requests: data.data || [],
      pagination: data.pagination || null,
      stats: data.stats || null,
      message: data.message || 'Requests fetched successfully',
    };
  } catch (error) {
    console.error('[TraditionalService] Get provider requests error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch provider requests',
      requests: [],
    };
  }
};

/**
 * Verify completion OTP to mark service as complete
 * Used by provider to complete the service after getting OTP from user
 * 
 * @param {string} requestId - Service request MongoDB _id
 * @param {string} otp - 6-digit OTP from user
 * @returns {Promise<Object>} Verification result
 */
export const verifyCompletionOtp = async (requestId, otp) => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    if (!otp) {
      throw new Error('OTP is required');
    }

    console.log('[TraditionalService] Verifying completion OTP:', { requestId, otp: '******' });

    const url = `${NODE_BASE_URL}${API_ENDPOINTS.TRADITIONAL_SERVICE.VERIFY_OTP}/${requestId}/verify-otp`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TraditionalService] OTP verification failed:', data);
      const errorMessage = data.error?.message || data.message || data.error || 'Failed to verify OTP';
      return {
        success: false,
        code: data.code || 'VERIFICATION_FAILED',
        error: errorMessage,
      };
    }

    console.log('[TraditionalService] OTP verified successfully, service completed');

    return {
      success: true,
      data: data.data,
      message: data.message || 'Service completed successfully',
      details: data.details || null,
    };
  } catch (error) {
    console.error('[TraditionalService] OTP verification error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to verify OTP',
    };
  }
};

/**
 * Resend completion OTP to user's email
 * 
 * @param {string} requestId - Service request MongoDB _id
 * @returns {Promise<Object>} Result of resending OTP with new OTP code
 */
export const resendCompletionOtp = async (requestId) => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }

    console.log('[TraditionalService] Resending completion OTP:', requestId);

    const url = `${NODE_BASE_URL}${API_ENDPOINTS.TRADITIONAL_SERVICE.RESEND_OTP}/${requestId}/resend-otp`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    // Handle 207 (partial success) as success since OTP was generated
    if (!response.ok && response.status !== 207) {
      console.error('[TraditionalService] Resend OTP failed:', data);
      const errorMessage = data.error?.message || data.message || data.error || 'Failed to resend OTP';
      throw new Error(errorMessage);
    }

    console.log('[TraditionalService] OTP resent successfully:', data);

    return {
      success: true,
      message: data.message || 'OTP sent successfully',
      otp: data.data?.completionOtp || null,
      expiresAt: data.data?.otpExpiresAt || null,
      warning: data.warning || false,
    };
  } catch (error) {
    console.error('[TraditionalService] Resend OTP error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to resend OTP',
    };
  }
};

/**
 * Submit rating for a completed service — CENTRALIZED
 * Works for ALL service types (traditional, event, emergency).
 * The backend auto-detects the service type from the request ID.
 *
 * @param {string} requestId - Service request MongoDB _id or requestId
 * @param {string} userId - User's ID
 * @param {number} rating - Rating from 1-5
 * @param {string} review - Optional review text
 */
/**
 * Submit a provider rating (centralized — provider-level, not service-level).
 * @param {string} requestId  - The service request _id or requestId (used for verification & dedup)
 * @param {string} userId     - The user submitting the rating
 * @param {number} rating     - 1-5 stars
 * @param {string} review     - Optional review text
 * @param {string} providerId - The provider being rated (optional, resolved server-side if omitted)
 */
export const submitRating = async (requestId, userId, rating, review = '', providerId = null) => {
  try {
    console.log('[Rating] Submitting:', { requestId, userId, rating, providerId });

    const body = { userId, rating: Math.round(rating), review };
    if (providerId) body.providerId = providerId;

    const response = await fetch(`${NODE_BASE_URL}/api/ratings/${requestId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Rating] Failed:', data);
      return {
        success: false,
        error: data.error || data.message || 'Failed to submit rating',
        code: data.code,
      };
    }

    console.log('[Rating] Success:', data);

    return {
      success: true,
      message: data.message || 'Rating submitted successfully',
      data: data.data,
    };
  } catch (error) {
    console.error('[Rating] Error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to submit rating',
    };
  }
};

// Alias for backward compatibility
export const submitEventRating = submitRating;

/**
 * Check if a service request has already been rated.
 * @param {string} serviceRequestId - The service request _id
 * @returns {{ rated: boolean, rating?: { rating, review, date } }}
 */
export const checkRatingStatus = async (serviceRequestId) => {
  try {
    const response = await fetch(`${NODE_BASE_URL}/api/ratings/check/${serviceRequestId}`);
    const data = await response.json();
    if (!response.ok) return { rated: false };
    return data.data || { rated: false };
  } catch (error) {
    console.warn('[Rating] checkRatingStatus error:', error.message);
    return { rated: false };
  }
};

/**
 * Get provider details by ID
 * @param {string} providerId - Provider's MongoDB ID
 */
export const getProviderDetails = async (providerId) => {
  try {
    console.log('[TraditionalService] Fetching provider details:', providerId);

    const response = await fetch(`${NODE_BASE_URL}/api/traditional-services/provider/${providerId}/details`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    // Get response text first to check if it's valid JSON
    const responseText = await response.text();
    
    // Check if response starts with HTML (error page)
    if (responseText.trim().startsWith('<') || responseText.trim().startsWith('<!')) {
      console.error('[TraditionalService] Server returned HTML instead of JSON');
      return {
        success: false,
        error: 'Server is currently unavailable. Please try again later.',
      };
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[TraditionalService] JSON parse error:', parseError.message);
      return {
        success: false,
        error: 'Invalid response from server. Please try again.',
      };
    }

    if (!response.ok) {
      console.error('[TraditionalService] Get provider details failed:', data);
      return {
        success: false,
        error: data.error || 'Failed to get provider details',
      };
    }

    console.log('[TraditionalService] Provider details fetched:', data.data?.name);

    return {
      success: true,
      provider: data.data,
    };
  } catch (error) {
    console.error('[TraditionalService] Get provider details error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to get provider details',
    };
  }
};

/**
 * Verify completion OTP for event services (photographer, influencer, etc.)
 * Provider enters the OTP to mark the event service as completed.
 * 
 * @param {string} requestId - Event service MongoDB _id
 * @param {string} otp - 6-digit OTP from user
 * @returns {Promise<Object>} Verification result
 */
export const verifyEventCompletionOtp = async (requestId, otp) => {
  try {
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    if (!otp) {
      throw new Error('OTP is required');
    }

    console.log('[EventService] Verifying completion OTP:', { requestId, otp: '******' });

    const url = `${NODE_BASE_URL}/api/event-services/${requestId}/verify-otp`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[EventService] OTP verification failed:', data);
      const errorMessage = data.error?.message || data.message || data.error || 'Failed to verify OTP';
      return {
        success: false,
        code: data.code || 'VERIFICATION_FAILED',
        error: errorMessage,
      };
    }

    console.log('[EventService] OTP verified successfully, service completed');

    return {
      success: true,
      data: data.data,
      message: data.message || 'Service completed successfully',
      details: data.details || null,
    };
  } catch (error) {
    console.error('[EventService] OTP verification error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to verify OTP',
    };
  }
};

export default {
  createServiceRequest,
  getNearbyProviders,
  getRequestDetails,
  cancelRequest,
  providerCancelRequest,
  getUserRequests,
  sendRequestToProvider,
  acceptRequestAsProvider,
  getProviderRequests,
  verifyCompletionOtp,
  verifyEventCompletionOtp,
  resendCompletionOtp,
  submitRating,
  submitEventRating,
  checkRatingStatus,
  getProviderDetails,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  REQUEST_STATUS,
};
