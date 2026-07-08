/**
 * App Version — single source of truth for the displayed build version.
 *
 * Reads the REAL native versionName/versionCode baked into the binary via
 * react-native-device-info (already a dependency). Never hardcode the version
 * in UI — always call these helpers so every screen stays in sync with the
 * actual store build.
 *
 * NOTE: package.json "version" (0.0.1) is NOT the app version. The real value
 * comes from android/app/build.gradle `versionName` and iOS CFBundleShortVersionString.
 *
 * All getters are defensive: if react-native-device-info is unavailable (e.g.
 * native module not linked in some build), they default to '' instead of
 * throwing, so a footer/splash render can never crash the app.
 */

import DeviceInfo from 'react-native-device-info';

/** Marketing version string, e.g. "1.0.5" (Android versionName / iOS short version). */
export const getAppVersion = () => {
  try {
    return DeviceInfo.getVersion() || '';
  } catch (e) {
    return '';
  }
};

/** Build number, e.g. "12" (Android versionCode / iOS CFBundleVersion). */
export const getAppBuildNumber = () => {
  try {
    return DeviceInfo.getBuildNumber() || '';
  } catch (e) {
    return '';
  }
};

/** Convenience: "v1.0.5" for footers/labels. Returns '' if version is unavailable. */
export const getAppVersionLabel = () => {
  const version = getAppVersion();
  return version ? `v${version}` : '';
};
