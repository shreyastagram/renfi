import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import socketService from '../utils/socket';
import { providerStorage } from '../utils/providerStorage';

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
  const [emailOrPhoneError, setEmailOrPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [addressError, setAddressError] = useState('');
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
    setEmailOrPhoneError(emailOrPhoneErr);
    setPasswordError(passwordErr);
    setAddressError(addressErr);
    return !emailOrPhoneErr && !passwordErr && !addressErr;
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
      
      console.log('✅ Login successful:', providerData);
      
      // Extract real provider ID
      const realProviderId = providerData.providerId || providerData.data?._id;
      
      if (!realProviderId) {
        setSubmitError('Failed to get provider ID from server.');
        return;
      }
      
      // Store provider ID and data
      await providerStorage.saveProviderId(realProviderId);
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
      
      // Store provider ID and data
      await providerStorage.saveProviderId(realProviderId);
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
});

export default ProviderLoginSignup;
