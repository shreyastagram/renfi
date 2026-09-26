/**
 * FloatingTabBar must not write module state during render, must publish a
 * REACTIVE window height, and must clear the rect when it hides.
 *
 * All three shipped wrong together:
 *
 *  - setBarRect(...) was called in the render body. A render must be pure;
 *    under StrictMode's double invoke or a Suspense retry it runs twice per
 *    commit.
 *  - the height came from Dimensions.get('window'), read once per render. The
 *    bar only re-renders on navigation state, so after a rotation, a fold, or
 *    entering split screen the published rect kept the old height until the
 *    user happened to switch tabs.
 *  - the call sat BELOW two early returns, so hiding the bar (keyboard open,
 *    or a screen setting tabBarStyle display:none) left the last rect in
 *    place and every TabBarDarkZone went on computing coverage against a bar
 *    that was not on screen.
 *
 * Asserted against the source because the alternative is rendering the whole
 * navigator, which needs the full navigation tree for one structural fact.
 */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'navigation', 'RootNavigator.jsx'),
  'utf8',
);

describe('FloatingTabBar bar-rect publishing', () => {
  it('publishes inside an effect, never in the render body', () => {
    const call = SRC.indexOf('setBarRect({');
    expect(call).toBeGreaterThan(-1);
    // Walk back to the nearest enclosing useEffect( — it must be closer than
    // the nearest enclosing `return (` of the JSX.
    const effectBefore = SRC.lastIndexOf('useEffect(', call);
    expect(effectBefore).toBeGreaterThan(-1);
    const between = SRC.slice(effectBefore, call);
    // No JSX return may intervene between that effect and the call.
    expect(between).not.toMatch(/\n\s*return \(/);
  });

  it('takes the window height from useWindowDimensions, not Dimensions.get', () => {
    expect(SRC).toMatch(/useWindowDimensions\(\)/);
    // Dimensions may only survive as prose, never as a call.
    expect(SRC).not.toMatch(/Dimensions\.get\s*\(/);
  });

  it('clears the rect when the bar is hidden', () => {
    expect(SRC).toMatch(/setBarRect\(null\)/);
  });

  it('decides visibility BEFORE the effect, so hiding still publishes', () => {
    // The early return must sit BELOW the effect. When it sat above (as two
    // separate returns did), hiding the bar skipped the publish entirely and
    // the stale rect survived.
    const decl = SRC.indexOf('const hidden =');
    const effect = SRC.indexOf('useEffect(() => {\n    if (hidden)');
    const earlyReturn = SRC.indexOf('if (hidden) {\n    return null;\n  }');
    expect(decl).toBeGreaterThan(-1);
    expect(effect).toBeGreaterThan(-1);
    expect(earlyReturn).toBeGreaterThan(-1);
    expect(decl).toBeLessThan(effect);
    expect(effect).toBeLessThan(earlyReturn);
  });
});

describe('TabBarDarkZone polling', () => {
  const ZONE = fs.readFileSync(
    path.join(__dirname, '..', '..', 'components', 'TabBarDarkZone.jsx'),
    'utf8',
  );

  it('gates the interval on screen focus', () => {
    // Seven screens use a zone. An ungated 150ms timer per zone is a native
    // round trip ~7x a second for the whole session, including off screen.
    expect(ZONE).toMatch(/useIsFocused\(\)/);
    expect(ZONE).toMatch(/if \(!isFocused\)/);
  });

  it('stops while the app is backgrounded', () => {
    expect(ZONE).toMatch(/AppState\.addEventListener/);
  });

  it('removes the AppState subscription on unmount', () => {
    expect(ZONE).toMatch(/sub\.remove\(\)/);
  });

  it('reports zero coverage when it goes off screen', () => {
    // Otherwise the bar keeps its dark tone from a zone that is no longer visible.
    expect(ZONE).toMatch(/setZoneFraction\(id, 0\)/);
  });
});
