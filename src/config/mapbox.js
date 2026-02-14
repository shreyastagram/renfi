/**
 * Mapbox Configuration
 * 
 * Centralized Mapbox access token management.
 * The token is loaded from .env file (via react-native-config or fallback).
 * 
 * NEVER hardcode the Mapbox token in source files.
 * 
 * @version 1.0.0
 */

import Mapbox from '@rnmapbox/maps';

// Load token from environment (.env file)
// react-native-config reads from .env automatically
let MAPBOX_ACCESS_TOKEN = '';

try {
  const Config = require('react-native-config').default;
  MAPBOX_ACCESS_TOKEN = Config.MAPBOX_ACCESS_TOKEN || '';
} catch (e) {
  // Fallback: If react-native-config is not available, 
  // the token must be set via Mapbox.setAccessToken() before use
  console.warn('[Mapbox] react-native-config not available, using fallback');
}

/**
 * Initialize Mapbox with the access token from .env
 * Call this once at app startup (e.g., in App.tsx or index.js)
 */
export const initializeMapbox = () => {
  if (MAPBOX_ACCESS_TOKEN) {
    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
    console.log('🗺️ [Mapbox] Initialized with token from .env');
  } else {
    console.error('🗺️ [Mapbox] ERROR: No access token found! Add MAPBOX_ACCESS_TOKEN to .env');
  }
};

/**
 * Get the Mapbox access token (for API calls like geocoding)
 */
export const getMapboxAccessToken = () => {
  if (!MAPBOX_ACCESS_TOKEN) {
    console.error('🗺️ [Mapbox] ERROR: No access token available!');
  }
  return MAPBOX_ACCESS_TOKEN;
};

export { MAPBOX_ACCESS_TOKEN };
export default { initializeMapbox, getMapboxAccessToken, MAPBOX_ACCESS_TOKEN };
