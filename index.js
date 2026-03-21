/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { setupBackgroundMessageHandler } from './src/services/fcmService';

// Register FCM background message handler BEFORE AppRegistry
// This MUST be called at the top level (not inside a component)
// so that background/quit-state push notifications are received.
setupBackgroundMessageHandler();

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
