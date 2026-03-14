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

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ActivityIndicator,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';

const FIXHOMI_LOGO = require('../assets/fixhomi_logo.jpg');
import { Icon } from '../components';
import { useShimmerAnimation, ShimmerBlock } from '../components/ShimmerLoader';
import {
  initializeSocket,
  disconnectSocket,
  startLocationTracking,
  stopLocationTracking,
  addEventListener,
} from '../services/socketService';
import { getProviderRequests } from '../services/traditionalServiceService';
import { getVerificationDashboard } from '../services/verificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NODE_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';
import authFetch from '../utils/authFetch';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Brand colors
const BRAND = {
  primary: '#f67c16', // Orange
  secondary: '#2b76bc', // Blue
  background: '#F1F5F9',
  white: '#FFFFFF',
  dark: '#0F172A',
  muted: '#94A3B8',
  darkText: '#0F172A',
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
 * Reusable press animation hook
 */
const usePressAnimation = () => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return { scaleAnim, onPressIn, onPressOut };
};

/**
 * Pulsing dot component for online status
 */
const PulsingDot = ({ isOnline }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (isOnline) {
      const pulse = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.8,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isOnline, pulseAnim, opacityAnim]);

  return (
    <View style={styles.pulsingDotContainer}>
      {isOnline && (
        <Animated.View
          style={[
            styles.pulsingRing,
            {
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
              backgroundColor: '#22C55E',
            },
          ]}
        />
      )}
      <View
        style={[
          styles.statusDotInner,
          { backgroundColor: isOnline ? '#22C55E' : '#94A3B8' },
        ]}
      />
    </View>
  );
};

/**
 * Home Screen Skeleton Loader — uses shared ShimmerLoader with Amazon-style shimmer sweep
 */
