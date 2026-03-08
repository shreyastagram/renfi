/**
 * Address Service
 * 
 * Frontend service for managing saved addresses
 * Like Ola/Uber address management
 * 
 * @version 1.0.0
 */

import { ENDPOINTS, getNodeBackendUrl } from '../config/api';
import { authFetch } from '../utils/authFetch';
import { getTokens } from '../utils/storage';

const API_BASE_URL = getNodeBackendUrl();

/**
 * Get auth headers with JWT token from secure storage (Keychain)
 */
const getAuthHeaders = async () => {
  const tokens = await getTokens();
  const token = tokens?.accessToken;
  if (!token) {
    console.warn('[AddressService] No auth token available');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

/**
 * Get all saved addresses for a user
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<Array>} Array of saved addresses
 */
export const getSavedAddresses = async (userId) => {
  try {
    const headers = await getAuthHeaders();
    const response = await authFetch(
      `${API_BASE_URL}${ENDPOINTS.ADDRESS.GET_ALL}/${userId}`,
      {
        method: 'GET',
        headers
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get addresses');
    }
    
    return {
      success: true,
      addresses: data.data || [],
      count: data.count || 0
    };
  } catch (error) {
    console.error('[AddressService] Get addresses error:', error);
    return {
      success: false,
      error: error.message,
      addresses: []
    };
  }
};

/**
 * Add a new address
 * @param {string} userId - MongoDB user ID
 * @param {Object} addressData - Address details
 * @returns {Promise<Object>} Created address
 */
export const addAddress = async (userId, addressData) => {
  try {
    const headers = await getAuthHeaders();
    const response = await authFetch(
      `${API_BASE_URL}${ENDPOINTS.ADDRESS.ADD}/${userId}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(addressData)
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to add address');
    }
    
    return {
      success: true,
      address: data.data
    };
  } catch (error) {
    console.error('[AddressService] Add address error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update an existing address
 * @param {string} userId - MongoDB user ID
 * @param {string} addressId - Address ID to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated address
 */
export const updateAddress = async (userId, addressId, updates) => {
  try {
    const headers = await getAuthHeaders();
    const response = await authFetch(
      `${API_BASE_URL}${ENDPOINTS.ADDRESS.UPDATE}/${userId}/${addressId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update address');
    }
    
    return {
      success: true,
      address: data.data
    };
  } catch (error) {
    console.error('[AddressService] Update address error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete an address
 * @param {string} userId - MongoDB user ID
 * @param {string} addressId - Address ID to delete
 * @returns {Promise<Object>} Success status
 */
export const deleteAddress = async (userId, addressId) => {
  try {
    const headers = await getAuthHeaders();
    const response = await authFetch(
      `${API_BASE_URL}${ENDPOINTS.ADDRESS.DELETE}/${userId}/${addressId}`,
      {
        method: 'DELETE',
        headers
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete address');
    }
    
    return {
      success: true,
      message: data.message
    };
  } catch (error) {
    console.error('[AddressService] Delete address error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Set an address as default
 * @param {string} userId - MongoDB user ID
 * @param {string} addressId - Address ID to set as default
 * @returns {Promise<Object>} Default address
 */
export const setDefaultAddress = async (userId, addressId) => {
  try {
    const headers = await getAuthHeaders();
    const response = await authFetch(
      `${API_BASE_URL}${ENDPOINTS.ADDRESS.SET_DEFAULT}/${userId}/${addressId}/default`,
      {
        method: 'PUT',
        headers
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to set default address');
    }
    
    return {
      success: true,
      address: data.data
    };
  } catch (error) {
    console.error('[AddressService] Set default error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get the default address for a user
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<Object|null>} Default address or null
 */
export const getDefaultAddress = async (userId) => {
  try {
    const result = await getSavedAddresses(userId);
    if (!result.success) {
      return null;
    }
    
    const defaultAddr = result.addresses.find(addr => addr.isDefault);
    return defaultAddr || result.addresses[0] || null;
  } catch (error) {
    console.error('[AddressService] Get default address error:', error);
    return null;
  }
};

/**
 * Format address for display (short version)
 * @param {Object} address - Address object
 * @returns {string} Formatted short address
 */
export const formatShortAddress = (address) => {
  if (!address) return 'No address';
  if (address.shortAddress) return address.shortAddress;
  
  const parts = [address.addressLine1, address.landmark, address.city].filter(Boolean);
  return parts.slice(0, 2).join(', ') || 'No address';
};

/**
 * Format address for display (full version)
 * @param {Object} address - Address object
 * @returns {string} Formatted full address
 */
export const formatFullAddress = (address) => {
  if (!address) return 'No address';
  if (address.formattedAddress) return address.formattedAddress;
  
  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.landmark,
    address.city,
    address.state,
    address.pincode
  ].filter(Boolean);
  
  return parts.join(', ') || 'No address';
};

/**
 * Get address label with icon
 * @param {string} label - Address label type
 * @param {string} customLabel - Custom label if type is 'other'
 * @returns {Object} Label with icon name
 */
export const getAddressLabel = (label, customLabel = '') => {
  const labels = {
    home: { icon: 'home', text: 'Home' },
    work: { icon: 'work', text: 'Work' },
    other: { icon: 'location-on', text: customLabel || 'Other' }
  };
  
  return labels[label] || labels.other;
};

export default {
  getSavedAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress,
  formatShortAddress,
  formatFullAddress,
  getAddressLabel
};
