/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Suppress known @rnmapbox/maps NativeEventEmitter warning
// This is a library-level issue — the locationManager module creates a
// NativeEventEmitter at import time before addListener/removeListeners
// can be patched. Safe to ignore.
LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
]);

AppRegistry.registerComponent(appName, () => App);
