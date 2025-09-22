import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import socketService from '../utils/socket';
import { userStorage } from '../utils/userStorage';
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
  const { clearAppState, loginUser } = useApp();
  
  useEffect(() => {
    // Clear any previous app state when user comes to login
    clearAppState();
  }, []);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [emailOrPhoneError, setEmailOrPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [fullNameError, setFullNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [cityError, setCityError] = useState('');
  const [pincodeError, setPincodeError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const mode = route?.params?.mode || 'login';

  const validateAddress = (value) => {
    if (!value) return 'Address is required.';
    if (value.length < 5) return 'Address must be at least 5 characters.';
    return '';
  };

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

  const validateCity = (value) => {
    if (!value) return 'City is required.';
    if (value.length < 2) return 'City must be at least 2 characters.';
    return '';
  };

  const validatePincode = (value) => {
    const pincodeRegex = /^\d{5,6}$/;
    if (!value) return 'Pincode is required.';
    if (!pincodeRegex.test(value)) return 'Enter a valid pincode (5-6 digits).';
    return '';
  };

  const validateFields = () => {
    const emailOrPhoneErr = validateEmailOrPhone(emailOrPhone);
    const passwordErr = validatePassword(password);
    
    if (mode === 'signup') {
      const fullNameErr = validateFullName(fullName);
      const phoneErr = validatePhone(phone);
      const addressErr = validateAddress(address);
      const cityErr = validateCity(city);
      const pincodeErr = validatePincode(pincode);
      
      setFullNameError(fullNameErr);
      setPhoneError(phoneErr);
      setAddressError(addressErr);
      setCityError(cityErr);
      setPincodeError(pincodeErr);
      setEmailOrPhoneError(emailOrPhoneErr);
      setPasswordError(passwordErr);
      
      return !emailOrPhoneErr && !passwordErr && !fullNameErr && !phoneErr && !addressErr && !cityErr && !pincodeErr;
    } else {
      setEmailOrPhoneError(emailOrPhoneErr);
      setPasswordError(passwordErr);
      return !emailOrPhoneErr && !passwordErr;
    }
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
      console.log('User ID from response:', userData.userId);
      console.log('User ID from data:', userData.data?._id);
      console.log('User ID from user:', userData.user?._id);
      console.log('Response keys:', Object.keys(userData));
      
      // Save authentication data - try different possible user ID fields
      const userId = userData.userId || userData.data?._id || userData.user?._id || userData._id;
      const token = userData.token;
      
      if (userId && token) {
        console.log('✅ Saving user ID:', userId);
        console.log('✅ Saving token:', token ? 'Present' : 'Missing');
        
        // Use the new authentication context
        await loginUser(userData, token);
        
        // ✅ CRITICAL FIX: Connect to socket with real user ID
        socketService.connect('user', userId);
        console.log('Connecting user to socket:', userId);
      } else {
        console.error('❌ Missing userId or token in response');
        console.error('User ID found:', userId);
        console.error('Token found:', token ? 'Present' : 'Missing');
        setSubmitError('Login response missing required data');
        setLoading(false);
        return;
      }
      
      setSubmitSuccess('Login successful!');
      setLoading(false);
      
      // Navigation will be handled automatically by RootNavigator
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
          fullName,
          phone,
          address,
          city,
          pincode,
          emergencyContact: phone, // Use phone as emergency contact for now
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
      console.log('User ID from response:', userData.userId);
      console.log('User ID from data:', userData.data?._id);
      console.log('User ID from user:', userData.user?._id);
      console.log('Response keys:', Object.keys(userData));
      
      // Save authentication data - try different possible user ID fields
      const userId = userData.userId || userData.data?._id || userData.user?._id || userData._id;
      const token = userData.token;
      
      if (userId && token) {
        console.log('✅ Saving user ID:', userId);
        console.log('✅ Saving token:', token ? 'Present' : 'Missing');
        
        // Use the new authentication context
        await loginUser(userData, token);
        
        // ✅ CRITICAL FIX: Connect to socket with real user ID
        socketService.connect('user', userId);
        console.log('Connecting new user to socket:', userId);
      } else {
        console.error('❌ Missing userId or token in response');
        console.error('User ID found:', userId);
        console.error('Token found:', token ? 'Present' : 'Missing');
        setSubmitError('Signup response missing required data');
        setLoading(false);
        return;
      }
      
      setSubmitSuccess('Signup successful!');
      
      // Navigation will be handled automatically by RootNavigator
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
            placeholder="Phone Number"
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
            placeholder="Home Address"
            value={address}
            onChangeText={text => {
              setAddress(text);
              if (addressError) setAddressError(validateAddress(text));
            }}
            multiline
            numberOfLines={2}
            onBlur={() => setAddressError(validateAddress(address))}
          />
          {!!addressError && <Text style={styles.errorText}>{addressError}</Text>}
          
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <TextInput
                style={[styles.input, cityError ? styles.inputError : null]}
                placeholder="City"
                value={city}
                onChangeText={text => {
                  setCity(text);
                  if (cityError) setCityError(validateCity(text));
                }}
                onBlur={() => setCityError(validateCity(city))}
              />
              {!!cityError && <Text style={styles.errorText}>{cityError}</Text>}
            </View>
            
            <View style={styles.halfInput}>
              <TextInput
                style={[styles.input, pincodeError ? styles.inputError : null]}
                placeholder="Pincode"
                value={pincode}
                onChangeText={text => {
                  setPincode(text);
                  if (pincodeError) setPincodeError(validatePincode(text));
                }}
                keyboardType="numeric"
                maxLength={6}
                onBlur={() => setPincodeError(validatePincode(pincode))}
              />
              {!!pincodeError && <Text style={styles.errorText}>{pincodeError}</Text>}
            </View>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 350,
  },
  halfInput: {
    width: '48%',
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
