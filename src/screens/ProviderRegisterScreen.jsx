/**
 * Provider Register Screen
 * 
 * Provider registration form with Node.js API integration
 * Required: email, password, name, address
 * Optional: phone, city, pincode, serviceCategories, experience, location
 * 
 * Now captures real GPS coordinates for provider location
 * Supports Google OAuth Sign-In for quick registration
 * 
 * @version 3.1.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Modal,
  Linking
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Geolocation from '@react-native-community/geolocation';
import { Button, Input, PhoneInput, Alert, FixhomiLogo } from '../components';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerProvider, getErrorMessage, AUTH_CODES, checkAvailability } from '../services/authService';
import { validateProviderRegistrationForm } from '../utils/validation';
import { useApp } from '../context/AppContext';
import {
  signInWithGoogleAsProvider,
  syncGoogleProviderToMongoDB,
  GOOGLE_AUTH_CODES,
  getGoogleAuthErrorMessage,
} from '../services/googleAuthService';
import {
  signInWithAppleAsProvider,
  syncAppleProviderToMongoDB,
  completeAppleSignInWithVerifiedEmail,
  APPLE_AUTH_CODES,
  getAppleAuthErrorMessage,
} from '../services/appleAuthService';
import AppleEmailCollectionModal from '../components/AppleEmailCollectionModal';
import RegisterChoice from '../components/RegisterChoice';
import { isInsideServiceZone, getZoneStatus } from '../utils/serviceZone';
import { useLanguage } from '../context/LanguageContext';

/**
 * ProviderRegisterScreen Component
 * 
 * @param {Object} props - Navigation props
 */
