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
import AsyncStorage from '@react-native-async-storage/async-storage';

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
export async function reportForcedLogout({ trigger, error = null, httpStatus = null, token = null, requestUrl = null, authBaseUrl = null }) {
  // Shared logout correlation context (route, storage truth, nav-fail flags).
  // Gathered BEFORE the caller clears tokens; time-boxed and fail-soft.
  let diagCtx = {};
  try {
    diagCtx = await gatherLogoutContext();
  } catch (e) { /* attributes just stay absent */ }
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
      // Correlation context shared with LogoutDiagnostic events.
      ...diagCtx,
    });

    const wrapped = new Error(
      `Forced logout: trigger=${trigger} status=${errorStatus} bodyCode=${errorBody}` +
      (tok ? ` userId=${tok.token_user_id} email=${tok.token_email_masked} tokenExpired=${tok.token_expired}` : '') +
      ` navFailBefore=${diagCtx.logout_nav_fail_before ?? 'unknown'}`
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

// ═══════════════════════════════════════════════════════════════════════════
// Nav-persist failure diagnostics + logout correlation (2026-07 instrumentation)
//
// Everything below runs ONLY on failure paths or logout — the healthy path
// pays nothing beyond two AsyncStorage marker writes per token refresh.
// Nothing here may throw into the caller, and nothing here ever calls
// JSON.stringify on a suspect object (the walker inspects references only;
// the markers stringify small literals we construct ourselves).
// ═══════════════════════════════════════════════════════════════════════════

// Cross-session markers. Present at boot ⇒ the previous session terminated
// inside the marked window (or failed to serialize its nav state).
const NAV_FAIL_MARKER_KEY = '@fixhomi_diag_nav_fail_v1';
const REFRESH_WINDOW_KEY = '@fixhomi_diag_refresh_window_v1';
const TOKEN_WRITE_KEY = '@fixhomi_diag_token_write_v1';

// In-session correlation state, attached to every logout event.
const sessionDiag = {
  navPersistFailCount: 0,
  lastNavPersistFail: null, // { at, route, paramKey, trigger }
  lastTokenWrite: null,     // { at, keychainOk, fallbackOk }
  prevSession: null,        // loaded once by checkPriorSessionMarkers()
};

// Context providers registered by App.tsx / apiClient.js so this module needs
// no imports from them (avoids require cycles).
let navContextProvider = null;     // () => ({ route })
let refreshStateProvider = null;   // () => ({ inProgress })
export function setNavContextProvider(fn) { navContextProvider = fn; }
export function setRefreshStateProvider(fn) { refreshStateProvider = fn; }

// Fail-soft await: resolves undefined instead of rejecting/hanging.
const withTimeout = (promise, ms) =>
  Promise.race([
    Promise.resolve(promise).catch(() => undefined),
    new Promise((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);

const safeParse = (raw) => {
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
};

/**
 * Locate the first cycle (and any serialization hazards) in a navigation state
 * tree WITHOUT serializing anything. Iterates enumerable own keys only — the
 * same surface JSON.stringify visits. Returns metadata only: key paths, route
 * name, param key, constructor names. Never values.
 */
export function diagnoseNavState(root) {
  const out = {
    found: false,
    cyclePath: null,      // path from root to the re-entrant reference
    firstSeenPath: null,  // path where the cycle target first appeared
    cycleCtor: null,
    routeName: null,      // deepest route whose subtree holds the cycle
    paramKey: null,       // top-level params key under which the cycle lives
    hazards: [],          // suspicious node types seen on the way (≤5)
    nodes: 0,
    bailed: false,
  };
  try {
    const MAX_NODES = 20000;
    const MAX_DEPTH = 50;
    const MAX_HAZARDS = 5;
    const onStack = new Map(); // object -> path string (current DFS ancestors)

    const walk = (node, path, depth, route, paramKey) => {
      if (out.found || out.bailed) return;
      if (++out.nodes > MAX_NODES || depth > MAX_DEPTH) { out.bailed = true; return; }
      if (node === null || typeof node !== 'object') return;

      if (onStack.has(node)) {
        out.found = true;
        out.cyclePath = path;
        out.firstSeenPath = onStack.get(node);
        out.cycleCtor = (node.constructor && node.constructor.name) || 'null-proto';
        out.routeName = route;
        out.paramKey = paramKey;
        return;
      }

      const ctor = node.constructor ? node.constructor.name : 'null-proto';
      if (out.hazards.length < MAX_HAZARDS) {
        if (ctor !== 'Object' && ctor !== 'Array') out.hazards.push(`${ctor}@${path}`);
        else if ('config' in node && 'request' in node) out.hazards.push(`axios-shape@${path}`);
        else if ('nativeEvent' in node || '_dispatchInstances' in node) out.hazards.push(`event-shape@${path}`);
      }

      // A route object carries its screen name — track the deepest one so the
      // eventual finding is attributed to the right screen.
      const childRoute = (typeof node.name === 'string' && ('params' in node || 'key' in node))
        ? node.name : route;

      onStack.set(node, path);
      const keys = Object.keys(node);
      const isParamsNode = path.endsWith('.params') || path === 'params';
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        let v;
        try { v = node[k]; } catch (e) { continue; } // a throwing getter is itself a hazard
        if (typeof v === 'function') {
          if (out.hazards.length < MAX_HAZARDS) out.hazards.push(`Function@${path}.${k}`);
          continue; // JSON.stringify drops functions — not a crash source
        }
        const childParamKey = isParamsNode ? k : paramKey;
        walk(v, path ? `${path}.${k}` : k, depth + 1, childRoute, childParamKey);
        if (out.found || out.bailed) break;
      }
      onStack.delete(node);
    };

    walk(root, '', 0, null, null);
  } catch (e) {
    out.bailed = true;
  }
  return out;
}

/**
 * Called from App.tsx when JSON.stringify of the navigation state throws.
 * Runs the walker, records session + cross-session correlation state, and
 * emits a dedicated non-fatal with route/param/constructor metadata.
 */
export function reportNavPersistFailure({ error, state, trigger }) {
  try {
    sessionDiag.navPersistFailCount += 1;
    const diag = diagnoseNavState(state);
    const route = diag.routeName || 'unknown';
    const paramKey = diag.paramKey || 'unknown';
    sessionDiag.lastNavPersistFail = { at: Date.now(), route, paramKey, trigger };

    // Cross-session marker (small hand-built literal — safe to stringify).
    AsyncStorage.setItem(
      NAV_FAIL_MARKER_KEY,
      JSON.stringify({ at: Date.now(), route, paramKey, trigger }),
    ).catch(() => {});

    let routeStack = 'unknown';
    try {
      routeStack = Array.isArray(state?.routes)
        ? state.routes.map((r) => r?.name || '?').join(',').slice(0, 100)
        : 'unknown';
    } catch (e) { /* metadata only — never fail */ }

    const trunc = (s, n) => (s ? String(s).slice(0, n) : 'null');

    safeCall(() => {
      crashlytics().log(
        `[NAV_PERSIST_FAIL] trigger=${trigger} route=${route} paramKey=${paramKey} ` +
        `ctor=${diag.cycleCtor || 'none'} found=${diag.found} bailed=${diag.bailed} nodes=${diag.nodes} ` +
        `path=${trunc(diag.cyclePath, 200)} hazards=${trunc(diag.hazards.join('|'), 200)}`
      );
    });

    const dedupKey = `nav_persist_fail:${route}:${paramKey}`;
    if (seenEvents.has(dedupKey)) return;
    seenEvents.add(dedupKey);

    safeCall(() => {
      crashlytics().setAttributes({
        nav_fail_trigger: trigger || 'unknown',
        nav_fail_route: route,
        nav_fail_param_key: paramKey,
        nav_fail_cycle_found: String(diag.found),
        nav_fail_cycle_path: trunc(diag.cyclePath, 200),
        nav_fail_first_seen_path: trunc(diag.firstSeenPath, 200),
        nav_fail_ctor: diag.cycleCtor || 'none',
        nav_fail_hazards: trunc(diag.hazards.join('|'), 200),
        nav_fail_route_stack: routeStack,
        nav_fail_walker_bailed: String(diag.bailed),
        nav_fail_count_session: String(sessionDiag.navPersistFailCount),
      });
      const wrapped = new Error(
        `Nav state persist failed: route=${route} paramKey=${paramKey} ctor=${diag.cycleCtor || 'none'} ` +
        `(${sanitizeMessage(error?.message) || 'no message'})`
      );
      wrapped.name = 'NavStatePersistNonFatal';
      crashlytics().recordError(wrapped);
    });
  } catch (e) {
    // Diagnostics must never become the incident.
  }
}

/**
 * Differential probe for the OTHER unguarded JSON.stringify sites
 * (usePersistedAuthFlow, AppContext profile compare, Alert message).
 * Distinct tags let production data say WHICH stringify was crashing.
 */
export function reportStringifyProbeFailure(tag, error) {
  try {
    safeCall(() => {
      crashlytics().log(`[${tag}_STRINGIFY_FAIL] msg=${sanitizeMessage(error?.message) || 'none'}`);
    });
    const dedupKey = `stringify_probe:${tag}`;
    if (seenEvents.has(dedupKey)) return;
    seenEvents.add(dedupKey);
    safeCall(() => {
      const wrapped = new Error(`Stringify probe failed: ${tag} (${sanitizeMessage(error?.message) || 'no message'})`);
      wrapped.name = 'StringifyProbeNonFatal';
      crashlytics().recordError(wrapped);
    });
  } catch (e) { /* never throw */ }
}

// ── Refresh-window / token-write markers ────────────────────────────────────
// Open BEFORE POST /refresh (the server may rotate the single-use token the
// moment the request arrives), close after the new pair is persisted. A marker
// still present at next boot ⇒ the app terminated inside the window.

export async function markRefreshWindowOpen(trigger) {
  try {
    await AsyncStorage.setItem(REFRESH_WINDOW_KEY, JSON.stringify({ at: Date.now(), trigger }));
  } catch (e) { /* best-effort */ }
}

export function markRefreshWindowClosed() {
  AsyncStorage.removeItem(REFRESH_WINDOW_KEY).catch(() => {});
}

export async function markTokenWriteStart() {
  try {
    await AsyncStorage.setItem(TOKEN_WRITE_KEY, String(Date.now()));
  } catch (e) { /* best-effort */ }
}

export function markTokenWriteEnd({ keychainOk, fallbackOk }) {
  sessionDiag.lastTokenWrite = { at: Date.now(), keychainOk: !!keychainOk, fallbackOk: !!fallbackOk };
  AsyncStorage.removeItem(TOKEN_WRITE_KEY).catch(() => {});
}

/**
 * Boot check (called once from validateAndRefreshTokens' telemetry block).
 * Consumes the cross-session markers and, if any are present, emits ONE
 * non-fatal describing how the previous session ended. This is the signal
 * that ties a logout to a crash/kill in the prior session.
 */
export async function checkPriorSessionMarkers() {
  try {
    const [navRaw, refRaw, twRaw] = await Promise.all([
      withTimeout(AsyncStorage.getItem(NAV_FAIL_MARKER_KEY), 1000),
      withTimeout(AsyncStorage.getItem(REFRESH_WINDOW_KEY), 1000),
      withTimeout(AsyncStorage.getItem(TOKEN_WRITE_KEY), 1000),
    ]);
    const prev = {
      navFail: safeParse(navRaw),
      refreshInterrupted: safeParse(refRaw),
      tokenWriteInterruptedAt: twRaw ? Number(twRaw) : null,
    };
    sessionDiag.prevSession = prev;
    AsyncStorage.multiRemove([NAV_FAIL_MARKER_KEY, REFRESH_WINDOW_KEY, TOKEN_WRITE_KEY]).catch(() => {});

    if (prev.navFail || prev.refreshInterrupted || prev.tokenWriteInterruptedAt) {
      safeCall(() => {
        crashlytics().log(
          `[PRIOR_SESSION] navFail=${!!prev.navFail} navFailRoute=${prev.navFail?.route || 'none'} ` +
          `refreshInterrupted=${!!prev.refreshInterrupted} refreshTrigger=${prev.refreshInterrupted?.trigger || 'none'} ` +
          `tokenWriteInterrupted=${!!prev.tokenWriteInterruptedAt}`
        );
        crashlytics().setAttributes({
          prev_session_nav_fail: String(!!prev.navFail),
          prev_session_nav_fail_route: prev.navFail?.route || 'none',
          prev_session_nav_fail_param: prev.navFail?.paramKey || 'none',
          prev_session_refresh_interrupted: String(!!prev.refreshInterrupted),
          prev_session_refresh_trigger: prev.refreshInterrupted?.trigger || 'none',
          prev_session_token_write_interrupted: String(!!prev.tokenWriteInterruptedAt),
        });
        const wrapped = new Error(
          `Prior session ended abnormally: navFail=${!!prev.navFail} ` +
          `refreshInterrupted=${!!prev.refreshInterrupted} tokenWriteInterrupted=${!!prev.tokenWriteInterruptedAt}`
        );
        wrapped.name = 'PriorSessionDiagnostic';
        crashlytics().recordError(wrapped);
      });
    }
  } catch (e) { /* never affect startup */ }
}

/**
 * Shared logout-context gatherer: storage truth (Keychain / fallback /
 * userData), token expiry, refresh-in-flight, current route, and nav-persist
 * failure correlation for THIS session and the PREVIOUS one. All probes are
 * parallel, time-boxed, and read-only.
 */
async function gatherLogoutContext() {
  const ctx = {
    logout_route: 'unknown',
    logout_refresh_in_progress: 'unknown',
    logout_keychain_had_tokens: 'unknown',
    logout_fallback_had_tokens: 'unknown',
    logout_user_data_present: 'unknown',
    logout_access_token_expired: 'unknown',
    logout_refresh_token_present: 'unknown',
    logout_last_token_write: 'none_this_session',
    logout_nav_fail_before: 'false',
    logout_nav_fail_count: '0',
    logout_nav_fail_route: 'none',
    logout_nav_fail_ms_ago: 'n/a',
    logout_prev_session_nav_fail: 'unknown',
    logout_prev_session_refresh_interrupted: 'unknown',
  };
  try { ctx.logout_route = navContextProvider?.().route || 'unknown'; } catch (e) { /* keep default */ }
  try { ctx.logout_refresh_in_progress = String(!!refreshStateProvider?.().inProgress); } catch (e) { /* keep default */ }

  ctx.logout_nav_fail_count = String(sessionDiag.navPersistFailCount);
  ctx.logout_nav_fail_before = String(sessionDiag.navPersistFailCount > 0);
  if (sessionDiag.lastNavPersistFail) {
    ctx.logout_nav_fail_route = sessionDiag.lastNavPersistFail.route;
    ctx.logout_nav_fail_ms_ago = String(Date.now() - sessionDiag.lastNavPersistFail.at);
  }
  if (sessionDiag.lastTokenWrite) {
    ctx.logout_last_token_write =
      `kc=${sessionDiag.lastTokenWrite.keychainOk} fb=${sessionDiag.lastTokenWrite.fallbackOk} ` +
      `${Math.round((Date.now() - sessionDiag.lastTokenWrite.at) / 1000)}s_ago`;
  }
  if (sessionDiag.prevSession) {
    ctx.logout_prev_session_nav_fail = String(!!sessionDiag.prevSession.navFail);
    ctx.logout_prev_session_refresh_interrupted = String(!!sessionDiag.prevSession.refreshInterrupted);
  }

  try {
    // STRICTLY READ-ONLY probes. Deliberately NOT storage.getTokens(): that
    // function re-mirrors the pair to the fallback store and re-primes
    // Keychain on read — under our timeout, an abandoned slow read could
    // land those writes AFTER the caller's clearTokens(), resurrecting a
    // cleared session. Token facts come from the fallback payload directly.
    const storage = require('./storage'); // lazy: storage.js imports this module
    const [probe, fallbackRaw, userDataRaw] = await Promise.all([
      withTimeout(storage.probeStorageState(), 1500), // read-only by contract
      withTimeout(AsyncStorage.getItem('@auth_tokens_fallback'), 1000), // STORAGE_KEYS.TOKENS_FALLBACK
      withTimeout(AsyncStorage.getItem('userData'), 1000), // STORAGE_KEYS.USER_DATA
    ]);
    if (probe) {
      ctx.logout_keychain_had_tokens = String(!!probe.keychainHadTokens);
      ctx.logout_fallback_had_tokens = String(!!probe.fallbackHadTokens);
    }
    const tokens = safeParse(fallbackRaw);
    if (tokens) {
      ctx.logout_refresh_token_present = String(!!tokens.refreshToken);
      ctx.logout_access_token_expired = tokens.expiryTime
        ? String(Date.now() >= tokens.expiryTime)
        : 'no_expiry';
    } else if (fallbackRaw !== undefined) {
      ctx.logout_refresh_token_present = 'false';
      ctx.logout_access_token_expired = 'no_tokens';
    }
    ctx.logout_user_data_present = String(!!userDataRaw);
  } catch (e) { /* leave unknowns */ }

  return ctx;
}

/**
 * One event per authenticated→logged-out transition on the paths that today
 * emit NOTHING (background /users/me check, boot userData loss, validate
 * throw, user/infra logout). `reason` must be unique per call site.
 *
 * @param {Object} params
 * @param {string} params.reason        unique reason code for this path
 * @param {string} [params.detail]      short safe detail (already sanitized by caller)
 * @param {number} [params.httpStatus]
 * @param {boolean} [params.onlyIfTokensPresent] skip the non-fatal when neither
 *        store holds tokens (used at boot so genuinely logged-out users and
 *        fresh installs don't generate noise).
 */
export async function reportSilentLogout({ reason, detail = null, httpStatus = null, onlyIfTokensPresent = false, lite = false }) {
  try {
    // `lite`: breadcrumb + non-fatal only, NO storage probes and NO
    // setAttributes. Used by auth_expired_signal, which fires AFTER apiClient
    // already cleared tokens — probing there records post-clear state and its
    // attributes would overwrite the correct pre-clear values the
    // ForcedLogoutNonFatal just set for this Crashlytics session.
    if (lite) {
      safeCall(() => {
        crashlytics().log(`[LOGOUT_DIAG] reason=${reason} status=${httpStatus ?? 'n/a'} detail=${detail || 'none'} (lite)`);
        const wrapped = new Error(`Logout: reason=${reason} (lite)`);
        wrapped.name = 'LogoutDiagnostic';
        crashlytics().recordError(wrapped);
      });
      return;
    }

    const ctx = await gatherLogoutContext();

    if (onlyIfTokensPresent &&
        ctx.logout_keychain_had_tokens !== 'true' &&
        ctx.logout_fallback_had_tokens !== 'true') {
      safeCall(() => crashlytics().log(`[LOGOUT_DIAG_SKIPPED] reason=${reason} (no tokens present)`));
      return;
    }

    safeCall(() => {
      crashlytics().log(
        `[LOGOUT_DIAG] reason=${reason} status=${httpStatus ?? 'n/a'} detail=${detail || 'none'} ` +
        `route=${ctx.logout_route} kc=${ctx.logout_keychain_had_tokens} fb=${ctx.logout_fallback_had_tokens} ` +
        `userData=${ctx.logout_user_data_present} navFailBefore=${ctx.logout_nav_fail_before}`
      );
      crashlytics().setAttributes({
        logout_reason: reason,
        logout_detail: detail ? String(detail).slice(0, 100) : 'none',
        logout_http_status: String(httpStatus ?? 'n/a'),
        logout_at: new Date().toISOString(),
        ...ctx,
      });
      const wrapped = new Error(
        `Logout: reason=${reason} route=${ctx.logout_route} navFailBefore=${ctx.logout_nav_fail_before} ` +
        `prevSessionNavFail=${ctx.logout_prev_session_nav_fail}`
      );
      wrapped.name = 'LogoutDiagnostic';
      crashlytics().recordError(wrapped);
    });
  } catch (e) { /* never block a logout */ }
}

export default {
  reportKeychainFailure,
  reportFallbackRescued,
  reportForcedLogout,
  reportStorageState,
  logBreadcrumb,
  diagnoseNavState,
  reportNavPersistFailure,
  reportStringifyProbeFailure,
  reportSilentLogout,
  markRefreshWindowOpen,
  markRefreshWindowClosed,
  markTokenWriteStart,
  markTokenWriteEnd,
  checkPriorSessionMarkers,
  setNavContextProvider,
  setRefreshStateProvider,
};
