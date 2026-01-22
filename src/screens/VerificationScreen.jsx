/**
 * Verification Screen
 * 
 * Screen for verifying email or phone number after registration
 * Requires authentication (uses stored tokens)
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Button, Alert } from '../components';
import { 
  sendPhoneVerificationOtp,
  verifyPhoneOtp,
  sendEmailVerification,
  getErrorMessage, 
  AUTH_CODES 
} from '../services/authService';
import { useApp } from '../context/AppContext';

const OTP_LENGTH = 6;

/**
 * VerificationScreen Component
 * 
 * @param {Object} props - Screen props
 */
const VerificationScreen = ({ 
  navigation,
  route,
  onVerificationComplete,
  onSkip,
}) => {
  const { user, refreshVerificationStatus } = useApp();

  // Get verificationType from route params (navigation) or props
  const verificationType = route?.params?.verificationType || 'phone';
  const isEmailVerification = verificationType === 'email';

  // Check if already verified from current user state
  const isAlreadyVerified = isEmailVerification 
    ? user?.isEmailVerified 
    : user?.isPhoneVerified;

  // OTP input refs (for phone verification)
  const inputRefs = useRef([]);
  
  // State
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [otpSent, setOtpSent] = useState(false);
  const [maskedValue, setMaskedValue] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [verified, setVerified] = useState(isAlreadyVerified || false); // Initialize with current status

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  /**
   * Format countdown time
   */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Show alert message
   */
  const showAlert = useCallback((message, type = 'error') => {
    setAlertMessage(message);
    setAlertType(type);
  }, []);

  /**
   * Clear alert message
   */
  const clearAlert = useCallback(() => {
    setAlertMessage(null);
  }, []);

  /**
   * Handle send verification (phone OTP or email link)
   */
  const handleSendVerification = async () => {
    try {
      clearAlert();
      setSendLoading(true);

      let result;
      if (isEmailVerification) {
        result = await sendEmailVerification();
      } else {
        result = await sendPhoneVerificationOtp();
      }

      if (result.success) {
        if (isEmailVerification) {
          setMaskedValue(result.maskedEmail || result.data?.maskedValue || 'your email');
          showAlert('Verification email sent! Please check your inbox.', 'success');
        } else {
          setMaskedValue(result.maskedPhone || result.data?.maskedValue || 'your phone');
          setOtpSent(true);
          setCountdown(5 * 60); // 5 minutes
          setCanResend(false);
          showAlert('OTP sent to ' + (result.maskedPhone || 'your phone'), 'success');
          
          // Focus first input
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
      } else {
        const { error } = result;
        
        // Check for "already verified" in error message
        const errorMsg = error.message?.toLowerCase() || '';
        if (errorMsg.includes('already verified')) {
          // Update verification status and show success
          await refreshVerificationStatus();
          setVerified(true);
          return;
        }
        
        switch (error.code) {
          case AUTH_CODES.TOO_MANY_REQUESTS:
            showAlert('Too many requests. Please wait before trying again.', 'warning');
            break;
            
          default:
            showAlert(error.message || 'Failed to send verification.', 'error');
        }
      }
    } catch (error) {
      console.error('❌ [VerificationScreen] Send error:', error);
      showAlert('An unexpected error occurred.', 'error');
    } finally {
      setSendLoading(false);
    }
  };

  /**
   * Handle OTP input change
   */
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

  /**
   * Handle key press
   */
  const handleKeyPress = (event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Handle phone OTP verification
   */
  const handleVerifyOtp = async () => {
    try {
      clearAlert();
      
      const otpCode = otp.join('');
      
      if (otpCode.length !== OTP_LENGTH) {
        showAlert('Please enter the complete OTP code', 'warning');
        return;
      }

      setLoading(true);

      const result = await verifyPhoneOtp(otpCode);

      if (result.success) {
        // Refresh verification status
        await refreshVerificationStatus();
        
        // Show success state
        setVerified(true);
        showAlert('Phone number verified successfully!', 'success');
        
        // Callback if provided
        if (onVerificationComplete) {
          onVerificationComplete();
        }
      } else {
        const { error } = result;
        
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        
        switch (error.code) {
          case AUTH_CODES.INVALID_OTP:
            showAlert('Invalid OTP code. Please check and try again.', 'error');
            break;
            
          case AUTH_CODES.OTP_EXPIRED:
            showAlert('OTP has expired. Please request a new one.', 'error');
            setOtpSent(false);
            break;
            
          case AUTH_CODES.MAX_ATTEMPTS_EXCEEDED:
            showAlert('Maximum attempts exceeded. Please request a new OTP.', 'error');
            setOtpSent(false);
            break;
            
          default:
            showAlert(error.message || 'Verification failed.', 'error');
        }
      }
    } catch (error) {
      console.error('❌ [VerificationScreen] Verify error:', error);
      showAlert('An unexpected error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle skip
   */
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  /**
   * Handle go back to profile/home
   */
  const handleGoBack = () => {
    if (navigation?.navigate) {
      navigation.navigate('Home');
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  // Show success screen after verification
  if (verified) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>
            {isEmailVerification ? 'Email Verified!' : 'Phone Verified!'}
          </Text>
          <Text style={styles.successSubtitle}>
            Your {isEmailVerification ? 'email address' : 'phone number'} has been verified successfully.
          </Text>
          <Button
            title="Back to Profile"
            onPress={handleGoBack}
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {isEmailVerification ? 'Verify Email' : 'Verify Phone'}
          </Text>
          <Text style={styles.subtitle}>
            {isEmailVerification 
              ? 'We\'ll send a verification link to your email address.'
              : 'We\'ll send a 6-digit OTP to your phone number.'
            }
          </Text>
        </View>

        {/* Alert */}
        {alertMessage && (
          <Alert
            type={alertType}
            message={alertMessage}
            onDismiss={clearAlert}
            style={styles.alert}
          />
        )}

        {/* Email Verification */}
        {isEmailVerification && (
          <View style={styles.emailSection}>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>📧 Email Verification</Text>
              <Text style={styles.infoDescription}>
                Click the button below to receive a verification link at your registered email address.
                Click the link in the email to verify your account.
              </Text>
            </View>

            <Button
              title={sendLoading ? 'Sending...' : 'Send Verification Email'}
              onPress={handleSendVerification}
              loading={sendLoading}
              disabled={sendLoading}
              style={styles.sendButton}
            />

            {maskedValue && (
              <Text style={styles.sentText}>
                Verification email sent to {maskedValue}
              </Text>
            )}
          </View>
        )}

        {/* Phone Verification */}
        {!isEmailVerification && (
          <View style={styles.phoneSection}>
            {!otpSent ? (
              <>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>📱 Phone Verification</Text>
                  <Text style={styles.infoDescription}>
                    We'll send a 6-digit verification code to your registered phone number.
                  </Text>
                </View>

                <Button
                  title={sendLoading ? 'Sending OTP...' : 'Send OTP'}
                  onPress={handleSendVerification}
                  loading={sendLoading}
                  disabled={sendLoading}
                  style={styles.sendButton}
                />
              </>
            ) : (
              <>
                {/* Timer */}
                <View style={styles.timerContainer}>
                  {countdown > 0 ? (
                    <Text style={styles.timerText}>
                      Code expires in <Text style={styles.timerValue}>{formatTime(countdown)}</Text>
                    </Text>
                  ) : (
                    <Text style={styles.timerExpired}>Code expired</Text>
                  )}
                </View>

                {/* OTP Input */}
                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => (inputRefs.current[index] = ref)}
                      style={[
                        styles.otpInput,
                        digit && styles.otpInputFilled,
                        loading && styles.otpInputDisabled,
                      ]}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                      onKeyPress={(event) => handleKeyPress(event, index)}
                      keyboardType="number-pad"
                      maxLength={index === 0 ? OTP_LENGTH : 1}
                      editable={!loading}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                <Button
                  title={loading ? 'Verifying...' : 'Verify OTP'}
                  onPress={handleVerifyOtp}
                  loading={loading}
                  disabled={loading || otp.join('').length !== OTP_LENGTH}
                  style={styles.verifyButton}
                />

                {/* Resend */}
                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>Didn't receive the code?</Text>
                  <TouchableOpacity
                    onPress={handleSendVerification}
                    disabled={!canResend || sendLoading || loading}
                  >
                    <Text style={[
                      styles.resendLink,
                      (!canResend || sendLoading) && styles.resendLinkDisabled,
                    ]}>
                      {sendLoading ? 'Sending...' : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* Skip Button */}
        <TouchableOpacity 
          style={styles.skipButton} 
          onPress={handleSkip}
          disabled={loading || sendLoading}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {isEmailVerification 
              ? 'Check your spam folder if you don\'t see the email.'
              : 'Make sure your phone number is correct in your profile.'
            }
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
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
  alert: {
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#F3F4F6',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  emailSection: {
    marginBottom: 32,
  },
  phoneSection: {
    marginBottom: 32,
  },
  sendButton: {
    marginBottom: 16,
  },
  sentText: {
    fontSize: 14,
    color: '#059669',
    textAlign: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  timerValue: {
    color: '#2563EB',
    fontWeight: '600',
  },
  timerExpired: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
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
  skipButton: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 24,
  },
  skipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  footerText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Success screen styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#16A34A',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  backButton: {
    minWidth: 200,
  },
});

export default VerificationScreen;
