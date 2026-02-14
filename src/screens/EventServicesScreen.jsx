/**
 * Event Services Screen
 * 
 * Handles event-based services (Photographer, Influencer)
 * These services are NOT location-based, instead showcase portfolio/social links
 * Production-grade booking flow for photographers and influencers
 * 
 * @version 2.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Image,
  RefreshControl,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../context/AppContext';
import { useLocation } from '../context/LocationContext';
import { NODE_BASE_URL } from '../config/api';
import { addToFavorites, checkIsFavorite } from '../services/favoritesService';
import { initiateCall } from '../services/callService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  background: '#faf7f7',
  white: '#FFFFFF',
  success: '#10B981',
  neutral: '#6B7280',
};

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
 * Service Card Component - Using MaterialIcon instead of emoji
 */
const ServiceCard = ({ service, onPress }) => (
  <TouchableOpacity
    style={styles.serviceCard}
    onPress={() => onPress(service)}
    activeOpacity={0.7}
  >
    <View style={styles.serviceIconContainer}>
      <MaterialIcon name={service.icon} size={28} color={BRAND.secondary} />
    </View>
    <View style={styles.serviceInfo}>
      <Text style={styles.serviceName}>{service.name}</Text>
      <Text style={styles.serviceDescription}>{service.description}</Text>
    </View>
    <MaterialIcon name="chevron-right" size={24} color="#9CA3AF" />
  </TouchableOpacity>
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
      size={20} 
      color={BRAND.secondary} 
    />
    <Text style={styles.portfolioLinkText}>
      {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </Text>
  </TouchableOpacity>
);

/**
 * Provider Card for Event Services
 */
const EventProviderCard = ({ provider, onViewDetails, onContact }) => {
  // Get profile picture URL - backend returns profilePicture as string or profilePicture.url
  const profilePictureUrl = typeof provider.profilePicture === 'string' 
    ? provider.profilePicture 
    : provider.profilePicture?.url || provider.profileImage;
  
  return (
  <TouchableOpacity 
    style={styles.providerCard}
    onPress={() => onViewDetails(provider)}
    activeOpacity={0.7}
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
            <MaterialIcon name="star" size={10} color="#F59E0B" />
          </View>
        )}
      </View>
      
      <View style={styles.providerInfo}>
        <View style={styles.providerNameRow}>
          <Text style={styles.providerName}>{provider.name}</Text>
          {provider.verified && (
            <MaterialIcon name="verified" size={16} color="#2563EB" />
          )}
        </View>
        
        {provider.bio && (
          <Text style={styles.providerBio} numberOfLines={2}>
            {provider.bio}
          </Text>
        )}
        
        {(provider.rating > 0 || provider.ratings?.average > 0) && (
          <View style={styles.ratingRow}>
            <MaterialIcon name="star" size={14} color="#F59E0B" />
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
                color={BRAND.secondary} 
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
      >
        <Text style={styles.viewButtonText}>View Portfolio</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.contactButton}
        onPress={() => onContact(provider)}
      >
        <MaterialIcon name="chat" size={18} color={BRAND.white} />
        <Text style={styles.contactButtonText}>Contact</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
);
};

/**
 * Provider Details Modal - Production Grade
 * Shows comprehensive provider information for event services
 */
