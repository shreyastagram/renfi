/**
 * Spacing, radii, and elevation.
 *
 * Every elevation level pairs an Android `elevation` with the iOS `shadow*`
 * properties — a repo rule. `shadowColor` is injected per-theme in themes.js
 * so dark mode can use a deeper shadow.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 14,
  card: 22,
  pill: 999,
};

export const makeElevation = (shadowColor) => ({
  none: {
    shadowColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  raised: {
    shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
});
