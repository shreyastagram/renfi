/**
 * Provider Login/Signup Screen
 * 
 * Handles provider authentication with multiple options:
 * - Email + Password login
 * - Phone + Password login  
 * - OTP-based passwordless login (phone or email)
 * - Google Sign-In (OAuth2)
 * - New provider signup with verification flow
 * 
 * @version 2.1.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import socketService from '../utils/socket';
import { getCurrentLocation, isValidLocation, formatLocation } from '../utils/locationUtils';
import { useApp } from '../context/AppContext';
import client from '../src/api/client';
import tokenService from '../src/services/tokenService';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { 
  getErrorMessage, 
  validatePassword as validatePasswordStrength,
  sendPhoneLoginOtp,
  verifyPhoneLoginOtp,
  sendEmailLoginOtp,
  verifyEmailLoginOtp,
} from '../src/api/authApi';

const { width } = Dimensions.get('window');

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
  const validation = validatePasswordStrength(value);
  if (!validation.isValid) {
    return validation.errors[0];
  }
  return '';
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// OTP Input Component
const OtpInput = ({ value, onChange, disabled, error }) => {
  const inputRefs = useRef([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleChange = (text, index) => {
    const newOtp = value.split('');
    newOtp[index] = text.slice(-1);
    const newValue = newOtp.join('');
    onChange(newValue);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.otpContainer}>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <TextInput
          key={index}
          ref={(ref) => (inputRefs.current[index] = ref)}
          style={[
            styles.otpInput,
            focusedIndex === index && styles.otpInputFocused,
            error && styles.otpInputError,
            value[index] && styles.otpInputFilled,
          ]}
          value={value[index] || ''}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          onFocus={() => setFocusedIndex(index)}
          keyboardType="number-pad"
          maxLength={1}
          editable={!disabled}
          selectTextOnFocus
        />
      ))}
    </View>
  );
};

// OTP Login Modal
const OtpLoginModal = ({ visible, onClose, emailOrPhone, onLoginSuccess }) => {
  const [step, setStep] = useState('send');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [maskedContact, setMaskedContact] = useState('');
  const isEmailLogin = isEmail(emailOrPhone);

  useEffect(() => {
    if (visible) {
      setStep('send');
      setOtp('');
      setError('');
      setResendTimer(0);
    }
  }, [visible]);

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSendOtp = async () => {
    setLoading(true);
    setError('');

    try {
      if (isEmailLogin) {
        const result = await sendEmailLoginOtp(emailOrPhone);
        setMaskedContact(result.maskedEmail || emailOrPhone);
      } else {
        const result = await sendPhoneLoginOtp(emailOrPhone);
        setMaskedContact(result.maskedPhone || emailOrPhone);
      }
      setStep('verify');
      setResendTimer(60);
    } catch (err) {
      setError(err.message || getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Please enter 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let response;
      if (isEmailLogin) {
        response = await verifyEmailLoginOtp(emailOrPhone, otp);
      } else {
        response = await verifyPhoneLoginOtp(emailOrPhone, otp);
      }
      
      await tokenService.storeTokens(response.accessToken, response.refreshToken);
      onLoginSuccess(response);
    } catch (err) {
      setError(err.message || getErrorMessage(err));
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.modalTitle}>
            {step === 'send' ? 'Login with OTP' : 'Enter OTP'}
          </Text>

          {step === 'send' ? (
            <>
              <Text style={styles.modalSubtitle}>
                We'll send a one-time password to:
              </Text>
              <Text style={styles.contactText}>{emailOrPhone}</Text>
              
              <TouchableOpacity
                style={[styles.sendOtpButton, loading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendOtpButtonText}>
                    Send OTP to {isEmailLogin ? 'Email' : 'Phone'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.modalSubtitle}>
                OTP sent to {maskedContact}
              </Text>

              <OtpInput
                value={otp}
                onChange={setOtp}
                disabled={loading}
                error={!!error}
              />

              <TouchableOpacity
                style={[styles.resendButton, resendTimer > 0 && styles.resendButtonDisabled]}
                onPress={handleSendOtp}
                disabled={resendTimer > 0 || loading}
              >
                <Text style={[styles.resendText, resendTimer > 0 && styles.resendTextDisabled]}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.verifyButton, (otp.length !== 6 || loading) && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={otp.length !== 6 || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.verifyButtonText}>Verify & Login</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {!!error && <Text style={styles.modalErrorText}>{error}</Text>}
        </View>
      </View>
    </Modal>
  );
};

const ProviderLoginSignup = ({ route, navigation }) => {
  const { loginProvider, loginWithGoogle } = useApp();
  
  useEffect(() => {
    console.log('Navigated to ProviderLoginSignup page');
  }, []);

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [emailOrPhoneError, setEmailOrPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [fullNameError, setFullNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const mode = route?.params?.mode || 'login';

  const validateFullName = (value) => {
    if (!value) return 'Full name is required.';
    if (value.length < 2) return 'Name must be at least 2 characters.';
    return '';
  };

  const validatePhone = (value) => {
    const phoneRegex = /^\+?\d{10,15}$/;
    if (!value) return 'Phone number is required.';
    if (!phoneRegex.test(value)) return 'Enter a valid phone number (10-15 digits).';
    return '';
  };

  const validateAddress = (value) => {
    if (!value) return 'Address is required.';
    if (value.length < 5) return 'Address must be at least 5 characters.';
    return '';
  };

  const validateFields = () => {
    const emailOrPhoneErr = validateEmailOrPhone(emailOrPhone);
    const passwordErr = validatePassword(password);
    
    if (mode === 'signup') {
      const fullNameErr = validateFullName(fullName);
      const phoneErr = validatePhone(phone);
      const addressErr = validateAddress(address);
      const locationErr = (!latitude || !longitude) ? 'Location is required for service providers.' : '';
      
      setFullNameError(fullNameErr);
      setPhoneError(phoneErr);
      setAddressError(addressErr);
      setLocationError(locationErr);
      setEmailOrPhoneError(emailOrPhoneErr);
      setPasswordError(passwordErr);
      
      return !emailOrPhoneErr && !passwordErr && !fullNameErr && !phoneErr && !addressErr && !locationErr;
    } else {
      setEmailOrPhoneError(emailOrPhoneErr);
      setPasswordError(passwordErr);
      return !emailOrPhoneErr && !passwordErr;
    }
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
      
      setLocationError('');
    } catch (error) {
      console.error('❌ Location error:', error);
      setLocationError(error.message || 'Unable to get location. Please check permissions.');
      
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

  const completeLogin = async (response) => {
    const realProviderId = response.userId;
    const token = response.accessToken;
    
    if (realProviderId && token) {
      console.log('✅ Provider ID:', realProviderId);
      console.log('✅ Token present');
      
      const providerData = {
        providerId: realProviderId,
        _id: realProviderId,
        email: response.email,
        fullName: response.fullName,
        role: response.role,
      };
      
      await loginProvider(providerData, token);
      socketService.connect('provider', String(realProviderId));
      console.log('Connecting provider to socket:', realProviderId);
      return true;
    } else {
      console.error('❌ Missing providerId or token in response');
      return false;
    }
  };

  const handleLogin = async () => {
    setSubmitError('');
    if (!validateFields()) {
      setSubmitError('Please fix the errors above.');
      return;
    }
    setLoading(true);
    try {
      // Use smartLogin which automatically detects email vs phone
      const response = await client.smartLogin(emailOrPhone, password);
      
      console.log('✅ Provider Login successful:', response);
      
      if (await completeLogin(response)) {
        setLoading(false);
      } else {
        setSubmitError('Login response missing required data');
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      setSubmitError(getErrorMessage(err));
      setLoading(false);
    }
  };

  const handleOtpLogin = () => {
    const err = validateEmailOrPhone(emailOrPhone);
    if (err) {
      setEmailOrPhoneError(err);
      setSubmitError('Please enter your email or phone number first.');
      return;
    }
    setShowOtpModal(true);
  };

  const handleOtpLoginSuccess = async (response) => {
    setShowOtpModal(false);
    
    if (await completeLogin(response)) {
      // Success - navigation handled by RootNavigator
    } else {
      setSubmitError('Login failed');
    }
  };

  const handleSignup = async () => {
    setSubmitError('');
    if (!validateFields()) {
      setSubmitError('Please fix the errors above.');
      return;
    }
    setLoading(true);
    try {
      const response = await client.register({
        email: emailOrPhone,
        password: password,
        fullName: fullName,
        phoneNumber: phone,
        role: 'SERVICE_PROVIDER',
      });
      
      console.log('✅ Provider Signup successful:', response);
      
      const realProviderId = response.userId;
      const token = response.accessToken;
      
      if (realProviderId && token) {
        // Build providerData for verification screen
        const providerData = {
          providerId: realProviderId,
          _id: realProviderId,
          email: response.email || emailOrPhone,
          fullName: response.fullName || fullName,
          role: response.role,
          phone: phone,
          address: address,
          lat: latitude,
          lng: longitude,
          accessToken: token,
          refreshToken: response.refreshToken,
        };
        
        setLoading(false);
        
        // Navigate to verification screen
        navigation.navigate('SignupVerification', {
          phoneNumber: phone,
          email: emailOrPhone,
          userData: providerData,
          userType: 'PROVIDER',
          onVerificationComplete: async (verifiedData) => {
            await tokenService.storeTokens(token, response.refreshToken);
            await loginProvider(providerData, token);
            socketService.connect('provider', String(realProviderId));
          },
        });
      } else {
        setSubmitError('Signup response missing required data');
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Signup error:', err);
      setSubmitError(getErrorMessage(err));
      setLoading(false);
    }
  };

  const goToLogin = () => {
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
            style={[styles.input, fullNameError ? styles.inputError : null]}
            placeholder="Full Name"
            value={fullName}
            onChangeText={text => {
              setFullName(text);
              if (fullNameError) setFullNameError(validateFullName(text));
            }}
            onBlur={() => setFullNameError(validateFullName(fullName))}
          />
          {!!fullNameError && <Text style={styles.errorText}>{fullNameError}</Text>}
          
          <TextInput
            style={[styles.input, phoneError ? styles.inputError : null]}
            placeholder="Phone Number (e.g., +911234567890)"
            value={phone}
            onChangeText={text => {
              setPhone(text);
              if (phoneError) setPhoneError(validatePhone(text));
            }}
            keyboardType="phone-pad"
            onBlur={() => setPhoneError(validatePhone(phone))}
          />
          {!!phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
          
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
            <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Login with Password'}</Text>
          </TouchableOpacity>
          
          {/* Forgot Password */}
          <TouchableOpacity 
            style={styles.forgotPasswordButton} 
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
          
          {/* OTP Login Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
          
          {/* OTP Login Button */}
          <TouchableOpacity style={styles.otpButton} onPress={handleOtpLogin} disabled={loading}>
            <Text style={styles.otpButtonText}>🔐 Login with OTP</Text>
          </TouchableOpacity>
          
          {/* Google Sign-In */}
          <GoogleSignInButton
            userType="provider"
            title="Continue with Google"
            style={styles.googleButton}
            disabled={loading}
            onSuccess={async (response) => {
              try {
                setLoading(true);
                await loginWithGoogle(response);
                setSubmitSuccess('Google login successful!');
              } catch (error) {
                setSubmitError(error.message || 'Google login failed');
              } finally {
                setLoading(false);
              }
            }}
            onError={(error) => {
              if (error.message !== 'Sign-in cancelled') {
                setSubmitError(error.message || 'Google login failed');
              }
            }}
          />
          
          <View style={styles.linkContainer}>
            <Text style={styles.linkText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.replace('ProviderLoginSignup', { mode: 'signup' })} disabled={loading}>
              <Text style={styles.linkButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      {!!submitError && <Text style={styles.submitErrorText}>{submitError}</Text>}
      
      {/* OTP Login Modal */}
      <OtpLoginModal
        visible={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        emailOrPhone={emailOrPhone}
        onLoginSuccess={handleOtpLoginSuccess}
      />
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
  // OTP Login Styles
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 350,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  otpButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
  },
  otpButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButton: {
    marginTop: 12,
    width: '100%',
    maxWidth: 350,
  },
  forgotPasswordButton: {
    marginTop: 12,
    padding: 8,
    alignSelf: 'flex-end',
    maxWidth: 350,
    width: '100%',
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 14,
    textAlign: 'right',
  },
});

export default ProviderLoginSignup;
