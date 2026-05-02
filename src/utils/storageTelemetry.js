/**
 * Storage / Auth Telemetry
 *
 * Lightweight wrapper around Firebase Crashlytics for diagnosing the
 * "users on non-Samsung Android phones get logged out after 1-2 days" issue.
 *
 * What we capture:
 *   - Every Keychain read/write failure (so we can see KeyPermanentlyInvalidatedException etc.)
 *   - Every successful AsyncStorage fallback rescue (so we can measure how often the workaround fires)
 *   - The exact code path that force-logged-out the user (refresh failure, missing token, etc.)
 *
 * Behavior is fail-soft: if Crashlytics isn't available or any call throws,
 * the telemetry is silently dropped — never affects the user flow.
 *
 * Per-session dedup: each unique error_code per op fires at most once per
 * cold start, so a stuck user doesn't spam thousands of identical events.
 *
 * @version 1.0.0
 */

import { Platform } from 'react-native';

// Lazy-require Crashlytics (matches the pattern in ErrorBoundary.jsx and App.tsx)
let crashlytics = null;
try {
  crashlytics = require('@react-native-firebase/crashlytics').default;
} catch (e) {
  // Crashlytics not installed — every call below becomes a no-op
}

let DeviceInfo = null;
try {
  DeviceInfo = require('react-native-device-info').default;
} catch (e) {
  // device-info not installed — brand/model fields just stay null
}

// Per-session dedup of identical events
const seenEvents = new Set();

/**
 * Strip anything that looks like a token (long base64-ish run) out of an
 * error message before logging. Defense against accidentally shipping a
 * fragment of an access token to Crashlytics.
 */
function sanitizeMessage(msg) {
  if (!msg || typeof msg !== 'string') return null;
  // Replace runs of 40+ url-safe-base64 chars with [REDACTED]
  const stripped = msg.replace(/[A-Za-z0-9_\-]{40,}/g, '[REDACTED]');
  return stripped.length > 200 ? stripped.slice(0, 200) + '…' : stripped;
}

function getDeviceContext() {
  const ctx = {
    os: Platform.OS,
    os_version: String(Platform.Version || ''),
  };
  if (DeviceInfo) {
    try {
      ctx.device_brand = DeviceInfo.getBrand?.() || null;
      ctx.device_model = DeviceInfo.getModel?.() || null;
      ctx.app_version = DeviceInfo.getVersion?.() || null;
    } catch (e) {
      // Ignore — fields stay undefined
    }
  }
  return ctx;
}

function safeCall(fn) {
  if (!crashlytics) return;
  try {
    fn();
  } catch (e) {
    // Crashlytics threw — never let telemetry break anything
  }
}

/**
 * Record a Keychain failure (read or write or clear).
 *
 * @param {Object} params
 * @param {'read'|'write'|'clear'} params.op
 * @param {number} [params.attempt]               1 or 2 for the retry path
 * @param {Error}  params.error                   the original exception
 * @param {boolean} [params.biometricRequired]    if known
 * @param {'keychain_ok'|'keychain_fail_fallback_ok'|'both_failed'} [params.resolvedPath]
 */
export function reportKeychainFailure({ op, attempt = 1, error, biometricRequired = null, resolvedPath = null }) {
  const errorCode = error?.code || null;
  const errorName = error?.name || null;
  const dedupKey = `keychain_fail:${op}:${errorCode || errorName || 'unknown'}`;

  // Always log a breadcrumb (cheap, lets us see sequence even if dedup'd)
  safeCall(() => {
    crashlytics().log(
      `[KEYCHAIN_FAIL] op=${op} attempt=${attempt} code=${errorCode} name=${errorName} path=${resolvedPath}`
    );
  });

  // Dedup the structured event itself
  if (seenEvents.has(dedupKey)) return;
  seenEvents.add(dedupKey);

  safeCall(() => {
    const ctx = getDeviceContext();
    crashlytics().setAttributes({
      last_keychain_op: op,
      last_keychain_attempt: String(attempt),
      last_keychain_error_code: errorCode || 'null',
      last_keychain_error_name: errorName || 'null',
      last_keychain_resolved_path: resolvedPath || 'unknown',
      last_keychain_biometric_required: String(biometricRequired),
      device_brand: ctx.device_brand || 'unknown',
      device_model: ctx.device_model || 'unknown',
      os: ctx.os,
      os_version: ctx.os_version,
    });

    // recordError() is the structured non-fatal — Crashlytics keeps the stack
    const wrapped = new Error(
      `Keychain ${op} failed (code=${errorCode || 'none'} name=${errorName || 'none'} msg=${sanitizeMessage(error?.message) || 'none'})`
    );
    wrapped.name = 'KeychainNonFatal';
    crashlytics().recordError(wrapped);
  });
}

