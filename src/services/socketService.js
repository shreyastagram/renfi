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
import { authFetch } from '../utils/authFetch';
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
    // Start with websocket, fall back to polling on iOS network transitions
    transports: ['websocket', 'polling'],
    upgrade: true,
    auth: {
      token,
      userType,
      userId,
    },
    reconnection: true,
    reconnectionAttempts: 60,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
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

    // Re-subscribe rooms for active tracking requests (may not be in subscribedRooms
    // if the detail screen unmounted and removed them)
    if (activeTrackingRequests.size > 0) {
      activeTrackingRequests.forEach((info, reqId) => {
        if (!subscribedRooms.has(reqId)) {
          console.log(`📡 [Socket] Re-subscribing tracking request room: ${reqId}`);
          socket.emit('request:subscribe', { requestId: reqId });
        }
      });
      // Ensure GPS watcher is alive after reconnect
      ensureGpsWatcherRunning();
    }

    // Notify listeners so LocationSharingContext can re-sync
    notifyListeners('__internal:reconnected', {});
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

  // ─── Per-request location events (location sharing system) ─────────
  socket.on('request:provider:location', (data) => {
    console.log('📍 [Socket] Request provider location:', data?.requestId);
    notifyListeners('request:provider:location', data);
  });

  socket.on('request:location:status', (data) => {
    console.log('📍 [Socket] Location sharing status:', data?.requestId, data?.enabled);
    notifyListeners('request:location:status', data);
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
    stopRequestLocationTracking();
    subscribedRooms.clear();
    listeners.clear();
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

// Multi-request location tracking state
// Map<requestId, { providerId, serviceCategory, onLocationUpdate, baseRoute }>
const activeTrackingRequests = new Map();
let requestLocationWatchId = null;
let requestLocationInterval = null;
let lastGpsUpdateTimestamp = null; // Tracks when broadcastRequestLocation last produced a GPS reading

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
    const { NODE_BASE_URL: baseUrl } = require('../config/api');
    await authFetch(`${baseUrl}/api/auth/provider/location`, {
      method: 'PUT',
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

// ==================== PER-REQUEST LOCATION TRACKING ====================

// Minimum distance (meters) before broadcasting — filters GPS noise when stationary
const MIN_BROADCAST_DISTANCE_M = 5;
let lastBroadcastCoords = null;

/**
 * Haversine distance in meters between two lat/lng points.
 */
const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Broadcast a location update to ALL actively tracked requests.
 * Uses one GPS reading → fans out to N socket rooms + REST endpoints.
 * Skips broadcast if provider hasn't moved more than 5m (GPS noise filter).
 */
const broadcastRequestLocation = (coords) => {
  if (activeTrackingRequests.size === 0) return;

  // Validate coordinates before broadcasting
  if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) ||
      coords.latitude < -90 || coords.latitude > 90 ||
      coords.longitude < -180 || coords.longitude > 180) {
    console.warn('⚠️ [Socket] Invalid coordinates, skipping broadcast');
    return;
  }

  // Skip if provider hasn't moved meaningfully (filters GPS jitter when stationary)
  if (lastBroadcastCoords) {
    const dist = haversineMeters(
      lastBroadcastCoords.latitude, lastBroadcastCoords.longitude,
      coords.latitude, coords.longitude,
    );
    if (dist < MIN_BROADCAST_DISTANCE_M) return;
  }
  lastBroadcastCoords = { latitude: coords.latitude, longitude: coords.longitude };

  // Track last successful GPS reading for health checks
  lastGpsUpdateTimestamp = Date.now();

  activeTrackingRequests.forEach((info, reqId) => {
    const locationPayload = {
      requestId: reqId,
      providerId: info.providerId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      timestamp: new Date().toISOString(),
    };

    // Real-time via socket
    if (socket?.connected) {
      socket.emit('request:location:update', locationPayload);
    }

    // Callback for local UI update (if screen is still mounted)
    if (info.onLocationUpdate) {
      info.onLocationUpdate({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      });
    }

    // REST persistence fallback
    try {
      authFetch(`${NODE_BASE_URL}/api/${info.baseRoute}/${reqId}/location-sharing/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: info.providerId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        }),
      }).then(res => {
        if (!res.ok) console.log(`[Socket] REST fallback failed for ${reqId}:`, res.status);
      }).catch(() => {});
    } catch (e) { /* silent */ }
  });

  console.log(`📍 [Socket] Location sent to ${activeTrackingRequests.size} request(s): ${coords.latitude.toFixed(4)} ${coords.longitude.toFixed(4)}`);
};

/**
 * Start or restart the shared GPS watcher + interval.
 * Only one watcher runs at a time regardless of how many requests are tracked.
 */
const ensureGpsWatcherRunning = () => {
  if (requestLocationWatchId !== null) return; // Already running

  console.log('📍 [Socket] Starting shared GPS watcher for request tracking');

  // Get initial position immediately
  Geolocation.getCurrentPosition(
    (position) => broadcastRequestLocation(position.coords),
    (error) => {
      Geolocation.getCurrentPosition(
        (position) => broadcastRequestLocation(position.coords),
        (fallbackError) => console.error('❌ [Socket] Request tracking location unavailable:', fallbackError.message),
        SOCKET_CONFIG.GEOLOCATION_OPTIONS_LOW_ACCURACY
      );
    },
    SOCKET_CONFIG.GEOLOCATION_OPTIONS
  );

  // Watch position changes
  requestLocationWatchId = Geolocation.watchPosition(
    (position) => broadcastRequestLocation(position.coords),
    (error) => console.warn('⚠️ [Socket] Request tracking watch error:', error.message),
    SOCKET_CONFIG.GEOLOCATION_OPTIONS
  );

  // Regular interval heartbeat (10s)
  requestLocationInterval = setInterval(() => {
    Geolocation.getCurrentPosition(
      (position) => broadcastRequestLocation(position.coords),
      (error) => {
        Geolocation.getCurrentPosition(
          (position) => broadcastRequestLocation(position.coords),
          () => {},
          SOCKET_CONFIG.GEOLOCATION_OPTIONS_LOW_ACCURACY
        );
      },
      SOCKET_CONFIG.GEOLOCATION_OPTIONS
    );
  }, SOCKET_CONFIG.LOCATION_UPDATE_INTERVAL);
};

/**
 * Stop the shared GPS watcher (only when no requests remain).
 */
const stopGpsWatcherIfIdle = () => {
  if (activeTrackingRequests.size > 0) return; // Still have active requests

  if (requestLocationWatchId !== null) {
    Geolocation.clearWatch(requestLocationWatchId);
    requestLocationWatchId = null;
  }
  if (requestLocationInterval) {
    clearInterval(requestLocationInterval);
    requestLocationInterval = null;
  }
  console.log('📍 [Socket] Shared GPS watcher stopped (no active requests)');
};

/**
 * Start per-request location tracking (provider sharing for a specific booking).
 * Multiple requests can be tracked concurrently — one shared GPS watcher fans out to all.
 *
 * @param {string} requestId - The service request MongoDB _id
 * @param {string} providerId - Provider MongoDB ID
 * @param {Function} onLocationUpdate - Optional callback with { latitude, longitude, accuracy }
 * @param {string} serviceCategory - 'traditional' | 'event' | 'emergency'
 */
export const startRequestLocationTracking = (requestId, providerId, onLocationUpdate, serviceCategory = 'traditional') => {
  if (!requestId || !providerId) {
    console.warn('⚠️ [Socket] Cannot start request tracking — missing IDs');
    return;
  }

  // Already tracking this request — just update the callback
  if (activeTrackingRequests.has(requestId)) {
    const existing = activeTrackingRequests.get(requestId);
    if (onLocationUpdate) existing.onLocationUpdate = onLocationUpdate;
    console.log(`📍 [Socket] Already tracking ${requestId}, updated callback`);
    return;
  }

  const baseRoute = serviceCategory === 'event' ? 'event-services' : serviceCategory === 'emergency' ? 'emergency-services' : 'traditional-services';

  activeTrackingRequests.set(requestId, {
    providerId,
    serviceCategory,
    baseRoute,
    onLocationUpdate: onLocationUpdate || null,
  });

  console.log(`📍 [Socket] Added request tracking: ${requestId} (${serviceCategory}) — total: ${activeTrackingRequests.size}`);

  // Start the shared GPS watcher if not already running
  ensureGpsWatcherRunning();
};

/**
 * Stop tracking a specific request. If no requests remain, the GPS watcher stops.
 * Call with no args to stop ALL request tracking.
 *
 * @param {string} [requestId] - Stop tracking this specific request. Omit to stop all.
 */
export const stopRequestLocationTracking = (requestId) => {
  if (requestId) {
    // Stop one specific request
    if (activeTrackingRequests.has(requestId)) {
      activeTrackingRequests.delete(requestId);
      console.log(`📍 [Socket] Stopped tracking request: ${requestId} — remaining: ${activeTrackingRequests.size}`);
    }
    stopGpsWatcherIfIdle();
  } else {
    // Stop ALL request tracking
    if (activeTrackingRequests.size > 0) {
      console.log(`📍 [Socket] Stopping all request tracking (${activeTrackingRequests.size} requests)`);
      activeTrackingRequests.clear();
      lastBroadcastCoords = null; // Reset distance filter
    }
    if (requestLocationWatchId !== null) {
      Geolocation.clearWatch(requestLocationWatchId);
      requestLocationWatchId = null;
    }
    if (requestLocationInterval) {
      clearInterval(requestLocationInterval);
      requestLocationInterval = null;
    }
  }
};

/**
 * Check if currently tracking a specific request
 */
export const isTrackingRequest = (requestId) => {
  return activeTrackingRequests.has(requestId);
};

/**
 * Get all currently tracked request IDs
 */
export const getActiveTrackingRequests = () => {
  return [...activeTrackingRequests.keys()];
};

/**
 * Check if the shared GPS watcher is alive (watchId is set + interval is running)
 */
export const isGpsWatcherRunning = () => {
  return requestLocationWatchId !== null && requestLocationInterval !== null;
};

/**
 * Get the timestamp (ms) of the last successful GPS broadcast.
 * Returns null if no broadcast has occurred yet.
 */
export const getLastGpsUpdateTime = () => lastGpsUpdateTimestamp;

/**
 * Force-restart the shared GPS watcher. Clears the existing watcher/interval
 * and starts fresh. Use when a health check detects the watcher has died.
 */
export const restartGpsWatcher = () => {
  if (activeTrackingRequests.size === 0) return;

  // Tear down existing
  if (requestLocationWatchId !== null) {
    Geolocation.clearWatch(requestLocationWatchId);
    requestLocationWatchId = null;
  }
  if (requestLocationInterval) {
    clearInterval(requestLocationInterval);
    requestLocationInterval = null;
  }

  // Small delay before restarting — allows iOS GPS hardware to release the
  // previous watcher cleanly, avoiding permission-denied or stale-fix issues.
  console.log('📍 [Socket] Force-restarting GPS watcher for request tracking');
  setTimeout(() => {
    if (activeTrackingRequests.size > 0) {
      ensureGpsWatcherRunning();
    }
  }, 200);
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
  startRequestLocationTracking,
  stopRequestLocationTracking,
  isTrackingRequest,
  getActiveTrackingRequests,
  isGpsWatcherRunning,
  getLastGpsUpdateTime,
  restartGpsWatcher,
  subscribeToRequest,
  unsubscribeFromRequest,
  addEventListener,
  removeEventListener,
};
