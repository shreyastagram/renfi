/**
 * Socket Service
 * 
 * Handles real-time communication with the backend via Socket.IO
 * - Provider location updates
 * - Request status updates
 * - Real-time notifications
 * 
 * @version 1.0.0
 */

import { io } from 'socket.io-client';
import { NODE_BASE_URL } from '../config/api';
import Geolocation from '@react-native-community/geolocation';

// Socket instance
let socket = null;
let locationWatchId = null;
let locationUpdateInterval = null;

// Listeners registry
const listeners = new Map();

// Track subscribed request rooms for re-join on reconnect
const subscribedRooms = new Set();

/**
 * Socket Service Configuration
 */
const SOCKET_CONFIG = {
  // How often to send location updates (in milliseconds)
  LOCATION_UPDATE_INTERVAL: 10000, // 10 seconds
  // High accuracy for GPS
  GEOLOCATION_OPTIONS: {
    enableHighAccuracy: true,
    timeout: 30000, // 30 seconds (increased from 15)
    maximumAge: 10000, // 10 seconds cache
  },
  // Low accuracy fallback when high accuracy times out
  GEOLOCATION_OPTIONS_LOW_ACCURACY: {
    enableHighAccuracy: false,
    timeout: 20000, // 20 seconds
    maximumAge: 60000, // 1 minute cache
  },
};

/**
 * Initialize socket connection
 * 
 * @param {string} userType - 'user' or 'provider'
 * @param {string} userId - User or Provider MongoDB ID
 * @param {string} token - JWT token for authentication
 * @returns {Object} Socket instance
 */
export const initializeSocket = (userType, userId, token) => {
  if (socket?.connected) {
    console.log('🔌 [Socket] Already connected');
    return socket;
  }

  console.log(`🔌 [Socket] Initializing socket for ${userType}: ${userId}`);

  socket = io(NODE_BASE_URL, {
    transports: ['websocket'],
    auth: {
      token,
      userType,
      userId,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  // Connection event handlers
  socket.on('connect', () => {
    console.log('✅ [Socket] Connected:', socket.id);
    
    // Register based on user type
    if (userType === 'provider') {
      socket.emit('provider:register', { providerId: userId });
    } else {
      socket.emit('user:register', { userId });
    }

    // Re-join any request rooms we were subscribed to before disconnect
    if (subscribedRooms.size > 0) {
      console.log(`📡 [Socket] Re-joining ${subscribedRooms.size} request rooms after reconnect`);
      subscribedRooms.forEach((requestId) => {
        socket.emit('request:subscribe', { requestId });
      });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ [Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ [Socket] Connection error:', error.message);
  });

  socket.on('error', (error) => {
    console.error('❌ [Socket] Error:', error);
  });

  // Provider-specific events
  if (userType === 'provider') {
    socket.on('provider:registered', (data) => {
      console.log('✅ [Socket] Provider registered:', data);
    });

    socket.on('new:request', (data) => {
      console.log('📦 [Socket] New request received:', data);
      notifyListeners('new:request', data);
    });
  }

  // User-specific events
  if (userType === 'user') {
    socket.on('user:registered', (data) => {
      console.log('✅ [Socket] User registered:', data);
    });

    socket.on('provider:assigned', (data) => {
      console.log('👤 [Socket] Provider assigned:', data);
      notifyListeners('provider:assigned', data);
    });

    socket.on('provider:location', (data) => {
      console.log('📍 [Socket] Provider location update:', data);
      notifyListeners('provider:location', data);
    });
  }

  // ─── Universal status events (both user & provider must receive) ───
  socket.on('request:accepted', (data) => {
    console.log('✅ [Socket] Request accepted:', data);
    notifyListeners('request:accepted', data);
  });

  socket.on('request:completed', (data) => {
    console.log('🎉 [Socket] Request completed:', data);
    notifyListeners('request:completed', data);
  });

  socket.on('request:cancelled', (data) => {
    console.log('❌ [Socket] Request cancelled:', data);
    notifyListeners('request:cancelled', data);
  });

  socket.on('request:status', (data) => {
    console.log('📊 [Socket] Request status update:', data);
    notifyListeners('request:status', data);
  });

  return socket;
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    console.log('🔌 [Socket] Disconnecting...');
    stopLocationTracking();
    subscribedRooms.clear();
    socket.disconnect();
    socket = null;
  }
};

/**
 * Get socket instance
 */
export const getSocket = () => socket;

/**
 * Check if socket is connected
 */
export const isConnected = () => socket?.connected ?? false;

// ==================== PROVIDER LOCATION TRACKING ====================

/**
 * Start sending location updates (for providers)
 * Works with or without socket connection - uses REST API as fallback
 * 
 * @param {string} providerId - Provider MongoDB ID
 */
export const startLocationTracking = (providerId) => {
  if (!providerId) {
    console.warn('⚠️ [Socket] Cannot start location tracking - no providerId');
    return;
  }

  console.log('📍 [Socket] Starting location tracking for provider:', providerId);

  // Clear any existing tracking
  stopLocationTracking();

  // Get initial position immediately with fallback
  const getInitialPosition = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ [Socket] Got initial position (high accuracy)');
        sendLocationUpdate(providerId, position.coords);
      },
      (error) => {
        console.warn('⚠️ [Socket] High accuracy failed, trying low accuracy:', error.message);
        // Fallback to low accuracy
        Geolocation.getCurrentPosition(
          (position) => {
            console.log('✅ [Socket] Got initial position (low accuracy)');
            sendLocationUpdate(providerId, position.coords);
          },
          (fallbackError) => {
            console.error('❌ [Socket] Location unavailable:', fallbackError.message);
          },
          SOCKET_CONFIG.GEOLOCATION_OPTIONS_LOW_ACCURACY
        );
      },
      SOCKET_CONFIG.GEOLOCATION_OPTIONS
    );
  };
  
  getInitialPosition();

  // Watch position changes
  locationWatchId = Geolocation.watchPosition(
    (position) => {
      sendLocationUpdate(providerId, position.coords);
    },
    (error) => {
      console.error('❌ [Socket] Location watch error:', error);
    },
    SOCKET_CONFIG.GEOLOCATION_OPTIONS
  );

  // Also send updates at regular intervals with fallback
  locationUpdateInterval = setInterval(() => {
    Geolocation.getCurrentPosition(
      (position) => {
        sendLocationUpdate(providerId, position.coords);
      },
      (error) => {
        // Silently try low accuracy on interval errors
        Geolocation.getCurrentPosition(
          (position) => {
            sendLocationUpdate(providerId, position.coords);
          },
          (fallbackError) => {
            // Only log if both fail
            console.warn('⚠️ [Socket] Interval location unavailable');
          },
          SOCKET_CONFIG.GEOLOCATION_OPTIONS_LOW_ACCURACY
        );
      },
      SOCKET_CONFIG.GEOLOCATION_OPTIONS
    );
  }, SOCKET_CONFIG.LOCATION_UPDATE_INTERVAL);
};

/**
 * Stop sending location updates
 */
export const stopLocationTracking = () => {
  if (locationWatchId !== null) {
    Geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
    console.log('📍 [Socket] Location watch stopped');
  }

  if (locationUpdateInterval) {
    clearInterval(locationUpdateInterval);
    locationUpdateInterval = null;
    console.log('📍 [Socket] Location interval stopped');
  }
};

/**
 * Send location update to server
 * Uses both socket (for real-time) and REST API (for persistence)
 */
const sendLocationUpdate = async (providerId, coords) => {
  const locationData = {
    providerId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    timestamp: new Date().toISOString(),
  };

  // Send via socket for real-time updates
  if (socket?.connected) {
    socket.emit('provider:location:update', locationData);
  }

  // Also persist via REST API
  try {
    const { NODE_BASE_URL } = require('../config/api');
    await fetch(`${NODE_BASE_URL}/api/auth/provider/location`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providerId,
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
    });
  } catch (error) {
    // Silent fail for REST - socket is primary
    console.log('📍 [Socket] REST location update failed:', error.message);
  }

  console.log('📍 [Socket] Location sent:', locationData.latitude, locationData.longitude);
};

