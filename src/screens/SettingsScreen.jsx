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
 * @version 2.0.0 - Working notifications + more settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
  Platform,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { startLocationTracking, stopLocationTracking } from '../services/socketService';
import { Icon, FixhomiLogo } from '../components';
import { NODE_BASE_URL, JAVA_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  background: '#faf7f7',
  white: '#FFFFFF',
};

/**
 * Settings Section Header
 */
const SectionHeader = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

/**
 * Settings Row with toggle
 */
const ToggleRow = ({ iconName, title, subtitle, value, onValueChange, disabled, onInfoPress }) => (
  <View style={styles.settingsRow}>
    <View style={styles.rowIconContainer}>
      <Icon name={iconName} size={20} color="#6B7280" />
    </View>
    <View style={styles.rowContent}>
      <View style={styles.rowTitleContainer}>
        <Text style={styles.rowTitle}>{title}</Text>
        {onInfoPress && (
          <TouchableOpacity onPress={onInfoPress} style={styles.infoButton}>
            <Icon name="info" size={16} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>
      {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: '#E5E7EB', true: BRAND.primary + '50' }}
      thumbColor={value ? BRAND.primary : '#9CA3AF'}
    />
  </View>
);

/**
 * Settings Row with navigation/action
 */
const ActionRow = ({ iconName, title, subtitle, onPress, showArrow = true, danger = false }) => (
  <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.rowIconContainer, danger && styles.rowIconDanger]}>
      <Icon name={iconName} size={20} color={danger ? '#EF4444' : '#6B7280'} />
    </View>
    <View style={styles.rowContent}>
      <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
      {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
    </View>
    {showArrow && <Icon name="chevron-right" size={20} color="#9CA3AF" />}
  </TouchableOpacity>
);

/**
 * Working Hours Display/Edit Component
 */
const WorkingHoursRow = ({ day, hours, onEdit }) => (
  <TouchableOpacity style={styles.workingHoursRow} onPress={onEdit}>
    <Text style={styles.dayLabel}>{day}</Text>
    <View style={styles.hoursContainer}>
      <Text style={styles.hoursText}>
        {hours?.start || '09:00'} - {hours?.end || '18:00'}
      </Text>
      <Icon name="edit" size={16} color="#6B7280" />
    </View>
  </TouchableOpacity>
);

/**
 * Settings Screen Component
 */
const SettingsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, userType, logout, refreshProfile, updateProviderAvailability, updateProviderLocationTracking } = useApp();
  
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
    soundEffects: true,
    autoRefresh: true,
    showDistanceInKm: true,
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
      console.log('📍 [Settings] Auto-starting location tracking (persisted setting is enabled)');
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
      // User wants to enable - check/request permission
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.NOTIFICATIONS
        : PERMISSIONS.ANDROID.POST_NOTIFICATIONS;
      
      const currentStatus = await check(permission);
      
      if (currentStatus === RESULTS.BLOCKED) {
        // Permission previously denied - need to go to settings
        Alert.alert(
          'Notifications Disabled',
          'Push notifications are disabled in your device settings. Would you like to enable them?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSettings() },
          ]
        );
        return;
      }
      
      if (currentStatus === RESULTS.DENIED) {
        // Request permission
        const result = await request(permission);
        if (result !== RESULTS.GRANTED) {
          Alert.alert('Permission Required', 'Please enable notifications to receive updates about your service requests.');
          return;
        }
      }
      
      setNotificationPermission(RESULTS.GRANTED);
    }
    
    const newNotifications = { ...notifications, pushEnabled: value };
    setNotifications(newNotifications);
    savePreferences('notification_preferences', newNotifications);
    
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
    
    setIsUpdatingAvailability(true);
    try {
      const result = await updateProviderAvailability(value);
      if (!result.success) {
        Alert.alert('Error', result.message || 'Failed to update availability');
      }
    } catch (error) {
      console.error('❌ [Settings] Error updating availability:', error);
      Alert.alert('Error', 'Failed to update availability');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };
  
  /**
   * Show info about availability toggle
   */
  const showAvailabilityInfo = () => {
    Alert.alert(
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
    Alert.alert(
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
    
    console.log('📡 [Settings] Updating location tracking to:', value);
    setIsUpdatingLocationTracking(true);
    try {
      const result = await updateProviderLocationTracking(value);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to update location tracking');
      } else {
        // Actually start/stop GPS tracking based on toggle
        if (value) {
          console.log('📍 [Settings] Starting location tracking for provider:', userId);
          startLocationTracking(userId);
        } else {
          console.log('📍 [Settings] Stopping location tracking');
          stopLocationTracking();
        }
      }
    } catch (error) {
      console.error('❌ [Settings] Error updating location tracking:', error);
      Alert.alert('Error', 'Failed to update location tracking');
    } finally {
      setIsUpdatingLocationTracking(false);
    }
  };
  
  /**
   * Handle emergency hours toggle (12 AM – 6 AM availability)
   */
  const handleEmergencyServicesChange = async (value) => {
    if (!userId || isUpdatingEmergency) return;

    setIsUpdatingEmergency(true);
    try {
      const tokens = await getTokens();
      const response = await fetch(`${NODE_BASE_URL}/api/provider/${userId}/emergency-services`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify({ enabled: value }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setEmergencyServicesEnabled(value);
        Alert.alert(
          value ? 'Emergency Hours Enabled' : 'Emergency Hours Disabled',
          value
            ? 'You will now appear in search results during midnight hours (12 AM – 6 AM IST).'
            : 'You will no longer appear in midnight hour searches.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to update emergency services setting');
      }
    } catch (error) {
      console.error('❌ [Settings] Error updating emergency services:', error);
      Alert.alert('Error', 'Failed to update emergency hours setting. Please check your connection.');
    } finally {
      setIsUpdatingEmergency(false);
    }
  };

  /**
   * Show info about emergency hours toggle
   */
  const showEmergencyServicesInfo = () => {
    Alert.alert(
      'Emergency Hours (12 AM – 6 AM)',
      'This toggle controls your availability during midnight hours.\n\n' +
      'When enabled:\n\n' +
      '• You will appear in search results between 12 AM and 6 AM IST\n' +
      '• Customers in need of urgent help can find and contact you\n' +
      '• Only providers who opt in are shown during these hours\n\n' +
      'When disabled:\n\n' +
      '• You will not appear in searches during 12 AM – 6 AM IST\n' +
      '• Your regular daytime availability is not affected\n\n' +
      'Note: This applies to all service types. Event services are not affected by emergency hours.',
      [{ text: 'Got it' }]
    );
  };

  /**
   * Handle working hours edit
   */
  const handleEditWorkingHours = (day) => {
    Alert.alert(
      `Edit ${day} Hours`,
      'Working hours editor will be available in the next update.',
      [{ text: 'OK' }]
    );
  };
  
  /**
   * Handle logout
   */
  const handleLogout = () => {
    Alert.alert(
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
    Alert.alert(
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
      const response = await fetch(`${JAVA_BASE_URL}/api/users/delete-account/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        // OTP sent successfully - show OTP input modal
        // Java Auth returns { message: "OTP sent to ******7890..." }
        const phoneMask = result.message?.match(/\*{4,}\d{4}/)?.[0] || '******';
        setMaskedPhone(result.maskedPhone || phoneMask);
        setDeleteOtpModalVisible(true);
      } else {
        Alert.alert('Error', result.message || 'Failed to send OTP. Please try again.');
      }
    } catch (error) {
      console.error('Request delete OTP error:', error);
      Alert.alert('Error', 'Failed to send OTP. Please check your connection and try again.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  /**
   * Confirm account deletion with OTP - Step 2
   */
  const confirmDeleteWithOtp = async () => {
    if (deleteOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP sent to your phone.');
      return;
    }

    try {
      setIsDeletingAccount(true);
      const tokens = await getTokens();
      
      // Call Java Auth directly to verify OTP and delete auth account
      const response = await fetch(`${JAVA_BASE_URL}/api/users/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify({
          otp: deleteOtp,
          reason: deleteReason || 'User requested deletion',
        }),
      });

      const result = await response.json();

      // Attempt MongoDB cleanup via Node.js (non-blocking)
      if (response.ok) {
        try {
          await fetch(`${NODE_BASE_URL}/api/auth/cleanup-account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokens?.accessToken}`,
            },
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
        Alert.alert(
          'Account Deleted',
          'Your account has been successfully deleted. We\'re sorry to see you go.',
          [{ text: 'OK', onPress: () => logout() }]
        );
      } else {
        Alert.alert('Error', result.message || 'Invalid OTP or deletion failed. Please try again.');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      Alert.alert('Error', 'Failed to delete account. Please check your connection and try again.');
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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow_back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
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
              title="Emergency Hours (12–6 AM)"
              subtitle={emergencyServicesEnabled ? 'You are searchable during midnight hours (12 AM – 6 AM IST)' : 'Toggle ON to be available during midnight hours'}
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
              subtitle={displayData?.isPremium ? 'Active — visible in Traditional & Event searches' : 'Subscribe to appear in search results'}
              onPress={() => navigation.navigate('Subscription')}
            />
            
            <View style={styles.verificationNote}>
              <Icon name="info" size={16} color="#6B7280" />
              <Text style={styles.verificationNoteText}>
                Complete phone, email, Aadhaar verification and get service approval to appear in customer searches. Premium is required for Traditional & Event services.
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
            title="Sound Effects"
            subtitle="Play sounds for notifications"
            value={appPreferences.soundEffects}
            onValueChange={(value) => handlePreferenceChange('soundEffects', value)}
          />
          
          <ToggleRow
            iconName="refresh"
            title="Auto Refresh"
            subtitle="Automatically update service list"
            value={appPreferences.autoRefresh}
            onValueChange={(value) => handlePreferenceChange('autoRefresh', value)}
          />
          
          <ToggleRow
            iconName="location"
            title="Distance in Kilometers"
            subtitle={appPreferences.showDistanceInKm ? 'Showing distance in km' : 'Showing distance in miles'}
            value={appPreferences.showDistanceInKm}
            onValueChange={(value) => handlePreferenceChange('showDistanceInKm', value)}
          />
        </View>
        
        {/* App Settings Section */}
        <View style={styles.section}>
          <SectionHeader title="App" />
          
          <ActionRow
            iconName="info"
            title="About FixHomi"
            subtitle="Version 1.0.0"
            onPress={() => {
              Alert.alert(
                'About FixHomi',
                'FixHomi - Your trusted home services partner.\n\nVersion 1.0.0\nBuild 2026.01.22\n\n© 2026 FixHomi. All rights reserved.',
                [{ text: 'OK' }]
              );
            }}
          />
          
          <ActionRow
            iconName="star"
            title="Rate FixHomi"
            subtitle="Love the app? Rate us on the store"
            onPress={() => {
              Alert.alert(
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
                        Alert.alert('Error', 'Could not open the app store.');
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
          <FixhomiLogo size={40} color={BRAND.primary} />
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
            <Text style={styles.modalTitle}>Verify Account Deletion</Text>
            <Text style={styles.modalSubtitle}>
              Enter the 6-digit OTP sent to {maskedPhone}
            </Text>
            
            <TextInput
              style={styles.otpInput}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={6}
              value={deleteOtp}
              onChangeText={setDeleteOtp}
              autoFocus
            />
            
            <TextInput
              style={styles.reasonInput}
              placeholder="Reason for leaving (optional)"
              placeholderTextColor="#9CA3AF"
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
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  
  // Section
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Settings Row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowIconDanger: {
    backgroundColor: '#FEE2E2',
  },
  rowContent: {
    flex: 1,
  },
  rowTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  infoButton: {
    marginLeft: 6,
    padding: 2,
  },
  rowTitleDanger: {
    color: '#EF4444',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  
  // Working Hours
  workingHoursHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  workingHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    textTransform: 'capitalize',
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hoursText: {
    fontSize: 14,
    color: '#6B7280',
  },
  
  // Verification Note
  verificationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  verificationNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  
  // Account Info
  accountInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  accountInfoText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  accountInfoSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  
  // Brand Footer
  brandFooter: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingBottom: 48,
    gap: 8,
  },
  brandFooterText: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND.primary,
    letterSpacing: 0.5,
  },
  brandFooterTagline: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  
  // Delete Account OTP Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  otpInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 8,
    color: '#1F2937',
    marginBottom: 16,
  },
  reasonInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  resendButton: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  resendButtonText: {
    fontSize: 14,
    color: BRAND.primary,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default SettingsScreen;
