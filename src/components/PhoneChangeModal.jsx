/**
 * PhoneChangeModal — verify-then-replace phone flow (both roles).
 *
 * Two steps in one sheet:
 *   1. Enter the NEW number.
 *   2. Enter the OTP sent to it.
 *
 * The account's current number is NOT touched until the OTP is verified —
 * Java Auth swaps the number and its verified flag atomically on verify. On
 * success we mirror the now-authoritative number into Mongo (sync-phone, which
 * re-reads truth from Java) and hand the fresh profile back to the caller.
 *
 * Used for three cases with identical UX: add a first number (Google/Apple
 * accounts), re-verify a stored-but-unverified number, and change a verified
 * number. Same component for user and provider.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, Animated, Platform, KeyboardAvoidingView,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import PhoneInput from './PhoneInput';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { sendPhoneChangeOtp, verifyPhoneChangeOtp, syncPhoneToMongoDB } from '../services/authService';
import { getTokens } from '../utils/storage';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

const PhoneChangeModal = ({ visible, onClose, currentPhone, onChanged }) => {
  const { dialog } = useDialog();
  const { t } = useLanguage();
  const { user, profile, userType, refreshProfile, refreshVerificationStatus } = useApp();

  const [step, setStep] = useState('enter'); // 'enter' | 'otp'
  const [newPhone, setNewPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inFlight = useRef(false); // reentry guard across renders
  const timerRef = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Reset everything whenever the sheet opens/closes.
  useEffect(() => {
    if (visible) {
      setStep('enter');
      setNewPhone('');
      setOtp('');
      setCountdown(0);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [visible]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); timerRef.current = null; return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleSend = useCallback(async () => {
    if (inFlight.current) return;
    if (!/^[6-9]\d{9}$/.test(newPhone)) {
      dialog(t('profile.invalidPhone'), t('profile.invalidPhoneMsg'));
      return;
    }
    // Re-entering the same number is allowed (re-verify path); the backend
    // rejects only an already-VERIFIED same number, with a clear message.
    inFlight.current = true;
    setSending(true);
    try {
      const result = await sendPhoneChangeOtp(newPhone);
      if (result.success) {
        setStep('otp');
        setOtp('');
        startCountdown();
      } else {
        dialog(t('common.error'), result.error?.message || t('profile.otpSendFail'));
      }
    } catch {
      dialog(t('common.error'), t('profile.otpSendFail'));
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  }, [newPhone, currentPhone, dialog, t, startCountdown]);

  const handleVerify = useCallback(async () => {
    if (inFlight.current) return;
    if (otp.length !== OTP_LENGTH) { shake(); return; }
    inFlight.current = true;
    setVerifying(true);
    try {
      const result = await verifyPhoneChangeOtp(newPhone, otp);
      if (!result.success) {
        shake();
        setOtp('');
        dialog(t('common.error'), result.error?.message || t('profile.invalidOtp'));
        return;
      }
      // Java Auth committed the new number + verified flag. Mirror into Mongo —
      // sync-phone re-reads truth from Java, so we don't send the flag ourselves.
      const uid = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
      if (uid) {
        try {
          const tokens = await getTokens();
          await syncPhoneToMongoDB({
            mongoId: uid,
            userType: userType === 'provider' ? 'provider' : 'user',
            accessToken: tokens?.accessToken,
          });
        } catch (syncErr) {
          console.warn('[PhoneChangeModal] Mongo sync after change failed (non-blocking):', syncErr?.message);
        }
        // Refresh so every surface reflects the new verified number immediately.
        await refreshVerificationStatus?.();
        await refreshProfile?.(userType, uid, { force: true });
      }
      onChanged?.(newPhone);
      onClose?.();
      dialog(t('common.success'), t('phoneChange.successMsg'));
    } catch {
      shake();
      dialog(t('common.error'), t('profile.verificationFailed'));
    } finally {
      setVerifying(false);
      inFlight.current = false;
    }
  }, [otp, newPhone, user, profile, userType, refreshProfile, refreshVerificationStatus, onChanged, onClose, dialog, t, shake]);

  const busy = sending || verifying;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onClose?.()}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.dragBar} />
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <MaterialIcon name="smartphone" size={22} color="#2b76bc" />
            </View>
            <TouchableOpacity onPress={() => !busy && onClose?.()} disabled={busy} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcon name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {step === 'enter' ? (
            <>
              <Text style={styles.title}>{t('phoneChange.enterTitle')}</Text>
              <Text style={styles.subtitle}>
                {currentPhone ? t('phoneChange.enterSubChange') : t('phoneChange.enterSubAdd')}
              </Text>
              <PhoneInput
                label={t('profile.phoneLabel')}
                value={newPhone}
                onChangeText={setNewPhone}
                editable={!busy}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, (busy || newPhone.length !== 10) && styles.primaryBtnDisabled]}
                onPress={handleSend}
                disabled={busy || newPhone.length !== 10}
                activeOpacity={0.85}
              >
                {sending ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.primaryBtnText}>{t('phoneChange.sendOtp')}</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('phoneChange.otpTitle')}</Text>
              <Text style={styles.subtitle}>{t('phoneChange.otpSub', { phone: `+91 ${newPhone}` })}</Text>
              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH))}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  placeholder="••••••"
                  placeholderTextColor="#CBD5E1"
                  editable={!busy}
                  autoFocus
                  textContentType="oneTimeCode"
                  autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                />
              </Animated.View>
              <TouchableOpacity
                style={[styles.primaryBtn, (busy || otp.length !== OTP_LENGTH) && styles.primaryBtnDisabled]}
                onPress={handleVerify}
                disabled={busy || otp.length !== OTP_LENGTH}
                activeOpacity={0.85}
              >
                {verifying ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.primaryBtnText}>{t('phoneChange.verifyChange')}</Text>}
              </TouchableOpacity>
              <View style={styles.resendRow}>
                {countdown > 0 ? (
                  <Text style={styles.resendMuted}>{t('phoneChange.resendIn', { s: countdown })}</Text>
                ) : (
                  <TouchableOpacity onPress={handleSend} disabled={busy}>
                    <Text style={styles.resendLink}>{t('phoneChange.resend')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => !busy && setStep('enter')} disabled={busy}>
                  <Text style={styles.resendLink}>{t('phoneChange.changeNumber')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34 },
  dragBar: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EAF2FB', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3, marginTop: 4 },
  subtitle: { fontSize: 13.5, color: '#64748B', lineHeight: 20, marginTop: 6, marginBottom: 16 },
  primaryBtn: { backgroundColor: '#2b76bc', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryBtnDisabled: { backgroundColor: '#B7CDE6' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '700' },
  otpInput: {
    borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 14, height: 60, textAlign: 'center',
    fontSize: 26, fontWeight: '700', letterSpacing: 12, color: '#0F172A', backgroundColor: '#F8FAFC',
  },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  resendMuted: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  resendLink: { fontSize: 13, color: '#2b76bc', fontWeight: '700' },
});

export default PhoneChangeModal;
