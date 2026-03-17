/**
 * Login Screen
 * 
 * User login form with email/password authentication
 * Direct call to Java Auth service
 * Supports Google OAuth Sign-In
 * 
 * @version 2.0.0
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
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Alert, FixhomiLogo } from '../components';
import { loginWithEmail, getErrorMessage, AUTH_CODES } from '../services/authService';
import {
  signInWithGoogleAsUser,
  signInWithGoogleAsProvider,
  syncGoogleUserToMongoDB,
  syncGoogleProviderToMongoDB,
  GOOGLE_AUTH_CODES,
  getGoogleAuthErrorMessage,
} from '../services/googleAuthService';
import {
  signInWithAppleAsUser,
  signInWithAppleAsProvider,
  syncAppleUserToMongoDB,
  syncAppleProviderToMongoDB,
  APPLE_AUTH_CODES,
  getAppleAuthErrorMessage,
} from '../services/appleAuthService';
import { validateEmail, validatePassword } from '../utils/validation';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

/**
 * LoginScreen Component
 *
 * @param {Object} props - Navigation props
 */
const LoginScreen = ({ navigation, onSwitchToRegister, onSwitchToOtp, userType = 'user' }) => {
  const { handleAuthSuccess } = useApp();
  const { t } = useLanguage();

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [alertHint, setAlertHint] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Cross-role dialog state
  const [showRoleConflictModal, setShowRoleConflictModal] = useState(false);
  const [conflictExistingRole, setConflictExistingRole] = useState('');
  const [conflictGoogleData, setConflictGoogleData] = useState(null);

  /**
   * Update form field
   */
  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
    if (alertMessage) {
      setAlertMessage(null);
    }
  }, [errors, alertMessage]);

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
   * Validate form
   */
  const validateForm = () => {
    const newErrors = {};
    
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) newErrors.email = emailValidation.error;
    
    if (!formData.password) {
      newErrors.password = t('auth.passwordRequired');
    }
    
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
    };
  };

  /**
   * Handle login submit
   */
  const handleLogin = async () => {
    try {
      setErrors({});
      clearAlert();

      const validation = validateForm();
      if (!validation.isValid) {
        setErrors(validation.errors);
        showAlert(t('auth.formErrors'), 'warning');
        return;
      }

      setLoading(true);

      const result = await loginWithEmail(formData.email, formData.password);

      if (result.success) {
        // Validate that the user's actual role matches the screen they're signing in from
        const backendRole = result.data?.role;
        const expectedRole = userType === 'provider' ? 'SERVICE_PROVIDER' : 'USER';
        if (backendRole && backendRole !== expectedRole && backendRole !== 'ADMIN') {
          const correctScreen = backendRole === 'SERVICE_PROVIDER' ? 'provider' : 'user';
          showAlert(
            t('auth.roleMismatch', { role: correctScreen }),
            'error'
          );
          setLoading(false);
          return;
        }

        showAlert(t('auth.loginSuccess'), 'success');

        // Add userType to auth data
        const authData = {
          ...result.data,
          userType,
        };

        const authProcessed = await handleAuthSuccess(authData);

        if (!authProcessed) {
          showAlert(t('auth.sessionSaveWarning'), 'warning');
        }
      } else {
        const { error } = result;

        switch (error.code) {
          case AUTH_CODES.INVALID_CREDENTIALS:
            showAlert(t('auth.invalidCredentials'), 'error');
            break;

          case AUTH_CODES.USER_NOT_FOUND:
            showAlert(t('auth.userNotFound'), 'error');
            break;

          case AUTH_CODES.ACCOUNT_DISABLED:
            showAlert(t('auth.accountDisabled'), 'error');
            break;

          case AUTH_CODES.ACCOUNT_LOCKED:
            showAlert(t('auth.accountLocked'), 'warning');
            break;

          case AUTH_CODES.EMAIL_NOT_VERIFIED:
            showAlert(t('auth.emailNotVerified'), 'warning');
            break;
            
          case AUTH_CODES.NETWORK_ERROR:
          case AUTH_CODES.SERVER_UNREACHABLE:
          case AUTH_CODES.SERVER_TIMEOUT:
          case AUTH_CODES.NO_INTERNET:
            showAlert(error.message || getErrorMessage(error.code), 'error', error.hint);
            break;

          default:
            showAlert(error.message || t('auth.loginFailed'), 'error', error.hint);
        }
      }
    } catch (error) {
      console.error('❌ [LoginScreen] Unexpected error:', error);
      showAlert(t('auth.unexpectedError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Google Sign-In — LOGIN MODE ONLY
   * Does NOT auto-register new users. If not registered, tells them to signup.
   * Handles cross-role conflicts with a user-friendly dialog.
   */
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      clearAlert();

      const isProvider = userType === 'provider';
      console.log(`🔐 [LoginScreen] Starting Google Login as ${isProvider ? 'PROVIDER' : 'USER'}`);
      
      // ✅ KEY CHANGE: Pass mode="login" — backend will NOT auto-register
      const result = isProvider 
        ? await signInWithGoogleAsProvider('login')
        : await signInWithGoogleAsUser('login');

      if (result.success) {
        const { accessToken, refreshToken, user, isNewUser } = result.data;

        // Validate role matches the screen before proceeding
        const googleRole = user?.role;
        const expectedRole = userType === 'provider' ? 'SERVICE_PROVIDER' : 'USER';
        if (googleRole && googleRole !== expectedRole && googleRole !== 'ADMIN') {
          const correctScreen = googleRole === 'SERVICE_PROVIDER' ? 'provider' : 'user';
          showAlert(
            t('auth.roleMismatch', { role: correctScreen }),
            'error'
          );
          setGoogleLoading(false);
          return;
        }

        showAlert(t('auth.loginSuccess'), 'success');

        // ✅ For LOGIN, user must already exist in MongoDB (registered via signup)
        // Only do a lightweight sync to ensure MongoDB profile is up-to-date
        if (user) {
          console.log(`🔄 [LoginScreen] Ensuring MongoDB profile exists for ${isProvider ? 'provider' : 'user'}...`);
          
          const syncData = {
            javaUserId: user.userId,
            email: user.email,
            fullName: user.fullName,
            googleId: user.googleId,
            profilePicture: user.profilePicture,
          };
          
          try {
            let syncOk = false;
            for (let attempt = 1; attempt <= 2 && !syncOk; attempt++) {
              try {
                if (isProvider) {
                  await syncGoogleProviderToMongoDB({
                    ...syncData,
                    name: user.fullName,
                    address: '',
                  }, accessToken);
                } else {
                  await syncGoogleUserToMongoDB(syncData, accessToken);
                }
                syncOk = true;
                console.log('✅ [LoginScreen] MongoDB profile sync OK');
              } catch (err) {
                if (attempt < 2) {
                  console.warn(`⚠️ [LoginScreen] MongoDB sync attempt ${attempt} failed, retrying in 2s...`);
                  await new Promise(r => setTimeout(r, 2000));
                } else {
                  throw err;
                }
              }
            }
          } catch (syncError) {
            console.warn('⚠️ [LoginScreen] MongoDB sync failed after retry:', syncError.message);
            // Don't fail login — auth middleware auto-sync will handle it
          }
        }
        
        const authData = {
          accessToken: accessToken,
          refreshToken: refreshToken,
          userId: user.userId,
          javaUserId: user.userId,
          mongoId: user.userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          userType: userType,
          isNewUser: isNewUser,
          authMethod: 'google',
        };
        
        const authProcessed = await handleAuthSuccess(authData);
        
        if (!authProcessed) {
          showAlert(t('auth.sessionSaveWarning'), 'warning');
        }
      } else {
        const { error } = result;

        // Don't show error for cancelled sign-in
        if (error.isCancelled) {
          console.log('🔵 [LoginScreen] Google Sign-In cancelled by user');
          return;
        }
        
        // ✅ NOT REGISTERED — user needs to sign up first
        if (error.code === GOOGLE_AUTH_CODES.NOT_REGISTERED) {
          showAlert(
            t('auth.googleNotRegistered'),
            'warning'
          );
          return;
        }
        
        // ✅ CROSS-ROLE CONFLICT — show dialog to switch role
        if (error.code === GOOGLE_AUTH_CODES.ROLE_CONFLICT) {
          const existingRole = error.existingRole || '';
          setConflictExistingRole(existingRole);
          setShowRoleConflictModal(true);
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
      console.error('❌ [LoginScreen] Google Sign-In error:', error);
      showAlert(t('auth.googleSignInFailed'), 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  /**
   * Handle "Yes, proceed" from cross-role conflict dialog.
   * Navigates user to the correct auth screen for their existing role.
   */
  const handleRoleConflictProceed = useCallback(() => {
    setShowRoleConflictModal(false);
    const isExistingUser = conflictExistingRole === 'USER';
    if (isExistingUser && userType === 'provider') {
      // They're a User but on Provider login — navigate to User login
      navigation?.navigate?.('UserAuth');
    } else if (!isExistingUser && userType === 'user') {
      // They're a Provider but on User login — navigate to Provider login
      navigation?.navigate?.('ProviderAuth');
    }
  }, [conflictExistingRole, userType, navigation]);

  /**
   * Handle Apple Sign-In — LOGIN MODE ONLY (mirrors Google handler)
   */
  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);
      clearAlert();

      const isProvider = userType === 'provider';
      const result = isProvider
        ? await signInWithAppleAsProvider('login')
        : await signInWithAppleAsUser('login');

      if (result.success) {
        const { accessToken, refreshToken, user, isNewUser } = result.data;

        const googleRole = user?.role;
        const expectedRole = userType === 'provider' ? 'SERVICE_PROVIDER' : 'USER';
        if (googleRole && googleRole !== expectedRole && googleRole !== 'ADMIN') {
          const correctScreen = googleRole === 'SERVICE_PROVIDER' ? 'provider' : 'user';
          showAlert(t('auth.roleMismatch', { role: correctScreen }), 'error');
          setAppleLoading(false);
          return;
        }

        showAlert(t('auth.loginSuccess'), 'success');

        // Sync profile to MongoDB (reuses same Google sync endpoints)
        if (user) {
          const syncData = {
            javaUserId: user.userId,
            email: user.email,
            fullName: user.fullName,
          };
          try {
            if (isProvider) {
              await syncAppleProviderToMongoDB({ ...syncData, name: user.fullName, address: '' }, accessToken);
            } else {
              await syncAppleUserToMongoDB(syncData, accessToken);
            }
          } catch (syncError) {
            // Don't fail login — auth middleware auto-sync handles it
          }
        }

        const authData = {
          accessToken,
          refreshToken,
          userId: user.userId,
          javaUserId: user.userId,
          mongoId: user.userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          userType,
          isNewUser,
          authMethod: 'apple',
        };

        const authProcessed = await handleAuthSuccess(authData);
        if (!authProcessed) {
          showAlert(t('auth.sessionSaveWarning'), 'warning');
        }
      } else {
        const { error } = result;
        if (error.isCancelled) return;

        if (error.code === APPLE_AUTH_CODES.NOT_REGISTERED) {
          showAlert(t('auth.appleNotRegistered') || 'No account found. Please register first.', 'warning');
          return;
        }
        if (error.code === APPLE_AUTH_CODES.ROLE_CONFLICT) {
          const existingRole = error.existingRole || '';
          setConflictExistingRole(existingRole);
          setShowRoleConflictModal(true);
          return;
        }
        if (error.code === APPLE_AUTH_CODES.NOT_AVAILABLE) return; // Android — button not shown

        const errorMessage = getAppleAuthErrorMessage(error.code, error.message);
        showAlert(errorMessage, 'error');
      }
    } catch (error) {
      showAlert(t('auth.appleSignInFailed') || 'Apple Sign-In failed. Please try again.', 'error');
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <FixhomiLogo size={52} />
            </View>
            <Text style={styles.brandName}>FixHomi</Text>
            <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
            <Text style={styles.subtitle}>
              {userType === 'provider' ? t('auth.signInProvider') : t('auth.signInContinue')}
            </Text>
          </View>

          {/* Alert */}
          {alertMessage && (
            <Alert
              type={alertType}
              message={alertMessage}
              hint={alertHint}
              onDismiss={clearAlert}
              style={styles.alert}
            />
          )}

          {/* Form */}
          <View style={styles.form}>
            <Input
              label={t('auth.email')}
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              placeholder={t('auth.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
              editable={!loading}
              required
            />

            <Input
              label={t('auth.password')}
              value={formData.password}
              onChangeText={(value) => updateField('password', value)}
              placeholder={t('auth.passwordPlaceholder')}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              error={errors.password}
              editable={!loading && !googleLoading}
              rightIcon={showPassword ? 'eye-off' : 'eye'}
              onRightIconPress={() => setShowPassword(!showPassword)}
              required
            />

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation?.navigate?.('ForgotPassword')}
              disabled={loading || googleLoading || appleLoading}
              accessibilityLabel="Forgot password"
              accessibilityRole="link"
            >
              <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>

            <Button
              title={loading ? t('auth.signingIn') : t('auth.signIn')}
              onPress={handleLogin}
              loading={loading}
              disabled={loading || googleLoading || appleLoading}
              style={styles.submitButton}
            />

            {/* Social Login Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.orContinueWith')}</Text>
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
              accessibilityLabel="Continue with Google"
              accessibilityRole="button"
            >
              {googleLoading ? (
                <Text style={styles.googleButtonText}>{t('auth.signingInGoogle')}</Text>
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
                accessibilityLabel="Continue with Apple"
                accessibilityRole="button"
              >
                {appleLoading ? (
                  <Text style={styles.appleButtonText}>{t('auth.signingInApple') || 'Signing in...'}</Text>
                ) : (
                  <>
                    <Text style={styles.appleIcon}>{'\uF8FF'}</Text>
                    <Text style={styles.appleButtonText}>{t('auth.continueWithApple') || 'Continue with Apple'}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* OTP Login Option */}
            <Button
              title={t('auth.signInWithOtp')}
              onPress={onSwitchToOtp}
              variant="outline"
              disabled={loading || googleLoading || appleLoading}
              style={styles.otpButton}
            />
          </View>

          {/* Register Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
            <TouchableOpacity onPress={onSwitchToRegister} disabled={loading} accessibilityLabel="Register for a new account" accessibilityRole="link">
              <Text style={styles.linkText}>{t('auth.register')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Cross-Role Conflict Dialog */}
      <Modal
        visible={showRoleConflictModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRoleConflictModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>🔄</Text>
            <Text style={styles.modalTitle}>{t('auth.differentAccountType')}</Text>
            <Text style={styles.modalMessage}>
              {conflictExistingRole === 'USER'
                ? t('auth.accountRegisteredUser')
                : t('auth.accountRegisteredProvider')}
              {'\n\n'}
              {t('auth.proceedLogin', { role: conflictExistingRole === 'USER' ? 'User' : 'Service Provider' })}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={handleRoleConflictProceed}
                activeOpacity={0.8}
                accessibilityLabel="Yes, proceed with login"
                accessibilityRole="button"
              >
                <Text style={styles.modalPrimaryButtonText}>
                  {conflictExistingRole === 'USER' ? t('auth.yesLoginUser') : t('auth.yesLoginProvider')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDismissButton}
                onPress={() => setShowRoleConflictModal(false)}
                activeOpacity={0.8}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
              >
                <Text style={styles.modalDismissText}>{t('common.cancel')}</Text>
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
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 22,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#f67c16',
    marginTop: 12,
    marginBottom: 16,
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
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
  form: {
    gap: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  submitButton: {
    marginTop: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#9CA3AF',
    fontSize: 14,
  },
  // Google Button Styles
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  // Apple Button Styles
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
  otpButton: {
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    gap: 4,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  linkText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  // Cross-role conflict modal styles
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
    marginBottom: 12,
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
  modalDismissButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  modalDismissText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});

export default LoginScreen;
