/**
 * Raw colour palette — the single source of hex literals in this app.
 *
 * Nothing outside this file may contain a hex literal; scripts/check-hex.js
 * enforces that for every file listed in scripts/migrated-files.json.
 *
 * Values were chosen against WCAG AA and are proven by scripts/check-contrast.js.
 * Do not hand-edit a value without re-running that script.
 */

// Fixhomi brand — unchanged from the existing app. Do not alter.
export const brand = {
  orange: '#f67c16',
  blue: '#2b76bc',
  blueDeep: '#1E5F9E', // blue dark enough to be readable AS TEXT on light surfaces
  blueLight: '#5FA8E8', // blue light enough to be readable on dark surfaces
};

// Non-brand blues already in the app (~87 occurrences). Kept as distinct tokens
// so light mode is unchanged; folding them into the brand blue would be a
// redesign, not a theme change. Tracked as brand-consistency debt in the phase
// board for a later, deliberate pass.
export const altBlue = {
  indigo: '#2563EB', // 38 occurrences
  sky: '#3B82F6', // 33 occurrences
  ios: '#007AFF', // 16 occurrences — iOS system blue, likely intentional
};

// Categorical violet accent (~42 occurrences). NOT decorative: it colour-codes
// service categories (carpenter, photographer), event services, portfolio and
// creative surfaces, and the in-progress/tracking state. It earns a token so it
// stops being reintroduced as loose hex — but it stays scoped to those existing
// uses. Brand orange and blue remain the identity; this is a support accent.
//
// The shipped #8B5CF6 fails AA on light surfaces at 3.87, so the light token is
// the darker #7C3AED the app already uses elsewhere for violet TEXT.
export const violet = {
  light: '#7C3AED', // 5.20 min on light surfaces
  dark: '#A78BFA', // 5.38 min on dark surfaces
  containerLight: '#F3E8FF',
  containerDark: '#241B3D',
};

// Third-party brand colours. NEVER themed and never token-mapped: Google's
// brand guidelines fix this value for sign-in buttons, and altering it breaks
// compliance. Kept here only so the value has one home.
export const vendor = {
  googleBlue: '#4285F4',
};

// Service-category accents. THEME-INDEPENDENT on purpose: these identify a
// trade (electrician, plumber, …), not a UI state, so they must stay the same
// colour in light and dark or the categories stop being recognisable.
//
// Verified 2026-09-25: all twelve clear 3:1 against the near-black card, from
// mason_tiler at 3.73 to solar at 9.32, so none needed a dark variant. Six sit
// below 3:1 on WHITE, which is not a failure because each icon sits above its
// text label and is therefore supplementary, but it is why they look washed out
// in light mode.
//
// Single source of truth: Icon.jsx and UserHomeScreen each carried their own
// copy of this map. They were byte-identical across all twelve entries, so they
// now both read from here.
export const categoryAccent = {
  electrician: '#F59E0B',
  plumber: '#3B82F6',
  electronics_technician: '#6366F1',
  carpenter: '#8B5CF6',
  painter: '#EC4899',
  solar_repairing: '#EAB308',
  welder: '#EF4444',
  salon: '#F472B6',
  vehicle_cleaning: '#0EA5E9',
  mason_tiler: '#78716C',
  driver: '#14B8A6',
  ac_repair: '#06B6D4',
};


// Fallback accents for the icon map. THEME-INDEPENDENT, and only ever used when
// a caller does not pass an explicit `color` — every themed screen does pass
// one. They encode identity (a trade, a status) rather than a UI surface, so
// they stay constant across light and dark. The generic no-match fallback is a
// real theme token, because that one DOES sit on a themed background.
export const iconAccent = {
  'photographer': '#8B5CF6',
  'influencer': '#EC4899',
  'snake_catcher': '#10B981',
  'private_ambulance': '#EF4444',
  'mortuary_van': '#6B7280',
  'pending': '#F59E0B',
  'accepted': '#3B82F6',
  'in-progress': '#8B5CF6',
  'completed': '#10B981',
  'cancelled': '#EF4444',
  'rejected': '#EF4444',
  'verified': '#10B981',
  'unverified': '#F59E0B',
  'warning': '#F59E0B',
  'verified_user': '#10B981',
  'shield': '#3B82F6',
  'call': '#10B981',
  'directions': '#3B82F6',
  'track': '#8B5CF6',
  'navigate': '#3B82F6',
  'chatbox': '#F67C16',
  'sms': '#F67C16',
  'chat': '#3B82F6',
  'star': '#F59E0B',
  'cancel': '#EF4444',
  'my_location': '#3B82F6',
  'other_location': '#8B5CF6',
  'search_location': '#6B7280',
  'gps': '#3B82F6',
  'live': '#EF4444',
  'online': '#10B981',
  'offline': '#9CA3AF',
  'close-circle': '#EF4444',
  'check-circle': '#10B981',
  'heart': '#EF4444',
  'pin': '#EF4444',
  'close_circle': '#EF4444',
};

