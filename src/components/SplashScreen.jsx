/**
 * SplashScreen Component — Premium Animated Launch
 * 
 * Industry-grade splash screen with:
 * - FixHomi brand logo (JPEG image)
 * - Rich gradient-feel background with brand colors
 * - Multi-stage entrance animations (scale, fade, slide, glow)
 * - Shimmer glow ring around logo
 * - Animated particles/dots floating
 * - Smooth choreographed exit
 * 
 * @version 2.0.0 — Premium redesign with actual logo image
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Image,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAppVersionLabel } from '../config/appVersion';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Brand colors (matches UserTypeScreen)
const BRAND = {
  primary: '#f67c16',    // Orange
  secondary: '#2b76bc',  // Blue
  dark: '#0B1120',       // Deep navy
  darker: '#060D1B',     // Almost black navy
  accent: '#FF8C2E',     // Lighter orange
  white: '#FFFFFF',
};

// Logo image
const LOGO_IMAGE = require('../assets/fixhomi_logo.jpg');

/**
 * Floating particle dot — decorative background element
 */
const FloatingDot = ({ delay, startX, startY, size, duration }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -60,
            duration: duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
};

/**
 * Main Splash Screen
 */
const SplashScreen = ({ visible = true, onFinish }) => {
  const insets = useSafeAreaInsets();
  // === Animation values ===
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.8)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const brandNameTranslateY = useRef(new Animated.Value(30)).current;
  const brandNameOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    // === STAGE 1: Logo entrance ===
    const stage1 = Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]);

    // === STAGE 2: Glow ring ===
    const stage2 = Animated.parallel([
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(glowScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]);

    // === STAGE 3: Brand name ===
    const stage3 = Animated.parallel([
      Animated.timing(brandNameOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(brandNameTranslateY, {
        toValue: 0,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
    ]);

    // === STAGE 4: Tagline + bar + footer ===
    const stage4 = Animated.parallel([
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(taglineTranslateY, {
        toValue: 0,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.timing(barWidth, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(loadingOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    // === Run sequence ===
    Animated.sequence([
      stage1,
      Animated.delay(100),
      stage2,
      Animated.delay(100),
      stage3,
      Animated.delay(80),
      stage4,
      Animated.delay(900),
    ]).start(() => {
      if (onFinish) {
        Animated.parallel([
          Animated.timing(containerOpacity, {
            toValue: 0,
            duration: 450,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(containerScale, {
            toValue: 1.1,
            duration: 450,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => onFinish());
      }
    });

    // === Continuous glow pulse ===
    const glowPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.08,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const glowTimeout = setTimeout(() => glowPulse.start(), 1200);
    return () => {
      clearTimeout(glowTimeout);
      glowPulse.stop();
    };
  }, [visible]);

  if (!visible) return null;

  const logoRotateInterpolate = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-8deg', '0deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: containerOpacity,
          transform: [{ scale: containerScale }],
        },
      ]}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Background layers */}
      <View style={styles.bgBase} />
      <View style={styles.bgGradientTop} />
      <View style={styles.bgGradientBottom} />

      {/* Decorative circles */}
      <View style={[styles.decorCircle, styles.circle1]} />
      <View style={[styles.decorCircle, styles.circle2]} />
      <View style={[styles.decorCircle, styles.circle3]} />
      <View style={[styles.decorCircle, styles.circle4]} />

      {/* Floating particles */}
      <FloatingDot delay={0} startX={SCREEN_WIDTH * 0.15} startY={SCREEN_HEIGHT * 0.2} size={6} duration={2500} />
      <FloatingDot delay={400} startX={SCREEN_WIDTH * 0.75} startY={SCREEN_HEIGHT * 0.15} size={4} duration={3000} />
      <FloatingDot delay={800} startX={SCREEN_WIDTH * 0.4} startY={SCREEN_HEIGHT * 0.7} size={5} duration={2800} />
      <FloatingDot delay={200} startX={SCREEN_WIDTH * 0.85} startY={SCREEN_HEIGHT * 0.55} size={3} duration={2200} />
      <FloatingDot delay={600} startX={SCREEN_WIDTH * 0.1} startY={SCREEN_HEIGHT * 0.65} size={4} duration={2600} />
      <FloatingDot delay={1000} startX={SCREEN_WIDTH * 0.6} startY={SCREEN_HEIGHT * 0.85} size={5} duration={3200} />

      {/* === Main Content === */}
      <View style={styles.content}>
        {/* Glow ring */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        {/* Logo Image */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [
                { scale: logoScale },
                { rotate: logoRotateInterpolate },
              ],
            },
          ]}
        >
          <View style={styles.logoShadow}>
            <Image
              source={LOGO_IMAGE}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Brand Name */}
        <Animated.View
          style={{
            opacity: brandNameOpacity,
            transform: [{ translateY: brandNameTranslateY }],
          }}
        >
          <Text style={styles.brandName}>FixHomi</Text>
        </Animated.View>

        {/* Accent bar */}
        <Animated.View
          style={[
            styles.accentBar,
            {
              width: barWidth.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 60],
              }),
            },
          ]}
        />

        {/* Tagline */}
        <Animated.View
          style={{
            opacity: taglineOpacity,
            transform: [{ translateY: taglineTranslateY }],
          }}
        >
          <Text style={styles.tagline}>Fix Your Home, Anytime</Text>
        </Animated.View>

        {/* Loading */}
        <Animated.View style={[styles.loadingContainer, { opacity: loadingOpacity }]}>
          <LoadingPulse />
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View style={[styles.footer, { opacity: footerOpacity, bottom: 50 + insets.bottom }]}>
        <Text style={styles.footerText}>Connecting you with trusted professionals</Text>
        <Text style={styles.footerVersion}>{getAppVersionLabel()}</Text>
      </Animated.View>
    </Animated.View>
  );
};

/**
 * Premium loading pulse — 3 dots with sequential glow
 */
const LoadingPulse = () => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const scale1 = useRef(new Animated.Value(0.8)).current;
  const scale2 = useRef(new Animated.Value(0.8)).current;
  const scale3 = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const animate = (dot, scale, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1.2, duration: 400, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 0.8, duration: 400, useNativeDriver: true }),
          ]),
        ])
      );
    };

    const a1 = animate(dot1, scale1, 0);
    const a2 = animate(dot2, scale2, 200);
    const a3 = animate(dot3, scale3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, { opacity: dot1, transform: [{ scale: scale1 }] }]} />
      <Animated.View style={[styles.dot, styles.dotAccent, { opacity: dot2, transform: [{ scale: scale2 }] }]} />
      <Animated.View style={[styles.dot, { opacity: dot3, transform: [{ scale: scale3 }] }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // NOTE: do NOT add `zIndex` here. The splash is the last of 2 in-tree children
    // of the App root View (NavigationContainer + SplashScreen). A `zIndex` child
    // makes Android use ReactZIndexedViewGroup, and unmounting the splash on every
    // launch desyncs the drawing-order array → native crash
    // "getChildDrawingOrder() returned invalid index 2 (child count is 2)" →
    // app blinks & closes on launch. Being the last child keeps it on top;
    // a small elevation is just a belt-and-suspenders layering guarantee.
    elevation: 12,
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND.dark,
  },
  bgGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
    backgroundColor: BRAND.darker,
    opacity: 0.7,
  },
  bgGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.35,
    backgroundColor: BRAND.primary,
    opacity: 0.08,
    borderTopLeftRadius: SCREEN_WIDTH,
    borderTopRightRadius: SCREEN_WIDTH,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 1000,
  },
  circle1: {
    width: 350,
    height: 350,
    top: -120,
    right: -100,
    backgroundColor: BRAND.primary,
    opacity: 0.06,
  },
  circle2: {
    width: 250,
    height: 250,
    bottom: 60,
    left: -100,
    backgroundColor: BRAND.secondary,
    opacity: 0.08,
  },
  circle3: {
    width: 180,
    height: 180,
    top: '35%',
    right: -60,
    backgroundColor: BRAND.accent,
    opacity: 0.05,
  },
  circle4: {
    width: 120,
    height: 120,
    bottom: '25%',
    right: SCREEN_WIDTH * 0.3,
    backgroundColor: BRAND.secondary,
    opacity: 0.04,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(246, 124, 22, 0.25)',
    backgroundColor: 'rgba(246, 124, 22, 0.04)',
  },
  logoContainer: {
    marginBottom: 28,
  },
  logoShadow: {
    width: 150,
    height: 150,
    borderRadius: 38,
    backgroundColor: BRAND.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
    overflow: 'hidden',
  },
  logoImage: {
    width: 150,
    height: 150,
    borderRadius: 38,
  },
  brandName: {
    fontSize: 46,
    fontWeight: '800',
    color: BRAND.white,
    letterSpacing: 3,
    textShadowColor: 'rgba(246, 124, 22, 0.3)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  accentBar: {
    height: 3,
    backgroundColor: BRAND.primary,
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
    letterSpacing: 1.5,
  },
  loadingContainer: {
    marginTop: 48,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  dotAccent: {
    backgroundColor: BRAND.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  footerVersion: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.25)',
    fontWeight: '500',
  },
});

export default SplashScreen;