const ProviderDetailsModal = ({ visible, provider, onClose, onBookNow, onContactProvider, sending }) => {
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
      Alert.alert('Error', 'Could not open link');
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
                <MaterialIcon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.detailsHeaderTitle}>Provider Details</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Profile Section - Production Grade */}
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
                    <MaterialIcon name="verified" size={20} color="#10B981" />
                  </View>
                )}
              </View>
              
              <View style={styles.detailsNameSection}>
                <Text style={styles.detailsName}>{provider.name}</Text>
                
                {/* Rating Row */}
                {(provider.rating > 0 || provider.ratings?.average > 0) && (
                  <View style={styles.detailsRating}>
                    <MaterialIcon name="star" size={18} color="#F59E0B" />
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
                    <MaterialIcon name="work" size={14} color="#6B7280" />
                    <Text style={styles.infoText}>{provider.experience} experience</Text>
                  </View>
                )}

                {/* Member Since */}
                {memberSince && (
                  <View style={styles.infoRow}>
                    <MaterialIcon name="calendar-today" size={14} color="#6B7280" />
                    <Text style={styles.infoText}>Member since {memberSince}</Text>
                  </View>
                )}

                {/* Location */}
                {(provider.city || provider.address) && (
                  <View style={styles.infoRow}>
                    <MaterialIcon name="location-on" size={14} color="#6B7280" />
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
                  color: provider.isOnline || provider.isAvailable ? '#10B981' : '#9CA3AF' 
                }]}>
                  {provider.isOnline || provider.isAvailable ? 'Online' : 'Offline'}
                </Text>
                <Text style={styles.statLabel}>Status</Text>
              </View>
            </View>

            {/* Bio */}
            {provider.bio && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>About</Text>
                <View style={styles.bioContainer}>
                  <Text style={styles.detailsBio}>{provider.bio}</Text>
                </View>
              </View>
            )}
            
            {/* Specializations */}
            {provider.specializations && provider.specializations.length > 0 && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>Specializations</Text>
                <View style={styles.specializationsGrid}>
                  {provider.specializations.map((spec, index) => (
                    <View key={index} style={styles.specTagLarge}>
                      <MaterialIcon name="auto-awesome" size={14} color="#7C3AED" />
                      <Text style={styles.specTagText}>{spec}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            {/* Portfolio Links */}
            {provider.portfolioLinks && Object.keys(provider.portfolioLinks).filter(k => provider.portfolioLinks[k]).length > 0 && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>Portfolio & Social</Text>
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
                <Text style={styles.sectionTitle}>Gallery ({provider.portfolioGallery.length})</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.galleryContainer}
                >
                  {provider.portfolioGallery.slice(0, 6).map((item, index) => (
                    <TouchableOpacity 
                      key={index}
                      style={styles.galleryItem}
                      onPress={() => openLink(item.url || item)}
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
              </View>
            )}
            
            {/* Contact - masked call */}
            {provider && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>Contact</Text>
                <TouchableOpacity 
                  style={styles.phoneButton}
                  onPress={() => onContactProvider(provider)}
                >
                  <MaterialIcon name="phone" size={20} color={BRAND.success} />
                  <Text style={styles.phoneText}>Call Provider</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
          
          {/* Action Buttons */}
          <View style={styles.detailsActions}>
            <TouchableOpacity 
              style={styles.callProviderBtn}
              onPress={() => provider && onContactProvider(provider)}
            >
              <MaterialIcon name="phone" size={22} color={BRAND.success} />
              <Text style={styles.callProviderText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.sendRequestButton}
              onPress={() => onBookNow(provider)}
              disabled={sending}
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
      const response = await fetch(`${NODE_BASE_URL}/api/event-services/providers`, {
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
        Alert.alert('Error', data.error || 'Failed to fetch providers');
      }
    } catch (error) {
      console.error('Fetch providers error:', error);
      Alert.alert('Error', 'Failed to fetch providers');
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
   * Handle contact provider (Exotel masked call)
   */
  const handleContactProvider = async (provider) => {
    if (!provider?._id) {
      Alert.alert('Error', 'Provider information not available');
      return;
    }

    Alert.alert(
      'Contact Provider',
      `Call ${provider.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: async () => {
            try {
              const result = await initiateCall({
                receiverId: provider._id,
                callerType: 'user',
                serviceType: 'event',
              });

              if (result.success) {
                Alert.alert(
                  'Connecting Call',
                  'You will receive a call shortly. Once you pick up, we will connect you to the provider.',
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert('Call Failed', result.error || 'Unable to connect. Please try again.');
              }
            } catch (error) {
              console.error('[EventServices] Call error:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            }
          },
        },
      ]
    );
  };
  
  /**
   * Open booking modal - Production-grade booking flow
   */
  const handleOpenBooking = (provider) => {
    setSelectedProvider(provider);
    setShowDetails(false);
    setEventDate(new Date());
    setEventDescription('');
    setEventVenue('');
    setShowBookingModal(true);
  };
  
  /**
   * Handle send booking request with all required fields
   * Production-grade implementation
   */
  const handleSendRequest = async () => {
    if (!selectedProvider) {
      Alert.alert('Error', 'Please select a provider');
      return;
    }
    
    if (!eventDate) {
      Alert.alert('Error', 'Please select an event date');
      return;
    }
    
    if (!eventVenue.trim()) {
      Alert.alert('Error', 'Please enter the event venue/address');
      return;
    }
    
    setSendingRequest(true);
    
    try {
      // Build location data from user's input and current location
      const locationData = {
        address: eventVenue.trim(),
        coordinates: selectedLocation?.coordinates ? [
          selectedLocation.coordinates.longitude,
          selectedLocation.coordinates.latitude
        ] : null,
        landmark: '',
      };
      
      // Create service request with ALL required fields including location
      const createResponse = await fetch(`${NODE_BASE_URL}/api/event-services/create-service`, {
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
        throw new Error(createData.message || createData.error || 'Failed to create request');
      }
      
      const serviceId = createData.data?._id || createData._id;
      if (!serviceId) {
        throw new Error('No service ID returned from creation');
      }
      
      // Then send to provider
      const sendResponse = await fetch(
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
        Alert.alert(
          '🎉 Request Sent!',
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
          await fetch(`${NODE_BASE_URL}/api/event-services/${serviceId}/cancel`, {
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
      Alert.alert('Error', error.message || 'Failed to send booking request');
    } finally {
      setSendingRequest(false);
    }
  };
  
  /**
   * Handle add to favorites
   */
  const handleAddFavorite = async (provider) => {
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
      
      Alert.alert('Added!', `${provider.name} added to favorites`);
    } else {
      Alert.alert('Error', result.error || 'Failed to add to favorites');
    }
  };
  
  /**
   * Render header
   */
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => {
          if (step === 'select') {
            navigation.goBack();
          } else {
            setStep('select');
            setSelectedService(null);
            setProviders([]);
          }
        }}
      >
        <MaterialIcon name="arrow-back" size={24} color="#1F2937" />
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
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={styles.loadingText}>Finding {selectedService?.name}s...</Text>
        </View>
      ) : providers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcon name="search-off" size={64} color="#D1D5DB" />
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
              colors={[BRAND.primary]}
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
      
      {/* Provider Details Modal - Production Grade */}
      <ProviderDetailsModal
        visible={showDetails}
        provider={selectedProvider}
        onClose={() => setShowDetails(false)}
        onBookNow={handleOpenBooking}
        onContactProvider={handleContactProvider}
        sending={sendingRequest}
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
                style={styles.closeDetailButton}
                onPress={() => setShowBookingModal(false)}
              >
                <MaterialIcon name="close" size={24} color="#6B7280" />
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
                        <MaterialIcon name="star" size={14} color="#F59E0B" />
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
                <Text style={styles.bookingSectionTitle}>
                  <MaterialIcon name="event" size={16} color={BRAND.primary} /> Event Date *
                </Text>
                <TouchableOpacity 
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <MaterialIcon name="calendar-today" size={20} color={BRAND.secondary} />
                  <Text style={styles.datePickerText}>
                    {eventDate.toLocaleDateString('en-IN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </Text>
                  <MaterialIcon name="edit" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Event Description */}
              <View style={styles.bookingSection}>
                <Text style={styles.bookingSectionTitle}>
                  <MaterialIcon name="description" size={16} color={BRAND.primary} /> Event Details (Optional)
                </Text>
                <TextInput
                  style={styles.eventDescriptionInput}
                  placeholder="Describe your event (e.g., Wedding, Birthday Party, Corporate Event...)"
                  placeholderTextColor="#9CA3AF"
                  value={eventDescription}
                  onChangeText={setEventDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Event Venue/Location */}
              <View style={styles.bookingSection}>
                <Text style={styles.bookingSectionTitle}>
                  <MaterialIcon name="location-on" size={16} color={BRAND.primary} /> Event Venue *
                </Text>
                <TextInput
                  style={styles.eventVenueInput}
                  placeholder="Enter event address (e.g., Hotel Grand, MG Road, Mumbai)"
                  placeholderTextColor="#9CA3AF"
                  value={eventVenue}
                  onChangeText={setEventVenue}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
                {selectedLocation?.address && (
                  <TouchableOpacity 
                    style={styles.useCurrentLocationBtn}
                    onPress={() => setEventVenue(selectedLocation.address)}
                  >
                    <MaterialIcon name="my-location" size={16} color={BRAND.secondary} />
                    <Text style={styles.useCurrentLocationText}>Use current location</Text>
                  </TouchableOpacity>
                )}
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
                <View style={styles.summaryRow}>
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
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: BRAND.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  introSection: {
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  
  // Service Card
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  serviceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  serviceIconEmoji: {
    fontSize: 28,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  
  // Providers
  providersContainer: {
    flex: 1,
  },
  providersList: {
    padding: 16,
    paddingBottom: 32,
  },
  providerCard: {
    backgroundColor: BRAND.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  providerHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  providerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  providerInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: BRAND.white,
  },
  favoriteBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BRAND.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
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
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 6,
  },
  providerBio: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  
  // Specializations
  specializationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  specializationTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  specializationText: {
    fontSize: 12,
    color: BRAND.secondary,
    fontWeight: '500',
  },
  
  // Links Preview
  linksPreview: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  
  // Provider Actions
  providerActions: {
    flexDirection: 'row',
  },
  viewButton: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.secondary,
  },
  contactButton: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.white,
    marginLeft: 6,
  },
  
  // Loading & Empty
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailsModalContent: {
    backgroundColor: BRAND.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  detailsHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeDetailButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  detailsAvatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  detailsAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BRAND.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  detailsAvatarInitial: {
    fontSize: 32,
    fontWeight: '600',
    color: BRAND.white,
  },
  favoriteButton: {
    position: 'absolute',
    bottom: 0,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailsName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  detailsBio: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  detailsRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsRatingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 4,
  },
  detailsRatingCount: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  
  // Details Sections
  detailsSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  specializationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specTagLarge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  specTagText: {
    fontSize: 13,
    color: BRAND.secondary,
    fontWeight: '500',
  },
  
  // Portfolio Links
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  portfolioLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  portfolioLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: BRAND.secondary,
    marginLeft: 6,
  },
  
  // Gallery
  galleryContainer: {
    paddingRight: 16,
  },
  galleryItem: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 8,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Phone
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  phoneText: {
    fontSize: 16,
    fontWeight: '500',
    color: BRAND.success,
    marginLeft: 8,
  },
  
  // Actions
  detailsActions: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  callProviderBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: BRAND.success,
  },
  callProviderText: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.success,
  },
  sendRequestButton: {
    flex: 2,
    flexDirection: 'row',
    height: 52,
    borderRadius: 26,
    backgroundColor: BRAND.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  sendRequestText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND.white,
  },

  // Enhanced Provider Details Modal
  detailsHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailsHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  detailsProfileSection: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  detailsNameSection: {
    flex: 1,
    marginLeft: 16,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  bioContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },

  // Booking Modal Styles
  bookingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bookingModalContent: {
    backgroundColor: BRAND.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  bookingModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  bookingModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  bookingModalScroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bookingProviderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  bookingProviderAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bookingProviderImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  bookingProviderInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: BRAND.white,
  },
  bookingProviderInfo: {
    flex: 1,
  },
  bookingProviderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  bookingRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  bookingRatingText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  bookingSection: {
    marginBottom: 20,
  },
  bookingSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  datePickerText: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  eventDescriptionInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    color: '#1F2937',
    minHeight: 80,
  },
  eventVenueInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    color: '#1F2937',
    minHeight: 60,
  },
  useCurrentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    gap: 6,
  },
  useCurrentLocationText: {
    fontSize: 13,
    color: BRAND.secondary,
    fontWeight: '500',
  },
  bookingSummary: {
    backgroundColor: '#FEF9F4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  bookingSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.primary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  bookingActions: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  confirmBookingButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  confirmBookingText: {
    fontSize: 17,
    fontWeight: '700',
    color: BRAND.white,
  },
});

export default EventServicesScreen;
