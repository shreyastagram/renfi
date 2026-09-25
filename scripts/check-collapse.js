/**
 * Collapsed fill/border check.
 *
 * THE GAP THIS CLOSES
 *
 * Migration maps many literals onto fewer tokens, which is the point — but when a
 * container's fill and its hairline were two different shades and both land on the
 * SAME token, the hairline silently disappears. Every other gate is blind to it:
 * check:hex only wants no literal, check:light only checks that each old value is
 * reachable from somewhere in the theme, and contrast never compares a fill to its
 * own border.
 *
 * Found for real on UserServiceHistoryScreen's OTP bar, where #F3E8FF (fill) and
 * #DDD6FE (border) both mapped to `accentVioletContainer`. Fixed by completing the
 * violet container/border pair.
 *
 * A style that sets `borderColor` to the same expression as its `backgroundColor`
 * is reported unless it is declared intentional below.
 *
 * Run: npm run check:collapse
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/**
 * Styles where fill and border are deliberately the same value. Both of these are
 * solid "selected" pills that carried a matching border at v1.0.9 so that turning
 * the border on and off does not shift the pill's size.
 */
const INTENTIONAL = new Set([
  'src/screens/UserServiceHistoryScreen.jsx:filterPillActive',
  'src/screens/UserServiceHistoryScreen.jsx:dateChipOn',
]);

const FILL = /backgroundColor:\s*([A-Za-z_$][\w.$]*)/g;
const BORDER = /border(?:Top|Bottom|Left|Right)?Color:\s*([A-Za-z_$][\w.$]*)/g;

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'migrated-files.json'), 'utf8'),
);

const failures = [];

for (const rel of config.migrated) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const lines = fs.readFileSync(full, 'utf8').split('\n');

  // Track the nearest enclosing style key so a failure names something findable.
  let key = '?';
  lines.forEach((line, i) => {
    const k = line.match(/^\s{2,4}([A-Za-z0-9_]+):\s*\{/);
    if (k) key = k[1];

    const fills = [...line.matchAll(FILL)].map((m) => m[1]);
    const borders = [...line.matchAll(BORDER)].map((m) => m[1]);
    const clash = fills.filter((f) => borders.includes(f));
    if (!clash.length) return;
    if (INTENTIONAL.has(`${rel}:${key}`)) return;

    failures.push({ rel, line: i + 1, key, token: clash[0] });
  });
}

if (failures.length) {
  console.error('check:collapse — fill and border resolve to the same token:\n');
  for (const f of failures) {
    console.error(`  ${f.rel}:${f.line}  ${f.key} — both are ${f.token}`);
  }
  console.error(
    '\nThe hairline is invisible. Either give the border its own token (see the\n' +
      '*Border family in semantic.js), or declare it in INTENTIONAL in\n' +
      'scripts/check-collapse.js with the reason it is deliberate.',
  );
  process.exit(1);
}

console.log(
  `check:collapse OK — ${config.migrated.length} migrated file(s); no hairline ` +
    `collapsed onto its fill (${INTENTIONAL.size} declared intentional).`,
);
