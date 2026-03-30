/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
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
]);

AppRegistry.registerComponent(appName, () => App);
