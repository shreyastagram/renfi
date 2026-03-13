/**
 * Profile Screen
 * 
 * User/Provider profile with:
 * - Profile info display & edit
 * - Verification status (phone, email)
 * - Account settings
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  Animated,
  Dimensions,
  Linking,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { Icon, PhoneInput, AadhaarVerificationModal } from '../components';
import { updateUserProfile, updateProviderProfile } from '../services/profileService';
import { SERVICE_CATEGORIES } from '../services/authService';
import { NODE_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';
import { getTokens } from '../utils/storage';
import { 
  sendPhoneVerificationOtp,
  verifyPhoneOtp,
  sendEmailVerification,
} from '../services/authService';
import { getAadhaarStatus } from '../services/aadhaarService';
import { getVerificationDashboard } from '../services/verificationService';
import Geolocation from '@react-native-community/geolocation';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import SavedAddresses from '../components/SavedAddresses';
import AddressAutocomplete from '../components/AddressAutocomplete';
import CityAutocomplete from '../components/CityAutocomplete';
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';

// Cloudinary config
const CLOUDINARY_CLOUD_NAME = 'dj1aytbae';
const CLOUDINARY_UPLOAD_PRESET = 'fixhomi_documents';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Service labels for proper display
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
};

/**
 * Format service name
 */
const formatServiceName = (service) => {
  if (SERVICE_LABELS[service]) return SERVICE_LABELS[service];
  const category = SERVICE_CATEGORIES?.find(c => c.id === service);
  if (category?.label) return category.label;
  return service
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Helper to extract error message from various error formats
 * Handles string, object with message property, or Error objects
 */
const getErrorMessage = (error, fallback = 'An error occurred') => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.message) return String(error.message);
  if (typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

/**
 * Premium card shadow helper
 */
const CARD_SHADOW = Platform.select({
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

/**
 * Section Header
 */
const SectionHeader = React.memo(({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
));

/**
 * Info Row (Read-only)
 */
const InfoRow = React.memo(({ label, value, iconName, verified, onVerify, isLoading }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconContainer}>
      <Icon name={iconName} size={20} color="#64748B" />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel} numberOfLines={1} ellipsizeMode="tail">{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2} ellipsizeMode="tail">{value || 'Not set'}</Text>
    </View>
    {verified !== undefined && (
      verified ? (
        <View style={styles.verifiedBadge}>
          <Icon name="check" size={14} color="#10B981" />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.verifyButton} onPress={onVerify} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify</Text>
          )}
        </TouchableOpacity>
      )
    )}
  </View>
));

/**
 * Editable Field
 */
const EditableField = React.memo(({ label, value, onChangeText, placeholder, editable = true, locked = false, lockMessage, keyboardType = 'default', maxLength, containerStyle }) => (
  <View style={[styles.fieldContainer, containerStyle]}>
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {locked && (
        <View style={styles.lockedBadge}>
          <MaterialIcon name="lock" size={12} color="#6B7280" />
          <Text style={styles.lockedBadgeText}>Locked</Text>
        </View>
      )}
    </View>
    <TextInput
      style={[styles.fieldInput, (!editable || locked) && styles.fieldInputDisabled]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      editable={editable && !locked}
      keyboardType={keyboardType}
      maxLength={maxLength}
    />
    {locked && lockMessage && (
      <Text style={styles.fieldLockMessage}>{lockMessage}</Text>
    )}
  </View>
));

/**
 * Shimmer block for skeleton loading
 */
const ShimmerBlock = ({ width, height, borderRadius = 8, style }) => {
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: '#CBD5E1', opacity: shimmerAnim }, style]} />;
};

/**
 * Profile Screen Skeleton Loader
 */
const ProfileSkeletonLoader = ({ insets, onBack }) => (
  <View style={styles.container}>
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Icon name="arrow_back" size={22} color="#0F172A" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Profile</Text>
      <View style={{ width: 60 }} />
    </View>
    <ScrollView style={styles.content} contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 30 }]} scrollEnabled={false}>
      {/* Profile card skeleton */}
      <View style={[styles.profileCard, { overflow: 'hidden' }]}>
        <View style={{ height: 100, backgroundColor: '#E2E8F0' }} />
        <View style={{ alignItems: 'center', marginTop: -40, paddingBottom: 20 }}>
          <ShimmerBlock width={80} height={80} borderRadius={40} />
          <ShimmerBlock width={140} height={18} borderRadius={8} style={{ marginTop: 12 }} />
          <ShimmerBlock width={180} height={13} borderRadius={6} style={{ marginTop: 8 }} />
        </View>
      </View>

      {/* Info rows skeleton */}
      <ShimmerBlock width={120} height={14} borderRadius={6} style={{ marginTop: 20, marginBottom: 12 }} />
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 }}>
          <ShimmerBlock width={36} height={36} borderRadius={18} />
          <View style={{ gap: 6, flex: 1 }}>
            <ShimmerBlock width={80} height={12} borderRadius={5} />
            <ShimmerBlock width={160} height={14} borderRadius={6} />
          </View>
        </View>
      ))}

      {/* Another section */}
      <ShimmerBlock width={100} height={14} borderRadius={6} style={{ marginTop: 20, marginBottom: 12 }} />
      {[1, 2].map(i => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 }}>
          <ShimmerBlock width={36} height={36} borderRadius={18} />
          <View style={{ gap: 6, flex: 1 }}>
            <ShimmerBlock width={90} height={12} borderRadius={5} />
            <ShimmerBlock width={140} height={14} borderRadius={6} />
          </View>
        </View>
      ))}
    </ScrollView>
  </View>
);

/**
 * Profile Screen Component
 */
const ProfileScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { dialog } = useDialog();
  const { user, profile, userType, refreshVerificationStatus, refreshProfile, aadhaarStatus, setAadhaarStatus, premiumStatus, setPremiumStatus, isProfileLoading } = useApp();

  // Set status bar for light background when this tab is focused
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor('transparent');
    }, [])
  );

  // Check if we should scroll to/open addresses section
  const scrollToAddresses = route?.params?.scrollToAddresses;

  // State
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit form state
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '', // Added phone number to editable fields
    address: '',
    city: '',
    pincode: '',
    experience: '',
  });
  const originalFormData = useRef({});
  
  // Provider service categories are now managed via Document Verification screen

  // Verification state
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState(Array(6).fill(''));
  const [otpFocusedIndex, setOtpFocusedIndex] = useState(-1);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpPhoneRef = useRef(''); // tracks which phone the OTP was sent to
  
  // OTP input refs & animations
  const otpInputRefs = useRef([]);
  const otpScaleAnims = useRef(Array(6).fill(null).map(() => new Animated.Value(1))).current;
  const otpShakeAnim = useRef(new Animated.Value(0)).current;

  // OTP countdown timer (5 minutes)
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown > 0]);

  // Reset OTP state when phone number changes after OTP was sent
  useEffect(() => {
    if (phoneOtpSent && formData.phone !== otpPhoneRef.current) {
      setPhoneOtpSent(false);
      setPhoneOtp(Array(6).fill(''));
      setOtpCountdown(0);
    }
  }, [formData.phone, phoneOtpSent]);

  // Saved Addresses state
  const [showAddressesModal, setShowAddressesModal] = useState(false);
  
  // Profile picture state
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showViewPhotoModal, setShowViewPhotoModal] = useState(false);
  
  // Aadhaar verification state — derived from context cache (no flicker)
  const [showAadhaarModal, setShowAadhaarModal] = useState(false);
  const isAadhaarVerified = aadhaarStatus.isVerified;
  const isNameLocked = aadhaarStatus.isNameLocked;
  const aadhaarName = aadhaarStatus.aadhaarName;
  
  // Premium subscription state — derived from context cache (SWR pattern: show loading until fetched)
  const isPremiumActive = premiumStatus.isPremiumActive;
  const premiumDaysLeft = premiumStatus.premiumDaysLeft;
  const premiumLoaded = premiumStatus.premiumLoaded;
  
  // Track original phone to detect changes
  const [originalPhone, setOriginalPhone] = useState('');
  
  // Location detection state
  const [detectingLocation, setDetectingLocation] = useState(false);
  
  /**
   * Detect My Location — GPS + Mapbox Reverse Geocoding
   * Gets device coordinates, reverse geocodes to address/city/pincode,
   * shows confirmation alert, then auto-fills the form.
   */
  const handleDetectLocation = useCallback(async () => {
    setDetectingLocation(true);
    try {
      // 1. Check & request location permission
      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      let permStatus = await check(permission);
      if (permStatus === RESULTS.DENIED) {
        permStatus = await request(permission);
      }

      if (permStatus !== RESULTS.GRANTED && permStatus !== RESULTS.LIMITED) {
        dialog(
          'Location Permission Required',
          'Please enable location permission in your device settings to use this feature.',
          [{ text: 'OK' }]
        );
        setDetectingLocation(false);
        return;
      }

      // 2. Get current GPS position — use network location first (fast, ~1-3s),
      //    then try GPS for better accuracy. For reverse geocoding, network accuracy is sufficient.
      const position = await new Promise((resolve, reject) => {
        let resolved = false;
        // Fast attempt: network/cell location (low accuracy but near-instant)
        Geolocation.getCurrentPosition(
          (pos) => { if (!resolved) { resolved = true; resolve(pos); } },
          () => {}, // Ignore fast-path errors, GPS attempt will handle it
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
        );
        // GPS attempt: higher accuracy, longer timeout
        Geolocation.getCurrentPosition(
          (pos) => { if (!resolved) { resolved = true; resolve(pos); } },
          (err) => { if (!resolved) { resolved = true; reject(err); } },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
        );
      });

      const { latitude, longitude } = position.coords;

      // 3. Reverse geocode via Mapbox
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?` +
        `access_token=${MAPBOX_ACCESS_TOKEN}` +
        `&types=address,poi,place,locality,neighborhood,postcode` +
        `&limit=1` +
        `&language=en`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        dialog('Location Not Found', 'Could not determine your address. Please enter it manually.');
        setDetectingLocation(false);
        return;
      }

      const feature = data.features[0];
      const context = feature.context || [];

      // Parse address components
      let detectedAddress = feature.place_name || '';
      let detectedCity = '';
      let detectedPincode = '';
      let detectedState = '';

      context.forEach((ctx) => {
        const id = ctx.id || '';
        if (id.startsWith('postcode')) detectedPincode = ctx.text || '';
        else if (id.startsWith('place')) detectedCity = ctx.text || '';
        else if (id.startsWith('district') && !detectedCity) detectedCity = ctx.text || '';
        else if (id.startsWith('locality') && !detectedCity) detectedCity = ctx.text || '';
        else if (id.startsWith('region')) detectedState = ctx.text || '';
      });

      // If the feature itself is a place, use it for city
      if (feature.place_type?.includes('place') && !detectedCity) {
        detectedCity = feature.text || '';
      }

      // 4. Show confirmation popup
      const confirmMsg = [
        `📍 Address: ${detectedAddress || 'Not found'}`,
        `🏙️ City: ${detectedCity || 'Not found'}`,
        `📮 Pincode: ${detectedPincode || 'Not found'}`,
        detectedState ? `🗺️ State: ${detectedState}` : '',
      ].filter(Boolean).join('\n\n');

      dialog(
        'Detected Location',
        `We detected the following from your current location:\n\n${confirmMsg}\n\nWould you like to use this?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Use This Location',
            onPress: () => {
              setFormData(prev => ({
                ...prev,
                address: detectedAddress || prev.address,
                city: detectedCity || prev.city,
                pincode: detectedPincode || prev.pincode,
              }));
            },
          },
        ]
      );
    } catch (error) {
      console.error('[DetectLocation] Error:', error);
      const errCode = error?.code;

      if (errCode === 2) {
        // GPS is turned off — offer to open settings
        dialog(
          'Location is Turned Off',
          'Please enable GPS to detect your location, or enter your address manually.',
          [
            { text: 'Enter Manually', style: 'cancel' },
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
      } else if (errCode === 1) {
        dialog('Permission Denied', 'Location permission is required. Please enable it in your device settings.');
      } else {
        dialog('Location Error', 'Could not detect your location. Please try again or enter manually.');
      }
    } finally {
      setDetectingLocation(false);
    }
  }, []);

  // Auto-open addresses modal if navigated with scrollToAddresses param
  useEffect(() => {
    if (scrollToAddresses) {
      // Small delay to ensure screen is fully mounted
      const timer = setTimeout(() => {
        setShowAddressesModal(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [scrollToAddresses]);

  // Combined user data
  const displayData = { ...user, ...profile };
  const isProvider = userType === 'provider';
  const isVerified = displayData?.isPhoneVerified && displayData?.isEmailVerified;

  // Initialize form data
  useEffect(() => {
    // Strip +91 or 91 prefix — PhoneInput stores raw 10 digits
    const rawPhone = displayData?.phone || displayData?.phoneNumber || '';
    const phoneDigits = rawPhone.replace(/[^0-9]/g, '');
    const phoneValue = (phoneDigits.length > 10 && phoneDigits.startsWith('91'))
      ? phoneDigits.substring(2)
      : phoneDigits;
    const initial = {
      fullName: displayData?.fullName || '',
      phone: phoneValue,
      address: displayData?.address || '',
      city: displayData?.city || '',
      pincode: displayData?.pincode || '',
      experience: String(displayData?.experience || ''),
    };
    setFormData(initial);
    originalFormData.current = initial;
    setOriginalPhone(phoneValue);
  }, [displayData?.fullName, displayData?.phone, displayData?.phoneNumber, displayData?.address, displayData?.city, displayData?.pincode, displayData?.experience]);

  // Fetch Aadhaar verification status and premium status for providers
  // Uses context cache — only fetches if stale or on first load
  const aadhaarFetchedRef = useRef(false);
  
  const fetchProviderStatuses = useCallback(async () => {
    if (!isProvider) return;
    try {
      const result = await getAadhaarStatus();
      if (result.success) {
        setAadhaarStatus({
          isVerified: result.aadhaar?.isVerified || false,
          isNameLocked: result.aadhaar?.isNameLocked || false,
          aadhaarName: result.aadhaar?.aadhaarName || null,
        });
      }
    } catch (error) {
      console.log('Error fetching Aadhaar status:', error);
    }
    // Fetch premium status from verification dashboard
    try {
      const pid = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
      if (pid) {
        const dashResult = await getVerificationDashboard(pid);
        if (dashResult.success && dashResult.data) {
          const premStep = dashResult.data.steps?.find(s => s.id === 'premium');
          setPremiumStatus({
            isPremiumActive: dashResult.data.isPremiumActive || false,
            premiumDaysLeft: premStep?.daysRemaining || 0,
            premiumLoaded: true,
          });
        }
      }
    } catch (error) {
      console.log('Error fetching premium status:', error);
      // Mark as loaded even on error so UI doesn't stay in loading state forever
      setPremiumStatus(prev => ({ ...prev, premiumLoaded: true }));
    }
  }, [isProvider, user?.mongoId, profile?.mongoId]);

  useEffect(() => {
    if (isProvider && !aadhaarFetchedRef.current) {
      aadhaarFetchedRef.current = true;
      fetchProviderStatuses();
    }
  }, [isProvider]);

  // Auto-refresh profile when screen gains focus
  // SWR: refreshProfile internally skips if data is < 30s old
  useFocusEffect(
    useCallback(() => {
      const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
      if (userId && userType) {
        refreshProfile(userType, userId);
      }
    }, [user?.mongoId, profile?.mongoId, userType, refreshProfile])
  );

  /**
   * Handle refresh - fetch full profile from both Java Auth and MongoDB
   */
  const onRefresh = async () => {
    setRefreshing(true);
    const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    if (userId) {
      await refreshProfile(userType, userId, { force: true });
    }
    await refreshVerificationStatus();
    
    // Refresh Aadhaar & premium status for providers (force refresh)
    if (isProvider) {
      await fetchProviderStatuses();
    }
    
    setRefreshing(false);
  };

  /**
   * Handle save profile
   */
  const handleSave = async () => {
    const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    
    if (!userId) {
      dialog('Error', 'Something unexpected happened. Please try again.');
      return;
    }

    // Trim whitespace from text fields
    const trimmed = { ...formData };
    for (const key of ['fullName', 'phone', 'address', 'city', 'pincode', 'bio']) {
      if (typeof trimmed[key] === 'string') trimmed[key] = trimmed[key].trim();
    }

    // Input length validation
    if (trimmed.fullName && (trimmed.fullName.length < 2 || trimmed.fullName.length > 100)) {
      dialog('Invalid Name', 'Name must be between 2 and 100 characters.');
      return;
    }
    if (trimmed.phone && (!/^\d{10}$/.test(trimmed.phone) || !/^[6-9]/.test(trimmed.phone))) {
      dialog('Invalid Phone', 'Please enter a valid 10-digit Indian phone number.');
      return;
    }
    if (trimmed.pincode && !/^\d{6}$/.test(trimmed.pincode)) {
      dialog('Invalid Pincode', 'Please enter a valid 6-digit pincode.');
      return;
    }

    // Use trimmed data for save
    Object.assign(formData, trimmed);

    // Detect if phone number is being changed (for providers)
    // Both values are now raw 10-digit numbers
    const phoneChanged = isProvider &&
      formData.phone !== originalPhone &&
      originalPhone.length > 0;
    
    // Warn user if phone is being changed — verification will reset
    if (phoneChanged) {
      return new Promise((resolve) => {
        dialog(
          'Phone Number Change',
          'Changing your phone number will reset your phone verification. You will need to re-verify with OTP.\n\nDo you want to continue?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => { setSaving(false); resolve(); } },
            { 
              text: 'Continue', 
              style: 'destructive',
              onPress: () => { performSave(userId); resolve(); }
            },
          ]
        );
      });
    }

    await performSave(userId);
  };

  /**
   * Perform the actual profile save
   */
  const performSave = async (userId) => {
    setSaving(true);
    try {
      let result;

      // Compute only the fields that actually changed to avoid unnecessary
      // Java Auth sync calls (which can fail independently of the main update)
      const orig = originalFormData.current;
      const changedFields = {};
      for (const key of Object.keys(formData)) {
        if (formData[key] !== orig[key]) {
          changedFields[key] = formData[key];
        }
      }

      if (Object.keys(changedFields).length === 0) {
        dialog('No Changes', 'No changes were made to your profile.');
        setSaving(false);
        return;
      }

      if (isProvider) {
        // For providers, update via provider profile endpoint
        // Note: serviceCategories are managed via Document Verification, not editable here
        const providerUpdates = {};
        if (changedFields.fullName !== undefined) providerUpdates.name = changedFields.fullName;
        if (changedFields.phone !== undefined) providerUpdates.phone = '+91' + changedFields.phone;
        if (changedFields.address !== undefined) providerUpdates.address = changedFields.address;
        if (changedFields.city !== undefined) providerUpdates.city = changedFields.city;
        if (changedFields.pincode !== undefined) providerUpdates.pincode = changedFields.pincode;
        if (changedFields.experience !== undefined) providerUpdates.experience = parseInt(changedFields.experience, 10) || undefined;
        result = await updateProviderProfile(userId, providerUpdates);
      } else {
        // For users, send only changed fields
        // Prepend +91 for phone before sending to backend
        const userUpdates = { ...changedFields };
        if (userUpdates.phone !== undefined) {
          userUpdates.phone = '+91' + userUpdates.phone;
        }
        result = await updateUserProfile(userId, userUpdates);
      }

      if (result.success) {
        dialog('Success', 'Profile updated successfully');
        setIsEditing(false);
        // Refresh profile data to reflect changes immediately
        await refreshProfile(userType, userId);
        await refreshVerificationStatus();
      } else {
        // Handle specific error codes from backend
        const errorCode = result.error?.code || result.error?.response?.data?.code;

        if (errorCode === 'PHONE_ALREADY_EXISTS') {
          dialog(
            'Number Already Registered',
            'This mobile number is already associated with another account. Please use a different number.',
            [
              { text: 'OK', onPress: () => {
                // Revert phone field to original value
                setFormData(prev => ({ ...prev, phone: originalPhone }));
              }}
            ]
          );
        } else if (errorCode === 'PROFILE_CONFLICT') {
          dialog(
            'Update Conflict',
            result.error?.message || 'This information conflicts with another account. Please try different values.',
            [{ text: 'OK' }]
          );
        } else if (errorCode === 'NAME_LOCKED') {
          dialog(
            'Name Locked',
            'Your name has been locked after Aadhaar verification and cannot be changed. This ensures your profile matches your verified identity.',
            [{ text: 'OK' }]
          );
        } else if (result.error?.isTransient) {
          // Transient network error — offer retry
          dialog(
            'Connection Issue',
            'We\'re having trouble connecting. Please try again.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: () => performSave(userId) },
            ]
          );
        } else {
          dialog('Couldn\'t Save', getErrorMessage(result.error, 'Your changes couldn\'t be saved. Please try again.'));
        }
      }
    } catch (error) {
      dialog('Couldn\'t Save', 'Your changes couldn\'t be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle phone verification
   */
  const handlePhoneVerify = async () => {
    if (!displayData?.phone) {
      dialog('Error', 'Add a phone number to your profile first.');
      return;
    }

    setVerifyingPhone(true);
    try {
      const result = await sendPhoneVerificationOtp(displayData.phone);
      
      if (result.success) {
        setPhoneOtpSent(true);
        setOtpCountdown(300); // 5 minutes
        otpPhoneRef.current = formData.phone; // track which phone the OTP was sent to (raw 10 digits)
        dialog('OTP Sent', `Verification code sent to ${displayData.phone}`);
      } else {
        dialog('Error', getErrorMessage(result.error, 'Couldn\'t send verification code. Please try again.'));
      }
    } catch (error) {
      dialog('Error', 'Couldn\'t send verification code. Please try again.');
    } finally {
      setVerifyingPhone(false);
    }
  };

  /**
   * Handle phone OTP verification
   */
  const handleVerifyPhoneOtp = async () => {
    const otpCode = phoneOtp.join('');
    if (otpCode.length !== 6) {
      // Shake animation
      Animated.sequence([
        Animated.timing(otpShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(otpShakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(otpShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(otpShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      dialog('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    setVerifyingPhone(true);
    try {
      // Java Auth only needs OTP - phone is extracted from JWT token
      const result = await verifyPhoneOtp(otpCode);
      
      if (result.success) {
        dialog('Success', 'Phone number verified successfully!');
        setPhoneOtpSent(false);
        setPhoneOtp(Array(6).fill(''));
        setOtpCountdown(0);
        await refreshVerificationStatus();
      } else {
        // Shake on error
        Animated.sequence([
          Animated.timing(otpShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(otpShakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(otpShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(otpShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
        setPhoneOtp(Array(6).fill(''));
        otpInputRefs.current[0]?.focus();
        dialog('Error', getErrorMessage(result.error, 'Invalid OTP'));
      }
    } catch (error) {
      dialog('Error', 'Verification didn\'t go through. Please try again.');
    } finally {
      setVerifyingPhone(false);
    }
  };
  
  /**
   * Handle OTP input change for individual boxes
   */
  const handleProfileOtpChange = useCallback((value, index) => {
    const digit = value.replace(/[^0-9]/g, '');
    
    if (digit.length <= 1) {
      const newOtp = [...phoneOtp];
      newOtp[index] = digit;
      setPhoneOtp(newOtp);
      
      // Pulse animation
      if (digit) {
        Animated.sequence([
          Animated.timing(otpScaleAnims[index], { toValue: 1.15, duration: 80, useNativeDriver: true }),
          Animated.spring(otpScaleAnims[index], { toValue: 1, friction: 3, useNativeDriver: true }),
        ]).start();
        
        if (index < 5) otpInputRefs.current[index + 1]?.focus();
      }
    } else if (digit.length > 1) {
      // Handle paste
      const digits = digit.slice(0, 6).split('');
      const newOtp = [...phoneOtp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setPhoneOtp(newOtp);
      const lastIndex = Math.min(index + digits.length - 1, 5);
      otpInputRefs.current[lastIndex]?.focus();
    }
  }, [phoneOtp]);
  
  /**
   * Handle OTP key press for backspace navigation
   */
  const handleProfileOtpKeyPress = useCallback((event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !phoneOtp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }, [phoneOtp]);

  /**
   * Handle email verification
   */
  const handleEmailVerify = async () => {
    if (!displayData?.email) {
      dialog('Error', 'No email found');
      return;
    }

    setVerifyingEmail(true);
    try {
      const result = await sendEmailVerification();
      
      if (result.success) {
        dialog(
          '✅ Verification Email Sent',
          `Please check your email at ${displayData.email} and click the verification link.\n\nAlso check your spam/junk folder if you don't see it.`
        );
      } else {
        // Parse rate-limit errors with remaining seconds
        const errorObj = result.error;
        const status = errorObj?.status;
        const message = errorObj?.message || '';
        
        if (status === 429 || message.includes('wait')) {
          // Extract seconds from message like "Please wait 85 seconds before..."
          const secondsMatch = message.match(/wait\s+(\d+)\s+seconds/i);
          const retrySeconds = secondsMatch 
            ? parseInt(secondsMatch[1], 10) 
            : (errorObj?.errors?.retryAfterSeconds ? parseInt(errorObj.errors.retryAfterSeconds, 10) : null);
          
          if (retrySeconds && retrySeconds > 0) {
            const mins = Math.floor(retrySeconds / 60);
            const secs = retrySeconds % 60;
            const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            dialog(
              '⏳ Email Already Sent',
              `A verification email was recently sent to ${displayData.email}.\n\nPlease check your inbox (and spam folder). You can request another in ${timeStr}.`
            );
          } else {
            dialog(
              '⏳ Email Already Sent',
              `A verification email was recently sent to ${displayData.email}.\n\nPlease check your inbox (and spam folder) and wait a couple of minutes before requesting another.`
            );
          }
        } else {
          dialog('Error', getErrorMessage(result.error, 'Couldn\'t send verification email. Please try again.'));
        }
      }
    } catch (error) {
      dialog('Error', 'Couldn\'t send verification email. Please try again.');
    } finally {
      setVerifyingEmail(false);
    }
  };

  /**
   * Upload image to Cloudinary
   */
  const uploadToCloudinary = async (imageUri) => {
    const formData = new FormData();
    
    // Fix Android URI
    let uri = imageUri;
    if (Platform.OS === 'android' && !uri.startsWith('file://')) {
      uri = `file://${uri}`;
    }
    
    formData.append('file', {
      uri: uri,
      type: 'image/jpeg',
      name: `profile_${Date.now()}.jpg`,
    });
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'profile_pictures');

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      const data = await response.json();
      
      if (data.secure_url) {
        return { success: true, url: data.secure_url, publicId: data.public_id };
      } else {
        console.error('Cloudinary upload error:', data);
        return { success: false, error: data.error?.message || 'Upload failed' };
      }
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Save profile picture to backend
   */
  const saveProfilePictureToBackend = async (url, publicId) => {
    const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    if (!userId) return { success: false, error: 'User ID not found' };

    try {
      const endpoint = isProvider
        ? `${NODE_BASE_URL}/api/provider/profile-picture/${userId}`
        : `${NODE_BASE_URL}/api/user/profile-picture/${userId}`;

      const response = await authFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify({ url, publicId }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Save profile picture error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Handle image selection from gallery
   */
  const handleSelectFromGallery = async () => {
    setShowImagePickerModal(false);
    
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 800,
      maxHeight: 800,
    };

    try {
      const result = await launchImageLibrary(options);
      
      if (result.didCancel) return;
      if (result.errorCode) {
        dialog('Error', 'Couldn\'t access your photos. Please check app permissions.');
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.uri) {
        await uploadProfilePicture(asset.uri);
      }
    } catch (error) {
      dialog('Error', 'Couldn\'t access your photos. Please check app permissions.');
    }
  };

  /**
   * Handle taking photo with camera
   */
  const handleTakePhoto = async () => {
    setShowImagePickerModal(false);
    
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 800,
      maxHeight: 800,
      cameraType: 'front',
    };

    try {
      const result = await launchCamera(options);
      
      if (result.didCancel) return;
      if (result.errorCode) {
        dialog('Error', 'Couldn\'t access your photos. Please check app permissions.');
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.uri) {
        await uploadProfilePicture(asset.uri);
      }
    } catch (error) {
      dialog('Error', 'Couldn\'t access your photos. Please check app permissions.');
    }
  };

  /**
   * Upload profile picture
   */
  const uploadProfilePicture = async (imageUri) => {
    setUploadingPicture(true);
    
    try {
      // Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(imageUri);
      
      if (!uploadResult.success) {
        dialog('Error', 'Couldn\'t upload your photo. Please try again.');
        return;
      }

      // Save to backend
      const saveResult = await saveProfilePictureToBackend(uploadResult.url, uploadResult.publicId);
      
      if (saveResult.success) {
        dialog('Success', 'Profile picture updated!');
        // Refresh profile
        const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
        if (userId) {
          await refreshProfile(userType, userId);
        }
      } else {
        dialog('Error', 'Photo uploaded but couldn\'t save. Please try again.');
      }
    } catch (error) {
      dialog('Error', 'Something unexpected happened. Please try again.');
    } finally {
      setUploadingPicture(false);
    }
  };

  // Show skeleton while profile is loading initially
  if (isProfileLoading && !displayData?.fullName && !displayData?.email) {
    return <ProfileSkeletonLoader insets={insets} onBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow_back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {!isEditing ? (
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
            <MaterialIcon name="edit-note" size={20} color="#2b76bc" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.editButton, styles.editButtonCancel]}
            onPress={() => setIsEditing(false)}
          >
            <MaterialIcon name="undo" size={18} color="#EF4444" />
            <Text style={styles.cancelButtonText}>Discard</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 30 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f67c16" />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {/* ─── Premium Profile Card ─── */}
          <View style={styles.profileCard}>
            {/* Colored header band */}
            <View style={[styles.profileCardHeader, isProvider ? styles.profileCardHeaderProvider : styles.profileCardHeaderUser]}>
              <View style={styles.profileDecorCircle1} />
              <View style={styles.profileDecorCircle2} />
              <View style={styles.profileDecorCircle3} />
            </View>

            {/* Avatar */}
            <View style={styles.profileAvatarWrap}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() => setShowImagePickerModal(true)}
                disabled={uploadingPicture}
              >
                {/* Outer ring */}
                <View style={[styles.avatarRing, isProvider && styles.avatarRingProvider]}>
                  {displayData?.profilePicture?.url ? (
                    <Image
                      source={{ uri: displayData.profilePicture.url }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={[styles.avatar, isProvider && styles.avatarProvider]}>
                      <Text style={styles.avatarText}>
                        {displayData?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                </View>
                {/* Camera overlay */}
                <View style={[styles.cameraIconOverlay, isProvider && styles.cameraIconOverlayProvider]}>
                  {uploadingPicture ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcon name="camera-alt" size={15} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Body */}
            <View style={styles.profileCardBody}>
              <View style={[styles.profileBodyAccent, isProvider ? { backgroundColor: '#FFF7ED' } : { backgroundColor: '#EFF6FF' }]} />
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName} numberOfLines={2} ellipsizeMode="tail">{displayData?.fullName || 'User'}</Text>
                {isProvider && isPremiumActive && (
                  <View style={styles.proBadge}>
                    <MaterialIcon name="workspace-premium" size={14} color="#F59E0B" />
                    <Text style={styles.proBadgeText}>PRO</Text>
                  </View>
                )}
              </View>

              {/* Email */}
              <Text style={styles.profileEmail} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.8}>
                {displayData?.email || ''}
              </Text>
              {/* Phone */}
              <Text style={styles.profilePhone} numberOfLines={1} ellipsizeMode="tail">
                {displayData?.phone || ''}
              </Text>

              {/* Type badge */}
              <View style={styles.profileBadgeRow}>
                <View style={[styles.typeBadge, isProvider && styles.typeBadgeProvider]}>
                  <Icon name={isProvider ? 'provider' : 'user'} size={13} color={isProvider ? '#f67c16' : '#2b76bc'} />
                  <Text style={[styles.typeBadgeText, isProvider && styles.typeBadgeTextProvider]} numberOfLines={1}>
                    {isProvider ? 'Service Provider' : 'User'}
                  </Text>
                </View>
              </View>

              {/* Verification pills */}
              <View style={styles.verificationSummary}>
                <View style={[
                  styles.verificationItem,
                  displayData?.isPhoneVerified && styles.verificationItemVerified,
                ]}>
                  <Icon name="phone" size={14} color={displayData?.isPhoneVerified ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[
                    styles.verificationLabel,
                    displayData?.isPhoneVerified && styles.verificationLabelVerified
                  ]} numberOfLines={1}>
                    {displayData?.isPhoneVerified ? 'Phone ✓' : 'Phone'}
                  </Text>
                </View>
                <View style={[
                  styles.verificationItem,
                  displayData?.isEmailVerified && styles.verificationItemVerified,
                ]}>
                  <Icon name="email" size={14} color={displayData?.isEmailVerified ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[
                    styles.verificationLabel,
                    displayData?.isEmailVerified && styles.verificationLabelVerified
                  ]} numberOfLines={1}>
                    {displayData?.isEmailVerified ? 'Email ✓' : 'Email'}
                  </Text>
                </View>
                {isProvider && (
                  <View style={[
                    styles.verificationItem,
                    isAadhaarVerified && styles.verificationItemVerified,
                  ]}>
                    <Icon name="verified_user" size={14} color={isAadhaarVerified ? '#FFFFFF' : '#6B7280'} />
                    <Text style={[
                      styles.verificationLabel,
                      isAadhaarVerified && styles.verificationLabelVerified
                    ]} numberOfLines={1}>
                      {isAadhaarVerified ? 'KYC ✓' : 'KYC'}
                    </Text>
                  </View>
                )}
              </View>

              {!isVerified && (
                <View style={styles.verifyWarning}>
                  <Icon name="warning" size={15} color="#f67c16" />
                  <Text style={styles.verifyWarningText} numberOfLines={2} ellipsizeMode="tail">
                    Verify phone & email to unlock all features
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Image Picker Modal — Bottom sheet */}
          <Modal
            visible={showImagePickerModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowImagePickerModal(false)}
          >
            <TouchableOpacity 
              style={styles.imagePickerOverlay}
              activeOpacity={1}
              onPress={() => setShowImagePickerModal(false)}
            >
              <View style={styles.imagePickerModal} onStartShouldSetResponder={() => true}>
                {/* Drag indicator */}
                <View style={styles.imagePickerDragBar} />
                <Text style={styles.imagePickerTitle}>Profile Photo</Text>

                {/* View Photo option — only if photo exists */}
                {displayData?.profilePicture?.url && (
                  <TouchableOpacity
                    style={styles.imagePickerOption}
                    onPress={() => {
                      setShowImagePickerModal(false);
                      setTimeout(() => setShowViewPhotoModal(true), 200);
                    }}
                  >
                    <View style={[styles.imagePickerIconWrap, { backgroundColor: '#EFF6FF' }]}>
                      <MaterialIcon name="visibility" size={22} color="#2b76bc" />
                    </View>
                    <View style={styles.imagePickerOptionContent}>
                      <Text style={styles.imagePickerOptionText}>View Photo</Text>
                      <Text style={styles.imagePickerOptionHint}>See your profile picture</Text>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.imagePickerOption} onPress={handleTakePhoto}>
                  <View style={[styles.imagePickerIconWrap, { backgroundColor: '#F0FDF4' }]}>
                    <MaterialIcon name="camera-alt" size={22} color="#16A34A" />
                  </View>
                  <View style={styles.imagePickerOptionContent}>
                    <Text style={styles.imagePickerOptionText}>Take Photo</Text>
                    <Text style={styles.imagePickerOptionHint}>Use your camera</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.imagePickerOption} onPress={handleSelectFromGallery}>
                  <View style={[styles.imagePickerIconWrap, { backgroundColor: '#FFF7ED' }]}>
                    <MaterialIcon name="photo-library" size={22} color="#EA580C" />
                  </View>
                  <View style={styles.imagePickerOptionContent}>
                    <Text style={styles.imagePickerOptionText}>Choose from Gallery</Text>
                    <Text style={styles.imagePickerOptionHint}>Pick from your photos</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.imagePickerCancelBtn}
                  onPress={() => setShowImagePickerModal(false)}
                >
                  <Text style={styles.imagePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* View Photo Modal — Full-screen preview */}
          <Modal
            visible={showViewPhotoModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowViewPhotoModal(false)}
          >
            <TouchableOpacity
              style={styles.viewPhotoOverlay}
              activeOpacity={1}
              onPress={() => setShowViewPhotoModal(false)}
            >
              <View style={styles.viewPhotoContainer} onStartShouldSetResponder={() => true}>
                {/* Close button */}
                <TouchableOpacity
                  style={styles.viewPhotoCloseBtn}
                  onPress={() => setShowViewPhotoModal(false)}
                >
                  <MaterialIcon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                {displayData?.profilePicture?.url && (
                  <Image
                    source={{ uri: displayData.profilePicture.url }}
                    style={styles.viewPhotoImage}
                    resizeMode="contain"
                  />
                )}

                <Text style={styles.viewPhotoName}>{displayData?.fullName || ''}</Text>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Aadhaar Verification Modal */}
          <AadhaarVerificationModal
            visible={showAadhaarModal}
            onClose={() => setShowAadhaarModal(false)}
            onVerified={async () => {
              // Immediately update context cache optimistically
              setAadhaarStatus(prev => ({ ...prev, isVerified: true }));
              setShowAadhaarModal(false);
              // Re-fetch from backend to get aadhaarName and lock status
              try {
                const result = await getAadhaarStatus();
                if (result.success) {
                  setAadhaarStatus({
                    isVerified: result.aadhaar?.isVerified || true,
                    isNameLocked: result.aadhaar?.isNameLocked || false,
                    aadhaarName: result.aadhaar?.aadhaarName || null,
                  });
                }
              } catch (e) {
                console.log('Error re-fetching Aadhaar status after verification:', e);
              }
            }}
          />

          {/* Edit Mode - Personal Information */}
          {isEditing ? (
            <View style={styles.section}>
              <SectionHeader title="Edit Profile" />
              
              <EditableField
                label="Full Name"
                value={formData.fullName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
                placeholder="Enter your full name"
                locked={isProvider && isNameLocked}
                lockMessage={isNameLocked ? `Verified as "${aadhaarName || formData.fullName}" via Aadhaar` : undefined}
              />

              <PhoneInput
                label="Phone Number"
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
              />
              
              {/* Phone change warning */}
              {isProvider && formData.phone !== originalPhone && originalPhone.length > 0 && (
                <View style={styles.phoneChangeWarning}>
                  <MaterialIcon name="warning" size={16} color="#F59E0B" />
                  <Text style={styles.phoneChangeWarningText}>
                    Changing your phone number will reset your phone verification. You'll need to re-verify via OTP.
                  </Text>
                </View>
              )}

              {/* === Location Section Header with Detect Button === */}
              <View style={styles.locationSectionHeader}>
                <Text style={styles.locationSectionTitle}>Location Details</Text>
                <TouchableOpacity
                  style={[styles.detectLocationBtn, detectingLocation && styles.detectLocationBtnDisabled]}
                  onPress={handleDetectLocation}
                  disabled={detectingLocation}
                  activeOpacity={0.7}
                >
                  {detectingLocation ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcon name="my-location" size={16} color="#FFFFFF" />
                  )}
                  <Text style={styles.detectLocationBtnText}>
                    {detectingLocation ? 'Detecting...' : 'Detect My Location'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Address — Mapbox Geocoding powered search */}
              <AddressAutocomplete
                value={formData.address}
                label="Address"
                placeholder="Search your address (e.g., Satyanarayan Layout)..."
                onSelectAddress={({ address, city, pincode }) => {
                  setFormData(prev => ({
                    ...prev,
                    address: address || prev.address,
                    city: city || prev.city,
                    pincode: pincode || prev.pincode,
                  }));
                }}
              />
              
              <View style={styles.rowFields}>
                <View style={[styles.halfField, { zIndex: 998 }]}>
                  {/* City — Mapbox city search */}
                  <CityAutocomplete
                    value={formData.city}
                    label="City"
                    placeholder="Search city..."
                    onSelectCity={({ city, pincode }) => {
                      setFormData(prev => ({
                        ...prev,
                        city: city || prev.city,
                        pincode: pincode || prev.pincode,
                      }));
                    }}
                  />
                </View>
                <View style={styles.halfField}>
                  <EditableField
                    label="Pincode"
                    value={formData.pincode}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, pincode: text }))}
                    placeholder="Pincode"
                    keyboardType="numeric"
                    maxLength={6}
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
              </View>
              
              {/* Service Categories - Provider Only (Read-only, managed via Document Verification) */}
              {isProvider && (
                <View style={styles.categoriesSection}>
                  <View style={styles.categoriesSectionHeader}>
                    <Text style={styles.fieldLabel}>Verified Service Categories</Text>
                    <View style={styles.verifiedBadgeSmall}>
                      <Icon name="check_circle" size={14} color="#2b76bc" />
                    </View>
                  </View>
                  <Text style={styles.categoriesHint}>
                    Service categories require approval via Request Service Approvals
                  </Text>
                  
                  {(displayData?.verifiedServiceCategories?.length > 0) ? (
                    <View style={styles.categoriesGrid}>
                      {(displayData?.verifiedServiceCategories || []).map((catId) => {
                        return (
                          <View
                            key={catId}
                            style={[styles.categoryChip, styles.categoryChipVerified]}
                          >
                            <Icon name="verified" size={14} color="#2b76bc" />
                            <Text style={[styles.categoryChipText, styles.categoryChipTextVerified]}>
                              {formatServiceName(catId)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.noCategoriesWarning}>
                      <Icon name="info" size={16} color="#f67c16" />
                      <Text style={styles.noCategoriesText}>No verified services yet</Text>
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={styles.documentVerificationLink}
                    onPress={() => navigation.navigate('DocumentVerification')}
                  >
                    <Icon name="document" size={18} color="#2b76bc" />
                    <Text style={styles.documentVerificationLinkText}>
                      {(displayData?.verifiedServiceCategories?.length > 0)
                        ? 'Add More Services'
                        : 'Get Verified for Services'}
                    </Text>
                    <Icon name="arrow-forward" size={16} color="#2b76bc" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Experience - Provider Only */}
              {isProvider && (
                <EditableField
                  label="Years of Experience"
                  value={formData.experience}
                  onChangeText={(text) => {
                    // Allow only digits (numeric input)
                    const numericOnly = text.replace(/[^0-9]/g, '');
                    setFormData(prev => ({ ...prev, experience: numericOnly }));
                  }}
                  placeholder="e.g., 5"
                  keyboardType="numeric"
                  maxLength={2}
                />
              )}
              
              {/* Phone & Email - Read Only */}
              <View style={styles.readOnlySection}>
                <Text style={styles.readOnlyNote}>
                  <Icon name="info" size={14} color="#6B7280" /> Phone and email cannot be changed
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="check" size={20} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.section}>
              <SectionHeader title="Personal Information" />
              
              <InfoRow
                iconName="user"
                label="Full Name"
                value={displayData?.fullName}
              />
              
              <InfoRow
                iconName="location"
                label="Address"
                value={displayData?.address || 'Not set'}
              />
              
              <InfoRow
                iconName="location"
                label="City"
                value={displayData?.city || 'Not set'}
              />
              
              <InfoRow
                iconName="location"
                label="Pincode"
                value={displayData?.pincode || 'Not set'}
              />
              
              {isProvider && (
                <>
                  {/* Service Categories */}
                  <View style={styles.serviceCategoriesDisplay}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconContainer}>
                        <Icon name="services" size={20} color="#6B7280" />
                      </View>
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Your Services</Text>
                        
                        {/* Verified Services */}
                        {(displayData?.verifiedServiceCategories?.length > 0) && (
                          <>
                            <View style={styles.servicesLabelRow}>
                              <Icon name="verified" size={12} color="#2b76bc" />
                              <Text style={styles.servicesLabelVerified}>Verified</Text>
                            </View>
                            <View style={styles.categoriesDisplayGrid}>
                              {displayData.verifiedServiceCategories.map((catId) => (
                                <View key={`verified-${catId}`} style={styles.categoryDisplayChipVerified}>
                                  <Icon name="check_circle" size={12} color="#2b76bc" />
                                  <Text style={styles.categoryDisplayTextVerified}>
                                    {formatServiceName(catId)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </>
                        )}
                        
                        {/* Pending Services */}
                        {(displayData?.serviceCategories?.filter(cat => 
                          !(displayData?.verifiedServiceCategories || []).includes(cat)
                        ).length > 0) && (
                          <>
                            <View style={[styles.servicesLabelRow, { marginTop: 8 }]}>
                              <Icon name="clock" size={12} color="#f67c16" />
                              <Text style={styles.servicesLabelPending}>Pending Approval</Text>
                            </View>
                            <View style={styles.categoriesDisplayGrid}>
                              {displayData.serviceCategories
                                .filter(cat => !(displayData?.verifiedServiceCategories || []).includes(cat))
                                .map((catId) => (
                                  <View key={`pending-${catId}`} style={styles.categoryDisplayChipPending}>
                                    <Icon name="clock" size={12} color="#f67c16" />
                                    <Text style={styles.categoryDisplayTextPending}>
                                      {formatServiceName(catId)}
                                    </Text>
                                  </View>
                                ))}
                            </View>
                          </>
                        )}
                        
                        {/* No Services at all - show button */}
                        {(!displayData?.verifiedServiceCategories?.length && 
                          !displayData?.serviceCategories?.length) && (
                          <TouchableOpacity
                            style={styles.getVerifiedButton}
                            onPress={() => navigation.navigate('DocumentVerification')}
                          >
                            <Icon name="document" size={16} color="#2b76bc" />
                            <Text style={styles.getVerifiedButtonText}>Get Verified for Services</Text>
                          </TouchableOpacity>
                        )}
                        
                        {/* Add More Services Link */}
                        {(displayData?.verifiedServiceCategories?.length > 0 || 
                          displayData?.serviceCategories?.length > 0) && (
                          <TouchableOpacity
                            style={styles.addMoreServicesLink}
                            onPress={() => navigation.navigate('DocumentVerification')}
                          >
                            <Icon name="add-circle" size={14} color="#2b76bc" />
                            <Text style={styles.addMoreServicesText}>Add More Services</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                  <InfoRow
                    iconName="star"
                    label="Rating"
                    value={displayData?.rating ? `${displayData.rating.toFixed(1)} / 5.0` : 'No ratings yet'}
                  />
                  <InfoRow
                    iconName="briefcase"
                    label="Experience"
                    value={displayData?.experience 
                      ? `${displayData.experience} year${displayData.experience === '1' || displayData.experience === 1 ? '' : 's'}` 
                      : 'Not set'}
                  />
                  
                  {/* Portfolio Section - Only for Photographer/Influencer */}
                  {(displayData?.verifiedServiceCategories?.includes('photographer') || 
                    displayData?.verifiedServiceCategories?.includes('influencer')) && (
                    <View style={styles.portfolioSection}>
                      <View style={styles.portfolioHeader}>
                        <View style={styles.portfolioIconContainer}>
                          <MaterialIcon name="collections" size={20} color="#7C3AED" />
                        </View>
                        <View style={styles.portfolioTitleContainer}>
                          <Text style={styles.portfolioTitle}>Portfolio & Social Links</Text>
                          <Text style={styles.portfolioSubtitle}>
                            Showcase your work to attract more clients
                          </Text>
                        </View>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.portfolioEditButton}
                        onPress={() => navigation.navigate('PortfolioEdit')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.portfolioEditContent}>
                          {/* Show current portfolio status */}
                          {(displayData?.portfolioLinks?.instagram || 
                            displayData?.portfolioLinks?.youtube ||
                            displayData?.portfolioLinks?.website) ? (
                            <View style={styles.portfolioLinksPreview}>
                              {displayData.portfolioLinks.instagram && (
                                <View style={styles.portfolioLinkBadge}>
                                  <MaterialIcon name="camera-alt" size={14} color="#DB2777" />
                                </View>
                              )}
                              {displayData.portfolioLinks.youtube && (
                                <View style={styles.portfolioLinkBadge}>
                                  <MaterialIcon name="play-circle-filled" size={14} color="#DC2626" />
                                </View>
                              )}
                              {displayData.portfolioLinks.website && (
                                <View style={styles.portfolioLinkBadge}>
                                  <MaterialIcon name="language" size={14} color="#0284C7" />
                                </View>
                              )}
                              {displayData.portfolioLinks.facebook && (
                                <View style={styles.portfolioLinkBadge}>
                                  <MaterialIcon name="facebook" size={14} color="#2563EB" />
                                </View>
                              )}
                              {displayData.portfolioLinks.tiktok && (
                                <View style={styles.portfolioLinkBadge}>
                                  <MaterialIcon name="music-note" size={14} color="#7C3AED" />
                                </View>
                              )}
                              <Text style={styles.portfolioEditText}>Edit Links</Text>
                            </View>
                          ) : (
                            <Text style={styles.portfolioAddText}>Add your portfolio links</Text>
                          )}
                        </View>
                        <MaterialIcon name="chevron-right" size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                      
                      {/* Bio Preview */}
                      {displayData?.bio && (
                        <View style={styles.bioPreview}>
                          <Text style={styles.bioPreviewLabel}>Bio</Text>
                          <Text style={styles.bioPreviewText} numberOfLines={2}>
                            {displayData.bio}
                          </Text>
                        </View>
                      )}
                      
                      {/* Specializations Preview */}
                      {displayData?.specializations?.length > 0 && (
                        <View style={styles.specializationsPreview}>
                          <Text style={styles.specializationsLabel}>Specializations</Text>
                          <View style={styles.specializationsChips}>
                            {displayData.specializations.slice(0, 3).map((spec, index) => (
                              <View key={index} style={styles.specializationChip}>
                                <Text style={styles.specializationChipText}>{spec}</Text>
                              </View>
                            ))}
                            {displayData.specializations.length > 3 && (
                              <Text style={styles.moreSpecializations}>
                                +{displayData.specializations.length - 3} more
                              </Text>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Verification Section — Users (below profile details) */}
          {!isProvider && (
            <View style={styles.section}>
              <SectionHeader title="Verification" />

              <InfoRow
                iconName="phone"
                label="Phone Number"
                value={displayData?.phone || 'Not set'}
                verified={displayData?.isPhoneVerified}
                onVerify={handlePhoneVerify}
                isLoading={verifyingPhone && !phoneOtpSent}
              />

              {/* Phone OTP Input — Modern 6-box design */}
              {phoneOtpSent && (
                <View style={styles.otpSectionModern}>
                  <Text style={styles.otpSectionLabel}>Enter the 6-digit code</Text>
                  <Animated.View style={[
                    styles.otpBoxesRow,
                    { transform: [{ translateX: otpShakeAnim }] }
                  ]}>
                    {phoneOtp.map((digit, index) => {
                      const isFocused = otpFocusedIndex === index;
                      const isFilled = !!digit;

                      return (
                        <Animated.View
                          key={index}
                          style={[
                            styles.otpBoxWrapper,
                            isFilled && styles.otpBoxWrapperFilled,
                            isFocused && styles.otpBoxWrapperFocused,
                            { transform: [{ scale: otpScaleAnims[index] }] },
                          ]}
                        >
                          <TextInput
                            ref={(ref) => (otpInputRefs.current[index] = ref)}
                            style={[
                              styles.otpBoxInput,
                              isFilled && styles.otpBoxInputFilled,
                              isFocused && styles.otpBoxInputFocused,
                            ]}
                            value={digit}
                            onChangeText={(value) => handleProfileOtpChange(value, index)}
                            onKeyPress={(event) => handleProfileOtpKeyPress(event, index)}
                            onFocus={() => setOtpFocusedIndex(index)}
                            onBlur={() => setOtpFocusedIndex(-1)}
                            keyboardType="number-pad"
                            maxLength={index === 0 ? 6 : 1}
                            selectTextOnFocus
                          />
                        </Animated.View>
                      );
                    })}
                  </Animated.View>
                  {otpCountdown > 0 && (
                    <Text style={styles.otpTimerText}>
                      Code expires in {Math.floor(otpCountdown / 60)}:{String(otpCountdown % 60).padStart(2, '0')}
                    </Text>
                  )}
                  {otpCountdown <= 0 && phoneOtpSent && (
                    <Text style={styles.otpExpiredText}>Code expired. Please request a new one.</Text>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.otpVerifyButton,
                      (verifyingPhone || phoneOtp.join('').length !== 6 || otpCountdown <= 0) && styles.otpVerifyButtonDisabled,
                    ]}
                    onPress={handleVerifyPhoneOtp}
                    disabled={verifyingPhone || phoneOtp.join('').length !== 6 || otpCountdown <= 0}
                    activeOpacity={0.8}
                  >
                    {verifyingPhone ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={styles.otpVerifyButtonContent}>
                        <MaterialIcon name="verified" size={18} color="#FFFFFF" />
                        <Text style={styles.otpVerifyButtonText}>Verify</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              <InfoRow
                iconName="email"
                label="Email"
                value={displayData?.email || 'Not set'}
                verified={displayData?.isEmailVerified}
                onVerify={handleEmailVerify}
                isLoading={verifyingEmail}
              />
            </View>
          )}

          {/* Verification Section — Providers (below profile details) */}
          {isProvider && (
            <View style={styles.section}>
              <SectionHeader title="Verification" />

              <InfoRow
                iconName="phone"
                label="Phone Number"
                value={displayData?.phone || 'Not set'}
                verified={displayData?.isPhoneVerified}
                onVerify={handlePhoneVerify}
                isLoading={verifyingPhone && !phoneOtpSent}
              />

              {/* Phone OTP Input — Modern 6-box design */}
              {phoneOtpSent && (
                <View style={styles.otpSectionModern}>
                  <Text style={styles.otpSectionLabel}>Enter the 6-digit code</Text>
                  <Animated.View style={[
                    styles.otpBoxesRow,
                    { transform: [{ translateX: otpShakeAnim }] }
                  ]}>
                    {phoneOtp.map((digit, index) => {
                      const isFocused = otpFocusedIndex === index;
                      const isFilled = !!digit;

                      return (
                        <Animated.View
                          key={index}
                          style={[
                            styles.otpBoxWrapper,
                            isFilled && styles.otpBoxWrapperFilled,
                            isFocused && styles.otpBoxWrapperFocused,
                            { transform: [{ scale: otpScaleAnims[index] }] },
                          ]}
                        >
                          <TextInput
                            ref={(ref) => (otpInputRefs.current[index] = ref)}
                            style={[
                              styles.otpBoxInput,
                              isFilled && styles.otpBoxInputFilled,
                              isFocused && styles.otpBoxInputFocused,
                            ]}
                            value={digit}
                            onChangeText={(value) => handleProfileOtpChange(value, index)}
                            onKeyPress={(event) => handleProfileOtpKeyPress(event, index)}
                            onFocus={() => setOtpFocusedIndex(index)}
                            onBlur={() => setOtpFocusedIndex(-1)}
                            keyboardType="number-pad"
                            maxLength={index === 0 ? 6 : 1}
                            selectTextOnFocus
                          />
                        </Animated.View>
                      );
                    })}
                  </Animated.View>
                  {otpCountdown > 0 && (
                    <Text style={styles.otpTimerText}>
                      Code expires in {Math.floor(otpCountdown / 60)}:{String(otpCountdown % 60).padStart(2, '0')}
                    </Text>
                  )}
                  {otpCountdown <= 0 && phoneOtpSent && (
                    <Text style={styles.otpExpiredText}>Code expired. Please request a new one.</Text>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.otpVerifyButton,
                      (verifyingPhone || phoneOtp.join('').length !== 6 || otpCountdown <= 0) && styles.otpVerifyButtonDisabled,
                    ]}
                    onPress={handleVerifyPhoneOtp}
                    disabled={verifyingPhone || phoneOtp.join('').length !== 6 || otpCountdown <= 0}
                    activeOpacity={0.8}
                  >
                    {verifyingPhone ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={styles.otpVerifyButtonContent}>
                        <MaterialIcon name="verified" size={18} color="#FFFFFF" />
                        <Text style={styles.otpVerifyButtonText}>Verify</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              <InfoRow
                iconName="email"
                label="Email"
                value={displayData?.email || 'Not set'}
                verified={displayData?.isEmailVerified}
                onVerify={handleEmailVerify}
                isLoading={verifyingEmail}
              />

              {/* Aadhaar Verification - Providers Only */}
              <InfoRow
                iconName="verified_user"
                label="Aadhaar (KYC)"
                value={isAadhaarVerified
                  ? `Verified${aadhaarName ? ` as ${aadhaarName}` : ''}`
                  : 'Not Verified'}
                verified={isAadhaarVerified}
                onVerify={() => setShowAadhaarModal(true)}
                isLoading={false}
              />

              {/* Name locked notice after Aadhaar */}
              {isNameLocked && (
                <View style={styles.nameLockNotice}>
                  <MaterialIcon name="lock" size={14} color="#2b76bc" />
                  <Text style={styles.nameLockNoticeText}>
                    Name locked after Aadhaar verification
                  </Text>
                </View>
              )}

              {/* Provider Aadhaar verification notice */}
              {!isAadhaarVerified && (
                <View style={styles.aadhaarNotice}>
                  <Icon name="warning" size={16} color="#f67c16" />
                  <Text style={styles.aadhaarNoticeText}>
                    Verify your Aadhaar to receive service requests
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Saved Addresses Section */}
          {!isProvider && (
            <View style={styles.section}>
              <SectionHeader title="Saved Addresses" />
              <TouchableOpacity
                style={styles.addressesCard}
                onPress={() => setShowAddressesModal(true)}
                activeOpacity={0.7}
              >
                <View style={styles.addressesIconContainer}>
                  <MaterialIcon name="location-on" size={24} color="#2b76bc" />
                </View>
                <View style={styles.addressesContent}>
                  <Text style={styles.addressesTitle} numberOfLines={1} ellipsizeMode="tail">Manage Addresses</Text>
                  <Text style={styles.addressesSubtitle} numberOfLines={2} ellipsizeMode="tail">
                    Add, edit or delete your saved addresses
                  </Text>
                </View>
                <MaterialIcon name="chevron-right" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          )}

          {/* Favorites Section */}
          {!isProvider && (
            <View style={styles.section}>
              <SectionHeader title="My Favorites" />
              <TouchableOpacity
                style={styles.addressesCard}
                onPress={() => navigation.navigate('Favorites')}
                activeOpacity={0.7}
              >
                <View style={[styles.addressesIconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialIcon name="favorite" size={24} color="#F59E0B" />
                </View>
                <View style={styles.addressesContent}>
                  <Text style={styles.addressesTitle} numberOfLines={1} ellipsizeMode="tail">Saved Providers</Text>
                  <Text style={styles.addressesSubtitle} numberOfLines={2} ellipsizeMode="tail">
                    View and manage your favorite service providers
                  </Text>
                </View>
                <MaterialIcon name="chevron-right" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          )}

          {/* Premium Subscription Section - Providers Only */}
          {isProvider && (
            <View style={styles.premiumSection}>
              {!premiumLoaded ? (
                /* SWR-style skeleton: show neutral loading card until fetch completes */
                <View style={styles.premiumCardLoading}>
                  <View style={styles.premiumLoadingShimmer}>
                    <ActivityIndicator size="small" color="#CBD5E1" />
                    <Text style={styles.premiumLoadingText}>Checking subscription…</Text>
                  </View>
                </View>
              ) : isPremiumActive ? (
                <TouchableOpacity
                  style={styles.premiumCardActive}
                  onPress={() => navigation.navigate('Subscription')}
                  activeOpacity={0.8}
                >
                  {/* Active premium header */}
                  <View style={styles.premiumActiveHeader}>
                    <View style={styles.premiumActiveDecoCircle1} />
                    <View style={styles.premiumActiveDecoCircle2} />
                    <View style={styles.premiumActiveIconRow}>
                      <View style={styles.premiumActiveIconBg}>
                        <MaterialIcon name="workspace-premium" size={26} color="#000" />
                      </View>
                      <View style={styles.premiumActiveBadge}>
                        <MaterialIcon name="verified" size={14} color="#16A34A" />
                        <Text style={styles.premiumActiveBadgeText}>ACTIVE</Text>
                      </View>
                    </View>
                    <Text style={styles.premiumActiveTitle}>Premium Plan</Text>
                    <Text style={styles.premiumActiveSubtitle}>Your premium benefits are active</Text>
                  </View>
                  {/* Stats row */}
                  <View style={styles.premiumStatsRow}>
                    <View style={styles.premiumStatItem}>
                      <Text style={styles.premiumStatValue}>{premiumDaysLeft}</Text>
                      <Text style={styles.premiumStatLabel}>Days Left</Text>
                    </View>
                    <View style={styles.premiumStatDivider} />
                    <View style={styles.premiumStatItem}>
                      <MaterialIcon name="trending-up" size={22} color="#16A34A" />
                      <Text style={styles.premiumStatLabel}>Priority</Text>
                    </View>
                    <View style={styles.premiumStatDivider} />
                    <View style={styles.premiumStatItem}>
                      <MaterialIcon name="visibility" size={22} color="#2b76bc" />
                      <Text style={styles.premiumStatLabel}>Boosted</Text>
                    </View>
                  </View>
                  {/* Footer */}
                  <View style={styles.premiumActiveFooter}>
                    <Text style={styles.premiumActiveFooterText}>Manage Subscription</Text>
                    <MaterialIcon name="arrow-forward-ios" size={14} color="#64748B" />
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.premiumCardInactive}
                  onPress={() => navigation.navigate('Subscription')}
                  activeOpacity={0.8}
                >
                  <View style={styles.premiumInactiveGradient}>
                    <View style={styles.premiumInactiveDecoCircle1} />
                    <View style={styles.premiumInactiveDecoCircle2} />
                    <MaterialIcon name="workspace-premium" size={44} color="#FFD700" />
                    <Text style={styles.premiumInactiveTitle}>Go Premium</Text>
                    <Text style={styles.premiumInactiveSubtitle}>Get priority listing & reach more customers</Text>
                    <View style={styles.premiumInactiveBtn}>
                      <Text style={styles.premiumInactiveBtnText}>Subscribe Now</Text>
                      <MaterialIcon name="arrow-forward" size={18} color="#FFFFFF" />
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Account Info */}
          <View style={styles.section}>
            <SectionHeader title="Account" />
            <InfoRow
              iconName="user"
              label="User ID"
              value={displayData?.javaUserId?.toString() || (displayData?.mongoId ? String(displayData.mongoId).slice(-8) : 'N/A')}
            />
            <InfoRow
              iconName="calendar"
              label="Member Since"
              value={displayData?.createdAt 
                ? new Date(displayData.createdAt).toLocaleDateString('en-IN', {
                    month: 'long',
                    year: 'numeric',
                  })
                : 'N/A'
              }
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Saved Addresses Modal */}
      <Modal
        visible={showAddressesModal}
        animationType="slide"
        onRequestClose={() => setShowAddressesModal(false)}
      >
        <SavedAddresses
          userId={displayData?.mongoId || displayData?._id}
          showHeader={true}
          onClose={() => setShowAddressesModal(false)}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
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
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  editButtonCancel: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  editButtonText: {
    fontSize: 14,
    color: '#2b76bc',
    fontWeight: '700',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },

  // Row fields for city/pincode
  rowFields: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  halfField: {
    flex: 1,
  },
  readOnlySection: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  readOnlyNote: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 28,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  profileCardHeader: {
    height: 110,
    overflow: 'hidden',
    position: 'relative',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  profileCardHeaderUser: {
    backgroundColor: '#2b76bc',
  },
  profileCardHeaderProvider: {
    backgroundColor: '#f67c16',
  },
  profileDecorCircle1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  profileDecorCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -15,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  profileDecorCircle3: {
    position: 'absolute',
    top: 10,
    left: '40%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  profileAvatarWrap: {
    alignSelf: 'center',
    marginTop: -52,
    zIndex: 10,
    ...Platform.select({
      ios: {},
      android: { elevation: 10 },
    }),
    marginBottom: 0,
  },
  profileCardBody: {
    paddingTop: 10,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  profileBodyAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    opacity: 0.45,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  avatarRingProvider: {
    borderColor: '#FFFFFF',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2b76bc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2b76bc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cameraIconOverlayProvider: {
    backgroundColor: '#f67c16',
  },
  avatarProvider: {
    backgroundColor: '#f67c16',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  profileBadgeRow: {
    marginTop: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  profileEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    letterSpacing: 0.1,
    flexShrink: 1,
    maxWidth: '90%',
    textAlign: 'center',
  },
  profilePhone: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 2,
    letterSpacing: 0.1,
    flexShrink: 1,
    maxWidth: '90%',
    textAlign: 'center',
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 2,
    marginTop: 8,
    maxWidth: '100%',
  },
  profileName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
    textAlign: 'center',
    flexShrink: 1,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#FDE68A',
    ...Platform.select({
      ios: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  proBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#D97706',
    marginLeft: 3,
    letterSpacing: 0.5,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  typeBadgeProvider: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  typeBadgeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#2b76bc',
  },
  typeBadgeTextProvider: {
    color: '#f67c16',
  },

  // Image Picker Modal
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'flex-end',
  },
  imagePickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 40,
  },
  imagePickerDragBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 18,
  },
  imagePickerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 22,
    letterSpacing: -0.3,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 14,
    borderRadius: 14,
    marginBottom: 4,
  },
  imagePickerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerOptionContent: {
    flex: 1,
  },
  imagePickerOptionText: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '600',
  },
  imagePickerOptionHint: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  imagePickerCancelBtn: {
    marginTop: 14,
    paddingVertical: 15,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    alignItems: 'center',
  },
  imagePickerCancelText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '700',
  },

  // View Photo Modal
  viewPhotoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewPhotoContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewPhotoCloseBtn: {
    position: 'absolute',
    top: 54,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  viewPhotoImage: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: 22,
  },
  viewPhotoName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 22,
    letterSpacing: -0.2,
  },

  verificationSummary: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  verificationItemVerified: {
    backgroundColor: '#2b76bc',
    borderColor: '#1e5f9e',
  },
  verificationLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  verificationLabelVerified: {
    color: '#FFFFFF',
  },
  verifyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  verifyWarningText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12.5,
    color: '#C2410C',
    fontWeight: '500',
    lineHeight: 18,
  },
  aadhaarNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f67c16',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  aadhaarNoticeText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    color: '#9A3412',
    fontWeight: '500',
    lineHeight: 18,
  },

  // Section
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  infoLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 3,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 15.5,
    color: '#0F172A',
    fontWeight: '600',
    flexShrink: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexShrink: 0,
  },
  verifiedText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '700',
  },
  verifyButton: {
    backgroundColor: '#f67c16',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 78,
    alignItems: 'center',
    flexShrink: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#f67c16',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  verifyButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // OTP Section
  otpSectionModern: {
    paddingVertical: 18,
    paddingHorizontal: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    marginTop: -2,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  otpSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  otpBoxWrapper: {
    width: 46,
    height: 54,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxWrapperFilled: {
    borderColor: '#2b76bc',
    backgroundColor: '#EFF6FF',
    ...Platform.select({
      ios: {
        shadowColor: '#2b76bc',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  otpBoxWrapperFocused: {
    borderColor: '#f67c16',
    backgroundColor: '#FFFBF5',
    ...Platform.select({
      ios: {
        shadowColor: '#f67c16',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  otpBoxInput: {
    width: '100%',
    height: '100%',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1E293B',
    padding: 0,
  },
  otpBoxInputFilled: {
    color: '#2b76bc',
  },
  otpBoxInputFocused: {
    color: '#f67c16',
  },
  otpVerifyButton: {
    backgroundColor: '#f67c16',
    borderRadius: 14,
    paddingVertical: 14,
    marginHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#f67c16',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  otpVerifyButtonDisabled: {
    backgroundColor: '#CBD5E1',
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  otpVerifyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  otpVerifyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  otpTimerText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  otpExpiredText: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },

  // Editable Field
  fieldContainer: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  fieldInput: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0F172A',
    backgroundColor: '#FAFBFC',
    fontWeight: '500',
  },
  fieldInputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  fieldLockMessage: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  phoneChangeWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    marginTop: -8,
    gap: 8,
  },
  phoneChangeWarningText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  nameLockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 6,
    marginBottom: 8,
    marginLeft: 56,
    marginRight: 16,
    gap: 6,
  },
  nameLockNoticeText: {
    fontSize: 12,
    color: '#2b76bc',
    fontWeight: '500',
    flexShrink: 1,
  },

  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f67c16',
    height: 56,
    borderRadius: 16,
    marginTop: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#f67c16',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // Service Categories Styles
  categoriesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  categoriesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  verifiedBadgeSmall: {
    marginTop: -2,
  },
  categoriesHint: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipVerified: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  categoryChipTextVerified: {
    color: '#2b76bc',
    fontWeight: '600',
  },
  categoryChipSelected: {
    backgroundColor: '#2b76bc',
    borderColor: '#2b76bc',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#4B5563',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  documentVerificationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  documentVerificationLinkText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    color: '#2b76bc',
    fontWeight: '600',
  },
  noCategoriesWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  noCategoriesText: {
    fontSize: 13,
    color: '#94A3B8',
  },

  // Service Categories Display (View Mode)
  serviceCategoriesDisplay: {
    marginBottom: 0,
  },
  labelWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedBadgeTiny: {
    marginLeft: 2,
  },
  categoriesDisplayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  categoryDisplayChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
  },
  categoryDisplayText: {
    fontSize: 12,
    color: '#2b76bc',
    fontWeight: '500',
  },
  categoryDisplayChipVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    gap: 4,
  },
  categoryDisplayTextVerified: {
    fontSize: 12,
    color: '#2b76bc',
    fontWeight: '600',
  },
  categoryDisplayChipPending: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    gap: 4,
  },
  categoryDisplayTextPending: {
    fontSize: 12,
    color: '#f67c16',
    fontWeight: '600',
  },
  servicesLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    marginTop: 4,
  },
  servicesLabelVerified: {
    fontSize: 11,
    color: '#2b76bc',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  servicesLabelPending: {
    fontSize: 11,
    color: '#f67c16',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  addMoreServicesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  addMoreServicesText: {
    fontSize: 13,
    color: '#2b76bc',
    fontWeight: '600',
  },
  pendingServicesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  pendingServicesText: {
    fontSize: 12,
    color: '#f67c16',
    fontWeight: '500',
  },
  getVerifiedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  getVerifiedButtonText: {
    fontSize: 13,
    color: '#2b76bc',
    fontWeight: '600',
  },

  // Saved Addresses Card
  addressesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  addressesIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  addressesContent: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  addressesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  addressesSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 3,
    lineHeight: 18,
  },

  // Portfolio Section Styles
  portfolioSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  portfolioHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  portfolioIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  portfolioTitleContainer: {
    flex: 1,
  },
  portfolioTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  portfolioSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  portfolioEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  portfolioEditContent: {
    flex: 1,
  },
  portfolioLinksPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  portfolioLinkBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  portfolioEditText: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '600',
    marginLeft: 4,
  },
  portfolioAddText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  bioPreview: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  bioPreviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bioPreviewText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  specializationsPreview: {
    marginTop: 12,
  },
  specializationsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  specializationsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  specializationChip: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  specializationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
  },
  moreSpecializations: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Detect My Location
  locationSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  locationSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  detectLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2b76bc',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#2b76bc',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  detectLocationBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  detectLocationBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Premium Subscription Section
  premiumSection: {
    marginBottom: 16,
  },
  premiumCardLoading: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    paddingVertical: 38,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: { elevation: 5 },
    }),
  },
  premiumLoadingShimmer: {
    alignItems: 'center',
    gap: 10,
  },
  premiumLoadingText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  premiumCardActive: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  premiumActiveHeader: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  premiumActiveDecoCircle1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,215,0,0.08)',
  },
  premiumActiveDecoCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -10,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,215,0,0.05)',
  },
  premiumActiveIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  premiumActiveIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22,163,74,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  premiumActiveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4ADE80',
    letterSpacing: 0.5,
  },
  premiumActiveTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  premiumActiveSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  premiumStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  premiumStatItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  premiumStatValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  premiumStatLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  premiumStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  premiumActiveFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  premiumActiveFooterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  premiumCardInactive: {
    borderRadius: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#4338CA',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  premiumInactiveGradient: {
    backgroundColor: '#1E293B',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  premiumInactiveDecoCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,215,0,0.06)',
  },
  premiumInactiveDecoCircle2: {
    position: 'absolute',
    bottom: -40,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  premiumInactiveTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 14,
    letterSpacing: -0.3,
  },
  premiumInactiveSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  premiumInactiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f67c16',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 22,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#f67c16',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  premiumInactiveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ProfileScreen;