// ==================== REQUEST EVENTS ====================

/**
 * Subscribe to request updates for a user
 * 
 * @param {string} requestId - Request ID to subscribe to
 */
export const subscribeToRequest = (requestId) => {
  if (!requestId) return;

  // Always track even if not connected — will re-join on connect
  subscribedRooms.add(requestId);

  if (!socket?.connected) {
    console.warn('⚠️ [Socket] Not connected — room queued for reconnect');
    return;
  }

  socket.emit('request:subscribe', { requestId });
  console.log('📡 [Socket] Subscribed to request:', requestId);
};

/**
 * Unsubscribe from request updates
 * 
 * @param {string} requestId - Request ID to unsubscribe from
 */
export const unsubscribeFromRequest = (requestId) => {
  if (!requestId) return;

  subscribedRooms.delete(requestId);

  if (!socket?.connected) return;

  socket.emit('request:unsubscribe', { requestId });
  console.log('📡 [Socket] Unsubscribed from request:', requestId);
};

// ==================== EVENT LISTENERS ====================

/**
 * Add event listener
 * 
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 * @returns {Function} Cleanup function
 */
export const addEventListener = (event, callback) => {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);

  // Return cleanup function
  return () => {
    listeners.get(event)?.delete(callback);
  };
};

/**
 * Remove event listener
 * 
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 */
export const removeEventListener = (event, callback) => {
  listeners.get(event)?.delete(callback);
};

/**
 * Notify all listeners for an event
 */
const notifyListeners = (event, data) => {
  const eventListeners = listeners.get(event);
  if (eventListeners) {
    eventListeners.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`❌ [Socket] Listener error for ${event}:`, error);
      }
    });
  }
};

// ==================== EXPORTS ====================

export default {
  initializeSocket,
  disconnectSocket,
  getSocket,
  isConnected,
  startLocationTracking,
  stopLocationTracking,
  subscribeToRequest,
  unsubscribeFromRequest,
  addEventListener,
  removeEventListener,
};
