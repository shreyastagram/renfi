/**
 * Settings Screen
 * 
 * User/Provider settings with:
 * - Notification preferences
 * - Location settings
 * - App preferences
 * - Provider-specific settings (working hours, availability)
 * - Account actions (logout, delete)
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Icon } from '../components';
import { updateProviderProfile, updateProviderOnlineStatus } from '../services/profileService';

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
      trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
      thumbColor={value ? '#22C55E' : '#9CA3AF'}
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
  const { user, profile, userType, logout, refreshProfile } = useApp();
  
  const displayData = { ...user, ...profile };
  const isProvider = userType === 'provider';
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
  
  // State
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
  });
  
  // Provider-specific state
  const [isAvailable, setIsAvailable] = useState(displayData?.isAvailable ?? true);
  const [locationTracking, setLocationTracking] = useState(false);
  const [workingHours, setWorkingHours] = useState(displayData?.availability?.workingHours || {});
  
  // Initialize from profile data - specifically check locationTracking.enabled
  useEffect(() => {
    if (displayData) {
      setIsAvailable(displayData.isAvailable ?? displayData.isOnline ?? true);
      // Check multiple possible paths for locationTracking
      const trackingEnabled = displayData.locationTracking?.enabled ?? 
                              displayData.locationTrackingEnabled ?? 
                              false;
      console.log('\ud83d\udccd [Settings] Initializing locationTracking from profile:', trackingEnabled);
      setLocationTracking(trackingEnabled);
      setWorkingHours(displayData.availability?.workingHours || getDefaultWorkingHours());
    }
  }, [displayData?.isAvailable, displayData?.isOnline, displayData?.locationTracking?.enabled, displayData?.availability]);
  
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
   * Handle availability toggle
   */
  const handleAvailabilityChange = async (value) => {
    if (!userId) return;
    
    setIsAvailable(value);
    try {
      const result = await updateProviderOnlineStatus(userId, value);
      if (!result.success) {
        setIsAvailable(!value);
        Alert.alert('Error', 'Failed to update availability');
      }
    } catch (error) {
      setIsAvailable(!value);
      Alert.alert('Error', 'Failed to update availability');
    }
  };
  
  /**
   * Show info about availability toggle
   */
  const showAvailabilityInfo = () => {
    Alert.alert(
      '📍 Available for Work',
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
      '📡 Live Location Tracking',
      'When enabled:\n\n' +
      '• Your real-time location is updated every 30 seconds\n' +
      '• Customers can see you approaching on the map\n' +
      '• Accurate ETA calculation for customers\n' +
      '• Your location is stored in the database for nearby searches\n\n' +
      'When disabled:\n\n' +
      '• Only your last known location is used\n' +
      '• Customers cannot track your arrival\n' +
      '• ETA may be less accurate\n\n' +
      '⚠️ Battery Usage: Location tracking uses GPS which may affect battery life.',
      [{ text: 'Got it' }]
    );
  };
  
  /**
   * Handle location tracking toggle
   */
  const handleLocationTrackingChange = async (value) => {
    if (!userId) return;
    
    setLocationTracking(value);
    try {
      const result = await updateProviderProfile(userId, {
        locationTracking: { enabled: value },
      });
      if (result.success) {
        // Refresh profile to ensure state sync
        await refreshProfile(userType, userId);
      } else {
        setLocationTracking(!value);
        Alert.alert('Error', 'Failed to update location tracking');
      }
    } catch (error) {
      setLocationTracking(!value);
      Alert.alert('Error', 'Failed to update location tracking');
    }
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
   * Handle account deletion
   */
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            Alert.alert('Coming Soon', 'Account deletion will be available in a future update.');
          }
        },
      ]
    );
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
            />
            
            <ToggleRow
              iconName="my_location"
              title="Live Location Tracking"
              subtitle="Allow customers to see your real-time location"
              value={locationTracking}
              onValueChange={handleLocationTrackingChange}
              onInfoPress={showLocationTrackingInfo}
            />
          </View>
        )}
        
        {/* Provider Working Hours Section */}
        {isProvider && (
          <View style={styles.section}>
            <SectionHeader title="Working Hours" />
            <Text style={styles.workingHoursHint}>
              Set your available hours for each day
            </Text>
            
            {Object.entries(workingHours).map(([day, hours]) => (
              <WorkingHoursRow
                key={day}
                day={day.charAt(0).toUpperCase() + day.slice(1)}
                hours={hours}
                onEdit={() => handleEditWorkingHours(day)}
              />
            ))}
          </View>
        )}
        
        {/* Notifications Section */}
        <View style={styles.section}>
          <SectionHeader title="Notifications" />
          
          <ToggleRow
            iconName="notification"
            title="Push Notifications"
            subtitle="Receive alerts for new requests and updates"
            value={notifications.pushEnabled}
            onValueChange={(value) => setNotifications(prev => ({ ...prev, pushEnabled: value }))}
          />
          
          <ToggleRow
            iconName="email"
            title="Email Notifications"
            subtitle="Receive booking confirmations via email"
            value={notifications.emailEnabled}
            onValueChange={(value) => setNotifications(prev => ({ ...prev, emailEnabled: value }))}
          />
        </View>
        
        {/* Provider Verification Section */}
        {isProvider && (
          <View style={styles.section}>
            <SectionHeader title="Verification" />
            
            <ActionRow
              iconName="document"
              title="Document Verification"
              subtitle={displayData?.verification?.isVerified ? 'Verified ✓' : 'Verify your identity'}
              onPress={() => {
                Alert.alert('Coming Soon', 'Document verification (Aadhaar, PAN) will be available soon.');
              }}
            />
            
            <View style={styles.verificationNote}>
              <Icon name="info" size={16} color="#6B7280" />
              <Text style={styles.verificationNoteText}>
                Complete verification to get the verified badge and build trust with customers.
              </Text>
            </View>
          </View>
        )}
        
        {/* App Settings Section */}
        <View style={styles.section}>
          <SectionHeader title="App" />
          
          <ActionRow
            iconName="info"
            title="About FixHomi"
            subtitle="Version 1.0.0"
            onPress={() => {}}
            showArrow={false}
          />
          
          <ActionRow
            iconName="document"
            title="Privacy Policy"
            onPress={() => Alert.alert('Privacy Policy', 'Will be available soon.')}
          />
          
          <ActionRow
            iconName="document"
            title="Terms of Service"
            onPress={() => Alert.alert('Terms of Service', 'Will be available soon.')}
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
      </ScrollView>
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
});

export default SettingsScreen;
