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
import { useLanguage } from '../context/LanguageContext';

/**
 * EmailVerifyHandlerScreen Component
 * 
 * @param {Object} props - Screen props
 */
const EmailVerifyHandlerScreen = ({ route, navigation }) => {
  const { initializeAuth, userType } = useApp();
  const { t } = useLanguage();

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
      setError(t('emailVerify.noToken'));
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
            setError(t('emailVerify.invalidToken'));
            break;

          case AUTH_CODES.TOKEN_EXPIRED:
            setError(t('emailVerify.tokenExpired'));
            break;

          default:
            setError(err.message || t('verificationScreen.verificationFailed'));
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
    // No top-level 'Home' route for users — user home is HomeTab inside UserTabs
    // (providers: ProviderTabs). Default to UserTabs (this flow is user-facing).
    const homeNav = userType === 'provider' ? 'ProviderTabs' : 'UserTabs';
    if (navigation?.reset) {
      navigation.reset({
        index: 0,
        routes: [{ name: homeNav }],
      });
    } else if (navigation?.navigate) {
      navigation.navigate(homeNav);
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
          <Text style={styles.loadingText}>{t('emailVerify.verifying')}</Text>
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
          <Text style={styles.title}>{t('emailVerify.verified')}</Text>
          <Text style={styles.subtitle}>
            {verifiedEmail
              ? t('emailVerify.verifiedMsg', { email: verifiedEmail })
              : t('emailVerify.verifiedMsgNoEmail')
            }
          </Text>
          <Button
            title={t('common.continue')}
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
        <Text style={styles.title}>{t('emailVerify.verificationFailed')}</Text>
        <Text style={styles.subtitle}>{error}</Text>
        <Button
          title={t('emailVerify.requestNewLink')}
          onPress={handleRequestNew}
          style={styles.button}
        />
        <Button
          title={t('emailVerify.goToHome')}
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
