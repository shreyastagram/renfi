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
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
  Image,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { LocationMap, Icon, ServiceIcon, DateTimePicker, LocationPicker, ProviderDetailsModal, FixhomiLogo, CancellationReasonModal } from '../components';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';

const FIXHOMI_LOGO = require('../assets/fixhomi_logo.jpg');
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLocation } from '../context/LocationContext';
import {
  createServiceRequest,
  getNearbyProviders,
  sendRequestToProvider,
  cancelRequest,
  getProviderDetails,
  getRequestDetails,
  skipProvider,
  retryProviderSearch,
} from '../services/traditionalServiceService';
import { formatDistance, formatDistanceFromMeters, useDistanceUnit } from '../utils/formatDistance';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Bottom sheet heights
const SHEET_MIN_HEIGHT = 160;
const SHEET_MID_HEIGHT = SCREEN_HEIGHT * 0.40; // 40% for initial state - shows user location
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.80; // Never exceed 80% of screen

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

const ServiceCard = ({ service, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.serviceCard}
        onPress={() => onPress(service)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.85}
      >
        <View style={styles.serviceIconContainer}>
          <ServiceIcon serviceType={service.id} size={26} color={BRAND.secondary} />
        </View>
        <Text style={styles.serviceName}>{service.name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ProviderCard = ({ provider, onCall, onBook, onSkip, onPress, booking, contacted, calling, skipping }) => {
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
              <Text style={styles.contactedBadgeText}>Contacted</Text>
            </View>
          )}
        </View>
        <View style={styles.providerDistanceRow}>
          <Icon name="location" size={14} color="#94A3B8" />
          <Text style={styles.providerDistance}>
            {provider.distanceKm ? `${formatDistance(provider.distanceKm, useKm)} away` :
             typeof provider.distance === 'number' ? `${formatDistanceFromMeters(provider.distance, useKm)} away` :
             'Nearby'}
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
      >
        {calling ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Icon name="phone" size={22} color="#FFFFFF" />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.bookButton, booking && styles.bookButtonLoading]}
        onPress={(e) => {
          e.stopPropagation();
          onBook(provider);
        }}
        disabled={booking}
      >
        {booking ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.bookButtonText}>Send Request</Text>}
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
      >
        {skipping ? (
          <ActivityIndicator size="small" color="#EF4444" />
        ) : (
          <MaterialIcon name="close" size={20} color="#EF4444" />
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

  // Set status bar for light background when this tab is focused
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor('transparent');
    }, [])
  );

  const useKm = useDistanceUnit();
  // Cap sheet max height — 80% of screen ensures it stays below the top bar icons
  const safeMaxHeight = SHEET_MAX_HEIGHT;
  const mapRef = useRef(null);
  const { user, profile, userType, logout, isProfileLoading, isAuthLoading } = useApp();

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
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(null); // Combined date & time
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

  // Animated sheet height
  const sheetHeight = useRef(new Animated.Value(SHEET_MID_HEIGHT)).current;
  const currentHeightRef = useRef(SHEET_MID_HEIGHT);

  // Pan responder for swipe gestures on the bottom sheet handle
  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Very sensitive to vertical movement for easy drag
        return Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        // Store current height when gesture starts
        sheetHeight.stopAnimation((value) => {
          currentHeightRef.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        // Calculate new height based on drag (negative dy = swipe up = increase height)
        const newHeight = Math.max(
          SHEET_MIN_HEIGHT,
          Math.min(safeMaxHeight, currentHeightRef.current - gestureState.dy)
        );
        sheetHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const velocity = gestureState.vy;
        const currentValue = currentHeightRef.current - gestureState.dy;
        const dragDistance = gestureState.dy;

        let targetHeight = SHEET_MID_HEIGHT;

        // Very low velocity threshold for easier swiping in both directions
        if (Math.abs(velocity) > 0.15) {
          if (velocity < 0) {
            // Swiping up fast
            targetHeight = safeMaxHeight;
          } else {
            // Swiping down — always step down one level
            if (currentHeightRef.current >= safeMaxHeight * 0.7) {
              targetHeight = SHEET_MID_HEIGHT;
            } else {
              targetHeight = SHEET_MIN_HEIGHT;
            }
          }
        } else if (Math.abs(dragDistance) > 30) {
          // Even very small drags (30px) should trigger state change
          if (dragDistance > 0) {
            // Dragging down — step down one level
            if (currentHeightRef.current >= safeMaxHeight * 0.7) {
              targetHeight = SHEET_MID_HEIGHT;
            } else {
              targetHeight = SHEET_MIN_HEIGHT;
            }
          } else {
            // Dragging up
            targetHeight = safeMaxHeight;
          }
        } else {
          // Snap to nearest position based on current position
          const midPoint1 = (SHEET_MIN_HEIGHT + SHEET_MID_HEIGHT) / 2;
          const midPoint2 = (SHEET_MID_HEIGHT + safeMaxHeight) / 2;

          if (currentValue < midPoint1) {
            targetHeight = SHEET_MIN_HEIGHT;
          } else if (currentValue < midPoint2) {
            targetHeight = SHEET_MID_HEIGHT;
          } else {
            targetHeight = safeMaxHeight;
          }
        }

        currentHeightRef.current = targetHeight;
        Animated.spring(sheetHeight, {
          toValue: targetHeight,
          useNativeDriver: false,
          friction: 7,
          tension: 50,
          overshootClamping: true,
        }).start();
      },
    }),
  [sheetHeight, safeMaxHeight]);

  // Function to animate sheet to a specific height
  const animateSheetTo = useCallback((targetHeight) => {
    currentHeightRef.current = targetHeight;
    Animated.spring(sheetHeight, {
      toValue: targetHeight,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
      overshootClamping: true,
    }).start();
  }, [sheetHeight]);

  // If a pre-selected service was set from Favorites, animate the sheet up
  useEffect(() => {
    if (pendingPreSelectRef.current) {
      pendingPreSelectRef.current = false;
      // Small delay so the component has re-rendered with the new step
      setTimeout(() => animateSheetTo(safeMaxHeight), 150);
    }
  }, [step, animateSheetTo, safeMaxHeight]);

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
      animateSheetTo(SHEET_MAX_HEIGHT);
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
  const isVerified = displayData?.isPhoneVerified && displayData?.isEmailVerified;

  // Check and request location permission
  const checkLocationPermission = useCallback(async () => {
    try {
      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      const result = await check(permission);

      if (result === RESULTS.GRANTED) {
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
      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      const result = await request(permission);

      if (result === RESULTS.GRANTED) {
        setLocationPermission('granted');
        // Refresh location from global context after permission granted
        refreshLocation();
        return true;
      } else if (result === RESULTS.BLOCKED) {
        setLocationPermission('blocked');
        dialog(
          'Location Permission Required',
          'Please enable location permission in your device settings to use this app effectively.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSettings() }
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
            'Notifications Required',
            'Notifications are required for you to receive updates about your service requests. Please enable them in settings.',
            [
              { text: 'Open Settings', onPress: () => openSettings() }
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
    // Only block for verification if profile has fully loaded and user is genuinely unverified
    // Don't show verification popup while data is still loading — bad UX
    if (profileReady && !isVerified) {
      dialog('Verification Required', 'Please verify your phone and email to book services.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Verify Now', onPress: () => navigation.navigate('Profile') },
      ]);
      return;
    }

    // Check if location services are enabled — show popup if GPS is off
    if (!locationServicesEnabled && !currentLocation) {
      dialog(
        'Location is Turned Off',
        'Please enable location services to find nearby service providers. You can also select a saved address during booking.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable Location',
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
            text: 'Continue Anyway',
            onPress: () => {
              setSelectedService(service);
              setStep('date');
              animateSheetTo(safeMaxHeight);
            },
          },
        ]
      );
      return;
    }

    setSelectedService(service);
    setStep('date');
    animateSheetTo(safeMaxHeight);
  };

  // Handle date/time selection from DateTimePicker
  const handleDateTimeChange = useCallback((dateTime) => {
    setSelectedDateTime(dateTime);
  }, []);

  // Handle location selection from LocationPicker
  const handleServiceLocationChange = useCallback((location) => {
    setServiceLocation(location);
  }, []);

  const handleCreateRequest = async () => {
    if (!selectedService || !selectedDateTime) {
      dialog('Error', 'Please select service and date/time');
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
          'Location Required',
          'Location services are turned off. Please enable GPS or select a saved address.',
          [
            { text: 'Select Address', onPress: () => {} },
            {
              text: 'Enable GPS',
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
        dialog('Location Required', 'Please wait for your location to be detected, or select a saved address.');
      }
      return;
    }

    // Validate location has actual coordinates (not just loading/partial)
    if (!locationToUse.latitude || !locationToUse.longitude) {
      dialog('Location Incomplete', 'Your location is still being detected. Please wait a moment and try again.');
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
        const alertMessage = selectedDateTime.isInstant
          ? 'Instant request created! Find nearby available providers now?'
          : 'Request created! Find nearby providers now?';
        dialog('Request Created', alertMessage, [
          { text: 'Later', onPress: resetFlow },
          { text: 'Find Providers', onPress: () => fetchProviders(result.request._id) },
        ]);
      } else if (result.code === 'OUTSIDE_SERVICE_ZONE') {
        dialog(
          'Service Unavailable in Your Area',
          result.suggestion || 'Our services are currently available only in Yavatmal City, Maharashtra. We\'re expanding soon!',
          [{ text: 'OK', onPress: resetFlow }]
        );
      } else if (result.code === 'RATE_LIMITED' && result.retryAfter) {
        dialog('Please Wait', `You've made too many requests. Try again in ${result.retryAfter} seconds.`);
      } else {
        dialog('Error', result.error || 'Failed to create request');
      }
    } catch (error) {
      dialog('Error', 'Something went wrong');
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
            'All Providers Reviewed',
            result.suggestion || 'You have reviewed all available providers. Start a fresh search to see them again.',
          );
        } else {
          setAllProvidersRejected(false);
          setProviders(result.providers || []);
          setSearchRadius(result.searchRadius || 0);
          if (!result.providers?.length) dialog('No Providers Found', `No providers within ${formatDistanceFromMeters(result.searchRadius, useKm)}. Try again later.`);
        }
      } else {
        dialog('Error', result.error || 'Failed to find providers');
      }
    } catch (error) {
      dialog('Error', 'Something went wrong');
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
          dialog('Error', resetResult.error || 'Failed to reset search. Try again.');
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
            'All Providers Reviewed',
            result.suggestion || 'All providers reviewed. Try again later when new providers come online.',
          );
        } else {
          setAllProvidersRejected(false);
          setProviders(result.providers || []);
          setSearchRadius(result.searchRadius || 0);
          setContactedProviderIds(new Set()); // Reset contacted state for fresh list
          if (!result.providers?.length) {
            dialog('No Providers Found', 'No providers are currently available in your area. Try again in a few minutes.');
          }
        }
      } else {
        dialog('No Providers Found', result.error || 'No providers available right now. Try again shortly.');
      }
    } catch (error) {
      dialog('Error', 'Something went wrong');
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
      'Skip Provider',
      `Remove ${provider.name || 'this provider'} from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            if (!createdRequest?._id) return;

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
                dialog('Error', result.error || 'Failed to skip provider');
              }
            } catch (error) {
              dialog('Error', 'Something went wrong while skipping');
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
        'Phone Not Available',
        'This provider\'s phone number is not yet available. Please try viewing their full profile or try again later.',
        [{ text: 'OK' }]
      );
      return;
    }

    dialog(
      'Call Provider',
      `Call ${provider.name || 'Provider'} at ${phone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          onPress: () => {
            setContactedProviderIds(prev => new Set(prev).add(provider._id));
            Linking.openURL(`tel:${cleanPhone}`).catch(() => {
              dialog('Error', 'Unable to make phone calls on this device');
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
    setBookingProvider(provider._id);
    try {
      // Pass distance from provider object (from getNearbyProviders response)
      const result = await sendRequestToProvider(createdRequest._id, provider._id, provider.distance);
      if (result.success) {
        dialog('Request Sent', `Your request has been sent to ${provider.name}.`, [{ text: 'OK', onPress: resetFlow }]);
      } else {
        dialog('Error', result.error || 'Failed to send request');
      }
    } catch (error) {
      dialog('Error', 'Something went wrong');
    } finally {
      setBookingProvider(null);
    }
  };

  const handleBookProvider = async (provider) => {
    if (!createdRequest?._id) { dialog('Error', 'Request not found'); return; }
    if (!contactedProviderIds.has(provider._id)) {
      // Show confirmation popup instead of blocking
      dialog(
        'Contact Provider First?',
        'We recommend having a quick talk with your provider before booking to discuss your requirements.',
        [
          { text: 'Call Provider', onPress: () => handleCallProvider(provider) },
          { text: 'Book Anyway', onPress: () => executeBookProvider(provider), style: 'default' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    executeBookProvider(provider);
  };

  const resetFlow = () => {
    setStep('select');
    setSelectedService(null);
    setSelectedDateTime(null);
    setServiceLocation(null);
    setServiceDescription('');
    setCreatedRequest(null);
    setProviders([]);
    setProviderDetailsVisible(false);
    setSelectedProvider(null);
    setContactedProviderIds(new Set()); // Reset per search session — don't carry over from previous bookings
    setSkippingProviderId(null);
    setAllProvidersRejected(false);
    animateSheetTo(SHEET_MID_HEIGHT);
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
        dialog('Request Cancelled', 'Your request has been cancelled.', [
          { text: 'OK', onPress: resetFlow }
        ]);
      } else {
        dialog('Error', result.error || 'Failed to cancel request');
      }
    } catch (error) {
      dialog('Error', 'Something went wrong');
    } finally {
      setCancellingRequest(false);
    }
  };

  const handleLogout = async () => await logout();
  const handleProfilePress = () => navigation.navigate('Profile');

  const renderSheetContent = () => {
    switch (step) {
      case 'date':
        return (
          <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false} bounces={false}>
            {/* Header: Back + Selected Service (compact row) */}
            <View style={styles.dateStepHeader}>
              <TouchableOpacity style={styles.backRow} onPress={resetFlow}>
                <View style={styles.backPill}>
                  <Icon name="arrow_back" size={18} color={BRAND.secondary} />
                  <Text style={styles.backText}>Back</Text>
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
                  <Text style={styles.serviceAtRowLabel}>YOUR LOCATION</Text>
                  <Text style={styles.serviceAtRowValue} numberOfLines={1}>
                    {displayAddress || (currentLocation ? 'Location detected' : 'Detecting...')}
                  </Text>
                </View>
                <View style={styles.serviceAtRowDivider} />
                {/* Service location row */}
                <View style={styles.serviceAtRow}>
                  <Text style={styles.serviceAtRowLabel}>SERVICE AT</Text>
                  <Text style={[styles.serviceAtRowValue, serviceLocation && serviceLocation.isCurrentLocation !== true && { color: BRAND.primary, fontWeight: '700' }]} numberOfLines={1}>
                    {serviceLocation && serviceLocation.isCurrentLocation !== true
                      ? (serviceLocation.shortAddress || serviceLocation.address || 'Selected address')
                      : (displayAddress || 'Same as your location')}
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
            <Text style={styles.sectionTitle}>CHANGE SERVICE LOCATION</Text>
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
                  <Text style={[styles.locationHintText, { color: '#EF4444' }]}>GPS is off -- select a saved address above</Text>
                </View>
              )}
              {!currentLocation && !serviceLocation && locationServicesEnabled && (
                <View style={styles.locationHintRow}>
                  <ActivityIndicator size="small" color="#94A3B8" />
                  <Text style={styles.locationHintText}>Detecting your location...</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.createButton, (!selectedDateTime || (!currentLocation && !serviceLocation)) && styles.createButtonDisabled]}
                onPress={handleCreateRequest}
                disabled={!selectedDateTime || creatingRequest || (!currentLocation && !serviceLocation)}
              >
                {creatingRequest ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcon name="check-circle" size={22} color="#FFFFFF" />
                    <Text style={styles.createButtonText}>Create Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      case 'providers':
        return (
          <View style={styles.sheetContent}>
            <View style={styles.providersHeader}>
              <View style={styles.providerHeaderActions}>
                {/* No "Done" button — it would leave the request in pending with no provider assigned.
                    After booking, the success Alert already calls resetFlow automatically. */}
                <TouchableOpacity style={styles.cancelPill} onPress={handleCancelRequest}>
                  <MaterialIcon name="cancel" size={16} color="#FFFFFF" />
                  <Text style={styles.cancelPillText}>Cancel Request</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.providersTitle}>{fetchingProviders ? 'Finding Providers...' : `${providers.length} Provider${providers.length !== 1 ? 's' : ''} Found`}</Text>
              {searchRadius > 0 && (
                <View style={styles.radiusPill}>
                  <Icon name="location" size={13} color={BRAND.secondary} />
                  <Text style={styles.radiusPillText}>Within {formatDistanceFromMeters(searchRadius, useKm)}</Text>
                </View>
              )}
              {/* Contact-first tip */}
              {!fetchingProviders && providers.length > 0 && (
                <View style={styles.providerTipRow}>
                  <MaterialIcon name="info-outline" size={18} color="#D97706" />
                  <Text style={styles.providerTipText}>Call and discuss first. Skip providers you don't want.</Text>
                </View>
              )}
            </View>
            {fetchingProviders ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={BRAND.primary} />
                <Text style={styles.loadingText}>Searching nearby providers...</Text>
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
                        <Text style={styles.emptyText}>All providers reviewed</Text>
                        <Text style={styles.emptySubtext}>You've gone through all available providers. Start a fresh search to see them again.</Text>
                        <TouchableOpacity
                          style={[styles.retryButton, { backgroundColor: BRAND.primary }]}
                          onPress={handleRetrySearch}
                        >
                          <Icon name="refresh" size={20} color="#FFFFFF" />
                          <Text style={styles.retryButtonText}>Start Fresh Search</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={styles.emptyText}>No providers found nearby</Text>
                        <Text style={styles.emptySubtext}>We're searching for providers to fix your home</Text>
                        <TouchableOpacity
                          style={styles.retryButton}
                          onPress={handleRetrySearch}
                        >
                          <Icon name="refresh" size={20} color="#FFFFFF" />
                          <Text style={styles.retryButtonText}>Retry Search</Text>
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
      default:
        return (
          <ScrollView
            style={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
            alwaysBounceVertical={true}
            contentContainerStyle={styles.servicesScrollContent}
            nestedScrollEnabled={true}
          >
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Hello, {displayData?.fullName?.split(' ')[0] || 'there'}!</Text>
              <Text style={styles.welcomeSubtext}>What service do you need?</Text>
            </View>

            {/* Quick Access Buttons */}
            <View style={styles.quickAccessRow}>
              <QuickAccessCard
                iconName="warning"
                iconColor="#DC2626"
                label="Emergency"
                borderColor="#FECACA"
                bgColor="#FEF2F2"
                iconBg="rgba(220, 38, 38, 0.1)"
                onPress={() => navigation.navigate('EmergencyServices')}
              />
              <QuickAccessCard
                iconName="camera"
                iconColor="#7C3AED"
                label="Events"
                borderColor="#C7D2FE"
                bgColor="#EEF2FF"
                iconBg="rgba(124, 58, 237, 0.1)"
                onPress={() => navigation.navigate('EventServices')}
              />
              <QuickAccessCard
                iconName="heart"
                iconColor="#F59E0B"
                label="Favorites"
                borderColor="#FDE68A"
                bgColor="#FFFBEB"
                iconBg="rgba(245, 158, 11, 0.1)"
                onPress={() => navigation.navigate('Favorites')}
              />
            </View>

            <Text style={styles.servicesSectionTitle}>TRADITIONAL SERVICES</Text>
            <View style={styles.servicesGrid}>
              {SERVICE_CATEGORIES.map((service) => (
                <ServiceCard key={service.id} service={service} onPress={handleServiceSelect} />
              ))}
            </View>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => navigation.navigate('HistoryTab')}
              >
                <MaterialIcon name="history" size={20} color="#475569" />
                <Text style={styles.quickActionText}>View History</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
    }
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
            Location permission needed for finding nearby providers.
          </Text>
          <TouchableOpacity
            style={styles.permissionBarButton}
            onPress={locationPermission === 'blocked' ? () => openSettings() : requestLocationPermission}
          >
            <Text style={styles.permissionBarButtonText}>
              {locationPermission === 'blocked' ? 'Settings' : 'Enable'}
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
            Location is turned off. Turn it on for better experience.
          </Text>
          <TouchableOpacity
            style={styles.permissionBarButton}
            onPress={() => openSettings()}
          >
            <Text style={styles.permissionBarButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {notificationPermission === 'blocked' && (
        <View style={[styles.permissionBar, styles.permissionBarDanger, { top: insets.top + ((locationPermission === 'denied' || locationPermission === 'blocked') || !locationServicesEnabled ? 110 : 60) }]}>
          <View style={[styles.permissionBarIconWrap, { backgroundColor: '#FEE2E2' }]}>
            <Icon name="notification" size={18} color="#EF4444" />
          </View>
          <Text style={[styles.permissionBarText, styles.permissionBarTextDanger]}>
            Notifications required for service updates
          </Text>
          <TouchableOpacity
            style={[styles.permissionBarButton, styles.permissionBarButtonDanger]}
            onPress={() => openSettings()}
          >
            <Text style={[styles.permissionBarButtonText, styles.permissionBarButtonTextDanger]}>Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Top Bar - Premium frosted glass */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => setIsDrawerOpen(true)} activeOpacity={0.7} style={styles.topBarLogoBtn}>
          <Image source={FIXHOMI_LOGO} style={styles.topBarLogoImg} />
        </TouchableOpacity>
        <View style={styles.topBarSpacer} />
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
      <Animated.View style={[styles.bottomSheet, { height: sheetHeight, paddingBottom: 8 }]}>
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
            <Text style={styles.permissionModalTitle}>Notifications Required</Text>
            <Text style={styles.permissionModalMessage}>
              FixHomi needs notification permission to send you real-time updates about your service requests, provider arrival, and payment confirmations.
            </Text>
            <TouchableOpacity
              style={styles.permissionModalButton}
              onPress={() => openSettings()}
            >
              <Text style={styles.permissionModalButtonText}>Open Settings</Text>
            </TouchableOpacity>
            <Text style={styles.permissionModalNote}>
              Enable notifications in app settings and return here
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
              'Call Provider',
              `Call ${selectedProvider?.name || 'Provider'} at ${phone}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Call Now',
                  onPress: () => {
                    if (selectedProvider) {
                      setContactedProviderIds(prev => new Set(prev).add(selectedProvider._id));
                    }
                    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
                      dialog('Error', 'Unable to make phone calls on this device');
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
    </View>
  );
};

// QuickAccessCard sub-component with press animation
const QuickAccessCard = ({ iconName, iconColor, label, borderColor, bgColor, iconBg, onPress }) => {
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
        <View style={[styles.quickAccessIconContainer, { backgroundColor: iconBg }]}>
          <Icon name={iconName} size={24} color={iconColor} />
        </View>
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
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  createButtonDisabled: {
    backgroundColor: '#CBD5E1',
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND.white,
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
  serviceCard: {
    width: Math.floor((SCREEN_WIDTH - 64) / 3),
    paddingVertical: 18,
    paddingHorizontal: 6,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: BRAND.white,
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
        elevation: 3,
      },
    }),
  },
  serviceIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: BRAND.secondary + '0D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BRAND.secondary + '15',
  },
  serviceName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 15,
    letterSpacing: -0.2,
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
    paddingBottom: 80,
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
    paddingBottom: 20,
  },

  // ─── Provider Card ─────────────────────────────────────────
  providerCard: {
    backgroundColor: BRAND.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
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
  providerCardSkipping: {
    opacity: 0.5,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerAvatarImage: {
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
    gap: 10,
    alignItems: 'center',
  },
  callButton: {
    width: 50,
    height: 46,
    backgroundColor: '#10B981',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  callButtonCalling: {
    backgroundColor: '#94A3B8',
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  bookButton: {
    flex: 1,
    height: 46,
    backgroundColor: BRAND.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  bookButtonLoading: {
    backgroundColor: BRAND.primary + '80',
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.white,
    letterSpacing: -0.2,
  },
  skipButton: {
    width: 42,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
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
