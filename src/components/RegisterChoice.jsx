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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from './Screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import TouchableOpacity from './TouchableOpacity';
import FixhomiLogo from './FixhomiLogo';
import GoogleLogo from './GoogleLogo';
import LinearGradient from 'react-native-linear-gradient';
import { useLanguage } from '../context/LanguageContext';
import { useDialog } from '../context/DialogContext';
import {
  useThemedStyles,
  useThemeColors,
  stableDark,
  vendor,
} from '../theme';

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
  // Optional: when provided, render a "Continue with phone number" card.
  // RegisterScreen (user) passes this; ProviderRegisterScreen does NOT, so the
  // provider flow renders exactly the buttons it always has.
  onPickPhone,
  googleLoading,
  appleLoading,
  onSwitchToLogin,
  userType = 'user',
}) => {
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
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
  // `styles` belongs here: it is a per-theme object now, so without it this memo would
  // keep serving the previous theme's link style after a switch.
  }, [t, styles.termsLink]);

  return (
    <Screen style={styles.container} edges={['top', 'left', 'right']}>
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
                <MaterialIcons name="email" size={22} color={C.primary} />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>{t('auth.fillManually')}</Text>
                <Text style={styles.optionSub}>{t('auth.fillManuallySub')}</Text>
              </View>
              <MaterialIcons name="arrow-forward" size={20} color={termsAccepted ? C.primary : C.borderMedium} />
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
                colors={[vendor.googleRed, vendor.googleYellow, vendor.googleGreen, vendor.googleBlue]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.googleGradientBorderCard}
              >
                <View style={styles.googleCardInner}>
                  <LinearGradient
                    colors={[stableDark.inkSoft, stableDark.inkSoftFade]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.googleCardGlare}
                    pointerEvents="none"
                  />
                  <View style={[styles.optionIconCircle, styles.googleIconCircleWhite]}>
                    {googleLoading ? (
                      <ActivityIndicator size="small" color={vendor.googleBlue} />
                    ) : (
                      <GoogleLogo size={24} />
                    )}
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>{t('auth.continueWithGoogle')}</Text>
                    <Text style={styles.optionSub}>{t('auth.continueWithGoogleSub')}</Text>
                  </View>
                  <MaterialIcons name="arrow-forward" size={20} color={termsAccepted ? C.textBody : C.borderMedium} />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Continue with phone number — USERS only (rendered when onPickPhone is passed) */}
            {onPickPhone && (
              <TouchableOpacity
                style={[styles.optionCard, styles.phoneCard, !termsAccepted && styles.optionCardDisabled]}
                onPress={guard(onPickPhone)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('auth.continueWithPhone') || 'Continue with phone number'}
                disabled={anyLoading}
              >
                <View style={[styles.optionIconCircle, styles.phoneIconCircle]}>
                  <MaterialIcons name="phone-iphone" size={22} color={C.indigo} />
                </View>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionTitle}>
                    {t('auth.continueWithPhone') || 'Continue with phone number'}
                  </Text>
                  <Text style={styles.optionSub}>
                    {t('auth.continueWithPhoneSub') || "We'll send you a verification code"}
                  </Text>
                </View>
                <MaterialIcons name="arrow-forward" size={20} color={termsAccepted ? C.indigo : C.borderMedium} />
              </TouchableOpacity>
            )}

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
                    <ActivityIndicator size="small" color={vendor.onVendor} />
                  ) : (
                    <Text style={styles.appleGlyph}>{''}</Text>
                  )}
                </View>
                <View style={styles.optionTextWrap}>
                  <Text style={[styles.optionTitle, styles.appleOptionTitle]}>{t('auth.continueWithApple')}</Text>
                  <Text style={[styles.optionSub, styles.appleOptionSub]}>{t('auth.continueWithAppleSub')}</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={20} color={termsAccepted ? C.onPrimary : C.textBody} />
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
              {termsAccepted && <MaterialIcons name="check" size={16} color={C.onPrimary} />}
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
              <MaterialIcons name="redeem" size={18} color={C.muted} style={styles.referralIcon} />
              <TextInput
      selectionColor={C.primary}
                style={styles.referralInput}
                value={referralCode}
                onChangeText={(v) => onReferralCodeChange(v.toUpperCase())}
                placeholder={t('auth.referralCodePlaceholder')}
                placeholderTextColor={C.borderMedium}
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
    </Screen>
  );
};