// Surfaces that stay DARK in BOTH themes, and the ink that sits on them.
//
// THE TRAP THIS EXISTS TO PREVENT: a theme-flipping token like textPrimary is
// white in dark mode and near-black in light. Used on a surface that is always
// dark — the notification banner, a dark hero — it goes invisible the moment
// the user switches to light. The Fixhomi website hit exactly this.
//
// So anything permanently dark uses these STABLE values instead. They do not
// flip, because the surface underneath them does not flip either.
export const stableDark = {
  surface: 'rgba(15, 23, 42, 0.95)', // the banner's reduced-transparency fallback
  ink: '#FFFFFF',
  inkMuted: 'rgba(255, 255, 255, 0.7)',
  inkFaint: 'rgba(255, 255, 255, 0.45)',
  fill: 'rgba(255, 255, 255, 0.2)',
  fillSubtle: 'rgba(255, 255, 255, 0.08)',
  fillChip: 'rgba(255, 255, 255, 0.12)',
  shadowBase: '#000000',
  successFill: 'rgba(16, 185, 129, 0.15)',
  successLine: 'rgba(16, 185, 129, 0.3)',
  infoFill: 'rgba(59, 130, 246, 0.15)',
  infoLine: 'rgba(59, 130, 246, 0.3)',

  // The drawer hero. A brand-dark panel above a light menu body, so the panel
  // and everything on it stays put while the body below flips with the theme.
  heroSurface: '#0F172A',
  heroCard: '#1E293B',
  heroBackdrop: 'rgba(15, 23, 42, 0.6)',
  heroDivider: 'rgba(255, 255, 255, 0.1)',
  heroRowFill: 'rgba(255, 255, 255, 0.03)',
  brandBlueFill: 'rgba(43, 118, 188, 0.08)',
  brandBlueLine: 'rgba(43, 118, 188, 0.25)',
  brandBlueLineStrong: 'rgba(43, 118, 188, 0.6)',
  brandBlueChip: 'rgba(43, 118, 188, 0.25)',
  brandOrangeFill: 'rgba(246, 124, 22, 0.08)',
  brandOrangeLine: 'rgba(246, 124, 22, 0.25)',
  brandOrangeLineStrong: 'rgba(246, 124, 22, 0.6)',
  brandOrangeChip: 'rgba(246, 124, 22, 0.25)',
  onlineDot: '#22C55E',
  onlineChip: 'rgba(34, 197, 94, 0.18)',
  onlineInk: '#DCFCE7',
  verifiedInk: '#86EFAC',
  inkSoft: 'rgba(255, 255, 255, 0.55)',
  inkDim: 'rgba(255, 255, 255, 0.6)',
};

// The emergency / panic surface (PSATriggerScreen). A deliberately alarming
// dark-red full screen. THEME-INDEPENDENT: it signals danger, not a UI mode, and
// it must look identical whichever appearance the user has chosen. Same class of
// reasoning as stableDark — the surface does not flip, so nothing on it may.
export const stableEmergency = {
  surface: '#7F1D1D',
  ink: '#FFFFFF',
  inkMuted: 'rgba(255, 255, 255, 0.7)',
  inkFaint: 'rgba(255, 255, 255, 0.6)',
  fill: 'rgba(255, 255, 255, 0.12)',
  fillStrong: 'rgba(255, 255, 255, 0.95)',
  line: 'rgba(255, 255, 255, 0.2)',
  sliderTrack: 'rgba(255, 255, 255, 0.15)',
  danger: '#DC2626',
  success: '#16A34A',
  successSurface: '#052E16',
  onFillStrong: '#1E293B',
  fillFaint: 'rgba(255, 255, 255, 0.08)',
  fillSoft: 'rgba(255, 255, 255, 0.1)',
  lineSoft: 'rgba(255, 255, 255, 0.3)',
  dangerFill: 'rgba(220, 38, 38, 0.2)',
  shadowBase: '#000000',
};

