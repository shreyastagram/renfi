/**
 * No button is filled with a solid brand or semantic colour.
 *
 * The owner's rule: every button is a tinted fill with a matching edge, so the
 * design is uniform. 69 buttons across 28 files were solid slabs of
 * C.primary / C.success / C.danger / C.secondary.
 *
 * WHAT THIS COSTS, recorded honestly: with no solid fill anywhere, nothing
 * announces "this is the main action" by weight. Hierarchy now has to come
 * from ink strength and position instead. That is a deliberate trade the owner
 * asked for, not an oversight — if a screen ever reads as having no obvious
 * primary action, this is the reason.
 *
 * Solid fills are still right for things that are NOT buttons: status dots,
 * progress fills, avatars, the online pad. This checks button styles only,
 * matched by name.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// The saturated tokens. A button may not be filled with one of these.
const SOLID = /^C\.(primary|secondary|success|danger|info|warning|accent|accentSky|brandOrange|brandBlue|altBlueIos|online)$/;

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return ['node_modules', '__tests__'].includes(e.name) ? [] : walk(f);
    return /\.jsx?$/.test(f) ? [f] : [];
  });

const block = (src, from) => {
  let depth = 0;
  for (let i = from; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(from, i + 1);
    }
  }
  return '';
};

const offenders = [];
let scanned = 0;

for (const file of walk(path.join(ROOT, 'src'))) {
  const src = fs.readFileSync(file, 'utf8');
  scanned += 1;

  // style definitions named like a button
  for (const m of src.matchAll(/^  (\w*(?:[Bb]tn|[Bb]utton|CTA|Cta)\w*): \{/gm)) {
    const key = m[1];
    if (/Text$|Label$|Icon$|Row$|Wrap$|Container$/.test(key)) continue;
    const body = block(src, m.index + key.length + 4).replace(/\w+:\s*\{[^{}]*\}/g, '');
    const bg = /backgroundColor:\s*(C\.\w+)/.exec(body);
    if (bg && SOLID.test(bg[1])) {
      offenders.push({
        rel: path.relative(ROOT, file),
        line: src.slice(0, m.index).split('\n').length,
        what: `${key} = ${bg[1]}`,
      });
    }
  }

  // inline overrides — `style={[styles.btn, { backgroundColor: C.primary }]}`
  for (const m of src.matchAll(/styles\.\w*(?:[Bb]tn|[Bb]utton)\w*,\s*\{[^}]*backgroundColor:\s*(C\.\w+)/g)) {
    if (!SOLID.test(m[1])) continue;
    offenders.push({
      rel: path.relative(ROOT, file),
      line: src.slice(0, m.index).split('\n').length,
      what: `inline override = ${m[1]}`,
    });
  }
}

if (offenders.length) {
  console.error('check:buttons — button filled with a solid colour:\n');
  for (const o of offenders) console.error(`  ${o.rel}:${o.line}   ${o.what}`);
  console.error(
    `\n${offenders.length} solid button fill(s). Every button is a tinted fill with a` +
    '\nmatching edge: C.primary -> brandOrangeFill + brandOrangeBorder, C.success ->' +
    '\nsuccessContainer + successBorder, and so on. Remember the label too — an' +
    '\non-colour ink is near-white and will not survive a pale tint.',
  );
  process.exit(1);
}
console.log(`check:buttons OK — ${scanned} file(s); no button filled with a solid colour.`);
