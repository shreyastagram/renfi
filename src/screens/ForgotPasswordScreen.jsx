/**
 * Forgot Password Screen
 *
 * Password reset via phone OTP.
 * Step 1: Enter phone -> send OTP
 * Step 2: Enter OTP + new password -> reset
 *
 * Uses absolute timestamp for OTP countdown so timer
 * stays accurate even when app is minimized.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, PhoneInput, Alert, FixhomiLogo } from '../components';
import {
  forgotPasswordPhone,
  verifyOtpAndResetPassword,
  getErrorMessage,
  AUTH_CODES,
} from '../services/authService';
import { validatePhone, validatePassword } from '../utils/validation';

const COLORS = {
  primary: '#FF6B35',
  primaryLight: '#FFF0EB',
  background: '#FFFFFF',
  surface: '#F8F9FA',
  text: '#1A1A2E',
  textSecondary: '#6C757D',
  textLight: '#ADB5BD',
  border: '#E9ECEF',
  error: '#DC3545',
  success: '#28A745',
  white: '#FFFFFF',
};

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 30;

const ForgotPasswordScreen = ({ navigation, onGoBack }) => {
  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
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

  const validatePhoneInput = () => {
    if (!phoneNumber.trim()) {
      setError('Phone number is required');
      return false;
    }
    const phoneValidation = validatePhone(phoneNumber);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error);
      return false;
    }
    setError(null);
    return true;
  };

  const handleSendOtp = async () => {
    if (!validatePhoneInput()) return;

    try {
      setLoading(true);
      clearAlert();

      const result = await forgotPasswordPhone(phoneNumber.trim());

      if (result.success) {
        setMaskedPhone(result.maskedPhone || phoneNumber.replace(/(.{2})(.*)(.{4})/, '$1****$3'));
        setStep(2);

        // Start timer
        expiryTimeRef.current = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;
        resendCooldownRef.current = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
        setCanResend(false);
        setSecondsLeft(OTP_EXPIRY_MINUTES * 60);

        showAlert('OTP sent to your phone!', 'success');
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      } else {
        const errorCode = result.error?.code;
        const errorMsg = result.error?.message || '';

        if (errorMsg.includes('Google Sign-In')) {
          showAlert('This account uses Google Sign-In. No password to reset.', 'error');
        } else if (
          errorCode === AUTH_CODES.USER_NOT_FOUND ||
          errorMsg.includes('No account found')
        ) {
          showAlert('No account found with this phone number.', 'error');
        } else if (errorCode === AUTH_CODES.TOO_MANY_REQUESTS) {
          showAlert('Too many requests. Please wait before trying again.', 'warning');
        } else {
          showAlert(getErrorMessage(errorCode, errorMsg), 'error');
        }
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      showAlert('Something went wrong. Please try again.', 'error');
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
      setError('Passwords do not match');
      showAlert('Passwords do not match', 'error');
      return false;
    }
    setError(null);
    return true;
  };

  const handleResetPassword = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== OTP_LENGTH) {
      showAlert('Please enter the complete 6-digit OTP', 'warning');
      return;
    }

    if (secondsLeft <= 0) {
      showAlert('OTP has expired. Please request a new one.', 'error');
      return;
    }

    if (!validatePasswordInputs()) return;

    try {
      setLoading(true);
      clearAlert();

      const result = await verifyOtpAndResetPassword(phoneNumber.trim(), otpCode, newPassword);

      if (result.success) {
        setPasswordResetSuccess(true);
        showAlert('Password reset successfully!', 'success');
      } else {
        const errorCode = result.error?.code || '';

        if (errorCode === 'INVALID_OTP' || errorCode === AUTH_CODES.INVALID_OTP) {
          showAlert(result.error?.message || 'The OTP you entered is incorrect. Please check and try again.', 'error');
          setOtp(Array(OTP_LENGTH).fill(''));
          otpRefs.current[0]?.focus();
        } else if (errorCode === AUTH_CODES.OTP_EXPIRED) {
          showAlert('This OTP has expired. Please request a new one.', 'error');
          setSecondsLeft(0);
        } else if (errorCode === AUTH_CODES.MAX_ATTEMPTS_EXCEEDED) {
          showAlert('Too many incorrect attempts. Please request a new OTP.', 'error');
          setSecondsLeft(0);
        } else {
          showAlert(getErrorMessage(errorCode, 'Password reset failed. Please try again.'), 'error');
        }
      }
    } catch (err) {
      console.error('Reset password error:', err);
      showAlert('Something went wrong. Please try again.', 'error');
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
      const result = await forgotPasswordPhone(phoneNumber.trim());

      if (result.success) {
        // Reset timers
        expiryTimeRef.current = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;
        resendCooldownRef.current = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
        setSecondsLeft(OTP_EXPIRY_MINUTES * 60);

        showAlert('New OTP sent!', 'success');
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      } else {
        setCanResend(true);
        showAlert(result.error?.message || 'Failed to resend OTP.', 'error');
      }
    } catch (err) {
      setCanResend(true);
      showAlert('Failed to resend OTP. Please try again.', 'error');
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
        <Text style={styles.successIcon}>✅</Text>
      </View>
      <Text style={styles.successTitle}>Password Reset!</Text>
      <Text style={styles.successMessage}>
        Your password has been reset successfully.{'\n'}
        You can now login with your new password.
      </Text>
      <Button
        title="Back to Login"
        onPress={onGoBack || (() => navigation?.goBack())}
        style={styles.actionButton}
      />
    </View>
  );

  const renderPhoneStep = () => (
    <View style={styles.formContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>
          Enter your registered phone number and we'll send you an OTP to reset your password.
        </Text>
      </View>

      <PhoneInput
        label="Phone Number"
        required
        value={phoneNumber}
        onChangeText={(text) => {
          setPhoneNumber(text);
          if (error) setError(null);
          if (alertMessage) clearAlert();
        }}
        error={error}
      />

      <Button
        title={loading ? 'Sending OTP...' : 'Send OTP'}
        onPress={handleSendOtp}
        loading={loading}
        disabled={loading || !phoneNumber.trim()}
        style={styles.actionButton}
      />

      <TouchableOpacity
        style={styles.backLink}
        onPress={onGoBack || (() => navigation?.goBack())}
      >
        <Text style={styles.backLinkText}>{'<'} Back to Login</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOtpStep = () => (
    <View style={styles.formContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Verify & Reset</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit OTP sent to{' '}
          <Text style={styles.maskedValue}>{maskedPhone}</Text>
          {' '}and set your new password.
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
            <Text style={styles.timerExpiredText}>OTP expired</Text>
          </View>
        )}
      </View>

      {/* OTP Input */}
      <Text style={styles.inputLabel}>Enter OTP</Text>
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
          />
        ))}
      </View>

      {/* Resend OTP */}
      <View style={styles.resendRow}>
        {isExpired ? (
          <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
            <Text style={styles.resendProminentText}>
              {loading ? 'Sending...' : 'Request New OTP'}
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
              {canResend ? "Didn't receive OTP? Resend" : 'Wait to resend...'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* New Password */}
      <Input
        label="New Password"
        placeholder="Enter new password"
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
        label="Confirm Password"
        placeholder="Confirm new password"
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
        <Text style={styles.hintTitle}>Password must contain:</Text>
        <Text style={[styles.hintText, newPassword.length >= 8 && styles.hintMet]}>
          {newPassword.length >= 8 ? '✓' : '•'} At least 8 characters
        </Text>
        <Text style={[styles.hintText, /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && styles.hintMet]}>
          {/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? '✓' : '•'} Uppercase & lowercase letters
        </Text>
        <Text style={[styles.hintText, /\d/.test(newPassword) && styles.hintMet]}>
          {/\d/.test(newPassword) ? '✓' : '•'} At least one number
        </Text>
        <Text style={[styles.hintText, /[@$!%*?&]/.test(newPassword) && styles.hintMet]}>
          {/[@$!%*?&]/.test(newPassword) ? '✓' : '•'} At least one special character (@$!%*?&)
        </Text>
      </View>

      {/* Submit Button */}
      <Button
        title={loading ? 'Resetting...' : isExpired ? 'OTP Expired' : 'Reset Password'}
        onPress={handleResetPassword}
        loading={loading}
        disabled={loading || !otpComplete || !newPassword || !confirmPassword || isExpired}
        style={styles.actionButton}
      />

      {/* Back */}
      <TouchableOpacity style={styles.backLink} onPress={handleGoBack}>
        <Text style={styles.backLinkText}>{'<'} Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              ? renderPhoneStep()
              : renderOtpStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  alert: {
    marginBottom: 16,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#f67c16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#f67c1615',
    marginTop: 20,
    marginBottom: 8,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f67c16',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1,
  },

  formContainer: {
    flex: 1,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  maskedValue: {
    fontWeight: '600',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  actionButton: {
    marginTop: 24,
  },
  backLink: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 12,
  },
  backLinkText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },

  // Timer
  timerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timerBadgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
    fontVariant: ['tabular-nums'],
  },
  timerBadgeExpired: {
    backgroundColor: '#FEF2F2',
  },
  timerExpiredText: {
    fontSize: 14,
    color: COLORS.error,
    fontWeight: '600',
  },

  // OTP
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  otpInputExpired: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    color: '#9CA3AF',
  },

  // Resend
  resendRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: COLORS.textLight,
  },
  resendProminentText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Password hints
  passwordHints: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  hintTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  hintText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  hintMet: {
    color: COLORS.success,
  },

  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 48,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
});

export default ForgotPasswordScreen;
