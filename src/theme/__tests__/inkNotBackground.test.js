/**
 * An ink token must never be a background.
 *
 * WHY THIS EXISTS
 *
 * The owner reported "washed out colours ... black text in black bg". The cause was
 * not a bad palette value — it was `backgroundColor: C.dark`, where `C.dark` mapped
 * to `textPrimary`. At v1.0.9 that style said `BRAND.dark = '#0F172A'`: a fixed navy
 * brand panel. `textPrimary` is INK, and ink flips. So in dark mode the provider home
 * screen, its hero header and the mini map card all turned near-white (#F1F5F9) with
 * white text still painted on them, and in light the greeting resolved to #0F172A on
 * #0F172A — a contrast ratio of exactly 1.00.
 *
 * Not one gate saw it. `check:hex` is happy: it is a token, not a literal.
 * `check:contrast` is happy: it grades declared pairs, and nobody declared this one.
 * `check:light` is happy: #0F172A is still reachable from the light theme, just not
 * from that style. `check:collapse` is happy: the border did not match the fill.
 *
 * The rule is narrow on purpose. A surface that must stay dark in both themes already
 * has tokens — `stableDark.*`, `premium.*`, `heroGradient.*`. Reaching for an ink
 * token instead is always a mistake, so this can be enforced rather than reviewed.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../..');

/** Tokens that exist to be painted ON something, never to be the something. */
const INK = new Set([
  'textPrimary', 'textPrimaryNeutral', 'textStrong', 'textStrongNeutral',
  'textBody', 'textBodyNeutral', 'textSecondary', 'textMuted',
]);

/**
 * Deliberate inverted chips: a "selected" pill that is dark-on-light in one theme and
 * light-on-dark in the other, high contrast either way. Both were '#1E293B' at v1.0.9
 * and both carry ink that inverts with them.
 */
const ALLOWED = new Set([
  'screens/ProviderServiceHistoryScreen.jsx:filterBarPillOn',
  'screens/UserServiceHistoryScreen.jsx:filterBarPillOn',
]);

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(full);
    return /\.jsx?$/.test(e.name) ? [full] : [];
  });

/** local makeC key -> semantic token */
const aliasMap = (src) => {
  const m = /const makeC = \(c\) => \(\{([\s\S]*?)\n\}\);/.exec(src);
  const out = {};
  if (m) for (const x of m[1].matchAll(/(\w+):\s*c\.(\w+)/g)) out[x[1]] = x[2];
  return out;
};

const offenders = [];
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  const alias = aliasMap(src);
  if (!Object.keys(alias).length) continue;
  const rel = path.relative(SRC, file);

  let style = null;
  for (const line of src.split('\n')) {
    const open = /^\s{2,6}(\w+): \{\s*$/.exec(line);
    if (open) { style = open[1]; continue; }
    if (/^\s{2,6}\},?\s*$/.test(line)) { style = null; continue; }
    if (!style) continue;
    const bg = /backgroundColor:\s*(?:C\.(\w+)|theme\.colors\.(\w+))/.exec(line);
    if (!bg) continue;
    const token = bg[1] ? alias[bg[1]] : bg[2];
    if (token && INK.has(token) && !ALLOWED.has(`${rel}:${style}`)) {
      offenders.push(`${rel}:${style} -> ${token}`);
    }
  }
}

describe('ink tokens are never painted as a background', () => {
  it('finds no style using a text colour as its fill', () => {
    expect(offenders).toEqual([]);
  });
});
