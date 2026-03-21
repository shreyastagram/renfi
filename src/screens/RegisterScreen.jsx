/**
 * Register Screen
 * 
 * User registration form with Node.js API integration
 * Validates input and displays appropriate feedback based on API responses
 * Supports Google OAuth Sign-In for quick registration
 * 
 * @version 2.1.0
 */

import React, { useState, useCallback, useRef } from 'react';
import {  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Linking
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, PhoneInput, Alert, FixhomiLogo } from '../components';
import { registerUser, getErrorMessage, AUTH_CODES, checkAvailability } from '../services/authService';
import { validateRegistrationForm } from '../utils/validation';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import {
  signInWithGoogleAsUser,
  syncGoogleUserToMongoDB,
  GOOGLE_AUTH_CODES,
  getGoogleAuthErrorMessage,
} from '../services/googleAuthService';
import {
  signInWithAppleAsUser,
  syncAppleUserToMongoDB,
  completeAppleSignInWithVerifiedEmail,
  APPLE_AUTH_CODES,
  getAppleAuthErrorMessage,
} from '../services/appleAuthService';
import AppleEmailCollectionModal from '../components/AppleEmailCollectionModal';

/**
 * RegisterScreen Component
 * 
 * @param {Object} props - Navigation props
 */
const RegisterScreen = ({ navigation }) => {
  const { handleAuthSuccess } = useApp();
  const { t } = useLanguage();

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [alertHint, setAlertHint] = useState(null);

  // Account exists modal state
  const [showAccountExistsModal, setShowAccountExistsModal] = useState(false);
  const [existingEmail, setExistingEmail] = useState('');
  
  // Phone already registered modal state
  const [showPhoneExistsModal, setShowPhoneExistsModal] = useState(false);
  const [existingPhone, setExistingPhone] = useState('');

  // Account type of existing account (for routing to correct login)
  const [existingAccountType, setExistingAccountType] = useState(null); // 'user' | 'provider'

  // Apple email verification state
  const [showAppleEmailModal, setShowAppleEmailModal] = useState(false);
  const [pendingAppleAuth, setPendingAppleAuth] = useState(null);

  // Debounce timers for availability checks
  const emailCheckTimer = useRef(null);
  const phoneCheckTimer = useRef(null);

  /**
   * Check email/phone availability (debounced)
   */
  const checkFieldAvailability = useCallback(async (field, value) => {
    if (!value || !value.trim()) return;

    const params = {};
    if (field === 'email') {
      // Basic email format check before API call
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return;
      params.email = value;
    } else {
      // Only check complete 10-digit numbers
      const digits = value.replace(/[^0-9]/g, '');
      if (digits.length !== 10) return;
      params.phone = value;
    }

    const result = await checkAvailability(params);
    if (!result.success || result.available) return;

    const conflict = result.conflicts.find(c => c.field === field);
    if (!conflict) return;

    setExistingAccountType(conflict.accountType);
    if (field === 'email') {
      setExistingEmail(value.trim());
      setShowAccountExistsModal(true);
      setErrors(prev => ({ ...prev, email: t('auth.emailAlreadyRegistered') }));
    } else {
      setExistingPhone(value);
      setShowPhoneExistsModal(true);
      setErrors(prev => ({ ...prev, phone: t('auth.phoneAlreadyRegistered') }));
    }
  }, []);

  /**
   * Update form field
   * @param {string} field - Field name
   * @param {string} value - Field value
   */
  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
    // Clear alert when user makes changes
    if (alertMessage) {
      setAlertMessage(null);
    }

    // Debounced availability check for email and phone
    if (field === 'email') {
      clearTimeout(emailCheckTimer.current);
      emailCheckTimer.current = setTimeout(() => checkFieldAvailability('email', value), 800);
    } else if (field === 'phone') {
      clearTimeout(phoneCheckTimer.current);
      phoneCheckTimer.current = setTimeout(() => checkFieldAvailability('phone', value), 800);
    }
  }, [errors, alertMessage, checkFieldAvailability]);

  /**
   * Show alert message
   * @param {string} message - Alert message
   * @param {string} type - Alert type (error, success, warning, info)
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
   * Navigate to the correct login screen based on existing account type
   */
  const handleGoToLogin = useCallback(() => {
    setShowAccountExistsModal(false);
    const target = existingAccountType === 'provider' ? 'ProviderAuth' : 'UserAuth';
    navigation.navigate(target, {
      initialTab: 'login',
      prefillEmail: existingEmail
    });
  }, [navigation, existingEmail, existingAccountType]);

  /**
   * Navigate to forgot password with pre-filled email
   */
  const handleForgotPassword = useCallback(() => {
    setShowAccountExistsModal(false);
    navigation.navigate('ForgotPassword', {
      prefillEmail: existingEmail
    });
  }, [navigation, existingEmail]);

  /**
   * Navigate to login when phone already exists
   */
  const handlePhoneGoToLogin = useCallback(() => {
    setShowPhoneExistsModal(false);
    const target = existingAccountType === 'provider' ? 'ProviderAuth' : 'UserAuth';
    navigation.navigate(target, {
      initialTab: 'login'
    });
  }, [navigation, existingAccountType]);

  /**
   * Dismiss phone modal and focus phone field for user to change it
   */
  const handleUseDifferentPhone = useCallback(() => {
    setShowPhoneExistsModal(false);
    setExistingPhone('');
    // Clear the phone error so user can re-enter
    setErrors(prev => ({ ...prev, phone: undefined }));
  }, []);

  /**
   * Handle registration submit
   */
  const handleRegister = async () => {
    try {
      // Clear previous errors
      setErrors({});
      clearAlert();

      // Client-side validation
      const validation = validateRegistrationForm(formData);
      if (!validation.isValid) {
        setErrors(validation.errors);
        showAlert(t('auth.formErrors'), 'warning');
        return;
      }

      // Re-check availability before submitting (prevents bypassing the popup)
      const availParams = { email: formData.email };
      if (formData.phone) {
        const digits = formData.phone.replace(/[^0-9]/g, '');
        if (digits.length === 10) availParams.phone = formData.phone;
      }
      const availResult = await checkAvailability(availParams);
      if (availResult.success && !availResult.available && availResult.conflicts?.length > 0) {
        const emailConflict = availResult.conflicts.find(c => c.field === 'email');
        const phoneConflict = availResult.conflicts.find(c => c.field === 'phone');
        if (emailConflict) {
          setExistingEmail(formData.email);
          setExistingAccountType(emailConflict.accountType);
          setShowAccountExistsModal(true);
          setErrors(prev => ({ ...prev, email: t('auth.emailAlreadyRegistered') }));
        }
        if (phoneConflict) {
          setExistingPhone(formData.phone);
          setExistingAccountType(phoneConflict.accountType);
          setShowPhoneExistsModal(true);
          setErrors(prev => ({ ...prev, phone: t('auth.phoneAlreadyRegistered') }));
        }
        return;
      }

      // Start loading
      setLoading(true);

      // Call register API
      const result = await registerUser({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone || undefined,
      });

      if (result.success) {
        const { data } = result;

        // Check response code for specific handling
        if (data.code === AUTH_CODES.REGISTRATION_SUCCESS) {
          showAlert(t('auth.registrationSuccess'), 'success');
        } else if (data.code === AUTH_CODES.USER_ALREADY_EXISTS) {
          showAlert(t('auth.accountFoundLoggedIn'), 'info');
        }

        // Process successful auth — explicitly set userType since this screen is user-only
        const authProcessed = await handleAuthSuccess({ ...data, userType: 'user' });

        if (!authProcessed) {
          showAlert(t('auth.registrationSessionFail'), 'warning');
        }

        // Record legal acceptance with explicit token
        if (termsAccepted && data.accessToken) {
          const { NODE_BASE_URL } = require('../config/api');
          try {
            await fetch(`${NODE_BASE_URL}/api/auth/accept-policies`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.accessToken}` },
              body: JSON.stringify({ termsAccepted: true, privacyAccepted: true }),
            });
          } catch (e) {
            console.warn('[Register] Legal acceptance failed:', e.message);
          }
        }
        // Navigation will happen automatically via RootNavigator when isAuthenticated changes

      } else {
        // Handle error response
        const { error } = result;
        
        // Log full error in development
        if (__DEV__) {
          console.error('🔍 [RegisterScreen] Full error details:', error);
        }
        
        // Handle specific error codes
        switch (error.code) {
          case AUTH_CODES.EMAIL_ALREADY_EXISTS:
            setExistingEmail(formData.email);
            setExistingAccountType(null); // Unknown from submit — could be either
            setShowAccountExistsModal(true);
            setErrors({ email: t('auth.emailAlreadyRegistered') });
            break;

          case AUTH_CODES.PHONE_ALREADY_EXISTS:
            setExistingPhone(formData.phone);
            setExistingAccountType(null);
            setShowPhoneExistsModal(true);
            setErrors({ phone: t('auth.phoneAlreadyRegistered') });
            break;
            
          case AUTH_CODES.WEAK_PASSWORD:
            setErrors({ password: error.message });
            showAlert(getErrorMessage(error.code, error.message), 'error');
            break;
            
          case AUTH_CODES.INVALID_EMAIL_FORMAT:
            setErrors({ email: error.message });
            break;
            
          case AUTH_CODES.INVALID_FULL_NAME:
            setErrors({ fullName: error.message });
            break;
            
          case AUTH_CODES.VALIDATION_FAILED:
            // Handle multiple validation errors from backend
            if (error.errors) {
              setErrors(error.errors);
            }
            showAlert(getErrorMessage(error.code, error.message), 'warning');
            break;
            
          case AUTH_CODES.AUTH_SERVICE_UNAVAILABLE:
          case AUTH_CODES.MONGODB_SYNC_FAILED:
            showAlert(error.message || getErrorMessage(error.code), 'error', error.hint);
            break;

          case AUTH_CODES.NETWORK_ERROR:
          case AUTH_CODES.SERVER_UNREACHABLE:
          case AUTH_CODES.SERVER_TIMEOUT:
          case AUTH_CODES.NO_INTERNET:
            // Use the specific message from parseApiError — not the generic lookup
            showAlert(error.message || getErrorMessage(error.code), 'error', error.hint);
            break;

          default:
            showAlert(error.message || t('auth.registrationFailed'), 'error', error.hint);
        }
      }
    } catch (err) {
      console.error('❌ [RegisterScreen] Unexpected error:', err);
      showAlert(t('auth.unexpectedError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigate back to user type selection
   */
  const handleBack = () => {
    navigation.goBack();
  };

  /**
   * Handle Google Sign-In for registration
   * Uses mode="signup" — backend will NOT login existing users
   */
  const handleGoogleSignIn = async () => {
    if (!termsAccepted) {
      showAlert('Please accept the Terms & Conditions and Privacy Policy before signing up.', 'warning');
      return;
    }
    try {
      setGoogleLoading(true);
      clearAlert();
      
      // ✅ KEY CHANGE: Pass mode="signup" — backend rejects if already registered
      const result = await signInWithGoogleAsUser('signup');

      if (result.success) {
        const { accessToken, refreshToken, user, isNewUser } = result.data;

        // If new user, sync profile to MongoDB
        if (isNewUser && user) {
          console.log('🆕 [RegisterScreen] New user - syncing to MongoDB...');
          let syncResult = await syncGoogleUserToMongoDB({
            javaUserId: user.id || user.userId,
            email: user.email,
            fullName: user.fullName || user.name,
            googleId: user.googleId,
            profilePicture: user.profilePicture,
          }, accessToken);

          // Retry once on failure — backend may still be warming up
          if (!syncResult.success) {
            console.warn('⚠️ [RegisterScreen] MongoDB sync failed, retrying in 2s...');
            await new Promise(r => setTimeout(r, 2000));
            syncResult = await syncGoogleUserToMongoDB({
              javaUserId: user.id || user.userId,
              email: user.email,
              fullName: user.fullName || user.name,
              googleId: user.googleId,
              profilePicture: user.profilePicture,
            }, accessToken);
          }

          if (!syncResult.success) {
            console.warn('⚠️ [RegisterScreen] MongoDB sync failed after retry, auth still succeeded');
            showAlert(t('auth.googleProfileSetup'), 'warning');
          }
        }

        showAlert(t('auth.googleRegistrationSuccess'), 'success');
        
        // Process auth with explicit ID extraction
        // The unified ID system means javaUserId = mongoId
        const authData = {
          accessToken,
          refreshToken,
          userId: user.id || user.userId,
          javaUserId: user.id || user.userId,
          mongoId: user.id || user.userId, // Same in unified system
          email: user.email,
          fullName: user.fullName || user.name,
          role: user.role,
          userType: 'user',
          isNewUser,
          authMethod: 'google',
        };
        
        const authProcessed = await handleAuthSuccess(authData);

        if (!authProcessed) {
          showAlert(t('auth.registrationSessionFail'), 'warning');
        }

        // Record legal acceptance with explicit token
        if (termsAccepted && accessToken) {
          const { NODE_BASE_URL } = require('../config/api');
          try {
            await fetch(`${NODE_BASE_URL}/api/auth/accept-policies`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
              body: JSON.stringify({ termsAccepted: true, privacyAccepted: true }),
            });
          } catch (e) {
            console.warn('[Register] Legal acceptance failed:', e.message);
          }
        }
      } else {
        const { error } = result;

        // Don't show error for cancelled sign-in
        if (error.isCancelled) {
          console.log('🔵 [RegisterScreen] Google Sign-In cancelled by user');
          return;
        }
        
        // Handle role conflict
        if (error.code === GOOGLE_AUTH_CODES.ROLE_CONFLICT) {
          const existingRole = error.existingRole === 'SERVICE_PROVIDER' ? 'Service Provider' : 'User';
          showAlert(
            t('auth.googleRoleConflict', { role: existingRole }),
            'warning'
          );
          return;
        }
        
        // ✅ Handle already registered — user should login instead
        if (error.code === GOOGLE_AUTH_CODES.ALREADY_REGISTERED) {
          setExistingEmail('this Google account');
          setShowAccountExistsModal(true);
          return;
        }
        
        // Handle account exists with password
        if (error.code === GOOGLE_AUTH_CODES.ACCOUNT_EXISTS_WITH_PASSWORD) {
          showAlert(
            t('auth.googleAccountExists'),
            'info'
          );
          return;
        }
        
        const errorMessage = getGoogleAuthErrorMessage(error.code, error.message);
        showAlert(errorMessage, 'error');
      }
    } catch (error) {
      console.error('❌ [RegisterScreen] Google Sign-In error:', error);
      showAlert(t('auth.googleSignInFailed'), 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  /**
   * Process a successful Apple auth result (shared between direct sign-in and email-verified retry).
   * Mirrors the Google Sign-In post-signup flow exactly.
   */
  const processAppleAuthSuccess = async (resultData) => {
    const { accessToken, refreshToken, user, isNewUser } = resultData;

    if (isNewUser && user) {
      console.log('[RegisterScreen] New Apple user - syncing to MongoDB...');
      let syncResult = await syncAppleUserToMongoDB({
        javaUserId: user.id || user.userId,
        email: user.email,
        fullName: user.fullName || user.name,
      }, accessToken);

      if (!syncResult.success) {
        console.warn('[RegisterScreen] MongoDB sync failed, retrying in 2s...');
        await new Promise(r => setTimeout(r, 2000));
        syncResult = await syncAppleUserToMongoDB({
          javaUserId: user.id || user.userId,
          email: user.email,
          fullName: user.fullName || user.name,
        }, accessToken);
      }

      if (!syncResult.success) {
        showAlert(t('auth.appleProfileSetup') || 'Account created. Profile setup may take a moment.', 'warning');
      }
    }

    showAlert(t('auth.appleRegistrationSuccess') || 'Account created successfully!', 'success');

    const authData = {
      accessToken,
      refreshToken,
      userId: user.id || user.userId,
      javaUserId: user.id || user.userId,
      mongoId: user.id || user.userId,
      email: user.email,
      fullName: user.fullName || user.name,
      role: user.role,
      userType: 'user',
      isNewUser,
      authMethod: 'apple',
    };

    const authProcessed = await handleAuthSuccess(authData);
    if (!authProcessed) {
      showAlert(t('auth.registrationSessionFail'), 'warning');
    }

    // Record legal acceptance with explicit token
    if (termsAccepted && accessToken) {
      const { NODE_BASE_URL } = require('../config/api');
      try {
        await fetch(`${NODE_BASE_URL}/api/auth/accept-policies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ termsAccepted: true, privacyAccepted: true }),
        });
      } catch (e) {
        console.warn('[Register] Legal acceptance failed:', e.message);
      }
    }
  };

  /**
   * Handle Apple Sign-In — SIGNUP MODE (mirrors Google handler)
   */
  const handleAppleSignIn = async () => {
    if (!termsAccepted) {
      showAlert('Please accept the Terms & Conditions and Privacy Policy before signing up.', 'warning');
      return;
    }
    try {
      setAppleLoading(true);
      clearAlert();

      const result = await signInWithAppleAsUser('signup');

      if (result.success) {
        await processAppleAuthSuccess(result.data);
      } else {
        const { error } = result;
        if (error.isCancelled) return;
        if (error.code === APPLE_AUTH_CODES.NOT_AVAILABLE) return;

        // EMAIL_REQUIRED — Apple hid the email, collect it from the user
        if (error.code === APPLE_AUTH_CODES.EMAIL_REQUIRED) {
          // Store the Apple credentials so we can retry after email verification
          setPendingAppleAuth({
            appleUserId: error.appleUserId,
            role: 'USER',
            mode: 'signup',
          });
          setShowAppleEmailModal(true);
          return;
        }

        if (error.code === APPLE_AUTH_CODES.ROLE_CONFLICT) {
          const existingRole = error.existingRole === 'SERVICE_PROVIDER' ? 'Service Provider' : 'User';
          showAlert(t('auth.appleRoleConflict') || `This account is registered as a ${existingRole}.`, 'warning');
          return;
        }

        if (error.code === APPLE_AUTH_CODES.ALREADY_REGISTERED) {
          setExistingEmail('this Apple account');
          setShowAccountExistsModal(true);
          return;
        }

        const errorMessage = getAppleAuthErrorMessage(error.code, error.message);
        showAlert(errorMessage, 'error');
      }
    } catch (error) {
      showAlert(t('auth.appleSignInFailed') || 'Apple Sign-In failed. Please try again.', 'error');
    } finally {
      setAppleLoading(false);
    }
  };

  /**
   * Callback when Apple email verification completes.
   * Retries Apple auth with the verified email + verification token.
   */
  const handleAppleEmailVerified = async (verifiedEmail, verificationToken) => {
    setShowAppleEmailModal(false);

    if (!pendingAppleAuth) {
      showAlert('Something went wrong. Please try Apple Sign-In again.', 'error');
      return;
    }

    try {
      setAppleLoading(true);
      clearAlert();

      const retryResult = await completeAppleSignInWithVerifiedEmail({
        identityToken: null, // Backend uses appleUserId + verificationToken for re-auth
        authorizationCode: null,
        appleUserId: pendingAppleAuth.appleUserId,
        fullName: null,
        role: pendingAppleAuth.role,
        mode: pendingAppleAuth.mode,
        email: verifiedEmail,
        verificationToken,
      });

      if (retryResult.success) {
        await processAppleAuthSuccess(retryResult.data);
      } else {
        const errorMessage = getAppleAuthErrorMessage(retryResult.error?.code, retryResult.error?.message);
        showAlert(errorMessage, 'error');
      }
    } catch (err) {
      console.error('[RegisterScreen] Apple email retry error:', err);
      showAlert('Could not complete registration. Please try again.', 'error');
    } finally {
      setAppleLoading(false);
      setPendingAppleAuth(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} accessibilityLabel="Go back" accessibilityRole="button">
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <FixhomiLogo size={44} />
            </View>
            <Text style={styles.brandName}>FixHomi</Text>
            <Text style={styles.title}>{t('auth.createAccount')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.joinFixhomi')}
            </Text>
          </View>

          {/* Alert Message */}
          {alertMessage && (
            <Alert
              type={alertType}
              message={alertMessage}
              hint={alertHint}
              onClose={clearAlert}
            />
          )}

          {/* Registration Form */}
          <View style={styles.form}>
            <Input
              label={t('auth.fullName')}
              placeholder={t('auth.fullNamePlaceholder')}
              value={formData.fullName}
              onChangeText={(value) => updateField('fullName', value)}
              error={errors.fullName}
              autoCapitalize="words"
              autoComplete="name"
              required
            />

            <Input
              label={t('auth.email')}
              placeholder={t('auth.emailPlaceholder')}
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              required
            />

            <Input
              label={t('auth.password')}
              placeholder={t('auth.createPassword')}
              value={formData.password}
              onChangeText={(value) => updateField('password', value)}
              error={errors.password}
              secureTextEntry
              autoComplete="password-new"
              required
            />

            <PhoneInput
              label={t('auth.phoneOptional')}
              value={formData.phone}
              onChangeText={(value) => updateField('phone', value)}
              error={errors.phone}
            />

            {/* Terms & Privacy Acceptance */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setTermsAccepted(!termsAccepted)}
              activeOpacity={0.7}
              accessibilityLabel={termsAccepted ? 'Terms and conditions accepted. Tap to uncheck' : 'Accept terms and conditions'}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Text style={styles.checkmark}>{'\u2713'}</Text>}
              </View>
              <Text style={styles.termsText}>
                {'I agree to the '}
                <Text style={styles.termsLink} onPress={() => Linking.openURL('https://fixhomi.com/terms')}>
                  Terms &amp; Conditions
                </Text>
                {' and '}
                <Text style={styles.termsLink} onPress={() => Linking.openURL('https://fixhomi.com/privacy')}>
                  Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

            <Button
              title={loading ? t('auth.creatingAccount') : t('auth.createAccount')}
              onPress={handleRegister}
              loading={loading}
              disabled={loading || googleLoading || appleLoading || !termsAccepted}
              style={styles.submitButton}
            />

            {/* Social Login Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.orRegisterWith')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              style={[
                styles.googleButton,
                (loading || googleLoading || appleLoading) && styles.googleButtonDisabled
              ]}
              onPress={handleGoogleSignIn}
              disabled={loading || googleLoading || appleLoading}
              activeOpacity={0.7}
              accessibilityLabel="Sign up with Google"
              accessibilityRole="button"
            >
              {googleLoading ? (
                <Text style={styles.googleButtonText}>{t('auth.signingUpGoogle')}</Text>
              ) : (
                <>
                  <View style={styles.googleIconContainer}>
                    <Text style={styles.googleIcon}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>{t('auth.continueWithGoogle')}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple Sign-In Button (iOS only) */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[
                  styles.appleButton,
                  (loading || googleLoading || appleLoading) && styles.appleButtonDisabled
                ]}
                onPress={handleAppleSignIn}
                disabled={loading || googleLoading || appleLoading}
                activeOpacity={0.7}
                accessibilityLabel="Sign up with Apple"
                accessibilityRole="button"
              >
                {appleLoading ? (
                  <Text style={styles.appleButtonText}>{t('auth.signingUpApple') || 'Signing up...'}</Text>
                ) : (
                  <>
                    <Text style={styles.appleIcon}>{'\uF8FF'}</Text>
                    <Text style={styles.appleButtonText}>{t('auth.continueWithApple') || 'Continue with Apple'}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Footer note */}
          {!termsAccepted && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Please accept the Terms &amp; Conditions above to continue
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Account Already Exists Modal */}
      <Modal
        visible={showAccountExistsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAccountExistsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>👋</Text>
            <Text style={styles.modalTitle}>{t('auth.accountAlreadyExists')}</Text>
            <Text style={styles.modalEmail}>{existingEmail}</Text>
            <Text style={styles.modalMessage}>
              {existingAccountType === 'provider'
                ? t('auth.accountExistsProvider')
                : existingAccountType === 'user'
                ? t('auth.accountExistsUser')
                : t('auth.accountExistsGeneric')}
            </Text>
            {existingAccountType && (
              <View style={styles.accountTypeBadge}>
                <Text style={styles.accountTypeBadgeText}>
                  {existingAccountType === 'provider' ? t('auth.providerAccount') : t('auth.userAccount')}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={handleGoToLogin}
                activeOpacity={0.8}
                accessibilityLabel="Go to login"
                accessibilityRole="button"
              >
                <Text style={styles.modalPrimaryButtonText}>
                  {existingAccountType === 'provider' ? t('auth.goToProviderLogin') : t('auth.logInToAccount')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={handleForgotPassword}
                activeOpacity={0.8}
                accessibilityLabel="Forgot password"
                accessibilityRole="button"
              >
                <Text style={styles.modalSecondaryButtonText}>{t('auth.iForgotPassword')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDismissButton}
                onPress={() => setShowAccountExistsModal(false)}
                activeOpacity={0.8}
                accessibilityLabel="Use a different email"
                accessibilityRole="button"
              >
                <Text style={styles.modalDismissText}>{t('auth.useDifferentEmail')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Phone Already Registered Modal */}
      <Modal
        visible={showPhoneExistsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhoneExistsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>📱</Text>
            <Text style={styles.modalTitle}>{t('auth.numberAlreadyRegistered')}</Text>
            <Text style={styles.modalEmail}>+91 {existingPhone}</Text>
            <Text style={styles.modalMessage}>
              {existingAccountType === 'provider'
                ? t('auth.numberRegisteredProvider')
                : existingAccountType === 'user'
                ? t('auth.numberRegisteredUser')
                : t('auth.numberRegisteredGeneric')}
              {t('auth.wouldLikeToLogin')}
            </Text>
            {existingAccountType && (
              <View style={styles.accountTypeBadge}>
                <Text style={styles.accountTypeBadgeText}>
                  {existingAccountType === 'provider' ? t('auth.providerAccount') : t('auth.userAccount')}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={handlePhoneGoToLogin}
                activeOpacity={0.8}
                accessibilityLabel="Go to login"
                accessibilityRole="button"
              >
                <Text style={styles.modalPrimaryButtonText}>
                  {existingAccountType === 'provider' ? t('auth.goToProviderLogin') : t('auth.logInToAccount')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDismissButton}
                onPress={handleUseDifferentPhone}
                activeOpacity={0.8}
                accessibilityLabel="Use a different phone number"
                accessibilityRole="button"
              >
                <Text style={styles.modalDismissText}>{t('auth.useDifferentNumber')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Apple Email Collection + OTP Verification Modal */}
      <AppleEmailCollectionModal
        visible={showAppleEmailModal}
        appleUserId={pendingAppleAuth?.appleUserId}
        onVerified={handleAppleEmailVerified}
        onCancel={() => {
          setShowAppleEmailModal(false);
          setPendingAppleAuth(null);
        }}
      />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  backButton: {
    marginBottom: 16,
    padding: 4,
    alignSelf: 'flex-start',
  },
  backIcon: {
    fontSize: 24,
    color: '#374151',
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f67c16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#f67c1615',
  },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f67c16',
    marginTop: 10,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  submitButton: {
    marginTop: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#9CA3AF',
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  appleButtonDisabled: {
    opacity: 0.6,
  },
  appleIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    marginRight: 10,
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 8,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  termsLink: {
    color: '#2563EB',
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  link: {
    color: '#2563EB',
    fontWeight: '500',
  },
  // Account Exists Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalEmail: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  modalMessage: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    gap: 12,
  },
  modalPrimaryButton: {
    backgroundColor: '#f67c16',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSecondaryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSecondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  modalDismissButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalDismissText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  accountTypeBadge: {
    alignSelf: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  accountTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
});

export default RegisterScreen;
