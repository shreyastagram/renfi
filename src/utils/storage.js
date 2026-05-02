/**
 * Secure Storage Utility
 *
 * Tokens live in react-native-keychain (Android Keystore-backed).
 * On phones where the keystore lock can transiently fail (Xiaomi/MIUI,
 * OnePlus, Oppo, Vivo) we keep an AsyncStorage shadow copy and a small
 * read-retry budget so a single keystore hiccup doesn't log the user out.
 *
 * Threat model: app sandbox protects both stores equally on non-rooted
 * devices. Keychain remains the *primary* (hardware-backed encryption);
 * AsyncStorage is consulted only when Keychain returns null/throws.
 *
 * @version 1.1.0
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  reportKeychainFailure,
  reportFallbackRescued,
} from './storageTelemetry';

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
  USER_TYPE: 'userType',
  TOKEN_EXPIRY: 'tokenExpiry',
  TOKENS_FALLBACK: '@auth_tokens_fallback',
};

const KEYCHAIN_SERVICE = 'fixhomi_auth';

// Keychain options:
// - AFTER_FIRST_UNLOCK: tokens stay readable across app kills until first reboot.
//   WHEN_UNLOCKED (the default) is too aggressive on OnePlus/Oppo lockscreens.
// - We set it on both Android and iOS for parity.
const KEYCHAIN_OPTIONS = {
  service: KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Securely store authentication tokens.
 * Writes to Keychain (primary) and AsyncStorage (fallback) so a transient
 * keystore failure on read doesn't kick the user out.
 *
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {number} expiresIn - seconds until access token expires (default 24h)
 */
export const storeTokens = async (accessToken, refreshToken, expiresIn = 86400) => {
  const expiryTime = Date.now() + expiresIn * 1000;
  const payload = JSON.stringify({ accessToken, refreshToken, expiryTime });

  let keychainOk = false;
  try {
    await Keychain.setGenericPassword('auth_tokens', payload, KEYCHAIN_OPTIONS);
    keychainOk = true;
  } catch (error) {
    console.warn('⚠️ [Storage] Keychain write failed, will rely on fallback:', error?.message);
    reportKeychainFailure({ op: 'write', attempt: 1, error });
  }

  // Mirror to AsyncStorage so we can survive a transient keystore failure.
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TOKENS_FALLBACK, payload);
  } catch (error) {
    console.warn('⚠️ [Storage] Fallback write failed:', error?.message);
  }

  if (keychainOk) {
    console.log('✅ [Storage] Tokens stored, expires at:', new Date(expiryTime).toISOString());
  }
  return true;
};

/**
 * Retrieve stored authentication tokens.
 *
 * Order:
 *   1. Try Keychain (with one quick retry — keystore lock often clears in <100ms)
 *   2. Fall back to AsyncStorage shadow copy
 *
 * Returning null here historically meant "log the user out". Callers should
 * treat null as "no session" only after this function has exhausted retries.
 */
export const getTokens = async () => {
  let lastKeychainError = null;
  let keychainThrew = false;

  // Attempt 1: Keychain (with one retry — keystore lock often clears in <100ms)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
      if (credentials && credentials.password) {
        // Opportunistically mirror to fallback — protects existing users who
        // installed before dual-write and might hit a Keychain hiccup later.
        AsyncStorage.setItem(STORAGE_KEYS.TOKENS_FALLBACK, credentials.password).catch(() => {});
        return JSON.parse(credentials.password);
      }
      // No credentials stored — break to fallback (don't retry an empty result)
      break;
    } catch (error) {
      lastKeychainError = error;
      keychainThrew = true;
      if (attempt === 1) {
        console.warn('⚠️ [Storage] Keychain read failed (attempt 1), retrying:', error?.message);
        reportKeychainFailure({ op: 'read', attempt: 1, error });
        await sleep(120);
        continue;
      }
      console.warn('⚠️ [Storage] Keychain read failed after retry, trying fallback:', error?.message);
      // Don't fire telemetry yet — wait until we know whether fallback rescued us
      // so we can record the resolved_path correctly.
    }
  }

  // Attempt 2: AsyncStorage shadow
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.TOKENS_FALLBACK);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.accessToken && parsed?.refreshToken) {
        console.log('🔁 [Storage] Recovered tokens from AsyncStorage fallback');
        if (keychainThrew) {
          // The whole point of this telemetry: we measure how often the
          // workaround is actually carrying users vs. how often Keychain works.
          reportFallbackRescued({ op: 'read' });
          reportKeychainFailure({
            op: 'read',
            attempt: 2,
            error: lastKeychainError,
            resolvedPath: 'keychain_fail_fallback_ok',
          });
        }
        // Best-effort: re-prime Keychain in the background so future reads hit it.
        Keychain.setGenericPassword('auth_tokens', raw, KEYCHAIN_OPTIONS).catch(() => {});
        return parsed;
      }
    }
  } catch (error) {
    console.error('❌ [Storage] Fallback read failed:', error?.message);
    if (keychainThrew) {
      reportKeychainFailure({
        op: 'read',
        attempt: 2,
        error: lastKeychainError,
        resolvedPath: 'both_failed',
      });
    }
    return null;
  }

  // Both stores returned no data. If Keychain threw, that's a real failure.
  // If neither threw, this just means no session exists (logged-out state).
  if (keychainThrew) {
    reportKeychainFailure({
      op: 'read',
      attempt: 2,
      error: lastKeychainError,
      resolvedPath: 'both_failed',
    });
  }

  return null;
};

