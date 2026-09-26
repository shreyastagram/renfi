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
  // Timeline steps: a solid filled circle that overrides the base circle's border
  // with its own fill colour, so the ring disappears by design. Both were already
  // `backgroundColor === borderColor` at v1.0.9.
  'src/screens/ServiceRequestDetailScreen.jsx:timelineCircleCompleted',
  'src/screens/ServiceRequestDetailScreen.jsx:timelineCircleCurrent',
  // Solid filled controls: a checked checkbox and two selected pills, all of which
  // were already `backgroundColor === borderColor` at v1.0.9.
  'src/screens/ProviderRegisterScreen.jsx:checkboxChecked',
  'src/screens/ProviderServiceHistoryScreen.jsx:filterPillActive',
  'src/screens/ProviderServiceHistoryScreen.jsx:dateChipOn',
  // An active filter tab, filled with the tab's own colour and given a matching
  // border so switching state does not change its size. Inline, and identical at
  // v1.0.9. Keyed by token, so it survives the file shifting.
  'src/screens/ServiceApprovalsScreen.jsx:inline:tab.color',
  // Apple's sign-in card is specified black-on-black by Apple's guidelines, and a
  // checked checkbox is a solid fill whose border matches so checking it does not
  // change its size. Both were already backgroundColor === borderColor at v1.0.9.
  'src/components/RegisterChoice.jsx:appleCard',
  'src/components/RegisterChoice.jsx:checkboxChecked',
  // Same two patterns on the auth screens: a checked checkbox filled with the brand
  // orange, and Apple's black-on-black sign-in card. Both identical at v1.0.9.
  'src/screens/RegisterScreen.jsx:checkboxChecked',
  'src/screens/UnifiedUserAuthScreen.jsx:appleCard',
]);

// The captured expression must be the WHOLE value, so a trailing terminator is
// required. Without it, `C.danger + '12'` and `C.danger + '30'` both captured just
// `C.danger` and looked collapsed -- they are different alphas of the same hue, a
// pattern several screens use deliberately. A false positive here is worse than a
// miss: it trains you to allowlist, and the next allowlist entry hides a real bug.
const FILL = /backgroundColor:\s*([A-Za-z_$][\w.$]*)\s*(?=[,}\n])/g;
const BORDER = /border(?:Top|Bottom|Left|Right)?Color:\s*([A-Za-z_$][\w.$]*)\s*(?=[,}\n])/g;

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'migrated-files.json'), 'utf8'),
);

const failures = [];

for (const rel of config.migrated) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const lines = fs.readFileSync(full, 'utf8').split('\n');

  // Track the nearest enclosing style key so a failure names something findable.
  // Inside a StyleSheet that key is the style name; an INLINE style in JSX has no
  // such key, and walking up would grab whatever unrelated object literal came
  // last — it once reported an inline filter tab as `rejected`, a STATUS_CONFIG
  // entry forty lines above. Those are keyed by line instead.
  let key = '?';
  let inSheet = false;
  lines.forEach((line, i) => {
    if (/StyleSheet\.create\(\{/.test(line)) inSheet = true;
    else if (inSheet && /^\}\);/.test(line)) inSheet = false;
    const k = inSheet && line.match(/^\s{2,4}([A-Za-z0-9_]+):\s*\{/);
    if (k) key = k[1];
    else if (!inSheet) key = null; // keyed by token below — a line number is not stable

    const fills = [...line.matchAll(FILL)].map((m) => m[1]);
    const borders = [...line.matchAll(BORDER)].map((m) => m[1]);
    const clash = fills.filter((f) => borders.includes(f));
    if (!clash.length) return;
    // An inline clash is keyed by the TOKEN, not the line. The old key was
    // `inline@L223`, and that entry broke the build the first time an unrelated edit
    // shifted the file by one line — the comment beside it had predicted exactly
    // that. A token key survives any reshuffle and is still specific.
    const effKey = key === null ? `inline:${clash[0]}` : key;
    if (INTENTIONAL.has(`${rel}:${effKey}`)) return;

    failures.push({ rel, line: i + 1, key: effKey, token: clash[0] });
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
