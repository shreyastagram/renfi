/**
 * User Home Screen
 *
 * Production-grade home screen with:
 * - Full screen map with user location
 * - Hamburger menu + Avatar for profile
 * - Expandable bottom sheet for service booking
 * - Inline date picker and booking flow
 * - Find nearby providers integration
 * - Global location context with 30-second refresh
 * - Address management icon
 *
 * @version 3.0.0 - Global Location Context + Address Management
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Linking,
  ScrollView,
  Animated,
  PanResponder,
  Platform,
  PermissionsAndroid,
  Modal,
  Image
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import RazorpayCheckout from 'react-native-razorpay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import { checkAndroidLocationGranted, requestAndroidLocationPermission } from '../utils/locationPermission';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
// 3D rendered icons (Fixhomi Figma icon system) for the quick-access row
const Emergency3D = require('../assets/serviceIcons/3d/emergency.png');
const Events3D = require('../assets/serviceIcons/3d/events.png');
const Favorites3D = require('../assets/serviceIcons/3d/favorites.png');
import { LocationMap, Icon, ServiceIcon, DateTimePicker, LocationPicker, ProviderDetailsModal, FixhomiLogo, CancellationReasonModal } from '../components';
import PhoneOnboardingSheet from '../components/PhoneOnboardingSheet';
import HelpSupportButton from '../components/HelpSupportButton';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import SvgArt from '../components/SvgArt';

const FIXHOMI_LOGO = require('../assets/fixhomi_logo.jpg');
import { useApp } from '../context/AppContext';
import { Analytics, EV } from '../services/analytics';
import BrandFooter from '../components/BrandFooter';
import { useDialog } from '../context/DialogContext';
import { useLocation } from '../context/LocationContext';
import { useLanguage } from '../context/LanguageContext';
import useExitConfirmation from '../hooks/useExitConfirmation';
import useBookingProfileGate from '../hooks/useBookingProfileGate';
import {
  createServiceRequest,
  getNearbyProviders,
  sendRequestToProvider,
  cancelRequest,
  getProviderDetails,
  getRequestDetails,
  skipProvider,
  retryProviderSearch,
  getAvailableCategories,
} from '../services/traditionalServiceService';
import { formatDistance, formatDistanceFromMeters, useDistanceUnit } from '../utils/formatDistance';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SERVICE_CARD_WIDTH = Math.floor((SCREEN_WIDTH - 64) / 3);
// 80 at most, but never wider than the card's content box (2 × 6 padding) —
// otherwise the squircle tile clips inside overflow:hidden on 320–340dp phones.
const SERVICE_ICON_SIZE = Math.min(80, SERVICE_CARD_WIDTH - 12);

// Bottom sheet heights
const SHEET_MIN_HEIGHT = 160;
const SHEET_MID_HEIGHT = SCREEN_HEIGHT * 0.40; // 40% for initial state - shows map + top services
// SHEET_MAX_HEIGHT is computed dynamically in the component using insets (see safeMaxHeight)

// Brand colors
const BRAND = {
  primary: '#f67c16', // Orange
  secondary: '#2b76bc', // Blue
  background: '#faf7f7',
  white: '#FFFFFF',
  neutral: '#6B7280',
  cardBg: '#F5F7FA',
};

// Service categories - Unified neutral palette (no rainbow)
// IDs must match backend allowedCategories for proper provider matching
const SERVICE_CATEGORIES = [
  { id: 'electrician', name: 'Electrician', iconName: 'electrician' },
  { id: 'plumber', name: 'Plumber', iconName: 'plumber' },
  { id: 'electronics_technician', name: 'Electronics', iconName: 'electronics_technician' },
  { id: 'carpenter', name: 'Carpenter', iconName: 'carpenter' },
  { id: 'painter', name: 'Painter', iconName: 'painter' },
  { id: 'solar_repairing', name: 'Solar', iconName: 'solar_repairing' },
  { id: 'welder', name: 'Welder', iconName: 'welder' },
  { id: 'salon', name: 'Salon', iconName: 'salon' },
  { id: 'vehicle_cleaning', name: 'Vehicle Clean', iconName: 'vehicle_cleaning' },
  { id: 'mason_tiler', name: 'Mason & Tiler', iconName: 'mason_tiler' },
  { id: 'driver', name: 'Driver', iconName: 'driver' },
  { id: 'ac_repair', name: 'AC Repair', iconName: 'ac_repair' },
];

// Map service IDs to translation keys
const SERVICE_ID_TO_KEY = {
  electrician: 'services.electrician',
  plumber: 'services.plumber',
  electronics_technician: 'services.electronics',
  carpenter: 'services.carpenter',
  painter: 'services.painter',
  solar_repairing: 'services.solar',
  welder: 'services.welder',
  salon: 'services.salon',
  vehicle_cleaning: 'services.vehicleClean',
  mason_tiler: 'services.masonTiler',
  driver: 'services.driver',
  ac_repair: 'services.acRepair',
};

// Per-service accent colors (from ICON_MAP) for 3D icon backgrounds
const SERVICE_COLORS = {
  electrician: '#F59E0B',
  plumber: '#3B82F6',
  electronics_technician: '#6366F1',
  carpenter: '#8B5CF6',
  painter: '#EC4899',
  solar_repairing: '#EAB308',
  welder: '#EF4444',
  salon: '#F472B6',
  vehicle_cleaning: '#0EA5E9',
  mason_tiler: '#78716C',
  driver: '#14B8A6',
  ac_repair: '#06B6D4',
};

const ServiceCard = React.memo(({ service, onPress, comingSoon = false }) => {
  const { t } = useLanguage();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const accent = SERVICE_COLORS[service.id] || BRAND.secondary;

  // No press-shrink animation for coming-soon cards (they only open a dialog).
  const onPressIn = () => { if (!comingSoon) Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, speed: 50, bounciness: 4 }).start(); };
  const onPressOut = () => { if (!comingSoon) Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }).start(); };

  const label = SERVICE_ID_TO_KEY[service.id] ? t(SERVICE_ID_TO_KEY[service.id]) : service.name;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.serviceCard}
        onPress={() => onPress(service)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={comingSoon ? 0.9 : 1}
        accessibilityLabel={comingSoon ? `${label} — ${t('userHome.comingSoonTitle') || 'Coming Soon'}` : `${label} service`}
        accessibilityRole="button"
        accessibilityState={{ disabled: comingSoon }}
      >
        {/* Service icon — custom SVG illustration or vector fallback */}
        <View style={[styles.serviceIconWrap, comingSoon && { opacity: 0.35 }]}>
          <ServiceIcon serviceType={service.id} size={SERVICE_ICON_SIZE} useSvg={true} color={accent} />
        </View>
        <Text style={[styles.serviceName, comingSoon && { opacity: 0.45 }]}>{label}</Text>
        {comingSoon && (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonBadgeText}>{t('userHome.comingSoon') || 'Coming Soon'}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

const ProviderCard = ({ provider, onCall, onBook, onSkip, onPress, booking, contacted, calling, skipping }) => {
  const { t } = useLanguage();
  const useKm = useDistanceUnit();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();

  return (
  <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
  <TouchableOpacity
    style={[styles.providerCard, skipping && styles.providerCardSkipping]}
    onPress={onPress}
    onPressIn={onPressIn}
    onPressOut={onPressOut}
    activeOpacity={0.85}
    disabled={skipping}
  >
    {/* Decorative bg circles */}
    <View style={styles.providerDecor1} />
    <View style={styles.providerDecor2} />
    <View style={styles.providerInfo}>
      {/* Profile Picture or Avatar */}
      {provider.profilePicture?.url ? (
        <View style={styles.providerAvatarRing}>
          <Image
            source={{ uri: provider.profilePicture.url }}
            style={styles.providerAvatarImage}
          />
        </View>
      ) : (
        <View style={styles.providerAvatarRing}>
          <View style={styles.providerAvatar}>
            <Text style={styles.providerInitial}>{provider.name?.charAt(0)?.toUpperCase() || 'P'}</Text>
          </View>
        </View>
      )}
      <View style={styles.providerDetails}>
        <View style={styles.providerNameRow}>
          <Text style={styles.providerName} numberOfLines={1}>{provider.name}</Text>
          {(provider.verified || provider.verification?.isVerified) && (
            <MaterialIcon name="verified" size={17} color="#2563EB" style={styles.verifiedBadge} />
          )}
          {contacted && (
            <View style={styles.contactedBadge}>
              <MaterialIcon name="call-made" size={10} color="#FFFFFF" />
              <Text style={styles.contactedBadgeText}>{t('userHome.contacted')}</Text>
            </View>
          )}
        </View>
        <View style={styles.providerDistanceRow}>
          <Icon name="location" size={14} color="#94A3B8" />
          <Text style={styles.providerDistance}>
            {provider.distanceKm ? `${formatDistance(provider.distanceKm, useKm)} ${t('common.away')}` :
             typeof provider.distance === 'number' ? `${formatDistanceFromMeters(provider.distance, useKm)} ${t('common.away')}` :
             t('common.nearby')}
          </Text>
        </View>
        {(provider.rating > 0 || provider.ratings?.average > 0) && (
          <View style={styles.providerRatingRow}>
            <Icon name="star" size={14} color="#F59E0B" />
            <Text style={styles.providerRating}>
              {(provider.ratings?.average || provider.rating || 0).toFixed(1)}
              {provider.ratings?.total > 0 && (
                <Text style={styles.providerRatingCount}> ({provider.ratings.total})</Text>
              )}
            </Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        style={styles.viewDetailsIcon}
        onPress={onPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={`View details for ${provider.name}`}
        accessibilityRole="button"
      >
        <MaterialIcon name="chevron-right" size={26} color="#CBD5E1" />
      </TouchableOpacity>
    </View>
    <View style={styles.providerActions}>
      <TouchableOpacity
        style={[styles.callButton, calling && styles.callButtonCalling]}
        onPress={(e) => {
          e.stopPropagation();
          onCall(provider);
        }}
        disabled={calling}
        accessibilityLabel={`Call ${provider.name}`}
        accessibilityRole="button"
      >
        {calling ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Icon name="phone" size={20} color="#FFFFFF" />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.bookButton, booking && styles.bookButtonLoading]}
        onPress={(e) => {
          e.stopPropagation();
          onBook(provider);
        }}
        disabled={booking}
        accessibilityLabel={`Book ${provider.name}`}
        accessibilityRole="button"
      >
        {booking ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.bookButtonText}>{t('userHome.bookButton')}</Text>}
      </TouchableOpacity>
      {/* Skip / Remove Provider Button */}
      <TouchableOpacity
        style={[styles.skipButton, skipping && styles.skipButtonLoading]}
        onPress={(e) => {
          e.stopPropagation();
          onSkip(provider);
        }}
        disabled={skipping || booking}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        accessibilityLabel={`Skip ${provider.name}`}
        accessibilityRole="button"
      >
        {skipping ? (
          <ActivityIndicator size="small" color="#EF4444" />
        ) : (
          <MaterialIcon name="skip-next" size={20} color="#EF4444" />
        )}
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
  </Animated.View>
  );
};

const UserHomeScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { dialog } = useDialog();
  const { t } = useLanguage();

  // Show "Exit App?" on Android back press from home screen
  useExitConfirmation();

  // Set status bar for light background when this tab is focused
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor('transparent');
    }, [])
  );

  // "Coming Soon" availability: which traditional categories currently have a
  // bookable provider. null = unknown → FAIL-OPEN (show everything active).
  const [availableCategories, setAvailableCategories] = useState(null);

  // Refetch each time Home gains focus so a category that just gained/lost a
  // provider flips within seconds — never shows stale "Coming Soon".
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAvailableCategories().then((cats) => {
        if (active && cats !== null) setAvailableCategories(cats);
      });
      return () => { active = false; };
    }, [])
  );

  // A category is "coming soon" only when we KNOW availability and it's absent.
  const isCategoryComingSoon = useCallback(
    (categoryId) => Array.isArray(availableCategories) && !availableCategories.includes(categoryId),
    [availableCategories]
  );

  // Ordered list: services WITH available providers first, "Coming Soon" ones last.
  // Stable sort preserves the original order within each group. When availability is
  // unknown (null → fail-open), nothing is "coming soon" so the original order stands.
  const orderedServiceCategories = useMemo(
    () => [...SERVICE_CATEGORIES].sort(
      (a, b) => (isCategoryComingSoon(a.id) ? 1 : 0) - (isCategoryComingSoon(b.id) ? 1 : 0)
    ),
    [isCategoryComingSoon]
  );

  const useKm = useDistanceUnit();
  // Max sheet height — 75% of screen, hard cap so it never overlaps header
  const safeMaxHeight = Math.min(SCREEN_HEIGHT * 0.75, SCREEN_HEIGHT - insets.top - 90);
  const mapRef = useRef(null);
  const { user, profile, userType, logout, isProfileLoading, isAuthLoading, phoneOnboardingPending, setPhoneOnboardingPending } = useApp();

  // Booking gate — name + verified phone required before any request is created
  const { ensureBookingProfileComplete, handleProfileIncompleteError } =
    useBookingProfileGate(navigation);

  // Use global location context (fetches once, updates every 30 sec)
  const {
    currentLocation,
    locationAddress,
    displayAddress,
    locationLoading,
    locationError,
    locationPermission: globalLocationPermission,
    locationServicesEnabled,
    refreshLocation,
    showGpsOffAlert,
  } = useLocation();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [step, setStep] = useState('select');

  // Hide the floating tab bar while the booking flow is active — its bottom
  // sheet has its own CTA (Create Request) that the pill would cover, and
  // tab-switching mid-booking is undesirable anyway. Restored on 'select'.
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: step !== 'select' ? { display: 'none' } : undefined,
    });
  }, [navigation, step]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(null); // Combined date & time
  const scheduleTrackedRef = useRef(false); // analytics: one schedule_selected per booking flow
  const [serviceLocation, setServiceLocation] = useState(null); // For "Book for Others"
  const [serviceDescription, setServiceDescription] = useState(''); // Optional description
  const [createdRequest, setCreatedRequest] = useState(null);
  const [providers, setProviders] = useState([]);
  const [searchRadius, setSearchRadius] = useState(0);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [fetchingProviders, setFetchingProviders] = useState(false);
  const [bookingProvider, setBookingProvider] = useState(null);
  const [allProvidersRejected, setAllProvidersRejected] = useState(false);

  // Provider details modal state
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerDetailsVisible, setProviderDetailsVisible] = useState(false);

  // Permission states (use global for location, local for notifications)
  const [locationPermission, setLocationPermission] = useState(globalLocationPermission);
  // locationServicesEnabled comes from LocationContext (detects GPS on/off)
  const [notificationPermission, setNotificationPermission] = useState('unknown');

  // Sync location permission from global context
  useEffect(() => {
    setLocationPermission(globalLocationPermission);
  }, [globalLocationPermission]);

  // Handle pre-selected service from Favorites screen or deep link
  // Note: animateSheetTo is defined after the PanResponder, so we use a ref-based approach
  const pendingPreSelectRef = useRef(null);
  useEffect(() => {
    const preSelectedService = route?.params?.preSelectedService;
    if (preSelectedService) {
      const service = SERVICE_CATEGORIES.find(s => s.id === preSelectedService);
      if (service) {
        setSelectedService(service);
        setStep('date');
        pendingPreSelectRef.current = true;
        // Clear the param so it doesn't re-trigger
        navigation.setParams({ preSelectedService: undefined, preSelectedProvider: undefined });
      }
    }
  }, [route?.params?.preSelectedService]);

  // Animated sheet — uses translateY with native driver for jitter-free animation.
  // translateY = 0 means sheet is at full max height. Positive translateY = pushed down.
  // For a target "visible height" h, translateY = safeMaxHeight - h.
  const initialTranslateY = safeMaxHeight - SHEET_MID_HEIGHT;
  const sheetTranslateY = useRef(new Animated.Value(initialTranslateY)).current;
  const currentHeightRef = useRef(SHEET_MID_HEIGHT);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const scrollOffsetRef = useRef(0); // tracks ScrollView scroll position
  const scrollViewRef = useRef(null);
  // Date view slides up from below to cover the select view (iOS modal style)
  const dateStepTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  // Keep a legacy sheetHeight ref so any code reading it still works (unused by Animated)
  const sheetHeight = { setValue: () => {}, stopAnimation: (cb) => cb && cb(currentHeightRef.current) };

  // Convert height target to translateY
  const heightToTranslateY = useCallback((h) => safeMaxHeight - h, [safeMaxHeight]);

  // Snap sheet to a target height with smooth spring animation
  // Note: scroll position is preserved across collapse/expand for better UX
  const snapToHeight = useCallback((targetHeight) => {
    currentHeightRef.current = targetHeight;
    const expanded = targetHeight >= safeMaxHeight * 0.95;
    setSheetExpanded(expanded);
    Animated.spring(sheetTranslateY, {
      toValue: heightToTranslateY(targetHeight),
      useNativeDriver: true,
      friction: 8,
      tension: 55,
      overshootClamping: true,
    }).start();
  }, [sheetTranslateY, heightToTranslateY, safeMaxHeight]);

  // Determine snap target from gesture
  const getSnapTarget = useCallback((gestureState) => {
    const velocity = gestureState.vy;
    const dragDistance = gestureState.dy;
    const currentVisibleHeight = currentHeightRef.current - dragDistance;

    // Fast swipe — use velocity
    if (Math.abs(velocity) > 0.3) {
      if (velocity < 0) return safeMaxHeight; // swipe up → expand
      // Swipe down — step down one level
      return currentHeightRef.current >= safeMaxHeight * 0.7 ? SHEET_MID_HEIGHT : SHEET_MIN_HEIGHT;
    }

    // Moderate drag — use distance
    if (Math.abs(dragDistance) > 40) {
      if (dragDistance < 0) return safeMaxHeight; // drag up → expand
      // Drag down — step down
      return currentHeightRef.current >= safeMaxHeight * 0.7 ? SHEET_MID_HEIGHT : SHEET_MIN_HEIGHT;
    }

    // Small drag — snap to nearest
    const midPoint1 = (SHEET_MIN_HEIGHT + SHEET_MID_HEIGHT) / 2;
    const midPoint2 = (SHEET_MID_HEIGHT + safeMaxHeight) / 2;
    if (currentVisibleHeight < midPoint1) return SHEET_MIN_HEIGHT;
    if (currentVisibleHeight < midPoint2) return SHEET_MID_HEIGHT;
    return safeMaxHeight;
  }, [safeMaxHeight]);

  // Pan responder — on handle only (no gesture conflicts with ScrollView)
  const isDraggingRef = useRef(false);
  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        // Capture current position as offset — no stopAnimation to avoid blink
        const currentTranslateY = heightToTranslateY(currentHeightRef.current);
        sheetTranslateY.setOffset(currentTranslateY);
        sheetTranslateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const maxUpDy = -(safeMaxHeight - currentHeightRef.current);
        const clamped = Math.max(gestureState.dy, maxUpDy);
        sheetTranslateY.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        isDraggingRef.current = false;
        sheetTranslateY.flattenOffset();
        const target = getSnapTarget(gestureState);
        snapToHeight(target);
      },
    }),
  [sheetTranslateY, safeMaxHeight, heightToTranslateY, getSnapTarget, snapToHeight]);

  // Public function to animate sheet to a specific height (used by service selection, etc.)
  const animateSheetTo = useCallback((targetHeight) => {
    snapToHeight(targetHeight);
  }, [snapToHeight]);

  // If a pre-selected service was set from Favorites, animate the sheet up
  useEffect(() => {
    if (pendingPreSelectRef.current) {
      pendingPreSelectRef.current = false;
      // Small delay so the component has re-rendered with the new step
      setTimeout(() => animateSheetTo(safeMaxHeight), 150);
    }
  }, [step, animateSheetTo, safeMaxHeight]);

  // Slide transition: date view slides up to cover, slides down to reveal select
  useEffect(() => {
    if (step === 'date') {
      Animated.spring(dateStepTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 11,
        tension: 70,
      }).start();
    } else if (step === 'select') {
      Animated.spring(dateStepTranslateY, {
        toValue: SCREEN_HEIGHT,
        useNativeDriver: true,
        friction: 11,
        tension: 70,
      }).start();
    }
  }, [step, dateStepTranslateY]);

  // Refs to avoid stale closures in focus listener
  const createdRequestRef = useRef(null);
  const stepRef = useRef('select');
  useEffect(() => { createdRequestRef.current = createdRequest; }, [createdRequest]);
  useEffect(() => { stepRef.current = step; }, [step]);

  // Handle resumeRequest param — resume provider search from history/detail screen
  useEffect(() => {
    const resumeRequest = route?.params?.resumeRequest;
    if (resumeRequest?._id) {
      setCreatedRequest(resumeRequest);
      setSelectedService(SERVICE_CATEGORIES.find(s => s.id === resumeRequest.serviceType) || null);
      setStep('providers');
      animateSheetTo(safeMaxHeight);
      // Trigger provider search
      setTimeout(() => fetchProviders(resumeRequest._id), 300);
      // Clear the param so it doesn't re-trigger
      navigation.setParams({ resumeRequest: undefined });
    }
  }, [route?.params?.resumeRequest]);

  // When returning to home screen, check if active request was cancelled elsewhere
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const req = createdRequestRef.current;
      if (!req?._id || stepRef.current !== 'providers') return;
      try {
        const result = await getRequestDetails(req._id);
        if (result.success && result.request) {
          const { status } = result.request;
          if (status === 'cancelled' || status === 'completed' || status === 'accepted') {
            // Request was handled elsewhere — reset the home screen flow
            setStep('select');
            setSelectedService(null);
            setSelectedDateTime(null);
            setServiceLocation(null);
            setServiceDescription('');
            setCreatedRequest(null);
            setProviders([]);
            setProviderDetailsVisible(false);
            setSelectedProvider(null);
            setAllProvidersRejected(false);
            animateSheetTo(SHEET_MID_HEIGHT);
          }
        } else {
          // Request not found — reset
          setStep('select');
          setCreatedRequest(null);
          setProviders([]);
          animateSheetTo(SHEET_MID_HEIGHT);
        }
      } catch {
        // Silently ignore — don't disrupt UX for network errors
      }
    });
    return unsubscribe;
  }, [navigation, animateSheetTo]);

  const displayData = { ...user, ...profile };
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
  // Only consider unverified if profile has actually loaded (not still loading)
  const profileReady = !isAuthLoading && !isProfileLoading && profile !== null;
  // Booking requires PHONE verification only. Email verification is intentionally
  // NOT required to book — email sends a link that can fail (e.g. full device storage),
  // which must never block a phone-verified user from booking a service. (Task 1)
  const isVerified = displayData?.isPhoneVerified;

  // Check and request location permission
  const checkLocationPermission = useCallback(async () => {
    try {
      // Android grant semantics (FINE/COARSE) come from the shared helper —
      // single source of truth with LocationContext and LocationMap.
      if (Platform.OS === 'android') {
        const { granted } = await checkAndroidLocationGranted();
        if (granted) {
          setLocationPermission('granted');
          return true;
        }
      }

      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      const result = await check(permission);

      if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
        setLocationPermission('granted');
        return true;
      } else if (result === RESULTS.DENIED) {
        setLocationPermission('denied');
        return false;
      } else if (result === RESULTS.BLOCKED) {
        setLocationPermission('blocked');
        return false;
      }
      return false;
    } catch (error) {
      console.log('Permission check error:', error);
      return false;
    }
  }, []);

  const requestLocationPermission = useCallback(async () => {
    try {
      // Android: shared helper (both accuracies, "Approximate" counts,
      // EITHER never_ask_again ⇒ blocked).
      if (Platform.OS === 'android') {
        const res = await requestAndroidLocationPermission();
        if (res.granted) {
          setLocationPermission('granted');
          refreshLocation();
          return true;
        }
        if (res.blocked) {
          setLocationPermission('blocked');
          dialog(
            t('userHome.locationPermRequired'),
            t('userHome.locationPermMsg'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.openSettings'), onPress: () => openSettings() }
            ]
          );
          return false;
        }
        setLocationPermission('denied');
        return false;
      }

      const result = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);

      if (result === RESULTS.GRANTED) {
        setLocationPermission('granted');
        // Refresh location from global context after permission granted
        refreshLocation();
        return true;
      } else if (result === RESULTS.BLOCKED) {
        setLocationPermission('blocked');
        dialog(
          t('userHome.locationPermRequired'),
          t('userHome.locationPermMsg'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.openSettings'), onPress: () => openSettings() }
          ]
        );
        return false;
      }
      return false;
    } catch (error) {
      console.log('Permission request error:', error);
      return false;
    }
  }, [refreshLocation]);

  // Check notification permission (Android 13+ requires explicit permission)
  const checkNotificationPermission = useCallback(async () => {
    try {
      // Only check on Android 13+ (API 33+) where POST_NOTIFICATIONS permission exists
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        // Verify the permission constant exists before using it
        const permission = PERMISSIONS.ANDROID?.POST_NOTIFICATIONS;
        if (!permission) {
          console.log('POST_NOTIFICATIONS permission not available');
          setNotificationPermission('granted');
          return true;
        }
        const result = await check(permission);
        if (result === RESULTS.GRANTED) {
          setNotificationPermission('granted');
          return true;
        } else if (result === RESULTS.BLOCKED) {
          setNotificationPermission('blocked');
          return false;
        }
        setNotificationPermission('denied');
        return false;
      }
      // iOS or older Android versions - notifications don't require explicit permission
      setNotificationPermission('granted');
      return true;
    } catch (error) {
      console.log('Notification permission check error:', error);
      setNotificationPermission('granted'); // Don't block on error
      return true;
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        // Verify the permission constant exists before using it
        const permission = PERMISSIONS.ANDROID?.POST_NOTIFICATIONS;
        if (!permission) {
          console.log('POST_NOTIFICATIONS permission not available for request');
          return true;
        }
        const result = await request(permission);
        if (result === RESULTS.GRANTED) {
          setNotificationPermission('granted');
          return true;
        } else if (result === RESULTS.BLOCKED) {
          setNotificationPermission('blocked');
          dialog(
            t('userHome.notificationRequired'),
            t('userHome.notificationRequiredMsg'),
            [
              { text: t('common.openSettings'), onPress: () => openSettings() }
            ]
          );
          return false;
        }
        return false;
      }
      return true;
    } catch (error) {
      console.log('Notification permission request error:', error);
      return true;
    }
  }, []);

  // Initial permission checks
  // Note: Location is now handled by global LocationContext with 30-second refresh
  useEffect(() => {
    const initializePermissions = async () => {
      // Check notification permission first (required)
      const notifGranted = await checkNotificationPermission();
      if (!notifGranted) {
        const requested = await requestNotificationPermission();
        if (!requested && notificationPermission === 'blocked') {
          // Notification is blocked - show persistent warning
        }
      }

      // Check location permission (for UI state)
      // Actual location fetching is handled by LocationContext
      await checkLocationPermission();
    };

    initializePermissions();
  }, [checkLocationPermission, checkNotificationPermission, requestNotificationPermission]);

  // Handle location change - no longer needed as we use global context
  // Kept for compatibility but now just logs
  const handleLocationChange = useCallback((location) => {
    console.log('[UserHomeScreen] Location updated from context');
  }, []);

  // Animate map to selected service location (marker + camera fly)
  useEffect(() => {
    if (
      serviceLocation &&
      serviceLocation.isCurrentLocation !== true &&
      serviceLocation.latitude &&
      serviceLocation.longitude
    ) {
      console.log('[UserHomeScreen] Flying map to service location:', serviceLocation.shortAddress || serviceLocation.address);
      mapRef.current?.animateToLocation(serviceLocation, 1000);
    }
  }, [serviceLocation]);

  const handleServiceSelect = (service) => {
    // "Coming Soon": no bookable provider for this category yet — don't start a
    // request; show a friendly dialog and never expose provider counts.
    if (isCategoryComingSoon(service.id)) {
      dialog(
        t('userHome.comingSoonTitle') || 'Coming Soon',
        t('userHome.comingSoonMsg') || 'This service is coming soon to your city. Please check back shortly!',
        [{ text: t('common.ok') || 'OK', style: 'default' }]
      );
      return;
    }

    // Only block for verification if profile has fully loaded and user is genuinely unverified
    // Don't show verification popup while data is still loading — bad UX
    if (profileReady && !isVerified) {
      dialog(t('userHome.verificationRequired'), t('userHome.verificationRequiredMsg'), [
        { text: t('common.later'), style: 'cancel' },
        { text: t('userHome.verifyNow'), onPress: () => navigation.navigate('Profile') },
      ]);
      return;
    }

    // Check if location services are enabled — show popup if GPS is off
    if (!locationServicesEnabled && !currentLocation) {
      dialog(
        t('userHome.locationOff'),
        t('userHome.locationOffMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('userHome.enableLocation'),
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
                  Linking.openSettings();
                });
              }
            },
          },
          {
            text: t('userHome.continueAnyway'),
            onPress: () => {
              setSelectedService(service);
              setStep('date');
              animateSheetTo(safeMaxHeight);
              // Analytics: same funnel entry as the normal path below
              scheduleTrackedRef.current = false;
              Analytics.track(EV.SERVICE_SELECTED, { role: 'user', service_type: service.id });
              Analytics.track(EV.BOOKING_STARTED, { role: 'user', service_type: service.id, entry: 'home' });
            },
          },
        ]
      );
      return;
    }

    setSelectedService(service);
    setStep('date');
    animateSheetTo(safeMaxHeight);

    // Analytics: category chosen (all gates passed) — this also begins the
    // inline booking flow on this screen. Reset the per-flow schedule guard.
    scheduleTrackedRef.current = false;
    Analytics.track(EV.SERVICE_SELECTED, { role: 'user', service_type: service.id });
    Analytics.track(EV.BOOKING_STARTED, { role: 'user', service_type: service.id, entry: 'home' });
  };

  // Handle date/time selection from DateTimePicker.
  // The picker calls this on EVERY tap (date, time slot, quick-select) — track
  // schedule_selected once per booking flow, or it fires 2-N times per booking
  // and inflates the Meta standard `Schedule` optimization signal.
  const handleDateTimeChange = useCallback((dateTime) => {
    setSelectedDateTime(dateTime);
    if (dateTime?.date && !scheduleTrackedRef.current) {
      scheduleTrackedRef.current = true;
      Analytics.track(EV.SCHEDULE_SELECTED, {
        role: 'user',
        is_instant: dateTime.isInstant ? 'true' : 'false',
      });
    }
  }, []);

  // Handle location selection from LocationPicker
  const handleServiceLocationChange = useCallback((location) => {
    setServiceLocation(location);
    if (location) {
      Analytics.track(EV.LOCATION_SELECTED, { role: 'user', source: 'booking_picker' });
    }
  }, []);

  const handleCreateRequest = async () => {
    if (!selectedService || !selectedDateTime) {
      dialog(t('common.error'), t('userHome.selectDateTime'));
      return;
    }

    // Booking gate — a name and a verified phone are required to book.
    if (!ensureBookingProfileComplete()) {
      return;
    }

    // Determine location to use:
    // 1. If user explicitly selected "Other Location" (saved addr, search, map pin) → use those coordinates
    // 2. Otherwise → use current GPS location
    // CRITICAL: Check for latitude/longitude presence, not just isCurrentLocation flag
    const hasServiceLocation = serviceLocation &&
      serviceLocation.latitude &&
      serviceLocation.longitude &&
      serviceLocation.isCurrentLocation !== true; // undefined or false both count as "other"

    const locationToUse = hasServiceLocation ? serviceLocation : currentLocation;

    if (!locationToUse) {
      // No location at all — GPS might be off
      if (!locationServicesEnabled) {
        dialog(
          t('userHome.locationRequired'),
          t('userHome.locationRequiredGpsMsg'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('userHome.enableGps'),
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
                    Linking.openSettings();
                  });
                }
              },
            },
          ]
        );
      } else {
        dialog(t('userHome.locationRequired'), t('userHome.locationRequiredDetecting'));
      }
      return;
    }

    // Validate location has actual coordinates (not just loading/partial)
    if (!locationToUse.latitude || !locationToUse.longitude) {
      dialog(t('userHome.locationIncomplete'), t('userHome.locationIncompleteMsg'));
      return;
    }

    // Build a descriptive service address
    const serviceAddr = hasServiceLocation
      ? (serviceLocation.address || serviceLocation.shortAddress || serviceLocation.addressLine1 || null)
      : null;

    setCreatingRequest(true);
    try {
      const result = await createServiceRequest({
        userId,
        serviceType: selectedService.id,
        latitude: locationToUse.latitude,
        longitude: locationToUse.longitude,
        serviceDate: selectedDateTime.date,
        serviceTime: selectedDateTime.time,
        serviceAddress: serviceAddr,
        isOtherLocation: hasServiceLocation,
        description: serviceDescription || null,
        isInstant: selectedDateTime.isInstant || false, // Pass instant flag
      });
      if (result.success) {
        setCreatedRequest(result.request);
        const alertMessage = t('userHome.requestCreatedMsg');
        dialog(t('userHome.requestCreated'), alertMessage, [
          { text: t('common.later'), onPress: resetFlow },
          { text: t('userHome.findProviders'), onPress: () => fetchProviders(result.request._id) },
        ]);
      } else if (result.code === 'OUTSIDE_SERVICE_ZONE') {
        dialog(
          t('userHome.outsideServiceZone'),
          result.suggestion || t('userHome.outsideServiceZoneMsg'),
          [{ text: t('common.ok'), onPress: resetFlow }]
        );
      } else if (result.code === 'RATE_LIMITED' && result.retryAfter) {
        dialog(t('userHome.rateLimited'), t('userHome.rateLimitedMsg', { seconds: result.retryAfter }));
      } else if (handleProfileIncompleteError(result)) {
        // Backend 403 PROFILE_INCOMPLETE — dialog shown, nothing else to do
      } else {
        dialog(t('common.error'), result.error || t('userHome.createRequestFailed'));
      }
    } catch (error) {
      dialog(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setCreatingRequest(false);
    }
  };

  const fetchProviders = async (requestId) => {
    setFetchingProviders(true);
    setStep('providers');
    try {
      const result = await getNearbyProviders(requestId);
      if (result.success) {
        // Check if all providers have been rejected
        if (result.code === 'ALL_PROVIDERS_REJECTED') {
          setProviders([]);
          setAllProvidersRejected(true);
          dialog(
            t('userHome.allProvidersReviewed'),
            result.suggestion || t('userHome.allProvidersReviewedMsg'),
          );
        } else {
          setAllProvidersRejected(false);
          setProviders(result.providers || []);
          setSearchRadius(result.searchRadius || 0);
          if (!result.providers?.length) dialog(t('userHome.noProviders'), t('userHome.noProvidersMsg', { distance: formatDistanceFromMeters(result.searchRadius, useKm) }));
        }
      } else {
        dialog(t('common.error'), result.error || t('userHome.findProvidersFailed'));
      }
    } catch (error) {
      dialog(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setFetchingProviders(false);
    }
  };

  /**
   * Retry / Fresh search for providers.
   * - If allProvidersRejected: calls retryProviderSearch() which clears rejectedProviders
   *   on the backend, then returns a fresh provider list.
   * - Otherwise: re-fetches getNearbyProviders (skipped providers remain excluded).
   */
  const handleRetrySearch = async () => {
    if (!createdRequest?._id) return;

    setFetchingProviders(true);
    try {
      if (allProvidersRejected) {
        // Step 1: Clear rejected list on backend
        const resetResult = await retryProviderSearch(createdRequest._id, userId);
        if (!resetResult.success) {
          dialog(t('common.error'), resetResult.error || t('userHome.failedResetSearch'));
          setFetchingProviders(false);
          return;
        }
        // Step 2: Now fetch fresh providers (rejected list is cleared)
      }

      // Fetch providers — either fresh (after reset) or normal re-fetch
      const result = await getNearbyProviders(createdRequest._id);

      if (result.success) {
        if (result.code === 'ALL_PROVIDERS_REJECTED') {
          setProviders([]);
          setAllProvidersRejected(true);
          dialog(
            t('userHome.allProvidersReviewed'),
            result.suggestion || t('userHome.allProvidersReviewedMsg'),
          );
        } else {
          setAllProvidersRejected(false);
          setProviders(result.providers || []);
          setSearchRadius(result.searchRadius || 0);
          setContactedProviderIds(new Set()); // Reset contacted state for fresh list
          if (!result.providers?.length) {
            dialog(t('userHome.noProviders'), t('userHome.noProvidersAvailable'));
          }
        }
      } else {
        dialog(t('userHome.noProviders'), result.error || t('userHome.noProvidersError'));
      }
    } catch (error) {
      dialog(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setFetchingProviders(false);
    }
  };

  // Direct call state
  const [callingProviderId, setCallingProviderId] = useState(null);
  const [contactedProviderIds, setContactedProviderIds] = useState(new Set());
  // Skip provider state
  const [skippingProviderId, setSkippingProviderId] = useState(null);

  // Cancel reason modal state
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);

  /**
   * Skip/Remove a provider from the list.
   * Backend adds them to rejectedProviders and returns a replacement (if available).
   * The replacement slides into the list in place of the skipped provider.
   */
  const handleSkipProvider = (provider) => {
    dialog(
      t('userHome.skipProvider'),
      t('userHome.skipProviderMsg', { name: provider.name || 'this provider' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('userHome.skip'),
          style: 'destructive',
          onPress: async () => {
            if (!createdRequest?._id) return;
            // Set loading immediately so spinner shows while dialog closes
            setSkippingProviderId(provider._id);
            try {
              // Send all currently-visible provider IDs so backend excludes them
              const currentProviderIds = providers.map(p => p._id);

              const result = await skipProvider(
                createdRequest._id,
                provider._id,
                currentProviderIds
              );

              if (result.success) {
                setProviders(prev => {
                  // Remove the skipped provider
                  const filtered = prev.filter(p => p._id !== provider._id);
                  // If backend returned a replacement, append it
                  if (result.replacement) {
                    return [...filtered, result.replacement];
                  }
                  return filtered;
                });

                // Remove from contacted set (no longer relevant)
                setContactedProviderIds(prev => {
                  const next = new Set(prev);
                  next.delete(provider._id);
                  return next;
                });

                // Inform user if queue is exhausted
                if (result.meta?.queueExhausted) {
                  // No toast or alert — the empty list component handles this
                }
              } else {
                dialog(t('common.error'), result.error || t('userHome.skipFailed'));
              }
            } catch (error) {
              dialog(t('common.error'), t('common.somethingWentWrong'));
            } finally {
              setSkippingProviderId(null);
            }
          },
        },
      ]
    );
  };

  /**
   * Direct phone call to provider - opens native dialer
   * Checks multiple phone fields to handle data inconsistencies
   */
  const handleCallProvider = (provider) => {
    // Robust phone resolution: check all possible phone fields
    const phone = provider?.phone || provider?.verifiedPhone || provider?.mobileNumber || '';
    const cleanPhone = phone.replace(/[\s\-()]/g, '');

    if (!cleanPhone) {
      dialog(
        t('userHome.phoneNotAvailable'),
        t('userHome.phoneNotAvailableMsg'),
        [{ text: t('common.ok') }]
      );
      return;
    }

    dialog(
      t('userHome.callProvider'),
      t('userHome.callProviderMsg', { name: provider.name || 'Provider', phone }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.callNow'),
          onPress: () => {
            setContactedProviderIds(prev => new Set(prev).add(provider._id));
            Linking.openURL(`tel:${cleanPhone}`).catch(() => {
              dialog(t('common.error'), t('userHome.unableToCall'));
            });
          },
        },
      ]
    );
  };

  /**
   * Open provider details modal
   * The modal handles its own loading and fetching
   */
  const handleViewProviderDetails = (provider) => {
    // Store provider for booking reference and open modal
    // Modal will fetch full details using providerId
    console.log('[UserHomeScreen] Opening provider details:', {
      _id: provider._id,
      id: provider.id,
      name: provider.name
    });
    setSelectedProvider(provider);
    setProviderDetailsVisible(true);
  };

  /**
   * Handle booking from provider details modal
   */
  const handleBookFromDetails = (provider) => {
    setProviderDetailsVisible(false);
    handleBookProvider(provider);
  };

  const executeBookProvider = async (provider) => {
    // bookingProvider may already be set by handleBookProvider — safe to re-set
    setBookingProvider(provider._id);
    try {
      // Pass distance from provider object (from getNearbyProviders response)
      const result = await sendRequestToProvider(createdRequest._id, provider._id, provider.distance);
      if (result.success) {
        dialog(t('userHome.requestSent'), t('userHome.requestSentMsg', { name: provider.name }), [{ text: t('common.ok'), onPress: resetFlow }]);
      } else {
        dialog(t('common.error'), result.error || t('userHome.sendRequestFailed'));
      }
    } catch (error) {
      dialog(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setBookingProvider(null);
    }
  };

  const handleBookProvider = async (provider) => {
    if (!createdRequest?._id) { dialog(t('common.error'), t('userHome.requestNotFound')); return; }
    if (!contactedProviderIds.has(provider._id)) {
      // Show confirmation popup instead of blocking
      dialog(
        t('userHome.contactFirst'),
        t('userHome.contactFirstMsg'),
        [
          { text: t('userHome.callProvider'), onPress: () => handleCallProvider(provider) },
          {
            text: t('userHome.bookAnyway'),
            onPress: () => {
              // Set loading immediately so spinner shows while dialog closes
              setBookingProvider(provider._id);
              executeBookProvider(provider);
            },
            style: 'default',
          },
          { text: t('common.cancel'), style: 'cancel' },
        ]
      );
      return;
    }
    // Set loading immediately for contacted providers too
    setBookingProvider(provider._id);
    executeBookProvider(provider);
  };

  const resetFlow = () => {
    // Switch step immediately — the services view is already mounted (always rendered)
    // so the swap is instant. The date view stays mounted (selectedService still set)
    // until cleanup, so its display: 'none' simply hides it without remounting later.
    setStep('select');
    snapToHeight(SHEET_MID_HEIGHT);
    // Clear request-related state immediately
    setSelectedDateTime(null);
    setServiceLocation(null);
    setServiceDescription('');
    setCreatedRequest(null);
    setProviders([]);
    setProviderDetailsVisible(false);
    setSelectedProvider(null);
    setContactedProviderIds(new Set());
    setSkippingProviderId(null);
    setAllProvidersRejected(false);
    // Clear selectedService AFTER the sheet animation finishes (so date view
    // doesn't unmount mid-transition causing a flicker). We use a long enough
    // delay to cover the spring settling time.
    setTimeout(() => setSelectedService(null), 350);
    // Return map camera to user's GPS location
    mapRef.current?.animateToUserLocation(currentLocation);
  };

  /**
   * Cancel the current request — opens reason modal first
   */
  const handleCancelRequest = async () => {
    if (!createdRequest?._id) {
      // No request created yet, just go back
      resetFlow();
      return;
    }
    // Open cancellation reason modal instead of a bare Alert
    setCancelModalVisible(true);
  };

  /**
   * Execute cancellation after user selects a reason
   */
  const executeCancellation = async (reason) => {
    setCancellingRequest(true);
    try {
      const result = await cancelRequest(createdRequest._id, userId, reason);
      setCancelModalVisible(false);
      if (result.success) {
        dialog(t('userHome.requestCancelled'), t('userHome.requestCancelledMsg'), [
          { text: t('common.ok'), onPress: resetFlow }
        ]);
      } else {
        dialog(t('common.error'), result.error || t('userHome.cancelFailed'));
      }
    } catch (error) {
      dialog(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setCancellingRequest(false);
    }
  };

  const handleLogout = async () => await logout();
  const handleProfilePress = () => navigation.navigate('Profile');

  // Render the select view as the base layer (always mounted, takes the layout space).
  // Date view slides up from below to cover it. Providers view replaces both.
  // This keeps the expensive services view (12 SVG cards) mounted across step
  // changes, eliminating the ~1s delay caused by remounting the SVG icons.
  const renderSheetContent = () => {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND.white, overflow: 'hidden' }}>
        {/* SELECT STEP — always mounted, base layer */}
        <View style={{ flex: 1 }}>
          {renderSelectStep()}
        </View>
        {/* DATE STEP — slides up from below */}
        {selectedService && (
          <Animated.View
            style={[
              styles.absoluteFill,
              { backgroundColor: BRAND.white, transform: [{ translateY: dateStepTranslateY }] },
            ]}
            pointerEvents={step === 'date' ? 'auto' : 'none'}
          >
            {renderDateStep()}
          </Animated.View>
        )}
        {/* PROVIDERS STEP — overlay when there's a created request */}
        {createdRequest && (
          <View style={[styles.absoluteFill, step !== 'providers' && styles.hidden]}>
            {renderProvidersStep()}
          </View>
        )}
      </View>
    );
  };

  const renderDateStep = () => {
    if (!selectedService) return null;
    return (
      <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false} bounces={false}>
            {/* Header: Back + Selected Service (compact row) */}
            <View style={styles.dateStepHeader}>
              <TouchableOpacity style={styles.backRow} onPress={resetFlow}>
                <View style={styles.backPill}>
                  <Icon name="arrow_back" size={18} color={BRAND.secondary} />
                  <Text style={styles.backText}>{t('common.back')}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.dateStepServiceChip}>
                <ServiceIcon serviceType={selectedService.id} size={20} color={BRAND.secondary} />
                <Text style={styles.dateStepServiceName} numberOfLines={1}>{selectedService.name}</Text>
              </View>
            </View>

            {/* Service Location Card — always visible at top of sheet (like Ola destination) */}
            <View style={styles.serviceAtCard}>
              <View style={styles.serviceAtIconCol}>
                {/* "From" dot */}
                <View style={styles.serviceAtDotBlue} />
                <View style={styles.serviceAtDottedLine} />
                {/* "To" pin */}
                <MaterialIcon name="place" size={22} color={BRAND.primary} />
              </View>
              <View style={styles.serviceAtInfoCol}>
                {/* Current location row */}
                <View style={styles.serviceAtRow}>
                  <Text style={styles.serviceAtRowLabel}>{t('userHome.yourLocation')}</Text>
                  <Text style={styles.serviceAtRowValue} numberOfLines={1}>
                    {displayAddress || (currentLocation ? t('userHome.locationDetected') : t('userHome.detecting'))}
                  </Text>
                </View>
                <View style={styles.serviceAtRowDivider} />
                {/* Service location row */}
                <View style={styles.serviceAtRow}>
                  <Text style={styles.serviceAtRowLabel}>{t('userHome.serviceAt')}</Text>
                  <Text style={[styles.serviceAtRowValue, serviceLocation && serviceLocation.isCurrentLocation !== true && { color: BRAND.primary, fontWeight: '700' }]} numberOfLines={1}>
                    {serviceLocation && serviceLocation.isCurrentLocation !== true
                      ? (serviceLocation.shortAddress || serviceLocation.address || t('userHome.selectedAddress'))
                      : (displayAddress || t('userHome.sameAsLocation'))}
                  </Text>
                </View>
              </View>
              {/* Show on map button */}
              {serviceLocation && serviceLocation.isCurrentLocation !== true && serviceLocation.latitude && (
                <TouchableOpacity
                  style={styles.serviceAtMapBtn}
                  onPress={() => {
                    animateSheetTo(SHEET_MIN_HEIGHT);
                    setTimeout(() => mapRef.current?.animateToLocation(serviceLocation, 800), 200);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcon name="map" size={20} color={BRAND.secondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Date & Time Picker */}
            <DateTimePicker
              onDateTimeChange={handleDateTimeChange}
              initialDate={selectedDateTime?.date}
              initialTime={selectedDateTime?.time}
            />

            {/* Location Picker — Change Service Location */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>{t('userHome.changeServiceLocation')}</Text>
            <LocationPicker
              onLocationChange={handleServiceLocationChange}
              currentLocation={currentLocation}
              currentLocationAddress={displayAddress}
            />

            {/* Create Request Button */}
            <View style={styles.createButtonContainer}>
              {/* Location status hint */}
              {!currentLocation && !serviceLocation && !locationServicesEnabled && (
                <View style={styles.locationHintRow}>
                  <MaterialIcon name="location-off" size={16} color="#EF4444" />
                  <Text style={[styles.locationHintText, { color: '#EF4444' }]}>{t('userHome.gpsOffHint')}</Text>
                </View>
              )}
              {!currentLocation && !serviceLocation && locationServicesEnabled && (
                <View style={styles.locationHintRow}>
                  <ActivityIndicator size="small" color="#94A3B8" />
                  <Text style={styles.locationHintText}>{t('userHome.detectingHint')}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.createButton, (!selectedDateTime || (!currentLocation && !serviceLocation)) && styles.createButtonDisabled]}
                onPress={handleCreateRequest}
                disabled={!selectedDateTime || creatingRequest || (!currentLocation && !serviceLocation)}
              >
                {creatingRequest ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcon name="check-circle" size={22} color="#FFFFFF" />
                    <Text style={styles.createButtonText}>{t('userHome.createRequest')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
    );
  };

  const renderProvidersStep = () => {
    return (
      <View style={styles.sheetContent}>
            <View style={styles.providersHeader}>
              <View style={styles.providerHeaderActions}>
                {/* No "Done" button — it would leave the request in pending with no provider assigned.
                    After booking, the success Alert already calls resetFlow automatically. */}
                <TouchableOpacity style={styles.cancelPill} onPress={handleCancelRequest}>
                  <MaterialIcon name="cancel" size={16} color="#FFFFFF" />
                  <Text style={styles.cancelPillText}>{t('userHome.cancelRequest')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.providersTitle}>{fetchingProviders ? t('userHome.findingProviders') : t('userHome.providersFound', { count: providers.length })}</Text>
              {searchRadius > 0 && (
                <View style={styles.radiusPill}>
                  <Icon name="location" size={13} color={BRAND.secondary} />
                  <Text style={styles.radiusPillText}>{t('userHome.within')} {formatDistanceFromMeters(searchRadius, useKm)}</Text>
                </View>
              )}
              {/* Contact-first tip */}
              {!fetchingProviders && providers.length > 0 && (
                <View style={styles.providerTipRow}>
                  <MaterialIcon name="info-outline" size={18} color="#D97706" />
                  <Text style={styles.providerTipText}>{t('userHome.tipText')}</Text>
                </View>
              )}
            </View>
            {fetchingProviders ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={BRAND.primary} />
                <Text style={styles.loadingText}>{t('userHome.searchingProviders')}</Text>
              </View>
            ) : (
              <FlatList
                data={providers}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <ProviderCard
                    provider={item}
                    onCall={handleCallProvider}
                    onBook={handleBookProvider}
                    onSkip={handleSkipProvider}
                    onPress={() => handleViewProviderDetails(item)}
                    booking={bookingProvider === item._id}
                    contacted={contactedProviderIds.has(item._id)}
                    calling={callingProviderId === item._id}
                    skipping={skippingProviderId === item._id}
                  />
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconWrap}>
                      <FixhomiLogo size={64} color="#CBD5E1" />
                    </View>
                    {allProvidersRejected ? (
                      <>
                        <Text style={styles.emptyText}>{t('userHome.allReviewedTitle')}</Text>
                        <Text style={styles.emptySubtext}>{t('userHome.allReviewedSubtitle')}</Text>
                        <TouchableOpacity
                          style={[styles.retryButton, { backgroundColor: BRAND.primary }]}
                          onPress={handleRetrySearch}
                        >
                          <Icon name="refresh" size={20} color="#FFFFFF" />
                          <Text style={styles.retryButtonText}>{t('userHome.startFreshSearch')}</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={styles.emptyText}>{t('userHome.noProvidersTitle')}</Text>
                        <Text style={styles.emptySubtext}>{t('userHome.noProvidersSubtitle')}</Text>
                        <TouchableOpacity
                          style={styles.retryButton}
                          onPress={handleRetrySearch}
                        >
                          <Icon name="refresh" size={20} color="#FFFFFF" />
                          <Text style={styles.retryButtonText}>{t('userHome.retrySearch')}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                }
                contentContainerStyle={styles.providersList}
                showsVerticalScrollIndicator={false}
              />
            )}
      </View>
    );
  };

  const renderSelectStep = () => {
    return (
      <ScrollView
            ref={scrollViewRef}
            style={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
            contentContainerStyle={[
              styles.servicesScrollContent,
              // Extra bottom padding when collapsed so user can scroll past the visible 40% window
              !sheetExpanded && { paddingBottom: (safeMaxHeight - SHEET_MID_HEIGHT) + 40 },
            ]}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
          >
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>{displayData?.fullName?.split(' ')[0] ? t('userHome.hello', { name: displayData.fullName.split(' ')[0] }) : t('userHome.helloDefault')}</Text>
              <Text style={styles.welcomeSubtext}>{t('userHome.whatServiceNeeded')}</Text>
            </View>

            {/* Quick Access Buttons */}
            <View style={styles.quickAccessRow}>
              <QuickAccessCard
                imageSource={Emergency3D}
                label={t('userHome.emergency')}
                borderColor="#FECACA"
                bgColor="#FEF2F2"
                iconBg="rgba(220, 38, 38, 0.08)"
                onPress={() => navigation.navigate('EmergencyServices')}
              />
              <QuickAccessCard
                imageSource={Events3D}
                label={t('userHome.events')}
                borderColor="#C7D2FE"
                bgColor="#EEF2FF"
                iconBg="rgba(124, 58, 237, 0.08)"
                onPress={() => navigation.navigate('EventServices')}
              />
              <QuickAccessCard
                imageSource={Favorites3D}
                label={t('userHome.favorites')}
                borderColor="#FDE68A"
                bgColor="#FFFBEB"
                iconBg="rgba(245, 158, 11, 0.1)"
                onPress={() => navigation.navigate('Favorites')}
              />
            </View>

            <Text style={styles.servicesSectionTitle}>{t('userHome.traditionalServices')}</Text>
            <View style={styles.servicesGrid}>
              {orderedServiceCategories.map((service) => (
                <ServiceCard key={service.id} service={service} onPress={handleServiceSelect} comingSoon={isCategoryComingSoon(service.id)} />
              ))}
            </View>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => navigation.navigate('HistoryTab')}
              >
                <MaterialIcon name="history" size={20} color="#475569" />
                <Text style={styles.quickActionText}>{t('userHome.viewHistory')}</Text>
              </TouchableOpacity>
            </View>

            {/* Brand footer — edge-to-edge art at the end of the sheet.
                Explicit numeric sizing inside BrandFooter (no zoom/crop on
                any device); short top fade merges the sheet's white into the
                sky, ending above the headline. Also provides the tab-bar
                scroll clearance. */}
            <BrandFooter
              source={require('../assets/brand_footer_user.jpg')}
              fadeColor="#FFFFFF"
              style={styles.brandFooterWrap}
            />
          </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <LocationMap
        ref={mapRef}
        onLocationChange={handleLocationChange}
        showUserLocation
        showSearchRadius={step === 'providers'}
        searchRadius={searchRadius}
        externalLocation={currentLocation}
        selectedLocation={
          serviceLocation &&
          serviceLocation.isCurrentLocation !== true &&
          serviceLocation.latitude &&
          serviceLocation.longitude
            ? serviceLocation
            : null
        }
      />

      {/* Permission Warning Bars */}
      {(locationPermission === 'denied' || locationPermission === 'blocked') && locationServicesEnabled && (
        <View style={[styles.permissionBar, { top: insets.top + 60 }]}>
          <View style={styles.permissionBarIconWrap}>
            <Icon name="location" size={18} color="#F59E0B" />
          </View>
          <Text style={styles.permissionBarText}>
            {t('userHome.locationPermBar')}
          </Text>
          <TouchableOpacity
            style={styles.permissionBarButton}
            onPress={locationPermission === 'blocked' ? () => openSettings() : requestLocationPermission}
          >
            <Text style={styles.permissionBarButtonText}>
              {locationPermission === 'blocked' ? t('userHome.settings') : t('userHome.enable')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {!locationServicesEnabled && (
        <View style={[styles.permissionBar, { top: insets.top + ((locationPermission === 'denied' || locationPermission === 'blocked') && locationServicesEnabled ? 110 : 60) }]}>
          <View style={styles.permissionBarIconWrap}>
            <Icon name="location" size={18} color="#F59E0B" />
          </View>
          <Text style={styles.permissionBarText}>
            {t('userHome.locationOffBar')}
          </Text>
          <TouchableOpacity
            style={styles.permissionBarButton}
            onPress={() => openSettings()}
          >
            <Text style={styles.permissionBarButtonText}>{t('userHome.settings')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {notificationPermission === 'blocked' && (
        <View style={[styles.permissionBar, styles.permissionBarDanger, { top: insets.top + ((locationPermission === 'denied' || locationPermission === 'blocked') || !locationServicesEnabled ? 110 : 60) }]}>
          <View style={[styles.permissionBarIconWrap, { backgroundColor: '#FEE2E2' }]}>
            <Icon name="notification" size={18} color="#EF4444" />
          </View>
          <Text style={[styles.permissionBarText, styles.permissionBarTextDanger]}>
            {t('userHome.notificationBar')}
          </Text>
          <TouchableOpacity
            style={[styles.permissionBarButton, styles.permissionBarButtonDanger]}
            onPress={() => openSettings()}
          >
            <Text style={[styles.permissionBarButtonText, styles.permissionBarButtonTextDanger]}>{t('userHome.settings')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Top Bar - Premium frosted glass */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => setIsDrawerOpen(true)} activeOpacity={0.7} style={styles.topBarLogoBtn}>
          <Image source={FIXHOMI_LOGO} style={styles.topBarLogoImg} />
        </TouchableOpacity>
        <View style={styles.topBarSpacer} />
        {/* Help & Support */}
        <HelpSupportButton size={24} color="#f67c16" style={styles.addressManageButton} />
        {/* Address Management Icon */}
        <TouchableOpacity
          style={styles.addressManageButton}
          onPress={() => navigation.navigate('Profile', { scrollToAddresses: true })}
          activeOpacity={0.7}
        >
          <MaterialIcon name="bookmark" size={22} color="#475569" />
        </TouchableOpacity>
        <AvatarButton
          name={displayData?.fullName}
          profilePicture={displayData?.profilePicture}
          onPress={handleProfilePress}
          isProvider={false}
        />
      </View>

      {/* Bottom Sheet */}
      <Animated.View style={[styles.bottomSheet, { height: safeMaxHeight, paddingBottom: 8, transform: [{ translateY: sheetTranslateY }] }]}>
        <SvgArt color="#f67c16" height={100} />
        <View style={styles.sheetHandle} {...panResponder.panHandlers}>
          <View style={styles.sheetHandleBar} />
        </View>
        {renderSheetContent()}
      </Animated.View>
      <DrawerMenu visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} user={displayData} userType={userType} navigation={navigation} onLogout={handleLogout} isVerified={isVerified} activeTab="home" />

      {/* Notification Permission Required Modal */}
      <Modal
        visible={notificationPermission === 'blocked'}
        animationType="fade"
        transparent
        statusBarTranslucent
      >
        <View style={styles.permissionModalOverlay}>
          <View style={styles.permissionModalContent}>
            <View style={styles.permissionModalIcon}>
              <Icon name="notification" size={48} color="#EF4444" />
            </View>
            <Text style={styles.permissionModalTitle}>{t('userHome.notifModalTitle')}</Text>
            <Text style={styles.permissionModalMessage}>
              {t('userHome.notifModalMsg')}
            </Text>
            <TouchableOpacity
              style={styles.permissionModalButton}
              onPress={() => openSettings()}
            >
              <Text style={styles.permissionModalButtonText}>{t('userHome.notifModalBtn')}</Text>
            </TouchableOpacity>
            <Text style={styles.permissionModalNote}>
              {t('userHome.notifModalNote')}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Provider Details Modal */}
      <ProviderDetailsModal
        visible={providerDetailsVisible}
        providerId={selectedProvider?._id || selectedProvider?.id}
        onClose={() => {
          setProviderDetailsVisible(false);
          setSelectedProvider(null);
        }}
        onBook={() => {
          if (selectedProvider) {
            handleBookFromDetails(selectedProvider);
          }
        }}
        onCall={(phone) => {
          // Called from ProviderDetailsModal with the freshly-fetched phone number
          // Use the phone arg directly since it comes from the details endpoint (latest data)
          // Fall back to selectedProvider data if phone arg is empty
          if (phone) {
            const phoneNumber = phone.replace(/[\s\-()]/g, '');
            dialog(
              t('userHome.callProvider'),
              t('userHome.callProviderMsg', { name: selectedProvider?.name || 'Provider', phone }),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('common.callNow'),
                  onPress: () => {
                    if (selectedProvider) {
                      setContactedProviderIds(prev => new Set(prev).add(selectedProvider._id));
                    }
                    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
                      dialog(t('common.error'), t('userHome.unableToCall'));
                    });
                  },
                },
              ]
            );
          } else if (selectedProvider) {
            handleCallProvider(selectedProvider);
          }
        }}
        hasContacted={selectedProvider ? contactedProviderIds.has(selectedProvider._id) : false}
      />

      {/* Cancellation Reason Modal */}
      <CancellationReasonModal
        visible={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        onSubmit={executeCancellation}
        cancellerRole="user"
        loading={cancellingRequest}
        serviceName={selectedService?.name}
      />

      {/* Post-signup phone verification prompt (Google/Apple users, no phone).
          Gated on profileReady && no phone anywhere, so it can never flash for
          users whose phone simply hasn't loaded yet. */}
      <PhoneOnboardingSheet
        visible={(() => {
          if (!phoneOnboardingPending || isAuthLoading || isProfileLoading || profile === null) return false;
          // del_ tombstones and whitespace count as "no phone" — mirrors the
          // server booking gate (serviceHelpers: del_ prefix = phone-less).
          const p = String(user?.phone || profile?.phone || '').trim();
          return !p || p.startsWith('del_');
        })()}
        onDismiss={() => setPhoneOnboardingPending(false)}
        bottomInset={insets.bottom}
      />
    </View>
  );
};

// QuickAccessCard sub-component with press animation
const QuickAccessCard = ({ iconName, iconColor, label, borderColor, bgColor, iconBg, onPress, SvgIcon, imageSource }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();

  return (
    <Animated.View style={[{ flex: 1, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[styles.quickAccessCard, { backgroundColor: bgColor, borderColor }]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.85}
      >
        {imageSource ? (
          // 3D squircle tile IS the icon — no tinted circle behind it (a white
          // tile floating on a colored circle reads as a double background).
          <Image
            source={imageSource}
            style={{ width: 48, height: 48, borderRadius: 14, marginBottom: 4 }}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.quickAccessIconContainer, { backgroundColor: iconBg }]}>
            {SvgIcon ? <SvgIcon size={32} /> : <Icon name={iconName} size={24} color={iconColor} />}
          </View>
        )}
        <Text style={styles.quickAccessLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  hidden: {
    display: 'none',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BRAND.white,
  },

  // ─── Top Bar ───────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
    paddingBottom: 12,
  },
  topBarLogoBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: BRAND.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BRAND.primary + '30',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  topBarLogoImg: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  topBarSpacer: {
    flex: 1,
  },
  addressManageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  // ─── Bottom Sheet ──────────────────────────────────────────
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BRAND.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    zIndex: 5,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  sheetHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    minHeight: 44,
  },
  sheetHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // ─── Date Step ─────────────────────────────────────────────
  dateStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BRAND.secondary + '10',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND.secondary + '20',
  },
  backText: {
    fontSize: 14,
    color: BRAND.secondary,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  dateStepServiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  dateStepServiceName: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.secondary,
    maxWidth: 110,
  },

  // ─── Service At Card ───────────────────────────────────────
  serviceAtCard: {
    flexDirection: 'row',
    backgroundColor: BRAND.white,
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  serviceAtIconCol: {
    alignItems: 'center',
    width: 26,
    marginRight: 14,
    paddingTop: 4,
  },
  serviceAtDotBlue: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    borderWidth: 2.5,
    borderColor: '#93C5FD',
  },
  serviceAtDottedLine: {
    width: 2,
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 4,
    minHeight: 20,
  },
  serviceAtInfoCol: {
    flex: 1,
  },
  serviceAtRow: {
    paddingVertical: 7,
  },
  serviceAtRowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  serviceAtRowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  serviceAtRowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  serviceAtMapBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.secondary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: BRAND.secondary + '20',
  },

  // ─── Location Hint ─────────────────────────────────────────
  locationHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 6,
  },
  locationHintText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // ─── Section Titles / Dividers ─────────────────────────────
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },

  // ─── Create Request Button ─────────────────────────────────
  createButtonContainer: {
    paddingVertical: 20,
    paddingBottom: 40,
  },
  createButton: {
    backgroundColor: BRAND.primary,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: BRAND.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  createButtonDisabled: {
    backgroundColor: '#CBD5E1',
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  // ─── Welcome Section ──────────────────────────────────────
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  welcomeSubtext: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },

  // ─── Quick Access ──────────────────────────────────────────
  quickAccessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 10,
  },
  quickAccessCard: {
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  quickAccessIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickAccessLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.2,
  },

  // ─── Services Section ─────────────────────────────────────
  servicesSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  // Card — clean flat surface
  comingSoonBadge: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  comingSoonBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  serviceCard: {
    overflow: 'hidden',
    width: SERVICE_CARD_WIDTH,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 6,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  serviceIconWrap: {
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: -0.15,
  },

  // ─── Quick Actions ─────────────────────────────────────────
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: -0.2,
  },
  servicesScrollContent: {
    // The brand footer image is the scroll tail and provides the clearance
    // under the floating tab bar — no synthetic bottom padding needed.
    paddingBottom: 0,
  },
  brandFooterWrap: {
    marginHorizontal: -20, // sheetContent pads 20 — break out to true edge-to-edge
    marginTop: 22,
  },

  // ─── Providers Section ─────────────────────────────────────
  providersHeader: {
    marginBottom: 16,
  },
  providerHeaderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cancelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cancelPillText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  providersTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
    letterSpacing: -0.5,
  },
  radiusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    backgroundColor: BRAND.secondary + '0D',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: BRAND.secondary + '18',
  },
  radiusPillText: {
    fontSize: 13,
    color: BRAND.secondary,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  providerTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  providerTipText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
    fontWeight: '500',
  },
  providersList: {
    paddingBottom: 120,
  },

  // ─── Provider Card ─────────────────────────────────────────
  providerCard: {
    backgroundColor: BRAND.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: {
        elevation: 4,
        borderWidth: 1,
        borderColor: '#F1F5F9',
      },
    }),
  },
  providerCardSkipping: {
    opacity: 0.5,
  },
  providerDecor1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(43,118,188,0.04)',
  },
  providerDecor2: {
    position: 'absolute',
    bottom: -15,
    left: -15,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(246,124,22,0.03)',
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  providerAvatarRing: {
    padding: 2,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: BRAND.secondary + '40',
    marginRight: 12,
  },
  providerAvatar: {
    overflow: 'hidden',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerAvatarImage: {
    overflow: 'hidden',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  providerInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.white,
  },
  providerDetails: {
    flex: 1,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  providerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    maxWidth: '60%',
  },
  verifiedBadge: {
    marginLeft: 5,
  },
  contactedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
    gap: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  contactedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  providerDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  providerDistance: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  providerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  providerRating: {
    fontSize: 13,
    color: BRAND.primary,
    fontWeight: '700',
  },
  providerRatingCount: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '400',
  },
  viewDetailsIcon: {
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },

  // ─── Provider Actions ──────────────────────────────────────
  providerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  callButton: {
    // Equal width with "Send Request" (both flex:1) — Skip stays fixed at 46.
    // Icon stays centered/unchanged; only the button width grows. (Task 5)
    flex: 1,
    height: 42,
    backgroundColor: '#10B981',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  callButtonCalling: {
    backgroundColor: '#CBD5E1',
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  bookButton: {
    flex: 1,
    height: 42,
    backgroundColor: BRAND.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  bookButtonLoading: {
    backgroundColor: '#F5A856',
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  skipButton: {
    width: 46,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  skipButtonLoading: {
    opacity: 0.5,
  },

  // ─── Loading / Empty States ────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 14,
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.secondary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 20,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: BRAND.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.white,
    letterSpacing: -0.2,
  },

  // ─── Permission Bars ───────────────────────────────────────
  permissionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  permissionBarDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  permissionBarIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBarText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 18,
  },
  permissionBarTextDanger: {
    color: '#991B1B',
  },
  permissionBarButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  permissionBarButtonDanger: {
    backgroundColor: '#EF4444',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
      },
    }),
  },
  permissionBarButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  permissionBarButtonTextDanger: {
    color: '#FFFFFF',
  },

  // ─── Notification Permission Modal ─────────────────────────
  permissionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 36,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  permissionModalIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  permissionModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  permissionModalMessage: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 28,
  },
  permissionModalButton: {
    backgroundColor: BRAND.secondary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: BRAND.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  permissionModalButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  permissionModalNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default UserHomeScreen;
