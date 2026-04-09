/**
 * Background Location Service
 *
 * Wraps TransistorSoft react-native-background-geolocation to provide
 * HTTP-based location updates when the app is backgrounded or killed.
 *
 * Architecture:
 * - Foreground: Existing Socket.IO in socketService.js (unchanged)
 * - Background/Killed: This service → HTTP POST → backend → Socket.IO bridge
 * - User's LiveTrackingScreen works identically regardless of transport
 *
 * Token handling:
 * - Tokens are stored in Keychain (not AsyncStorage)
 * - TransistorSoft can't read Keychain directly
 * - We read tokens at start() time and pass them into the config
 * - TransistorSoft's built-in JWT refresh handles renewal automatically
 *   using our /api/auth/refresh endpoint
 *
 * Store compliance:
 * - Tracking ONLY runs during active service requests
 * - stop() is called when all requests complete
 * - No 24/7 tracking — Apple/Google require a legitimate reason
 *
 * @version 1.0.0
 */

import BackgroundGeolocation from 'react-native-background-geolocation';
import { getTokens, storeTokens } from '../utils/storage';
import { NODE_BASE_URL, JAVA_BASE_URL } from '../config/api';

// ── Module state ──
let isConfigured = false;
let isRunning = false;
let isStarting = false; // Lock to prevent concurrent start() calls
let currentProviderId = null;

// Track active requests that need background location
const activeBackgroundRequests = new Set();

// NOTE: autoSync is always true. TransistorSoft HTTP POSTs fire in ALL states
// (foreground, background, killed). In foreground, this means both socket AND
// HTTP deliver locations — the backend rate limiter (1/5s per provider)
// deduplicates. This is intentional: toggling autoSync off in foreground
// risked leaving it off when the app was killed (process killed before
// AppState 'background' fires), breaking killed-state tracking entirely.
// The minor duplicate POST overhead is negligible vs. reliable killed-state tracking.

/**
 * Build the TransistorSoft configuration object.
 *
 * Called once at first start(), then updated via setConfig() if tokens change.
 *
 * @param {string} providerId - Provider's MongoDB _id
 * @param {string} accessToken - Current JWT access token
 * @param {string} refreshToken - Current refresh token
 * @returns {Object} TransistorSoft config
 */
const buildConfig = (providerId, accessToken, refreshToken) => ({
  // Reset persisted state — always apply fresh config on ready()
  // Without this, ready() restores the last state (e.g., enabled: false from a previous stop())
  reset: true,

  // ── HTTP: POST to our unified background location endpoint ──
  url: `${NODE_BASE_URL}/api/provider/location-update`,
  method: 'POST',
  httpRootProperty: '.',
  headers: {
    'Content-Type': 'application/json',
  },

  // ── JWT Authorization: TransistorSoft handles token refresh automatically ──
  // On 401 or token expiry, the SDK POSTs to refreshUrl and extracts new tokens.
  // This works in killed state — critical for long-running background tracking.
  authorization: {
    strategy: 'JWT',
    accessToken,
    refreshToken,
    refreshUrl: `${JAVA_BASE_URL}/api/auth/refresh`,
    refreshPayload: {
      refreshToken: '{refreshToken}',
    },
    refreshHeaders: {
      'Content-Type': 'application/json',
    },
    expires: 86400, // 24h — matches Java Auth token TTL
  },
  // Hand-crafted template — latitude/longitude/accuracy are NUMBERS (no quotes)
  // providerId is interpolated at config time (it's a string MongoDB ID)
  // timestamp is a string (ISO format, needs quotes)
  locationTemplate: `{ "providerId": "${providerId}", "latitude": <%= latitude %>, "longitude": <%= longitude %>, "accuracy": <%= accuracy %>, "timestamp": "<%= timestamp %>", "source": "background" }`,
  autoSync: true,
  batchSync: false,
  maxRecordsToPersist: 100,
  maxDaysToPersist: 1,

  // ── Location accuracy ──
  // 50m distanceFilter: at 60km/h (~17m/s) = one event every ~3s
  // Our backend rate limits to 1/5s — some 429s at highway speed, which is fine
  // At walking speed (5km/h) = one event every ~36s — ideal
  desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
  distanceFilter: 50,
  stopTimeout: 3,
  stationaryRadius: 25,

  // ── Lifecycle ──
  stopOnTerminate: false,
  startOnBoot: true,
  heartbeatInterval: 60,

  // ── Android ──
  foregroundService: true,
  enableHeadless: true,
  notification: {
    title: 'Fixhomi',
    text: 'Sharing your location with the customer',
    channelName: 'Location Tracking',
    sticky: true,
    priority: -1, // PRIORITY_MIN — small icon only, no popup
  },

  // ── iOS ──
  pausesLocationUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,

  // ── Safety ──
  preventSuspend: false,
  // Use accelerometer for motion detection instead of Activity Recognition API.
  // This avoids the physical activity permission prompt and works without it.
  disableMotionActivityUpdates: true,
  disableStopDetection: false,
});

