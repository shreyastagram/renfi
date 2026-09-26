/**
 * Phase 10 sweep, made permanent.
 *
 * Every check here is a failure the existing gates CANNOT see. check:hex only proves
 * no literal survived; check:contrast only grades token pairs; check:light only
 * compares against v1.0.9. A screen can pass all three while consuming the theme in a
 * way that is broken, slow, or silently frozen on one appearance — and the symptom
 * (a card that does not repaint on switch, a device that stutters) shows up on a
 * physical phone, long after the commit.
 *
 * Each case below was found by hand at least once during the migration.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(full);
    return /\.(jsx?|tsx?)$/.test(e.name) ? [full] : [];
  });

const SOURCES = [
  ...walk(SRC),
  path.join(ROOT, 'App.tsx'),
  ...walk(path.join(ROOT, 'navigation')),
].filter((f) => fs.existsSync(f));

const rel = (f) => path.relative(ROOT, f);
const read = (f) => fs.readFileSync(f, 'utf8');

describe('makeStyles stays at module scope', () => {
  it('is never declared inside a component', () => {
    // useThemedStyles caches per (makeStyles identity, theme). A factory redeclared
    // on each render is a new identity every time, so the cache misses every render
    // and rebuilds the whole StyleSheet — the exact churn the theme engine was
    // written to avoid on low-end Android.
    const offenders = SOURCES.filter((f) =>
      /^[ \t]+const make\w*[Ss]tyles\s*=/m.test(read(f)),
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('no sheet is frozen on one appearance', () => {
  it('has no module-scope StyleSheet.create reading a fixed theme', () => {
    // `const styles = StyleSheet.create({ color: lightTheme.colors.x })` resolves
    // once at import and never repaints on a theme switch. It renders correctly in
    // light, so it is invisible until someone switches to dark.
    const offenders = SOURCES.filter((f) => {
      const src = read(f);
      return [...src.matchAll(/^const \w+ = StyleSheet\.create\(/gm)].some((m) =>
        /\b(lightTheme|darkTheme)\b|theme\.colors/.test(
          src.slice(m.index, m.index + 3000),
        ),
      );
    }).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('the theme barrel is the only entry point', () => {
  // ErrorBoundary must NOT go through the barrel: it re-exports ThemeContext, which
  // pulls AsyncStorage in at module load, and the crash screen cannot afford a native
  // dependency that might itself fail. Documented in src/theme/index.js.
  const ALLOWED = new Set(['src/components/ErrorBoundary.jsx']);

  it('has no undocumented deep import into src/theme internals', () => {
    const offenders = SOURCES.filter((f) => !rel(f).startsWith('src/theme'))
      .filter((f) => /from '[^']*theme\/(?!index)[\w./-]+'/.test(read(f)))
      .map(rel)
      .filter((f) => !ALLOWED.has(f));
    expect(offenders).toEqual([]);
  });
});

describe('memoised JSX keeps up with the theme', () => {
  it('never reads styles.* inside a useMemo that omits `styles`', () => {
    // A useMemo that builds JSX from `styles` but does not depend on it serves the
    // PREVIOUS theme's stylesheet after a switch — one stale card on an otherwise
    // repainted screen. Found for real in RegisterChoice and UnifiedUserAuthScreen.
    const offenders = [];
    for (const f of SOURCES) {
      const src = read(f);
      for (const m of src.matchAll(/useMemo\(\s*\(\)\s*=>/g)) {
        const seg = src.slice(m.index, m.index + 1800);
        const deps = seg.match(/\}?\s*,\s*\[([^\]]*)\]\s*\)/);
        if (!deps) continue;
        if (/\bstyles\./.test(seg.slice(0, deps.index)) && !/\bstyles\b/.test(deps[1])) {
          offenders.push(`${rel(f)}:${src.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
