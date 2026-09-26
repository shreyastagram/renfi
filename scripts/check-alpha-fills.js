/**
 * A low-alpha hue must not be used as a SURFACE.
 *
 * WHY THIS EXISTS
 *
 * The theme has two families of tinted colour:
 *
 *   xFill       rgba(30, 95, 158, 0.1)   10% of a dark hue
 *   xContainer  #EFF6FF                  a solid pale tint
 *
 * They look interchangeable in the token list and are not. 10% of a DARK hue
 * over any ground composites to a grey with a hint of something — measured
 * over white, every xFill lands between 4% and 10% saturation. Four such
 * chips side by side read as four shades of mud, which is exactly what the
 * owner reported twice: once on the history stat pills, and again on the home
 * screen's Events tile, where a grey slab sat between a pink Emergency and an
 * orange Favorites.
 *
 * I caused the second one myself, by reaching for xFill while fixing the
 * first. That is the argument for a gate rather than a habit.
 *
 * xFill is still correct for a BORDER or a hairline, where a translucent hue
 * over the real ground is what you want. This checks backgrounds only.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { lightTheme } = require(path.join(ROOT, 'src/theme/themes.js'));

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return ['node_modules', '__tests__'].includes(e.name) ? [] : walk(f);
    return /\.jsx?$/.test(f) ? [f] : [];
  });

// Every light token whose value is translucent — those are the unsafe surfaces.
const TRANSLUCENT = new Set(
  Object.entries(lightTheme.colors)
    .filter(([, v]) => typeof v === 'string' && /^rgba?\(/.test(v) && !/,\s*1\s*\)$/.test(v))
    .map(([k]) => k),
);

const offenders = [];
let scanned = 0;

for (const file of walk(path.join(ROOT, 'src'))) {
  const src = fs.readFileSync(file, 'utf8');
  scanned += 1;
  for (const m of src.matchAll(/(backgroundColor|bgColor):\s*C\.(\w+)/g)) {
    if (!TRANSLUCENT.has(m[2])) continue;
    // overlays and scrims are MEANT to be translucent over content
    // Overlays and scrims are MEANT to sit translucent over content. So is
    // iosFill — it is Apple's system fill, and matching the platform is the
    // whole point of that token.
    if (/overlay|scrim|backdrop|lightbox|glass|^iosFill$/i.test(m[2])) continue;
    offenders.push({
      rel: path.relative(ROOT, file),
      line: src.slice(0, m.index).split('\n').length,
      token: m[2],
      value: lightTheme.colors[m[2]],
    });
  }
}

if (offenders.length) {
  console.error('check:alpha — a translucent token used as a SURFACE:\n');
  for (const o of offenders) {
    console.error(`  ${o.rel}:${o.line}   C.${o.token}  =  ${o.value}`);
    const solid = o.token.replace(/Fill$/, 'Container');
    if (lightTheme.colors[solid]) console.error(`      use C.${solid} (${lightTheme.colors[solid]}) — a solid tint`);
  }
  console.error(
    `\n${offenders.length} translucent surface(s). A low-alpha hue over any ground` +
    '\ncomposites toward grey; the Container tokens are solid pale tints and stay' +
    '\ncoloured. Translucent is still right for a border or a scrim.',
  );
  process.exit(1);
}
console.log(`check:alpha OK — ${scanned} file(s); no translucent token used as a surface.`);
