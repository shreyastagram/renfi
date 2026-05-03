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

// LiveKit RN polyfills WebRTC globals — must run before any livekit-client
// import resolves. Safe to call on every platform; iOS is a no-op for the
// demo (we don't ship iOS) but the call itself is harmless.
import { registerGlobals } from '@livekit/react-native';
registerGlobals();

import App from './App';
import { name as appName } from './app.json';
import { setupBackgroundMessageHandler } from './src/services/fcmService';
import { setPendingIncomingCall } from './src/services/callKeepService';
import BackgroundGeolocation from 'react-native-background-geolocation';

// Register FCM background message handler BEFORE AppRegistry
// This MUST be called at the top level (not inside a component)
// so that background/quit-state push notifications are received.
//
// INCOMING_CALL pushes need to wake CallKeep so the lockscreen ring
// shows even if the app is killed. CallKeep setup is idempotent — safe
// to call from both here and App.tsx's foreground init.
setupBackgroundMessageHandler(async (remoteMessage) => {
  const data = remoteMessage?.data || {};
  if (data.type !== 'INCOMING_CALL') return;
  if (!data.callId) return;
  // WhatsApp-style: stash the call payload so when the user taps the
  // FCM heads-up notification (which Android shows from the message's
  // notification block in noefix), App.tsx's onNotificationOpenedApp
  // handler can read it and navigate to the in-app IncomingCallScreen.
  // The native CallKeep ring is intentionally NOT shown here — that
  // looked like a real phone call ("from 123") and registered an
  // unwanted "in call" status with Android's Telecom service.
  try {
    await setPendingIncomingCall({
      callId: data.callId,
      roomName: data.roomName,
      callerId: data.callerId,
      callerName: data.callerName,
      calleeType: data.calleeType,
    });
  } catch (err) {
    console.warn('[FCM bg] INCOMING_CALL handling failed:', err?.message);
  }
});

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
      console.log('[Headless] Token refresh:', params.success ? 'OK' : 'FAILED');
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
