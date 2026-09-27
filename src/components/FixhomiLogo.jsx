import * as React from "react";
import { View, Text, Image, StyleSheet, Animated } from "react-native";
import FixhomiWordmark from "./FixhomiWordmark";
import {
  useThemedStyles,
  brand,
} from '../theme';

// Brand colors
const makeC = (c) => ({
  primary: c.brandOrange,
  secondary: c.brandBlue,
  white: c.surface,
  shadow: c.shadow,
});

const LOGO_IMAGE = require('../assets/fixhomi_logo.jpg');

/**
 * FixhomiLogo - Client's official logo (orange house + blue Fix text)
 *
 * @param {number} size - Size of the logo (default 64)
 * @param {object} style - Additional styles
 */
const FixhomiLogo = ({ size = 64, color, style }) => (
  <Image
    source={LOGO_IMAGE}
    style={[
      { width: size, height: size },
      // The asset is a white square with the mark on it. Unrounded, that white
      // reads as a hard square patch on a dark page — the owner's "it looks
      // like a square". Rounding the IMAGE itself (with overflow clipped)
      // rather than a wrapper means every caller gets it, including the ones
      // that pass their own container. ~22% matches the platform icon shape.
      { borderRadius: Math.round(size * 0.22), overflow: 'hidden' },
      color ? { tintColor: color } : null,
      style,
    ]}
    resizeMode="contain"
  />
);

/**
 * FixhomiLogoWithText - Logo with brand name below
 */
const FixhomiLogoWithText = ({ size = 64, textColor = brand.orange }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.logoWithText}>
      <FixhomiLogo size={size} />
      {/* One wordmark component app-wide — see FixhomiWordmark for why the
          name is two colours and why there is no custom font. */}
      <FixhomiWordmark size={Math.round(size * 0.25)} />
    </View>
  );
};

/**
 * FixhomiMarker - Logo for map markers
 */
const FixhomiMarker = ({ size = 40 }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.marker, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
      <FixhomiLogo size={size} />
    </View>
  );
};

/**
 * FixhomiLoader - Animated loading logo
 */
const FixhomiLoader = ({ size = 48 }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <FixhomiLogo size={size} />
    </Animated.View>
  );
};

const makeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  logoWithText: {
    alignItems: 'center',
    gap: 8,
  },
  marker: {
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  });
};

export default FixhomiLogo;
export { FixhomiLogoWithText, FixhomiMarker, FixhomiLoader };