const HomeSkeletonLoader = ({ insets }) => {
  const shimmerAnim = useShimmerAnimation();
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]} scrollEnabled={false}>
        {/* Hero Header skeleton */}
        <View style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}>
          <View style={[styles.decorCircle, styles.decorCircle1]} />
          <View style={[styles.decorCircle, styles.decorCircle2]} />
          <View style={styles.headerRow}>
            <ShimmerBlock width={40} height={40} borderRadius={20} shimmerAnim={shimmerAnim} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <ShimmerBlock width={40} height={40} borderRadius={20} shimmerAnim={shimmerAnim} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </View>
          <View style={styles.heroTextBlock}>
            <ShimmerBlock width={100} height={14} borderRadius={6} shimmerAnim={shimmerAnim} style={{ backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 8 }} />
            <ShimmerBlock width={160} height={26} borderRadius={8} shimmerAnim={shimmerAnim} style={{ backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 6 }} />
            <ShimmerBlock width={200} height={12} borderRadius={6} shimmerAnim={shimmerAnim} style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          </View>
        </View>

        <View style={styles.contentArea}>
          {/* Availability card skeleton */}
          <View style={[styles.availabilityCard, { paddingVertical: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <ShimmerBlock width={14} height={14} borderRadius={7} shimmerAnim={shimmerAnim} />
              <View style={{ gap: 6 }}>
                <ShimmerBlock width={120} height={16} borderRadius={6} shimmerAnim={shimmerAnim} />
                <ShimmerBlock width={180} height={12} borderRadius={6} shimmerAnim={shimmerAnim} />
              </View>
            </View>
            <ShimmerBlock width={50} height={28} borderRadius={14} shimmerAnim={shimmerAnim} />
          </View>

          {/* Verification card skeleton */}
          <View style={{ backgroundColor: BRAND.white, borderRadius: 16, padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ShimmerBlock width={40} height={40} borderRadius={20} shimmerAnim={shimmerAnim} />
              <View style={{ gap: 6, flex: 1 }}>
                <ShimmerBlock width={140} height={14} borderRadius={6} shimmerAnim={shimmerAnim} />
                <ShimmerBlock width={100} height={12} borderRadius={6} shimmerAnim={shimmerAnim} />
              </View>
            </View>
            <ShimmerBlock width={'100%'} height={6} borderRadius={3} shimmerAnim={shimmerAnim} />
          </View>

          {/* Stats skeleton */}
          <ShimmerBlock width={80} height={12} borderRadius={6} shimmerAnim={shimmerAnim} style={{ marginTop: 20, marginBottom: 10 }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={{ flex: 1, backgroundColor: BRAND.white, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8 }}>
                <ShimmerBlock width={36} height={36} borderRadius={18} shimmerAnim={shimmerAnim} />
                <ShimmerBlock width={30} height={18} borderRadius={6} shimmerAnim={shimmerAnim} />
                <ShimmerBlock width={50} height={10} borderRadius={5} shimmerAnim={shimmerAnim} />
              </View>
            ))}
          </View>

          {/* Quick actions skeleton */}
          <ShimmerBlock width={110} height={12} borderRadius={6} shimmerAnim={shimmerAnim} style={{ marginTop: 20, marginBottom: 10 }} />
          {[1, 2, 3].map(i => (
            <View key={i} style={{ backgroundColor: BRAND.white, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <ShimmerBlock width={44} height={44} borderRadius={12} shimmerAnim={shimmerAnim} />
              <View style={{ gap: 6, flex: 1 }}>
                <ShimmerBlock width={120} height={14} borderRadius={6} shimmerAnim={shimmerAnim} />
                <ShimmerBlock width={180} height={11} borderRadius={5} shimmerAnim={shimmerAnim} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

/**
 * Stats Card Component
 */
const StatsCard = ({ iconName, value, label, color, bgColor }) => {
  const { scaleAnim, onPressIn, onPressOut } = usePressAnimation();

  return (
    <Animated.View style={[styles.statsCard, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.statsCardInner}
      >
        <View style={[styles.statsIconCircle, { backgroundColor: bgColor }]}>
          <Icon name={iconName} size={20} color={color} />
        </View>
        <Text style={[styles.statsValue, { color: BRAND.darkText }]}>{value}</Text>
        <Text style={styles.statsLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Quick Action Card
 */
const ActionCard = ({ iconName, title, subtitle, onPress, color }) => {
  const { scaleAnim, onPressIn, onPressOut } = usePressAnimation();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.actionCard}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={[styles.actionIconContainer, { backgroundColor: `${color}18` }]}>
          <Icon name={iconName} size={22} color={color} />
        </View>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.actionArrowCircle}>
          <Icon name="chevron-right" size={16} color={BRAND.muted} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Verification Status Card -- shows progress on ProviderHomeScreen
 */
const VerificationStatusCard = ({ dashboard, onPress, isLoading = false, t }) => {
  const { scaleAnim, onPressIn, onPressOut } = usePressAnimation();

  // Show loading skeleton while dashboard is being fetched
  if (!dashboard) {
    if (!isLoading) return null;
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.verificationCard, { backgroundColor: '#FFF7ED', borderColor: BRAND.primary + '30' }]}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={1}
        >
          <View style={styles.verificationCardContent}>
            <View style={[styles.verificationProgress, { borderColor: BRAND.primary + '40' }]}>
              <ActivityIndicator size="small" color={BRAND.primary} />
            </View>
            <View style={styles.verificationTextContent}>
              <ShimmerBlock width={180} height={14} borderRadius={6} />
              <ShimmerBlock width={140} height={11} borderRadius={6} style={{ marginTop: 6 }} />
            </View>
            <Icon name="chevron-right" size={20} color={BRAND.primary} />
          </View>
          <View style={styles.verificationStepDots}>
            {[1, 2, 3, 4, 5].map(i => (
              <ShimmerBlock key={i} width={null} height={5} borderRadius={3} style={{ flex: 1 }} />
            ))}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

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
    title = t('providerHome.fullyVerified');
    subtitle = t('providerHome.premiumActive', { days: daysRemaining });
  } else if (identityDone && !isPremium && hasEmergencyCategory) {
    title = `Identity Verified - ${percentage}%`;
    subtitle = t('providerHome.emergencyVisible');
  } else if (identityDone && !isPremium) {
    title = `Identity Verified - ${percentage}%`;
    subtitle = t('providerHome.notVisible');
  } else {
    title = t('providerHome.verificationProgress', { completed, total });
    subtitle = t('providerHome.verificationProgressSub');
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.verificationCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={styles.verificationCardContent}>
          {/* Progress indicator */}
          <View style={[styles.verificationProgress, { borderColor: accentColor + '40' }]}>
            <Text style={[styles.verificationPercent, { color: accentColor }]}>
              {percentage}%
            </Text>
          </View>

          <View style={styles.verificationTextContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isFullyReady && (
                <View style={styles.verifiedBadgeSmall}>
                  <Icon name="check-circle" size={14} color="#10B981" />
                </View>
              )}
              <Text style={styles.verificationCardTitle}>
                {title}
              </Text>
            </View>
            <Text style={[styles.verificationCardSubtitle, identityDone && !isPremium && hasEmergencyCategory && { color: BRAND.secondary }, identityDone && !isPremium && !hasEmergencyCategory && { color: BRAND.primary }]}>
              {subtitle}
            </Text>
          </View>

          <View style={[styles.verificationArrow, { backgroundColor: accentColor + '15' }]}>
            <Icon name="chevron-right" size={18} color={accentColor} />
          </View>
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
    </Animated.View>
  );
};

/**
 * Provider Home Screen Component
 */
const ProviderHomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { user, profile, logout, updateProviderAvailability, isProfileLoading, refreshProfile, userType, setPremiumStatus } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();

  // Set status bar for dark hero header when this tab is focused
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor('transparent');
    }, [])
  );

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
  const [verificationLoading, setVerificationLoading] = useState(true);
  const verificationLastFetched = useRef(0);
  const bonusPopupShownRef = useRef(false);
  const VERIFICATION_STALE_THRESHOLD = 30000; // 30 seconds, matches profile SWR pattern

  // Combined user data - single source of truth for availability
  const displayData = { ...user, ...profile };

  // Cached availability — show last known state instantly, validate from DB
  const [cachedAvailability, setCachedAvailability] = useState(null);
  const availabilityLoadedRef = useRef(false);

  // Load cached availability from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem('provider_availability').then(val => {
      if (val !== null) setCachedAvailability(val === 'true');
    });
  }, []);

  // Once DB data loads, sync cache
  const dbAvailability = displayData?.isAvailable ?? displayData?.isOnline;
  useEffect(() => {
    if (dbAvailability !== undefined && dbAvailability !== null && !availabilityLoadedRef.current) {
      availabilityLoadedRef.current = true;
      setCachedAvailability(dbAvailability);
      AsyncStorage.setItem('provider_availability', String(dbAvailability));
    }
  }, [dbAvailability]);

  const isAvailable = cachedAvailability ?? dbAvailability ?? false;

  /**
   * Fetch provider stats from API - includes traditional and event services
   */
  const fetchStats = useCallback(async () => {
    const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    if (!providerId) return;

    try {
      // Fetch traditional, event, and emergency services in parallel
      const [traditionalResult, eventResult, emergencyResult] = await Promise.all([
        getProviderRequests(providerId, { limit: 100 }),
        authFetch(`${NODE_BASE_URL}/api/event-services/provider/${providerId}`)
          .then(r => r.json())
          .catch(() => ({ data: [] })),
        authFetch(`${NODE_BASE_URL}/api/emergency-services/provider/${providerId}`)
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
  const fetchVerificationData = useCallback(async ({ force = false } = {}) => {
    const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    if (!providerId) return;

    // SWR: Skip fetch if data is fresh (< 30s old) unless forced
    const now = Date.now();
    if (!force && verificationDashboard && (now - verificationLastFetched.current) < VERIFICATION_STALE_THRESHOLD) {
      return;
    }

    try {
      // Only show loading spinner on first load (no cached data yet)
      if (!verificationDashboard) {
        setVerificationLoading(true);
      }
      const result = await getVerificationDashboard(providerId);
      if (result.success) {
        setVerificationDashboard(result.data);
        verificationLastFetched.current = Date.now();
      }
    } catch (error) {
      console.log('[ProviderHome] Verification dashboard fetch error:', error.message);
    } finally {
      setVerificationLoading(false);
    }
  }, [user?.mongoId, profile?.mongoId, user?._id, profile?._id, verificationDashboard]);

  // Refresh profile + stats + verification when screen comes into focus
  useEffect(() => {
    if (isFocused) {
      const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
      if (providerId && userType === 'provider') {
        refreshProfile(userType, providerId);
      }
      fetchStats();
      fetchVerificationData();
    }
  }, [isFocused]);

  /**
   * Handle refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    await Promise.all([
      fetchStats(),
      fetchVerificationData({ force: true }),
      providerId ? refreshProfile(userType, providerId, { force: true }) : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  /**
   * Handle availability toggle - uses centralized state management
   */
  const handleAvailabilityToggle = async (value) => {
    if (isUpdatingAvailability) return; // Prevent double-tap

    // Optimistic update -- toggle UI immediately
    const previousValue = isAvailable;
    setCachedAvailability(value);
    AsyncStorage.setItem('provider_availability', String(value));
    updateProviderAvailability(value, true); // optimistic flag

    setIsUpdatingAvailability(true);

    try {
      const result = await updateProviderAvailability(value);

      if (!result.success) {
        // Revert optimistic update
        setCachedAvailability(previousValue);
        AsyncStorage.setItem('provider_availability', String(previousValue));
        updateProviderAvailability(previousValue, true);

        const errorMsg = result.error || 'Failed to update availability';
        const isNetworkError = /unable to connect|network|timeout|unavailable|ECONNREFUSED/i.test(errorMsg);
        const isAuthError = /not authorized|token|auth|401|403/i.test(errorMsg);

        if (isNetworkError) {
          dialog(t('providerHome.connectionIssue'), t('providerHome.connectionIssueMsg'));
        } else if (isAuthError) {
          dialog(t('providerHome.sessionExpired'), t('providerHome.sessionExpiredMsg'));
        } else {
          dialog(t('common.error'), errorMsg);
        }
      } else {
        // DB confirmed — update cache
        AsyncStorage.setItem('provider_availability', String(value));
        // Start/stop location tracking based on availability
        const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
        if (value && providerId) {
          startLocationTracking(providerId);
        } else {
          stopLocationTracking();
        }

        if (value && result.visibilityWarnings && result.visibilityWarnings.length > 0) {
          const warningText = result.visibilityWarnings.map((w, i) => `${i + 1}. ${w}`).join('\n');
          dialog(t('providerHome.profileVisibility'), t('providerHome.profileVisibilityMsg', { warnings: warningText }), [{ text: t('providerHome.gotIt') }]);
        }
      }
    } catch (error) {
      // Revert on failure
      setCachedAvailability(previousValue);
      AsyncStorage.setItem('provider_availability', String(previousValue));
      updateProviderAvailability(previousValue, true);
      console.error('Failed to update availability:', error);
      dialog(t('common.error'), t('providerHome.availabilityError'));
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
      // Initialize socket connection -- fetch token from secure storage
      // (accessToken is NOT stored in the user state object, only in AsyncStorage)
      const initSocket = async () => {
        try {
          const tokens = await getTokens();
          if (tokens?.accessToken) {
            console.log('[ProviderHome] Initializing socket for provider:', providerId);
            initializeSocket('provider', providerId, tokens.accessToken);
          } else {
            console.warn('[ProviderHome] No access token available -- socket NOT initialized');
          }
        } catch (err) {
          console.error('[ProviderHome] Failed to get token for socket:', err.message);
        }
      };
      initSocket();

      // Start location tracking if:
      // 1. Explicitly enabled in settings, OR
      // 2. Provider has NO location yet (first time -- must report location to appear in searches)
      if (locationTrackingEnabled || !hasLocation) {
        if (!hasLocation) {
          console.log('[ProviderHome] No location set yet -- auto-starting tracking so provider appears in searches');
        } else {
          console.log('[ProviderHome] Starting location tracking (enabled in settings)');
        }
        startLocationTracking(providerId);
      } else {
        console.log('[ProviderHome] Location tracking not enabled in settings');
        // Don't call stopLocationTracking here on initial mount - only on explicit toggle off
      }
    }

    // Cleanup on unmount
    return () => {
      stopLocationTracking();
    };
  }, [user?.mongoId, profile?.mongoId, user?._id, profile?._id, displayData?.locationTracking?.enabled, displayData?.location?.latitude]);

  // ─── Per-request location tracking lifecycle is now managed by
  //     LocationSharingContext (always-mounted, screen-independent).
  //     ProviderHomeScreen only listens for socket events to refresh stats. ───

  // Listen for socket events so provider's dashboard refreshes in real-time
  useEffect(() => {
    // When a new request arrives, refresh stats so pending count updates
    const removeNewReq = addEventListener('new:request', () => {
      console.log('[ProviderHome] Socket: new:request -- refreshing stats');
      fetchStats();
    });

    // When a request is accepted/completed/cancelled, refresh stats
    const removeAccepted = addEventListener('request:accepted', () => {
      console.log('[ProviderHome] Socket: request:accepted -- refreshing stats');
      fetchStats();
    });
    const removeCompleted = addEventListener('request:completed', () => {
      console.log('[ProviderHome] Socket: request:completed -- refreshing stats');
      fetchStats();
    });
    const removeCancelled = addEventListener('request:cancelled', () => {
      console.log('[ProviderHome] Socket: request:cancelled -- refreshing stats');
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

  // Retry verification data once profile finishes loading
  // This handles Google signup where MongoDB profile is auto-synced asynchronously
  useEffect(() => {
    if (!isProfileLoading && !verificationDashboard && (user?.mongoId || profile?.mongoId)) {
      console.log('[ProviderHome] Profile loaded but verification dashboard empty -- retrying...');
      fetchVerificationData();
    }
  }, [isProfileLoading, verificationDashboard, user?.mongoId, profile?.mongoId, fetchVerificationData]);

  // First Approval Bonus popup — show congratulations when firstApprovalBonusPending flag is set
  useEffect(() => {
    if (profile?.firstApprovalBonusPending !== true) return;
    if (bonusPopupShownRef.current) return;
    bonusPopupShownRef.current = true;

    dialog(
      t('providerHome.welcomePremium'),
      t('providerHome.welcomePremiumMsg'),
      [{
        text: t('providerHome.awesome'),
        onPress: async () => {
          const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
          if (!providerId) return;
          try {
            await authFetch(`${NODE_BASE_URL}/api/provider/${providerId}/clear-bonus-popup`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
            });
          } catch (err) {
            console.warn('[ProviderHome] Failed to clear bonus popup flag:', err.message);
          }
          // Update premium status in context
          setPremiumStatus({
            isPremiumActive: true,
            premiumDaysLeft: 60,
            premiumLoaded: true,
          });
          // Refresh profile so firstApprovalBonusPending becomes false in context
          // This prevents the popup from re-showing on component remount
          refreshProfile(userType, providerId, { force: true });
          fetchVerificationData({ force: true });
        },
      }]
    );
  }, [profile?.firstApprovalBonusPending]);

  const firstName = displayData?.fullName?.split(' ')[0] || 'Provider';

  // Show skeleton loader until profile data is available
  if (!profile || (isProfileLoading && !displayData?.fullName)) {
    return <HomeSkeletonLoader insets={insets} />;
  }

  return (
    <View style={styles.container}>
  

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}>
          {/* Decorative circles */}
          <View style={[styles.decorCircle, styles.decorCircle1]} />
          <View style={[styles.decorCircle, styles.decorCircle2]} />
          <View style={[styles.decorCircle, styles.decorCircle3]} />

          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setIsDrawerOpen(true)} activeOpacity={0.7} style={styles.headerLogoBtn}>
              <Image source={FIXHOMI_LOGO} style={styles.headerLogoImg} />
            </TouchableOpacity>

            <AvatarButton
              name={displayData?.fullName}
              profilePicture={displayData?.profilePicture}
              onPress={() => navigation.navigate('Profile')}
              isProvider={true}
            />
          </View>

          <View style={styles.heroTextBlock}>
            <Text style={styles.heroGreetingSmall}>{t('providerHome.welcomeBack')}</Text>
            <Text style={styles.heroName}>{firstName}</Text>
            <Text style={styles.heroSubtext}>{t('providerHome.manageServices')}</Text>
          </View>
        </View>

        {/* Content area with padding */}
        <View style={styles.contentArea}>
          {/* Availability Toggle Card */}
          <View style={[
            styles.availabilityCard,
            isAvailable && styles.availabilityCardOnline,
          ]}>
            <View style={styles.availabilityContent}>
              <PulsingDot isOnline={isAvailable} />
              <View style={styles.availabilityTextBlock}>
                <Text style={styles.availabilityTitle}>
                  {isAvailable ? t('providerHome.youreOnline') : t('providerHome.youreOffline')}
                </Text>
                <Text style={styles.availabilitySubtitle}>
                  {isAvailable ? t('providerHome.onlineSubtitle') : t('providerHome.offlineSubtitle')}
                </Text>
              </View>
            </View>
            <View style={styles.switchWrapper}>
              {isUpdatingAvailability && (
                <ActivityIndicator size="small" color={BRAND.primary} style={{ marginRight: 8 }} />
              )}
              <Switch
                value={isAvailable}
                onValueChange={handleAvailabilityToggle}
                trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                thumbColor={isAvailable ? '#22C55E' : '#94A3B8'}
                ios_backgroundColor="#CBD5E1"
              />
            </View>
          </View>

          {/* Verification Status Card */}
          <VerificationStatusCard
            dashboard={verificationDashboard}
            onPress={() => navigation.navigate('VerificationDashboard')}
            isLoading={verificationLoading || isProfileLoading}
            t={t}
          />

          {/* Stats Grid */}
          <Text style={styles.sectionTitle}>{t('providerHome.overview')}</Text>
          <View style={styles.statsGrid}>
            <StatsCard
              iconName="clipboard-list"
              value={stats.pending}
              label={t('providerHome.statsPending')}
              color={BRAND.primary}
              bgColor={BRAND.primary + '18'}
            />
            <StatsCard
              iconName="check-circle"
              value={stats.completed}
              label={t('providerHome.statsCompleted')}
              color={BRAND.secondary}
              bgColor={BRAND.secondary + '18'}
            />
            <StatsCard
              iconName="star"
              value={stats.rating.toFixed(1)}
              label={t('providerHome.statsRating')}
              color="#EAB308"
              bgColor="#EAB30818"
            />
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>{t('providerHome.quickActions')}</Text>

          <ActionCard
            iconName="clipboard-list"
            title={t('providerHome.myJobs')}
            subtitle={t('providerHome.myJobsSub')}
            onPress={() => navigation.navigate('ProviderJobs')}
            color={BRAND.secondary}
          />

          {/* Service Categories - Only show verified services */}
          <Text style={styles.sectionTitle}>{t('providerHome.yourServices')}</Text>
          <View style={styles.servicesContainer}>
            {/* Show Verified Services */}
            {(displayData?.verifiedServiceCategories?.length > 0) && (
              displayData.verifiedServiceCategories.map((cat, index) => (
                <View key={`verified-${index}`} style={styles.serviceTag}>
                  <View style={styles.serviceTagIconCircle}>
                    <Icon name="verified" size={13} color={BRAND.secondary} />
                  </View>
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
                    <View style={[styles.serviceTagIconCircle, styles.serviceTagIconCirclePending]}>
                      <Icon name="clock" size={13} color={BRAND.primary} />
                    </View>
                    <Text style={[styles.serviceTagText, styles.serviceTagTextPending]}>{formatServiceName(cat)}</Text>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>{t('providerHome.pendingBadge')}</Text>
                    </View>
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
                <View style={styles.noServicesIconCircle}>
                  <Icon name="add-circle" size={22} color={BRAND.primary} />
                </View>
                <View>
                  <Text style={styles.noServicesTitle}>{t('providerHome.getVerified')}</Text>
                  <Text style={styles.noServicesText}>{t('providerHome.getVerifiedSub')}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Tips Section */}
          <View style={styles.tipsCard}>
            {/* Decorative elements */}
            <View style={styles.tipsDecorCircle1} />
            <View style={styles.tipsDecorCircle2} />
            <View style={styles.tipsIconCircle}>
              <Icon name="lightbulb" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.tipsContent}>
              <Text style={styles.tipsBadge}>{t('providerHome.proTip')}</Text>
              <Text style={styles.tipsText}>
                {t('providerHome.proTipText')}
              </Text>
            </View>
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
        activeTab="home"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.dark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // ===== Hero Header =====
  heroHeader: {
    backgroundColor: BRAND.dark,
    paddingHorizontal: 20,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  decorCircle1: {
    width: 200,
    height: 200,
    backgroundColor: BRAND.primary + '12',
    top: -60,
    right: -40,
  },
  decorCircle2: {
    width: 140,
    height: 140,
    backgroundColor: BRAND.secondary + '10',
    bottom: -30,
    left: -30,
  },
  decorCircle3: {
    width: 80,
    height: 80,
    backgroundColor: BRAND.primary + '08',
    top: 40,
    left: SCREEN_WIDTH * 0.4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLogoBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerLogoImg: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  heroTextBlock: {
    paddingLeft: 2,
  },
  heroGreetingSmall: {
    fontSize: 14,
    fontWeight: '500',
    color: BRAND.muted,
    letterSpacing: 0.3,
  },
  heroName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  heroSubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
    letterSpacing: 0.1,
  },

  // ===== Content Area =====
  contentArea: {
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  // ===== Availability Card =====
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BRAND.white,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  availabilityCardOnline: {
    borderColor: '#22C55E20',
    backgroundColor: '#F7FEF9',
  },
  availabilityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pulsingDotContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  pulsingRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  statusDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  availabilityTextBlock: {
    flex: 1,
  },
  availabilityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.darkText,
    letterSpacing: -0.2,
  },
  availabilitySubtitle: {
    fontSize: 13,
    color: BRAND.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  switchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ===== Verification Status Card =====
  verificationCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  verificationCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationProgress: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginRight: 14,
  },
  verificationPercent: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  verificationTextContent: {
    flex: 1,
  },
  verifiedBadgeSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.darkText,
    letterSpacing: -0.2,
  },
  verificationCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 17,
    fontWeight: '500',
  },
  verificationArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationStepDots: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 6,
  },
  verificationDot: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  verificationDotComplete: {
    backgroundColor: '#10B981',
  },
  verificationDotPending: {
    backgroundColor: '#E2E8F0',
  },
  verificationDotPremium: {
    backgroundColor: BRAND.secondary + '60',
  },

  // ===== Section Title =====
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
    marginTop: 8,
  },

  // ===== Stats Grid =====
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statsCard: {
    flex: 1,
    backgroundColor: BRAND.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  statsCardInner: {
    padding: 16,
    alignItems: 'center',
  },
  statsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statsValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statsLabel: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ===== Action Cards =====
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.white,
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.darkText,
    letterSpacing: -0.2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: BRAND.muted,
    marginTop: 3,
    fontWeight: '500',
  },
  actionArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ===== Services Container =====
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.secondary + '20',
  },
  serviceTagIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BRAND.secondary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTagIconCirclePending: {
    backgroundColor: BRAND.primary + '15',
  },
  serviceTagPending: {
    backgroundColor: '#FFF7ED',
    borderColor: BRAND.primary + '20',
  },
  serviceTagText: {
    fontSize: 13,
    color: BRAND.secondary,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  serviceTagTextPending: {
    color: BRAND.primary,
  },
  pendingBadge: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 2,
  },
  pendingBadgeText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  noServicesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: BRAND.white,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: BRAND.primary + '30',
    borderStyle: 'dashed',
    width: '100%',
  },
  noServicesIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noServicesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.darkText,
    letterSpacing: -0.2,
  },
  noServicesText: {
    fontSize: 13,
    color: BRAND.muted,
    fontWeight: '500',
    marginTop: 2,
  },

  // ===== Tips Card =====
  tipsCard: {
    flexDirection: 'row',
    backgroundColor: BRAND.primary,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tipsDecorCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: -40,
    right: -20,
  },
  tipsDecorCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -20,
    left: 30,
  },
  tipsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  tipsContent: {
    flex: 1,
  },
  tipsBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // ===== Drawer styles (same as UserHomeScreen) =====
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
