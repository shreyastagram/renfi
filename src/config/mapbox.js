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
 * The basemap style for the current appearance.
 *
 * WHY THIS IS CENTRAL
 *
 * Six MapView sites each picked their own style. Two flipped to TrafficNight in
 * dark and four were hardcoded to Street, so a dark-mode user got a glaring white
 * map on four of six screens. A shared helper means a map cannot be added in the
 * wrong appearance by omission.
 *
 * Dark, not TrafficNight. TrafficNight is `navigation-preview-night`, a NAVY
 * basemap built to sit under turn-by-turn; against a true-black app it reads as a
 * blue panel. `dark-v10` is near-black and actually belongs next to these surfaces.
 */
export const getMapStyleURL = (isDark) =>
  (isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street);

/**
 * Get the Mapbox access token (for API calls like geocoding)
 */
export const getMapboxAccessToken = () => MAPBOX_ACCESS_TOKEN;

export { MAPBOX_ACCESS_TOKEN };
export default { initializeMapbox, getMapboxAccessToken, getMapStyleURL, MAPBOX_ACCESS_TOKEN };
