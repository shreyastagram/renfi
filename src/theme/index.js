/**
 * Public theme surface.
 *
 * Screens and components import from here and NOWHERE else inside src/theme.
 * That indirection is what allows the engine to be swapped later (for example to
 * react-native-unistyles) without touching consumers.
 */

export { ThemeProvider, useTheme, useThemeColors } from './ThemeContext';

// Sourced from the pure module rather than through ThemeContext so that callers
// needing only the constants do not pull in AsyncStorage and react-native.
export {
  resolveThemeName,
  THEME_MODES,
  THEME_MODE_KEY,
} from './resolveThemeName.js';

export { default as useThemedStyles } from './useThemedStyles.js';
export { lightTheme, darkTheme, themes } from './themes.js';

// Third-party brand colours. NOT theme tokens — they are fixed by the vendor's
// brand guidelines and must render identically in both themes. Exported here so
// migrating screens have one place to import them from instead of re-hardcoding.
export { vendor } from './tokens/palette.js';

// Service-category accents. Identical in both themes by design — a trade's
// colour must stay recognisable regardless of appearance.
export {
  categoryAccent,
  iconAccent,
  stableDark,
  stableEmergency,
  premium,
  medal,
  brandTint,
  mapRoute,
  mapOverlay,
  brand,
} from './tokens/palette.js';