// Low-alpha brand washes. THEME-INDEPENDENT because alpha composites against
// whatever surface is beneath: 10% orange reads as a pale wash on white and as a
// dark orange-tinted panel on near-black. Both are correct, so one value serves
// both themes.
export const brandTint = {
  orange04: 'rgba(246, 124, 22, 0.04)',
  orange06: 'rgba(246, 124, 22, 0.06)',
  orange10: 'rgba(246, 124, 22, 0.1)',
  orange12: 'rgba(246, 124, 22, 0.12)',
  blue05: 'rgba(43, 118, 188, 0.05)',
  blue06: 'rgba(43, 118, 188, 0.06)',
  blue08: 'rgba(43, 118, 188, 0.08)',
  blue10: 'rgba(43, 118, 188, 0.1)',
  violet04: 'rgba(124, 58, 237, 0.04)',
  violet10: 'rgba(124, 58, 237, 0.1)',
};

// Route overlay drawn ON the Mapbox canvas. THEME-INDEPENDENT: the line sits on
// a map, not a themed surface, and a warm orange route reads clearly against both
// the light Streets style and the dark navigation-night style.
export const mapRoute = {
  outline: '#c45a00',
  shimmer: '#FFD580',
};

// Referral leaderboard medals. THEME-INDEPENDENT: gold, silver and bronze are
// what they are. Recognisability beats theme consistency here.
export const medal = {
  gold: '#F59E0B',
  silver: '#94A3B8',
  bronze: '#CD7F32',
  goldInk: '#B7791F',
  silverInk: '#64748B',
  bronzeInk: '#92400E',
};

// Apple system colours, light and dark, exactly as the HIG defines them.
//
// Used only where a surface is deliberately meant to feel native iOS — today
// that is CustomDialog, whose whole purpose is to read as a system alert. They
// are NOT brand tokens and must not be swapped for Fixhomi colours.
//
// KNOWN AND ACCEPTED: white on systemBlue is 4.02:1 light and 3.65:1 dark, and
// on systemRed 3.55:1 and 3.41:1. Those sit under the 4.5 AA wants for normal
// text. They are Apple's own values, used in Apple's own alerts, and deviating
// from them is what would look broken. Recorded as a deliberate exception
// rather than silently fixed or silently ignored. Everything Fixhomi controls
// on these surfaces still clears AA.
export const iosSystem = {
  light: {
    blue: '#007AFF',
    red: '#FF3B30',
    label: '#000000',
    labelSecondary: 'rgba(0, 0, 0, 0.55)',
    surfaceFallback: '#F2F2F7',
  },
  dark: {
    blue: '#0A84FF',
    red: '#FF453A',
    label: '#FFFFFF',
    labelSecondary: 'rgba(235, 235, 245, 0.6)',
    surfaceFallback: '#1C1C1E',
  },
  onAccent: '#FFFFFF',
};

// Neutral SLATE ramp (cool-tinted) — the app's dominant scale, 669 occurrences.
export const slate = {
  0: '#FFFFFF',
  25: '#F8FAFC',
  50: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#78879C', // darkened from Tailwind #94A3B8, which fails AA at 2.33:1
  500: '#5B6878', // darkened from Tailwind #64748B, which fails AA at 4.32:1
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
};

// Neutral GRAY ramp (neutral-tinted) — the app's SECOND scale, 321 occurrences,
// used interchangeably with slate; 13 files mix both internally.
//
// Only the steps that are BOTH perceptibly different from slate AND accessible
// are kept as separate variants. Measured CIE76 dE against the slate step:
//   900 dE 3.09 | 800 dE 2.81 | 700 dE 2.84 | 300 dE 3.74 | 200 dE 2.47  -> keep
//   100 dE 1.46 | 50  dE 0.61                                -> below JND, converge
//   500 dE 5.99 | 400 dE 5.59  -> visible, but BOTH fail WCAG AA as text
//                                 (4.39:1 and 2.31:1), so both must change
//                                 anyway; they converge on the accessible slate
//                                 values above.
export const gray = {
  200: '#E5E7EB',
  300: '#D1D5DB',
  700: '#374151',
  800: '#1F2937',
  900: '#111827',
};

