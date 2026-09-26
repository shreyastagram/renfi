/**
 * The resolved theme, readable WITHOUT React context.
 *
 * WHY THIS EXISTS
 *
 * ErrorBoundary is mounted ABOVE ThemeProvider in App.tsx, deliberately — it has to
 * be, or it could not catch a crash inside the provider itself. That placement means
 * it can never read theme context: `useThemeColors()` called from there (or from a
 * wrapper around it) is outside the provider and would always return the light
 * fallback, so a dark-mode user would get a full-screen white flash at the exact
 * moment the app fails. The crash screen is the worst possible place for that.
 *
 * So the provider PUSHES its resolved theme here, and the crash screen PULLS it
 * synchronously. No context, no hooks, no async, no storage read on the crash path.
 *
 * This is not a general-purpose escape hatch. Everything rendered inside the provider
 * must use `useThemedStyles` / `useThemeColors`; a module singleton does not
 * re-render on change, so a live component reading this would go stale on a theme
 * switch. The crash screen is exempt because it renders once, after the tree it would
 * have re-rendered with is already gone.
 */

import { Appearance } from 'react-native';
import { themes, lightTheme } from './themes.js';

let lastName = null;

/** Called by ThemeProvider whenever the resolved theme settles. */
export const publishResolvedTheme = (name) => {
  if (themes[name]) lastName = name;
};

/**
 * The best theme guess available without context.
 *
 * Order: what the provider last published, then the OS appearance (covers a crash
 * before the provider ever mounted), then light. Every step is wrapped, because a
 * throw here would take down the screen whose whole job is to survive a throw.
 */
export const getResolvedThemeOutsideProvider = () => {
  try {
    if (lastName && themes[lastName]) return themes[lastName];
    return themes[Appearance.getColorScheme()] || lightTheme;
  } catch (e) {
    return lightTheme;
  }
};

/** Test seam — there is no other way to get back to the pre-publish state. */
export const __resetResolvedTheme = () => {
  lastName = null;
};
