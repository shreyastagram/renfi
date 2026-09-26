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
  // Orange dark enough to be readable AS A GLYPH on light surfaces — the twin of
  // blueDeep above. Brand orange is 2.69:1 on white, under the 3:1 WCAG 1.4.11
  // asks of a control you must see to identify; this is 4.19:1 and still reads as
  // Fixhomi orange rather than brown. Only for light: on a dark surface the
  // ordinary brand orange is already 7.17:1 and this would be muddy.
  orangeDeep: '#A85408',
  // The ink that sits ON brand orange, identical in both themes — the semantic
  // onBrandOrange resolves here either way. Needed by files that still carry a
  // legacy local BRAND palette and cannot reach the theme. 6.64:1 on #f67c16.
  onOrange: '#0F172A',
  // The plate a brand mark sits on. fixhomi_logo.jpg is a JPEG — no alpha — with a
  // pure-white background, and the mark inside it is orange and blue specified
  // against white. So its container must stay light in BOTH themes: on a themed
  // fill the logo became a white SQUARE floating inside a near-black CIRCLE.
  // Keeping the plate white renders it as the brand tile it already is in light.
  plate: '#FFFFFF',
  // Tinted fills for orange chips. They used to borrow warning/*, whose dark value
  // (#2E2107) is olive — that is the yellow the owner keeps seeing. These are hued
  // off #f67c16 instead, so a brand chip stays orange in both themes.
  orangeFillLight: '#FFF3E8',
  orangeFillDark: '#2A1708',
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
  // Apple's Sign in with Apple button is specified as black on light backgrounds.
  // Like the Google blue, it is fixed by the vendor's guidelines, not by our theme.
  appleBlack: '#000000',
  onVendor: '#FFFFFF',
  // Google's four brand colours, used for the "G" gradient on the sign-in card.
  // Fixed by Google's guidelines; never themed.
  googleRed: '#EA4335',
  googleYellow: '#FBBC05',
  googleGreen: '#34A853',
  // WhatsApp's brand green, used for the "chat on WhatsApp" support row. Same rule
  // as the others: it identifies WhatsApp, so it does not flip with our theme.
  whatsappGreen: '#25D366',
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
  // Values only — these keys are looked up by service name
  // (categoryAccent[service]), so renaming one silently drops its colour.
  // electrician was #F59E0B amber: it is the profession label on the provider
  // profile, so it reads as the app using yellow, not as a category hue.
  electrician: '#f67c16',
  plumber: '#3B82F6',
  electronics_technician: '#6366F1',
  carpenter: '#8B5CF6',
  painter: '#EC4899',
  // was #EAB308, the most saturated yellow in the app. Green rather than another
  // orange so it stays distinguishable from electrician above.
  solar_repairing: '#16A34A',
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
  // Brand orange, not amber (#F59E0B). A rating star is a decorative brand accent,
  // not a status signal, so it has no claim on the caution hue — and the owner's
  // rule is that yellow is not a Fixhomi colour. Status pending/warning keep amber:
  // those ARE signals, and a caution colour that reads as brand is worse than yellow.
  'star': '#f67c16',
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
  // Portfolio platforms. The app's chosen accent per platform rather than each
  // brand's official colour, but the same reasoning applies: it identifies a
  // destination, so it must not change with the theme.
  'instagram': '#DB2777',
  'youtube': '#DC2626',
  'website': '#0284C7',
  'facebook': '#2563EB',
  'tiktok': '#7C3AED',
  'twitter': '#0EA5E9',
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
  dangerFill: 'rgba(239, 68, 68, 0.15)',
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
  onlineBorder: '#16A34A', // the ring around an online pad
  onlineChip: 'rgba(34, 197, 94, 0.18)',
  onlineInk: '#DCFCE7',
  verifiedInk: '#86EFAC',
  inkSoft: 'rgba(255, 255, 255, 0.55)',
  inkSoftFade: 'rgba(255, 255, 255, 0)', // the transparent end of an ink gradient
  inkDim: 'rgba(255, 255, 255, 0.6)',
};

