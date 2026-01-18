/**
 * User Registration Screen
 * 
 * Handles user registration via Node.js API → Java Auth + MongoDB
 * 
 * Registration Flow:
 * 1. User fills form (email, password, fullName, phone, location)
 * 2. Frontend validates input
 * 3. Sends to Node.js API: POST /api/auth/register
 * 4. Node.js registers in Java Auth (PostgreSQL)
 * 5. Node.js creates user in MongoDB
 * 6. Returns JWT tokens + user profile
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { registerUser } from '../src/api/client';
import { useApp } from '../context/AppContext';
import { ERROR_CODES, ERROR_MESSAGES } from '../utils/apiConfig';

const UserRegisterScreen = ({ navigation, onSuccess, onSwitchToLogin }) => {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  
  // App context for auth state
  const { loginUser } = useApp();

  // Get user's current location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  /**
   * Get current location
   */
  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        setIsGettingLocation(false);
        console.log('📍 Got location:', { lat: latitude, lng: longitude });
      },
      (error) => {
        console.warn('📍 Location error:', error.message);
        setIsGettingLocation(false);
        // Location is optional, so don't show error
      },
      { 
        enableHighAccuracy: false, 
        timeout: 15000, 
        maximumAge: 60000 
      }
    );
  };

  /**
   * Validate form fields
   */
  const validateForm = () => {
    const newErrors = {};

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    // Confirm password
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Full name validation
    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    // Phone validation (optional but if provided, must be valid)
    if (phone && !/^\+?[\d\s\-\(\)]{10,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Get user-friendly error message from API response
   */
  const getErrorMessage = (error) => {
    const code = error.code || error.response?.data?.code;
    
    // Check for network errors
    if (error.message === 'Network Error' || error.code === 'ECONNREFUSED') {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }

    // Check for known error codes
    if (code && ERROR_MESSAGES[code]) {
      return ERROR_MESSAGES[code];
    }

    // Handle specific error cases from backend
    switch (code) {
      case ERROR_CODES.EMAIL_ALREADY_EXISTS:
        return 'This email is already registered. Try logging in instead.';
      
      case ERROR_CODES.PHONE_ALREADY_EXISTS:
        return 'This phone number is already registered.';
      
      case ERROR_CODES.WEAK_PASSWORD:
        return 'Password is too weak. Use at least 8 characters.';
      
      case ERROR_CODES.INVALID_EMAIL_FORMAT:
        return 'Please enter a valid email address.';
      
      case ERROR_CODES.AUTH_SERVICE_UNAVAILABLE:
        return 'Service is temporarily unavailable. Please try again in a few minutes.';
      
      case ERROR_CODES.MONGODB_SYNC_FAILED:
        // Partial success - user created in auth but not in DB
        return 'Registration partially completed. Please try logging in.';
      
      case ERROR_CODES.VALIDATION_FAILED:
        // Show specific validation errors
        if (error.errors) {
          return Object.values(error.errors).join('. ');
        }
        return 'Please check your input and try again.';
      
      case ERROR_CODES.MISSING_REQUIRED_FIELDS:
        if (error.missingFields) {
          return `Please fill in: ${error.missingFields.join(', ')}`;
        }
        return 'Please fill in all required fields.';
      
      default:
        return error.message || 'Registration failed. Please try again.';
    }
  };

  /**
   * Handle form submission
   */
  const handleRegister = async () => {
    // Clear previous errors
    setApiError(null);

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      console.log('📝 Starting registration...');

      // Prepare registration data
      const registrationData = {
        email: email.trim().toLowerCase(),
        password: password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        location: location || undefined,
      };

      console.log('📤 Sending registration request:', {
        ...registrationData,
        password: '***hidden***',
      });

      // Call API
      const response = await registerUser(registrationData);

      console.log('✅ Registration successful!');
      console.log('📦 Response:', {
        success: response.success,
        userId: response.userId,
        javaUserId: response.javaUserId,
        email: response.data?.email,
      });

      // Show success message
      Alert.alert(
        'Registration Successful! 🎉',
        `Welcome to FixHomi, ${response.data?.fullName || fullName}!`,
        [
          {
            text: 'Get Started',
            onPress: () => {
              // Update app context with user data
              if (loginUser) {
                loginUser(response, response.accessToken);
              }
              
              // Call success callback if provided
              if (onSuccess) {
                onSuccess(response);
              }
            },
          },
        ]
      );

    } catch (error) {
      console.error('❌ Registration failed:', error);

      const errorMessage = getErrorMessage(error);
      setApiError(errorMessage);

      // Show specific field errors if available
      if (error.errors) {
        const fieldErrors = {};
        Object.keys(error.errors).forEach((field) => {
          fieldErrors[field] = error.errors[field];
        });
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }

      // Handle special cases
      if (error.code === ERROR_CODES.EMAIL_ALREADY_EXISTS) {
        Alert.alert(
          'Email Already Registered',
          'An account with this email already exists. Would you like to login instead?',
          [
            { text: 'Stay Here', style: 'cancel' },
            { 
              text: 'Go to Login', 
              onPress: () => onSwitchToLogin && onSwitchToLogin() 
            },
          ]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join FixHomi and get services at your doorstep
            </Text>
          </View>

          {/* API Error Banner */}
          {apiError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {apiError}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={[styles.input, errors.fullName && styles.inputError]}
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  setErrors((prev) => ({ ...prev, fullName: null }));
                }}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {errors.fullName && (
                <Text style={styles.errorText}>{errors.fullName}</Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="Enter your email"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrors((prev) => ({ ...prev, email: null }));
                  setApiError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number (Optional)</Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                placeholder="Enter your phone number"
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setErrors((prev) => ({ ...prev, phone: null }));
                }}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              {errors.phone && (
                <Text style={styles.errorText}>{errors.phone}</Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    errors.password && styles.inputError,
                  ]}
                  placeholder="Create a password (min 8 characters)"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrors((prev) => ({ ...prev, password: null }));
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.showPasswordButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.showPasswordText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password *</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.confirmPassword && styles.inputError,
                ]}
                placeholder="Confirm your password"
                placeholderTextColor="#94A3B8"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setErrors((prev) => ({ ...prev, confirmPassword: null }));
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            {/* Location Status */}
            <View style={styles.locationStatus}>
              {isGettingLocation ? (
                <View style={styles.locationRow}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.locationText}>Getting your location...</Text>
                </View>
              ) : location ? (
                <View style={styles.locationRow}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <Text style={styles.locationText}>Location detected</Text>
                  <TouchableOpacity onPress={getCurrentLocation}>
                    <Text style={styles.refreshLocation}>Refresh</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.locationRow}
                  onPress={getCurrentLocation}
                >
                  <Text style={styles.locationIcon}>📍</Text>
                  <Text style={styles.locationTextMuted}>
                    Tap to enable location (optional)
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.registerButton, isLoading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.registerButtonText}>Creating Account...</Text>
                </View>
              ) : (
                <Text style={styles.registerButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginLinkContainer}>
              <Text style={styles.loginLinkText}>Already have an account? </Text>
              <TouchableOpacity onPress={onSwitchToLogin}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>
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
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  form: {
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 70,
  },
  showPasswordButton: {
    position: 'absolute',
    right: 16,
    top: 14,
  },
  showPasswordText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
  },
  locationStatus: {
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#0369A1',
    flex: 1,
  },
  locationTextMuted: {
    fontSize: 14,
    color: '#64748B',
  },
  refreshLocation: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  registerButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#64748B',
  },
  loginLink: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
});

export default UserRegisterScreen;
