/**
 * Emergency Services Screen
 *
 * Handles two types of emergency services:
 * 1. Location-based: Snake Catcher, Private Ambulance, Mortuary Van
 * 2. Static Numbers: Fire Brigade, Police, Hospital
 *
 * @version 2.0.0 — Premium UI revamp
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  PanResponder,
  Dimensions,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLocation } from '../context/LocationContext';
import { useLanguage } from '../context/LanguageContext';
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
import ScreenShimmer from '../components/ShimmerLoader';

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

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

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
    <AnimatedTouchable
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedTouchable>
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
        size={28}
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
  const { t } = useLanguage();
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
               provider.distance != null ? formatDistanceFromMeters(Number(provider.distance), useKm) : t('common.nearby')}
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
                  ({provider.ratings?.total || provider.totalRatings} {t('common.reviews')})
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
              {(provider.isOnline || provider.isAvailable) ? t('common.available') : t('common.offline')}
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
            <Text style={styles.bookButtonText}>{hasContacted ? t('common.sendRequest') : t('emergencyServices.sendRequestOrCallFirst')}</Text>
          )}
        </TouchableOpacity>
      </View>
      {/* View Details indicator */}
      <View style={styles.viewDetailsHint}>
        <Text style={styles.viewDetailsText}>{t('common.viewDetails')}</Text>
        <MaterialIcon name="chevron-right" size={16} color={COLORS.muted} />
      </View>
    </AnimatedPressable>
  );
};

/**
 * Static Numbers Modal — Premium bottom sheet
 */
