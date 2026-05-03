/**
 * CallViaAppButton — demo branch only.
 *
 * Premium "Call via app" CTA used at every in-app calling entry point.
 * Visual treatment is a tri-stop indigo→blue→cyan gradient with a slow
 * white sheen that sweeps across roughly every four seconds, paused
 * between sweeps so the motion stays in iOS-subtle territory rather
 * than feeling busy. Uses the native driver so the loop runs on the
 * UI thread and doesn't compete with JS work elsewhere on the screen.
 *
 * Two layouts share the same animation:
 *   default  — full-width pill with phone icon, label, and HD badge.
 *              Used at the user-side ProviderCard and the provider-side
 *              "call customer" entry point.
 *   compact  — 46×46 rounded square with phone icon and a label below,
 *              dropped into the existing compactActionRow alongside
 *              Directions / Phone / etc. without breaking the rhythm.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import TouchableOpacity from './TouchableOpacity';

const GRADIENT_COLORS = ['#4F46E5', '#2563EB', '#06B6D4'];
const SHEEN_COLORS = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.42)', 'rgba(255,255,255,0)'];
const SHEEN_COLORS_COMPACT = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'];
const SHEEN_DURATION_MS = 2400;
const SHEEN_REST_MS = 1800;

function useSheenLoop() {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: SHEEN_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(SHEEN_REST_MS),
        // Reset back to 0 instantly so the next pass starts off-screen
        // on the left rather than tweening backwards visibly.
        Animated.timing(value, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

export default function CallViaAppButton({
  onPress,
  label = 'Call via app',
  showHdBadge = true,
  compact = false,
  disabled = false,
  style,
}) {
  const sheen = useSheenLoop();

  if (compact) {
    const translate = sheen.interpolate({ inputRange: [0, 1], outputRange: [-46, 46] });
    const hasLabel = !!label;
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        disabled={disabled}
        style={[hasLabel ? compactStyles.group : compactStyles.iconOnlyGroup, style]}
      >
        <View style={hasLabel ? compactStyles.iconWrap : compactStyles.iconWrapInline}>
          <LinearGradient
            colors={GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              compactStyles.sheen,
              { transform: [{ translateX: translate }, { rotate: '22deg' }] },
            ]}
          >
            <LinearGradient
              colors={SHEEN_COLORS_COMPACT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <MaterialIcon name="phone" size={hasLabel ? 20 : 18} color="#FFFFFF" />
        </View>
        {hasLabel && <Text style={compactStyles.label}>{label}</Text>}
      </TouchableOpacity>
    );
  }

  // Default — full-width pill. Sweep distance (~280) is wider than any
  // realistic button so the highlight clears the right edge cleanly
  // before the rest period.
  const translate = sheen.interpolate({ inputRange: [0, 1], outputRange: [-220, 220] });
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled, style]}
    >
      <LinearGradient
        colors={GRADIENT_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sheen,
          { transform: [{ translateX: translate }, { rotate: '20deg' }] },
        ]}
      >
        <LinearGradient
          colors={SHEEN_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.iconWrap}>
        <MaterialIcon name="phone" size={15} color="#FFFFFF" />
      </View>
      <Text style={styles.label}>{label}</Text>
      {showHdBadge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>HD</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 16,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  sheen: {
    position: 'absolute',
    top: -12,
    bottom: -12,
    width: 64,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    marginLeft: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});

const compactStyles = StyleSheet.create({
  group: { alignItems: 'center', gap: 6, minWidth: 64 },
  iconOnlyGroup: { alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  // Inline variant — matches sibling action buttons in ProviderCard
  // (callButton/skipButton are 46×42, borderRadius 12).
  iconWrapInline: {
    width: 46,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  sheen: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 30,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
  },
});
