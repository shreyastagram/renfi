/**
 * Verification Screen
 *
 * Screen for verifying email or phone number after registration
 * Requires authentication (uses stored tokens)
 * Allows adding/editing phone or email if not set before verification
 *
 * @version 2.0.0 — Premium UI revamp
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
  Dimensions
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { Button, Alert } from '../components';
import {
  sendPhoneVerificationOtp,
  verifyPhoneOtp,
  sendEmailVerification,
  getErrorMessage,
  AUTH_CODES
} from '../services/authService';
import { updateJavaAuthProfile, addUserEmail } from '../services/profileService';
import { syncVerificationStatus } from '../services/verificationService';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

const OTP_LENGTH = 6;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  bg: '#F1F5F9',
  white: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  successGreen: '#10B981',
  amber: '#F59E0B',
  red: '#DC2626',
};

/* ─── Premium card shadow helper ─────────────────────────────────── */
const cardShadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: {
    elevation: 4,
  },
});

const glowShadow = Platform.select({
  ios: {
    shadowColor: '#f67c16',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  android: {
    elevation: 8,
  },
});

/**
 * VerificationScreen Component
 *
 * @param {Object} props - Screen props
 */
const VerificationScreen = ({
  navigation,
  route,
  onVerificationComplete,
  onSkip,
}) => {
  const { user, profile, userType, refreshVerificationStatus, refreshProfile, updateProfileWithAutoSync } = useApp();
  const { t } = useLanguage();

  // Get verificationType from route params (navigation) or props
  const verificationType = route?.params?.verificationType || 'phone';
  const isEmailVerification = verificationType === 'email';
  const forceReVerify = route?.params?.forceReVerify || false; // e.g., phone number changed

  // Check if already verified from current user state
  // If forceReVerify is true (phone changed after verification), bypass this check
  const isAlreadyVerified = forceReVerify
    ? false
    : (isEmailVerification ? user?.isEmailVerified : user?.isPhoneVerified);

  // Current value from user context
  // Strip +91/91 prefix from phone — we display raw 10 digits
  const rawPhone = user?.phone || profile?.phone || '';
  const phoneDigits = rawPhone.replace(/[^0-9]/g, '');
  const currentPhone = (phoneDigits.length > 10 && phoneDigits.startsWith('91'))
    ? phoneDigits.substring(2)
    : phoneDigits;
  const currentEmail = user?.email || profile?.email || '';
  const currentValue = isEmailVerification ? currentEmail : currentPhone;

  // OTP input refs (for phone verification)
  const inputRefs = useRef([]);

  // State
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('error');
  const [alertHint, setAlertHint] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [maskedValue, setMaskedValue] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [verified, setVerified] = useState(isAlreadyVerified || false); // Initialize with current status

  // Phone/email editing state
  const [isEditing, setIsEditing] = useState(!currentValue); // Auto-open edit if no value set
  const [editValue, setEditValue] = useState(currentValue);
  const [savingValue, setSavingValue] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Animations for OTP inputs
  const otpScales = useRef(Array(OTP_LENGTH).fill(null).map(() => new Animated.Value(1))).current;
  const otpBorderColors = useRef(Array(OTP_LENGTH).fill(null).map(() => new Animated.Value(0))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  /**
   * Format countdown time
   */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Show alert message
   */
  const showAlert = useCallback((message, type = 'error', hint = null) => {
    setAlertMessage(message);
    setAlertType(type);
    setAlertHint(hint);
  }, []);

  /**
   * Clear alert message
   */
  const clearAlert = useCallback(() => {
    setAlertMessage(null);
    setAlertHint(null);
  }, []);

  /**
   * Validate phone number format
   */
  const isValidPhone = (phone) => {
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length === 10 && /^[6-9]/.test(digits);
  };

  /**
   * Validate email format
   */
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim());
  };

  /**
   * Save phone/email to profile before verification
   * Updates Java Auth (where OTP is sent from) and MongoDB
   */
  const handleSaveValue = async () => {
    try {
      clearAlert();
      const trimmedValue = editValue?.trim();

      if (!trimmedValue) {
        showAlert(isEmailVerification ? t('verificationScreen.enterEmail') : t('verificationScreen.enterPhone'), 'warning');
        return;
      }

      if (!isEmailVerification && !isValidPhone(trimmedValue)) {
        showAlert(t('verificationScreen.invalidPhone'), 'warning');
        return;
      }

      if (isEmailVerification && !isValidEmail(trimmedValue)) {
        showAlert(t('verificationScreen.invalidEmail'), 'warning');
        return;
      }

      setSavingValue(true);

      const userId = user?.mongoId || profile?.mongoId || profile?._id;

      if (isEmailVerification) {
        // Add/change email through NoeFix → Java Auth (source of truth: stores it
        // UNVERIFIED and sends the verification link) → mirrors the value into Mongo.
        // ONE call updates BOTH databases consistently.
        const emailResult = await addUserEmail(userId, trimmedValue);

        if (!emailResult.success) {
          console.error('❌ [VerificationScreen] Failed to add email:', emailResult.error);
          const errCode = emailResult.error?.code;
          const errStatus = emailResult.error?.status;
          if (errCode === 'EMAIL_ALREADY_EXISTS' || errStatus === 409) {
            showAlert(t('verificationScreen.emailInUse'), 'error');
          } else if (errCode === 'TOO_MANY_REQUESTS' || errStatus === 429) {
            showAlert(emailResult.error?.message || t('verificationScreen.emailWaitMoment'), 'error');
          } else {
            showAlert(emailResult.error?.message || t('verificationScreen.failedUpdate', { type: verificationType }), 'error');
          }
          return;
        }

        // Email set + verification link already sent by the backend. Refresh so the
        // new (unverified) email shows, then tell the user to check their inbox.
        await refreshVerificationStatus();
        if (userId) {
          await refreshProfile(userType, userId, { force: true });
        }
        console.log('✅ [VerificationScreen] email saved + link sent:', trimmedValue);
        showAlert(t('verificationScreen.emailSent'), 'success');
        setIsEditing(false);
        return;
      }

      // PHONE path (unchanged): Java Auth first, then Mongo sync.
      const javaAuthUpdate = { phoneNumber: '+91' + trimmedValue };
      console.log(`📝 [VerificationScreen] Saving ${verificationType}:`, trimmedValue);

      const javaResult = await updateJavaAuthProfile(javaAuthUpdate);

      if (!javaResult.success) {
        console.error('❌ [VerificationScreen] Failed to update Java Auth:', javaResult.error);
        const errCode = javaResult.error?.code;
        const errStatus = javaResult.error?.status;
        if (errCode === 'PHONE_ALREADY_EXISTS' || errStatus === 409) {
          showAlert(t('profile.phoneConflictMsg') || 'This mobile number is already verified on another account. Please use a different number.', 'error');
        } else {
          showAlert(javaResult.error?.message || t('verificationScreen.failedUpdate', { type: verificationType }), 'error');
        }
        return;
      }

      // Also sync to MongoDB via profile update
      if (updateProfileWithAutoSync) {
        await updateProfileWithAutoSync({ phone: trimmedValue });
      }

      // Refresh verification status and profile to get updated user data
      await refreshVerificationStatus();
      if (userId) {
        await refreshProfile(userType, userId, { force: true });
      }

      console.log(`✅ [VerificationScreen] ${verificationType} saved:`, trimmedValue);
      showAlert(t('verificationScreen.phoneUpdated'), 'success');
      setIsEditing(false);
    } catch (error) {
      console.error('❌ [VerificationScreen] Save error:', error);
      showAlert(t('verificationScreen.failedToSave'), 'error');
    } finally {
      setSavingValue(false);
    }
  };

  /**
   * Handle send verification (phone OTP or email link)
   * Now checks if phone/email is set before sending
   */
  const handleSendVerification = async () => {
    try {
      clearAlert();

      // Check if phone/email is set before trying to send
      const valueToVerify = isEmailVerification
        ? (user?.email || profile?.email)
        : (user?.phone || profile?.phone);

      if (!valueToVerify) {
        showAlert(
          isEmailVerification
            ? t('verificationScreen.addEmailFirst')
            : t('verificationScreen.addPhoneFirst'),
          'warning'
        );
        setIsEditing(true); // Open edit mode
        return;
      }

      setSendLoading(true);

      let result;
      if (isEmailVerification) {
        result = await sendEmailVerification();
      } else {
        result = await sendPhoneVerificationOtp();
      }

      if (result.success) {
        if (isEmailVerification) {
          setMaskedValue(result.maskedEmail || result.data?.maskedValue || 'your email');
          showAlert(t('verificationScreen.emailSent'), 'success');
        } else {
          setMaskedValue(result.maskedPhone || result.data?.maskedValue || 'your phone');
          setOtpSent(true);
          setCountdown(5 * 60); // 5 minutes
          setCanResend(false);
          showAlert(t('verificationScreen.otpSent', { phone: result.maskedPhone || 'your phone' }), 'success');

          // Focus first input
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
      } else {
        const { error } = result;

        // Check for "already verified" in error message
        const errorMsg = error.message?.toLowerCase() || '';
        if (errorMsg.includes('already verified')) {
          // Update verification status and show success
          await refreshVerificationStatus();
          // Providers: the dashboard reads the Mongo mirror — heal it now so
          // the phone step flips even if the mirror was stale (2026-07-19
          // incident). Server-side dashboard self-heal covers failures here.
          if (userType === 'provider') {
            const pid = user?.mongoId || user?._id;
            if (pid) { try { await syncVerificationStatus(pid); } catch (e) { /* best-effort */ } }
          }
          setVerified(true);
          return;
        }

        // Check for rate limit (429) — code may come as 'TOO_MANY_REQUESTS' or 'Too Many Requests'
        const isRateLimited = error.status === 429 ||
          error.code === AUTH_CODES.TOO_MANY_REQUESTS ||
          error.code === 'Too Many Requests' ||
          (error.message || '').toLowerCase().includes('wait');

        if (isRateLimited) {
          // Extract remaining seconds from message: "Please wait N seconds before..."
          const msg = error.message || '';
          const secMatch = msg.match(/wait\s+(\d+)\s+seconds/i);
          const retrySec = secMatch
            ? parseInt(secMatch[1], 10)
            : (error.errors?.retryAfterSeconds ? parseInt(error.errors.retryAfterSeconds, 10) : null);

          if (retrySec && retrySec > 0) {
            const m = Math.floor(retrySec / 60);
            const s = retrySec % 60;
            const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
            showAlert(t('verificationScreen.rateLimitedWithTime', { time: timeStr }), 'warning');
          } else {
            showAlert(t('verificationScreen.rateLimitedGeneric'), 'warning');
          }
        } else {
          showAlert(error.message || t('verificationScreen.failedSendVerification'), 'error');
        }
      }
    } catch (error) {
      console.error('❌ [VerificationScreen] Send error:', error);
      showAlert(t('auth.unexpectedError'), 'error');
    } finally {
      setSendLoading(false);
    }
  };

  /**
   * Handle OTP input change
   */
  const handleOtpChange = (value, index) => {
    clearAlert();

    const digit = value.replace(/[^0-9]/g, '');

    if (digit.length <= 1) {
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);

      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (digit.length > 1) {
      const digits = digit.slice(0, OTP_LENGTH).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < OTP_LENGTH) {
          newOtp[index + i] = d;
        }
      });
      setOtp(newOtp);

      const lastIndex = Math.min(index + digits.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIndex]?.focus();
    }
  };

  /**
   * Handle key press
   */
  const handleKeyPress = (event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Handle phone OTP verification
   */
  const handleVerifyOtp = async () => {
    try {
      clearAlert();

      const otpCode = otp.join('');

      if (otpCode.length !== OTP_LENGTH) {
        showAlert(t('verificationScreen.completeOtp'), 'warning');
        return;
      }

      setLoading(true);

      const result = await verifyPhoneOtp(otpCode);

      if (result.success) {
        // Refresh verification status and profile
        await refreshVerificationStatus();
        const uid = user?.mongoId || profile?.mongoId || profile?._id;
        if (uid) {
          await refreshProfile(userType, uid, { force: true });
        }

        // Show success state
        setVerified(true);
        showAlert(t('verificationScreen.phoneVerifiedAlert'), 'success');

        // Callback if provided
        if (onVerificationComplete) {
          onVerificationComplete();
        }
      } else {
        const { error } = result;

        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();

        switch (error.code) {
          case AUTH_CODES.INVALID_OTP:
          case 'INVALID_OTP':
            showAlert(t('verificationScreen.invalidOtp'), 'error');
            break;

          case AUTH_CODES.OTP_EXPIRED:
            showAlert(t('verificationScreen.otpExpired'), 'error');
            setOtpSent(false);
            break;

          case AUTH_CODES.MAX_ATTEMPTS_EXCEEDED:
            showAlert(t('verificationScreen.maxAttempts'), 'error');
            setOtpSent(false);
            break;

          default:
            showAlert(getErrorMessage(error.code, t('verificationScreen.verificationFailed')), 'error');
        }
      }
    } catch (error) {
      console.error('❌ [VerificationScreen] Verify error:', error);
      showAlert(t('auth.unexpectedError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle skip
   */
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  /**
   * Handle go back to profile/home
   */
  const handleGoBack = () => {
    // Prefer going back (we usually arrived from Profile). Fall back to the real
    // home route — there is NO top-level 'Home' route for users; user home is
    // HomeTab inside UserTabs (providers: ProviderTabs).
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate(userType === 'provider' ? 'ProviderTabs' : 'UserTabs', { screen: 'HomeTab' });
    }
  };

  /* ─── Status Badge ─────────────────────────────────────────────── */
  const StatusBadge = ({ status }) => {
    let bg, color, label, icon;
    switch (status) {
      case 'verified':
        bg = '#ECFDF5'; color = '#059669'; label = t('common.verified'); icon = 'verified';
        break;
      case 'pending':
        bg = '#FFFBEB'; color = '#D97706'; label = t('common.pending'); icon = 'schedule';
        break;
      default:
        bg = '#F1F5F9'; color = '#94A3B8'; label = t('common.notStarted'); icon = 'circle';
    }
    return (
      <View style={[s.badge, { backgroundColor: bg }]}>
        <MaterialIcon name={icon} size={14} color={color} />
        <Text style={[s.badgeText, { color }]}>{label}</Text>
      </View>
    );
  };

  /* ─── Countdown Circle ─────────────────────────────────────────── */
  const CountdownCircle = () => {
    const totalTime = 5 * 60;
    const progress = countdown / totalTime;
    const expired = countdown <= 0;
    return (
      <View style={s.countdownRow}>
        <View style={[s.countdownCircle, expired && s.countdownCircleExpired]}>
          <View style={s.countdownInner}>
            <MaterialIcon
              name={expired ? 'error-outline' : 'timer'}
              size={18}
              color={expired ? BRAND.red : BRAND.secondary}
            />
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          {expired ? (
            <Text style={s.countdownExpiredText}>{t('verificationScreen.codeExpired')}</Text>
          ) : (
            <>
              <Text style={s.countdownLabel}>{t('verificationScreen.codeExpiresIn')}</Text>
              <Text style={s.countdownValue}>{formatTime(countdown)}</Text>
            </>
          )}
        </View>
      </View>
    );
  };

  // ──── Success Screen ────────────────────────────────────────────
  if (verified) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.successContainer}>
          <View style={s.successIconOuter}>
            <View style={s.successIconCircle}>
              <MaterialIcon name="check" size={44} color={BRAND.white} />
            </View>
            <View style={s.successRing} />
            <View style={s.successRingOuter} />
          </View>
          <Text style={s.successTitle}>
            {isEmailVerification ? t('verificationScreen.emailVerified') : t('verificationScreen.phoneVerified')}
          </Text>
          <Text style={s.successSubtitle}>
            {isEmailVerification ? t('verificationScreen.emailVerifiedSub') : t('verificationScreen.phoneVerifiedSub')}
          </Text>
          <TouchableOpacity
            style={s.successBackBtn}
            onPress={handleGoBack}
            activeOpacity={0.8}
          >
            <MaterialIcon name="arrow-back" size={20} color={BRAND.white} />
            <Text style={s.successBackBtnText}>{t('verificationScreen.backToProfile')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ──── Main Screen ───────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      {/* Fixed Header */}
      <View style={s.headerBar}>
        <TouchableOpacity
          style={s.backCircle}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <MaterialIcon name="arrow-back" size={22} color={BRAND.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1} ellipsizeMode="tail">
          {isEmailVerification ? t('verificationScreen.verifyEmail') : t('verificationScreen.verifyPhone')}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Subtitle */}
        <Text style={s.headerSubtitle}>
          {isEmailVerification
            ? t('verificationScreen.emailSubtitle')
            : t('verificationScreen.phoneSubtitle')
          }
        </Text>

        {/* Alert */}
        {alertMessage && (
          <Alert
            type={alertType}
            message={alertMessage}
            hint={alertHint}
            onDismiss={clearAlert}
            style={s.alert}
          />
        )}

        {/* ═══════════════ EMAIL VERIFICATION ═══════════════ */}
        {isEmailVerification && (
          <View style={s.sectionWrap}>
            {/* Email Info Card */}
            <View style={[s.card, cardShadow]}>
              <View style={s.cardHeaderRow}>
                <View style={s.cardIconCircle}>
                  <MaterialIcon name="email" size={22} color={BRAND.secondary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.sectionLabel}>{t('verificationScreen.emailVerification')}</Text>
                  <Text style={s.cardDescription} numberOfLines={2} ellipsizeMode="tail">
                    {currentEmail
                      ? t('verificationScreen.emailHasValueDesc')
                      : t('verificationScreen.emailNoValueDesc')}
                  </Text>
                </View>
                <StatusBadge status={maskedValue ? 'pending' : 'not_started'} />
              </View>

              {/* Value display / edit */}
              {isEditing ? (
                <View style={s.editWrap}>
                  <Text style={s.editLabel}>{t('verificationScreen.emailAddress')}</Text>
                  <TextInput
                    style={s.editInput}
                    value={editValue}
                    onChangeText={setEditValue}
                    placeholder={t('verificationScreen.emailPlaceholder')}
                    placeholderTextColor={BRAND.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!savingValue}
                  />
                  <View style={s.editActions}>
                    <TouchableOpacity
                      style={s.ctaButton}
                      onPress={handleSaveValue}
                      disabled={savingValue}
                      activeOpacity={0.8}
                    >
                      {savingValue ? (
                        <ActivityIndicator size="small" color={BRAND.white} />
                      ) : (
                        <Text style={s.ctaButtonText}>{t('verificationScreen.saveEmail')}</Text>
                      )}
                    </TouchableOpacity>
                    {currentEmail ? (
                      <TouchableOpacity
                        style={s.cancelBtn}
                        onPress={() => {
                          setIsEditing(false);
                          setEditValue(currentEmail);
                        }}
                      >
                        <Text style={s.cancelBtnText}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={s.valueDisplayRow}>
                  <View style={s.valueLabelCol}>
                    <Text style={s.valueLabelSmall}>{t('verificationScreen.emailValue')}</Text>
                    <Text style={s.valueText} numberOfLines={1} ellipsizeMode="middle">
                      {currentEmail || t('common.notSet')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.editPill}
                    onPress={() => {
                      setEditValue(currentEmail);
                      setIsEditing(true);
                    }}
                  >
                    <MaterialIcon name="edit" size={16} color={BRAND.secondary} />
                    <Text style={s.editPillText}>{t('common.edit')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Send Button */}
            {!isEditing && (
              <TouchableOpacity
                style={[s.ctaButton, glowShadow, (!currentEmail || sendLoading) && s.ctaButtonDisabled]}
                onPress={handleSendVerification}
                disabled={sendLoading || !currentEmail}
                activeOpacity={0.8}
              >
                {sendLoading ? (
                  <View style={s.ctaRow}>
                    <ActivityIndicator size="small" color={BRAND.white} />
                    <Text style={s.ctaButtonText}>{t('verificationScreen.sendingBtn')}</Text>
                  </View>
                ) : (
                  <View style={s.ctaRow}>
                    <MaterialIcon name="send" size={20} color={BRAND.white} />
                    <Text style={s.ctaButtonText}>{t('verificationScreen.sendVerificationEmail')}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Sent confirmation */}
            {maskedValue ? (
              <View style={s.sentCard}>
                <MaterialIcon name="mark-email-read" size={20} color={BRAND.successGreen} />
                <Text style={s.sentText} numberOfLines={2} ellipsizeMode="tail">
                  {t('verificationScreen.emailSentTo', { value: maskedValue })}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ═══════════════ PHONE VERIFICATION ═══════════════ */}
        {!isEmailVerification && (
          <View style={s.sectionWrap}>
            {!otpSent ? (
              <>
                {/* Phone Info Card */}
                <View style={[s.card, cardShadow]}>
                  <View style={s.cardHeaderRow}>
                    <View style={[s.cardIconCircle, { backgroundColor: '#FFF7ED' }]}>
                      <MaterialIcon name="phone-android" size={22} color={BRAND.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.sectionLabel}>{t('verificationScreen.phoneVerification')}</Text>
                      <Text style={s.cardDescription} numberOfLines={2} ellipsizeMode="tail">
                        {currentPhone
                          ? t('verificationScreen.phoneHasValueDesc')
                          : t('verificationScreen.phoneNoValueDesc')}
                      </Text>
                    </View>
                    <StatusBadge status="not_started" />
                  </View>

                  {/* Value display / edit */}
                  {isEditing ? (
                    <View style={s.editWrap}>
                      <Text style={s.editLabel}>{t('verificationScreen.phoneNumber')}</Text>
                      <View style={s.phoneInputRow}>
                        <View style={s.countryCodeBox}>
                          <Text style={s.countryCodeText}>{t('verificationScreen.countryCode')}</Text>
                        </View>
                        <TextInput
                          style={[s.editInput, { flex: 1 }]}
                          value={editValue}
                          onChangeText={(text) => {
                            let digits = text.replace(/[^0-9]/g, '');
                            if (digits.length > 10 && digits.startsWith('91')) {
                              digits = digits.substring(2);
                            }
                            setEditValue(digits.slice(0, 10));
                          }}
                          placeholder={t('verificationScreen.phonePlaceholder')}
                          placeholderTextColor={BRAND.textMuted}
                          keyboardType="number-pad"
                          maxLength={10}
                          editable={!savingValue}
                        />
                      </View>
                      <Text style={s.editHint}>{t('verificationScreen.phoneHint')}</Text>
                      <View style={s.editActions}>
                        <TouchableOpacity
                          style={s.ctaButton}
                          onPress={handleSaveValue}
                          disabled={savingValue}
                          activeOpacity={0.8}
                        >
                          {savingValue ? (
                            <ActivityIndicator size="small" color={BRAND.white} />
                          ) : (
                            <Text style={s.ctaButtonText}>{t('verificationScreen.savePhone')}</Text>
                          )}
                        </TouchableOpacity>
                        {currentPhone ? (
                          <TouchableOpacity
                            style={s.cancelBtn}
                            onPress={() => {
                              setIsEditing(false);
                              setEditValue(currentPhone);
                            }}
                          >
                            <Text style={s.cancelBtnText}>{t('common.cancel')}</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ) : (
                    <View style={s.valueDisplayRow}>
                      <View style={s.valueLabelCol}>
                        <Text style={s.valueLabelSmall}>{t('verificationScreen.phoneValue')}</Text>
                        <Text style={s.valueText} numberOfLines={1} ellipsizeMode="tail">
                          {currentPhone || t('common.notSet')}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={s.editPill}
                        onPress={() => {
                          setEditValue(currentPhone);
                          setIsEditing(true);
                        }}
                      >
                        <MaterialIcon name="edit" size={16} color={BRAND.secondary} />
                        <Text style={s.editPillText}>{t('common.edit')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Send OTP Button */}
                {!isEditing && (
                  <TouchableOpacity
                    style={[s.ctaButton, glowShadow, (!currentPhone || sendLoading) && s.ctaButtonDisabled]}
                    onPress={handleSendVerification}
                    disabled={sendLoading || !currentPhone}
                    activeOpacity={0.8}
                  >
                    {sendLoading ? (
                      <View style={s.ctaRow}>
                        <ActivityIndicator size="small" color={BRAND.white} />
                        <Text style={s.ctaButtonText}>{t('verificationScreen.sendingOtp')}</Text>
                      </View>
                    ) : (
                      <View style={s.ctaRow}>
                        <MaterialIcon name="sms" size={20} color={BRAND.white} />
                        <Text style={s.ctaButtonText}>{t('verificationScreen.sendOtp')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {/* OTP Entry Card */}
                <View style={[s.card, cardShadow]}>
                  {/* Countdown */}
                  <CountdownCircle />

                  {/* Separator */}
                  <View style={s.separator} />

                  {/* OTP Instruction */}
                  <Text style={s.otpInstruction}>
                    {t('verificationScreen.otpInstruction')}
                  </Text>

                  {/* OTP Input Boxes */}
                  <Animated.View style={[
                    s.otpContainer,
                    { transform: [{ translateX: shakeAnim }] }
                  ]}>
                    {otp.map((digit, index) => {
                      const isFocused = focusedIndex === index;
                      const isFilled = !!digit;

                      return (
                        <Animated.View
                          key={index}
                          style={[
                            s.otpBox,
                            isFilled && s.otpBoxFilled,
                            isFocused && s.otpBoxFocused,
                            { transform: [{ scale: otpScales[index] }] },
                          ]}
                        >
                          <TextInput
                            ref={(ref) => (inputRefs.current[index] = ref)}
                            style={[
                              s.otpDigitInput,
                              isFilled && s.otpDigitFilled,
                              isFocused && s.otpDigitFocused,
                              loading && s.otpDigitDisabled,
                            ]}
                            value={digit}
                            onChangeText={(value) => {
                              handleOtpChange(value, index);
                              // Pulse animation on fill
                              if (value) {
                                Animated.sequence([
                                  Animated.timing(otpScales[index], { toValue: 1.1, duration: 100, useNativeDriver: true }),
                                  Animated.spring(otpScales[index], { toValue: 1, friction: 3, useNativeDriver: true }),
                                ]).start();
                              }
                            }}
                            onKeyPress={(event) => handleKeyPress(event, index)}
                            onFocus={() => setFocusedIndex(index)}
                            onBlur={() => setFocusedIndex(-1)}
                            keyboardType="number-pad"
                            maxLength={index === 0 ? OTP_LENGTH : 1}
                            editable={!loading}
                            selectTextOnFocus
                            // SMS OTP autofill: iOS via textContentType, Android
                            // via autoComplete="sms-otp". First cell only —
                            // handleOtpChange fans the pasted code across cells.
                            textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                            autoComplete={index === 0 && Platform.OS === 'android' ? 'sms-otp' : undefined}
                            importantForAutofill={index === 0 ? 'yes' : 'no'}
                          />
                          {isFocused && !digit && (
                            <Animated.View style={s.otpCursor} />
                          )}
                        </Animated.View>
                      );
                    })}
                  </Animated.View>
                </View>

                {/* Verify Button */}
                <TouchableOpacity
                  style={[
                    s.ctaButton,
                    glowShadow,
                    (loading || otp.join('').length !== OTP_LENGTH) && s.ctaButtonDisabled,
                  ]}
                  onPress={() => {
                    if (otp.join('').length !== OTP_LENGTH) {
                      // Shake animation on incomplete OTP
                      Animated.sequence([
                        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
                      ]).start();
                      return;
                    }
                    handleVerifyOtp();
                  }}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <View style={s.ctaRow}>
                      <ActivityIndicator size="small" color={BRAND.white} />
                      <Text style={s.ctaButtonText}>{t('verificationScreen.verifyingBtn')}</Text>
                    </View>
                  ) : (
                    <View style={s.ctaRow}>
                      <MaterialIcon name="verified" size={20} color={BRAND.white} />
                      <Text style={s.ctaButtonText}>{t('verificationScreen.verifyOtp')}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Resend */}
                <View style={s.resendRow}>
                  <Text style={s.resendLabel}>{t('verificationScreen.didntReceive')}</Text>
                  <TouchableOpacity
                    onPress={handleSendVerification}
                    disabled={!canResend || sendLoading || loading}
                    style={[
                      s.resendBtn,
                      (!canResend || sendLoading) && s.resendBtnDisabled,
                    ]}
                    activeOpacity={0.7}
                  >
                    {sendLoading ? (
                      <ActivityIndicator size="small" color={BRAND.primary} />
                    ) : (
                      <>
                        <MaterialIcon name="refresh" size={16} color={(!canResend || sendLoading) ? BRAND.textMuted : BRAND.primary} />
                        <Text style={[
                          s.resendBtnText,
                          (!canResend || sendLoading) && s.resendBtnTextDisabled,
                        ]}>
                          {t('verificationScreen.resendOtp')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* Skip Button */}
        <TouchableOpacity
          style={s.skipBtn}
          onPress={handleSkip}
          disabled={loading || sendLoading}
          activeOpacity={0.7}
        >
          <Text style={s.skipBtnText}>{t('verificationScreen.skipForNow')}</Text>
          <MaterialIcon name="chevron-right" size={18} color={BRAND.textMuted} />
        </TouchableOpacity>

        {/* Footer Tip */}
        <View style={[s.footerCard, cardShadow]}>
          <MaterialIcon name="info-outline" size={18} color={BRAND.textMuted} />
          <Text style={s.footerText}>
            {isEmailVerification
              ? t('verificationScreen.emailTip')
              : t('verificationScreen.phoneTip')
            }
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  /* ─── Layout ───────────────────────────────────────────────────── */
  safeArea: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionWrap: {
    marginBottom: 16,
  },

  /* ─── Header Bar ───────────────────────────────────────────────── */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: BRAND.bg,
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.text,
    textAlign: 'center',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 15,
    color: BRAND.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 4,
  },

  /* ─── Alert ────────────────────────────────────────────────────── */
  alert: {
    marginBottom: 16,
    borderRadius: 16,
  },

  /* ─── Card ─────────────────────────────────────────────────────── */
  card: {
    backgroundColor: BRAND.white,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: BRAND.textSecondary,
    lineHeight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: BRAND.border,
    marginVertical: 16,
  },

  /* ─── Status Badge ─────────────────────────────────────────────── */
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* ─── Value Display ────────────────────────────────────────────── */
  valueDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  valueLabelCol: {
    flex: 1,
    marginRight: 12,
  },
  valueLabelSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND.text,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
  },
  editPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.secondary,
  },

  /* ─── Edit Mode ────────────────────────────────────────────────── */
  editWrap: {
    marginTop: 4,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.text,
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: BRAND.text,
    backgroundColor: '#F8FAFC',
  },
  editHint: {
    fontSize: 12,
    color: BRAND.textMuted,
    marginTop: 6,
    marginBottom: 12,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryCodeBox: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.text,
  },

  /* ─── CTA Button ───────────────────────────────────────────────── */
  ctaButton: {
    flex: 1,
    backgroundColor: BRAND.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ctaButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaButtonText: {
    color: BRAND.white,
    fontSize: 16,
    fontWeight: '700',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: BRAND.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },

  /* ─── Sent confirmation ────────────────────────────────────────── */
  sentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  sentText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#065F46',
    lineHeight: 20,
  },

  /* ─── Countdown ────────────────────────────────────────────────── */
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    borderWidth: 3,
    borderColor: BRAND.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownCircleExpired: {
    borderColor: BRAND.red,
    backgroundColor: '#FEF2F2',
  },
  countdownInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownLabel: {
    fontSize: 12,
    color: BRAND.textMuted,
    fontWeight: '500',
  },
  countdownValue: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.secondary,
  },
  countdownExpiredText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.red,
  },

  /* ─── OTP Input ────────────────────────────────────────────────── */
  otpInstruction: {
    fontSize: 14,
    color: BRAND.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  otpBox: {
    width: (SCREEN_WIDTH - 40 - 20 - 60) / 6, // adaptive sizing
    minWidth: 44,
    maxWidth: 54,
    height: 60,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: BRAND.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  otpBoxFilled: {
    borderColor: BRAND.secondary,
    backgroundColor: '#EFF6FF',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.secondary,
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  otpBoxFocused: {
    borderColor: BRAND.primary,
    backgroundColor: '#FFFBF5',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.primary,
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  otpDigitInput: {
    width: '100%',
    height: '100%',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: BRAND.text,
    padding: 0,
  },
  otpDigitFilled: {
    color: BRAND.secondary,
  },
  otpDigitFocused: {
    color: BRAND.primary,
  },
  otpDigitDisabled: {
    color: BRAND.textMuted,
  },
  otpCursor: {
    position: 'absolute',
    width: 2,
    height: 26,
    backgroundColor: BRAND.primary,
    borderRadius: 1,
  },

  /* ─── Resend ───────────────────────────────────────────────────── */
  resendRow: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    marginTop: 4,
  },
  resendLabel: {
    fontSize: 14,
    color: BRAND.textMuted,
    fontWeight: '500',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
  },
  resendBtnDisabled: {
    backgroundColor: '#F1F5F9',
  },
  resendBtnText: {
    fontSize: 14,
    color: BRAND.primary,
    fontWeight: '700',
  },
  resendBtnTextDisabled: {
    color: BRAND.textMuted,
  },

  /* ─── Skip ─────────────────────────────────────────────────────── */
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 16,
    marginBottom: 16,
  },
  skipBtnText: {
    fontSize: 14,
    color: BRAND.textMuted,
    fontWeight: '500',
  },

  /* ─── Footer ───────────────────────────────────────────────────── */
  footerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: BRAND.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  footerText: {
    flex: 1,
    fontSize: 13,
    color: BRAND.textMuted,
    lineHeight: 20,
  },

  /* ─── Success Screen ───────────────────────────────────────────── */
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: BRAND.bg,
  },
  successIconOuter: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  successIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: BRAND.successGreen,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.successGreen,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  successRing: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: BRAND.successGreen,
    opacity: 0.25,
  },
  successRingOuter: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: BRAND.successGreen,
    opacity: 0.12,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: BRAND.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: BRAND.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  successBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: BRAND.secondary,
    paddingHorizontal: 32,
    height: 56,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: BRAND.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  successBackBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.white,
  },
});

export default VerificationScreen;
