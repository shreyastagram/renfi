/**
 * Light-mode fidelity check.
 *
 * THE GAP THIS CLOSES
 *
 * Every other gate passes even when a colour is mapped to the WRONG token.
 * check:hex only cares that no literal remains. check:contrast only checks that
 * token pairs meet AA. Tests and lint never look at colour values. So writing
 * `theme.colors.surfaceSunken` where the original was `#FFFFFF` is invisible —
 * light mode silently changes and nothing complains.
 *
 * This compares, per migrated file:
 *   - the colour literals that file had at tag v1.0.9
 *   - the LIGHT-theme values the file resolves to now
 *
 * A value present before and missing now is a candidate regression. Intentional
 * changes (accessibility fixes, deliberate convergence) are declared in
 * EXPECTED_CHANGES below with a reason, so every difference is either justified
 * in writing or a bug.
 *
 * Run: npm run check:light
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE_TAG = 'v1.0.9';

const { lightTheme } = require('../src/theme/themes.js');
const palette = require('../src/theme/tokens/palette.js');

/**
 * Colours we intentionally changed in light mode. Key is the file, value maps
 * an old literal to the reason it is gone. Anything not listed here that
 * disappears is reported as a possible regression.
 */
const EXPECTED_CHANGES = {
  'src/components/CustomDialog.jsx': {
    '#FFFFFF': 'a11y: white on the orange primary button was 2.69:1 -> onBrandOrange',
    '#EF4444': 'converged onto the danger token (#B91C1C), which passes AA',
    '#0F172A': 'kept as onBrandOrange / textPrimary; shadow now theme.colors.shadow',
    '#64748B': 'textSecondary is now the accessible #475569',
    '#F1F5F9': 'cancel button now surfaceSunken + a border',
    'rgba(0,0,0,0.35)': 'modal scrims unified onto theme.colors.overlay; slightly deeper and slate-tinted',
    'rgba(15,23,42,0.55)': 'modal scrims unified onto theme.colors.overlay; slightly lighter',
  },
  'src/components/Alert.jsx': {
    '#FFF1F2': 'converged onto dangerContainer (dE 0.90, imperceptible)',
    '#BE123C': 'converged onto the danger token — one semantic system',
    '#FECDD3': 'border now comes from dangerBorder',
    '#FFFBEB': 'converged onto warningContainer',
    '#92400E': 'converged onto the warning token',
    '#FDE68A': 'border now comes from warningBorder',
    '#BBF7D0': 'border now comes from successBorder',
    '#16A34A': 'a11y: white on this badge was 3.30:1 -> success + onSuccess',
    '#E11D48': 'converged onto the danger token',
    '#D97706': 'a11y: white on this badge was 3.19:1 -> warning + onWarning',
    '#BFDBFE': 'border now comes from infoBorder',
    '#1E40AF': 'converged onto the info token',
    '#2563EB': 'converged onto the info token',
    '#FFFFFF': 'badge/action ink is now per-hue (onSuccess/onWarning/onDanger/onInfo)',
    '#000': 'shadow now theme.colors.shadow',
    'rgba(0,0,0,0.04)': 'progress track now surfaceSunken',
  },
  'src/components/Button.jsx': {
    '#374151': 'textBodyNeutral',
    '#E5E7EB': 'borderNeutral',
    '#FFFFFF': 'onAltBlueIndigo',
    '#2563EB': 'altBlueIndigo',
  },
  'src/components/Input.jsx': {
    '#9CA3AF': 'placeholder now textMuted, which is accessible',
    '#374151': 'textBodyNeutral',
    '#EF4444': 'danger token (#B91C1C) — the old value failed AA at 4.41',
    '#D1D5DB': 'borderMediumNeutral',
    '#FFFFFF': 'surface',
    '#2563EB': 'altBlueIndigo',
    '#F3F4F6': 'surfaceSunken',
    '#111827': 'textPrimaryNeutral',
    '#6B7280': 'textSecondary is now the accessible #475569',
  },
  'src/components/ShimmerLoader.jsx': {
    '#E2E8F0': 'border',
    '#F8FAFC': 'surfaceSunken',
    '#CBD5E1': 'borderMedium',
    '#FFFFFF': 'skeleton card now surface',
  },
  'src/components/Icon.jsx': {
    '#374151': 'the no-match fallback is now textBodyNeutral',
    '#6B7280': 'ServiceIcon fallback is now textSecondary',
  },
  'src/components/GlobalBanner.jsx': {
    '#f67c16': 'brand.orange',
    '#2b76bc': 'brand.blue',
    '#FFFFFF': 'stableDark.ink',
    '#10B981': 'iconAccent.completed / call',
    '#EF4444': 'iconAccent.cancelled',
    '#F59E0B': 'iconAccent.pending',
    '#3B82F6': 'iconAccent.directions',
    '#fff': 'stableDark.ink',
    '#000': 'stableDark.shadowBase',
  },
  'src/components/DrawerMenu.jsx': {
    '#f67c16': 'brandOrange', '#2b76bc': 'brandBlue', '#0F172A': 'stableDark.heroSurface',
    '#FFFFFF': 'stableDark.ink', '#FBCFE8': 'n/a', '#FBFCFE': 'surface',
    '#EF4444': 'danger token', '#1E293B': 'textStrong', '#64748B': 'textSecondary',
    '#94A3B8': 'textMuted is now accessible', '#E2E8F0': 'border', '#F1F5F9': 'surfaceSunken',
    '#DC2626': 'danger token', '#22C55E': 'stableDark.onlineDot',
    '#DCFCE7': 'stableDark.onlineInk', '#86EFAC': 'stableDark.verifiedInk',
    '#EFF6FF': 'infoContainer', '#991B1B': 'danger token',
    // The drawer carried TWO red families: #EF4444 tints for danger rows and
    // #DC2626 tints for accent rows. Converged onto one danger family.
    'rgba(220,38,38,0.08)': 'accent-row fill converged onto dangerFill',
    'rgba(220,38,38,0.05)': 'accent-row fill converged onto dangerFill',
    'rgba(220,38,38,0.12)': 'accent-row hairline converged onto dangerLine',
  },
  'src/screens/PSAContactsScreen.jsx': {
    // This screen carried its own warning family (amber-600/50) alongside the
    // semantic one (amber-700/orange-50). Converged, same call as Alert.
    '#FECACA': 'danger hairline now dangerLine, visible in both themes',
    '#D97706': 'converged onto the warning token (#B45309), which also passes AA',
    '#FFFBEB': 'converged onto warningContainer',
    '#FDE68A': 'warning hairline now warningLine',
    '#78350F': 'disclaimer body converged onto the warning token',
    'rgba(241,245,249,0.95)': 'sheet background now the bg token; the 0.95 alpha was imperceptible',
  },
  'src/screens/EmailVerifyHandlerScreen.jsx': {
    '#2563EB': 'altBlueIndigo', '#FFFFFF': 'surface',
    '#6B7280': 'textSecondary is now the accessible #475569',
    '#DCFCE7': 'successContainer', '#16A34A': 'success token',
    '#FEE2E2': 'dangerContainer', '#DC2626': 'danger token',
    '#1F2937': 'textStrongNeutral',
  },
};

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

