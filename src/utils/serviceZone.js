/**
 * Service Zone Geofence — Yavatmal City Boundary (Client-Side)
 * 
 * Client-side implementation of the service zone check.
 * Mirrors the backend serviceZone.js for real-time zone validation
 * during provider registration without needing a network call.
 * 
 * @version 1.0.0
 */

/**
 * Yavatmal City Service Zone polygon.
 * Each point is [latitude, longitude].
 * First point == last point (closed polygon).
 */
const YAVATMAL_ZONE_POLYGON = [
  [20.379949,  78.0673621],
  [20.3602247, 78.0897582],
  [20.3580028, 78.1022153],
  [20.3563219, 78.1107305],
  [20.3597217, 78.116052 ],
  [20.3623096, 78.1196904],
  [20.3698109, 78.1373999],
  [20.3715811, 78.1490729],
  [20.375926,  78.1518195],
  [20.3791444, 78.1550811],
  [20.3855809, 78.1605742],
  [20.3910518, 78.1629775],
  [20.3973269, 78.1628058],
  [20.404889,  78.1604026],
  [20.411968,  78.1511328],
  [20.4158291, 78.1473563],
  [20.4206554, 78.1473563],
  [20.4246772, 78.1495879],
  [20.4360985, 78.1495879],
  [20.437707,  78.1398032],
  [20.4335247, 78.1341384],
  [20.4232293, 78.1331084],
  [20.4201728, 78.1226371],
  [20.4169552, 78.1171439],
  [20.4140594, 78.1040976],
  [20.4111635, 78.0946562],
  [20.4011884, 78.0822966],
  [20.379949,  78.0673621],
];

const ZONE_INFO = {
  name: 'Yavatmal City',
  state: 'Maharashtra',
  country: 'India',
  bounds: {
    minLat: 20.3563219,
    maxLat: 20.437707,
    minLng: 78.0673621,
    maxLng: 78.1629775,
  },
};

/**
 * Ray-casting algorithm for point-in-polygon test.
 */
function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];

    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Quick bounding-box pre-check.
 */
function isInBoundingBox(lat, lng) {
  const { minLat, maxLat, minLng, maxLng } = ZONE_INFO.bounds;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/**
 * Check if a GPS coordinate is inside the Yavatmal service zone.
 * 
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} true if inside the service zone
 */
export function isInsideServiceZone(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (!isInBoundingBox(lat, lng)) return false;
  return pointInPolygon(lat, lng, YAVATMAL_ZONE_POLYGON);
}

/**
 * Get a human-readable zone status.
 * 
 * @param {number} lat
 * @param {number} lng
 * @returns {{ inside: boolean, zoneName: string, message: string }}
 */
export function getZoneStatus(lat, lng) {
  const inside = isInsideServiceZone(lat, lng);
  return {
    inside,
    zoneName: ZONE_INFO.name,
    message: inside
      ? `You're within the ${ZONE_INFO.name} service area ✓`
      : `Your location is outside the ${ZONE_INFO.name} service area. FixHomi is currently available only in ${ZONE_INFO.name}, ${ZONE_INFO.state}.`,
  };
}

export { ZONE_INFO };
export default { isInsideServiceZone, getZoneStatus, ZONE_INFO };
