/**
 * Portfolio Edit Screen
 * 
 * Allows photographers and influencers to edit their:
 * - Bio/About section
 * - Portfolio links (social media, website)
 * - Specializations
 * - Portfolio gallery
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { updateProviderProfile } from '../services/profileService';
import { NODE_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';

// Cloudinary config
const CLOUDINARY_CLOUD_NAME = 'dj1aytbae';
const CLOUDINARY_UPLOAD_PRESET = 'fixhomi_documents';

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  purple: '#7C3AED',
  background: '#F9FAFB',
  white: '#FFFFFF',
  success: '#10B981',
};

// Social media platforms configuration
const PLATFORMS = [
  { 
    id: 'website', 
    label: 'Website', 
    icon: 'language', 
    color: '#0284C7',
    bgColor: '#E0F2FE',
    placeholder: 'https://yourwebsite.com',
  },
  { 
    id: 'instagram', 
    label: 'Instagram', 
    icon: 'camera-alt', 
    color: '#DB2777',
    bgColor: '#FCE7F3',
    placeholder: 'https://instagram.com/yourusername',
  },
  { 
    id: 'youtube', 
    label: 'YouTube', 
    icon: 'play-circle-filled', 
    color: '#DC2626',
    bgColor: '#FEE2E2',
    placeholder: 'https://youtube.com/c/yourchannel',
  },
  { 
    id: 'facebook', 
    label: 'Facebook', 
    icon: 'facebook', 
    color: '#2563EB',
    bgColor: '#DBEAFE',
    placeholder: 'https://facebook.com/yourpage',
  },
  { 
    id: 'tiktok', 
    label: 'TikTok', 
    icon: 'music-note', 
    color: '#7C3AED',
    bgColor: '#F3E8FF',
    placeholder: 'https://tiktok.com/@yourusername',
  },
  { 
    id: 'twitter', 
    label: 'Twitter/X', 
    icon: 'alternate-email', 
    color: '#0EA5E9',
    bgColor: '#E0F7FA',
    placeholder: 'https://twitter.com/yourusername',
  },
];

// Suggested specializations
const SUGGESTED_SPECIALIZATIONS = {
  photographer: [
    'Wedding Photography',
    'Portrait Photography',
    'Event Photography',
    'Product Photography',
    'Fashion Photography',
    'Food Photography',
    'Real Estate Photography',
    'Sports Photography',
    'Wildlife Photography',
    'Landscape Photography',
    'Corporate Photography',
    'Newborn Photography',
  ],
  influencer: [
    'Lifestyle',
    'Fashion & Beauty',
    'Food & Travel',
    'Tech Reviews',
    'Fitness & Health',
    'Gaming',
    'Education',
    'Entertainment',
    'Business & Finance',
    'Home & DIY',
    'Parenting',
    'Vlogs',
  ],
};

/**
 * Link Input Component
 */
const LinkInput = ({ platform, value, onChange }) => {
  const { dialog } = useDialog();
  return (
  <View style={styles.linkInputContainer}>
    <View style={[styles.linkIconContainer, { backgroundColor: platform.bgColor }]}>
      <MaterialIcon name={platform.icon} size={22} color={platform.color} />
    </View>
    <View style={styles.linkInputWrapper}>
      <Text style={styles.linkLabel}>{platform.label}</Text>
      <TextInput
        style={styles.linkInput}
        value={value}
        onChangeText={onChange}
        placeholder={platform.placeholder}
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
    </View>
    {value ? (
      <TouchableOpacity 
        style={styles.linkTestButton}
        onPress={() => {
          let url = value;
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          Linking.openURL(url).catch(() => {
            dialog('Invalid URL', 'Please check the URL format');
          });
        }}
      >
        <MaterialIcon name="open-in-new" size={18} color={platform.color} />
      </TouchableOpacity>
    ) : null}
  </View>
  );
};

/**
 * Specialization Chip Component
 */
const SpecializationChip = ({ label, selected, onToggle }) => (
  <TouchableOpacity
    style={[styles.specChip, selected && styles.specChipSelected]}
    onPress={onToggle}
    activeOpacity={0.7}
  >
    <Text style={[styles.specChipText, selected && styles.specChipTextSelected]}>
      {label}
    </Text>
    {selected && (
      <MaterialIcon name="check" size={14} color={BRAND.white} />
    )}
  </TouchableOpacity>
);