const StaticNumbersModal = ({ visible, onClose, numbers, serviceType }) => {
  const { t } = useLanguage();
  return (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        {/* Drag handle */}
        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
          <View style={styles.modalDragHandle} />
        </View>
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
              <Text style={styles.noNumbersText}>{t('emergencyServices.noNumbersAvailable')}</Text>
              <Text style={styles.noNumbersSubtext}>{t('emergencyServices.checkBackLater')}</Text>
            </View>
          ) : (
            numbers.map((item, index) => (
              <View key={index} style={[styles.numberCard, index === numbers.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.numberCardLeft}>
                  <View style={styles.numberIconWrap}>
                    <MaterialIcon name="phone" size={20} color={COLORS.danger} />
                  </View>
                  <View style={styles.numberInfo}>
                    <Text style={styles.numberLabel}>{item.label || item.name}</Text>
                    {item.description && (
                      <Text style={styles.numberDescription}>{item.description}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.callNumberButton}
                  onPress={() => Linking.openURL(`tel:${item.number}`)}
                  activeOpacity={0.8}
                >
                  <MaterialIcon name="phone" size={20} color={COLORS.white} />
                  <Text style={styles.callNumberText}>{item.number}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        <TouchableOpacity style={styles.closeModalButton} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.closeModalButtonText}>{t('common.close')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
  );
};

/**
 * Emergency Provider Details Modal — Premium design
 */
const EmergencyProviderDetailsModal = ({ visible, provider, onClose, onCall, onBook, hasContacted, booking }) => {
  const { dialog } = useDialog();
  const useKm = useDistanceUnit();
  const { t } = useLanguage();
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
              <Text style={detailStyles.headerTitle}>{t('emergencyServices.providerDetailsTitle')}</Text>
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
                        ({provider.ratings?.total || provider.totalRatings} {t('common.reviews')})
                      </Text>
                    )}
                  </View>
                )}

                {/* Experience */}
                {provider.experience && (
                  <View style={detailStyles.infoRow}>
                    <MaterialIcon name="work" size={14} color={COLORS.muted} />
                    <Text style={detailStyles.infoText}>{provider.experience} {t('home.experience').toLowerCase()}</Text>
                  </View>
                )}

                {/* Member Since */}
                {memberSince && (
                  <View style={detailStyles.infoRow}>
                    <MaterialIcon name="calendar-today" size={14} color={COLORS.muted} />
                    <Text style={detailStyles.infoText}>{t('detail.memberSince', { date: memberSince })}</Text>
                  </View>
                )}

                {/* Distance */}
                {(provider.distanceKm || provider.distance != null) && (
                  <View style={detailStyles.infoRow}>
                    <MaterialIcon name="location-on" size={14} color={COLORS.primary} />
                    <Text style={detailStyles.infoText}>
                      {provider.distanceKm ? `${formatDistance(provider.distanceKm, useKm)} ${t('common.away')}` :
                       `${formatDistanceFromMeters(Number(provider.distance), useKm)} ${t('common.away')}`}
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
                <Text style={detailStyles.statLabel}>{t('emergencyServices.jobsDone')}</Text>
              </View>
              <View style={detailStyles.statDivider} />
              <View style={detailStyles.statItem}>
                <Text style={detailStyles.statValue}>
                  {provider.ratings?.total || provider.totalRatings || 0}
                </Text>
                <Text style={detailStyles.statLabel}>{t('common.reviews')}</Text>
              </View>
              <View style={detailStyles.statDivider} />
              <View style={detailStyles.statItem}>
                <Text style={[detailStyles.statValue, {
                  color: (provider.isOnline || provider.isAvailable) ? COLORS.success : COLORS.muted
                }]}>
                  {(provider.isOnline || provider.isAvailable) ? t('common.online') : t('common.offline')}
                </Text>
                <Text style={detailStyles.statLabel}>{t('home.status')}</Text>
              </View>
            </View>

            {/* Bio */}
            {provider.bio ? (
              <View style={detailStyles.section}>
                <View style={detailStyles.sectionHeaderRow}>
                  <View style={detailStyles.sectionAccent} />
                  <Text style={detailStyles.sectionTitle}>{t('emergencyServices.about')}</Text>
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
                  <Text style={detailStyles.sectionTitle}>{t('emergencyServices.verifiedServices')}</Text>
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
                <Text style={detailStyles.sectionTitle}>{t('emergencyServices.contact')}</Text>
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
                    {t('emergencyServices.callProviderPhone', { phone })}
                  </Text>
                  <MaterialIcon name="chevron-right" size={18} color={COLORS.muted} />
                </TouchableOpacity>
              ) : (
                <Text style={detailStyles.noPhoneText}>{t('emergencyServices.phoneNotAvailable')}</Text>
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
              <Text style={detailStyles.callActionText}>{t('common.call')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[detailStyles.bookActionBtn, !hasContacted && { opacity: 0.5 }]}
              onPress={() => {
                if (!hasContacted) {
                  dialog(t('emergencyServices.callFirst'), t('emergencyServices.callFirstMsg'), [{ text: t('common.ok') }]);
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
                    {hasContacted ? t('common.sendRequest') : t('emergencyServices.sendRequestOrCallFirst')}
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
  const { t } = useLanguage();

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

  // Loading timeout state for provider search
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const loadingTimerRef = useRef(null);

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
      // Static service - fetch numbers without showing full-screen loading
      const result = await getStaticEmergencyNumbers(service.id);

      if (result.success) {
        // Handle both array format and object format
        const numbers = Array.isArray(result.data)
          ? result.data
          : result.data?.numbers || [];
        setStaticNumbers(numbers);
        setStep('static');
      } else {
        dialog(t('common.error'), result.error || t('emergencyServices.requestFailed'));
      }
    } else {
      // Location-based service - show notes input
      setShowNotesInput(true);
    }
  };

  const SEARCH_TIMEOUT_MS = 60000; // 60 seconds

  const startLoadingTimer = useCallback(() => {
    setLoadingElapsed(0);
    setLoadingTimedOut(false);
    if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    const startTime = Date.now();
    loadingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setLoadingElapsed(elapsed);
      if (elapsed >= SEARCH_TIMEOUT_MS) {
        setLoadingTimedOut(true);
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }, 1000);
  }, []);

  const stopLoadingTimer = useCallback(() => {
    if (loadingTimerRef.current) {
      clearInterval(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => stopLoadingTimer(), []);

  /** Wrap a promise with a timeout */
  const withTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
      ),
    ]);

  /**
   * Create emergency request and fetch providers
   */
  const handleCreateRequest = async () => {
    if (!currentLocation) {
      dialog(t('emergencyServices.locationRequired'), t('emergencyServices.locationRequiredMsg'));
      refreshLocation();
      return;
    }

    setIsLoading(true);
    setShowNotesInput(false);
    startLoadingTimer();

    try {
      // Create request — 30s timeout
      const createResult = await withTimeout(
        createEmergencyRequest({
          userId,
          serviceType: selectedService.id,
          location: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address: displayAddress,
          },
          notes,
        }),
        30000,
        'Creating request',
      );

      if (!createResult.success) {
        stopLoadingTimer();
        setIsLoading(false);
        if (createResult.code === 'OUTSIDE_SERVICE_ZONE') {
          dialog(
            t('emergencyServices.serviceUnavailable'),
            createResult.suggestion || t('emergencyServices.serviceUnavailableMsg'),
            [{ text: t('common.ok') }]
          );
        } else if (createResult.code === 'RATE_LIMITED' && createResult.retryAfter) {
          dialog(t('userHome.rateLimited'), t('userHome.rateLimitedMsg', { seconds: createResult.retryAfter }));
        } else {
          dialog(t('common.error'), createResult.error || t('emergencyServices.requestFailed'));
        }
        return;
      }

      setCreatedRequest(createResult.data);

      // Fetch nearby providers — 30s timeout
      const providersResult = await withTimeout(
        getNearbyEmergencyProviders(createResult.data._id),
        30000,
        'Finding providers',
      );

      stopLoadingTimer();
      setIsLoading(false);

      if (providersResult.success && providersResult.providers?.length > 0) {
        setProviders(providersResult.providers);
        setStep('providers');
      } else {
        dialog(t('emergencyServices.noProviders'), providersResult.error || t('emergencyServices.noProvidersMsg'));
      }
    } catch (error) {
      stopLoadingTimer();
      setIsLoading(false);
      setLoadingTimedOut(false);
      dialog(
        t('emergencyServices.requestFailed'),
        error.message?.includes('timed out')
          ? t('emergencyServices.serverTimeout')
          : (error.message || t('common.somethingWentWrong')),
      );
    }
  };

  /** Retry fetching providers for an existing request */
  const handleRetryProviders = async () => {
    if (!createdRequest?._id) {
      // No existing request — restart from scratch
      handleCreateRequest();
      return;
    }

    setLoadingTimedOut(false);
    setIsLoading(true);
    startLoadingTimer();

    try {
      const providersResult = await withTimeout(
        getNearbyEmergencyProviders(createdRequest._id),
        30000,
        'Finding providers',
      );

      stopLoadingTimer();
      setIsLoading(false);

      if (providersResult.success && providersResult.providers?.length > 0) {
        setProviders(providersResult.providers);
        setStep('providers');
      } else {
        dialog(t('emergencyServices.noProviders'), providersResult.error || t('emergencyServices.noProvidersMsg'));
      }
    } catch (error) {
      stopLoadingTimer();
      setIsLoading(false);
      dialog(
        t('emergencyServices.retryFailed'),
        error.message?.includes('timed out')
          ? t('emergencyServices.retryFailedMsg')
          : (error.message || t('common.somethingWentWrong')),
      );
    }
  };

  /** Cancel search and go back to service selection */
  const handleCancelSearch = () => {
    stopLoadingTimer();
    setIsLoading(false);
    setLoadingTimedOut(false);
    setLoadingElapsed(0);
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
        t('userHome.phoneNotAvailable'),
        t('userHome.phoneNotAvailableMsg'),
        [{ text: t('common.ok') }]
      );
      return;
    }

    const phoneNumber = stripped.startsWith('+') ? stripped :
                        stripped.startsWith('91') ? `+${stripped}` : `+91${stripped}`;

    dialog(
      t('userHome.callProvider'),
      t('userHome.callProviderMsg', { name: provider.name || 'Provider', phone }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.callNow'),
          onPress: () => {
            // Track that user has contacted this provider
            setContactedProviderIds(prev => new Set(prev).add(provider._id));
            Linking.openURL(`tel:${phoneNumber}`).catch(() => {
              dialog(t('common.error'), t('userHome.unableToCall'));
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
        t('emergencyServices.callFirst'),
        t('emergencyServices.callFirstMsg'),
        [{ text: t('common.ok') }]
      );
      return;
    }

    setBookingProvider(provider._id);

    try {
      const result = await assignEmergencyProvider(createdRequest._id, provider._id);

      if (result.success) {
        setBookingProvider(null);
        dialog(
          t('emergencyServices.requestSent'),
          t('emergencyServices.requestSentMsg', { name: provider.name }),
          [
            {
              text: t('common.ok'),
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        setBookingProvider(null);
        dialog(t('common.error'), result.error || t('emergencyServices.requestFailed'));
      }
    } catch (error) {
      console.error('[Emergency] Book provider error:', error);
      dialog(t('common.error'), t('common.somethingWentWrong'));
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
      t('emergencyServices.rejectProvider'),
      t('emergencyServices.rejectProviderMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.rejected'),
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
        dialog(t('emergencyServices.noProviders'), t('emergencyServices.noMoreProviders'));
      }
    } else {
      dialog(t('common.error'), result.error || t('emergencyServices.requestFailed'));
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
      dialog(t('common.error'), t('providerHistory.cancelError'));
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
          {step === 'select' ? t('emergencyServices.title') :
           step === 'static' ? EMERGENCY_SERVICE_LABELS[selectedService?.id] :
           t('emergencyServices.nearbyProviders')}
        </Text>
        {step === 'select' && (
          <Text style={styles.headerSubtitle}>{t('emergencyServices.quickAccess')}</Text>
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
      contentContainerStyle={[styles.contentContainer, { paddingBottom: 40 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Location-based Services */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccentBar} />
        <View style={styles.sectionIconContainer}>
          <MaterialIcon name="location-on" size={20} color={COLORS.primary} />
        </View>
        <Text style={styles.sectionTitle}>{t('emergencyServices.locationBasedServices')}</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        {t('emergencyServices.findNearbyProviders')}
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
        <Text style={styles.sectionTitle}>{t('emergencyServices.emergencyHelplines')}</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        {t('emergencyServices.callDirectly')}
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
          <Text style={styles.emergencyInfoTitle}>{t('emergencyServices.emergencyInfo')}</Text>
          <Text style={styles.emergencyInfoText}>{t('emergencyServices.dial112')}</Text>
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
            {t('emergencyServices.providersFound', { n: providers.length })}
          </Text>
          <Text style={styles.providersSubtitle}>
            {t('emergencyServices.callFirstThenSend')}
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
            <MaterialIcon name="refresh" size={20} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>

      {providers.length === 0 ? (
        <View style={styles.emptyProviders}>
          <View style={styles.emptyIconCircle}>
            <MaterialIcon name="search-off" size={44} color={COLORS.muted} />
          </View>
          <Text style={styles.emptyText}>{t('emergencyServices.noProvidersAvailable')}</Text>
          <Text style={styles.emptySubtext}>
            {t('emergencyServices.allRejectedOrNone')}
          </Text>
          <TouchableOpacity
            style={styles.retryLargeButton}
            onPress={handleRetrySearch}
            activeOpacity={0.8}
          >
            <MaterialIcon name="refresh" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
            <Text style={styles.retryLargeButtonText}>{t('emergencyServices.searchAgain')}</Text>
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
          contentContainerStyle={[styles.providersList, { paddingBottom: 80 + insets.bottom }]}
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
        style={[styles.cancelButton, { bottom: 16 + insets.bottom }]}
        onPress={handleCancelRequest}
        activeOpacity={0.8}
      >
        <MaterialIcon name="close" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
        <Text style={styles.cancelButtonText}>{t('emergencyServices.cancelRequest')}</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Notes input modal — bottom sheet with swipe-to-dismiss
   * Self-managed animation (no animationType="slide") to avoid flicker.
   */
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const notesSheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const notesOverlayOpacity = useRef(new Animated.Value(0)).current;
  const isDismissing = useRef(false);

  // Animate in when modal opens
  useEffect(() => {
    if (showNotesInput) {
      isDismissing.current = false;
      notesSheetTranslateY.setValue(SCREEN_HEIGHT);
      notesOverlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(notesSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
          overshootClamping: true,
        }),
        Animated.timing(notesOverlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showNotesInput]);

  const dismissNotesModal = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    Animated.parallel([
      Animated.spring(notesSheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
        overshootClamping: true,
      }),
      Animated.timing(notesOverlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowNotesInput(false);
      setSelectedService(null);
    });
  }, []);

  const notesPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 3,
    onPanResponderGrant: () => {
      notesSheetTranslateY.stopAnimation();
    },
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) notesSheetTranslateY.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80 || gs.vy > 0.15) {
        dismissNotesModal();
      } else {
        Animated.spring(notesSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
          overshootClamping: true,
        }).start();
      }
    },
  }), []);

  const renderNotesInput = () => (
    <Modal
      visible={showNotesInput}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={dismissNotesModal}
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 23, 42, 0.6)', opacity: notesOverlayOpacity }]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={dismissNotesModal}
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ position: 'absolute', bottom: insets.bottom, left: 0, right: 0 }}
          pointerEvents="box-none"
        >
        <Animated.View
          style={[
            styles.notesModalContent,
            {
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: notesSheetTranslateY }],
            },
          ]}
        >
          {/* Swipeable drag handle */}
          <View {...notesPanResponder.panHandlers} style={styles.dragHandleZone}>
            <View style={styles.modalDragHandle} />
          </View>

          {/* Service icon + title */}
          <View style={styles.notesModalHeader}>
            <View style={styles.notesModalIconWrap}>
              <MaterialIcon
                name={EMERGENCY_SERVICE_ICONS[selectedService?.id] || 'warning'}
                size={24}
                color={COLORS.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notesModalTitle}>
                {EMERGENCY_SERVICE_LABELS[selectedService?.id]} Request
              </Text>
              <Text style={styles.notesModalSubtitle}>
                {t('emergencyServices.describeSituation')}
              </Text>
            </View>
          </View>

          {/* Notes label + input */}
          <Text style={styles.notesLabel}>{t('emergencyServices.detailsOptional')}</Text>
          <TextInput
            style={styles.notesInput}
            placeholder={EMERGENCY_NOTES_PLACEHOLDERS[selectedService?.id] || t('emergencyServices.addDetails')}
            placeholderTextColor={COLORS.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Location preview */}
          <View style={styles.locationPreview}>
            <View style={styles.locationIconWrap}>
              <MaterialIcon name="my-location" size={16} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationLabel}>{t('emergencyServices.yourLocationLabel')}</Text>
              <Text style={styles.locationText} numberOfLines={2}>
                {displayAddress || t('emergencyServices.fetchingLocation')}
              </Text>
            </View>
            {locationLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>

          {/* Action buttons */}
          <View style={styles.notesModalActions}>
            <TouchableOpacity
              style={styles.notesModalCancelButton}
              onPress={dismissNotesModal}
              activeOpacity={0.8}
            >
              <Text style={styles.notesModalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.notesModalConfirmButton, (isLoading || locationLoading) && { opacity: 0.7 }]}
              onPress={handleCreateRequest}
              disabled={isLoading || locationLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcon name="search" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
                  <Text style={styles.notesModalConfirmText}>{t('userHome.findProviders')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {renderHeader()}

      {isLoading && step === 'select' ? (
        <View style={styles.loadingContainer}>
          {loadingTimedOut ? (
            <>
              <View style={[styles.loadingIconCircle, { backgroundColor: '#FEF2F2' }]}>
                <MaterialIcon name="error-outline" size={40} color={COLORS.danger} />
              </View>
              <Text style={styles.loadingText}>{t('emergencyServices.takingTooLong')}</Text>
              <Text style={styles.loadingSubtext}>
                {t('emergencyServices.serverNotResponding')}
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetryProviders} activeOpacity={0.8}>
                <MaterialIcon name="refresh" size={20} color={COLORS.primary} />
                <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelSearchButton} onPress={handleCancelSearch} activeOpacity={0.8}>
                <Text style={styles.cancelSearchText}>{t('common.goBack')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ScreenShimmer type="cardList" showStats={false} />
          )}
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
    gap: 12,
  },
  serviceCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.cardWhite,
    borderRadius: CARD_RADIUS,
    padding: 18,
    alignItems: 'center',
    marginBottom: 0,
    ...SHADOWS,
  },
  staticServiceCard: {
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerLight,
  },
  serviceIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  staticIconContainer: {
    backgroundColor: '#FEE2E2',
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
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
    width: 54,
    height: 54,
    borderRadius: 16,
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
    height: 54,
    borderRadius: 16,
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
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 19,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(246,124,22,0.12)',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  cancelSearchButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 12,
  },
  cancelSearchText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
  },

  // ── Modal Common ────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalDragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
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
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderBottomWidth: 0,
  },
  numberCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  numberIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numberInfo: {
    flex: 1,
  },
  numberLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  numberDescription: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 3,
    lineHeight: 18,
  },
  callNumberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    paddingHorizontal: 20,
    height: 52,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.danger,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  callNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  closeModalButton: {
    marginTop: 8,
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
  dragHandleZone: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    minHeight: 44,
  },
  notesModalContent: {
    backgroundColor: COLORS.cardWhite,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
  },
  notesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 4,
  },
  notesModalIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
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
    marginTop: 3,
    lineHeight: 18,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesInput: {
    borderWidth: 1.5,
    borderColor: COLORS.divider,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 120,
    backgroundColor: COLORS.inputBg,
    lineHeight: 22,
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 14,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  locationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  notesModalActions: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  notesModalCancelButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesModalCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  notesModalConfirmButton: {
    flex: 2,
    height: 56,
    borderRadius: 16,
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
    fontSize: 16,
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
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  phoneIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  phoneButtonText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.success,
    fontWeight: '700',
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
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
    backgroundColor: COLORS.cardWhite,
  },
  callActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.successLight,
    borderWidth: 1.5,
    borderColor: COLORS.success,
    marginRight: 12,
  },
  callActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.success,
    marginLeft: 8,
  },
  bookActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    marginLeft: 8,
  },
});

export default EmergencyServicesScreen;
