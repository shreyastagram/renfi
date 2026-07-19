/**
 * Meta App Events + Firebase Analytics — Core Analytics Service
 *
 * The ONLY file that talks to the Meta and Firebase SDKs. Screens/services
 * import `Analytics` + `EV` from 'src/services/analytics' and never touch
 * either SDK. Every track/purchase/user call is mirrored to both: Meta App
 * Events (ad optimization) and Firebase Analytics/GA4 (product analytics).
 *
 * Guarantees:
 * - Never crashes the app: SDK is lazily required; every call is try/caught
 *   and silently no-ops if the native module is absent or unconfigured.
 * - Meta constraints enforced: event names ≤40 chars; ≤25 params per event;
 *   param values coerced to string/number; nullish params dropped.
 * - Standard-event dual logging (STANDARD_MAP) for ad-delivery optimization.
 * - __DEV__ echo so events are visible in Metro logs during development.
 *
 * Offline/retry: the Meta SDK persists events locally and flushes in batches
 * automatically (default flush behavior) — no custom retry queue is needed.
 *
 * Docs: docs/META_APP_EVENTS.md
 */

import { STANDARD_MAP } from './events';

/**
 * TEMPORARY release-visible debug logging — REMOVE after Meta Events Manager
 * verification. babel's transform-remove-console strips direct `console.*`
 * calls in production bundles; going through `global.console` survives the
 * strip so these lines reach `adb logcat` (ReactNativeJS tag) in RELEASE
 * builds too. Filter with:  adb logcat | grep MetaDebug
 */
const DEBUG_ANALYTICS = false;
const dbg = (...args) => {
  if (!DEBUG_ANALYTICS && !__DEV__) return;
  const c = global.console;
  if (c && c.log) c.log('[MetaDebug]', ...args);
};

// Lazy, crash-proof SDK access. Resolved once.
let _sdk = null; // { logger, settings } | false (unavailable)
const getSdk = () => {
  if (_sdk !== null) return _sdk;
  try {
    // Lazy require: keeps the app alive even if the package is absent.
    // The JS wrapper always exposes logEvent, so also probe the NATIVE module
    // (missing when pods/gradle haven't linked it) to avoid caching a
    // half-working handle.
    const { NativeModules } = require('react-native');
    const { AppEventsLogger, Settings } = require('react-native-fbsdk-next');
    const nativePresent = !!NativeModules.FBAppEventsLogger;
    const constantsPresent = !!(AppEventsLogger && AppEventsLogger.AppEvents);
    dbg('getSdk: jsWrapper=', !!AppEventsLogger, 'nativeModule=', nativePresent, 'constants=', constantsPresent);
    if (!AppEventsLogger || !nativePresent) {
      dbg('getSdk: SDK UNAVAILABLE — all analytics calls will no-op');
      _sdk = false;
    } else {
      _sdk = { logger: AppEventsLogger, settings: Settings };
    }
  } catch (e) {
    dbg('getSdk: require FAILED:', e?.message);
    _sdk = false;
  }
  return _sdk;
};

// Lazy, crash-proof Firebase Analytics access. Resolved once.
// Mirrors every event to GA4 alongside Meta; same no-op guarantee if the
// package is absent or the native module isn't linked.
let _fb = null; // { mod, instance } | false (unavailable)
const getFb = () => {
  if (_fb !== null) return _fb;
  try {
    const mod = require('@react-native-firebase/analytics');
    const instance = mod.getAnalytics();
    _fb = { mod, instance };
    dbg('getFb: Firebase Analytics ready');
  } catch (e) {
    dbg('getFb: require FAILED — Firebase events will no-op:', e?.message);
    _fb = false;
  }
  return _fb;
};

// GA4 event names: letters/digits/underscores only, must start with a letter.
const toGa4Name = (name) => {
  const n = String(name).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
  return /^[a-zA-Z]/.test(n) ? n : `e_${n}`.slice(0, 40);
};

/** Coerce params to Meta-safe shape: string/number values, ≤25 keys. */
const sanitizeParams = (params) => {
  if (!params || typeof params !== 'object') return undefined;
  const out = {};
  let count = 0;
  for (const [key, raw] of Object.entries(params)) {
    if (count >= 25) break; // Meta hard limit: 25 parameters per event
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'number' && !isFinite(raw)) continue; // drop NaN/Infinity
    const k = String(key).slice(0, 40);
    let v;
    if (typeof raw === 'number') v = raw;
    else if (typeof raw === 'boolean') v = raw ? 'true' : 'false';
    else if (typeof raw === 'object') {
      // Avoid '[object Object]' garbage — serialize, or drop if unserializable
      try { v = JSON.stringify(raw).slice(0, 100); } catch (e) { continue; }
    } else v = String(raw).slice(0, 100);
    out[k] = v;
    count++;
  }
  return count > 0 ? out : undefined;
};

