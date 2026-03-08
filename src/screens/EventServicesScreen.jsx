/**
 * Event Services Screen
 *
 * Handles event-based services (Photographer, Influencer)
 * These services are NOT location-based, instead showcase portfolio/social links
 * Production-grade booking flow for photographers and influencers
 *
 * Premium design language v3.0
 *
 * @version 3.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Linking,
  Modal,
  Image,
  RefreshControl,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLocation } from '../context/LocationContext';
import { NODE_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';
import { addToFavorites, checkIsFavorite } from '../services/favoritesService';
import MapPickerModal from '../components/MapPickerModal';
import ImageViewerModal from '../components/ImageViewerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Premium design tokens
const COLORS = {
  darkHero: '#0F172A',
  background: '#F1F5F9',
  cardWhite: '#FFFFFF',
  primary: '#f67c16',
  primaryLight: '#FFF7ED',
  secondary: '#2b76bc',
  secondaryLight: '#EFF6FF',
  muted: '#94A3B8',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  success: '#10B981',
  successLight: '#ECFDF5',
  divider: '#E2E8F0',
  iconBg: '#F1F5F9',
  white: '#FFFFFF',
  star: '#F59E0B',
  verified: '#2563EB',
  purple: '#7C3AED',
  purpleLight: '#F5F3FF',
};

const SHADOWS = Platform.select({
  ios: {
    shadowColor: COLORS.darkHero,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  android: {
    elevation: 5,
  },
});

const SHADOW_LIGHT = Platform.select({
  ios: {
    shadowColor: COLORS.darkHero,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  android: {
    elevation: 3,
  },
});

// Event service types - using MaterialIcon names
const EVENT_SERVICES = [
  { id: 'photographer', name: 'Photographer', icon: 'camera-alt', description: 'Professional photography services' },
  { id: 'influencer', name: 'Influencer', icon: 'star', description: 'Social media promotion & content creation' },
];

// Platform icons
const PLATFORM_ICONS = {
  instagram: 'camera',
  youtube: 'play-circle-filled',
  website: 'language',
  facebook: 'facebook',
  tiktok: 'music-note',
  twitter: 'alternate-email',
};

/**
 * Animated Press Wrapper - provides spring scale effect
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
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * Section Header with left accent bar
 */
