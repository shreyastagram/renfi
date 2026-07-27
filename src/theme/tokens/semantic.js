/**
 * Semantic colour tokens.
 *
 * lightColors and darkColors MUST have identical key sets — tokens.test.js
 * asserts this. Screens name intent (surface, textMuted, danger), never a
 * palette step.
 *
 * The .js extensions on the import below are required: scripts/check-contrast.js
 * loads this module through Node's require(esm), and Node's ESM resolver rejects
 * extensionless specifiers. Metro accepts both forms.
 */

import {
  brand,
  altBlue,
  violet,
  slate,
  gray,
  dark,
  semanticLight,
  semanticDark,
  overlay,
} from './palette.js';

export const lightColors = {
  // Surfaces
  bg: slate[50],
  surface: slate[0],
  surfaceElevated: slate[0],
  surfaceSunken: slate[25],

  // Lines — the *Neutral variants exist so files built on the gray ramp stay
  // pixel-identical in light mode. They collapse onto one value in dark.
  border: slate[200],
  borderNeutral: gray[200],
  borderMedium: slate[300],
  borderMediumNeutral: gray[300],
  borderStrong: slate[400],

  // Text. textSecondary/textMuted are deliberately DARKER than the values the
  // app ships today: Tailwind slate-500/400 and gray-500/400 all fail WCAG AA
  // as text (4.32, 2.33, 4.39, 2.31), so both ramps converge here.
  textPrimary: slate[900],
  textPrimaryNeutral: gray[900],
  textStrong: slate[800],
  textStrongNeutral: gray[800],
  textBody: slate[700],
  textBodyNeutral: gray[700],
  textSecondary: slate[600],
  textMuted: slate[500],
  textInverse: slate[0],

  // Brand
  brandOrange: brand.orange,
  onBrandOrange: slate[900], // NEVER white — white on orange is 2.69:1
  brandBlue: brand.blue,
  onBrandBlue: slate[0],
  info: brand.blueDeep, // brand blue readable as text on light surfaces

  // Non-brand blues, preserved so light mode is unchanged. See palette.altBlue.
  altBlueIndigo: altBlue.indigo,
  altBlueSky: altBlue.sky,
  altBlueIos: altBlue.ios,

  // Categorical accent — scoped to categories, events, portfolio, in-progress.
  accentViolet: violet.light,
  accentVioletContainer: violet.containerLight,

  // Semantic
  success: semanticLight.success,
  warning: semanticLight.warning,
  danger: semanticLight.danger,
  successContainer: semanticLight.successContainer,
  warningContainer: semanticLight.warningContainer,
  dangerContainer: semanticLight.dangerContainer,
  infoContainer: semanticLight.infoContainer,

  // Misc
  overlay: overlay.light,
  shadow: slate[900],
};

export const darkColors = {
  // Surfaces
  bg: dark.base,
  surface: dark.surface,
  surfaceElevated: dark.elevated,
  surfaceSunken: dark.sunken,

  // Lines — both light-mode ramps UNIFY here. Dark mode gets one clean scale.
  border: dark.border,
  borderNeutral: dark.border,
  borderMedium: dark.borderMedium,
  borderMediumNeutral: dark.borderMedium,
  borderStrong: dark.borderStrong,

  // Text — the slate/gray split is a light-mode-only artefact and collapses here.
  textPrimary: dark.textPrimary,
  textPrimaryNeutral: dark.textPrimary,
  textStrong: dark.textPrimary,
  textStrongNeutral: dark.textPrimary,
  textBody: dark.textSecondary,
  textBodyNeutral: dark.textSecondary,
  textSecondary: dark.textSecondary,
  textMuted: dark.textMuted,
  textInverse: slate[900],

  // Brand — orange survives dark mode unchanged, blue must lighten
  brandOrange: brand.orange,
  onBrandOrange: slate[900],
  brandBlue: brand.blueLight,
  onBrandBlue: slate[900],
  info: brand.blueLight,

  // Non-brand blues also converge in dark — three near-identical blues on a
  // dark surface would read as noise, and all three fail AA unlightened.
  altBlueIndigo: brand.blueLight,
  altBlueSky: brand.blueLight,
  altBlueIos: brand.blueLight,

  // Categorical accent — lightened so it stays legible on dark surfaces.
  accentViolet: violet.dark,
  accentVioletContainer: violet.containerDark,

  // Semantic
  success: semanticDark.success,
  warning: semanticDark.warning,
  danger: semanticDark.danger,
  successContainer: semanticDark.successContainer,
  warningContainer: semanticDark.warningContainer,
  dangerContainer: semanticDark.dangerContainer,
  infoContainer: semanticDark.infoContainer,

  // Misc
  overlay: overlay.dark,
  shadow: dark.shadow,
};
