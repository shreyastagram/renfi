/**
 * When a provider's location is worth sending to the server.
 *
 * Before: the foreground sender persisted a fix every 10 seconds whether or not
 * the provider had moved (~8,600 writes/day/provider, and a GPS read whenever
 * the shared cache was stale). Since work hours — not location age — now decide
 * who is searchable, position only needs to be accurate enough for distance
 * sorting. So: send when the provider actually moved, plus a slow heartbeat.
 */

export const PERSIST_MIN_DISTANCE_M = 100;
export const PERSIST_MIN_INTERVAL_MS = 5 * 60 * 1000;

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

const isCoord = (c) => !!c && typeof c.latitude === 'number' && typeof c.longitude === 'number'
  && Number.isFinite(c.latitude) && Number.isFinite(c.longitude);

/** Haversine distance in metres. */
export function distanceMeters(a, b) {
  if (!isCoord(a) || !isCoord(b)) return Infinity;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * @param {{latitude, longitude, at}|null} last previously persisted fix
 * @param {{latitude, longitude}} coords candidate fix
 * @param {number} now epoch ms
 */
export function shouldPersistLocation(last, coords, now) {
  if (!isCoord(coords)) return false;
  if (!last) return true;
  if (now - last.at >= PERSIST_MIN_INTERVAL_MS) return true;
  return distanceMeters(last, coords) >= PERSIST_MIN_DISTANCE_M;
}
