/**
 * Every screen root goes through `<Screen>`.
 *
 * WHY THIS EXISTS
 *
 * `targetSdkVersion 36` makes Android 15+ enforce edge-to-edge, so what a screen root
 * does about insets is load-bearing. At v1.0.9 there were 18 raw `<SafeAreaView>` roots
 * and only 4 declared an `edges` prop; the rest relied on the implicit default, which
 * makes the behaviour invisible at the call site.
 *
 * All of them now go through `Screen`, which supplies a themed background and makes
 * `edges` explicit. Nothing stops the next screen from reaching for `SafeAreaView`
 * again except this test — and the failure it prevents (white root on a near-black
 * theme, or content under the navigation bar) is invisible in code review and only
 * shows up on a physical device, which CI cannot check.
 *
 * `useSafeAreaInsets` is deliberately NOT restricted. Applying padding where it is
 * needed — a sticky footer, a floating button — is a different and often better
 * pattern than wrapping the whole tree, and 21 screens legitimately use it.
 *
 * It lives under src/theme/__tests__ because that is what `npm run test:unit` scans,
 * and this must run on every `npm run verify`.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../..');

// The primitive itself is the one place allowed to hold a SafeAreaView.
const ALLOWED = new Set([path.join(SRC, 'components', 'Screen.jsx')]);

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(full);
    return /\.(jsx?|tsx?)$/.test(e.name) ? [full] : [];
  });

describe('screen roots', () => {
  const offenders = walk(SRC)
    .filter((f) => !ALLOWED.has(f))
    .filter((f) => /<SafeAreaView[\s>]/.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(SRC, f));

  it('renders no raw <SafeAreaView> outside the Screen primitive', () => {
    expect(offenders).toEqual([]);
  });

  it('keeps Screen as the only importer of SafeAreaView', () => {
    const importers = walk(SRC)
      .filter((f) => !ALLOWED.has(f))
      .filter((f) => {
        const src = fs.readFileSync(f, 'utf8');
        // The hook is fine — only the component is restricted.
        return /import\s*\{[^}]*\bSafeAreaView\b[^}]*\}\s*from\s*'react-native-safe-area-context'/.test(
          src,
        );
      })
      .map((f) => path.relative(SRC, f));
    expect(importers).toEqual([]);
  });
});