/**
 * Record that the AsyncStorage fallback rescued a session (Keychain read failed
 * but the shadow copy was good). This is THE metric for measuring the impact of
 * the dual-storage workaround in production.
 */
export function reportFallbackRescued({ op = 'read' } = {}) {
  safeCall(() => {
    crashlytics().log(`[STORAGE_FALLBACK_RESCUED] op=${op}`);
    crashlytics().setAttributes({
      last_fallback_rescue_op: op,
      last_fallback_rescue_at: new Date().toISOString(),
    });
  });
}

/**
 * Record the exact moment a user is force-logged-out and WHY.
 * Fired from apiClient.js immediately before clearTokens()/onAuthExpired().
 *
 * @param {Object} params
 * @param {string} params.trigger    one of:
 *   - 'refresh_no_token'              : tried to refresh but getTokens() returned no refreshToken
 *   - 'refresh_definitive_auth_fail'  : Java Auth /refresh returned 400/401
 *   - 'response_401_account_deleted'  : server returned ACCOUNT_DELETED on a request
 *   - 'response_401_refresh_failed'   : 401 retry path failed definitively
 * @param {Error}  [params.error]     underlying error if any
 * @param {number} [params.httpStatus] HTTP status from server if available
 */
export function reportForcedLogout({ trigger, error = null, httpStatus = null }) {
  safeCall(() => {
    const errorCode = error?.code || null;
    const errorName = error?.name || null;
    const errorStatus = error?.response?.status || httpStatus || null;
    const errorBody = error?.response?.data?.code || null;

    crashlytics().log(
      `[FORCED_LOGOUT] trigger=${trigger} status=${errorStatus} body_code=${errorBody} err_code=${errorCode}`
    );
    const ctx = getDeviceContext();
    crashlytics().setAttributes({
      last_logout_trigger: trigger,
      last_logout_http_status: String(errorStatus || 'null'),
      last_logout_body_code: errorBody || 'null',
      last_logout_error_code: errorCode || 'null',
      last_logout_error_name: errorName || 'null',
      last_logout_at: new Date().toISOString(),
      device_brand: ctx.device_brand || 'unknown',
      device_model: ctx.device_model || 'unknown',
      os: ctx.os,
      os_version: ctx.os_version,
    });

    const wrapped = new Error(
      `Forced logout: trigger=${trigger} status=${errorStatus} bodyCode=${errorBody}`
    );
    wrapped.name = 'ForcedLogoutNonFatal';
    crashlytics().recordError(wrapped);
  });
}

/**
 * One-shot cold-start state event. Records what the storage layer looked
 * like at app boot — gives us the denominator for "of N launches, M had
 * working Keychain reads."
 *
 * @param {Object} state
 * @param {boolean} state.keychainHadTokens
 * @param {boolean} state.fallbackHadTokens
 * @param {boolean} state.recoveredFromFallback   true if Keychain failed but fallback rescued
 */
export function reportStorageState({ keychainHadTokens, fallbackHadTokens, recoveredFromFallback = false } = {}) {
  safeCall(() => {
    crashlytics().log(
      `[STORAGE_STATE] keychain=${keychainHadTokens} fallback=${fallbackHadTokens} recovered=${recoveredFromFallback}`
    );
    const ctx = getDeviceContext();
    crashlytics().setAttributes({
      boot_keychain_had_tokens: String(!!keychainHadTokens),
      boot_fallback_had_tokens: String(!!fallbackHadTokens),
      boot_recovered_from_fallback: String(!!recoveredFromFallback),
      device_brand: ctx.device_brand || 'unknown',
      device_model: ctx.device_model || 'unknown',
      os: ctx.os,
      os_version: ctx.os_version,
    });
  });
}

/**
 * Simple breadcrumb — cheap, useful for sequencing in Crashlytics reports.
 */
export function logBreadcrumb(tag, fields = {}) {
  safeCall(() => {
    const parts = Object.entries(fields)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    crashlytics().log(`[${tag}] ${parts}`);
  });
}

export default {
  reportKeychainFailure,
  reportFallbackRescued,
  reportForcedLogout,
  reportStorageState,
  logBreadcrumb,
};
