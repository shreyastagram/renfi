/**
 * SvgArt — Shared decorative SVG background
 *
 * Static SVG art — renders once, zero per-frame cost.
 * Use on headers, cards, sheets, and section backgrounds.
 *
 * Props:
 *   color  — stroke/fill color (default '#f67c16')
 *   height — container height (default 110)
 *   style  — extra container styles
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const SvgArt = ({ color = '#f67c16', height = 110, style }) => (
  <View style={[styles.wrap, { height }, style]} pointerEvents="none">
    <Svg width="100%" height="100%" viewBox="0 0 400 110" preserveAspectRatio="xMidYMid slice">
      <Path d="M0 85 Q60 40 130 70 T260 50 T400 75" stroke={color} strokeWidth="1.5" fill="none" opacity={0.12} />
      <Path d="M0 95 Q80 55 170 80 T340 60 T400 90" stroke={color} strokeWidth="1" fill="none" opacity={0.08} />
      <Path d="M0 70 Q50 30 120 55 T250 35 T400 60" stroke={color} strokeWidth="0.8" fill="none" opacity={0.06} />
      <Circle cx="340" cy="20" r="45" fill={color} opacity={0.04} />
      <Circle cx="370" cy="90" r="25" fill={color} opacity={0.035} />
      <Circle cx="50" cy="15" r="30" fill={color} opacity={0.03} />
      <Circle cx="280" cy="45" r="3" fill={color} opacity={0.12} />
      <Circle cx="100" cy="80" r="2.5" fill={color} opacity={0.1} />
      <Circle cx="200" cy="25" r="2" fill={color} opacity={0.08} />
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
});

export default React.memo(SvgArt);
