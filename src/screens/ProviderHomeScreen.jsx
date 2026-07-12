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
import {  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  RefreshControl,
  Switch,
  Dimensions,
  ActivityIndicator,
  Image,
  Animated,
  Platform,
  Linking,
  InteractionManager
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import TabBarDarkZone from '../components/TabBarDarkZone';
import BrandFooter from '../components/BrandFooter';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { useLocation } from '../context/LocationContext';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Mapbox from '@rnmapbox/maps';
import useExitConfirmation from '../hooks/useExitConfirmation';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import SvgArt from '../components/SvgArt';
import LocationTrackingBanner from '../components/LocationTrackingBanner';

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
 * Casual greeting based on time of day — rotates between variants
 */
const getGreeting = (name) => {
  const hour = new Date().getHours();
  if (hour < 12) {
    const g = [`Good morning, ${name}`, `Morning, ${name}`, `Hi, ${name}`, `Hey, ${name}`];
    return g[Math.floor(Date.now() / 60000) % g.length];
  }
  if (hour < 17) {
    const g = [`Good afternoon, ${name}`, `Hi, ${name}`, `Hey, ${name}`, `Hey there, ${name}`];
    return g[Math.floor(Date.now() / 60000) % g.length];
  }
  const g = [`Good evening, ${name}`, `Hi, ${name}`, `Hey, ${name}`, `Hey there, ${name}`];
  return g[Math.floor(Date.now() / 60000) % g.length];
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
const PulsingDot = ({ isOnline, paused }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Don't run animation when screen is not focused (paused=true)
    if (isOnline && !paused) {
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
      return () => {
        pulse.stop();
        pulseAnim.setValue(1);
        opacityAnim.setValue(0.6);
      };
    }
  }, [isOnline, paused, pulseAnim, opacityAnim]);

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
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]} scrollEnabled={false}>
        {/* Hero Header skeleton */}
        <View style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}>
          <SvgArt color="rgba(255,255,255,1)" height={110} />
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
const StatsCard = ({ iconName, value, label, color, bgColor, materialIconName }) => {
  const { scaleAnim, onPressIn, onPressOut } = usePressAnimation();

  return (
    <Animated.View style={[styles.statsCard, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.statsCardInner}
      >
        <View style={styles.statsTopRow}>
          <View style={[styles.statsIconCircle, { backgroundColor: bgColor }]}>
            {materialIconName ? (
              <MaterialIcon name={materialIconName} size={16} color={color} />
            ) : (
              <Icon name={iconName} size={16} color={color} />
            )}
          </View>
          <Text style={styles.statsLabel}>{label}</Text>
        </View>
        <Text style={[styles.statsValue, { color: BRAND.darkText }]}>{value}</Text>
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
 * Animated Online/Offline toggle pad.
 * Scale bounce on press, instant color swap.
 */
const StatusTogglePad = ({ isAvailable, isUpdating, onToggle, paused }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (isUpdating) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isUpdating}
      activeOpacity={1}
      accessibilityLabel={isAvailable ? 'Go offline' : 'Go online'}
      accessibilityRole="switch"
      accessibilityState={{ checked: isAvailable }}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          styles.statusPad,
          {
            backgroundColor: isAvailable ? '#22C55E' : '#FFFFFF',
            borderColor: isAvailable ? '#16A34A' : '#E2E8F0',
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {isUpdating ? (
          <ActivityIndicator size="small" color={isAvailable ? '#FFFFFF' : '#94A3B8'} />
        ) : (
          <>
            <PulsingDot isOnline={isAvailable} paused={paused} />
            <Text style={[
              styles.statusPadText,
              { color: isAvailable ? '#FFFFFF' : '#94A3B8' },
            ]}>
              {isAvailable ? 'Online' : 'Offline'}
            </Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
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
  const { currentLocation: providerLocation, locationAddress, displayAddress, locationStatus } = useLocation();

  // Show "Exit App?" on Android back press from home screen
  useExitConfirmation();

  // Shimmer animation for inline loading states
  const shimmerAnim = useShimmerAnimation();

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
    active: 0,
    completed: 0,
    earnings: 0,
    rating: 0,
  });
  const [recentServices, setRecentServices] = useState([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const locationModalAnim = useRef(new Animated.Value(0)).current;
  const [locationModalRendered, setLocationModalRendered] = useState(false);
  const miniMapRef = useRef(null);
  const [miniMapOrigin, setMiniMapOrigin] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const openLocationModal = useCallback(() => {
    // Measure the mini card position before opening
    miniMapRef.current?.measureInWindow((x, y, w, h) => {
      setMiniMapOrigin({ x, y, w, h });
      setLocationModalRendered(true);
      setLocationModalVisible(true);
      Animated.spring(locationModalAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    });
  }, [locationModalAnim]);

  const closeLocationModal = useCallback(() => {
    Animated.timing(locationModalAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setLocationModalVisible(false);
      setLocationModalRendered(false);
    });
  }, [locationModalAnim]);
  const [verificationDashboard, setVerificationDashboard] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const verificationLastFetched = useRef(0);
  const bonusPopupShownRef = useRef(false);
  const initialLoadDone = useRef(false);
  const VERIFICATION_STALE_THRESHOLD = 30000;

  // Combined user data - single source of truth for availability
  const displayData = { ...user, ...profile };

  // Availability reads directly from AppContext (single source of truth: isAvailable)
  // Use a ref to hold the last known value so refreshes don't flash the toggle to "off"
  const lastKnownAvailability = useRef(false);
  const rawAvailable = displayData?.isAvailable;
  // Only update last known value when we have a definitive boolean (not undefined during loading)
  if (rawAvailable !== undefined && rawAvailable !== null) {
    lastKnownAvailability.current = rawAvailable;
  }
  const isAvailable = lastKnownAvailability.current;

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

      const pendingCount = allRequests.filter(r => r.status === 'pending').length;
      const activeCount = allRequests.filter(r =>
        r.status === 'accepted' || r.status === 'in-progress'
      ).length;
      const completedCount = allRequests.filter(r => r.status === 'completed').length;
      const rating = user?.rating || profile?.rating || 0;

      setStats({
        pending: pendingCount,
        active: activeCount,
        completed: completedCount,
        earnings: 0, // Will be implemented with earnings API
        rating: rating,
      });

      const activeRequests = allRequests
        .filter(r => r.status === 'accepted' || r.status === 'in-progress')
        .sort((a, b) => new Date(b.serviceDate || b.createdAt) - new Date(a.serviceDate || a.createdAt))
        .slice(0, 3);
      setRecentServices(activeRequests);
      setStatsLoaded(true);
    } catch (error) {
      console.error('[ProviderHome] Error fetching stats:', error);
      setStatsLoaded(true);
      // Fallback to profile data
      setStats({
        pending: 0,
        active: 0,
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
  // Refresh on focus — but skip the very first focus (initial mount is handled by AppContext)
  const lastRefreshRef = useRef(0);
  useEffect(() => {
    if (isFocused) {
      // Defer fetches until after tab transition animation completes
      const task = InteractionManager.runAfterInteractions(() => {
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          lastRefreshRef.current = Date.now();
          fetchStats();
          fetchVerificationData();
          return;
        }
        const elapsed = Date.now() - lastRefreshRef.current;
        if (elapsed < 30000) return;
        lastRefreshRef.current = Date.now();
        const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
        if (providerId && userType === 'provider') {
          refreshProfile(userType, providerId);
        }
        fetchStats();
        fetchVerificationData({ force: true });
      });
      return () => task.cancel();
    }
  }, [isFocused]);

  /**
   * Handle refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    lastRefreshRef.current = Date.now();
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

    // Optimistic update -- toggle UI immediately via AppContext
    const previousValue = isAvailable;
    updateProviderAvailability(value, true); // optimistic flag

    setIsUpdatingAvailability(true);

    try {
      const result = await updateProviderAvailability(value);

      if (!result.success) {
        // Revert optimistic update via AppContext
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
      // Revert on failure via AppContext
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

  // Listen for socket events ONLY when this tab is focused
  // Prevents background tabs from triggering API calls on socket events
  useFocusEffect(
    useCallback(() => {
      const socketRefresh = (label) => {
        console.log(`[ProviderHome] Socket: ${label} -- refreshing stats`);
        lastRefreshRef.current = Date.now();
        fetchStats();
      };
      const removeNewReq = addEventListener('new:request', () => socketRefresh('new:request'));
      const removeAccepted = addEventListener('request:accepted', () => socketRefresh('request:accepted'));
      const removeCompleted = addEventListener('request:completed', () => socketRefresh('request:completed'));
      const removeCancelled = addEventListener('request:cancelled', () => socketRefresh('request:cancelled'));

      return () => {
        removeNewReq();
        removeAccepted();
        removeCompleted();
        removeCancelled();
      };
    }, [fetchStats])
  );

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
          // Update premium status in context — FIRST_APPROVAL_BONUS is 180 days (6 months)
          setPremiumStatus({
            isPremiumActive: true,
            premiumDaysLeft: 180,
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
  if (!user && !profile) {
    return <HomeSkeletonLoader insets={insets} />;
  }

  return (
    <View style={styles.container}>
  

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent} // brand footer image is the tail — it provides the tab-bar clearance
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}>
          <SvgArt color="rgba(255,255,255,1)" height={110} />

          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setIsDrawerOpen(true)} activeOpacity={0.7} style={styles.headerLogoBtn}>
              <Image source={FIXHOMI_LOGO} style={styles.headerLogoImg} />
            </TouchableOpacity>

            <View style={styles.heroTextInline}>
              <Text style={styles.heroNameInline} numberOfLines={1}>{getGreeting(firstName)}</Text>
              <Text style={styles.heroSubtextInline} numberOfLines={1}>{t('providerHome.manageServices')}</Text>
            </View>

            <AvatarButton
              name={displayData?.fullName}
              profilePicture={displayData?.profilePicture}
              onPress={() => navigation.navigate('Profile')}
              isProvider={true}
            />
          </View>
        </View>

        {/* Content area with padding */}
        <View style={styles.contentArea}>
          {/* Status Pads Row — location sharing (left) + online toggle (right) */}
          <View style={styles.statusPadsRow}>
            {/* Location Sharing Pad — left side, only visible when tracking */}
            <LocationTrackingBanner />

            {/* Online/Offline Toggle Pad — right side */}
            {isProfileLoading ? (
              <View style={[styles.statusPad, { backgroundColor: BRAND.white, borderColor: '#E2E8F0' }]}>
                <ActivityIndicator size="small" color={BRAND.muted} />
              </View>
            ) : (
              <StatusTogglePad
                isAvailable={isAvailable}
                isUpdating={isUpdatingAvailability || refreshing}
                onToggle={() => handleAvailabilityToggle(!isAvailable)}
                paused={!isFocused}
              />
            )}
          </View>

          {/* Verification Status / Location Row */}
          {(() => {
            const dashboard = verificationDashboard;
            const steps = dashboard?.steps || [];
            const identitySteps = steps.filter(s => s.id !== 'premium');
            const identityDone = identitySteps.length > 0 && identitySteps.every(s => s.completed);
            const isPremium = dashboard?.isPremiumActive || false;
            const isFullyReady = identityDone && isPremium;
            const percentage = steps.length > 0 ? Math.round((steps.filter(s => s.completed).length / steps.length) * 100) : 0;
            const premiumStep = steps.find(s => s.id === 'premium');
            const daysRemaining = premiumStep?.daysRemaining || 0;

            if (isFullyReady) {
              return (
                <View style={styles.dualCardRow}>
                  {/* Compact verification card */}
                  <TouchableOpacity
                    style={styles.miniVerificationCard}
                    onPress={() => navigation.navigate('VerificationDashboard')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.miniVerificationPercent}>100%</Text>
                    <View style={styles.miniVerificationBadge}>
                      <MaterialIcon name="verified" size={12} color="#10B981" />
                      <Text style={styles.miniVerificationBadgeText}>Premium</Text>
                    </View>
                    <Text style={styles.miniVerificationDays}>{daysRemaining}d left</Text>
                  </TouchableOpacity>

                  {/* Location preview card with inline map */}
                  <TouchableOpacity
                    ref={miniMapRef}
                    style={styles.miniLocationCard}
                    onPress={openLocationModal}
                    activeOpacity={0.85}
                  >
                    {providerLocation?.latitude ? (
                      <View style={styles.miniMapWrap}>
                        <Mapbox.MapView
                          style={styles.miniMapView}
                          styleURL={Mapbox.StyleURL.Street}
                          scrollEnabled={false}
                          pitchEnabled={false}
                          rotateEnabled={false}
                          zoomEnabled={false}
                        >
                          <Mapbox.Camera
                            centerCoordinate={[providerLocation.longitude, providerLocation.latitude]}
                            zoomLevel={14}
                            animationDuration={0}
                          />
                        </Mapbox.MapView>
                        <View style={styles.miniMapPinOverlay} pointerEvents="none">
                          <MaterialIcon name="person-pin-circle" size={24} color={BRAND.primary} />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.miniMapPlaceholder}>
                        <MaterialIcon
                          name={locationStatus === 'acquiring' ? 'my-location' : 'location-off'}
                          size={20}
                          color={BRAND.muted}
                        />
                      </View>
                    )}
                    <Text style={styles.miniLocationLabel} numberOfLines={1}>
                      {providerLocation?.latitude
                        ? (displayAddress || 'My Location')
                        : locationStatus === 'acquiring'
                          ? 'Getting your location…'
                          : locationStatus === 'disabled'
                            ? 'Location is off'
                            : locationStatus === 'denied'
                              ? 'Enable location'
                              : (displayAddress || 'My Location')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }

            // Not fully ready — show original full-width verification card
            return (
              <VerificationStatusCard
                dashboard={verificationDashboard}
                onPress={() => navigation.navigate('VerificationDashboard')}
                isLoading={verificationLoading || isProfileLoading}
                t={t}
              />
            );
          })()}

          {/* Stats Grid */}
          <Text style={styles.sectionTitle}>{t('providerHome.overview')}</Text>
          {!statsLoaded ? (
            <View style={styles.statsGrid}>
              {[0,1,2,3].map(i => (
                <View key={i} style={[styles.statsCard, { padding: 14, alignItems: 'center' }]}>
                  <ShimmerBlock width={36} height={36} borderRadius={18} shimmerAnim={shimmerAnim} />
                  <ShimmerBlock width={30} height={20} borderRadius={6} shimmerAnim={shimmerAnim} style={{ marginTop: 8 }} />
                  <ShimmerBlock width={50} height={10} borderRadius={5} shimmerAnim={shimmerAnim} style={{ marginTop: 4 }} />
                </View>
              ))}
            </View>
          ) : (
          <View style={styles.statsGrid}>
            <StatsCard
              materialIconName="play-circle-filled"
              value={stats.active}
              label={t('providerHome.statsActive')}
              color="#10B981"
              bgColor="#10B98118"
            />
            <StatsCard
              iconName="check-circle"
              value={stats.completed}
              label={t('providerHome.statsCompleted')}
              color={BRAND.secondary}
              bgColor={BRAND.secondary + '18'}
            />
            <StatsCard
              materialIconName="star"
              value={stats.rating.toFixed(1)}
              label={t('providerHome.statsRating')}
              color="#EAB308"
              bgColor="#EAB30818"
            />
          </View>
          )}

          {/* Recent Active Services */}
          <Text style={styles.sectionTitle}>{t('providerHome.activeJobs')} <Text style={{ color: '#CBD5E1', fontSize: 11, fontWeight: '500', textTransform: 'none' }}>{t('providerHome.recentThree')}</Text></Text>

          {!statsLoaded ? (
            /* Shimmer placeholders while stats are loading */
            [0, 1].map(i => (
              <View key={i} style={[styles.recentServiceCard, { padding: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ShimmerBlock width={40} height={40} borderRadius={12} shimmerAnim={shimmerAnim} />
                  <View style={{ flex: 1 }}>
                    <ShimmerBlock width={120} height={14} borderRadius={6} shimmerAnim={shimmerAnim} />
                    <ShimmerBlock width={80} height={11} borderRadius={5} shimmerAnim={shimmerAnim} style={{ marginTop: 6 }} />
                  </View>
                  <ShimmerBlock width={50} height={24} borderRadius={8} shimmerAnim={shimmerAnim} />
                </View>
              </View>
            ))
          ) : recentServices.length > 0 ? (
            recentServices.map((req) => {
              const userName = req.userDetails?.name || req.userName || 'Customer';
              const serviceDate = req.serviceDate || req.eventDate || req.createdAt;
              const dateStr = serviceDate ? new Date(serviceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
              const timeStr = serviceDate ? new Date(serviceDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
              const phone = req.userDetails?.phone;
              const serviceLabel = formatServiceName(req.serviceType) || req.serviceType;

              // Get coords for directions
              let lat, lng;
              if (req.location?.coordinates && Array.isArray(req.location.coordinates) && req.location.coordinates.length === 2) {
                [lng, lat] = req.location.coordinates;
              } else if (req.location?.latitude && req.location?.longitude) {
                lat = req.location.latitude;
                lng = req.location.longitude;
              }

              return (
                <TouchableOpacity
                  key={req._id}
                  style={styles.recentServiceCard}
                  onPress={() => navigation.navigate('ServiceRequestDetail', {
                    requestId: req._id,
                    request: req,
                    isEventService: req.isEventService,
                    isEmergencyService: req.isEmergencyService,
                  })}
                  activeOpacity={0.7}
                >
                  <View style={styles.recentServiceTop}>
                    <View style={styles.recentServiceInfo}>
                      <Text style={styles.recentServiceName} numberOfLines={1}>{userName}</Text>
                      <Text style={styles.recentServiceType} numberOfLines={1}>{serviceLabel}</Text>
                    </View>
                    <View style={styles.recentServiceDate}>
                      <Text style={styles.recentServiceDateText}>{dateStr}</Text>
                      <Text style={styles.recentServiceTimeText}>{timeStr}</Text>
                    </View>
                  </View>
                  <View style={styles.recentServiceActions}>
                    {lat && lng && (
                      <TouchableOpacity
                        style={styles.recentActionBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          const url = Platform.select({
                            ios: `maps:?daddr=${lat},${lng}`,
                            android: `google.navigation:q=${lat},${lng}`,
                          });
                          Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`));
                        }}
                      >
                        <MaterialIcon name="directions" size={16} color={BRAND.secondary} />
                        <Text style={styles.recentActionText}>{t('detail.directions')}</Text>
                      </TouchableOpacity>
                    )}
                    {phone && (
                      <TouchableOpacity
                        style={styles.recentActionBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => {});
                        }}
                      >
                        <MaterialIcon name="phone" size={16} color="#10B981" />
                        <Text style={[styles.recentActionText, { color: '#10B981' }]}>{t('common.call')}</Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.recentActionBtn}>
                      <MaterialIcon name="chevron-right" size={16} color={BRAND.muted} />
                      <Text style={[styles.recentActionText, { color: BRAND.muted }]}>{t('providerHome.details')}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.noRecentCard}>
              <MaterialIcon name="inbox" size={28} color={BRAND.muted} />
              <Text style={styles.noRecentText}>{t('providerHome.noActiveServices')}</Text>
            </View>
          )}

          {/* Service Categories - Only show verified services */}
          <Text style={styles.sectionTitle}>{t('providerHome.yourServices')}</Text>
          {isProfileLoading && !displayData?.serviceCategories?.length ? (
            <View style={styles.servicesContainer}>
              {[0,1,2].map(i => (
                <View key={i} style={[styles.serviceTag, { paddingVertical: 10, paddingHorizontal: 14 }]}>
                  <ShimmerBlock width={18} height={18} borderRadius={9} shimmerAnim={shimmerAnim} />
                  <ShimmerBlock width={80 + i * 15} height={13} borderRadius={6} shimmerAnim={shimmerAnim} style={{ marginLeft: 8 }} />
                </View>
              ))}
            </View>
          ) : (
          <View style={styles.servicesContainer}>
            {/* Show Verified Services */}
            {(displayData?.verifiedServiceCategories?.length > 0) && (
              displayData.verifiedServiceCategories.map((cat, index) => (
                <View key={`verified-${index}`} style={styles.serviceTag}>
                  <View style={styles.serviceTagIconCircle}>
                    <Icon name="verified" size={11} color={BRAND.secondary} />
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
                      <Icon name="clock" size={11} color={BRAND.primary} />
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
          )}

          {/* Tips Section — solid saturated orange: flagged as a dark zone so
              the glass tab bar flips to its smoke variant (white text) while
              this card passes under it; the orange-tinted light glass would
              otherwise melt into the same hue. */}
          <TabBarDarkZone>
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
          </TabBarDarkZone>

          {/* Emergency Numbers — reuses the same helpline screen Users see */}
          <TouchableOpacity
            style={styles.emergencyNumbersCard}
            onPress={() => navigation.navigate('EmergencyServices', { mode: 'helplines' })}
            activeOpacity={0.85}
          >
            <View style={styles.emergencyNumbersIconCircle}>
              <MaterialIcon name="phone-in-talk" size={22} color="#DC2626" />
            </View>
            <View style={styles.emergencyNumbersTextWrap}>
              <Text style={styles.emergencyNumbersTitle}>{t('providerHome.emergencyNumbers') || 'Emergency Numbers'}</Text>
              <Text style={styles.emergencyNumbersSub}>{t('providerHome.emergencyNumbersSub') || 'Police, Ambulance, Fire & more helplines'}</Text>
            </View>
            <MaterialIcon name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Brand footer — edge-to-edge art at the end of the home scroll.
            Explicit numeric sizing inside BrandFooter (no zoom/crop on any
            device); short top fade merges the screen's dark navy into the
            sky, ending above the headline. Provides tab-bar clearance. */}
        <BrandFooter
          source={require('../assets/brand_footer_provider.jpg')}
          fadeColor="#0F172A"
          style={styles.brandFooterWrap}
        />
      </ScrollView>

      {/* Location Preview — animated floating card from mini map origin */}
      {locationModalRendered && (
        <View style={StyleSheet.absoluteFill} pointerEvents={locationModalVisible ? 'auto' : 'none'}>
          {/* Backdrop */}
          <Animated.View
            style={[
              styles.locationModalOverlay,
              { opacity: locationModalAnim },
            ]}
          >
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeLocationModal} />
          </Animated.View>

          {/* Card — flies from mini map center to screen center */}
          <Animated.View
            style={[
              styles.locationModalCardWrap,
              {
                opacity: locationModalAnim.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0, 1, 1],
                }),
                transform: [
                  {
                    // Start at mini card center, end at screen center (0,0 offset)
                    translateX: locationModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        miniMapOrigin.x + miniMapOrigin.w / 2 - SCREEN_WIDTH / 2,
                        0,
                      ],
                    }),
                  },
                  {
                    translateY: locationModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        miniMapOrigin.y + miniMapOrigin.h / 2 - Dimensions.get('window').height / 2,
                        0,
                      ],
                    }),
                  },
                  {
                    scale: locationModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.15, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.locationModalCard} onStartShouldSetResponder={() => true}>
              {providerLocation?.latitude && providerLocation?.longitude ? (
                <>
                  <View style={styles.locationModalMap}>
                    <Mapbox.MapView
                      style={{ flex: 1 }}
                      styleURL={Mapbox.StyleURL.Street}
                      scrollEnabled
                      pitchEnabled={false}
                      rotateEnabled={false}
                      zoomEnabled
                    >
                      <Mapbox.Camera
                        centerCoordinate={[providerLocation.longitude, providerLocation.latitude]}
                        zoomLevel={16}
                        animationDuration={800}
                      />
                      {Platform.OS === 'ios' ? (
                        <Mapbox.MarkerView id="provider-loc" coordinate={[providerLocation.longitude, providerLocation.latitude]}>
                          <View style={styles.locationPinOuter}>
                            <MaterialIcon name="person-pin-circle" size={36} color={BRAND.primary} />
                          </View>
                        </Mapbox.MarkerView>
                      ) : (
                        <Mapbox.PointAnnotation id="provider-loc" coordinate={[providerLocation.longitude, providerLocation.latitude]}>
                          <View style={styles.locationPinOuter}>
                            <MaterialIcon name="person-pin-circle" size={36} color={BRAND.primary} />
                          </View>
                        </Mapbox.PointAnnotation>
                      )}
                    </Mapbox.MapView>

                    <TouchableOpacity
                      style={styles.locationModalClose}
                      onPress={closeLocationModal}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcon name="close" size={18} color="#1F2937" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.locationModalAddress}>
                    <MaterialIcon name="place" size={16} color={BRAND.primary} />
                    <Text style={styles.locationModalAddressMain} numberOfLines={1}>
                      {locationAddress?.shortAddress || locationAddress?.city || displayAddress || 'Your current location'}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.locationModalNoData}>
                  <MaterialIcon
                    name={locationStatus === 'acquiring' ? 'my-location' : 'location-off'}
                    size={36}
                    color="#94A3B8"
                  />
                  <Text style={styles.locationModalNoText}>
                    {locationStatus === 'acquiring' ? 'Getting your location…' : 'Location unavailable'}
                  </Text>
                  <Text style={styles.locationModalNoSub}>
                    {locationStatus === 'acquiring'
                      ? 'Hang tight while we find you'
                      : locationStatus === 'denied'
                        ? 'Grant location permission in Settings'
                        : 'Enable location services'}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      )}

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
    paddingBottom: 0,
  },
  brandFooterWrap: {
    marginTop: 22,
  },

  // ===== Hero Header =====
  heroHeader: {
    backgroundColor: BRAND.dark,
    paddingHorizontal: 20,
    paddingBottom: 18,
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
    gap: 12,
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
  heroTextInline: {
    flex: 1,
  },
  heroNameInline: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroSubtextInline: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    letterSpacing: 0.1,
  },

  // ===== Content Area =====
  contentArea: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },

  // ===== Status Pads Row =====
  statusPadsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statusPad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    flex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  statusPadText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ===== Availability Card (legacy — kept for skeleton loader) =====
  availabilityCard: {
    overflow: 'hidden',
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
    marginBottom: 10,
    marginTop: 4,
  },

  // ===== Stats Grid =====
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statsCard: {
    overflow: 'hidden',
    flex: 1,
    backgroundColor: BRAND.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statsCardInner: {
    padding: 10,
    alignItems: 'center',
  },
  statsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  statsIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statsLabel: {
    fontSize: 11,
    color: BRAND.muted,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // ===== Action Cards =====
  actionCard: {
    overflow: 'hidden',
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
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.secondary + '20',
  },
  serviceTagIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
    fontSize: 12,
    color: BRAND.secondary,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  serviceTagTextPending: {
    color: BRAND.primary,
  },
  pendingBadge: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 2,
  },
  pendingBadgeText: {
    fontSize: 8,
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
  emergencyNumbersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#9A3412', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  emergencyNumbersIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyNumbersTextWrap: { flex: 1 },
  emergencyNumbersTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  emergencyNumbersSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
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
    overflow: 'hidden',
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

  // ===== Dual Card Row (verification + location) =====
  dualCardRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  miniVerificationCard: {
    flex: 3,
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B98130',
    ...Platform.select({
      ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  miniVerificationPercent: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: -0.3,
  },
  miniVerificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
  },
  miniVerificationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  miniVerificationDays: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  miniLocationCard: {
    flex: 7,
    backgroundColor: BRAND.dark,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 14 },
      android: { elevation: 6 },
    }),
  },
  miniMapWrap: {
    width: '100%',
    height: 72,
  },
  miniMapView: {
    flex: 1,
  },
  miniMapPinOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniMapPlaceholder: {
    width: '100%',
    height: 72,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniLocationLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.darkText,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: BRAND.white,
  },

  // ===== Recent Service Cards =====
  recentServiceCard: {
    overflow: 'hidden',
    backgroundColor: BRAND.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  recentServiceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  recentServiceInfo: {
    flex: 1,
    marginRight: 12,
  },
  recentServiceName: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.darkText,
    letterSpacing: -0.2,
  },
  recentServiceType: {
    fontSize: 12,
    color: BRAND.muted,
    fontWeight: '500',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  recentServiceDate: {
    alignItems: 'flex-end',
  },
  recentServiceDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.darkText,
  },
  recentServiceTimeText: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 1,
  },
  recentServiceActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  recentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  recentActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.secondary,
  },
  noRecentCard: {
    backgroundColor: BRAND.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  noRecentText: {
    fontSize: 13,
    color: BRAND.muted,
    fontWeight: '500',
  },

  // ===== Location Modal =====
  // ===== Location Modal — animated floating card =====
  locationModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  locationModalCardWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  locationModalCard: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: BRAND.white,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 30 },
      android: { elevation: 24 },
    }),
  },
  locationModalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  locationModalMap: {
    height: 360,
  },
  locationPinOuter: {
    alignItems: 'center',
  },
  locationModalNoData: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  locationModalNoText: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.darkText,
  },
  locationModalNoSub: {
    fontSize: 12,
    color: BRAND.muted,
  },
  locationModalAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.white,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  locationModalAddressMain: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.darkText,
    letterSpacing: -0.1,
  },
});

export default ProviderHomeScreen;
