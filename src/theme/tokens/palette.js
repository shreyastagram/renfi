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

// Neutral slate ramp — matches the Tailwind slate scale the app already uses.
export const slate = {
  0: '#FFFFFF',
  25: '#F8FAFC',
  50: '#F1F5F9',
  200: '#E2E8F0',
  400: '#78879C',
  500: '#5B6878',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
};

// Dark-mode surface ramp. Base is a dark neutral, not pure black (Material 3);
// surfaces get lighter as they elevate.
export const dark = {
  sunken: '#080D18',
  base: '#0B1220',
  surface: '#111827',
  elevated: '#1E293B',
  border: '#263449',
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
