/**
 * SINGLE SOURCE OF TRUTH for raw Android location-permission calls.
 *
 * The FINE/COARSE semantics live here and nowhere else: on Android 12+/MIUI
 * the system dialog offers "Precise / Approximate" — Approximate grants
 * COARSE only, and that MUST count as granted (a coarse fix beats a
 * permission nag; FINE-only checks read approximate users as denied forever,
 * the "Enable location while GPS is ON" bug).
 *
 * Consumers: LocationContext (canonical state owner), UserHomeScreen's local
 * permission bar, MapView/LocationMap. Do not duplicate these checks inline.
 */
import { PermissionsAndroid, Platform } from 'react-native';

const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

/**
 * Silent check. @returns {{granted: boolean, fine: boolean}}
 */
export const checkAndroidLocationGranted = async () => {
  if (Platform.OS !== 'android') return { granted: true, fine: true };
  const fine = await PermissionsAndroid.check(FINE);
  if (fine) return { granted: true, fine: true };
  const coarse = await PermissionsAndroid.check(COARSE);
  return { granted: !!coarse, fine: false };
};

/**
 * Show the system dialog (both accuracies requested so "Approximate" works).
 * `blocked` is true when the dialog will never show again — Android 12+
 * decouples the two denial states, so EITHER being never_ask_again means the
 * only remedy is Settings.
 * @returns {{granted: boolean, fine: boolean, blocked: boolean}}
 */
export const requestAndroidLocationPermission = async () => {
  if (Platform.OS !== 'android') return { granted: true, fine: true, blocked: false };
  const results = await PermissionsAndroid.requestMultiple([FINE, COARSE]);
  const fine = results[FINE] === PermissionsAndroid.RESULTS.GRANTED;
  const coarse = results[COARSE] === PermissionsAndroid.RESULTS.GRANTED;
  const blocked = !fine && !coarse && (
    results[FINE] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
    results[COARSE] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
  );
  return { granted: fine || coarse, fine, blocked };
};

export default { checkAndroidLocationGranted, requestAndroidLocationPermission };
