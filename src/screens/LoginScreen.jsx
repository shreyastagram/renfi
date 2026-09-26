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
import {  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../components/Screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Button, Input, Alert, FixhomiLogo } from '../components';
import GoogleLogo from '../components/GoogleLogo';
import LinearGradient from 'react-native-linear-gradient';
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
import {
  useThemedStyles,
  useThemeColors,
  stableDark,
  brandTint,
  vendor,
} from '../theme';

/**
 * LoginScreen Component
 *
 * @param {Object} props - Navigation props
 */
const LoginScreen = ({ navigation, onSwitchToRegister, onSwitchToOtp, userType = 'user' }) => {
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const { handleAuthSuccess } = useApp();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  // Theme colors per flow — orange for the user side, blue for the provider side.
  // Used by the OTP pill, Register CTA, and Forgot-password link so each flow
  // reads visually distinct (matches the cards on UserTypeScreen).
  const isProvider = userType === 'provider';
  const themeColor = isProvider ? C.info : C.warning;
  const themeColorTint = isProvider ? C.infoBg : C.warningBg;

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

        const appleRole = user?.role;
        const expectedRole = userType === 'provider' ? 'SERVICE_PROVIDER' : 'USER';
        if (appleRole && appleRole !== expectedRole && appleRole !== 'ADMIN') {
          const correctScreen = appleRole === 'SERVICE_PROVIDER' ? 'provider' : 'user';
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
          showAlert(t('auth.appleNotRegistered'), 'warning');
          return;
        }
        if (error.code === APPLE_AUTH_CODES.EMAIL_REQUIRED) {
          showAlert(t('auth.appleNotRegistered'), 'warning');
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
      showAlert(t('auth.appleSignInFailed'), 'error');
    } finally {
      setAppleLoading(false);
    }
  };

  const anyLoading = loading || googleLoading || appleLoading;

  return (
    <Screen style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          {/* Header — compact */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <FixhomiLogo size={44} />
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

            {/* Forgot Password — between password and sign-in */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation?.navigate?.('ForgotPassword')}
              disabled={anyLoading}
              accessibilityLabel="Forgot password"
              accessibilityRole="link"
            >
              <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>

            <Button
              title={loading ? t('auth.signingIn') : t('auth.signIn')}
              onPress={handleLogin}
              loading={loading}
              disabled={anyLoading}
              style={styles.submitButton}
            />

            {/* Row 1: Google (gradient border, logo only) + OTP (theme border, text only) */}
            <View style={styles.socialRow}>
              {/* Google — white inside, Google rainbow gradient border, subtle top glare */}
              <TouchableOpacity
                style={[styles.googleWrap, anyLoading && styles.disabled]}
                onPress={handleGoogleSignIn}
                disabled={anyLoading}
                activeOpacity={0.7}
                accessibilityLabel="Continue with Google"
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={[vendor.googleRed, vendor.googleYellow, vendor.googleGreen, vendor.googleBlue]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.googleGradientBorder}
                >
                  <View style={styles.googleWhiteInner}>
                    {/* Subtle glare — soft white highlight at the top */}
                    <LinearGradient
                      colors={[stableDark.inkSoft, stableDark.inkSoftFade]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.googleGlare}
                      pointerEvents="none"
                    />
                    {googleLoading ? (
                      <ActivityIndicator size="small" color={vendor.googleBlue} />
                    ) : (
                      <GoogleLogo size={26} />
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* OTP — white bg, theme-color border + text/icon, no tint */}
              <TouchableOpacity
                style={[
                  styles.halfPill,
                  { borderColor: themeColor },
                  anyLoading && styles.disabled,
                ]}
                onPress={onSwitchToOtp}
                disabled={anyLoading}
                activeOpacity={0.7}
                accessibilityLabel="OTP Login"
                accessibilityRole="button"
              >
                <MaterialIcons name="sms" size={18} color={C.text} />
                <Text style={[styles.otpPillText, { color: C.text }]} numberOfLines={1}>
                  {t('auth.otpLogin') || 'OTP Login'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Row 2: Apple full-width — iOS only (Apple App Store guideline 4.8) */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.applePill, anyLoading && styles.disabled]}
                onPress={handleAppleSignIn}
                disabled={anyLoading}
                activeOpacity={0.7}
                accessibilityLabel="Continue with Apple"
                accessibilityRole="button"
              >
                {appleLoading ? (
                  <ActivityIndicator size="small" color={C.onPrimary} />
                ) : (
                  <>
                    <Text style={styles.appleGlyph}>{'\uF8FF'}</Text>
                    <Text style={styles.applePillText}>{t('auth.continueWithApple')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Visual break separating sign-in section from the Register CTA */}
          <View style={styles.breakLine} />

          {/* Register CTA — sits right below the break, no big gap */}
          <View style={styles.registerCtaWrap}>
            <Text style={styles.registerHint}>{t('auth.noAccount')}</Text>
            <TouchableOpacity
              onPress={onSwitchToRegister}
              disabled={loading}
              activeOpacity={0.85}
              style={[styles.registerCtaBtn, { borderColor: themeColor, backgroundColor: themeColorTint }]}
              accessibilityLabel="Create a new account"
              accessibilityRole="button"
            >
              <Text style={[styles.registerCtaText, { color: themeColor }]}>{t('auth.register')}</Text>
              <MaterialIcons name="arrow-forward" size={18} color={themeColor} />
            </TouchableOpacity>
          </View>
        </View>
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
            <View style={styles.modalIconCircle}>
              <MaterialIcons name="swap-horiz" size={28} color={C.warning} />
            </View>
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
    </Screen>
  );
};

const makeC = (c) => ({
  primary: c.brandOrange,
  onPrimary: c.onBrandOrange,
  secondary: c.brandBlue,
  onSecondary: c.onBrandBlue,
  white: c.surface,
  bg: c.bg,
  sunken: c.surfaceSunken,
  // The shipped neutral hairline was #F1F5F9 -- exactly `bg` in light, and a recessed
  // seam on a dark surface.
  hairline: c.bg,
  line: c.border,
  borderMedium: c.borderMedium,
  text: c.textStrong,
  textDark: c.textPrimary,
  textBody: c.textBody,
  textSecondary: c.textSecondary,
  muted: c.textMuted,
  info: c.info,
  infoBg: c.infoContainer,
  infoFill: c.infoFill,
  indigo: c.altBlueIndigo,
  success: c.success,
  successBg: c.successContainer,
  successFill: c.successFill,
  danger: c.danger,
  onDanger: c.onDanger,
  dangerBg: c.dangerContainer,
  dangerFill: c.dangerFill,
  dangerLine: c.dangerBorder,
  warning: c.warning,
  warningBg: c.warningContainer,
  overlay: c.overlay,
  shadow: c.shadow,
});

const makeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  // ── Layout (full-height flex, no scroll) ──
  container: { flex: 1, backgroundColor: C.white },
  keyboardView: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  flexSpacer: { flex: 1, minHeight: 12 },
  breakLine: { height: 1, backgroundColor: C.line, marginVertical: 14 },

  // ── Header (compact) ──
  header: { marginBottom: 20, alignItems: 'center' },
  logoContainer: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: C.white,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 5 },
    }),
  },
  brandName: { fontSize: 16, fontWeight: '800', color: C.warning, marginTop: 8, marginBottom: 10, letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: C.textSecondary, lineHeight: 19, textAlign: 'center', paddingHorizontal: 8 },

  // ── Alert ──
  alert: { marginBottom: 12 },

  // ── Form ──
  form: { gap: 14 },
  forgotPassword: { alignSelf: 'flex-end', marginTop: -6 },
  forgotPasswordText: { fontSize: 13, color: C.text, fontWeight: '600' },
  submitButton: { marginTop: 6 },

  // ── Social row: Google + OTP, half width each ──
  socialRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14,
  },
  // OTP pill — white bg, themed border (border color set inline)
  halfPill: {
    flex: 1, height: 52, borderRadius: 14,
    backgroundColor: C.white, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 10,
  },
  otpPillText: { fontSize: 14, fontWeight: '700' }, // color set inline per theme

  // Google pill — gradient border + white inside + subtle top glare, logo only
  googleWrap: { flex: 1, height: 52 },
  googleGradientBorder: {
    flex: 1, borderRadius: 14, padding: 1.5,
  },
  googleWhiteInner: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 12.5,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  googleGlare: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '55%',
  },

  // ── Apple full-width pill (iOS only) ──
  applePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 14,
    backgroundColor: vendor.appleBlack, marginTop: 12,
  },
  applePillText: { fontSize: 14, fontWeight: '700', color: C.onPrimary },
  appleGlyph: { fontSize: 22, color: C.onPrimary, marginTop: -2 },

  disabled: { opacity: 0.5 },

  // ── Register CTA (visible without scrolling, prominent) ──
  registerCtaWrap: { alignItems: 'center', paddingTop: 0 },
  registerHint: { fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  registerCtaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%', paddingVertical: 14, borderRadius: 14,
    backgroundColor: C.warningBg, borderWidth: 1.5, borderColor: C.primary,
    gap: 6,
  },
  registerCtaText: { fontSize: 15, fontWeight: '700', color: C.warning },

  // ── Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: C.overlay,
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalContent: {
    backgroundColor: C.white, borderRadius: 20, padding: 28, width: '100%', maxWidth: 340,
    ...Platform.select({
      ios: { shadowColor: C.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 },
      android: { elevation: 10 },
    }),
  },
  modalIconCircle: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: brandTint.orange10,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 19, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 12 },
  modalMessage: { fontSize: 14, color: C.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 21 },
  modalButtons: { gap: 10 },
  modalPrimaryButton: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  modalPrimaryButtonText: { color: C.onPrimary, fontSize: 15, fontWeight: '700' },
  modalDismissButton: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  modalDismissText: { color: C.muted, fontSize: 14, fontWeight: '500' },
  });
};

export default LoginScreen;
