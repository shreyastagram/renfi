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

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  PermissionsAndroid,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import { Button, Input, Alert, FixhomiLogo } from '../components';
import { registerProvider, getErrorMessage, AUTH_CODES } from '../services/authService';
import { validateProviderRegistrationForm } from '../utils/validation';
import { useApp } from '../context/AppContext';
import {
  signInWithGoogleAsProvider,
  syncGoogleProviderToMongoDB,
  GOOGLE_AUTH_CODES,
  getGoogleAuthErrorMessage,
} from '../services/googleAuthService';
import { isInsideServiceZone, getZoneStatus } from '../utils/serviceZone';

/**
 * ProviderRegisterScreen Component
 * 
 * @param {Object} props - Navigation props
 */
const ProviderRegisterScreen = ({ navigation }) => {
  const { handleAuthSuccess } = useApp();

  // Form state - required and common optional fields
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    address: '',
    city: '',
    pincode: '',
    phone: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');

  // Account exists modal state
  const [showAccountExistsModal, setShowAccountExistsModal] = useState(false);
  const [existingEmail, setExistingEmail] = useState('');
  
  // Phone already registered modal state
  const [showPhoneExistsModal, setShowPhoneExistsModal] = useState(false);
  const [existingPhone, setExistingPhone] = useState('');

  // Location state
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);

  /**
   * Navigate to login with pre-filled email
   */
  const handleGoToLogin = useCallback(() => {
    setShowAccountExistsModal(false);
    navigation.navigate('ProviderAuth', { 
      initialTab: 'login',
      prefillEmail: existingEmail 
    });
  }, [navigation, existingEmail]);

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
    navigation.navigate('ProviderAuth', { 
      initialTab: 'login' 
    });
  }, [navigation]);

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
            title: 'Location Permission',
            message: 'FixHomi needs your location to show you to nearby customers.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
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
      setLocationError('Location permission denied');
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
          setLocationError('Location services are turned off. Please enable GPS.');
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
              setLocationError('Location services are turned off. Please enable GPS.');
            } else {
              setLocationError('Could not get location. You can retry or continue without it.');
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
  }, [errors, alertMessage]);

  /**
   * Show alert message
   * @param {string} message - Alert message
   * @param {string} type - Alert type (error, success, warning, info)
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
        showAlert('Please fix the errors below', 'warning');
        return;
      }

      // Start loading
      setLoading(true);

      // Warn if no location but don't block registration
      if (!location) {
        console.warn('⚠️ No location available for registration');
      }

      // Call register API with location
      const result = await registerProvider({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        address: formData.address,
        city: formData.city || undefined,
        pincode: formData.pincode || undefined,
        phone: formData.phone || undefined,
        // Include GPS coordinates if available
        latitude: location?.latitude,
        longitude: location?.longitude,
      });

      if (result.success) {
        const { data } = result;

        // Check response code for specific handling
        if (data.code === AUTH_CODES.REGISTRATION_SUCCESS) {
          showAlert('Registration successful! Welcome to FixHomi.', 'success');
        } else if (data.code === AUTH_CODES.PROVIDER_ALREADY_EXISTS) {
          showAlert('Account found. You have been logged in.', 'info');
        }

        // Process successful auth
        const authProcessed = await handleAuthSuccess(data);
        
        if (!authProcessed) {
          showAlert('Registration successful but failed to save session. Please login.', 'warning');
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
            // Industry-grade UX: Show modal with login/reset options
            setExistingEmail(formData.email);
            setShowAccountExistsModal(true);
            setErrors({ email: 'This email is already registered' });
            break;
            
          case AUTH_CODES.PHONE_ALREADY_EXISTS:
            // Industry-grade UX: Show modal with options (like Zomato/Uber)
            setExistingPhone(formData.phone);
            setShowPhoneExistsModal(true);
            setErrors({ phone: 'This mobile number is already registered' });
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
            showAlert(getErrorMessage(error.code, error.message), 'error');
            break;
            
          case AUTH_CODES.NETWORK_ERROR:
            showAlert(getErrorMessage(error.code, error.message), 'error');
            break;
            
          default:
            showAlert(error.message || 'Registration failed. Please try again.', 'error');
        }
      }
    } catch (err) {
      console.error('❌ [ProviderRegisterScreen] Unexpected error:', err);
      showAlert('An unexpected error occurred. Please try again.', 'error');
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
   * Handle Google Sign-In for provider registration
   * Uses mode="signup" — backend will NOT login existing users
   */
  const handleGoogleSignIn = async () => {
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
          
          const syncResult = await syncGoogleProviderToMongoDB({
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
          });

          if (!syncResult.success) {
            console.warn('⚠️ [ProviderRegisterScreen] MongoDB sync failed, but auth succeeded');
          }
        }

        showAlert('Registration successful!', 'success');
        
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
          showAlert('Registration successful but failed to save session.', 'warning');
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
            `This email is already registered as a ${existingRole}. Each email can only be used for one account type.`,
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
            'An account with this email already exists. Please login with your password.',
            'info'
          );
          return;
        }
        
        const errorMessage = getGoogleAuthErrorMessage(error.code, error.message);
        showAlert(errorMessage, 'error');
      }
    } catch (error) {
      console.error('❌ [ProviderRegisterScreen] Google Sign-In error:', error);
      showAlert('Google Sign-In failed. Please try again.', 'error');
    } finally {
      setGoogleLoading(false);
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
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <FixhomiLogo size={52} color="#f67c16" />
            <Text style={styles.brandName}>FixHomi</Text>
            <Text style={styles.title}>Become a Provider</Text>
            <Text style={styles.subtitle}>
              Join FixHomi and start earning by providing home services
            </Text>
          </View>

          {/* Alert Message */}
          {alertMessage && (
            <Alert
              type={alertType}
              message={alertMessage}
              onClose={clearAlert}
            />
          )}

          {/* Registration Form */}
          <View style={styles.form}>
            <Input
              label="Your Name"
              placeholder="Enter your full name"
              value={formData.name}
              onChangeText={(value) => updateField('name', value)}
              error={errors.name}
              autoCapitalize="words"
              autoComplete="name"
              required
            />

            <Input
              label="Email"
              placeholder="Enter your email"
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              placeholder="Create a password (min 8 characters)"
              value={formData.password}
              onChangeText={(value) => updateField('password', value)}
              error={errors.password}
              secureTextEntry
              autoComplete="password-new"
              required
            />

            <Input
              label="Phone Number"
              placeholder="Enter your phone number"
              value={formData.phone}
              onChangeText={(value) => updateField('phone', value)}
              error={errors.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />

            <Input
              label="Address"
              placeholder="Enter your address"
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
                  label="City"
                  placeholder="City"
                  value={formData.city}
                  onChangeText={(value) => updateField('city', value)}
                  error={errors.city}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.halfInput}>
                <Input
                  label="Pincode"
                  placeholder="Pincode"
                  value={formData.pincode}
                  onChangeText={(value) => updateField('pincode', value)}
                  error={errors.pincode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>ℹ️ Complete your profile later</Text>
              <Text style={styles.infoText}>
                After registration, you can add service categories, experience, 
                working hours, and verification documents in your profile.
              </Text>
            </View>

            {/* Location Status */}
            <View style={styles.locationBox}>
              <View style={styles.locationHeader}>
                <Text style={styles.locationTitle}>📍 Your Location</Text>
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
                        <Text style={zoneStatus.inside ? styles.locationSuccessIcon : styles.locationWarningIcon}>
                          {zoneStatus.inside ? '✓' : '⚠'}
                        </Text>
                        <Text style={zoneStatus.inside ? styles.locationSuccessText : styles.locationWarningText}>
                          {zoneStatus.inside 
                            ? 'Location detected — within service area' 
                            : 'Location detected — outside service area'}
                        </Text>
                      </View>
                      {!zoneStatus.inside && (
                        <View style={styles.outOfZoneBanner}>
                          <Text style={styles.outOfZoneText}>
                            FixHomi is currently available only in {zoneStatus.zoneName}. 
                            You can still register, but you won't receive service requests until 
                            you're within the service area.
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
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : !locationLoading ? (
                <TouchableOpacity onPress={getCurrentLocation} style={styles.getLocationButton}>
                  <Text style={styles.getLocationButtonText}>Detect My Location</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.locationHint}>
                Your location helps customers find you nearby
              </Text>
            </View>

            <Button
              title={loading ? 'Creating Account...' : 'Create Provider Account'}
              onPress={handleRegister}
              loading={loading}
              disabled={loading || googleLoading}
              style={styles.submitButton}
            />

            {/* Social Login Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or register with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              style={[
                styles.googleButton,
                (loading || googleLoading) && styles.googleButtonDisabled
              ]}
              onPress={handleGoogleSignIn}
              disabled={loading || googleLoading}
              activeOpacity={0.7}
            >
              {googleLoading ? (
                <Text style={styles.googleButtonText}>Signing up...</Text>
              ) : (
                <>
                  <View style={styles.googleIconContainer}>
                    <Text style={styles.googleIcon}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By creating an account, you agree to our{' '}
              <Text style={styles.link}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.link}>Privacy Policy</Text>
            </Text>
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
            <Text style={styles.modalIcon}>👋</Text>
            <Text style={styles.modalTitle}>Welcome Back!</Text>
            <Text style={styles.modalEmail}>{existingEmail}</Text>
            <Text style={styles.modalMessage}>
              An account with this email already exists. Would you like to log in instead?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalPrimaryButton}
                onPress={handleGoToLogin}
                activeOpacity={0.8}
              >
                <Text style={styles.modalPrimaryButtonText}>Log In to My Account</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalSecondaryButton}
                onPress={handleForgotPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSecondaryButtonText}>I Forgot My Password</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalDismissButton}
                onPress={() => setShowAccountExistsModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalDismissText}>Use a Different Email</Text>
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
            <Text style={styles.modalTitle}>Number Already Registered</Text>
            <Text style={styles.modalEmail}>{existingPhone}</Text>
            <Text style={styles.modalMessage}>
              This mobile number is already associated with another account. Would you like to log in instead, or use a different number?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalPrimaryButton}
                onPress={handlePhoneGoToLogin}
                activeOpacity={0.8}
              >
                <Text style={styles.modalPrimaryButtonText}>Log In to My Account</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalDismissButton}
                onPress={handleUseDifferentPhone}
                activeOpacity={0.8}
              >
                <Text style={styles.modalDismissText}>Use a Different Number</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f67c16',
    marginTop: 8,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
  },
  locationBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
  },
  locationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationSuccessIcon: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 6,
  },
  locationSuccessText: {
    fontSize: 13,
    color: '#15803D',
  },
  locationOutOfZone: {
    borderColor: '#FDE68A',
  },
  locationWarningIcon: {
    color: '#D97706',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 6,
  },
  locationWarningText: {
    fontSize: 13,
    color: '#92400E',
  },
  outOfZoneBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  outOfZoneText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  locationErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  locationErrorText: {
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  getLocationButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 4,
  },
  getLocationButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  locationHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
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
    marginBottom: 8,
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
    backgroundColor: '#059669',
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
});

export default ProviderRegisterScreen;
