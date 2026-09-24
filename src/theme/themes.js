/**
 * Assembled theme objects consumed by ThemeContext and useThemedStyles.
 *
 * The .js extensions below are required — see the note in tokens/semantic.js.
 */

import { lightColors, darkColors } from './tokens/semantic.js';
import { spacing, radii, makeElevation } from './tokens/spacing.js';

export const lightTheme = {
  name: 'light',
  colors: lightColors,
  spacing,
  radii,
  elevation: makeElevation(lightColors.shadow),
};

export const darkTheme = {
  name: 'dark',
  colors: darkColors,
  spacing,
  radii,
  elevation: makeElevation(darkColors.shadow),
};

export const themes = { light: lightTheme, dark: darkTheme };
