import { distanceMeters, shouldPersistLocation, PERSIST_MIN_DISTANCE_M, PERSIST_MIN_INTERVAL_MS } from '../src/utils/locationThrottle';

const YAVATMAL = { latitude: 20.3899, longitude: 78.1200 };
const at = (ms) => new Date('2026-09-14T10:00:00Z').getTime() + ms;

describe('distanceMeters', () => {
  test('same point is 0', () => {
    expect(distanceMeters(YAVATMAL, YAVATMAL)).toBe(0);
  });
  test('~111 m per 0.001° of latitude', () => {
    const d = distanceMeters(YAVATMAL, { ...YAVATMAL, latitude: 20.3909 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(115);
  });
});

describe('shouldPersistLocation', () => {
  const last = { ...YAVATMAL, at: at(0) };

  test('first fix always persists', () => {
    expect(shouldPersistLocation(null, YAVATMAL, at(0))).toBe(true);
  });

  test('stationary before the heartbeat window → skip', () => {
    expect(shouldPersistLocation(last, YAVATMAL, at(PERSIST_MIN_INTERVAL_MS - 1000))).toBe(false);
  });

  test('stationary after the heartbeat window → send', () => {
    expect(shouldPersistLocation(last, YAVATMAL, at(PERSIST_MIN_INTERVAL_MS + 1))).toBe(true);
  });

  test('moved far enough → send immediately', () => {
    const moved = { latitude: 20.3920, longitude: 78.1200 }; // ~230 m
    expect(distanceMeters(last, moved)).toBeGreaterThan(PERSIST_MIN_DISTANCE_M);
    expect(shouldPersistLocation(last, moved, at(5000))).toBe(true);
  });

  test('small GPS jitter → skip', () => {
    const jitter = { latitude: 20.38993, longitude: 78.12004 }; // a few metres
    expect(shouldPersistLocation(last, jitter, at(5000))).toBe(false);
  });

  test('invalid coordinates never persist', () => {
    expect(shouldPersistLocation(last, null, at(0))).toBe(false);
    expect(shouldPersistLocation(last, { latitude: 'x', longitude: 1 }, at(0))).toBe(false);
  });
});
