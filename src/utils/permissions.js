/**
 * Permission helpers for camera and photo library access.
 *
 * Requests the appropriate platform permission before opening the camera
 * or gallery.  Returns true if granted, false otherwise.  When the user
 * has permanently denied the permission, opens the app settings so they
 * can re-enable it.
 */

import { Platform, Linking } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  openSettings,
} from 'react-native-permissions';

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
