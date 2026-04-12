/**
 * Aadhaar Verification Modal (DigiLocker Via Link)
 *
 * A modal dialog for providers to verify their Aadhaar via DigiLocker.
 * Direct OTP flow is NOT used due to government compliance restrictions.
 *
 * FLOW:
 * 1. User taps "Start Verification"
 * 2. App opens DigiLocker URL in browser
 * 3. User authenticates in DigiLocker (OTP handled by DigiLocker)
 * 4. DigiLocker redirects back to app
 * 5. App polls for verification status
 *
 * COMPLIANCE NOTES:
 * - NO Aadhaar number collected
 * - NO OTP handled by our app
 * - DigiLocker handles all sensitive authentication
 * - Only verification status is saved
 *
 * @version 3.0.0 - Revamped UI with safe area insets
 */

import React, { useState, useEffect, useRef } from 'react';
import {  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  Linking,
  AppState,
  Animated
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import {
  initiateVerification,
  openVerificationUrl,
  checkVerificationStatus,
  getAadhaarStatus
} from '../services/aadhaarService';

// Steps in the verification flow
const STEPS = {
  INTRO: 'intro',
  NAME_CONFIRM: 'name_confirm',
  VERIFYING: 'verifying',
  POLLING: 'polling',
  VERIFIED: 'verified',
  ERROR: 'error',
};

const COLORS = {
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primaryDark: '#1D4ED8',
  success: '#10B981',
  successLight: '#ECFDF5',
  error: '#EF4444',
  errorLight: '#FEF2F2',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  bg: '#FFFFFF',
  bgSecondary: '#F9FAFB',
  border: '#E5E7EB',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

const AadhaarVerificationModal = ({ visible, onClose, onVerified }) => {
  const { dialog } = useDialog();
  const { t } = useLanguage();
  const { profile } = useApp();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(STEPS.INTRO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const appStateRef = useRef(AppState.currentState);
  const pollingRef = useRef(null);

  const providerName = profile?.fullName || profile?.name || '';

  // Animate in when step changes
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [step]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep(STEPS.INTRO);
      setError('');
      setSessionId('');
      setPollingAttempts(0);
      setLoading(false);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [visible]);

  // Handle app state changes (when user returns from browser)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        sessionId &&
        step === STEPS.VERIFYING
      ) {
        console.log('[DigiLocker] User returned to app, starting poll');
        setStep(STEPS.POLLING);
        startPolling();
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription?.remove();
  }, [sessionId, step]);

  // Handle deep link callback
  useEffect(() => {
    const handleDeepLink = (event) => {
      const url = event.url;
      if (url.includes('aadhaar-verification')) {
        const params = new URLSearchParams(url.split('?')[1]);
        const status = params.get('status');

        if (status === 'success') {
          setStep(STEPS.VERIFIED);
          setTimeout(() => { onVerified?.(); onClose(); }, 1500);
        } else if (status === 'name_mismatch') {
          const aadhaarName = params.get('aadhaarName') || '';
          setError(`Name on Aadhaar: "${aadhaarName}"\n\nPlease update your name in Profile to match your Aadhaar card exactly, then try again.`);
          setStep(STEPS.ERROR);
        } else if (status === 'name_retrieval_failed') {
          setError(params.get('message') || 'Could not retrieve name from DigiLocker. Please try again.');
          setStep(STEPS.ERROR);
        } else if (status === 'failed' || status === 'error') {
          setError(params.get('message') || 'Verification failed');
          setStep(STEPS.ERROR);
        } else {
          setStep(STEPS.POLLING);
          startPolling();
        }
      }
    };

    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);
    return () => linkingSubscription?.remove();
  }, []);

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPollingAttempts(0);

    pollingRef.current = setInterval(async () => {
      setPollingAttempts(prev => {
        const newAttempts = prev + 1;
        if (newAttempts > 20) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setError(t('aadhaar.timeout'));
          setStep(STEPS.ERROR);
          return prev;
        }
        return newAttempts;
      });

      const result = await checkVerificationStatus(sessionId);

      if (result.verified) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setStep(STEPS.VERIFIED);
        setTimeout(() => { onVerified?.(); onClose(); }, 1500);
      } else if (result.status === 'name_mismatch') {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setError(`Name mismatch!\n\nName on Aadhaar: "${result.aadhaarName || ''}"\n\nUpdate your profile name to match your Aadhaar card, then try again.`);
        setStep(STEPS.ERROR);
      } else if (result.status === 'name_retrieval_failed') {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setError(result.message || 'Could not retrieve your name from DigiLocker. Please try again.');
        setStep(STEPS.ERROR);
      } else if (result.status === 'failed' || result.status === 'expired') {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setError(result.message || 'Verification failed');
        setStep(STEPS.ERROR);
      }
    }, 3000);
  };

  const handleStartVerification = async () => {
    if (!providerName || providerName.trim().length < 2) {
      setError(t('aadhaar.nameRequired'));
      setStep(STEPS.ERROR);
      return;
    }
    setStep(STEPS.NAME_CONFIRM);
  };

  const handleNameConfirmed = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await initiateVerification();

      if (result.success) {
        setSessionId(result.sessionId);
        const opened = await openVerificationUrl(result.verificationUrl);
        if (opened) {
          setStep(STEPS.VERIFYING);
        } else {
          setError(t('aadhaar.openFailed'));
          setStep(STEPS.ERROR);
        }
      } else {
        if (result.code === 'NAME_REQUIRED') {
          setError(t('aadhaar.nameRequired'));
        } else {
          setError(result.error || 'Failed to start verification');
        }
        setStep(STEPS.ERROR);
      }
    } catch (err) {
      setError(t('aadhaar.genericError'));
      setStep(STEPS.ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setStep(STEPS.INTRO);
    setError('');
    setSessionId('');
  };

  const handleCheckStatus = async () => {
    if (!sessionId) return;
    setLoading(true);
    const result = await checkVerificationStatus(sessionId);
    setLoading(false);

    if (result.verified) {
      setStep(STEPS.VERIFIED);
      setTimeout(() => { onVerified?.(); onClose(); }, 1500);
    } else if (result.status === 'name_mismatch') {
      setError(`Name mismatch!\n\nName on Aadhaar: "${result.aadhaarName || ''}"\n\nUpdate your profile name, then try again.`);
      setStep(STEPS.ERROR);
    } else if (result.status === 'name_retrieval_failed') {
      setError(result.message || 'Could not retrieve your name from DigiLocker. Please try again.');
      setStep(STEPS.ERROR);
    } else if (result.status === 'pending') {
      if (Platform.OS === 'ios') {
        // iOS modal-in-modal deadlock prevention: this Modal is still mounted
        // when the dialog() would be called, which freezes iOS. Instead, use
        // the same inline error state pattern already used above for
        // name_mismatch / name_retrieval_failed. User can tap "Start Verification"
        // to reopen DigiLocker from the ERROR step.
        setError('Verification still processing. Please complete the verification in DigiLocker first, then tap the button below to try again.');
        setStep(STEPS.ERROR);
      } else {
        // Android: original behavior (identical to Play build 5 — do not change).
        dialog('Still Processing', 'Please complete the verification in DigiLocker first.', [
          { text: 'Open DigiLocker', onPress: () => handleStartVerification() },
          { text: 'OK', style: 'cancel' },
        ]);
      }
    } else {
      setError(result.message || 'Verification not complete');
    }
  };

  const bottomPadding = Math.max(insets.bottom, 16) + 8;

  // ─── STEP RENDERERS ────────────────────────────────────────

  const renderIntroStep = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={s.headerRow}>
        <View style={s.headerIconWrap}>
          <MaterialIcon name="verified-user" size={28} color={COLORS.primary} />
        </View>
        <View style={s.headerTextWrap}>
          <Text style={s.headerTitle}>{t('aadhaar.title')}</Text>
          <Text style={s.headerSubtitle}>{t('aadhaar.subtitle')}</Text>
        </View>
      </View>

      <View style={s.featureList}>
        {[
          { icon: 'shield', text: t('aadhaar.feature1') },
          { icon: 'lock-outline', text: t('aadhaar.feature2') },
          { icon: 'bolt', text: t('aadhaar.feature3') },
        ].map((item, i) => (
          <View key={i} style={s.featureRow}>
            <View style={s.featureIconWrap}>
              <MaterialIcon name={item.icon} size={18} color={COLORS.success} />
            </View>
            <Text style={s.featureText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={s.infoCard}>
        <MaterialIcon name="info-outline" size={16} color={COLORS.primary} />
        <Text style={s.infoText}>
          {t('aadhaar.infoText')}
        </Text>
      </View>

      <View style={s.warningCard}>
        <MaterialIcon name="warning-amber" size={16} color={COLORS.warning} />
        <Text style={s.warningText}>
          {t('aadhaar.warningText')}
        </Text>
      </View>

      <TouchableOpacity
        style={[s.primaryBtn, loading && s.btnDisabled]}
        onPress={handleStartVerification}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <>
            <MaterialIcon name="verified-user" size={20} color="#FFF" />
            <Text style={s.primaryBtnText}>{t('aadhaar.startBtn')}</Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  const renderNameConfirmStep = () => (
    <Animated.View style={[s.centeredContent, { opacity: fadeAnim }]}>
      <View style={s.nameIconCircle}>
        <MaterialIcon name="person-outline" size={36} color={COLORS.primary} />
      </View>

      <Text style={s.stepTitle}>{t('aadhaar.confirmName')}</Text>
      <Text style={s.stepDesc}>
        {t('aadhaar.confirmNameDesc')}
      </Text>

      <View style={s.nameCard}>
        <Text style={s.nameLabel}>{t('aadhaar.profileNameLabel')}</Text>
        <Text style={s.nameValue}>{providerName}</Text>
      </View>

      <Text style={s.nameQuestion}>{t('aadhaar.nameQuestion')}</Text>

      <TouchableOpacity
        style={[s.primaryBtn, loading && s.btnDisabled]}
        onPress={handleNameConfirmed}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <>
            <MaterialIcon name="check-circle-outline" size={20} color="#FFF" />
            <Text style={s.primaryBtnText}>{t('aadhaar.yesProceed')}</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={s.outlineBtn}
        onPress={() => {
          if (Platform.OS === 'ios') {
            // iOS modal-in-modal deadlock prevention: close this Modal first,
            // then defer the dialog() until after the Modal has fully unmounted.
            // Otherwise iOS freezes with two Modals simultaneously mounted.
            onClose();
            setTimeout(() => {
              dialog(
                t('aadhaar.updateNameTitle'),
                t('aadhaar.updateNameMsg'),
                [{ text: 'OK' }]
              );
            }, 400);
          } else {
            // Android: original behavior (identical to Play build 5 — do not change).
            onClose();
            dialog(
              t('aadhaar.updateNameTitle'),
              t('aadhaar.updateNameMsg'),
              [{ text: 'OK' }]
            );
          }
        }}
        activeOpacity={0.8}
      >
        <MaterialIcon name="edit" size={18} color={COLORS.error} />
        <Text style={s.outlineBtnText}>{t('aadhaar.updateName')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderVerifyingStep = () => (
    <Animated.View style={[s.centeredContent, { opacity: fadeAnim, paddingVertical: 32 }]}>
      <View style={s.pulseWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
      <Text style={s.stepTitle}>{t('aadhaar.inProgress')}</Text>
      <Text style={s.stepDesc}>
        {t('aadhaar.inProgressDesc')}
      </Text>

      <TouchableOpacity style={s.secondaryBtn} onPress={handleCheckStatus} disabled={loading} activeOpacity={0.8}>
        <Text style={s.secondaryBtnText}>{loading ? t('aadhaar.checking') : t('aadhaar.completedBtn')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.linkBtn} onPress={handleStartVerification} activeOpacity={0.7}>
        <Text style={s.linkBtnText}>{t('aadhaar.openAgain')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderPollingStep = () => (
    <Animated.View style={[s.centeredContent, { opacity: fadeAnim, paddingVertical: 40 }]}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={[s.stepTitle, { marginTop: 24 }]}>{t('aadhaar.checkingStatus')}</Text>
      <Text style={s.stepDesc}>{t('aadhaar.checkingDesc')}</Text>
      <Text style={s.mutedSmall}>Attempt {pollingAttempts} of 20</Text>
    </Animated.View>
  );

  const renderErrorStep = () => (
    <Animated.View style={[s.centeredContent, { opacity: fadeAnim }]}>
      <View style={s.errorCircle}>
        <MaterialIcon name="close" size={36} color={COLORS.error} />
      </View>
      <Text style={[s.stepTitle, { color: COLORS.error }]}>{t('aadhaar.failed')}</Text>
      <Text style={[s.stepDesc, { marginBottom: 24 }]}>{error}</Text>

      <TouchableOpacity style={s.primaryBtn} onPress={handleRetry} activeOpacity={0.8}>
        <MaterialIcon name="refresh" size={20} color="#FFF" />
        <Text style={s.primaryBtnText}>{t('aadhaar.tryAgain')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.linkBtn} onPress={onClose} activeOpacity={0.7}>
        <Text style={s.linkBtnText}>{t('aadhaar.cancel')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderVerifiedStep = () => (
    <Animated.View style={[s.centeredContent, { opacity: fadeAnim, paddingVertical: 40 }]}>
      <View style={s.successCircle}>
        <MaterialIcon name="check" size={44} color="#FFF" />
      </View>
      <Text style={[s.stepTitle, { color: COLORS.success, marginTop: 20 }]}>{t('aadhaar.verified')}</Text>
      <Text style={s.stepDesc}>{t('aadhaar.verifiedDesc')}</Text>
    </Animated.View>
  );

  // ─── MODAL SHELL ───────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={step !== STEPS.VERIFIED ? onClose : undefined}
    >
      <View style={s.overlay}>
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={() => {
            if (step === STEPS.INTRO || step === STEPS.ERROR || step === STEPS.NAME_CONFIRM) onClose();
          }}
        />

        <View style={[s.sheet, { paddingBottom: bottomPadding }]}>
          <View style={s.handle} />

          {(step === STEPS.INTRO || step === STEPS.ERROR || step === STEPS.NAME_CONFIRM) && (
            <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcon name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          {step === STEPS.INTRO && renderIntroStep()}
          {step === STEPS.NAME_CONFIRM && renderNameConfirmStep()}
          {step === STEPS.VERIFYING && renderVerifyingStep()}
          {step === STEPS.POLLING && renderPollingStep()}
          {step === STEPS.ERROR && renderErrorStep()}
          {step === STEPS.VERIFIED && renderVerifiedStep()}
        </View>
      </View>
    </Modal>
  );
};

// ─── STYLES ─────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    top: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Header ──────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTextWrap: { flex: 1 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // ─── Feature list ────────────────
  featureList: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },

  // ─── Info / Warning cards ────────
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  infoText: {
    color: COLORS.primary,
    fontSize: 13,
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warningLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    color: '#92400E',
    fontSize: 13,
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },

  // ─── Buttons ─────────────────────
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: COLORS.errorLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  outlineBtnText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  linkBtn: {
    marginTop: 14,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  linkBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
  },

  // ─── Centered content ────────────
  centeredContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  mutedSmall: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 8,
  },

  // ─── Name confirm ────────────────
  nameIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  nameCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginVertical: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  nameLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 6,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  nameValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  nameQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
  },

  // ─── Status circles ──────────────
  errorCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseWrap: {
    marginBottom: 20,
  },
});

export default AadhaarVerificationModal;
