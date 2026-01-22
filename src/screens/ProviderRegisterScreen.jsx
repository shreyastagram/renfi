/**
 * Provider Register Screen
 * 
 * Provider registration form with Node.js API integration
 * Required: email, password, name, address
 * Optional: phone, city, pincode, serviceCategories, experience, location
 * 
 * Now captures real GPS coordinates for provider location
 * 
 * @version 2.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  PermissionsAndroid,
  ActivityIndicator,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { Button, Input, Alert, FixhomiLogo } from '../components';
import { registerProvider, getErrorMessage, AUTH_CODES } from '../services/authService';
import { validateProviderRegistrationForm } from '../utils/validation';
import { useApp } from '../context/AppContext';

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
  const [errors, setErrors] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');

  // Location state
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [watchId, setWatchId] = useState(null);

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
   * Industry-grade location strategy (like Uber/Ola):
   * 1. Start with watchPosition for continuous updates
   * 2. Accept first location immediately (cached/network)
   * 3. Refine with better accuracy updates automatically
   * 4. Stop watching once we have good enough accuracy (<100m)
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

    console.log('📍 Starting industry-grade location fetch...');
    
    // Clear any existing watch
    if (watchId !== null) {
      Geolocation.clearWatch(watchId);
    }

    let locationReceived = false;
    let bestAccuracy = Infinity;
    
    // Use watchPosition - this is how Uber/Ola get fast location
    // It immediately returns cached/network location, then refines with GPS
    const id = Geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log('📍 Location update:', latitude.toFixed(6), longitude.toFixed(6), 'accuracy:', accuracy?.toFixed(0) || 'unknown', 'm');
        
        // Accept any location immediately to show user we're working
        if (!locationReceived) {
          locationReceived = true;
          setLocation({ latitude, longitude, accuracy });
          setLocationLoading(false);
          console.log('📍 First location acquired!');
        }
        
        // Keep updating if we get better accuracy
        if (accuracy && accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          setLocation({ latitude, longitude, accuracy });
          console.log('📍 Better accuracy received:', accuracy.toFixed(0), 'm');
        }
        
        // Stop watching once we have good accuracy (<100m) or after getting a location
        if (accuracy && accuracy < 100) {
          console.log('📍 Good accuracy achieved, stopping watch');
          Geolocation.clearWatch(id);
          setWatchId(null);
        }
      },
      (error) => {
        console.warn('📍 Location watch error:', error.message, error.code);
        
        // Only show error if we haven't received any location yet
        if (!locationReceived) {
          // Try one last time with getCurrentPosition as fallback
          Geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              console.log('📍 Fallback location:', latitude, longitude);
              setLocation({ latitude, longitude });
              setLocationLoading(false);
            },
            (fallbackError) => {
              console.error('📍 All location attempts failed:', fallbackError.message);
              setLocationError('Could not get location. You can retry or continue without GPS.');
              setLocationLoading(false);
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
          );
        }
        
        Geolocation.clearWatch(id);
        setWatchId(null);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // Update every 10 meters
        interval: 1000, // Android: update every 1 second
        fastestInterval: 500, // Android: fastest update interval
        timeout: 30000,
        maximumAge: 1000, // Use cached location up to 1 second old for instant result
      }
    );
    
    setWatchId(id);
    
    // Safety timeout: stop watching after 15 seconds regardless
    setTimeout(() => {
      if (id && !locationReceived) {
        console.log('📍 Safety timeout reached');
        Geolocation.clearWatch(id);
        setWatchId(null);
        if (!location) {
          setLocationError('Location timeout. You can retry or continue without GPS.');
          setLocationLoading(false);
        }
      } else if (id) {
        // We have a location, just stop the watch
        Geolocation.clearWatch(id);
        setWatchId(null);
      }
    }, 15000);
  };

  // Request location on mount and cleanup on unmount
  useEffect(() => {
    getCurrentLocation();
    
    return () => {
      // Cleanup watch on unmount
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
    };
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
            setErrors({ email: 'This email is already registered' });
            showAlert(getErrorMessage(error.code, error.message), 'error');
            break;
            
          case AUTH_CODES.PHONE_ALREADY_EXISTS:
            setErrors({ phone: 'This phone number is already registered' });
            showAlert(getErrorMessage(error.code, error.message), 'error');
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
            />

            <Input
              label="Password"
              placeholder="Create a password (min 8 characters)"
              value={formData.password}
              onChangeText={(value) => updateField('password', value)}
              error={errors.password}
              secureTextEntry
              autoComplete="password-new"
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
                <View style={styles.locationSuccess}>
                  <Text style={styles.locationSuccessIcon}>✓</Text>
                  <Text style={styles.locationSuccessText}>
                    Location captured ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
                  </Text>
                </View>
              ) : locationError ? (
                <View style={styles.locationErrorContainer}>
                  <Text style={styles.locationErrorText}>{locationError}</Text>
                  <TouchableOpacity onPress={getCurrentLocation} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : !locationLoading ? (
                <TouchableOpacity onPress={getCurrentLocation} style={styles.getLocationButton}>
                  <Text style={styles.getLocationButtonText}>Get My Location</Text>
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
              style={styles.submitButton}
            />
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
});

export default ProviderRegisterScreen;
