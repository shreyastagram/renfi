/**
 * Palette keys that are looked up at RUNTIME must never be renamed.
 *
 * WHY THIS EXISTS
 *
 * Some palette groups are not read as `group.someName` but indexed by a value
 * that arrives from the backend:
 *
 *   const accent = SERVICE_COLORS[service.id] || C.secondary;   // UserHomeScreen
 *   iconAccent['in-progress']                                    // Icon.jsx
 *
 * So `categoryAccent.electrician` is not a variable name, it is a contract with
 * whatever the API calls that service. Rename it to `electric` and nothing
 * fails: the lookup returns undefined, falls through to the default, and every
 * electrician in the app quietly turns the wrong colour. No gate sees it —
 * check:hex sees a valid literal, check:tokens only inspects `makeC`, and
 * eslint sees a property access on a defined object.
 *
 * Recolouring is expected and fine; these assertions deliberately check only
 * the KEYS, never the values. Adding a key is fine too — a new service can
 * appear. Removing or renaming one is what breaks, so that is what fails here.
 *
 * If a service really is renamed backend-side, update the list in the same
 * commit as the palette, so the two move together on purpose.
 */

import { categoryAccent, iconAccent } from '../tokens/palette';

// Backend service ids. Source of truth is the API; this mirrors it.
const SERVICE_IDS = [
  'electrician',
  'plumber',
  'electronics_technician',
  'carpenter',
  'painter',
  'solar_repairing',
  'welder',
  'salon',
  'vehicle_cleaning',
  'mason_tiler',
  'driver',
  'ac_repair',
];

describe('palette keys used as runtime lookups', () => {
  it('keeps every backend service id in categoryAccent', () => {
    for (const id of SERVICE_IDS) {
      expect(categoryAccent).toHaveProperty(id);
      expect(typeof categoryAccent[id]).toBe('string');
    }
  });

  it('gives each service a colour that is actually a colour', () => {
    for (const id of SERVICE_IDS) {
      expect(categoryAccent[id]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('keeps the hyphenated iconAccent keys that are indexed with brackets', () => {
    // These cannot be reached with dot notation, so a rename is easy to miss.
    for (const key of ['in-progress', 'close-circle', 'check-circle']) {
      expect(iconAccent).toHaveProperty(key);
    }
  });

  it('keeps the request-status keys, which are indexed by the API status string', () => {
    // These live in iconAccent, and the value comes straight off a service
    // request, so the key set is a contract with the backend too.
    for (const key of ['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'rejected']) {
      expect(iconAccent).toHaveProperty(key);
    }
  });

  it('keeps service colours distinguishable from one another', () => {
    // The whole point of a per-category hue is telling them apart. Two services
    // sharing one colour is a recolour that went wrong, not a design choice.
    const seen = new Map();
    for (const id of SERVICE_IDS) {
      const hex = categoryAccent[id].toLowerCase();
      expect(seen.has(hex)).toBe(false);
      seen.set(hex, id);
    }
  });
});
