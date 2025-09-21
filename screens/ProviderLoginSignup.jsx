import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import socketService from '../utils/socket';
import { providerStorage } from '../utils/providerStorage';
import { getCurrentLocation, isValidLocation, formatLocation } from '../utils/locationUtils';

function validateEmailOrPhone(value) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\+?\d{10,15}$/;
  if (!value) return 'Email or phone number is required.';
  if (!emailRegex.test(value) && !phoneRegex.test(value)) {
    return 'Enter a valid email or phone number.';
  }
  return '';
}

function validatePassword(value) {
  if (!value) return 'Password is required.';
  if (value.length < 6) return 'Password must be at least 6 characters.';
  return '';
}

const ProviderLoginSignup = ({ route, navigation }) => {
  useEffect(() => {
    console.log('Navigated to ProviderLoginSignup page');
  }, []);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [emailOrPhoneError, setEmailOrPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const mode = route?.params?.mode || 'login';

  const validateAddress = (value) => {
    if (!value) return 'Address is required.';
    if (value.length < 5) return 'Address must be at least 5 characters.';
    return '';
  };

  const validateFields = () => {
    const emailOrPhoneErr = validateEmailOrPhone(emailOrPhone);
    const passwordErr = validatePassword(password);
    const addressErr = mode === 'signup' ? validateAddress(address) : '';
    const locationErr = mode === 'signup' && (!latitude || !longitude) ? 'Location is required for service providers.' : '';
    
    setEmailOrPhoneError(emailOrPhoneErr);
    setPasswordError(passwordErr);
    setAddressError(addressErr);
    setLocationError(locationErr);
    
    return !emailOrPhoneErr && !passwordErr && !addressErr && !locationErr;
  };

  // Get current GPS location
  const getCurrentGPSLocation = async () => {
    setLocationLoading(true);
    setLocationError('');
    
    try {
      console.log('🔍 Requesting location permissions and GPS...');
      const location = await getCurrentLocation();
      setLatitude(location.latitude);
      setLongitude(location.longitude);
      console.log('📍 Provider location obtained:', formatLocation(location.latitude, location.longitude));
      
      // Clear any previous errors
      setLocationError('');
    } catch (error) {
      console.error('❌ Location error:', error);
      setLocationError(error.message || 'Unable to get location. Please check permissions.');
      
      // Show alert to user
      Alert.alert(
        'Location Required',
        error.message || 'We need your location to match you with nearby service requests. Please enable location permissions and try again.',
        [
          { text: 'Cancel' },
          { text: 'Retry', onPress: getCurrentGPSLocation }
        ]
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const handleLogin = async () => {
    setSubmitError('');
    if (!validateFields()) {
      setSubmitError('Please fix the errors above.');
      console.log('Login validation failed');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('http://10.0.2.2:5050/auth/provider/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailOrPhone,
          password,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        setSubmitError(errorData.message || 'Login failed.');
        setLoading(false);
        return;
      }
      
      // Get provider data from response
      const providerData = await response.json();
      setLoading(false);
      
      console.log('✅ Provider Login successful:', providerData);
      console.log('Provider ID from response:', providerData.providerId);
      console.log('Provider ID from data:', providerData.data?._id);
      console.log('Response keys:', Object.keys(providerData));
      
      // Extract real provider ID
      const realProviderId = providerData.providerId || providerData.data?._id;
      
      if (!realProviderId) {
        console.error('❌ No provider ID found in response');
        setSubmitError('Failed to get provider ID from server.');
        return;
      }
      
      console.log('🔑 Using provider ID:', realProviderId);
      
      // Store provider ID, token, and data
      await providerStorage.saveProviderId(realProviderId);
      if (providerData.token) {
        await providerStorage.saveProviderToken(providerData.token);
      }
      if (providerData.data) {
        await providerStorage.saveProviderData(providerData.data);
      }
      
      // Connect to socket with real provider ID
      socketService.connect('provider', realProviderId);
      
      // Check if profile is complete (has service categories)
      if (providerData.data && providerData.data.serviceCategories && providerData.data.serviceCategories.length > 0) {
        // Profile is complete, go to dashboard
        navigation.replace('ProviderDashboard');
      } else {
        // Profile incomplete, redirect to setup
        navigation.replace('ProviderProfileSetup', {
          providerId: realProviderId,
          isEditing: false
        });
      }
    } catch (err) {
      setSubmitError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setSubmitError('');
    if (!validateFields()) {
      setSubmitError('Please fix the errors above.');
      console.log('Signup validation failed');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('http://10.0.2.2:5050/auth/provider/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailOrPhone,
          password,
          address,
          lat: latitude,
          lng: longitude,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        setSubmitError(errorData.message || 'Signup failed.');
        setLoading(false);
        return;
      }
      
      // Get provider data from response
      const providerData = await response.json();
      setLoading(false);
      
      console.log('✅ Signup successful:', providerData);
      
      // Extract real provider ID
      const realProviderId = providerData.providerId || providerData.data?._id;
      
      if (!realProviderId) {
        setSubmitError('Failed to get provider ID from server.');
        return;
      }
      
      // Store provider ID, token, and data
      await providerStorage.saveProviderId(realProviderId);
      if (providerData.token) {
        await providerStorage.saveProviderToken(providerData.token);
      }
      if (providerData.data) {
        await providerStorage.saveProviderData(providerData.data);
      }
      
      // Connect to socket with real provider ID
      socketService.connect('provider', realProviderId);
      
      // New providers need to complete profile setup
      navigation.replace('ProviderProfileSetup', {
        providerId: realProviderId,
        isEditing: false
      });
    } catch (err) {
      setSubmitError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const goToLogin = () => {
    console.log('Go to Login pressed');
    navigation.replace('ProviderLoginSignup', { mode: 'login' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Service Provider {mode === 'signup' ? 'Signup' : 'Login'}</Text>
      <TextInput
        style={[styles.input, emailOrPhoneError ? styles.inputError : null]}
        placeholder="Email or Phone Number"
        value={emailOrPhone}
        onChangeText={text => {
          setEmailOrPhone(text);
          if (emailOrPhoneError) setEmailOrPhoneError(validateEmailOrPhone(text));
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        onBlur={() => setEmailOrPhoneError(validateEmailOrPhone(emailOrPhone))}
      />
      {!!emailOrPhoneError && <Text style={styles.errorText}>{emailOrPhoneError}</Text>}
      <TextInput
        style={[styles.input, passwordError ? styles.inputError : null]}
        placeholder="Password"
        value={password}
        onChangeText={text => {
          setPassword(text);
          if (passwordError) setPasswordError(validatePassword(text));
        }}
        secureTextEntry
        onBlur={() => setPasswordError(validatePassword(password))}
      />
      {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
      {mode === 'signup' && (
        <>
          <TextInput
            style={[styles.input, addressError ? styles.inputError : null]}
            placeholder="Address"
            value={address}
            onChangeText={text => {
              setAddress(text);
              if (addressError) setAddressError(validateAddress(text));
            }}
            onBlur={() => setAddressError(validateAddress(address))}
          />
          {!!addressError && <Text style={styles.errorText}>{addressError}</Text>}
          
          {/* Location Section for Signup */}
          <View style={styles.locationSection}>
            <Text style={styles.locationTitle}>📍 Your Service Location</Text>
            <Text style={styles.locationSubtitle}>
              We need your location to match you with nearby service requests
            </Text>
            
            {latitude && longitude ? (
              <View style={styles.locationInfo}>
                <Text style={styles.locationText}>✅ Location Set</Text>
                <Text style={styles.locationCoords}>
                  {formatLocation(latitude, longitude)}
                </Text>
                <TouchableOpacity 
                  style={styles.locationButton}
                  onPress={getCurrentGPSLocation}
                  disabled={locationLoading}
                >
                  <Text style={styles.locationButtonText}>
                    {locationLoading ? '🔄 Updating...' : '🔄 Update Location'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={[styles.locationButton, styles.getLocationButton]}
                onPress={getCurrentGPSLocation}
                disabled={locationLoading}
              >
                <Text style={styles.locationButtonText}>
                  {locationLoading ? '🔄 Getting Location...' : '📍 Get My Location'}
                </Text>
              </TouchableOpacity>
            )}
            
            {!!locationError && <Text style={styles.errorText}>{locationError}</Text>}
          </View>
        </>
      )}
      {mode === 'signup' ? (
        <>
          <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Signing up...' : 'Signup'}</Text>
          </TouchableOpacity>
          <View style={styles.linkContainer}>
            <Text style={styles.linkText}>Already have an account?</Text>
            <TouchableOpacity onPress={goToLogin} disabled={loading}>
              <Text style={styles.linkButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Login'}</Text>
          </TouchableOpacity>
          <View style={styles.linkContainer}>
            <Text style={styles.linkText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.replace('ProviderLoginSignup', { mode: 'signup' })} disabled={loading}>
              <Text style={styles.linkButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      {!!submitError && <Text style={styles.submitErrorText}>{submitError}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    maxWidth: 350,
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#ff4d4f',
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 14,
    marginBottom: 8,
    alignSelf: 'flex-start',
    maxWidth: 350,
  },
  submitErrorText: {
    color: '#ff4d4f',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 8,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkContainer: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 16,
    marginRight: 6,
  },
  linkButtonText: {
    color: '#007AFF',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  locationSection: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    alignItems: 'center',
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  locationSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  locationInfo: {
    alignItems: 'center',
    width: '100%',
  },
  locationText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  locationButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  getLocationButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProviderLoginSignup;
