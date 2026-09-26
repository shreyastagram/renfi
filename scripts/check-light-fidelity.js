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
  'src/components/AddressForm.jsx': {
    '#faf7f7': 'the one warm-white input well converged onto surfaceSunken (#F8FAFC) -- the cool-white every other input already used',
    '#f3f4f6': 'gray-100 chips converged onto surfaceSunken (#F8FAFC) -- one neutral family instead of two',
    '#fee2e2': 'converged onto dangerContainer (#FEF2F2)',
    '#ecfdf5': 'converged onto successContainer (#F0FDF4) -- emerald-50 and green-50 are the same step',
    '#a7f3d0': 'converged onto successBorder (#BBF7D0)',
    '#fca5a5': 'converged onto dangerBorder (#FECACA) -- the lighter of the two, matching Alert',
  },
  'src/components/AppUpdateModal.jsx': {
    '#e06b0a': 'the primaryDark key was declared and never referenced, at v1.0.9 too -- removed rather than tokenised',
    '#059669': 'converged onto the success token (#15803D), which passes AA as text',
    '#ecfdf5': 'converged onto successContainer (#F0FDF4)',
    'rgba(0,0,0,0.6)': 'modal scrims unified onto theme.colors.overlay -- lighter, and slate-tinted rather than pure black',
  },
  'src/components/MaintenanceModal.jsx': {
    '#d97706': 'converged onto the warning token (#B45309), which passes AA as text',
    '#fffbeb': 'converged onto warningContainer (#FFF7ED)',
    'rgba(0,0,0,0.7)': 'a maintenance gate is never dismissible, so it takes overlayStrong (0.85) -- deliberately heavier than a sheet scrim',
  },
  'src/components/MapView/LocationMap.jsx': {
    '#f3f4f6': 'the map loading panel converged onto surfaceSunken (#F8FAFC)',
  },
  'src/components/SupportSheet.jsx': {
    '#eef2f6': 'converged onto the border token (#E2E8F0) -- one hairline colour app-wide',
  },
  'src/components/WelcomeModal.jsx': {
    'rgba(15,23,42,0.55)': 'modal scrims unified onto theme.colors.overlay; slightly lighter',
  },
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
    '#eab308': "categoryAccent.solar_repairing, the app's most saturated yellow. The owner's rule is that yellow is not a Fixhomi colour; green rather than another orange so it stays distinguishable from electrician, which took brand orange in the same pass.",
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
    '#eab308': "categoryAccent.solar_repairing, the app's most saturated yellow. The owner's rule is that yellow is not a Fixhomi colour; green rather than another orange so it stays distinguishable from electrician, which took brand orange in the same pass.",
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
  'src/screens/SubscriptionScreen.jsx': {
    '#0d1220': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    '#161d30': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    '#1a1f2e': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    '#131a2a': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    '#0f172a': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    '#1e293b': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    '#e8b54d': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    '#f2ce8a': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    '#b98a2f': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    '#ffd700': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    '#b9c0cf': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    '#8a93a6': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    'rgba(232,181,77,0.14)': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    'rgba(232,181,77,0.12)': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    'rgba(232,181,77,0.35)': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    'rgba(232,181,77,0.30)': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    'rgba(232,181,77,0.16)': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    'rgba(232,181,77,0.4)': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    'rgba(255,215,0,0.07)': "premium palette retuned for a premium read (values only, no key renamed): the ground moves off mid blue-slate onto a deeper warm neutral, and the metal off #FFD700 — pure spectrum yellow — onto champagne.",
    // The navy + gold hero, the active-plan header band and the launch-offer chip are
    // UNCHANGED -- they moved to the theme-independent `premium` group, which holds
    // their shipped values verbatim. Everything below is a light-surface change.
    //
    // This screen carried its own orange family (orange-600/700 on orange-50) beside
    // the semantic amber one. Converged, and the convergence is also the a11y fix:
    '#EA580C': 'a11y: orange-600 on its own tint was 4.0:1 -> the warning token (5.4:1)',
    '#C2410C': 'converged onto the warning token',
    '#C77D3A': 'a11y: 3.6:1 on white -> the warning token',
    '#FFF5EC': 'converged onto warningContainer',
    'rgba(253,242,232,0.92)': 'premium badge fill -> warningContainer; the 0.92 alpha was imperceptible',
    'rgba(246,124,22,0.35)': 'premium badge hairline -> brandOrangeBorder (#FDBA74)',
    'rgba(234,88,12,0.28)': 'journey node hairline -> warningBorder',
    'rgba(234,88,12,0.25)': 'journey tag hairline -> warningBorder',
    'rgba(234,88,12,0.18)': 'journey thread -> warningBorder',
    '#D97706': 'the pending-transaction amber converged onto the warning token; it keeps a DIFFERENT background (warningContainer) from refunded (warningFill) so the two states stay distinguishable',
    '#FFFBEB': 'converged onto warningContainer',
    'rgba(15,23,42,0.08)': 'journey card hairline -> border (#E2E8F0)',
    '#F8FBFF': 'the selected plan tint -> infoContainer (#EFF6FF); a touch stronger, and it is the selection cue',
    '#98A2B3': 'a11y: 2.6:1 on white -> textMuted (5.42:1)',
    '#DBEAFE': 'chip hairline converged onto infoBorder',
    '#F5F3FF': 'benefit-row violet tint -> accentVioletFill',
    '#F0F9FF': 'benefit-row sky tint converged onto infoFill; #0EA5E9 on it was 2.8:1',
    // Not flagged (still reachable elsewhere) but changed for real:
    '#16A34A': 'a11y: green-600 on its tint was 3.0:1 -> the success token (4.8:1)',
    '#0EA5E9': 'a11y: sky-500 on its tint was 2.8:1 -> the info token',
    '#2b76bc': 'the processing bar and benefit row keep brand blue as an icon, but blue-on-tint TEXT moves to the info token (4.4 -> 5.6)',
    'rgba(15, 23, 42, 0.6)': 'the transaction sheet scrim unified onto theme.colors.overlay (0.45)',
  },
  'src/screens/EmergencyServicesScreen.jsx': {
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'phone-button hairline -> successBorder (#BBF7D0)',
    '#065F46': 'service-tag ink converged onto the success token',
    '#FEE2E2': 'danger icon chips -> dangerFill, which keeps a step against the card under them',
    '#FFEDD5': 'the location-preview hairline and its nested icon chip split into warningBorder and warningFill, so the chip no longer matches the box it sits in',
    // Not flagged but changed for real:
    '#10B981': 'a11y: white on this fill was 2.46:1 -> the success fill',
    '#F59E0B': 'the header retry chip held BRAND ORANGE icons on a #FFF7ED fill at 2.3:1 -- an icon-only control below the 3:1 floor. Fill -> warningContainer, icon -> the warning token (5.4:1)',
    'rgba(15, 23, 42, 0.6)': 'the three modal scrims unified onto theme.colors.overlay (0.45)',
  },
  'src/screens/AccountSecurityScreen.jsx': {
    '#ECFDF5': 'converged onto successContainer',
    '#FFFBEB': 'converged onto warningContainer',
    '#0F172A': 'C.dark was dead at v1.0.9 -- not mapped; the shadow uses theme.colors.shadow',
    // Not flagged but changed for real:
    '#f67c16': 'the refresh-token row kept brand orange as an ICON on a #FFF7ED chip -- 2.3:1, below the 3:1 floor. Chip -> warningContainer, icon -> the warning token.',
    '#10B981': 'a11y: emerald-500 was 2.46:1 on white -> the success token',
    '#EF4444': 'a11y: red-500 was 3.76:1 on white -> the danger token',
  },
  'src/screens/SettingsScreen.jsx': {
    '#FEE2E2': 'the danger row tint -> dangerContainer',
    '#F9FAFB': 'language-option fill -> surfaceSunken',
    'rgba(0,0,0,0.35)': 'the native-iOS delete sheet scrim -> theme.colors.overlay',
    'rgba(0,0,0,0.4)': 'the language-modal scrim -> theme.colors.overlay',
    // The delete-account sheet deliberately reads as native iOS, so its colours moved
    // to the Apple tokens (iosLabel / iosFill / iosBlue / iosRed / iosDisabled /
    // iosPlaceholder), which follow the OS appearance. Three of those needed adding.
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
    '#F1F5F9': 'the icon chip and divider both map to bg, which is this value in light',
  },
  'src/screens/ChangePasswordScreen.jsx': {
    // A pre-design-system palette, and not even the Fixhomi orange.
    '#FF6B35': 'a11y: this coral measured 2.9:1 as text on white, and it is ONLY used as text here (three links + a spinner). Mapped to the warning token (5.4:1), matching the call already made for warm accent text on Subscription and EmergencyServices.',
    '#FFF0EB': 'converged onto warningContainer',
    '#1A1A2E': 'heading ink -> textPrimary',
    '#6C757D': 'secondary ink -> textSecondary (#475569)',
    '#ADB5BD': 'a11y: 2.1:1 on white -> textMuted (5.42:1)',
    '#E9ECEF': 'hairline -> border (#E2E8F0)',
    '#F8F9FA': 'sunken surface -> surfaceSunken (#F8FAFC)',
    '#DC3545': 'a11y: Bootstrap red was 4.53:1 -> the danger token (7.00:1)',
    '#28A745': 'a11y: Bootstrap green was 3.03:1 -> the success token (4.83:1)',
    '#E8F5E9': 'success icon circle -> successFill, which keeps a step on a dark card',
    '#FFFFFF': 'COLORS.white was dead at v1.0.9; the page background maps to surface',
  },
  'src/screens/ProfileScreen.jsx': {
    '#ffd700': "premium palette retuned for a premium read (values only, no key renamed): #FFD700 is pure spectrum yellow and #E8B54D is brassy; both move to champagne. Shared with SubscriptionScreen.",
    '#e8b54d': "premium palette retuned for a premium read (values only, no key renamed): #FFD700 is pure spectrum yellow and #E8B54D is brassy; both move to champagne. Shared with SubscriptionScreen.",
    // The brand-gradient hero and the premium card's dark header are UNCHANGED --
    // they moved to the theme-independent heroGradient / premium groups, which hold
    // their shipped values verbatim. Everything below is a light-surface change.
    //
    // This screen shipped FOUR near-white neutrals and two hairline weights. They
    // converge onto surface / surfaceSunken / bg / border, which is imperceptible in
    // light and gives each one a real step on a dark surface.
    '#FCFDFE': 'stat strip -> surface', '#F4F6FA': 'section band -> surfaceSunken',
    '#FAFBFC': 'text inputs -> surfaceSunken', '#F4F7FB': 'page background -> bg',
    '#FAFAFA': 'premium stats row -> surfaceSunken', '#F9FAFB': 'picker field -> surfaceSunken',
    '#F3F4F6': 'clear button and locked badge -> surfaceSunken',
    '#EDF1F6': 'the second hairline weight -> border (#E2E8F0)',
    'rgba(0,0,0,0.04)': 'the premium card hairline -> border',
    '#D6DEE8': 'the dashed empty-state outline -> borderMedium',
    '#C6C6C8': 'the iOS separator on the premium card -> border',
    // Warm family: this screen carried orange-600/700/800 alongside amber-600/700.
    '#D97706': 'converged onto the warning token', '#C2410C': 'converged onto the warning token',
    '#9A3412': 'converged onto the warning token', '#FED7AA': 'converged onto warningBorder',
    '#FFFBEB': 'converged onto warningContainer', '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'the focused OTP box -> warningContainer',
    // Other convergences
    '#0891B2': 'the cyan experience accent converged onto the info token',
    '#ECFEFF': 'its tint converged onto infoFill',
    '#93C5FD': 'the disabled detect-location fill -> infoBorder',
    '#8E8E93': 'the iOS grey on the premium card -> textMuted on the light part, premium.inkMuted on the dark header',
    '#34C759': 'the iOS green badge on the dark header -> premium.statusDot (#4ADE80)',
    'rgba(52,199,89,0.2)': 'its fill -> premium.statusFill',
    'rgba(255,215,0,0.08)': 'gold deco blobs converged onto premium.decoGold (0.07)',
    'rgba(255,215,0,0.06)': 'gold deco blobs converged onto premium.decoGold',
    'rgba(255,215,0,0.05)': 'gold deco blobs converged onto premium.decoGold',
    'rgba(99,102,241,0.08)': 'indigo deco blob converged onto premium.decoIndigo (0.06)',
    // Not flagged but changed for real:
    '#f67c16': 'brand orange as TEXT measured 2.7:1; the headline, chips and OTP ink take the warning token. It stays the fill on buttons, where onBrandOrange is the ink.',
    '#2b76bc': 'brand blue as TEXT on a tint was 4.4:1; those take the info token. It stays the fill on buttons and the verified chip.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted', '#6B7280': 'converged onto textSecondary',
    '#9CA3AF': 'placeholders -> textMuted', '#16A34A': 'a11y: 3.0:1 on its tint -> the success token',
    '#EA580C': 'converged onto the warning token',
  },
  'src/components/TimePickerField.jsx': {
    '#FFFBF6': 'the active field tint -> warningContainer',
  },
  'src/screens/WorkAvailabilityScreen.jsx': {
    '#FFF4EA': 'the today badge -> warningContainer',
    '#EEF2FF': 'the night-note card converged onto infoContainer (indigo-50 -> blue-50)',
    '#3730A3': 'its ink converged onto the info token',
    '#4F46E5': 'the clock icon -> altBlueIndigo',
  },
  'src/components/ProviderHomeTopRow.jsx': {
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'the nested verification badge -> successFill, so it keeps a step against the card',
    '#059669': 'converged onto the success token',
    '#10B98130': 'the alpha-concatenated green hairline is now `C.success + \'30\'`, so the tint follows the token',
    // Not flagged but now a real token rather than an inline literal:
    '#22C55E': 'the availability pad green is unchanged -- it moved to the new `online` token, which is identical in both themes and whose dark ink is asserted in check:contrast',
  },
  'src/components/WeeklyScheduleCard.jsx': {
    '#ECFDF5': 'converged onto successContainer', '#047857': 'converged onto the success token',
    '#1D4ED8': 'the saved-not-enforced ink converged onto the info token',
    '#FFF4EA': 'the today icon -> warningContainer', '#FED7AA': 'the chip hairline -> warningBorder',
    '#C2410C': 'chip letter converged onto the warning token',
    '#9A3412': 'chip hours converged onto the warning token',
  },
  'src/screens/PortfolioEditScreen.jsx': {
    // Platform identity colours are UNCHANGED (they moved to iconAccent). Their tints
    // are now the same colour at 10% alpha, which reproduces the shipped values
    // closely -- #DB2777 at 10% over white is #FBE9F1 against a shipped #FCE7F3 --
    // and, unlike a fixed pale tint, composites correctly on a dark card.
    '#E0F2FE': 'website tint -> iconAccent.website at 10%',
    '#FCE7F3': 'instagram tint -> iconAccent.instagram at 10%',
    '#FEE2E2': 'youtube tint -> iconAccent.youtube at 10%',
    '#DBEAFE': 'facebook tint -> iconAccent.facebook at 10%',
    '#E0F7FA': 'twitter tint -> iconAccent.twitter at 10%',
    '#F9FAFB': 'the gray-ramp sunken surface -> surfaceSunken',
    '#F3F4F6': 'chips and the back button -> surfaceSunken',
    '#FAFAFA': 'the add-image tile -> surfaceSunken',
    'rgba(0, 0, 0, 0.6)': 'the remove-image chip sits on a PHOTO, so it takes mapOverlay.hint (0.55) -- theme-independent, like the map chips',
  },
  'src/screens/ProviderHomeScreen.jsx': {
    '#eab308': "categoryAccent.solar_repairing, the app's most saturated yellow. The owner's rule is that yellow is not a Fixhomi colour; green rather than another orange so it stays distinguishable from electrician, which took brand orange in the same pass.",
    // The dark hero, its skeleton and the brand-orange tips card are UNCHANGED --
    // they moved to stableDark, whose values are the shipped ones.
    'rgba(255,255,255,0.5)': 'hero subtext -> stableDark.inkSoft (0.55)',
    'rgba(255,255,255,0.8)': 'drawer email -> stableDark.inkDim (0.6)',
    'rgba(255,255,255,0.9)': 'two near-opaque white fills -> surface; the 0.9 alpha was imperceptible',
    '#ECFDF5': 'converged onto successContainer',
    '#F7FEF9': 'the online availability card -> successContainer',
    '#10B98130': "alpha-concatenated green hairlines now follow the token: C.success + '30'",
    '#10B98118': "same, at 18",
    '#EAB30818': "the star tint now follows iconAccent.star + '18'",
    '#22C55E20': "the online card border now follows C.online + '20'",
    '#FEE2E2': 'the emergency card hairline -> dangerBorder',
    '#9A3412': 'a brown drop shadow -> theme.colors.shadow',
    'rgba(0,0,0,0.08)': 'the location modal hairline -> border',
  },
  'src/screens/ProviderRegisterScreen.jsx': {
    // Google's blue and Apple's black are UNCHANGED -- they moved to `vendor`, which
    // is never themed, because both are fixed by the vendor's sign-in guidelines.
    '#D97706': 'the out-of-zone amber converged onto the warning token',
    '#FFFBEB': 'its banner converged onto warningContainer',
    '#0891B2': 'the cyan experience preview converged onto the info token',
    'rgba(15, 23, 42, 0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
  },
  'src/screens/ProviderServiceHistoryScreen.jsx': {
    '#ECFDF5': 'converged onto successContainer', '#EDE9FE': 'converged onto accentVioletContainer',
    '#DBEAFE': 'converged onto infoContainer', '#FEF3C7': 'the pending tint -> warningContainer',
    '#FEE2E2': 'the cancel chip -> dangerFill', '#FAF5FF': 'the violet action tint -> accentVioletFill',
    '#E8ECF0': 'the filter-bar hairline -> border', '#EEF2F6': 'the date-row hairline -> border',
    '#991B1B': 'converged onto the danger token',
    'rgba(255,59,48,0.08)': "the iOS-red tint now follows the token: C.iosRed + '14'",
    'rgba(0,0,0,0.35)': 'the native-iOS OTP scrim -> theme.colors.overlay',
    'rgba(0,0,0,0.4)': 'its hint text -> iosPlaceholder',
    // The OTP sheet deliberately reads as native iOS, so its colours moved to the
    // Apple tokens, which follow the OS appearance rather than the app palette.
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
    '#10B981': 'a11y: emerald-500 was 2.46:1 -> the success token',
    '#8B5CF6': 'converged onto accentViolet',
  },
  'src/screens/ServiceApprovalsScreen.jsx': {
    // The fullscreen document viewer is a lightbox, so its ground stays near-black in
    // either theme and its chrome stays stableDark.
    'rgba(0,0,0,0.75)': 'the uploading scrim -> overlayPhoto (0.92); both read as opaque',
    'rgba(0,0,0,0.6)': 'the tap-to-zoom chip sits on an IMAGE, so it takes mapOverlay.hint',
    'rgba(255,255,255,0.25)': 'the active filter count -> stableDark.fill (0.2)',
    // Four near-white neutrals and four hairline weights converge.
    '#F5F5F7': 'the iOS-ish grey -> surfaceSunken', '#faf7f7': 'the warm page background -> bg',
    '#F3F4F6': 'chips -> surfaceSunken', '#FAFAFA': 'the upload tile -> surfaceSunken',
    '#F0F0F0': 'a hairline weight -> border',
    'rgba(0,0,0,0.04)': 'card hairline -> border', 'rgba(0,0,0,0.06)': 'modal hairline -> border',
    'rgba(0,0,0,0.08)': 'header hairline -> border', 'rgba(0,0,0,0.1)': 'upload hairline -> border',
    '#F0F7FF': 'the blue instruction tint -> infoFill',
    '#F7FAFF': 'the selected-card tint -> infoFill',
    '#DBEAFE': 'the badge tint -> infoFill',
    '#FEE2E2': 'the cancel chip -> dangerFill',
    'rgba(246, 124, 22, 0.15)': 'the add-button hairline -> brandOrangeBorder',
    // Not flagged but changed for real:
    '#9CA3AF': 'a11y: 2.54:1 on white -> textMuted',
    '#22C55E': 'the document-present green converged onto the success token',
    '#F59E0B': 'the staged-document amber converged onto the warning token',
  },
  // ── the ten modals reachable from themed screens ──
  // They share one gray-ramp palette, so the same convergences recur; the reasons are
  // identical by design rather than copy-paste. Declared per file because the gate is
  // keyed by file.
  'src/components/LocationPicker.jsx': {
    '#F9FAFB': 'gray-50 sunken surface -> surfaceSunken',
    '#F3F4F6': 'gray-100 chips and hairlines -> surfaceSunken',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    '#faf7f7': 'the warm page background -> bg',
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#1D4ED8': 'converged onto the info token',
    '#EAF2FB': 'a pale blue panel -> infoContainer',
    '#B7CDE6': 'its nested chip -> infoFill',
    '#FF6B00': 'a stray coral that is not the Fixhomi orange -> brandOrange',
    '#E0F2FE': 'website tint -> iconAccent.website at 10%',
    '#FCE7F3': 'instagram tint -> iconAccent.instagram at 10%',
    '#E0F7FA': 'twitter tint -> iconAccent.twitter at 10%',
    'rgba(15,23,42,0.55)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(0,0,0,0.6)': 'the modal scrim -> theme.colors.overlay; on ProviderDetailsModal the same value is a chip over imagery and takes mapOverlay.hint instead',
  },
  'src/components/ProviderDetailsModal.jsx': {
    '#F9FAFB': 'gray-50 sunken surface -> surfaceSunken',
    '#F3F4F6': 'gray-100 chips and hairlines -> surfaceSunken',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    '#faf7f7': 'the warm page background -> bg',
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#1D4ED8': 'converged onto the info token',
    '#EAF2FB': 'a pale blue panel -> infoContainer',
    '#B7CDE6': 'its nested chip -> infoFill',
    '#FF6B00': 'a stray coral that is not the Fixhomi orange -> brandOrange',
    '#E0F2FE': 'website tint -> iconAccent.website at 10%',
    '#FCE7F3': 'instagram tint -> iconAccent.instagram at 10%',
    '#E0F7FA': 'twitter tint -> iconAccent.twitter at 10%',
    'rgba(15,23,42,0.55)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(0,0,0,0.6)': 'the modal scrim -> theme.colors.overlay; on ProviderDetailsModal the same value is a chip over imagery and takes mapOverlay.hint instead',
  },
  'src/components/CancellationReasonModal.jsx': {
    '#F9FAFB': 'gray-50 sunken surface -> surfaceSunken',
    '#F3F4F6': 'gray-100 chips and hairlines -> surfaceSunken',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    '#faf7f7': 'the warm page background -> bg',
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#1D4ED8': 'converged onto the info token',
    '#EAF2FB': 'a pale blue panel -> infoContainer',
    '#B7CDE6': 'its nested chip -> infoFill',
    '#FF6B00': 'a stray coral that is not the Fixhomi orange -> brandOrange',
    '#E0F2FE': 'website tint -> iconAccent.website at 10%',
    '#FCE7F3': 'instagram tint -> iconAccent.instagram at 10%',
    '#E0F7FA': 'twitter tint -> iconAccent.twitter at 10%',
    'rgba(15,23,42,0.55)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(0,0,0,0.6)': 'the modal scrim -> theme.colors.overlay; on ProviderDetailsModal the same value is a chip over imagery and takes mapOverlay.hint instead',
  },
  'src/components/MapPickerModal.jsx': {
    '#F9FAFB': 'gray-50 sunken surface -> surfaceSunken',
    '#F3F4F6': 'gray-100 chips and hairlines -> surfaceSunken',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    '#faf7f7': 'the warm page background -> bg',
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#1D4ED8': 'converged onto the info token',
    '#EAF2FB': 'a pale blue panel -> infoContainer',
    '#B7CDE6': 'its nested chip -> infoFill',
    '#FF6B00': 'a stray coral that is not the Fixhomi orange -> brandOrange',
    '#E0F2FE': 'website tint -> iconAccent.website at 10%',
    '#FCE7F3': 'instagram tint -> iconAccent.instagram at 10%',
    '#E0F7FA': 'twitter tint -> iconAccent.twitter at 10%',
    'rgba(15,23,42,0.55)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(0,0,0,0.6)': 'the modal scrim -> theme.colors.overlay; on ProviderDetailsModal the same value is a chip over imagery and takes mapOverlay.hint instead',
  },
  'src/components/RatingModal.jsx': {
    '#F9FAFB': 'gray-50 sunken surface -> surfaceSunken',
    '#F3F4F6': 'gray-100 chips and hairlines -> surfaceSunken',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    '#faf7f7': 'the warm page background -> bg',
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#1D4ED8': 'converged onto the info token',
    '#EAF2FB': 'a pale blue panel -> infoContainer',
    '#B7CDE6': 'its nested chip -> infoFill',
    '#FF6B00': 'a stray coral that is not the Fixhomi orange -> brandOrange',
    '#E0F2FE': 'website tint -> iconAccent.website at 10%',
    '#FCE7F3': 'instagram tint -> iconAccent.instagram at 10%',
    '#E0F7FA': 'twitter tint -> iconAccent.twitter at 10%',
    'rgba(15,23,42,0.55)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(0,0,0,0.6)': 'the modal scrim -> theme.colors.overlay; on ProviderDetailsModal the same value is a chip over imagery and takes mapOverlay.hint instead',
  },
  'src/components/AadhaarVerificationModal.jsx': {
    '#F9FAFB': 'gray-50 sunken surface -> surfaceSunken',
    '#F3F4F6': 'gray-100 chips and hairlines -> surfaceSunken',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    '#faf7f7': 'the warm page background -> bg',
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#1D4ED8': 'converged onto the info token',
    '#EAF2FB': 'a pale blue panel -> infoContainer',
    '#B7CDE6': 'its nested chip -> infoFill',
    '#FF6B00': 'a stray coral that is not the Fixhomi orange -> brandOrange',
    '#E0F2FE': 'website tint -> iconAccent.website at 10%',
    '#FCE7F3': 'instagram tint -> iconAccent.instagram at 10%',
    '#E0F7FA': 'twitter tint -> iconAccent.twitter at 10%',
    'rgba(15,23,42,0.55)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(0,0,0,0.6)': 'the modal scrim -> theme.colors.overlay; on ProviderDetailsModal the same value is a chip over imagery and takes mapOverlay.hint instead',
  },
  'src/components/AddressAutocomplete.jsx': {
    '#F9FAFB': 'gray-50 sunken surface -> surfaceSunken',
    '#F3F4F6': 'gray-100 chips and hairlines -> surfaceSunken',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    '#faf7f7': 'the warm page background -> bg',
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#1D4ED8': 'converged onto the info token',
    '#EAF2FB': 'a pale blue panel -> infoContainer',
    '#B7CDE6': 'its nested chip -> infoFill',
    '#FF6B00': 'a stray coral that is not the Fixhomi orange -> brandOrange',
    '#E0F2FE': 'website tint -> iconAccent.website at 10%',
    '#FCE7F3': 'instagram tint -> iconAccent.instagram at 10%',
    '#E0F7FA': 'twitter tint -> iconAccent.twitter at 10%',
    'rgba(15,23,42,0.55)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(0,0,0,0.6)': 'the modal scrim -> theme.colors.overlay; on ProviderDetailsModal the same value is a chip over imagery and takes mapOverlay.hint instead',
  },
  'src/components/PhoneChangeModal.jsx': {
    '#F9FAFB': 'gray-50 sunken surface -> surfaceSunken',
    '#F3F4F6': 'gray-100 chips and hairlines -> surfaceSunken',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    '#faf7f7': 'the warm page background -> bg',
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#1D4ED8': 'converged onto the info token',
    '#EAF2FB': 'a pale blue panel -> infoContainer',
    '#B7CDE6': 'its nested chip -> infoFill',
    '#FF6B00': 'a stray coral that is not the Fixhomi orange -> brandOrange',
    '#E0F2FE': 'website tint -> iconAccent.website at 10%',
    '#FCE7F3': 'instagram tint -> iconAccent.instagram at 10%',
    '#E0F7FA': 'twitter tint -> iconAccent.twitter at 10%',
    'rgba(15,23,42,0.55)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(0,0,0,0.6)': 'the modal scrim -> theme.colors.overlay; on ProviderDetailsModal the same value is a chip over imagery and takes mapOverlay.hint instead',
  },
  'src/components/DateTimePicker.jsx': {
    '#F9FAFB': 'gray-50 sunken surface -> surfaceSunken',
    '#F3F4F6': 'gray-100 chips and hairlines -> surfaceSunken',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    '#faf7f7': 'the warm page background -> bg',
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#1D4ED8': 'converged onto the info token',
    '#EAF2FB': 'a pale blue panel -> infoContainer',
    '#B7CDE6': 'its nested chip -> infoFill',
    '#FF6B00': 'a stray coral that is not the Fixhomi orange -> brandOrange',
    '#E0F2FE': 'website tint -> iconAccent.website at 10%',
    '#FCE7F3': 'instagram tint -> iconAccent.instagram at 10%',
    '#E0F7FA': 'twitter tint -> iconAccent.twitter at 10%',
    'rgba(15,23,42,0.55)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(0,0,0,0.6)': 'the modal scrim -> theme.colors.overlay; on ProviderDetailsModal the same value is a chip over imagery and takes mapOverlay.hint instead',
  },
  'src/components/SavedAddresses.jsx': {
    '#F9FAFB': 'gray-50 sunken surface -> surfaceSunken',
    '#F3F4F6': 'gray-100 chips and hairlines -> surfaceSunken',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    '#faf7f7': 'the warm page background -> bg',
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#1D4ED8': 'converged onto the info token',
    '#EAF2FB': 'a pale blue panel -> infoContainer',
    '#B7CDE6': 'its nested chip -> infoFill',
    '#FF6B00': 'a stray coral that is not the Fixhomi orange -> brandOrange',
    '#E0F2FE': 'website tint -> iconAccent.website at 10%',
    '#FCE7F3': 'instagram tint -> iconAccent.instagram at 10%',
    '#E0F7FA': 'twitter tint -> iconAccent.twitter at 10%',
    'rgba(15,23,42,0.55)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(0,0,0,0.6)': 'the modal scrim -> theme.colors.overlay; on ProviderDetailsModal the same value is a chip over imagery and takes mapOverlay.hint instead',
  },
  // ── the twelve small components still reachable from a themed screen ──
  'src/components/GraphBackground.jsx': {
    // Decorative brand-tinted background art. Theme-independent by design, so these
    // moved to brandTint, which converges the four hand-tuned alphas onto two steps.
    'rgba(43,118,188,0.07)': 'the grid line -> brandTint.blue06',
    'rgba(43,118,188,0.04)': 'a decor blob -> brandTint.blue05',
    'rgba(43,118,188,0.03)': 'a decor blob -> brandTint.blue05',
    'rgba(246,124,22,0.035)': 'a decor blob -> brandTint.orange04',
  },
  'src/components/SafeBlurView.jsx': {
    'rgba(15,23,42,0.92)': 'the DARK blur fallback -> stableDark.surface (0.95); it must stay dark whatever the theme, because the blurType asked for dark',
    'rgba(255,255,255,0.92)': 'the LIGHT blur fallback -> the theme surface, so it follows the appearance instead of always being white',
  },
  'src/components/PhoneOnboardingSheet.jsx': {
    '#059669': 'the benefit tick converged onto the success token',
    '#ECFDF5': 'converged onto successContainer',
    'rgba(15,23,42,0.55)': 'the sheet scrim -> theme.colors.overlay (0.45)',
    // The warm CTA gradient is UNCHANGED -- its three stops moved to heroGradient.
  },
  'src/components/AppleEmailCollectionModal.jsx': {
    '#e06b0a': 'COLORS.primaryDark was dead at v1.0.9 -- defined, never referenced. Removed rather than mapped.',
    '#ECFDF5': 'converged onto successContainer',
    'rgba(15,23,42,0.55)': 'the sheet scrim -> theme.colors.overlay',
  },
  'src/components/ImageViewerModal.jsx': {
    // A photo viewer is a lightbox: the ground stays near-black and the chrome stays
    // white in EITHER theme, so almost all of this is theme-independent by design.
    'rgba(0,0,0,0.4)': 'a chrome scrim -> theme.colors.overlay (0.45)',
    'rgba(0,0,0,0.6)': 'the hint chip sits on the IMAGE -> mapOverlay.hint (0.55)',
    'rgba(255,255,255,0.4)': 'the inactive page dot -> stableDark.inkFaint (0.45)',
  },
  'src/components/CityAutocomplete.jsx': {
    '#FF6B00': 'a stray coral that is NOT the Fixhomi orange -> brandOrange',
    '#FAFBFC': 'the input fill -> surfaceSunken',
    '#F3F4F6': 'gray-100 chips -> surfaceSunken',
  },
  'src/components/PhoneInput.jsx': {
    '#F3F4F6': 'the country-code chip -> surfaceSunken',
  },
  'src/components/LocationTrackingBanner.jsx': {
    '#9A3412': 'the amber-900 ink and its brown drop shadow both converge -- ink onto the warning token, shadow onto theme.colors.shadow',
    '#C2410C': 'converged onto the warning token',
  },
  'src/components/RegisterChoice.jsx': {
    // Apple's black card and Google's four brand colours are UNCHANGED -- they moved
    // to `vendor`, which is never themed, because both are fixed by the vendors'
    // sign-in guidelines rather than by our palette.
    '#EEF2F6': 'a hairline weight -> border',
  },
  // ── Phase 9: the auth, verification and insurance screens ──
  // One slate ramp shared across all fourteen, so the same convergences recur. Google's
  // and Apple's sign-in colours are UNCHANGED -- they moved to `vendor`, which is never
  // themed, because both are fixed by the vendors' guidelines.
  'src/screens/RegisterScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/LoginScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/InsuranceScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/VerificationScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/UnifiedUserAuthScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/OTPVerifyScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/UserTypeScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/VerificationDashboardScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/ForgotPasswordScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/OTPLoginScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/PhoneSignupScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/PhoneNumberScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/UserAuthScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
  },
  'src/screens/ProviderAuthScreen.jsx': {
    '#FFFBEB': 'converged onto warningContainer',
    '#FEF3C7': 'converged onto warningContainer',
    '#FFFBF5': 'converged onto warningContainer',
    '#FFF1E5': 'converged onto warningContainer',
    '#D97706': 'converged onto the warning token',
    '#ECFDF5': 'converged onto successContainer',
    '#D1FAE5': 'a nested success chip -> successFill, so it keeps a step from its card',
    'rgba(16,185,129,0.08)': 'a success wash -> successFill',
    '#059669': 'converged onto the success token',
    '#065F46': 'converged onto the success token',
    '#FEE2E2': 'a nested danger chip -> dangerFill',
    '#FCA5A5': 'the stronger red hairline converged onto dangerBorder',
    '#991B1B': 'converged onto the danger token',
    '#DBEAFE': 'converged onto infoFill',
    '#E9F1FA': 'a pale blue panel -> infoContainer',
    '#FAFBFC': 'an input fill -> surfaceSunken',
    'rgba(15,23,42,0.5)': 'the modal scrim -> theme.colors.overlay (0.45)',
    'rgba(246,124,22,0.07)': 'a brand wash -> brandTint.orange06',
    'rgba(43,118,188,0.07)': 'a brand wash -> brandTint.blue06',
    'rgba(246,124,22,0.2)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(246,124,22,0.3)': 'a brand hairline -> stableDark.brandOrangeLine (0.25)',
    'rgba(43,118,188,0.2)': 'a brand hairline -> stableDark.brandBlueLine (0.25)',
    '#f67c16': 'brand orange as TEXT measured 2.7:1 on white, so text and icons take the warning token. It stays the FILL on buttons, where onBrandOrange is the ink.',
    '#94A3B8': 'a11y: 2.54:1 on white -> textMuted',
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
  'premium',
  'heroGradient',
  'vendor',
  'mapPin',
  'splash',
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