// JWT refresh is handled TWO ways:
// 1. Foreground: apiClient proactive refresh → syncTokensToBackgroundService()
// 2. Background/Killed: TransistorSoft's authorization block auto-refreshes on 401
//    and the onAuthorization listener syncs new tokens back to Keychain.

/**
 * Handle HTTP responses from TransistorSoft.
 *
 * Logs failures for debugging. TransistorSoft handles retry/queue internally.
 * 429 (rate limit) is expected at high speeds — not an error.
 */
const handleHttp = (event) => {
  const { status } = event;
  if (status === 200) return; // Success — silent

  if (status === 429) {
    // Expected when driving fast — TransistorSoft will retry, backend will
    // reject stale locations (>5min), which is the correct behavior
    return;
  }

  if (status === 400) {
    // Expected: stale queued locations rejected by backend (>5min old)
    // This happens after app resumes and TransistorSoft flushes its SQLite queue
    return;
  }

  if (status >= 400) {
    console.warn(`[BGLocation] HTTP ${status}:`, event.responseText?.substring(0, 200));
  }
};

/**
 * Start background location tracking for a specific service request.
 *
 * Reads tokens from Keychain, configures TransistorSoft (once), and starts
 * the background service. Safe to call multiple times — subsequent calls
 * just register the request ID without reconfiguring.
 *
 * @param {string} providerId - Provider's MongoDB _id
 * @param {string} requestId - The service request being tracked
 * @returns {Promise<boolean>} true if started successfully
 */
export const startBackgroundTracking = async (providerId, requestId) => {
  if (!providerId || !requestId) {
    console.warn('[BGLocation] Cannot start — missing providerId or requestId');
    return false;
  }

  // Register this request
  activeBackgroundRequests.add(requestId);

  // If already running for this provider, just register the request
  if (isRunning && currentProviderId === providerId) {
    console.log(`[BGLocation] Already running — added request ${requestId} (total: ${activeBackgroundRequests.size})`);
    return true;
  }

  // Prevent concurrent start() calls (e.g., resumeTracking iterates multiple requests)
  if (isStarting) {
    console.log(`[BGLocation] Start already in progress — queued request ${requestId}`);
    return true; // Request is registered in the Set, will be tracked once start completes
  }

  isStarting = true;
  try {
    // Read tokens from Keychain
    const tokens = await getTokens();
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      console.warn('[BGLocation] Cannot start — no tokens in Keychain');
      activeBackgroundRequests.delete(requestId);
      return false;
    }

    const config = buildConfig(providerId, tokens.accessToken, tokens.refreshToken);

    if (!isConfigured) {
      // First time — full initialization
      const state = await BackgroundGeolocation.ready(config);
      console.log('[BGLocation] Configured — enabled:', state.enabled, 'trackingMode:', state.trackingMode);

      // Register event listeners (once)
      BackgroundGeolocation.onLocation(
        (location) => console.log(`[BGLocation] GPS event: ${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)} | speed: ${location.coords.speed}`),
        (error) => console.warn('[BGLocation] GPS error:', error),
      );
      BackgroundGeolocation.onHttp(handleHttp);
      BackgroundGeolocation.onProviderChange((event) => console.log('[BGLocation] Provider change:', event.enabled, event.status));
      BackgroundGeolocation.onAuthorization(async (event) => {
        if (event.success) {
          // TransistorSoft refreshed the token (background/killed state)
          // Sync new tokens back to Keychain so foreground apiClient uses them too
          const { accessToken: newAccess, refreshToken: newRefresh, expiresIn } = event.response;
          if (newAccess) {
            await storeTokens(newAccess, newRefresh, expiresIn || 86400);
            console.log('[BGLocation] Token auto-refreshed by TransistorSoft — synced to Keychain');
          }
        } else {
          console.warn('[BGLocation] Token refresh failed:', event.error);
        }
      });

      isConfigured = true;

      // If ready() returned enabled:true, the service is already running
      // (survived from previous session via stopOnTerminate:false)
      if (state.enabled) {
        isRunning = true;
        console.log(`[BGLocation] Already running from previous session — tracking ${activeBackgroundRequests.size} request(s)`);
      }
    } else if (currentProviderId !== providerId) {
      // Provider changed (shouldn't happen normally, but handle it)
      await BackgroundGeolocation.setConfig(config);
      console.log('[BGLocation] Config updated for new provider:', providerId);
    } else {
      // Same provider, maybe tokens changed — update authorization config
      await BackgroundGeolocation.setConfig({
        authorization: config.authorization,
      });
    }

    currentProviderId = providerId;

    if (!isRunning) {
      await BackgroundGeolocation.start();
      isRunning = true;
      console.log(`[BGLocation] Started — tracking ${activeBackgroundRequests.size} request(s)`);
    }

    return true;
  } catch (error) {
    console.error('[BGLocation] Start failed:', error.message);
    activeBackgroundRequests.delete(requestId);
    return false;
  } finally {
    isStarting = false;
  }
};

