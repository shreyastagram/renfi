/**
 * The floating tab bar must follow the app theme, not only scroll position.
 *
 * WHY THIS EXISTS
 *
 * tabBarTone.js does NOT sample what is underneath the bar. It reads explicit
 * <TabBarDarkZone> markers, and only two screens place one — each around a single
 * dark card. So in app-dark mode, where every page is #000000, nothing registers
 * and the bar rested in its LIGHT material: a near-white pill with a blue lens,
 * floating on pure black. That is what the owner reported as washed out.
 *
 * What made it survive so long is that a comment in RootNavigator asserted the
 * opposite — that the adaptive system "already picks the dark tone by itself" —
 * and §15 of the tracker repeated it, so every pass over that file trusted the
 * claim instead of checking it. A source-level assertion is crude, but it is the
 * cheap half of the lesson: the prose can lie, the dependency cannot.
 */

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../../../navigation/RootNavigator.jsx'),
  'utf8',
);

describe('tab bar tone', () => {
  it('reads the app theme', () => {
    expect(SRC).toMatch(/const appDark = useIsDark\(\)/);
  });

  it('forces the dark tone when the app is dark, before consulting zones', () => {
    // The early return matters: subscribing and waiting for a zone report would
    // leave the bar light until something happened to scroll.
    const effect = /useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[toneAnim, appDark\]\);/.exec(SRC);
    expect(effect).not.toBeNull();
    const body = effect[1];
    expect(body.indexOf('if (appDark)')).toBeGreaterThan(-1);
    expect(body.indexOf('if (appDark)')).toBeLessThan(body.indexOf('subscribeTone'));
  });

  it('still subscribes to zone coverage, so light mode keeps its scroll behaviour', () => {
    expect(SRC).toMatch(/subscribeTone\(/);
  });
});
