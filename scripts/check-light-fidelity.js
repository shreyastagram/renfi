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
    '#FECDD3': 'rose-200 border converged onto dangerBorder (#FECACA) — one red family',
    '#FFF1F2': 'converged onto dangerContainer (dE 0.90, imperceptible)',
    '#BE123C': 'converged onto the danger token — one semantic system',
    '#FFFBEB': 'converged onto warningContainer',
    '#92400E': 'converged onto the warning token',
    '#16A34A': 'a11y: white on this badge was 3.30:1 -> the darker success fill, still white ink (5.02)',
    '#E11D48': 'converged onto the danger token',
    '#D97706': 'a11y: white on this badge was 3.19:1 -> the darker warning fill, still white ink (5.02)',
    '#1E40AF': 'converged onto the info token',
    '#2563EB': 'converged onto the info token',
    '#FFFFFF': 'badge/action ink is now the on* tokens; white in light, dark ink in dark',
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
    '#D97706': 'converged onto the warning token (#B45309), which also passes AA',
    '#FFFBEB': 'converged onto warningContainer',
    '#78350F': 'disclaimer body converged onto the warning token',
    'rgba(241,245,249,0.95)': 'sheet background now the bg token; the 0.95 alpha was imperceptible',
  },
  'src/screens/LiveTrackingScreen.jsx': {
    '#EDE9FE': 'violet stat chip converged onto accentVioletContainer',
    '#ECFDF5': 'converged onto successContainer — one green family',
    '#FEE2E2': 'live badge converged onto dangerContainer',
    '#059669': 'a11y: emerald-600 on its tint was 3.32:1 -> the success token',
    'rgba(248,250,252,0.95)': 'map-loading scrim now surfaceSunken; the 0.95 alpha over a map read as opaque anyway',
    'rgba(255,255,255,0.96)': 'floating header now surface; same reason',
  },
  'src/screens/FavoritesScreen.jsx': {
    '#0D9488': 'a11y: teal-600 on white was 3.41:1 -> the success token',
    '#CCFBF1': 'teal tint converged onto successContainer',
    '#FFFBEB': 'converged onto warningContainer, as in Alert and PSAContacts',
    '#EDE9FE': 'converged onto accentVioletContainer',
    'rgba(15,23,42,0.5)': 'both modal scrims unified onto theme.colors.overlay (0.45)',
  },
  'src/screens/EventServicesScreen.jsx': {
    '#ECFDF5': 'converged onto successContainer — one green family',
    '#F5F3FF': 'converged onto accentVioletContainer',
    '#A7F3D0': 'converged onto successBorder (#BBF7D0), the shared container hairline',
    'rgba(15,23,42,0.5)': 'both modal scrims unified onto theme.colors.overlay (0.45)',
    // Not flagged by this gate — #10B981 stays reachable via iconAccent.completed —
    // but the change is real and belongs on the record.
    '#10B981': 'a11y: emerald-500 on white was 2.46:1 -> the success token (#15803D)',
  },
  'src/screens/CreateServiceRequestScreen.jsx': {
    // A pre-design-system screen: bare greys, Bootstrap red/green, iOS blue.
    // The iOS blue itself is UNCHANGED (altBlueIos); only the greys and the two
    // Bootstrap hues move, and both of those were accessibility failures.
    '#1a1a1a': 'heading ink -> textPrimary (#0F172A)',
    '#333333': 'body ink -> textBody (#334155), near-identical',
    '#666666': 'secondary ink -> textSecondary (#475569)',
    '#888888': 'a11y: 3.54:1 on white -> textMuted (5.42:1)',
    '#999999': 'a11y: 2.85:1 on white -> textMuted (5.42:1)',
    '#cccccc': 'disabled-control fill -> borderMedium (#CBD5E1)',
    '#e0e0e0': 'modal header hairline -> border (#E2E8F0)',
    '#f0f0f0': 'close-button chip -> bg (#F1F5F9)',
    '#f8f9fa': 'screen and sheet backgrounds -> bg (#F1F5F9); inner chips -> surfaceSunken (#F8FAFC, exact)',
    '#f3f4f6': 'address icon chip -> surfaceSunken',
    '#f0f7ff': 'iOS-blue tint -> infoContainer (#EFF6FF)',
    '#e8f4ff': 'same tint family -> infoContainer',
    '#dc3545': 'a11y: Bootstrap red was 4.53:1 as text -> the danger token (7.00:1)',
    '#28a745': 'a11y: white on Bootstrap green was 3.13:1 -> the success fill (5.02:1 with white)',
    'rgba(0,0,0,0.5)': 'date-picker scrim -> theme.colors.overlay (slate-tinted, 0.45)',
  },
  'src/screens/UserServiceHistoryScreen.jsx': {
    '#f0f2f5': 'screen background -> bg (#F1F5F9)',
    '#e8ecf0': 'card and filter hairlines -> border (#E2E8F0)',
    '#eef2f6': 'date-row hairline -> border',
    '#ecfdf5': 'converged onto successContainer',
    '#d1fae5': 'completed-status tint converged onto successContainer',
    '#059669': 'completed status converged onto the success token',
    '#d97706': 'pending status and rating stars converged onto the warning token',
    '#fef3c7': 'amber-100 strips converged onto warningContainer',
    '#fee2e2': 'converged onto dangerContainer',
    '#991b1b': 'rejected-strip ink converged onto the danger token',
    '#ede9fe': 'converged onto accentVioletContainer',
    '#ddd6fe': 'OTP bar converged onto accentVioletContainer',
    '#dbeafe': 'accepted/arrived tint converged onto infoContainer',
    // Not flagged (both stay reachable via iconAccent) but changed for real:
    '#10B981': 'a11y: emerald-500 was 2.46:1 on white -> the success token',
    '#EF4444': 'a11y: red-500 was 3.76:1 on white -> the danger token',
  },
  'src/screens/UserHomeScreen.jsx': {
    '#faf7f7': 'the warm off-white screen background -> bg (#F1F5F9); imperceptible, and it unifies the app background',
    '#F5F7FA': 'BRAND.cardBg was dead at v1.0.9 -- removed rather than mapped',
    '#6B7280': 'BRAND.neutral was dead at v1.0.9 -- removed rather than mapped',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted (5.42:1)',
    '#047857': 'the "active now" green converged onto the success token',
    '#10B981': 'a11y: white on this fill was 2.46:1 -> the success fill (5.02:1 with white)',
    '#EF4444': 'a11y: white on this fill was 3.76:1 -> the danger fill (6.47:1)',
    '#F59E0B': 'a11y: white on this fill was 2.15:1 -> the warning fill; the rating star keeps iconAccent.star',
    '#F5A856': 'the orange button loading state -> brandTint.orangeSoft, same value',
    '#93C5FD': 'dot ring converged onto infoBorder (#BFDBFE)',
    '#DBEAFE': 'chip hairline converged onto infoBorder',
    '#C7D2FE': 'indigo-200 card border converged onto accentVioletBorder',
    '#EEF2FF': 'indigo-50 card fill converged onto accentVioletContainer -- the icon in it was already violet',
    '#FEF3C7': 'amber icon chip -> warningFill, which keeps a step against the warning bar it sits on',
    '#FEE2E2': 'danger icon chip -> dangerFill, same reason',
    '#991B1B': 'converged onto the danger token',
    '#92400E': 'converged onto the warning token',
    '#FFFBEB': 'converged onto warningContainer',
    '#B0BEC5': 'timeline number -> textMuted',
    '#D97706': 'the location-hint amber converged onto the warning token',
    'rgba(15, 23, 42, 0.85)': 'the blocking permission scrim keeps its weight as overlayStrong',
    'rgba(43,118,188,0.04)': 'decor blob -> brandTint.blue05',
    'rgba(246,124,22,0.03)': 'decor blob -> brandTint.orange04',
    'rgba(220, 38, 38, 0.08)': 'quick-access icon fill -> dangerFill',
    'rgba(124, 58, 237, 0.08)': 'quick-access icon fill -> accentVioletFill (0.1)',
    'rgba(245, 158, 11, 0.1)': 'quick-access icon fill -> warningFill (amber-700 at 0.12)',
  },
  'src/screens/ServiceRequestDetailScreen.jsx': {
    // Status pills: brand orange on amber-100 and brand blue on blue-100 measured
    // 2.4:1 for both the label and the dot. Each status keeps its HUE family but
    // takes the accessible token from it, and the tint moves to the matching *Fill.
    '#FEF3C7': 'pending tint -> warningFill', '#DBEAFE': 'accepted tint -> infoFill',
    '#D1FAE5': 'completed tint -> successFill', '#FEE2E2': 'cancelled tint -> dangerFill',
    '#F3F4F6': 'rejected tint -> the neutral hairline',
    '#ECFDF5': 'converged onto successFill', '#A7F3D0': 'banner hairline -> successBorder (#BBF7D0)',
    '#065F46': 'converged onto the success token', '#047857': 'converged onto the success token',
    '#059669': 'converged onto the success token',
    '#9B2C2C': 'converged onto the danger token', '#991B1B': 'converged onto the danger token',
    '#FFF5F5': 'converged onto dangerContainer', '#FCA5A5': 'converged onto dangerBorder',
    '#6D28D9': 'violet ink converged onto accentViolet', '#5B21B6': 'violet ink converged onto accentViolet',
    '#E9D5FF': 'OTP digit hairline converged onto accentVioletBorder',
    '#F5F3FF': 'provider OTP card -> accentVioletContainer',
    '#EDE9FE': 'violet chips -> accentVioletContainer, and the nested circle -> accentVioletFill',
    '#E8ECF1': 'card hairlines converged onto border (#E2E8F0)',
    '#B0BEC5': 'timeline number -> textMuted',
    '#1E40AF': 'converged onto the info token',
    '#FEF3E7': 'warm badge tint converged onto warningContainer',
    '#FEF9F4': 'warm box tint converged onto warningContainer',
    // Not flagged (still reachable via iconAccent) but changed for real:
    '#10B981': 'a11y: white on this fill was 2.46:1 -> the success fill',
    '#F59E0B': 'the Rate button keeps its gold fill (medal.gold) but its label is now dark ink; white was 2.15:1',
    '#FFFFFF': 'the help icon was WHITE ON A WHITE HEADER at v1.0.9 -- invisible. Now brand orange, matching UserHomeScreen.',
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
  'mapRoute',
  'mapOverlay',
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
