/**
 * IncomingCallScreen — full-screen incoming-call UI shown when an FCM
 * INCOMING_CALL push lands while the app is in the foreground.
 *
 * Background-state incoming calls go straight to CallKeep's native
 * lockscreen UI (handled by react-native-callkeep); on Accept there,
 * the app navigates directly to InCallScreen — this screen is bypassed.
 *
 * Layout matches the iOS / Android system call UI aesthetic so it feels
 * native: dark gradient, large caller avatar with a soft pulsing ring,
 * caller name, and two prominent round action buttons.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TouchableOpacity from '../components/TouchableOpacity';
import { useDialog } from '../context/DialogContext';
import { acceptCall, rejectCall } from '../services/callService';
import { endCallNative } from '../services/callKeepService';
import { CALL_RING_TIMEOUT_MS } from '../config/iacax';

// Vibrate pattern: 0ms wait, 800ms vibrate, 600ms pause, repeated.
const RING_VIBRATION = [0, 800, 600, 800];

// Stable colour from a string — used to tint placeholder avatars.
function hashColor(seed = '') {
  const palette = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6'];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function initialOf(name = '') {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

export default function IncomingCallScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { dialog } = useDialog();

  const { callId, callerId, callerName = 'Unknown caller' } = route?.params || {};
  const [busy, setBusy] = useState(null); // 'accept' | 'reject' | null

  const avatarTint = useMemo(() => hashColor(callerId || callerName), [callerId, callerName]);
  const initial = useMemo(() => initialOf(callerName), [callerName]);

  // Pulsing ring around the avatar — adds liveliness without being noisy.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Vibrate while ringing (in addition to whatever CallKeep does on the
  // lockscreen). Cleared on unmount and on user action.
  useEffect(() => {
    Vibration.vibrate(RING_VIBRATION, true);
    return () => Vibration.cancel();
  }, []);

  // Auto-dismiss after the server-side ring timeout (60s) — by then
  // iacax has marked the call missed and noefix won't deliver a fresh
  // accept token anyway.
  useEffect(() => {
    const timer = setTimeout(() => {
      Vibration.cancel();
      endCallNative(callId);
      navigation.goBack();
    }, CALL_RING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [callId, navigation]);

  const handleReject = async () => {
    if (busy) return;
    setBusy('reject');
    Vibration.cancel();
    endCallNative(callId);
    try {
      await rejectCall(callId, 'declined');
    } catch (err) {
      // Reject is best-effort — even if the API call fails the UI
      // closes and CallKeep is already cleaned up.
      console.warn('[IncomingCall] reject failed:', err?.parsed?.code || err?.message);
    }
    navigation.goBack();
  };

  const handleAccept = async () => {
    if (busy) return;
    setBusy('accept');
    Vibration.cancel();
    try {
      const res = await acceptCall(callId);
      navigation.replace('InCall', {
        callId: res.callId,
        roomName: res.roomName,
        token: res.token,
        livekitUrl: res.livekitUrl,
        mode: 'incoming',
        otherPartyId: callerId,
        otherPartyName: callerName,
      });
    } catch (err) {
      const parsed = err?.parsed || { message: 'Could not connect the call. Please try again.' };
      endCallNative(callId);
      dialog('Call failed', parsed.message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.headerArea, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.statusLabel}>Incoming voice call</Text>
      </View>

      <View style={styles.avatarArea}>
        <Animated.View
          style={[
            styles.avatarRing,
            { borderColor: avatarTint, opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        />
        <View style={[styles.avatar, { backgroundColor: avatarTint }]}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
        <Text style={styles.callerName} numberOfLines={1}>
          {callerName}
        </Text>
        <Text style={styles.callerSubtitle}>Fixhomi</Text>
      </View>

      <View style={[styles.actionRow, { paddingBottom: insets.bottom + 48 }]}>
        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton, busy === 'reject' && styles.actionButtonBusy]}
            onPress={handleReject}
            disabled={!!busy}
            activeOpacity={0.85}
            accessibilityLabel="Decline call"
          >
            {busy === 'reject' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialIcon name="call-end" size={36} color="#fff" />
            )}
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Decline</Text>
        </View>

        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton, busy === 'accept' && styles.actionButtonBusy]}
            onPress={handleAccept}
            disabled={!!busy}
            activeOpacity={0.85}
            accessibilityLabel="Accept call"
          >
            {busy === 'accept' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialIcon name="call" size={36} color="#fff" />
            )}
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Accept</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  headerArea: {
    alignItems: 'center',
  },
  statusLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  avatarArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  avatarRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '700',
  },
  callerName: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    marginTop: 28,
    textAlign: 'center',
  },
  callerSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  actionGroup: {
    alignItems: 'center',
  },
  actionButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
  actionButtonBusy: {
    opacity: 0.8,
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
