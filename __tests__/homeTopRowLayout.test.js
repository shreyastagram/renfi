import { computeTopRowLayout, MIN_MAP_WIDTH, TOP_ROW_GAP } from '../src/utils/homeTopRowLayout';

// Usable row width = screen width − 36 (18 px page padding each side).
const PHONES = [280, 320, 340, 360, 375, 390, 393, 411, 428, 480].map((w) => w - 36);
const SCALES = [0.85, 1, 1.15, 1.3, 2];

describe('computeTopRowLayout', () => {
  test.each(PHONES)('row width %i: tiles never exceed the row', (width) => {
    for (const fontScale of SCALES) {
      for (const showVerification of [true, false]) {
        const l = computeTopRowLayout({ width, fontScale, showVerification });
        if (l.stacked) {
          // Stacked: verification + toggle share the first line (flex), map is full width.
          expect(l.mapWidth).toBeLessThan(MIN_MAP_WIDTH);
        } else {
          const used = l.mapWidth + l.toggleWidth + TOP_ROW_GAP + (showVerification ? l.sideWidth + TOP_ROW_GAP : 0);
          expect(used).toBe(width);
          expect(l.mapWidth).toBeGreaterThanOrEqual(MIN_MAP_WIDTH);
        }
        expect(l.sideWidth).toBeGreaterThanOrEqual(78);
        expect(l.toggleWidth).toBeGreaterThanOrEqual(82);
      }
    }
  });

  test('common phones keep a single row at normal font size', () => {
    for (const w of [360, 375, 393, 411].map((x) => x - 36)) {
      expect(computeTopRowLayout({ width: w, fontScale: 1, showVerification: true }).stacked).toBe(false);
    }
  });

  test('very narrow phones fall back to two lines', () => {
    expect(computeTopRowLayout({ width: 280 - 36, fontScale: 1, showVerification: true }).stacked).toBe(true);
  });

  test('tile height grows with font scale but is capped', () => {
    expect(computeTopRowLayout({ width: 324, fontScale: 1, showVerification: true }).tileHeight).toBe(92);
    expect(computeTopRowLayout({ width: 324, fontScale: 3, showVerification: true }).tileHeight).toBe(110);
    expect(computeTopRowLayout({ width: 324, fontScale: NaN, showVerification: true }).tileHeight).toBe(92);
  });
});
