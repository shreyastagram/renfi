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
import {  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  StatusBar
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { requestGalleryPermission } from '../utils/permissions';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { updateProviderProfile } from '../services/profileService';
import { NODE_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';

import { uploadPortfolioImage } from '../services/cloudinaryService';
import {
  useThemedStyles,
  useThemeColors,
  iconAccent,
  mapOverlay,
} from '../theme';
import { stableDark } from '../theme';

// Brand colors
const makeC = (c) => ({
  primary: c.brandOrange,
  secondary: c.brandBlue,
  purple: c.accentViolet,
  background: c.bg,
  white: c.surface,
  success: c.success,
  line: c.borderNeutral,
  sunken: c.surfaceSunken,
  text: c.textStrongNeutral,
  textBody: c.textBodyNeutral,
  textSecondary: c.textSecondary,
  muted: c.textMuted,
  violetFill: c.accentVioletFill,
  shadow: c.shadow,
});

// Social media platforms configuration
const PLATFORMS = [
  { 
    id: 'website', 
    label: 'Website', 
    icon: 'language', 
    color: iconAccent.website,
    bgColor: iconAccent.website + '1A',
    placeholder: 'https://yourwebsite.com',
  },
  { 
    id: 'instagram', 
    label: 'Instagram', 
    icon: 'camera-alt', 
    color: iconAccent.instagram,
    bgColor: iconAccent.instagram + '1A',
    placeholder: 'https://instagram.com/yourusername',
  },
  { 
    id: 'youtube', 
    label: 'YouTube', 
    icon: 'play-circle-filled', 
    color: iconAccent.youtube,
    bgColor: iconAccent.youtube + '1A',
    placeholder: 'https://youtube.com/c/yourchannel',
  },
  { 
    id: 'facebook', 
    label: 'Facebook', 
    icon: 'facebook', 
    color: iconAccent.facebook,
    bgColor: iconAccent.facebook + '1A',
    placeholder: 'https://facebook.com/yourpage',
  },
  { 
    id: 'tiktok', 
    label: 'TikTok', 
    icon: 'music-note', 
    color: iconAccent.tiktok,
    bgColor: iconAccent.tiktok + '1A',
    placeholder: 'https://tiktok.com/@yourusername',
  },
  { 
    id: 'twitter', 
    label: 'Twitter/X', 
    icon: 'alternate-email', 
    color: iconAccent.twitter,
    bgColor: iconAccent.twitter + '1A',
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
const LinkInput = ({ platform, value, onChange, t }) => {
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
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
        placeholderTextColor={C.muted}
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
            dialog(t('portfolio.invalidUrl'), t('portfolio.invalidUrlMsg'));
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
const SpecializationChip = ({ label, selected, onToggle }) => {
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  return (
    <TouchableOpacity
      style={[styles.specChip, selected && styles.specChipSelected]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Text style={[styles.specChipText, selected && styles.specChipTextSelected]}>
        {label}
      </Text>
      {selected && (
        <MaterialIcon name="check" size={14} color={C.white} />
      )}
    </TouchableOpacity>
  );
};

/**
 * Gallery Image Component
 */
const GalleryImage = ({ image, onRemove }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.galleryImageWrapper}>
      <Image 
        source={{ uri: image.url || image }} 
        style={styles.galleryImage}
        resizeMode="cover"
      />
      <TouchableOpacity style={styles.removeImageButton} onPress={onRemove}>
        <MaterialIcon name="close" size={16} color={stableDark.ink} />
      </TouchableOpacity>
    </View>
  );
};

const PortfolioEditScreen = ({ navigation }) => {
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();

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
    return uploadPortfolioImage(imageUri);
  };

  const handleAddGalleryImage = async () => {
    try {
      const granted = await requestGalleryPermission(dialog);
      if (!granted) return;

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
      dialog('Error', t('portfolio.uploadFailed'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveGalleryImage = (index) => {
    dialog(
      t('portfolio.removeImage'),
      t('portfolio.removeImageMsg'),
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
        dialog('Success', t('portfolio.portfolioUpdated'), [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        dialog('Error', result.error || t('portfolio.saveFailed'));
      }
    } catch (error) {
      console.error('Error saving portfolio:', error);
      dialog('Error', t('portfolio.saveFailed'));
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
          <MaterialIcon name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('portfolio.title')}</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
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
              <MaterialIcon name="person" size={20} color={C.purple} />
              <Text style={styles.sectionTitle}>{t('portfolio.aboutYou')}</Text>
            </View>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              placeholder={t('portfolio.bioPlaceholder')}
              placeholderTextColor={C.muted}
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
              <MaterialIcon name="link" size={20} color={C.purple} />
              <Text style={styles.sectionTitle}>{t('portfolio.portfolioLinks')}</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              {t('portfolio.portfolioLinksSub')}
            </Text>
            <View style={styles.linksContainer}>
              {PLATFORMS.map((platform) => (
                <LinkInput
                  key={platform.id}
                  platform={platform}
                  value={portfolioLinks[platform.id]}
                  onChange={(value) => handleLinkChange(platform.id, value)}
                  t={t}
                />
              ))}
            </View>
          </View>

          {/* Specializations Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcon name="auto-awesome" size={20} color={C.purple} />
              <Text style={styles.sectionTitle}>{t('portfolio.specializationsTitle')}</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              {t('portfolio.specializationsSub')}
            </Text>
            
            {/* Selected specializations */}
            {specializations.length > 0 && (
              <View style={styles.selectedSpecsContainer}>
                <Text style={styles.selectedSpecsLabel}>{t('portfolio.yourSpecializations')}</Text>
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
              <Text style={styles.suggestedSpecsLabel}>{t('portfolio.suggestions')}</Text>
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
                placeholder={t('portfolio.customSpecPlaceholder')}
                placeholderTextColor={C.muted}
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
                  color={customSpecialization.trim() ? C.purple : C.muted} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Portfolio Gallery Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcon name="collections" size={20} color={C.purple} />
              <Text style={styles.sectionTitle}>{t('portfolio.portfolioGallery')}</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              {t('portfolio.gallerySub')}
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
                    <ActivityIndicator size="small" color={C.purple} />
                  ) : (
                    <>
                      <MaterialIcon name="add-photo-alternate" size={28} color={C.purple} />
                      <Text style={styles.addImageText}>{t('portfolio.addPhoto')}</Text>
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

const makeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
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
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: C.sunken,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: C.purple,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.white,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: C.shadow,
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
    color: C.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  // Bio styles
  bioInput: {
    backgroundColor: C.sunken,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: C.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: C.line,
  },
  charCount: {
    fontSize: 11,
    color: C.muted,
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
    backgroundColor: C.sunken,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
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
    color: C.textSecondary,
    marginBottom: 4,
  },
  linkInput: {
    fontSize: 14,
    color: C.text,
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
    color: C.text,
    marginBottom: 10,
  },
  suggestedSpecsContainer: {
    marginBottom: 16,
  },
  suggestedSpecsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
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
    backgroundColor: C.sunken,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  specChipSelected: {
    backgroundColor: C.purple,
  },
  specChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textBody,
  },
  specChipTextSelected: {
    color: C.white,
  },
  customSpecContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.sunken,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingLeft: 14,
    paddingRight: 4,
  },
  customSpecInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    paddingVertical: 12,
  },
  addSpecButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: C.violetFill,
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
    backgroundColor: mapOverlay.hint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.sunken,
  },
  addImageText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.purple,
    marginTop: 4,
  },
  });
};

export default PortfolioEditScreen;
