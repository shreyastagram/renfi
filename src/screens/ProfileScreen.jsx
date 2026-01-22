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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { Icon } from '../components';
import { updateUserProfile, updateProviderProfile } from '../services/profileService';
import { SERVICE_CATEGORIES } from '../services/authService';
import { 
  sendPhoneVerificationOtp,
  verifyPhoneOtp,
  sendEmailVerification,
} from '../services/authService';
import SavedAddresses from '../components/SavedAddresses';

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
const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, userType, refreshVerificationStatus, refreshProfile } = useApp();

  // State
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit form state
  const [formData, setFormData] = useState({
    fullName: '',
    address: '',
    city: '',
    pincode: '',
    experience: '',
  });
  
  // Provider service categories state
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Verification state
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  
  // Saved Addresses state
  const [showAddressesModal, setShowAddressesModal] = useState(false);

  // Combined user data
  const displayData = { ...user, ...profile };
  const isProvider = userType === 'provider';
  const isVerified = displayData?.isPhoneVerified && displayData?.isEmailVerified;

  // Initialize form data
  useEffect(() => {
    setFormData({
      fullName: displayData?.fullName || '',
      address: displayData?.address || '',
      city: displayData?.city || '',
      pincode: displayData?.pincode || '',
      experience: displayData?.experience || '',
    });
    // Initialize service categories for providers
    if (isProvider && displayData?.serviceCategories) {
      setSelectedCategories(displayData.serviceCategories);
    }
  }, [displayData?.fullName, displayData?.address, displayData?.city, displayData?.pincode, displayData?.experience, displayData?.serviceCategories, isProvider]);

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
        result = await updateProviderProfile(userId, {
          name: formData.fullName,
          serviceCategories: selectedCategories,
          address: formData.address,
          city: formData.city,
          pincode: formData.pincode,
          experience: formData.experience,
        });
      } else {
        // For users, use user profile endpoint
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
   * Toggle service category selection
   */
  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
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
            <Icon name="edit" size={20} color="#2563EB" />
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
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={[
              styles.avatar,
              isProvider && styles.avatarProvider,
            ]}>
              <Text style={styles.avatarText}>
                {displayData?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.profileName}>{displayData?.fullName || 'User'}</Text>
            <View style={[styles.typeBadge, isProvider && styles.typeBadgeProvider]}>
              <Icon name={isProvider ? 'provider' : 'user'} size={16} color={isProvider ? '#7C3AED' : '#2563EB'} />
              <Text style={[styles.typeBadgeText, isProvider && styles.typeBadgeTextProvider]}>
                {isProvider ? 'Service Provider' : 'User'}
              </Text>
            </View>

            {/* Verification Status Summary */}
            <View style={styles.verificationSummary}>
              <View style={[
                styles.verificationItem,
                displayData?.isPhoneVerified && styles.verificationItemVerified,
              ]}>
                <Icon name="phone" size={16} color={displayData?.isPhoneVerified ? '#10B981' : '#6B7280'} />
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
                <Icon name="email" size={16} color={displayData?.isEmailVerified ? '#10B981' : '#6B7280'} />
                <Text style={[
                  styles.verificationLabel,
                  displayData?.isEmailVerified && styles.verificationLabelVerified
                ]}>
                  {displayData?.isEmailVerified ? 'Email ✓' : 'Email'}
                </Text>
              </View>
            </View>

            {!isVerified && (
              <View style={styles.verifyWarning}>
                <Icon name="warning" size={16} color="#F59E0B" />
                <Text style={styles.verifyWarningText}>
                  Please verify your phone and email to use all features
                </Text>
              </View>
            )}
          </View>

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
          </View>

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
              
              {/* Service Categories - Provider Only */}
              {isProvider && (
                <View style={styles.categoriesSection}>
                  <Text style={styles.fieldLabel}>Service Categories</Text>
                  <Text style={styles.categoriesHint}>Select the services you provide</Text>
                  
                  <View style={styles.categoriesGrid}>
                    {SERVICE_CATEGORIES.map((category) => {
                      const isSelected = selectedCategories.includes(category.id);
                      return (
                        <TouchableOpacity
                          key={category.id}
                          style={[
                            styles.categoryChip,
                            isSelected && styles.categoryChipSelected,
                          ]}
                          onPress={() => toggleCategory(category.id)}
                        >
                          <Icon 
                            name={isSelected ? 'check' : 'add'} 
                            size={16} 
                            color={isSelected ? '#FFFFFF' : '#6B7280'} 
                          />
                          <Text style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextSelected,
                          ]}>
                            {category.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  
                  {selectedCategories.length === 0 && (
                    <View style={styles.noCategoriesWarning}>
                      <Icon name="warning" size={16} color="#F59E0B" />
                      <Text style={styles.noCategoriesText}>
                        Please select at least one service category
                      </Text>
                    </View>
                  )}
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
                        <Text style={styles.infoLabel}>Service Categories</Text>
                        {displayData?.serviceCategories?.length > 0 ? (
                          <View style={styles.categoriesDisplayGrid}>
                            {displayData.serviceCategories.map((catId) => {
                              const category = SERVICE_CATEGORIES.find(c => c.id === catId);
                              return (
                                <View key={catId} style={styles.categoryDisplayChip}>
                                  <Text style={styles.categoryDisplayText}>
                                    {category?.label || catId}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        ) : (
                          <Text style={styles.infoValue}>No services set - tap Edit to add</Text>
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
                  <MaterialIcon name="location-on" size={24} color="#3B82F6" />
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
    color: '#2563EB',
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
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarProvider: {
    backgroundColor: '#7C3AED',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 16,
  },
  typeBadgeProvider: {
    backgroundColor: '#EDE9FE',
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  typeBadgeTextProvider: {
    color: '#7C3AED',
  },
  verificationSummary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  verificationItemVerified: {
    backgroundColor: '#D1FAE5',
  },
  verificationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  verificationLabelVerified: {
    color: '#059669',
  },
  verifyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  verifyWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
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
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  verifyButton: {
    backgroundColor: '#2563EB',
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
    backgroundColor: '#10B981',
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
    backgroundColor: '#2563EB',
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
  categoryChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#4B5563',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  noCategoriesWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  noCategoriesText: {
    fontSize: 13,
    color: '#B45309',
  },
  
  // Service Categories Display (View Mode)
  serviceCategoriesDisplay: {
    marginBottom: 0,
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
    backgroundColor: '#DBEAFE',
  },
  categoryDisplayText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '500',
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
