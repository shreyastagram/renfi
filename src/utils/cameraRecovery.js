/**
 * Camera-capture recovery for low-RAM Android devices.
 *
 * Launching the system camera can get our process KILLED by the OS (LMK) on
 * 2-3GB phones (budget Realme/Xiaomi). The user taps OK in the camera, Android
 * cold-restarts the app, and react-native-image-picker's promise is gone — the
 * photo appears lost. BUT: the camera app writes the capture into OUR cache
 * (image-picker's FileProvider temp file) BEFORE our process is resumed, so
 * the file survives the death.
 *
 * Pattern (per screen):
 *   await markPendingCapture({ kind: 'profilePhoto', ...context });
 *   const result = await launchCamera(opts);
 *   await clearPendingCapture();            // process survived — normal path
 *   ...
 *   // on mount:
 *   const rec = await recoverPendingCapture();
 *   if (rec?.kind === 'profilePhoto') → confirm with user → use rec.uri
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';

const KEY = 'pending_camera_capture_v1';
const MAX_AGE_MS = 5 * 60 * 1000; // captures older than 5 min are stale

export const markPendingCapture = async (context) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ context, ts: Date.now() }));
  } catch (e) { /* best-effort */ }
};

export const clearPendingCapture = async () => {
  try { await AsyncStorage.removeItem(KEY); } catch (e) { /* best-effort */ }
};

/**
 * Find the newest camera temp file image-picker produced within maxAgeMs.
 * Android-only (iOS does not LMK-kill for the in-process camera UI).
 */
const findRecentCameraFile = async (sinceTs) => {
  if (Platform.OS !== 'android') return null;
  try {
    const cacheDir = ReactNativeBlobUtil.fs.dirs.CacheDir;
    const entries = await ReactNativeBlobUtil.fs.lstat(cacheDir);
    const candidates = (entries || []).filter((e) =>
      e.type === 'file' &&
      /rn_image_picker_lib_temp/i.test(e.filename) &&
      Number(e.lastModified) >= sinceTs
    );
    if (!candidates.length) return null;
    candidates.sort((a, b) => Number(b.lastModified) - Number(a.lastModified));
    const best = candidates[0];
    // A zero/near-zero byte file means the camera never finished writing.
    if (Number(best.size) < 1024) return null;
    return 'file://' + best.path;
  } catch (e) {
    return null;
  }
};

/**
 * Returns { kind, ...context, uri } when the app restarted mid-capture and the
 * photo survived; null otherwise. Consumes the marker either way (one-shot).
 */
export const recoverPendingCapture = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY); // one-shot: never re-prompt
    const { context, ts } = JSON.parse(raw);
    if (!ts || Date.now() - ts > MAX_AGE_MS) return null;
    const uri = await findRecentCameraFile(ts);
    if (!uri) return null;
    return { ...context, uri };
  } catch (e) {
    return null;
  }
};
