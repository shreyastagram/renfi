/**
 * Register Screen
 * 
 * User registration form with Node.js API integration
 * Validates input and displays appropriate feedback based on API responses
 * Supports Google OAuth Sign-In for quick registration
 * 
 * @version 2.1.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Button, Input, PhoneInput, Alert, FixhomiLogo } from '../components';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import RegisterChoice from '../components/RegisterChoice';

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
    referralCode: '',
  });

  // Load pending referral code from deep link
  useEffect(() => {
    AsyncStorage.getItem('pendingReferralCode').then((code) => {
      if (code) {
        setFormData((prev) => ({ ...prev, referralCode: code }));
        AsyncStorage.removeItem('pendingReferralCode');
      }
    });
  }, []);

  // UI state
  const [mode, setMode] = useState('choice'); // 'choice' | 'form'
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
  const scrollViewRef = useRef(null);

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
    // Auto-scroll to top so user sees the alert (important after Google/Apple auth at bottom)
    setTimeout(() => scrollViewRef.current?.scrollTo?.({ y: 0, animated: true }), 100);
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

      // Call register API — backend enforces T&C, send the flags it captured
      const result = await registerUser({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone || undefined,
        referralCode: formData.referralCode?.trim() || undefined,
        termsAccepted: termsAccepted === true,
        privacyAccepted: termsAccepted === true,
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
   * Form-mode back button — returns to choice mode rather than navigating away.
   * From choice mode the user can still go back via the system gesture.
   */
  const handleBack = () => {
    if (mode === 'form') {
      setMode('choice');
      return;
    }
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
          // Get pending referral code for Google OAuth registration
          const pendingRefCode = formData.referralCode?.trim() || await AsyncStorage.getItem('pendingReferralCode') || undefined;
          if (pendingRefCode) AsyncStorage.removeItem('pendingReferralCode');

          let syncResult = await syncGoogleUserToMongoDB({
            javaUserId: user.id || user.userId,
            email: user.email,
            fullName: user.fullName || user.name,
            googleId: user.googleId,
            profilePicture: user.profilePicture,
            referralCode: pendingRefCode,
            termsAccepted: termsAccepted === true,
            privacyAccepted: termsAccepted === true,
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
              referralCode: pendingRefCode,
              termsAccepted: termsAccepted === true,
              privacyAccepted: termsAccepted === true,
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
      console.log('🆕 [RegisterScreen] New Apple user - syncing to MongoDB...');

      // Get pending referral code for Apple OAuth registration (mirrors Google flow)
      const pendingRefCode = formData.referralCode?.trim() || await AsyncStorage.getItem('pendingReferralCode') || undefined;
      if (pendingRefCode) AsyncStorage.removeItem('pendingReferralCode');

      const syncPayload = {
        javaUserId: user.id || user.userId,
        email: user.email,
        fullName: user.fullName || user.name,
        profilePicture: user.profilePicture,
        referralCode: pendingRefCode,
        termsAccepted: termsAccepted === true,
        privacyAccepted: termsAccepted === true,
      };

      let syncResult = await syncAppleUserToMongoDB(syncPayload, accessToken);

      // Retry once on failure — backend may still be warming up
      if (!syncResult.success) {
        console.warn('⚠️ [RegisterScreen] MongoDB sync failed, retrying in 2s...');
        await new Promise(r => setTimeout(r, 2000));
        syncResult = await syncAppleUserToMongoDB(syncPayload, accessToken);
      }

      if (!syncResult.success) {
        console.warn('⚠️ [RegisterScreen] MongoDB sync failed after retry, auth still succeeded');
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
          showAlert(t('auth.appleRoleConflict', { role: existingRole }), 'warning');
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

  // Step 1 — choice screen. Captures referral + T&C, then routes to manual or OAuth.
  if (mode === 'choice') {
    return (
      <RegisterChoice
        referralCode={formData.referralCode}
        onReferralCodeChange={(v) => updateField('referralCode', v)}
        termsAccepted={termsAccepted}
        onTermsToggle={setTermsAccepted}
        onPickManual={() => setMode('form')}
        onPickGoogle={handleGoogleSignIn}
        onPickApple={handleAppleSignIn}
        googleLoading={googleLoading}
        appleLoading={appleLoading}
        onSwitchToLogin={() => navigation?.goBack?.()}
        userType="user"
      />
    );
  }

  // Step 2 — manual form (only fields, since referral + T&C were captured in step 1).
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} accessibilityLabel="Go back" accessibilityRole="button" activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color="#1E293B" />
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

            {/* Referral code, T&C checkbox, divider, and social buttons \u2014 all
             * captured in the RegisterChoice step. The form mode only collects
             * email/password/name/phone, so they're intentionally hidden here.
             */}

            <Button
              title={loading ? t('auth.creatingAccount') : t('auth.createAccount')}
              onPress={handleRegister}
              loading={loading}
              disabled={loading || googleLoading || appleLoading || !termsAccepted}
              style={styles.submitButton}
            />

            {/* Google + Apple buttons removed — they live on the RegisterChoice
             * step now. Manual-fill mode only collects email/password/name/phone. */}
          </View>
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
            <View style={styles.modalIconCircle}>
              <MaterialIcons name="person" size={28} color="#f67c16" />
            </View>
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
            <View style={styles.modalIconCircle}>
              <MaterialIcons name="phone-android" size={28} color="#f67c16" />
            </View>
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
  // ── Layout ──
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },

  // ── Header ──
  header: { marginBottom: 28, alignItems: 'center' },
  backButton: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 18,
  },
  logoContainer: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#f67c16', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 5 },
    }),
  },
  brandName: { fontSize: 18, fontWeight: '800', color: '#f67c16', marginTop: 10, letterSpacing: 0.3 },
  title: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginTop: 10, marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748B', lineHeight: 21, textAlign: 'center', paddingHorizontal: 8 },

  // ── Form ──
  form: { flex: 1 },
  submitButton: { marginTop: 8 },

  // ── Divider ──
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { marginHorizontal: 14, color: '#94A3B8', fontSize: 13, fontWeight: '500' },

  // ── Google Button ──
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 10,
  },
  googleButtonDisabled: { opacity: 0.5 },
  googleIconContainer: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  googleIcon: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  googleButtonText: { fontSize: 15, fontWeight: '600', color: '#1E293B' },

  // ── Apple Button ──
  appleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000000', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24, marginBottom: 12,
  },
  appleButtonDisabled: { opacity: 0.5 },
  appleIcon: { fontSize: 18, color: '#FFF', marginRight: 10 },
  appleButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  // ── Terms ──
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, marginTop: 8, gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#f67c16', borderColor: '#f67c16' },
  checkmark: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  termsText: { flex: 1, fontSize: 13, color: '#64748B', lineHeight: 20 },
  termsLink: { color: '#2b76bc', fontWeight: '600' },

  // ── Footer ──
  footer: { paddingVertical: 20 },
  footerText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
  link: { color: '#2b76bc', fontWeight: '500' },

  // ── Modals ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 28, width: '100%', maxWidth: 340,
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 },
      android: { elevation: 10 },
    }),
  },
  modalIconCircle: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(246,124,22,0.08)',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 19, fontWeight: '700', color: '#1E293B', textAlign: 'center', marginBottom: 8 },
  modalEmail: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 8, fontStyle: 'italic' },
  modalMessage: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 21 },
  modalButtons: { gap: 10 },
  modalPrimaryButton: { backgroundColor: '#f67c16', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  modalPrimaryButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  modalSecondaryButton: { backgroundColor: '#F1F5F9', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  modalSecondaryButtonText: { color: '#1E293B', fontSize: 15, fontWeight: '600' },
  modalDismissButton: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  modalDismissText: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
  accountTypeBadge: {
    alignSelf: 'center', backgroundColor: 'rgba(43,118,188,0.08)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16,
  },
  accountTypeBadgeText: { fontSize: 12, fontWeight: '600', color: '#2b76bc' },
});

export default RegisterScreen;
