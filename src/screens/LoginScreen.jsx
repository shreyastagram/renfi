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
import { validateEmail, validatePassword } from '../utils/validation';
import { useApp } from '../context/AppContext';

/**
 * LoginScreen Component
 * 
 * @param {Object} props - Navigation props
 */
const LoginScreen = ({ navigation, onSwitchToRegister, onSwitchToOtp, userType = 'user' }) => {
  const { handleAuthSuccess } = useApp();

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [showPassword, setShowPassword] = useState(false);

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
   * Validate form
   */
  const validateForm = () => {
    const newErrors = {};
    
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) newErrors.email = emailValidation.error;
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
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
        showAlert('Please fix the errors below', 'warning');
        return;
      }

      setLoading(true);

      const result = await loginWithEmail(formData.email, formData.password);

      if (result.success) {
        showAlert('Login successful!', 'success');
        
        // Add userType to auth data
        const authData = {
          ...result.data,
          userType,
        };
        
        const authProcessed = await handleAuthSuccess(authData);
        
        if (!authProcessed) {
          showAlert('Login successful but failed to save session.', 'warning');
        }
      } else {
        const { error } = result;
        
        switch (error.code) {
          case AUTH_CODES.INVALID_CREDENTIALS:
            showAlert('Invalid email or password. Please try again.', 'error');
            break;
            
          case AUTH_CODES.USER_NOT_FOUND:
            showAlert('No account found with this email. Please register first.', 'error');
            break;
            
          case AUTH_CODES.ACCOUNT_DISABLED:
            showAlert('Your account has been disabled. Please contact support.', 'error');
            break;
            
          case AUTH_CODES.ACCOUNT_LOCKED:
            showAlert('Too many failed attempts. Please try again later.', 'warning');
            break;
            
          case AUTH_CODES.EMAIL_NOT_VERIFIED:
            showAlert('Please verify your email address before logging in.', 'warning');
            break;
            
          case AUTH_CODES.NETWORK_ERROR:
            showAlert(getErrorMessage(error.code, error.message), 'error');
            break;
            
          default:
            showAlert(error.message || 'Login failed. Please try again.', 'error');
        }
      }
    } catch (error) {
      console.error('❌ [LoginScreen] Unexpected error:', error);
      showAlert('An unexpected error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Google Sign-In
   * Uses userType prop to determine if signing in as USER or SERVICE_PROVIDER
   */
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      clearAlert();

      const isProvider = userType === 'provider';
      console.log(`🔐 [LoginScreen] Starting Google Sign-In as ${isProvider ? 'PROVIDER' : 'USER'}`);
      
      // Call appropriate sign-in method based on user type
      const result = isProvider 
        ? await signInWithGoogleAsProvider()
        : await signInWithGoogleAsUser();

      if (result.success) {
        showAlert('Login successful!', 'success');
        
        const { accessToken, refreshToken, user, isNewUser } = result.data;
        
        // ✅ CRITICAL: Always sync Google users to MongoDB
        // Java Auth creates user in PostgreSQL, but we need them in MongoDB too
        // This handles: new users, returning users after DB clear, cross-device login
        if (user) {
          console.log(`🔄 [LoginScreen] Syncing Google ${isProvider ? 'provider' : 'user'} to MongoDB...`);
          
          const syncData = {
            javaUserId: user.userId,
            email: user.email,
            fullName: user.fullName,
            googleId: user.googleId,
            profilePicture: user.profilePicture,
          };
          
          try {
            if (isProvider) {
              // For providers, sync basic data - they can add more in ProfileScreen
              await syncGoogleProviderToMongoDB({
                ...syncData,
                name: user.fullName,
                address: '', // Will be updated in ProfileScreen
              });
            } else {
              await syncGoogleUserToMongoDB(syncData);
            }
            console.log('✅ [LoginScreen] MongoDB sync completed');
          } catch (syncError) {
            console.warn('⚠️ [LoginScreen] MongoDB sync failed, continuing...', syncError);
            // Don't block login - auth middleware auto-sync will handle it
          }
        }
        
        // Add userType to auth data
        // Include javaUserId as the unified ID for MongoDB queries
        const authData = {
          accessToken: accessToken,
          refreshToken: refreshToken,
          userId: user.userId,
          javaUserId: user.userId,
          mongoId: user.userId, // Same as javaUserId in unified system
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          userType: userType,
          isNewUser: isNewUser,
          authMethod: 'google',
        };
        
        // For new providers, they may need to complete their profile
        // The handleAuthSuccess should handle this navigation
        const authProcessed = await handleAuthSuccess(authData);
        
        if (!authProcessed) {
          showAlert('Login successful but failed to save session.', 'warning');
        }
      } else {
        const { error } = result;
        
        // Don't show error for cancelled sign-in
        if (error.isCancelled) {
          console.log('🔵 [LoginScreen] Google Sign-In cancelled by user');
          return;
        }
        
        // Handle role conflict - email registered as different type
        if (error.code === GOOGLE_AUTH_CODES.ROLE_CONFLICT) {
          const roleMessage = isProvider
            ? 'This email is already registered as a User. Each email can only be used for one account type.'
            : 'This email is already registered as a Service Provider. Please login from the Provider app.';
          showAlert(roleMessage, 'warning');
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
      console.error('❌ [LoginScreen] Google Sign-In error:', error);
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
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <FixhomiLogo size={64} color="#f67c16" />
            <Text style={styles.brandName}>FixHomi</Text>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in to continue {userType === 'provider' ? 'as a service provider' : ''}
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

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Email"
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
              editable={!loading}
            />

            <Input
              label="Password"
              value={formData.password}
              onChangeText={(value) => updateField('password', value)}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              error={errors.password}
              editable={!loading && !googleLoading}
              rightIcon={showPassword ? 'eye-off' : 'eye'}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            {/* Forgot Password */}
            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={() => navigation?.navigate?.('ForgotPassword')}
              disabled={loading || googleLoading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Button
              title={loading ? 'Signing In...' : 'Sign In'}
              onPress={handleLogin}
              loading={loading}
              disabled={loading || googleLoading}
              style={styles.submitButton}
            />

            {/* Social Login Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
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
                <Text style={styles.googleButtonText}>Signing in...</Text>
              ) : (
                <>
                  <View style={styles.googleIconContainer}>
                    <Text style={styles.googleIcon}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* OTP Login Option */}
            <Button
              title="Sign In with OTP"
              onPress={onSwitchToOtp}
              variant="outline"
              disabled={loading || googleLoading}
              style={styles.otpButton}
            />
          </View>

          {/* Register Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={onSwitchToRegister} disabled={loading}>
              <Text style={styles.linkText}>Register</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  brandName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f67c16',
    marginTop: 8,
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
});

export default LoginScreen;
