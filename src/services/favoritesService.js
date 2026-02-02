/**
 * Favorites Service
 * Handles adding/removing favorite providers for users
 * 
 * @version 1.0.0
 */

import { NODE_BASE_URL } from '../config/api';

const API_BASE = `${NODE_BASE_URL}/api/favorites`;

/**
 * Add a provider to favorites
 * @param {string} userId - User ID
 * @param {string} providerId - Provider ID
 * @param {string} serviceCategory - Service category (e.g., 'electrician')
 * @param {string} notes - Optional notes about the provider
 * @returns {Promise<Object>}
 */
export const addToFavorites = async (userId, providerId, serviceCategory, notes = '') => {
  try {
    const response = await fetch(`${API_BASE}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        providerId,
        serviceCategory,
        notes
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to add to favorites');
    }

    return {
      success: true,
      message: data.message,
      data: data.data
    };
  } catch (error) {
    console.error('[Favorites] Add error:', error);
    return {
      success: false,
      error: error.message || 'Failed to add to favorites'
    };
  }
};

/**
 * Remove a provider from favorites
 * @param {string} userId - User ID
 * @param {string} providerId - Provider ID
 * @param {string} serviceCategory - Optional: remove only for specific service
 * @returns {Promise<Object>}
 */
export const removeFromFavorites = async (userId, providerId, serviceCategory = null) => {
  try {
    const body = { userId, providerId };
    if (serviceCategory) {
      body.serviceCategory = serviceCategory;
    }

    const response = await fetch(`${API_BASE}/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to remove from favorites');
    }

    return {
      success: true,
      message: data.message
    };
  } catch (error) {
    console.error('[Favorites] Remove error:', error);
    return {
      success: false,
      error: error.message || 'Failed to remove from favorites'
    };
  }
};

/**
 * Get user's favorite providers
 * @param {string} userId - User ID
 * @param {string} serviceCategory - Optional: filter by service category
 * @returns {Promise<Object>}
 */
export const getFavorites = async (userId, serviceCategory = null) => {
  try {
    let url = `${API_BASE}/${userId}`;
    if (serviceCategory) {
      url += `?serviceCategory=${encodeURIComponent(serviceCategory)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch favorites');
    }

    return {
      success: true,
      count: data.count,
      favorites: data.favorites || []
    };
  } catch (error) {
    console.error('[Favorites] Get error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch favorites',
      favorites: []
    };
  }
};

/**
 * Check if a provider is in favorites
 * @param {string} userId - User ID
 * @param {string} providerId - Provider ID
 * @param {string} serviceCategory - Optional: check for specific service
 * @returns {Promise<Object>}
 */
export const checkIsFavorite = async (userId, providerId, serviceCategory = null) => {
  try {
    let url = `${API_BASE}/check/${userId}/${providerId}`;
    if (serviceCategory) {
      url += `?serviceCategory=${encodeURIComponent(serviceCategory)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to check favorite status');
    }

    return {
      success: true,
      isFavorite: data.isFavorite
    };
  } catch (error) {
    console.error('[Favorites] Check error:', error);
    return {
      success: false,
      error: error.message || 'Failed to check favorite status',
      isFavorite: false
    };
  }
};

/**
 * Toggle favorite status for a provider
 * @param {string} userId - User ID
 * @param {string} providerId - Provider ID
 * @param {string} serviceCategory - Service category
 * @param {boolean} currentStatus - Current favorite status
 * @returns {Promise<Object>}
 */
export const toggleFavorite = async (userId, providerId, serviceCategory, currentStatus) => {
  if (currentStatus) {
    return removeFromFavorites(userId, providerId, serviceCategory);
  } else {
    return addToFavorites(userId, providerId, serviceCategory);
  }
};

export default {
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  checkIsFavorite,
  toggleFavorite
};
