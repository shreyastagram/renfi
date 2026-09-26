/**
 * The crash screen must not flash white at a dark-mode user.
 *
 * WHY THIS EXISTS
 *
 * ErrorBoundary is mounted ABOVE ThemeProvider in App.tsx so it can catch a crash
 * inside the provider. That placement is correct and must stay, but it also means
 * the boundary cannot read theme context — a `useThemeColors()` call from there
 * silently returns the light fallback, and the bug is invisible until an app in dark
 * mode crashes in front of a user and blinds them.
 *
 * Nothing else in the suite would catch that: the colours are tokens, so check:hex
 * passes; the pairs are AA, so check:contrast passes; the component renders, so lint
 * passes. Only asserting the context-free path actually returns the DARK theme does.
 */

jest.mock('react-native', () => ({
  Appearance: { getColorScheme: jest.fn(() => 'light') },
}));

const { Appearance } = require('react-native');
const { darkTheme, lightTheme } = require('../themes');
const {
  publishResolvedTheme,
  getResolvedThemeOutsideProvider,
  __resetResolvedTheme,
} = require('../lastResolvedTheme');

beforeEach(() => {
  __resetResolvedTheme();
  Appearance.getColorScheme.mockReturnValue('light');
});

describe('theme access without a provider', () => {
  it('returns what the provider last published, so a dark app crashes dark', () => {
    publishResolvedTheme('dark');
    expect(getResolvedThemeOutsideProvider().name).toBe(darkTheme.name);
  });

  it('follows the provider when the user switches back to light', () => {
    publishResolvedTheme('dark');
    publishResolvedTheme('light');
    expect(getResolvedThemeOutsideProvider().name).toBe(lightTheme.name);
  });

  it('falls back to the OS appearance when the provider never mounted', () => {
    // A crash during startup, before ThemeProvider has rendered even once.
    Appearance.getColorScheme.mockReturnValue('dark');
    expect(getResolvedThemeOutsideProvider().name).toBe(darkTheme.name);
  });

  it('ignores a garbage theme name rather than storing it', () => {
    publishResolvedTheme('chartreuse');
    expect(getResolvedThemeOutsideProvider().name).toBe(lightTheme.name);
  });

  it('never throws, even if Appearance itself is broken', () => {
    // The one screen whose job is surviving a throw must not add a new way to throw.
    Appearance.getColorScheme.mockImplementation(() => {
      throw new Error('native module missing');
    });
    expect(() => getResolvedThemeOutsideProvider()).not.toThrow();
    expect(getResolvedThemeOutsideProvider().name).toBe(lightTheme.name);
  });
});

describe('the crash screen consumes it', () => {
  it('ErrorBoundary reads the context-free theme, not a hook', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../components/ErrorBoundary.jsx'),
      'utf8',
    );
    expect(src).toContain('getResolvedThemeOutsideProvider');
    // A hook CALL here would compile and render fine while always yielding light.
    // Matches invocations only — the file mentions useThemedStyles in a comment.
    expect(src).not.toMatch(/\buse(ThemeColors|ThemedStyles)\s*\(/);
  });
});
