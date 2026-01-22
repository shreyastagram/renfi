/**
 * OTP Verify Screen
 * 
 * Screen for entering and verifying OTP code
 * Used for both phone and email OTP verification
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Button, Alert } from '../components';
import { 
  verifyPhoneLoginOtp, 
  verifyEmailLoginOtp,
  sendPhoneLoginOtp,
  sendEmailLoginOtp,
  getErrorMessage, 
  AUTH_CODES 
} from '../services/authService';
import { useApp } from '../context/AppContext';

const OTP_LENGTH = 6;

/**
 * OTPVerifyScreen Component
 * 
 * @param {Object} props - Screen props
 */
const OTPVerifyScreen = ({ 
  route, 
  navigation,
  // These can be passed directly or via route.params
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
  
  // State
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [countdown, setCountdown] = useState(_expiresInMinutes * 60);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  // Enable resend after 30 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setCanResend(true);
    }, 30000);
    return () => clearTimeout(timer);
  }, []);

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
   * Handle OTP input change
   */
  const handleOtpChange = (value, index) => {
    clearAlert();
    
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '');
    
    if (digit.length <= 1) {
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);
      
      // Move to next input
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
      
      // Focus last filled or next empty
      const lastIndex = Math.min(index + digits.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIndex]?.focus();
    }
  };

  /**
   * Handle key press (for backspace)
   */
  const handleKeyPress = (event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Handle OTP verification
   */
  const handleVerify = async () => {
    try {
      clearAlert();
      
      const otpCode = otp.join('');
      
      if (otpCode.length !== OTP_LENGTH) {
        showAlert('Please enter the complete OTP code', 'warning');
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
        showAlert('OTP verified successfully!', 'success');
        
        // Add userType to auth data
        const authData = {
          ...result.data,
          userType: _userType,
        };
        
        const authProcessed = await handleAuthSuccess(authData);
        
        if (!authProcessed) {
          showAlert('Login successful but failed to save session.', 'warning');
        }
        // Navigation will happen automatically when isAuthenticated changes
      } else {
        const { error } = result;
        
        // Clear OTP on error
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        
        switch (error.code) {
          case AUTH_CODES.INVALID_OTP:
            showAlert('Invalid OTP code. Please check and try again.', 'error');
            break;
            
          case AUTH_CODES.OTP_EXPIRED:
            showAlert('OTP has expired. Please request a new one.', 'error');
            break;
            
          case AUTH_CODES.MAX_ATTEMPTS_EXCEEDED:
            showAlert('Maximum attempts exceeded. Please request a new OTP.', 'error');
            break;
            
          case AUTH_CODES.ACCOUNT_DISABLED:
            showAlert('Your account has been disabled. Please contact support.', 'error');
            break;
            
          default:
            showAlert(error.message || 'Verification failed. Please try again.', 'error');
        }
      }
    } catch (error) {
      console.error('❌ [OTPVerifyScreen] Unexpected error:', error);
      showAlert('An unexpected error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle resend OTP
   */
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
        // Reset countdown
        setCountdown(_expiresInMinutes * 60);
        setCanResend(false);
        
        // Clear OTP
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        
        showAlert('New OTP sent successfully!', 'success');
        
        // Enable resend after 30 seconds
        setTimeout(() => setCanResend(true), 30000);
      } else {
        showAlert(result.error?.message || 'Failed to resend OTP.', 'error');
      }
    } catch (error) {
      console.error('❌ [OTPVerifyScreen] Resend error:', error);
      showAlert('Failed to resend OTP. Please try again.', 'error');
    } finally {
      setResendLoading(false);
    }
  };

  /**
   * Handle back navigation
   */
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

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
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Enter OTP</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to {_maskedValue}
            </Text>
          </View>

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

          {/* Alert */}
          {alertMessage && (
            <Alert
              type={alertType}
              message={alertMessage}
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

          {/* Verify Button */}
          <Button
            title={loading ? 'Verifying...' : 'Verify OTP'}
            onPress={handleVerify}
            loading={loading}
            disabled={loading || otp.join('').length !== OTP_LENGTH}
            style={styles.verifyButton}
          />

          {/* Resend */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code?</Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={!canResend || resendLoading || loading}
            >
              <Text style={[
                styles.resendLink,
                (!canResend || resendLoading) && styles.resendLinkDisabled,
              ]}>
                {resendLoading ? 'Sending...' : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.infoText}>
              Please check your {_method === 'phone' ? 'SMS messages' : 'email inbox'} for the OTP.
              {_method === 'email' && ' Check your spam folder if you don\'t see it.'}
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
  backButton: {
    marginBottom: 16,
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
