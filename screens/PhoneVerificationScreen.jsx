/**
 * Phone Verification Screen
 * 
 * Handles phone number verification via OTP
 * JARBAC Integration:
 * - POST /api/verification/otp/send
 * - POST /api/verification/otp/verify
 * 
 * OTP Settings:
 * - Expires in: 5 minutes (300 seconds)
 * - Max attempts: 3
 * - Rate limit: 1 request per minute
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  sendOtp,
  verifyOtp,
  resendOtp,
  validatePhoneNumber,
  getErrorMessage,
} from '../src/api/authApi';

// ============================================================================
// OTP Input Component
// ============================================================================

const OtpInput = ({ value, onChange, disabled }) => {
  const inputRefs = useRef([]);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);

  useEffect(() => {
    // Sync external value to internal digits
    if (value) {
      const digits = value.split('').slice(0, 6);
      const padded = [...digits, ...Array(6 - digits.length).fill('')];
      setOtpDigits(padded);
    } else {
      setOtpDigits(['', '', '', '', '', '']);
    }
  }, [value]);

  const handleChange = (text, index) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    
    // Notify parent
    onChange(newDigits.join(''));
    
    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace - move to previous input
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (text) => {
    // Handle paste of full OTP
    const digits = text.replace(/[^0-9]/g, '').slice(0, 6).split('');
    const padded = [...digits, ...Array(6 - digits.length).fill('')];
    setOtpDigits(padded);
    onChange(padded.join(''));
    
    // Focus last filled input or first empty
    const lastFilledIndex = digits.length - 1;
    if (lastFilledIndex >= 0 && lastFilledIndex < 5) {
      inputRefs.current[lastFilledIndex + 1]?.focus();
    }
  };

  return (
    <View style={styles.otpContainer}>
      {otpDigits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => (inputRefs.current[index] = ref)}
          style={[
            styles.otpInput,
            digit ? styles.otpInputFilled : null,
            disabled ? styles.otpInputDisabled : null,
          ]}
          value={digit}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={1}
          editable={!disabled}
          selectTextOnFocus
          onFocus={() => {
            // Select all on focus for easy replacement
            if (digit) {
              inputRefs.current[index]?.setSelection(0, 1);
            }
          }}
        />
      ))}
    </View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const PhoneVerificationScreen = ({ route, navigation }) => {
  // Get phone number from route params or state
  const initialPhone = route?.params?.phoneNumber || '';
  
  // State
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(initialPhone ? 'verify' : 'enter_phone'); // 'enter_phone', 'verify'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Timer state for resend
  const [resendTimer, setResendTimer] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  
  // Refs
  const timerRef = useRef(null);
  const expiryRef = useRef(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (expiryRef.current) clearInterval(expiryRef.current);
    };
  }, []);

  // Start resend countdown
  const startResendTimer = (seconds = 60) => {
    setResendTimer(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Start OTP expiry countdown
  const startExpiryTimer = (seconds = 300) => {
    setOtpExpiresIn(seconds);
    if (expiryRef.current) clearInterval(expiryRef.current);
    
    expiryRef.current = setInterval(() => {
      setOtpExpiresIn((prev) => {
        if (prev <= 1) {
          clearInterval(expiryRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle send OTP
  const handleSendOtp = async () => {
    setError('');
    setSuccess('');
    
    // Validate phone
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await sendOtp(validation.formatted);
      
      setPhoneNumber(result.phoneNumber);
      setSuccess(result.message);
      setStep('verify');
      
      // Start timers
      startResendTimer(60);
      startExpiryTimer(result.expiresInSeconds || 300);
      
    } catch (err) {
      console.error('Send OTP error:', err);
      
      if (err.isRateLimitError) {
        setError(err.message);
        startResendTimer(err.retryAfterSeconds || 60);
      } else if (err.isValidationError) {
        setError(err.message);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle verify OTP
  const handleVerifyOtp = async () => {
    setError('');
    setSuccess('');
    
    // Validate OTP
    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await verifyOtp(phoneNumber, otp);
      
      if (result.phoneVerified) {
        setSuccess('Phone number verified successfully!');
        
        // Clear timers
        if (timerRef.current) clearInterval(timerRef.current);
        if (expiryRef.current) clearInterval(expiryRef.current);
        
        // Callback or navigation after successful verification
        if (route?.params?.onVerified) {
          route.params.onVerified(phoneNumber);
        }
        
        // Navigate back or to next screen after delay
        setTimeout(() => {
          if (route?.params?.returnScreen) {
            navigation.navigate(route.params.returnScreen, {
              phoneVerified: true,
              phoneNumber: phoneNumber,
            });
          } else {
            navigation.goBack();
          }
        }, 1500);
      } else {
        setError('Verification failed. Please try again.');
      }
      
    } catch (err) {
      console.error('Verify OTP error:', err);
      
      if (err.isExpiredError) {
        setError(err.message);
        setOtpExpiresIn(0);
      } else if (err.isMaxAttemptsError) {
        setError(err.message);
        // Reset to allow requesting new OTP
        setOtp('');
      } else if (err.isInvalidOtpError) {
        setError(err.message);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    
    setError('');
    setSuccess('');
    setOtp('');
    setLoading(true);
    
    try {
      const result = await resendOtp(phoneNumber);
      
      setSuccess('New OTP sent successfully!');
      startResendTimer(60);
      startExpiryTimer(result.expiresInSeconds || 300);
      
    } catch (err) {
      console.error('Resend OTP error:', err);
      
      if (err.isRateLimitError) {
        setError(err.message);
        startResendTimer(err.retryAfterSeconds || 60);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle change phone number
  const handleChangePhone = () => {
    setStep('enter_phone');
    setOtp('');
    setError('');
    setSuccess('');
    setOtpExpiresIn(0);
    if (timerRef.current) clearInterval(timerRef.current);
    if (expiryRef.current) clearInterval(expiryRef.current);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.title}>
          {step === 'enter_phone' ? 'Verify Phone Number' : 'Enter OTP'}
        </Text>
        
        <Text style={styles.subtitle}>
          {step === 'enter_phone'
            ? 'We will send you a 6-digit verification code'
            : `Enter the code sent to ${phoneNumber}`}
        </Text>

        {/* Phone Input Step */}
        {step === 'enter_phone' && (
          <View style={styles.inputSection}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="+91 XXXXXXXXXX"
              placeholderTextColor="#999"
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                setError('');
              }}
              keyboardType="phone-pad"
              autoFocus
              editable={!loading}
            />
            <Text style={styles.hint}>
              Include country code (e.g., +91 for India)
            </Text>
          </View>
        )}

        {/* OTP Input Step */}
        {step === 'verify' && (
          <View style={styles.inputSection}>
            <OtpInput
              value={otp}
              onChange={(value) => {
                setOtp(value);
                setError('');
              }}
              disabled={loading}
            />
            
            {/* Expiry Timer */}
            {otpExpiresIn > 0 && (
              <Text style={styles.expiryText}>
                OTP expires in {formatTime(otpExpiresIn)}
              </Text>
            )}
            {otpExpiresIn === 0 && step === 'verify' && (
              <Text style={styles.expiredText}>
                OTP has expired. Please request a new one.
              </Text>
            )}
          </View>
        )}

        {/* Error Message */}
        {!!error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Success Message */}
        {!!success && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonSection}>
          {step === 'enter_phone' ? (
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.button,
                  (loading || otp.length !== 6 || otpExpiresIn === 0) && styles.buttonDisabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={loading || otp.length !== 6 || otpExpiresIn === 0}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify OTP</Text>
                )}
              </TouchableOpacity>

              {/* Resend Section */}
              <View style={styles.resendSection}>
                <Text style={styles.resendText}>Didn't receive the code?</Text>
                {resendTimer > 0 ? (
                  <Text style={styles.resendTimerText}>
                    Resend in {formatTime(resendTimer)}
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Change Phone */}
              <TouchableOpacity
                style={styles.changePhoneButton}
                onPress={handleChangePhone}
                disabled={loading}
              >
                <Text style={styles.changePhoneText}>Change Phone Number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  phoneInput: {
    height: 56,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#1a1a1a',
    backgroundColor: '#f9f9f9',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1a1a1a',
    backgroundColor: '#f9f9f9',
  },
  otpInputFilled: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0fff0',
  },
  otpInputDisabled: {
    backgroundColor: '#eee',
    color: '#999',
  },
  expiryText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  expiredText: {
    fontSize: 14,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: '#2e7d32',
    fontSize: 14,
    textAlign: 'center',
  },
  buttonSection: {
    marginTop: 16,
  },
  button: {
    height: 56,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resendSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 8,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
  },
  resendTimerText: {
    fontSize: 14,
    color: '#999',
  },
  resendLink: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  changePhoneButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  changePhoneText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
});

export default PhoneVerificationScreen;
