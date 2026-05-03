/**
 * CallKeep service — demo branch only.
 *
 * Thin wrapper around react-native-callkeep that:
 *  - Initialises CallKeep once at app boot (idempotent — safe to call twice)
 *  - Exposes setUpcomingCallContext() so the FCM background handler can
 *    park {callId, roomName, callerId, callerName, calleeType} for the
 *    foreground IncomingCallScreen to pick up after the native ring
 *  - Forwards CallKeep's user-action events (answerCall, endCall) to a
 *    global hook the navigator can consume — kept here so App.tsx stays
 *    focused on app-wide concerns
 *
 * Android only. iOS is out of scope for this demo (no Apple Dev account
 * + no PushKit cert), so anything iOS-specific in CallKeep's API we
 * skip here.
 */

import { Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CALLKEEP_LABEL } from '../config/iacax';

const PENDING_CALL_KEY = '@iacax/pendingIncomingCall';

let isSetup = false;

const callKeepOptions = {
  android: {
    alertTitle: 'Permission required',
    alertDescription: 'Fixhomi needs phone account access so you can receive in-app calls on your lockscreen.',
    cancelButton: 'Not now',
    okButton: 'OK',
    additionalPermissions: [],
    selfManaged: false, // false = use system Telecom UI (looks native)
    foregroundService: {
      channelId: 'fixhomi_calls',
      channelName: 'In-app calls',
      notificationTitle: 'Fixhomi call in progress',
      notificationIcon: 'ic_launcher',
    },
  },
  ios: {
    appName: CALLKEEP_LABEL,
    supportsVideo: false,
    maximumCallGroups: '1',
    maximumCallsPerCallGroup: '1',
  },
};

/**
 * Initialise CallKeep. Call once at app boot. Subsequent calls no-op.
 */
export async function setupCallKeep() {
  if (Platform.OS !== 'android') return; // iOS skipped per demo scope
  if (isSetup) return;
  try {
    await RNCallKeep.setup(callKeepOptions);
    RNCallKeep.setAvailable(true);
    RNCallKeep.registerPhoneAccount(callKeepOptions);
    RNCallKeep.registerAndroidEvents();
    isSetup = true;
  } catch (err) {
    // Permission denial here is recoverable — the app still functions,
    // the user just won't get the lockscreen ring UI for incoming calls.
    console.warn('[CallKeep] setup failed:', err?.message);
  }
}

/**
 * Show the native incoming-call UI. Called from the FCM background
 * handler when an INCOMING_CALL push lands.
 */
export function displayIncomingCall({ callId, callerName }) {
  if (Platform.OS !== 'android') return;
  RNCallKeep.displayIncomingCall(
    callId,                      // UUID — must match the callId iacax minted
    callerName || 'Unknown',     // handle (caller identifier)
    callerName || 'Incoming call', // localizedCallerName (display name)
    'generic',                   // handleType
    false,                       // hasVideo
  );
}

/**
 * Transition a CallKeep call from RINGING to ACTIVE. Without this, Android's
 * Telecom service keeps the microphone muted even after the user accepts —
 * LiveKit connects but no audio flows. Call this from the answerCall
 * listener after the iacax /accept succeeds.
 */
export function setCallActive(callId) {
  if (Platform.OS !== 'android') return;
  try {
    RNCallKeep.setCurrentCallActive(callId);
  } catch (err) {
    console.warn('[CallKeep] setCurrentCallActive failed:', err?.message);
  }
}

/**
 * End a CallKeep call programmatically. Call this when:
 *   - The user explicitly hangs up via the in-app InCallScreen
 *   - Iacax tells us the call ended (e.g. callee rejected)
 *   - The 60s ring timeout fires
 */
export function endCallNative(callId) {
  if (Platform.OS !== 'android') return;
  try {
    RNCallKeep.endCall(callId);
  } catch (err) {
    // CallKeep occasionally throws if the call was already ended
    // natively (e.g. user tapped Reject on lockscreen). Safe to ignore.
    console.log('[CallKeep] endCall noop:', err?.message);
  }
}

/**
 * Stash incoming-call context from the FCM background handler so the
 * IncomingCallScreen can read it after the user taps Accept on the
 * native ring UI. The native UI doesn't carry our call metadata, so we
 * use AsyncStorage as the bridge.
 */
export async function setPendingIncomingCall(payload) {
  try {
    await AsyncStorage.setItem(PENDING_CALL_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[CallKeep] could not stash pending call:', err?.message);
  }
}

/**
 * Read + clear the pending incoming call. Returns null if none.
 * IncomingCallScreen calls this on mount so the same payload isn't
 * picked up again on a later cold start.
 */
export async function consumePendingIncomingCall() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CALL_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_CALL_KEY);
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[CallKeep] could not consume pending call:', err?.message);
    return null;
  }
}

/**
 * Wire CallKeep's user-action events to a single handler. Returns a
 * cleanup function to unsubscribe — caller should run it on unmount.
 *
 * @param {Object} handlers
 * @param {(callId: string) => void} [handlers.onAnswer]
 * @param {(callId: string) => void} [handlers.onEnd]
 * @param {(callId: string, muted: boolean) => void} [handlers.onMute]
 * @param {(callId: string, held: boolean) => void} [handlers.onHold]
 */
export function registerCallKeepListeners(handlers = {}) {
  if (Platform.OS !== 'android') return () => {};

  const onAnswer = ({ callUUID }) => handlers.onAnswer?.(callUUID);
  const onEnd = ({ callUUID }) => handlers.onEnd?.(callUUID);
  const onMute = ({ muted, callUUID }) => handlers.onMute?.(callUUID, muted);
  const onHold = ({ hold, callUUID }) => handlers.onHold?.(callUUID, hold);

  RNCallKeep.addEventListener('answerCall', onAnswer);
  RNCallKeep.addEventListener('endCall', onEnd);
  RNCallKeep.addEventListener('didPerformSetMutedCallAction', onMute);
  RNCallKeep.addEventListener('didToggleHoldCallAction', onHold);

  return () => {
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
    RNCallKeep.removeEventListener('didToggleHoldCallAction');
  };
}
