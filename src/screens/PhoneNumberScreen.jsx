/**
 * PhoneNumberScreen
 *
 * Phone-entry step of the UNIFIED user auth flow. Collects ONLY the phone
 * number (no name — new accounts start with an empty name; the Welcome
 * popup optionally collects one) and dispatches an OTP via the unified
 * NoeFix endpoint, which decides login vs signup server-side.
 *
 * On success, bubbles { method:'phone', context:'unified', flow, … } up to
 * UserAuthScreen, which switches to the shared OTP_VERIFY mode.
 * A 409 ROLE_CONFLICT (number belongs to a provider) shows a clear message.
 *
 * USERS ONLY: no provider entry point reaches this screen.
 */

import React, { useState, useCallback, useRef } from 'react';
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
import { Button, PhoneInput, Alert, FixhomiLogo } from '../components';
import { sendUnifiedPhoneOtp, getErrorMessage, AUTH_CODES } from '../services/authService';
import { validatePhone } from '../utils/validation';
import { useLanguage } from '../context/LanguageContext';

const PhoneNumberScreen = ({ onOtpSent, onBack }) => {
  const { t } = useLanguage();

  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
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

  const handleSendOtp = async () => {
    // Synchronous re-entry guard — a same-frame double-tap would otherwise
    // send two OTP SMS before `loading` state re-renders.
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      clearAlert();
      setPhoneError(null);

      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.isValid) {
        setPhoneError(phoneCheck.error);
        return;
      }

      setLoading(true);
      const result = await sendUnifiedPhoneOtp(phone);

      if (result.success) {
        // Bubble up to UserAuthScreen which switches to OTP_VERIFY
        // (context='unified'; `flow` must be echoed back at verify time).
        if (onOtpSent) {
          onOtpSent({
            method: 'phone',
            context: 'unified',
            flow: result.flow,
            identifier: phone,
            maskedValue: result.maskedPhone,
            expiresInMinutes: result.expiresInMinutes,
            userType: 'user',
          });
        }
        return;
      }

      const { error } = result;
      switch (error?.code) {
        case 'ROLE_CONFLICT':
          showAlert(
            t('auth.providerAccountPhone') ||
              'This number belongs to a Provider account. Please sign in from the Provider screen.',
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
      console.error('[PhoneNumberScreen] Unexpected error:', err);
      showAlert(t('auth.unexpectedError') || 'Something went wrong.', 'error');
    } finally {
      setLoading(false);
      submittingRef.current = false;
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
              {t('auth.phoneEntryTitle') || 'Continue with phone'}
            </Text>
            <Text style={styles.subtitle}>
              {t('auth.phoneEntrySubtitle') ||
                "Enter your mobile number — we'll send a 6-digit verification code"}
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
            <PhoneInput
              label={t('auth.phoneNumber') || 'Phone number'}
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                if (phoneError) setPhoneError(null);
                if (alertMessage) clearAlert();
              }}
              error={phoneError}
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
              {t('auth.phoneEntryInfo') ||
                "New to FixHomi? We'll create your account automatically after you verify the code."}
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

export default PhoneNumberScreen;
