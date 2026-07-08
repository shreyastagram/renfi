/**
 * WelcomeModal
 *
 * Post-signup welcome popup for NEW users in the unified auth flow.
 * Shown after a successful Google / Apple / phone auth where isNewUser===true,
 * BEFORE handleAuthSuccess runs (the parent holds the auth result).
 *
 * Contents:
 *   - "Welcome to FixHomi" title + informational terms sentence
 *   - Name input (ONLY for phone signups — Google/Apple provide a name).
 *     Optional and skippable: phone accounts are created with an EMPTY name,
 *     never a placeholder value.
 *   - Optional referral code input (auto-uppercase, max 16)
 *   - Continue (primary) + "Skip for now" text button
 *
 * `onComplete({ fullName?, referralCode? })` is async — if it resolves with
 * { referralError } the modal stays open and shows the error inline so the
 * user can correct the code or skip. Otherwise the parent proceeds with
 * handleAuthSuccess and hides the modal.
 *
 * Modeled on AppleEmailCollectionModal (animation + KeyboardAvoidingView).
 *
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Keyboard,
  Platform,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import TouchableOpacity from './TouchableOpacity';
import { useLanguage } from '../context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  primary: '#f67c16',
  white: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  overlay: 'rgba(15, 23, 42, 0.55)',
  inputBg: '#F8FAFC',
  disabled: '#94A3B8',
  cardBg: '#FFFFFF',
};

const WelcomeModal = ({ visible, needsName, initialReferralCode, onComplete, onSkip }) => {
  const { t } = useLanguage();

  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Synchronous re-entry guard — `loading` state doesn't update until the next
  // render, so a same-frame double-tap would fire onComplete/onSkip twice.
  const submittingRef = useRef(false);

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Reset + animate in whenever the modal opens. Name is NEVER pre-filled
  // (no placeholder values); referral pre-fills from the deep-link code.
  useEffect(() => {
    if (visible) {
      setFullName('');
      setReferralCode((initialReferralCode || '').toUpperCase());
      setError('');
      setLoading(false);
      submittingRef.current = false;

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialReferralCode]);

  // Informational terms sentence — reuse the [T]/[P] template, rendered as
  // plain text here (acceptance already happened on the auth screen).
  const termsSentence = (
    t('auth.byContinuingAgree') || 'By continuing, you agree to our [T] and [P]'
  )
    .replace('[T]', t('auth.termsAndConditions') || 'Terms & Conditions')
    .replace('[P]', t('auth.privacyPolicy') || 'Privacy Policy');

  const handleContinue = async () => {
    if (loading || submittingRef.current) return;
    const trimmedName = fullName.trim();
    // Node's profile update rejects 1-character names (min 2) — enforce the
    // same rule here so the name never silently diverges between the two DBs.
    if (needsName && trimmedName.length === 1) {
      setError(
        t('auth.nameTooShort') || 'Please enter your full name (at least 2 characters).'
      );
      return;
    }
    submittingRef.current = true;
    Keyboard.dismiss();
    setError('');
    setLoading(true);
    try {
      const result = await onComplete({
        fullName: needsName && trimmedName.length >= 2 ? trimmedName : undefined,
        referralCode: referralCode.trim() ? referralCode.trim() : undefined,
      });
      // Referral rejected — stay open, show inline error, let the user
      // correct the code or skip. Anything else: parent already proceeded.
      if (result?.referralError) {
        setError(result.referralError);
        setLoading(false);
        submittingRef.current = false;
      }
    } catch (e) {
      console.warn('[WelcomeModal] onComplete failed:', e?.message);
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleSkip = () => {
    if (loading || submittingRef.current) return;
    submittingRef.current = true;
    Keyboard.dismiss();
    onSkip && onSkip();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.overlayInner}>
          <Animated.View
            style={[
              styles.card,
              { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <MaterialIcons name="celebration" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.title}>
                {t('auth.welcomeToFixhomi') || 'Welcome to FixHomi'}
              </Text>
              <Text style={styles.subtitle}>{termsSentence}</Text>
            </View>

            {/* Inline error (referral) */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Name input — phone signups only (Google/Apple provide a name) */}
            {needsName && (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>
                  {t('auth.yourName') || 'Your name'}
                </Text>
                <TextInput
                  style={styles.nameInput}
                  value={fullName}
                  onChangeText={(v) => {
                    setFullName(v);
                    if (error) setError('');
                  }}
                  placeholder={t('auth.yourNamePlaceholder') || 'Your name (optional)'}
                  placeholderTextColor={COLORS.disabled}
                  autoCapitalize="words"
                  autoComplete="name"
                  autoCorrect={false}
                  maxLength={100}
                  editable={!loading}
                />
              </View>
            )}

            {/* Referral code input (RegisterChoice styling) */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>
                {t('auth.haveReferralCode') || 'Have a referral code?'}
              </Text>
              <View style={styles.referralInputRow}>
                <MaterialIcons name="redeem" size={18} color="#94A3B8" style={styles.referralIcon} />
                <TextInput
                  style={styles.referralInput}
                  value={referralCode}
                  onChangeText={(v) => {
                    setReferralCode(v.toUpperCase());
                    if (error) setError('');
                  }}
                  placeholder={t('auth.referralCodePlaceholder') || 'Enter referral code (optional)'}
                  placeholderTextColor="#CBD5E1"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={16}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Continue */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleContinue}
              disabled={loading}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('common.continue') || 'Continue'}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {t('common.continue') || 'Continue'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Skip for now */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={loading}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('auth.skipForNow') || 'Skip for now'}
            >
              <Text style={styles.skipText}>
                {t('auth.skipForNow') || 'Skip for now'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 48, 380),
    backgroundColor: COLORS.cardBg,
    borderRadius: 22,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(246,124,22,0.08)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  errorContainer: {
    backgroundColor: COLORS.errorBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    textAlign: 'center',
    lineHeight: 18,
  },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  nameInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 13 : 11,
    fontSize: 15,
    color: COLORS.text,
  },
  // Referral row — mirrors RegisterChoice referralInputRow/referralInput
  referralInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 12, height: 46,
  },
  referralIcon: { marginRight: 8 },
  referralInput: { flex: 1, fontSize: 14, color: '#1E293B', letterSpacing: 1.5, fontWeight: '600' },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: 4,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  skipButton: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  skipText: { fontSize: 14, color: COLORS.disabled, fontWeight: '600' },
});

export default WelcomeModal;
