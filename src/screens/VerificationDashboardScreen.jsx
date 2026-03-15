/**
 * Verification Dashboard Screen
 *
 * Full-screen verification checklist for providers showing:
 * - 5-step verification progress (phone, email, aadhaar, service approval, premium)
 * - Search visibility capabilities
 * - Quick actions to complete each step
 * - Sync button to refresh status from Java Auth
 *
 * @version 2.0.0 — Premium design language
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Animated,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { Icon, AadhaarVerificationModal } from '../components';
import ScreenShimmer from '../components/ShimmerLoader';
import { getVerificationDashboard, syncVerificationStatus } from '../services/verificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Premium design-language tokens
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  hero: '#0F172A',
  background: '#F1F5F9',
  white: '#FFFFFF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  muted: '#94A3B8',
  textPrimary: '#1E293B',
  grayLight: '#F1F5F9',
};

const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: BRAND.hero,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  android: {
    elevation: 5,
  },
});

const CARD_SHADOW_LIGHT = Platform.select({
  ios: {
    shadowColor: BRAND.hero,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  android: {
    elevation: 3,
  },
});

// Step configuration for icons and actions
const STEP_CONFIG = {
  phone: {
    icon: 'phone',
    actionLabelKey: 'verificationDashboard.verifyPhone',
    navTarget: 'Verification',
    navParams: { verificationType: 'phone' },
    descriptionKey: 'verificationDashboard.verifyPhoneDesc',
  },
  email: {
    icon: 'email',
    actionLabelKey: 'verificationDashboard.verifyEmail',
    navTarget: 'Verification',
    navParams: { verificationType: 'email' },
    descriptionKey: 'verificationDashboard.verifyEmailDesc',
  },
  aadhaar: {
    icon: 'badge',
    actionLabelKey: 'verificationDashboard.verifyAadhaar',
    navTarget: 'DocumentVerification',
    navParams: {},
    descriptionKey: 'verificationDashboard.verifyAadhaarDesc',
  },
  service_approval: {
    icon: 'document',
    actionLabelKey: 'verificationDashboard.submitDocuments',
    navTarget: 'DocumentVerification',
    navParams: {},
    descriptionKey: 'verificationDashboard.submitDocumentsDesc',
  },
  legal_acceptance: {
    icon: 'document',
    actionLabelKey: 'verificationDashboard.acceptTerms',
    navTarget: null, // Handled inline
    navParams: {},
    descriptionKey: 'verificationDashboard.acceptTermsDesc',
  },
  premium: {
    icon: 'star',
    actionLabelKey: 'verificationDashboard.goPremium',
    navTarget: 'Subscription',
    navParams: {},
    descriptionKey: 'verificationDashboard.goPremiumDesc',
  },
};

/**
 * Animated pressable wrapper with spring scale effect
 */
const AnimatedPressable = ({ children, onPress, disabled, style }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * Circular progress indicator — premium style
 */
const ProgressCircle = ({ completed, total }) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = completed === total;

  return (
    <View style={[styles.progressCircle, isComplete && styles.progressCircleComplete]}>
      <View style={[styles.progressCircleInner, isComplete && styles.progressCircleInnerComplete]}>
        <Text style={[styles.progressPercentage, isComplete && styles.progressPercentageComplete]}>
          {percentage}%
        </Text>
        <Text style={[styles.progressLabel, isComplete && styles.progressLabelComplete]}>
          {completed}/{total}
        </Text>
      </View>
    </View>
  );
};

/**
 * Section header with left accent bar
 */
const SectionHeader = ({ title, subtitle }) => (
  <View style={styles.sectionHeaderRow}>
    <View style={styles.sectionAccentBar} />
    <View style={styles.sectionHeaderContent}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  </View>
);

/**
 * Verification step card — premium card style
 */
