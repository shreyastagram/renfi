/**
 * OTP Verify Screen
 *
 * Screen for entering and verifying OTP code.
 * Uses absolute timestamp for countdown so timer stays accurate
 * even when the app is minimized and resumed.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Alert, FixhomiLogo } from '../components';
import {
  verifyPhoneLoginOtp,
  verifyEmailLoginOtp,
  sendPhoneLoginOtp,
  sendEmailLoginOtp,
  getErrorMessage,
  AUTH_CODES,
} from '../services/authService';
import { useApp } from '../context/AppContext';

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
  onBack,
}) => {
  const { handleAuthSuccess } = useApp();

  // Get params from route or props
  const params = route?.params || {};
  const _method = method || params.method;
  const _identifier = identifier || params.identifier;
  const _maskedValue = maskedValue || params.maskedValue;
  const _expiresInMinutes = expiresInMinutes || params.expiresInMinutes;
  const _userType = userType || params.userType;

  // OTP input refs
  const inputRefs = useRef([]);

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
    const digit = value.replace(/[^0-9]/g, '');

    if (digit.length <= 1) {
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);
      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (digit.length > 1) {
      // Handle paste
      const digits = digit.slice(0, OTP_LENGTH).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < OTP_LENGTH) {
          newOtp[index + i] = d;
        }
      });
      setOtp(newOtp);
      const lastIndex = Math.min(index + digits.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIndex]?.focus();
    }
  };

  const handleKeyPress = (event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    try {
      clearAlert();
      const otpCode = otp.join('');

      if (otpCode.length !== OTP_LENGTH) {
        showAlert('Please enter the complete 6-digit OTP', 'warning');
        return;
      }

      if (secondsLeft <= 0) {
        showAlert('This OTP has expired. Please request a new one.', 'error');
        return;
      }

      setLoading(true);

      let result;
      if (_method === 'phone') {
        result = await verifyPhoneLoginOtp(_identifier, otpCode);
      } else {
        result = await verifyEmailLoginOtp(_identifier, otpCode);
      }

      if (result.success) {
        // Validate that the user's actual role matches the screen they're signing in from
        const backendRole = result.data?.role;
        const expectedRole = _userType === 'provider' ? 'SERVICE_PROVIDER' : 'USER';
        if (backendRole && backendRole !== expectedRole) {
          const correctScreen = backendRole === 'SERVICE_PROVIDER' ? 'provider' : 'user';
          showAlert(
            `This account is registered as a ${correctScreen}. Please sign in from the ${correctScreen} login screen.`,
            'error'
          );
          setLoading(false);
          return;
        }
        showAlert('Verified successfully!', 'success');
        const authData = { ...result.data, userType: _userType };
        const authProcessed = await handleAuthSuccess(authData);
        if (!authProcessed) {
          showAlert('Login successful but failed to save session.', 'warning');
        }
      } else {
        const { error } = result;
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();

        switch (error.code) {
          case AUTH_CODES.INVALID_OTP:
          case 'INVALID_OTP':
            showAlert(error.message || 'The OTP you entered is incorrect. Please check and try again.', 'error');
            break;
          case AUTH_CODES.OTP_EXPIRED:
            showAlert('This OTP has expired. Please request a new one.', 'error');
            setSecondsLeft(0);
            break;
          case AUTH_CODES.MAX_ATTEMPTS_EXCEEDED:
            showAlert('Too many incorrect attempts. Please request a new OTP.', 'error');
            setSecondsLeft(0);
            break;
          case AUTH_CODES.ACCOUNT_DISABLED:
            showAlert('Your account has been disabled. Please contact support.', 'error');
            break;
          case AUTH_CODES.USER_NOT_FOUND:
            showAlert(
              'No account found with this ' + (_method === 'phone' ? 'phone number' : 'email') + '.',
              'error',
            );
            break;
          default:
            showAlert(getErrorMessage(error.code, 'Verification failed. Please try again.'), 'error');
        }
      }
    } catch (error) {
      console.error('[OTPVerifyScreen] Unexpected error:', error);
      showAlert('Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      clearAlert();
      setResendLoading(true);

      let result;
      if (_method === 'phone') {
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
        showAlert('New OTP sent successfully!', 'success');
      } else {
        const msg = result.error?.message || 'Failed to resend OTP. Please try again.';
        showAlert(msg, 'error');
      }
    } catch (error) {
      console.error('[OTPVerifyScreen] Resend error:', error);
      showAlert('Failed to resend OTP. Please try again.', 'error');
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>{'<'} Back</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <FixhomiLogo size={44} />
          </View>
          <Text style={styles.brandName}>FixHomi</Text>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Enter OTP</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.maskedValue}>{_maskedValue}</Text>
            </Text>
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
                <Text style={styles.timerExpiredText}>Code expired</Text>
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
                  isExpired && styles.otpInputExpired,
                  loading && styles.otpInputDisabled,
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(event) => handleKeyPress(event, index)}
                keyboardType="number-pad"
                maxLength={index === 0 ? OTP_LENGTH : 1}
                editable={!loading && !isExpired}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Verify Button */}
          <Button
            title={loading ? 'Verifying...' : isExpired ? 'OTP Expired' : 'Verify OTP'}
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
                  {resendLoading ? 'Sending...' : 'Request New OTP'}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.resendText}>Didn't receive the code?</Text>
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
                    {resendLoading ? 'Sending...' : canResend ? 'Resend OTP' : 'Wait to resend'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.infoText}>
              Please check your {_method === 'phone' ? 'SMS messages' : 'email inbox'} for the OTP.
              {_method === 'email' && " Check your spam folder if you don't see it."}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
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
    marginBottom: 8,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f67c16',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
  },
  backButton: {
    marginBottom: 16,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '500',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  maskedValue: {
    fontWeight: '600',
    color: '#1F2937',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
    color: '#DC2626',
    fontWeight: '600',
  },
  alert: {
    marginBottom: 16,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  otpInputFilled: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  otpInputExpired: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    color: '#9CA3AF',
  },
  otpInputDisabled: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
  verifyButton: {
    marginBottom: 24,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginBottom: 32,
  },
  resendText: {
    fontSize: 14,
    color: '#6B7280',
  },
  resendLink: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: '#9CA3AF',
  },
  resendProminent: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  resendProminentText: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '600',
  },
  info: {
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default OTPVerifyScreen;
