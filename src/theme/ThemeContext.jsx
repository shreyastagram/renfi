/**
 * Theme Context
 *
 * Owns the theme mode (light | dark | system), persists it, and subscribes to
 * the OS appearance when the mode is 'system'. A manual light/dark choice always
 * wins and is never overwritten by a system change.
 *
 * Modelled on LanguageContext deliberately, including the memoised value: every
 * themed component in the app consumes this context, so an inline object here
 * would hand all of them a new identity on each provider render — the whole-app
 * re-render amplifier diagnosed as the low-end-Android "text jitter" in
 * AUTH_STARTUP_LOGOUT_FIX.md. The value identity must change exactly when the
 * resolved theme changes, and no more often.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, lightTheme } from './themes.js';
import {
  resolveThemeName,
  THEME_MODE_KEY,
  THEME_MODES,
} from './resolveThemeName.js';

// Re-exported so consumers have a single import site, while the pure logic
// stays in a module that Jest can load without native mocks.
export { resolveThemeName, THEME_MODE_KEY, THEME_MODES };

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [mode, setModeState] = useState('system');
  const [systemScheme, setSystemScheme] = useState(
    () => Appearance.getColorScheme() || 'light',
  );
  const [isReady, setIsReady] = useState(false);

  // Load the persisted mode before first paint so there is no light-to-dark flash.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_MODE_KEY);
        if (!cancelled && saved && THEME_MODES.includes(saved)) {
          setModeState(saved);
        }
      } catch (e) {
        // Corrupt or unavailable storage — fall through to the 'system' default.
      }
      if (!cancelled) setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Track the OS appearance. Subscribed unconditionally so that switching back
  // to 'system' resolves correctly without waiting for the next OS change.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'light');
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback(async (next) => {
    if (!THEME_MODES.includes(next)) return;
    setModeState(next);
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, next);
    } catch (e) {
      // Persistence failure is non-fatal — the choice still applies this session.
    }
  }, []);

  const themeName = resolveThemeName(mode, systemScheme);
  const theme = themes[themeName] || lightTheme;

  const value = useMemo(
    () => ({
      theme,
      mode,
      setMode,
      isDark: themeName === 'dark',
      isReady,
    }),
    [theme, mode, setMode, themeName, isReady],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Used only when a consumer renders outside the provider. `isReady: false` marks it
// as a fallback so a caller can tell it apart from a settled theme.
const FALLBACK_CONTEXT = {
  theme: lightTheme,
  mode: 'system',
  setMode: () => {},
  themeName: lightTheme.name,
  isReady: false,
};

/**
 * Full theme access, including `mode` / `setMode`. Throws without a provider,
 * because a caller that wants to CHANGE the theme and has no provider is a wiring
 * bug and should fail loudly.
 */
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};

/**
 * Read-only theme access, which is what the presentational hooks need.
 *
 * Deliberately does NOT throw without a provider — it falls back to the light
 * theme. A theme is presentational: rendering in light mode is a far better
 * failure than crashing the tree. This also keeps a component testable in
 * isolation, which is how the provider-row tests render it, and how any component
 * reached outside the provider (a detached modal, an error-boundary fallback)
 * would behave in production.
 *
 * `useTheme` keeps its throw, so the fail-fast path still exists where it matters.
 */
export const useThemeContextOrDefault = () => {
  const ctx = useContext(ThemeContext);
  return ctx || FALLBACK_CONTEXT;
};

export const useThemeColors = () => useThemeContextOrDefault().theme.colors;

export default ThemeContext;
