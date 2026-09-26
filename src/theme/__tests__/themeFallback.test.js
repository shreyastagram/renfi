/**
 * The read-only theme hooks must not throw without a ThemeProvider.
 *
 * WHY THIS EXISTS
 *
 * Phase 8 migrated ProviderHomeTopRow, and the owner's providerHomeTopRow suite
 * renders that component in isolation — no provider. `useThemedStyles` called
 * `useTheme`, which throws without one, so seven of the owner's tests broke.
 *
 * The fix was not to wrap the owner's tests. A theme is presentational: rendering
 * in light mode is a far better failure than crashing the tree, and any component
 * reached outside the provider in production (a detached modal, an error-boundary
 * fallback) would otherwise take the screen down. So the read-only path falls back
 * to the light theme, while `useTheme` keeps its throw for callers that want to
 * CHANGE the theme — there, a missing provider really is a wiring bug.
 *
 * This asserts both halves of that contract.
 */

const React = require('react');
const { act, create } = require('react-test-renderer');
const { Text } = require('react-native');

const {
  useTheme,
  useThemeColors,
  useThemeContextOrDefault,
  useIsDark,
} = require('../ThemeContext');
const useThemedStyles = require('../useThemedStyles').default;
const { lightTheme } = require('../themes');

const render = (element) => {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
};

describe('theme hooks without a provider', () => {
  it('useThemeColors falls back to the light theme', () => {
    let seen;
    const Probe = () => {
      seen = useThemeColors();
      return React.createElement(Text, null, 'x');
    };
    render(React.createElement(Probe));
    expect(seen).toBe(lightTheme.colors);
  });

  it('useThemedStyles resolves against the light theme', () => {
    const makeStyles = (theme) => ({ box: { color: theme.colors.textPrimary } });
    let seen;
    const Probe = () => {
      seen = useThemedStyles(makeStyles);
      return React.createElement(Text, null, 'x');
    };
    render(React.createElement(Probe));
    expect(seen.box.color).toBe(lightTheme.colors.textPrimary);
  });

  it('marks the fallback with isReady: false, so it is distinguishable', () => {
    let seen;
    const Probe = () => {
      seen = useThemeContextOrDefault();
      return React.createElement(Text, null, 'x');
    };
    render(React.createElement(Probe));
    expect(seen.isReady).toBe(false);
    expect(seen.theme).toBe(lightTheme);
  });

  it('useIsDark answers false outside a provider instead of throwing', () => {
    // ProviderHomeTopRow picks its map style from this, and the owner's tests
    // render it bare. `useTheme()` there threw and took 6 of those tests with it.
    let seen;
    const Probe = () => {
      seen = useIsDark();
      return React.createElement(Text, null, 'x');
    };
    expect(() => render(React.createElement(Probe))).not.toThrow();
    expect(seen).toBe(false);
  });

  it('the fallback carries isDark, matching the provider value shape', () => {
    // It did not, so a read-only consumer got `undefined` rather than false —
    // silent, because undefined is falsy, until someone writes `isDark === false`.
    let seen;
    const Probe = () => {
      seen = useThemeContextOrDefault();
      return React.createElement(Text, null, 'x');
    };
    render(React.createElement(Probe));
    expect(seen.isDark).toBe(false);
  });

  it('useTheme still throws, because changing the theme needs a real provider', () => {
    const Probe = () => {
      useTheme();
      return React.createElement(Text, null, 'x');
    };
    // React logs the error boundary warning; silence it for this expectation.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(React.createElement(Probe))).toThrow(
      /must be used within a ThemeProvider/,
    );
    spy.mockRestore();
  });
});