const StepCard = ({ step, config, onAction, isLast, t }) => {
  const isCompleted = step.completed;
  const hasWarning = step.phoneChanged;
  const statusColor = isCompleted
    ? (hasWarning ? BRAND.warning : BRAND.success)
    : BRAND.primary;

  return (
    <View style={[styles.stepCard, !isLast && styles.stepCardWithConnector]}>
      {/* Step indicator column */}
      <View style={styles.stepIndicatorColumn}>
        <View style={[styles.stepDot, { backgroundColor: statusColor }]}>
          <Icon
            name={isCompleted && !hasWarning ? 'check' : hasWarning ? 'warning' : config.icon}
            size={isCompleted ? 14 : 16}
            color="#FFFFFF"
          />
        </View>
        {!isLast && (
          <View style={[styles.stepConnector, isCompleted && !hasWarning && styles.stepConnectorComplete]} />
        )}
      </View>

      {/* Step content card */}
      <View style={[styles.stepContent, isCompleted && !hasWarning && styles.stepContentComplete]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepIconContainer, { backgroundColor: statusColor + '12' }]}>
            <Icon name={config.icon} size={18} color={statusColor} />
          </View>
          <Text style={[styles.stepTitle, isCompleted && !hasWarning && styles.stepTitleComplete]}>
            {step.label}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {hasWarning ? t('verificationDashboard.reVerify') : isCompleted ? t('common.verified') : t('common.pending')}
            </Text>
          </View>
        </View>

        <Text style={styles.stepDescription}>
          {step.description || (config.descriptionKey ? t(config.descriptionKey) : config.description)}
        </Text>

        {/* Phone changed warning */}
        {step.phoneChanged && (
          <View style={styles.stepWarning}>
            <Icon name="warning" size={12} color="#92400E" />
            <Text style={styles.stepWarningText}>
              {t('verificationDashboard.phoneChanged')}
            </Text>
          </View>
        )}

        {/* Aadhaar name + lock info */}
        {step.id === 'aadhaar' && step.completed && step.aadhaarName && (
          <View style={styles.stepVerifiedInfo}>
            <Icon name="verified_user" size={12} color={BRAND.success} />
            <Text style={styles.stepVerifiedInfoText}>
              {t('verificationDashboard.verifiedAs', { name: step.aadhaarName })}
            </Text>
          </View>
        )}
        {step.id === 'aadhaar' && step.isNameLocked && (
          <View style={styles.stepLockInfo}>
            <Icon name="lock" size={11} color={BRAND.muted} />
            <Text style={styles.stepLockInfoText}>
              {t('verificationDashboard.nameLocked')}
            </Text>
          </View>
        )}

        {/* Contextual details based on step type */}
        {step.id === 'service_approval' && step.approvedServices?.length > 0 && (
          <Text style={styles.stepDetails}>
            {t('verificationDashboard.approvedServices', { list: step.approvedServices.join(', ') })}
          </Text>
        )}
        {step.id === 'service_approval' && step.pendingServices?.length > 0 && (
          <Text style={styles.stepDetails}>
            {t('verificationDashboard.pendingServices', { list: step.pendingServices.join(', ') })}
          </Text>
        )}
        {step.id === 'premium' && step.completed && step.daysRemaining > 0 && (
          <Text style={styles.stepDetails}>
            {t('verificationDashboard.daysRemaining', { count: step.daysRemaining })}
          </Text>
        )}
        {step.id === 'premium' && !step.completed && (
          <Text style={styles.stepDetails}>
            {t('verificationDashboard.premiumPricing')}
          </Text>
        )}
        {step.id === 'aadhaar' && step.completed && step.verifiedAt && !step.aadhaarName && (
          <Text style={styles.stepDetails}>
            {t('verificationDashboard.verifiedOn', { date: new Date(step.verifiedAt).toLocaleDateString('en-IN') })}
          </Text>
        )}
        {step.id === 'legal_acceptance' && step.completed && step.acceptedAt && (
          <Text style={styles.stepDetails}>
            Accepted on {new Date(step.acceptedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        )}
        {step.id === 'legal_acceptance' && !step.completed && (
          <Text style={styles.stepDetails}>
            Read and accept our Terms &amp; Conditions and Privacy Policy
          </Text>
        )}

        {/* Action button for incomplete steps or phone re-verify */}
        {(!isCompleted || step.phoneChanged) && (
          <AnimatedPressable
            onPress={() => onAction(step.id, config)}
            style={styles.stepActionButton}
          >
            <Text style={styles.stepActionText}>
              {step.phoneChanged ? t('verificationDashboard.reVerifyPhone') : (config.actionLabelKey ? t(config.actionLabelKey) : config.actionLabel)}
            </Text>
            <Icon name="chevron-right" size={16} color={BRAND.white} />
          </AnimatedPressable>
        )}
      </View>
    </View>
  );
};

/**
 * Capability card showing search visibility — premium style
 */
const CapabilityCard = ({ iconName, title, enabled, description }) => (
  <View style={[styles.capabilityCard, enabled && styles.capabilityCardEnabled]}>
    <View style={[styles.capabilityIcon, { backgroundColor: enabled ? BRAND.success + '12' : BRAND.grayLight }]}>
      <Icon name={iconName} size={20} color={enabled ? BRAND.success : BRAND.muted} />
    </View>
    <View style={styles.capabilityContent}>
      <Text style={[styles.capabilityTitle, enabled && styles.capabilityTitleEnabled]}>
        {title}
      </Text>
      <Text style={styles.capabilityDescription}>{description}</Text>
    </View>
    <View style={[styles.capabilityStatus, { backgroundColor: enabled ? BRAND.success + '12' : BRAND.danger + '10' }]}>
      <Icon
        name={enabled ? 'check-circle' : 'close'}
        size={16}
        color={enabled ? BRAND.success : BRAND.danger}
      />
    </View>
  </View>
);

/**
 * Verification Dashboard Screen Component
 */
const VerificationDashboardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [showAadhaarModal, setShowAadhaarModal] = useState(false);

  // Animated sync icon rotation
  const spinAnim = useRef(new Animated.Value(0)).current;

  const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  /**
   * Fetch dashboard data
   */
  const fetchDashboard = useCallback(async (showLoader = true) => {
    if (!providerId) return;

    if (showLoader) setLoading(true);
    setError(null);

    try {
      const result = await getVerificationDashboard(providerId);

      if (result.success) {
        setDashboard(result.data);
      } else {
        setError(result.error?.message || t('verificationDashboard.loadFailed'));
      }
    } catch (err) {
      setError(t('verificationDashboard.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard(false);
    setRefreshing(false);
  };

  /**
   * Sync verification from Java Auth
   */
  const handleSync = async () => {
    if (!providerId || syncing) return;

    // Spin animation
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ).start();

    setSyncing(true);
    try {
      const result = await syncVerificationStatus(providerId);

      if (result.success) {
        setDashboard(result.data);
        if (refreshProfile) {
          refreshProfile();
        }
        dialog(t('verificationDashboard.synced'), t('verificationDashboard.syncedMsg'));
      } else {
        dialog(t('verificationDashboard.syncFailed'), result.error?.message || t('verificationDashboard.syncFailedMsg'));
      }
    } catch (err) {
      dialog('Error', t('verificationDashboard.syncError'));
    } finally {
      setSyncing(false);
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  };

  /**
   * Handle step action — navigate to the relevant screen or open modal
   */
  const handleStepAction = (stepKey, config) => {
    // Aadhaar step: open the AadhaarVerificationModal directly (same as ProfileScreen)
    if (stepKey === 'aadhaar') {
      setShowAadhaarModal(true);
      return;
    }

    // Legal acceptance step: show confirmation dialog
    if (stepKey === 'legal_acceptance') {
      dialog(
        t('verificationDashboard.acceptTermsTitle') || 'Terms & Privacy Policy',
        t('verificationDashboard.acceptTermsMsg') || 'By accepting, you agree to the Fixhomi Terms & Conditions and Privacy Policy. This cannot be undone — to revoke, contact support.',
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('verificationDashboard.readTerms') || 'Read Terms',
            onPress: () => Linking.openURL('https://fixhomi.com/terms'),
          },
          {
            text: t('verificationDashboard.acceptBtn') || 'Accept',
            onPress: async () => {
              try {
                const { authFetch } = require('../utils/authFetch');
                const { NODE_BASE_URL } = require('../config/api');
                const res = await authFetch(`${NODE_BASE_URL}/api/auth/accept-policies`, {
                  method: 'POST',
                  body: JSON.stringify({
                    termsAccepted: true,
                    privacyAccepted: true,
                  }),
                });
                const data = await res.json();
                if (data.success) {
                  dialog(t('common.success'), t('verificationDashboard.policiesAccepted') || 'Policies accepted successfully.');
                  loadDashboard();
                } else {
                  dialog(t('common.error'), data.error || 'Unable to save. Please try again.');
                }
              } catch (err) {
                dialog(t('common.error'), 'Unable to save. Please try again.');
              }
            },
          },
        ]
      );
      return;
    }

    if (config.navTarget) {
      const params = { ...(config.navParams || {}) };

      // If phone step has phoneChanged flag, pass forceReVerify
      if (stepKey === 'phone') {
        const phoneStep = steps.find(s => s.id === 'phone');
        if (phoneStep?.phoneChanged) {
          params.forceReVerify = true;
        }
      }

      navigation.navigate(config.navTarget, params);
    }
  };

  // Fetch dashboard on mount and when returning from another screen
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDashboard(false);
    });
    return unsubscribe;
  }, [navigation, fetchDashboard]);

  // Compute derived values
  const steps = dashboard?.steps || [];
  const completedSteps = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const capabilities = dashboard?.capabilities || {};
  const isFullyVerified = dashboard?.isFullyVerified || false;
  const isPremium = dashboard?.isPremium || false;

  const spinRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Loading state
  if (loading && !dashboard) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ScreenShimmer type="steps" />
      </View>
    );
  }

  // Error state
  if (error && !dashboard) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={styles.errorIconContainer}>
          <Icon name="error" size={36} color={BRAND.danger} />
        </View>
        <Text style={styles.errorTitle}>{t('verificationDashboard.somethingWentWrong')}</Text>
        <Text style={styles.errorText}>{error}</Text>
        <AnimatedPressable onPress={() => fetchDashboard()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View style={styles.headerContent}>
          <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow_back" size={22} color={BRAND.white} />
          </AnimatedPressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{t('verificationDashboard.title')}</Text>
            <Text style={styles.headerSubtitle}>
              {isFullyVerified ? t('verificationDashboard.allComplete') : t('verificationDashboard.progress', { completed: completedSteps, total: totalSteps })}
            </Text>
          </View>
          <AnimatedPressable
            onPress={handleSync}
            disabled={syncing}
            style={styles.syncButton}
          >
            {syncing ? (
              <Animated.View style={{ transform: [{ rotate: spinRotation }] }}>
                <Icon name="refresh" size={20} color={BRAND.white} />
              </Animated.View>
            ) : (
              <Icon name="refresh" size={20} color={BRAND.white} />
            )}
          </AnimatedPressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND.primary}
            colors={[BRAND.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Overview Card */}
        <View style={[styles.overviewCard, isFullyVerified && styles.overviewCardComplete]}>
          <View style={styles.overviewContent}>
            <ProgressCircle completed={completedSteps} total={totalSteps} />
            <View style={styles.overviewText}>
              <Text style={styles.overviewTitle}>
                {isFullyVerified
                  ? t('verificationDashboard.fullyVerified')
                  : t('verificationDashboard.stepsRemaining', { count: totalSteps - completedSteps })
                }
              </Text>
              <Text style={styles.overviewSubtitle}>
                {isFullyVerified
                  ? t('verificationDashboard.fullyVerifiedSub')
                  : t('verificationDashboard.incompleteSub')
                }
              </Text>

              {/* Progress bar */}
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: totalSteps > 0 ? `${(completedSteps / totalSteps) * 100}%` : '0%',
                        backgroundColor: isFullyVerified ? BRAND.success : BRAND.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Premium status indicator */}
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Icon name="star" size={14} color="#F59E0B" />
              <Text style={styles.premiumBadgeText}>{t('verificationDashboard.premiumActive')}</Text>
            </View>
          )}
        </View>

        {/* Verification Steps */}
        <SectionHeader title={t('verificationDashboard.verificationChecklist')} />
        <View style={styles.stepsContainer}>
          {steps.map((step, index) => {
            const config = STEP_CONFIG[step.id] || {
              icon: 'check-circle',
              actionLabelKey: 'verificationDashboard.completeBtn',
              description: step.label,
            };

            return (
              <StepCard
                key={step.id}
                step={step}
                config={config}
                onAction={handleStepAction}
                isLast={index === steps.length - 1}
                t={t}
              />
            );
          })}
        </View>

        {/* Search Visibility Section */}
        <SectionHeader
          title={t('verificationDashboard.searchVisibility')}
          subtitle={t('verificationDashboard.searchVisibilitySub')}
        />

        <CapabilityCard
          iconName="build"
          title={t('verificationDashboard.traditionalServices')}
          enabled={capabilities.canAppearInTraditionalSearch}
          description={t('verificationDashboard.traditionalServicesSub')}
        />

        <CapabilityCard
          iconName="camera"
          title={t('verificationDashboard.eventServicesTitle')}
          enabled={capabilities.canAppearInEventSearch}
          description={t('verificationDashboard.eventServicesSub')}
        />

        {/* Only show Emergency capability if provider has emergency categories */}
        {capabilities.hasEmergencyCategory && (
          <CapabilityCard
            iconName="notification"
            title={t('verificationDashboard.emergencyServicesTitle')}
            enabled={capabilities.canAppearInEmergencySearch}
            description={t('verificationDashboard.emergencyServicesSub')}
          />
        )}

        {/* Info note */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Icon name="info" size={18} color={BRAND.secondary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>{t('verificationDashboard.howItWorks')}</Text>
            <Text style={styles.infoText}>
              {'• '}{t('verificationDashboard.howItWorks1')}{'\n'}
              {'• '}{t('verificationDashboard.howItWorks2')}{'\n'}
              {'• '}{t('verificationDashboard.howItWorks3')}{'\n'}
              {'• '}{t('verificationDashboard.howItWorks4')}{'\n'}
              {'• '}{t('verificationDashboard.howItWorks5')}{'\n'}
              {'• '}{t('verificationDashboard.howItWorks6')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Aadhaar Verification Modal — same flow as ProfileScreen */}
      <AadhaarVerificationModal
        visible={showAadhaarModal}
        onClose={() => setShowAadhaarModal(false)}
        onVerified={() => {
          setShowAadhaarModal(false);
          // Refresh dashboard to show updated status
          fetchDashboard(false);
          if (refreshProfile) refreshProfile();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // ─── Premium Header ────────────────────────────────────────
  header: {
    backgroundColor: BRAND.hero,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: BRAND.hero,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.white,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  syncButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Scroll ────────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // ─── Loading & Error ───────────────────────────────────────
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BRAND.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.muted,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BRAND.danger + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.textPrimary,
  },
  errorText: {
    marginTop: 6,
    fontSize: 14,
    color: BRAND.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    ...CARD_SHADOW_LIGHT,
  },
  retryButtonText: {
    color: BRAND.white,
    fontSize: 15,
    fontWeight: '700',
  },

  // ─── Overview Card ─────────────────────────────────────────
  overviewCard: {
    backgroundColor: BRAND.white,
    borderRadius: 22,
    padding: 22,
    marginBottom: 28,
    ...CARD_SHADOW,
  },
  overviewCardComplete: {
    borderWidth: 1.5,
    borderColor: BRAND.success + '30',
  },
  overviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewText: {
    flex: 1,
    marginLeft: 18,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.textPrimary,
    marginBottom: 4,
  },
  overviewSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: BRAND.muted,
    lineHeight: 18,
  },
  progressBarContainer: {
    marginTop: 12,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND.grayLight,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 14,
    gap: 6,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },

  // ─── Progress Circle ───────────────────────────────────────
  progressCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: BRAND.primary + '12',
    borderWidth: 3,
    borderColor: BRAND.primary + '25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleComplete: {
    backgroundColor: BRAND.success + '12',
    borderColor: BRAND.success + '25',
  },
  progressCircleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BRAND.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  progressCircleInnerComplete: {
    ...Platform.select({
      ios: {
        shadowColor: BRAND.success,
      },
      android: {},
    }),
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.primary,
  },
  progressPercentageComplete: {
    color: BRAND.success,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.muted,
    marginTop: -2,
  },
  progressLabelComplete: {
    color: BRAND.success,
  },

  // ─── Section Header ────────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionAccentBar: {
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: BRAND.primary,
    marginRight: 10,
    marginTop: 1,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND.textPrimary,
    letterSpacing: 0.1,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: BRAND.muted,
    marginTop: 3,
    lineHeight: 18,
  },

  // ─── Steps Container ───────────────────────────────────────
  stepsContainer: {
    marginBottom: 28,
  },
  stepCard: {
    flexDirection: 'row',
  },
  stepCardWithConnector: {
    marginBottom: 0,
  },

  // Step Indicator
  stepIndicatorColumn: {
    width: 40,
    alignItems: 'center',
  },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  stepConnector: {
    width: 2.5,
    flex: 1,
    backgroundColor: '#E2E8F0',
    minHeight: 20,
    borderRadius: 1.25,
  },
  stepConnectorComplete: {
    backgroundColor: BRAND.success + '40',
  },

  // Step Content
  stepContent: {
    flex: 1,
    backgroundColor: BRAND.white,
    borderRadius: 18,
    padding: 16,
    marginLeft: 10,
    marginBottom: 10,
    ...CARD_SHADOW_LIGHT,
  },
  stepContentComplete: {
    borderWidth: 1,
    borderColor: BRAND.success + '20',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.textPrimary,
    flex: 1,
  },
  stepTitleComplete: {
    color: BRAND.success,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepDescription: {
    fontSize: 13,
    color: BRAND.muted,
    lineHeight: 18,
    marginBottom: 6,
    marginLeft: 44,
  },
  stepDetails: {
    fontSize: 12,
    color: BRAND.muted,
    fontStyle: 'italic',
    marginBottom: 4,
    marginLeft: 44,
  },
  stepWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 6,
    marginLeft: 44,
    gap: 6,
  },
  stepWarningText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  stepVerifiedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
    marginLeft: 44,
  },
  stepVerifiedInfoText: {
    fontSize: 12,
    color: BRAND.success,
    fontWeight: '600',
  },
  stepLockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    marginBottom: 6,
    marginLeft: 44,
  },
  stepLockInfoText: {
    fontSize: 11,
    color: BRAND.muted,
    fontStyle: 'italic',
  },
  stepActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    marginLeft: 44,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: BRAND.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  stepActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.white,
  },

  // ─── Capability Card ───────────────────────────────────────
  capabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...CARD_SHADOW_LIGHT,
  },
  capabilityCardEnabled: {
    borderWidth: 1,
    borderColor: BRAND.success + '25',
  },
  capabilityIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  capabilityContent: {
    flex: 1,
  },
  capabilityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.textPrimary,
  },
  capabilityTitleEnabled: {
    color: BRAND.success,
  },
  capabilityDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: BRAND.muted,
    marginTop: 2,
  },
  capabilityStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  // ─── Info Card ─────────────────────────────────────────────
  infoCard: {
    flexDirection: 'row',
    backgroundColor: BRAND.secondary + '08',
    borderRadius: 18,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: BRAND.secondary + '12',
  },
  infoIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: BRAND.secondary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    marginLeft: 14,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.secondary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '500',
    color: BRAND.muted,
    lineHeight: 21,
  },
});

export default VerificationDashboardScreen;