/**
 * Gallery Image Component
 */
const GalleryImage = ({ image, onRemove }) => (
  <View style={styles.galleryImageWrapper}>
    <Image 
      source={{ uri: image.url || image }} 
      style={styles.galleryImage}
      resizeMode="cover"
    />
    <TouchableOpacity style={styles.removeImageButton} onPress={onRemove}>
      <MaterialIcon name="close" size={16} color={BRAND.white} />
    </TouchableOpacity>
  </View>
);

const PortfolioEditScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useApp();
  const { dialog } = useDialog();

  // Determine service type
  const isPhotographer = profile?.verifiedServiceCategories?.includes('photographer');
  const isInfluencer = profile?.verifiedServiceCategories?.includes('influencer');
  const serviceType = isPhotographer ? 'photographer' : 'influencer';

  // State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state
  const [bio, setBio] = useState('');
  const [portfolioLinks, setPortfolioLinks] = useState({
    website: '',
    instagram: '',
    youtube: '',
    facebook: '',
    tiktok: '',
    twitter: '',
  });
  const [specializations, setSpecializations] = useState([]);
  const [customSpecialization, setCustomSpecialization] = useState('');
  const [portfolioGallery, setPortfolioGallery] = useState([]);

  // Initialize form with existing data
  useEffect(() => {
    if (profile) {
      setBio(profile.bio || '');
      setPortfolioLinks({
        website: profile.portfolioLinks?.website || '',
        instagram: profile.portfolioLinks?.instagram || '',
        youtube: profile.portfolioLinks?.youtube || '',
        facebook: profile.portfolioLinks?.facebook || '',
        tiktok: profile.portfolioLinks?.tiktok || '',
        twitter: profile.portfolioLinks?.twitter || '',
      });
      setSpecializations(profile.specializations || []);
      setPortfolioGallery(profile.portfolioGallery || []);
    }
  }, [profile]);

  const handleLinkChange = (platformId, value) => {
    setPortfolioLinks(prev => ({
      ...prev,
      [platformId]: value,
    }));
  };

  const toggleSpecialization = (spec) => {
    setSpecializations(prev => {
      if (prev.includes(spec)) {
        return prev.filter(s => s !== spec);
      } else {
        return [...prev, spec];
      }
    });
  };

  const addCustomSpecialization = () => {
    const trimmed = customSpecialization.trim();
    if (trimmed && !specializations.includes(trimmed)) {
      setSpecializations(prev => [...prev, trimmed]);
      setCustomSpecialization('');
    }
  };

  const uploadImageToCloudinary = async (imageUri) => {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'portfolio_image.jpg',
    });
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'fixhomi/portfolio');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();
    if (data.secure_url) {
      return {
        url: data.secure_url,
        publicId: data.public_id,
      };
    }
    throw new Error('Failed to upload image');
  };

  const handleAddGalleryImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
      });

      if (result.didCancel || !result.assets?.[0]?.uri) return;

      setUploadingImage(true);
      const uploaded = await uploadImageToCloudinary(result.assets[0].uri);
      setPortfolioGallery(prev => [...prev, uploaded]);
    } catch (error) {
      console.error('Error uploading image:', error);
      dialog('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveGalleryImage = (index) => {
    dialog(
      'Remove Image',
      'Are you sure you want to remove this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setPortfolioGallery(prev => prev.filter((_, i) => i !== index));
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updateData = {
        bio: bio.trim(),
        portfolioLinks,
        specializations,
        portfolioGallery,
      };

      const result = await updateProviderProfile(profile._id || profile.mongoId, updateData);

      if (result.success) {
        await refreshProfile();
        dialog('Success', 'Portfolio updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        dialog('Error', result.error || 'Failed to update portfolio');
      }
    } catch (error) {
      console.error('Error saving portfolio:', error);
      dialog('Error', 'Failed to save portfolio. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const suggestedSpecs = SUGGESTED_SPECIALIZATIONS[serviceType] || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcon name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Portfolio</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={BRAND.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Bio Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcon name="person" size={20} color={BRAND.purple} />
              <Text style={styles.sectionTitle}>About You</Text>
            </View>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell clients about yourself, your experience, and what makes you unique..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.charCount}>{bio.length}/500</Text>
          </View>

          {/* Portfolio Links Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcon name="link" size={20} color={BRAND.purple} />
              <Text style={styles.sectionTitle}>Portfolio Links</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Add your social media and portfolio links to help clients find your work
            </Text>
            <View style={styles.linksContainer}>
              {PLATFORMS.map((platform) => (
                <LinkInput
                  key={platform.id}
                  platform={platform}
                  value={portfolioLinks[platform.id]}
                  onChange={(value) => handleLinkChange(platform.id, value)}
                />
              ))}
            </View>
          </View>

          {/* Specializations Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcon name="auto-awesome" size={20} color={BRAND.purple} />
              <Text style={styles.sectionTitle}>Specializations</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Select or add your areas of expertise
            </Text>
            
            {/* Selected specializations */}
            {specializations.length > 0 && (
              <View style={styles.selectedSpecsContainer}>
                <Text style={styles.selectedSpecsLabel}>Your specializations:</Text>
                <View style={styles.specsGrid}>
                  {specializations.map((spec, index) => (
                    <SpecializationChip
                      key={index}
                      label={spec}
                      selected={true}
                      onToggle={() => toggleSpecialization(spec)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Suggested specializations */}
            <View style={styles.suggestedSpecsContainer}>
              <Text style={styles.suggestedSpecsLabel}>Suggestions:</Text>
              <View style={styles.specsGrid}>
                {suggestedSpecs
                  .filter(spec => !specializations.includes(spec))
                  .map((spec, index) => (
                    <SpecializationChip
                      key={index}
                      label={spec}
                      selected={false}
                      onToggle={() => toggleSpecialization(spec)}
                    />
                  ))}
              </View>
            </View>

            {/* Custom specialization input */}
            <View style={styles.customSpecContainer}>
              <TextInput
                style={styles.customSpecInput}
                value={customSpecialization}
                onChangeText={setCustomSpecialization}
                placeholder="Add custom specialization..."
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={addCustomSpecialization}
              />
              <TouchableOpacity 
                style={styles.addSpecButton}
                onPress={addCustomSpecialization}
                disabled={!customSpecialization.trim()}
              >
                <MaterialIcon 
                  name="add" 
                  size={20} 
                  color={customSpecialization.trim() ? BRAND.purple : '#9CA3AF'} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Portfolio Gallery Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcon name="collections" size={20} color={BRAND.purple} />
              <Text style={styles.sectionTitle}>Portfolio Gallery</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Showcase your best work (up to 10 images)
            </Text>

            <View style={styles.galleryGrid}>
              {portfolioGallery.map((image, index) => (
                <GalleryImage
                  key={index}
                  image={image}
                  onRemove={() => handleRemoveGalleryImage(index)}
                />
              ))}
              
              {portfolioGallery.length < 10 && (
                <TouchableOpacity 
                  style={styles.addImageButton}
                  onPress={handleAddGalleryImage}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color={BRAND.purple} />
                  ) : (
                    <>
                      <MaterialIcon name="add-photo-alternate" size={28} color={BRAND.purple} />
                      <Text style={styles.addImageText}>Add Photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BRAND.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: BRAND.purple,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.white,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: BRAND.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  // Bio styles
  bioInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  charCount: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 6,
  },
  // Links styles
  linksContainer: {
    gap: 12,
  },
  linkInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  linkIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkInputWrapper: {
    flex: 1,
  },
  linkLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  linkInput: {
    fontSize: 14,
    color: '#1F2937',
    padding: 0,
  },
  linkTestButton: {
    padding: 8,
  },
  // Specializations styles
  selectedSpecsContainer: {
    marginBottom: 16,
  },
  selectedSpecsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
  },
  suggestedSpecsContainer: {
    marginBottom: 16,
  },
  suggestedSpecsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  specChipSelected: {
    backgroundColor: BRAND.purple,
  },
  specChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  specChipTextSelected: {
    color: BRAND.white,
  },
  customSpecContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingLeft: 14,
    paddingRight: 4,
  },
  customSpecInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: 12,
  },
  addSpecButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
  },
  // Gallery styles
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  galleryImageWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  addImageText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.purple,
    marginTop: 4,
  },
});

export default PortfolioEditScreen;
