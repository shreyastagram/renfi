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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PhoneInput from './PhoneInput';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { sendPhoneChangeOtp, verifyPhoneChangeOtp, syncPhoneToMongoDB } from '../services/authService';
import { syncVerificationStatus } from '../services/verificationService';
import { getTokens } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;
// Resume the OTP step for this long after send (matches server OTP validity).
const OTP_TTL_SECONDS = 5 * 60;
const PENDING_CHANGE_KEY = 'pending_phone_change_v1';

const PhoneChangeModal = ({ visible, onClose, currentPhone, onChanged, bottomInset }) => {
  const { dialog } = useDialog();
  const { t } = useLanguage();
  const { user, profile, userType, refreshProfile, refreshVerificationStatus } = useApp();
  // useSafeAreaInsets is unreliable inside an RN Modal (separate window — often
  // returns 0 for the bottom), which let the button slip under a 3-button nav
  // bar. Use the inset from the parent screen (correct for BOTH gesture and
  // 3-button nav); fall back to the modal's own reading, then a small floor for
  // the degenerate case where both report 0 (non-edge-to-edge, nav bar is opaque
  // and the sheet already sits above it).
  const modalInsets = useSafeAreaInsets();
  const safeBottom = Math.max(bottomInset || 0, modalInsets.bottom || 0, 20);
  const otpInputRef = useRef(null);

  const [step, setStep] = useState('enter'); // 'enter' | 'otp'
  const [newPhone, setNewPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [fieldError, setFieldError] = useState(''); // inline message under the number field
  const [otpError, setOtpError] = useState(''); // inline message under the OTP field
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inFlight = useRef(false); // reentry guard across renders
  const timerRef = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Reset on open — but RESUME the OTP step if the app was killed mid-flow
  // (low-RAM phones die when the user hops to the SMS app). The OTP is still
  // valid server-side; losing the sheet's in-memory state shouldn't force a
  // fresh send. Persisted only between send and success/close/change-number.
  useEffect(() => {
    if (visible) {
      let cancelled = false;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(PENDING_CHANGE_KEY);
          if (!cancelled && raw) {
            const p = JSON.parse(raw);
            const elapsed = (Date.now() - (p.sentAt || 0)) / 1000;
            if (p.newPhone && elapsed < OTP_TTL_SECONDS) {
              setNewPhone(p.newPhone);
              setStep('otp');
              setOtp('');
              setFieldError('');
              setOtpError('');
              const remaining = Math.max(0, Math.ceil(RESEND_SECONDS - elapsed));
              if (remaining > 0) resumeCountdown(remaining); else setCountdown(0);
              return;
            }
          }
        } catch (e) { /* fall through to clean reset */ }
        if (!cancelled) {
          setStep('enter'); setNewPhone(''); setOtp('');
          setFieldError(''); setOtpError(''); setCountdown(0);
        }
      })();
      return () => { cancelled = true; };
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    return undefined;
  }, [visible, resumeCountdown]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Raise the keyboard on the OTP step. autoFocus inside an RN Modal is
  // unreliable on iOS (focus fires before the modal finishes presenting), so
  // focus explicitly after a short settle delay on iOS.
  useEffect(() => {
    if (step !== 'otp') return undefined;
    const id = setTimeout(() => otpInputRef.current?.focus(), Platform.OS === 'ios' ? 350 : 50);
    return () => clearTimeout(id);
  }, [step]);

  const resumeCountdown = useCallback((from) => {
    setCountdown(from);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); timerRef.current = null; return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);
  const startCountdown = useCallback(() => resumeCountdown(RESEND_SECONDS), [resumeCountdown]);

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
    setFieldError('');
    if (!/^[6-9]\d{9}$/.test(newPhone)) {
      setFieldError(t('profile.invalidPhoneMsg'));
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
        setOtpError('');
        startCountdown();
        // Persist so a mid-OTP process death (SMS-app hop on low-RAM phones)
        // resumes on the OTP step instead of forcing a fresh send.
        AsyncStorage.setItem(PENDING_CHANGE_KEY, JSON.stringify({ newPhone, sentAt: Date.now() })).catch(() => {});
      } else {
        // 4xx from send-otp is always about THIS number (taken / same verified
        // number / invalid) → show a calm inline message under the field, not a
        // scary error dialog. Reserve dialogs for network/unexpected failures.
        const status = result.error?.status;
        const raw = (result.error?.message || '').toLowerCase();
        if (status && status >= 400 && status < 500) {
          // Order matters: "already your" must be checked before the generic
          // "already"/"in use" so a user re-entering their OWN verified number
          // doesn't get the "belongs to another account" message.
          if (raw.includes('already your')) {
            setFieldError(t('phoneChange.alreadyYours'));
          } else if (raw.includes('in use') || raw.includes('already')) {
            setFieldError(t('phoneChange.numberInUse'));
          } else {
            setFieldError(result.error?.message || t('profile.otpSendFail'));
          }
        } else {
          dialog(t('common.error'), t('profile.otpSendFail'));
        }
      }
    } catch {
      dialog(t('common.error'), t('profile.otpSendFail'));
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  }, [newPhone, dialog, t, startCountdown]);

  const handleVerify = useCallback(async () => {
    if (inFlight.current) return;
    setOtpError('');
    if (otp.length !== OTP_LENGTH) { shake(); return; }
    inFlight.current = true;
    setVerifying(true);
    try {
      const result = await verifyPhoneChangeOtp(newPhone, otp);
      if (!result.success) {
        // Verification failed → the number was NOT changed. Show the reason
        // inline under the OTP field; the current number is still intact.
        shake();
        setOtp('');
        setOtpError(result.error?.message || t('profile.invalidOtp'));
        return;
      }
      // SUCCESS: Java Auth already committed the new number + verified flag in
      // one transaction. Everything below is best-effort UI refresh — a failure
      // here must NOT report the (already committed) change as failed.
      const uid = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
      try {
        if (uid) {
          const tokens = await getTokens();
          // Mirror into Mongo — the server re-reads truth from Java; we also
          // send the number so the write doesn't depend solely on that re-read.
          const syncPayload = {
            mongoId: uid,
            userType: userType === 'provider' ? 'provider' : 'user',
            accessToken: tokens?.accessToken,
            phoneNumber: newPhone,
          };
          // One retry: the old single silent best-effort shot is how provider
          // mirrors went stale (verification-dashboard incident, 2026-07-19).
          let sync = await syncPhoneToMongoDB(syncPayload);
          if (!sync?.success) {
            await new Promise((r) => setTimeout(r, 1500));
            sync = await syncPhoneToMongoDB(syncPayload);
            if (!sync?.success) {
              console.warn('[PhoneChangeModal] Mongo mirror sync failed twice — server-side dashboard self-heal will cover it');
            }
          }
          // Providers: heal the verification dashboard mirror right now too,
          // so the phone step is verified the moment they navigate there.
          if (userType === 'provider') {
            try { await syncVerificationStatus(uid); } catch (e) { /* dashboard self-heals server-side */ }
          }
          // Refresh so every surface reflects the new verified number immediately.
          await refreshVerificationStatus?.();
          await refreshProfile?.(userType, uid, { force: true });
        }
      } catch (refreshErr) {
        console.warn('[PhoneChangeModal] Post-change refresh failed (change already saved):', refreshErr?.message);
      }
      AsyncStorage.removeItem(PENDING_CHANGE_KEY).catch(() => {}); // change complete — nothing to resume
      onChanged?.(newPhone);
      onClose?.();
      dialog(t('common.success'), t('phoneChange.successMsg'));
    } catch {
      // Network/unexpected error talking to the verify endpoint — the change did
      // not complete; let the user retry.
      shake();
      setOtpError(t('profile.verificationFailed'));
    } finally {
      setVerifying(false);
      inFlight.current = false;
    }
  }, [otp, newPhone, user, profile, userType, refreshProfile, refreshVerificationStatus, onChanged, onClose, dialog, t, shake]);

  const busy = sending || verifying;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => !busy && onClose?.()}>
      {/* RN Modal on Android is a separate window that does not reliably respond
          to adjustResize, so we drive keyboard avoidance ourselves with padding
          on BOTH platforms — the bottom-anchored sheet then lifts above the
          keyboard and the input stays visible. */}
      <KeyboardAvoidingView behavior="padding" style={styles.overlay} keyboardVerticalOffset={0}>
        <View style={[styles.sheet, { paddingBottom: safeBottom + 14 }]}>
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
                onChangeText={(v) => { setNewPhone(v); if (fieldError) setFieldError(''); }}
                editable={!busy}
              />
              {!!fieldError && (
                <View style={styles.inlineMsg}>
                  <MaterialIcon name="info-outline" size={16} color="#B45309" />
                  <Text style={styles.inlineMsgText}>{fieldError}</Text>
                </View>
              )}
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
                  ref={otpInputRef}
                  style={[styles.otpInput, !!otpError && styles.otpInputError]}
                  value={otp}
                  onChangeText={(v) => { setOtp(v.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH)); if (otpError) setOtpError(''); }}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  placeholder="••••••"
                  placeholderTextColor="#CBD5E1"
                  editable={!busy}
                  textContentType="oneTimeCode"
                  autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                />
              </Animated.View>
              {!!otpError && (
                <View style={styles.inlineMsg}>
                  <MaterialIcon name="info-outline" size={16} color="#B45309" />
                  <Text style={styles.inlineMsgText}>{otpError}</Text>
                </View>
              )}
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
                <TouchableOpacity
                  onPress={() => { if (!busy) { AsyncStorage.removeItem(PENDING_CHANGE_KEY).catch(() => {}); setStep('enter'); } }}
                  disabled={busy}
                >
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
    fontSize: 26, fontWeight: '700', letterSpacing: 8, color: '#0F172A', backgroundColor: '#F8FAFC',
    // iOS renders trailing letter-spacing after the last glyph, shifting centered
    // text right; nudge left to re-center. Android has no trailing gap.
    paddingLeft: Platform.OS === 'ios' ? 8 : 0,
  },
  otpInputError: { borderColor: '#FCA5A5' },
  // Calm inline hint (amber), NOT an alarming red form-validation label
  inlineMsg: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 10,
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10,
  },
  inlineMsgText: { flex: 1, fontSize: 12.5, color: '#92400E', lineHeight: 18, fontWeight: '600' },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  resendMuted: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  resendLink: { fontSize: 13, color: '#2b76bc', fontWeight: '700' },
});

export default PhoneChangeModal;
