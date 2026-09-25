import * as React from "react";
import { View, Text, Image, StyleSheet, Animated } from "react-native";
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
    style={[{ width: size, height: size }, color ? { tintColor: color } : null, style]}
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
      <Text style={[styles.brandText, { color: textColor, fontSize: size * 0.25 }]}>FixHomi</Text>
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
  brandText: {
    fontWeight: '700',
    letterSpacing: 1,
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
