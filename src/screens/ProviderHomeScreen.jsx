/**
 * Provider Home Screen
 * 
 * Dashboard for providers with:
 * - Stats overview
 * - Incoming requests
 * - Availability toggle
 * - Quick navigation
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  RefreshControl,
  Switch,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import { Icon, FixhomiLogo } from '../components';
import { 
  initializeSocket, 
  disconnectSocket, 
  startLocationTracking, 
  stopLocationTracking,
  isConnected,
  addEventListener,
} from '../services/socketService';
import { getProviderRequests } from '../services/traditionalServiceService';
import { getVerificationDashboard } from '../services/verificationService';
import { NODE_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Brand colors
const BRAND = {
  primary: '#f67c16', // Orange
  secondary: '#2b76bc', // Blue
  background: '#faf7f7',
  white: '#FFFFFF',
};

// Service category labels
const SERVICE_LABELS = {
  electrician: 'Electrician',
  plumber: 'Plumber',
  carpenter: 'Carpenter',
  painter: 'Painter',
  welder: 'Welder',
  electronics_technician: 'Electronics Technician',
  solar_repairing: 'Solar Installer',
  salon: 'Salon',
  driver: 'Driver',
  mason_tiler: 'Mason & Tiler',
  influencer: 'Influencer',
  vehicle_cleaning: 'Vehicle Cleaning',
  snake_catcher: 'Snake Catcher',
  ambulance_services: 'Ambulance',
  fire_brigade: 'Fire Brigade',
  mortuary_van: 'Mortuary Van',
  photographer: 'Photographer',
  ac_repair: 'AC Repair',
  cleaning: 'Cleaning',
};

/**
 * Format service name - removes underscores and capitalizes
 */
