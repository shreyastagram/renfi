/**
 * PhoneSignupScreen
 *
 * Step 2 of phone-only USER signup. Collects the user's full name + phone
 * number, then dispatches an OTP via NoeFix -> JAuth. T&C acceptance is
 * captured upstream in RegisterChoice (the only way to reach this screen
 * is via the "Continue with phone number" card, which is gated behind
 * the existing T&C checkbox), so this screen doesn't ask again.
 *
 * On success, bubbles { method:'phone', context:'signup', fullName,
 * signupExtras } up to UserAuthScreen, which switches to the shared
 * OTP_VERIFY mode. OTPVerifyScreen branches on context to call the
 * phone-signup verify endpoint instead of the phone-login one.
 *
 * USERS ONLY: no provider entry point reaches this screen.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TouchableOpacity from '../components/TouchableOpacity';
import { Button, Input, PhoneInput, Alert, FixhomiLogo } from '../components';
import { sendPhoneSignupOtp, getErrorMessage, AUTH_CODES } from '../services/authService';
import { validatePhone } from '../utils/validation';
import { useLanguage } from '../context/LanguageContext';

const PhoneSignupScreen = ({ onOtpSent, onBack, signupExtras = {} }) => {
  const { t } = useLanguage();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [alertHint, setAlertHint] = useState(null);

  const showAlert = useCallback((message, type = 'error', hint = null) => {
    setAlertMessage(message);
    setAlertType(type);
    setAlertHint(hint);
  }, []);

  const clearAlert = useCallback(() => {
    setAlertMessage(null);
    setAlertHint(null);
  }, []);

  const validate = () => {
    const next = {};
    if (!fullName || fullName.trim().length < 2) {
      next.fullName = t('auth.fullNameRequired') || 'Please enter your full name';
    } else if (fullName.trim().length > 100) {
      next.fullName = t('auth.fullNameTooLong') || 'Full name is too long';
    }
    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.isValid) {
      next.phone = phoneCheck.error;
    }
    return { isValid: Object.keys(next).length === 0, errors: next };
  };

  const handleSendOtp = async () => {
    try {
      clearAlert();
      setErrors({});

      const v = validate();
      if (!v.isValid) {
        setErrors(v.errors);
        showAlert(t('auth.formErrors') || 'Please fix the highlighted fields', 'warning');
        return;
      }

      setLoading(true);
      const result = await sendPhoneSignupOtp(phone, fullName);

      if (result.success) {
        const maskedValue = result.maskedPhone;
        // Bubble up to UserAuthScreen which switches to OTP_VERIFY (context='signup').
        if (onOtpSent) {
          onOtpSent({
            method: 'phone',
            context: 'signup',
            identifier: phone,
            fullName: fullName.trim(),
            maskedValue,
            expiresInMinutes: result.expiresInMinutes,
            userType: 'user',
            // Forwarded all the way through to verifyPhoneSignupOtp so NoeFix's
            // LEGAL_ACCEPTANCE_REQUIRED gate is satisfied.
            signupExtras: {
              termsAccepted: true,
              privacyAccepted: true,
              referralCode: signupExtras.referralCode,
              termsVersion: signupExtras.termsVersion,
              privacyVersion: signupExtras.privacyVersion,
            },
          });
        }
        return;
      }

      const { error } = result;
      switch (error?.code) {
        case AUTH_CODES.PHONE_ALREADY_EXISTS:
          showAlert(
            t('auth.phoneAlreadyRegistered') ||
              'This mobile number is already registered. Please log in instead.',
            'error',
          );
          break;
        case AUTH_CODES.TOO_MANY_REQUESTS:
          showAlert(t('auth.tooManyRequests') || 'Too many requests. Please wait and try again.', 'warning');
          break;
        case AUTH_CODES.NETWORK_ERROR:
        case AUTH_CODES.SERVER_UNREACHABLE:
        case AUTH_CODES.SERVER_TIMEOUT:
        case AUTH_CODES.NO_INTERNET:
          showAlert(error.message || getErrorMessage(error.code), 'error', error.hint);
          break;
        default:
          showAlert(error?.message || t('auth.sendOtpFailed') || 'Could not send OTP. Try again.', 'error');
      }
    } catch (err) {
      console.error('[PhoneSignupScreen] Unexpected error:', err);
      showAlert(t('auth.unexpectedError') || 'Something went wrong.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            {onBack && (
              <TouchableOpacity
                onPress={onBack}
                style={styles.backButton}
                accessibilityLabel={t('common.goBack')}
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color="#1E293B" />
              </TouchableOpacity>
            )}
            <View style={styles.logoContainer}>
              <FixhomiLogo size={44} />
            </View>
            <Text style={styles.brandName}>FixHomi</Text>
            <Text style={styles.title}>
              {t('auth.phoneSignupTitle') || 'Sign up with phone'}
            </Text>
            <Text style={styles.subtitle}>
              {t('auth.phoneSignupSubtitle') ||
                "Enter your name and mobile number — we'll send a verification code"}
            </Text>
          </View>

          {alertMessage && (
            <Alert
              type={alertType}
              message={alertMessage}
              hint={alertHint}
              onDismiss={clearAlert}
              style={styles.alert}
            />
          )}

          <View style={styles.form}>
            <Input
              label={t('auth.fullName') || 'Full name'}
              value={fullName}
              onChangeText={(v) => {
                setFullName(v);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: null }));
                if (alertMessage) clearAlert();
              }}
              placeholder={t('auth.fullNamePlaceholder') || 'Enter your full name'}
              autoCapitalize="words"
              autoComplete="name"
              error={errors.fullName}
              editable={!loading}
              required
            />

            <PhoneInput
              label={t('auth.phoneNumber') || 'Phone number'}
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: null }));
                if (alertMessage) clearAlert();
              }}
              error={errors.phone}
              editable={!loading}
              required
            />

            <Button
              title={loading ? (t('auth.sendingOtp') || 'Sending OTP…') : (t('auth.sendOtp') || 'Send OTP')}
              onPress={handleSendOtp}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
            />
          </View>

          <View style={styles.info}>
            <Text style={styles.infoText}>
              {t('auth.phoneSignupInfo') ||
                "We'll text a 6-digit code to verify it's your number. You can add an email later from your profile."}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },

  header: { marginBottom: 28, alignItems: 'center' },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 8,
    zIndex: 1,
  },
  logoContainer: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#f67c16', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 5 },
    }),
  },
  brandName: { fontSize: 18, fontWeight: '800', color: '#f67c16', marginTop: 10, marginBottom: 14, letterSpacing: 0.3 },
  title: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748B', lineHeight: 21, textAlign: 'center', paddingHorizontal: 8 },

  alert: { marginBottom: 16 },

  form: { gap: 16 },
  submitButton: { marginTop: 8 },

  info: { marginTop: 28, padding: 14, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  infoText: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});

export default PhoneSignupScreen;