const Analytics = {
  /**
   * Initialize the SDK from JS (native side auto-inits via manifest/AppDelegate;
   * this is a belt-and-braces call, safe to invoke multiple times).
   */
  init() {
    dbg('init() called');
    const sdk = getSdk();
    if (!sdk) {
      dbg('init: SDK unavailable — analytics disabled (no-op mode)');
      return;
    }
    try {
      sdk.settings?.initializeSDK?.();
      dbg('init: Settings.initializeSDK() OK');
    } catch (e) {
      dbg('init: initializeSDK FAILED (non-fatal):', e?.message);
    }
  },

  /**
   * Log an event from the EV catalog. Fire ONLY after the action succeeded.
   * Also dual-logs the mapped Meta standard event when one exists.
   *
   * @param {string} eventName - value from EV (never a raw string literal)
   * @param {Object} [params] - flat key/value params (string|number|boolean)
   */
  track(eventName, params) {
    if (!eventName || typeof eventName !== 'string') return;
    const name = eventName.slice(0, 40); // Meta limit: 40-char event names
    const safeParams = sanitizeParams(params);

    // Firebase/GA4 mirror — independent of the Meta SDK's availability
    const fb = getFb();
    if (fb) {
      try {
        fb.mod
          .logEvent(fb.instance, toGa4Name(name), safeParams)
          .catch((e) => dbg('track: firebase logEvent FAILED:', name, e?.message));
      } catch (e) {
        dbg('track: firebase logEvent THREW:', name, e?.message);
      }
    }

    const sdk = getSdk();
    dbg('track:', name, safeParams ? JSON.stringify(safeParams) : '(no params)', sdk ? '' : '→ DROPPED (no SDK)');
    if (!sdk) return;
    try {
      if (safeParams) sdk.logger.logEvent(name, safeParams);
      else sdk.logger.logEvent(name);
      dbg('track: logEvent dispatched →', name);

      // Dual-log the Meta standard event (powers ad optimization)
      const standardKey = STANDARD_MAP[eventName];
      const standardName = standardKey && sdk.logger.AppEvents?.[standardKey];
      if (standardName) {
        if (safeParams) sdk.logger.logEvent(standardName, safeParams);
        else sdk.logger.logEvent(standardName);
        dbg('track: standard dual-log →', standardName);
      }
    } catch (e) {
      dbg('track FAILED:', name, e?.message);
    }
  },

  /**
   * Log a monetary purchase (Meta value optimization).
   * @param {number} amount - e.g. 499.00
   * @param {string} currency - ISO 4217, e.g. 'INR'
   * @param {Object} [params]
   */
  trackPurchase(amount, currency, params) {
    const value = Number(amount);
    if (!isFinite(value) || value <= 0 || !currency) return;

    const fb = getFb();
    if (fb) {
      try {
        fb.mod
          .logEvent(fb.instance, 'purchase', {
            value,
            currency: String(currency),
            ...(sanitizeParams(params) || {}),
          })
          .catch((e) => dbg('trackPurchase: firebase FAILED:', e?.message));
      } catch (e) {
        dbg('trackPurchase: firebase THREW:', e?.message);
      }
    }

    const sdk = getSdk();
    dbg('trackPurchase:', value, currency, sdk ? '' : '→ DROPPED (no SDK)');
    if (!sdk) return;
    try {
      sdk.logger.logPurchase(value, String(currency), sanitizeParams(params));
      dbg('trackPurchase: dispatched');
    } catch (e) {
      dbg('trackPurchase FAILED:', e?.message);
    }
  },

  /** Associate events with the app user (improves attribution). */
  setUser(userId) {
    if (!userId) return;
    const fb = getFb();
    if (fb) {
      try {
        fb.mod
          .setUserId(fb.instance, String(userId))
          .catch((e) => dbg('setUser: firebase FAILED:', e?.message));
      } catch (e) {
        dbg('setUser: firebase THREW:', e?.message);
      }
    }
    const sdk = getSdk();
    if (!sdk) return;
    try {
      sdk.logger.setUserID(String(userId));
    } catch (e) {
      dbg('setUser FAILED:', e?.message);
    }
  },

  /** Clear the user association on logout. */
  clearUser() {
    const fb = getFb();
    if (fb) {
      try {
        fb.mod
          .setUserId(fb.instance, null)
          .catch((e) => dbg('clearUser: firebase FAILED:', e?.message));
      } catch (e) {
        dbg('clearUser: firebase THREW:', e?.message);
      }
    }
    const sdk = getSdk();
    if (!sdk) return;
    try {
      sdk.logger.setUserID(null);
    } catch (e) {
      dbg('clearUser FAILED:', e?.message);
    }
  },

  /** Force-flush queued events (e.g. right after a critical conversion). */
  flush() {
    const sdk = getSdk();
    if (!sdk) return;
    try {
      sdk.logger.flush();
      dbg('flush: requested');
    } catch (e) {
      dbg('flush FAILED:', e?.message);
    }
  },
};

export default Analytics;
