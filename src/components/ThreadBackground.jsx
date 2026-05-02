/**
 * ThreadBackground
 *
 * Subtle multi-color flowing "thread" pattern drawn as inline SVG.
 * Sits behind card content with low opacity so it reads as a soft,
 * almost-blurred wash of brand colors rather than a hard pattern.
 *
 * Props:
 *   colors     — array of hex colors, one per thread (default: orange shades)
 *   opacity    — base stroke opacity per thread (default 0.18)
 *   strokeWidth— thread thickness (default 2)
 *
 * Used absolutely-positioned inside an option card with pointerEvents="none".
 *
 * @version 1.0.0
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const ThreadBackground = ({
  colors = ['#f67c16', '#FB923C', '#FED7AA'],
  opacity = 0.18,
  strokeWidth = 2,
}) => {
  // Each color gets two flowing curves at different vertical positions and
  // phase offsets. With overlap, this gives the soft multi-tone wash effect.
  const threads = [];
  const baseY = 30;
  const span = 16;

  colors.forEach((color, idx) => {
    const yOffset1 = baseY - span / 2 + (idx * (span / Math.max(colors.length - 1, 1)));
    const yOffset2 = yOffset1 + 14 + (idx % 2) * 4;

    // First curve — gentle sine-like flow across the card width
    threads.push(
      <Path
        key={`a-${idx}`}
        d={`M -10 ${yOffset1} Q 50 ${yOffset1 - 12} 110 ${yOffset1} T 230 ${yOffset1} T 360 ${yOffset1}`}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
        fill="none"
        strokeLinecap="round"
      />
    );

    // Second curve — counter-phase, slightly thinner, lower
    threads.push(
      <Path
        key={`b-${idx}`}
        d={`M -10 ${yOffset2} Q 60 ${yOffset2 + 10} 130 ${yOffset2} T 260 ${yOffset2} T 380 ${yOffset2}`}
        stroke={color}
        strokeWidth={strokeWidth - 0.4}
        strokeOpacity={opacity * 0.8}
        fill="none"
        strokeLinecap="round"
      />
    );
  });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 360 80" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.6" />
          </LinearGradient>
        </Defs>
        {threads}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderRadius: 14,
  },
});

export default ThreadBackground;
