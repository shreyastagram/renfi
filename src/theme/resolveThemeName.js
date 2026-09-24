/**
 * Pure theme-mode resolution.
 *
 * Deliberately isolated from ThemeContext.jsx: that module imports AsyncStorage
 * and react-native, both of which need native mocks under Jest. Keeping this
 * logic in its own dependency-free file means the mode-resolution rules — the
 * part with actual branching to get wrong — are unit-testable with no mocks,
 * no React, and no native modules.
 */

export const THEME_MODE_KEY = 'app_theme_mode';
export const THEME_MODES = ['light', 'dark', 'system'];

/**
 * Resolve the active theme name from the user's mode and the OS colour scheme.
 *
 * An explicit 'light' or 'dark' always wins — the user's override is never
 * displaced by a system change. Anything else (including 'system', an
 * unrecognised persisted value, or null) follows the OS, defaulting to light.
 *
 * @param {'light'|'dark'|'system'|null|undefined} mode
 * @param {'light'|'dark'|null|undefined} systemScheme
 * @returns {'light'|'dark'}
 */
export const resolveThemeName = (mode, systemScheme) => {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light';
};
