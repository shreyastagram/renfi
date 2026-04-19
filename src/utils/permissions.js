/**
 * Permission helpers for camera, photo library, and background location access.
 *
 * Requests the appropriate platform permission before opening the camera,
 * gallery, or starting background location tracking.  Returns true if
 * granted, false otherwise.  When the user has permanently denied the
 * permission, opens the app settings so they can re-enable it.
 */

import { Platform, Linking, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  openSettings,
} from 'react-native-permissions';

// ─── Foreground Location (Prominent Disclosure helper) ────────────────
// Google Play's User Data policy requires an in-app disclosure immediately
// before any runtime permission prompt. Use this for every screen that
// requests foreground location, with screen-specific `message` copy.

const FOREGROUND_LOCATION_PERMISSION = Platform.select({
  ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
  android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
});

/**
 * Request foreground location with a mandatory in-app disclosure dialog
 * that precedes the OS permission prompt. Complies with Google Play
 * Prominent Disclosure & Consent requirement.
 *
 * @param {Function} dialog - useDialog() dialog function (required)
 * @param {Object} opts
 * @param {string} opts.message - purpose-specific disclosure shown before the OS prompt
 * @param {string} [opts.title] - dialog title (default: 'Location Access')
 * @param {string} [opts.continueText] - continue button label
 * @param {string} [opts.cancelText] - cancel button label
 * @returns {Promise<boolean>} true if granted
 */
export const requestForegroundLocationPermission = async (dialog, opts = {}) => {
  const {
    message = 'Fixhomi uses your location to provide core service features. Location is only used while the app is open.',
    title = 'Location Access',
    continueText = 'Continue',
    cancelText = 'Not Now',
  } = opts;

  try {
    const status = await check(FOREGROUND_LOCATION_PERMISSION);

    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) return true;

    if (status === RESULTS.BLOCKED) {
      return new Promise((resolve) => {
        dialog(
          'Location Access Needed',
          'Location permission was previously denied. Please enable it in Settings to use this feature.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Open Settings', onPress: () => { openSettings().catch(() => Linking.openSettings()); resolve(false); } },
          ],
        );
      });
    }

    // DENIED or UNAVAILABLE → show in-app disclosure, then request
    return new Promise((resolve) => {
      dialog(
        title,
        message,
        [
          { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
          {
            text: continueText,
            onPress: async () => {
              try {
                // Give React a tick to unmount the Modal before the OS
                // permission prompt appears — otherwise both can be on
                // screen at the same time on slower Android devices.
                await new Promise((r) => setTimeout(r, 60));
                const result = await request(FOREGROUND_LOCATION_PERMISSION);
                resolve(result === RESULTS.GRANTED || result === RESULTS.LIMITED);
              } catch (err) {
                console.warn('[Permissions] Foreground location request error:', err?.message);
                resolve(false);
              }
            },
          },
        ],
      );
    });
  } catch (err) {
    console.warn('[Permissions] Foreground location check error:', err?.message);
    return false;
  }
};

/**
 * Request POST_NOTIFICATIONS (Android 13+) with an in-app disclosure.
 * Silent no-op on iOS and Android <13 (iOS permission is handled by FCM/APNs).
 *
 * @param {Function} dialog - useDialog() dialog function
 * @param {Object} opts
 * @param {string} [opts.message] - purpose-specific disclosure copy
 * @returns {Promise<boolean>} true if granted (or not required)
 */
