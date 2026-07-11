/**
 * Settings Screen
 *
 * User/Provider settings with:
 * - Notification preferences
 * - Location settings
 * - App preferences (theme, language, haptics)
 * - Provider-specific settings (working hours, availability)
 * - Account actions (logout, delete)
 *
 * @version 3.0.0 - Premium design language revamp
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
  Platform,
  Vibration,
  Image,
  Animated,
  StatusBar,
  Share,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { BlurView } from '@react-native-community/blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { check, request, checkNotifications, requestNotifications, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { Analytics, EV } from '../services/analytics';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { startLocationTracking, stopLocationTracking } from '../services/socketService';
import { Icon } from '../components';
import SvgArt from '../components/SvgArt';
import GraphBackground from '../components/GraphBackground';
import { useShimmerAnimation, ShimmerBlock } from '../components/ShimmerLoader';
import { NODE_BASE_URL, JAVA_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';
import { getTokens } from '../utils/storage';
import { playNotificationSound } from '../utils/notificationSound';
import { getAutoUpdateEnabled, setAutoUpdateEnabled, getCurrentAppVersion, checkForAppUpdate, openStorePage } from '../services/appUpdateService';

const FIXHOMI_LOGO = require('../assets/fixhomi_logo.jpg');

// Premium design tokens
const COLORS = {
  darkHero: '#0F172A',
  background: '#F1F5F9',
  cardWhite: '#FFFFFF',
  primary: '#f67c16',
  secondary: '#2b76bc',
  muted: '#94A3B8',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  iconBg: '#F1F5F9',
  divider: '#F1F5F9',
  switchTrackOff: '#E2E8F0',
  switchThumbOff: '#CBD5E1',
};

const SHADOWS = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  android: {
    elevation: 5,
  },
});

const CARD_RADIUS = 22;
const ICON_SIZE = 42;
const ICON_RADIUS = 14;

/**
 * Animated pressable wrapper for menu items
 */
const AnimatedPressable = ({ children, onPress, style, disabled }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * Settings Section Header with accent bar
 */
const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeaderContainer}>
    <View style={styles.sectionAccentBar} />
    <Text style={styles.sectionHeader}>{title}</Text>
  </View>
);

/**
 * Settings Row with toggle
 */
