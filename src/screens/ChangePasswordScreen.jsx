/**
 * Change Password Screen
 * 
 * Allows authenticated users to change or set their password
 * Part of the Password Management flow (Phase 1)
 * 
 * Requirements:
 * - User must be logged in
 * - OAuth users (no password) can set a new password without current password
 * - Users with password must provide current password
 * 
 * @version 1.1.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Alert } from '../components';
import { 
  changePassword, 
  getErrorMessage, 
  AUTH_CODES,
  forgotPasswordPhone,
  verifyOtpAndResetPassword,
} from '../services/authService';
import { validatePassword } from '../utils/validation';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

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
 * ChangePasswordScreen Component
 * 
 * @param {Object} props - Navigation props
 */
const ChangePasswordScreen = ({ navigation, onGoBack, onSuccess }) => {
  const { user, profile, refreshVerificationStatus } = useApp();
  const { t } = useLanguage();

  // Determine if user has a password (OAuth users don't)
  const [hasPassword, setHasPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Forgot password flow state
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Check if user has password from profile
  useEffect(() => {
    const checkPasswordStatus = () => {
      // hasPassword comes from Java Auth /api/users/me response
      const userHasPassword = profile?.hasPassword ?? user?.hasPassword ?? true;
      setHasPassword(userHasPassword);
      setInitialLoading(false);
    };
    checkPasswordStatus();
  }, [profile, user]);
  
  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Form state
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // UI state
  const [errors, setErrors] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [alertHint, setAlertHint] = useState(null);
  const [changeComplete, setChangeComplete] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
   * Update form field
   */
  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
    if (alertMessage) {
      clearAlert();
    }
  }, [errors, alertMessage, clearAlert]);

  /**
   * Validate form
   */
  const validateForm = () => {
    const newErrors = {};

    // Validate current password (only required if user has one)
    if (hasPassword && !formData.currentPassword) {
      newErrors.currentPassword = t('changePassword.currentRequired');
    }

    // Validate new password
    const passwordValidation = validatePassword(formData.newPassword);
    if (!passwordValidation.isValid) {
      newErrors.newPassword = passwordValidation.error;
    }

    // Check if new password is same as current (only if user has password)
    if (hasPassword && formData.newPassword && formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = t('changePassword.sameAsCurrent');
    }

    // Validate confirm password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('changePassword.confirmRequired');
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t('changePassword.noMatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle submit
   */
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      clearAlert();

      // For OAuth users setting first password, pass empty string for currentPassword
      const currentPwd = hasPassword ? formData.currentPassword : '';
      const result = await changePassword(currentPwd, formData.newPassword);

      if (result.success) {
        setChangeComplete(true);
        setHasPassword(true); // User now has a password
        const successMsg = hasPassword ? t('changePassword.alertChanged') : t('changePassword.alertSet');
        showAlert(successMsg, 'success');
        
        // Refresh profile from Java Auth so hasPassword is persisted in AppContext
        refreshVerificationStatus().catch(() => {});
        
        // Clear form
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });

        // Call success callback if provided
        if (onSuccess) {
          setTimeout(() => onSuccess(), 2000);
        }
      } else {
        const errorCode = result.error?.code;
        const errorMessage = getErrorMessage(errorCode, result.error?.message);
        
        if (errorCode === AUTH_CODES.INVALID_CURRENT_PASSWORD || 
            errorCode === 'INVALID_CURRENT_PASSWORD') {
          setErrors({ currentPassword: t('changePassword.currentIncorrect') });
        } else if (errorCode === AUTH_CODES.SAME_PASSWORD ||
                   errorCode === 'SAME_PASSWORD') {
          setErrors({ newPassword: t('changePassword.sameAsCurrent') });
        } else if (errorCode === AUTH_CODES.WEAK_PASSWORD) {
          setErrors({ newPassword: t('auth.weakPassword') });
        } else {
          showAlert(errorMessage);
        }
      }
    } catch (err) {
      console.error('❌ Change password error:', err);
      showAlert(t('common.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle forgot password - send OTP to phone
   */
  const handleForgotPassword = async () => {
    const phoneNumber = profile?.phone || user?.phone || user?.phoneNumber;

    if (!phoneNumber) {
      showAlert(t('changePassword.noPhone'));
      return;
    }

    try {
      setOtpLoading(true);
      clearAlert();

      const result = await forgotPasswordPhone(phoneNumber);

      if (result.success) {
        setOtpSent(true);
        setResendCountdown(60); // 60 second cooldown
        showAlert(t('changePassword.alertOtpSent'), 'success');
      } else {
        showAlert(result.error?.message || t('changePassword.otpSendFailed'));
      }
    } catch (err) {
      console.error('❌ Forgot password error:', err);
      showAlert(t('changePassword.otpSendFailed'));
    } finally {
      setOtpLoading(false);
    }
  };

  /**
   * Handle OTP verification and password reset
   */
  const handleVerifyOtpAndReset = async () => {
    if (otp.length !== 6) {
      showAlert(t('changePassword.invalidOtp'));
      return;
    }

    const passwordValidation = validatePassword(formData.newPassword);
    if (!passwordValidation.isValid) {
      setErrors({ newPassword: passwordValidation.error });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setErrors({ confirmPassword: t('changePassword.noMatch') });
      return;
    }

    const phoneNumber = profile?.phone || user?.phone || user?.phoneNumber;

    try {
      setLoading(true);
      clearAlert();

      const result = await verifyOtpAndResetPassword(phoneNumber, otp, formData.newPassword);

      if (result.success) {
        setChangeComplete(true);
        setHasPassword(true);
        showAlert(t('changePassword.alertReset'), 'success');
        
        // Refresh profile from Java Auth so hasPassword is persisted in AppContext
        refreshVerificationStatus().catch(() => {});
        
        // Clear form and reset state
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setOtp('');
        setOtpSent(false);
        setForgotPasswordMode(false);

        if (onSuccess) {
          setTimeout(() => onSuccess(), 2000);
        }
      } else {
        const errorCode = result.error?.code || '';

        if (errorCode === 'INVALID_OTP' || errorCode === AUTH_CODES.INVALID_OTP) {
          showAlert(t('changePassword.otpIncorrect'));
        } else if (errorCode === AUTH_CODES.OTP_EXPIRED) {
          showAlert(t('changePassword.otpExpired'));
        } else if (errorCode === AUTH_CODES.MAX_ATTEMPTS_EXCEEDED) {
          showAlert(t('changePassword.maxAttempts'));
        } else {
          showAlert(getErrorMessage(errorCode, t('changePassword.resetFailed')));
        }
      }
    } catch (err) {
      console.error('❌ Reset password error:', err);
      showAlert(t('changePassword.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Switch to forgot password mode
   */
  const enterForgotPasswordMode = () => {
    setForgotPasswordMode(true);
    setOtpSent(false);
    setOtp('');
    clearAlert();
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setErrors({});
  };

  /**
   * Exit forgot password mode
   */
  const exitForgotPasswordMode = () => {
    setForgotPasswordMode(false);
    setOtpSent(false);
    setOtp('');
    clearAlert();
    setErrors({});
  };

  /**
   * Handle back navigation
   */
  const handleGoBack = () => {
    if (onGoBack) {
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
      
      <Text style={styles.successTitle}>{hasPassword ? t('changePassword.passwordChanged') : t('changePassword.passwordSet')}</Text>

      <Text style={styles.successMessage}>
        {hasPassword ? t('changePassword.changedMsg') : t('changePassword.setMsg')}
      </Text>

      <Button
        title={t('common.done')}
        onPress={handleGoBack}
        style={styles.doneButton}
      />
    </View>
  );

  /**
   * Render loading state
   */
  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>{t('common.loading')}</Text>
    </View>
  );

  /**
   * Render forgot password mode (OTP verification flow)
   */
  const renderForgotPasswordMode = () => {
    const phoneNumber = profile?.phone || user?.phone || user?.phoneNumber;
    const maskedPhone = phoneNumber 
      ? `****${phoneNumber.slice(-4)}` 
      : 'your registered number';

    return (
      <View style={styles.formContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('changePassword.resetPassword')}</Text>
          <Text style={styles.subtitle}>
            {otpSent
              ? t('changePassword.otpSentSub', { phone: maskedPhone })
              : t('changePassword.otpNotSentSub', { phone: maskedPhone })
            }
          </Text>
        </View>

        {!otpSent ? (
          // Step 1: Send OTP
          <>
            <View style={styles.phoneInfoContainer}>
              <Text style={styles.phoneInfoLabel}>{t('changePassword.registeredPhone')}</Text>
              <Text style={styles.phoneInfoValue}>{maskedPhone}</Text>
            </View>

            <Button
              title={t('changePassword.sendOtp')}
              onPress={handleForgotPassword}
              loading={otpLoading}
              disabled={otpLoading || !phoneNumber}
              style={styles.submitButton}
            />

            {!phoneNumber && (
              <Text style={styles.noPhoneWarning}>
                {t('changePassword.noPhoneWarning')}
              </Text>
            )}
          </>
        ) : (
          // Step 2: Verify OTP and set new password
          <>
            {/* OTP Input */}
            <View style={styles.otpContainer}>
              <Text style={styles.otpLabel}>{t('changePassword.enterOtpLabel')}</Text>
              <View style={styles.otpInputContainer}>
                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
              
              {/* Resend OTP */}
              <TouchableOpacity 
                style={styles.resendButton}
                onPress={handleForgotPassword}
                disabled={resendCountdown > 0 || otpLoading}
              >
                <Text style={[
                  styles.resendText, 
                  (resendCountdown > 0 || otpLoading) && styles.resendTextDisabled
                ]}>
                  {resendCountdown > 0
                    ? t('changePassword.resendOtpIn', { n: resendCountdown })
                    : t('changePassword.resendOtp')
                  }
                </Text>
              </TouchableOpacity>
            </View>

            {/* New Password Input */}
            <Input
              label={t('changePassword.newPasswordLabel')}
              placeholder={t('changePassword.newPasswordPlaceholder')}
              value={formData.newPassword}
              onChangeText={(text) => updateField('newPassword', text)}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
              error={errors.newPassword}
              leftIcon="lock"
              rightIcon={showNewPassword ? 'eye-off' : 'eye'}
              onRightIconPress={() => setShowNewPassword(!showNewPassword)}
            />

            {/* Confirm New Password Input */}
            <Input
              label={t('changePassword.confirmLabel')}
              placeholder={t('changePassword.confirmPlaceholder')}
              value={formData.confirmPassword}
              onChangeText={(text) => updateField('confirmPassword', text)}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              error={errors.confirmPassword}
              leftIcon="lock"
              rightIcon={showConfirmPassword ? 'eye-off' : 'eye'}
              onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
            />

            {/* Password Requirements */}
            <View style={styles.requirementsContainer}>
              <Text style={styles.requirementsTitle}>{t('changePassword.passwordMust')}</Text>
              <PasswordRequirement
                met={formData.newPassword.length >= 8}
                text={t('changePassword.be8Chars')}
              />
              <PasswordRequirement
                met={/[A-Z]/.test(formData.newPassword)}
                text={t('changePassword.containUppercase')}
              />
              <PasswordRequirement
                met={/[a-z]/.test(formData.newPassword)}
                text={t('changePassword.containLowercase')}
              />
              <PasswordRequirement
                met={/[0-9]/.test(formData.newPassword)}
                text={t('changePassword.containNumber')}
              />
            </View>

            {/* Submit Button */}
            <Button
              title={t('changePassword.resetPasswordBtn')}
              onPress={handleVerifyOtpAndReset}
              loading={loading}
              disabled={loading || otp.length !== 6 || !formData.newPassword || !formData.confirmPassword}
              style={styles.submitButton}
            />
          </>
        )}

        {/* Back to Change Password */}
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={exitForgotPasswordMode}
        >
          <Text style={styles.cancelButtonText}>{`← ${t('changePassword.backToChange')}`}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * Render form state
   */
  const renderFormState = () => (
    <View style={styles.formContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{hasPassword ? t('changePassword.title') : t('changePassword.setPassword')}</Text>
        <Text style={styles.subtitle}>
          {hasPassword
            ? t('changePassword.changeSub')
            : t('changePassword.setSub')
          }
        </Text>
      </View>

      {/* Current Password Input - Only show if user has password */}
      {hasPassword && (
        <>
          <Input
            label={t('changePassword.currentPassword')}
            placeholder={t('changePassword.currentPasswordPlaceholder')}
            value={formData.currentPassword}
            onChangeText={(text) => updateField('currentPassword', text)}
            secureTextEntry={!showCurrentPassword}
            autoCapitalize="none"
            error={errors.currentPassword}
            leftIcon="lock"
            rightIcon={showCurrentPassword ? 'eye-off' : 'eye'}
            onRightIconPress={() => setShowCurrentPassword(!showCurrentPassword)}
          />
          
          {/* Forgot Password Link */}
          <TouchableOpacity 
            style={styles.forgotPasswordLink}
            onPress={enterForgotPasswordMode}
          >
            <Text style={styles.forgotPasswordText}>{t('changePassword.forgotPassword')}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('changePassword.newPasswordDivider')}</Text>
            <View style={styles.dividerLine} />
          </View>
        </>
      )}

      {/* New Password Input */}
      <Input
        label={t('changePassword.newPasswordLabel')}
        placeholder={t('changePassword.newPasswordPlaceholder')}
        value={formData.newPassword}
        onChangeText={(text) => updateField('newPassword', text)}
        secureTextEntry={!showNewPassword}
        autoCapitalize="none"
        error={errors.newPassword}
        leftIcon="lock"
        rightIcon={showNewPassword ? 'eye-off' : 'eye'}
        onRightIconPress={() => setShowNewPassword(!showNewPassword)}
      />

      {/* Confirm New Password Input */}
      <Input
        label={t('changePassword.confirmLabel')}
        placeholder={t('changePassword.confirmPlaceholder')}
        value={formData.confirmPassword}
        onChangeText={(text) => updateField('confirmPassword', text)}
        secureTextEntry={!showConfirmPassword}
        autoCapitalize="none"
        error={errors.confirmPassword}
        leftIcon="lock"
        rightIcon={showConfirmPassword ? 'eye-off' : 'eye'}
        onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
      />

      {/* Password Requirements */}
      <View style={styles.requirementsContainer}>
        <Text style={styles.requirementsTitle}>{t('changePassword.passwordMust')}</Text>
        <PasswordRequirement
          met={formData.newPassword.length >= 8}
          text={t('changePassword.be8Chars')}
        />
        <PasswordRequirement
          met={/[A-Z]/.test(formData.newPassword)}
          text={t('changePassword.containUppercase')}
        />
        <PasswordRequirement
          met={/[a-z]/.test(formData.newPassword)}
          text={t('changePassword.containLowercase')}
        />
        <PasswordRequirement
          met={/[0-9]/.test(formData.newPassword)}
          text={t('changePassword.containNumber')}
        />
        {hasPassword && (
          <PasswordRequirement
            met={formData.newPassword !== formData.currentPassword && formData.newPassword.length > 0}
            text={t('changePassword.beDifferent')}
          />
        )}
      </View>

      {/* Submit Button */}
      <Button
        title={hasPassword ? t('changePassword.changePasswordBtn') : t('changePassword.setPasswordBtn')}
        onPress={handleSubmit}
        loading={loading}
        disabled={loading || (hasPassword && !formData.currentPassword) || !formData.newPassword || !formData.confirmPassword}
        style={styles.submitButton}
      />

      {/* Cancel */}
      <TouchableOpacity 
        style={styles.cancelButton}
        onPress={handleGoBack}
      >
        <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
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
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleGoBack}
          >
            <Text style={styles.backButtonText}>{`← ${t('common.back')}`}</Text>
          </TouchableOpacity>

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

          {/* Content */}
          {initialLoading 
            ? renderLoadingState() 
            : changeComplete 
              ? renderSuccessState() 
              : forgotPasswordMode 
                ? renderForgotPasswordMode()
                : renderFormState()
          }

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/**
 * Password Requirement Indicator Component
 */
const PasswordRequirement = ({ met, text }) => (
  <View style={styles.requirement}>
    <Text style={[styles.requirementIcon, met && styles.requirementMet]}>
      {met ? '✓' : '○'}
    </Text>
    <Text style={[styles.requirementText, met && styles.requirementTextMet]}>
      {text}
    </Text>
  </View>
);

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
  backButton: {
    marginBottom: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
  alert: {
    marginBottom: 16,
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
  
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    paddingHorizontal: 16,
    fontWeight: '500',
  },
  
  // Password Requirements
  requirementsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementIcon: {
    fontSize: 14,
    color: COLORS.textLight,
    marginRight: 8,
    width: 16,
  },
  requirementMet: {
    color: COLORS.success,
  },
  requirementText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  requirementTextMet: {
    color: COLORS.text,
  },
  
  submitButton: {
    marginTop: 16,
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  // Success Container
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
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
    color: COLORS.success,
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  doneButton: {
    width: '100%',
  },
  
  // Loading Container
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  
  // Forgot Password Link
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  
  // Phone Info
  phoneInfoContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  phoneInfoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  phoneInfoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  noPhoneWarning: {
    fontSize: 13,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  
  // OTP Styles
  otpContainer: {
    marginBottom: 20,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  otpInputContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  otpInput: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 8,
    paddingVertical: 12,
  },
  resendButton: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: COLORS.textLight,
  },
});

export default ChangePasswordScreen;
