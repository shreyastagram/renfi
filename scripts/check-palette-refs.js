/**
 * Every `group.key` read off a palette group must exist on that group.
 *
 * WHY THIS EXISTS
 *
 * check:tokens covers `C.*` — the per-file alias tables. It cannot see the
 * palette groups that screens import directly:
 *
 *   backgroundColor: brandTint.orange08    // there is no orange08
 *   color: stableDark.inkFaint             // there is no inkFaint
 *
 * These are the same silent failure: the property is `undefined`, React Native
 * drops the style, and the fill renders transparent or the text falls back to
 * platform black. `brandTint.orange08` shipped exactly that way — brandTint has
 * orange04, orange06, orange10 and orange12, and the one value nobody defined
 * is the one WelcomeModal asked for.
 *
 * Nested groups (iosSystem.dark.blue) are resolved a level at a time rather
 * than flagged, since the intermediate is itself an object.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const palette = require(path.join(ROOT, 'src/theme/tokens/palette.js'));

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return ['node_modules', '__tests__'].includes(e.name) ? [] : walk(f);
    return /\.jsx?$/.test(f) ? [f] : [];
  });

const groups = Object.keys(palette).filter(
  (g) => palette[g] && typeof palette[g] === 'object' && !Array.isArray(palette[g]),
);

const offenders = [];
let scanned = 0;

for (const file of [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'navigation'))]) {
  // palette.js defines the groups; it is allowed to reference them freely.
  if (file.endsWith(path.join('tokens', 'palette.js'))) continue;
  const src = fs.readFileSync(file, 'utf8');
  scanned += 1;
  for (const g of groups) {
    for (const m of src.matchAll(new RegExp(`\\b${g}\\.([A-Za-z_]\\w*)`, 'g'))) {
      const key = m[1];
      if (key in palette[g]) continue;
      // `a.b.c` where b is itself an object — resolve through it, not against it.
      const before = src.slice(Math.max(0, m.index - 1), m.index);
      if (before === '.') continue;
      offenders.push({
        rel: path.relative(ROOT, file),
        line: src.slice(0, m.index).split('\n').length,
        ref: `${g}.${key}`,
        near: Object.keys(palette[g]).filter((k) => k.startsWith(key.slice(0, 4))).slice(0, 4),
      });
    }
  }
}

if (offenders.length) {
  console.error('check:palette — references to palette keys that do not exist:\n');
  for (const o of offenders) {
    console.error(`  ${o.rel}:${o.line}   ${o.ref}  -> undefined at runtime`);
    if (o.near.length) console.error(`      did you mean: ${o.near.join(', ')}`);
  }
  console.error(
    `\n${offenders.length} undefined palette reference(s). Each silently drops its style:` +
    '\na fill becomes transparent, a colour falls back to platform black.',
  );
  process.exit(1);
}
console.log(`check:palette OK — ${scanned} file(s); every ${groups.length} palette group reference resolves.`);
