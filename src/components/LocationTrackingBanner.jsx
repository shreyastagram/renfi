/**
 * Location Tracking Banner (Pad Style)
 *
 * A compact pad shown beside the online/offline toggle on ProviderHomeScreen
 * when location tracking is active (foreground socket OR background HTTP).
 * Styled like a music pad with a pulsing location icon.
 *
 * When tracking is inactive, renders nothing (the online pad takes full width).
 * Also shows a brief toast on app state transitions.
 *
 * @version 3.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, AppState, Platform } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { getActiveTrackingRequests, subscribeTrackingChange } from '../services/socketService';

const BRAND_ORANGE = '#f67c16';
const TOAST_DURATION = 3000;

/**
 * Pulsing location icon — indicates active location sharing.
 */
const PulsingLocationIcon = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.8, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, opacityAnim]);

  return (
    <View style={styles.iconContainer}>
      <Animated.View
        style={[
          styles.iconPulse,
          { transform: [{ scale: pulseAnim }], opacity: opacityAnim },
        ]}
      />
      <MaterialIcon name="my-location" size={18} color={BRAND_ORANGE} />
    </View>
  );
};

/**
 * LocationTrackingBanner
 *
 * Renders as a pad in the statusPadsRow alongside the online/offline toggle.
 * Shows when ANY location tracking is active — foreground socket or background HTTP.
 * When not tracking, returns null so the online pad stretches to full width.
 */
const LocationTrackingBanner = () => {
  const [trackingCount, setTrackingCount] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const appStateRef = useRef(AppState.currentState);

  // Subscribe to tracking-count changes (event-driven; no polling timer).
  // Count only changes when a request starts/stops sharing, so the row never
  // reflows spuriously.
  useEffect(() => {
    setTrackingCount(getActiveTrackingRequests().length);
    const unsubscribe = subscribeTrackingChange((count) => setTrackingCount(count));
    return unsubscribe;
  }, []);

  // Show toast helper
  const showToast = useCallback((message) => {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(TOAST_DURATION),
      Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToastMessage(null));
  }, [toastOpacity]);

  // Toast on app state transitions
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextState;
      if (getActiveTrackingRequests().length === 0) return;
      if (wasActive && nextState !== 'active') {
        showToast('Location sharing continues in background');
      } else if (!wasActive && nextState === 'active') {
        showToast('Location sharing active');
      }
    });
    return () => subscription.remove();
  }, [showToast]);

  // When not tracking, render nothing — online pad takes full row
  if (trackingCount === 0 && !toastMessage) return null;

  return (
    <>
      {/* Pad — sits beside the online/offline toggle */}
      {trackingCount > 0 && (
        <View style={styles.pad}>
          <PulsingLocationIcon />
          <View style={styles.padTextBlock}>
            <Text style={styles.padTitle}>Sharing</Text>
            <Text style={styles.padCount}>
              {trackingCount} request{trackingCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Floating toast — appears above the pads row */}
      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  // ─── Pad (matches statusPad sizing from ProviderHomeScreen) ──
  pad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
    flex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#9A3412',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  padTextBlock: {
    alignItems: 'flex-start',
  },
  padTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9A3412',
    letterSpacing: 0.2,
  },
  padCount: {
    fontSize: 11,
    fontWeight: '500',
    color: '#C2410C',
    marginTop: 1,
  },
  // ─── Pulsing location icon ──
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND_ORANGE,
  },
  // ─── Toast ──
  toast: {
    position: 'absolute',
    top: -36,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    zIndex: 20,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

export default LocationTrackingBanner;
