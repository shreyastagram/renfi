/**
 * Profile Service
 * 
 * Handles profile-related API calls:
 * - Get current user info from Java Auth (verification status)
 * - Get user profile from MongoDB
 * - Get provider profile from MongoDB
 * 
 * @version 1.0.0
 */

import apiClient, { authClient, parseApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

// ==================== JAVA AUTH PROFILE ====================

/**
 * Get current user info from Java Auth
 * Returns verification status and basic user info
 * Requires access token (sent automatically by authClient)
 * 
 * @returns {Promise<Object>} User info with verification status
 */
export const getCurrentUser = async () => {
  try {
    console.log('👤 [ProfileService] Fetching current user from Java Auth...');
    
    const response = await authClient.get(ENDPOINTS.PROFILE.ME);
    
    console.log('✅ [ProfileService] Current user fetched:', response.data);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('❌ [ProfileService] Get current user failed:', error.message);
    const parsedError = parseApiError(error);
    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== MONGODB USER PROFILE ====================

/**
 * Get user profile from MongoDB
 * Uses the MongoDB _id (userId field in response)
 * NOTE: This endpoint requires JWT token verification with shared secret
 * 
 * @param {string} userId - MongoDB user _id
 * @returns {Promise<Object>} User profile data
 */
export const getUserProfile = async (userId) => {
  try {
    console.log(`👤 [ProfileService] Fetching user profile: ${userId}`);
    
    if (!userId) {
      return {
        success: false,
        error: { message: 'User ID is required', code: 'MISSING_USER_ID' },
      };
    }
    
    const response = await apiClient.get(`${ENDPOINTS.PROFILE.USER}/${userId}`);
    
    console.log('✅ [ProfileService] User profile fetched:', response.data);
    
    return {
      success: true,
      data: response.data.profile || response.data,
    };
  } catch (error) {
    // Handle auth errors gracefully - the token might not be verified by Node.js
    if (error.response?.status === 401) {
      console.warn('⚠️ [ProfileService] User profile auth failed - using Java Auth data only');
      return {
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' },
        authError: true,
      };
    }
    
    console.error('❌ [ProfileService] Get user profile failed:', error.message);
    const parsedError = parseApiError(error);
    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== MONGODB PROVIDER PROFILE ====================

/**
 * Get provider profile from MongoDB
 * Uses the MongoDB _id (providerId field in response)
 * 
 * @param {string} providerId - MongoDB provider _id
 * @returns {Promise<Object>} Provider profile data
 */
export const getProviderProfile = async (providerId) => {
  try {
    console.log(`👤 [ProfileService] Fetching provider profile: ${providerId}`);
    
    if (!providerId) {
      return {
        success: false,
        error: { message: 'Provider ID is required', code: 'MISSING_PROVIDER_ID' },
      };
    }
    
    const response = await apiClient.get(`${ENDPOINTS.PROFILE.PROVIDER}/${providerId}`);
    
    console.log('✅ [ProfileService] Provider profile fetched:', response.data);
    
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    console.error('❌ [ProfileService] Get provider profile failed:', error.message);
    const parsedError = parseApiError(error);
    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== UPDATE USER PROFILE ====================

/**
 * Update user profile in Java Auth (PostgreSQL)
 * Used to sync name and phone changes to the auth database
 * 
 * @param {Object} updates - Profile updates { fullName, phoneNumber }
 * @returns {Promise<Object>} Updated profile data
 */
export const updateJavaAuthProfile = async (updates) => {
  try {
    console.log('📝 [ProfileService] Updating Java Auth profile:', updates);
    
    const response = await authClient.put(ENDPOINTS.PROFILE.UPDATE_ME, updates);
    
    console.log('✅ [ProfileService] Java Auth profile updated:', response.data);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('❌ [ProfileService] Update Java Auth profile failed:', error.message);
    const parsedError = parseApiError(error);
    return {
      success: false,
      error: parsedError,
    };
  }
};

/**
 * Update user profile in MongoDB
 * Also syncs name and phone changes to Java Auth (PostgreSQL) for consistency
 * 
 * @param {string} userId - MongoDB user _id
 * @param {Object} updates - Profile updates
 * @returns {Promise<Object>} Updated profile data
 */
export const updateUserProfile = async (userId, updates) => {
  try {
    console.log(`📝 [ProfileService] Updating user profile: ${userId}`, updates);
    
    if (!userId) {
      return {
        success: false,
        error: { message: 'User ID is required', code: 'MISSING_USER_ID' },
      };
    }
    
    // If name is being updated, sync to Java Auth first
    if (updates.name || updates.fullName) {
      const nameToSync = updates.name || updates.fullName;
      console.log(`🔄 [ProfileService] Syncing name to Java Auth: ${nameToSync}`);
      
      const javaAuthResult = await updateJavaAuthProfile({ fullName: nameToSync });
      
      if (!javaAuthResult.success) {
        console.warn('⚠️ [ProfileService] Failed to sync name to Java Auth:', javaAuthResult.error);
        // Continue with MongoDB update even if Java Auth fails (non-blocking)
      } else {
        console.log('✅ [ProfileService] Name synced to Java Auth');
      }
    }
    
    // If phone is being updated, sync to Java Auth
    if (updates.phone || updates.phoneNumber) {
      const phoneToSync = updates.phone || updates.phoneNumber;
      console.log(`🔄 [ProfileService] Syncing phone to Java Auth: ${phoneToSync}`);
      
      const javaAuthResult = await updateJavaAuthProfile({ phoneNumber: phoneToSync });
      
      if (!javaAuthResult.success) {
        console.warn('⚠️ [ProfileService] Failed to sync phone to Java Auth:', javaAuthResult.error);
        // Continue with MongoDB update even if Java Auth fails (non-blocking)
      } else {
        console.log('✅ [ProfileService] Phone synced to Java Auth');
      }
    }
    
    const response = await apiClient.put(`${ENDPOINTS.PROFILE.UPDATE_USER}/${userId}`, updates);
    
    console.log('✅ [ProfileService] User profile updated:', response.data);
    
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    console.error('❌ [ProfileService] Update user profile failed:', error.message);
    const parsedError = parseApiError(error);
    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== UPDATE PROVIDER ONLINE STATUS ====================

/**
 * Update provider online/availability status
 * 
 * @param {string} providerId - MongoDB provider _id
 * @param {boolean} isOnline - Online status
 * @returns {Promise<Object>} Updated status
 */
export const updateProviderOnlineStatus = async (providerId, isOnline) => {
  try {
    console.log(`🟢 [ProfileService] Updating provider online status: ${providerId} -> ${isOnline}`);
    
    if (!providerId) {
      return {
        success: false,
        error: { message: 'Provider ID is required', code: 'MISSING_PROVIDER_ID' },
      };
    }
    
    const response = await apiClient.patch(
      `${ENDPOINTS.PROFILE.UPDATE_PROVIDER_ONLINE}/${providerId}/online`,
      { isOnline }
    );
    
    console.log('✅ [ProfileService] Provider online status updated:', response.data);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('❌ [ProfileService] Update provider online status failed:', error.message);
    const parsedError = parseApiError(error);
    return {
      success: false,
      error: parsedError,
    };
  }
};

// ==================== COMBINED PROFILE FETCH ====================

/**
 * Fetch full user data from both Java Auth and MongoDB
 * Java Auth provides verification status, MongoDB provides business data
 * 
 * @param {string} userType - 'user' or 'provider'
 * @param {string} mongoId - MongoDB document _id
 * @returns {Promise<Object>} Combined profile data
 */
export const fetchFullProfile = async (userType, mongoId) => {
  try {
    console.log(`📋 [ProfileService] Fetching full profile for ${userType}...`);
    
    // Fetch from Java Auth (verification status) - always works with our tokens
    const javaAuthResult = await getCurrentUser();
    
    // Fetch from MongoDB based on user type
    // Note: User profile may fail auth if JWT secrets don't match
    let mongoResult = { success: false, data: {} };
    if (userType === 'provider') {
      // Provider profile endpoint has no auth middleware
      mongoResult = await getProviderProfile(mongoId);
    } else if (mongoId) {
      // User profile requires auth - may fail if JWT secrets don't match
      mongoResult = await getUserProfile(mongoId);
    }
    
    // As long as Java Auth worked, we have core profile data
    if (!javaAuthResult.success) {
      return {
        success: false,
        error: { 
          message: 'Failed to fetch profile from auth service',
          javaAuthError: javaAuthResult.error,
        },
      };
    }
    
    // Combine data - Java Auth for core data, MongoDB for extended business data
    const javaAuthData = javaAuthResult.data || {};
    const mongoData = mongoResult.success ? (mongoResult.data || {}) : {};
    
    const combinedProfile = {
      // Java Auth data (core profile + verification status)
      javaUserId: javaAuthData.userId,
      isEmailVerified: javaAuthData.isEmailVerified ?? false,
      isPhoneVerified: javaAuthData.isPhoneVerified ?? false,
      isActive: javaAuthData.isActive ?? true,
      role: javaAuthData.role,
      lastLoginAt: javaAuthData.lastLoginAt,
      
      // Core identity - for providers, MongoDB name takes precedence (where profile is updated)
      email: javaAuthData.email || mongoData.email,
      fullName: userType === 'provider' 
        ? (mongoData.name || mongoData.fullName || javaAuthData.fullName)
        : (javaAuthData.fullName || mongoData.fullName || mongoData.name),
      phone: javaAuthData.phoneNumber || mongoData.phone,
      
      // MongoDB data (extended business data)
      mongoId: mongoData._id || mongoId,
      address: mongoData.address || '',
      city: mongoData.city || '',
      pincode: mongoData.pincode || '',
      
      // User-specific fields (from MongoDB if available)
      ...(userType === 'user' && {
        emergencyContact: mongoData.emergencyContact || '',
        preferences: mongoData.preferences || {},
        stats: mongoData.stats || {},
      }),
      
      // Provider-specific fields (from MongoDB if available)
      ...(userType === 'provider' && {
        serviceCategories: mongoData.serviceCategories || [],
        serviceTypes: mongoData.serviceTypes || [],
        experience: mongoData.experience || '',
        rating: mongoData.rating || 0,
        ratings: mongoData.ratings || {},
        isAvailable: mongoData.isAvailable ?? true,
        isOnline: mongoData.isOnline ?? false,
        availability: mongoData.availability || {},
        verification: mongoData.verification || {},
        location: mongoData.location || {},
        locationTracking: mongoData.locationTracking || { enabled: false },
        currentLocation: mongoData.currentLocation || {},
        stats: mongoData.stats || {},
      }),
      
      // Timestamps
      createdAt: javaAuthData.createdAt || mongoData.createdAt,
      updatedAt: javaAuthData.updatedAt || mongoData.updatedAt,
      
      // Metadata
      mongoProfileLoaded: mongoResult.success,
    };
    
    console.log('✅ [ProfileService] Full profile combined:', combinedProfile);
    
    return {
      success: true,
      data: combinedProfile,
      rawJavaAuth: javaAuthData,
      rawMongo: mongoData,
    };
  } catch (error) {
    console.error('❌ [ProfileService] Fetch full profile failed:', error);
    return {
      success: false,
      error: { message: error.message, code: 'PROFILE_FETCH_FAILED' },
    };
  }
};

// ==================== UPDATE PROVIDER PROFILE ====================

/**
 * Update provider profile in MongoDB
 * Also syncs name changes to Java Auth (PostgreSQL) for consistency
 * 
 * @param {string} providerId - MongoDB provider _id
 * @param {Object} updates - Profile updates (name, phone, serviceCategories, experience)
 * @returns {Promise<Object>} Updated profile data
 */
export const updateProviderProfile = async (providerId, updates) => {
  try {
    console.log(`📝 [ProfileService] Updating provider profile: ${providerId}`, updates);
    
    if (!providerId) {
      return {
        success: false,
        error: { message: 'Provider ID is required', code: 'MISSING_PROVIDER_ID' },
      };
    }
    
    // If name is being updated, sync to Java Auth first
    if (updates.name || updates.fullName) {
      const nameToSync = updates.name || updates.fullName;
      console.log(`🔄 [ProfileService] Syncing name to Java Auth: ${nameToSync}`);
      
      const javaAuthResult = await updateJavaAuthProfile({ fullName: nameToSync });
      
      if (!javaAuthResult.success) {
        console.warn('⚠️ [ProfileService] Failed to sync name to Java Auth:', javaAuthResult.error);
        // Continue with MongoDB update even if Java Auth fails (non-blocking)
      } else {
        console.log('✅ [ProfileService] Name synced to Java Auth');
      }
    }
    
    // If phone is being updated, sync to Java Auth
    if (updates.phone) {
      console.log(`🔄 [ProfileService] Syncing phone to Java Auth: ${updates.phone}`);
      
      const javaAuthResult = await updateJavaAuthProfile({ phoneNumber: updates.phone });
      
      if (!javaAuthResult.success) {
        console.warn('⚠️ [ProfileService] Failed to sync phone to Java Auth:', javaAuthResult.error);
        // Continue with MongoDB update even if Java Auth fails (non-blocking)
      } else {
        console.log('✅ [ProfileService] Phone synced to Java Auth');
      }
    }
    
    // Update MongoDB
    const response = await apiClient.put(ENDPOINTS.PROFILE.UPDATE_PROVIDER, {
      providerId,
      ...updates,
    });
    
    console.log('✅ [ProfileService] Provider profile updated:', response.data);
    
    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    console.error('❌ [ProfileService] Update provider profile failed:', error.message);
    const parsedError = parseApiError(error);
    return {
      success: false,
      error: parsedError,
    };
  }
};

export default {
  getCurrentUser,
  getUserProfile,
  getProviderProfile,
  updateUserProfile,
  updateProviderProfile,
  updateProviderOnlineStatus,
  updateJavaAuthProfile,
  fetchFullProfile,
};
