/**
 * "No internet connection" bar.
 *
 * Reads `networkStatus`, which derives the state from the app's own traffic
 * rather than from a reachability probe — see that module for why. This
 * component's only job is to render the state; all the logic that decides
 * whether the device is really offline lives there, under test.
 *
 * Mounted above GlobalBanner in App.tsx so that if both are visible at once
 * the notification wins the top slot, and deliberately WITHOUT `zIndex` — see
 * the note in GlobalBanner: a zIndex child flips the parent into Android's
 * ReactZIndexedViewGroup and breaks touch handling for its siblings.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

import { useThemedStyles, useThemeColors, stableDark } from '../theme';
import { subscribeToNetwork } from '../services/networkStatus';
import { useLanguage } from '../context/LanguageContext';

const makeC = (c) => ({
  fill: c.dangerContainer,
  line: c.dangerBorder,
  ink: c.danger,
  inkSoft: c.textSecondary,
});

const OfflineBanner = () => {
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [offline, setOffline] = useState(false);
  // Kept mounted through the exit animation so the bar can slide away rather
  // than vanish, then unmounted so it costs nothing while online.
  const [mounted, setMounted] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => subscribeToNetwork(setOffline), []);

  useEffect(() => {
    if (offline) setMounted(true);
    const anim = Animated.timing(slide, {
      toValue: offline ? 1 : 0,
      duration: offline ? 220 : 180,
      easing: offline ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished && !offline) setMounted(false);
    });
    return () => anim.stop();
  }, [offline, slide]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 8,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View style={styles.row}>
        <MaterialIcon name="wifi-off" size={16} color={C.ink} />
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>{t('common.noInternet')}</Text>
          <Text style={styles.hint} numberOfLines={1}>{t('common.noInternetHint')}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const makeStyles = (theme) => {
  const c = theme.colors;
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 14,
      paddingBottom: 10,
      backgroundColor: c.dangerContainer,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.dangerBorder,
      ...Platform.select({
        android: { elevation: 6 },
        ios: {
          shadowColor: stableDark.heroSurface,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 6,
        },
      }),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    textCol: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 13,
      fontWeight: '700',
      color: c.danger,
      letterSpacing: -0.1,
    },
    hint: {
      fontSize: 11.5,
      fontWeight: '500',
      color: c.textSecondary,
      marginTop: 1,
    },
  });
};

export default React.memo(OfflineBanner);
