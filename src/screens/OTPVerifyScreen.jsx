/**
 * OTP Verify Screen
 *
 * Screen for entering and verifying OTP code.
 * Uses absolute timestamp for countdown so timer stays accurate
 * even when the app is minimized and resumed.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  AppState,
  Keyboard,
  ScrollView
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Button, Alert, FixhomiLogo } from '../components';
import {
  verifyPhoneLoginOtp,
  verifyEmailLoginOtp,
  sendPhoneLoginOtp,
  sendEmailLoginOtp,
  verifyPhoneSignupOtp,
  sendPhoneSignupOtp,
  sendUnifiedPhoneOtp,
  verifyUnifiedPhoneOtp,
  getErrorMessage,
  AUTH_CODES,
} from '../services/authService';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

const OTPVerifyScreen = ({
  route,
  navigation,
  method,
  identifier,
  maskedValue,
  expiresInMinutes = 5,
  userType = 'user',
  // 'login' (default — existing OTP-login flow), 'signup' (legacy phone-only
  // signup flow), or 'unified' (USER unified auth — NoeFix decides login vs
  // signup; `flow` from send-otp must be echoed back at verify time).
  context = 'login',
  // Unified flow only: 'login' | 'signup' as reported by the unified send-otp.
  flow,
  fullName,
  signupExtras,
  // Unified flow only: called with the auth result when isNewUser===true so
  // the parent can show the Welcome popup BEFORE handleAuthSuccess.
  onNewUserAuth,
  onBack,
}) => {
  const { handleAuthSuccess } = useApp();
  const { t } = useLanguage();

  // Get params from route or props
  const params = route?.params || {};
  const _method = method || params.method;
  const _identifier = identifier || params.identifier;
  const _maskedValue = maskedValue || params.maskedValue;
  const _expiresInMinutes = expiresInMinutes || params.expiresInMinutes;
  const _userType = userType || params.userType;
  const _context = context || params.context || 'login';
  const _fullName = fullName || params.fullName;
  const _signupExtras = signupExtras || params.signupExtras || {};
  // Unified flow — kept in a ref so a resend can pick up a changed flow
  // (e.g. the account was created elsewhere between send and resend).
  const unifiedFlowRef = useRef(flow || params.flow);

  // OTP input refs
  const inputRefs = useRef([]);
  // Synchronous re-entry guard so a fast double-tap can't fire two verifies
  const submittingRef = useRef(false);

  // Absolute expiry timestamp (survives app minimize)
  const expiryTimeRef = useRef(Date.now() + _expiresInMinutes * 60 * 1000);
  const resendCooldownRef = useRef(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);

  // State
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [alertHint, setAlertHint] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(_expiresInMinutes * 60);
  const [canResend, setCanResend] = useState(false);
  // Which cell is focused — drives the active-cell highlight (no blinking caret)
  const [focusedIndex, setFocusedIndex] = useState(null);

  // Calculate remaining time from absolute timestamp
  const recalculate = useCallback(() => {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((expiryTimeRef.current - now) / 1000));
    setSecondsLeft(remaining);

    const resendRemaining = resendCooldownRef.current - now;
    if (resendRemaining <= 0) {
      setCanResend(true);
    }
  }, []);

  // Countdown timer — recalculates from absolute timestamp each tick
  useEffect(() => {
    recalculate();
    const timer = setInterval(recalculate, 1000);
    return () => clearInterval(timer);
  }, [recalculate]);

  // AppState listener — recalculate immediately when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        recalculate();
      }
    });
    return () => subscription.remove();
  }, [recalculate]);

  // Autofocus the first cell on mount so the keyboard opens immediately
  // (slight delay lets the navigation/mount transition settle first).
  useEffect(() => {
    const focusTimer = setTimeout(() => inputRefs.current[0]?.focus(), 350);
    return () => clearTimeout(focusTimer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const showAlert = useCallback((message, type = 'error', hint = null) => {
    setAlertMessage(message);
    setAlertType(type);
    setAlertHint(hint);
  }, []);

  const clearAlert = useCallback(() => {
    setAlertMessage(null);
    setAlertHint(null);
  }, []);

  const handleOtpChange = (value, index) => {
    clearAlert();
    const digits = value.replace(/[^0-9]/g, '');

    // Deletion fallback: on Android, Backspace onKeyPress is unreliable for
    // number-pad inputs. When a filled cell is cleared, blank it and step focus
    // back so deleting never strands the user on an empty cell.
    if (value === '' && index > 0) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
      return;
    }

    // Multiple digits arriving at once = SMS autofill / paste → distribute across
    // cells starting from this one. (selectTextOnFocus makes a single re-typed
    // digit replace rather than append, so this branch is paste-only in practice.)
    if (digits.length > 1) {
      const incoming = digits.slice(0, OTP_LENGTH - index).split('');
      const newOtp = [...otp];
      incoming.forEach((d, i) => {
        newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const lastIndex = Math.min(index + incoming.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIndex]?.focus();
      return;
    }

    // Single digit
    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);
    if (digits && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      clearAlert();
      const otpCode = otp.join('');

      if (otpCode.length !== OTP_LENGTH) {
        showAlert(t('auth.otpIncomplete'), 'warning');
        return;
      }

      if (secondsLeft <= 0) {
        showAlert(t('auth.otpExpiredMsg'), 'error');
        return;
      }

      setLoading(true);

      let result;
      if (_context === 'unified' && _method === 'phone') {
        // UNIFIED user phone auth — NoeFix logs in existing accounts and
        // auto-registers unknown ones (per the `flow` from send-otp). Terms
        // are accepted implicitly on the unified auth screen.
        result = await verifyUnifiedPhoneOtp(_identifier, otpCode, unifiedFlowRef.current, {
          termsAccepted: true,
          privacyAccepted: true,
        });
      } else if (_context === 'signup' && _method === 'phone') {
        // Phone-only USER signup. Goes via NoeFix (apiClient) so the Mongo
        // user doc is created alongside the JAuth user. Legal acceptance and
        // optional overrides ride in `signupExtras`.
        result = await verifyPhoneSignupOtp(_identifier, otpCode, _signupExtras);
      } else if (_method === 'phone') {
        result = await verifyPhoneLoginOtp(_identifier, otpCode);
      } else {
        result = await verifyEmailLoginOtp(_identifier, otpCode);
      }

      if (result.success) {
        // Close the keyboard the moment verification lands so the success
        // transition feels clean (no keyboard lingering over the next screen).
        Keyboard.dismiss();
        // Clear OTP from state immediately after successful verification
        setOtp(Array(OTP_LENGTH).fill(''));

        // Validate that the user's actual role matches the screen they're signing in from.
        // NoeFix signup-verify returns the user payload nested under `data`; JAuth login
        // returns role at the top level. Read both.
        // Normalize once: JAuth login returns role UPPERCASE ('USER'/'SERVICE_PROVIDER'),
        // NoeFix signup returns it lowercase ('user'). Uppercasing both removes the need
        // for a magic 'user' literal in the comparison below.
        const backendRole = (result.data?.role || result.data?.data?.role || '').toString().toUpperCase();
        const expectedRole = _userType === 'provider' ? 'SERVICE_PROVIDER' : 'USER';
        if (backendRole && backendRole !== expectedRole && backendRole !== 'ADMIN') {
          const correctScreen = backendRole === 'SERVICE_PROVIDER' ? 'provider' : 'user';
          showAlert(
            t('auth.roleMismatch', { role: correctScreen }),
            'error'
          );
          setLoading(false);
          return;
        }
        showAlert(t('auth.verifiedSuccess'), 'success');
        // NoeFix signup returns the auth envelope flat (accessToken/refreshToken at top level
        // alongside `data: {profile…}`), matching the existing register() shape. Pass through.
        const authData = { ...result.data, userType: _userType };

        // UNIFIED flow, NEW user → hold the auth result in the parent and show
        // the Welcome popup BEFORE handleAuthSuccess (name is optional there;
        // phone accounts are created with an empty name, never a placeholder).
        if (_context === 'unified' && result.data?.isNewUser && onNewUserAuth) {
          onNewUserAuth({ ...authData, authMethod: 'phone' });
          setLoading(false);
          return;
        }

        const authProcessed = await handleAuthSuccess(authData);
        if (!authProcessed) {
          showAlert(t('auth.sessionSaveWarning'), 'warning');
        }
      } else {
        const { error } = result;
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();

        switch (error.code) {
          case AUTH_CODES.INVALID_OTP:
          case 'INVALID_OTP':
            showAlert(error.message || t('auth.invalidOtp'), 'error');
            break;
          case AUTH_CODES.OTP_EXPIRED:
            showAlert(t('auth.otpExpiredMsg'), 'error');
            setSecondsLeft(0);
            break;
          case AUTH_CODES.MAX_ATTEMPTS_EXCEEDED:
            showAlert(t('auth.maxAttempts'), 'error');
            setSecondsLeft(0);
            break;
          case AUTH_CODES.ACCOUNT_DISABLED:
            showAlert(t('auth.accountDisabled'), 'error');
            break;
          case 'ROLE_CONFLICT':
            // Unified flow — the number belongs to a provider account.
            showAlert(
              t('auth.providerAccountPhone') ||
                'This number belongs to a Provider account. Please sign in from the Provider screen.',
              'error',
            );
            break;
          case AUTH_CODES.USER_NOT_FOUND:
            showAlert(
              _method === 'phone' ? t('auth.noAccountPhone') : t('auth.noAccountEmail'),
              'error',
            );
            break;
          case 'PROFILE_SYNC_FAILED':
          case 'MONGODB_SYNC_FAILED':
            // The OTP WAS verified but account setup didn't finish (transient DB
            // issue). The code is consumed — the user must request a fresh one;
            // the retry self-heals server-side.
            showAlert(
              t('auth.syncFailedRetry') ||
                'Your code was verified, but account setup could not finish. Please request a new code and try again.',
              'warning',
            );
            setSecondsLeft(0);
            break;
          case 'PHONE_ALREADY_EXISTS':
            // Rare unified race: send-otp chose signup but the account got
            // created meanwhile. A fresh OTP re-routes to login automatically.
            showAlert(
              t('auth.phoneExistsResend') ||
                'This number is already registered. Please request a new code to sign in.',
              'warning',
            );
            setSecondsLeft(0);
            break;
          default:
            showAlert(getErrorMessage(error.code, t('auth.verificationFailed')), 'error');
        }
      }
    } catch (error) {
      console.error('[OTPVerifyScreen] Unexpected error:', error);
      showAlert(t('common.somethingWentWrong'), 'error');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      clearAlert();
      setResendLoading(true);

      let result;
      if (_context === 'unified' && _method === 'phone') {
        // Unified resend — re-hits the unified send endpoint; keep the flow in
        // sync in case the backend reports a different one this time.
        result = await sendUnifiedPhoneOtp(_identifier);
        if (result.success && result.flow) {
          unifiedFlowRef.current = result.flow;
        }
      } else if (_context === 'signup' && _method === 'phone') {
        // Resend during phone-signup needs the captured full name so JAuth can
        // re-issue an OTP for the same prospective account.
        result = await sendPhoneSignupOtp(_identifier, _fullName);
      } else if (_method === 'phone') {
        result = await sendPhoneLoginOtp(_identifier);
      } else {
        result = await sendEmailLoginOtp(_identifier);
      }

      if (result.success) {
        // Reset expiry timestamp
        expiryTimeRef.current = Date.now() + _expiresInMinutes * 60 * 1000;
        resendCooldownRef.current = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
        setCanResend(false);
        recalculate();

        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        showAlert(t('auth.resendSuccess'), 'success');
      } else {
        const msg = result.error?.message || t('auth.resendFailed');
        showAlert(msg, 'error');
      }
    } catch (error) {
      console.error('[OTPVerifyScreen] Resend error:', error);
      showAlert(t('auth.resendFailed'), 'error');
    } finally {
      setResendLoading(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  const isExpired = secondsLeft <= 0;
  const otpComplete = otp.join('').length === OTP_LENGTH;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <FixhomiLogo size={44} />
          </View>
          <Text style={styles.brandName}>FixHomi</Text>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.enterOtp')}</Text>
            {/* Masked identifier on its own flowed line (not a forced `\n`) so a
                long masked number + long translated label wraps cleanly and can
                never collide with the OTP boxes below. */}
            <Text style={styles.subtitle}>{t('auth.otpSentSubtitle')}</Text>
            <Text style={styles.maskedValue}>{_maskedValue}</Text>
          </View>

          {/* Timer */}
          <View style={styles.timerContainer}>
            {!isExpired ? (
              <View style={styles.timerBadge}>
                <Text style={styles.timerBadgeText}>
                  {formatTime(secondsLeft)}
                </Text>
              </View>
            ) : (
              <View style={[styles.timerBadge, styles.timerBadgeExpired]}>
                <Text style={styles.timerExpiredText}>{t('auth.codeExpired')}</Text>
              </View>
            )}
          </View>

          {/* Alert */}
          {alertMessage && (
            <Alert
              type={alertType}
              message={alertMessage}
              hint={alertHint}
              onDismiss={clearAlert}
              style={styles.alert}
            />
          )}

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.otpInput,
                  digit && styles.otpInputFilled,
                  focusedIndex === index && !isExpired && styles.otpInputFocused,
                  isExpired && styles.otpInputExpired,
                  loading && styles.otpInputDisabled,
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(event) => handleKeyPress(event, index)}
                onFocus={() => setFocusedIndex(index)}
                onBlur={() => setFocusedIndex((cur) => (cur === index ? null : cur))}
                keyboardType="number-pad"
                maxLength={index === 0 ? OTP_LENGTH : 1}
                editable={!loading && !isExpired}
                selectTextOnFocus
                caretHidden={true}
                selectionColor="transparent"
                // SMS OTP autofill: iOS reads the code from the Messages app via
                // textContentType; Android via autoComplete="sms-otp". Only on the
                // first cell — the paste branch in handleOtpChange fans it across cells.
                textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                autoComplete={index === 0 && Platform.OS === 'android' ? 'sms-otp' : undefined}
                importantForAutofill={index === 0 ? 'yes' : 'no'}
              />
            ))}
          </View>

          {/* Verify Button */}
          <Button
            title={loading ? t('auth.verifying') : isExpired ? t('auth.otpExpiredBtn') : t('auth.verifyOtp')}
            onPress={handleVerify}
            loading={loading}
            disabled={loading || !otpComplete || isExpired}
            style={styles.verifyButton}
          />

          {/* Resend */}
          <View style={styles.resendContainer}>
            {isExpired ? (
              <TouchableOpacity
                onPress={handleResend}
                disabled={resendLoading || loading}
                style={styles.resendProminent}
              >
                <Text style={styles.resendProminentText}>
                  {resendLoading ? t('auth.sending') : t('auth.requestNewOtp')}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.resendText}>{t('auth.didntReceive')}</Text>
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={!canResend || resendLoading || loading}
                >
                  <Text
                    style={[
                      styles.resendLink,
                      (!canResend || resendLoading) && styles.resendLinkDisabled,
                    ]}
                  >
                    {resendLoading ? t('auth.sending') : canResend ? t('auth.resendOtp') : t('auth.waitToResend')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.infoText}>
              {_method === 'phone' ? t('auth.infoPhoneCheck') : t('auth.infoEmailCheck')}
            </Text>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ── Layout ──
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, padding: 24 },

  // ── Back Button ──
  backButton: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 18,
  },

  // ── Logo ──
  logoContainer: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center',
    overflow: 'hidden', marginBottom: 6,
    ...Platform.select({
      ios: { shadowColor: '#f67c16', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 5 },
    }),
  },
  brandName: { fontSize: 18, fontWeight: '800', color: '#f67c16', textAlign: 'center', marginBottom: 18, letterSpacing: 0.3 },

  // ── Header ──
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', lineHeight: 22, flexWrap: 'wrap' },
  maskedValue: { fontSize: 15, fontWeight: '700', color: '#1E293B', lineHeight: 22, marginTop: 4, flexWrap: 'wrap' },

  // ── Timer ──
  timerContainer: { alignItems: 'center', marginBottom: 24 },
  timerBadge: {
    backgroundColor: 'rgba(246,124,22,0.06)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
  },
  timerBadgeText: { fontSize: 17, fontWeight: '700', color: '#f67c16', fontVariant: ['tabular-nums'] },
  timerBadgeExpired: { backgroundColor: '#FEF2F2' },
  timerExpiredText: { fontSize: 14, color: '#EF4444', fontWeight: '600' },

  // ── Alert ──
  alert: { marginBottom: 16 },

  // ── OTP Boxes ──
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, paddingHorizontal: 4 },
  otpInput: {
    width: 48, height: 56, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14,
    fontSize: 22, fontWeight: '800', textAlign: 'center', color: '#1E293B', backgroundColor: '#FAFBFC',
  },
  otpInputFilled: { borderColor: '#f67c16', backgroundColor: 'rgba(246,124,22,0.04)' },
  otpInputFocused: { borderColor: '#f67c16', borderWidth: 2, backgroundColor: '#FFFFFF' },
  otpInputExpired: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', color: '#94A3B8' },
  otpInputDisabled: { backgroundColor: '#F8FAFC', color: '#94A3B8' },

  // ── Verify Button ──
  verifyButton: { marginBottom: 24 },

  // ── Resend ──
  resendContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginBottom: 28 },
  resendText: { fontSize: 14, color: '#64748B' },
  resendLink: { fontSize: 14, color: '#f67c16', fontWeight: '600' },
  resendLinkDisabled: { color: '#94A3B8' },
  resendProminent: {
    backgroundColor: 'rgba(246,124,22,0.06)', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(246,124,22,0.25)',
  },
  resendProminentText: { fontSize: 15, color: '#f67c16', fontWeight: '600' },

  // ── Info ──
  info: { padding: 14, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  infoText: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});

export default OTPVerifyScreen;