const ProviderRegisterScreen = ({ navigation }) => {
  const { handleAuthSuccess } = useApp();
  const { t } = useLanguage();

  // Form state - required and common optional fields
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    address: '',
    city: '',
    pincode: '',
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
  const [existingAccountType, setExistingAccountType] = useState(null);

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
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return;
      params.email = value;
    } else {
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

  // Location state
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);

  /**
   * Navigate to the correct login screen based on existing account type
   */
  const handleGoToLogin = useCallback(() => {
    setShowAccountExistsModal(false);
    const target = existingAccountType === 'user' ? 'UserAuth' : 'ProviderAuth';
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
    const target = existingAccountType === 'user' ? 'UserAuth' : 'ProviderAuth';
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
   * Request location permission (Android)
   */
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: t('providerRegister.locationPermission'),
            message: t('providerRegister.locationPermissionMsg'),
            buttonNeutral: t('providerRegister.askMeLater'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Location permission error:', err);
        return false;
      }
    }
    return true; // iOS handles permission via Info.plist
  };

  /**
   * Ultra-fast 2-stage location strategy (same as LocationContext / Uber / Ola):
   * Stage 1: Get ANY cached location INSTANTLY (maximumAge: 5 min, low accuracy OK)
   * Stage 2: If accuracy > 100m, silently refine in background
   * This gives users a near-instant location result.
   */
  const getCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);

    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setLocationError(t('providerRegister.locationDenied'));
      setLocationLoading(false);
      return;
    }

    console.log('⚡ [ProviderRegister] Starting ultra-fast 2-stage location fetch...');

    // STAGE 1: Get ANY cached/network location INSTANTLY
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log(`⚡ [ProviderRegister] FAST location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy?.toFixed(0) || '?'}m)`);
        
        setLocation({ latitude, longitude, accuracy });
        setLocationLoading(false);
        
        // STAGE 2: If accuracy is poor (>100m), silently get better location
        if (accuracy && accuracy > 100) {
          console.log('📍 [ProviderRegister] Refining accuracy in background...');
          Geolocation.getCurrentPosition(
            (betterPosition) => {
              const better = betterPosition.coords;
              if (better.accuracy && better.accuracy < accuracy) {
                console.log(`✅ [ProviderRegister] Improved: ±${better.accuracy.toFixed(0)}m`);
                setLocation({ latitude: better.latitude, longitude: better.longitude, accuracy: better.accuracy });
              }
            },
            () => {}, // Ignore errors in background refinement
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
      },
      (error) => {
        // Stage 1 failed — no cached location available
        console.warn('⚠️ [ProviderRegister] No cached location, trying fresh GPS...');
        
        // GPS off check (error code 2 = POSITION_UNAVAILABLE)
        if (error.code === 2) {
          setLocationError(t('providerRegister.locationGpsOff'));
          setLocationLoading(false);
          return;
        }
        
        // Fallback: Try fresh GPS with high accuracy
        Geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            console.log(`📍 [ProviderRegister] Fresh location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            setLocation({ latitude, longitude, accuracy });
            setLocationLoading(false);
          },
          (fallbackError) => {
            console.error('📍 [ProviderRegister] All location attempts failed:', fallbackError.message);
            if (fallbackError.code === 2) {
              setLocationError(t('providerRegister.locationGpsOff'));
            } else {
              setLocationError(t('providerRegister.locationFallback'));
            }
            setLocationLoading(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      },
      {
        enableHighAccuracy: false, // FALSE for SPEED — get any cached location
        timeout: 3000,             // Short timeout — fail fast if no cache
        maximumAge: 300000,        // Accept 5-min old cache for instant result
      }
    );
  };

  // Request location on mount
  useEffect(() => {
    getCurrentLocation();
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
   * Handle registration submit
   */
  const handleRegister = async () => {
    try {
      // Clear previous errors
      setErrors({});
      clearAlert();

      // Client-side validation
      const validation = validateProviderRegistrationForm(formData);
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

      // Warn if no location but don't block registration
      if (!location) {
        console.warn('⚠️ No location available for registration');
      }

      // Call register API with location — backend enforces T&C, send the flags
      const result = await registerProvider({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        address: formData.address,
        city: formData.city || undefined,
        pincode: formData.pincode || undefined,
        phone: formData.phone || undefined,
        referralCode: formData.referralCode?.trim() || undefined,
        // Include GPS coordinates if available
        latitude: location?.latitude,
        longitude: location?.longitude,
        termsAccepted: termsAccepted === true,
        privacyAccepted: termsAccepted === true,
      });

      if (result.success) {
        const { data } = result;

        // Check response code for specific handling
        if (data.code === AUTH_CODES.REGISTRATION_SUCCESS) {
          showAlert(t('auth.registrationSuccess'), 'success');
        } else if (data.code === AUTH_CODES.PROVIDER_ALREADY_EXISTS) {
          showAlert(t('auth.accountFoundLoggedIn'), 'info');
        }

        // Process successful auth
        const authProcessed = await handleAuthSuccess(data);

        if (!authProcessed) {
          showAlert(t('auth.registrationSessionFail'), 'warning');
        }

        // Record legal acceptance — use explicit token since authFetch may not have it stored yet
        if (termsAccepted && data.accessToken) {
          const { NODE_BASE_URL } = require('../config/api');
          try {
            await fetch(`${NODE_BASE_URL}/api/auth/accept-policies`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.accessToken}`,
              },
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
          console.error('🔍 [ProviderRegisterScreen] Full error details:', error);
        }
        
        // Handle specific error codes
        switch (error.code) {
          case AUTH_CODES.EMAIL_ALREADY_EXISTS:
            setExistingEmail(formData.email);
            setExistingAccountType(null);
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
            
          case AUTH_CODES.INVALID_PROVIDER_NAME:
          case AUTH_CODES.PROVIDER_NAME_TOO_LONG:
            setErrors({ name: error.message });
            break;
            
          case AUTH_CODES.INVALID_ADDRESS:
            setErrors({ address: error.message });
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
            showAlert(error.message || getErrorMessage(error.code), 'error', error.hint);
            break;

          default:
            showAlert(error.message || t('auth.registrationFailed'), 'error', error.hint);
        }
      }
    } catch (err) {
      console.error('❌ [ProviderRegisterScreen] Unexpected error:', err);
      showAlert(t('auth.unexpectedError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Form-mode back button — returns to choice mode rather than navigating away.
   */
  const handleBack = () => {
    if (mode === 'form') {
      setMode('choice');
      return;
    }
    navigation.goBack();
  };

  /**
   * Handle Google Sign-In for provider registration
   * Uses mode="signup" — backend will NOT login existing users
   */
  const handleGoogleSignIn = async () => {
    if (!termsAccepted) {
      showAlert(t('auth.termsRequired'), 'warning');
      return;
    }
    try {
      setGoogleLoading(true);
      clearAlert();

      console.log('🔐 [ProviderRegisterScreen] Starting Google Sign-Up as SERVICE_PROVIDER');
      
      // ✅ KEY CHANGE: Pass mode="signup" — backend rejects if already registered
      const result = await signInWithGoogleAsProvider('signup');

      if (result.success) {
        const { accessToken, refreshToken, user, isNewUser } = result.data;

        // For new providers via Google, sync to MongoDB
        // Use form data if pre-filled, otherwise rely on profile completion later
        if (isNewUser && user) {
          console.log('🆕 [ProviderRegisterScreen] New provider - syncing to MongoDB...');
          
          // Get pending referral code for Google OAuth registration
          const pendingRefCode = formData.referralCode?.trim() || await AsyncStorage.getItem('pendingReferralCode') || undefined;
          if (pendingRefCode) AsyncStorage.removeItem('pendingReferralCode');

          const syncPayload = {
            javaUserId: user.id || user.userId,
            email: user.email,
            name: user.fullName || user.name || user.email.split('@')[0],
            address: formData.address?.trim() || '',
            googleId: user.googleId,
            profilePicture: user.profilePicture,
            phone: formData.phone?.trim() || undefined,
            city: formData.city?.trim() || undefined,
            pincode: formData.pincode?.trim() || undefined,
            latitude: location?.latitude,
            longitude: location?.longitude,
            referralCode: pendingRefCode,
            termsAccepted: termsAccepted === true,
            privacyAccepted: termsAccepted === true,
          };

          let syncResult = await syncGoogleProviderToMongoDB(syncPayload, accessToken);

          // Retry once on failure — backend may still be warming up
          if (!syncResult.success) {
            console.warn('⚠️ [ProviderRegisterScreen] MongoDB sync failed, retrying in 2s...');
            await new Promise(r => setTimeout(r, 2000));
            syncResult = await syncGoogleProviderToMongoDB(syncPayload, accessToken);
          }

          if (!syncResult.success) {
            console.warn('⚠️ [ProviderRegisterScreen] MongoDB sync failed after retry, auth still succeeded');
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
          providerId: user.id || user.userId, // For provider profile fetching
          email: user.email,
          fullName: user.fullName || user.name,
          role: user.role,
          userType: 'provider',
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
          console.log('🔵 [ProviderRegisterScreen] Google Sign-In cancelled by user');
          return;
        }
        
        // Handle role conflict
        if (error.code === GOOGLE_AUTH_CODES.ROLE_CONFLICT) {
          const existingRole = error.existingRole === 'USER' ? 'User' : 'Service Provider';
          showAlert(
            t('auth.googleRoleConflict', { role: existingRole }),
            'warning'
          );
          return;
        }
        
        // ✅ Handle already registered — provider should login instead
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
      console.error('❌ [ProviderRegisterScreen] Google Sign-In error:', error);
      showAlert(t('auth.googleSignInFailed'), 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  /**
   * Process a successful Apple auth result for providers.
   * Mirrors the Google Sign-In post-signup flow exactly.
   */
  const processAppleAuthSuccess = async (resultData) => {
    const { accessToken, refreshToken, user, isNewUser } = resultData;

    if (isNewUser && user) {
      console.log('🆕 [ProviderRegisterScreen] New Apple provider - syncing to MongoDB...');

      // Get pending referral code for Apple OAuth registration (mirrors Google flow)
      const pendingRefCode = formData.referralCode?.trim() || await AsyncStorage.getItem('pendingReferralCode') || undefined;
      if (pendingRefCode) AsyncStorage.removeItem('pendingReferralCode');

      const syncPayload = {
        javaUserId: user.id || user.userId,
        email: user.email,
        name: user.fullName || user.name || user.email?.split('@')[0],
        address: formData.address?.trim() || '',
        profilePicture: user.profilePicture,
        phone: formData.phone?.trim() || undefined,
        city: formData.city?.trim() || undefined,
        pincode: formData.pincode?.trim() || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        referralCode: pendingRefCode,
        termsAccepted: termsAccepted === true,
        privacyAccepted: termsAccepted === true,
      };

      let syncResult = await syncAppleProviderToMongoDB(syncPayload, accessToken);

      // Retry once on failure — backend may still be warming up (use FULL payload, not partial)
      if (!syncResult.success) {
        console.warn('⚠️ [ProviderRegisterScreen] MongoDB sync failed, retrying in 2s...');
        await new Promise(r => setTimeout(r, 2000));
        syncResult = await syncAppleProviderToMongoDB(syncPayload, accessToken);
      }

      if (!syncResult.success) {
        console.warn('⚠️ [ProviderRegisterScreen] MongoDB sync failed after retry, auth still succeeded');
        showAlert(t('auth.appleProfileSetup') || 'Account created. Profile setup may take a moment.', 'warning');
      }
    }

    showAlert(t('auth.appleRegistrationSuccess') || 'Account created successfully!', 'success');

    const authData = {
      accessToken,
      refreshToken,
      userId: user.id || user.userId,
      javaUserId: user.id || user.userId,
      mongoId: user.id || user.userId, // Same in unified system
      providerId: user.id || user.userId, // For provider profile fetching (parity with Google flow)
      email: user.email,
      fullName: user.fullName || user.name,
      role: user.role,
      userType: 'provider',
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
   * Handle Apple Sign-In — SIGNUP MODE for providers (mirrors Google handler)
   */
  const handleAppleSignIn = async () => {
    if (!termsAccepted) {
      showAlert(t('auth.termsRequired'), 'warning');
      return;
    }
    try {
      setAppleLoading(true);
      clearAlert();

      const result = await signInWithAppleAsProvider('signup');

      if (result.success) {
        await processAppleAuthSuccess(result.data);
      } else {
        const { error } = result;
        if (error.isCancelled) return;
        if (error.code === APPLE_AUTH_CODES.NOT_AVAILABLE) return;

        // EMAIL_REQUIRED — Apple hid the email, collect it from the user
        if (error.code === APPLE_AUTH_CODES.EMAIL_REQUIRED) {
          setPendingAppleAuth({
            appleUserId: error.appleUserId,
            role: 'SERVICE_PROVIDER',
            mode: 'signup',
          });
          setShowAppleEmailModal(true);
          return;
        }

        if (error.code === APPLE_AUTH_CODES.ROLE_CONFLICT) {
          const existingRole = error.existingRole === 'USER' ? 'User' : 'Service Provider';
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
   * Callback when Apple email verification completes for providers.
   * Retries Apple auth with the verified email + verification token.
   */
  const handleAppleEmailVerified = async (verifiedEmail, verificationToken) => {
    setShowAppleEmailModal(false);

    if (!pendingAppleAuth) {
      showAlert(t('auth.appleSignInFailed'), 'error');
      return;
    }

    try {
      setAppleLoading(true);
      clearAlert();

      const retryResult = await completeAppleSignInWithVerifiedEmail({
        identityToken: null,
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
      console.error('[ProviderRegisterScreen] Apple email retry error:', err);
      showAlert(t('auth.registrationFailed'), 'error');
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
        userType="provider"
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
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color="#1E293B" />
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <FixhomiLogo size={44} />
            </View>
            <Text style={styles.brandName}>FixHomi</Text>
            <Text style={styles.title}>{t('providerRegister.becomeProvider')}</Text>
            <Text style={styles.subtitle}>
              {t('providerRegister.joinSubtitle')}
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
              label={t('providerRegister.yourName')}
              placeholder={t('providerRegister.yourNamePlaceholder')}
              value={formData.name}
              onChangeText={(value) => updateField('name', value)}
              error={errors.name}
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
              label={t('auth.phoneNumber')}
              value={formData.phone}
              onChangeText={(value) => updateField('phone', value)}
              error={errors.phone}
            />

            <Input
              label={t('providerRegister.address')}
              placeholder={t('providerRegister.addressPlaceholder')}
              value={formData.address}
              onChangeText={(value) => updateField('address', value)}
              error={errors.address}
              autoCapitalize="words"
              autoComplete="street-address"
              required
            />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Input
                  label={t('providerRegister.city')}
                  placeholder={t('providerRegister.cityPlaceholder')}
                  value={formData.city}
                  onChangeText={(value) => updateField('city', value)}
                  error={errors.city}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.halfInput}>
                <Input
                  label={t('providerRegister.pincode')}
                  placeholder={t('providerRegister.pincodePlaceholder')}
                  value={formData.pincode}
                  onChangeText={(value) => updateField('pincode', value)}
                  error={errors.pincode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>

            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <MaterialIcons name="info-outline" size={16} color="#64748B" />
                <Text style={styles.infoTitle}>{t('providerRegister.completeProfileLater')}</Text>
              </View>
              <Text style={styles.infoText}>
                {t('providerRegister.completeProfileLaterMsg')}
              </Text>
            </View>

            {/* Location Status */}
            <View style={styles.locationBox}>
              <View style={styles.locationHeader}>
                <View style={styles.locationTitleRow}>
                  <Ionicons name="location" size={15} color="#64748B" />
                  <Text style={styles.locationTitle}>{t('providerRegister.yourLocation')}</Text>
                </View>
                {locationLoading && (
                  <ActivityIndicator size="small" color="#2563EB" />
                )}
              </View>
              {location ? (
                (() => {
                  const zoneStatus = getZoneStatus(location.latitude, location.longitude);
                  return (
                    <View>
                      <View style={[styles.locationSuccess, !zoneStatus.inside && styles.locationOutOfZone]}>
                        <Ionicons
                          name={zoneStatus.inside ? 'checkmark-circle' : 'warning'}
                          size={16}
                          color={zoneStatus.inside ? '#16A34A' : '#D97706'}
                        />
                        <Text style={zoneStatus.inside ? styles.locationSuccessText : styles.locationWarningText}>
                          {zoneStatus.inside
                            ? t('providerRegister.locationDetectedInside')
                            : t('providerRegister.locationDetectedOutside')}
                        </Text>
                      </View>
                      {!zoneStatus.inside && (
                        <View style={styles.outOfZoneBanner}>
                          <Text style={styles.outOfZoneText}>
                            {t('providerRegister.locationOutOfZone', { zone: zoneStatus.zoneName })}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })()
              ) : locationError ? (
                <View style={styles.locationErrorContainer}>
                  <Text style={styles.locationErrorText}>{locationError}</Text>
                  <TouchableOpacity onPress={getCurrentLocation} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                </View>
              ) : !locationLoading ? (
                <TouchableOpacity onPress={getCurrentLocation} style={styles.getLocationButton} activeOpacity={0.7}>
                  <Ionicons name="navigate" size={14} color="#FFF" />
                  <Text style={styles.getLocationButtonText}>{t('providerRegister.detectMyLocation')}</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.locationHint}>
                {t('providerRegister.locationHint')}
              </Text>
            </View>

            {/* Referral, T&C, divider, Google + Apple — captured in the
             * RegisterChoice step. Manual-fill mode only collects the
             * provider's email/password/business details. */}

            <Button
              title={loading ? t('providerRegister.creatingAccount') : t('providerRegister.createProviderAccount')}
              onPress={handleRegister}
              loading={loading}
              disabled={loading || googleLoading || appleLoading || !termsAccepted}
              style={styles.submitButton}
            />
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
              {existingAccountType === 'user'
                ? t('auth.accountExistsUser')
                : existingAccountType === 'provider'
                ? t('auth.accountExistsProvider')
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
              >
                <Text style={styles.modalPrimaryButtonText}>
                  {existingAccountType === 'user' ? t('auth.goToProviderLogin') : t('auth.logInToAccount')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={handleForgotPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSecondaryButtonText}>{t('auth.iForgotPassword')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDismissButton}
                onPress={() => setShowAccountExistsModal(false)}
                activeOpacity={0.8}
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
              {existingAccountType === 'user'
                ? t('auth.numberRegisteredUser')
                : existingAccountType === 'provider'
                ? t('auth.numberRegisteredProvider')
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
              >
                <Text style={styles.modalPrimaryButtonText}>
                  {existingAccountType === 'user' ? t('auth.goToProviderLogin') : t('auth.logInToAccount')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDismissButton}
                onPress={handleUseDifferentPhone}
                activeOpacity={0.8}
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
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },

  // ── Info Box ──
  infoBox: {
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14,
    marginTop: 4, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoTitle: { fontSize: 13, fontWeight: '600', color: '#475569' },
  infoText: { fontSize: 12, color: '#64748B', lineHeight: 18, marginLeft: 22 },

  // ── Location Box ──
  locationBox: {
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0',
  },
  locationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  locationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationTitle: { fontSize: 13, fontWeight: '600', color: '#475569' },
  locationSuccess: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  locationSuccessText: { fontSize: 13, color: '#15803D', fontWeight: '500' },
  locationOutOfZone: {},
  locationWarningText: { fontSize: 13, color: '#92400E', fontWeight: '500' },
  outOfZoneBanner: {
    backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10, marginTop: 6, marginBottom: 4,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  outOfZoneText: { fontSize: 12, color: '#92400E', lineHeight: 17 },
  locationErrorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  locationErrorText: { fontSize: 13, color: '#EF4444', flex: 1 },
  retryButton: {
    backgroundColor: '#2b76bc', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, marginLeft: 8,
  },
  retryButtonText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  getLocationButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#2b76bc', paddingVertical: 9, borderRadius: 10,
    alignSelf: 'flex-start', paddingHorizontal: 16, marginBottom: 4,
  },
  getLocationButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  locationHint: { fontSize: 11, color: '#94A3B8', marginTop: 6 },

  // ── Submit Button ──
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

export default ProviderRegisterScreen;
