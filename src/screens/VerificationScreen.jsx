/**
 * Verification Screen
 * 
 * Screen for verifying email or phone number after registration
 * Requires authentication (uses stored tokens)
 * Allows adding/editing phone or email if not set before verification
 * 
 * @version 1.1.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { Button, Alert } from '../components';
import { 
  sendPhoneVerificationOtp,
  verifyPhoneOtp,
  sendEmailVerification,
  getErrorMessage, 
  AUTH_CODES 
} from '../services/authService';
import { updateJavaAuthProfile } from '../services/profileService';
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
  const { user, profile, refreshVerificationStatus, updateProfileWithAutoSync } = useApp();

  // Get verificationType from route params (navigation) or props
  const verificationType = route?.params?.verificationType || 'phone';
  const isEmailVerification = verificationType === 'email';
  const forceReVerify = route?.params?.forceReVerify || false; // e.g., phone number changed

  // Check if already verified from current user state
  // If forceReVerify is true (phone changed after verification), bypass this check
  const isAlreadyVerified = forceReVerify 
    ? false 
    : (isEmailVerification ? user?.isEmailVerified : user?.isPhoneVerified);

  // Current value from user context
  const currentPhone = user?.phone || profile?.phone || '';
  const currentEmail = user?.email || profile?.email || '';
  const currentValue = isEmailVerification ? currentEmail : currentPhone;

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
  
  // Phone/email editing state
  const [isEditing, setIsEditing] = useState(!currentValue); // Auto-open edit if no value set
  const [editValue, setEditValue] = useState(currentValue);
  const [savingValue, setSavingValue] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  // Animations for OTP inputs
  const otpScales = useRef(Array(OTP_LENGTH).fill(null).map(() => new Animated.Value(1))).current;
  const otpBorderColors = useRef(Array(OTP_LENGTH).fill(null).map(() => new Animated.Value(0))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

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
   * Validate phone number format
   */
  const isValidPhone = (phone) => {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    // Accept 10-digit numbers or +91XXXXXXXXXX format
    return /^(\+91)?[6-9]\d{9}$/.test(cleaned) || /^[6-9]\d{9}$/.test(cleaned);
  };

  /**
   * Validate email format
   */
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim());
  };

  /**
   * Save phone/email to profile before verification
   * Updates Java Auth (where OTP is sent from) and MongoDB
   */
  const handleSaveValue = async () => {
    try {
      clearAlert();
      const trimmedValue = editValue?.trim();

      if (!trimmedValue) {
        showAlert(isEmailVerification ? 'Please enter your email address.' : 'Please enter your phone number.', 'warning');
        return;
      }

      if (!isEmailVerification && !isValidPhone(trimmedValue)) {
        showAlert('Please enter a valid 10-digit Indian phone number (starting with 6-9).', 'warning');
        return;
      }

      if (isEmailVerification && !isValidEmail(trimmedValue)) {
        showAlert('Please enter a valid email address.', 'warning');
        return;
      }

      setSavingValue(true);

      // Update Java Auth first (this is where OTP is sent from)
      const javaAuthUpdate = isEmailVerification 
        ? { email: trimmedValue }
        : { phoneNumber: trimmedValue };

      console.log(`📝 [VerificationScreen] Saving ${verificationType}:`, trimmedValue);
      
      const javaResult = await updateJavaAuthProfile(javaAuthUpdate);
      
      if (!javaResult.success) {
        console.error('❌ [VerificationScreen] Failed to update Java Auth:', javaResult.error);
        showAlert(javaResult.error?.message || `Failed to update ${verificationType}. Please try again.`, 'error');
        return;
      }

      // Also sync to MongoDB via profile update
      if (updateProfileWithAutoSync) {
        const mongoUpdate = isEmailVerification 
          ? { email: trimmedValue }
          : { phone: trimmedValue };
        
        await updateProfileWithAutoSync(mongoUpdate);
      }

      // Refresh verification status to get updated user data
      await refreshVerificationStatus();

      console.log(`✅ [VerificationScreen] ${verificationType} saved:`, trimmedValue);
      showAlert(`${isEmailVerification ? 'Email' : 'Phone number'} updated successfully! You can now send verification.`, 'success');
      setIsEditing(false);
    } catch (error) {
      console.error('❌ [VerificationScreen] Save error:', error);
      showAlert('Failed to save. Please try again.', 'error');
    } finally {
      setSavingValue(false);
    }
  };

  /**
   * Handle send verification (phone OTP or email link)
   * Now checks if phone/email is set before sending
   */
  const handleSendVerification = async () => {
    try {
      clearAlert();
      
      // Check if phone/email is set before trying to send
      const valueToVerify = isEmailVerification 
        ? (user?.email || profile?.email) 
        : (user?.phone || profile?.phone);
      
      if (!valueToVerify) {
        showAlert(
          isEmailVerification 
            ? 'Please add your email address first before requesting verification.'
            : 'Please add your phone number first before requesting verification.',
          'warning'
        );
        setIsEditing(true); // Open edit mode
        return;
      }
      
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
        
        // Check for rate limit (429) — code may come as 'TOO_MANY_REQUESTS' or 'Too Many Requests'
        const isRateLimited = error.status === 429 || 
          error.code === AUTH_CODES.TOO_MANY_REQUESTS || 
          error.code === 'Too Many Requests' ||
          (error.message || '').toLowerCase().includes('wait');
        
        if (isRateLimited) {
          // Extract remaining seconds from message: "Please wait N seconds before..."
          const msg = error.message || '';
          const secMatch = msg.match(/wait\s+(\d+)\s+seconds/i);
          const retrySec = secMatch 
            ? parseInt(secMatch[1], 10) 
            : (error.errors?.retryAfterSeconds ? parseInt(error.errors.retryAfterSeconds, 10) : null);
          
          if (retrySec && retrySec > 0) {
            const m = Math.floor(retrySec / 60);
            const s = retrySec % 60;
            const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
            showAlert(`Verification email already sent. Check your inbox (and spam). Retry in ${timeStr}.`, 'warning');
          } else {
            showAlert('Verification email already sent. Please check your inbox and spam folder, then wait a couple of minutes before retrying.', 'warning');
          }
        } else {
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
          <View style={styles.successIconContainer}>
            <View style={styles.successIconCircle}>
              <MaterialIcon name="check" size={48} color="#FFFFFF" />
            </View>
            <View style={styles.successIconRing} />
          </View>
          <Text style={styles.successTitle}>
            {isEmailVerification ? 'Email Verified!' : 'Phone Verified!'}
          </Text>
          <Text style={styles.successSubtitle}>
            Your {isEmailVerification ? 'email address' : 'phone number'} has been verified successfully.
          </Text>
          <TouchableOpacity
            style={styles.successBackButton}
            onPress={handleGoBack}
            activeOpacity={0.8}
          >
            <MaterialIcon name="arrow-back" size={20} color="#FFFFFF" />
            <Text style={styles.successBackButtonText}>Back to Profile</Text>
          </TouchableOpacity>
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
                {currentEmail 
                  ? 'Click the button below to receive a verification link at your email address.'
                  : 'Please add your email address first, then we\'ll send a verification link.'}
              </Text>
            </View>

            {/* Current email display / edit */}
            <View style={styles.valueCard}>
              {isEditing ? (
                <View style={styles.editContainer}>
                  <Text style={styles.editLabel}>Email Address</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editValue}
                    onChangeText={setEditValue}
                    placeholder="Enter your email address"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!savingValue}
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity 
                      style={styles.saveButton}
                      onPress={handleSaveValue}
                      disabled={savingValue}
                    >
                      {savingValue ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.saveButtonText}>Save Email</Text>
                      )}
                    </TouchableOpacity>
                    {currentEmail ? (
                      <TouchableOpacity 
                        style={styles.cancelButton}
                        onPress={() => {
                          setIsEditing(false);
                          setEditValue(currentEmail);
                        }}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={styles.displayContainer}>
                  <View style={styles.displayRow}>
                    <Text style={styles.displayLabel}>Email</Text>
                    <Text style={styles.displayValue}>{currentEmail || 'Not set'}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.editIcon}
                    onPress={() => {
                      setEditValue(currentEmail);
                      setIsEditing(true);
                    }}
                  >
                    <Text style={styles.editIconText}>✏️ Edit</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {!isEditing && (
              <Button
                title={sendLoading ? 'Sending...' : 'Send Verification Email'}
                onPress={handleSendVerification}
                loading={sendLoading}
                disabled={sendLoading || !currentEmail}
                style={styles.sendButton}
              />
            )}

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
                    {currentPhone 
                      ? 'We\'ll send a 6-digit verification code to your phone number.'
                      : 'Please add your phone number first, then we\'ll send a verification code.'}
                  </Text>
                </View>

                {/* Current phone display / edit */}
                <View style={styles.valueCard}>
                  {isEditing ? (
                    <View style={styles.editContainer}>
                      <Text style={styles.editLabel}>Phone Number</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        placeholder="Enter your 10-digit phone number"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                        maxLength={13}
                        editable={!savingValue}
                      />
                      <Text style={styles.editHint}>Indian phone number starting with 6-9</Text>
                      <View style={styles.editActions}>
                        <TouchableOpacity 
                          style={styles.saveButton}
                          onPress={handleSaveValue}
                          disabled={savingValue}
                        >
                          {savingValue ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.saveButtonText}>Save Phone</Text>
                          )}
                        </TouchableOpacity>
                        {currentPhone ? (
                          <TouchableOpacity 
                            style={styles.cancelButton}
                            onPress={() => {
                              setIsEditing(false);
                              setEditValue(currentPhone);
                            }}
                          >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.displayContainer}>
                      <View style={styles.displayRow}>
                        <Text style={styles.displayLabel}>Phone</Text>
                        <Text style={styles.displayValue}>{currentPhone || 'Not set'}</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.editIcon}
                        onPress={() => {
                          setEditValue(currentPhone);
                          setIsEditing(true);
                        }}
                      >
                        <Text style={styles.editIconText}>✏️ Edit</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {!isEditing && (
                  <Button
                    title={sendLoading ? 'Sending OTP...' : 'Send OTP'}
                    onPress={handleSendVerification}
                    loading={sendLoading}
                    disabled={sendLoading || !currentPhone}
                    style={styles.sendButton}
                  />
                )}
              </>
            ) : (
              <>
                {/* Timer */}
                <View style={styles.timerContainer}>
                  {countdown > 0 ? (
                    <View style={styles.timerPill}>
                      <MaterialIcon name="timer" size={16} color="#2563EB" />
                      <Text style={styles.timerText}>
                        Code expires in <Text style={styles.timerValue}>{formatTime(countdown)}</Text>
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.timerPill, { backgroundColor: '#FEF2F2' }]}>
                      <MaterialIcon name="error-outline" size={16} color="#DC2626" />
                      <Text style={styles.timerExpired}>Code expired</Text>
                    </View>
                  )}
                </View>

                {/* OTP Instruction */}
                <Text style={styles.otpInstruction}>
                  Enter the 6-digit code sent to your phone
                </Text>

                {/* OTP Input — Modern animated boxes */}
                <Animated.View style={[
                  styles.otpContainer,
                  { transform: [{ translateX: shakeAnim }] }
                ]}>
                  {otp.map((digit, index) => {
                    const isFocused = focusedIndex === index;
                    const isFilled = !!digit;
                    
                    return (
                      <Animated.View
                        key={index}
                        style={[
                          styles.otpInputWrapper,
                          isFilled && styles.otpInputWrapperFilled,
                          isFocused && styles.otpInputWrapperFocused,
                          { transform: [{ scale: otpScales[index] }] },
                        ]}
                      >
                        <TextInput
                          ref={(ref) => (inputRefs.current[index] = ref)}
                          style={[
                            styles.otpInput,
                            isFilled && styles.otpInputFilled,
                            isFocused && styles.otpInputFocused,
                            loading && styles.otpInputDisabled,
                          ]}
                          value={digit}
                          onChangeText={(value) => {
                            handleOtpChange(value, index);
                            // Pulse animation on fill
                            if (value) {
                              Animated.sequence([
                                Animated.timing(otpScales[index], { toValue: 1.1, duration: 100, useNativeDriver: true }),
                                Animated.spring(otpScales[index], { toValue: 1, friction: 3, useNativeDriver: true }),
                              ]).start();
                            }
                          }}
                          onKeyPress={(event) => handleKeyPress(event, index)}
                          onFocus={() => setFocusedIndex(index)}
                          onBlur={() => setFocusedIndex(-1)}
                          keyboardType="number-pad"
                          maxLength={index === 0 ? OTP_LENGTH : 1}
                          editable={!loading}
                          selectTextOnFocus
                        />
                        {isFocused && !digit && (
                          <Animated.View style={styles.otpCursor} />
                        )}
                      </Animated.View>
                    );
                  })}
                </Animated.View>

                {/* Verify Button — Full-width gradient style */}
                <TouchableOpacity
                  style={[
                    styles.verifyOtpButton,
                    (loading || otp.join('').length !== OTP_LENGTH) && styles.verifyOtpButtonDisabled,
                  ]}
                  onPress={() => {
                    if (otp.join('').length !== OTP_LENGTH) {
                      // Shake animation on incomplete OTP
                      Animated.sequence([
                        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
                      ]).start();
                      return;
                    }
                    handleVerifyOtp();
                  }}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <View style={styles.verifyOtpButtonContent}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.verifyOtpButtonText}>Verifying...</Text>
                    </View>
                  ) : (
                    <View style={styles.verifyOtpButtonContent}>
                      <MaterialIcon name="verified" size={20} color="#FFFFFF" />
                      <Text style={styles.verifyOtpButtonText}>Verify OTP</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Resend — Cleaner layout */}
                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>Didn't receive the code?</Text>
                  <TouchableOpacity
                    onPress={handleSendVerification}
                    disabled={!canResend || sendLoading || loading}
                    style={[
                      styles.resendButton,
                      (!canResend || sendLoading) && styles.resendButtonDisabled,
                    ]}
                  >
                    {sendLoading ? (
                      <ActivityIndicator size="small" color="#f67c16" />
                    ) : (
                      <>
                        <MaterialIcon name="refresh" size={16} color={(!canResend || sendLoading) ? '#9CA3AF' : '#f67c16'} />
                        <Text style={[
                          styles.resendLink,
                          (!canResend || sendLoading) && styles.resendLinkDisabled,
                        ]}>
                          Resend OTP
                        </Text>
                      </>
                    )}
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
              ? 'Check your spam folder if you don\'t see the email. You can edit your email above if needed.'
              : 'You can edit your phone number above if it\'s incorrect or not set.'
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
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 22,
  },
  emailSection: {
    marginBottom: 32,
  },
  phoneSection: {
    marginBottom: 32,
  },
  // Phone/Email value display & editing
  valueCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  displayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  displayRow: {
    flex: 1,
  },
  displayLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  displayValue: {
    fontSize: 17,
    color: '#1E293B',
    fontWeight: '600',
  },
  editIcon: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  editIconText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  editContainer: {
  },
  editLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    marginBottom: 6,
  },
  editHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#f67c16',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    shadowColor: '#f67c16',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  sendButton: {
    marginBottom: 16,
  },
  sentText: {
    fontSize: 14,
    color: '#059669',
    textAlign: 'center',
  },
  // Timer
  timerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  timerText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  timerValue: {
    color: '#2563EB',
    fontWeight: '700',
  },
  timerExpired: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  // OTP — Modern design
  otpInstruction: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
  },
  otpInputWrapper: {
    width: 52,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  otpInputWrapperFilled: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
    shadowColor: '#2563EB',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  otpInputWrapperFocused: {
    borderColor: '#f67c16',
    backgroundColor: '#FFFBF5',
    shadowColor: '#f67c16',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  otpInput: {
    width: '100%',
    height: '100%',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1E293B',
    padding: 0,
  },
  otpInputFilled: {
    color: '#2563EB',
  },
  otpInputFocused: {
    color: '#f67c16',
  },
  otpInputDisabled: {
    color: '#94A3B8',
  },
  otpCursor: {
    position: 'absolute',
    width: 2,
    height: 28,
    backgroundColor: '#f67c16',
    borderRadius: 1,
  },
  // Verify button — modern gradient style
  verifyOtpButton: {
    backgroundColor: '#f67c16',
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 24,
    shadowColor: '#f67c16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  verifyOtpButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyOtpButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  verifyOtpButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Resend
  resendContainer: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  resendText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
  },
  resendButtonDisabled: {
    backgroundColor: '#F1F5F9',
  },
  resendLink: {
    fontSize: 14,
    color: '#f67c16',
    fontWeight: '700',
  },
  resendLinkDisabled: {
    color: '#94A3B8',
  },
  // Skip
  skipButton: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 24,
  },
  skipText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  footer: {
    padding: 18,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  footerText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Success screen — Modern design
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  successIconRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#10B981',
    opacity: 0.2,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  successBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2563EB',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  successBackButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verifyButton: {
    marginBottom: 24,
  },
  backButton: {
    minWidth: 200,
  },
});

export default VerificationScreen;