/**
 * Stop tracking a specific service request.
 *
 * If no active requests remain, stops the background service entirely.
 * This is critical for App Store compliance — no tracking without a reason.
 *
 * @param {string} requestId - The request to stop tracking
 */
export const stopBackgroundTrackingForRequest = (requestId) => {
  if (!requestId) return;

  activeBackgroundRequests.delete(requestId);
  console.log(`[BGLocation] Removed request ${requestId} — remaining: ${activeBackgroundRequests.size}`);

  if (activeBackgroundRequests.size === 0) {
    stopAllBackgroundTracking();
  }
};

/**
 * Stop all background location tracking immediately.
 *
 * Called when:
 * - All active requests complete/cancel
 * - Provider logs out
 * - App needs to force-stop tracking
 */
export const stopAllBackgroundTracking = async () => {
  activeBackgroundRequests.clear();

  if (!isRunning) return;

  try {
    await BackgroundGeolocation.stop();
    isRunning = false;
    currentProviderId = null;
    console.log('[BGLocation] Stopped — no active requests');
  } catch (error) {
    console.error('[BGLocation] Stop failed:', error.message);
    isRunning = false;
    currentProviderId = null;
  }
};

/**
 * Check if background tracking is currently active.
 * @returns {boolean}
 */
export const isBackgroundTrackingRunning = () => isRunning;

/**
 * Get count of requests being tracked in background.
 * @returns {number}
 */
export const getBackgroundTrackingCount = () => activeBackgroundRequests.size;

/**
 * Sync fresh tokens into TransistorSoft's authorization config.
 *
 * Call this after a foreground token refresh (e.g., from apiClient)
 * so background HTTP posts use the latest token.
 *
 * @param {string} accessToken - New access token
 * @param {string} refreshToken - New refresh token
 */
export const syncTokensToBackgroundService = async (accessToken, refreshToken) => {
  if (!isConfigured || !isRunning) return;

  try {
    await BackgroundGeolocation.setConfig({
      authorization: {
        strategy: 'JWT',
        accessToken,
        refreshToken,
        refreshUrl: `${JAVA_BASE_URL}/api/auth/refresh`,
        refreshPayload: {
          refreshToken: '{refreshToken}',
        },
        refreshHeaders: {
          'Content-Type': 'application/json',
        },
        expires: 86400,
      },
    });
    console.log('[BGLocation] Token synced from foreground refresh');
  } catch (error) {
    console.error('[BGLocation] Token sync failed:', error.message);
  }
};
