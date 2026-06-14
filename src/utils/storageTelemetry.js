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

// ── JWT payload decode for telemetry (NEVER verifies signature; fail-soft) ──
// Used only to attach diagnostics (which account/token/age/backend) to logout
// events so Cohort A (valid token, transient) and Cohort B (token email not
// registered) are distinguishable directly in Crashlytics.
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64Decode(str) {
  if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
    return globalThis.atob(str);
  }
  let output = '';
  const clean = String(str).replace(/=+$/, '');
  let bc = 0, bs = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = B64_CHARS.indexOf(clean.charAt(i));
    if (c === -1) continue;
    bs = bc % 4 ? bs * 64 + c : c;
    if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
  }
  return output;
}

// Mask an email for telemetry: "gajanandingale1980@gmail.com" -> "ga****@gmail.com"
function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.min(6, Math.max(1, local.length - 2)))}@${domain}`;
}

/**
 * Decode a JWT's claims (no verification) and build a telemetry-safe context.
 * Returns null on any failure. Email is masked; userId/iat/exp are non-sensitive
 * and let us correlate a logout event to the exact account/token in the backend.
 */
function buildTokenContext(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(base64Decode(b64));
    const nowSec = Math.floor(Date.now() / 1000);
    const iat = typeof claims.iat === 'number' ? claims.iat : null;
    const exp = typeof claims.exp === 'number' ? claims.exp : null;
    return {
      token_user_id: claims.userId != null ? String(claims.userId) : 'null',
      token_email_masked: maskEmail(claims.sub) || 'null',
      token_iat_iso: iat ? new Date(iat * 1000).toISOString() : 'null',
      token_age_hours: iat ? String(Math.round(((nowSec - iat) / 3600) * 10) / 10) : 'null',
      token_exp_iso: exp ? new Date(exp * 1000).toISOString() : 'null',
      token_expired: exp != null ? String(nowSec >= exp) : 'null',
    };
  } catch (e) {
    return null;
  }
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
 *   - 'refresh_no_token'                    : tried to refresh but getTokens() returned no refreshToken
 *   - 'refresh_definitive_auth_fail'        : Java Auth /refresh returned 400/401 (proactive interceptor path)
 *   - 'response_401_account_deleted'        : server returned ACCOUNT_DELETED on a request
 *   - 'response_401_refresh_failed'         : 401 retry path failed definitively
 *   - 'startup_refresh_definitive_auth_fail': startup validateAndRefreshTokens got a definitive 401
 *                                             (see AUTH_STARTUP_LOGOUT_FIX.md). NOTE: the startup
 *                                             *transient* case is intentionally NOT a forced logout —
 *                                             it logs the breadcrumb [STARTUP_REFRESH_TRANSIENT_KEPT].
 * @param {Error}  [params.error]      underlying error if any
 * @param {number} [params.httpStatus] HTTP status from server if available
 * @param {string} [params.token]      the offending access token — decoded (NOT verified)
 *                                      to attach userId / masked email / age / expired so we
 *                                      can tell Cohort A (valid token, transient) from Cohort B
 *                                      (token email not registered) right in Crashlytics.
 * @param {string} [params.requestUrl] the request path that triggered the logout
 * @param {string} [params.authBaseUrl] which backend host returned it
 */
export function reportForcedLogout({ trigger, error = null, httpStatus = null, token = null, requestUrl = null, authBaseUrl = null }) {
  safeCall(() => {
    const errorCode = error?.code || null;
    const errorName = error?.name || null;
    const errorStatus = error?.response?.status || httpStatus || null;
    const errorBody = error?.response?.data?.code || null;
    // Decode the offending token (fail-soft) so the event says WHICH account/token.
    const tok = buildTokenContext(token);

    crashlytics().log(
      `[FORCED_LOGOUT] trigger=${trigger} status=${errorStatus} body_code=${errorBody} err_code=${errorCode}` +
      (tok ? ` userId=${tok.token_user_id} email=${tok.token_email_masked} tokenAgeH=${tok.token_age_hours} tokenExpired=${tok.token_expired}` : '') +
      (requestUrl ? ` url=${requestUrl}` : '')
    );
    const ctx = getDeviceContext();
    crashlytics().setAttributes({
      last_logout_trigger: trigger,
      last_logout_http_status: String(errorStatus || 'null'),
      last_logout_body_code: errorBody || 'null',
      last_logout_error_code: errorCode || 'null',
      last_logout_error_name: errorName || 'null',
      last_logout_at: new Date().toISOString(),
      last_logout_request_url: requestUrl || 'null',
      last_logout_auth_base_url: authBaseUrl || 'null',
      // Token diagnostics — the key to telling Cohort A (valid token, transient)
      // from Cohort B (token email not registered) directly in Crashlytics.
      last_logout_token_user_id: tok?.token_user_id || 'unknown',
      last_logout_token_email: tok?.token_email_masked || 'unknown',
      last_logout_token_iat: tok?.token_iat_iso || 'unknown',
      last_logout_token_age_hours: tok?.token_age_hours || 'unknown',
      last_logout_token_expired: tok?.token_expired || 'unknown',
      device_brand: ctx.device_brand || 'unknown',
      device_model: ctx.device_model || 'unknown',
      os: ctx.os,
      os_version: ctx.os_version,
    });

    const wrapped = new Error(
      `Forced logout: trigger=${trigger} status=${errorStatus} bodyCode=${errorBody}` +
      (tok ? ` userId=${tok.token_user_id} email=${tok.token_email_masked} tokenExpired=${tok.token_expired}` : '')
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
