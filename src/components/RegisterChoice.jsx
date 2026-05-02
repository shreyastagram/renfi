/**
 * RegisterChoice
 *
 * Step 1 of registration. Lets the user pick their signup method, then
 * captures referral code and Terms acceptance. Routes to:
 *   - Manual fill (calls onPickManual)
 *   - Google sign-up (calls onPickGoogle)
 *   - Apple sign-up (calls onPickApple, iOS only)
 *
 * All three buttons are gated behind T&C acceptance — tapping a disabled
 * button surfaces a friendly dialog. Used by both RegisterScreen and
 * ProviderRegisterScreen with their own handlers.
 *
 * @version 2.0.0
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import TouchableOpacity from './TouchableOpacity';
import FixhomiLogo from './FixhomiLogo';
import GoogleLogo from './GoogleLogo';
import LinearGradient from 'react-native-linear-gradient';
import { useLanguage } from '../context/LanguageContext';
import { useDialog } from '../context/DialogContext';

const TERMS_URL = 'https://fixhomi.com/terms';
const PRIVACY_URL = 'https://fixhomi.com/privacy';

const RegisterChoice = ({
  referralCode,
  onReferralCodeChange,
  termsAccepted,
  onTermsToggle,
  onPickManual,
  onPickGoogle,
  onPickApple,
  googleLoading,
  appleLoading,
  onSwitchToLogin,
  userType = 'user',
}) => {
  const { t } = useLanguage();
  const { dialog } = useDialog();
  const insets = useSafeAreaInsets();

  const anyLoading = googleLoading || appleLoading;

  const handleDisabledTap = useCallback(() => {
    dialog(
      t('auth.acceptTermsRequired') || 'Terms required',
      t('auth.acceptTermsRequiredMsg') ||
        'Please tick the box to accept the Terms & Conditions and Privacy Policy before continuing.',
      [{ text: 'OK', style: 'default' }]
    );
  }, [dialog, t]);

  const guard = (handler) => () => {
    if (!termsAccepted) {
      handleDisabledTap();
      return;
    }
    handler && handler();
  };

  // Render the T&C agreement text with clickable Terms and Privacy links.
  // Splits the localized template "I agree to the [T] and [P]" on the
  // [T]/[P] markers. We use bracket markers (not {{}}) because i18n-js
  // would try to interpolate {{}} as placeholders and emit "missing X
  // value" when no values are passed.
  const termsContent = useMemo(() => {
    const template = t('auth.agreeToTerms') || 'I agree to the [T] and [P]';
    const termsLabel = t('auth.termsAndConditions') || 'Terms & Conditions';
    const privacyLabel = t('auth.privacyPolicy') || 'Privacy Policy';
    const parts = template.split(/(\[T\]|\[P\])/g);
    return parts.map((part, i) => {
      if (part === '[T]') {
        return (
          <Text
            key={`t-${i}`}
            style={styles.termsLink}
            onPress={() => Linking.openURL(TERMS_URL)}
          >
            {termsLabel}
          </Text>
        );
      }
      if (part === '[P]') {
        return (
          <Text
            key={`p-${i}`}
            style={styles.termsLink}
            onPress={() => Linking.openURL(PRIVACY_URL)}
          >
            {privacyLabel}
          </Text>
        );
      }
      return <Text key={`x-${i}`}>{part}</Text>;
    });
  }, [t]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header — compact, no top padding gap */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <FixhomiLogo size={40} />
            </View>
            <Text style={styles.brandName}>FixHomi</Text>
            <Text style={styles.title}>{t('auth.createAccount')}</Text>
            <Text style={styles.subtitle}>{t('auth.createAccountSubtitle')}</Text>
          </View>

          {/*
           * Interactive panel — visually distinct from the header so it reads
           * as "the actions you can take", not part of the title block.
           * Soft slate-50 background, rounded corners, padding inside.
           */}
          <View style={styles.interactivePanel}>
          {/* Choice cards — order: Manual → Google → Apple (iOS) */}
          <View style={styles.cards}>
            {/* Fill manually — Fixhomi orange thread BG */}
            <TouchableOpacity
              style={[styles.optionCard, styles.manualCard, !termsAccepted && styles.optionCardDisabled]}
              onPress={guard(onPickManual)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('auth.fillManually')}
              disabled={anyLoading}
            >
              <View style={[styles.optionIconCircle, styles.manualIconCircle]}>
                <MaterialIcons name="email" size={22} color="#f67c16" />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>{t('auth.fillManually')}</Text>
                <Text style={styles.optionSub}>{t('auth.fillManuallySub')}</Text>
              </View>
              <MaterialIcons name="arrow-forward" size={20} color={termsAccepted ? '#f67c16' : '#CBD5E1'} />
            </TouchableOpacity>

            {/* Continue with Google — gradient border (Google rainbow) + subtle top glare */}
            <TouchableOpacity
              style={[styles.googleCardOuter, !termsAccepted && styles.optionCardDisabled]}
              onPress={guard(onPickGoogle)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('auth.continueWithGoogle')}
              disabled={anyLoading}
            >
              <LinearGradient
                colors={['#EA4335', '#FBBC05', '#34A853', '#4285F4']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.googleGradientBorderCard}
              >
                <View style={styles.googleCardInner}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.googleCardGlare}
                    pointerEvents="none"
                  />
                  <View style={[styles.optionIconCircle, styles.googleIconCircleWhite]}>
                    {googleLoading ? (
                      <ActivityIndicator size="small" color="#4285F4" />
                    ) : (
                      <GoogleLogo size={24} />
                    )}
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>{t('auth.continueWithGoogle')}</Text>
                    <Text style={styles.optionSub}>{t('auth.continueWithGoogleSub')}</Text>
                  </View>
                  <MaterialIcons name="arrow-forward" size={20} color={termsAccepted ? '#475569' : '#CBD5E1'} />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Continue with Apple — iOS only, plain black (untouched) */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.optionCard, styles.appleCard, !termsAccepted && styles.appleCardDisabled]}
                onPress={guard(onPickApple)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('auth.continueWithApple')}
                disabled={anyLoading}
              >
                <View style={[styles.optionIconCircle, styles.appleIconCircle]}>
                  {appleLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.appleGlyph}>{''}</Text>
                  )}
                </View>
                <View style={styles.optionTextWrap}>
                  <Text style={[styles.optionTitle, styles.appleOptionTitle]}>{t('auth.continueWithApple')}</Text>
                  <Text style={[styles.optionSub, styles.appleOptionSub]}>{t('auth.continueWithAppleSub')}</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={20} color={termsAccepted ? '#FFFFFF' : '#475569'} />
              </TouchableOpacity>
            )}
          </View>

          {/* T&C with clickable Terms and Privacy links */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => onTermsToggle(!termsAccepted)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!termsAccepted }}
            accessibilityLabel={t('auth.agreeToTerms')}
            disabled={anyLoading}
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
              {termsAccepted && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
            </View>
            <Text style={styles.termsText}>{termsContent}</Text>
          </TouchableOpacity>

          {!termsAccepted && (
            <Text style={styles.termsHint}>{t('auth.acceptTermsToContinue')}</Text>
          )}

          {/* Break */}
          <View style={styles.breakLine} />

          {/* Referral code */}
          <View style={styles.referralWrap}>
            <Text style={styles.referralLabel}>{t('auth.haveReferralCode')}</Text>
            <View style={styles.referralInputRow}>
              <MaterialIcons name="redeem" size={18} color="#94A3B8" style={styles.referralIcon} />
              <TextInput
                style={styles.referralInput}
                value={referralCode}
                onChangeText={(v) => onReferralCodeChange(v.toUpperCase())}
                placeholder={t('auth.referralCodePlaceholder')}
                placeholderTextColor="#CBD5E1"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={16}
                editable={!anyLoading}
              />
            </View>
          </View>

          {/* Break */}
          <View style={styles.breakLine} />

          {/* Already have an account? Sign in */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('auth.alreadyHaveAccount') || 'Already have an account?'}
            </Text>
            <TouchableOpacity
              onPress={onSwitchToLogin}
              disabled={anyLoading}
              accessibilityRole="link"
            >
              <Text style={styles.footerLink}>{t('auth.signIn')}</Text>
            </TouchableOpacity>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 12 },

  // Header — sits at the top; bigger margin pushes the interactive panel down
  header: { alignItems: 'center', marginBottom: 56, marginTop: 8 },

  // Interactive panel — visually separates the action area from the header
  // and floats above the page with a soft shadow.
  interactivePanel: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.10,
        shadowRadius: 18,
      },
      android: { elevation: 6 },
    }),
  },
  logoContainer: {
    width: 52, height: 52, borderRadius: 13, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#f67c16', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 5 },
    }),
  },
  brandName: { fontSize: 15, fontWeight: '800', color: '#f67c16', marginTop: 6, marginBottom: 6, letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', paddingHorizontal: 8, lineHeight: 19 },

  // Cards stack — generous gap so each option reads as a separate choice
  cards: { gap: 20, marginBottom: 16 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 14,
    gap: 12,
    overflow: 'hidden',
  },
  manualCard: { borderColor: '#f67c16', backgroundColor: '#FFFFFF' },
  appleCard: { borderColor: '#000000', backgroundColor: '#000000' },
  optionCardDisabled: { opacity: 0.5 },
  appleCardDisabled: { opacity: 0.5 },

  // Google card — gradient border + white inside + subtle top glare (matches LoginScreen)
  googleCardOuter: {},
  googleGradientBorderCard: { borderRadius: 14, padding: 1.5 },
  googleCardInner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12.5,
    paddingVertical: 13, paddingHorizontal: 13,
    gap: 12,
    overflow: 'hidden',
  },
  googleCardGlare: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '55%',
  },
  optionIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  manualIconCircle: { backgroundColor: '#FFFFFF' },
  googleIconCircleWhite: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  appleIconCircle: { backgroundColor: 'rgba(255,255,255,0.15)' },
  appleGlyph: { fontSize: 22, color: '#FFFFFF', marginTop: -2 },
  optionTextWrap: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  optionSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  appleOptionTitle: { color: '#FFFFFF' },
  appleOptionSub: { color: 'rgba(255,255,255,0.7)' },

  // T&C with link styling — extra vertical padding so it feels separated
  termsRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 10,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { borderColor: '#f67c16', backgroundColor: '#f67c16' },
  termsText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 19 },
  termsLink: { color: '#2b76bc', fontWeight: '700', textDecorationLine: 'underline' },
  termsHint: { fontSize: 12, color: '#DC2626', marginLeft: 32, marginTop: -4, marginBottom: 4, fontStyle: 'italic' },

  // Break line
  breakLine: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 10 },

  // Referral
  referralWrap: {},
  referralLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  referralInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 12, height: 46,
  },
  referralIcon: { marginRight: 8 },
  referralInput: { flex: 1, fontSize: 14, color: '#1E293B', letterSpacing: 1.5, fontWeight: '600' },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, paddingTop: 4 },
  footerText: { fontSize: 13, color: '#64748B' },
  footerLink: { fontSize: 13, color: '#2b76bc', fontWeight: '700' },
});

export default RegisterChoice;
