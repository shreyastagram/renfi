/**
 * PSATriggerScreen — SOS Trigger
 *
 * Full-screen red alert with slide-to-confirm, 5-second countdown,
 * haptic feedback, and post-trigger confirmation.
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
  PanResponder,
  Vibration,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocation } from '../context/LocationContext';
import * as psaService from '../services/psaService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 64;
const THUMB_SIZE = 60;
const SLIDE_THRESHOLD = SLIDER_WIDTH - THUMB_SIZE;
const COUNTDOWN_SECONDS = 5;

const COLORS = {
  background: '#7F1D1D',
  white: '#FFFFFF',
  whiteTranslucent: 'rgba(255,255,255,0.6)',
  danger: '#DC2626',
  success: '#16A34A',
  successBg: '#052E16',
  sliderTrack: 'rgba(255,255,255,0.15)',
  sliderThumb: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.7)',
};

const STATE = { READY: 'ready', COUNTDOWN: 'countdown', SENDING: 'sending', SENT: 'sent', ERROR: 'error' };

const PSATriggerScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { currentLocation, locationAddress, displayAddress } = useLocation();

  const contacts = route.params?.contacts || [];
  const [state, setState] = useState(STATE.READY);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [result, setResult] = useState(null);
  const countdownRef = useRef(null);
  const triggerFiredRef = useRef(false);

  // Refs for values accessed inside PanResponder and interval closures
  const stateRef = useRef(state);
  const locationRef = useRef({ currentLocation, locationAddress, displayAddress });

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { locationRef.current = { currentLocation, locationAddress, displayAddress }; }, [currentLocation, locationAddress, displayAddress]);

  // Animations
  const slideX = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownScale = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor(COLORS.background);
    }, [])
  );

  // Pulse animation for countdown
  useEffect(() => {
    if (state === STATE.COUNTDOWN) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [state, pulseAnim]);

  const triggerAlert = useCallback(async () => {
    // Guard against double-fire
    if (triggerFiredRef.current) return;
    triggerFiredRef.current = true;

    setState(STATE.SENDING);
    Vibration.vibrate([0, 200, 100, 200]);

    const loc = locationRef.current;
    const lat = loc.currentLocation?.latitude;
    const lng = loc.currentLocation?.longitude;

    if (lat == null || lng == null) {
      setState(STATE.ERROR);
      setResult({ error: 'Could not determine your location. Please enable location services and try again.' });
      triggerFiredRef.current = false;
      return;
    }

    const address = loc.locationAddress?.shortAddress || loc.displayAddress || '';

    const res = await psaService.triggerSOS({
      latitude: lat,
      longitude: lng,
      address,
    });

    if (res.success) {
      setState(STATE.SENT);
      setResult(res.details);
      Vibration.vibrate([0, 100, 50, 100, 50, 300]);
    } else {
      setState(STATE.ERROR);
      setResult({ error: res.message || res.error || 'Could not send alert. Try again or call 112.' });
      triggerFiredRef.current = false;
    }
  }, []);

  // Countdown logic
  useEffect(() => {
    if (state === STATE.COUNTDOWN) {
      triggerFiredRef.current = false;
      setCountdown(COUNTDOWN_SECONDS);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          const next = prev - 1;
          if (next <= 0) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
            triggerAlert();
            return 0;
          }
          Vibration.vibrate(100);
          Animated.sequence([
            Animated.timing(countdownScale, { toValue: 1.3, duration: 150, useNativeDriver: true }),
            Animated.timing(countdownScale, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
          return next;
        });
      }, 1000);
      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      };
    }
  }, [state, triggerAlert, countdownScale]);

  const handleCancel = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setState(STATE.READY);
    slideX.setValue(0);
  }, [slideX]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // PanResponder — uses stateRef to avoid closure capture
  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => stateRef.current === STATE.READY,
      onMoveShouldSetPanResponder: () => stateRef.current === STATE.READY,
      onPanResponderMove: (_, gestureState) => {
        const x = Math.max(0, Math.min(gestureState.dx, SLIDE_THRESHOLD));
        slideX.setValue(x);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= SLIDE_THRESHOLD) {
          Vibration.vibrate(300);
          setState(STATE.COUNTDOWN);
        } else {
          Animated.spring(slideX, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
        }
      },
    }),
  [slideX]);

  // Display address
  const locationDisplay = displayAddress || (currentLocation ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}` : 'Determining location...');

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Back / Cancel */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeButton} onPress={state === STATE.COUNTDOWN ? handleCancel : handleGoBack}>
          <MaterialIcon name={state === STATE.COUNTDOWN ? 'close' : 'arrow-back'} size={22} color={COLORS.white} />
        </TouchableOpacity>
        {state === STATE.COUNTDOWN && (
          <Text style={styles.cancelHint}>Tap X to cancel</Text>
        )}
      </View>

      {/* ── READY STATE ── */}
      {state === STATE.READY && (
        <View style={styles.readyContainer}>
          <View style={styles.sosCircle}>
            <MaterialIcon name="sos" size={48} color={COLORS.white} />
          </View>
          <Text style={styles.title}>Send Safety Alert</Text>
          <Text style={styles.subtitle}>
            This will send your current location to {contacts.length} emergency contact{contacts.length !== 1 ? 's' : ''} via email.
          </Text>

          <View style={styles.locationCard}>
            <MaterialIcon name="my-location" size={18} color={COLORS.danger} />
            <Text style={styles.locationText} numberOfLines={2}>{locationDisplay}</Text>
          </View>

          <View style={styles.contactsPreview}>
            <Text style={styles.contactsPreviewLabel}>Will be notified:</Text>
            {contacts.map((c, i) => (
              <View key={c._id || i} style={styles.contactChip}>
                <Text style={styles.contactChipText}>{c.name}</Text>
                {c.relationship ? <Text style={styles.contactChipRelation}> ({c.relationship})</Text> : null}
              </View>
            ))}
          </View>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderTrack}>
              <Animated.View
                style={[styles.sliderThumb, { transform: [{ translateX: slideX }] }]}
                {...panResponder.panHandlers}
              >
                <MaterialIcon name="chevron-right" size={28} color={COLORS.danger} />
              </Animated.View>
              <Text style={styles.sliderText}>Slide to confirm</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── COUNTDOWN STATE ── */}
      {state === STATE.COUNTDOWN && (
        <Animated.View style={[styles.countdownContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.countdownLabel}>Sending alert in</Text>
          <Animated.Text style={[styles.countdownNumber, { transform: [{ scale: countdownScale }] }]}>
            {countdown}
          </Animated.Text>
          <Text style={styles.countdownUnit}>second{countdown !== 1 ? 's' : ''}</Text>

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <MaterialIcon name="close" size={28} color={COLORS.white} />
            <Text style={styles.cancelButtonText}>CANCEL</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── SENDING STATE ── */}
      {state === STATE.SENDING && (
        <View style={styles.sendingContainer}>
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.sendingText}>Sending safety alert...</Text>
          <Text style={styles.sendingSubtext}>Notifying your emergency contacts</Text>
        </View>
      )}

      {/* ── SENT STATE ── */}
      {state === STATE.SENT && (
        <View style={styles.sentContainer}>
          <View style={styles.sentCircle}>
            <MaterialIcon name="check" size={48} color={COLORS.success} />
          </View>
          <Text style={styles.sentTitle}>Alert Sent</Text>
          <Text style={styles.sentSubtitle}>
            Your emergency contacts have been notified with your location.
          </Text>

          {result && (
            <View style={styles.sentDetails}>
              <View style={styles.sentDetailRow}>
                <MaterialIcon name="people" size={18} color={COLORS.whiteTranslucent} />
                <Text style={styles.sentDetailText}>{result.contactsNotified} contact{result.contactsNotified !== 1 ? 's' : ''} notified</Text>
              </View>
              <View style={styles.sentDetailRow}>
                <MaterialIcon name="email" size={18} color={COLORS.whiteTranslucent} />
                <Text style={styles.sentDetailText}>{result.emailsSent} email{result.emailsSent !== 1 ? 's' : ''} sent</Text>
              </View>
              {result.smsSent > 0 && (
                <View style={styles.sentDetailRow}>
                  <MaterialIcon name="sms" size={18} color={COLORS.whiteTranslucent} />
                  <Text style={styles.sentDetailText}>{result.smsSent} SMS sent</Text>
                </View>
              )}
              <View style={styles.sentDetailRow}>
                <MaterialIcon name="event-repeat" size={18} color={COLORS.whiteTranslucent} />
                <Text style={styles.sentDetailText}>{result.monthlyRemaining} alert{result.monthlyRemaining !== 1 ? 's' : ''} remaining this month</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.doneButton} onPress={handleGoBack}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── ERROR STATE ── */}
      {state === STATE.ERROR && (
        <View style={styles.errorContainer}>
          <View style={styles.errorCircle}>
            <MaterialIcon name="error-outline" size={48} color={COLORS.danger} />
          </View>
          <Text style={styles.errorTitle}>Alert Failed</Text>
          <Text style={styles.errorSubtitle}>{result?.error || 'Something went wrong.'}</Text>

          <View style={styles.errorActions}>
            <TouchableOpacity style={styles.retryButton} onPress={() => { triggerFiredRef.current = false; setState(STATE.READY); slideX.setValue(0); }}>
              <MaterialIcon name="refresh" size={20} color={COLORS.white} />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.backButtonAlt, { marginLeft: 12 }]} onPress={handleGoBack}>
              <Text style={styles.backButtonAltText}>Go Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.emergencyFallback}>
            <MaterialIcon name="phone-in-talk" size={18} color={COLORS.white} />
            <Text style={styles.emergencyFallbackText}>
              If this is an emergency, call <Text style={{ fontWeight: '800' }}>112</Text> directly
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  closeButton: {
    width: 44, height: 44, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  cancelHint: { fontSize: 14, color: COLORS.textMuted, marginLeft: 12, fontWeight: '500' },

  readyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  sosCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.white, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  locationCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12,
    padding: 14, width: '100%', marginBottom: 20,
  },
  locationText: { flex: 1, fontSize: 14, color: '#1E293B', marginLeft: 10, lineHeight: 20 },

  contactsPreview: { width: '100%', marginBottom: 32 },
  contactsPreviewLabel: { fontSize: 13, color: COLORS.textMuted, marginBottom: 8, fontWeight: '600' },
  contactChip: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6,
  },
  contactChipText: { fontSize: 14, color: COLORS.white, fontWeight: '600' },
  contactChipRelation: { fontSize: 14, color: COLORS.textMuted },

  sliderContainer: { width: '100%' },
  sliderTrack: {
    height: THUMB_SIZE + 8, borderRadius: (THUMB_SIZE + 8) / 2,
    backgroundColor: COLORS.sliderTrack, justifyContent: 'center', paddingHorizontal: 4,
  },
  sliderThumb: {
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
    backgroundColor: COLORS.sliderThumb, alignItems: 'center', justifyContent: 'center',
    position: 'absolute', left: 4, top: 4, zIndex: 2,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  sliderText: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1 },

  countdownContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  countdownLabel: { fontSize: 18, color: COLORS.textMuted, fontWeight: '600', marginBottom: 12 },
  countdownNumber: { fontSize: 96, fontWeight: '800', color: COLORS.white, lineHeight: 110 },
  countdownUnit: { fontSize: 18, color: COLORS.textMuted, fontWeight: '500', marginBottom: 40 },
  cancelButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 32,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelButtonText: { fontSize: 18, fontWeight: '800', color: COLORS.white, marginLeft: 10, letterSpacing: 1 },

  sendingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  sendingText: { fontSize: 20, fontWeight: '700', color: COLORS.white, marginTop: 24 },
  sendingSubtext: { fontSize: 14, color: COLORS.textMuted, marginTop: 8 },

  sentContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  sentCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.successBg, alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, borderWidth: 3, borderColor: COLORS.success,
  },
  sentTitle: { fontSize: 26, fontWeight: '800', color: COLORS.white, marginBottom: 12 },
  sentSubtitle: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  sentDetails: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    padding: 18, width: '100%', marginBottom: 32,
  },
  sentDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sentDetailText: { fontSize: 14, color: COLORS.textMuted, marginLeft: 12 },
  doneButton: { backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48 },
  doneButtonText: { fontSize: 16, fontWeight: '700', color: COLORS.background },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(220,38,38,0.2)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, borderWidth: 3, borderColor: COLORS.danger,
  },
  errorTitle: { fontSize: 26, fontWeight: '800', color: COLORS.white, marginBottom: 12 },
  errorSubtitle: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  errorActions: { flexDirection: 'row', marginBottom: 32 },
  retryButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.danger, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24,
  },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: COLORS.white, marginLeft: 8 },
  backButtonAlt: {
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  backButtonAltText: { fontSize: 15, fontWeight: '600', color: COLORS.white },
  emergencyFallback: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    padding: 14, width: '100%',
  },
  emergencyFallbackText: { fontSize: 13, color: COLORS.textMuted, marginLeft: 10, lineHeight: 19 },
});

export default PSATriggerScreen;
