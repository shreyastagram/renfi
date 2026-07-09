/**
 * User Auth Screen
 *
 * Container screen for USER authentication — UNIFIED flow (v3):
 *   UNIFIED     → UnifiedUserAuthScreen (Google / Apple / Phone OTP)
 *   PHONE_INPUT → PhoneNumberScreen (phone-only entry, unified OTP)
 *   OTP_VERIFY  → OTPVerifyScreen (context='unified')
 *
 * Email/password login/registration was REMOVED for Users — LoginScreen /
 * RegisterScreen / OTPLoginScreen / PhoneSignupScreen are no longer rendered
 * here (they remain in the codebase for the provider flow, which is untouched).
 *
 * Also orchestrates the post-signup Welcome popup: any successful auth with
 * isNewUser===true holds the auth result in state, shows WelcomeModal
 * (optional name for phone signups + referral code), applies the referral /
 * name with an EXPLICIT access token (handleAuthSuccess hasn't stored tokens
 * yet), and only then calls handleAuthSuccess.
 *
 * @version 3.0.0
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';
import UnifiedUserAuthScreen from './UnifiedUserAuthScreen';
import PhoneNumberScreen from './PhoneNumberScreen';
import OTPVerifyScreen from './OTPVerifyScreen';
import WelcomeModal from '../components/WelcomeModal';
import usePersistedAuthFlow, { AUTH_MODES } from '../hooks/usePersistedAuthFlow';
import { applyReferralCode } from '../services/referralService';
import { NODE_BASE_URL, JAVA_BASE_URL, ENDPOINTS } from '../config/api';
import { useApp } from '../context/AppContext';
import { Analytics, EV, onceEver } from '../services/analytics';

/**
 * Update the new user's name in BOTH databases with an explicit token.
 * Runs BEFORE handleAuthSuccess, so tokens are not in storage yet — the
 * axios clients' interceptors would find nothing (or worse, trigger a
 * refresh-and-clear), hence plain fetch with an explicit Bearer header.
 * Mirrors profileService.updateUserProfile: Java Auth first (fullName),
 * then the Mongo doc (name). Best-effort — never blocks login.
 */
const updateNameWithToken = async (userId, fullName, accessToken) => {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  try {
    await fetch(`${JAVA_BASE_URL}${ENDPOINTS.PROFILE.UPDATE_ME}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ fullName }),
    });
  } catch (e) {
    console.warn('[UserAuth] Java Auth name update failed:', e.message);
  }
  try {
    // Node's updateUserById reads `fullName` and mirrors it into both the
    // `fullName` and `name` Mongo fields itself.
    await fetch(`${NODE_BASE_URL}${ENDPOINTS.PROFILE.UPDATE_USER}/${userId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ fullName }),
    });
  } catch (e) {
    console.warn('[UserAuth] Mongo name update failed:', e.message);
  }
};

/**
 * UserAuthScreen Component
 * Manages the unified user authentication flow
 *
 * @param {Object} props - Navigation props
 */
const UserAuthScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const { handleAuthSuccess } = useApp();
  // OTP step persists across an OS process kill (Issue 2) so a user who leaves
  // to read the SMS OTP returns to the OTP box instead of starting over.
  // Default mode for USERS is the unified auth screen.
  const { authMode, setAuthMode, otpData, setOtpData } = usePersistedAuthFlow(
    'user',
    AUTH_MODES.UNIFIED
  );

  // Welcome popup state — the held auth result of a NEW user (tokens included)
  // waiting for the popup to finish before handleAuthSuccess runs.
  const [pendingAuth, setPendingAuth] = useState(null);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [welcomeReferralPrefill, setWelcomeReferralPrefill] = useState('');

  /**
   * Complete the held auth — the single exit point of the popup flow.
   */
  const finishAuth = useCallback(
    async (authData) => {
      setWelcomeVisible(false);
      setPendingAuth(null);
      const processed = await handleAuthSuccess(authData);
      if (!processed) {
        console.warn('[UserAuth] handleAuthSuccess failed after welcome popup');
      }
    },
    [handleAuthSuccess]
  );

  /**
   * A NEW user authenticated (Google/Apple/phone). Hold the result and show
   * the Welcome popup BEFORE logging in. Pre-fills the referral field from
   * the deep-link code ('pendingReferralCode') and clears it.
   */
  const handleNewUserAuth = useCallback(async (authData) => {
    // The OTP step is complete — reset the persisted mode so a process-kill
    // while the welcome popup is open doesn't restore a consumed-OTP screen.
    setOtpData(null);
    setAuthMode(AUTH_MODES.UNIFIED);

    // Analytics: the account already exists server-side at this point. Log the
    // registration NOW (deduped by the same key handleAuthSuccess uses) so a
    // user who kills the app on the Welcome popup is still counted — otherwise
    // their next auth returns isNewUser=false and the conversion is lost.
    const regId = authData?.userId || authData?.javaUserId || authData?.mongoId;
    if (regId) {
      onceEver(`registered:${regId}`).then((first) => {
        if (first) {
          Analytics.setUser(regId);
          Analytics.track(EV.USER_REGISTERED, {
            role: 'user',
            method: authData?.authMethod || 'unknown',
          });
          Analytics.flush();
        }
      });
    }
    let prefill = '';
    try {
      const code = await AsyncStorage.getItem('pendingReferralCode');
      if (code) {
        // NOT removed here — cleared only after a successful apply or an
        // explicit skip, so a transient failure doesn't lose the code.
        prefill = code;
      }
    } catch (e) {
      // best-effort — popup still shows without a prefill
    }
    setWelcomeReferralPrefill(prefill);
    setPendingAuth(authData);
    setWelcomeVisible(true);
  }, [setOtpData, setAuthMode]);

  /**
   * Welcome popup "Continue". Applies the referral code and/or name with the
   * held access token, then logs in. Referral REJECTIONS (bad code etc.) are
   * returned to the modal as an inline error so the user can correct or skip;
   * transient failures and name-update failures never block login.
   */
  const handleWelcomeComplete = useCallback(
    async ({ fullName, referralCode }) => {
      if (!pendingAuth) return {};
      const accessToken = pendingAuth.accessToken;
      const userId =
        pendingAuth.mongoId || pendingAuth.javaUserId || pendingAuth.userId;

      // (a) Referral code — explicit token (tokens not stored yet)
      if (referralCode) {
        const res = await applyReferralCode(referralCode, accessToken);
        if (res.success) {
          AsyncStorage.removeItem('pendingReferralCode').catch(() => {});
        }
        if (!res.success) {
          const inlineErrors = {
            INVALID_CODE:
              t('auth.invalidReferralCode') ||
              'That referral code is not valid. Check it or skip for now.',
            SELF_REFERRAL:
              t('auth.selfReferralCode') || "You can't use your own referral code.",
            ALREADY_REFERRED:
              t('auth.alreadyReferred') ||
              'A referral code was already applied to your account.',
            DAILY_LIMIT:
              t('auth.referralDailyLimit') ||
              'This code reached its daily limit. Try again tomorrow or skip.',
          };
          if (inlineErrors[res.code]) {
            // Keep the modal open — user can fix the code or skip.
            return { referralError: inlineErrors[res.code] };
          }
          // Transient/unknown failure — don't block login.
          console.warn('[UserAuth] Referral apply failed (non-blocking):', res.code);
        }
      }

      // (b) Name (phone signups only) — explicit token, best-effort
      if (fullName && userId) {
        await updateNameWithToken(userId, fullName, accessToken);
      }

      // (c) Log in with the held result
      await finishAuth({
        ...pendingAuth,
        fullName: fullName || pendingAuth.fullName,
      });
      return {};
    },
    [pendingAuth, finishAuth, t]
  );

  /**
   * Welcome popup "Skip for now" — log straight in. Phone accounts keep an
   * empty name (no placeholder is ever written).
   */
  const handleWelcomeSkip = useCallback(() => {
    // Deliberate skip — discard any pending deep-link referral code.
    AsyncStorage.removeItem('pendingReferralCode').catch(() => {});
    if (pendingAuth) {
      finishAuth(pendingAuth);
    } else {
      setWelcomeVisible(false);
    }
  }, [pendingAuth, finishAuth]);

  /**
   * Switch to the phone-entry step of the unified flow
   */
  const handlePickPhone = useCallback(() => {
    setAuthMode(AUTH_MODES.PHONE_INPUT);
  }, [setAuthMode]);

  /**
   * Handle OTP sent - switch to verify mode
   */
  const handleOtpSent = useCallback((data) => {
    setOtpData(data);
    setAuthMode(AUTH_MODES.OTP_VERIFY);
  }, [setAuthMode, setOtpData]);

  /**
   * Back from OTP verify — the unified flow returns to the phone-entry step;
   * anything else (e.g. a restored pre-unified OTP step) falls back to the
   * unified auth screen.
   */
  const handleOtpVerifyBack = useCallback(() => {
    if (otpData?.context === 'unified') {
      setAuthMode(AUTH_MODES.PHONE_INPUT);
    } else {
      setAuthMode(AUTH_MODES.UNIFIED);
    }
    setOtpData(null);
  }, [otpData, setAuthMode, setOtpData]);

  /**
   * Back from the phone-entry step returns to the unified auth screen.
   */
  const handlePhoneInputBack = useCallback(() => {
    setAuthMode(AUTH_MODES.UNIFIED);
  }, [setAuthMode]);

  /**
   * Render current auth screen based on mode
   */
  const renderAuthScreen = () => {
    switch (authMode) {
      case AUTH_MODES.PHONE_INPUT:
        return (
          <PhoneNumberScreen
            onOtpSent={handleOtpSent}
            onBack={handlePhoneInputBack}
          />
        );

      case AUTH_MODES.OTP_VERIFY:
        return (
          <OTPVerifyScreen
            navigation={navigation}
            method={otpData?.method}
            identifier={otpData?.identifier}
            maskedValue={otpData?.maskedValue}
            expiresInMinutes={otpData?.expiresInMinutes}
            userType="user"
            context={otpData?.context || 'unified'}
            flow={otpData?.flow}
            // Signup-only extras — kept for a restored legacy 'signup' OTP step.
            fullName={otpData?.fullName}
            signupExtras={otpData?.signupExtras}
            onNewUserAuth={handleNewUserAuth}
            onBack={handleOtpVerifyBack}
          />
        );

      case AUTH_MODES.UNIFIED:
      default:
        // LOGIN / REGISTER / OTP_LOGIN / PHONE_SIGNUP no longer exist for
        // users — any stale mode lands on the unified screen.
        return (
          <UnifiedUserAuthScreen
            navigation={navigation}
            onPickPhone={handlePickPhone}
            onNewUserAuth={handleNewUserAuth}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderAuthScreen()}

      {/* Post-signup Welcome popup (NEW users only, before handleAuthSuccess) */}
      <WelcomeModal
        visible={welcomeVisible}
        needsName={pendingAuth?.authMethod === 'phone'}
        initialReferralCode={welcomeReferralPrefill}
        onComplete={handleWelcomeComplete}
        onSkip={handleWelcomeSkip}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export default UserAuthScreen;
