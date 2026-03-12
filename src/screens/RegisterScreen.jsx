/**
 * Register Screen
 * 
 * User registration form with Node.js API integration
 * Validates input and displays appropriate feedback based on API responses
 * Supports Google OAuth Sign-In for quick registration
 * 
 * @version 2.1.0
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Alert, FixhomiLogo } from '../components';
import { registerUser, getErrorMessage, AUTH_CODES } from '../services/authService';
import { validateRegistrationForm } from '../utils/validation';
import { useApp } from '../context/AppContext';
import {
  signInWithGoogleAsUser,
  syncGoogleUserToMongoDB,
  GOOGLE_AUTH_CODES,
  getGoogleAuthErrorMessage,
} from '../services/googleAuthService';

/**
 * RegisterScreen Component
 * 
 * @param {Object} props - Navigation props
 */
const RegisterScreen = ({ navigation }) => {
  const { handleAuthSuccess } = useApp();

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
   * Navigate to login with pre-filled email
   */
  const handleGoToLogin = useCallback(() => {
    setShowAccountExistsModal(false);
    navigation.navigate('UserAuth', { 
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
    navigation.navigate('UserAuth', { 
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
        showAlert('Please fix the errors below', 'warning');
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
        // Location can be added here if needed
        // location: { lat: 0, lng: 0 }
      });

      if (result.success) {
        const { data } = result;

        // Check response code for specific handling
        if (data.code === AUTH_CODES.REGISTRATION_SUCCESS) {
          showAlert('Registration successful! Welcome to FixHomi.', 'success');
        } else if (data.code === AUTH_CODES.USER_ALREADY_EXISTS) {
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
          console.error('🔍 [RegisterScreen] Full error details:', error);
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
            showAlert(error.message || 'Registration failed. Please try again.', 'error', error.hint);
        }
      }
    } catch (err) {
      console.error('❌ [RegisterScreen] Unexpected error:', err);
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
   * Handle Google Sign-In for registration
   * Uses mode="signup" — backend will NOT login existing users
   */
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      clearAlert();

      console.log('🔐 [RegisterScreen] Starting Google Sign-Up as USER');
      
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
            showAlert('Your account is ready! Profile setup will complete shortly.', 'warning');
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
          email: user.email,
          fullName: user.fullName || user.name,
          role: user.role,
          userType: 'user',
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
          console.log('🔵 [RegisterScreen] Google Sign-In cancelled by user');
          return;
        }
        
        // Handle role conflict
        if (error.code === GOOGLE_AUTH_CODES.ROLE_CONFLICT) {
          const existingRole = error.existingRole === 'SERVICE_PROVIDER' ? 'Service Provider' : 'User';
          showAlert(
            `This email is already registered as a ${existingRole}. Each email can only be used for one account type.`,
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
            'An account with this email already exists. Please login with your password.',
            'info'
          );
          return;
        }
        
        const errorMessage = getGoogleAuthErrorMessage(error.code, error.message);
        showAlert(errorMessage, 'error');
      }
    } catch (error) {
      console.error('❌ [RegisterScreen] Google Sign-In error:', error);
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
            <FixhomiLogo size={56} color="#f67c16" />
            <Text style={styles.brandName}>FixHomi</Text>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join FixHomi and get access to trusted home services
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
              label="Full Name"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChangeText={(value) => updateField('fullName', value)}
              error={errors.fullName}
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
              label="Phone Number (Optional)"
              placeholder="Enter your phone number"
              value={formData.phone}
              onChangeText={(value) => updateField('phone', value)}
              error={errors.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />

            <Button
              title={loading ? 'Creating Account...' : 'Create Account'}
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
});

export default RegisterScreen;