// Dark-mode surface ramp — near-black, neutral, and hardened for every device class.
//
// Owner decision 2026-09-25: the previous ramp was slate-derived and read navy
// (39% saturation, blue running 22 points above red). This one is effectively
// neutral (~5% saturation) and genuinely dark.
//
// DEVICE-CLASS HARDENING — the reason these values are not simply #000/#111/#222:
//
//  - HIGH END (OLED): `sunken` is true black so those pixels switch off, which is
//    where the battery saving comes from. Text is #F1F5F9 rather than pure white
//    to avoid the halation/smearing OLED panels show with #FFF on #000.
//
//  - LOW END (6-bit + FRC LCD, which is most budget Android and therefore most
//    providers): very dark values CRUSH together on these panels. Contrast RATIO
//    is a poor guide this close to black — it compresses toward 1.0 no matter
//    what — so the steps are sized by 8-bit CODE VALUE gap instead, held at 10+
//    between adjacent surfaces (0->10->23->38).
//
//  - The real insurance is `border`. If a cheap panel crushes the fills anyway,
//    a card is still defined by its 1px border, which holds 1.5:1 or better
//    against every surface. This is why the design rule is "cards carry a border,
//    not a shadow" — it is a device-robustness decision, not only an aesthetic one.
//
//  - `borderStrong` clears 3.0 on all three surfaces because WCAG 1.4.11 does bind
//    input and focus boundaries: they identify the component.
export const dark = {
  sunken: '#000000', // true black — OLED pixels off
  base: '#0A0A0C',
  surface: '#17171B',
  elevated: '#26262B',
  border: '#42424A', // decorative, but the low-end safety net
  borderMedium: '#52525C',
  borderStrong: '#757581', // >= 3.0 everywhere — inputs and focus rings
  textPrimary: '#F1F5F9',
  textSecondary: '#A9B4C4',
  textMuted: '#8B96A8',
  shadow: '#000000',
};

// Semantic hues, light-surface variants (all >= 4.5:1 on white and on slate.50).
export const semanticLight = {
  success: '#15803D',
  warning: '#B45309',
  danger: '#B91C1C',
  successContainer: '#F0FDF4',
  warningContainer: '#FFF7ED',
  dangerContainer: '#FEF2F2',
  infoContainer: '#EFF6FF',
};

// Semantic hues, dark-surface variants (all >= 4.5:1 on every dark surface).
//
// Containers are re-based onto the near-black ramp. On a dark card a tinted fill
// alone barely reads — the green sat at 1.15:1 against the old surface — so each
// status also carries a border in its own hue (semanticDarkBorder below). The
// TEXT and DOT do the semantic work at 6:1+; the border only supplies definition,
// which is why it is not held to 3.0.
export const semanticDark = {
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  successContainer: '#0E2E20',
  warningContainer: '#2E2107',
  dangerContainer: '#2F1518',
  infoContainer: '#102639',
};

// Visible hairlines for danger- and warning-styled ROWS — a tinted seam across a
// plain card, as in the drawer's logout item. Deliberately fainter than the
// container borders below, because a row has no fill to sit against.
export const semanticLine = {
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  dangerFillLight: 'rgba(239, 68, 68, 0.08)',
  warningLight: 'rgba(217, 119, 6, 0.25)',
  warningFillLight: 'rgba(217, 119, 6, 0.12)',
};

// Borders for the status CONTAINERS — a tint-200 hairline that gives a filled
// card its edge.
//
// These were once `transparent` in light mode, on the theory that a light chip
// reads fine on its fill alone. That was wrong: at v1.0.9 every consumer —
// Alert's four variants, the tracking screen's address bar, the event screen's
// venue buttons — drew `borderWidth: 1` in one of these hues, so making the
// token transparent silently erased a hairline the design relied on. Restored to
// the shipped values, which is both the bug fix and exact light fidelity.
export const semanticLightBorder = {
  success: '#BBF7D0',
  warning: '#FDE68A',
  danger: '#FECACA',
  info: '#BFDBFE',
  brandOrange: '#FDBA74',
  accentViolet: '#DDD6FE',
};

// The dark-surface counterparts — the status hue at ~70% over the card. The TEXT
// and DOT do the semantic work at 6:1+; the border only supplies definition,
// which is why it is not held to 3.0.
export const semanticDarkBorder = {
  success: '#2A9B77',
  warning: '#B58D25',
  danger: '#B3565B',
  info: '#487DAE',
  brandOrange: '#B0662C',
  accentViolet: '#6B5BA5',
};

export const overlay = {
  light: 'rgba(15,23,42,0.45)',
  dark: 'rgba(0,0,0,0.65)',
};
