/**
 * Reset Password Screen
 * 
 * Allows users to set a new password using the reset token from email
 * Part of the Password Management flow (Phase 1)
 * 
 * This screen is opened when:
 * 1. User clicks the reset link in email
 * 2. Deep link: fixhomi://auth/reset-password?token=xxx
 * 
 * Flow:
 * 1. Extract token from deep link
 * 2. Validate token with backend
 * 3. User enters new password
 * 4. Submit new password
 * 5. Redirect to login
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Alert, FixhomiLogo } from '../components';
import { 
  validateResetToken, 
  resetPassword, 
  getErrorMessage, 
  AUTH_CODES 
} from '../services/authService';
import { validatePassword } from '../utils/validation';
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
 * ResetPasswordScreen Component
 * 
 * @param {Object} props - Navigation and route props
 * @param {string} props.token - Reset token from deep link (required)
 */
const ResetPasswordScreen = ({ navigation, route, token: propToken, onGoToLogin }) => {
  const { t } = useLanguage();

  // Extract token from props or route params
  const token = propToken || route?.params?.token;

  // Form state
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [errors, setErrors] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [alertHint, setAlertHint] = useState(null);
  const [resetComplete, setResetComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /**
   * Validate the reset token on mount
   */
  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        setValidating(false);
        setIsTokenValid(false);
        showAlert(t('auth.invalidResetLink'));
        return;
      }

      try {
        setValidating(true);
        console.log('🔍 Validating reset token...');

        const result = await validateResetToken(token);

        if (result.success && result.isValid) {
          setIsTokenValid(true);
          console.log('✅ Reset token is valid');
        } else {
          setIsTokenValid(false);
          const errorCode = result.error?.code;
          if (errorCode === AUTH_CODES.RESET_TOKEN_EXPIRED ||
              errorCode === 'RESET_TOKEN_EXPIRED' ||
              result.error?.message?.includes('expired')) {
            showAlert(t('auth.expiredResetLink'));
          } else {
            showAlert(t('auth.invalidResetLink'));
          }
        }
      } catch (err) {
        console.error('❌ Token validation error:', err);
        setIsTokenValid(false);
        showAlert(t('auth.unableToValidate'));
      } finally {
        setValidating(false);
      }
    };

    checkToken();
  }, [token]);

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

    // Validate password
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.error;
    }

    // Validate confirm password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.confirmPasswordRequired');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordsNoMatch');
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

      const result = await resetPassword(token, formData.password);

      if (result.success) {
        setResetComplete(true);
        showAlert(t('auth.passwordResetDone'), 'success');
      } else {
        const errorCode = result.error?.code;
        const errorMessage = getErrorMessage(errorCode, result.error?.message);

        if (errorCode === AUTH_CODES.WEAK_PASSWORD) {
          setErrors({ password: t('auth.weakPassword') });
        } else if (errorCode === AUTH_CODES.RESET_TOKEN_EXPIRED ||
                   errorCode === 'RESET_TOKEN_EXPIRED') {
          showAlert(t('auth.expiredResetLink'));
          setIsTokenValid(false);
        } else {
          showAlert(errorMessage);
        }
      }
    } catch (err) {
      console.error('❌ Reset password error:', err);
      showAlert(t('auth.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigate to login
   */
  const handleGoToLogin = () => {
    if (onGoToLogin) {
      onGoToLogin();
    } else if (navigation?.navigate) {
      navigation.navigate('Login');
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  /**
   * Navigate to forgot password
   */
  const handleRequestNewLink = () => {
    if (navigation?.navigate) {
      navigation.navigate('ForgotPassword');
    }
  };

  /**
   * Render loading state
   */
  const renderLoadingState = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>{t('auth.validatingLink')}</Text>
    </View>
  );

  /**
   * Render invalid token state
   */
  const renderInvalidTokenState = () => (
    <View style={styles.centerContainer}>
      {/* Error Icon */}
      <View style={[styles.iconContainer, styles.errorIconContainer]}>
        <Text style={styles.icon}>❌</Text>
      </View>
      
      <Text style={styles.errorTitle}>{t('auth.invalidExpiredLink')}</Text>

      <Text style={styles.errorMessage}>
        {t('auth.invalidLinkMsg')}
      </Text>

      <Button
        title={t('auth.requestNewLink')}
        onPress={handleRequestNewLink}
        style={styles.actionButton}
      />

      <TouchableOpacity
        style={styles.backLink}
        onPress={handleGoToLogin}
      >
        <Text style={styles.backLinkText}>{t('auth.backToLogin')}</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render success state
   */
  const renderSuccessState = () => (
    <View style={styles.centerContainer}>
      {/* Success Icon */}
      <View style={[styles.iconContainer, styles.successIconContainer]}>
        <Text style={styles.icon}>✅</Text>
      </View>
      
      <Text style={styles.successTitle}>{t('auth.passwordResetComplete')}</Text>

      <Text style={styles.successMessage}>
        {t('auth.passwordResetCompleteMsg')}
      </Text>

      <Button
        title={t('auth.goToLogin')}
        onPress={handleGoToLogin}
        style={styles.actionButton}
      />
    </View>
  );

  /**
   * Render form state
   */
  const renderFormState = () => (
    <View style={styles.formContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.createNewPassword')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.createNewPasswordSubtitle')}
        </Text>
      </View>

      {/* New Password Input */}
      <Input
        label={t('auth.newPassword')}
        placeholder={t('auth.newPasswordPlaceholder')}
        value={formData.password}
        onChangeText={(text) => updateField('password', text)}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        error={errors.password}
        leftIcon="lock"
        rightIcon={showPassword ? 'eye-off' : 'eye'}
        onRightIconPress={() => setShowPassword(!showPassword)}
      />

      {/* Confirm Password Input */}
      <Input
        label={t('auth.confirmPassword')}
        placeholder={t('auth.confirmPasswordPlaceholder')}
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
        <Text style={styles.requirementsTitle}>{t('auth.passwordMustBe')}</Text>
        <PasswordRequirement
          met={formData.password.length >= 8}
          text={t('auth.be8Chars')}
        />
        <PasswordRequirement
          met={/[A-Z]/.test(formData.password)}
          text={t('auth.containUppercase')}
        />
        <PasswordRequirement
          met={/[a-z]/.test(formData.password)}
          text={t('auth.containLowercase')}
        />
        <PasswordRequirement
          met={/[0-9]/.test(formData.password)}
          text={t('auth.containNumber')}
        />
      </View>

      {/* Submit Button */}
      <Button
        title={t('auth.resetPassword')}
        onPress={handleSubmit}
        loading={loading}
        disabled={loading || !formData.password || !formData.confirmPassword}
        style={styles.submitButton}
      />

      {/* Back to Login */}
      <TouchableOpacity 
        style={styles.backLink}
        onPress={handleGoToLogin}
      >
        <Text style={styles.backLinkText}>
          {t('auth.backToLogin')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render content based on state
   */
  const renderContent = () => {
    if (validating) {
      return renderLoadingState();
    }
    
    if (!isTokenValid) {
      return renderInvalidTokenState();
    }
    
    if (resetComplete) {
      return renderSuccessState();
    }
    
    return renderFormState();
  };

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
          {alertMessage && !validating && (
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
          {renderContent()}

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

  // Center Container (for loading, error, success states)
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successIconContainer: {
    backgroundColor: '#E8F5E9',
  },
  errorIconContainer: {
    backgroundColor: '#FFEBEE',
  },
  icon: {
    fontSize: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.error,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
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
  actionButton: {
    width: '100%',
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
});

export default ResetPasswordScreen;
