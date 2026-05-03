/**
 * InCallScreen — unified outgoing-ringing + active call UI.
 *
 * Used for two distinct entry points that converge on the same view:
 *   - Outgoing: caller initiates a call → mode='outgoing' → shows
 *     "Calling..." until the callee accepts, then "Connected".
 *   - Incoming: callee tapped Accept (either on the in-app
 *     IncomingCallScreen or on the native CallKeep ring UI) →
 *     mode='incoming' → joins LiveKit immediately as the second party.
 *
 * The visual treatment matches IncomingCallScreen so the transition
 * feels seamless. LiveKit handles the actual audio transport — this
 * screen owns lifecycle (room connect / disconnect, audio session,
 * mic permission) and the control surface (mute, speaker, end).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  BackHandler,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Room, RoomEvent } from 'livekit-client';
import { AudioSession } from '@livekit/react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { useDialog } from '../context/DialogContext';
import { endCall as endCallApi } from '../services/callService';
import { endCallNative } from '../services/callKeepService';

const STATUS_LABEL = {
  connecting: 'Connecting…',
  ringing: 'Calling…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  ended: 'Call ended',
};

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

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

async function ensureMicPermission() {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone access',
      message: 'Fixhomi needs microphone access to make voice calls.',
      buttonPositive: 'Allow',
      buttonNegative: 'Cancel',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export default function InCallScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { dialog } = useDialog();

  const {
    callId,
    token,
    livekitUrl,
    mode = 'outgoing',
    otherPartyId,
    otherPartyName = 'Unknown',
  } = route?.params || {};

  const [status, setStatus] = useState(mode === 'outgoing' ? 'ringing' : 'connecting');
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [connectedAt, setConnectedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [endingFromUser, setEndingFromUser] = useState(false);

  const roomRef = useRef(null);
  const audioStartedRef = useRef(false);

  const tint = useMemo(() => hashColor(otherPartyId || otherPartyName), [otherPartyId, otherPartyName]);
  const initial = useMemo(() => initialOf(otherPartyName), [otherPartyName]);

  // Bring the call down cleanly. Idempotent — safe to call multiple
  // times from different teardown paths (back button, end button,
  // remote disconnect, screen unmount).
  const teardown = useCallback(
    async ({ apiEnd = true, navigateBack = true } = {}) => {
      const room = roomRef.current;
      if (room) {
        try {
          await room.disconnect();
        } catch (err) {
          console.log('[InCall] room disconnect noop:', err?.message);
        }
        roomRef.current = null;
      }
      if (audioStartedRef.current) {
        try {
          await AudioSession.stopAudioSession();
        } catch (err) {
          console.log('[InCall] audio session stop noop:', err?.message);
        }
        audioStartedRef.current = false;
      }
      if (callId) {
        endCallNative(callId);
        if (apiEnd) {
          try {
            await endCallApi(callId);
          } catch (err) {
            // Best-effort — server-side ring-timeout sweep handles
            // anything that races with this call.
            console.log('[InCall] endCall API noop:', err?.parsed?.code || err?.message);
          }
        }
      }
      if (navigateBack && navigation.canGoBack()) {
        navigation.goBack();
      } else if (navigateBack) {
        // Fall back to a known good route if there's no back stack
        // (e.g. cold start from a notification tap).
        navigation.navigate('UserHome');
      }
    },
    [callId, navigation],
  );

  // Connect to LiveKit. Mic permission first, then audio session, then
  // room.connect. Any failure unwinds and surfaces a dialog.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const micOK = await ensureMicPermission();
      if (cancelled) return;
      if (!micOK) {
        dialog('Microphone needed', 'Voice calls require microphone access.', [
          { text: 'OK', onPress: () => teardown({ apiEnd: true }) },
        ]);
        return;
      }

      try {
        await AudioSession.startAudioSession();
        audioStartedRef.current = true;
      } catch (err) {
        console.warn('[InCall] startAudioSession failed:', err?.message);
      }

      const room = new Room({ adaptiveStream: false, dynacast: false });
      roomRef.current = room;

      room
        .on(RoomEvent.Connected, () => {
          // For outgoing calls we sit on 'ringing' until the callee
          // joins (ParticipantConnected). For incoming we know the
          // caller is already in the room — go straight to connected.
          if (mode === 'incoming') {
            setStatus('connected');
            setConnectedAt(Date.now());
          }
        })
        .on(RoomEvent.ParticipantConnected, () => {
          setStatus('connected');
          setConnectedAt((prev) => prev || Date.now());
        })
        .on(RoomEvent.ParticipantDisconnected, () => {
          // Other party hung up — tear down on our side too.
          teardown({ apiEnd: false });
        })
        .on(RoomEvent.Reconnecting, () => setStatus('reconnecting'))
        .on(RoomEvent.Reconnected, () => setStatus('connected'))
        .on(RoomEvent.Disconnected, () => {
          if (!endingFromUser) teardown({ apiEnd: false });
        });

      try {
        await room.connect(livekitUrl, token);
        if (cancelled) {
          await room.disconnect();
          return;
        }
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (err) {
        console.warn('[InCall] room connect failed:', err?.message);
        if (!cancelled) {
          dialog('Call failed', 'Could not connect the call. Please try again.', [
            { text: 'OK', onPress: () => teardown({ apiEnd: true }) },
          ]);
        }
      }
    })();

    return () => {
      cancelled = true;
      teardown({ apiEnd: false, navigateBack: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick the duration timer once per second when connected.
  useEffect(() => {
    if (!connectedAt) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [connectedAt]);

  // Hardware back ends the call rather than backgrounding it — matches
  // standard phone-call UX where Back is not a "hide" action.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEnd();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = async () => {
    if (endingFromUser) return;
    setEndingFromUser(true);
    setStatus('ended');
    await teardown({ apiEnd: true });
  };

  const handleToggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    setMuted(next);
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
    } catch (err) {
      console.warn('[InCall] mute toggle failed:', err?.message);
      setMuted(!next); // revert on failure
    }
  };

  const handleToggleSpeaker = async () => {
    const next = !speaker;
    setSpeaker(next);
    try {
      const outputs = await AudioSession.getAudioOutputs();
      const target = next
        ? outputs.find((o) => /speaker/i.test(o)) || 'speaker'
        : outputs.find((o) => /earpiece|receiver/i.test(o)) || 'earpiece';
      await AudioSession.selectAudioOutput(target);
    } catch (err) {
      // Some devices don't expose the output picker — keep the visual
      // toggle so the user has feedback, even if routing didn't switch.
      console.log('[InCall] speaker toggle noop:', err?.message);
    }
  };

  const durationLabel = connectedAt ? formatDuration(now - connectedAt) : null;
  const statusLabel = STATUS_LABEL[status] || '';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#0F172A', '#1E293B', '#0F172A']} style={StyleSheet.absoluteFill} />

      <View style={[styles.headerArea, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.statusLabel}>{statusLabel}</Text>
        {durationLabel ? <Text style={styles.duration}>{durationLabel}</Text> : null}
      </View>

      <View style={styles.avatarArea}>
        <View style={[styles.avatar, { backgroundColor: tint }]}>
          {status === 'connecting' || status === 'ringing' ? (
            <ActivityIndicator color="#fff" size="large" style={styles.avatarSpinner} />
          ) : null}
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
        <Text style={styles.partyName} numberOfLines={1}>
          {otherPartyName}
        </Text>
        <Text style={styles.partySubtitle}>Fixhomi voice call</Text>
      </View>

      <View style={[styles.controlArea, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.controlRow}>
          <ControlButton
            icon={muted ? 'mic-off' : 'mic'}
            label={muted ? 'Unmute' : 'Mute'}
            active={muted}
            onPress={handleToggleMute}
            disabled={!connectedAt}
          />
          <ControlButton
            icon={speaker ? 'volume-up' : 'volume-down'}
            label="Speaker"
            active={speaker}
            onPress={handleToggleSpeaker}
            disabled={!connectedAt}
          />
        </View>

        <TouchableOpacity
          style={[styles.endButton, endingFromUser && styles.endButtonBusy]}
          onPress={handleEnd}
          disabled={endingFromUser}
          activeOpacity={0.85}
          accessibilityLabel="End call"
        >
          {endingFromUser ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <MaterialIcon name="call-end" size={36} color="#fff" />
          )}
        </TouchableOpacity>
        <Text style={styles.endLabel}>End</Text>
      </View>
    </View>
  );
}

function ControlButton({ icon, label, active, onPress, disabled }) {
  return (
    <View style={controlStyles.group}>
      <TouchableOpacity
        style={[
          controlStyles.button,
          active && controlStyles.buttonActive,
          disabled && controlStyles.buttonDisabled,
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
      >
        <MaterialIcon
          name={icon}
          size={28}
          color={active ? '#0F172A' : '#fff'}
        />
      </TouchableOpacity>
      <Text style={controlStyles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  headerArea: { alignItems: 'center' },
  statusLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  duration: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 18,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  avatarArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
  avatarSpinner: { position: 'absolute' },
  avatarInitial: { color: '#fff', fontSize: 64, fontWeight: '700' },
  partyName: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    marginTop: 28,
    textAlign: 'center',
  },
  partySubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  controlArea: { alignItems: 'center', paddingHorizontal: 24 },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    marginBottom: 36,
  },
  endButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
  endButtonBusy: { opacity: 0.8 },
  endLabel: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

const controlStyles = StyleSheet.create({
  group: { alignItems: 'center' },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  buttonDisabled: { opacity: 0.4 },
  label: {
    color: '#fff',
    fontSize: 13,
    marginTop: 10,
    fontWeight: '500',
  },
});
