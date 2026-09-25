/**
 * GraphBackground — Reusable grid-pattern background
 *
 * Decorative background with grid lines and accent circles.
 * Inspired by the Fixhomi website hero section.
 *
 * @version 2.0.0
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  brandTint,
} from '../theme';

const GRID = 28;
const ROWS = 45;
const COLS = 16;

const GraphBackground = memo(({ lineColor = brandTint.blue06, showCircles = true }) => (
  <View style={s.root} pointerEvents="none">
    {Array.from({ length: ROWS }, (_, i) => (
      <View key={`h${i}`} style={[s.lineH, { top: i * GRID, backgroundColor: lineColor }]} />
    ))}
    {Array.from({ length: COLS }, (_, i) => (
      <View key={`v${i}`} style={[s.lineV, { left: i * GRID, backgroundColor: lineColor }]} />
    ))}
    {showCircles && (
      <>
        <View style={[s.circle, { top: 100, right: -10, width: 60, height: 60, backgroundColor: brandTint.blue05 }]} />
        <View style={[s.circle, { top: 350, left: -15, width: 45, height: 45, backgroundColor: brandTint.orange04 }]} />
        <View style={[s.circle, { top: 600, right: 20, width: 35, height: 35, backgroundColor: brandTint.blue05 }]} />
      </>
    )}
  </View>
));

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 0, overflow: 'hidden' },
  lineH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  lineV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  circle: { position: 'absolute', borderRadius: 999 },
});

GraphBackground.displayName = 'GraphBackground';
export default GraphBackground;
