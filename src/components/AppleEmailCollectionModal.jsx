/**
 * AppleEmailCollectionModal
 *
 * Modal that collects and verifies an email address when Apple Sign-In
 * does not provide one (user chose "Hide My Email" or subsequent sign-in).
 *
 * Two-step flow:
 *   1. EMAIL_INPUT  — user enters their email, taps "Send Verification Code"
 *   2. OTP_INPUT    — user enters the 6-digit OTP sent to their email
 *
 * On successful verification, calls onVerified(email, verificationToken).
 *
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Keyboard,
  Platform,
  Dimensions,
  Animated,
  KeyboardAvoidingView
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import { useLanguage } from '../context/LanguageContext';
import { sendAppleEmailOtp, verifyAppleEmailOtp } from '../services/appleAuthService';
import { parseApiError } from '../services/apiClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  primary: '#f67c16',
  primaryDark: '#e06b0a',
  white: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  success: '#10B981',
  successBg: '#ECFDF5',
  overlay: 'rgba(15, 23, 42, 0.55)',
  inputBg: '#F8FAFC',
  inputFocusBorder: '#f67c16',
  disabled: '#94A3B8',
  cardBg: '#FFFFFF',
};

const STEPS = {
  EMAIL_INPUT: 'EMAIL_INPUT',
  OTP_INPUT: 'OTP_INPUT',
};

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim());
};

const AppleEmailCollectionModal = ({ visible, appleUserId, onVerified, onCancel }) => {
  const { t } = useLanguage();

  // State
  const [step, setStep] = useState(STEPS.EMAIL_INPUT);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');

  // Refs
  const emailInputRef = useRef(null);
  const otpInputRefs = useRef([]);
  const countdownInterval = useRef(null);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Animation
  useEffect(() => {
    if (visible) {
      setStep(STEPS.EMAIL_INPUT);
      setEmail('');
      setOtp(Array(OTP_LENGTH).fill(''));
      setError('');
      setSuccessMessage('');
      setLoading(false);
      setCountdown(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-focus email input after modal opens
      setTimeout(() => emailInputRef.current?.focus(), 400);
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    }
  }, [visible]);

  // Countdown timer
  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  /**
   * Send OTP to the entered email
   */
  const handleSendOtp = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError(t('auth.emailRequired') || 'Email is required');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError(t('auth.validationFailedEmail') || 'Please enter a valid email address.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await sendAppleEmailOtp(trimmedEmail, appleUserId);
      setStep(STEPS.OTP_INPUT);
      startCountdown();
      // Auto-focus first OTP input
      setTimeout(() => otpInputRefs.current[0]?.focus(), 300);
    } catch (err) {
      const parsed = parseApiError(err);
      const serverMsg = err.response?.data?.message;
      setError(serverMsg || parsed.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resend OTP
   */
  const handleResendOtp = async () => {
    if (countdown > 0 || loading) return;

    setError('');
    setOtp(Array(OTP_LENGTH).fill(''));
    setLoading(true);

    try {
      await sendAppleEmailOtp(email.trim(), appleUserId);
      startCountdown();
      setSuccessMessage(t('auth.resendSuccess') || 'New code sent successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 300);
    } catch (err) {
      const parsed = parseApiError(err);
      const serverMsg = err.response?.data?.message;
      setError(serverMsg || parsed.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verify the OTP
   */
  const handleVerifyOtp = async (otpValue) => {
    const otpString = (otpValue || otp).join('');
    if (otpString.length !== OTP_LENGTH) {
      setError(t('auth.otpIncomplete') || 'Please enter the complete 6-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await verifyAppleEmailOtp(email.trim(), appleUserId, otpString);
      const verificationToken = result.verificationToken || result.token;

      if (!verificationToken) {
        setError('Verification succeeded but no token received. Please try again.');
        setLoading(false);
        return;
      }

      setSuccessMessage(t('auth.appleEmailVerified') || 'Email verified! Completing registration...');

      // Small delay so user sees success message
      setTimeout(() => {
        onVerified(email.trim(), verificationToken);
      }, 800);
    } catch (err) {
      const parsed = parseApiError(err);
      const serverMsg = err.response?.data?.message;
      const errorCode = err.response?.data?.code || err.response?.data?.validationErrors?.code;

      if (errorCode === 'INVALID_OTP' || errorCode === 'OTP_INVALID') {
        setError(t('auth.invalidOtp') || 'The code you entered is incorrect. Please check and try again.');
      } else if (errorCode === 'OTP_EXPIRED') {
        setError(t('auth.otpExpiredMsg') || 'This code has expired. Please request a new one.');
      } else if (errorCode === 'MAX_ATTEMPTS') {
        setError(t('auth.maxAttempts') || 'Too many incorrect attempts. Please request a new code.');
      } else {
        setError(serverMsg || parsed.message || 'Verification failed. Please try again.');
      }
      setLoading(false);
    }
  };

  /**
   * Handle OTP input change
   */
  const handleOtpChange = (text, index) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '');

    const newOtp = [...otp];

    if (digit.length > 1) {
      // Handle paste — fill as many boxes as possible
      const digits = digit.split('');
      for (let i = 0; i < OTP_LENGTH && i < digits.length; i++) {
        const targetIndex = index + i;
        if (targetIndex < OTP_LENGTH) {
          newOtp[targetIndex] = digits[i];
        }
      }
      setOtp(newOtp);

      const lastFilledIndex = Math.min(index + digits.length, OTP_LENGTH) - 1;
      if (lastFilledIndex < OTP_LENGTH - 1) {
        otpInputRefs.current[lastFilledIndex + 1]?.focus();
      } else {
        Keyboard.dismiss();
        // Auto-submit when all digits filled
        const fullOtp = newOtp.join('');
        if (fullOtp.length === OTP_LENGTH) {
          setTimeout(() => handleVerifyOtp(newOtp), 100);
        }
      }
    } else {
      newOtp[index] = digit;
      setOtp(newOtp);

      if (digit && index < OTP_LENGTH - 1) {
        otpInputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all digits filled
      const fullOtp = newOtp.join('');
      if (fullOtp.length === OTP_LENGTH && digit) {
        Keyboard.dismiss();
        setTimeout(() => handleVerifyOtp(newOtp), 100);
      }
    }

    // Clear error on input
    if (error) setError('');
  };

  /**
   * Handle backspace on OTP input
   */
  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Go back to email input step
   */
  const handleBackToEmail = () => {
    setStep(STEPS.EMAIL_INPUT);
    setOtp(Array(OTP_LENGTH).fill(''));
    setError('');
    setSuccessMessage('');
    setTimeout(() => emailInputRef.current?.focus(), 300);
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    onCancel();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={handleCancel}
        >
          <Animated.View
            style={[
              styles.card,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerIcon}>{'\uF8FF'}</Text>
                <Text style={styles.title}>
                  {step === STEPS.EMAIL_INPUT
                    ? (t('auth.appleEmailVerify') || 'Verify Your Email')
                    : (t('auth.enterOtp') || 'Enter OTP')}
                </Text>
                <Text style={styles.subtitle}>
                  {step === STEPS.EMAIL_INPUT
                    ? (t('auth.appleEmailRequired') || 'Please enter your email to complete Apple Sign-In')
                    : `${t('auth.appleEmailOtpSent') || 'Enter the verification code sent to'}\n${email.trim()}`}
                </Text>
              </View>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Success Message */}
              {successMessage ? (
                <View style={styles.successContainer}>
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              ) : null}

              {/* Step 1: Email Input */}
              {step === STEPS.EMAIL_INPUT && (
                <View style={styles.inputSection}>
                  <TextInput
                    ref={emailInputRef}
                    style={styles.emailInput}
                    placeholder={t('auth.appleEmailPlaceholder') || 'Enter your email address'}
                    placeholderTextColor={COLORS.disabled}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (error) setError('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    editable={!loading}
                    returnKeyType="send"
                    onSubmitEditing={handleSendOtp}
                  />

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                    onPress={handleSendOtp}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {t('auth.appleEmailSendOtp') || 'Send Verification Code'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 2: OTP Input */}
              {step === STEPS.OTP_INPUT && (
                <View style={styles.inputSection}>
                  <View style={styles.otpContainer}>
                    {Array(OTP_LENGTH).fill(0).map((_, index) => (
                      <TextInput
                        key={index}
                        ref={(ref) => { otpInputRefs.current[index] = ref; }}
                        style={[
                          styles.otpInput,
                          otp[index] ? styles.otpInputFilled : null,
                        ]}
                        value={otp[index]}
                        onChangeText={(text) => handleOtpChange(text, index)}
                        onKeyPress={(e) => handleOtpKeyPress(e, index)}
                        keyboardType="number-pad"
                        maxLength={index === 0 ? OTP_LENGTH : 1}
                        editable={!loading}
                        selectTextOnFocus
                        // This OTP arrives by EMAIL, not SMS. iOS reads mail
                        // codes via textContentType="oneTimeCode"; deliberately
                        // NO Android autoComplete="sms-otp" (there is no SMS).
                        textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                        importantForAutofill={index === 0 ? 'yes' : 'no'}
                      />
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                    onPress={() => handleVerifyOtp()}
                    disabled={loading || otp.join('').length !== OTP_LENGTH}
                    activeOpacity={0.7}
                  >
                    {loading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color={COLORS.white} />
                        <Text style={[styles.primaryButtonText, { marginLeft: 8 }]}>
                          {t('auth.appleEmailVerifying') || 'Verifying...'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {t('auth.verifyOtp') || 'Verify OTP'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Resend / Countdown */}
                  <View style={styles.resendRow}>
                    {countdown > 0 ? (
                      <Text style={styles.countdownText}>
                        {t('auth.appleEmailResend') || 'Resend Code'} ({countdown}s)
                      </Text>
                    ) : (
                      <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                        <Text style={[styles.linkText, loading && { opacity: 0.5 }]}>
                          {t('auth.appleEmailResend') || 'Resend Code'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Back to email */}
                  <TouchableOpacity onPress={handleBackToEmail} disabled={loading}>
                    <Text style={styles.backLink}>
                      {t('auth.useDifferentEmail') || 'Use a Different Email'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Cancel Button */}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>{t('common.cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 48, 380),
    backgroundColor: COLORS.cardBg,
    borderRadius: 22,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    fontSize: 36,
    marginBottom: 12,
    color: '#000000',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: COLORS.errorBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    textAlign: 'center',
    lineHeight: 18,
  },
  successContainer: {
    backgroundColor: COLORS.successBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    fontSize: 13,
    color: COLORS.success,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 8,
  },
  emailInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 16,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  otpInput: {
    flex: 1,
    height: 52,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF7ED',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  countdownText: {
    fontSize: 14,
    color: COLORS.disabled,
  },
  linkText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  backLink: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    textDecorationLine: 'underline',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 14,
    color: COLORS.disabled,
    fontWeight: '600',
  },
});

export default AppleEmailCollectionModal;
