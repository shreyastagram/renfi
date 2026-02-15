/**
 * Verification Dashboard Screen
 * 
 * Full-screen verification checklist for providers showing:
 * - 5-step verification progress (phone, email, aadhaar, service approval, premium)
 * - Search visibility capabilities
 * - Quick actions to complete each step
 * - Sync button to refresh status from Java Auth
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Icon, AadhaarVerificationModal } from '../components';
import { getVerificationDashboard, syncVerificationStatus } from '../services/verificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Brand colors - consistent with rest of app
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  background: '#faf7f7',
  white: '#FFFFFF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  gray: '#6B7280',
  grayLight: '#F3F4F6',
};

// Step configuration for icons and actions
const STEP_CONFIG = {
  phone: {
    icon: 'phone',
    actionLabel: 'Verify Phone',
    navTarget: 'Verification',
    navParams: { verificationType: 'phone' },
    description: 'Verify your phone number with OTP',
  },
  email: {
    icon: 'email',
    actionLabel: 'Verify Email',
    navTarget: 'Verification',
    navParams: { verificationType: 'email' },
    description: 'Verify your email address',
  },
  aadhaar: {
    icon: 'badge',
    actionLabel: 'Verify Aadhaar',
    navTarget: 'DocumentVerification',
    navParams: {},
    description: 'Complete Aadhaar verification via DigiLocker',
  },
  service_approval: {
    icon: 'document',
    actionLabel: 'Submit Documents',
    navTarget: 'DocumentVerification',
    navParams: {},
    description: 'Get your service categories approved',
  },
  premium: {
    icon: 'star',
    actionLabel: 'Go Premium',
    navTarget: 'Subscription',
    navParams: {},
    description: 'Subscribe to premium for visibility in search',
  },
};

/**
 * Circular progress indicator
 */
const ProgressCircle = ({ completed, total }) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = completed === total;
  
  return (
    <View style={[styles.progressCircle, isComplete && styles.progressCircleComplete]}>
      <Text style={[styles.progressPercentage, isComplete && styles.progressPercentageComplete]}>
        {percentage}%
      </Text>
      <Text style={[styles.progressLabel, isComplete && styles.progressLabelComplete]}>
        {completed}/{total}
      </Text>
    </View>
  );
};

/**
 * Verification step card
 */