const ToggleRow = ({ iconName, title, subtitle, value, onValueChange, disabled, onInfoPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={true}
    >
      <Animated.View style={[styles.settingsRow, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.rowIconContainer}>
          <Icon name={iconName} size={20} color={COLORS.secondary} />
        </View>
        <View style={styles.rowContent}>
          <View style={styles.rowTitleContainer}>
            <Text style={styles.rowTitle}>{title}</Text>
            {onInfoPress && (
              <TouchableOpacity onPress={onInfoPress} style={styles.infoButton}>
                <Icon name="info" size={16} color={COLORS.muted} />
              </TouchableOpacity>
            )}
          </View>
          {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: COLORS.switchTrackOff, true: COLORS.primary }}
          thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (value ? COLORS.primary : COLORS.switchThumbOff)}
          ios_backgroundColor={COLORS.switchTrackOff}
          accessibilityLabel={title}
          accessibilityRole="switch"
          accessibilityState={{ checked: value, disabled }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * Settings Row with navigation/action
 */
const ActionRow = ({ iconName, title, subtitle, onPress, showArrow = true, danger = false, loading = false, disabled = false }) => (
  <AnimatedPressable
    onPress={onPress}
    disabled={loading || disabled}
    accessibilityRole="button"
    accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    accessibilityState={{ disabled: loading || disabled }}
  >
    <View style={[styles.settingsRow, (loading || disabled) && { opacity: 0.6 }]}>
      <View style={[styles.rowIconContainer, danger && styles.rowIconDanger]}>
        {loading ? (
          <ActivityIndicator size={18} color={danger ? COLORS.danger : COLORS.secondary} />
        ) : (
          <Icon name={iconName} size={20} color={danger ? COLORS.danger : COLORS.secondary} />
        )}
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>
          {loading ? (title + '...') : title}
        </Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {showArrow && (
        <View style={styles.arrowContainer}>
          <Icon name="chevron-right" size={18} color={COLORS.muted} />
        </View>
      )}
    </View>
  </AnimatedPressable>
);

/**
 * Working Hours Display/Edit Component
 */
const WorkingHoursRow = ({ day, hours, onEdit }) => (
  <AnimatedPressable onPress={onEdit}>
    <View style={styles.workingHoursRow}>
      <Text style={styles.dayLabel}>{day}</Text>
      <View style={styles.hoursContainer}>
        <Text style={styles.hoursText}>
          {hours?.start || '09:00'} - {hours?.end || '18:00'}
        </Text>
        <Icon name="edit" size={16} color={COLORS.muted} />
      </View>
    </View>
  </AnimatedPressable>
);

/**
 * Settings Skeleton Loader — Amazon-style shimmer wave
 */
const SettingsSkeletonLoader = ({ insets, onBack }) => {
  const shimmerAnim = useShimmerAnimation();
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Icon name="arrow_back" size={22} color={COLORS.cardWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={styles.content} contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 88 }]} scrollEnabled={false}>
        {/* Section header */}
        <ShimmerBlock width={100} height={13} borderRadius={6} shimmerAnim={shimmerAnim} style={{ marginBottom: 12, marginTop: 8 }} />
        {/* Toggle rows */}
        {[1, 2, 3].map(i => (
          <View key={i} style={{ backgroundColor: COLORS.cardWhite, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <ShimmerBlock width={40} height={40} borderRadius={12} shimmerAnim={shimmerAnim} />
            <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
              <ShimmerBlock width={130} height={14} borderRadius={6} shimmerAnim={shimmerAnim} />
              <ShimmerBlock width={200} height={11} borderRadius={5} shimmerAnim={shimmerAnim} />
            </View>
            <ShimmerBlock width={46} height={28} borderRadius={14} shimmerAnim={shimmerAnim} />
          </View>
        ))}
        {/* Section header */}
        <ShimmerBlock width={120} height={13} borderRadius={6} shimmerAnim={shimmerAnim} style={{ marginBottom: 12, marginTop: 16 }} />
        {/* Setting rows */}
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={{ backgroundColor: COLORS.cardWhite, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <ShimmerBlock width={40} height={40} borderRadius={12} shimmerAnim={shimmerAnim} />
            <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
              <ShimmerBlock width={110 + i * 15} height={14} borderRadius={6} shimmerAnim={shimmerAnim} />
              <ShimmerBlock width={160 + i * 10} height={11} borderRadius={5} shimmerAnim={shimmerAnim} />
            </View>
          </View>
        ))}
        {/* Section header */}
        <ShimmerBlock width={80} height={13} borderRadius={6} shimmerAnim={shimmerAnim} style={{ marginBottom: 12, marginTop: 16 }} />
        {/* Action rows */}
        {[1, 2].map(i => (
          <View key={i} style={{ backgroundColor: COLORS.cardWhite, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <ShimmerBlock width={40} height={40} borderRadius={12} shimmerAnim={shimmerAnim} />
            <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
              <ShimmerBlock width={120} height={14} borderRadius={6} shimmerAnim={shimmerAnim} />
              <ShimmerBlock width={180} height={11} borderRadius={5} shimmerAnim={shimmerAnim} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

/**
 * Settings Screen Component
 */
const SettingsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, userType, logout, refreshProfile, updateProviderAvailability, updateProviderLocationTracking, isProfileLoading } = useApp();
  const { dialog } = useDialog();
  const { t, language, setLanguage, languages } = useLanguage();
  const [showLangModal, setShowLangModal] = React.useState(false);

  // Set status bar for dark hero header when this tab is focused
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor('transparent');
    }, [])
  );

  const displayData = { ...user, ...profile };
  const isProvider = userType === 'provider';
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  // Derive isAvailable from context (single source of truth: isAvailable)
  // Use a ref to hold the last known value so refreshes don't flash the toggle
  const lastKnownAvailability = useRef(false);
  const rawAvailable = displayData?.isAvailable;
  if (rawAvailable !== undefined && rawAvailable !== null) {
    lastKnownAvailability.current = rawAvailable;
  }
  const isAvailable = lastKnownAvailability.current;

  // Derive locationTracking from context (single source of truth)
  // Don't default to false - wait for profile to load to show accurate state
  const locationTracking = displayData?.locationTracking?.enabled ?? false;

  // State
  const [saving, setSaving] = useState(false);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [isUpdatingLocationTracking, setIsUpdatingLocationTracking] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('granted');
  const [notifications, setNotifications] = useState({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
  });

  // Logout/signout overlay state
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // OTP-based account deletion state
  const [deleteOtpModalVisible, setDeleteOtpModalVisible] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // App preferences state
  const [appPreferences, setAppPreferences] = useState({
    hapticFeedback: true,
    notificationSound: true,
    distanceInKm: true,
  });

  // Auto-update state
  const [autoUpdateEnabled, setAutoUpdateEnabledState] = useState(false);
  const [checkingForUpdate, setCheckingForUpdate] = useState(false);

  // Provider-specific state
  const [workingHours, setWorkingHours] = useState(displayData?.availability?.workingHours || {});
  const [emergencyServicesEnabled, setEmergencyServicesEnabled] = useState(displayData?.emergencyServicesEnabled || false);
  const [isUpdatingEmergency, setIsUpdatingEmergency] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    loadPreferences();
    checkNotificationPermission();
  }, []);

  // Auto-sync location tracking on mount for providers
  // This ensures GPS tracking matches the persisted setting when app reopens
  useEffect(() => {
    if (isProvider && userId && locationTracking) {
      console.log('[Settings] Auto-starting location tracking (persisted setting is enabled)');
      startLocationTracking(userId);
    }
    // Note: We don't stop tracking here if disabled, as ProviderHomeScreen handles that
  }, [isProvider, userId, locationTracking]);

  /**
   * Load preferences from AsyncStorage
   */
  const loadPreferences = async () => {
    try {
      const savedPrefs = await AsyncStorage.getItem('app_preferences');
      if (savedPrefs) {
        setAppPreferences(JSON.parse(savedPrefs));
      }
      const savedNotifs = await AsyncStorage.getItem('notification_preferences');
      if (savedNotifs) {
        setNotifications(JSON.parse(savedNotifs));
      }

      // Also hydrate from backend profile if available
      if (displayData?.preferences) {
        const bp = displayData.preferences;
        if (typeof bp.pushNotifications === 'boolean') {
          setNotifications(prev => ({ ...prev, pushEnabled: bp.pushNotifications }));
        }
        if (typeof bp.emailNotifications === 'boolean') {
          setNotifications(prev => ({ ...prev, emailEnabled: bp.emailNotifications }));
        }
        if (typeof bp.notificationSound === 'boolean') {
          setAppPreferences(prev => ({ ...prev, notificationSound: bp.notificationSound }));
        }
        if (typeof bp.distanceInKm === 'boolean') {
          setAppPreferences(prev => ({ ...prev, distanceInKm: bp.distanceInKm }));
        }
      }

      // Load auto-update preference
      const autoUpdate = await getAutoUpdateEnabled();
      setAutoUpdateEnabledState(autoUpdate);
    } catch (error) {
      console.log('Error loading preferences:', error);
    }
  };

  /**
   * Save preferences to AsyncStorage
   */
  const savePreferences = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.log('Error saving preferences:', error);
    }
  };

  /**
   * Sync notification/app preferences to backend
   */
  const syncPreferencesToBackend = async (prefs) => {
    if (!userId) return;
    try {
      const endpoint = isProvider
        ? `${NODE_BASE_URL}/api/provider/${userId}/preferences`
        : `${NODE_BASE_URL}/api/user/${userId}/preferences`;
      await authFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(prefs),
      });
    } catch (error) {
      console.log('Failed to sync preferences to backend:', error.message);
    }
  };

  /**
   * Check notification permission status
   */
  const checkNotificationPermission = async () => {
    try {
      let result;
      if (Platform.OS === 'ios') {
        const { status } = await checkNotifications();
        result = status;
      } else {
        result = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
      }
      setNotificationPermission(result);

      // If denied, update local state to match
      if (result === RESULTS.DENIED || result === RESULTS.BLOCKED) {
        setNotifications(prev => ({ ...prev, pushEnabled: false }));
      }
    } catch (error) {
      console.log('Error checking notification permission:', error);
    }
  };

  /**
   * Handle push notification toggle
   */
  const handlePushNotificationChange = async (value) => {
    if (value) {
      try {
        let currentStatus;
        if (Platform.OS === 'ios') {
          const { status } = await checkNotifications();
          currentStatus = status;
        } else {
          currentStatus = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
        }

        if (currentStatus === RESULTS.BLOCKED) {
          // Permission permanently denied - guide user to settings, but still toggle app-level pref
          dialog(
            'System Notifications Disabled',
            'Push notifications are disabled in your device settings. The in-app preference will be enabled, but you also need to allow notifications in system settings.',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Open Settings', onPress: () => openSettings() },
            ]
          );
          // Still update the app-level preference (falls through below)
        } else if (currentStatus === RESULTS.DENIED) {
          // Request permission
          let result;
          if (Platform.OS === 'ios') {
            const { status } = await requestNotifications(['alert', 'badge', 'sound']);
            result = status;
          } else {
            result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
          }
          if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
            setNotificationPermission(RESULTS.GRANTED);
          }
          // Still update the app-level preference regardless
        } else if (currentStatus === RESULTS.GRANTED || currentStatus === RESULTS.LIMITED) {
          setNotificationPermission(RESULTS.GRANTED);
        }
        // RESULTS.UNAVAILABLE (Android < 13): notifications are always allowed, proceed
      } catch (error) {
        console.log('Error checking notification permission:', error);
        // Still allow toggling the app-level preference
      }
    }

    const newNotifications = { ...notifications, pushEnabled: value };
    setNotifications(newNotifications);
    savePreferences('notification_preferences', newNotifications);
    syncPreferencesToBackend({ pushNotifications: value });

    // Haptic feedback
    if (appPreferences.hapticFeedback) {
      Vibration.vibrate(10);
    }
  };

  /**
   * Handle app preference changes
   */
  const handlePreferenceChange = (key, value) => {
    const newPrefs = { ...appPreferences, [key]: value };
    setAppPreferences(newPrefs);
    savePreferences('app_preferences', newPrefs);

    // Sync notification sound and distance preferences to backend
    if (key === 'notificationSound' || key === 'distanceInKm') {
      syncPreferencesToBackend({ [key]: value });
    }

    // Play sound when toggling notification sound ON
    if (key === 'notificationSound' && value) {
      playNotificationSound({ title: 'Notification Sound', body: 'Sound enabled', force: true });
    }

    // Haptic feedback when toggling haptics ON
    if (key === 'hapticFeedback' && value) {
      Vibration.vibrate(10);
    }
  };

  /**
   * Handle auto-update toggle
   */
  const handleAutoUpdateChange = async (value) => {
    setAutoUpdateEnabledState(value);
    await setAutoUpdateEnabled(value);
    if (appPreferences.hapticFeedback) {
      Vibration.vibrate(10);
    }
  };

  /**
   * Manually check for updates
   */
  const handleCheckForUpdate = async () => {
    setCheckingForUpdate(true);
    try {
      const info = await checkForAppUpdate();
      if (info && info.updateRequired) {
        dialog(
          'Update Available',
          `Version ${info.latestVersion} is available.`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Update Now', onPress: () => openStorePage(info.storeUrl) },
          ]
        );
      } else {
        dialog('Up to Date', `You're on the latest version (${getCurrentAppVersion()}).`);
      }
    } catch {
      dialog('Error', 'Could not check for updates. Please try again.');
    } finally {
      setCheckingForUpdate(false);
    }
  };

  /**
   * Handle email notification toggle
   */
  const handleEmailNotificationChange = (value) => {
    const newNotifications = { ...notifications, emailEnabled: value };
    setNotifications(newNotifications);
    savePreferences('notification_preferences', newNotifications);
    syncPreferencesToBackend({ emailNotifications: value });

    if (appPreferences.hapticFeedback) {
      Vibration.vibrate(10);
    }
  };

  // Initialize working hours from profile data
  useEffect(() => {
    if (displayData) {
      setWorkingHours(displayData.availability?.workingHours || getDefaultWorkingHours());
      setEmergencyServicesEnabled(displayData.emergencyServicesEnabled || false);
    }
  }, [displayData?.availability, displayData?.emergencyServicesEnabled]);

  const getDefaultWorkingHours = () => ({
    monday: { start: '09:00', end: '18:00' },
    tuesday: { start: '09:00', end: '18:00' },
    wednesday: { start: '09:00', end: '18:00' },
    thursday: { start: '09:00', end: '18:00' },
    friday: { start: '09:00', end: '18:00' },
    saturday: { start: '09:00', end: '16:00' },
    sunday: { start: '10:00', end: '16:00' },
  });

  /**
   * Handle availability toggle (uses centralized state from AppContext)
   */
  const handleAvailabilityChange = async (value) => {
    if (!userId || isUpdatingAvailability) return;

    // Optimistic update
    const previousValue = isAvailable;
    updateProviderAvailability(value, true);

    setIsUpdatingAvailability(true);
    try {
      const result = await updateProviderAvailability(value);
      if (!result.success) {
        updateProviderAvailability(previousValue, true); // revert
        dialog('Error', result.message || 'Failed to update availability');
      }
    } catch (error) {
      updateProviderAvailability(previousValue, true); // revert
      console.error('[Settings] Error updating availability:', error);
      dialog('Error', 'Failed to update availability');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  /**
   * Show info about availability toggle
   */
  const showAvailabilityInfo = () => {
    dialog(
      'Available for Work',
      'When enabled:\n\n' +
      '• Customers can find you in nearby provider searches\n' +
      '• You appear in the provider list for your service categories\n' +
      '• You can receive new booking requests\n\n' +
      'When disabled:\n\n' +
      '• You are hidden from all customer searches\n' +
      '• You cannot receive new booking requests\n' +
      '• Existing bookings are not affected',
      [{ text: 'Got it' }]
    );
  };

  /**
   * Show info about location tracking toggle
   */
  const showLocationTrackingInfo = () => {
    dialog(
      'Live Location Tracking',
      'When enabled:\n\n' +
      '• Your real-time location is updated every 30 seconds\n' +
      '• Customers can see you approaching on the map\n' +
      '• Accurate ETA calculation for customers\n' +
      '• Your location is stored in the database for nearby searches\n\n' +
      'When disabled:\n\n' +
      '• Only your last known location is used\n' +
      '• Customers cannot track your arrival\n' +
      '• ETA may be less accurate\n\n' +
      'Note: Location tracking uses GPS which may affect battery life.',
      [{ text: 'Got it' }]
    );
  };

  /**
   * Handle location tracking toggle (uses centralized state from AppContext)
   * Also starts/stops actual GPS tracking
   */
  const handleLocationTrackingChange = async (value) => {
    if (!userId || isUpdatingLocationTracking) return;

    // Optimistic update
    const previousValue = locationTracking;
    updateProviderLocationTracking(value, true);

    setIsUpdatingLocationTracking(true);
    try {
      const result = await updateProviderLocationTracking(value);
      if (!result.success) {
        updateProviderLocationTracking(previousValue, true); // revert
        dialog('Error', result.error || 'Failed to update location tracking');
      } else {
        if (value) {
          startLocationTracking(userId);
        } else {
          stopLocationTracking();
        }
      }
    } catch (error) {
      updateProviderLocationTracking(previousValue, true); // revert
      console.error('[Settings] Error updating location tracking:', error);
      dialog('Error', 'Failed to update location tracking');
    } finally {
      setIsUpdatingLocationTracking(false);
    }
  };

  /**
   * Handle emergency hours toggle (10 PM - 7 AM availability)
   */
  const handleEmergencyServicesChange = async (value) => {
    if (!userId || isUpdatingEmergency) return;

    // Optimistic update
    const previousValue = emergencyServicesEnabled;
    setEmergencyServicesEnabled(value);

    setIsUpdatingEmergency(true);
    try {
      const response = await authFetch(`${NODE_BASE_URL}/api/provider/${userId}/emergency-services`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: value }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Sync AppContext profile cache so the value persists across app restarts
        await refreshProfile(userType, userId, { force: true });
        dialog(
          value ? 'Emergency Hours Enabled' : 'Emergency Hours Disabled',
          value
            ? 'You will now appear in search results during night hours (10 PM \u2013 7 AM IST).'
            : 'You will no longer appear in night hour searches.',
          [{ text: 'OK' }]
        );
      } else {
        setEmergencyServicesEnabled(previousValue); // revert
        dialog('Error', result.message || 'Failed to update emergency services setting');
      }
    } catch (error) {
      setEmergencyServicesEnabled(previousValue); // revert
      console.error('[Settings] Error updating emergency services:', error);
      dialog('Error', 'Failed to update emergency hours setting. Please check your connection.');
    } finally {
      setIsUpdatingEmergency(false);
    }
  };

  /**
   * Show info about emergency hours toggle
   */
  const showEmergencyServicesInfo = () => {
    dialog(
      'Night Emergency Hours (10 PM \u2013 7 AM)',
      'This toggle controls your availability during night hours.\n\n' +
      'When enabled:\n\n' +
      '• You will appear in search results between 10 PM and 7 AM IST\n' +
      '• Customers in need of urgent help can find and contact you\n' +
      '• Only providers who opt in are shown during these hours\n\n' +
      'When disabled:\n\n' +
      '• You will not appear in searches during 10 PM \u2013 7 AM IST\n' +
      '• Your regular daytime availability is not affected\n\n' +
      'Note: This applies to all service types. Event services are not affected by emergency hours.',
      [{ text: 'Got it' }]
    );
  };

  /**
   * Handle working hours edit
   */
  const handleEditWorkingHours = (day) => {
    dialog(
      `${day} Working Hours`,
      'Your working hours are displayed to customers to help them know when you are available. To update your hours, please contact support.',
      [{ text: 'OK' }]
    );
  };

  /**
   * Handle GDPR data export — download all user/provider data
   */
  const [isExportingData, setIsExportingData] = useState(false);

  const handleExportData = async () => {
    try {
      setIsExportingData(true);
      const id = user?.mongoId || user?._id;
      if (!id) {
        dialog('Error', 'Could not identify your account. Please try logging in again.');
        return;
      }

      const endpoint = userType === 'provider'
        ? `${NODE_BASE_URL}/api/provider/${id}/export`
        : `${NODE_BASE_URL}/api/user/${id}/export`;

      const response = await authFetch(endpoint);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        dialog('Export Failed', errorData.message || 'Could not export your data right now. Please try again later.');
        return;
      }

      const json = await response.json();
      const exportString = JSON.stringify(json.data, null, 2);

      await Share.share({
        message: exportString,
        title: 'FixHomi Data Export',
      });
    } catch (error) {
      console.error('[Settings] Data export error:', error);
      dialog('Export Failed', 'Something went wrong while exporting your data. Please try again.');
    } finally {
      setIsExportingData(false);
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = () => {
    dialog(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            await logout();
          }
        },
      ]
    );
  };

  /**
   * Handle account deletion - Step 1: Request OTP
   */
  const handleDeleteAccount = () => {
    dialog(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently removed.\n\nAn OTP will be sent to your registered phone number for verification.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => requestDeleteOtp(),
        },
      ]
    );
  };

  /**
   * Request OTP for account deletion via Java Auth service
   */
  const requestDeleteOtp = async () => {
    try {
      setIsRequestingOtp(true);
      const tokens = await getTokens();

      // Call Java Auth directly (not via Node.js proxy) for reliable connectivity
      const response = await authFetch(`${JAVA_BASE_URL}/api/users/delete-account/request-otp`, {
        method: 'POST',
      });

      const result = await response.json();

      if (response.ok) {
        // OTP sent successfully - show OTP input modal
        // Java Auth returns { message: "OTP sent to ******7890..." }
        const phoneMask = result.message?.match(/\*{4,}\d{4}/)?.[0] || '******';
        setMaskedPhone(result.maskedPhone || phoneMask);
        setDeleteOtpModalVisible(true);
      } else if (response.status === 429) {
        dialog('Please Wait', 'Too many attempts. Please try again in a few minutes.');
      } else {
        dialog('Error', result.message || 'Failed to send OTP. Please try again.');
      }
    } catch (error) {
      console.error('Request delete OTP error:', error);
      dialog('Error', 'Failed to send OTP. Please check your connection and try again.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  /**
   * Confirm account deletion with OTP - Step 2
   */
  const confirmDeleteWithOtp = async () => {
    if (deleteOtp.length !== 6) {
      dialog('Invalid OTP', 'Please enter the 6-digit OTP sent to your phone.');
      return;
    }

    try {
      setIsDeletingAccount(true);
      const tokens = await getTokens();

      // Call Java Auth directly to verify OTP and delete auth account
      const response = await authFetch(`${JAVA_BASE_URL}/api/users/account`, {
        method: 'DELETE',
        body: JSON.stringify({
          otp: deleteOtp,
          reason: deleteReason || 'User requested deletion',
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // MongoDB cleanup — retry up to 2 times to ensure data is fully removed
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const cleanupRes = await authFetch(`${NODE_BASE_URL}/api/auth/cleanup-account`, {
              method: 'POST',
              body: JSON.stringify({ reason: deleteReason || 'User requested deletion' }),
            });
            if (cleanupRes.ok) {
              console.log('[Settings] MongoDB cleanup successful');
              break;
            }
            console.warn(`[Settings] MongoDB cleanup attempt ${attempt} returned:`, cleanupRes.status);
          } catch (cleanupErr) {
            console.warn(`[Settings] MongoDB cleanup attempt ${attempt} failed:`, cleanupErr.message);
          }
          if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
        }
      }

      if (response.ok) {
        setDeleteOtpModalVisible(false);
        setDeleteOtp('');
        setDeleteReason('');
        dialog(
          'Account Deleted',
          'Your account has been successfully deleted. We\'re sorry to see you go.',
          [{ text: 'OK', onPress: () => { setIsLoggingOut(true); logout(); } }]
        );
      } else if (response.status === 429) {
        dialog('Please Wait', 'Too many attempts. Please try again in a few minutes.');
      } else {
        const msgLower = (result.message || '').toLowerCase();
        if (msgLower.includes('otp') || msgLower.includes('verification') || msgLower.includes('invalid')) {
          dialog('Incorrect OTP', 'The OTP you entered is incorrect. Please check and try again.');
        } else {
          dialog('Unable to Delete', 'Something went wrong. Please try again.');
        }
      }
    } catch (error) {
      console.error('Delete account error:', error);
      dialog('Unable to Delete', 'Something went wrong. Please try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  /**
   * Resend deletion OTP
   */
  const resendDeleteOtp = async () => {
    setDeleteOtp('');
    await requestDeleteOtp();
  };

  // Show skeleton until profile data is available
  if (!profile) {
    return <SettingsSkeletonLoader insets={insets} onBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GraphBackground />
      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, overflow: 'hidden' }]}>
        <SvgArt color="rgba(255,255,255,1)" height={80} />
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow_back" size={22} color={COLORS.cardWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 88 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Provider Availability Section */}
        {isProvider && (
          <View style={styles.section}>
            <SectionHeader title={t('settings.availability')} />

            <ToggleRow
              iconName="location"
              title={t('settings.availableForWork')}
              subtitle={isAvailable ? t('settings.customersCanSee') : t('settings.hiddenFromCustomers')}
              value={isAvailable}
              onValueChange={handleAvailabilityChange}
              onInfoPress={showAvailabilityInfo}
              disabled={isUpdatingAvailability}
            />

            <ToggleRow
              iconName="my_location"
              title={t('settings.liveLocationTracking')}
              subtitle={t('settings.liveLocationSub')}
              value={locationTracking}
              onValueChange={handleLocationTrackingChange}
              onInfoPress={showLocationTrackingInfo}
              disabled={isUpdatingLocationTracking}
            />

            <ToggleRow
              iconName="notification"
              title={t('settings.nightEmergencyHours')}
              subtitle={emergencyServicesEnabled ? t('settings.nightEmergencyOnSub') : t('settings.nightEmergencyOffSub')}
              value={emergencyServicesEnabled}
              onValueChange={handleEmergencyServicesChange}
              onInfoPress={showEmergencyServicesInfo}
              disabled={isUpdatingEmergency}
            />
          </View>
        )}

        {/* Provider Verification Section */}
        {isProvider && (
          <View style={styles.section}>
            <SectionHeader title={t('settings.verification')} />

            <ActionRow
              iconName="verified"
              title={t('settings.verificationDashboard')}
              subtitle={t('settings.verificationDashboardSub')}
              onPress={() => navigation.navigate('VerificationDashboard')}
            />

            <ActionRow
              iconName="document"
              title={t('settings.requestServiceApprovals')}
              subtitle={
                displayData?.documentVerification?.overallStatus === 'fully_verified'
                  ? t('settings.allServicesVerified')
                  : displayData?.documentVerification?.overallStatus === 'partially_verified'
                  ? t('settings.someServicesVerified')
                  : displayData?.documentVerification?.overallStatus === 'pending'
                  ? t('settings.underReviewServices')
                  : t('settings.getVerifiedToReceive')
              }
              onPress={() => navigation.navigate('DocumentVerification')}
            />

            <ActionRow
              iconName="star"
              title={t('settings.premiumSubscription')}
              subtitle={
                displayData?.isPremium
                  ? t('settings.premiumActiveSub')
                  : t(profile?.verifiedServiceCategories?.length > 0 ? 'settings.premiumRenewSub' : 'settings.subscribeSub')
              }
              onPress={() => navigation.navigate('Subscription')}
            />

            <View style={styles.verificationNote}>
              <View style={styles.verificationNoteIconContainer}>
                <Icon name="info" size={14} color={COLORS.secondary} />
              </View>
              <Text style={styles.verificationNoteText}>
                {displayData?.isFullyVerified
                  ? t('settings.verificationCompleteNote') || 'All verifications complete. Activate Professional Tools to appear in customer searches.'
                  : t('settings.verificationNote')}
              </Text>
            </View>
          </View>
        )}

        {/* Refer & Earn Section — Both Users and Providers */}
        <View style={styles.section}>
          <SectionHeader title="Refer & Earn" />
          <ActionRow
            iconName="star"
            title="Refer & Earn Rewards"
            subtitle="Share your code, earn points, win prizes"
            onPress={() => navigation.navigate('ReferralScreen')}
          />
        </View>

        {/* Insurance Section — Provider Only */}
        {isProvider && (
          <View style={styles.section}>
            <SectionHeader title={t('settings.insuranceSection')} />

            <ActionRow
              iconName="shield"
              title={t('settings.insuranceDocuments')}
              subtitle={
                displayData?.insuranceVerification?.overallStatus === 'approved'
                  ? t('settings.insuranceActiveSub')
                  : displayData?.insuranceVerification?.overallStatus === 'pending' || displayData?.insuranceVerification?.overallStatus === 'under_review'
                  ? t('settings.insuranceReviewSub')
                  : displayData?.insuranceVerification?.overallStatus === 'rejected'
                  ? t('settings.insuranceRejectedSub')
                  : t('settings.insuranceUploadSub')
              }
              onPress={() => navigation.navigate('Insurance')}
            />

            <View style={styles.verificationNote}>
              <View style={styles.verificationNoteIconContainer}>
                <Icon name="info" size={14} color={COLORS.secondary} />
              </View>
              <Text style={styles.verificationNoteText}>
                {t('settings.insuranceNote')}
              </Text>
            </View>
          </View>
        )}

        {/* Notifications Section */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.notifications')} />

          <ToggleRow
            iconName="notification"
            title={t('settings.pushNotifications')}
            subtitle={
              notificationPermission === RESULTS.BLOCKED
                ? t('settings.pushDisabledSystem')
                : notifications.pushEnabled
                  ? t('settings.pushReceiveAlerts')
                  : t('settings.pushEnableUpdates')
            }
            value={notifications.pushEnabled}
            onValueChange={handlePushNotificationChange}
          />

          <ToggleRow
            iconName="email"
            title={t('settings.emailNotifications')}
            subtitle={t('settings.emailNotificationsSub')}
            value={notifications.emailEnabled}
            onValueChange={handleEmailNotificationChange}
          />
        </View>

        {/* App Preferences Section */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.preferences')} />

          <ToggleRow
            iconName="settings"
            title={t('settings.hapticFeedback')}
            subtitle={t('settings.hapticFeedbackSub')}
            value={appPreferences.hapticFeedback}
            onValueChange={(value) => handlePreferenceChange('hapticFeedback', value)}
          />

          <ToggleRow
            iconName="notification"
            title={t('settings.notificationSound')}
            subtitle={t('settings.notificationSoundSub')}
            value={appPreferences.notificationSound}
            onValueChange={(value) => handlePreferenceChange('notificationSound', value)}
          />

          <ToggleRow
            iconName="location"
            title={t('settings.distanceUnit')}
            subtitle={appPreferences.distanceInKm ? t('settings.distanceKm') : t('settings.distanceMeters')}
            value={appPreferences.distanceInKm}
            onValueChange={(value) => handlePreferenceChange('distanceInKm', value)}
          />

          <ActionRow
            iconName="settings"
            title={t('settings.language')}
            subtitle={languages.find(l => l.code === language)?.nativeLabel || 'English'}
            onPress={() => setShowLangModal(true)}
          />
        </View>

        {/* App Settings Section */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.app')} />

          <ToggleRow
            iconName="settings"
            title={t('settings.autoUpdate')}
            subtitle={autoUpdateEnabled
              ? t('settings.autoUpdateOnSub')
              : t('settings.autoUpdateOffSub')}
            value={autoUpdateEnabled}
            onValueChange={handleAutoUpdateChange}
          />

          <ActionRow
            iconName="settings"
            title={t('settings.checkForUpdates')}
            subtitle={checkingForUpdate ? t('settings.checking') : t('settings.currentVersion', { version: getCurrentAppVersion() })}
            onPress={handleCheckForUpdate}
          />

          <ActionRow
            iconName="info"
            title={t('settings.aboutFixhomi')}
            subtitle={t('settings.version', { version: getCurrentAppVersion() })}
            onPress={() => {
              dialog(
                'About FixHomi',
                `FixHomi - Your trusted home services partner.\n\nVersion ${getCurrentAppVersion()}\n\n\u00A9 2026 FixHomi. All rights reserved.`,
                [{ text: 'OK' }]
              );
            }}
          />

          <ActionRow
            iconName="star"
            title={t('settings.rateFixhomi')}
            subtitle={t('settings.rateFixhomiSub')}
            onPress={() => {
              dialog(
                'Rate FixHomi',
                'Would you like to rate FixHomi on the app store?',
                [
                  { text: 'Later', style: 'cancel' },
                  {
                    text: 'Rate Now',
                    onPress: () => {
                      const storeUrl = Platform.OS === 'ios'
                        ? 'https://apps.apple.com/app/fixhomi/id6760935950'
                        : 'https://play.google.com/store/apps/details?id=com.renfi';
                      Linking.openURL(storeUrl).catch(() => {
                        dialog('Error', 'Could not open the app store.');
                      });
                    }
                  },
                ]
              );
            }}
          />

          <ActionRow
            iconName="download"
            title={t('settings.downloadData') || 'Download My Data'}
            subtitle={t('settings.downloadDataSub') || 'Export all your data'}
            onPress={handleExportData}
            loading={isExportingData}
            disabled={isExportingData}
          />

          <ActionRow
            iconName="help"
            title={t('settings.helpSupport')}
            subtitle={t('settings.helpSupportSub')}
            onPress={() => {
              dialog(
                'Help & Support',
                'How would you like to reach us?',
                [
                  {
                    text: 'WhatsApp',
                    onPress: () => {
                      Analytics.track(userType === 'provider' ? EV.SUPPORT_CONTACTED : EV.CUSTOMER_SUPPORT_CONTACTED, { role: userType, channel: 'whatsapp' });
                      Linking.openURL('https://wa.me/918446385312');
                    },
                  },
                  {
                    text: 'Email',
                    onPress: () => {
                      Analytics.track(userType === 'provider' ? EV.SUPPORT_CONTACTED : EV.CUSTOMER_SUPPORT_CONTACTED, { role: userType, channel: 'email' });
                      Linking.openURL('mailto:contact@fixhomi.com').catch(() => dialog('Email Us', 'contact@fixhomi.com'));
                    },
                  },
                  {
                    text: 'Visit Support Page',
                    onPress: () => {
                      Analytics.track(userType === 'provider' ? EV.SUPPORT_CONTACTED : EV.CUSTOMER_SUPPORT_CONTACTED, { role: userType, channel: 'web' });
                      Linking.openURL('https://fixhomi.com/support');
                    },
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                ]
              );
            }}
          />

          <ActionRow
            iconName="document"
            title={t('settings.privacyPolicy') || 'Privacy Policy'}
            onPress={() => Linking.openURL('https://fixhomi.com/privacy')}
          />

          <ActionRow
            iconName="document"
            title={t('settings.termsOfService') || 'Terms of Service'}
            onPress={() => Linking.openURL('https://fixhomi.com/terms')}
          />
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.security')} />

          <ActionRow
            iconName="lock"
            title={t('settings.changePassword')}
            subtitle={t('settings.changePasswordSub')}
            onPress={() => navigation.navigate('ChangePassword')}
          />

          <ActionRow
            iconName="shield"
            title={t('settings.accountSecurity')}
            subtitle={t('settings.accountSecuritySub')}
            onPress={() => navigation.navigate('AccountSecurity')}
          />
        </View>

        {/* Account Actions Section */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.account')} />

          <ActionRow
            iconName="logout"
            title={t('settings.logoutBtn')}
            onPress={handleLogout}
            showArrow={false}
          />

          <ActionRow
            iconName="delete"
            title={isRequestingOtp ? 'Sending OTP' : t('settings.deleteAccount')}
            danger
            onPress={handleDeleteAccount}
            showArrow={false}
            loading={isRequestingOtp}
            disabled={isRequestingOtp}
          />
        </View>

        {/* Account Info */}
        <View style={styles.accountInfo}>
          <Text style={styles.accountInfoText}>
            Logged in as {displayData?.fullName || displayData?.email || 'User'}
          </Text>
          <Text style={styles.accountInfoSubtext}>
            Member since {displayData?.createdAt
              ? new Date(displayData.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
              : 'N/A'
            }
          </Text>
        </View>

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <View style={styles.brandLogoContainer}>
            <Image source={FIXHOMI_LOGO} style={styles.brandFooterLogo} />
          </View>
          <Text style={styles.brandFooterText}>FixHomi</Text>
          <Text style={styles.brandFooterTagline}>Fix Your Home, Anytime</Text>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={showLangModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangModal(false)}
      >
        <TouchableOpacity
          style={settingsLangStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowLangModal(false)}
        >
          <View style={settingsLangStyles.modal}>
            <Text style={settingsLangStyles.title}>Select Language</Text>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  settingsLangStyles.option,
                  language === lang.code && settingsLangStyles.optionActive,
                ]}
                onPress={() => {
                  setLanguage(lang.code);
                  setShowLangModal(false);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[
                    settingsLangStyles.optionText,
                    language === lang.code && settingsLangStyles.optionTextActive,
                  ]}>
                    {lang.nativeLabel}
                  </Text>
                  <Text style={settingsLangStyles.optionSub}>{lang.label}</Text>
                </View>
                {language === lang.code && (
                  <Icon name="check" size={20} color={COLORS.secondary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Account OTP Modal */}
      <Modal
        visible={deleteOtpModalVisible}
        transparent
        animationType={Platform.OS === 'ios' ? 'fade' : 'slide'}
        onRequestClose={() => {
          if (!isDeletingAccount) {
            setDeleteOtpModalVisible(false);
            setDeleteOtp('');
            setDeleteReason('');
          }
        }}
      >
        {Platform.OS === 'ios' ? (
          /* ── iOS: Frosted glass OTP modal ── */
          <View style={styles.iosDeleteBg}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.iosDeleteCenter}>
                <View style={styles.iosDeleteWrap}>
                  {/* Main card */}
                  <View style={styles.iosDeleteCardOuter}>
                    <BlurView
                      style={styles.iosBlurFill}
                      blurType="light"
                      blurAmount={80}
                      reducedTransparencyFallbackColor="#F2F2F7"
                    >
                      <View style={styles.iosDeleteContent}>
                        <Text style={styles.iosDeleteIcon}>⚠️</Text>
                        <Text style={styles.iosDeleteTitle}>Verify Account Deletion</Text>
                        <Text style={styles.iosDeleteSubtitle}>
                          Enter the 6-digit OTP sent to {maskedPhone}
                        </Text>

                        <TextInput
                          style={[styles.iosOtpInput, isDeletingAccount && { opacity: 0.5 }]}
                          placeholder="000000"
                          placeholderTextColor="rgba(0,0,0,0.2)"
                          keyboardType="number-pad"
                          maxLength={6}
                          value={deleteOtp}
                          onChangeText={setDeleteOtp}
                          autoFocus
                          editable={!isDeletingAccount}
                          // SMS OTP autofill (deletion code sent to maskedPhone):
                          // Android via autoComplete="sms-otp", iOS via textContentType.
                          autoComplete="sms-otp"
                          textContentType="oneTimeCode"
                        />

                        <TextInput
                          style={[styles.iosReasonInput, isDeletingAccount && { opacity: 0.5 }]}
                          placeholder="Reason for leaving (optional)"
                          placeholderTextColor="rgba(0,0,0,0.2)"
                          value={deleteReason}
                          onChangeText={setDeleteReason}
                          multiline
                          numberOfLines={2}
                          editable={!isDeletingAccount}
                        />

                        <TouchableOpacity
                          style={[styles.iosResendBtn, (isRequestingOtp || isDeletingAccount) && { opacity: 0.4 }]}
                          onPress={resendDeleteOtp}
                          disabled={isRequestingOtp || isDeletingAccount}
                        >
                          {isRequestingOtp ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <ActivityIndicator size={14} color="#007AFF" />
                              <Text style={styles.iosResendText}>Sending...</Text>
                            </View>
                          ) : (
                            <Text style={styles.iosResendText}>Resend OTP</Text>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Delete button */}
                      <View style={styles.iosDeleteActions}>
                        <TouchableOpacity
                          style={[styles.iosDeleteBtn, (isDeletingAccount || deleteOtp.length !== 6) && styles.iosDeleteBtnDisabled]}
                          onPress={confirmDeleteWithOtp}
                          disabled={isDeletingAccount || deleteOtp.length !== 6}
                          activeOpacity={0.7}
                        >
                          {isDeletingAccount ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Text style={styles.iosDeleteBtnText}>Delete Account</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </BlurView>
                  </View>

                  {/* Cancel — separate frosted card */}
                  <View style={styles.iosCancelOuter}>
                    <BlurView
                      style={styles.iosBlurFill}
                      blurType="light"
                      blurAmount={80}
                      reducedTransparencyFallbackColor="#F2F2F7"
                    >
                      <TouchableOpacity
                        style={styles.iosCancelBtn}
                        onPress={() => {
                          if (!isDeletingAccount) {
                            setDeleteOtpModalVisible(false);
                            setDeleteOtp('');
                            setDeleteReason('');
                          }
                        }}
                        disabled={isDeletingAccount}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.iosCancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </BlurView>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
        ) : (
          /* ── Android: Existing card design ──
           * behavior="padding" (not "height"). "height" re-measures the layout
           * on every keyboard event which caused the modal to shake on non-
           * Samsung ROMs. Padding just shifts the content up smoothly.
           */
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeaderBar} />
                  <Text style={styles.modalTitle}>Verify Account Deletion</Text>
                  <Text style={styles.modalSubtitle}>
                    Enter the 6-digit OTP sent to {maskedPhone}
                  </Text>

                  <TextInput
                    style={[styles.otpInput, isDeletingAccount && { opacity: 0.5 }]}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={deleteOtp}
                    onChangeText={setDeleteOtp}
                    autoFocus
                    editable={!isDeletingAccount}
                    textContentType="oneTimeCode"
                    autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                  />

                  <TextInput
                    style={[styles.reasonInput, isDeletingAccount && { opacity: 0.5 }]}
                    placeholder="Reason for leaving (optional)"
                    placeholderTextColor={COLORS.muted}
                    value={deleteReason}
                    onChangeText={setDeleteReason}
                    multiline
                    numberOfLines={2}
                    editable={!isDeletingAccount}
                  />

                  <TouchableOpacity
                    style={[styles.resendButton, (isRequestingOtp || isDeletingAccount) && { opacity: 0.5 }]}
                    onPress={resendDeleteOtp}
                    disabled={isRequestingOtp || isDeletingAccount}
                  >
                    {isRequestingOtp ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ActivityIndicator size={14} color={COLORS.primary} />
                        <Text style={styles.resendButtonText}>Sending...</Text>
                      </View>
                    ) : (
                      <Text style={styles.resendButtonText}>Resend OTP</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton, isDeletingAccount && styles.disabledButton]}
                      onPress={() => {
                        if (!isDeletingAccount) {
                          setDeleteOtpModalVisible(false);
                          setDeleteOtp('');
                          setDeleteReason('');
                        }
                      }}
                      disabled={isDeletingAccount}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        styles.deleteButton,
                        (isDeletingAccount || deleteOtp.length !== 6) && styles.disabledButton
                      ]}
                      onPress={confirmDeleteWithOtp}
                      disabled={isDeletingAccount || deleteOtp.length !== 6}
                    >
                      {isDeletingAccount ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.deleteButtonText}>Delete Account</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        )}
      </Modal>

      {/* Logout / Sign-out overlay — blocks interaction during cleanup */}
      {isLoggingOut && (
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutOverlayCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.logoutOverlayText}>Signing out...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Premium Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.darkHero,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.cardWhite,
    letterSpacing: 0.3,
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 24,
  },

  // Premium Card Section
  section: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: CARD_RADIUS,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS,
  },

  // Section Header with accent bar
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionAccentBar: {
    width: 4,
    height: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginRight: 10,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Settings Row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  rowIconContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_RADIUS,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowIconDanger: {
    backgroundColor: COLORS.dangerLight,
  },
  rowContent: {
    flex: 1,
  },
  rowTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  infoButton: {
    marginLeft: 8,
    padding: 4,
    flexShrink: 0,
  },
  rowTitleDanger: {
    color: COLORS.danger,
  },
  rowSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 3,
    lineHeight: 17,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Working Hours
  workingHoursHint: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 12,
  },
  workingHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textTransform: 'capitalize',
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hoursText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  // Verification Note
  verificationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.iconBg,
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  verificationNoteIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  verificationNoteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },

  // Account Info
  accountInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  accountInfoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  accountInfoSubtext: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },

  // Brand Footer
  brandFooter: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingBottom: 48,
    gap: 8,
  },
  brandLogoContainer: {
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  brandFooterLogo: {
    width: 60,
    height: 60,
    borderRadius: 18,
  },
  brandFooterText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  brandFooterTagline: {
    fontSize: 12,
    color: COLORS.muted,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },

  // Delete Account OTP Modal (Premium)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: CARD_RADIUS,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    ...SHADOWS,
  },
  modalHeaderBar: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.divider,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  otpInput: {
    backgroundColor: COLORS.iconBg,
    borderRadius: 16,
    padding: 18,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  reasonInput: {
    backgroundColor: COLORS.iconBg,
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  resendButton: {
    alignSelf: 'center',
    marginBottom: 24,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.iconBg,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.cardWhite,
  },
  disabledButton: {
    opacity: 0.5,
  },

  // ─── iOS Delete Account OTP ────────────────────────────────────
  iosDeleteBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  iosDeleteCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  iosDeleteWrap: {
    width: '100%',
    maxWidth: 300,
  },
  iosDeleteCardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  iosBlurFill: {},
  iosDeleteContent: {
    paddingTop: 28,
    paddingBottom: 6,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  iosDeleteIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  iosDeleteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: -0.45,
  },
  iosDeleteSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(0, 0, 0, 0.55)',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: -0.15,
    marginTop: 6,
    marginBottom: 20,
  },
  iosOtpInput: {
    width: '100%',
    backgroundColor: 'rgba(120, 120, 128, 0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 10,
    color: '#000000',
    marginBottom: 12,
  },
  iosReasonInput: {
    width: '100%',
    backgroundColor: 'rgba(120, 120, 128, 0.12)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#000000',
    marginBottom: 12,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  iosResendBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  iosResendText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '400',
    letterSpacing: -0.24,
  },
  iosDeleteActions: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  iosDeleteBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosDeleteBtnDisabled: {
    backgroundColor: '#C7C7CC',
  },
  iosDeleteBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.41,
  },
  iosCancelOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 10,
  },
  iosCancelBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosCancelBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: -0.41,
  },

  // Logout overlay
  logoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logoutOverlayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  logoutOverlayText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
});

const settingsLangStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 320,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  optionActive: {
    backgroundColor: `${COLORS.secondary}15`,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  optionTextActive: {
    color: COLORS.secondary,
  },
  optionSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
});

export default SettingsScreen;
