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
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useApp } from '../context/AppContext';
import { Icon, AadhaarVerificationModal } from '../components';
import { updateUserProfile, updateProviderProfile } from '../services/profileService';
import { SERVICE_CATEGORIES } from '../services/authService';
import { NODE_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';
import { 
  sendPhoneVerificationOtp,
  verifyPhoneOtp,
  sendEmailVerification,
} from '../services/authService';
import { getAadhaarStatus } from '../services/aadhaarService';
import { getVerificationDashboard } from '../services/verificationService';
import SavedAddresses from '../components/SavedAddresses';

// Cloudinary config
const CLOUDINARY_CLOUD_NAME = 'dj1aytbae';
const CLOUDINARY_UPLOAD_PRESET = 'fixhomi_documents';

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
 * Section Header
 */
const SectionHeader = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

/**
 * Info Row (Read-only)
 */
const InfoRow = ({ label, value, iconName, verified, onVerify, isLoading }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconContainer}>
      <Icon name={iconName} size={20} color="#6B7280" />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'Not set'}</Text>
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
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify</Text>
          )}
        </TouchableOpacity>
      )
    )}
  </View>
);

/**
 * Editable Field
 */
const EditableField = ({ label, value, onChangeText, placeholder, editable = true, locked = false, lockMessage, keyboardType = 'default', maxLength }) => (
  <View style={styles.fieldContainer}>
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
);

/**
 * Profile Screen Component
 */
const ProfileScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, userType, refreshVerificationStatus, refreshProfile } = useApp();
  
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
  
  // Provider service categories are now managed via Document Verification screen

  // Verification state
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState(Array(6).fill(''));
  const [otpFocusedIndex, setOtpFocusedIndex] = useState(-1);
  
  // OTP input refs & animations
  const otpInputRefs = useRef([]);
  const otpScaleAnims = useRef(Array(6).fill(null).map(() => new Animated.Value(1))).current;
  const otpShakeAnim = useRef(new Animated.Value(0)).current;
  
  // Saved Addresses state
  const [showAddressesModal, setShowAddressesModal] = useState(false);
  
  // Profile picture state
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  
  // Aadhaar verification state (providers only)
  const [showAadhaarModal, setShowAadhaarModal] = useState(false);
  const [isAadhaarVerified, setIsAadhaarVerified] = useState(false);
  const [isNameLocked, setIsNameLocked] = useState(false);
  const [aadhaarName, setAadhaarName] = useState(null);
  
  // Premium subscription state (providers only)
  const [isPremiumActive, setIsPremiumActive] = useState(false);
  const [premiumDaysLeft, setPremiumDaysLeft] = useState(0);
  
  // Track original phone to detect changes
  const [originalPhone, setOriginalPhone] = useState('');
  
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
    const phoneValue = displayData?.phone || displayData?.phoneNumber || '';
    setFormData({
      fullName: displayData?.fullName || '',
      phone: phoneValue,
      address: displayData?.address || '',
      city: displayData?.city || '',
      pincode: displayData?.pincode || '',
      experience: String(displayData?.experience || ''),
    });
    setOriginalPhone(phoneValue);
  }, [displayData?.fullName, displayData?.phone, displayData?.phoneNumber, displayData?.address, displayData?.city, displayData?.pincode, displayData?.experience]);

  // Fetch Aadhaar verification status and premium status for providers
  useEffect(() => {
    const fetchProviderStatus = async () => {
      if (isProvider) {
        try {
          const result = await getAadhaarStatus();
          if (result.success) {
            setIsAadhaarVerified(result.aadhaar?.isVerified || false);
            setIsNameLocked(result.aadhaar?.isNameLocked || false);
            setAadhaarName(result.aadhaar?.aadhaarName || null);
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
              setIsPremiumActive(dashResult.data.isPremiumActive || false);
              const premStep = dashResult.data.steps?.find(s => s.id === 'premium');
              setPremiumDaysLeft(premStep?.daysRemaining || 0);
            }
          }
        } catch (error) {
          console.log('Error fetching premium status:', error);
        }
      }
    };
    fetchProviderStatus();
  }, [isProvider]);

  /**
   * Handle refresh - fetch full profile from both Java Auth and MongoDB
   */
  const onRefresh = async () => {
    setRefreshing(true);
    const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    if (userId) {
      await refreshProfile(userType, userId);
    }
    await refreshVerificationStatus();
    
    // Refresh Aadhaar status for providers
    if (isProvider) {
      try {
        const result = await getAadhaarStatus();
        if (result.success) {
          setIsAadhaarVerified(result.aadhaar?.isVerified || false);
          setIsNameLocked(result.aadhaar?.isNameLocked || false);
          setAadhaarName(result.aadhaar?.aadhaarName || null);
        }
      } catch (error) {
        console.log('Error refreshing Aadhaar status:', error);
      }
      // Refresh premium status
      try {
        const pid = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
        if (pid) {
          const dashResult = await getVerificationDashboard(pid);
          if (dashResult.success && dashResult.data) {
            setIsPremiumActive(dashResult.data.isPremiumActive || false);
            const premStep = dashResult.data.steps?.find(s => s.id === 'premium');
            setPremiumDaysLeft(premStep?.daysRemaining || 0);
          }
        }
      } catch (error) {
        console.log('Error refreshing premium status:', error);
      }
    }
    
    setRefreshing(false);
  };

  /**
   * Handle save profile
   */
  const handleSave = async () => {
    const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    
    if (!userId) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    // Detect if phone number is being changed (for providers)
    const normalizePhone = (p) => (p || '').replace(/[\s\-+]/g, '').replace(/^91/, '').slice(-10);
    const phoneChanged = isProvider && 
      normalizePhone(formData.phone) !== normalizePhone(originalPhone) && 
      originalPhone.length > 0;
    
    // Warn user if phone is being changed — verification will reset
    if (phoneChanged) {
      return new Promise((resolve) => {
        Alert.alert(
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
      
      if (isProvider) {
        // For providers, update via provider profile endpoint
        // Note: serviceCategories are managed via Document Verification, not editable here
        result = await updateProviderProfile(userId, {
          name: formData.fullName,
          phone: formData.phone, // Include phone number
          address: formData.address,
          city: formData.city,
          pincode: formData.pincode,
          experience: formData.experience ? parseInt(formData.experience, 10) : undefined,
        });
      } else {
        // For users, use user profile endpoint (formData includes phone)
        result = await updateUserProfile(userId, formData);
      }
      
      if (result.success) {
        Alert.alert('Success', 'Profile updated successfully');
        setIsEditing(false);
        // Refresh profile data to reflect changes immediately
        await refreshProfile(userType, userId);
        await refreshVerificationStatus();
      } else {
        // Handle specific error codes from backend
        const errorCode = result.error?.code || result.error?.response?.data?.code;
        
        if (errorCode === 'PHONE_ALREADY_EXISTS') {
          Alert.alert(
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
          Alert.alert(
            'Update Conflict',
            result.error?.message || 'This information conflicts with another account. Please try different values.',
            [{ text: 'OK' }]
          );
        } else if (errorCode === 'NAME_LOCKED') {
          Alert.alert(
            'Name Locked',
            'Your name has been locked after Aadhaar verification and cannot be changed. This ensures your profile matches your verified identity.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', getErrorMessage(result.error, 'Failed to update profile'));
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle phone verification
   */
  const handlePhoneVerify = async () => {
    if (!displayData?.phone) {
      Alert.alert('Error', 'No phone number found. Please update your profile.');
      return;
    }

    setVerifyingPhone(true);
    try {
      const result = await sendPhoneVerificationOtp(displayData.phone);
      
      if (result.success) {
        setPhoneOtpSent(true);
        Alert.alert('OTP Sent', `Verification code sent to ${displayData.phone}`);
      } else {
        Alert.alert('Error', getErrorMessage(result.error, 'Failed to send OTP'));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send verification code');
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
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    setVerifyingPhone(true);
    try {
      // Java Auth only needs OTP - phone is extracted from JWT token
      const result = await verifyPhoneOtp(otpCode);
      
      if (result.success) {
        Alert.alert('Success', 'Phone number verified successfully!');
        setPhoneOtpSent(false);
        setPhoneOtp(Array(6).fill(''));
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
        Alert.alert('Error', getErrorMessage(result.error, 'Invalid OTP'));
      }
    } catch (error) {
      Alert.alert('Error', 'Verification failed');
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
      Alert.alert('Error', 'No email found');
      return;
    }

    setVerifyingEmail(true);
    try {
      const result = await sendEmailVerification();
      
      if (result.success) {
        Alert.alert(
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
            Alert.alert(
              '⏳ Email Already Sent',
              `A verification email was recently sent to ${displayData.email}.\n\nPlease check your inbox (and spam folder). You can request another in ${timeStr}.`
            );
          } else {
            Alert.alert(
              '⏳ Email Already Sent',
              `A verification email was recently sent to ${displayData.email}.\n\nPlease check your inbox (and spam folder) and wait a couple of minutes before requesting another.`
            );
          }
        } else {
          Alert.alert('Error', getErrorMessage(result.error, 'Failed to send verification email'));
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send verification email. Please try again.');
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
      const { accessToken } = await getTokens();
      const endpoint = isProvider 
        ? `${NODE_BASE_URL}/api/provider/profile-picture/${userId}`
        : `${NODE_BASE_URL}/api/user/profile-picture/${userId}`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
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
        Alert.alert('Error', result.errorMessage || 'Failed to select image');
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.uri) {
        await uploadProfilePicture(asset.uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
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
        Alert.alert('Error', result.errorMessage || 'Failed to take photo');
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.uri) {
        await uploadProfilePicture(asset.uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
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
        Alert.alert('Error', uploadResult.error || 'Failed to upload image');
        return;
      }

      // Save to backend
      const saveResult = await saveProfilePictureToBackend(uploadResult.url, uploadResult.publicId);
      
      if (saveResult.success) {
        Alert.alert('Success', 'Profile picture updated!');
        // Refresh profile
        const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
        if (userId) {
          await refreshProfile(userType, userId);
        }
      } else {
        Alert.alert('Error', saveResult.message || 'Failed to save profile picture');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setUploadingPicture(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header — Elevated with subtle gradient feel */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow_back" size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {!isEditing ? (
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
            <MaterialIcon name="edit" size={18} color="#2b76bc" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.editButton, styles.editButtonCancel]} 
            onPress={() => setIsEditing(false)}
          >
            <MaterialIcon name="close" size={18} color="#EF4444" />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card - Enhanced Layout */}
          <View style={styles.profileCard}>
            <View style={styles.profileTopRow}>
              {/* Profile Picture */}
              <TouchableOpacity 
                style={styles.avatarContainer}
                onPress={() => setShowImagePickerModal(true)}
                disabled={uploadingPicture}
              >
                {displayData?.profilePicture?.url ? (
                  <Image 
                    source={{ uri: displayData.profilePicture.url }} 
                    style={[styles.avatarImage, isProvider && styles.avatarImageProvider]}
                  />
                ) : (
                  <View style={[
                    styles.avatar,
                    isProvider && styles.avatarProvider,
                  ]}>
                    <Text style={styles.avatarText}>
                      {displayData?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                {/* Camera Icon Overlay */}
                <View style={styles.cameraIconOverlay}>
                  {uploadingPicture ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcon name="camera-alt" size={16} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>

              {/* Name and Type */}
              <View style={styles.profileInfoColumn}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.profileName}>{displayData?.fullName || 'User'}</Text>
                  {isProvider && isPremiumActive && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                      <MaterialIcon name="workspace-premium" size={14} color="#F59E0B" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#D97706', marginLeft: 3 }}>PRO</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.typeBadge, isProvider && styles.typeBadgeProvider]}>
                  <Icon name={isProvider ? 'provider' : 'user'} size={14} color={isProvider ? '#f67c16' : '#2b76bc'} />
                  <Text style={[styles.typeBadgeText, isProvider && styles.typeBadgeTextProvider]}>
                    {isProvider ? 'Service Provider' : 'User'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Verification Status Summary */}
            <View style={styles.verificationSummary}>
              <View style={[
                styles.verificationItem,
                displayData?.isPhoneVerified && styles.verificationItemVerified,
              ]}>
                <Icon name="phone" size={16} color={displayData?.isPhoneVerified ? '#2b76bc' : '#6B7280'} />
                <Text style={[
                  styles.verificationLabel,
                  displayData?.isPhoneVerified && styles.verificationLabelVerified
                ]}>
                  {displayData?.isPhoneVerified ? 'Phone ✓' : 'Phone'}
                </Text>
              </View>
              <View style={[
                styles.verificationItem,
                displayData?.isEmailVerified && styles.verificationItemVerified,
              ]}>
                <Icon name="email" size={16} color={displayData?.isEmailVerified ? '#2b76bc' : '#6B7280'} />
                <Text style={[
                  styles.verificationLabel,
                  displayData?.isEmailVerified && styles.verificationLabelVerified
                ]}>
                  {displayData?.isEmailVerified ? 'Email ✓' : 'Email'}
                </Text>
              </View>
              {/* Aadhaar badge for providers */}
              {isProvider && (
                <View style={[
                  styles.verificationItem,
                  isAadhaarVerified && styles.verificationItemVerified,
                ]}>
                  <Icon name="verified_user" size={16} color={isAadhaarVerified ? '#2b76bc' : '#6B7280'} />
                  <Text style={[
                    styles.verificationLabel,
                    isAadhaarVerified && styles.verificationLabelVerified
                  ]}>
                    {isAadhaarVerified ? 'KYC ✓' : 'KYC'}
                  </Text>
                </View>
              )}
            </View>

            {!isVerified && (
              <View style={styles.verifyWarning}>
                <Icon name="warning" size={16} color="#f67c16" />
                <Text style={styles.verifyWarningText}>
                  Please verify your phone and email to use all features
                </Text>
              </View>
            )}
          </View>

          {/* Image Picker Modal */}
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
              <View style={styles.imagePickerModal}>
                <Text style={styles.imagePickerTitle}>Change Profile Picture</Text>
                
                <TouchableOpacity style={styles.imagePickerOption} onPress={handleTakePhoto}>
                  <MaterialIcon name="camera-alt" size={24} color="#2b76bc" />
                  <Text style={styles.imagePickerOptionText}>Take Photo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.imagePickerOption} onPress={handleSelectFromGallery}>
                  <MaterialIcon name="photo-library" size={24} color="#2b76bc" />
                  <Text style={styles.imagePickerOptionText}>Choose from Gallery</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.imagePickerOption, styles.imagePickerCancel]}
                  onPress={() => setShowImagePickerModal(false)}
                >
                  <Text style={styles.imagePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Verification Section */}
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
                <TouchableOpacity 
                  style={[
                    styles.otpVerifyButton,
                    (verifyingPhone || phoneOtp.join('').length !== 6) && styles.otpVerifyButtonDisabled,
                  ]}
                  onPress={handleVerifyPhoneOtp}
                  disabled={verifyingPhone}
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
            {isProvider && (
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
            )}
            
            {/* Name locked notice after Aadhaar */}
            {isProvider && isNameLocked && (
              <View style={styles.nameLockNotice}>
                <MaterialIcon name="lock" size={14} color="#2b76bc" />
                <Text style={styles.nameLockNoticeText}>
                  Name locked after Aadhaar verification
                </Text>
              </View>
            )}
            
            {/* Provider Aadhaar verification notice */}
            {isProvider && !isAadhaarVerified && (
              <View style={styles.aadhaarNotice}>
                <Icon name="warning" size={16} color="#f67c16" />
                <Text style={styles.aadhaarNoticeText}>
                  Verify your Aadhaar to receive service requests
                </Text>
              </View>
            )}
          </View>
          
          {/* Aadhaar Verification Modal */}
          <AadhaarVerificationModal
            visible={showAadhaarModal}
            onClose={() => setShowAadhaarModal(false)}
            onVerified={async () => {
              // Immediately update UI optimistically
              setIsAadhaarVerified(true);
              setShowAadhaarModal(false);
              // Re-fetch from backend to get aadhaarName and lock status
              try {
                const result = await getAadhaarStatus();
                if (result.success) {
                  setIsAadhaarVerified(result.aadhaar?.isVerified || true);
                  setIsNameLocked(result.aadhaar?.isNameLocked || false);
                  setAadhaarName(result.aadhaar?.aadhaarName || null);
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

              <EditableField
                label="Phone Number"
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                placeholder="Enter your phone number (e.g., +91XXXXXXXXXX)"
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

              <EditableField
                label="Address"
                value={formData.address}
                onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
                placeholder="Enter your street address"
              />
              
              <View style={styles.rowFields}>
                <View style={styles.halfField}>
                  <EditableField
                    label="City"
                    value={formData.city}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, city: text }))}
                    placeholder="City"
                  />
                </View>
                <View style={styles.halfField}>
                  <EditableField
                    label="Pincode"
                    value={formData.pincode}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, pincode: text }))}
                    placeholder="Pincode"
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

          {/* Saved Addresses Section - Like Ola/Uber */}
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
                  <Text style={styles.addressesTitle}>Manage Addresses</Text>
                  <Text style={styles.addressesSubtitle}>
                    Add, edit or delete your saved addresses
                  </Text>
                </View>
                <MaterialIcon name="chevron-right" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Favorites Section - For Users */}
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
                  <Text style={styles.addressesTitle}>Saved Providers</Text>
                  <Text style={styles.addressesSubtitle}>
                    View and manage your favorite service providers
                  </Text>
                </View>
                <MaterialIcon name="chevron-right" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Premium Subscription Section - Providers Only */}
          {isProvider && (
            <View style={styles.section}>
              <SectionHeader title="Premium Subscription" />
              <TouchableOpacity 
                style={styles.addressesCard}
                onPress={() => navigation.navigate('Subscription')}
                activeOpacity={0.7}
              >
                <View style={[styles.addressesIconContainer, { backgroundColor: isPremiumActive ? '#ECFDF5' : '#FEF3C7' }]}>
                  <MaterialIcon name="workspace-premium" size={24} color={isPremiumActive ? '#10B981' : '#F59E0B'} />
                </View>
                <View style={styles.addressesContent}>
                  <Text style={styles.addressesTitle}>
                    {isPremiumActive ? 'Premium Active' : 'Go Premium'}
                  </Text>
                  <Text style={styles.addressesSubtitle}>
                    {isPremiumActive
                      ? `${premiumDaysLeft} day${premiumDaysLeft !== 1 ? 's' : ''} remaining · Visible in all searches`
                      : 'Get priority listing & reach more customers'
                    }
                  </Text>
                </View>
                <MaterialIcon name="chevron-right" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Account Info */}
          <View style={styles.section}>
            <SectionHeader title="Account" />
            <InfoRow
              iconName="user"
              label="User ID"
              value={displayData?.javaUserId?.toString() || displayData?.mongoId?.slice(-8) || 'N/A'}
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
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
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
  },
  editButtonCancel: {
    backgroundColor: '#FEF2F2',
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
  },
  halfField: {
    flex: 1,
  },
  readOnlySection: {
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 10,
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

  // Profile Card — Modern elevated design
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: '#2b76bc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#2b76bc',
  },
  avatarImageProvider: {
    borderColor: '#f67c16',
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#2b76bc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  profileInfoColumn: {
    marginLeft: 18,
    flex: 1,
  },
  avatarProvider: {
    backgroundColor: '#f67c16',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  typeBadgeProvider: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2b76bc',
  },
  typeBadgeTextProvider: {
    color: '#f67c16',
  },
  // Image Picker Modal — Bottom sheet style
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  imagePickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  imagePickerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 22,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 16,
  },
  imagePickerOptionText: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '600',
  },
  imagePickerCancel: {
    justifyContent: 'center',
    borderBottomWidth: 0,
    marginTop: 8,
  },
  imagePickerCancelText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '700',
    textAlign: 'center',
  },
  verificationSummary: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  verificationItemVerified: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  verificationLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  verificationLabelVerified: {
    color: '#2b76bc',
  },
  verifyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  verifyWarningText: {
    flex: 1,
    fontSize: 13,
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
    borderRadius: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f67c16',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  aadhaarNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#9A3412',
    fontWeight: '500',
    lineHeight: 18,
  },

  // Section — Elevated card design
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Info Row — Better spacing and visual weight
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 3,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  verifiedText: {
    fontSize: 12,
    color: '#2b76bc',
    fontWeight: '700',
  },
  verifyButton: {
    backgroundColor: '#f67c16',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 75,
    alignItems: 'center',
    shadowColor: '#f67c16',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  verifyButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // OTP Section — Modern 6-box design
  otpSectionModern: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    marginTop: -4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  otpSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  otpBoxWrapper: {
    width: 44,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxWrapperFilled: {
    borderColor: '#2b76bc',
    backgroundColor: '#EFF6FF',
    shadowColor: '#2b76bc',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  otpBoxWrapperFocused: {
    borderColor: '#f67c16',
    backgroundColor: '#FFFBF5',
    shadowColor: '#f67c16',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
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
    borderRadius: 12,
    paddingVertical: 13,
    marginHorizontal: 12,
    shadowColor: '#f67c16',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  otpVerifyButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
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

  // Editable Field — Cleaner inputs
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
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
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
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: -8,
    gap: 8,
  },
  phoneChangeWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  nameLockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: -4,
    marginBottom: 8,
    marginLeft: 44,
    gap: 6,
  },
  nameLockNoticeText: {
    fontSize: 12,
    color: '#2b76bc',
    fontWeight: '500',
  },

  // Save Button — Premium look
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f67c16',
    height: 54,
    borderRadius: 14,
    marginTop: 16,
    shadowColor: '#f67c16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  
  // Service Categories Styles
  categoriesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
    color: '#6B7280',
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
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  documentVerificationLinkText: {
    flex: 1,
    fontSize: 14,
    color: '#2b76bc',
    fontWeight: '600',
  },
  noCategoriesWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  noCategoriesText: {
    fontSize: 13,
    color: '#6B7280',
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
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
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
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
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
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
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
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  servicesLabelPending: {
    fontSize: 11,
    color: '#f67c16',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  addMoreServicesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
    borderRadius: 8,
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
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  getVerifiedButtonText: {
    fontSize: 13,
    color: '#2b76bc',
    fontWeight: '600',
  },
  
  // Saved Addresses Card — Modern actionable card
  addressesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FAFBFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  addressesIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  addressesContent: {
    flex: 1,
  },
  addressesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  addressesSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  
  // Portfolio Section Styles
  portfolioSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  portfolioHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  portfolioIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontWeight: '600',
    color: '#1F2937',
  },
  portfolioSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  portfolioEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  portfolioEditText: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '600',
    marginLeft: 4,
  },
  portfolioAddText: {
    fontSize: 13,
    color: '#6B7280',
  },
  bioPreview: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  bioPreviewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
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
    fontWeight: '600',
    color: '#9CA3AF',
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  specializationChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7C3AED',
  },
  moreSpecializations: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});

export default ProfileScreen;
