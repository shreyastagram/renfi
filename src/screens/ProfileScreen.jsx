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
import {  View,
  Text,
  StyleSheet,
  ScrollView,
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
  InteractionManager,
  AppState
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Circle, Path } from 'react-native-svg';
import { formatExperience, formatMonthYear, minExperienceStartDate } from '../utils/experience';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { Icon, PhoneInput, AadhaarVerificationModal } from '../components';
import ImageViewerModal from '../components/ImageViewerModal';
import { useShimmerAnimation, ShimmerBlock as SharedShimmerBlock } from '../components/ShimmerLoader';

/** Auto-orient Cloudinary URLs to fix EXIF rotation on iOS */
const autoOrient = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com') || url.includes('/a_auto')) return url;
  return url.replace('/upload/', '/upload/a_auto/');
};
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
import { requestCameraPermission, requestGalleryPermission } from '../utils/permissions';
import SavedAddresses from '../components/SavedAddresses';
import GraphBackground from '../components/GraphBackground';
import AddressAutocomplete from '../components/AddressAutocomplete';
import CityAutocomplete from '../components/CityAutocomplete';
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';

import { uploadProfilePicture } from '../services/cloudinaryService';

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
const InfoRow = React.memo(({ label, value, iconName, verified, onVerify, isLoading, otpSent, verifiedLabel, verifyLabel, iconColor, iconBg, materialIcon }) => (
  <View style={styles.infoRow}>
    <View style={[styles.infoIconContainer, iconBg && { backgroundColor: iconBg }]}>
      {materialIcon ? (
        <MaterialIcon name={materialIcon} size={20} color={iconColor || '#64748B'} />
      ) : (
        <Icon name={iconName} size={20} color={iconColor || '#64748B'} />
      )}
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel} numberOfLines={1} ellipsizeMode="tail">{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2} ellipsizeMode="tail">{value}</Text>
    </View>
    {verified !== undefined && (
      verified ? (
        <View style={styles.verifiedBadge}>
          <Icon name="check" size={14} color="#10B981" />
          <Text style={styles.verifiedText}>{verifiedLabel || 'Verified'}</Text>
        </View>
      ) : otpSent ? (
        <View style={styles.otpSentBadge}>
          <MaterialIcon name="mark-email-read" size={14} color="#F59E0B" />
          <Text style={styles.otpSentText}>OTP Sent</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.verifyButton} onPress={onVerify} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.verifyButtonText}>{verifyLabel || 'Verify'}</Text>
          )}
        </TouchableOpacity>
      )
    )}
  </View>
));

/**
 * Editable Field
 */
const EditableField = React.memo(({ label, value, onChangeText, placeholder, editable = true, locked = false, lockMessage, lockedLabel, keyboardType = 'default', maxLength, containerStyle }) => (
  <View style={[styles.fieldContainer, containerStyle]}>
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {locked && (
        <View style={styles.lockedBadge}>
          <MaterialIcon name="lock" size={12} color="#6B7280" />
          <Text style={styles.lockedBadgeText}>{lockedLabel || 'Locked'}</Text>
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
 * Profile Screen Skeleton Loader — Amazon-style shimmer wave
 */
const ProfileSkeletonLoader = ({ insets, onBack }) => {
  const shimmerAnim = useShimmerAnimation();
  return (
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
            <SharedShimmerBlock width={80} height={80} borderRadius={40} shimmerAnim={shimmerAnim} />
            <SharedShimmerBlock width={140} height={18} borderRadius={8} shimmerAnim={shimmerAnim} style={{ marginTop: 12 }} />
            <SharedShimmerBlock width={180} height={13} borderRadius={6} shimmerAnim={shimmerAnim} style={{ marginTop: 8 }} />
          </View>
        </View>

        {/* Info rows skeleton */}
        <SharedShimmerBlock width={120} height={14} borderRadius={6} shimmerAnim={shimmerAnim} style={{ marginTop: 20, marginBottom: 12 }} />
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 }}>
            <SharedShimmerBlock width={36} height={36} borderRadius={18} shimmerAnim={shimmerAnim} />
            <View style={{ gap: 6, flex: 1 }}>
              <SharedShimmerBlock width={80} height={12} borderRadius={5} shimmerAnim={shimmerAnim} />
              <SharedShimmerBlock width={160} height={14} borderRadius={6} shimmerAnim={shimmerAnim} />
            </View>
          </View>
        ))}

        {/* Another section */}
        <SharedShimmerBlock width={100} height={14} borderRadius={6} shimmerAnim={shimmerAnim} style={{ marginTop: 20, marginBottom: 12 }} />
        {[1, 2].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 }}>
            <SharedShimmerBlock width={36} height={36} borderRadius={18} shimmerAnim={shimmerAnim} />
            <View style={{ gap: 6, flex: 1 }}>
              <SharedShimmerBlock width={90} height={12} borderRadius={5} shimmerAnim={shimmerAnim} />
              <SharedShimmerBlock width={140} height={14} borderRadius={6} shimmerAnim={shimmerAnim} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

/**
 * Profile Screen Component
 */
const ProfileScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { dialog } = useDialog();
  const { user, profile, userType, refreshVerificationStatus, refreshProfile, aadhaarStatus, setAadhaarStatus, premiumStatus, setPremiumStatus, isProfileLoading } = useApp();
  const { t } = useLanguage();

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
  // Per-section edit state: null | 'identity' | 'contact' | 'experience' | 'about'
  const [editingSection, setEditingSection] = useState(null);
  const isEditing = editingSection !== null;
  const [saving, setSaving] = useState(false);
  
  // Edit form state
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '', // Added phone number to editable fields
    address: '',
    city: '',
    pincode: '',
    experience: '',
    bio: '',
  });
  const originalFormData = useRef({});

  // Provider experience — LinkedIn-style "Working since" month+year (optional)
  const [experienceStartDate, setExperienceStartDate] = useState(null); // Date | null
  const [showExperiencePicker, setShowExperiencePicker] = useState(false);
  const originalExperienceStartDate = useRef(null); // ISO string | null

  const handleExperienceDateChange = useCallback((event, selectedDate) => {
    if (Platform.OS === 'android') setShowExperiencePicker(false);
    if (event?.type === 'dismissed') return;
    if (selectedDate) setExperienceStartDate(selectedDate);
  }, []);

  // Provider service categories are now managed via Document Verification screen

  // Verification state
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState(Array(6).fill(''));
  const [otpFocusedIndex, setOtpFocusedIndex] = useState(-1);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpExpiryRef = useRef(0); // absolute timestamp when OTP expires
  const otpPhoneRef = useRef(''); // tracks which phone the OTP was sent to

  // OTP input refs & animations
  const otpInputRefs = useRef([]);
  const otpScaleAnims = useRef(Array(6).fill(null).map(() => new Animated.Value(1))).current;
  const otpShakeAnim = useRef(new Animated.Value(0)).current;

  // OTP countdown timer — uses absolute expiry timestamp so it survives app minimize
  useEffect(() => {
    if (!otpExpiryRef.current) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((otpExpiryRef.current - Date.now()) / 1000));
      setOtpCountdown(remaining);
      if (remaining <= 0) otpExpiryRef.current = 0;
    };
    tick(); // immediate sync on resume
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown > 0]);

  // Reset OTP state when phone number changes after OTP was sent
  useEffect(() => {
    if (phoneOtpSent && formData.phone !== otpPhoneRef.current) {
      setPhoneOtpSent(false);
      setPhoneOtp(Array(6).fill(''));
      setOtpCountdown(0);
      otpExpiryRef.current = 0;
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
  const [galleryViewerVisible, setGalleryViewerVisible] = useState(false);
  const [galleryViewerIndex, setGalleryViewerIndex] = useState(0);
  const isAadhaarVerified = aadhaarStatus.isVerified;
  const isNameLocked = aadhaarStatus.isNameLocked;
  const aadhaarName = aadhaarStatus.aadhaarName;
  const aadhaarLoaded = aadhaarStatus.aadhaarLoaded;

  // Shimmer animation for inline placeholders
  const shimmerAnim = useShimmerAnimation();
  
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
          t('profile.locationPermRequired'),
          t('profile.locationPermMsg'),
          [{ text: t('common.ok') }]
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
        dialog(t('profile.locationNotFound'), t('profile.locationNotFoundMsg'));
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
      const confirmLines = [
        `Address: ${detectedAddress || 'Not found'}`,
        `City: ${detectedCity || 'Not found'}`,
        `Pincode: ${detectedPincode || 'Not found'}`,
        detectedState ? `State: ${detectedState}` : '',
      ].filter(Boolean).join('\n');

      dialog(
        t('profile.detectedLocation'),
        `We found the following from your current location:\n\n${confirmLines}\n\nWould you like to use this?`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('profile.useThisLocation'),
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
          t('profile.locationTurnedOff'),
          t('profile.locationTurnedOffMsg'),
          [
            { text: t('profile.enterManually'), style: 'cancel' },
            {
              text: t('userHome.enableGps'),
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:').catch(() => Linking.openSettings());
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
        dialog(t('profile.permissionDenied'), t('profile.permissionDeniedMsg'));
      } else {
        dialog(t('profile.locationErrorTitle'), t('profile.locationErrorMsg'));
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
      experience: displayData?.experience != null && displayData.experience !== '' ? String(displayData.experience).trim() : '',
      bio: displayData?.bio || '',
    };
    setFormData(initial);
    originalFormData.current = initial;
    setOriginalPhone(phoneValue);

    // "Working since" date — prefill from the provider's existing experienceStartDate
    const rawExpStart = displayData?.experienceStartDate || null;
    const parsedExpStart = rawExpStart ? new Date(rawExpStart) : null;
    setExperienceStartDate(parsedExpStart && !isNaN(parsedExpStart.getTime()) ? parsedExpStart : null);
    originalExperienceStartDate.current = rawExpStart;
  }, [displayData?.fullName, displayData?.phone, displayData?.phoneNumber, displayData?.address, displayData?.city, displayData?.pincode, displayData?.experience, displayData?.experienceStartDate, displayData?.bio]);

  // Fetch Aadhaar verification status and premium status for providers
  // Uses context cache — only fetches if stale or on first load
  const aadhaarFetchedRef = useRef(false);
  
  const fetchProviderStatuses = useCallback(async () => {
    if (!isProvider) return;
    const pid = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

    // Run both fetches in parallel instead of sequentially
    const [aadhaarResult, dashResult] = await Promise.allSettled([
      getAadhaarStatus(),
      pid ? getVerificationDashboard(pid) : Promise.resolve(null),
    ]);

    // Process Aadhaar result
    if (aadhaarResult.status === 'fulfilled' && aadhaarResult.value?.success) {
      const a = aadhaarResult.value.aadhaar;
      const status = {
        isVerified: a?.isVerified || false,
        isNameLocked: a?.isNameLocked || false,
        aadhaarName: a?.aadhaarName || null,
        aadhaarLoaded: true,
      };
      setAadhaarStatus(status);
      // Cache for instant display on next cold start
      AsyncStorage.setItem('cached_aadhaar_status', JSON.stringify(status)).catch(() => {});
    } else {
      setAadhaarStatus(prev => ({ ...prev, aadhaarLoaded: true }));
    }

    // Process premium/dashboard result
    if (dashResult.status === 'fulfilled' && dashResult.value?.success && dashResult.value?.data) {
      const premStep = dashResult.value.data.steps?.find(s => s.id === 'premium');
      setPremiumStatus({
        isPremiumActive: dashResult.value.data.isPremiumActive || false,
        premiumDaysLeft: premStep?.daysRemaining || 0,
        premiumLoaded: true,
      });
    } else {
      setPremiumStatus(prev => ({ ...prev, premiumLoaded: true }));
    }
  }, [isProvider, user?.mongoId, profile?.mongoId]);

  useEffect(() => {
    if (isProvider && !aadhaarFetchedRef.current) {
      aadhaarFetchedRef.current = true;
      fetchProviderStatuses();
    }
  }, [isProvider]);

  // Auto-refresh profile when screen gains focus — with 30s staleness guard
  const profileLastRefreshRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const elapsed = Date.now() - profileLastRefreshRef.current;
      if (elapsed < 30000) return; // Skip if refreshed within last 30s

      const task = InteractionManager.runAfterInteractions(() => {
        const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
        if (userId && userType) {
          profileLastRefreshRef.current = Date.now();
          refreshProfile(userType, userId);
        }
      });
      return () => task.cancel();
    }, [user?.mongoId, profile?.mongoId, userType, refreshProfile])
  );

  // Refresh from the SERVER when the app returns to the foreground.
  // Why: after adding an email the user leaves to open the verification link in
  // their mail app; on some phones the app is killed while backgrounded. Because
  // the email value is already persisted server-side and the verified flag is
  // read from Java Auth (the source of truth), simply re-fetching on resume shows
  // the now-verified state — nothing is kept in fragile in-memory state. This
  // covers the warm-resume case; cold start is covered by the focus effect above.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      // Lightweight: just re-pull the verification flags from Java Auth (the
      // source of truth) so a freshly-verified email shows on return. We do NOT
      // force a full profile refresh here — that flashes the whole screen on
      // every resume; the on-focus effect already handles the heavier refresh.
      refreshVerificationStatus?.();
    });
    return () => sub.remove();
  }, [refreshVerificationStatus]);

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
      dialog(t('common.error'), t('common.somethingWentWrong'));
      return;
    }

    // Trim whitespace from text fields
    const trimmed = { ...formData };
    for (const key of ['fullName', 'phone', 'address', 'city', 'pincode', 'bio']) {
      if (typeof trimmed[key] === 'string') trimmed[key] = trimmed[key].trim();
    }

    // Input length validation
    if (trimmed.fullName && (trimmed.fullName.length < 2 || trimmed.fullName.length > 100)) {
      dialog(t('profile.invalidName'), t('profile.invalidNameMsg'));
      return;
    }
    if (trimmed.phone && (!/^\d{10}$/.test(trimmed.phone) || !/^[6-9]/.test(trimmed.phone))) {
      dialog(t('profile.invalidPhone'), t('profile.invalidPhoneMsg'));
      return;
    }
    if (trimmed.pincode && !/^\d{6}$/.test(trimmed.pincode)) {
      dialog(t('profile.invalidPincode'), t('profile.invalidPincodeMsg'));
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
          t('profile.phoneChangeTitle'),
          t('profile.phoneChangeMsg'),
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => { setSaving(false); resolve(); } },
            {
              text: t('common.continue'),
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

      // "Working since" date lives in separate state — detect its change by ISO string
      const newExpIso = experienceStartDate ? experienceStartDate.toISOString() : null;
      const origExpIso = originalExperienceStartDate.current
        ? (isNaN(new Date(originalExperienceStartDate.current).getTime())
            ? null
            : new Date(originalExperienceStartDate.current).toISOString())
        : null;
      const experienceStartChanged = isProvider && newExpIso !== origExpIso;

      if (Object.keys(changedFields).length === 0 && !experienceStartChanged) {
        dialog(t('profile.noChanges'), t('profile.noChangesMsg'));
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
        // Send the "Working since" date (null clears it). Date wins over legacy experience.
        if (experienceStartChanged) providerUpdates.experienceStartDate = newExpIso;
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
        dialog(t('common.success'), t('profile.profileUpdated'));
        setEditingSection(null);
        // Refresh profile data to reflect changes immediately
        await refreshProfile(userType, userId);
        await refreshVerificationStatus();
      } else {
        // Handle specific error codes from backend
        const errorCode = result.error?.code || result.error?.response?.data?.code;

        if (errorCode === 'PHONE_ALREADY_EXISTS') {
          dialog(
            t('profile.phoneConflict'),
            t('profile.phoneConflictMsg'),
            [
              { text: t('common.ok'), onPress: () => {
                // Revert phone field to original value
                setFormData(prev => ({ ...prev, phone: originalPhone }));
              }}
            ]
          );
        } else if (errorCode === 'PROFILE_CONFLICT') {
          dialog(
            t('profile.updateConflict'),
            result.error?.message || 'This information conflicts with another account. Please try different values.',
            [{ text: t('common.ok') }]
          );
        } else if (errorCode === 'NAME_LOCKED') {
          dialog(
            t('profile.nameLocked'),
            t('profile.nameLockedMsg'),
            [{ text: t('common.ok') }]
          );
        } else if (result.error?.isTransient) {
          // Transient network error — offer retry
          dialog(
            t('profile.connectionIssue'),
            t('profile.connectionIssueMsg'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.retry') || 'Retry', onPress: () => performSave(userId) },
            ]
          );
        } else {
          dialog(t('profile.couldntSave'), getErrorMessage(result.error, t('profile.couldntSaveMsg')));
        }
      }
    } catch (error) {
      dialog(t('profile.couldntSave'), t('profile.couldntSaveMsg'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Save a section's fields as a partial update (per-section editors).
   * Takes SEMANTIC fields and maps them to the role-specific payload exactly
   * like performSave (provider name key = 'name'; phone gets '+91'). Only the
   * provided fields are sent, so the Java-Auth sync inside the update services
   * only fires when name/phone actually change.
   * Returns true on success so callers can keep local state on failure.
   */
  const saveProfileFields = useCallback(async (fields) => {
    const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    if (!userId) {
      dialog(t('profile.couldntSave'), t('profile.couldntSaveMsg'));
      return false;
    }
    setSaving(true);
    try {
      const payload = {};
      if (fields.fullName !== undefined) payload[isProvider ? 'name' : 'fullName'] = fields.fullName;
      if (fields.phone !== undefined) payload.phone = '+91' + fields.phone;
      if (fields.address !== undefined) payload.address = fields.address;
      if (fields.city !== undefined) payload.city = fields.city;
      if (fields.pincode !== undefined) payload.pincode = fields.pincode;
      if (fields.bio !== undefined) payload.bio = fields.bio;
      if (fields.experienceStartDate !== undefined) payload.experienceStartDate = fields.experienceStartDate;

      const updateFn = isProvider ? updateProviderProfile : updateUserProfile;
      const result = await updateFn(userId, payload);
      if (!result?.success) {
        const errorCode = result?.error?.code || result?.error?.response?.data?.code;
        if (errorCode === 'PHONE_ALREADY_EXISTS') {
          dialog(t('profile.phoneConflict'), t('profile.phoneConflictMsg'), [
            { text: t('common.ok'), onPress: () => setFormData(prev => ({ ...prev, phone: originalPhone })) },
          ]);
        } else if (errorCode === 'NAME_LOCKED') {
          dialog(t('profile.nameLocked'), t('profile.nameLockedMsg'));
        } else if (errorCode === 'PROFILE_CONFLICT') {
          dialog(
            t('profile.updateConflict'),
            result?.error?.message || 'This information conflicts with another account. Please try different values.'
          );
        } else {
          dialog(t('profile.couldntSave'), getErrorMessage(result?.error, t('profile.couldntSaveMsg')));
        }
        return false;
      }
      await refreshProfile(userType, userId);
      if (fields.phone !== undefined || fields.fullName !== undefined) {
        await refreshVerificationStatus?.();
      }
      setEditingSection(null);
      return true;
    } catch (error) {
      dialog(t('profile.connectionIssue'), t('profile.connectionIssueMsg'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, profile, isProvider, userType, originalPhone, refreshProfile, refreshVerificationStatus, dialog, t]);

  /**
   * Handle phone verification
   */
  const handlePhoneVerify = async () => {
    if (!displayData?.phone) {
      dialog(t('common.error'), t('profile.addPhoneFirst'));
      return;
    }

    setVerifyingPhone(true);
    try {
      const result = await sendPhoneVerificationOtp(displayData.phone);

      if (result.success) {
        setPhoneOtpSent(true);
        otpExpiryRef.current = Date.now() + 300000; // 5 minutes from now
        setOtpCountdown(300);
        setPhoneOtp(Array(6).fill(''));
        otpPhoneRef.current = formData.phone; // track which phone the OTP was sent to (raw 10 digits)
        dialog(t('profile.otpSent'), t('profile.otpSentMsg', { phone: displayData.phone }));
      } else {
        dialog(t('common.error'), getErrorMessage(result.error, t('profile.otpSendFail')));
      }
    } catch (error) {
      dialog(t('common.error'), t('profile.otpSendFail'));
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
      dialog(t('common.error'), t('profile.invalidOtp'));
      return;
    }

    setVerifyingPhone(true);
    try {
      // Java Auth only needs OTP - phone is extracted from JWT token
      const result = await verifyPhoneOtp(otpCode);

      if (result.success) {
        dialog(t('common.success'), t('profile.phoneVerifiedSuccess'));
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
        dialog(t('common.error'), getErrorMessage(result.error, t('profile.invalidOtp')));
      }
    } catch (error) {
      dialog(t('common.error'), t('profile.verificationFailed'));
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
      // Phone-only user with no email yet — take them to the add-email screen
      // instead of dead-ending on an error. (Only reachable for USERS; providers
      // always have an email, so this branch never fires for them.)
      navigation.navigate('Verification', { verificationType: 'email' });
      return;
    }

    setVerifyingEmail(true);
    try {
      const result = await sendEmailVerification();

      if (result.success) {
        dialog(
          t('profile.emailSent'),
          t('profile.emailSentMsg', { email: displayData.email })
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
              t('profile.emailAlreadySent'),
              `A verification email was recently sent to ${displayData.email}.\n\nPlease check your inbox (and spam folder). You can request another in ${timeStr}.`
            );
          } else {
            dialog(
              t('profile.emailAlreadySent'),
              `A verification email was recently sent to ${displayData.email}.\n\nPlease check your inbox (and spam folder) and wait a couple of minutes before requesting another.`
            );
          }
        } else {
          dialog(t('common.error'), getErrorMessage(result.error, t('profile.emailSendFail')));
        }
      }
    } catch (error) {
      dialog(t('common.error'), t('profile.emailSendFail'));
    } finally {
      setVerifyingEmail(false);
    }
  };

  /**
   * Upload image to Cloudinary (signed)
   */
  const uploadToCloudinary = async (imageUri) => {
    try {
      const result = await uploadProfilePicture(imageUri);
      return { success: true, url: result.url, publicId: result.publicId };
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

    const granted = await requestGalleryPermission(dialog);
    if (!granted) return;

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
        dialog(t('common.error'), t('profile.photoAccessFail'));
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.uri) {
        await handleProfilePictureUpload(asset.uri);
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

    const granted = await requestCameraPermission(dialog);
    if (!granted) return;

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
        dialog(t('common.error'), t('profile.photoAccessFail'));
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.uri) {
        await handleProfilePictureUpload(asset.uri);
      }
    } catch (error) {
      dialog('Error', 'Couldn\'t access your photos. Please check app permissions.');
    }
  };

  /**
   * Handle profile picture upload (pick → upload → save)
   */
  const handleProfilePictureUpload = async (imageUri) => {
    setUploadingPicture(true);
    
    try {
      // Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(imageUri);
      
      if (!uploadResult.success) {
        dialog(t('common.error'), t('profile.photoUploadFail'));
        return;
      }

      // Save to backend
      const saveResult = await saveProfilePictureToBackend(uploadResult.url, uploadResult.publicId);
      
      if (saveResult.success) {
        // Force refresh profile to get updated picture URL from backend
        const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
        if (userId) {
          await refreshProfile(userType, userId, { force: true });
        }
        dialog(t('common.success'), t('profile.photoUpdated'));
      } else {
        dialog(t('common.error'), t('profile.photoSaveFail'));
      }
    } catch (error) {
      dialog(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setUploadingPicture(false);
    }
  };

  // Show skeleton until profile data is available
  if (!profile || (isProfileLoading && !displayData?.fullName && !displayData?.email)) {
    return <ProfileSkeletonLoader insets={insets} onBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GraphBackground />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow_back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        {!isEditing ? (
          <TouchableOpacity style={styles.editButton} onPress={() => setEditingSection('identity')} activeOpacity={0.8}>
            <MaterialIcon name="edit" size={16} color="#FFFFFF" />
            <Text style={styles.editButtonText}>{t('profile.edit') || 'Edit'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.editButton, styles.editButtonCancel]}
            onPress={() => setEditingSection(null)}
            activeOpacity={0.8}
          >
            <MaterialIcon name="close" size={16} color="#FFFFFF" />
            <Text style={styles.cancelButtonText}>{t('profile.discard')}</Text>
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
          {/* ─── Modern Profile Card ─── */}
          <View style={styles.profileCard}>
            {/* Gradient-style banner with avatar overlapping */}
            <View style={[styles.profileCardHeader, isProvider ? styles.profileCardHeaderProvider : styles.profileCardHeaderUser]}>
              <View style={StyleSheet.absoluteFill}>
                <Svg width="100%" height="100%" viewBox="0 0 400 110" preserveAspectRatio="xMidYMid slice">
                  {/* Organic flowing curves */}
                  <Path d="M0 85 Q60 40 130 70 T260 50 T400 75" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" />
                  <Path d="M0 95 Q80 55 170 80 T340 60 T400 90" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />
                  <Path d="M0 70 Q50 30 120 55 T250 35 T400 60" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" fill="none" />
                  {/* Soft scattered circles */}
                  <Circle cx="340" cy="20" r="45" fill="rgba(255,255,255,0.06)" />
                  <Circle cx="370" cy="90" r="25" fill="rgba(255,255,255,0.05)" />
                  <Circle cx="50" cy="15" r="30" fill="rgba(255,255,255,0.04)" />
                  {/* Geometric accents */}
                  <Circle cx="280" cy="45" r="3" fill="rgba(255,255,255,0.15)" />
                  <Circle cx="100" cy="80" r="2.5" fill="rgba(255,255,255,0.12)" />
                  <Circle cx="200" cy="25" r="2" fill="rgba(255,255,255,0.1)" />
                </Svg>
              </View>
              {/* Type badge floating on banner */}
              <View style={styles.profileBannerBadge}>
                <Icon name={isProvider ? 'provider' : 'user'} size={11} color="#FFFFFF" />
                <Text style={styles.profileBannerBadgeText}>
                  {isProvider ? t('profile.serviceProvider') : t('profile.user')}
                </Text>
              </View>
            </View>

            {/* Avatar overlapping banner */}
            <View style={styles.profileAvatarWrap}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() => setShowImagePickerModal(true)}
                disabled={uploadingPicture}
              >
                <View style={[styles.avatarRing, isProvider && styles.avatarRingProvider]}>
                  {displayData?.profilePicture?.url ? (
                    <Image
                      source={{ uri: autoOrient(displayData.profilePicture.url) }}
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
                <View style={[styles.cameraIconOverlay, isProvider && styles.cameraIconOverlayProvider]}>
                  {uploadingPicture ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcon name="camera-alt" size={14} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Body — centered info */}
            <View style={styles.profileCardBody}>
              {/* Name + Pro badge */}
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName} numberOfLines={2} ellipsizeMode="tail">{displayData?.fullName || t('profile.userFallback')}</Text>
                {isProvider && !premiumLoaded && (
                  <SharedShimmerBlock width={55} height={22} borderRadius={11} shimmerAnim={shimmerAnim} />
                )}
                {isProvider && premiumLoaded && isPremiumActive && (
                  <View style={styles.proBadge}>
                    <MaterialIcon name="workspace-premium" size={14} color="#F59E0B" />
                    <Text style={styles.proBadgeText}>{t('profile.proBadge')}</Text>
                  </View>
                )}
              </View>

              {/* Contact info row */}
              <View style={styles.profileContactRow}>
                {displayData?.email ? (
                  <View style={styles.profileContactItem}>
                    <MaterialIcon name="mail-outline" size={14} color="#94A3B8" />
                    <Text style={styles.profileContactText} numberOfLines={1}>{displayData.email}</Text>
                  </View>
                ) : null}
                {displayData?.phone ? (
                  <View style={styles.profileContactItem}>
                    <MaterialIcon name="phone" size={14} color="#94A3B8" />
                    <Text style={styles.profileContactText} numberOfLines={1}>{displayData.phone}</Text>
                  </View>
                ) : null}
              </View>

              {/* Verification pills */}
              <View style={styles.verificationSummary}>
                <View style={[
                  styles.verificationItem,
                  displayData?.isPhoneVerified && styles.verificationItemVerified,
                ]}>
                  <Icon name="phone" size={13} color={displayData?.isPhoneVerified ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[
                    styles.verificationLabel,
                    displayData?.isPhoneVerified && styles.verificationLabelVerified
                  ]} numberOfLines={1}>
                    {displayData?.isPhoneVerified ? t('profile.phoneVerified') : t('profile.phoneUnverified')}
                  </Text>
                </View>
                <View style={[
                  styles.verificationItem,
                  displayData?.isEmailVerified && styles.verificationItemVerified,
                ]}>
                  <Icon name="email" size={13} color={displayData?.isEmailVerified ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[
                    styles.verificationLabel,
                    displayData?.isEmailVerified && styles.verificationLabelVerified
                  ]} numberOfLines={1}>
                    {displayData?.isEmailVerified ? t('profile.emailVerified') : t('profile.emailUnverified')}
                  </Text>
                </View>
                {isProvider && (
                  !aadhaarLoaded ? (
                    <SharedShimmerBlock width={65} height={28} borderRadius={14} shimmerAnim={shimmerAnim} />
                  ) : (
                    <View style={[
                      styles.verificationItem,
                      isAadhaarVerified && styles.verificationItemVerified,
                    ]}>
                      <Icon name="verified_user" size={13} color={isAadhaarVerified ? '#FFFFFF' : '#6B7280'} />
                      <Text style={[
                        styles.verificationLabel,
                        isAadhaarVerified && styles.verificationLabelVerified
                      ]} numberOfLines={1}>
                        {isAadhaarVerified ? t('profile.kycVerified') : t('profile.kycUnverified')}
                      </Text>
                    </View>
                  )
                )}
              </View>

              {!isVerified && (
                <View style={styles.verifyWarning}>
                  <Icon name="warning" size={15} color="#f67c16" />
                  <Text style={styles.verifyWarningText} numberOfLines={2} ellipsizeMode="tail">
                    {t('profile.verifyWarning')}
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
                <Text style={styles.imagePickerTitle}>{t('profile.profilePhoto')}</Text>

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
                      <Text style={styles.imagePickerOptionText}>{t('profile.viewPhoto')}</Text>
                      <Text style={styles.imagePickerOptionHint}>{t('profile.viewPhotoHint')}</Text>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.imagePickerOption} onPress={handleTakePhoto}>
                  <View style={[styles.imagePickerIconWrap, { backgroundColor: '#F0FDF4' }]}>
                    <MaterialIcon name="camera-alt" size={22} color="#16A34A" />
                  </View>
                  <View style={styles.imagePickerOptionContent}>
                    <Text style={styles.imagePickerOptionText}>{t('profile.takePhoto')}</Text>
                    <Text style={styles.imagePickerOptionHint}>{t('profile.takePhotoHint')}</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.imagePickerOption} onPress={handleSelectFromGallery}>
                  <View style={[styles.imagePickerIconWrap, { backgroundColor: '#FFF7ED' }]}>
                    <MaterialIcon name="photo-library" size={22} color="#EA580C" />
                  </View>
                  <View style={styles.imagePickerOptionContent}>
                    <Text style={styles.imagePickerOptionText}>{t('profile.chooseGallery')}</Text>
                    <Text style={styles.imagePickerOptionHint}>{t('profile.chooseGalleryHint')}</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.imagePickerCancelBtn}
                  onPress={() => setShowImagePickerModal(false)}
                >
                  <Text style={styles.imagePickerCancelText}>{t('common.cancel')}</Text>
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
                    aadhaarLoaded: true,
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
              <SectionHeader title={t('profile.editProfile')} />

              <EditableField
                label={t('profile.fullNameLabel')}
                value={formData.fullName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
                placeholder={t('profile.fullNamePlaceholder')}
                locked={isProvider && isNameLocked}
                lockedLabel={t('profile.locked')}
                lockMessage={isNameLocked ? `Verified as "${aadhaarName || formData.fullName}" via Aadhaar` : undefined}
              />

              <PhoneInput
                label={t('profile.phoneLabel')}
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
              />
              
              {/* Phone change warning */}
              {isProvider && formData.phone !== originalPhone && originalPhone.length > 0 && (
                <View style={styles.phoneChangeWarning}>
                  <MaterialIcon name="warning" size={16} color="#F59E0B" />
                  <Text style={styles.phoneChangeWarningText}>
                    {t('profile.phoneChangeWarning')}
                  </Text>
                </View>
              )}

              {/* === Location Section Header with Detect Button === */}
              <View style={styles.locationSectionHeader}>
                <Text style={styles.locationSectionTitle}>{t('profile.locationDetails')}</Text>
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
                    {detectingLocation ? t('profile.detectingLocation') : t('profile.detectMyLocation')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Address — Mapbox Geocoding powered search */}
              <AddressAutocomplete
                value={formData.address}
                label={t('profile.addressLabel')}
                placeholder={t('profile.addressPlaceholder')}
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
                    label={t('profile.cityLabel')}
                    placeholder={t('profile.cityPlaceholder')}
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
                  {/* Manual label + input to match CityAutocomplete layout exactly */}
                  <Text style={styles.fieldLabel}>{t('profile.pincodeLabel')}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formData.pincode}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, pincode: text }))}
                    placeholder={t('profile.pincodePlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    maxLength={6}
                  />
                </View>
              </View>
              
              {/* Service Categories - Provider Only (Read-only, managed via Document Verification) */}
              {isProvider && (
                <View style={styles.categoriesSection}>
                  <View style={styles.categoriesSectionHeader}>
                    <Text style={styles.fieldLabel}>{t('profile.verifiedCategories')}</Text>
                    <View style={styles.verifiedBadgeSmall}>
                      <Icon name="check_circle" size={14} color="#2b76bc" />
                    </View>
                  </View>
                  <Text style={styles.categoriesHint}>
                    {t('profile.categoriesHint')}
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
                      <Text style={styles.noCategoriesText}>{t('profile.noVerifiedServices')}</Text>
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={styles.documentVerificationLink}
                    onPress={() => navigation.navigate('DocumentVerification')}
                  >
                    <Icon name="document" size={18} color="#2b76bc" />
                    <Text style={styles.documentVerificationLinkText}>
                      {(displayData?.verifiedServiceCategories?.length > 0)
                        ? t('profile.addMoreServices')
                        : t('profile.getVerified')}
                    </Text>
                    <Icon name="arrow-forward" size={16} color="#2b76bc" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Experience - Provider Only — LinkedIn-style "Working since" picker */}
              {isProvider && (
                <View style={styles.fieldContainer}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>{t('experience.workingSince')}</Text>
                  </View>
                  <View style={styles.expPickerRow}>
                    <TouchableOpacity
                      style={styles.expPickerField}
                      onPress={() => setShowExperiencePicker(true)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcon name="work-history" size={18} color="#64748B" />
                      <Text
                        style={[
                          styles.expPickerText,
                          !experienceStartDate && styles.expPickerPlaceholder,
                        ]}
                      >
                        {experienceStartDate
                          ? formatMonthYear(experienceStartDate)
                          : (displayData?.experience && Number(displayData.experience) > 0
                              ? formatExperience(null, displayData.experience, t)
                              : t('experience.selectStartMonth'))}
                      </Text>
                    </TouchableOpacity>
                    {experienceStartDate && (
                      <TouchableOpacity
                        style={styles.expClearBtn}
                        onPress={() => setExperienceStartDate(null)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <MaterialIcon name="close" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {experienceStartDate ? (
                    <Text style={styles.expPreview}>
                      {t('experience.experiencePreview', {
                        exp: formatExperience(experienceStartDate, null, t),
                      })}
                    </Text>
                  ) : (
                    <Text style={styles.expHint}>{t('experience.experienceOptional')}</Text>
                  )}
                  {showExperiencePicker && (
                    <>
                      <DateTimePicker
                        value={experienceStartDate || new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                        onChange={handleExperienceDateChange}
                        minimumDate={minExperienceStartDate()}
                        maximumDate={new Date()}
                      />
                      {/* iOS spinner is inline and doesn't self-dismiss — give it a Done button. */}
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity
                          style={styles.expPickerDone}
                          onPress={() => setShowExperiencePicker(false)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.expPickerDoneText}>{t('common.done') || 'Done'}</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}
              
              {/* Phone & Email — not editable in this form; managed via the Verify flow.
                  For users this is tappable and opens the add/change-email screen. */}
              {!isProvider ? (
                <TouchableOpacity
                  style={styles.readOnlySection}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Verification', { verificationType: 'email' })}
                >
                  <Text style={styles.readOnlyNote}>
                    <Icon name="info" size={14} color="#6B7280" /> {t('profile.manageContactNote')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.readOnlySection}>
                  <Text style={styles.readOnlyNote}>
                    <Icon name="info" size={14} color="#6B7280" /> {t('profile.readOnlyNote')}
                  </Text>
                </View>
              )}

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
                    <Text style={styles.saveButtonText}>{t('profile.saveChanges')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.section}>
              <SectionHeader title={t('profile.personalInfo')} />

              <InfoRow
                iconName="user"
                label={t('profile.fullNameInfo')}
                value={displayData?.fullName}
              />

              <InfoRow
                iconName="location"
                label={t('profile.addressInfo')}
                value={displayData?.address || t('profile.notSet')}
              />

              <InfoRow
                iconName="location"
                label={t('profile.cityInfo')}
                value={displayData?.city || t('profile.notSet')}
              />

              <InfoRow
                iconName="location"
                label={t('profile.pincodeInfo')}
                value={displayData?.pincode || t('profile.notSet')}
              />
              
              {isProvider && (
                <>
                  {/* Service Categories */}
                  <View style={styles.serviceCategoriesDisplay}>
                    <View style={styles.infoRow}>
                      <View style={[styles.infoIconContainer, { backgroundColor: '#EFF6FF' }]}>
                        <MaterialIcon name="home-repair-service" size={20} color="#2b76bc" />
                      </View>
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>{t('profile.yourServices')}</Text>
                        
                        {/* Verified Services */}
                        {(displayData?.verifiedServiceCategories?.length > 0) && (
                          <>
                            <View style={styles.servicesLabelRow}>
                              <Icon name="verified" size={12} color="#2b76bc" />
                              <Text style={styles.servicesLabelVerified}>{t('profile.verifiedLabel')}</Text>
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
                              <Text style={styles.servicesLabelPending}>{t('profile.pendingApproval')}</Text>
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
                            <Text style={styles.getVerifiedButtonText}>{t('profile.getVerified')}</Text>
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
                            <Text style={styles.addMoreServicesText}>{t('profile.addMoreServices')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                  <InfoRow
                    iconName="star"
                    label={t('profile.ratingLabel')}
                    value={displayData?.rating ? t('profile.ratingValue', { rating: displayData.rating.toFixed(1) }) : t('profile.noRatings')}
                    iconColor="#F59E0B"
                    iconBg="#FFFBEB"
                  />
                  {(() => {
                    // LinkedIn-style: date wins, else legacy number, else hide the row cleanly
                    const expText = formatExperience(displayData?.experienceStartDate, displayData?.experience, t);
                    if (!expText) return null;
                    return (
                      <InfoRow
                        iconName="briefcase"
                        label={t('profile.experienceInfo')}
                        value={expText}
                        iconColor="#0891B2"
                        iconBg="#ECFEFF"
                        materialIcon="work-history"
                      />
                    );
                  })()}
                  
                  {/* Portfolio Section - Only for Photographer/Influencer */}
                  {(displayData?.verifiedServiceCategories?.includes('photographer') || 
                    displayData?.verifiedServiceCategories?.includes('influencer')) && (
                    <View style={styles.portfolioSection}>
                      <View style={styles.portfolioHeader}>
                        <View style={styles.portfolioIconContainer}>
                          <MaterialIcon name="collections" size={20} color="#7C3AED" />
                        </View>
                        <View style={styles.portfolioTitleContainer}>
                          <Text style={styles.portfolioTitle}>{t('profile.portfolioTitle')}</Text>
                          <Text style={styles.portfolioSubtitle}>
                            {t('profile.portfolioSubtitle')}
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
                              <Text style={styles.portfolioEditText}>{t('profile.editLinks')}</Text>
                            </View>
                          ) : (
                            <Text style={styles.portfolioAddText}>{t('profile.addPortfolioLinks')}</Text>
                          )}
                        </View>
                        <MaterialIcon name="chevron-right" size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                      
                      {/* Bio Preview */}
                      {displayData?.bio && (
                        <View style={styles.bioPreview}>
                          <Text style={styles.bioPreviewLabel}>{t('profile.bioLabel')}</Text>
                          <Text style={styles.bioPreviewText} numberOfLines={2}>
                            {displayData.bio}
                          </Text>
                        </View>
                      )}
                      
                      {/* Specializations Preview */}
                      {displayData?.specializations?.length > 0 && (
                        <View style={styles.specializationsPreview}>
                          <Text style={styles.specializationsLabel}>{t('profile.specializationsLabel')}</Text>
                          <View style={styles.specializationsChips}>
                            {displayData.specializations.slice(0, 3).map((spec, index) => (
                              <View key={index} style={styles.specializationChip}>
                                <Text style={styles.specializationChipText}>{spec}</Text>
                              </View>
                            ))}
                            {displayData.specializations.length > 3 && (
                              <Text style={styles.moreSpecializations}>
                                {t('profile.moreSpecializations', { n: displayData.specializations.length - 3 })}
                              </Text>
                            )}
                          </View>
                        </View>
                      )}

                      {/* Portfolio Gallery Preview */}
                      {displayData?.portfolioGallery?.length > 0 && (
                        <View style={styles.galleryPreviewSection}>
                          <Text style={styles.galleryPreviewLabel}>Gallery</Text>
                          <View style={styles.galleryPreviewGrid}>
                            {displayData.portfolioGallery.slice(0, 6).map((img, index) => {
                              const rawUri = typeof img === 'string' ? img : img?.url || img?.uri;
                              const uri = autoOrient(rawUri);
                              if (!uri) return null;
                              return (
                                <TouchableOpacity
                                  key={index}
                                  style={styles.galleryPreviewItem}
                                  onPress={() => { setGalleryViewerIndex(index); setGalleryViewerVisible(true); }}
                                  activeOpacity={0.8}
                                >
                                  <Image source={{ uri }} style={styles.galleryPreviewImage} />
                                  {index === 5 && displayData.portfolioGallery.length > 6 && (
                                    <View style={styles.galleryPreviewOverlay}>
                                      <Text style={styles.galleryPreviewOverlayText}>+{displayData.portfolioGallery.length - 6}</Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      <ImageViewerModal
                        visible={galleryViewerVisible}
                        images={displayData?.portfolioGallery || []}
                        initialIndex={galleryViewerIndex}
                        onClose={() => setGalleryViewerVisible(false)}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Verification Section — Users (below profile details) */}
          {!isProvider && (
            <View style={styles.section}>
              <SectionHeader title={t('profile.verification') || 'Verification'} />

              <InfoRow
                iconName="phone"
                label={t('profile.phoneLabel')}
                value={displayData?.phone || t('profile.notSet')}
                verified={displayData?.isPhoneVerified}
                onVerify={handlePhoneVerify}
                isLoading={verifyingPhone && !phoneOtpSent}
                otpSent={phoneOtpSent}
              />

              {/* Phone OTP Input — Modern 6-box design */}
              {phoneOtpSent && (
                <View style={styles.otpSectionModern}>
                  <Text style={styles.otpSectionLabel}>{t('profile.enterOtp')}</Text>
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
                            // SMS OTP autofill: iOS via textContentType, Android
                            // via autoComplete="sms-otp". First cell only —
                            // handleProfileOtpChange fans the pasted code across cells.
                            textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                            autoComplete={index === 0 && Platform.OS === 'android' ? 'sms-otp' : undefined}
                            importantForAutofill={index === 0 ? 'yes' : 'no'}
                          />
                        </Animated.View>
                      );
                    })}
                  </Animated.View>
                  {otpCountdown > 0 && (
                    <Text style={styles.otpTimerText}>
                      {t('profile.otpTimer', { time: `${Math.floor(otpCountdown / 60)}:${String(otpCountdown % 60).padStart(2, '0')}` })}
                    </Text>
                  )}
                  {otpCountdown <= 0 && phoneOtpSent && (
                    <View style={styles.otpExpiredRow}>
                      <Text style={styles.otpExpiredText}>{t('profile.otpExpiredText')}</Text>
                      <TouchableOpacity
                        style={styles.otpResendButton}
                        onPress={handlePhoneVerify}
                        disabled={verifyingPhone}
                        activeOpacity={0.7}
                      >
                        {verifyingPhone ? (
                          <ActivityIndicator size="small" color="#F59E0B" />
                        ) : (
                          <View style={styles.otpResendButtonContent}>
                            <MaterialIcon name="refresh" size={16} color="#F59E0B" />
                            <Text style={styles.otpResendButtonText}>{t('profile.resendOtp') || 'Resend OTP'}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                  {otpCountdown > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.otpVerifyButton,
                        (verifyingPhone || phoneOtp.join('').length !== 6) && styles.otpVerifyButtonDisabled,
                      ]}
                      onPress={handleVerifyPhoneOtp}
                      disabled={verifyingPhone || phoneOtp.join('').length !== 6}
                      activeOpacity={0.8}
                    >
                      {verifyingPhone ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <View style={styles.otpVerifyButtonContent}>
                          <MaterialIcon name="verified" size={18} color="#FFFFFF" />
                          <Text style={styles.otpVerifyButtonText}>{t('profile.verifyBtn')}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <InfoRow
                iconName="email"
                label={t('profile.emailLabel')}
                value={displayData?.email || t('profile.notSet')}
                verified={displayData?.isEmailVerified}
                onVerify={handleEmailVerify}
                isLoading={verifyingEmail}
              />
            </View>
          )}

          {/* Verification Section — Providers (below profile details) */}
          {isProvider && (
            <View style={styles.section}>
              <SectionHeader title={t('profile.verification') || 'Verification'} />

              <InfoRow
                iconName="phone"
                label={t('profile.phoneLabel')}
                value={displayData?.phone || t('profile.notSet')}
                verified={displayData?.isPhoneVerified}
                onVerify={handlePhoneVerify}
                isLoading={verifyingPhone && !phoneOtpSent}
                otpSent={phoneOtpSent}
              />

              {/* Phone OTP Input — Modern 6-box design */}
              {phoneOtpSent && (
                <View style={styles.otpSectionModern}>
                  <Text style={styles.otpSectionLabel}>{t('profile.enterOtp')}</Text>
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
                            // SMS OTP autofill: iOS via textContentType, Android
                            // via autoComplete="sms-otp". First cell only —
                            // the paste handler fans the code across the boxes.
                            textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                            autoComplete={index === 0 && Platform.OS === 'android' ? 'sms-otp' : undefined}
                            selectTextOnFocus
                          />
                        </Animated.View>
                      );
                    })}
                  </Animated.View>
                  {otpCountdown > 0 && (
                    <Text style={styles.otpTimerText}>
                      {t('profile.otpTimer', { time: `${Math.floor(otpCountdown / 60)}:${String(otpCountdown % 60).padStart(2, '0')}` })}
                    </Text>
                  )}
                  {otpCountdown <= 0 && phoneOtpSent && (
                    <View style={styles.otpExpiredRow}>
                      <Text style={styles.otpExpiredText}>{t('profile.otpExpiredText')}</Text>
                      <TouchableOpacity
                        style={styles.otpResendButton}
                        onPress={handlePhoneVerify}
                        disabled={verifyingPhone}
                        activeOpacity={0.7}
                      >
                        {verifyingPhone ? (
                          <ActivityIndicator size="small" color="#F59E0B" />
                        ) : (
                          <View style={styles.otpResendButtonContent}>
                            <MaterialIcon name="refresh" size={16} color="#F59E0B" />
                            <Text style={styles.otpResendButtonText}>{t('profile.resendOtp') || 'Resend OTP'}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                  {otpCountdown > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.otpVerifyButton,
                        (verifyingPhone || phoneOtp.join('').length !== 6) && styles.otpVerifyButtonDisabled,
                      ]}
                      onPress={handleVerifyPhoneOtp}
                      disabled={verifyingPhone || phoneOtp.join('').length !== 6}
                      activeOpacity={0.8}
                    >
                      {verifyingPhone ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <View style={styles.otpVerifyButtonContent}>
                          <MaterialIcon name="verified" size={18} color="#FFFFFF" />
                          <Text style={styles.otpVerifyButtonText}>{t('profile.verifyBtn')}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <InfoRow
                iconName="email"
                label={t('profile.emailLabel')}
                value={displayData?.email || t('profile.notSet')}
                verified={displayData?.isEmailVerified}
                onVerify={handleEmailVerify}
                isLoading={verifyingEmail}
              />

              {/* Aadhaar Verification - Providers Only */}
              {!aadhaarLoaded ? (
                <View style={[styles.infoRow, { gap: 12 }]}>
                  <SharedShimmerBlock width={36} height={36} borderRadius={18} shimmerAnim={shimmerAnim} />
                  <View style={{ gap: 6, flex: 1 }}>
                    <SharedShimmerBlock width={90} height={12} borderRadius={5} shimmerAnim={shimmerAnim} />
                    <SharedShimmerBlock width={140} height={14} borderRadius={6} shimmerAnim={shimmerAnim} />
                  </View>
                  <SharedShimmerBlock width={70} height={28} borderRadius={14} shimmerAnim={shimmerAnim} />
                </View>
              ) : (
                <>
                  <InfoRow
                    iconName="verified_user"
                    label={t('profile.aadhaarLabel')}
                    value={isAadhaarVerified
                      ? (aadhaarName ? t('profile.aadhaarVerifiedAs', { name: aadhaarName }) : t('profile.aadhaarVerified'))
                      : t('profile.aadhaarNotVerified')}
                    verified={isAadhaarVerified}
                    onVerify={() => setShowAadhaarModal(true)}
                    isLoading={false}
                  />

                  {/* Name locked notice after Aadhaar */}
                  {isNameLocked && (
                    <View style={styles.nameLockNotice}>
                      <MaterialIcon name="lock" size={14} color="#2b76bc" />
                      <Text style={styles.nameLockNoticeText}>
                        {t('profile.nameLockNotice')}
                      </Text>
                    </View>
                  )}

                  {/* Provider Aadhaar verification notice */}
                  {!isAadhaarVerified && (
                    <View style={styles.aadhaarNotice}>
                      <Icon name="warning" size={16} color="#f67c16" />
                      <Text style={styles.aadhaarNoticeText}>
                        {t('profile.aadhaarVerifyNotice')}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Saved Addresses Section */}
          {!isProvider && (
            <View style={styles.section}>
              <SectionHeader title={t('profile.savedAddresses') || 'Saved Addresses'} />
              <TouchableOpacity
                style={styles.addressesCard}
                onPress={() => setShowAddressesModal(true)}
                activeOpacity={0.7}
              >
                <View style={styles.addressesIconContainer}>
                  <MaterialIcon name="location-on" size={24} color="#2b76bc" />
                </View>
                <View style={styles.addressesContent}>
                  <Text style={styles.addressesTitle} numberOfLines={1} ellipsizeMode="tail">{t('profile.manageAddresses')}</Text>
                  <Text style={styles.addressesSubtitle} numberOfLines={2} ellipsizeMode="tail">
                    {t('profile.manageAddressesSub')}
                  </Text>
                </View>
                <MaterialIcon name="chevron-right" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          )}

          {/* Favorites Section */}
          {!isProvider && (
            <View style={styles.section}>
              <SectionHeader title={t('profile.myFavorites') || 'My Favorites'} />
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
                /* Shimmer skeleton while premium status loads */
                <View style={[styles.premiumCardLoading, { padding: 16, gap: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <SharedShimmerBlock width={44} height={44} borderRadius={22} shimmerAnim={shimmerAnim} />
                    <View style={{ gap: 6, flex: 1 }}>
                      <SharedShimmerBlock width={130} height={16} borderRadius={8} shimmerAnim={shimmerAnim} />
                      <SharedShimmerBlock width={180} height={12} borderRadius={6} shimmerAnim={shimmerAnim} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 }}>
                    <SharedShimmerBlock width={60} height={36} borderRadius={8} shimmerAnim={shimmerAnim} />
                    <SharedShimmerBlock width={60} height={36} borderRadius={8} shimmerAnim={shimmerAnim} />
                    <SharedShimmerBlock width={60} height={36} borderRadius={8} shimmerAnim={shimmerAnim} />
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
            <SectionHeader title={t('profile.accountSection') || 'Account'} />
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
    backgroundColor: '#F4F7FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.88)',
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#2b76bc',
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#2b76bc',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  editButtonCancel: {
    backgroundColor: '#EF4444',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  editButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  cancelButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 14,
    paddingTop: 12,
  },

  // Row fields for city/pincode
  rowFields: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  halfField: {
    flex: 1,
  },
  readOnlySection: {
    backgroundColor: 'rgba(248,250,252,0.7)',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  readOnlyNote: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 10 },
    }),
  },
  profileCardHeader: {
    height: 110,
    overflow: 'hidden',
    position: 'relative',
  },
  profileCardHeaderUser: {
    backgroundColor: '#2563EB',
  },
  profileCardHeaderProvider: {
    backgroundColor: '#EA580C',
  },
  // Old decor circles removed — replaced by SVG art in JSX
  _profileDecorLegacy: {
  },
  profileBannerBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  profileBannerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  profileAvatarWrap: {
    alignSelf: 'center',
    marginTop: -54,
    zIndex: 10,
    ...Platform.select({
      ios: {},
      android: { elevation: 10 },
    }),
    marginBottom: 4,
  },
  profileCardBody: {
    paddingTop: 4,
    paddingHorizontal: 22,
    paddingBottom: 22,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarRing: {
    overflow: 'hidden',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  avatarRingProvider: {
    borderColor: '#FFFFFF',
  },
  avatar: {
    overflow: 'hidden',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#2b76bc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    overflow: 'hidden',
    width: 104,
    height: 104,
    borderRadius: 52,
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
  profileContactRow: {
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginBottom: 16,
  },
  profileContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileContactText: {
    fontSize: 13,
    color: '#94A3B8',
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 0,
    marginTop: 6,
    maxWidth: '100%',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
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
  // typeBadge styles kept for backward compat (used elsewhere)
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
    overflow: 'hidden',
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
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.10,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.04)',
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
  otpSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    flexShrink: 0,
  },
  otpSentText: {
    fontSize: 11,
    color: '#D97706',
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
  otpExpiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  otpExpiredText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  otpResendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  otpResendButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  otpResendButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },

  // Editable Field
  fieldContainer: {
    marginBottom: 20,
  },
  // Experience "Working since" picker
  expPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expPickerField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  expPickerText: { fontSize: 15, color: '#111827', fontWeight: '500' },
  expPickerPlaceholder: { color: '#9CA3AF', fontWeight: '400' },
  expClearBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  expPreview: { fontSize: 13, color: '#0891B2', fontWeight: '600', marginTop: 8, marginLeft: 2 },
  expHint: { fontSize: 11, color: '#9CA3AF', marginTop: 6, marginLeft: 2, lineHeight: 16 },
  expPickerDone: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, marginTop: 4 },
  expPickerDoneText: { fontSize: 16, color: '#2563EB', fontWeight: '700' },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  fieldInput: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
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
    marginTop: 24,
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
    marginTop: 20,
    paddingTop: 20,
    marginBottom: 24,
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
    marginTop: 18,
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

  // Portfolio Gallery Preview
  galleryPreviewSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  galleryPreviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  galleryPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  galleryPreviewItem: {
    width: Math.floor((SCREEN_WIDTH - 28 - 36 - 12) / 3),
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  galleryPreviewImage: {
    width: '100%',
    height: '100%',
  },
  galleryPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  galleryPreviewOverlayText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Detect My Location
  locationSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 8,
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
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
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
    borderRadius: Platform.OS === 'ios' ? 20 : 22,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)',
      },
      android: { elevation: 6 },
    }),
  },
  premiumActiveHeader: {
    ...Platform.select({
      ios: {
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 18,
      },
      android: {
        backgroundColor: '#0F172A',
        paddingHorizontal: 22,
        paddingTop: 22,
        paddingBottom: 20,
      },
    }),
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
    width: Platform.OS === 'ios' ? 44 : 48,
    height: Platform.OS === 'ios' ? 44 : 48,
    borderRadius: Platform.OS === 'ios' ? 12 : 16,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        backgroundColor: 'rgba(52,199,89,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 14,
      },
      android: {
        backgroundColor: 'rgba(22,163,74,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
      },
    }),
    gap: 4,
  },
  premiumActiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Platform.OS === 'ios' ? '#34C759' : '#4ADE80',
    letterSpacing: Platform.OS === 'ios' ? 0.3 : 0.5,
  },
  premiumActiveTitle: {
    fontSize: Platform.OS === 'ios' ? 20 : 22,
    fontWeight: Platform.OS === 'ios' ? '700' : '800',
    color: '#FFFFFF',
    letterSpacing: Platform.OS === 'ios' ? -0.45 : -0.3,
  },
  premiumActiveSubtitle: {
    fontSize: 13,
    color: Platform.OS === 'ios' ? '#8E8E93' : '#94A3B8',
    marginTop: 4,
    letterSpacing: Platform.OS === 'ios' ? -0.08 : 0,
  },
  premiumStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        paddingVertical: 16,
        paddingHorizontal: 8,
        backgroundColor: '#FAFAFA',
      },
      android: {
        paddingVertical: 18,
        paddingHorizontal: 12,
      },
    }),
  },
  premiumStatItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  premiumStatValue: {
    fontSize: Platform.OS === 'ios' ? 24 : 26,
    fontWeight: Platform.OS === 'ios' ? '700' : '800',
    color: Platform.OS === 'ios' ? '#1C1C1E' : '#0F172A',
  },
  premiumStatLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Platform.OS === 'ios' ? '#8E8E93' : '#94A3B8',
    letterSpacing: Platform.OS === 'ios' ? -0.07 : 0.2,
  },
  premiumStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: Platform.OS === 'ios' ? '#C6C6C8' : '#E2E8F0',
  },
  premiumActiveFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'ios' ? 13 : 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Platform.OS === 'ios' ? '#C6C6C8' : '#F1F5F9',
    gap: 6,
  },
  premiumActiveFooterText: {
    fontSize: 14,
    fontWeight: '600',
    color: Platform.OS === 'ios' ? '#007AFF' : '#64748B',
    letterSpacing: Platform.OS === 'ios' ? -0.15 : 0,
  },
  premiumCardInactive: {
    borderRadius: Platform.OS === 'ios' ? 20 : 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#4338CA',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)',
      },
      android: { elevation: 6 },
    }),
  },
  premiumInactiveGradient: {
    backgroundColor: Platform.OS === 'ios' ? '#1C1C1E' : '#1E293B',
    paddingVertical: Platform.OS === 'ios' ? 28 : 32,
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
    fontSize: Platform.OS === 'ios' ? 24 : 26,
    fontWeight: Platform.OS === 'ios' ? '700' : '800',
    color: '#FFFFFF',
    marginTop: 14,
    letterSpacing: Platform.OS === 'ios' ? -0.45 : -0.3,
  },
  premiumInactiveSubtitle: {
    fontSize: 14,
    color: Platform.OS === 'ios' ? '#8E8E93' : '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    letterSpacing: Platform.OS === 'ios' ? -0.15 : 0,
  },
  premiumInactiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f67c16',
    paddingHorizontal: Platform.OS === 'ios' ? 24 : 28,
    paddingVertical: Platform.OS === 'ios' ? 13 : 14,
    borderRadius: Platform.OS === 'ios' ? 14 : 30,
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
    fontSize: Platform.OS === 'ios' ? 15 : 16,
    fontWeight: Platform.OS === 'ios' ? '600' : '700',
    color: '#FFFFFF',
    letterSpacing: Platform.OS === 'ios' ? -0.24 : 0,
  },
});

export default ProfileScreen;
