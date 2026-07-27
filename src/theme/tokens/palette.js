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

// Dark-mode surface ramp. Base is a dark neutral, not pure black (Material 3);
// surfaces get lighter as they elevate.
export const dark = {
  sunken: '#080D18',
  base: '#0B1220',
  surface: '#111827',
  elevated: '#1E293B',
  border: '#263449',
  borderMedium: '#33425C',
  borderStrong: '#64748B',
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
export const semanticDark = {
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  successContainer: '#0C2A1E',
  warningContainer: '#2B1F06',
  dangerContainer: '#2C1416',
  infoContainer: '#0E2236',
};

export const overlay = {
  light: 'rgba(15,23,42,0.45)',
  dark: 'rgba(0,0,0,0.65)',
};
