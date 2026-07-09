/**
 * Analytics deduplication helpers.
 *
 * One-shot conversion events (registration, booking_accepted per request,
 * document_verified per category…) must never double-fire — socket + FCM can
 * both deliver the same status change, screens re-render, and the app may
 * observe the same state again on a later launch.
 *
 * - onceEver(key):     persisted via AsyncStorage — survives restarts.
 * - oncePerSession(key): in-memory — resets on app restart.
 *
 * Both return true exactly once per key (best-effort; a hard crash between
 * check and mark could re-allow — acceptable for analytics).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_PREFIX = 'analytics_once:';
const sessionKeys = new Set();

/** True exactly once per key across app installs' lifetime. */
export const onceEver = async (key) => {
  if (!key) return false;
  const storageKey = STORE_PREFIX + key;
  try {
    // Fast path: also guard within this session to avoid racing async reads
    if (sessionKeys.has(storageKey)) return false;
    sessionKeys.add(storageKey);

    const existing = await AsyncStorage.getItem(storageKey);
    if (existing) return false;
    await AsyncStorage.setItem(storageKey, '1');
    return true;
  } catch (e) {
    // Storage unavailable → allow (better a rare duplicate than a lost conversion)
    return true;
  }
};

/** True exactly once per key per app session. */
export const oncePerSession = (key) => {
  if (!key) return false;
  const k = 'session:' + key;
  if (sessionKeys.has(k)) return false;
  sessionKeys.add(k);
  return true;
};
