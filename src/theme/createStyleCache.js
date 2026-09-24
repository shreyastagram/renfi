/**
 * Per-theme style memoisation.
 *
 * Kept separate from useThemedStyles.js for the same reason resolveThemeName.js
 * is separate from ThemeContext.jsx: this is the part with real logic, and in
 * its own dependency-free module it is unit-testable with no React and no
 * native mocks.
 */

/**
 * Wraps a makeStyles function in a per-theme-name memo.
 *
 * @param {(theme: object) => object} makeStyles
 * @returns {(theme: object) => object} cached style getter
 */
export const createStyleCache = (makeStyles) => {
  const cache = new Map();
  return (theme) => {
    const key = theme.name;
    if (!cache.has(key)) {
      cache.set(key, makeStyles(theme));
    }
    return cache.get(key);
  };
};

export default createStyleCache;
