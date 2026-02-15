/**
 * Email Verify Handler Screen
 * 
 * Handles email verification deep links
 * Called when user clicks the verification link in their email
 * 
 * Deep link format: fixhomi://auth/email-verify?token=xxx
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Alert } from '../components';
import { verifyEmailToken, getErrorMessage, AUTH_CODES } from '../services/authService';
import { useApp } from '../context/AppContext';

/**
 * EmailVerifyHandlerScreen Component
 * 
 * @param {Object} props - Screen props
 */
const EmailVerifyHandlerScreen = ({ route, navigation }) => {
  const { initializeAuth } = useApp();

  // Get token from route params or deep link
  const token = route?.params?.token;

  // State
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [verifiedEmail, setVerifiedEmail] = useState('');

  /**
   * Verify email on mount
   */
  useEffect(() => {
    if (token) {
      handleVerify();
    } else {
      setLoading(false);
      setError('Invalid verification link. No token provided.');
    }
  }, [token]);

  /**
   * Handle verification
   */
  const handleVerify = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await verifyEmailToken(token);

      if (result.success) {
        setSuccess(true);
        setVerifiedEmail(result.data?.maskedValue || result.data?.email || '');
        
        // Refresh user data
        await initializeAuth();
      } else {
        const { error: err } = result;
        
        switch (err.code) {
          case AUTH_CODES.INVALID_TOKEN:
            setError('This verification link is invalid or has already been used.');
            break;
            
          case AUTH_CODES.TOKEN_EXPIRED:
            setError('This verification link has expired. Please request a new one.');
            break;
            
          default:
            setError(err.message || 'Verification failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('❌ [EmailVerifyHandler] Error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigate to home
   */
  const handleContinue = () => {
    if (navigation?.reset) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } else if (navigation?.navigate) {
      navigation.navigate('Home');
    }
  };

  /**
   * Request new verification email
   */
  const handleRequestNew = () => {
    if (navigation?.navigate) {
      navigation.navigate('Verification', { verificationType: 'email' });
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Verifying your email...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Success state
  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.title}>Email Verified!</Text>
          <Text style={styles.subtitle}>
            {verifiedEmail 
              ? `Your email ${verifiedEmail} has been verified.`
              : 'Your email has been verified successfully.'
            }
          </Text>
          <Button
            title="Continue"
            onPress={handleContinue}
            style={styles.button}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        <View style={styles.iconContainerError}>
          <Text style={styles.errorIcon}>✕</Text>
        </View>
        <Text style={styles.title}>Verification Failed</Text>
        <Text style={styles.subtitle}>{error}</Text>
        <Button
          title="Request New Link"
          onPress={handleRequestNew}
          style={styles.button}
        />
        <Button
          title="Go to Home"
          onPress={handleContinue}
          variant="outline"
          style={styles.buttonSecondary}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 40,
    color: '#16A34A',
  },
  iconContainerError: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorIcon: {
    fontSize: 40,
    color: '#DC2626',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  button: {
    width: '100%',
    marginBottom: 12,
  },
  buttonSecondary: {
    width: '100%',
  },
});

export default EmailVerifyHandlerScreen;
