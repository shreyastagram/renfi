/**
 * usePersistedAuthFlow
 *
 * Drop-in replacement for the `authMode` + `otpData` local state used by
 * UserAuthScreen / ProviderAuthScreen.
 *
 * WHY (Issue 2 — OTP step survives a minimize/kill):
 * On Samsung/Realme/Vivo/Oppo the OS frequently kills the backgrounded process
 * (e.g. while the user is in the SMS app reading the OTP). The app then cold-
 * starts and, because the OTP step lived only in component state, it reset to
 * the login screen — "the OTP box is gone and it starts over".
 *
 * This hook persists ONLY the in-progress OTP-verify step (method, identifier,
 * masked value, and remaining validity) so the OTP entry screen is restored on
 * relaunch. It NEVER persists the entered OTP digits (those stay in the verify
 * screen's local state) and it only restores while the OTP could still be valid.
 *
 * @param {'user'|'provider'} userType
 */
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_MODES = {
  LOGIN: 'login',
  REGISTER: 'register',
  OTP_LOGIN: 'otp_login',
  OTP_VERIFY: 'otp_verify',
  // Phone-number SIGNUP entry step (name + phone form). USERS only.
  PHONE_SIGNUP: 'phone_signup',
};

const keyFor = (userType) => `@fixhomi_auth_flow_${userType || 'user'}`;

// Don't restore an OTP step that has essentially no time left (forces a resend).
const MIN_REMAINING_MINUTES = 0.25;

export default function usePersistedAuthFlow(userType) {
  const [authMode, setAuthMode] = useState(AUTH_MODES.LOGIN);
  const [otpData, setOtpData] = useState(null);
  // Guard so the persist effect doesn't wipe storage before restore reads it.
  const [hydrated, setHydrated] = useState(false);

  // Restore the OTP-verify step on mount (only if still within validity).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(keyFor(userType));
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved?.authMode === AUTH_MODES.OTP_VERIFY && saved?.otpData && saved?.savedAt) {
            const elapsedMin = (Date.now() - saved.savedAt) / 60000;
            const totalMin = Number(saved.otpData.expiresInMinutes) || 5;
            const remaining = totalMin - elapsedMin;
            if (remaining > MIN_REMAINING_MINUTES && !cancelled) {
              // Restore with the REMAINING validity so the verify screen's
              // countdown reflects real time left (not a fresh full window).
              setOtpData({ ...saved.otpData, expiresInMinutes: remaining });
              setAuthMode(AUTH_MODES.OTP_VERIFY);
            } else {
              AsyncStorage.removeItem(keyFor(userType)).catch(() => {});
            }
          }
        }
      } catch (e) {
        // Corrupt/unavailable — start fresh.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userType]);

  // Persist while on the OTP-verify step; clear in every other mode (login,
  // register, otp_login) and on success/back (which switch away from verify).
  useEffect(() => {
    if (!hydrated) return;
    if (authMode === AUTH_MODES.OTP_VERIFY && otpData) {
      AsyncStorage.setItem(
        keyFor(userType),
        JSON.stringify({ authMode, otpData, savedAt: Date.now() }),
      ).catch(() => {});
    } else {
      AsyncStorage.removeItem(keyFor(userType)).catch(() => {});
    }
  }, [authMode, otpData, hydrated, userType]);

  return { authMode, setAuthMode, otpData, setOtpData };
}
