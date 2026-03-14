/**
 * Favorites Screen - Premium Edition
 *
 * Full booking flow from favorites:
 *   Select provider -> Pick service -> Create request via correct API
 *   (traditional/event/emergency) -> Send to provider -> Accept/Reject -> OTP -> Tracking
 *
 * Routes service types to their correct backend APIs:
 *   - Traditional (12 types) -> traditionalServiceService
 *   - Event (photographer, influencer) -> /api/event-services/create-service
 *   - Emergency (snake_catcher, private_ambulance, mortuary_van) -> emergencyServicesService
 *
 * @version 4.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  RefreshControl,
  SectionList,
  Modal,
  ScrollView,
  Dimensions,
  Image,
  StatusBar,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { useLocation } from '../context/LocationContext';
import { getFavorites, removeFromFavorites } from '../services/favoritesService';
import { ProviderDetailsModal } from '../components';
import {
  createServiceRequest,
  sendRequestToProvider,
} from '../services/traditionalServiceService';
import {
  createEmergencyRequest,
  assignEmergencyProvider,
} from '../services/emergencyServicesService';
import { NODE_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Premium Design Tokens
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
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  iconBg: '#F1F5F9',
  success: '#0D9488',
  successLight: '#CCFBF1',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
};

const SHADOWS = {
  card: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
    },
    android: { elevation: 5 },
  }),
  sm: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
    },
    android: { elevation: 2 },
  }),
  header: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
  }),
  xl: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 28,
    },
    android: { elevation: 12 },
  }),
};

const FONTS = {
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: COLORS.darkHero },
  h2: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: COLORS.darkHero },
  h3: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2, color: COLORS.textPrimary },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22, color: COLORS.textPrimary },
  bodyMedium: { fontSize: 15, fontWeight: '500', color: COLORS.textPrimary },
  caption: { fontSize: 13, fontWeight: '400', color: COLORS.textSecondary },
  captionMedium: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  small: { fontSize: 11, fontWeight: '500', letterSpacing: 0.2, color: COLORS.textTertiary },
  button: { fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
};

// Service Type Routing
// These MUST match the backend model enums exactly
const TRADITIONAL_SERVICES = [
  'electrician', 'plumber', 'electronics_technician', 'carpenter',
  'painter', 'solar_repairing', 'welder', 'salon',
  'vehicle_cleaning', 'mason_tiler', 'driver', 'ac_repair',
];
const EVENT_SERVICES = ['photographer', 'influencer'];
const EMERGENCY_SERVICES = ['snake_catcher', 'private_ambulance', 'mortuary_van'];

const getServiceFlow = (serviceType) => {
  if (EVENT_SERVICES.includes(serviceType)) return 'event';
  if (EMERGENCY_SERVICES.includes(serviceType)) return 'emergency';
  return 'traditional';
};

// Service Labels and Icons
const SERVICE_CATEGORY_LABELS = {
  electrician: 'Electrician',
  plumber: 'Plumber',
  electronics_technician: 'Electronics',
  carpenter: 'Carpenter',
  painter: 'Painter',
  solar_repairing: 'Solar Repair',
  welder: 'Welder',
  salon: 'Salon',
  vehicle_cleaning: 'Vehicle Wash',
  mason_tiler: 'Mason & Tiler',
  driver: 'Driver',
  ac_repair: 'AC Repair',
  cleaning: 'Cleaning',
  photographer: 'Photographer',
  influencer: 'Influencer',
  snake_catcher: 'Snake Catcher',
  private_ambulance: 'Ambulance',
  mortuary_van: 'Mortuary Van',
};

const SERVICE_ICONS = {
  electrician: 'flash-on',
  plumber: 'plumbing',
  electronics_technician: 'tv',
  carpenter: 'handyman',
  painter: 'format-paint',
  solar_repairing: 'wb-sunny',
  welder: 'build',
  salon: 'content-cut',
  vehicle_cleaning: 'local-car-wash',
  mason_tiler: 'view-module',
  driver: 'drive-eta',
  ac_repair: 'ac-unit',
  cleaning: 'cleaning-services',
  photographer: 'camera-alt',
  influencer: 'star',
  snake_catcher: 'pest-control',
  private_ambulance: 'local-hospital',
  mortuary_van: 'airport-shuttle',
};

const SERVICE_FLOW_COLORS = {
  traditional: COLORS.secondary,
  event: COLORS.purple,
  emergency: COLORS.danger,
};

const SERVICE_FLOW_LABELS = {
  traditional: 'Standard',
  event: 'Event',
  emergency: 'Emergency',
};

// =============================================================================
// Provider Card Component
// =============================================================================
const ProviderCard = ({ provider, onCall, onRemove, onBook, onViewProfile, t }) => {
  const verifiedCount = (provider.verifiedServices || []).length;
  // Handle both string URL and object { url } from backend
  const profilePicUrl = typeof provider.profilePicture === 'string'
    ? provider.profilePicture
    : provider.profilePicture?.url || provider.profileImage || null;
  const hasProfilePic = !!profilePicUrl;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={cardStyles.card}>
        <View style={cardStyles.cardTop}>
          <TouchableOpacity
            style={cardStyles.avatarTouchable}
            onPress={() => onViewProfile(provider)}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.85}
          >
            {hasProfilePic ? (
              <Image source={{ uri: profilePicUrl }} style={cardStyles.avatarImage} />
            ) : (
              <View style={cardStyles.avatarFallback}>
                <Text style={cardStyles.avatarInitial}>
                  {(provider.name || 'P').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={cardStyles.avatarBadge}>
              <MaterialIcon name="open-in-new" size={10} color={COLORS.cardWhite} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={cardStyles.cardInfo}
            onPress={() => onViewProfile(provider)}
            activeOpacity={0.75}
          >
            <View style={cardStyles.nameRow}>
              <Text style={cardStyles.providerName} numberOfLines={1}>
                {provider.name || 'Provider'}
              </Text>
              {verifiedCount > 0 && (
                <View style={cardStyles.proBadge}>
                  <MaterialIcon name="verified" size={11} color={COLORS.cardWhite} />
                  <Text style={cardStyles.proBadgeText}>{t('favoritesScreen.proBadge')}</Text>
                </View>
              )}
            </View>

            <View style={cardStyles.metaRow}>
              {(provider.rating > 0 || (provider.ratings && provider.ratings.average > 0)) && (
                <View style={cardStyles.ratingChip}>
                  <MaterialIcon name="star" size={13} color="#F59E0B" />
                  <Text style={cardStyles.ratingValue}>
                    {((provider.ratings && provider.ratings.average) || provider.rating || 0).toFixed(1)}
                  </Text>
                  {(provider.totalRatings > 0 || (provider.ratings && provider.ratings.total > 0)) && (
                    <Text style={cardStyles.ratingCount}>
                      ({provider.totalRatings || (provider.ratings && provider.ratings.total) || 0})
                    </Text>
                  )}
                </View>
              )}
              {verifiedCount > 0 && (
                <View style={cardStyles.serviceCountChip}>
                  <MaterialIcon name="build" size={11} color={COLORS.textTertiary} />
                  <Text style={cardStyles.serviceCountText}>{t('favoritesScreen.verified', { n: verifiedCount })}</Text>
                </View>
              )}
            </View>

            {provider.lastServiceDate && (
              <Text style={cardStyles.lastServiceText}>
                {t('favoritesScreen.lastBooked') + ' '}
                {new Date(provider.lastServiceDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={cardStyles.heartButton}
            onPress={() => onRemove(provider)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcon name="favorite" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>

        {provider.notes ? (
          <View style={cardStyles.notesRow}>
            <MaterialIcon name="sticky-note-2" size={14} color={COLORS.textTertiary} />
            <Text style={cardStyles.notesText} numberOfLines={2}>
              {provider.notes}
            </Text>
          </View>
        ) : null}

        <View style={cardStyles.actions}>
          <TouchableOpacity style={cardStyles.callBtn} onPress={() => onCall(provider)} activeOpacity={0.8}>
            <MaterialIcon name="phone" size={18} color={COLORS.success} />
            <Text style={cardStyles.callBtnText}>{t('common.call')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={cardStyles.bookBtn} onPress={() => onBook(provider)} activeOpacity={0.8}>
            <MaterialIcon name="bolt" size={18} color={COLORS.cardWhite} />
            <Text style={cardStyles.bookBtnText}>{t('favoritesScreen.bookNow')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

// =============================================================================
// Section Header with accent bar
// =============================================================================
const SectionHeader = ({ category, count }) => {
  const flow = getServiceFlow(category);
  const iconBg =
    flow === 'event'
      ? COLORS.purpleLight
      : flow === 'emergency'
        ? COLORS.dangerLight
        : COLORS.secondaryLight;
  const iconColor = SERVICE_FLOW_COLORS[flow];

  return (
    <View style={sectionStyles.sectionHeader}>
      <View style={sectionStyles.accentBar} />
      <View style={[sectionStyles.sectionIcon, { backgroundColor: iconBg }]}>
        <MaterialIcon name={SERVICE_ICONS[category] || 'star'} size={20} color={iconColor} />
      </View>
      <View style={sectionStyles.sectionTitleCol}>
        <Text style={sectionStyles.sectionTitle}>
          {SERVICE_CATEGORY_LABELS[category] || category}
        </Text>
        {flow !== 'traditional' && (
          <Text style={[sectionStyles.sectionFlowLabel, { color: iconColor }]}>
            {SERVICE_FLOW_LABELS[flow]} Service
          </Text>
        )}
      </View>
      <View style={sectionStyles.sectionCount}>
        <Text style={sectionStyles.sectionCountText}>{count}</Text>
      </View>
    </View>
  );
};

// =============================================================================
// Main Screen
// =============================================================================
const FavoritesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();
  const { currentLocation } = useLocation();

  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  // Data
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Service selection modal
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [bookingProvider, setBookingProvider] = useState(null);
  const [availableServicesForModal, setAvailableServicesForModal] = useState([]);
  const [sendingRequest, setSendingRequest] = useState(false);

  // Provider details modal
  const [providerDetailsVisible, setProviderDetailsVisible] = useState(false);
  const [selectedProviderForDetails, setSelectedProviderForDetails] = useState(null);

  // Fetch Favorites
  const fetchFavorites = useCallback(
    async (refresh) => {
      if (!userId) return;
      if (refresh) {
        setRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const result = await getFavorites(userId);
      console.log('[Favorites] Fetch:', {
        success: result.success,
        count: result.favorites ? result.favorites.length : 0,
      });

      if (result.success) {
        // Deduplicate by providerId — keep only the most recent entry per provider
        const seenProviders = new Map();
        (result.favorites || []).forEach((fav) => {
          const pid = (fav.provider?._id || fav.providerId || '').toString();
          const existing = seenProviders.get(pid);
          if (!existing || new Date(fav.addedAt) > new Date(existing.addedAt)) {
            seenProviders.set(pid, fav);
          }
        });
        const uniqueFavorites = Array.from(seenProviders.values());

        const byCategory = {};
        uniqueFavorites.forEach((fav) => {
          const category = fav.serviceCategory || 'other';
          if (!byCategory[category]) {
            byCategory[category] = [];
          }
          byCategory[category].push({
            ...(fav.provider || {}),
            _id: (fav.provider && fav.provider._id) || fav.providerId,
            serviceCategory: category,
            notes: fav.notes,
            lastServiceDate: fav.lastServiceDate,
            addedAt: fav.addedAt,
          });
        });

        const order = [
          ...TRADITIONAL_SERVICES,
          ...EVENT_SERVICES,
          ...EMERGENCY_SERVICES,
          'other',
        ];
        const sorted = Object.entries(byCategory).sort(([a], [b]) => {
          const idxA = order.indexOf(a) === -1 ? 99 : order.indexOf(a);
          const idxB = order.indexOf(b) === -1 ? 99 : order.indexOf(b);
          return idxA - idxB;
        });
        setSections(
          sorted.map(([cat, data]) => ({ category: cat, data: data }))
        );
      }

      setIsLoading(false);
      setRefreshing(false);
    },
    [userId]
  );

  useEffect(() => {
    fetchFavorites(false);
  }, [fetchFavorites]);

  // View Provider Profile
  const handleViewProfile = (provider) => {
    if (!provider._id) {
      dialog('Error', t('favoritesScreen.providerInfoUnavailable'));
      return;
    }
    setSelectedProviderForDetails(provider);
    setProviderDetailsVisible(true);
  };

  // Direct Phone Call
  const handleCallProvider = (provider) => {
    const phone = provider.phone || '';
    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    if (!cleanPhone) {
      dialog(
        t('favoritesScreen.notAvailable'),
        t('favoritesScreen.phoneNotAvailable'),
        [{ text: 'OK' }]
      );
      return;
    }

    dialog(
      t('favoritesScreen.callProviderTitle'),
      t('favoritesScreen.callProviderMsg', { name: provider.name || 'Provider', phone }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.callNow'),
          onPress: () =>
            Linking.openURL('tel:' + cleanPhone).catch(() =>
              dialog('Error', t('favoritesScreen.unableToCall'))
            ),
        },
      ]
    );
  };

  // Remove Favorite
  const handleRemoveFavorite = (provider) => {
    const providerId = provider._id;
    if (!userId || !providerId) {
      dialog('Error', t('favoritesScreen.unableToRemove'));
      return;
    }

    dialog(
      t('favoritesScreen.removeFavorite'),
      t('favoritesScreen.removeFromFavorites', { name: provider.name || 'this provider' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            const result = await removeFromFavorites(
              userId,
              providerId,
              provider.serviceCategory
            );
            if (result.success) {
              setSections((prev) =>
                prev
                  .map((sec) => ({
                    ...sec,
                    data: sec.data.filter(
                      (p) =>
                        !(
                          p._id === providerId &&
                          p.serviceCategory === provider.serviceCategory
                        )
                    ),
                  }))
                  .filter((sec) => sec.data.length > 0)
              );
            } else {
              dialog('Error', result.error || t('favoritesScreen.removeFailed'));
            }
          },
        },
      ]
    );
  };

  // Book Provider - Show Service Picker
  const handleBookProvider = (provider) => {
    const verifiedServices = provider.verifiedServices || [];
    const allCategories = provider.serviceCategories || [];
    const allServices = [...new Set([...verifiedServices, ...allCategories])];
    const available =
      allServices.length > 0 ? allServices : [provider.serviceCategory];

    if (available.length === 0) {
      dialog(
        t('favoritesScreen.notAvailable'),
        t('favoritesScreen.noRegisteredServices'),
        [{ text: 'OK' }]
      );
      return;
    }

    if (available.length === 1) {
      showConfirmation(available[0], provider);
      return;
    }

    setBookingProvider(provider);
    setAvailableServicesForModal(
      available.map((svc) => ({
        id: svc,
        label: SERVICE_CATEGORY_LABELS[svc] || svc,
        icon: SERVICE_ICONS[svc] || 'build',
        isVerified: verifiedServices.includes(svc),
        flow: getServiceFlow(svc),
      }))
    );
    setServiceModalVisible(true);
  };

  // Confirmation Alert
  const showConfirmation = (serviceId, provider) => {
    setServiceModalVisible(false);
    const name = SERVICE_CATEGORY_LABELS[serviceId] || serviceId;
    const flow = getServiceFlow(serviceId);
    var flowLabel = '';
    if (flow === 'event') {
      flowLabel = t('favoritesScreen.eventFlow');
    } else if (flow === 'emergency') {
      flowLabel = t('favoritesScreen.emergencyFlow');
    }

    dialog(
      t('favoritesScreen.sendServiceRequest'),
      t('favoritesScreen.sendRequestMsg', { service: name, flow: flowLabel, name: provider.name || 'this provider' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.sendRequest'),
          onPress: () => handleSendRequest(serviceId, provider),
        },
      ]
    );
  };

  const handleServiceSelected = (service) => {
    if (bookingProvider) {
      showConfirmation(service.id, bookingProvider);
    }
  };

  // =================================================================
  // Create and Send Request - routes to the CORRECT backend API
  //
  //   Traditional -> createServiceRequest + sendRequestToProvider
  //   Event       -> POST /api/event-services/create-service + send-to-provider
  //   Emergency   -> createEmergencyRequest + assignEmergencyProvider
  // =================================================================
  const handleSendRequest = async (serviceId, provider) => {
    if (!currentLocation || !currentLocation.latitude || !currentLocation.longitude) {
      dialog(t('favoritesScreen.locationRequired'), t('favoritesScreen.locationRequiredMsg'), [
        { text: 'OK' },
      ]);
      return;
    }

    setSendingRequest(true);
    const flow = getServiceFlow(serviceId);

    try {
      var success = false;
      var errorMsg = '';

      // ========================================================
      // TRADITIONAL SERVICE FLOW
      // ========================================================
      if (flow === 'traditional') {
        var now = new Date();
        var hours = now.getHours().toString().padStart(2, '0');
        var mins = now.getMinutes().toString().padStart(2, '0');

        var createResult = await createServiceRequest({
          userId: userId,
          serviceType: serviceId,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          serviceDate: now.toISOString(),
          serviceTime: hours + ':' + mins,
          serviceAddress:
            currentLocation.address || currentLocation.shortAddress || '',
          isOtherLocation: false,
          description: 'Booked from favorites',
        });

        if (!createResult.success) {
          if (createResult.code === 'OUTSIDE_SERVICE_ZONE') {
            dialog(
              t('favoritesScreen.serviceUnavailable'),
              createResult.suggestion || t('favoritesScreen.serviceUnavailableMsg'),
              [{ text: 'OK' }]
            );
            return;
          }
          throw new Error(createResult.error || 'Failed to create request');
        }

        var requestId = createResult.request && createResult.request._id;
        if (!requestId) {
          throw new Error('No request ID returned');
        }

        var sendResult = await sendRequestToProvider(requestId, provider._id);
        success = sendResult.success;
        if (!success) {
          errorMsg = sendResult.error || 'Failed to send request';
        }
      }

      // ========================================================
      // EVENT SERVICE FLOW  (photographer, influencer)
      // ========================================================
      else if (flow === 'event') {
        var eventNow = new Date();
        var locationData = {
          address:
            currentLocation.address ||
            currentLocation.shortAddress ||
            'Current Location',
          coordinates: [currentLocation.longitude, currentLocation.latitude],
          landmark: '',
        };

        var createResp = await authFetch(
          NODE_BASE_URL + '/api/event-services/create-service',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userId,
              serviceType: serviceId,
              serviceName: SERVICE_CATEGORY_LABELS[serviceId] || serviceId,
              eventDate: eventNow.toISOString(),
              notes: 'Booked from favorites',
              location: locationData,
            }),
          }
        );

        var createData = await createResp.json();

        if (
          !createResp.ok ||
          (createData.statusCode && createData.statusCode >= 400)
        ) {
          if (createData.code === 'OUTSIDE_SERVICE_ZONE') {
            dialog(
              t('favoritesScreen.serviceUnavailable'),
              (createData.details && createData.details.suggestion) ||
                t('favoritesScreen.serviceUnavailableMsg'),
              [{ text: 'OK' }]
            );
            return;
          }
          throw new Error(
            createData.message ||
              createData.error ||
              'Failed to create event request'
          );
        }

        var serviceRequestId =
          (createData.data && createData.data._id) || createData._id;
        if (!serviceRequestId) {
          throw new Error('No event request ID returned');
        }

        var sendResp = await authFetch(
          NODE_BASE_URL +
            '/api/event-services/' +
            serviceRequestId +
            '/send-to-provider',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId: provider._id }),
          }
        );

        var sendData = await sendResp.json();
        success =
          sendResp.ok && (!sendData.statusCode || sendData.statusCode < 400);

        if (!success) {
          // Cancel orphan request on failure
          try {
            await authFetch(
              NODE_BASE_URL +
                '/api/event-services/' +
                serviceRequestId +
                '/cancel',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: userId,
                  reason: 'Failed to send to provider',
                }),
              }
            );
          } catch (cancelErr) {
            // ignore cancel error
          }
          errorMsg =
            sendData.message ||
            sendData.error ||
            'Failed to send to provider';
        }
      }

      // ========================================================
      // EMERGENCY SERVICE FLOW (snake_catcher, private_ambulance, mortuary_van)
      // ========================================================
      else if (flow === 'emergency') {
        var emergencyResult = await createEmergencyRequest({
          userId: userId,
          serviceType: serviceId,
          location: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address:
              currentLocation.address || currentLocation.shortAddress || '',
          },
          notes: 'Booked from favorites',
        });

        if (!emergencyResult.success) {
          if (emergencyResult.code === 'OUTSIDE_SERVICE_ZONE') {
            dialog(
              t('favoritesScreen.serviceUnavailable'),
              emergencyResult.suggestion || t('favoritesScreen.serviceUnavailableMsg'),
              [{ text: 'OK' }]
            );
            return;
          }
          throw new Error(
            emergencyResult.error || 'Failed to create emergency request'
          );
        }

        var emergencyId = emergencyResult.data && emergencyResult.data._id;
        if (!emergencyId) {
          throw new Error('No emergency request ID returned');
        }

        var assignResult = await assignEmergencyProvider(
          emergencyId,
          provider._id
        );
        success = assignResult.success;
        if (!success) {
          errorMsg = assignResult.error || 'Failed to assign provider';
        }
      }

      // Show result
      if (success) {
        var serviceName = SERVICE_CATEGORY_LABELS[serviceId] || serviceId;
        dialog(
          t('favoritesScreen.requestSent'),
          t('favoritesScreen.requestSentMsg', { service: serviceName, name: provider.name || 'the provider' }),
          [
            {
              text: t('favoritesScreen.viewHistoryBtn'),
              onPress: () =>
                navigation.navigate('UserTabs', { screen: 'HistoryTab' }),
            },
            { text: 'OK' },
          ]
        );
      } else {
        dialog('Error', errorMsg || t('favoritesScreen.sendFailed'));
      }
    } catch (error) {
      console.error('[Favorites] Send request error:', error);
      dialog(
        'Error',
        error.message || t('favoritesScreen.somethingWentWrong')
      );
    } finally {
      setSendingRequest(false);
      setBookingProvider(null);
      setAvailableServicesForModal([]);
    }
  };

  // Self-managed modal animation (no animationType="slide") to avoid flicker
  const FAV_SCREEN_HEIGHT = Dimensions.get('window').height;
  const modalSheetTranslateY = useRef(new Animated.Value(FAV_SCREEN_HEIGHT)).current;
  const modalOverlayOpacity = useRef(new Animated.Value(0)).current;
  const isModalDismissing = useRef(false);

  // Animate in when modal opens
  useEffect(() => {
    if (serviceModalVisible) {
      isModalDismissing.current = false;
      modalSheetTranslateY.setValue(FAV_SCREEN_HEIGHT);
      modalOverlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(modalSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
          overshootClamping: true,
        }),
        Animated.timing(modalOverlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [serviceModalVisible]);

  const closeModal = useCallback(() => {
    if (isModalDismissing.current) return;
    isModalDismissing.current = true;
    Animated.parallel([
      Animated.spring(modalSheetTranslateY, {
        toValue: FAV_SCREEN_HEIGHT,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
        overshootClamping: true,
      }),
      Animated.timing(modalOverlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setServiceModalVisible(false);
      setBookingProvider(null);
      setAvailableServicesForModal([]);
    });
  }, []);

  const modalPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 3,
    onPanResponderGrant: () => {
      modalSheetTranslateY.stopAnimation();
    },
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) modalSheetTranslateY.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80 || gs.vy > 0.15) {
        closeModal();
      } else {
        Animated.spring(modalSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
          overshootClamping: true,
        }).start();
      }
    },
  })).current;

  // Total count
  var totalFavorites = sections.reduce(
    (acc, sec) => acc + sec.data.length,
    0
  );

  // =================================================================
  // RENDER
  // =================================================================
  return (
    <View style={screenStyles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.cardWhite} />

      {/* Header */}
      <View style={[screenStyles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={screenStyles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcon name="arrow-back-ios" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={screenStyles.headerCenter}>
          <Text style={screenStyles.headerTitle}>{t('favoritesScreen.title')}</Text>
          {totalFavorites > 0 && (
            <View style={screenStyles.headerBadge}>
              <Text style={screenStyles.headerBadgeText}>{totalFavorites}</Text>
            </View>
          )}
        </View>
        <View style={screenStyles.headerRight} />
      </View>

      {/* Sending Overlay */}
      {sendingRequest && (
        <View style={screenStyles.overlay}>
          <View style={screenStyles.overlayCard}>
            <View style={screenStyles.overlayIconWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
            <Text style={screenStyles.overlayTitle}>{t('favoritesScreen.sendingRequest')}</Text>
            <Text style={screenStyles.overlaySubtitle}>
              {t('favoritesScreen.connecting')}
            </Text>
          </View>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={screenStyles.center}>
          <View style={screenStyles.loadingCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={screenStyles.loadingText}>
              {t('favoritesScreen.loadingFavorites')}
            </Text>
          </View>
        </View>
      ) : sections.length === 0 ? (
        <View style={screenStyles.emptyState}>
          <View style={screenStyles.emptyCircleOuter}>
            <View style={screenStyles.emptyCircleInner}>
              <MaterialIcon
                name="favorite-border"
                size={48}
                color={COLORS.muted}
              />
            </View>
          </View>
          <Text style={screenStyles.emptyTitle}>{t('favoritesScreen.noFavoritesTitle')}</Text>
          <Text style={screenStyles.emptyBody}>
            {t('favoritesScreen.noFavoritesMsg')}
          </Text>
          <TouchableOpacity
            style={screenStyles.emptyBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <MaterialIcon name="search" size={18} color={COLORS.cardWhite} />
            <Text style={screenStyles.emptyBtnText}>{t('favoritesScreen.findServices')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, idx) =>
            (item._id || '') + '-' + (item.serviceCategory || '') + '-' + idx
          }
          renderItem={({ item }) => (
            <ProviderCard
              provider={item}
              onCall={handleCallProvider}
              onRemove={handleRemoveFavorite}
              onBook={handleBookProvider}
              onViewProfile={handleViewProfile}
              t={t}
            />
          )}
          renderSectionHeader={({ section }) => (
            <SectionHeader
              category={section.category}
              count={section.data.length}
            />
          )}
          contentContainerStyle={screenStyles.listContent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchFavorites(true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}

      {/* Service Selection Modal */}
      <Modal
        visible={serviceModalVisible}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={closeModal}
      >
        <View style={{ flex: 1 }}>
          <Animated.View style={[modalStyles.modalOverlay, { opacity: modalOverlayOpacity }]}>
            <TouchableOpacity
              style={modalStyles.modalDismiss}
              activeOpacity={1}
              onPress={closeModal}
            />
          </Animated.View>
          <Animated.View
            style={[
              modalStyles.modalSheet,
              {
                paddingBottom: insets.bottom + 20,
                transform: [{ translateY: modalSheetTranslateY }],
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
              },
            ]}
          >
            <View {...modalPanResponder.panHandlers} style={modalStyles.modalGrabber}>
              <View style={modalStyles.modalGrabberBar} />
            </View>

            <View style={modalStyles.modalHeader}>
              <View style={modalStyles.modalHeaderLeft}>
                <View style={modalStyles.modalHeaderIcon}>
                  <MaterialIcon
                    name="handyman"
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
                <View>
                  <Text style={FONTS.h3}>{t('favoritesScreen.chooseService')}</Text>
                  {bookingProvider && (
                    <Text
                      style={[FONTS.caption, { marginTop: 2 }]}
                      numberOfLines={1}
                    >
                      {t('favoritesScreen.forProvider', { name: bookingProvider.name })}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={modalStyles.modalClose}
                onPress={closeModal}
              >
                <MaterialIcon
                  name="close"
                  size={22}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={modalStyles.modalList}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {availableServicesForModal.map((svc, idx) => {
                var flowColor = SERVICE_FLOW_COLORS[svc.flow];
                var iconBgColor =
                  svc.flow === 'event'
                    ? COLORS.purpleLight
                    : svc.flow === 'emergency'
                      ? COLORS.dangerLight
                      : COLORS.secondaryLight;
                return (
                  <TouchableOpacity
                    key={svc.id + '-modal-' + idx}
                    style={modalStyles.modalItem}
                    onPress={() => handleServiceSelected(svc)}
                    activeOpacity={0.65}
                  >
                    <View
                      style={[
                        modalStyles.modalItemIcon,
                        { backgroundColor: iconBgColor },
                      ]}
                    >
                      <MaterialIcon
                        name={svc.icon}
                        size={22}
                        color={flowColor}
                      />
                    </View>
                    <View style={modalStyles.modalItemInfo}>
                      <Text style={modalStyles.modalItemName}>{svc.label}</Text>
                      <View style={modalStyles.modalItemMeta}>
                        {svc.isVerified ? (
                          <View style={modalStyles.verifiedTag}>
                            <MaterialIcon
                              name="verified"
                              size={11}
                              color={COLORS.success}
                            />
                            <Text style={modalStyles.verifiedTagText}>
                              {t('favoritesScreen.verifiedTag')}
                            </Text>
                          </View>
                        ) : (
                          <View style={modalStyles.pendingTag}>
                            <MaterialIcon
                              name="schedule"
                              size={11}
                              color={COLORS.warning}
                            />
                            <Text style={modalStyles.pendingTagText}>{t('favoritesScreen.pendingTag')}</Text>
                          </View>
                        )}
                        {svc.flow !== 'traditional' && (
                          <View
                            style={[
                              modalStyles.flowTag,
                              { backgroundColor: flowColor + '18' },
                            ]}
                          >
                            <Text
                              style={[
                                modalStyles.flowTagText,
                                { color: flowColor },
                              ]}
                            >
                              {SERVICE_FLOW_LABELS[svc.flow]}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <MaterialIcon
                      name="arrow-forward-ios"
                      size={16}
                      color={COLORS.border}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={modalStyles.modalHint}>
              <MaterialIcon
                name="info-outline"
                size={15}
                color={COLORS.secondary}
              />
              <Text style={modalStyles.modalHintText}>
                {t('favoritesScreen.selectServiceHint')}
              </Text>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Provider Details Modal */}
      <ProviderDetailsModal
        visible={providerDetailsVisible}
        providerId={
          selectedProviderForDetails
            ? selectedProviderForDetails._id
            : undefined
        }
        onClose={() => {
          setProviderDetailsVisible(false);
          setSelectedProviderForDetails(null);
        }}
        onBook={() => {
          setProviderDetailsVisible(false);
          if (selectedProviderForDetails) {
            setTimeout(
              () => handleBookProvider(selectedProviderForDetails),
              350
            );
          }
        }}
        onCall={(phone) => {
          if (phone) {
            var cleaned = phone.replace(/[^0-9+]/g, '');
            dialog(
              t('favoritesScreen.callProviderTitle'),
              t('favoritesScreen.callProviderMsg', {
                name: selectedProviderForDetails
                  ? selectedProviderForDetails.name
                  : 'Provider',
                phone,
              }),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('common.callNow'),
                  onPress: () =>
                    Linking.openURL('tel:' + cleaned).catch(() =>
                      dialog('Error', t('favoritesScreen.unableToCall'))
                    ),
                },
              ]
            );
          } else if (selectedProviderForDetails) {
            handleCallProvider(selectedProviderForDetails);
          }
        }}
      />
    </View>
  );
};

// =============================================================================
// STYLES - Premium Design System
// =============================================================================

// Screen styles
const screenStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: COLORS.cardWhite,
    ...SHADOWS.header,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    ...FONTS.h2,
  },
  headerBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerRight: { width: 42 },

  loadingCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 22,
    paddingHorizontal: 40,
    paddingVertical: 32,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  loadingText: {
    ...FONTS.caption,
    fontWeight: '600',
    marginTop: 16,
    color: COLORS.muted,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  overlayCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 22,
    padding: 36,
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.72,
    ...SHADOWS.xl,
  },
  overlayIconWrap: { marginBottom: 20 },
  overlayTitle: { ...FONTS.h3, fontWeight: '800', marginBottom: 6 },
  overlaySubtitle: { ...FONTS.caption, textAlign: 'center' },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 44,
  },
  emptyCircleOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.cardWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...SHADOWS.card,
  },
  emptyCircleInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { ...FONTS.h2, marginBottom: 12, textAlign: 'center' },
  emptyBody: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  emptyBtnText: { ...FONTS.button, color: COLORS.cardWhite },

  listContent: { padding: 20, paddingBottom: 40 },
});

// Card styles
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    ...SHADOWS.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarTouchable: {
    position: 'relative',
    marginRight: 14,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.borderLight,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.cardWhite,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.cardWhite,
  },
  cardInfo: { flex: 1, paddingTop: 2 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  providerName: { ...FONTS.h3, fontWeight: '800', flex: 1 },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.cardWhite,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingValue: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  ratingCount: { fontSize: 11, color: COLORS.textTertiary },
  serviceCountChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  serviceCountText: { ...FONTS.small },
  lastServiceText: { ...FONTS.small, marginTop: 2 },
  heartButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    marginTop: 2,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.iconBg,
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
    marginBottom: 4,
    gap: 8,
  },
  notesText: { flex: 1, ...FONTS.caption, lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.success + '25',
  },
  callBtnText: { ...FONTS.button, color: COLORS.success },
  bookBtn: {
    flex: 2,
    flexDirection: 'row',
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  bookBtnText: { ...FONTS.button, color: COLORS.cardWhite },
});

// Section styles
const sectionStyles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  accentBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: COLORS.secondary,
    marginRight: 10,
  },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitleCol: { flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.darkHero, letterSpacing: -0.2 },
  sectionFlowLabel: { ...FONTS.small, marginTop: 1 },
  sectionCount: {
    minWidth: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  sectionCountText: { ...FONTS.captionMedium, fontWeight: '600', color: COLORS.textPrimary },
});

// Modal styles
const modalStyles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  modalDismiss: { flex: 1 },
  modalSheet: {
    backgroundColor: COLORS.cardWhite,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    maxHeight: '78%',
  },
  modalGrabber: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    minHeight: 44,
  },
  modalGrabberBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  modalHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  modalList: { paddingTop: 8, maxHeight: 420 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modalItemInfo: { flex: 1 },
  modalItemName: { ...FONTS.bodyMedium, fontWeight: '600', marginBottom: 4 },
  modalItemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedTagText: { ...FONTS.small, color: COLORS.success },
  pendingTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pendingTagText: { ...FONTS.small, color: COLORS.warning },
  flowTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  flowTagText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  modalHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  modalHintText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
  },
});

export default FavoritesScreen;
