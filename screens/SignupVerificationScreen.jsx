/**
 * Signup Verification Screen
 * 
 * This screen handles OTP verification for both phone and email after user signup.
 * Flow: Signup → This Screen (verify phone + email) → Success Modal → Continue to App
 * 
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { sendOtp, verifyOtp, getErrorMessage } from '../src/api/authApi';

const { width } = Dimensions.get('window');

// OTP Input Component
const OtpInput = ({ value, onChange, disabled, error }) => {
  const inputRefs = useRef([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleChange = (text, index) => {
    const newOtp = value.split('');
    newOtp[index] = text.slice(-1); // Only take last character
    const newValue = newOtp.join('');
    onChange(newValue);

    // Auto-advance to next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.otpContainer}>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <TextInput
          key={index}
          ref={(ref) => (inputRefs.current[index] = ref)}
          style={[
            styles.otpInput,
            focusedIndex === index && styles.otpInputFocused,
            error && styles.otpInputError,
            value[index] && styles.otpInputFilled,
          ]}
          value={value[index] || ''}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          onFocus={() => setFocusedIndex(index)}
          keyboardType="number-pad"
          maxLength={1}
          editable={!disabled}
          selectTextOnFocus
        />
      ))}
    </View>
  );
};

// Success Modal Component
const SuccessModal = ({ visible, onContinue, userType }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(checkAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      checkAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.successModal,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Animated.View
            style={[
              styles.checkContainer,
              { opacity: checkAnim },
            ]}
          >
            <Text style={styles.checkMark}>✓</Text>
          </Animated.View>
          <Text style={styles.congratsTitle}>Congratulations! 🎉</Text>
          <Text style={styles.congratsSubtitle}>
            Your account has been verified successfully.
          </Text>
          <Text style={styles.congratsMessage}>
            Welcome to FixHomi! {userType === 'PROVIDER' ? 'Start offering your services today.' : 'Book services near you now.'}
          </Text>
          <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
            <Text style={styles.continueButtonText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const SignupVerificationScreen = ({ route, navigation }) => {
  // Get params from signup
  const { 
    phoneNumber, 
    email, 
    userData, 
    userType = 'USER',
    onVerificationComplete,
  } = route?.params || {};

  // Verification states
  const [step, setStep] = useState('phone'); // 'phone', 'email', 'complete'
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  
  // Status states
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  
  // Loading/Error states
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Timer states
  const [phoneResendTimer, setPhoneResendTimer] = useState(0);
  const [emailResendTimer, setEmailResendTimer] = useState(0);
  const [phoneExpiryTimer, setPhoneExpiryTimer] = useState(0);
  const [emailExpiryTimer, setEmailExpiryTimer] = useState(0);
  
  // Modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Send initial phone OTP on mount
  useEffect(() => {
    if (phoneNumber && step === 'phone' && !phoneVerified) {
      handleSendPhoneOtp();
    }
  }, []);

  // Resend timers
  useEffect(() => {
    let interval;
    if (phoneResendTimer > 0) {
      interval = setInterval(() => {
        setPhoneResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phoneResendTimer]);

  useEffect(() => {
    let interval;
    if (emailResendTimer > 0) {
      interval = setInterval(() => {
        setEmailResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [emailResendTimer]);

  // Expiry timers
  useEffect(() => {
    let interval;
    if (phoneExpiryTimer > 0) {
      interval = setInterval(() => {
        setPhoneExpiryTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phoneExpiryTimer]);

  useEffect(() => {
    let interval;
    if (emailExpiryTimer > 0) {
      interval = setInterval(() => {
        setEmailExpiryTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [emailExpiryTimer]);

  // Check if both verified
  useEffect(() => {
    if (phoneVerified && emailVerified) {
      setShowSuccessModal(true);
    }
  }, [phoneVerified, emailVerified]);

  const handleSendPhoneOtp = async () => {
    setSendingOtp(true);
    setError('');
    
    try {
      // Backend uses JWT to identify user - no phone number needed
      const result = await sendOtp();
      setPhoneExpiryTimer(result.expiresInSeconds || 300);
      setPhoneResendTimer(60);
      setSuccessMessage(`OTP sent to ${result.maskedPhone || maskPhoneNumber(phoneNumber)}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Send phone OTP error:', err);
      setError(err.message || getErrorMessage(err));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSendEmailOtp = async () => {
    if (!email) {
      // No email to verify, show skip option
      return;
    }
    
    setSendingOtp(true);
    setError('');
    
    try {
      // Backend sends email verification LINK, not OTP
      const { sendEmailVerification } = await import('../src/api/authApi');
      await sendEmailVerification(email);
      
      // Email verification link sent - user needs to check email
      setSuccessMessage(`Verification email sent to ${maskEmail(email)}. Please check your inbox and click the verification link.`);
      setEmailResendTimer(60);
      // Don't auto-verify - let user skip or verify via link
    } catch (err) {
      console.error('Send email verification error:', err);
      setError('Could not send verification email. You can skip for now.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (phoneOtp.length !== 6) {
      setError('Please enter 6-digit OTP');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Backend uses JWT - only OTP needed
      await verifyOtp(phoneOtp);
      setPhoneVerified(true);
      setSuccessMessage('Phone verified successfully! ✓');
      
      // Move to email verification
      setTimeout(() => {
        setStep('email');
        setSuccessMessage('');
        if (email) {
          handleSendEmailOtp();
        } else {
          // No email to verify, complete
          setEmailVerified(true);
        }
      }, 1500);
    } catch (err) {
      console.error('Verify phone OTP error:', err);
      setError(err.message || getErrorMessage(err));
      setPhoneOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    // Backend doesn't support email OTP - verification is via link
    // This function is kept for potential future use
    // For now, email is verified via the handleSendEmailOtp flow
    setEmailVerified(true);
    setSuccessMessage('Email verification in progress via link...');
  };

  const handleSkipEmail = () => {
    setEmailVerified(true);
  };

  const handleContinue = () => {
    setShowSuccessModal(false);
    
    // Call completion callback if provided
    if (onVerificationComplete) {
      onVerificationComplete(userData);
    }
    
    // Navigation will be handled by RootNavigator based on auth state
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const maskPhoneNumber = (phone) => {
    if (!phone || phone.length < 7) return phone;
    return phone.slice(0, 4) + '****' + phone.slice(-4);
  };

  const maskEmail = (email) => {
    if (!email || !email.includes('@')) return email;
    const [local, domain] = email.split('@');
    return local[0] + '***@' + domain;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Verify Your Account</Text>
          <Text style={styles.subtitle}>
            {step === 'phone' 
              ? 'Enter the OTP sent to your phone' 
              : 'Enter the OTP sent to your email'}
          </Text>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, phoneVerified && styles.progressDotComplete]}>
              {phoneVerified ? <Text style={styles.progressCheck}>✓</Text> : <Text style={styles.progressNumber}>1</Text>}
            </View>
            <Text style={styles.progressLabel}>Phone</Text>
          </View>
          <View style={[styles.progressLine, phoneVerified && styles.progressLineComplete]} />
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, emailVerified && styles.progressDotComplete]}>
              {emailVerified ? <Text style={styles.progressCheck}>✓</Text> : <Text style={styles.progressNumber}>2</Text>}
            </View>
            <Text style={styles.progressLabel}>Email</Text>
          </View>
        </View>

        {/* Phone Verification */}
        {step === 'phone' && (
          <View style={styles.verificationCard}>
            <Text style={styles.cardTitle}>📱 Phone Verification</Text>
            <Text style={styles.cardSubtitle}>
              OTP sent to {maskPhoneNumber(phoneNumber)}
            </Text>
            
            {phoneExpiryTimer > 0 && (
              <Text style={styles.expiryText}>
                OTP expires in {formatTime(phoneExpiryTimer)}
              </Text>
            )}

            <OtpInput
              value={phoneOtp}
              onChange={setPhoneOtp}
              disabled={loading}
              error={!!error}
            />

            {/* Resend Button */}
            <TouchableOpacity
              style={[styles.resendButton, phoneResendTimer > 0 && styles.resendButtonDisabled]}
              onPress={handleSendPhoneOtp}
              disabled={phoneResendTimer > 0 || sendingOtp}
            >
              {sendingOtp ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={[styles.resendText, phoneResendTimer > 0 && styles.resendTextDisabled]}>
                  {phoneResendTimer > 0 ? `Resend in ${phoneResendTimer}s` : 'Resend OTP'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.verifyButton, (phoneOtp.length !== 6 || loading) && styles.verifyButtonDisabled]}
              onPress={handleVerifyPhoneOtp}
              disabled={phoneOtp.length !== 6 || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Phone</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Email Verification */}
        {step === 'email' && (
          <View style={styles.verificationCard}>
            <Text style={styles.cardTitle}>📧 Email Verification</Text>
            <Text style={styles.cardSubtitle}>
              We've sent a verification link to {maskEmail(email)}
            </Text>
            
            <View style={styles.emailInstructions}>
              <Text style={styles.instructionText}>
                Please check your email inbox and click the verification link to verify your email address.
              </Text>
              <Text style={styles.instructionNote}>
                You can continue using the app and verify your email later.
              </Text>
            </View>

            {/* Resend Button */}
            <TouchableOpacity
              style={[styles.resendButton, emailResendTimer > 0 && styles.resendButtonDisabled]}
              onPress={handleSendEmailOtp}
              disabled={emailResendTimer > 0 || sendingOtp}
            >
              {sendingOtp ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={[styles.resendText, emailResendTimer > 0 && styles.resendTextDisabled]}>
                  {emailResendTimer > 0 ? `Resend email in ${emailResendTimer}s` : 'Resend Verification Email'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.verifyButton}
              onPress={handleSkipEmail}
            >
              <Text style={styles.verifyButtonText}>Continue to App</Text>
            </TouchableOpacity>

            {/* Skip Option */}
            <TouchableOpacity style={styles.skipButton} onPress={handleSkipEmail}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error/Success Messages */}
        {!!error && (
          <View style={styles.messageContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!!successMessage && (
          <View style={[styles.messageContainer, styles.successContainer]}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}
      </ScrollView>

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        onContinue={handleContinue}
        userType={userType}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotComplete: {
    backgroundColor: '#4CAF50',
  },
  progressNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  progressCheck: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  progressLine: {
    width: 60,
    height: 3,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  progressLineComplete: {
    backgroundColor: '#4CAF50',
  },
  verificationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  expiryText: {
    fontSize: 14,
    color: '#ff9800',
    textAlign: 'center',
    marginBottom: 16,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  otpInput: {
    width: (width - 120) / 6,
    height: 56,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#f9f9f9',
    color: '#1a1a1a',
  },
  otpInputFocused: {
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  otpInputError: {
    borderColor: '#ff4d4f',
  },
  otpInputFilled: {
    backgroundColor: '#e8f4fd',
    borderColor: '#007AFF',
  },
  resendButton: {
    alignSelf: 'center',
    padding: 12,
    marginBottom: 16,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: '#999',
  },
  verifyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: '#b0d4ff',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    alignSelf: 'center',
    padding: 16,
    marginTop: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
  messageContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#ffebee',
  },
  successContainer: {
    backgroundColor: '#e8f5e9',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
  successText: {
    color: '#2e7d32',
    fontSize: 14,
    textAlign: 'center',
  },
  emailInstructions: {
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  instructionNote: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: width - 48,
    alignItems: 'center',
  },
  checkContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkMark: {
    fontSize: 40,
    color: '#fff',
    fontWeight: 'bold',
  },
  congratsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  congratsSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  congratsMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default SignupVerificationScreen;
