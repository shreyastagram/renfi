/**
 * Screen — the themed safe-area root for a full-screen view.
 *
 * WHY THIS EXISTS
 *
 * `targetSdkVersion 36` means Android 15+ enforces edge-to-edge, so what a screen
 * does about insets is load-bearing rather than cosmetic. At v1.0.9 there were 18
 * `<SafeAreaView>` usages and only 4 declared an `edges` prop — the other 14 relied
 * on the implicit default, which makes the behaviour invisible at the call site and
 * easy to get wrong on 3-button navigation.
 *
 * This wraps that up with a themed background so a screen root cannot be left
 * white on a near-black theme.
 *
 * ON THE DEFAULT
 *
 * `edges` defaults to all four, which is exactly what `SafeAreaView` already does
 * when the prop is omitted. That is deliberate: swapping `SafeAreaView` for
 * `Screen` is then behaviour-neutral, and narrowing the insets becomes an explicit,
 * reviewable choice at each call site rather than something this component does to
 * 14 screens silently.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '../theme';
import { ALL_EDGES } from './screenEdges';

export { ALL_EDGES };

const makeStyles = (theme) =>
  StyleSheet.create({
    base: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
  });

const Screen = ({ children, edges = ALL_EDGES, style, ...rest }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView style={[styles.base, style]} edges={edges} {...rest}>
      {children}
    </SafeAreaView>
  );
};

export default Screen;
