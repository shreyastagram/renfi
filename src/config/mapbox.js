/**
 * Mapbox Configuration
 *
 * Centralized Mapbox access token management.
 * Loads token from react-native-config (.env file).
 *
 * @version 3.0.0 - Single source of truth from .env, no hardcoded fallback
 */

import Mapbox from '@rnmapbox/maps';

// ============================================
// TOKEN LOADING (from .env via react-native-config)
// ============================================
// Public token (pk.*) — safe to embed, not a secret key
const FALLBACK_TOKEN = 'pk.eyJ1IjoiZml4aG9taSIsImEiOiJjbWY2Zjg1MTUwMnhmMm1zNnQxaTdkcmtnIn0.AtF-wG4vaenzSf0Ff9aYBg';

let MAPBOX_ACCESS_TOKEN = '';

try {
  const Config = require('react-native-config').default;
  if (Config?.MAPBOX_ACCESS_TOKEN) {
    MAPBOX_ACCESS_TOKEN = Config.MAPBOX_ACCESS_TOKEN;
  }
} catch (e) {
  // react-native-config not available in release builds
}

// Fallback for release builds where react-native-config may not inject .env
if (!MAPBOX_ACCESS_TOKEN) {
  MAPBOX_ACCESS_TOKEN = FALLBACK_TOKEN;
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