const formatServiceName = (service) => {
  if (SERVICE_LABELS[service]) return SERVICE_LABELS[service];
  return service
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Stats Card Component
 */
const StatsCard = ({ iconName, value, label, color, bgColor }) => (
  <View style={[styles.statsCard, { backgroundColor: bgColor }]}>
    <Icon name={iconName} size={24} color={color} />
    <Text style={[styles.statsValue, { color }]}>{value}</Text>
    <Text style={styles.statsLabel}>{label}</Text>
  </View>
);

/**
 * Quick Action Card
 */
const ActionCard = ({ iconName, title, subtitle, onPress, color }) => (
  <TouchableOpacity
    style={[styles.actionCard, { borderLeftColor: color }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.actionIconContainer, { backgroundColor: `${color}15` }]}>
      <Icon name={iconName} size={24} color={color} />
    </View>
    <View style={styles.actionTextContainer}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </View>
    <Icon name="chevron-right" size={20} color="#9CA3AF" />
  </TouchableOpacity>
);

/**
 * Verification Status Card — shows progress on ProviderHomeScreen
 */
const VerificationStatusCard = ({ dashboard, onPress }) => {
  if (!dashboard) return null;

  const steps = dashboard.steps || [];
  const completed = steps.filter(s => s.completed).length;
  const total = steps.length;
  const isFullyVerified = dashboard.isFullyVerified;
  const isPremium = dashboard.isPremiumActive || false;
  const premiumStep = steps.find(s => s.id === 'premium');
  const daysRemaining = premiumStep?.daysRemaining || 0;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Identity steps = all except premium (phone, email, aadhaar, service_approval)
  const identitySteps = steps.filter(s => s.id !== 'premium');
  const identityCompleted = identitySteps.filter(s => s.completed).length;
  const identityTotal = identitySteps.length;
  const identityDone = identityCompleted === identityTotal && identityTotal > 0;

  // Check if provider has emergency service categories
  const capabilities = dashboard.capabilities || {};
  const hasEmergencyCategory = capabilities.hasEmergencyCategory || false;

  // Fully ready = identity verified AND (premium active OR has emergency category)
  const isFullyReady = identityDone && isPremium;

  // Determine card color and messaging based on actual search visibility
  const cardBg = isFullyReady ? '#ECFDF5' : identityDone ? (hasEmergencyCategory ? '#EFF6FF' : '#FFF7ED') : '#FFF7ED';
  const cardBorder = isFullyReady ? '#10B98130' : identityDone ? (hasEmergencyCategory ? BRAND.secondary + '30' : BRAND.primary + '30') : BRAND.primary + '30';
  const accentColor = isFullyReady ? '#10B981' : identityDone ? (hasEmergencyCategory ? BRAND.secondary : BRAND.primary) : BRAND.primary;

  // Build title and subtitle based on actual status
  let title, subtitle;
  if (isFullyReady) {
    title = '✅ Fully Verified & Active';
    subtitle = `Premium active · ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining · Visible in all searches`;
  } else if (identityDone && !isPremium && hasEmergencyCategory) {
    title = `✅ Identity Verified · ${percentage}%`;
    subtitle = '🆓 Visible in Emergency searches (free) · Subscribe to Premium for Traditional & Event';
  } else if (identityDone && !isPremium) {
    title = `✅ Identity Verified · ${percentage}%`;
    subtitle = '⚠️ Not visible in searches · Subscribe to Premium to appear in results';
  } else {
    title = `Verification: ${completed}/${total} complete`;
    subtitle = 'Complete all steps to appear in customer searches';
  }

  return (
    <TouchableOpacity 
      style={[styles.verificationCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.verificationCardContent}>
        {/* Progress indicator */}
        <View style={[styles.verificationProgress, { borderColor: accentColor + '40' }]}>
          <Text style={[styles.verificationPercent, { color: accentColor }]}>
            {percentage}%
          </Text>
        </View>

        <View style={styles.verificationTextContent}>
          <Text style={styles.verificationCardTitle}>
            {title}
          </Text>
          <Text style={[styles.verificationCardSubtitle, identityDone && !isPremium && hasEmergencyCategory && { color: BRAND.secondary }, identityDone && !isPremium && !hasEmergencyCategory && { color: BRAND.primary }]}>
            {subtitle}
          </Text>
        </View>

        <Icon name="chevron-right" size={20} color={accentColor} />
      </View>

      {/* Mini step indicators */}
      <View style={styles.verificationStepDots}>
        {steps.map((step, i) => (
          <View
            key={step.id}
            style={[
              styles.verificationDot,
              step.completed ? styles.verificationDotComplete : styles.verificationDotPending,
              step.id === 'premium' && !step.completed && identityDone && styles.verificationDotPremium,
            ]}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
};

/**
 * Provider Home Screen Component
 */
const ProviderHomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, logout, updateProviderAvailability } = useApp();

  // State - derive from profile/user for single source of truth
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    earnings: 0,
    rating: 0,
  });
  const [verificationDashboard, setVerificationDashboard] = useState(null);

  // Combined user data - single source of truth for availability
  const displayData = { ...user, ...profile };
  const isAvailable = displayData?.isAvailable ?? displayData?.isOnline ?? true;

  /**
   * Fetch provider stats from API - includes traditional and event services
   */
  const fetchStats = useCallback(async () => {
    const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    if (!providerId) return;

    try {
      // Fetch traditional, event, and emergency services in parallel
      const [traditionalResult, eventResult, emergencyResult] = await Promise.all([
        getProviderRequests(providerId, { limit: 500 }),
        fetch(`${NODE_BASE_URL}/api/event-services/provider/${providerId}`)
          .then(r => r.json())
          .catch(() => ({ data: [] })),
        fetch(`${NODE_BASE_URL}/api/emergency-services/provider/${providerId}`)
          .then(r => r.json())
          .catch(() => ({ requests: [] }))
      ]);
      
      // Combine all requests from all three categories
      const traditionalRequests = traditionalResult.success && Array.isArray(traditionalResult.requests) 
        ? traditionalResult.requests : [];
      const eventRequests = Array.isArray(eventResult.data) ? eventResult.data : [];
      const emergencyRequests = Array.isArray(emergencyResult.requests) ? emergencyResult.requests 
        : Array.isArray(emergencyResult.data) ? emergencyResult.data : [];
      const allRequests = [...traditionalRequests, ...eventRequests, ...emergencyRequests];
      
      const pendingCount = allRequests.filter(r => 
        r.status === 'pending' || r.status === 'accepted'
      ).length;
      const completedCount = allRequests.filter(r => r.status === 'completed').length;
      const rating = user?.rating || profile?.rating || 0;

      setStats({
        pending: pendingCount,
        completed: completedCount,
        earnings: 0, // Will be implemented with earnings API
        rating: rating,
      });
    } catch (error) {
      console.error('[ProviderHome] Error fetching stats:', error);
      // Fallback to profile data
      setStats({
        pending: 0,
        completed: 0,
        earnings: 0,
        rating: user?.rating || profile?.rating || 0,
      });
    }
  }, [user?.mongoId, profile?.mongoId, user?._id, profile?._id, user?.rating, profile?.rating]);

  /**
   * Fetch verification dashboard data
   */
  const fetchVerificationData = useCallback(async () => {
    const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    if (!providerId) return;

    try {
      const result = await getVerificationDashboard(providerId);
      if (result.success) {
        setVerificationDashboard(result.data);
      }
    } catch (error) {
      console.log('[ProviderHome] Verification dashboard fetch error:', error.message);
    }
  }, [user?.mongoId, profile?.mongoId, user?._id, profile?._id]);

  /**
   * Handle refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchVerificationData()]);
    setRefreshing(false);
  };

  /**
   * Handle availability toggle - uses centralized state management
   */
  const handleAvailabilityToggle = async (value) => {
    if (isUpdatingAvailability) return; // Prevent double-tap
    
    setIsUpdatingAvailability(true);
    
    try {
      const result = await updateProviderAvailability(value);
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to update availability');
      } else {
        // Start/stop location tracking based on availability
        const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
        if (value && providerId) {
          startLocationTracking(providerId);
        } else {
          stopLocationTracking();
        }
      }
    } catch (error) {
      console.error('Failed to update availability:', error);
      Alert.alert('Error', 'Failed to update availability. Please try again.');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    // Stop location tracking and disconnect socket
    stopLocationTracking();
    disconnectSocket();
    await logout();
  };

  // Initialize socket and location tracking
  useEffect(() => {
    const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    // Use the persisted setting from profile
    const locationTrackingEnabled = displayData?.locationTracking?.enabled === true;
    // Check if provider has valid location set (null lat/lng = never reported)
    const hasLocation = displayData?.location?.latitude != null && displayData?.location?.longitude != null;
    
    if (providerId) {
      // Initialize socket connection — fetch token from secure storage
      // (accessToken is NOT stored in the user state object, only in AsyncStorage)
      const initSocket = async () => {
        try {
          const tokens = await getTokens();
          if (tokens?.accessToken) {
            console.log('🔌 [ProviderHome] Initializing socket for provider:', providerId);
            initializeSocket('provider', providerId, tokens.accessToken);
          } else {
            console.warn('⚠️ [ProviderHome] No access token available — socket NOT initialized');
          }
        } catch (err) {
          console.error('❌ [ProviderHome] Failed to get token for socket:', err.message);
        }
      };
      initSocket();
      
      // Start location tracking if:
      // 1. Explicitly enabled in settings, OR
      // 2. Provider has NO location yet (first time — must report location to appear in searches)
      if (locationTrackingEnabled || !hasLocation) {
        if (!hasLocation) {
          console.log('📍 [ProviderHome] No location set yet — auto-starting tracking so provider appears in searches');
        } else {
          console.log('📍 [ProviderHome] Starting location tracking (enabled in settings)');
        }
        startLocationTracking(providerId);
      } else {
        console.log('📍 [ProviderHome] Location tracking not enabled in settings');
        // Don't call stopLocationTracking here on initial mount - only on explicit toggle off
      }
    }
    
    // Cleanup on unmount
    return () => {
      stopLocationTracking();
    };
  }, [user?.mongoId, profile?.mongoId, user?._id, profile?._id, displayData?.locationTracking?.enabled, displayData?.location?.latitude]);

  // Listen for socket events so provider's dashboard refreshes in real-time
  useEffect(() => {
    // When a new request arrives, refresh stats so pending count updates
    const removeNewReq = addEventListener('new:request', () => {
      console.log('📦 [ProviderHome] Socket: new:request — refreshing stats');
      fetchStats();
    });

    // When a request is accepted/completed/cancelled, refresh stats
    const removeAccepted = addEventListener('request:accepted', () => {
      console.log('✅ [ProviderHome] Socket: request:accepted — refreshing stats');
      fetchStats();
    });
    const removeCompleted = addEventListener('request:completed', () => {
      console.log('🎉 [ProviderHome] Socket: request:completed — refreshing stats');
      fetchStats();
    });
    const removeCancelled = addEventListener('request:cancelled', () => {
      console.log('❌ [ProviderHome] Socket: request:cancelled — refreshing stats');
      fetchStats();
    });

    return () => {
      removeNewReq();
      removeAccepted();
      removeCompleted();
      removeCancelled();
    };
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
    fetchVerificationData();
  }, [fetchStats, fetchVerificationData]);

  // Refresh verification data when screen regains focus (e.g., returning from Subscription/VerificationDashboard)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchVerificationData();
    });
    return unsubscribe;
  }, [navigation, fetchVerificationData]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <MenuButton onPress={() => setIsDrawerOpen(true)} />
          
          <View style={styles.headerContent}>
            <View style={styles.brandRow}>
              <FixhomiLogo size={24} color={BRAND.primary} />
              <Text style={styles.brandName}>FixHomi</Text>
            </View>
            <Text style={styles.greeting}>Hello, {displayData?.fullName?.split(' ')[0] || 'Provider'}</Text>
          </View>

          <AvatarButton 
            name={displayData?.fullName} 
            profilePicture={displayData?.profilePicture}
            onPress={() => navigation.navigate('Profile')}
            isProvider={true}
          />
        </View>

        {/* Availability Toggle */}
        <View style={styles.availabilityCard}>
          <View style={styles.availabilityContent}>
            <View style={[styles.availabilityDot, isAvailable && styles.availabilityDotOnline]} />
            <View>
              <Text style={styles.availabilityTitle}>
                {isAvailable ? 'You\'re Online' : 'You\'re Offline'}
              </Text>
              <Text style={styles.availabilitySubtitle}>
                {isAvailable ? 'Customers can see you' : 'Go online to receive requests'}
              </Text>
            </View>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={handleAvailabilityToggle}
            trackColor={{ false: '#E5E7EB', true: BRAND.primary + '50' }}
            thumbColor={isAvailable ? BRAND.primary : '#9CA3AF'}
            disabled={isUpdatingAvailability}
          />
        </View>

        {/* Verification Status Card */}
        <VerificationStatusCard
          dashboard={verificationDashboard}
          onPress={() => navigation.navigate('VerificationDashboard')}
        />

        {/* Stats Grid - Unified Brand Colors */}
        <View style={styles.statsGrid}>
          <StatsCard
            iconName="clipboard-list"
            value={stats.pending}
            label="Pending"
            color={BRAND.primary}
            bgColor="#FFF7ED"
          />
          <StatsCard
            iconName="check-circle"
            value={stats.completed}
            label="Completed"
            color={BRAND.secondary}
            bgColor="#EFF6FF"
          />
          <StatsCard
            iconName="star"
            value={stats.rating.toFixed(1)}
            label="Rating"
            color={BRAND.primary}
            bgColor="#FFF7ED"
          />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <ActionCard
          iconName="clipboard-list"
          title="My Jobs"
          subtitle="View requests, active jobs & history"
          onPress={() => navigation.navigate('ProviderJobs')}
          color={BRAND.secondary}
        />

        {/* Service Categories - Only show verified services */}
        <Text style={styles.sectionTitle}>Your Services</Text>
        <View style={styles.servicesContainer}>
          {/* Show Verified Services */}
          {(displayData?.verifiedServiceCategories?.length > 0) && (
            displayData.verifiedServiceCategories.map((cat, index) => (
              <View key={`verified-${index}`} style={styles.serviceTag}>
                <Icon name="verified" size={12} color={BRAND.secondary} />
                <Text style={styles.serviceTagText}>{formatServiceName(cat)}</Text>
              </View>
            ))
          )}
          {/* Show Pending Services (in serviceCategories but not in verifiedServiceCategories) */}
          {(displayData?.serviceCategories?.length > 0) && (
            displayData.serviceCategories
              .filter(cat => !(displayData?.verifiedServiceCategories || []).includes(cat))
              .map((cat, index) => (
                <View key={`pending-${index}`} style={[styles.serviceTag, styles.serviceTagPending]}>
                  <Icon name="clock" size={12} color={BRAND.primary} />
                  <Text style={[styles.serviceTagText, styles.serviceTagTextPending]}>{formatServiceName(cat)}</Text>
                  <Text style={styles.pendingBadge}>Pending</Text>
                </View>
              ))
          )}
          {/* Show Add Services button only if no services at all */}
          {(!displayData?.verifiedServiceCategories?.length && !displayData?.serviceCategories?.length) && (
            <TouchableOpacity 
              style={styles.noServicesCard}
              onPress={() => navigation.navigate('DocumentVerification')}
              activeOpacity={0.8}
            >
              <Icon name="add-circle" size={20} color={BRAND.primary} />
              <Text style={styles.noServicesText}>Get verified for services</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tips Section */}
        <View style={styles.tipsCard}>
          <Icon name="lightbulb" size={24} color="#F59E0B" />
          <View style={styles.tipsContent}>
            <Text style={styles.tipsTitle}>Pro Tip</Text>
            <Text style={styles.tipsText}>
              Stay online during peak hours (9 AM - 6 PM) to receive more requests!
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Drawer Menu */}
      <DrawerMenu
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={displayData}
        userType="provider"
        navigation={navigation}
        onLogout={handleLogout}
        isVerified={displayData?.isPhoneVerified && displayData?.isEmailVerified}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  headerContent: {
    flex: 1,
    marginLeft: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  brandName: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.primary,
    letterSpacing: 0.5,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  subGreeting: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#FEF3C7',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F59E0B',
  },

  // Availability Card
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BRAND.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  availabilityContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#9CA3AF',
    marginRight: 12,
  },
  availabilityDotOnline: {
    backgroundColor: BRAND.primary,
  },
  availabilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  availabilitySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // Verification Status Card
  verificationCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
  },
  verificationCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationProgress: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    marginRight: 12,
  },
  verificationPercent: {
    fontSize: 14,
    fontWeight: '800',
  },
  verificationTextContent: {
    flex: 1,
  },
  verificationCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  verificationCardSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  verificationStepDots: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 6,
  },
  verificationDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  verificationDotComplete: {
    backgroundColor: '#10B981',
  },
  verificationDotPending: {
    backgroundColor: '#E5E7EB',
  },
  verificationDotPremium: {
    backgroundColor: BRAND.secondary + '60',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statsCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  statsIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statsLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  // Section Title
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },

  // Action Cards
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 20,
    color: '#9CA3AF',
  },

  // Services Container
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.secondary + '30',
  },
  serviceTagPending: {
    backgroundColor: '#FFF7ED',
    borderColor: BRAND.primary + '30',
  },
  serviceTagText: {
    fontSize: 12,
    color: BRAND.secondary,
    fontWeight: '600',
  },
  serviceTagTextPending: {
    color: BRAND.primary,
  },
  pendingBadge: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '700',
    backgroundColor: BRAND.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  noServicesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.primary + '40',
    borderStyle: 'dashed',
  },
  noServicesText: {
    fontSize: 13,
    color: BRAND.primary,
    fontWeight: '600',
  },

  // Tips Card
  tipsCard: {
    flexDirection: 'row',
    backgroundColor: BRAND.primary + '10',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BRAND.primary + '20',
  },
  tipsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.primary,
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },

  // Drawer styles (same as UserHomeScreen)
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: '#FFFFFF',
  },
  drawerHeader: {
    padding: 24,
    paddingTop: 20,
  },
  drawerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  drawerAvatarText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  drawerUserName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  drawerUserEmail: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  drawerUserBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  drawerUserBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  drawerContent: {
    flex: 1,
    paddingTop: 16,
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  drawerMenuIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  drawerMenuLabel: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  drawerMenuDanger: {
    color: '#EF4444',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
    marginHorizontal: 24,
  },
  drawerVersion: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingBottom: 24,
  },
});

export default ProviderHomeScreen;
