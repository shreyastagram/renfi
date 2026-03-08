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
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
  Platform,
  Vibration,
  Image,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { startLocationTracking, stopLocationTracking } from '../services/socketService';
import { Icon } from '../components';
import { NODE_BASE_URL, JAVA_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';
import { getTokens } from '../utils/storage';
import { playNotificationSound } from '../utils/notificationSound';

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
          trackColor={{ false: COLORS.switchTrackOff, true: COLORS.primary + '40' }}
          thumbColor={value ? COLORS.primary : COLORS.switchThumbOff}
          ios_backgroundColor={COLORS.switchTrackOff}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * Settings Row with navigation/action
 */
const ActionRow = ({ iconName, title, subtitle, onPress, showArrow = true, danger = false }) => (
  <AnimatedPressable onPress={onPress}>
    <View style={styles.settingsRow}>
      <View style={[styles.rowIconContainer, danger && styles.rowIconDanger]}>
        <Icon name={iconName} size={20} color={danger ? COLORS.danger : COLORS.secondary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
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
 * Settings Screen Component
 */
const SettingsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, userType, logout, refreshProfile, updateProviderAvailability, updateProviderLocationTracking } = useApp();
  const { dialog } = useDialog();

  const displayData = { ...user, ...profile };
  const isProvider = userType === 'provider';
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  // Derive isAvailable from context (single source of truth)
  const isAvailable = displayData?.isAvailable ?? displayData?.isOnline ?? true;

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
      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.NOTIFICATIONS
        : PERMISSIONS.ANDROID.POST_NOTIFICATIONS;

      const result = await check(permission);
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
      // User wants to enable - check/request system permission
      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.NOTIFICATIONS
        : PERMISSIONS.ANDROID.POST_NOTIFICATIONS;

      try {
        const currentStatus = await check(permission);

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
          const result = await request(permission);
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
   * Handle emergency hours toggle (12 AM - 6 AM availability)
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
        dialog(
          value ? 'Emergency Hours Enabled' : 'Emergency Hours Disabled',
          value
            ? 'You will now appear in search results during midnight hours (12 AM \u2013 6 AM IST).'
            : 'You will no longer appear in midnight hour searches.',
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
      'Emergency Hours (12 AM \u2013 6 AM)',
      'This toggle controls your availability during midnight hours.\n\n' +
      'When enabled:\n\n' +
      '• You will appear in search results between 12 AM and 6 AM IST\n' +
      '• Customers in need of urgent help can find and contact you\n' +
      '• Only providers who opt in are shown during these hours\n\n' +
      'When disabled:\n\n' +
      '• You will not appear in searches during 12 AM \u2013 6 AM IST\n' +
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
      `Edit ${day} Hours`,
      'Working hours editor will be available in the next update.',
      [{ text: 'OK' }]
    );
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

      // Attempt MongoDB cleanup via Node.js (non-blocking)
      if (response.ok) {
        try {
          await authFetch(`${NODE_BASE_URL}/api/auth/cleanup-account`, {
            method: 'POST',
            body: JSON.stringify({ reason: deleteReason || 'User requested deletion' }),
          });
        } catch (cleanupErr) {
          console.warn('[Settings] MongoDB cleanup call failed (non-critical):', cleanupErr.message);
        }
      }

      if (response.ok) {
        setDeleteOtpModalVisible(false);
        setDeleteOtp('');
        setDeleteReason('');
        dialog(
          'Account Deleted',
          'Your account has been successfully deleted. We\'re sorry to see you go.',
          [{ text: 'OK', onPress: () => logout() }]
        );
      } else {
        dialog('Error', result.message || 'Invalid OTP or deletion failed. Please try again.');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      dialog('Error', 'Failed to delete account. Please check your connection and try again.');
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

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow_back" size={22} color={COLORS.cardWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Provider Availability Section */}
        {isProvider && (
          <View style={styles.section}>
            <SectionHeader title="Availability" />

            <ToggleRow
              iconName="location"
              title="Available for Work"
              subtitle={isAvailable ? 'Customers can see and book you' : 'You are hidden from customers'}
              value={isAvailable}
              onValueChange={handleAvailabilityChange}
              onInfoPress={showAvailabilityInfo}
              disabled={isUpdatingAvailability}
            />

            <ToggleRow
              iconName="my_location"
              title="Live Location Tracking"
              subtitle="Allow customers to see your real-time location"
              value={locationTracking}
              onValueChange={handleLocationTrackingChange}
              onInfoPress={showLocationTrackingInfo}
              disabled={isUpdatingLocationTracking}
            />

            <ToggleRow
              iconName="notification"
              title="Emergency Hours (12\u20136 AM)"
              subtitle={emergencyServicesEnabled ? 'You are searchable during midnight hours (12 AM \u2013 6 AM IST)' : 'Toggle ON to be available during midnight hours'}
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
            <SectionHeader title="Verification" />

            <ActionRow
              iconName="verified"
              title="Verification Dashboard"
              subtitle="View your 5-step verification progress"
              onPress={() => navigation.navigate('VerificationDashboard')}
            />

            <ActionRow
              iconName="document"
              title="Request Service Approvals"
              subtitle={
                displayData?.documentVerification?.overallStatus === 'fully_verified'
                  ? 'All services verified'
                  : displayData?.documentVerification?.overallStatus === 'partially_verified'
                  ? 'Some services verified'
                  : displayData?.documentVerification?.overallStatus === 'pending'
                  ? 'Under review (3-5 business days)'
                  : 'Get verified to receive requests'
              }
              onPress={() => navigation.navigate('DocumentVerification')}
            />

            <ActionRow
              iconName="star"
              title="Premium Subscription"
              subtitle={displayData?.isPremium ? 'Active \u2014 visible in Traditional & Event searches' : 'Subscribe to appear in search results'}
              onPress={() => navigation.navigate('Subscription')}
            />

            <View style={styles.verificationNote}>
              <View style={styles.verificationNoteIconContainer}>
                <Icon name="info" size={14} color={COLORS.secondary} />
              </View>
              <Text style={styles.verificationNoteText}>
                Complete phone, email, Aadhaar verification and get service approval to appear in customer searches. Premium is required for Traditional & Event services.
              </Text>
            </View>
          </View>
        )}

        {/* Insurance Section — Provider Only */}
        {isProvider && (
          <View style={styles.section}>
            <SectionHeader title="Insurance" />

            <ActionRow
              iconName="shield"
              title="Insurance Documents"
              subtitle={
                displayData?.insuranceVerification?.overallStatus === 'approved'
                  ? 'Insurance active — you are covered'
                  : displayData?.insuranceVerification?.overallStatus === 'pending' || displayData?.insuranceVerification?.overallStatus === 'under_review'
                  ? 'Under review (3-5 business days)'
                  : displayData?.insuranceVerification?.overallStatus === 'rejected'
                  ? 'Rejected — please resubmit documents'
                  : 'Upload documents to activate insurance'
              }
              onPress={() => navigation.navigate('Insurance')}
            />

            <View style={styles.verificationNote}>
              <View style={styles.verificationNoteIconContainer}>
                <Icon name="info" size={14} color={COLORS.secondary} />
              </View>
              <Text style={styles.verificationNoteText}>
                Upload PAN Card and Address Proof to activate Fixhomi insurance coverage. Insurance protects you during service delivery.
              </Text>
            </View>
          </View>
        )}

        {/* Notifications Section */}
        <View style={styles.section}>
          <SectionHeader title="Notifications" />

          <ToggleRow
            iconName="notification"
            title="Push Notifications"
            subtitle={
              notificationPermission === RESULTS.BLOCKED
                ? 'Disabled in system settings'
                : notifications.pushEnabled
                  ? 'Receive alerts for new requests'
                  : 'Enable to get important updates'
            }
            value={notifications.pushEnabled}
            onValueChange={handlePushNotificationChange}
          />

          <ToggleRow
            iconName="email"
            title="Email Notifications"
            subtitle="Receive booking confirmations via email"
            value={notifications.emailEnabled}
            onValueChange={handleEmailNotificationChange}
          />
        </View>

        {/* App Preferences Section */}
        <View style={styles.section}>
          <SectionHeader title="Preferences" />

          <ToggleRow
            iconName="settings"
            title="Haptic Feedback"
            subtitle="Vibration feedback for actions"
            value={appPreferences.hapticFeedback}
            onValueChange={(value) => handlePreferenceChange('hapticFeedback', value)}
          />

          <ToggleRow
            iconName="notification"
            title="Notification Sound"
            subtitle="Play sounds for in-app notifications"
            value={appPreferences.notificationSound}
            onValueChange={(value) => handlePreferenceChange('notificationSound', value)}
          />

          <ToggleRow
            iconName="location"
            title="Distance Unit"
            subtitle={appPreferences.distanceInKm ? 'Showing distance in km' : 'Showing distance in meters'}
            value={appPreferences.distanceInKm}
            onValueChange={(value) => handlePreferenceChange('distanceInKm', value)}
          />
        </View>

        {/* App Settings Section */}
        <View style={styles.section}>
          <SectionHeader title="App" />

          <ActionRow
            iconName="info"
            title="About FixHomi"
            subtitle="Version 1.5"
            onPress={() => {
              dialog(
                'About FixHomi',
                'FixHomi - Your trusted home services partner.\n\nVersion 1.5\nBuild 2026.03.04\n\n\u00A9 2026 FixHomi. All rights reserved.',
                [{ text: 'OK' }]
              );
            }}
          />

          <ActionRow
            iconName="star"
            title="Rate FixHomi"
            subtitle="Love the app? Rate us on the store"
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
                        ? 'https://apps.apple.com/app/fixhomi'
                        : 'https://play.google.com/store/apps/details?id=com.fixhomi';
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
            iconName="help"
            title="Help & Support"
            subtitle="Get help with your account"
            onPress={() => Linking.openURL('mailto:support@fixhomi.com')}
          />

          <ActionRow
            iconName="document"
            title="Privacy Policy"
            onPress={() => Linking.openURL('https://fixhomi.com/privacy')}
          />

          <ActionRow
            iconName="document"
            title="Terms of Service"
            onPress={() => Linking.openURL('https://fixhomi.com/terms')}
          />
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <SectionHeader title="Security" />

          <ActionRow
            iconName="lock"
            title="Change Password"
            subtitle="Update your account password"
            onPress={() => navigation.navigate('ChangePassword')}
          />

          <ActionRow
            iconName="shield"
            title="Account Security"
            subtitle="Manage sessions and trusted devices"
            onPress={() => navigation.navigate('AccountSecurity')}
          />
        </View>

        {/* Account Actions Section */}
        <View style={styles.section}>
          <SectionHeader title="Account" />

          <ActionRow
            iconName="logout"
            title="Logout"
            onPress={handleLogout}
            showArrow={false}
          />

          <ActionRow
            iconName="close"
            title="Delete Account"
            danger
            onPress={handleDeleteAccount}
            showArrow={false}
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

      {/* Delete Account OTP Modal */}
      <Modal
        visible={deleteOtpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setDeleteOtpModalVisible(false);
          setDeleteOtp('');
          setDeleteReason('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderBar} />
            <Text style={styles.modalTitle}>Verify Account Deletion</Text>
            <Text style={styles.modalSubtitle}>
              Enter the 6-digit OTP sent to {maskedPhone}
            </Text>

            <TextInput
              style={styles.otpInput}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor={COLORS.muted}
              keyboardType="number-pad"
              maxLength={6}
              value={deleteOtp}
              onChangeText={setDeleteOtp}
              autoFocus
            />

            <TextInput
              style={styles.reasonInput}
              placeholder="Reason for leaving (optional)"
              placeholderTextColor={COLORS.muted}
              value={deleteReason}
              onChangeText={setDeleteReason}
              multiline
              numberOfLines={2}
            />

            <TouchableOpacity
              style={styles.resendButton}
              onPress={resendDeleteOtp}
              disabled={isRequestingOtp}
            >
              <Text style={styles.resendButtonText}>
                {isRequestingOtp ? 'Sending...' : 'Resend OTP'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setDeleteOtpModalVisible(false);
                  setDeleteOtp('');
                  setDeleteReason('');
                }}
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
      </Modal>
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
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  infoButton: {
    marginLeft: 6,
    padding: 4,
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
});

export default SettingsScreen;