const makeC = (c) => ({
  brandOrangeInk: c.brandOrangeInk,
  primary: c.brandOrange,
  onPrimary: c.onBrandOrange,
  secondary: c.brandBlue,
  white: c.surface,
  sunken: c.surfaceSunken,
  line: c.border,
  borderMedium: c.borderMedium,
  text: c.textStrong,
  textBody: c.textBody,
  textSecondary: c.textSecondary,
  muted: c.textMuted,
  indigo: c.altBlueIndigo,
  infoBg: c.infoContainer,
  danger: c.danger,
  warning: c.warning,
  warningBg: c.warningContainer,
  warningLine: c.warningBorder,
  overlay: c.overlay,
  overlayStrong: c.overlayStrong,
  shadow: c.shadow,
});

const makeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },
  keyboardView: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 12 },

  // Header — sits at the top; bigger margin pushes the interactive panel down
  header: { alignItems: 'center', marginBottom: 56, marginTop: 8 },

  // Interactive panel — visually separates the action area from the header
  // and floats above the page with a soft shadow.
  interactivePanel: {
    backgroundColor: C.sunken,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
    ...Platform.select({
      ios: {
        shadowColor: C.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.10,
        shadowRadius: 18,
      },
      android: { elevation: 6 },
    }),
  },
  logoContainer: {
    width: 52, height: 52, borderRadius: 13, backgroundColor: C.white,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 5 },
    }),
  },
  brandName: { fontSize: 15, fontWeight: '800', color: C.brandOrangeInk, marginTop: 6, marginBottom: 6, letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: C.textSecondary, textAlign: 'center', paddingHorizontal: 8, lineHeight: 19 },

  // Cards stack — generous gap so each option reads as a separate choice
  cards: { gap: 20, marginBottom: 16 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1.5, borderColor: C.line,
    borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 14,
    gap: 12,
    overflow: 'hidden',
  },
  manualCard: { borderColor: C.primary, backgroundColor: C.white },
  // Phone signup — blue accent to differentiate from manual (orange) and Google rainbow.
  phoneCard: { borderColor: C.indigo, backgroundColor: C.white },
  appleCard: { borderColor: vendor.appleBlack, backgroundColor: vendor.appleBlack },
  optionCardDisabled: { opacity: 0.5 },
  appleCardDisabled: { opacity: 0.5 },

  // Google card — gradient border + white inside + subtle top glare (matches LoginScreen)
  googleCardOuter: {},
  googleGradientBorderCard: { borderRadius: 14, padding: 1.5 },
  googleCardInner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white,
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
  manualIconCircle: { backgroundColor: C.white },
  phoneIconCircle: { backgroundColor: C.infoBg },
  googleIconCircleWhite: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  appleIconCircle: { backgroundColor: stableDark.fill },
  appleGlyph: { fontSize: 22, color: vendor.onVendor, marginTop: -2 },
  optionTextWrap: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  optionSub: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  appleOptionTitle: { color: vendor.onVendor },
  appleOptionSub: { color: stableDark.inkMuted },

  // T&C with link styling — extra vertical padding so it feels separated
  termsRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 10,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: C.muted,
    backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { borderColor: C.primary, backgroundColor: C.primary },
  termsText: { flex: 1, fontSize: 13, color: C.textBody, lineHeight: 19 },
  termsLink: { color: C.secondary, fontWeight: '700', textDecorationLine: 'underline' },
  termsHint: { fontSize: 12, color: C.danger, marginLeft: 32, marginTop: -4, marginBottom: 4, fontStyle: 'italic' },

  // Break line
  breakLine: { height: 1, backgroundColor: C.line, marginVertical: 10 },

  // Referral
  referralWrap: {},
  referralLabel: { fontSize: 13, fontWeight: '600', color: C.textBody, marginBottom: 6 },
  referralInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderWidth: 1, borderColor: C.line,
    borderRadius: 12, paddingHorizontal: 12, height: 46,
  },
  referralIcon: { marginRight: 8 },
  referralInput: { flex: 1, fontSize: 14, color: C.text, letterSpacing: 1.5, fontWeight: '600' },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, paddingTop: 4 },
  footerText: { fontSize: 13, color: C.textSecondary },
  footerLink: { fontSize: 13, color: C.secondary, fontWeight: '700' },
  });
};

export default RegisterChoice;
