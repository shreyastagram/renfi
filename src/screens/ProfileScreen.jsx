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

import React, { useState, useCallback, useEffect } from 'react';
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
  cleaning: 'Cleaning',
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
const EditableField = ({ label, value, onChangeText, placeholder, editable = true }) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.fieldInput, !editable && styles.fieldInputDisabled]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      editable={editable}
    />
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
  const [phoneOtp, setPhoneOtp] = useState('');
  
  // Saved Addresses state
  const [showAddressesModal, setShowAddressesModal] = useState(false);
  
  // Profile picture state
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  
  // Aadhaar verification state (providers only)
  const [showAadhaarModal, setShowAadhaarModal] = useState(false);
  const [isAadhaarVerified, setIsAadhaarVerified] = useState(false);
  
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
    setFormData({
      fullName: displayData?.fullName || '',
      phone: displayData?.phone || displayData?.phoneNumber || '',
      address: displayData?.address || '',
      city: displayData?.city || '',
      pincode: displayData?.pincode || '',
      experience: displayData?.experience || '',
    });
  }, [displayData?.fullName, displayData?.phone, displayData?.phoneNumber, displayData?.address, displayData?.city, displayData?.pincode, displayData?.experience]);

  // Fetch Aadhaar verification status for providers
  useEffect(() => {
    const fetchAadhaarStatus = async () => {
      if (isProvider) {
        try {
          const result = await getAadhaarStatus();
          if (result.success) {
            setIsAadhaarVerified(result.aadhaar?.isVerified || false);
          }
        } catch (error) {
          console.log('Error fetching Aadhaar status:', error);
        }
      }
    };
    fetchAadhaarStatus();
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
        }
      } catch (error) {
        console.log('Error refreshing Aadhaar status:', error);
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
          experience: formData.experience,
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
        Alert.alert('Error', getErrorMessage(result.error, 'Failed to update profile'));
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
    if (phoneOtp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    setVerifyingPhone(true);
    try {
      // Java Auth only needs OTP - phone is extracted from JWT token
      const result = await verifyPhoneOtp(phoneOtp);
      
      if (result.success) {
        Alert.alert('Success', 'Phone number verified successfully!');
        setPhoneOtpSent(false);
        setPhoneOtp('');
        await refreshVerificationStatus();
      } else {
        Alert.alert('Error', getErrorMessage(result.error, 'Invalid OTP'));
      }
    } catch (error) {
      Alert.alert('Error', 'Verification failed');
    } finally {
      setVerifyingPhone(false);
    }
  };

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
          'Verification Email Sent',
          `Please check your email at ${displayData.email} and click the verification link.`
        );
      } else {
        Alert.alert('Error', getErrorMessage(result.error, 'Failed to send verification email'));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send verification email');
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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow_back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {!isEditing ? (
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
            <Icon name="edit" size={20} color="#2b76bc" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => setIsEditing(false)}
          >
            <Icon name="close" size={20} color="#EF4444" />
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
                <Text style={styles.profileName}>{displayData?.fullName || 'User'}</Text>
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

            {/* Phone OTP Input */}
            {phoneOtpSent && (
              <View style={styles.otpSection}>
                <TextInput
                  style={styles.otpInput}
                  value={phoneOtp}
                  onChangeText={setPhoneOtp}
                  placeholder="Enter 6-digit OTP"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity 
                  style={styles.otpButton}
                  onPress={handleVerifyPhoneOtp}
                  disabled={verifyingPhone}
                >
                  {verifyingPhone ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.otpButtonText}>Verify</Text>
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
                value={isAadhaarVerified ? 'Identity Verified' : 'Not Verified'}
                verified={isAadhaarVerified}
                onVerify={() => setShowAadhaarModal(true)}
                isLoading={false}
              />
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
            onVerified={() => {
              setIsAadhaarVerified(true);
              setShowAadhaarModal(false);
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
              />

              <EditableField
                label="Phone Number"
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                placeholder="Enter your phone number (e.g., +91XXXXXXXXXX)"
              />

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
                  onChangeText={(text) => setFormData(prev => ({ ...prev, experience: text }))}
                  placeholder="e.g., 5 years"
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
                    value={displayData?.experience || 'Not set'}
                  />
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
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editButtonText: {
    fontSize: 15,
    color: '#2b76bc',
    fontWeight: '600',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#EF4444',
    fontWeight: '600',
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
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  readOnlyNote: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2b76bc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#2b76bc',
  },
  avatarImageProvider: {
    borderColor: '#f67c16',
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2b76bc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfoColumn: {
    marginLeft: 16,
    flex: 1,
  },
  avatarProvider: {
    backgroundColor: '#f67c16',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeBadgeProvider: {
    backgroundColor: '#FFF7ED',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2b76bc',
  },
  typeBadgeTextProvider: {
    color: '#f67c16',
  },
  // Image Picker Modal
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  imagePickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  imagePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 16,
  },
  imagePickerOptionText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  imagePickerCancel: {
    justifyContent: 'center',
    borderBottomWidth: 0,
    marginTop: 8,
  },
  imagePickerCancelText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
    textAlign: 'center',
  },
  verificationSummary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  verificationItemVerified: {
    backgroundColor: '#EFF6FF',
  },
  verificationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  verificationLabelVerified: {
    color: '#2b76bc',
  },
  verifyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  verifyWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#f67c16',
  },
  aadhaarNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f67c16',
  },
  aadhaarNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#78350F',
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

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 12,
    color: '#2b76bc',
    fontWeight: '600',
  },
  verifyButton: {
    backgroundColor: '#f67c16',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  verifyButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // OTP Section
  otpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  otpInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    letterSpacing: 4,
    textAlign: 'center',
  },
  otpButton: {
    backgroundColor: '#f67c16',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  otpButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Editable Field
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  fieldInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  fieldInputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },

  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f67c16',
    height: 52,
    borderRadius: 12,
    marginTop: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
  
  // Saved Addresses Card
  addressesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressesIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addressesContent: {
    flex: 1,
  },
  addressesTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  addressesSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
});

export default ProfileScreen;
