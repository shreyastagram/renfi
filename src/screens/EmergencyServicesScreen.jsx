/**
 * Emergency Services Screen
 *
 * Handles two types of emergency services:
 * 1. Location-based: Snake Catcher, Private Ambulance, Mortuary Van
 * 2. Static Numbers: Fire Brigade, Police, Hospital
 *
 * @version 2.0.0 — Premium UI revamp
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
  RefreshControl,
  TextInput,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLocation } from '../context/LocationContext';
import {
  EMERGENCY_SERVICE_TYPES,
  LOCATION_BASED_SERVICES,
  STATIC_NUMBER_SERVICES,
  EMERGENCY_SERVICE_LABELS,
  EMERGENCY_SERVICE_ICONS,
  getStaticEmergencyNumbers,
  createEmergencyRequest,
  getNearbyEmergencyProviders,
  assignEmergencyProvider,
  rejectEmergencyProvider,
  cancelEmergencyRequest,
} from '../services/emergencyServicesService';
import { addToFavorites } from '../services/favoritesService';
import { CancellationReasonModal } from '../components';
import { formatDistance, formatDistanceFromMeters, useDistanceUnit } from '../utils/formatDistance';
// Direct phone dialing - Exotel call masking removed

// Service-specific placeholder hints for notes input
const EMERGENCY_NOTES_PLACEHOLDERS = {
  snake_catcher: 'e.g., Snake spotted in backyard near the fence...',
  private_ambulance: 'e.g., Patient needs urgent transport to hospital, stretcher required...',
  mortuary_van: 'e.g., Need vehicle for deceased family member transport from home...',
};

// Premium design tokens
const COLORS = {
  darkHero: '#0F172A',
  background: '#F1F5F9',
  cardWhite: '#FFFFFF',
  primary: '#f67c16',
  secondary: '#2b76bc',
  muted: '#94A3B8',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FECACA',
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  divider: '#E2E8F0',
  inputBg: '#F8FAFC',
  white: '#FFFFFF',
};

const SHADOWS = Platform.select({
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

const CARD_RADIUS = 22;

/**
 * Animated press wrapper for premium spring scale effect
 */
const AnimatedPressable = ({ children, onPress, style, disabled }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * Service Card Component - Premium design with animated press
 */
const ServiceCard = ({ service, onPress, isStatic }) => (
  <AnimatedPressable
    style={[styles.serviceCard, isStatic && styles.staticServiceCard]}
    onPress={() => onPress(service)}
  >
    <View style={[styles.serviceIconContainer, isStatic && styles.staticIconContainer]}>
      <MaterialIcon
        name={EMERGENCY_SERVICE_ICONS[service.id]}
        size={24}
        color={isStatic ? COLORS.danger : COLORS.secondary}
      />
    </View>
    <Text style={styles.serviceName} numberOfLines={2}>{service.name}</Text>
    {isStatic && (
      <View style={styles.staticBadge}>
        <MaterialIcon name="phone" size={11} color={COLORS.danger} />
        <Text style={styles.staticBadgeText}>Call</Text>
      </View>
    )}
  </AnimatedPressable>
);

/**
 * Provider Card Component — Premium with profile picture, phone, status
 */
const ProviderCard = ({ provider, onCall, onBook, onPress, booking, isFavorite, hasContacted }) => {
  const useKm = useDistanceUnit();
  const profilePictureUrl = typeof provider.profilePicture === 'string'
    ? provider.profilePicture
    : provider.profilePicture?.url || provider.profileImage || null;

  const phone = provider.phone || provider.verifiedPhone || '';

  return (
    <AnimatedPressable
      style={styles.providerCard}
      onPress={onPress}
    >
      <View style={styles.providerInfo}>
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
          {isFavorite && (
            <View style={styles.favoriteBadge}>
              <MaterialIcon name="star" size={10} color={COLORS.warning} />
            </View>
          )}
        </View>
        <View style={styles.providerDetails}>
          <View style={styles.providerNameRow}>
            <Text style={styles.providerName} numberOfLines={1}>{provider.name}</Text>
            {(provider.verified || provider.isVerified) && (
              <MaterialIcon name="verified" size={16} color="#2563EB" style={styles.verifiedBadge} />
            )}
          </View>
          <View style={styles.providerDistanceRow}>
            <MaterialIcon name="location-on" size={14} color={COLORS.muted} />
            <Text style={styles.providerDistance}>
              {provider.distanceKm ? formatDistance(provider.distanceKm, useKm) :
               provider.distance != null ? formatDistanceFromMeters(Number(provider.distance), useKm) : 'Nearby'}
            </Text>
          </View>
          {(provider.rating > 0 || provider.ratings?.average > 0) && (
            <View style={styles.providerRatingRow}>
              <MaterialIcon name="star" size={14} color={COLORS.warning} />
              <Text style={styles.providerRating}>
                {(provider.ratings?.average || provider.rating || 0).toFixed(1)}
              </Text>
              {(provider.ratings?.total > 0 || provider.totalRatings > 0) && (
                <Text style={styles.providerRatingCount}>
                  ({provider.ratings?.total || provider.totalRatings} reviews)
                </Text>
              )}
            </View>
          )}
          {phone ? (
            <View style={styles.providerPhoneRow}>
              <MaterialIcon name="phone" size={13} color={COLORS.success} />
              <Text style={styles.providerPhoneText}>{phone}</Text>
            </View>
          ) : null}
          {/* Online/Available status */}
          <View style={styles.providerStatusRow}>
            <View style={[styles.statusDot, { backgroundColor: (provider.isOnline || provider.isAvailable) ? COLORS.success : COLORS.muted }]} />
            <Text style={[styles.providerStatusText, { color: (provider.isOnline || provider.isAvailable) ? COLORS.success : COLORS.muted }]}>
              {(provider.isOnline || provider.isAvailable) ? 'Available' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.providerActions}>
        <TouchableOpacity
          style={styles.callButton}
          onPress={(e) => {
            e.stopPropagation();
            onCall(provider);
          }}
          activeOpacity={0.8}
        >
          <MaterialIcon name="phone" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bookButton, booking && styles.bookButtonLoading, !hasContacted && { opacity: 0.5 }]}
          onPress={(e) => {
            e.stopPropagation();
            onBook(provider);
          }}
          disabled={booking}
          activeOpacity={0.8}
        >
          {booking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.bookButtonText}>{hasContacted ? 'Send Request' : 'Call First'}</Text>
          )}
        </TouchableOpacity>
      </View>
      {/* View Details indicator */}
      <View style={styles.viewDetailsHint}>
        <Text style={styles.viewDetailsText}>Tap for details</Text>
        <MaterialIcon name="chevron-right" size={16} color={COLORS.muted} />
      </View>
    </AnimatedPressable>
  );
};