const StepCard = ({ step, config, onAction, isLast }) => {
  const isCompleted = step.completed;
  const hasWarning = step.phoneChanged; // Phone changed after verification
  const statusColor = isCompleted 
    ? (hasWarning ? BRAND.warning : BRAND.success) 
    : BRAND.warning;
  
  return (
    <View style={[styles.stepCard, !isLast && styles.stepCardWithConnector]}>
      {/* Step indicator */}
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
      
      {/* Step content */}
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Text style={[styles.stepTitle, isCompleted && !hasWarning && styles.stepTitleComplete]}>
            {step.label}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {hasWarning ? 'Re-verify' : isCompleted ? 'Completed' : 'Pending'}
            </Text>
          </View>
        </View>
        
        <Text style={styles.stepDescription}>
          {step.description || config.description}
        </Text>
        
        {/* Phone changed warning */}
        {step.phoneChanged && (
          <View style={styles.stepWarning}>
            <Icon name="warning" size={12} color="#92400E" />
            <Text style={styles.stepWarningText}>
              Phone number changed — re-verify your new number
            </Text>
          </View>
        )}
        
        {/* Aadhaar name + lock info */}
        {step.id === 'aadhaar' && step.completed && step.aadhaarName && (
          <View style={styles.stepVerifiedInfo}>
            <Icon name="verified_user" size={12} color={BRAND.success} />
            <Text style={styles.stepVerifiedInfoText}>
              Verified as: {step.aadhaarName}
            </Text>
          </View>
        )}
        {step.id === 'aadhaar' && step.isNameLocked && (
          <View style={styles.stepLockInfo}>
            <Icon name="lock" size={11} color="#6B7280" />
            <Text style={styles.stepLockInfoText}>
              Name locked after verification
            </Text>
          </View>
        )}
        
        {/* Contextual details based on step type */}
        {step.id === 'service_approval' && step.approvedServices?.length > 0 && (
          <Text style={styles.stepDetails}>
            Approved: {step.approvedServices.join(', ')}
          </Text>
        )}
        {step.id === 'service_approval' && step.pendingServices?.length > 0 && (
          <Text style={styles.stepDetails}>
            Pending: {step.pendingServices.join(', ')}
          </Text>
        )}
        {step.id === 'premium' && step.completed && step.daysRemaining > 0 && (
          <Text style={styles.stepDetails}>
            {step.daysRemaining} day{step.daysRemaining !== 1 ? 's' : ''} remaining
          </Text>
        )}
        {step.id === 'premium' && !step.completed && (
          <Text style={styles.stepDetails}>
            ₹299 for 28 days • Not required for Snake Catcher, Ambulance, Mortuary Van
          </Text>
        )}
        {step.id === 'aadhaar' && step.completed && step.verifiedAt && !step.aadhaarName && (
          <Text style={styles.stepDetails}>
            Verified on {new Date(step.verifiedAt).toLocaleDateString('en-IN')}
          </Text>
        )}
        
        {/* Action button for incomplete steps or phone re-verify */}
        {(!isCompleted || step.phoneChanged) && (
          <TouchableOpacity
            style={styles.stepAction}
            onPress={() => onAction(step.id, config)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepActionText}>
              {step.phoneChanged ? 'Re-verify Phone' : config.actionLabel}
            </Text>
            <Icon name="chevron-right" size={16} color={BRAND.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/**
 * Capability card showing search visibility
 */
const CapabilityCard = ({ iconName, title, enabled, description }) => (
  <View style={[styles.capabilityCard, enabled && styles.capabilityCardEnabled]}>
    <View style={[styles.capabilityIcon, { backgroundColor: enabled ? BRAND.success + '15' : '#F3F4F6' }]}>
      <Icon name={iconName} size={20} color={enabled ? BRAND.success : '#9CA3AF'} />
    </View>
    <View style={styles.capabilityContent}>
      <Text style={[styles.capabilityTitle, enabled && styles.capabilityTitleEnabled]}>
        {title}
      </Text>
      <Text style={styles.capabilityDescription}>{description}</Text>
    </View>
    <View style={[styles.capabilityStatus, { backgroundColor: enabled ? BRAND.success + '15' : '#FEF2F2' }]}>
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
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [showAadhaarModal, setShowAadhaarModal] = useState(false);
  
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
        setError(result.error?.message || 'Failed to load verification status');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
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
    
    setSyncing(true);
    try {
      const result = await syncVerificationStatus(providerId);
      
      if (result.success) {
        setDashboard(result.data);
        // Also refresh the global profile context
        if (refreshProfile) {
          refreshProfile();
        }
        Alert.alert('Synced', 'Verification status updated successfully.');
      } else {
        Alert.alert('Sync Failed', result.error?.message || 'Could not sync verification status.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to sync. Please check your connection.');
    } finally {
      setSyncing(false);
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
  
  // Loading state
  if (loading && !dashboard) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={BRAND.primary} />
        <Text style={styles.loadingText}>Loading verification status...</Text>
      </View>
    );
  }
  
  // Error state
  if (error && !dashboard) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Icon name="error" size={48} color={BRAND.danger} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchDashboard()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow_back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification Status</Text>
        <TouchableOpacity 
          style={styles.syncButton} 
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={BRAND.primary} />
          ) : (
            <Icon name="refresh" size={22} color={BRAND.primary} />
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Overview Card */}
        <View style={[styles.overviewCard, isFullyVerified && styles.overviewCardComplete]}>
          <View style={styles.overviewContent}>
            <ProgressCircle completed={completedSteps} total={totalSteps} />
            <View style={styles.overviewText}>
              <Text style={styles.overviewTitle}>
                {isFullyVerified 
                  ? '🎉 Fully Verified!' 
                  : `${totalSteps - completedSteps} step${totalSteps - completedSteps !== 1 ? 's' : ''} remaining`
                }
              </Text>
              <Text style={styles.overviewSubtitle}>
                {isFullyVerified
                  ? 'You are visible in all search results'
                  : 'Complete all steps to appear in customer searches'
                }
              </Text>
            </View>
          </View>
          
          {/* Premium status indicator */}
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Icon name="star" size={14} color="#F59E0B" />
              <Text style={styles.premiumBadgeText}>Premium Active</Text>
            </View>
          )}
        </View>
        
        {/* Verification Steps */}
        <Text style={styles.sectionTitle}>Verification Checklist</Text>
        <View style={styles.stepsContainer}>
          {steps.map((step, index) => {
            const config = STEP_CONFIG[step.id] || {
              icon: 'check-circle',
              actionLabel: 'Complete',
              description: step.label,
            };
            
            return (
              <StepCard
                key={step.id}
                step={step}
                config={config}
                onAction={handleStepAction}
                isLast={index === steps.length - 1}
              />
            );
          })}
        </View>
        
        {/* Search Visibility Section */}
        <Text style={styles.sectionTitle}>Search Visibility</Text>
        <Text style={styles.sectionSubtitle}>
          Where customers can find you based on your verification status
        </Text>
        
        <CapabilityCard
          iconName="build"
          title="Traditional Services"
          enabled={capabilities.canAppearInTraditionalSearch}
          description="Electrician, Plumber, Carpenter, etc."
        />
        
        <CapabilityCard
          iconName="camera"
          title="Event Services"
          enabled={capabilities.canAppearInEventSearch}
          description="Photographer, Influencer, etc."
        />
        
        {/* Only show Emergency capability if provider has emergency categories */}
        {capabilities.hasEmergencyCategory && (
          <CapabilityCard
            iconName="notification"
            title="Emergency Services"
            enabled={capabilities.canAppearInEmergencySearch}
            description="Snake Catcher, Ambulance, Mortuary Van (Free · 24/7)"
          />
        )}
        
        {/* Info note */}
        <View style={styles.infoCard}>
          <Icon name="info" size={20} color={BRAND.secondary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>How Verification Works</Text>
            <Text style={styles.infoText}>
              • Phone & email verification ensures your identity{'\n'}
              • Aadhaar verification is mandatory for all providers{'\n'}
              • Service approval is granted after document review{'\n'}
              • Premium subscription is required for Traditional & Event services{'\n'}
              • Emergency services (Snake Catcher, Ambulance, Mortuary Van) are free — no premium needed{'\n'}
              • Emergency Hours toggle (in Settings) lets you be searchable during 12 AM – 6 AM
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
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: BRAND.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  syncButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  
  // Loading & Error
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: BRAND.gray,
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    color: BRAND.danger,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Overview Card
  overviewCard: {
    backgroundColor: BRAND.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  overviewCardComplete: {
    borderColor: BRAND.success + '40',
    backgroundColor: BRAND.success + '05',
  },
  overviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewText: {
    flex: 1,
    marginLeft: 16,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  overviewSubtitle: {
    fontSize: 13,
    color: BRAND.gray,
    lineHeight: 18,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
    gap: 4,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  
  // Progress Circle
  progressCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BRAND.primary + '10',
    borderWidth: 3,
    borderColor: BRAND.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleComplete: {
    backgroundColor: BRAND.success + '10',
    borderColor: BRAND.success + '30',
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
    color: BRAND.gray,
    marginTop: -2,
  },
  progressLabelComplete: {
    color: BRAND.success,
  },
  
  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: BRAND.gray,
    marginBottom: 12,
  },
  
  // Steps Container
  stepsContainer: {
    marginBottom: 24,
    marginTop: 8,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  stepConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    minHeight: 20,
  },
  stepConnectorComplete: {
    backgroundColor: BRAND.success + '40',
  },
  
  // Step Content
  stepContent: {
    flex: 1,
    backgroundColor: BRAND.white,
    borderRadius: 12,
    padding: 14,
    marginLeft: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  stepTitleComplete: {
    color: BRAND.success,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stepDescription: {
    fontSize: 12,
    color: BRAND.gray,
    lineHeight: 16,
    marginBottom: 4,
  },
  stepDetails: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  stepWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 4,
    gap: 6,
  },
  stepWarningText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
  },
  stepVerifiedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  stepVerifiedInfoText: {
    fontSize: 11,
    color: BRAND.success,
    fontWeight: '500',
  },
  stepLockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  stepLockInfoText: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  stepAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 4,
  },
  stepActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.primary,
    marginRight: 4,
  },
  
  // Capability Card
  capabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  capabilityCardEnabled: {
    borderColor: BRAND.success + '30',
    backgroundColor: BRAND.success + '03',
  },
  capabilityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  capabilityContent: {
    flex: 1,
  },
  capabilityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  capabilityTitleEnabled: {
    color: BRAND.success,
  },
  capabilityDescription: {
    fontSize: 12,
    color: BRAND.gray,
    marginTop: 2,
  },
  capabilityStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  
  // Info Card
  infoCard: {
    flexDirection: 'row',
    backgroundColor: BRAND.secondary + '08',
    borderRadius: 12,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: BRAND.secondary + '15',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.secondary,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: BRAND.gray,
    lineHeight: 20,
  },
});

export default VerificationDashboardScreen;
