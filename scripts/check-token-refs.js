/**
 * Every `C.x` must exist in that file's `makeC`.
 *
 * WHY THIS EXISTS
 *
 * `C` is a plain object, so `C.textMuted` on a `makeC` that only defines `muted` is
 * not an error — it is `undefined`. React Native then drops the property silently:
 *
 *   color: undefined            -> falls back to the platform default, i.e. BLACK
 *   backgroundColor: undefined  -> transparent, so the surface disappears
 *   borderColor: undefined      -> the hairline vanishes
 *
 * That first one is the serious one. A screen that meant `textMuted` renders black
 * text, which on a dark surface is invisible — the owner's original "black text in
 * black bg" report. The migration introduced these by renaming a local palette key
 * without updating every reference.
 *
 * NOTHING ELSE CATCHES IT. eslint's no-undef sees a property access on a defined
 * object and is satisfied. check:hex sees no literal. check:contrast never learns the
 * pair exists. The value is only wrong at runtime, on a device, in one theme.
 *
 * The check is deliberately dumb and exact: collect the keys `makeC` returns, collect
 * every `C.` reference, and diff them. No heuristics, so no false positives.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

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
  const m = /const makeC = \(c\) => \(\{([\s\S]*?)\n\}\);/.exec(src);
  if (!m) continue;
  scanned += 1;

  const defined = new Set([...m[1].matchAll(/^\s*(\w+):/gm)].map((x) => x[1]));
  const used = new Map();
  for (const r of src.matchAll(/\bC\.(\w+)\b/g)) {
    used.set(r[1], (used.get(r[1]) || 0) + 1);
  }
  for (const [k, n] of used) {
    if (!defined.has(k)) {
      offenders.push({ file: path.relative(ROOT, file), key: k, count: n });
    }
  }
}

if (offenders.length) {
  console.error('check:tokens — C.* references with no matching makeC key:\n');
  let last = null;
  for (const o of offenders.sort((a, b) => a.file.localeCompare(b.file) || a.key.localeCompare(b.key))) {
    if (o.file !== last) { console.error(`  ${o.file}`); last = o.file; }
    console.error(`      C.${o.key}  x${o.count}   -> undefined at runtime`);
  }
  console.error(
    `\n${offenders.length} undefined reference(s) across ${new Set(offenders.map((o) => o.file)).size} file(s).` +
    '\nEach one silently drops its style property: colour falls back to BLACK, a fill' +
    '\nbecomes transparent, a border disappears. Point it at a key that exists, or add' +
    '\nthe key to that file\'s makeC.',
  );
  process.exit(1);
}
console.log(`check:tokens OK — ${scanned} themed file(s); every C.* resolves.`);