// The profile hero's brand gradient and everything drawn on it. THEME-INDEPENDENT:
// it is a four-stop brand ramp (warm for users, blue for providers) that runs light
// at the top to saturated at the bottom, so the nav ink and the white decorations
// are positioned against the gradient rather than against the page. Flipping any of
// it would break it against the ramp underneath. Same trap as stableDark.
//
// Note stop 3 of the user ramp is #f6851f, a near-twin of the brand orange but NOT
// the same value. Preserved exactly rather than "corrected" -- it is a gradient stop
// tuned against its neighbours, not a brand reference.
export const heroGradient = {
  userStop1: '#FFF3EA',
  userStop2: '#FBDDC5',
  userStop3: '#f6851f',
  userStop4: '#EA580C',
  providerStop1: '#E9F2FB',
  providerStop2: '#CBE1F5',
  providerStop3: '#3a86cf',
  providerStop4: '#1e5f9e',
  navInk: '#0F172A', // sits on the LIGHT end of the ramp
  ink: '#FFFFFF', // sits on the saturated end
  decorStroke: 'rgba(255,255,255,0.16)',
  decorStrokeSoft: 'rgba(255,255,255,0.10)',
  decorBlob: 'rgba(255,255,255,0.06)',
  decorBlobSoft: 'rgba(255,255,255,0.05)',
  decorDot: 'rgba(255,255,255,0.18)',
  chipFill: 'rgba(255,255,255,0.24)',
  // A warm three-stop CTA gradient (the phone-onboarding sheet's button). Brand art,
  // so it does not flip -- the dark ink that sits on it is onBrandOrange either way.
  ctaWarm1: '#FB923C',
  ctaWarm2: '#F97316',
  ctaWarm3: '#EA580C',
  backBtnFill: 'rgba(255,255,255,0.55)',

  // DARK VARIANT. The light ramp opens on #FFF3EA — luma 246, effectively white.
  // On a white page that blends; on a black one it is a glaring slab, worst with no
  // profile photo, which is when the owner noticed it. These stops start at the page
  // and still END on brand, so the screen stays recognisably Fixhomi.
  dark: {
    userStop1: '#140F0A',
    userStop2: '#241608',
    userStop3: '#7A3D0B',
    userStop4: '#A85408',
    providerStop1: '#0A0E14',
    providerStop2: '#101C2A',
    providerStop3: '#1E5F9E',
    providerStop4: '#174A7A',
    // The light ramp's nav ink is near-black because it sits on the pale end. Here
    // the pale end is gone, so the nav has to flip.
    navInk: '#F1F5F9',
    ink: '#F1F5F9',
    decorStroke: 'rgba(255,255,255,0.10)',
    decorStrokeSoft: 'rgba(255,255,255,0.06)',
    decorBlob: 'rgba(255,255,255,0.04)',
    decorBlobSoft: 'rgba(255,255,255,0.03)',
    decorDot: 'rgba(255,255,255,0.12)',
    chipFill: 'rgba(255,255,255,0.14)',
    ctaWarm1: '#B4600F', ctaWarm2: '#A85408', ctaWarm3: '#8A4207',
    backBtnFill: 'rgba(255,255,255,0.16)',
  },
};

