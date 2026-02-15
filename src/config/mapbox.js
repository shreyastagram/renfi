/**
 * Mapbox Configuration
 * 
 * Centralized Mapbox access token management.
 * Loads token with multi-strategy fallback:
 *   1. react-native-config (reads .env)
 *   2. Hardcoded fallback (from .env file contents)
 * 
 * @version 2.0.0 - Robust token loading + lazy init + NativeEventEmitter fix
 */

import Mapbox from '@rnmapbox/maps';

// ============================================
// TOKEN LOADING (multi-strategy)
// ============================================
let MAPBOX_ACCESS_TOKEN = '';

// Strategy 1: Try react-native-config
try {
  const Config = require('react-native-config').default;
  if (Config?.MAPBOX_ACCESS_TOKEN) {
    MAPBOX_ACCESS_TOKEN = Config.MAPBOX_ACCESS_TOKEN;
  }
} catch (e) {
  // react-native-config not installed — use fallback
}

// Strategy 2: Fallback — token must come from .env file
// Do NOT hardcode tokens here — GitHub Push Protection will block the push
if (!MAPBOX_ACCESS_TOKEN) {
  console.warn('⚠️ [Mapbox] No access token found. Create a .env file with MAPBOX_ACCESS_TOKEN=your_token');
}

// ============================================
// INITIALIZATION (lazy, idempotent)
// ============================================
let _initialized = false;

/**
 * Initialize Mapbox with the access token.
 * Safe to call multiple times — only initializes once.
 * Also disables telemetry to prevent NativeEventEmitter warnings.
 */
export const initializeMapbox = () => {
  if (_initialized) return;
  
  if (MAPBOX_ACCESS_TOKEN) {
    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
    
    // Disable telemetry to suppress NativeEventEmitter warnings
    // from Mapbox's locationManager module
    try {
      Mapbox.setTelemetryEnabled(false);
    } catch (e) {
      // Telemetry disable not supported in this SDK version — safe to ignore
    }
    
    _initialized = true;
    console.log('🗺️ [Mapbox] Initialized successfully');
  } else {
    console.warn('🗺️ [Mapbox] WARNING: No access token configured');
  }
};

/**
 * Get the Mapbox access token (for API calls like geocoding)
 */
export const getMapboxAccessToken = () => MAPBOX_ACCESS_TOKEN;

export { MAPBOX_ACCESS_TOKEN };
export default { initializeMapbox, getMapboxAccessToken, MAPBOX_ACCESS_TOKEN };