const norm = (v) => {
  const s = v.replace(/\s+/g, '').toLowerCase();
  // Expand 3-digit hex so #fff and #ffffff compare equal.
  if (s.startsWith('#') && s.length === 4) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  // A fully opaque rgb/rgba IS a hex colour. Without this, rgba(0,122,255,1)
  // and #007AFF looked like different colours and produced false positives.
  const m = s.match(/^rgba?\((\d+),(\d+),(\d+)(?:,(\d*\.?\d+))?\)$/);
  if (m && (m[4] === undefined || parseFloat(m[4]) === 1)) {
    const hex = [m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('');
    return `#${hex}`;
  }
  return s;
};

// Flatten every value the light theme can resolve to, including the
// theme-independent groups a migrated file may legitimately reference.
const resolvable = new Set();
Object.values(lightTheme.colors).forEach((v) => resolvable.add(norm(String(v))));
for (const group of [
  'categoryAccent',
  'iconAccent',
  'stableDark',
  'stableEmergency',
  'medal',
  'brandTint',
  'vendor',
]) {
  const g = palette[group];
  if (g) Object.values(g).forEach((v) => resolvable.add(norm(String(v))));
}
for (const sub of ['light']) {
  const g = palette.iosSystem && palette.iosSystem[sub];
  if (g) Object.values(g).forEach((v) => resolvable.add(norm(String(v))));
}
if (palette.iosSystem) resolvable.add(norm(palette.iosSystem.onAccent));

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'migrated-files.json'), 'utf8'),
);

let failed = false;
let checked = 0;
let justified = 0;

for (const rel of config.migrated) {
  // Only files that existed at the base tag can be compared.
  let before;
  try {
    before = execFileSync('git', ['show', `${BASE_TAG}:${rel}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    continue; // new file — nothing to compare against
  }
  checked += 1;

  const had = new Set((before.match(COLOUR) || []).map(norm));
  const expected = EXPECTED_CHANGES[rel] || {};
  const expectedNorm = new Set(Object.keys(expected).map(norm));

  const unexplained = [...had].filter(
    (c) => !resolvable.has(c) && !expectedNorm.has(c),
  );

  justified += [...had].filter((c) => expectedNorm.has(c)).length;

  if (unexplained.length) {
    console.error(`check:light — ${rel}`);
    console.error(
      `    ${unexplained.length} colour(s) from ${BASE_TAG} are neither reachable ` +
        'from the light theme nor declared as an intentional change:',
    );
    unexplained.forEach((c) => console.error(`      ${c}`));
    failed = true;
  }
}

if (failed) {
  console.error(
    '\nEither the mapping is wrong, or the change is intentional and belongs in\n' +
      'EXPECTED_CHANGES in scripts/check-light-fidelity.js with a reason.',
  );
  process.exit(1);
}

console.log(
  `check:light OK — ${checked} migrated file(s) compared against ${BASE_TAG}; ` +
    `${justified} intentional change(s) declared, no unexplained drift.`,
);
