/**
 * Verify Email Screen
 * 
 * Handles deep link email verification when user clicks verification link.
 * Deep link format: fixhomi://verify-email?token=<token>
 * 
 * API: GET /api/auth/email/verify?token=<token>
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { authClient } from '../src/api/client';

const VerifyEmailScreen = ({ route, navigation }) => {
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  
  // Get token from deep link params
  const token = route?.params?.token;

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
    }
  }, [token]);

  const verifyEmail = async (verificationToken) => {
    try {
      setStatus('verifying');
      
      const response = await authClient.get(`/api/auth/email/verify?token=${verificationToken}`);
      
      setStatus('success');
      setMessage(response.data?.message || 'Email verified successfully!');
    } catch (error) {
      console.error('Email verification error:', error);
      setStatus('error');
      
      const errorMessage = error.response?.data?.message || 'Failed to verify email. The link may have expired.';
      setMessage(errorMessage);
    }
  };

  const handleContinue = () => {
    // Navigate back to home or login
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <View style={styles.container}>
      {status === 'verifying' && (
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.title}>Verifying Email...</Text>
          <Text style={styles.subtitle}>Please wait while we verify your email address.</Text>
        </View>
      )}

      {status === 'success' && (
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.title}>Email Verified!</Text>
          <Text style={styles.subtitle}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.content}>
          <View style={[styles.iconContainer, styles.errorIcon]}>
            <Text style={styles.errorIconText}>✕</Text>
          </View>
          <Text style={styles.title}>Verification Failed</Text>
          <Text style={styles.subtitle}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 40,
    color: '#fff',
    fontWeight: 'bold',
  },
  errorIcon: {
    backgroundColor: '#ff4d4f',
  },
  errorIconText: {
    fontSize: 40,
    color: '#fff',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VerifyEmailScreen;
