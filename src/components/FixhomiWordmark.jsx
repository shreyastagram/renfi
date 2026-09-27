/**
 * The Fixhomi wordmark.
 *
 * The brand is **Fixhomi** — "Fix" in brand blue, "homi" in brand orange, one
 * capital, set tight. Ten screens were each hand-rolling `<Text>FixHomi</Text>`
 * in a single colour with camel-case and positive tracking, which is a
 * different word in a different voice. One component now, so the name cannot
 * drift screen to screen again.
 *
 * ON THE TYPEFACE. The reference sets this in a geometric sans. The app ships
 * NO custom font on purpose — Roboto on Android, SF on iOS — because a bundled
 * face is the classic older-Android failure and costs megabytes, and the
 * owner's rule is that everything must work identically on both. So this
 * matches the parts that carry the identity and are free: the two-colour
 * split, the case, heavy weight, and tight negative tracking. It will not be
 * pixel-identical to the web mark. Closing that last gap needs the font file
 * shipped and measured on a low-end device first.
 *
 * ON THE CLOUD. Brand blue on a black page is 2.6:1 — the "Fix" half of the
 * mark goes nearly invisible in dark. Rather than lighten the blue and lose
 * the brand, a soft radial bloom sits behind the mark in dark only, lifting
 * the local ground just enough for both halves to read. Light mode needs
 * nothing and gets nothing.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

import { useThemedStyles, useThemeColors, useIsDark } from '../theme';

const FixhomiWordmark = ({ size = 28, style, align = 'center' }) => {
  const styles = useThemedStyles(makeStyles);
  const c = useThemeColors();
  const isDark = useIsDark();

  // The bloom is sized off the type so it scales with any usage.
  const w = Math.round(size * 7.2);
  const h = Math.round(size * 3.2);

  return (
    <View style={[styles.wrap, { alignItems: align === 'left' ? 'flex-start' : 'center' }, style]}>
      {isDark && (
        <View pointerEvents="none" style={[styles.bloom, { width: w, height: h, marginLeft: -w / 2 }]}>
          <Svg width={w} height={h}>
            <Defs>
              <RadialGradient id="fixhomiBloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={c.brandOrange} stopOpacity="0.16" />
                <Stop offset="55%" stopColor={c.brandOrange} stopOpacity="0.06" />
                <Stop offset="100%" stopColor={c.brandOrange} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill="url(#fixhomiBloom)" />
          </Svg>
        </View>
      )}

      <Text
        style={[styles.word, { fontSize: size }]}
        numberOfLines={1}
        allowFontScaling={false}
        accessibilityRole="header"
        accessibilityLabel="Fixhomi"
      >
        <Text style={styles.fix}>Fix</Text>
        <Text style={styles.homi}>homi</Text>
      </Text>
    </View>
  );
};

const makeStyles = (theme) => {
  const c = theme.colors;
  return StyleSheet.create({
    wrap: {
      justifyContent: 'center',
    },
    bloom: {
      position: 'absolute',
      left: '50%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    word: {
      fontWeight: '800',
      // Negative. The old mark used +0.3, which pulls a heavy word apart; the
      // reference is set tight.
      letterSpacing: -0.8,
      includeFontPadding: false,
    },
    // brandBlue is already theme-aware — #2b76bc in light, #5FA8E8 in dark —
    // so the mark needs no branch here. The dark value exists precisely because
    // #2b76bc is 2.6:1 on a dark ground.
    fix: { color: c.brandBlue },
    homi: { color: c.brandOrange },
  });
};

export default React.memo(FixhomiWordmark);
