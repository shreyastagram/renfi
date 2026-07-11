/**
 * Tab-bar adaptive tone — shared singleton (no context, no re-renders).
 *
 * Screens mark dark surfaces with <TabBarDarkZone>; zones report what
 * fraction of the floating tab bar they cover. The bar subscribes and
 * flips its material light/dark (fraction + hysteresis, iOS-style).
 *
 * Module-level on purpose: the bar and zones live in different trees, and
 * a context would re-render the navigator on every scroll tick.
 */

const zones = new Map(); // zoneId -> fraction (0..1)
const listeners = new Set();
let barRect = null; // { top, bottom } in window coords — set by FloatingTabBar

const aggregate = () => {
  let max = 0;
  zones.forEach((f) => {
    if (f > max) max = f;
  });
  return max;
};

const notify = () => {
  const frac = aggregate();
  listeners.forEach((l) => {
    try {
      l(frac);
    } catch (e) {
      // listener errors must never break scrolling
    }
  });
};

/** FloatingTabBar publishes its window-space rect (top/bottom). */
export const setBarRect = (rect) => {
  barRect = rect;
};

/** Dark zones read the bar rect to compute overlap. */
export const getBarRect = () => barRect;

/** A dark zone reports the fraction of the bar it currently covers. */
export const setZoneFraction = (zoneId, fraction) => {
  const prev = zones.get(zoneId) || 0;
  const next = Math.max(0, Math.min(1, fraction || 0));
  if (Math.abs(prev - next) < 0.02) return; // ignore sub-2% jitter
  zones.set(zoneId, next);
  notify();
};

/** Remove a zone entirely (unmount). */
export const clearZone = (zoneId) => {
  if (zones.delete(zoneId)) notify();
};

/** The bar subscribes to aggregated dark coverage. Returns unsubscribe. */
export const subscribeTone = (listener) => {
  listeners.add(listener);
  listener(aggregate());
  return () => listeners.delete(listener);
};
