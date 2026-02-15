/**
 * OTP Login Screen
 * 
 * Passwordless login using OTP
 * Supports both phone and email OTP methods
 * 
 * @version 1.0.0
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Alert, FixhomiLogo } from '../components';
import { 
  sendPhoneLoginOtp, 
  sendEmailLoginOtp, 
  getErrorMessage, 
  AUTH_CODES 
} from '../services/authService';
import { validateEmail, validatePhone } from '../utils/validation';
import { useApp } from '../context/AppContext';

/**
 * OTPLoginScreen Component
 * 
 * @param {Object} props - Navigation props
 */
const OTPLoginScreen = ({ navigation, onSwitchToPassword, onOtpSent, userType = 'user' }) => {
  // Method: 'phone' or 'email'
  const [method, setMethod] = useState('phone');
  
  // Form state
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');

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
   * Switch login method
   */
  const switchMethod = (newMethod) => {
    setMethod(newMethod);
    setErrors({});
    clearAlert();
  };

  /**
   * Validate form based on method
   */
  const validateForm = () => {
    const newErrors = {};
    
    if (method === 'phone') {
      const phoneValidation = validatePhone(formData.phone);
      if (!phoneValidation.isValid) newErrors.phone = phoneValidation.error;
    } else {
      const emailValidation = validateEmail(formData.email);
      if (!emailValidation.isValid) newErrors.email = emailValidation.error;
    }
    
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
    };
  };

  /**
   * Handle send OTP
   */
  const handleSendOtp = async () => {
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

      let result;
      let identifier;

      if (method === 'phone') {
        identifier = formData.phone;
        result = await sendPhoneLoginOtp(formData.phone);
      } else {
        identifier = formData.email;
        result = await sendEmailLoginOtp(formData.email);
      }

      if (result.success) {
        const maskedValue = method === 'phone' ? result.maskedPhone : result.maskedEmail;
        showAlert(`OTP sent to ${maskedValue}`, 'success');
        
        // Navigate to OTP verification screen
        if (onOtpSent) {
          onOtpSent({
            method,
            identifier,
            maskedValue,
            expiresInMinutes: result.expiresInMinutes,
            userType,
          });
        }
      } else {
        const { error } = result;
        
        switch (error.code) {
          case AUTH_CODES.USER_NOT_FOUND:
            showAlert(
              method === 'phone' 
                ? 'No account found with this phone number.' 
                : 'No account found with this email.',
              'error'
            );
            break;
            
          case AUTH_CODES.TOO_MANY_REQUESTS:
            showAlert('Too many requests. Please wait before trying again.', 'warning');
            break;
            
          case AUTH_CODES.ACCOUNT_DISABLED:
            showAlert('Your account has been disabled. Please contact support.', 'error');
            break;
            
          case AUTH_CODES.NETWORK_ERROR:
            showAlert(getErrorMessage(error.code, error.message), 'error');
            break;
            
          default:
            showAlert(error.message || 'Failed to send OTP. Please try again.', 'error');
        }
      }
    } catch (error) {
      console.error('❌ [OTPLoginScreen] Unexpected error:', error);
      showAlert('An unexpected error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
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
            <FixhomiLogo size={56} color="#f67c16" />
            <Text style={styles.brandName}>FixHomi</Text>
            <Text style={styles.title}>Sign In with OTP</Text>
            <Text style={styles.subtitle}>
              We'll send a one-time password to your {method === 'phone' ? 'phone' : 'email'}
            </Text>
          </View>

          {/* Method Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, method === 'phone' && styles.tabActive]}
              onPress={() => switchMethod('phone')}
              disabled={loading}
            >
              <Text style={[styles.tabText, method === 'phone' && styles.tabTextActive]}>
                Phone
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, method === 'email' && styles.tabActive]}
              onPress={() => switchMethod('email')}
              disabled={loading}
            >
              <Text style={[styles.tabText, method === 'email' && styles.tabTextActive]}>
                Email
              </Text>
            </TouchableOpacity>
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
            {method === 'phone' ? (
              <Input
                label="Phone Number"
                value={formData.phone}
                onChangeText={(value) => updateField('phone', value)}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                autoComplete="tel"
                error={errors.phone}
                editable={!loading}
              />
            ) : (
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
            )}

            <Button
              title={loading ? 'Sending OTP...' : 'Send OTP'}
              onPress={handleSendOtp}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
            />

            {/* Password Login Option */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Sign In with Password"
              onPress={onSwitchToPassword}
              variant="outline"
              disabled={loading}
            />
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.infoText}>
              {method === 'phone' 
                ? 'You will receive a 6-digit OTP on your registered phone number.'
                : 'You will receive a 6-digit OTP on your registered email address.'
              }
            </Text>
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
    marginBottom: 24,
    alignItems: 'center',
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f67c16',
    marginTop: 8,
    marginBottom: 16,
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  alert: {
    marginBottom: 16,
  },
  form: {
    gap: 16,
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
  info: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default OTPLoginScreen;
