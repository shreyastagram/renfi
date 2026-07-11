/**
 * BrandFooter — Ola-style edge-to-edge brand artwork at the end of a scroll.
 *
 * Sizing is EXPLICIT numbers derived from the actual asset dimensions via
 * Image.resolveAssetSource — immune to flex/stretch/percentage quirks that
 * can make an Image fall back to its intrinsic pixel size (rendering a
 * 1024px-wide asset "zoomed in" on a 390pt screen).
 *
 * A SHORT gradient fade (56px) merges the screen background into the
 * artwork's sky. It ends well above the baked-in hashtag headline, so the
 * text is never washed out.
 */

import React from 'react';
import { View, Image, Dimensions, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;
const FADE_HEIGHT = 56;

const BrandFooter = ({ source, fadeColor = '#FFFFFF', style }) => {
  const resolved = Image.resolveAssetSource(source);
  const width = SCREEN_WIDTH;
  const height =
    resolved?.width && resolved?.height
      ? Math.round((SCREEN_WIDTH * resolved.height) / resolved.width)
      : Math.round(SCREEN_WIDTH * 1.46); // safe fallback ≈ the assets' ratio

  return (
    <View style={[{ width, height }, style]}>
      <Image source={source} style={{ width, height }} resizeMode="contain" />
      {/* Short top merge — screen bg → transparent, above the headline */}
      <LinearGradient
        colors={[fadeColor, `${fadeColor}00`]}
        style={[styles.fade, { width }]}
        pointerEvents="none"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: FADE_HEIGHT,
  },
});

export default BrandFooter;
