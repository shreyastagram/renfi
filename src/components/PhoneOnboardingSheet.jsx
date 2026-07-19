/**
 * PhoneOnboardingSheet — post-signup phone verification prompt.
 *
 * Shown once per login session on UserHome for accounts that authenticated
 * without a phone number (Google/Apple signups). Hands the actual add+OTP
 * work to PhoneChangeModal (the canonical verify-then-replace flow).
 *
 * Race-safety rules (do not weaken):
 * - The parent controls `visible` and must gate it on profileReady && !hasPhone,
 *   so this sheet never flashes for users whose phone simply hasn't loaded yet.
 * - ENTRY_DELAY_MS defers the entrance until after the auth→home navigator
 *   transition settles; if `visible` flips false during the delay (profile
 *   arrived with a phone), the sheet never appears.
 * - The sheet Modal and PhoneChangeModal are never open simultaneously
 *   (stacked RN Modals are flaky on Android) — CTA closes the sheet first,
 *   then opens the phone modal on the next frame.
 * - Every exit path calls onDismiss exactly once (reentry ref guard).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Pressable, Platform } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import TouchableOpacity from './TouchableOpacity';
import PhoneChangeModal from './PhoneChangeModal';
import { useLanguage } from '../context/LanguageContext';

const ENTRY_DELAY_MS = 450;

const BENEFIT_ICONS = ['flash-on', 'sms', 'verified-user'];

const PhoneOnboardingSheet = ({ visible, onDismiss, bottomInset = 0 }) => {
  const { t } = useLanguage();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const dismissedRef = useRef(false);
  const slide = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown

  // Deferred entrance — cancelled if `visible` drops during the delay. If the
  // parent gate flips false while the sheet is already open (e.g. a profile
  // refresh arrives with a phone verified elsewhere), close it too.
  useEffect(() => {
    if (!visible) {
      setSheetOpen(false);
      setPhoneModalOpen(false);
      return undefined;
    }
    dismissedRef.current = false;
    const timer = setTimeout(() => setSheetOpen(true), ENTRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    Animated.spring(slide, {
      toValue: sheetOpen ? 1 : 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 4,
    }).start();
  }, [sheetOpen, slide]);

  const finish = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setSheetOpen(false);
    setPhoneModalOpen(false);
    onDismiss?.();
  };

  const handleSkip = () => finish();

  const handleVerifyNow = () => {
    // Close the sheet Modal first; open the phone modal on the next frame so
    // the two RN Modals never overlap (Android stacking issues).
    setSheetOpen(false);
    setTimeout(() => setPhoneModalOpen(true), Platform.OS === 'android' ? 120 : 60);
  };

  const handlePhoneModalClose = () => {
    // Closed without verifying — don't nag again this session.
    finish();
  };

  const handlePhoneChanged = () => {
    // Verified! PhoneChangeModal already refreshed context/profile.
    finish();
  };

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });

  const benefits = [
    t('phoneOnboarding.benefitBook'),
    t('phoneOnboarding.benefitUpdates'),
    t('phoneOnboarding.benefitSecure'),
  ];

  return (
    <>
      <Modal
        visible={sheetOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleSkip}
      >
        <View style={styles.backdropWrap}>
          <Animated.View style={[styles.backdrop, { opacity: slide }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleSkip} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(bottomInset, 16) + 8, transform: [{ translateY }] },
            ]}
          >
            <View style={styles.grabber} />

            <View style={styles.iconBadge}>
              <MaterialIcon name="phone-iphone" size={30} color="#F97316" />
              <View style={styles.iconCheck}>
                <MaterialIcon name="check" size={12} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.title}>{t('phoneOnboarding.title')}</Text>
            <Text style={styles.subtitle}>{t('phoneOnboarding.subtitle')}</Text>

            <View style={styles.benefits}>
              {benefits.map((label, i) => (
                <View key={BENEFIT_ICONS[i]} style={styles.benefitRow}>
                  <View style={styles.benefitIconWrap}>
                    <MaterialIcon name={BENEFIT_ICONS[i]} size={16} color="#059669" />
                  </View>
                  <Text style={styles.benefitText}>{label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity activeOpacity={0.85} onPress={handleVerifyNow} style={styles.ctaWrap}>
              <LinearGradient
                colors={['#FB923C', '#F97316', '#EA580C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}
              >
                <MaterialIcon name="verified" size={18} color="#FFFFFF" style={styles.ctaIcon} />
                <Text style={styles.ctaText}>{t('phoneOnboarding.verifyNow')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSkip} style={styles.laterBtn} activeOpacity={0.7}>
              <Text style={styles.laterText}>{t('phoneOnboarding.later')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <PhoneChangeModal
        visible={phoneModalOpen}
        onClose={handlePhoneModalClose}
        currentPhone=""
        onChanged={handlePhoneChanged}
        bottomInset={bottomInset}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 10,
    alignItems: 'center',
    // iOS shadow + Android elevation (repo rule: every elevation gets a shadow)
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 18,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconCheck: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  benefits: { alignSelf: 'stretch', marginBottom: 20, gap: 10 },
  benefitRow: { flexDirection: 'row', alignItems: 'center' },
  benefitIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  benefitText: { fontSize: 14.5, color: '#334155', fontWeight: '600', flex: 1 },
  ctaWrap: { alignSelf: 'stretch', borderRadius: 16, overflow: 'hidden' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
  },
  ctaIcon: { marginRight: 8 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  laterBtn: { paddingVertical: 14, paddingHorizontal: 20 },
  laterText: { color: '#94A3B8', fontSize: 14.5, fontWeight: '700' },
});

export default PhoneOnboardingSheet;
