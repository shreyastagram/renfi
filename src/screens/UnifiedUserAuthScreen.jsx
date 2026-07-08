/**
 * UnifiedUserAuthScreen
 *
 * Single entry point for USER authentication — no login/register split.
 * Offers exactly three methods:
 *   - Continue with Google (both platforms)
 *   - Continue with Apple (iOS only)
 *   - Continue with Phone (OTP) — routes to the PHONE_INPUT step
 *
 * Existing accounts are logged in; unknown accounts are auto-registered
 * (the backend decides — Google/Apple exchanges are called WITHOUT a mode,
 * phone uses the unified send/verify endpoints). Terms acceptance is
 * implicit: "By continuing, you agree to…" with tappable links.
 *
 * New users (isNewUser === true) are NOT logged in directly — the auth
 * result is bubbled up via `onNewUserAuth` so UserAuthScreen can show the
 * Welcome popup (referral code + optional name) BEFORE handleAuthSuccess.
 *
 * USERS ONLY — the provider flow (ProviderAuthScreen) is untouched.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import TouchableOpacity from '../components/TouchableOpacity';
import GoogleLogo from '../components/GoogleLogo';
import { Alert, FixhomiLogo } from '../components';
import AppleEmailCollectionModal from '../components/AppleEmailCollectionModal';
import {
  signInWithGoogleUnified,
  syncGoogleUserToMongoDB,
  GOOGLE_AUTH_CODES,
  getGoogleAuthErrorMessage,
} from '../services/googleAuthService';
import {
  signInWithAppleUnified,
  syncAppleUserToMongoDB,
  completeAppleSignInWithVerifiedEmail,
  APPLE_AUTH_CODES,
  getAppleAuthErrorMessage,
} from '../services/appleAuthService';
import { NODE_BASE_URL } from '../config/api';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

const TERMS_URL = 'https://fixhomi.com/terms';
const PRIVACY_URL = 'https://fixhomi.com/privacy';

const UnifiedUserAuthScreen = ({ navigation, onPickPhone, onNewUserAuth }) => {
  const { handleAuthSuccess } = useApp();
  const { t } = useLanguage();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [alertHint, setAlertHint] = useState(null);

  // Apple EMAIL_REQUIRED collection flow (Apple hid the email)
  const [showAppleEmailModal, setShowAppleEmailModal] = useState(false);
  const [pendingAppleAuth, setPendingAppleAuth] = useState(null);

  const anyLoading = googleLoading || appleLoading;

  const showAlert = useCallback((message, type = 'error', hint = null) => {
    setAlertMessage(message);
    setAlertType(type);
    setAlertHint(hint);
  }, []);

  const clearAlert = useCallback(() => {
    setAlertMessage(null);
    setAlertHint(null);
  }, []);

  /**
   * Terms sentence with tappable Terms & Privacy links. Same [T]/[P]
   * bracket-marker pattern as RegisterChoice (i18n-js would misread {{}}).
   */
  const termsContent = useMemo(() => {
    const template =
      t('auth.byContinuingAgree') || 'By continuing, you agree to our [T] and [P]';
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

  /**
   * Best-effort legal-acceptance record (terms are accepted implicitly by
   * continuing). Runs with an explicit token — handleAuthSuccess may not
   * have stored tokens yet. Never blocks the flow.
   */
  const recordLegalAcceptance = useCallback(async (accessToken) => {
    if (!accessToken) return;
    try {
      await fetch(`${NODE_BASE_URL}/api/auth/accept-policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ termsAccepted: true, privacyAccepted: true }),
      });
    } catch (e) {
      console.warn('[UnifiedAuth] Legal acceptance failed:', e.message);
    }
  }, []);

  /**
   * Shared post-exchange processing for Google and Apple.
   * New users: sync the Mongo profile (T&C true, referral applied later by
   * the Welcome popup via apply-code) then hand the auth result to the
   * parent so the Welcome popup shows BEFORE handleAuthSuccess.
   * Existing users: log straight in.
   */
  const processOauthResult = useCallback(
    async (resultData, provider) => {
      const { accessToken, refreshToken, user, isNewUser } = resultData;
      const unifiedId = user?.id || user?.userId;

      if (isNewUser && user) {
        console.log(`🆕 [UnifiedAuth] New ${provider} user — syncing to MongoDB...`);
        const syncFn =
          provider === 'apple' ? syncAppleUserToMongoDB : syncGoogleUserToMongoDB;
        const syncPayload = {
          javaUserId: unifiedId,
          email: user.email,
          fullName: user.fullName || user.name,
          googleId: user.googleId,
          profilePicture: user.profilePicture,
          // The popup applies the referral via apply-code (idempotent) — omit here.
          termsAccepted: true,
          privacyAccepted: true,
        };
        let syncResult = await syncFn(syncPayload, accessToken);
        if (!syncResult.success) {
          // Retry once — backend may still be warming up (Render cold start)
          console.warn('⚠️ [UnifiedAuth] MongoDB sync failed, retrying in 2s...');
          await new Promise((r) => setTimeout(r, 2000));
          syncResult = await syncFn(syncPayload, accessToken);
        }
        if (!syncResult.success) {
          console.warn('⚠️ [UnifiedAuth] MongoDB sync failed after retry, auth still succeeded');
        }
        recordLegalAcceptance(accessToken);
      }

      const authData = {
        accessToken,
        refreshToken,
        userId: unifiedId,
        javaUserId: unifiedId,
        mongoId: unifiedId, // Unified ID system: Mongo _id = Java userId
        email: user?.email,
        fullName: user?.fullName || user?.name,
        role: user?.role,
        userType: 'user',
        isNewUser,
        authMethod: provider,
      };

      if (isNewUser && onNewUserAuth) {
        // Parent shows the Welcome popup, then calls handleAuthSuccess.
        onNewUserAuth(authData);
        return;
      }

      const authProcessed = await handleAuthSuccess(authData);
      if (!authProcessed) {
        showAlert(t('auth.sessionSaveWarning') || 'Signed in but failed to save session.', 'warning');
      }
    },
    [handleAuthSuccess, onNewUserAuth, recordLegalAcceptance, showAlert, t]
  );

  /**
   * Continue with Google — unified (no mode): login-or-register.
   */
  const handleGoogle = async () => {
    if (anyLoading) return;
    try {
      setGoogleLoading(true);
      clearAlert();

      const result = await signInWithGoogleUnified();

      if (result.success) {
        await processOauthResult(result.data, 'google');
      } else {
        const { error } = result;
        if (error.isCancelled) return;
        if (error.code === GOOGLE_AUTH_CODES.ROLE_CONFLICT) {
          showAlert(
            t('auth.googleRoleConflict', {
              role: error.existingRole === 'SERVICE_PROVIDER' ? 'Service Provider' : 'User',
            }),
            'warning'
          );
          return;
        }
        showAlert(getGoogleAuthErrorMessage(error.code, error.message), 'error');
      }
    } catch (err) {
      console.error('❌ [UnifiedAuth] Google error:', err);
      showAlert(t('auth.googleSignInFailed') || 'Google Sign-In failed. Please try again.', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  /**
   * Continue with Apple — unified (no mode). iOS only.
   */
  const handleApple = async () => {
    if (anyLoading) return;
    try {
      setAppleLoading(true);
      clearAlert();

      const result = await signInWithAppleUnified();

      if (result.success) {
        await processOauthResult(result.data, 'apple');
      } else {
        const { error } = result;
        if (error.isCancelled) return;
        if (error.code === APPLE_AUTH_CODES.NOT_AVAILABLE) return;

        // Apple hid the email — collect and verify it, then retry the exchange.
        if (error.code === APPLE_AUTH_CODES.EMAIL_REQUIRED) {
          setPendingAppleAuth({ appleUserId: error.appleUserId, role: 'USER', mode: null });
          setShowAppleEmailModal(true);
          return;
        }

        if (error.code === APPLE_AUTH_CODES.ROLE_CONFLICT) {
          showAlert(
            t('auth.appleRoleConflict', {
              role: error.existingRole === 'SERVICE_PROVIDER' ? 'Service Provider' : 'User',
            }),
            'warning'
          );
          return;
        }
        showAlert(getAppleAuthErrorMessage(error.code, error.message), 'error');
      }
    } catch (err) {
      console.error('❌ [UnifiedAuth] Apple error:', err);
      showAlert(t('auth.appleSignInFailed') || 'Apple Sign-In failed. Please try again.', 'error');
    } finally {
      setAppleLoading(false);
    }
  };

  /**
   * Apple email verified — retry the unified exchange with the verification token.
   */
  const handleAppleEmailVerified = async (verifiedEmail, verificationToken) => {
    setShowAppleEmailModal(false);
    if (!pendingAppleAuth) {
      showAlert(t('auth.appleSignInFailed') || 'Apple Sign-In failed. Please try again.', 'error');
      return;
    }
    try {
      setAppleLoading(true);
      clearAlert();

      const retryResult = await completeAppleSignInWithVerifiedEmail({
        identityToken: null, // Backend re-auths via appleUserId + verificationToken
        authorizationCode: null,
        appleUserId: pendingAppleAuth.appleUserId,
        fullName: null,
        role: pendingAppleAuth.role,
        mode: pendingAppleAuth.mode, // null — unified
        email: verifiedEmail,
        verificationToken,
      });

      if (retryResult.success) {
        await processOauthResult(retryResult.data, 'apple');
      } else {
        showAlert(
          getAppleAuthErrorMessage(retryResult.error?.code, retryResult.error?.message),
          'error'
        );
      }
    } catch (err) {
      console.error('[UnifiedAuth] Apple email retry error:', err);
      showAlert(t('auth.appleSignInFailed') || 'Apple Sign-In failed. Please try again.', 'error');
    } finally {
      setAppleLoading(false);
      setPendingAppleAuth(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back to UserType */}
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.backButton}
          disabled={anyLoading}
          accessibilityLabel={t('common.goBack') || 'Go Back'}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#1E293B" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <FixhomiLogo size={48} />
          </View>
          <Text style={styles.brandName}>FixHomi</Text>
          <Text style={styles.title}>
            {t('auth.unifiedWelcomeTitle') || 'Welcome to FixHomi'}
          </Text>
          <Text style={styles.subtitle}>
            {t('auth.unifiedWelcomeSubtitle') || 'Sign in or create your account to continue'}
          </Text>
        </View>

        {/* Alert */}
        {alertMessage && (
          <Alert
            type={alertType}
            message={alertMessage}
            hint={alertHint}
            onDismiss={clearAlert}
            style={styles.alert}
          />
        )}

        {/* Method cards */}
        <View style={styles.cards}>
          {/* Continue with Google — gradient rainbow border + top glare */}
          <TouchableOpacity
            style={styles.googleCardOuter}
            onPress={handleGoogle}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('auth.continueWithGoogle') || 'Continue with Google'}
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
                  <Text style={styles.optionTitle}>
                    {t('auth.continueWithGoogle') || 'Continue with Google'}
                  </Text>
                  <Text style={styles.optionSub}>
                    {t('auth.unifiedGoogleSub') || 'Use your Google account'}
                  </Text>
                </View>
                <MaterialIcons name="arrow-forward" size={20} color="#475569" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Continue with Apple — iOS only, black pill */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.optionCard, styles.appleCard]}
              onPress={handleApple}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('auth.continueWithApple') || 'Continue with Apple'}
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
                <Text style={[styles.optionTitle, styles.appleOptionTitle]}>
                  {t('auth.continueWithApple') || 'Continue with Apple'}
                </Text>
                <Text style={[styles.optionSub, styles.appleOptionSub]}>
                  {t('auth.unifiedAppleSub') || 'Use your Apple ID'}
                </Text>
              </View>
              <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Continue with Phone (OTP) */}
          <TouchableOpacity
            style={[styles.optionCard, styles.phoneCard]}
            onPress={onPickPhone}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('auth.continueWithPhone') || 'Continue with phone number'}
            disabled={anyLoading}
          >
            <View style={[styles.optionIconCircle, styles.phoneIconCircle]}>
              <MaterialIcons name="phone-iphone" size={22} color="#2563EB" />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>
                {t('auth.continueWithPhone') || 'Continue with phone number'}
              </Text>
              <Text style={styles.optionSub}>
                {t('auth.unifiedPhoneSub') || "We'll text you a one-time code"}
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color="#2563EB" />
          </TouchableOpacity>
        </View>

        {/* Terms sentence with tappable links */}
        <Text style={styles.termsText}>{termsContent}</Text>
      </ScrollView>

      {/* Apple Email Collection + OTP Verification Modal (EMAIL_REQUIRED flow) */}
      <AppleEmailCollectionModal
        visible={showAppleEmailModal}
        appleUserId={pendingAppleAuth?.appleUserId}
        onVerified={handleAppleEmailVerified}
        onCancel={() => {
          setShowAppleEmailModal(false);
          setPendingAppleAuth(null);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },

  // ── Back Button ──
  backButton: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 12,
  },

  // ── Header ──
  header: { alignItems: 'center', marginBottom: 32, marginTop: 4 },
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

  // ── Alert ──
  alert: { marginBottom: 16 },

  // ── Method cards (mirrors RegisterChoice card language) ──
  cards: { gap: 18, marginBottom: 20 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 14,
    gap: 12,
    overflow: 'hidden',
  },
  phoneCard: { borderColor: '#2563EB', backgroundColor: '#FFFFFF' },
  appleCard: { borderColor: '#000000', backgroundColor: '#000000' },

  // Google card — gradient border + white inside + subtle top glare
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
  googleIconCircleWhite: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  phoneIconCircle: { backgroundColor: '#EFF6FF' },
  appleIconCircle: { backgroundColor: 'rgba(255,255,255,0.15)' },
  appleGlyph: { fontSize: 22, color: '#FFFFFF', marginTop: -2 },
  optionTextWrap: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  optionSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  appleOptionTitle: { color: '#FFFFFF' },
  appleOptionSub: { color: 'rgba(255,255,255,0.7)' },

  // ── Terms sentence ──
  termsText: {
    fontSize: 12, color: '#64748B', lineHeight: 18,
    textAlign: 'center', paddingHorizontal: 12,
  },
  termsLink: { color: '#2b76bc', fontWeight: '700', textDecorationLine: 'underline' },
});

export default UnifiedUserAuthScreen;
