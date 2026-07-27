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

import { brand, slate, dark, semanticLight, semanticDark, overlay } from './palette.js';

export const lightColors = {
  // Surfaces
  bg: slate[50],
  surface: slate[0],
  surfaceElevated: slate[0],
  surfaceSunken: slate[25],

  // Lines
  border: slate[200],
  borderStrong: slate[400],

  // Text
  textPrimary: slate[900],
  textSecondary: slate[600],
  textMuted: slate[500],
  textInverse: slate[0],

  // Brand
  brandOrange: brand.orange,
  onBrandOrange: slate[900], // NEVER white — white on orange is 2.69:1
  brandBlue: brand.blue,
  onBrandBlue: slate[0],
  info: brand.blueDeep, // brand blue readable as text on light surfaces

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

  // Lines
  border: dark.border,
  borderStrong: dark.borderStrong,

  // Text
  textPrimary: dark.textPrimary,
  textSecondary: dark.textSecondary,
  textMuted: dark.textMuted,
  textInverse: slate[900],

  // Brand — orange survives dark mode unchanged, blue must lighten
  brandOrange: brand.orange,
  onBrandOrange: slate[900],
  brandBlue: brand.blueLight,
  onBrandBlue: slate[900],
  info: brand.blueLight,

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