/**
 * Check if the access token is expired or about to expire.
 *
 * Optimistic semantics: when we cannot read the expiry (keystore hiccup, no
 * data yet), we return *false* — let the caller try the request and rely on
 * a real 401 from the server to drive a refresh. The previous behaviour
 * (assume expired) caused a refresh storm at every cold start on phones
 * where Keychain reads occasionally fail.
 *
 * @param {number} bufferMs - refresh this many ms before actual expiry
 */
export const isTokenExpired = async (bufferMs = 5 * 60 * 1000) => {
  try {
    const tokens = await getTokens();
    if (!tokens) {
      // No tokens at all — caller should not have asked, but treat as expired.
      return true;
    }
    if (!tokens.expiryTime) {
      // We have a token but no expiry timestamp (e.g., legacy install or
      // partially recovered fallback). Don't preemptively refresh — let the
      // server reject if it's actually invalid.
      console.log('ℹ️ [Storage] No expiry timestamp, treating token as valid until 401');
      return false;
    }
    return Date.now() + bufferMs >= tokens.expiryTime;
  } catch (error) {
    // Optimistic: don't tear down the session over a read error.
    console.warn('⚠️ [Storage] Expiry check errored, treating token as valid:', error?.message);
    return false;
  }
};

/**
 * Get token expiry time
 * @returns {number|null} Expiry timestamp or null
 */
export const getTokenExpiry = async () => {
  try {
    const tokens = await getTokens();
    return tokens?.expiryTime || null;
  } catch (error) {
    console.error('❌ [Storage] Failed to get token expiry:', error);
    return null;
  }
};

/**
 * Clear stored authentication tokens (Keychain + AsyncStorage fallback).
 */
export const clearTokens = async () => {
  let ok = true;
  try {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  } catch (error) {
    console.error('❌ [Storage] Failed to clear Keychain tokens:', error);
    reportKeychainFailure({ op: 'clear', attempt: 1, error });
    ok = false;
  }
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.TOKENS_FALLBACK);
  } catch (error) {
    console.error('❌ [Storage] Failed to clear fallback tokens:', error);
    ok = false;
  }
  if (ok) console.log('✅ [Storage] Tokens cleared');
  return ok;
};

/**
 * Store user data in AsyncStorage.
 * Only stores essential, non-sensitive fields to minimize PII exposure.
 * Sensitive data (tokens, passwords) are stored in Keychain.
 * @param {Object} userData - User data object
 */
export const storeUserData = async (userData) => {
  try {
    // Strip sensitive PII — only keep fields needed for app navigation/state
    const safeData = {
      id: userData.id || userData._id || userData.mongoId,
      mongoId: userData.mongoId,
      javaUserId: userData.javaUserId,
      role: userData.role,
      userType: userData.userType,
      fullName: userData.fullName || userData.name,
      isEmailVerified: userData.isEmailVerified,
      isPhoneVerified: userData.isPhoneVerified,
      isAadhaarVerified: userData.isAadhaarVerified,
      isPremium: userData.isPremium,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(safeData));
    return true;
  } catch (error) {
    console.error('❌ [Storage] Failed to store user data:', error);
    return false;
  }
};

/**
 * Get user data from AsyncStorage
 * @returns {Object|null} User data or null
 */
export const getUserData = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('❌ [Storage] Failed to get user data:', error);
    return null;
  }
};

/**
 * Store user type (user/provider)
 * @param {string} userType - 'user' or 'provider'
 */
export const storeUserType = async (userType) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_TYPE, userType);
    return true;
  } catch (error) {
    console.error('❌ [Storage] Failed to store user type:', error);
    return false;
  }
};

/**
 * Get user type
 * @returns {string|null} User type or null
 */
export const getUserType = async () => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.USER_TYPE);
  } catch (error) {
    console.error('❌ [Storage] Failed to get user type:', error);
    return null;
  }
};

/**
 * Clear all stored data (logout)
 */
export const clearAllData = async () => {
  try {
    await clearTokens();
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.USER_TYPE,
    ]);
    return true;
  } catch (error) {
    console.error('❌ [Storage] Failed to clear all data:', error);
    return false;
  }
};

export default {
  storeTokens,
  getTokens,
  clearTokens,
  isTokenExpired,
  getTokenExpiry,
  storeUserData,
  getUserData,
  storeUserType,
  getUserType,
  clearAllData,
};
