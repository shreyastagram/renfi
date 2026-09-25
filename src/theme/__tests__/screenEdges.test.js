const { ALL_EDGES } = require('../../components/screenEdges');

describe('Screen edge defaults', () => {
  // Regression guard. `Screen` replaces SafeAreaView at call sites that mostly
  // omitted `edges` entirely. SafeAreaView's own default is all four edges, so
  // ALL_EDGES must stay all four or swapping in `Screen` would silently drop
  // the bottom inset on 14 screens — a real bug on 3-button navigation, which
  // matters because targetSdk 36 enforces edge-to-edge.
  it('defaults to all four edges, matching SafeAreaView', () => {
    expect([...ALL_EDGES].sort()).toEqual(['bottom', 'left', 'right', 'top']);
  });

  it('is exactly four entries — no duplicates, nothing missing', () => {
    expect(ALL_EDGES).toHaveLength(4);
    expect(new Set(ALL_EDGES).size).toBe(4);
  });
});
