import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import socketService from '../utils/socket';
import { useApp } from '../context/AppContext';

function validateEmailOrPhone(value) {
  // Simple email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Simple phone regex (10-15 digits, allows + at start)
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


const UserLoginSignup = ({ route, navigation }) => {
  const { clearAppState } = useApp();
  
  useEffect(() => {
    // Clear any previous app state when user comes to login
    clearAppState();
  }, []);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [emailOrPhoneError, setEmailOrPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
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
    setSubmitSuccess('');
    if (!validateFields()) {
      setSubmitError('Please fix the errors above.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('http://10.0.2.2:5050/auth/login', {
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
      
      // Get user data from response
      const userData = await response.json();
      console.log('User login response:', userData); // Debug log
      
      setSubmitSuccess('Login successful!');
      setLoading(false);
      
      // ✅ CRITICAL FIX: Connect to socket with real user ID
      if (userData.userId) {
        socketService.connect('user', userData.userId);
        console.log('Connecting user to socket:', userData.userId);
      }
      
      // Navigate to UserLocation screen to start the proper flow
      navigation.replace('UserLocation');
    } catch (err) {
      setSubmitError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setSubmitError('');
    setSubmitSuccess('');
    if (!validateFields()) {
      setSubmitError('Please fix the errors above.');
      return;
    }
    setSubmitError('');
    setSubmitSuccess('');
    try {
  const response = await fetch('http://10.0.2.2:5050/auth/register', {
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
        return;
      }
      
      // Get user data from response
      const userData = await response.json();
      console.log('User register response:', userData); // Debug log
      
      setSubmitSuccess('Signup successful!');
      
      // ✅ CRITICAL FIX: Connect to socket with real user ID
      if (userData.userId) {
        socketService.connect('user', userData.userId);
        console.log('Connecting new user to socket:', userData.userId);
      }
      
      // Navigate to UserLocation screen to start the proper flow
      navigation.replace('UserLocation');
    } catch (err) {
      setSubmitError('Network error. Please try again.');
    }
  };

  const goToLogin = () => {
    navigation.replace('UserLoginSignup', { mode: 'login' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User {mode === 'signup' ? 'Signup' : 'Login'}</Text>
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
            <TouchableOpacity onPress={() => navigation.replace('UserLoginSignup', { mode: 'signup' })} disabled={loading}>
              <Text style={styles.linkButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      {!!submitError && <Text style={styles.submitErrorText}>{submitError}</Text>}
      {!!submitSuccess && <Text style={{ color: 'green', fontSize: 16, marginTop: 12, textAlign: 'center' }}>{submitSuccess}</Text>}
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

export default UserLoginSignup;
