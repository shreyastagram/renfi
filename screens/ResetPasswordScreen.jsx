/**
 * Reset Password Screen
 * 
 * Handles deep link password reset when user clicks reset link from email.
 * Deep link format: fixhomi://reset-password?token=<token>
 * 
 * Flow:
 * 1. Validate token via GET /api/auth/reset-password/validate?token=<token>
 * 2. If valid, show password form
 * 3. Submit new password via POST /api/auth/reset-password
 * 4. Navigate to login on success
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { validateResetToken, resetPassword, getErrorMessage } from '../src/api/authApi';

const ResetPasswordScreen = ({ route, navigation }) => {
  // Get token from deep link params
  const token = route?.params?.token;
  
  // Debug: Log immediately on every render
  console.log('🔄 [ResetPassword] RENDER - token:', token);

  // States
  const [status, setStatus] = useState('validating'); // 'validating', 'valid', 'invalid', 'success', 'error'
  const [maskedEmail, setMaskedEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationMessage, setValidationMessage] = useState('');

  // Validate token on mount
  useEffect(() => {
    console.log('🔑 [ResetPassword] Route params:', JSON.stringify(route?.params));
    console.log('🔑 [ResetPassword] Token received:', token);
    console.log('🔑 [ResetPassword] Token length:', token?.length);
    
    if (token) {
      validateTokenWithBackend();
    } else {
      setStatus('invalid');
      setValidationMessage('Invalid reset link. No token provided.');
    }
  }, [token]);

  const validateTokenWithBackend = async () => {
    try {
      setStatus('validating');
      console.log('🔍 [ResetPassword] Calling validateResetToken with:', token);
      const result = await validateResetToken(token);
      console.log('✅ [ResetPassword] Validation result:', JSON.stringify(result));
      
      if (result.valid || result.success) {
        setStatus('valid');
        setMaskedEmail(result.maskedTarget || result.email || '');
      } else {
        setStatus('invalid');
        setValidationMessage(result.message || 'This reset link is invalid or has expired.');
      }
    } catch (err) {
      console.error('❌ [ResetPassword] Token validation error:', err);
      console.error('❌ [ResetPassword] Error response:', err.response?.data);
      setStatus('invalid');
      setValidationMessage(err.response?.data?.message || 'This reset link is invalid or has expired.');
    }
  };

  const validatePasswordStrength = (password) => {
    const errors = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('One number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('One special character');
    return errors;
  };

  const handleResetPassword = async () => {
    setError('');
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // Validate password strength
    const strengthErrors = validatePasswordStrength(newPassword);
    if (strengthErrors.length > 0) {
      setError(`Password must have: ${strengthErrors.join(', ')}`);
      return;
    }
    
    setLoading(true);
    
    try {
      await resetPassword(token, newPassword);
      setStatus('success');
    } catch (err) {
      console.error('Reset password error:', err);
      setError(err.message || getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigation.reset({
      index: 0,
      routes: [{ 
        name: 'Home',
        params: { message: 'Password reset successfully. Please login with your new password.' }
      }],
    });
  };

  const handleRequestNewLink = () => {
    navigation.navigate('ForgotPassword');
  };

  // Validating state
  if (status === 'validating') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Validating reset link...</Text>
      </View>
    );
  }

  // Invalid token state
  if (status === 'invalid') {
    return (
      <View style={styles.centerContainer}>
        <View style={[styles.iconContainer, styles.errorIconBg]}>
          <Text style={styles.icon}>✕</Text>
        </View>
        <Text style={styles.title}>Link Expired</Text>
        <Text style={styles.subtitle}>{validationMessage}</Text>
        <TouchableOpacity style={styles.button} onPress={handleRequestNewLink}>
          <Text style={styles.buttonText}>Request New Link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={handleGoToLogin}>
          <Text style={styles.linkText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <View style={styles.centerContainer}>
        <View style={[styles.iconContainer, styles.successIconBg]}>
          <Text style={styles.icon}>✓</Text>
        </View>
        <Text style={styles.title}>Password Reset!</Text>
        <Text style={styles.subtitle}>
          Your password has been reset successfully. Please login with your new password.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleGoToLogin}>
          <Text style={styles.buttonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Valid token - show password form
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          {maskedEmail ? (
            <Text style={styles.subtitle}>Enter a new password for {maskedEmail}</Text>
          ) : (
            <Text style={styles.subtitle}>Enter your new password below</Text>
          )}
        </View>

        <View style={styles.form}>
          {/* New Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Password requirements */}
          <View style={styles.requirements}>
            <Text style={styles.requirementsTitle}>Password must have:</Text>
            <Text style={[styles.requirement, newPassword.length >= 8 && styles.requirementMet]}>
              • At least 8 characters
            </Text>
            <Text style={[styles.requirement, /[A-Z]/.test(newPassword) && styles.requirementMet]}>
              • One uppercase letter
            </Text>
            <Text style={[styles.requirement, /[a-z]/.test(newPassword) && styles.requirementMet]}>
              • One lowercase letter
            </Text>
            <Text style={[styles.requirement, /[0-9]/.test(newPassword) && styles.requirementMet]}>
              • One number
            </Text>
            <Text style={[styles.requirement, /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) && styles.requirementMet]}>
              • One special character
            </Text>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <Text style={styles.mismatchText}>Passwords do not match</Text>
            )}
          </View>

          {/* Error Message */}
          {!!error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.button,
              (!newPassword || !confirmPassword || loading) && styles.buttonDisabled
            ]}
            onPress={handleResetPassword}
            disabled={!newPassword || !confirmPassword || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Reset Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={handleGoToLogin}>
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconBg: {
    backgroundColor: '#4CAF50',
  },
  errorIconBg: {
    backgroundColor: '#ff4d4f',
  },
  icon: {
    fontSize: 40,
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  passwordInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  eyeButton: {
    padding: 12,
  },
  eyeIcon: {
    fontSize: 20,
  },
  requirements: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  requirement: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  requirementMet: {
    color: '#4CAF50',
  },
  mismatchText: {
    fontSize: 12,
    color: '#ff4d4f',
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    padding: 12,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default ResetPasswordScreen;
