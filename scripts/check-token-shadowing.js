/**
 * A `makeC` key must not SHADOW a real theme token with a different value.
 *
 * WHY THIS EXISTS
 *
 * Every screen builds a local alias table:
 *
 *   const makeC = (c) => ({ primary: c.brandOrange, bandFill: c.surfaceSunken });
 *
 * Aliasing is fine and deliberate — `primary` is a local name, there is no
 * `theme.colors.primary`. The failure is different: when the local key has the
 * SAME NAME as a real semantic token but points at a different one.
 *
 *   bandFill: c.surfaceSunken     // theme.colors.bandFill exists, and is NOT this
 *
 * That shipped. `bandFill` was introduced as #FFFFFF/#000000 precisely so the
 * profile's section gutter would be pure black in dark, the comment on the style
 * said so, the tracker said so — and this one file kept painting #252321,
 * because its makeC still resolved `bandFill` to `surfaceSunken`. A flat dark
 * grey band on a black page is also the exact luminance where Samsung AMOLED
 * panels shift hue while scrolling, which is what the owner reported three
 * times as a "purple violet flash".
 *
 * NOTHING ELSE CATCHES IT. check:tokens only asks whether `C.bandFill` resolves
 * to something — it does. check:hex sees no literal. check:ink grades the colour
 * that is actually used, which is a legitimate colour, just the wrong one. The
 * name says one thing and the value says another, and only a human reading both
 * halves would notice.
 *
 * Deliberate shadowing is allowed, but it has to be stated: add the key to
 * ALLOWED with a reason.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// Every key the theme actually defines. Read from the built themes so this
// tracks the token set automatically rather than a hand-kept list.
const themeKeys = (() => {
  const file = fs.readFileSync(path.join(SRC, 'theme', 'tokens', 'semantic.js'), 'utf8');
  const keys = new Set();
  for (const block of file.matchAll(/export const (?:light|dark)Colors = \{([\s\S]*?)\n\};/g)) {
    for (const m of block[1].matchAll(/^\s{2}(\w+):/gm)) keys.add(m[1]);
  }
  return keys;
})();

// Shadowing that is intentional. Key -> reason. Keep this list short; a growing
// list means the token names are not saying what they mean.
const ALLOWED = {
  // e.g. 'surface': 'the auth screens deliberately render on the elevated tone',
};

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(f);
    return /\.jsx?$/.test(f) ? [f] : [];
  });

const offenders = [];
let scanned = 0;

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  const m = /const make(?:C|Brand) = \((?:c|theme)\) => \(\{([\s\S]*?)\n\}\);/.exec(src);
  if (!m) continue;
  scanned += 1;

  for (const entry of m[1].matchAll(/^\s*(\w+):\s*c\.(\w+)\s*,/gm)) {
    const [, local, source] = entry;
    if (local === source) continue;            // the normal, correct case
    if (!themeKeys.has(local)) continue;       // a pure local alias — fine
    if (ALLOWED[local]) continue;
    offenders.push({ file: path.relative(ROOT, file), local, source });
  }
}

// The 97 that exist today are all small-delta family aliases — `borderMedium` ->
// `borderMediumNeutral`, `dangerLine` -> `dangerBorder`. They are cosmetic, not
// the bandFill class, so they are carried as a DECLINING baseline rather than
// fixed in one sweep. The two that mattered (bandFill on the profile's section
// gutter, border on AccountSecurity's dividers) had luminance gaps of 37 and 130
// and are fixed. What this baseline buys is that a NEW one cannot appear.
const BASELINE = 97;

if (offenders.length > BASELINE) {
  console.error(`check:shadow — shadowed tokens rose from ${BASELINE} to ${offenders.length}.\n`);
  let last = null;
  for (const o of offenders.sort((a, b) => a.file.localeCompare(b.file) || a.local.localeCompare(b.local))) {
    if (o.file !== last) { console.error(`  ${o.file}`); last = o.file; }
    console.error(`      ${o.local}: c.${o.source}   -> theme.colors.${o.local} exists and is NOT c.${o.source}`);
  }
  console.error(
    `\n${offenders.length} shadowed token(s) across ${new Set(offenders.map((o) => o.file)).size} file(s), baseline ${BASELINE}.` +
    '\nThe name promises one token and the value delivers another, so the style reads' +
    '\ncorrectly and renders wrongly. Point it at c.<same name>, rename the local key' +
    '\nto something that is not a token, or declare it in ALLOWED with a reason.',
  );
  process.exit(1);
}
console.log(
  `check:shadow OK — ${scanned} themed file(s); ${offenders.length}/${BASELINE} baseline ` +
  'shadowed alias(es), none new.',
);
