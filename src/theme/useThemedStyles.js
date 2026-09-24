/**
 * useThemedStyles — theme-aware StyleSheet with zero per-render cost.
 *
 * Usage:
 *
 *   const makeStyles = (theme) => StyleSheet.create({
 *     card: { backgroundColor: theme.colors.surface },
 *   });
 *
 *   const MyScreen = () => {
 *     const styles = useThemedStyles(makeStyles);
 *     ...
 *   };
 *
 * `makeStyles` MUST be declared at module scope, not inline in the component.
 * Declared at module scope it runs at most once per theme for the process
 * lifetime; declared inline it would build a fresh cache every render, which is
 * exactly the allocation-per-render pattern this repo removed during the
 * low-end-Android jitter work.
 */

import { useMemo } from 'react';
import { useTheme } from './ThemeContext';
import { createStyleCache } from './createStyleCache.js';

// One cache per makeStyles function, keyed weakly so unmounted modules can be
// collected. The WeakMap lookup is O(1) and allocates nothing on the hot path.
const caches = new WeakMap();

const useThemedStyles = (makeStyles) => {
  const { theme } = useTheme();
  let cached = caches.get(makeStyles);
  if (!cached) {
    cached = createStyleCache(makeStyles);
    caches.set(makeStyles, cached);
  }
  return useMemo(() => cached(theme), [cached, theme]);
};

export default useThemedStyles;