export const requestAndroidNotificationPermission = async (dialog, opts = {}) => {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;

  const {
    title = 'Notification Access',
    message = 'Fixhomi uses notifications to alert you about service request updates, provider arrivals, and important account activity. You can change this anytime in Settings.',
    continueText = 'Continue',
    cancelText = 'Not Now',
  } = opts;

  try {
    const already = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (already) return true;

    return new Promise((resolve) => {
      dialog(
        title,
        message,
        [
          { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
          {
            text: continueText,
            onPress: async () => {
              try {
                // Give React a tick to unmount the Modal before the OS
                // prompt appears — prevents overlap on slower Android devices.
                await new Promise((r) => setTimeout(r, 60));
                const result = await PermissionsAndroid.request(
                  PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
                );
                resolve(result === PermissionsAndroid.RESULTS.GRANTED);
              } catch (err) {
                console.warn('[Permissions] Notification request error:', err?.message);
                resolve(false);
              }
            },
          },
        ],
      );
    });
  } catch (err) {
    console.warn('[Permissions] Notification check error:', err?.message);
    return false;
  }
};

// ─── Camera ───────────────────────────────────────────────────────────
const CAMERA_PERMISSION = Platform.select({
  ios: PERMISSIONS.IOS.CAMERA,
  android: PERMISSIONS.ANDROID.CAMERA,
});

/**
 * Ensure camera permission is granted.
 * @param {Function} dialog – the useDialog() dialog function
 * @returns {Promise<boolean>}
 */
export const requestCameraPermission = async (dialog) => {
  try {
    const status = await check(CAMERA_PERMISSION);

    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) return true;

    if (status === RESULTS.DENIED) {
      const result = await request(CAMERA_PERMISSION);
      return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
    }

    if (status === RESULTS.BLOCKED) {
      dialog(
        'Camera Access Required',
        'Please allow camera access in your device settings to take photos.',
        [
          { text: 'Open Settings', onPress: () => openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return false;
    }

    // UNAVAILABLE or unknown
    return false;
  } catch {
    return false;
  }
};

// ─── Photo Library ────────────────────────────────────────────────────
const PHOTO_LIBRARY_PERMISSION = Platform.select({
  ios: PERMISSIONS.IOS.PHOTO_LIBRARY,
  android:
    Number(Platform.Version) >= 33
      ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
      : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
});

/**
 * Ensure photo library permission is granted.
 * @param {Function} dialog – the useDialog() dialog function
 * @returns {Promise<boolean>}
 */
export const requestGalleryPermission = async (dialog) => {
  try {
    const status = await check(PHOTO_LIBRARY_PERMISSION);

    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) return true;

    if (status === RESULTS.DENIED) {
      const result = await request(PHOTO_LIBRARY_PERMISSION);
      return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
    }

    if (status === RESULTS.BLOCKED) {
      dialog(
        'Photo Access Required',
        'Please allow photo library access in your device settings to choose photos.',
        [
          { text: 'Open Settings', onPress: () => openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return false;
    }

    return false;
  } catch {
    return false;
  }
};

// ─── Background Location ─────────────────────────────────────────────
// iOS requires LOCATION_ALWAYS for background tracking.
// Android requires ACCESS_BACKGROUND_LOCATION (API 29+).
// Both need a pre-permission explanation to pass store review.

const BATTERY_OPT_SHOWN_KEY = 'fixhomi_battery_opt_shown';

/**
 * Request background location permission with pre-explanation dialog.
 *
 * Flow:
 * 1. Check if "When In Use" is already granted (prerequisite)
 * 2. Show friendly explanation of WHY background access is needed
 * 3. Trigger the system permission prompt
 * 4. Handle blocked/denied states
 *
 * @param {Function} dialog - useDialog() dialog function
 * @returns {Promise<boolean>} true if background location is granted
 */
export const requestBackgroundLocationPermission = async (dialog) => {
  try {
    if (Platform.OS === 'ios') {
      return await requestIOSBackgroundLocation(dialog);
    } else {
      return await requestAndroidBackgroundLocation(dialog);
    }
  } catch (error) {
    console.error('[Permissions] Background location error:', error.message);
    return false;
  }
};

/**
 * iOS: Request "Always Allow" location.
 * Must already have "When In Use" granted first.
 */
const requestIOSBackgroundLocation = async (dialog) => {
  // Check current status
  const whenInUse = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
  if (whenInUse !== RESULTS.GRANTED && whenInUse !== RESULTS.LIMITED) {
    // Need foreground first — show in-app disclosure before the OS prompt
    // (Prominent Disclosure requirement — Google Play User Data policy).
    const foregroundGranted = await requestForegroundLocationPermission(dialog, {
      title: 'Location Access',
      message: 'Fixhomi needs your location to match you with nearby service requests and show your position on the provider map.\n\nThe next step will ask for background access so customers can see your live location during an active service.',
    });
    if (!foregroundGranted) {
      showLocationDeniedDialog(dialog);
      return false;
    }
  }

  // Check "Always" status
  const alwaysStatus = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
  if (alwaysStatus === RESULTS.GRANTED) return true;

  if (alwaysStatus === RESULTS.BLOCKED) {
    showBackgroundBlockedDialog(dialog);
    return false;
  }

  // Show pre-permission explanation, then request
  return new Promise((resolve) => {
    dialog(
      'Background Location Access',
      'To share your live location with customers while navigating to them, Fixhomi needs location access even when the app is in the background.\n\nThis is only active during service requests — never at other times.',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Continue',
          onPress: async () => {
            await new Promise((r) => setTimeout(r, 60));
            const result = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
            if (result === RESULTS.GRANTED) {
              resolve(true);
            } else if (result === RESULTS.BLOCKED) {
              showBackgroundBlockedDialog(dialog);
              resolve(false);
            } else {
              resolve(false);
            }
          },
        },
      ],
    );
  });
};

/**
 * Android: Request ACCESS_BACKGROUND_LOCATION (API 29+).
 * On older Android, foreground permission is sufficient.
 */
const requestAndroidBackgroundLocation = async (dialog) => {
  // Android < 10 (API 29): foreground permission covers background too
  if (Number(Platform.Version) < 29) {
    const fineLocation = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    if (fineLocation === RESULTS.GRANTED) return true;

    const granted = await requestForegroundLocationPermission(dialog, {
      title: 'Location Access',
      message: 'Fixhomi needs your location to match you with nearby service requests and share your live location with customers during an active service.',
    });
    if (granted) return true;

    showLocationDeniedDialog(dialog);
    return false;
  }

  // Ensure fine location is granted first — show in-app disclosure before the
  // OS prompt (Prominent Disclosure requirement — Google Play User Data policy).
  const fineStatus = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
  if (fineStatus !== RESULTS.GRANTED) {
    const foregroundGranted = await requestForegroundLocationPermission(dialog, {
      title: 'Location Access',
      message: 'Fixhomi needs your location to match you with nearby service requests and show your position on the provider map.\n\nThe next step will ask for background access so customers can see your live location during an active service.',
    });
    if (!foregroundGranted) {
      showLocationDeniedDialog(dialog);
      return false;
    }
  }

  // Check background location
  const bgStatus = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
  if (bgStatus === RESULTS.GRANTED) return true;

  if (bgStatus === RESULTS.BLOCKED) {
    showBackgroundBlockedDialog(dialog);
    return false;
  }

  // Show pre-permission explanation, then request
  return new Promise((resolve) => {
    dialog(
      'Background Location Access',
      'To share your live location with customers while navigating to them, Fixhomi needs the "Allow all the time" location permission.\n\nThis is only active during service requests — never at other times.',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Continue',
          onPress: async () => {
            await new Promise((r) => setTimeout(r, 60));
            const result = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
            if (result === RESULTS.GRANTED) {
              resolve(true);
            } else if (result === RESULTS.BLOCKED) {
              showBackgroundBlockedDialog(dialog);
              resolve(false);
            } else {
              resolve(false);
            }
          },
        },
      ],
    );
  });
};

/**
 * Show dialog when location permission is denied.
 * Non-blocking — provider can still use the app, just without live tracking.
 */
const showLocationDeniedDialog = (dialog) => {
  dialog(
    'Location Access Needed',
    'Without location access, customers won\'t be able to see your live location during service requests. You can enable it anytime from Settings.',
    [
      { text: 'Open Settings', onPress: () => openSettings() },
      { text: 'Skip', style: 'cancel' },
    ],
  );
};

/**
 * Show dialog when background location is permanently blocked.
 * Directs to app settings since the system prompt can't be shown again.
 */
const showBackgroundBlockedDialog = (dialog) => {
  dialog(
    'Background Location Blocked',
    'Background location access was previously denied. To enable live tracking during service requests, please go to Settings and select "Always" for location access.',
    [
      { text: 'Open Settings', onPress: () => openSettings() },
      { text: 'Skip', style: 'cancel' },
    ],
  );
};

// ─── Android Battery Optimization ────────────────────────────────────
// OEM battery killers (Xiaomi MIUI, Samsung One UI, Oppo ColorOS) can
// kill the foreground service. We prompt the user once to disable
// battery optimization for this app.

/**
 * Show battery optimization dialog for Android OEMs.
 * Only shown once per install (AsyncStorage flag).
 *
 * @param {Function} dialog - useDialog() dialog function
 * @returns {Promise<void>}
 */
export const showBatteryOptimizationDialog = async (dialog) => {
  if (Platform.OS !== 'android') return;

  try {
    const alreadyShown = await AsyncStorage.getItem(BATTERY_OPT_SHOWN_KEY);
    if (alreadyShown === 'true') return;

    // Mark as shown immediately (don't re-show even if they skip)
    await AsyncStorage.setItem(BATTERY_OPT_SHOWN_KEY, 'true');

    dialog(
      'Keep Location Active',
      'Some phones (Xiaomi, Samsung, Oppo, Vivo) aggressively stop background apps. To ensure reliable service delivery, open Fixhomi\'s app settings → tap Battery → select Unrestricted.',
      [
        {
          text: 'Open Fixhomi Settings',
          onPress: () => {
            // openSettings() opens APPLICATION_DETAILS_SETTINGS for our app.
            // User lands on the Fixhomi app info page and can tap
            // Battery → Unrestricted from there.
            openSettings().catch(() => {
              // Fallback: react-native Linking.openSettings (same target)
              Linking.openSettings();
            });
          },
        },
        { text: 'Skip', style: 'cancel' },
      ],
    );
  } catch (error) {
    console.warn('[Permissions] Battery optimization dialog error:', error.message);
  }
};

/**
 * Check if background location permission is currently granted.
 * Does NOT prompt — use for status checks and UI indicators.
 *
 * @returns {Promise<boolean>}
 */
export const isBackgroundLocationGranted = async () => {
  try {
    if (Platform.OS === 'ios') {
      const status = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
      return status === RESULTS.GRANTED;
    } else {
      if (Number(Platform.Version) < 29) {
        const status = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        return status === RESULTS.GRANTED;
      }
      const status = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
      return status === RESULTS.GRANTED;
    }
  } catch {
    return false;
  }
};