// The premium / subscription surface. THEME-INDEPENDENT, and a deliberately separate
// system from `stableDark`: that one is slate + white chrome, this one is navy + gold
// marketing. The hero, the active-plan header and the launch-offer chip are dark in
// BOTH themes — they sell a product rather than reflect a UI mode — so nothing on
// them may use a flipping token. Same trap as stableDark, different palette.
export const premium = {
  navy: '#0D1220',
  navyLift: '#161D30',
  navyGradA: '#1A1F2E',
  navyGradC: '#131A2A',
  slateHeader: '#0F172A', // the active-plan card's dark header band
  iosDark: '#1C1C1E', // the same band on iOS, which uses Apple's dark grey
  slateCard: '#1E293B', // the inactive card's Android gradient base
  indigoShadow: '#4338CA', // the inactive card's coloured drop shadow
  gold: '#E8B54D',
  goldSoft: '#F2CE8A',
  goldInk: '#B98A2F', // gold dark enough to read as TEXT on a light surface
  crown: '#FFD700',
  ink: '#FDFBF7',
  inkIvory: '#F4EFE6',
  inkPer: '#E7E2D6',
  inkMuted: '#B9C0CF',
  inkFaint: '#8A93A6',
  inkBlue: '#8FBAE3',
  assure: '#7FD8A5',
  statusDot: '#4ADE80',
  keyline: 'rgba(232,181,77,0.14)',
  keylineBlue: 'rgba(43,118,188,0.16)',
  crownFill: 'rgba(232,181,77,0.12)',
  crownLine: 'rgba(232,181,77,0.35)',
  divider: 'rgba(255,255,255,0.08)',
  glowOrange: 'rgba(246,124,22,0.20)',
  glowGold: 'rgba(232,181,77,0.16)',
  glowBlue: 'rgba(43,118,188,0.22)',
  borderGold: 'rgba(232,181,77,0.30)',
  borderBlue: 'rgba(43,118,188,0.38)',
  offerLine: 'rgba(232,181,77,0.4)',
  statusFill: 'rgba(22,163,74,0.15)',
  decoGold: 'rgba(255,215,0,0.07)',
  decoIndigo: 'rgba(99,102,241,0.06)',
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
  // Solid, not a tint: the orange button's loading state. Theme-independent for
  // the same reason brandOrange is -- it does not flip between themes.
  orangeSoft: '#F5A856',
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
    fill: 'rgba(120, 120, 128, 0.12)', // Apple tertiarySystemFill
    disabled: '#C7C7CC',
    placeholder: 'rgba(0, 0, 0, 0.2)',
  },
  dark: {
    blue: '#0A84FF',
    red: '#FF453A',
    label: '#FFFFFF',
    labelSecondary: 'rgba(235, 235, 245, 0.6)',
    surfaceFallback: '#1C1C1E',
    fill: 'rgba(120, 120, 128, 0.24)',
    disabled: '#3A3A3C',
    placeholder: 'rgba(235, 235, 245, 0.3)',
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
  // TRUE BLACK page. On the OLED panels most phones now ship, a black pixel is off:
  // it reads as genuinely black and costs no light. The previous ramp lifted the page
  // to #0A0A0C and cards to #17171B so they would not crush together on 6-bit LCD —
  // but that lift reads as GREY on OLED, which is what it was reported as. Deepening
  // costs nothing: page->card separation actually improves (13 -> 14 code values) and
  // every text and border ratio against the card goes UP.
  base: '#000000',
  // NEUTRAL, NOT BLUE. Every value here used to carry a blue bias — surface +6,
  // sunken +8, elevated +9, and the border a full +41 — so the whole app read as
  // bluish even though the page is pure black. The owner reported it twice. These
  // are barely warm instead, which sits better under an orange brand, and the LUMA
  // LADDER IS UNCHANGED (0 / 23 / 35 / 45) so every contrast ratio and the elevation
  // steps survive the swap untouched.
  //
  // TONAL ELEVATION. In dark, depth cannot come from a shadow: the shadow token is
  // #000000 and the page is #000000, so it contributes exactly 0 code values. In
  // light the same shadow is worth 221 against the page and is doing most of the
  // work — which is why 48 of the app's 65 elevated surfaces, having no border,
  // simply stopped reading as objects on black. The owner described the result as
  // the placements looking weird; nothing had moved, the containers had vanished.
  //
  // So a raised surface is painted LIGHTER instead, which is what Material 3 and
  // iOS both do on dark. The page stays true black. Ladder, in code values above
  // the page: 0 -> 23 -> 35 -> 45. Every adjacent step clears MIN_SURFACE_GAP, and
  // 23 is wide enough to survive a 6-bit panel where the old 14 might not.
  surface: '#191716',
  // A filled well — an input, a chip — INSIDE a card. On dark this is LIGHTER than
  // the card it sits in, which is the inverse of light mode and the standard dark
  // convention: light comes from elevation, so recessed controls are lifted, not sunk.
  // It can no longer double as a page background; the three screens that used it that
  // way now say `bg`, which is what they meant.
  sunken: '#252321',
  elevated: '#2F2D2B', // topped out here: any lighter and the border drops under 3:1
  // CRYSTAL EDGES. The owner's call, and it removes a dependency on hardware.
  //
  // On true black the card is only 14 code values off the page, so separation was
  // resting on a fill difference a cheap 6-bit panel may simply not resolve — which
  // is why "do cards separate?" was the one question no gate could answer and every
  // build had to ask a human. A lit edge answers it in software instead: the border
  // now carries the boundary and the fill difference is a bonus, not the mechanism.
  //
  // Cool and slightly blue, not grey. A neutral line at this brightness reads as a
  // wireframe; biasing it toward the light end of the slate ramp reads as glass
  // catching light, which is the look these near-black surfaces already suggest.
  // Sized to clear 3:1 against the LIGHTEST surface it can be drawn on
  // (surfaceElevated), not just against a card — #5C7089 looked right on a card at
  // 3.79 but landed on 2.96 there, and the gate caught it.
  border: '#84827E', // 4.65 on the page, 4.26 on a card, 3.33 on elevated
  borderMedium: '#9C9A95', // one clear step up
  borderStrong: '#B8B5AF', // inputs and focus rings
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
// Things drawn ON a map. THEME-INDEPENDENT: the map tile itself is light in light
// mode and dark in dark mode, but a pin's drop shadow and a translucent hint chip
// read correctly over either, and making them flip would break them over the
// opposite tile. The route colours live in `mapRoute` for the same reason.
export const mapOverlay = {
  pinShadowSoft: 'rgba(0,0,0,0.15)',
  pinShadowStrong: 'rgba(0,0,0,0.2)',
  hint: 'rgba(0,0,0,0.55)',
};

export const semanticDark = {
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  successContainer: '#0E2E20',
  warningContainer: '#2E2107',
  dangerContainer: '#2F1518',
  infoContainer: '#102639',

  // One step LIGHTER than the matching container, for a tinted chip sitting on a
  // tinted card — the icon wrap inside a warning bar, for instance. In light mode
  // the *Fill tokens are low-alpha washes that deepen whatever they sit on, but on
  // dark they have to be opaque, and pointing them at the container value made the
  // chip identical to the card it sat on. Asserted distinct by the token tests.
  successFill: '#123B2A',
  warningFill: '#3D2C0A',
  dangerFill: '#3E1D21',
  infoFill: '#16324B',
  accentVioletFill: '#302552',
};

// Visible hairlines for danger- and warning-styled ROWS — a tinted seam across a
// plain card, as in the drawer's logout item. Deliberately fainter than the
// container borders below, because a row has no fill to sit against.
export const semanticLine = {
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  dangerFillLight: 'rgba(239, 68, 68, 0.08)',
  warningLight: 'rgba(217, 119, 6, 0.25)',
  warningFillLight: 'rgba(217, 119, 6, 0.12)',
  accentVioletFillLight: 'rgba(124, 58, 237, 0.1)',
  successFillLight: 'rgba(21, 128, 61, 0.1)',
  infoFillLight: 'rgba(30, 95, 158, 0.1)',
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
  // A blocking modal -- the location-permission gate -- needs a heavier scrim than
  // a bottom sheet, because the screen behind it must read as unavailable rather
  // than merely dimmed. Kept as its own step instead of converging onto `overlay`,
  // which would visibly lighten a deliberately opaque barrier.
  strongLight: 'rgba(15,23,42,0.85)',
  strongDark: 'rgba(0,0,0,0.9)',
  // A full-screen photo viewer is a lightbox: the image sits on a near-black ground
  // in EITHER theme, because that is what a lightbox is. Not theme-dependent.
  photo: 'rgba(0,0,0,0.92)',
  photoSoft: 'rgba(0,0,0,0.5)',
};

// The splash screen: a deep-navy brand panel with white ink and an orange glow,
// shown before the theme has even been read from storage. It is the same artwork in
// both appearances -- flipping it would mean a light splash handing off to a dark app
// (or the reverse) on every cold start, which is the flash the theme work exists to
// remove. Grouped here for the same reason as heroGradient: one self-contained piece
// of brand art with its own ramp.
// Markers and geometry drawn ON the map. They sit over Mapbox tiles, not over our
// surfaces, so they do not flip: a pin that inverted with the app theme would have to
// stay legible against satellite imagery, street tiles and everything between, which
// no single flip can do. Same rule as mapRoute and mapOverlay.
export const mapPin = {
  markerDefault: '#2563EB',
  userDot: '#2563EB',
  userHalo: 'rgba(37, 99, 235, 0.3)',
  geofenceFill: 'rgba(37, 99, 235, 0.1)',
  geofenceLine: 'rgba(37, 99, 235, 0.5)',
  servicePin: brand.orange,
  ring: '#FFFFFF', // the white collar that separates a pin from the tiles behind it
  ink: '#FFFFFF', // on the blue user dot
  // The service pin is brand orange; white on it is 2.69:1, under the 3:1 a glyph
  // needs. Near-black reads on orange at 6.64 and matches onBrandOrange, which is
  // what every orange control in the app already uses.
  onServicePin: '#0F172A',
  shadow: '#000000',
};

export const splash = {
  primary: brand.orange,
  secondary: brand.blue,
  dark: '#0B1120', // deep navy -- the gradient's light end
  darker: '#060D1B', // almost-black navy -- its dark end
  accent: '#FF8C2E', // a lighter orange, for the sweep highlight
  white: '#FFFFFF',
  floaterFill: 'rgba(255, 255, 255, 0.15)',
  inkMuted: 'rgba(255, 255, 255, 0.75)',
  dot: 'rgba(255, 255, 255, 0.6)',
  inkFaint: 'rgba(255, 255, 255, 0.45)',
  inkFaintest: 'rgba(255, 255, 255, 0.25)',
  glowLine: 'rgba(246, 124, 22, 0.25)',
  glowFill: 'rgba(246, 124, 22, 0.04)',
  nameGlow: 'rgba(246, 124, 22, 0.3)',
};
