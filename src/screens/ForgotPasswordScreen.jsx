/**
 * Forgot Password Screen
 *
 * Password reset via phone OTP or email OTP.
 * Step 1: Choose method (phone/email) -> enter identifier -> send OTP
 * Step 2: Enter OTP + new password -> reset
 *
 * Uses absolute timestamp for OTP countdown so timer
 * stays accurate even when app is minimized.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  AppState
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Button, Input, PhoneInput, Alert, FixhomiLogo } from '../components';
import {
  forgotPasswordPhone,
  forgotPasswordEmail,
  verifyOtpAndResetPassword,
  verifyEmailOtpAndResetPassword,
  getErrorMessage,
  AUTH_CODES,
} from '../services/authService';
import { validatePhone, validatePassword, validateEmail } from '../utils/validation';
import { useLanguage } from '../context/LanguageContext';

const COLORS = {
  primary: '#f67c16',
  primaryLight: 'rgba(246,124,22,0.06)',
  background: '#FFFFFF',
  surface: '#F8FAFC',
  text: '#1E293B',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  border: '#E2E8F0',
  error: '#EF4444',
  success: '#10B981',
  white: '#FFFFFF',
};

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 30;

const ForgotPasswordScreen = ({ navigation, onGoBack }) => {
  const { t } = useLanguage();

  // Method state: 'phone' or 'email'
  const [method, setMethod] = useState('phone');

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [alertHint, setAlertHint] = useState(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  // Timer state (absolute timestamp based)
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const expiryTimeRef = useRef(0);
  const resendCooldownRef = useRef(0);

  // OTP input refs
  const otpRefs = useRef([]);

  // Recalculate timer from absolute timestamp
  const recalculate = useCallback(() => {
    if (expiryTimeRef.current === 0) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((expiryTimeRef.current - now) / 1000));
    setSecondsLeft(remaining);
    if (resendCooldownRef.current > 0 && now >= resendCooldownRef.current) {
      setCanResend(true);
    }
  }, []);

  // Timer tick
  useEffect(() => {
    if (step !== 2 || passwordResetSuccess) return;
    const timer = setInterval(recalculate, 1000);
    return () => clearInterval(timer);
  }, [step, passwordResetSuccess, recalculate]);

  // AppState listener — recalculate on resume
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && step === 2) {
        recalculate();
      }
    });
    return () => subscription.remove();
  }, [step, recalculate]);

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

  const validateInput = () => {
    if (method === 'phone') {
      if (!phoneNumber.trim()) {
        setError(t('auth.phoneRequired'));
        return false;
      }
      const phoneValidation = validatePhone(phoneNumber);
      if (!phoneValidation.isValid) {
        setError(phoneValidation.error);
        return false;
      }
    } else {
      if (!email.trim()) {
        setError(t('auth.emailRequired') || 'Email is required');
        return false;
      }
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        setError(emailValidation.error);
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleSendOtp = async () => {
    if (!validateInput()) return;

    try {
      setLoading(true);
      clearAlert();

      let result;
      if (method === 'phone') {
        result = await forgotPasswordPhone(phoneNumber.trim());
      } else {
        result = await forgotPasswordEmail(email.trim());
      }

      if (result.success) {
        if (method === 'phone') {
          setMaskedPhone(result.maskedPhone || phoneNumber.replace(/(.{2})(.*)(.{4})/, '$1****$3'));
        } else {
          setMaskedEmail(email.replace(/(.{2})(.*)(@.*)/, '$1***$3'));
        }
        setStep(2);

        // Start timer
        expiryTimeRef.current = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;
        resendCooldownRef.current = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
        setCanResend(false);
        setSecondsLeft(OTP_EXPIRY_MINUTES * 60);

        showAlert(
          method === 'phone' ? t('auth.otpSentPhone') : (t('auth.otpSentEmail') || 'If your email is registered, an OTP has been sent.'),
          'success'
        );
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      } else {
        const errorCode = result.error?.code;
        const errorMsg = result.error?.message || '';

        if (errorMsg.includes('Google Sign-In')) {
          showAlert(t('auth.googleSignInError'), 'error');
        } else if (
          errorCode === AUTH_CODES.USER_NOT_FOUND ||
          errorMsg.includes('No account found')
        ) {
          showAlert(method === 'phone' ? t('auth.noAccountPhone') : (t('auth.noAccountEmail') || 'No account found with this email.'), 'error');
        } else if (errorCode === AUTH_CODES.TOO_MANY_REQUESTS) {
          showAlert(t('auth.tooManyRequests'), 'warning');
        } else {
          showAlert(getErrorMessage(errorCode, errorMsg), 'error');
        }
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      showAlert(t('common.somethingWentWrong'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text, index) => {
    clearAlert();
    const digit = text.replace(/[^0-9]/g, '');

    if (digit.length <= 1) {
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);
      if (digit && index < OTP_LENGTH - 1) {
        otpRefs.current[index + 1]?.focus();
      }
    } else {
      // Handle paste — distribute digits across inputs
      const digits = digit.slice(0, OTP_LENGTH).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < OTP_LENGTH) {
          newOtp[index + i] = d;
        }
      });
      setOtp(newOtp);
      const lastIndex = Math.min(index + digits.length - 1, OTP_LENGTH - 1);
      otpRefs.current[lastIndex]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const validatePasswordInputs = () => {
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error);
      showAlert(passwordValidation.error, 'error');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsNoMatch'));
      showAlert(t('auth.passwordsNoMatch'), 'error');
      return false;
    }
    setError(null);
    return true;
  };

  const handleResetPassword = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== OTP_LENGTH) {
      showAlert(t('auth.otpIncomplete'), 'warning');
      return;
    }

    if (secondsLeft <= 0) {
      showAlert(t('auth.otpExpiredMsg'), 'error');
      return;
    }

    if (!validatePasswordInputs()) return;

    try {
      setLoading(true);
      clearAlert();

      const result = method === 'phone'
        ? await verifyOtpAndResetPassword(phoneNumber.trim(), otpCode, newPassword)
        : await verifyEmailOtpAndResetPassword(email.trim(), otpCode, newPassword);

      if (result.success) {
        setPasswordResetSuccess(true);
        showAlert(t('auth.passwordResetDone'), 'success');
      } else {
        const errorCode = result.error?.code || '';

        if (errorCode === 'INVALID_OTP' || errorCode === AUTH_CODES.INVALID_OTP) {
          showAlert(result.error?.message || t('auth.invalidOtp'), 'error');
          setOtp(Array(OTP_LENGTH).fill(''));
          otpRefs.current[0]?.focus();
        } else if (errorCode === AUTH_CODES.OTP_EXPIRED) {
          showAlert(t('auth.otpExpiredMsg'), 'error');
          setSecondsLeft(0);
        } else if (errorCode === AUTH_CODES.MAX_ATTEMPTS_EXCEEDED) {
          showAlert(t('auth.maxAttempts'), 'error');
          setSecondsLeft(0);
        } else {
          showAlert(getErrorMessage(errorCode, t('auth.resetFailed')), 'error');
        }
      }
    } catch (err) {
      console.error('Reset password error:', err);
      showAlert(t('common.somethingWentWrong'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || loading) return;

    setOtp(Array(OTP_LENGTH).fill(''));
    clearAlert();
    setCanResend(false);

    try {
      setLoading(true);
      const result = method === 'phone'
        ? await forgotPasswordPhone(phoneNumber.trim())
        : await forgotPasswordEmail(email.trim());

      if (result.success) {
        // Reset timers
        expiryTimeRef.current = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;
        resendCooldownRef.current = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
        setSecondsLeft(OTP_EXPIRY_MINUTES * 60);

        showAlert(t('auth.newOtpSent'), 'success');
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      } else {
        setCanResend(true);
        showAlert(result.error?.message || t('auth.resendFailed'), 'error');
      }
    } catch (err) {
      setCanResend(true);
      showAlert(t('auth.resendFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    if (step === 2 && !passwordResetSuccess) {
      setStep(1);
      setOtp(Array(OTP_LENGTH).fill(''));
      clearAlert();
      setError(null);
    } else if (onGoBack) {
      onGoBack();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  const isExpired = step === 2 && secondsLeft <= 0 && !passwordResetSuccess;
  const otpComplete = otp.join('').length === OTP_LENGTH;

  // ==================== RENDER ====================

  const renderSuccessState = () => (
    <View style={styles.successContainer}>
      <View style={styles.successIconContainer}>
        <MaterialIcons name="check-circle" size={48} color="#10B981" />
      </View>
      <Text style={styles.successTitle}>{t('auth.passwordResetDone')}</Text>
      <Text style={styles.successMessage}>
        {t('auth.passwordResetMsg')}
      </Text>
      <Button
        title={t('auth.backToLogin')}
        onPress={onGoBack || (() => navigation?.goBack())}
        style={styles.actionButton}
      />
    </View>
  );

  const renderInputStep = () => (
    <View style={styles.formContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.forgotPasswordTitle')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.forgotPasswordSubtitle')}
        </Text>
      </View>

      {/* Method Toggle */}
      <View style={styles.methodToggle}>
        <TouchableOpacity
          style={[styles.methodTab, method === 'phone' && styles.methodTabActive]}
          onPress={() => { setMethod('phone'); setError(null); clearAlert(); }}
        >
          <Text style={[styles.methodTabText, method === 'phone' && styles.methodTabTextActive]}>
            {t('auth.viaPhone') || 'Via Phone'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.methodTab, method === 'email' && styles.methodTabActive]}
          onPress={() => { setMethod('email'); setError(null); clearAlert(); }}
        >
          <Text style={[styles.methodTabText, method === 'email' && styles.methodTabTextActive]}>
            {t('auth.viaEmail') || 'Via Email'}
          </Text>
        </TouchableOpacity>
      </View>

      {method === 'phone' ? (
        <PhoneInput
          label={t('auth.phoneNumber')}
          required
          value={phoneNumber}
          onChangeText={(text) => {
            setPhoneNumber(text);
            if (error) setError(null);
            if (alertMessage) clearAlert();
          }}
          error={error}
        />
      ) : (
        <Input
          label={t('auth.email') || 'Email'}
          placeholder={t('auth.emailPlaceholder') || 'Enter your email address'}
          required
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (error) setError(null);
            if (alertMessage) clearAlert();
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          leftIcon="mail"
          error={error}
        />
      )}

      <Button
        title={loading ? t('auth.sendingOtp') : t('auth.sendOtp')}
        onPress={handleSendOtp}
        loading={loading}
        disabled={loading || (method === 'phone' ? !phoneNumber.trim() : !email.trim())}
        style={styles.actionButton}
      />

      <TouchableOpacity
        style={styles.backLink}
        onPress={onGoBack || (() => navigation?.goBack())}
      >
        <View style={styles.backLinkRow}><Ionicons name="arrow-back" size={16} color={COLORS.primary} /><Text style={styles.backLinkText}>{t('auth.backToLogin')}</Text></View>
      </TouchableOpacity>
    </View>
  );

  const renderOtpStep = () => (
    <View style={styles.formContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.verifyAndReset')}</Text>
        <Text style={styles.subtitle}>
          {method === 'phone'
            ? t('auth.otpSentToPhone', { phone: maskedPhone })
            : (t('auth.otpSentToEmail', { email: maskedEmail }) || `OTP sent to ${maskedEmail}`)}
        </Text>
      </View>

      {/* Timer */}
      <View style={styles.timerContainer}>
        {secondsLeft > 0 ? (
          <View style={styles.timerBadge}>
            <Text style={styles.timerBadgeText}>{formatTime(secondsLeft)}</Text>
          </View>
        ) : (
          <View style={[styles.timerBadge, styles.timerBadgeExpired]}>
            <Text style={styles.timerExpiredText}>{t('auth.codeExpired')}</Text>
          </View>
        )}
      </View>

      {/* OTP Input */}
      <Text style={styles.inputLabel}>{t('auth.otpLabel')}</Text>
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (otpRefs.current[index] = ref)}
            style={[
              styles.otpInput,
              digit && styles.otpInputFilled,
              isExpired && styles.otpInputExpired,
            ]}
            value={digit}
            onChangeText={(text) => handleOtpChange(text, index)}
            onKeyPress={(e) => handleOtpKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={index === 0 ? OTP_LENGTH : 1}
            editable={!loading && !isExpired}
            selectTextOnFocus
            caretHidden={true}
            selectionColor="transparent"
          />
        ))}
      </View>

      {/* Resend OTP */}
      <View style={styles.resendRow}>
        {isExpired ? (
          <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
            <Text style={styles.resendProminentText}>
              {loading ? t('auth.sending') : t('auth.requestNewOtpBtn')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleResendOtp}
            disabled={!canResend || loading}
          >
            <Text
              style={[
                styles.resendText,
                (!canResend || loading) && styles.resendTextDisabled,
              ]}
            >
              {canResend ? t('auth.didntReceiveOtp') : t('auth.waitToResendDots')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* New Password */}
      <Input
        label={t('auth.newPassword')}
        placeholder={t('auth.newPasswordPlaceholder')}
        required
        value={newPassword}
        onChangeText={(text) => {
          setNewPassword(text);
          if (error) setError(null);
        }}
        secureTextEntry={!showPassword}
        rightIcon={showPassword ? 'eye-off' : 'eye'}
        onRightIconPress={() => setShowPassword(!showPassword)}
        error={error && error.toLowerCase().includes('password') && !error.includes('match') ? error : null}
        editable={!isExpired}
      />

      {/* Confirm Password */}
      <Input
        label={t('auth.confirmPassword')}
        placeholder={t('auth.confirmPasswordPlaceholder')}
        required
        value={confirmPassword}
        onChangeText={(text) => {
          setConfirmPassword(text);
          if (error) setError(null);
        }}
        secureTextEntry={!showConfirmPassword}
        rightIcon={showConfirmPassword ? 'eye-off' : 'eye'}
        onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
        error={error && error.includes('match') ? error : null}
        editable={!isExpired}
      />

      {/* Password requirements */}
      <View style={styles.passwordHints}>
        <Text style={styles.hintTitle}>{t('auth.passwordMust')}</Text>
        <Text style={[styles.hintText, newPassword.length >= 8 && styles.hintMet]}>
          {newPassword.length >= 8 ? '✓' : '•'} {t('auth.min8Chars')}
        </Text>
        <Text style={[styles.hintText, /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && styles.hintMet]}>
          {/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? '✓' : '•'} {t('auth.upperLower')}
        </Text>
        <Text style={[styles.hintText, /\d/.test(newPassword) && styles.hintMet]}>
          {/\d/.test(newPassword) ? '✓' : '•'} {t('auth.oneNumber')}
        </Text>
        <Text style={[styles.hintText, /[@$!%*?&]/.test(newPassword) && styles.hintMet]}>
          {/[@$!%*?&]/.test(newPassword) ? '✓' : '•'} {t('auth.oneSpecial')}
        </Text>
      </View>

      {/* Submit Button */}
      <Button
        title={loading ? t('auth.resetting') : isExpired ? t('auth.otpExpiredBtn') : t('auth.resetPassword')}
        onPress={handleResetPassword}
        loading={loading}
        disabled={loading || !otpComplete || !newPassword || !confirmPassword || isExpired}
        style={styles.actionButton}
      />

      {/* Back */}
      <TouchableOpacity style={styles.backLink} onPress={handleGoBack}>
        <View style={styles.backLinkRow}><Ionicons name="arrow-back" size={16} color={COLORS.primary} /><Text style={styles.backLinkText}>{t('common.back')}</Text></View>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Alert */}
          {alertMessage && (
            <Alert
              message={alertMessage}
              type={alertType}
              hint={alertHint}
              onDismiss={clearAlert}
              style={styles.alert}
            />
          )}

          {/* Logo */}
          <View style={styles.logoContainer}>
            <FixhomiLogo size={44} />
          </View>
          <Text style={styles.brandName}>FixHomi</Text>

          {/* Content */}
          {passwordResetSuccess
            ? renderSuccessState()
            : step === 1
              ? renderInputStep()
              : renderOtpStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ── Layout ──
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardAvoid: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  alert: { marginBottom: 16 },

  // ── Logo ──
  logoContainer: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center',
    overflow: 'hidden', marginTop: 16, marginBottom: 6,
    ...Platform.select({
      ios: { shadowColor: '#f67c16', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 5 },
    }),
  },
  brandName: { fontSize: 18, fontWeight: '800', color: '#f67c16', textAlign: 'center', marginBottom: 20, letterSpacing: 0.3 },

  // ── Form ──
  formContainer: { flex: 1 },

  // ── Method Toggle ──
  methodToggle: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 4, marginBottom: 20 },
  methodTab: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  methodTabActive: {
    backgroundColor: COLORS.white,
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  methodTabText: { fontSize: 14, fontWeight: '500', color: COLORS.textLight },
  methodTabTextActive: { color: COLORS.primary, fontWeight: '700' },

  // ── Header ──
  header: { marginBottom: 28 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  maskedValue: { fontWeight: '700', color: COLORS.text },
  inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  actionButton: { marginTop: 24 },

  // ── Back Link ──
  backLink: { alignItems: 'center', marginTop: 20, paddingVertical: 10 },
  backLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backLinkText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  // ── Timer ──
  timerContainer: { alignItems: 'center', marginBottom: 20 },
  timerBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  timerBadgeText: { fontSize: 17, fontWeight: '700', color: COLORS.primary, fontVariant: ['tabular-nums'] },
  timerBadgeExpired: { backgroundColor: '#FEF2F2' },
  timerExpiredText: { fontSize: 14, color: COLORS.error, fontWeight: '600' },

  // ── OTP ──
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 },
  otpInput: {
    width: 48, height: 56, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    fontSize: 22, fontWeight: '800', color: COLORS.text, backgroundColor: COLORS.surface, textAlign: 'center',
  },
  otpInputFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  otpInputExpired: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', color: '#94A3B8' },

  // ── Resend ──
  resendRow: { alignItems: 'center', marginBottom: 24 },
  resendText: { fontSize: 14, color: COLORS.primary, fontWeight: '500' },
  resendTextDisabled: { color: COLORS.textLight },
  resendProminentText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },

  // ── Password Hints ──
  passwordHints: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: COLORS.border },
  hintTitle: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  hintText: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 },
  hintMet: { color: COLORS.success },

  // ── Success ──
  successContainer: { flex: 1, alignItems: 'center', paddingTop: 24 },
  successIconContainer: {
    width: 88, height: 88, borderRadius: 22, backgroundColor: 'rgba(16,185,129,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  successMessage: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 16 },
});

export default ForgotPasswordScreen;
