/**
 * Offline detection derived from the app's OWN traffic.
 *
 * WHY NOT NetInfo
 *
 * The obvious tool is `@react-native-community/netinfo` and its
 * `isInternetReachable`. That flag is produced by a probe the library fires on
 * a timer, and on a slow or memory-pressured device the probe times out while
 * the connection is fine. The result is the exact failure the owner reported:
 * a phone with working internet showing "no network connection". Adding that
 * library would be re-introducing the bug we are trying to prevent.
 *
 * WHAT THIS DOES INSTEAD
 *
 * The app already talks to two backends continuously, and apiClient already
 * classifies failures with `isTransientNetworkError`. That traffic IS the
 * reachability probe — a real one, against the servers that actually matter,
 * with no extra battery or CPU cost. This module turns it into a state.
 *
 * FOUR RULES, EACH ONE GUARDING AGAINST A FALSE POSITIVE
 *
 *  1. Only *network* failures count. A 404 or a 500 is a RESPONSE: the packet
 *     reached the server and came back, so the internet demonstrably works.
 *     Those never mark the app offline no matter how many arrive.
 *
 *  2. One failure is never enough. Render cold-starts and slow radios produce
 *     isolated timeouts constantly. It takes MIN_FAILURES consecutive ones.
 *
 *  3. A failure within GRACE_MS of a success is ignored for the purpose of
 *     going offline. Several requests usually fly in parallel; if one of them
 *     came back just now, the device is plainly online and the others are
 *     merely slow. This is the rule that protects low-RAM phones, where
 *     parallel requests are slow enough to trip timeouts while others succeed.
 *
 *  4. ANY success clears offline instantly. The dangerous direction is being
 *     stuck showing an offline banner on a working phone, so recovery is
 *     immediate and unconditional while entering the state is conservative.
 *
 * The cost of this design is that it cannot detect offline before the app has
 * made a request. That is acceptable: the banner exists to explain why
 * something failed, and nothing has failed yet.
 */

// Consecutive qualifying failures required before we claim to be offline.
const MIN_FAILURES = 2;

// A failure this close to a successful response does not count toward going
// offline. Sized above a slow-device round trip, below a user's patience.
const GRACE_MS = 8000;

let consecutiveFailures = 0;
let lastSuccessAt = 0;
let offline = false;

const listeners = new Set();

const emit = () => {
  for (const fn of listeners) {
    try {
      fn(offline);
    } catch (e) {
      // A bad subscriber must not take the others down with it.
      console.warn('[network] listener threw:', e?.message);
    }
  }
};

const setOffline = (next) => {
  if (offline === next) return;
  offline = next;
  console.log(`🌐 [network] ${next ? 'OFFLINE' : 'online'}`);
  emit();
};

/**
 * A request came back — any status at all. The server was reachable.
 */
export const reportReachable = (now = Date.now()) => {
  lastSuccessAt = now;
  consecutiveFailures = 0;
  setOffline(false);
};

/**
 * A request failed without a response. Only call this for errors that
 * apiClient has already classified as a network failure.
 */
export const reportUnreachable = (now = Date.now()) => {
  // Rule 3 — something worked moments ago, so this is slowness, not absence.
  if (lastSuccessAt && now - lastSuccessAt < GRACE_MS) return;

  consecutiveFailures += 1;
  if (consecutiveFailures >= MIN_FAILURES) setOffline(true);
};

export const isOffline = () => offline;

/**
 * Subscribe to changes. Fires immediately with the current value so a mounting
 * component does not have to wait for the next transition.
 */
export const subscribeToNetwork = (fn) => {
  listeners.add(fn);
  // Guarded exactly like emit(). A subscriber that throws on its first call
  // would otherwise take down whatever component was mounting.
  try {
    fn(offline);
  } catch (e) {
    console.warn('[network] listener threw on subscribe:', e?.message);
  }
  return () => listeners.delete(fn);
};

/** Test seam — resets module state between cases. */
export const __resetNetworkStatus = () => {
  consecutiveFailures = 0;
  lastSuccessAt = 0;
  offline = false;
  listeners.clear();
};

export default { reportReachable, reportUnreachable, isOffline, subscribeToNetwork };
