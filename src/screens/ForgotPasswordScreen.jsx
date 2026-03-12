/**
 * Forgot Password Screen
 * 
 * Allows users to reset password via phone OTP
 * Part of the Password Management flow
 * 
 * Flow:
 * 1. User enters phone number
 * 2. Backend sends OTP to phone via SMS
 * 3. User enters OTP and new password
 * 4. Password is reset
 * 
 * @version 2.0.0 - Updated to use phone OTP instead of email
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Alert, FixhomiLogo } from '../components';
import { 
  forgotPasswordPhone, 
  verifyOtpAndResetPassword, 
  getErrorMessage, 
  AUTH_CODES 
} from '../services/authService';
import { validatePhone, validatePassword } from '../utils/validation';

// Colors
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

/**
 * ForgotPasswordScreen Component
 * 
 * @param {Object} props - Navigation props
 */
const ForgotPasswordScreen = ({ navigation, onGoBack }) => {
  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI state
  const [step, setStep] = useState(1); // 1 = phone, 2 = OTP + password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [alertHint, setAlertHint] = useState(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  // OTP input refs
  const otpRefs = useRef([]);

  /**
   * Show alert message
   */
  const showAlert = useCallback((message, type = 'error', hint = null) => {
    setAlertMessage(message);
    setAlertType(type);
    setAlertHint(hint);
  }, []);

  /**
   * Clear alert message
   */
  const clearAlert = useCallback(() => {
    setAlertMessage(null);
    setAlertHint(null);
  }, []);

  /**
   * Validate phone number
   */
  const validatePhoneInput = () => {
    const phoneValidation = validatePhone(phoneNumber);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error);
      return false;
    }
    setError(null);
    return true;
  };

  /**
   * Handle send OTP
   */
  const handleSendOtp = async () => {
    if (!validatePhoneInput()) return;

    try {
      setLoading(true);
      clearAlert();

      const result = await forgotPasswordPhone(phoneNumber.trim());

      if (result.success) {
        setMaskedPhone(result.maskedPhone || phoneNumber.replace(/(.{2})(.*)(.{4})/, '$1****$3'));
        setStep(2);
        showAlert('OTP sent successfully to your phone!', 'success');
      } else {
        const errorCode = result.error?.code;
        const errorMessage = getErrorMessage(errorCode, result.error?.message);
        
        // Special handling for user not found
        if (errorCode === AUTH_CODES.USER_NOT_FOUND || 
            result.error?.message?.includes('No account found')) {
          showAlert('No account found with this phone number.');
        } else if (result.error?.message?.includes('Google Sign-In')) {
          showAlert('This account uses Google Sign-In. No password to reset.');
        } else {
          showAlert(errorMessage);
        }
      }
    } catch (err) {
      console.error('❌ Send OTP error:', err);
      showAlert('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle OTP input change
   */
  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  /**
   * Handle OTP key press (for backspace)
   */
  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Validate password
   */
  const validatePasswordInputs = () => {
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error);
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    setError(null);
    return true;
  };

  /**
   * Handle reset password
   */
  const handleResetPassword = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      showAlert('Please enter the 6-digit OTP');
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
          showAlert('The OTP you entered is incorrect. Please check and try again.');
          setOtp(['', '', '', '', '', '']);
        } else if (errorCode === AUTH_CODES.OTP_EXPIRED) {
          showAlert('This OTP has expired. Please request a new one.');
          setStep(1);
          setOtp(['', '', '', '', '', '']);
        } else if (errorCode === AUTH_CODES.MAX_ATTEMPTS_EXCEEDED) {
          showAlert('Too many attempts. Please request a new OTP.');
          setStep(1);
          setOtp(['', '', '', '', '', '']);
        } else {
          showAlert(getErrorMessage(errorCode, 'Password reset failed. Please try again.'));
        }
      }
    } catch (err) {
      console.error('❌ Reset password error:', err);
      showAlert('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle resend OTP
   */
  const handleResendOtp = async () => {
    setOtp(['', '', '', '', '', '']);
    await handleSendOtp();
  };

  /**
   * Handle back navigation
   */
  const handleGoBack = () => {
    if (step === 2 && !passwordResetSuccess) {
      setStep(1);
      setOtp(['', '', '', '', '', '']);
      clearAlert();
    } else if (onGoBack) {
      onGoBack();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  /**
   * Render success state
   */
  const renderSuccessState = () => (
    <View style={styles.successContainer}>
      {/* Success Icon */}
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
        style={styles.backButton}
      />
    </View>
  );

  /**
   * Render Step 1: Phone number input
   */
  const renderPhoneStep = () => (
    <View style={styles.formContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>
          No worries! Enter your phone number and we'll send you an OTP to reset your password.
        </Text>
      </View>

      {/* Phone Input */}
      <Input
        label="Phone Number"
        placeholder="Enter your phone number"
        required
        value={phoneNumber}
        onChangeText={(text) => {
          setPhoneNumber(text);
          if (error) setError(null);
          if (alertMessage) clearAlert();
        }}
        keyboardType="phone-pad"
        autoCapitalize="none"
        error={error}
        leftIcon="phone"
      />

      {/* Submit Button */}
      <Button
        title="Send OTP"
        onPress={handleSendOtp}
        loading={loading}
        disabled={loading || !phoneNumber.trim()}
        style={styles.submitButton}
      />

      {/* Back to Login */}
      <TouchableOpacity 
        style={styles.backLink}
        onPress={onGoBack || (() => navigation?.goBack())}
      >
        <Text style={styles.backLinkText}>
          ← Back to Login
        </Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render Step 2: OTP + New Password
   */
  const renderOtpStep = () => (
    <View style={styles.formContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Verify & Reset</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit OTP sent to {maskedPhone} and set your new password.
        </Text>
      </View>

      {/* OTP Input */}
      <Text style={styles.inputLabel}>Enter OTP</Text>
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (otpRefs.current[index] = ref)}
            style={[styles.otpInput, digit && styles.otpInputFilled]}
            value={digit}
            onChangeText={(text) => handleOtpChange(text.replace(/[^0-9]/g, '').slice(-1), index)}
            onKeyPress={(e) => handleOtpKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
          />
        ))}
      </View>

      {/* Resend OTP */}
      <TouchableOpacity onPress={handleResendOtp} style={styles.resendLink}>
        <Text style={styles.resendText}>Didn't receive OTP? Resend</Text>
      </TouchableOpacity>

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
        error={error && error.includes('password') ? error : null}
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
      />

      {/* Password requirements */}
      <View style={styles.passwordHints}>
        <Text style={styles.hintTitle}>Password must contain:</Text>
        <Text style={styles.hintText}>• At least 8 characters</Text>
        <Text style={styles.hintText}>• Uppercase & lowercase letters</Text>
        <Text style={styles.hintText}>• At least one number</Text>
        <Text style={styles.hintText}>• At least one special character (@$!%*?&)</Text>
      </View>

      {/* Submit Button */}
      <Button
        title="Reset Password"
        onPress={handleResetPassword}
        loading={loading}
        disabled={loading || otp.join('').length !== 6 || !newPassword || !confirmPassword}
        style={styles.submitButton}
      />

      {/* Back */}
      <TouchableOpacity 
        style={styles.backLink}
        onPress={handleGoBack}
      >
        <Text style={styles.backLinkText}>
          ← Back
        </Text>
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
            <FixhomiLogo size={80} />
          </View>

          {/* Content based on state */}
          {passwordResetSuccess 
            ? renderSuccessState() 
            : step === 1 
              ? renderPhoneStep() 
              : renderOtpStep()
          }

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
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  
  // Form Container
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  submitButton: {
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

  // OTP Container
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
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  resendLink: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
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

  // Success Container
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
  backButton: {
    width: '100%',
  },
});

export default ForgotPasswordScreen;