/**
 * Static Numbers Modal — Premium bottom sheet
 */
const StaticNumbersModal = ({ visible, onClose, numbers, serviceType }) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        {/* Drag handle */}
        <View style={styles.modalDragHandle} />
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderLeft}>
            <View style={styles.modalIconWrap}>
              <MaterialIcon name="phone-in-talk" size={20} color={COLORS.danger} />
            </View>
            <Text style={styles.modalTitle}>
              {EMERGENCY_SERVICE_LABELS[serviceType] || 'Emergency'} Numbers
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcon name="close" size={20} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.numbersContainer} showsVerticalScrollIndicator={false}>
          {numbers.length === 0 ? (
            <View style={styles.emptyNumbersContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialIcon name="phone-disabled" size={36} color={COLORS.muted} />
              </View>
              <Text style={styles.noNumbersText}>No numbers available</Text>
              <Text style={styles.noNumbersSubtext}>Check back later or call 112 for emergencies</Text>
            </View>
          ) : (
            numbers.map((item, index) => (
              <View key={index} style={[styles.numberCard, index === numbers.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.numberInfo}>
                  <Text style={styles.numberLabel}>{item.label || item.name}</Text>
                  {item.description && (
                    <Text style={styles.numberDescription}>{item.description}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.callNumberButton}
                  onPress={() => Linking.openURL(`tel:${item.number}`)}
                  activeOpacity={0.8}
                >
                  <MaterialIcon name="phone" size={18} color={COLORS.white} />
                  <Text style={styles.callNumberText}>{item.number}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        <TouchableOpacity style={styles.closeModalButton} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.closeModalButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

/**
 * Emergency Provider Details Modal — Premium design
 */
const EmergencyProviderDetailsModal = ({ visible, provider, onClose, onCall, onBook, hasContacted, booking }) => {
  const { dialog } = useDialog();
  const useKm = useDistanceUnit();
  if (!provider) return null;

  const profilePictureUrl = typeof provider.profilePicture === 'string'
    ? provider.profilePicture
    : provider.profilePicture?.url || provider.profileImage || null;

  const phone = provider.phone || provider.verifiedPhone || '';

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

  const memberSince = getMemberSince();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={detailStyles.overlay}>
        <View style={detailStyles.container}>
          {/* Drag handle */}
          <View style={detailStyles.dragHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={detailStyles.header}>
              <TouchableOpacity style={detailStyles.closeBtn} onPress={onClose}>
                <MaterialIcon name="close" size={20} color={COLORS.muted} />
              </TouchableOpacity>
              <Text style={detailStyles.headerTitle}>Provider Details</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Profile Section */}
            <View style={detailStyles.profileSection}>
              <View style={detailStyles.avatarContainer}>
                {profilePictureUrl ? (
                  <Image
                    source={{ uri: profilePictureUrl }}
                    style={detailStyles.avatarImage}
                  />
                ) : (
                  <View style={detailStyles.avatarPlaceholder}>
                    <Text style={detailStyles.avatarInitial}>
                      {provider.name?.charAt(0)?.toUpperCase() || 'P'}
                    </Text>
                  </View>
                )}
                {(provider.verified || provider.isVerified || provider.isFullyVerified) && (
                  <View style={detailStyles.verifiedBadge}>
                    <MaterialIcon name="verified" size={20} color={COLORS.success} />
                  </View>
                )}
              </View>

              <View style={detailStyles.nameSection}>
                <Text style={detailStyles.providerName}>{provider.name}</Text>

                {/* Rating */}
                {(provider.rating > 0 || provider.ratings?.average > 0) && (
                  <View style={detailStyles.ratingRow}>
                    <MaterialIcon name="star" size={18} color={COLORS.warning} />
                    <Text style={detailStyles.ratingText}>
                      {(provider.ratings?.average || provider.rating || 0).toFixed(1)}
                    </Text>
                    {(provider.ratings?.total > 0 || provider.totalRatings > 0) && (
                      <Text style={detailStyles.ratingCount}>
                        ({provider.ratings?.total || provider.totalRatings} reviews)
                      </Text>
                    )}
                  </View>
                )}

                {/* Experience */}
                {provider.experience && (
                  <View style={detailStyles.infoRow}>
                    <MaterialIcon name="work" size={14} color={COLORS.muted} />
                    <Text style={detailStyles.infoText}>{provider.experience} experience</Text>
                  </View>
                )}

                {/* Member Since */}
                {memberSince && (
                  <View style={detailStyles.infoRow}>
                    <MaterialIcon name="calendar-today" size={14} color={COLORS.muted} />
                    <Text style={detailStyles.infoText}>Member since {memberSince}</Text>
                  </View>
                )}

                {/* Distance */}
                {(provider.distanceKm || provider.distance != null) && (
                  <View style={detailStyles.infoRow}>
                    <MaterialIcon name="location-on" size={14} color={COLORS.primary} />
                    <Text style={detailStyles.infoText}>
                      {provider.distanceKm ? `${formatDistance(provider.distanceKm, useKm)} away` :
                       `${formatDistanceFromMeters(Number(provider.distance), useKm)} away`}
                    </Text>
                  </View>
                )}

                {/* City/Address */}
                {(provider.city || provider.address) && (
                  <View style={detailStyles.infoRow}>
                    <MaterialIcon name="place" size={14} color={COLORS.muted} />
                    <Text style={detailStyles.infoText}>
                      {provider.city || provider.address}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Stats Row */}
            <View style={detailStyles.statsRow}>
              <View style={detailStyles.statItem}>
                <Text style={detailStyles.statValue}>
                  {provider.stats?.completedRequests || provider.completedJobs || 0}
                </Text>
                <Text style={detailStyles.statLabel}>Jobs Done</Text>
              </View>
              <View style={detailStyles.statDivider} />
              <View style={detailStyles.statItem}>
                <Text style={detailStyles.statValue}>
                  {provider.ratings?.total || provider.totalRatings || 0}
                </Text>
                <Text style={detailStyles.statLabel}>Reviews</Text>
              </View>
              <View style={detailStyles.statDivider} />
              <View style={detailStyles.statItem}>
                <Text style={[detailStyles.statValue, {
                  color: (provider.isOnline || provider.isAvailable) ? COLORS.success : COLORS.muted
                }]}>
                  {(provider.isOnline || provider.isAvailable) ? 'Online' : 'Offline'}
                </Text>
                <Text style={detailStyles.statLabel}>Status</Text>
              </View>
            </View>

            {/* Bio */}
            {provider.bio ? (
              <View style={detailStyles.section}>
                <View style={detailStyles.sectionHeaderRow}>
                  <View style={detailStyles.sectionAccent} />
                  <Text style={detailStyles.sectionTitle}>About</Text>
                </View>
                <View style={detailStyles.bioContainer}>
                  <Text style={detailStyles.bioText}>{provider.bio}</Text>
                </View>
              </View>
            ) : null}

            {/* Services */}
            {provider.verifiedServiceCategories && provider.verifiedServiceCategories.length > 0 && (
              <View style={detailStyles.section}>
                <View style={detailStyles.sectionHeaderRow}>
                  <View style={detailStyles.sectionAccent} />
                  <Text style={detailStyles.sectionTitle}>Verified Services</Text>
                </View>
                <View style={detailStyles.tagsContainer}>
                  {provider.verifiedServiceCategories.map((cat, index) => (
                    <View key={index} style={detailStyles.serviceTag}>
                      <MaterialIcon name="verified" size={12} color={COLORS.success} />
                      <Text style={detailStyles.serviceTagText}>
                        {EMERGENCY_SERVICE_LABELS[cat] || cat.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Contact Section */}
            <View style={detailStyles.section}>
              <View style={detailStyles.sectionHeaderRow}>
                <View style={detailStyles.sectionAccent} />
                <Text style={detailStyles.sectionTitle}>Contact</Text>
              </View>
              {phone ? (
                <TouchableOpacity
                  style={detailStyles.phoneButton}
                  onPress={() => onCall(provider)}
                  activeOpacity={0.8}
                >
                  <View style={detailStyles.phoneIconWrap}>
                    <MaterialIcon name="phone" size={18} color={COLORS.success} />
                  </View>
                  <Text style={detailStyles.phoneButtonText}>
                    Call Provider ({phone})
                  </Text>
                  <MaterialIcon name="chevron-right" size={18} color={COLORS.muted} />
                </TouchableOpacity>
              ) : (
                <Text style={detailStyles.noPhoneText}>Phone number not available</Text>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={detailStyles.actions}>
            <TouchableOpacity
              style={detailStyles.callActionBtn}
              onPress={() => onCall(provider)}
              activeOpacity={0.8}
            >
              <MaterialIcon name="phone" size={20} color={COLORS.success} />
              <Text style={detailStyles.callActionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[detailStyles.bookActionBtn, !hasContacted && { opacity: 0.5 }]}
              onPress={() => {
                if (!hasContacted) {
                  dialog('Call First', 'Please call the provider to discuss the emergency details before sending a request.', [{ text: 'OK' }]);
                  return;
                }
                onBook(provider);
              }}
              disabled={booking}
              activeOpacity={0.8}
            >
              {booking ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcon name="send" size={18} color={COLORS.white} />
                  <Text style={detailStyles.bookActionText}>
                    {hasContacted ? 'Send Request' : 'Call First'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const EmergencyServicesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile } = useApp();
  const { dialog } = useDialog();
  const { currentLocation, displayAddress, locationLoading, refreshLocation } = useLocation();

  // User ID
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  // State
  const [selectedService, setSelectedService] = useState(null);
  const [step, setStep] = useState('select'); // select, providers, static
  const [isLoading, setIsLoading] = useState(false);
  const [createdRequest, setCreatedRequest] = useState(null);
  const [providers, setProviders] = useState([]);
  const [staticNumbers, setStaticNumbers] = useState([]);
  const [bookingProvider, setBookingProvider] = useState(null);
  const [notes, setNotes] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Track which providers the user has called (call-before-book enforcement)
  const [contactedProviderIds, setContactedProviderIds] = useState(new Set());

  // Cancel reason modal state
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);

  // Service categories
  const locationBasedServices = LOCATION_BASED_SERVICES.map(id => ({
    id,
    name: EMERGENCY_SERVICE_LABELS[id],
  }));

  const staticServices = STATIC_NUMBER_SERVICES.map(id => ({
    id,
    name: EMERGENCY_SERVICE_LABELS[id],
  }));

  /**
   * Handle service selection
   */
  const handleServiceSelect = async (service) => {
    setSelectedService(service);

    if (STATIC_NUMBER_SERVICES.includes(service.id)) {
      // Static service - fetch numbers
      setIsLoading(true);
      const result = await getStaticEmergencyNumbers(service.id);
      setIsLoading(false);

      if (result.success) {
        // Handle both array format and object format
        const numbers = Array.isArray(result.data)
          ? result.data
          : result.data?.numbers || [];
        setStaticNumbers(numbers);
        setStep('static');
      } else {
        dialog('Error', result.error || 'Failed to fetch emergency numbers');
      }
    } else {
      // Location-based service - show notes input
      setShowNotesInput(true);
    }
  };

  /**
   * Create emergency request and fetch providers
   */
  const handleCreateRequest = async () => {
    if (!currentLocation) {
      dialog('Location Required', 'Please enable location to request emergency services.');
      refreshLocation();
      return;
    }

    setIsLoading(true);
    setShowNotesInput(false);

    // Create request
    const createResult = await createEmergencyRequest({
      userId,
      serviceType: selectedService.id,
      location: {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: displayAddress,
      },
      notes,
    });

    if (!createResult.success) {
      setIsLoading(false);
      if (createResult.code === 'OUTSIDE_SERVICE_ZONE') {
        dialog(
          'Service Unavailable in Your Area',
          createResult.suggestion || 'Emergency services are currently available only in Yavatmal City, Maharashtra. For emergencies outside this zone, please call 112.',
          [{ text: 'OK' }]
        );
      } else {
        dialog('Error', createResult.error || 'Failed to create request');
      }
      return;
    }

    setCreatedRequest(createResult.data);

    // Fetch nearby providers
    const providersResult = await getNearbyEmergencyProviders(createResult.data._id);
    setIsLoading(false);

    console.log('[EmergencyScreen] Providers result:', {
      success: providersResult.success,
      providersCount: providersResult.providers?.length,
      providers: providersResult.providers
    });

    if (providersResult.success && providersResult.providers?.length > 0) {
      setProviders(providersResult.providers);
      setStep('providers');
    } else {
      dialog('No Providers', providersResult.error || 'No providers available nearby');
    }
  };

  /**
   * View provider details
   */
  const handleViewDetails = (provider) => {
    setSelectedProvider(provider);
    setShowDetails(true);
  };

  /**
   * Handle calling provider - direct phone dialing with contact tracking
   */
  const handleCallProvider = (provider) => {
    // Robust phone resolution: check all possible phone fields
    const phone = provider?.phone || provider?.verifiedPhone || provider?.mobileNumber || '';
    const stripped = phone.replace(/[\s\-()]/g, '');

    if (!stripped) {
      dialog(
        'Phone Not Available',
        'This provider\'s phone number is not yet available. Please try viewing their full profile or try again later.',
        [{ text: 'OK' }]
      );
      return;
    }

    const phoneNumber = stripped.startsWith('+') ? stripped :
                        stripped.startsWith('91') ? `+${stripped}` : `+91${stripped}`;

    dialog(
      'Call Provider',
      `Call ${provider.name || 'Provider'} at ${phone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          onPress: () => {
            // Track that user has contacted this provider
            setContactedProviderIds(prev => new Set(prev).add(provider._id));
            Linking.openURL(`tel:${phoneNumber}`).catch(() => {
              dialog('Error', 'Unable to make phone calls on this device');
            });
          },
        },
      ]
    );
  };

  /**
   * Handle booking provider - User selects a provider
   */
  const handleBookProvider = async (provider) => {
    if (!createdRequest) return;

    // Enforce call-before-book: user must call provider first
    if (!contactedProviderIds.has(provider._id)) {
      dialog(
        'Call First',
        'Please call the provider to discuss the emergency details before sending a request.',
        [{ text: 'OK' }]
      );
      return;
    }

    setBookingProvider(provider._id);

    try {
      const result = await assignEmergencyProvider(createdRequest._id, provider._id);

      if (result.success) {
        setBookingProvider(null);
        dialog(
          'Request Sent!',
          `Your request has been sent to ${provider.name}. They will review and confirm shortly.`,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        setBookingProvider(null);
        dialog('Error', result.error || 'Failed to send request');
      }
    } catch (error) {
      console.error('[Emergency] Book provider error:', error);
      dialog('Error', 'Something went wrong. Please try again.');
    } finally {
      setBookingProvider(null);
    }
  };

  /**
   * Handle reject provider
   */
  const handleRejectProvider = async (providerId) => {
    if (!createdRequest) return;

    dialog(
      'Reject Provider',
      'Are you sure you want to remove this provider from the list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            const result = await rejectEmergencyProvider(createdRequest._id, providerId);
            if (result.success) {
              setProviders(prev => prev.filter(p => p._id !== providerId));
            }
          },
        },
      ]
    );
  };

  /**
   * Retry search for providers
   */
  const handleRetrySearch = async () => {
    if (!createdRequest) return;

    setRefreshing(true);

    const result = await getNearbyEmergencyProviders(createdRequest._id);

    setRefreshing(false);

    if (result.success) {
      setProviders(result.providers || []);
      if ((result.providers || []).length === 0) {
        dialog('No Providers', 'No more providers available in your area.');
      }
    } else {
      dialog('Error', result.error || 'Failed to refresh providers');
    }
  };

  /**
   * Handle cancel request — opens reason modal
   */
  const handleCancelRequest = () => {
    if (!createdRequest) {
      resetState();
      return;
    }
    setCancelModalVisible(true);
  };

  /**
   * Execute cancellation after user selects a reason from the modal
   */
  const executeCancellation = async (reason) => {
    setCancellingRequest(true);
    try {
      if (createdRequest) {
        await cancelEmergencyRequest(createdRequest._id, reason, 'user');
      }
      setCancelModalVisible(false);
      resetState();
    } catch (error) {
      console.error('[Emergency Cancel] Error:', error);
      dialog('Error', 'Failed to cancel request');
    } finally {
      setCancellingRequest(false);
    }
  };

  /**
   * Reset state
   */
  const resetState = () => {
    setSelectedService(null);
    setStep('select');
    setCreatedRequest(null);
    setProviders([]);
    setStaticNumbers([]);
    setNotes('');
    setShowNotesInput(false);
    setShowDetails(false);
    setSelectedProvider(null);
    setContactedProviderIds(new Set()); // Reset per search session
  };

  /**
   * Render premium header with dark background
   */
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          if (step === 'select') {
            navigation.goBack();
          } else {
            if (step === 'providers' && createdRequest) {
              handleCancelRequest();
            } else {
              resetState();
            }
          }
        }}
        activeOpacity={0.7}
      >
        <MaterialIcon name="arrow-back" size={22} color={COLORS.white} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>
          {step === 'select' ? 'Emergency Services' :
           step === 'static' ? EMERGENCY_SERVICE_LABELS[selectedService?.id] :
           'Nearby Providers'}
        </Text>
        {step === 'select' && (
          <Text style={styles.headerSubtitle}>Quick access to help when you need it</Text>
        )}
      </View>
      {/* Emergency pulse indicator */}
      <View style={styles.emergencyIndicator}>
        <View style={styles.emergencyDot} />
      </View>
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
      {/* Location-based Services */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccentBar} />
        <View style={styles.sectionIconContainer}>
          <MaterialIcon name="location-on" size={20} color={COLORS.primary} />
        </View>
        <Text style={styles.sectionTitle}>Location-Based Services</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        Find nearby providers for these services
      </Text>

      <View style={styles.servicesGrid}>
        {locationBasedServices.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            onPress={handleServiceSelect}
            isStatic={false}
          />
        ))}
      </View>

      {/* Static Number Services */}
      <View style={[styles.sectionHeader, { marginTop: 28 }]}>
        <View style={[styles.sectionAccentBar, { backgroundColor: COLORS.danger }]} />
        <View style={[styles.sectionIconContainer, { backgroundColor: COLORS.dangerLight }]}>
          <MaterialIcon name="phone" size={20} color={COLORS.danger} />
        </View>
        <Text style={styles.sectionTitle}>Emergency Helplines</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        Call these numbers directly for immediate help
      </Text>

      <View style={styles.servicesGrid}>
        {staticServices.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            onPress={handleServiceSelect}
            isStatic={true}
          />
        ))}
      </View>

      {/* Emergency info card */}
      <View style={styles.emergencyInfoCard}>
        <View style={styles.emergencyInfoIcon}>
          <MaterialIcon name="info-outline" size={20} color={COLORS.danger} />
        </View>
        <View style={styles.emergencyInfoContent}>
          <Text style={styles.emergencyInfoTitle}>In case of life-threatening emergency</Text>
          <Text style={styles.emergencyInfoText}>Dial 112 immediately for police, fire, or ambulance services.</Text>
        </View>
      </View>
    </ScrollView>
  );

  /**
   * Render providers list
   */
  const renderProvidersList = () => (
    <View style={styles.providersContainer}>
      <View style={styles.providersHeader}>
        <View>
          <Text style={styles.providersTitle}>
            {providers.length} Provider{providers.length !== 1 ? 's' : ''} Found
          </Text>
          <Text style={styles.providersSubtitle}>
            Call first, then send your request
          </Text>
        </View>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetrySearch}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <MaterialIcon name="refresh" size={16} color={COLORS.primary} />
              <Text style={styles.retryButtonText}>Refresh</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {providers.length === 0 ? (
        <View style={styles.emptyProviders}>
          <View style={styles.emptyIconCircle}>
            <MaterialIcon name="search-off" size={44} color={COLORS.muted} />
          </View>
          <Text style={styles.emptyText}>No providers available</Text>
          <Text style={styles.emptySubtext}>
            All providers have been rejected or none are available nearby
          </Text>
          <TouchableOpacity
            style={styles.retryLargeButton}
            onPress={handleRetrySearch}
            activeOpacity={0.8}
          >
            <MaterialIcon name="refresh" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
            <Text style={styles.retryLargeButtonText}>Search Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ProviderCard
              provider={item}
              onCall={handleCallProvider}
              onBook={handleBookProvider}
              onPress={() => handleViewDetails(item)}
              booking={bookingProvider === item._id}
              isFavorite={item.isFavorite}
              hasContacted={contactedProviderIds.has(item._id)}
            />
          )}
          contentContainerStyle={styles.providersList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRetrySearch}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={handleCancelRequest}
        activeOpacity={0.8}
      >
        <MaterialIcon name="close" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
        <Text style={styles.cancelButtonText}>Cancel Request</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render notes input modal
   */
  const renderNotesInput = () => (
    <Modal
      visible={showNotesInput}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowNotesInput(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.notesModalContent}>
          {/* Drag handle */}
          <View style={styles.modalDragHandle} />
          <View style={styles.notesModalHeader}>
            <View style={styles.notesModalIconWrap}>
              <MaterialIcon
                name={EMERGENCY_SERVICE_ICONS[selectedService?.id] || 'warning'}
                size={22}
                color={COLORS.primary}
              />
            </View>
            <View>
              <Text style={styles.notesModalTitle}>
                {EMERGENCY_SERVICE_LABELS[selectedService?.id]} Request
              </Text>
              <Text style={styles.notesModalSubtitle}>
                Add any details that might help the provider
              </Text>
            </View>
          </View>

          <TextInput
            style={styles.notesInput}
            placeholder={EMERGENCY_NOTES_PLACEHOLDERS[selectedService?.id] || 'Add details to help the provider...'}
            placeholderTextColor={COLORS.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <View style={styles.locationPreview}>
            <View style={styles.locationIconWrap}>
              <MaterialIcon name="location-on" size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.locationText} numberOfLines={2}>
              {displayAddress || 'Fetching location...'}
            </Text>
          </View>

          <View style={styles.notesModalActions}>
            <TouchableOpacity
              style={styles.notesModalCancelButton}
              onPress={() => {
                setShowNotesInput(false);
                setSelectedService(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.notesModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notesModalConfirmButton}
              onPress={handleCreateRequest}
              disabled={isLoading || locationLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcon name="search" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.notesModalConfirmText}>Find Providers</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}

      {isLoading && step === 'select' ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIconCircle}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
          <Text style={styles.loadingText}>Finding providers...</Text>
          <Text style={styles.loadingSubtext}>Searching nearby emergency services</Text>
        </View>
      ) : step === 'select' ? (
        renderServiceSelection()
      ) : step === 'providers' ? (
        renderProvidersList()
      ) : null}

      {/* Provider Details Modal - Emergency Services */}
      <EmergencyProviderDetailsModal
        visible={showDetails}
        provider={selectedProvider}
        onClose={() => setShowDetails(false)}
        onCall={handleCallProvider}
        onBook={(provider) => {
          setShowDetails(false);
          handleBookProvider(provider);
        }}
        hasContacted={selectedProvider ? contactedProviderIds.has(selectedProvider._id) : false}
        booking={selectedProvider ? bookingProvider === selectedProvider._id : false}
      />

      {/* Static Numbers Modal */}
      <StaticNumbersModal
        visible={step === 'static'}
        onClose={resetState}
        numbers={staticNumbers}
        serviceType={selectedService?.id}
      />

      {/* Notes Input Modal */}
      {renderNotesInput()}

      {/* Cancellation Reason Modal */}
      <CancellationReasonModal
        visible={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        onSubmit={executeCancellation}
        cancellerRole="user"
        loading={cancellingRequest}
        serviceName={EMERGENCY_SERVICE_LABELS[selectedService?.id]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: COLORS.darkHero,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  headerSpacer: {
    width: 42,
  },
  emergencyIndicator: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.danger,
  },

  // ── Content ─────────────────────────────────────────────
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  // ── Section Headers ─────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionAccentBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginRight: 10,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 16,
    marginLeft: 54,
  },

  // ── Service Cards ───────────────────────────────────────
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  serviceCard: {
    width: '31%',
    marginHorizontal: '1.16%',
    backgroundColor: COLORS.cardWhite,
    borderRadius: CARD_RADIUS,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    ...SHADOWS,
  },
  staticServiceCard: {
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerLight,
  },
  serviceIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  staticIconContainer: {
    backgroundColor: '#FEE2E2',
  },
  serviceName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 16,
  },
  staticBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
  },
  staticBadgeText: {
    fontSize: 10,
    color: COLORS.danger,
    marginLeft: 3,
    fontWeight: '600',
  },

  // ── Emergency Info Card ─────────────────────────────────
  emergencyInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 16,
    backgroundColor: COLORS.dangerLight,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  emergencyInfoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  emergencyInfoContent: {
    flex: 1,
  },
  emergencyInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
    marginBottom: 2,
  },
  emergencyInfoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },

  // ── Providers ───────────────────────────────────────────
  providersContainer: {
    flex: 1,
    padding: 20,
  },
  providersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  providersTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  providersSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
  },
  retryButtonText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  providersList: {
    paddingBottom: 80,
  },
  providerCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: CARD_RADIUS,
    padding: 18,
    marginBottom: 14,
    ...SHADOWS,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  providerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  providerAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 18,
  },
  providerInitial: {
    fontSize: 20,
    fontWeight: '700',
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
    borderColor: COLORS.warning,
  },
  providerDetails: {
    flex: 1,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  verifiedBadge: {
    marginLeft: 5,
  },
  providerDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  providerDistance: {
    fontSize: 13,
    color: COLORS.muted,
    marginLeft: 4,
  },
  providerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  providerRating: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginLeft: 4,
  },
  providerRatingCount: {
    fontSize: 12,
    color: COLORS.muted,
    marginLeft: 4,
  },
  providerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  providerPhoneText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  providerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  bookButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  bookButtonLoading: {
    opacity: 0.7,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },

  // ── Provider Status ─────────────────────────────────────
  providerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  providerStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewDetailsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
  },
  viewDetailsText: {
    fontSize: 12,
    color: COLORS.muted,
    marginRight: 2,
  },

  // ── Empty State ─────────────────────────────────────────
  emptyProviders: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  retryLargeButton: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  retryLargeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },

  // ── Cancel Button ───────────────────────────────────────
  cancelButton: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.danger,
  },

  // ── Loading ─────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.cardWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...SHADOWS,
  },
  loadingText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  loadingSubtext: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 4,
  },

  // ── Modal Common ────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.divider,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalContent: {
    backgroundColor: COLORS.cardWhite,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 4,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Static Numbers ──────────────────────────────────────
  numbersContainer: {
    maxHeight: 400,
  },
  emptyNumbersContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noNumbersText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  noNumbersSubtext: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 4,
  },
  numberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  numberInfo: {
    flex: 1,
    marginRight: 16,
  },
  numberLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  numberDescription: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 3,
  },
  callNumberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.danger,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  callNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
    marginLeft: 8,
  },
  closeModalButton: {
    marginTop: 16,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  // ── Notes Modal ─────────────────────────────────────────
  notesModalContent: {
    backgroundColor: COLORS.cardWhite,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  notesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 4,
  },
  notesModalIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  notesModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  notesModalSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  notesInput: {
    borderWidth: 1.5,
    borderColor: COLORS.divider,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 110,
    backgroundColor: COLORS.inputBg,
    lineHeight: 22,
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 14,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  notesModalActions: {
    flexDirection: 'row',
    marginTop: 20,
  },
  notesModalCancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  notesModalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  notesModalConfirmButton: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  notesModalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
});

/**
 * Styles for EmergencyProviderDetailsModal — Premium
 */
const detailStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.cardWhite,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    minHeight: '50%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.divider,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  profileSection: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  nameSection: {
    flex: 1,
    justifyContent: 'center',
  },
  providerName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 13,
    color: COLORS.muted,
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: COLORS.background,
    borderRadius: CARD_RADIUS,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 3,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.divider,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  bioContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
  },
  bioText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  serviceTagText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '600',
    marginLeft: 5,
    textTransform: 'capitalize',
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    padding: 14,
    borderRadius: 14,
  },
  phoneIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  phoneButtonText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '600',
  },
  noPhoneText: {
    fontSize: 14,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
    backgroundColor: COLORS.cardWhite,
  },
  callActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.success,
    marginRight: 12,
  },
  callActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.success,
    marginLeft: 6,
  },
  bookActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  bookActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
    marginLeft: 8,
  },
});

export default EmergencyServicesScreen;
