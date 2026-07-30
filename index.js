/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';

// ── Suppress Mapbox "view: null" crashes ─────────────────────────────────
// Known @rnmapbox/maps issue: native MapView is destroyed during navigation
// but the JS bridge still holds a stale reference. This triggers an unhandled
// promise rejection that crashes the app. Safe to swallow — purely cosmetic.

// 1. Synchronous errors
const originalHandler = global.ErrorUtils?.getGlobalHandler();
global.ErrorUtils?.setGlobalHandler((error, isFatal) => {
  const msg = error?.message || String(error);
  if (msg.includes('view: null found with tag') || msg.includes('ViewTagResolver')) {
    return;
  }
  if (originalHandler) originalHandler(error, isFatal);
});

// 2. Unhandled promise rejections (the actual crash path for this Mapbox bug)
const originalRejectionHandler = global.ErrorUtils?.getGlobalHandler();
const patchRejectionTracking = () => {
  try {
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.disable();
    tracking.enable({
      allRejections: true,
      onUnhandled: (id, error) => {
        const msg = error?.message || String(error);
        if (msg.includes('view: null found with tag') || msg.includes('ViewTagResolver')) {
          return; // Swallow Mapbox view lifecycle rejection
        }
        // Default RN behavior: report as error
        const { ExceptionsManager } = require('react-native');
        if (ExceptionsManager) {
          ExceptionsManager.handleException(error, false);
        }
      },
      onHandled: () => {},
    });
  } catch {
    // Fallback: if promise tracking module isn't available, do nothing
  }
};
patchRejectionTracking();

import App from './App';
import { name as appName } from './app.json';
import { setupBackgroundMessageHandler } from './src/services/fcmService';
import BackgroundGeolocation from 'react-native-background-geolocation';

// Register FCM background message handler BEFORE AppRegistry
// This MUST be called at the top level (not inside a component)
// so that background/quit-state push notifications are received.
setupBackgroundMessageHandler();

// Register TransistorSoft headless task for Android killed-state tracking.
// When the app is killed, Android runs this task in a bare JS context —
// no React tree, no components. TransistorSoft handles the HTTP POST
// automatically; this registration is required for the headless service
// to start. Keep it minimal — heavy work here drains battery.
BackgroundGeolocation.registerHeadlessTask(async (event) => {
  const { name, params } = event;
  switch (name) {
    case 'location':
      // TransistorSoft auto-posts this to our backend via HTTP config.
      // Nothing to do here — the HTTP sync is config-driven.
      console.log('[Headless] Location received');
      break;
    case 'http':
      // Log non-200 responses for debugging
      if (params.response?.status !== 200) {
        console.log('[Headless] HTTP:', params.response?.status);
      }
      break;
    case 'authorization':
      // TransistorSoft refreshed the token NATIVELY while the app was killed.
      // CRITICAL: persist the rotated pair. jauth refresh tokens are
      // SINGLE-USE (rotated on every refresh) — logging only, as before, left
      // the Keychain holding an already-burned refresh token, so the next app
      // launch 401'd definitively and logged the provider out ("logged out
      // after some days"). Mirrors backgroundLocationService's foreground
      // onAuthorization sync-back.
      if (params.success && params.response) {
        try {
          // Both-halves guard lives in storeRotatedTokenPair (shared with the
          // foreground onAuthorization handler in backgroundLocationService).
          const { storeRotatedTokenPair } = require('./src/utils/storage');
          const stored = await storeRotatedTokenPair(params.response);
          console.log(stored
            ? '[Headless] Token refresh persisted to Keychain'
            : '[Headless] Token refresh payload incomplete — kept existing pair');
        } catch (e) {
          console.warn('[Headless] Failed to persist refreshed tokens:', e?.message);
        }
      } else {
        console.log('[Headless] Token refresh: FAILED');
      }
      break;
    case 'terminate':
      // App was terminated — tracking continues via headless service
      console.log('[Headless] App terminated, tracking continues');
      break;
  }
});

// Suppress known @rnmapbox/maps NativeEventEmitter warning
// This is a library-level issue — the locationManager module creates a
// NativeEventEmitter at import time before addListener/removeListeners
// can be patched. Safe to ignore.
LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
  'Unknown reactTag',
  'PointAnnotation supports max 1 subview',
  'view: null found with tag',
  'ViewTagResolver',
]);

AppRegistry.registerComponent(appName, () => App);