const SectionHeader = ({ title, style: customStyle }) => (
  <View style={[styles.sectionHeaderRow, customStyle]}>
    <View style={styles.sectionAccentBar} />
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

/**
 * Service Card Component - Premium design
 */
const ServiceCard = ({ service, onPress }) => (
  <AnimatedPressable
    style={styles.serviceCard}
    onPress={() => onPress(service)}
  >
    <View style={styles.serviceIconContainer}>
      <MaterialIcon name={service.icon} size={24} color={COLORS.secondary} />
    </View>
    <View style={styles.serviceInfo}>
      <Text style={styles.serviceName}>{service.name}</Text>
      <Text style={styles.serviceDescription}>{service.description}</Text>
    </View>
    <View style={styles.serviceChevronWrap}>
      <MaterialIcon name="chevron-right" size={22} color={COLORS.muted} />
    </View>
  </AnimatedPressable>
);

/**
 * Portfolio Link Button
 */
const PortfolioLink = ({ platform, url, onPress }) => (
  <TouchableOpacity
    style={styles.portfolioLink}
    onPress={() => onPress(url)}
    activeOpacity={0.7}
  >
    <MaterialIcon
      name={PLATFORM_ICONS[platform] || 'link'}
      size={18}
      color={COLORS.secondary}
    />
    <Text style={styles.portfolioLinkText}>
      {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </Text>
  </TouchableOpacity>
);

/**
 * Provider Card for Event Services - Premium with animated press
 */
const EventProviderCard = ({ provider, onViewDetails, onContact }) => {
  // Get profile picture URL - backend returns profilePicture as string or profilePicture.url
  const profilePictureUrl = typeof provider.profilePicture === 'string'
    ? provider.profilePicture
    : provider.profilePicture?.url || provider.profileImage;

  return (
    <AnimatedPressable
      style={styles.providerCard}
      onPress={() => onViewDetails(provider)}
    >
      <View style={styles.providerHeader}>
        <View style={styles.providerAvatar}>
          {profilePictureUrl ? (
            <Image
              source={{ uri: profilePictureUrl }}
              style={styles.providerAvatarImage}
            />
          ) : (
            <Text style={styles.providerInitial}>
              {provider.name?.charAt(0)?.toUpperCase() || 'P'}
            </Text>
          )}
          {provider.isFavorite && (
            <View style={styles.favoriteBadge}>
              <MaterialIcon name="star" size={10} color={COLORS.star} />
            </View>
          )}
        </View>

        <View style={styles.providerInfo}>
          <View style={styles.providerNameRow}>
            <Text style={styles.providerName}>{provider.name}</Text>
            {provider.verified && (
              <MaterialIcon name="verified" size={16} color={COLORS.verified} />
            )}
          </View>

          {provider.bio && (
            <Text style={styles.providerBio} numberOfLines={2}>
              {provider.bio}
            </Text>
          )}

          {(provider.rating > 0 || provider.ratings?.average > 0) && (
            <View style={styles.ratingRow}>
              <MaterialIcon name="star" size={14} color={COLORS.star} />
              <Text style={styles.ratingText}>
                {(provider.ratings?.average || provider.rating || 0).toFixed(1)}
              </Text>
              {provider.ratings?.total > 0 && (
                <Text style={styles.ratingCount}>({provider.ratings.total} reviews)</Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Specializations */}
      {provider.specializations && provider.specializations.length > 0 && (
        <View style={styles.specializationsContainer}>
          {provider.specializations.slice(0, 3).map((spec, index) => (
            <View key={index} style={styles.specializationTag}>
              <Text style={styles.specializationText}>{spec}</Text>
            </View>
          ))}
          {provider.specializations.length > 3 && (
            <View style={styles.specializationTag}>
              <Text style={styles.specializationText}>
                +{provider.specializations.length - 3}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Portfolio Links Preview */}
      {provider.portfolioLinks && Object.keys(provider.portfolioLinks).length > 0 && (
        <View style={styles.linksPreview}>
          {Object.keys(provider.portfolioLinks).slice(0, 4).map((platform) => (
            provider.portfolioLinks[platform] && (
              <View key={platform} style={styles.linkIcon}>
                <MaterialIcon
                  name={PLATFORM_ICONS[platform] || 'link'}
                  size={16}
                  color={COLORS.secondary}
                />
              </View>
            )
          ))}
        </View>
      )}

      <View style={styles.providerActions}>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => onViewDetails(provider)}
          activeOpacity={0.7}
        >
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => onContact(provider)}
          activeOpacity={0.7}
        >
          <MaterialIcon name="phone" size={18} color={COLORS.white} />
          <Text style={styles.contactButtonText}>Call</Text>
        </TouchableOpacity>
      </View>
    </AnimatedPressable>
  );
};

/**
 * Provider Details Modal - Premium Design
 * Shows comprehensive provider information for event services
 */
const ProviderDetailsModal = ({ visible, provider, onClose, onBookNow, onContactProvider, sending, hasContacted }) => {
  const { dialog } = useDialog();
  const [galleryViewerVisible, setGalleryViewerVisible] = useState(false);
  const [galleryViewerIndex, setGalleryViewerIndex] = useState(0);

  if (!provider) return null;

  const openLink = (urlInput) => {
    if (!urlInput) return;

    // Handle both string URLs and object URLs { url: '...' }
    let url = typeof urlInput === 'string' ? urlInput : urlInput?.url;
    if (!url) return;

    // Ensure URL has protocol
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      finalUrl = 'https://' + url;
    }

    Linking.openURL(finalUrl).catch(() => {
      dialog('Error', 'Could not open link');
    });
  };

  // Format member since date
  const getMemberSince = () => {
    if (provider.memberSince) return provider.memberSince;
    if (provider.createdAt) {
      return new Date(provider.createdAt).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric'
      });
    }
    return null;
  };

  // Get profile image URL - backend returns profilePicture as string URL or object with url
  const getProfileImageUrl = () => {
    // Backend returns profilePicture as string URL directly
    if (typeof provider.profilePicture === 'string' && provider.profilePicture) return provider.profilePicture;
    if (provider.profilePicture?.url) return provider.profilePicture.url;
    if (provider.profileImage) return provider.profileImage;
    return null;
  };

  const profileImageUrl = getProfileImageUrl();
  const memberSince = getMemberSince();

  /**
   * Handle book now with popup if not called
   */
  const handleBookPress = () => {
    if (!hasContacted) {
      dialog(
        'Contact Provider First?',
        'We recommend having a quick talk with your provider before booking to discuss your requirements.',
        [
          { text: 'Call Provider', onPress: () => onContactProvider(provider) },
          { text: 'Book Anyway', onPress: () => onBookNow(provider), style: 'default' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    onBookNow(provider);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.detailsModalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header with Close Button */}
            <View style={styles.detailsHeaderBar}>
              <TouchableOpacity style={styles.closeDetailButton} onPress={onClose}>
                <MaterialIcon name="close" size={24} color={COLORS.muted} />
              </TouchableOpacity>
              <Text style={styles.detailsHeaderTitle}>Provider Details</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Profile Section - Premium */}
            <View style={styles.detailsProfileSection}>
              <View style={styles.detailsAvatarContainer}>
                {profileImageUrl ? (
                  <Image
                    source={{ uri: profileImageUrl }}
                    style={styles.detailsAvatarImage}
                  />
                ) : (
                  <View style={styles.detailsAvatar}>
                    <Text style={styles.detailsAvatarInitial}>
                      {provider.name?.charAt(0)?.toUpperCase() || 'P'}
                    </Text>
                  </View>
                )}
                {provider.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <MaterialIcon name="verified" size={20} color={COLORS.success} />
                  </View>
                )}
              </View>

              <View style={styles.detailsNameSection}>
                <Text style={styles.detailsName}>{provider.name}</Text>

                {/* Rating Row */}
                {(provider.rating > 0 || provider.ratings?.average > 0) && (
                  <View style={styles.detailsRating}>
                    <MaterialIcon name="star" size={18} color={COLORS.star} />
                    <Text style={styles.detailsRatingText}>
                      {(provider.ratings?.average || provider.rating || 0).toFixed(1)}
                    </Text>
                    {provider.ratings?.total > 0 && (
                      <Text style={styles.detailsRatingCount}>
                        ({provider.ratings.total} reviews)
                      </Text>
                    )}
                  </View>
                )}

                {/* Experience */}
                {provider.experience && (
                  <View style={styles.infoRow}>
                    <MaterialIcon name="work" size={14} color={COLORS.muted} />
                    <Text style={styles.infoText}>{provider.experience} experience</Text>
                  </View>
                )}

                {/* Member Since */}
                {memberSince && (
                  <View style={styles.infoRow}>
                    <MaterialIcon name="calendar-today" size={14} color={COLORS.muted} />
                    <Text style={styles.infoText}>Member since {memberSince}</Text>
                  </View>
                )}

                {/* Location */}
                {(provider.city || provider.address) && (
                  <View style={styles.infoRow}>
                    <MaterialIcon name="location-on" size={14} color={COLORS.muted} />
                    <Text style={styles.infoText}>
                      {provider.city || provider.address}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {provider.stats?.completedRequests || provider.completedJobs || 0}
                </Text>
                <Text style={styles.statLabel}>Jobs Done</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{provider.ratings?.total || 0}</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, {
                  color: provider.isOnline || provider.isAvailable ? COLORS.success : COLORS.muted
                }]}>
                  {provider.isOnline || provider.isAvailable ? 'Online' : 'Offline'}
                </Text>
                <Text style={styles.statLabel}>Status</Text>
              </View>
            </View>

            {/* Bio */}
            {provider.bio && (
              <View style={styles.detailsSection}>
                <SectionHeader title="About" />
                <View style={styles.bioContainer}>
                  <Text style={styles.detailsBio}>{provider.bio}</Text>
                </View>
              </View>
            )}

            {/* Specializations */}
            {provider.specializations && provider.specializations.length > 0 && (
              <View style={styles.detailsSection}>
                <SectionHeader title="Specializations" />
                <View style={styles.specializationsGrid}>
                  {provider.specializations.map((spec, index) => (
                    <View key={index} style={styles.specTagLarge}>
                      <MaterialIcon name="auto-awesome" size={14} color={COLORS.purple} />
                      <Text style={styles.specTagText}>{spec}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Portfolio Links */}
            {provider.portfolioLinks && Object.keys(provider.portfolioLinks).filter(k => provider.portfolioLinks[k]).length > 0 && (
              <View style={styles.detailsSection}>
                <SectionHeader title="Portfolio & Social" />
                <View style={styles.linksGrid}>
                  {Object.entries(provider.portfolioLinks).map(([platform, url]) => (
                    url && (
                      <PortfolioLink
                        key={platform}
                        platform={platform}
                        url={url}
                        onPress={openLink}
                      />
                    )
                  ))}
                </View>
              </View>
            )}

            {/* Gallery Preview */}
            {provider.portfolioGallery && provider.portfolioGallery.length > 0 && (
              <View style={styles.detailsSection}>
                <SectionHeader title={`Gallery (${provider.portfolioGallery.length})`} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.galleryContainer}
                >
                  {provider.portfolioGallery.slice(0, 6).map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.galleryItem}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (item.type === 'video') {
                          // Videos still open in browser
                          openLink(item.url || item);
                        } else {
                          // Images open in in-app viewer
                          setGalleryViewerIndex(index);
                          setGalleryViewerVisible(true);
                        }
                      }}
                    >
                      <Image
                        source={{ uri: item.thumbnail || item.url || item }}
                        style={styles.galleryImage}
                      />
                      {item.type === 'video' && (
                        <View style={styles.videoOverlay}>
                          <MaterialIcon name="play-circle-filled" size={32} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* In-App Image Viewer */}
                <ImageViewerModal
                  visible={galleryViewerVisible}
                  images={provider.portfolioGallery.slice(0, 6).filter(item => item.type !== 'video')}
                  initialIndex={galleryViewerIndex}
                  onClose={() => setGalleryViewerVisible(false)}
                />
              </View>
            )}

            {/* Contact - masked call */}
            {provider && (
              <View style={styles.detailsSection}>
                <SectionHeader title="Contact" />
                <TouchableOpacity
                  style={styles.phoneButton}
                  onPress={() => onContactProvider(provider)}
                  activeOpacity={0.7}
                >
                  <View style={styles.phoneIconWrap}>
                    <MaterialIcon name="phone" size={18} color={COLORS.success} />
                  </View>
                  <Text style={styles.phoneText}>Call Provider</Text>
                  <MaterialIcon name="chevron-right" size={20} color={COLORS.muted} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons - Book always active */}
          <View style={styles.detailsActions}>
            <TouchableOpacity
              style={styles.callProviderBtn}
              onPress={() => provider && onContactProvider(provider)}
              activeOpacity={0.7}
            >
              <MaterialIcon name="phone" size={22} color={COLORS.success} />
              <Text style={styles.callProviderText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sendRequestButton}
              onPress={handleBookPress}
              disabled={sending}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcon name="event" size={20} color="#FFFFFF" />
                  <Text style={styles.sendRequestText}>Book Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const EventServicesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile } = useApp();
  const { dialog } = useDialog();

  // User ID
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  // State
  const [selectedService, setSelectedService] = useState(null);
  const [step, setStep] = useState('select'); // select, providers, booking
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  // Booking flow state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [eventDescription, setEventDescription] = useState('');
  const [eventVenue, setEventVenue] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [venueCoords, setVenueCoords] = useState(null); // { latitude, longitude }

  // Track which providers the user has called (call-before-book enforcement)
  const [contactedProviderIds, setContactedProviderIds] = useState(new Set());

  // Get user location from context
  const { selectedLocation } = useLocation();

  /**
   * Fetch providers for service type
   */
  const fetchProviders = async (serviceType, refresh = false) => {
    console.log('========== FETCH EVENT PROVIDERS ==========');
    console.log('ServiceType:', serviceType);
    console.log('API URL:', `${NODE_BASE_URL}/api/event-services/providers`);

    if (refresh) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await authFetch(`${NODE_BASE_URL}/api/event-services/providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType,
          userId,
        }),
      });

      const data = await response.json();
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(data, null, 2));

      if (response.ok && data.success) {
        // Response structure: { success: true, providers: [...] }
        const providersList = data.providers || [];
        console.log(`Found ${providersList.length} providers`);
        setProviders(providersList);
      } else {
        console.log('Error response:', data.error);
        dialog('Error', data.error || 'Failed to fetch providers');
      }
    } catch (error) {
      console.error('Fetch providers error:', error);
      dialog('Error', 'Failed to fetch providers');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
    console.log('=============================================');
  };

  /**
   * Handle service selection
   */
  const handleServiceSelect = (service) => {
    setSelectedService(service);
    setStep('providers');
    fetchProviders(service.id);
  };

  /**
   * Handle view provider details
   */
  const handleViewDetails = async (provider) => {
    setSelectedProvider(provider);
    setShowDetails(true);
  };

  /**
   * Handle contact provider (direct phone call)
   */
  const handleContactProvider = async (provider) => {
    const phone = provider?.phone || provider?.verifiedPhone;
    if (!phone) {
      dialog('Error', 'Provider phone number not available');
      return;
    }

    // Clean phone number — ensure it starts with country code
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    const phoneNumber = cleanPhone.startsWith('+') ? cleanPhone :
                        cleanPhone.startsWith('91') ? `+${cleanPhone}` : `+91${cleanPhone}`;

    dialog(
      'Contact Provider',
      `Call ${provider.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            // Track that user has contacted this provider
            setContactedProviderIds(prev => new Set(prev).add(provider._id));
            Linking.openURL(`tel:${phoneNumber}`).catch(() => {
              dialog('Error', 'Unable to make a call. Please check your phone settings.');
            });
          },
        },
      ]
    );
  };

  /**
   * Execute the actual booking (open booking modal)
   */
  const executeBooking = (provider) => {
    setSelectedProvider(provider);
    setShowDetails(false);
    setEventDate(new Date());
    setEventDescription('');
    setEventVenue('');
    setVenueCoords(null);
    setShowBookingModal(true);
  };

  /**
   * Open booking modal - with contact-first recommendation popup
   */
  const handleOpenBooking = (provider) => {
    // If user has already called, go straight to booking
    if (contactedProviderIds.has(provider._id)) {
      executeBooking(provider);
      return;
    }
    // Otherwise show recommendation popup
    dialog(
      'Contact Provider First?',
      'We recommend having a quick talk with your provider before booking to discuss your requirements.',
      [
        { text: 'Call Provider', onPress: () => handleContactProvider(provider) },
        { text: 'Book Anyway', onPress: () => executeBooking(provider), style: 'default' },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  /**
   * Handle send booking request with all required fields
   * Production-grade implementation
   */
  const handleSendRequest = async () => {
    if (!selectedProvider) {
      dialog('Error', 'Please select a provider');
      return;
    }

    if (!eventDate) {
      dialog('Error', 'Please select an event date');
      return;
    }

    if (!eventVenue.trim()) {
      dialog('Error', 'Please select the event venue using the map');
      return;
    }

    setSendingRequest(true);

    try {
      // Build location data from map-picked venue coordinates
      const locationData = {
        address: eventVenue.trim(),
        coordinates: venueCoords ? [
          venueCoords.longitude,
          venueCoords.latitude
        ] : (selectedLocation?.coordinates ? [
          selectedLocation.coordinates.longitude,
          selectedLocation.coordinates.latitude
        ] : null),
        landmark: '',
      };

      // Create service request with ALL required fields including location
      const createResponse = await authFetch(`${NODE_BASE_URL}/api/event-services/create-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          serviceType: selectedService.id,
          serviceName: selectedService.name,
          eventDate: eventDate.toISOString(),
          notes: eventDescription || `Booking request for ${selectedService.name} services`,
          location: locationData,
        }),
      });

      const createData = await createResponse.json();
      console.log('[EventServices] Create response:', createData);

      // Backend returns { statusCode: 201, message: '...', data: {...} }
      if (!createResponse.ok || (createData.statusCode && createData.statusCode >= 400)) {
        // Handle geofence rejection with user-friendly message
        if (createData.code === 'OUTSIDE_SERVICE_ZONE') {
          const suggestion = createData.details?.suggestion || 'Event services are currently available only in Yavatmal City, Maharashtra. We\'re expanding soon!';
          dialog('Service Unavailable in Your Area', suggestion, [{ text: 'OK' }]);
          setSendingRequest(false);
          return;
        }
        throw new Error(createData.message || createData.error || 'Failed to create request');
      }

      const serviceId = createData.data?._id || createData._id;
      if (!serviceId) {
        throw new Error('No service ID returned from creation');
      }

      // Then send to provider
      const sendResponse = await authFetch(
        `${NODE_BASE_URL}/api/event-services/${serviceId}/send-to-provider`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            providerId: selectedProvider._id,
          }),
        }
      );

      const sendData = await sendResponse.json();
      console.log('[EventServices] Send response:', sendData);

      // Backend returns { statusCode: 200, message: '...', data: {...} }
      if (sendResponse.ok && (!sendData.statusCode || sendData.statusCode < 400)) {
        setShowBookingModal(false);
        dialog(
          'Request Sent!',
          `Your booking request has been sent to ${selectedProvider.name}.\n\nEvent Date: ${eventDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n\nThey will contact you soon to confirm.`,
          [
            {
              text: 'View My Bookings',
              onPress: () => navigation.navigate('History'),
            },
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        // Send failed - cancel the created request to avoid orphan pending requests
        try {
          await authFetch(`${NODE_BASE_URL}/api/event-services/${serviceId}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, reason: 'Failed to send to provider' }),
          });
          console.log('[EventServices] Cancelled orphan request after send failure');
        } catch (cancelErr) {
          console.error('[EventServices] Failed to cancel orphan request:', cancelErr);
        }
        throw new Error(sendData.message || sendData.error || 'Failed to send request to provider');
      }
    } catch (error) {
      console.error('[EventServices] Booking error:', error);
      dialog('Error', error.message || 'Failed to send booking request');
    } finally {
      setSendingRequest(false);
    }
  };

  /**
   * Handle add to favorites — with duplicate prevention
   */
  const handleAddFavorite = async (provider) => {
    // Check if already favorited (by providerId only — prevents cross-service duplicates)
    const checkResult = await checkIsFavorite(userId, provider._id);
    if (checkResult.success && checkResult.isFavorite) {
      dialog('Already Favorited', `${provider.name} is already in your favorites`);
      // Update UI to reflect correct state
      setProviders(prev => prev.map(p =>
        p._id === provider._id ? { ...p, isFavorite: true } : p
      ));
      if (selectedProvider?._id === provider._id) {
        setSelectedProvider({ ...selectedProvider, isFavorite: true });
      }
      return;
    }

    const result = await addToFavorites(
      userId,
      provider._id,
      selectedService.id
    );

    if (result.success) {
      // Update provider in list
      setProviders(prev => prev.map(p =>
        p._id === provider._id ? { ...p, isFavorite: true } : p
      ));

      // Update selected provider
      if (selectedProvider?._id === provider._id) {
        setSelectedProvider({ ...selectedProvider, isFavorite: true });
      }

      dialog('Added!', `${provider.name} added to favorites`);
    } else {
      dialog('Error', result.error || 'Failed to add to favorites');
    }
  };

  /**
   * Render premium header with safe area
   */
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          if (step === 'select') {
            navigation.goBack();
          } else {
            setStep('select');
            setSelectedService(null);
            setProviders([]);
            setContactedProviderIds(new Set()); // Reset per search session
          }
        }}
        activeOpacity={0.7}
      >
        <MaterialIcon name="arrow-back" size={24} color={COLORS.white} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        {step === 'select' ? 'Event Services' : selectedService?.name || 'Providers'}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  /**
   * Render service selection
   */
  const renderServiceSelection = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.introSection}>
        <Text style={styles.introTitle}>Find Creative Professionals</Text>
        <Text style={styles.introSubtitle}>
          Browse portfolios and connect with photographers & influencers for your events
        </Text>
      </View>

      {EVENT_SERVICES.map(service => (
        <ServiceCard
          key={service.id}
          service={service}
          onPress={handleServiceSelect}
        />
      ))}
    </ScrollView>
  );

  /**
   * Render providers list
   */
  const renderProvidersList = () => (
    <View style={styles.providersContainer}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinnerWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
          <Text style={styles.loadingText}>Finding {selectedService?.name}s...</Text>
        </View>
      ) : providers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <MaterialIcon name="search-off" size={48} color={COLORS.muted} />
          </View>
          <Text style={styles.emptyText}>No {selectedService?.name}s found</Text>
          <Text style={styles.emptySubtext}>
            Check back later for more providers
          </Text>
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <EventProviderCard
              provider={item}
              onViewDetails={handleViewDetails}
              onContact={handleContactProvider}
            />
          )}
          contentContainerStyle={styles.providersList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchProviders(selectedService.id, true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}

      {step === 'select' ? renderServiceSelection() : renderProvidersList()}

      {/* Provider Details Modal - Premium */}
      <ProviderDetailsModal
        visible={showDetails}
        provider={selectedProvider}
        onClose={() => setShowDetails(false)}
        onBookNow={handleOpenBooking}
        onContactProvider={handleContactProvider}
        sending={sendingRequest}
        hasContacted={selectedProvider ? contactedProviderIds.has(selectedProvider._id) : false}
      />

      {/* Booking Modal - Date Selection & Confirmation */}
      <Modal
        visible={showBookingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBookingModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.bookingModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.bookingModalContent}>
            {/* Header */}
            <View style={styles.bookingModalHeader}>
              <TouchableOpacity
                style={styles.bookingCloseButton}
                onPress={() => setShowBookingModal(false)}
                activeOpacity={0.7}
              >
                <MaterialIcon name="close" size={22} color={COLORS.muted} />
              </TouchableOpacity>
              <Text style={styles.bookingModalTitle}>Book {selectedService?.name}</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              style={styles.bookingModalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Provider Info */}
              {selectedProvider && (
                <View style={styles.bookingProviderCard}>
                  <View style={styles.bookingProviderAvatar}>
                    {(typeof selectedProvider.profilePicture === 'string' ? selectedProvider.profilePicture : selectedProvider.profilePicture?.url) || selectedProvider.profileImage ? (
                      <Image
                        source={{ uri: typeof selectedProvider.profilePicture === 'string' ? selectedProvider.profilePicture : (selectedProvider.profilePicture?.url || selectedProvider.profileImage) }}
                        style={styles.bookingProviderImage}
                      />
                    ) : (
                      <Text style={styles.bookingProviderInitial}>
                        {selectedProvider.name?.charAt(0)?.toUpperCase() || 'P'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.bookingProviderInfo}>
                    <Text style={styles.bookingProviderName}>{selectedProvider.name}</Text>
                    {selectedProvider.ratings?.average > 0 && (
                      <View style={styles.bookingRatingRow}>
                        <MaterialIcon name="star" size={14} color={COLORS.star} />
                        <Text style={styles.bookingRatingText}>
                          {selectedProvider.ratings.average.toFixed(1)} ({selectedProvider.ratings.total} reviews)
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Event Date Selection */}
              <View style={styles.bookingSection}>
                <View style={styles.bookingSectionTitleRow}>
                  <View style={styles.bookingSectionIconWrap}>
                    <MaterialIcon name="event" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={styles.bookingSectionTitle}>Event Date *</Text>
                </View>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <MaterialIcon name="calendar-today" size={20} color={COLORS.secondary} />
                  <Text style={styles.datePickerText}>
                    {eventDate.toLocaleDateString('en-IN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </Text>
                  <MaterialIcon name="edit" size={18} color={COLORS.muted} />
                </TouchableOpacity>
              </View>

              {/* Event Description */}
              <View style={styles.bookingSection}>
                <View style={styles.bookingSectionTitleRow}>
                  <View style={styles.bookingSectionIconWrap}>
                    <MaterialIcon name="description" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={styles.bookingSectionTitle}>Event Details (Optional)</Text>
                </View>
                <TextInput
                  style={styles.eventDescriptionInput}
                  placeholder="Describe your event (e.g., Wedding, Birthday Party, Corporate Event...)"
                  placeholderTextColor={COLORS.muted}
                  value={eventDescription}
                  onChangeText={setEventDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Event Venue/Location - Map Picker */}
              <View style={styles.bookingSection}>
                <View style={styles.bookingSectionTitleRow}>
                  <View style={styles.bookingSectionIconWrap}>
                    <MaterialIcon name="location-on" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={styles.bookingSectionTitle}>Event Venue *</Text>
                </View>

                {/* Selected venue display */}
                {eventVenue ? (
                  <TouchableOpacity
                    style={styles.venueSelectedCard}
                    onPress={() => setShowMapPicker(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.venueSelectedRow}>
                      <View style={styles.venueIconWrap}>
                        <MaterialIcon name="place" size={22} color={COLORS.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.venueSelectedAddress} numberOfLines={2}>
                          {eventVenue}
                        </Text>
                        {venueCoords && (
                          <Text style={styles.venueCoordsText}>
                            {venueCoords.latitude.toFixed(4)}, {venueCoords.longitude.toFixed(4)}
                          </Text>
                        )}
                      </View>
                      <MaterialIcon name="edit" size={18} color={COLORS.muted} />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.venueButtonsRow}>
                    {/* Pick on Map */}
                    <TouchableOpacity
                      style={styles.venueMapButton}
                      onPress={() => setShowMapPicker(true)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcon name="map" size={20} color={COLORS.white} />
                      <Text style={styles.venueMapButtonText}>Pick on Map</Text>
                    </TouchableOpacity>

                    {/* Use Current Location */}
                    {selectedLocation?.coordinates && (
                      <TouchableOpacity
                        style={styles.venueCurrentButton}
                        onPress={() => {
                          setEventVenue(selectedLocation.address || 'Current Location');
                          setVenueCoords({
                            latitude: selectedLocation.coordinates.latitude,
                            longitude: selectedLocation.coordinates.longitude,
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <MaterialIcon name="my-location" size={20} color={COLORS.secondary} />
                        <Text style={styles.venueCurrentButtonText}>Current Location</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* MapPickerModal */}
                <MapPickerModal
                  visible={showMapPicker}
                  onClose={() => setShowMapPicker(false)}
                  onLocationSelect={(location) => {
                    setEventVenue(location.address || location.shortAddress || 'Selected Location');
                    setVenueCoords({
                      latitude: location.latitude,
                      longitude: location.longitude,
                    });
                    setShowMapPicker(false);
                  }}
                  initialLocation={venueCoords || (selectedLocation?.coordinates ? {
                    latitude: selectedLocation.coordinates.latitude,
                    longitude: selectedLocation.coordinates.longitude,
                  } : null)}
                  title="Select Event Venue"
                />
              </View>

              {/* Summary */}
              <View style={styles.bookingSummary}>
                <Text style={styles.bookingSummaryTitle}>Booking Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service</Text>
                  <Text style={styles.summaryValue}>{selectedService?.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Provider</Text>
                  <Text style={styles.summaryValue}>{selectedProvider?.name}</Text>
                </View>
                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.summaryLabel}>Event Date</Text>
                  <Text style={styles.summaryValue}>
                    {eventDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Action Button */}
            <View style={styles.bookingActions}>
              <TouchableOpacity
                style={styles.confirmBookingButton}
                onPress={handleSendRequest}
                disabled={sendingRequest}
                activeOpacity={0.7}
              >
                {sendingRequest ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcon name="send" size={20} color="#FFFFFF" />
                    <Text style={styles.confirmBookingText}>Send Booking Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Native Date Picker - Platform specific */}
      {showDatePicker && (
        <DateTimePicker
          value={eventDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS until done
            if (selectedDate) {
              setEventDate(selectedDate);
            }
            if (Platform.OS === 'android') {
              setShowDatePicker(false);
            }
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // ─── Container ───
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ─── Premium Header (dark hero) ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.darkHero,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 42,
  },

  // ─── Content ───
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 32,
  },
  introSection: {
    marginBottom: 28,
  },
  introTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  // ─── Section Header with accent bar ───
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionAccentBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginRight: 10,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  // ─── Service Card (premium) ───
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardWhite,
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    ...SHADOWS,
  },
  serviceIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  serviceChevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Providers ───
  providersContainer: {
    flex: 1,
  },
  providersList: {
    padding: 20,
    paddingBottom: 32,
  },
  providerCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    ...SHADOWS,
  },
  providerHeader: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  providerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  providerAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  providerInitial: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
  },
  favoriteBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.star,
  },
  providerInfo: {
    flex: 1,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  providerName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginRight: 6,
  },
  providerBio: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: COLORS.muted,
    marginLeft: 4,
  },

  // ─── Specializations ───
  specializationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  specializationTag: {
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  specializationText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
  },

  // ─── Links Preview ───
  linksPreview: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  // ─── Provider Actions ───
  providerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  viewButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  contactButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },

  // ─── Loading & Empty ───
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSpinnerWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: COLORS.cardWhite,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS,
  },
  loadingText: {
    marginTop: 18,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: COLORS.cardWhite,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // ─── Details Modal ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  detailsModalContent: {
    backgroundColor: COLORS.cardWhite,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  detailsHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  closeDetailButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  detailsProfileSection: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'flex-start',
  },
  detailsAvatarContainer: {
    position: 'relative',
  },
  detailsAvatar: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 28,
  },
  detailsAvatarInitial: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.white,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 2,
    ...SHADOW_LIGHT,
  },
  detailsNameSection: {
    flex: 1,
    marginLeft: 16,
  },
  detailsName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  detailsRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailsRatingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 4,
  },
  detailsRatingCount: {
    fontSize: 13,
    color: COLORS.muted,
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // ─── Stats Row ───
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.iconBg,
    borderRadius: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.divider,
  },

  // ─── Details Sections ───
  detailsSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  bioContainer: {
    backgroundColor: COLORS.iconBg,
    borderRadius: 16,
    padding: 14,
  },
  detailsBio: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  specializationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specTagLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.purpleLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
    gap: 6,
  },
  specTagText: {
    fontSize: 13,
    color: COLORS.purple,
    fontWeight: '600',
  },

  // ─── Portfolio Links ───
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  portfolioLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
    gap: 6,
  },
  portfolioLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
  },

  // ─── Gallery ───
  galleryContainer: {
    paddingRight: 16,
  },
  galleryItem: {
    width: 100,
    height: 100,
    borderRadius: 16,
    marginRight: 10,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Phone / Contact ───
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
  },
  phoneIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.success,
  },

  // ─── Detail Actions (bottom bar) ───
  detailsActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: 12,
  },
  callProviderBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.success,
  },
  callProviderText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.success,
  },
  sendRequestButton: {
    flex: 2,
    flexDirection: 'row',
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...SHADOW_LIGHT,
  },
  sendRequestText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },

  // ─── Booking Modal ───
  bookingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  bookingModalContent: {
    backgroundColor: COLORS.cardWhite,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  bookingModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  bookingCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  bookingModalScroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  bookingProviderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.iconBg,
    borderRadius: 22,
    padding: 16,
    marginBottom: 24,
  },
  bookingProviderAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  bookingProviderImage: {
    width: 52,
    height: 52,
    borderRadius: 18,
  },
  bookingProviderInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
  },
  bookingProviderInfo: {
    flex: 1,
  },
  bookingProviderName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  bookingRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  bookingRatingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },

  // ─── Booking Sections ───
  bookingSection: {
    marginBottom: 22,
  },
  bookingSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  bookingSectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.divider,
    gap: 12,
  },
  datePickerText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  eventDescriptionInput: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.divider,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 90,
    lineHeight: 22,
  },

  // ─── Venue ───
  venueButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  venueMapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    ...SHADOW_LIGHT,
  },
  venueMapButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  venueCurrentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondaryLight,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  venueCurrentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  venueSelectedCard: {
    backgroundColor: COLORS.successLight,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  venueSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  venueIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueSelectedAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  venueCoordsText: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },

  // ─── Booking Summary ───
  bookingSummary: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#FDBA74',
  },
  bookingSummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FDBA74',
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  // ─── Booking Actions ───
  bookingActions: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  confirmBookingButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    ...SHADOWS,
  },
  confirmBookingText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.white,
  },
});

export default EventServicesScreen;
