/**
 * Create Service Request Screen
 * Allows users to create a traditional service request, fetch nearby providers, and book them
 * @version 2.0.0
 * 
 * Flow:
 * 1. User selects service type
 * 2. User picks service date
 * 3. User adds optional description
 * 4. Location is captured automatically
 * 5. Request is created
 * 6. User is prompted to fetch nearby providers
 * 7. Nearby providers are displayed with phone numbers
 * 8. User can call provider to discuss
 * 9. User can book provider (sends request to provider)
 */

import React, { useState, useEffect, useRef } from 'react';
import {  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
  RefreshControl,
  Linking,
  StatusBar
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import Geolocation from '@react-native-community/geolocation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { Analytics, EV } from '../services/analytics';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { isProviderRefusal } from '../utils/workSchedule';
import {
  createServiceRequest,
  getNearbyProviders,
  sendRequestToProvider,
  cancelRequest,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
} from '../services/traditionalServiceService';
import SavedAddresses from '../components/SavedAddresses';
import useBookingProfileGate from '../hooks/useBookingProfileGate';
import { getSavedAddresses, getDefaultAddress } from '../services/addressService';
import { formatDistance, formatDistanceFromMeters, useDistanceUnit } from '../utils/formatDistance';
import {
  useTheme,
  useThemedStyles,
  useThemeColors,
} from '../theme';

// Service type icons (using emoji for simplicity, replace with actual icons)
const SERVICE_ICONS = {
  electrician: '⚡',
  plumber: '🔧',
  electronics_technician: '📺',
  carpenter: '🪵',
  painter: '🎨',
  solar_repairing: '☀️',
  welder: '🔥',
  salon: '💇',
  vehicle_cleaning: '🚗',
  mason_tiler: '🧱',
  driver: '🚙',
  ac_repair: '❄️',
};

// This screen predates the design system: bare greys (#333/#666/#999), Bootstrap
// red/green, and iOS blue as the accent. Mapped onto tokens without restyling it
// -- the iOS blue stays `altBlueIos` rather than converging on the brand blue,
// which would be a redesign of the screen, not a theme change.
const makeC = (c) => ({
  infoDeep: c.info,
  infoBorder: c.infoBorder,
  infoContainer: c.infoContainer,
  brandOrangeInk: c.brandOrangeInk,
  successDeep: c.successDeep,
  line: c.border,
  successContainer: c.successContainer,
  successBorder: c.successBorder,
  bg: c.bg,
  surface: c.surface,
  surfaceSunken: c.surfaceSunken,
  border: c.border,
  borderNeutral: c.borderNeutral,
  textPrimary: c.textPrimary,
  textStrongNeutral: c.textStrongNeutral,
  textBody: c.textBody,
  textSecondary: c.textSecondary,
  textMuted: c.textMuted,
  danger: c.danger,
  success: c.success,
  onSuccess: c.onSuccess,
  // The screen's action colour. `onBrandBlue` is its ink: white in light (4.02 on
  // iOS blue -- Apple's own pairing, the documented exception) and dark ink in
  // dark, where the fill lightens to #5FA8E8.
  accent: c.altBlueIos,
  onAccent: c.onBrandBlue,
  accentSky: c.altBlueSky,
  accentContainer: c.infoContainer,
  // A neutral chip fill and a disabled-control fill -- grey steps in light, and
  // recessed dark steps in dark.
  chipFill: c.bg,
  disabledFill: c.borderMedium,
  overlay: c.overlay,
  shadow: c.shadow,
});

const CreateServiceRequestScreen = ({ navigation, route }) => {
  const { isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const insets = useSafeAreaInsets();
  const { user, profile } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();
  // Booking gate — name + verified phone required before any request is created
  const { ensureBookingProfileComplete, handleProfileIncompleteError } =
    useBookingProfileGate(navigation);
  const useKm = useDistanceUnit();
  const existingRequest = route?.params?.existingRequest;

  // Run the gate once when the screen opens (in addition to the submit-time
  // check) so an incomplete profile is surfaced BEFORE the user fills the
  // whole form and loses their work navigating away to fix it.
  useEffect(() => {
    if (!existingRequest) {
      // Analytics: booking flow entered via the dedicated create screen.
      // (The profile gate now runs at submit time — a missing name is collected
      // inline there, so we no longer pop a collector on mount.)
      Analytics.track(EV.BOOKING_STARTED, { role: 'user', entry: 'create_screen' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Form state
  const [selectedService, setSelectedService] = useState(null);
  const [serviceDate, setServiceDate] = useState('');
  
  // Location state
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  
  // Request state
  const [isCreating, setIsCreating] = useState(false);
  const [createdRequest, setCreatedRequest] = useState(null);
  
  // Providers state
  const [isFetchingProviders, setIsFetchingProviders] = useState(false);
  const [providers, setProviders] = useState([]);
  const [searchRadius, setSearchRadius] = useState(0);
  const [showProvidersModal, setShowProvidersModal] = useState(false);
  const [bookingProviderId, setBookingProviderId] = useState(null); // Track which provider is being booked
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const scheduleTrackedRef = useRef(false); // analytics: one schedule_selected per screen visit
  
  // Saved address selection state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(true);
  
  // Get user's MongoDB ID
  const userId = user?.mongoId || profile?.id || profile?._id;

  // If navigated with an existing request, skip creation and go to provider search
  useEffect(() => {
    if (existingRequest?._id) {
      setCreatedRequest(existingRequest);
      setSelectedService(existingRequest.serviceType);
      // Auto-open provider search
      setTimeout(() => handleFetchProviders(existingRequest._id), 300);
    }
  }, [existingRequest?._id]);

  // Fetch location on mount
  useEffect(() => {
    requestLocationPermission();
    loadDefaultAddress();
  }, []);
  
  /**
   * Load user's default saved address
   */
  const loadDefaultAddress = async () => {
    if (!userId) return;
    
    try {
      const defaultAddr = await getDefaultAddress(userId);
      if (defaultAddr) {
        setSelectedAddress(defaultAddr);
        // Don't auto-switch to saved address, let user choose
      }
    } catch (error) {
      console.log('[Address] Could not load default address:', error);
    }
  };
  
  /**
   * Handle address selection from saved addresses
   */
  const handleSelectAddress = (address) => {
    setSelectedAddress(address);
    setLocation({
      latitude: address.location.latitude,
      longitude: address.location.longitude,
    });
    setUsingCurrentLocation(false);
    setShowAddressModal(false);
    Analytics.track(EV.LOCATION_SELECTED, { role: 'user', source: 'saved_address' });
  };
  
  /**
   * Switch back to current location
   */
  const handleUseCurrentLocation = () => {
    setUsingCurrentLocation(true);
    setSelectedAddress(null);
    getCurrentPosition();
  };

  const requestLocationPermission = async () => {
    setLocationLoading(true);
    setLocationError(null);

    try {
      if (Platform.OS === 'ios') {
        Geolocation.requestAuthorization('whenInUse');
      }

      getCurrentPosition();
    } catch (error) {
      console.error('[Location] Permission error:', error);
      setLocationError(t('createRequest.locationPermFailed'));
      setLocationLoading(false);
    }
  };

  const getCurrentPosition = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        console.log('[Location] Position received:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationLoading(false);
        setLocationError(null);
      },
      (error) => {
        console.error('[Location] Error:', error);
        setLocationLoading(false);
        
        // Only error code 2 (POSITION_UNAVAILABLE) reliably indicates GPS is off.
        // Code 3 (TIMEOUT) can happen on cold GPS start — don't treat as GPS-off.
        if (error.code === 2) {
          setLocationError(t('createRequest.gpsOff'));
          dialog(
            t('createRequest.gpsOff'),
            t('createRequest.enableGpsOrSaved'),
            [
              { text: t('createRequest.useSavedAddress'), onPress: () => setShowAddressModal(true) },
              {
                text: t('userHome.enableGps'),
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
                      Linking.openSettings();
                    });
                  }
                },
              },
            ]
          );
        } else {
          setLocationError(error.message || 'Failed to get location');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
      }
    );
  };

  // Generate date options (today + next 7 days)
  const getDateOptions = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const label = i === 0 ? t('createRequest.today') : i === 1 ? t('createRequest.tomorrow') : date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      
      dates.push({
        value: date.toISOString().split('T')[0],
        label,
        fullDate: date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      });
    }
    
    return dates;
  };

  const handleCreateRequest = async () => {
    // Validate
    if (!selectedService) {
      dialog(t('common.error'), t('createRequest.selectServiceError'));
      return;
    }
    if (!serviceDate) {
      dialog(t('common.error'), t('createRequest.selectDateError'));
      return;
    }
    if (!location) {
      dialog(t('common.error'), t('createRequest.locationRequiredError'));
      return;
    }
    if (!userId) {
      dialog(t('common.error'), t('createRequest.userNotFound'));
      return;
    }

    // Booking gate — a name and a verified phone are required to book.
    if (!(await ensureBookingProfileComplete())) {
      return;
    }

    setIsCreating(true);

    try {
      // Build full service address string for provider to see
      const serviceAddress = location.address || location.shortAddress || [
        location.addressLine1,
        location.landmark,
        location.city,
        location.state,
        location.pincode
      ].filter(Boolean).join(', ') || '';

      const result = await createServiceRequest({
        userId,
        serviceType: selectedService,
        latitude: location.latitude,
        longitude: location.longitude,
        serviceDate,
        serviceAddress,
        isOtherLocation: !location.isCurrentLocation,
        description: location.shortAddress || '',
      });

      if (result.success) {
        setCreatedRequest(result.request);
        
        // Show success prompt - user MUST select a provider or cancel
        dialog(
          t('createRequest.requestCreated'),
          t('createRequest.requestCreatedMsg'),
          [
            {
              text: t('userHome.cancelRequest'),
              style: 'destructive',
              onPress: async () => {
                // Cancel the request since user is not booking a provider
                try {
                  await cancelRequest(result.request._id, userId, 'User cancelled before booking provider');
                  console.log('[CreateRequest] Request cancelled - user did not book provider');
                } catch (err) {
                  console.error('[CreateRequest] Failed to cancel:', err);
                }
                navigation.goBack();
              },
            },
            {
              text: t('createRequest.findNearbyProviders'),
              onPress: () => handleFetchProviders(result.request._id),
            },
          ],
          { cancelable: false } // Force user to make a choice
        );
      } else {
        if (result.code === 'RATE_LIMITED' && result.retryAfter) {
          dialog(t('createRequest.pleaseWait'), t('createRequest.tooManyRequests', { n: result.retryAfter }));
        } else if (handleProfileIncompleteError(result)) {
          // Backend 403 PROFILE_INCOMPLETE — dialog shown, nothing else to do
        } else {
          dialog(t('common.error'), result.error || t('createRequest.createFailed'));
        }
      }
    } catch (error) {
      console.error('[CreateRequest] Error:', error);
      dialog(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleFetchProviders = async (requestId = null) => {
    const id = requestId || createdRequest?._id;
    
    if (!id) {
      dialog(t('common.error'), t('createRequest.requestNotFound'));
      return;
    }

    setIsFetchingProviders(true);
    setShowProvidersModal(true);

    try {
      const result = await getNearbyProviders(id);

      if (result.success) {
        setProviders(result.providers);
        setSearchRadius(result.searchRadius);
        
        if (result.providers.length === 0) {
          dialog(
            t('createRequest.noProvidersFound'),
            t('createRequest.noProvidersMsg', { distance: formatDistanceFromMeters(result.searchRadius, useKm) })
          );
        }
      } else {
        dialog(t('common.error'), result.error || t('createRequest.fetchProvidersFailed'));
        setShowProvidersModal(false);
      }
    } catch (error) {
      console.error('[FetchProviders] Error:', error);
      dialog(t('common.error'), t('common.somethingWentWrong'));
      setShowProvidersModal(false);
    } finally {
      setIsFetchingProviders(false);
    }
  };

  /**
   * Handle cancelling the service request
   */
  const handleCancelRequest = () => {
    if (!createdRequest?._id) {
      dialog(t('common.error'), t('createRequest.noRequestToCancel'));
      return;
    }

    dialog(
      t('userHome.cancelRequest'),
      t('createRequest.cancelRequestConfirm'),
      [
        {
          text: t('createRequest.noKeepIt'),
          style: 'cancel',
        },
        {
          text: t('createRequest.yesCancelIt'),
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await cancelRequest(
                createdRequest._id,
                userId,
                'User cancelled from app'
              );

              if (result.success) {
                dialog(
                  t('status.cancelled'),
                  t('createRequest.requestCancelled'),
                  [
                    {
                      text: t('common.ok'),
                      onPress: () => {
                        // Reset state
                        setCreatedRequest(null);
                        setProviders([]);
                        setSelectedService(null);
                        setServiceDate('');
                      },
                    },
                  ]
                );
              } else {
                dialog(t('common.error'), result.error || t('createRequest.cancelFailed'));
              }
            } catch (error) {
              console.error('[CancelRequest] Error:', error);
              dialog(t('common.error'), t('common.somethingWentWrong'));
            }
          },
        },
      ]
    );
  };

  // Track which providers have been contacted (called)
  const [contactedProviderIds, setContactedProviderIds] = useState(new Set());

  /**
   * Handle calling the provider — marks provider as contacted
   */
  const handleCallProvider = (phone, providerName, providerId) => {
    if (!phone) {
      dialog(t('common.error'), t('createRequest.phoneNotAvailable'));
      return;
    }

    // Format phone number for dialing
    const phoneNumber = phone.replace(/\s/g, '');
    const url = `tel:${phoneNumber}`;

    dialog(
      t('userHome.callProvider'),
      t('createRequest.callProviderDialog', { name: providerName, phone }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.callNow'),
          onPress: () => {
            // Mark as contacted before opening dialer
            if (providerId) {
              setContactedProviderIds(prev => new Set(prev).add(providerId));
            }
            Linking.canOpenURL(url)
              .then((supported) => {
                if (supported) {
                  return Linking.openURL(url);
                } else {
                  dialog(t('common.error'), t('createRequest.unableToCall'));
                }
              })
              .catch((err) => {
                console.error('[CallProvider] Error:', err);
                dialog(t('common.error'), t('createRequest.dialerFailed'));
              });
          },
        },
      ]
    );
  };

  /**
   * Handle booking the provider (send request to provider)
   */
  const handleBookProvider = async (provider) => {
    const requestId = createdRequest?._id;
    
    if (!requestId) {
      dialog(t('common.error'), t('createRequest.requestNotFound'));
      return;
    }

    if (!provider?._id) {
      dialog(t('common.error'), t('createRequest.providerInfoNotFound'));
      return;
    }

    // Require contact before booking
    if (!contactedProviderIds.has(provider._id)) {
      dialog(t('createRequest.callFirstToBook'), t('createRequest.callFirstDialog'), [{ text: t('common.ok') }]);
      return;
    }

    // Confirm booking
    dialog(
      t('createRequest.bookProvider'),
      t('createRequest.bookProviderConfirm', { name: provider.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('createRequest.bookNowBtn'),
          onPress: async () => {
            setBookingProviderId(provider._id);

            try {
              // Pass distance from provider object (from getNearbyProviders response)
              const result = await sendRequestToProvider(requestId, provider._id, provider.distance);

              if (result.success) {
                dialog(
                  t('createRequest.requestCreated'),
                  `${t('createRequest.requestSentSuccess', { name: provider.name })}\n\n${result.notificationSent ? t('createRequest.providerNotified') : t('createRequest.providerWillSee')}`,
                  [
                    {
                      text: t('common.ok'),
                      onPress: () => {
                        setShowProvidersModal(false);
                        navigation.goBack();
                      },
                    },
                  ]
                );
              } else {
                dialog(t('common.error'), isProviderRefusal(result.code)
                  ? t('workHours.providerNotAvailableMsg')
                  : (result.error || t('createRequest.sendFailed')));
              }
            } catch (error) {
              console.error('[BookProvider] Error:', error);
              dialog(t('common.error'), t('common.somethingWentWrong'));
            } finally {
              setBookingProviderId(null);
            }
          },
        },
      ]
    );
  };

  const renderServiceCard = (type) => (
    <TouchableOpacity
      key={type}
      style={[
        styles.serviceCard,
        selectedService === type && styles.serviceCardSelected,
      ]}
      onPress={() => setSelectedService(type)}
    >
      <Text style={styles.serviceIcon}>{SERVICE_ICONS[type] || '🔨'}</Text>
      <Text
        style={[
          styles.serviceLabel,
          selectedService === type && styles.serviceLabelSelected,
        ]}
        numberOfLines={2}
      >
        {SERVICE_TYPE_LABELS[type]}
      </Text>
    </TouchableOpacity>
  );

  const renderDateOption = (date) => (
    <TouchableOpacity
      key={date.value}
      style={[
        styles.dateOption,
        serviceDate === date.value && styles.dateOptionSelected,
      ]}
      onPress={() => {
        setServiceDate(date.value);
        setShowDatePicker(false);
        // Track once per visit — re-picking a different date is the same selection act
        if (!scheduleTrackedRef.current) {
          scheduleTrackedRef.current = true;
          Analytics.track(EV.SCHEDULE_SELECTED, { role: 'user', entry: 'create_screen' });
        }
      }}
    >
      <Text
        style={[
          styles.dateLabel,
          serviceDate === date.value && styles.dateLabelSelected,
        ]}
      >
        {date.label}
      </Text>
      <Text
        style={[
          styles.dateFullLabel,
          serviceDate === date.value && styles.dateLabelSelected,
        ]}
      >
        {date.fullDate}
      </Text>
    </TouchableOpacity>
  );

  const renderProviderCard = ({ item: provider }) => {
    const isBooking = bookingProviderId === provider._id;
    
    return (
      <View style={styles.providerCard}>
        <View style={styles.providerHeader}>
          <View style={styles.providerAvatar}>
            <Text style={styles.providerInitial}>
              {provider.name?.charAt(0)?.toUpperCase() || 'P'}
            </Text>
          </View>
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{provider.name || t('tracking.providerFallback')}</Text>
            <Text style={styles.providerService}>
              {SERVICE_TYPE_LABELS[provider.serviceType] || provider.serviceType}
            </Text>
          </View>
        </View>
        
        <View style={styles.providerStats}>
          {provider.distance !== undefined && (
            <View style={styles.statItem}>
              <MaterialIcon name="place" size={13} color={C.textMuted} />
              <Text style={styles.statText}>
                {formatDistanceFromMeters(provider.distance, useKm)} {t('common.away')}
              </Text>
            </View>
          )}
          {provider.rating !== undefined && (
            <View style={styles.statItem}>
              <MaterialIcon name="star" size={13} color={C.brandOrangeInk} />
              <Text style={styles.statText}>{provider.rating.toFixed(1)}</Text>
            </View>
          )}
          {provider.totalJobs !== undefined && (
            <View style={styles.statItem}>
              <MaterialIcon name="check-circle" size={13} color={C.successDeep} />
              <Text style={styles.statText}>{provider.totalJobs} {t('providerHistory.jobs')}</Text>
            </View>
          )}
        </View>

        {/* Phone Number Display */}
        {provider.phone && (
          <View style={styles.phoneContainer}>
            <Text style={styles.phoneIcon}>📱</Text>
            <Text style={styles.phoneNumber}>{provider.phone}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.providerActions}>
          {/* Call Button */}
          {(provider.phone || provider.verifiedPhone) && (
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => handleCallProvider(provider.phone || provider.verifiedPhone, provider.name, provider._id)}
            >
              <Text style={styles.callButtonText}>
                {contactedProviderIds.has(provider._id) ? t('createRequest.called') : t('userHome.callProvider')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Book Button — only enabled after contacting */}
          {contactedProviderIds.has(provider._id) ? (
            <TouchableOpacity
              style={[
                styles.bookButton,
                isBooking && styles.bookButtonDisabled,
              ]}
              onPress={() => handleBookProvider(provider)}
              disabled={isBooking}
            >
              {isBooking ? (
                <ActivityIndicator size="small" color={C.infoDeep} />
              ) : (
                <Text style={styles.bookButtonText}>{t('createRequest.bookProvider')}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.bookButton, { backgroundColor: C.disabledFill }]}>
              <Text style={[styles.bookButtonText, { color: C.textMuted }]}>{t('createRequest.callFirstToBook')}</Text>
            </View>
          )}
        </View>

        {/* Instructions */}
        <Text style={styles.providerInstructions}>
          {t('createRequest.callDiscussHint')}
        </Text>
      </View>
    );
  };

  /**
   * Handle closing the providers modal
   * If no provider was selected, cancel the request
   */
  const handleCloseProvidersModal = async () => {
    // If request exists but no provider was sent to, cancel it
    if (createdRequest && !createdRequest.lastSentProviderId) {
      dialog(
        t('userHome.cancelRequest'),
        t('createRequest.cancelNoProvider'),
        [
          {
            text: t('createRequest.keepLooking'),
            style: 'cancel',
          },
          {
            text: t('userHome.cancelRequest'),
            style: 'destructive',
            onPress: async () => {
              try {
                await cancelRequest(createdRequest._id, userId, 'User cancelled - no provider selected');
                console.log('[CreateRequest] Request cancelled - modal closed without booking');
              } catch (err) {
                console.error('[CreateRequest] Failed to cancel:', err);
              }
              setShowProvidersModal(false);
              setCreatedRequest(null);
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      setShowProvidersModal(false);
    }
  };

  const renderProvidersModal = () => (
    <Modal
      visible={showProvidersModal}
      animationType="slide"
      onRequestClose={handleCloseProvidersModal}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('createRequest.nearbyProviders')}</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleCloseProvidersModal}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {isFetchingProviders ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.loadingText}>{t('createRequest.findingProviders')}</Text>
            <Text style={styles.loadingSubtext}>
              {t('createRequest.searchingRadius')}
            </Text>
          </View>
        ) : (
          <>
            {searchRadius > 0 && (
              <View style={styles.searchInfo}>
                <Text style={styles.searchInfoText}>
                  {t('createRequest.foundProviders', { n: providers.length, distance: formatDistanceFromMeters(searchRadius, useKm) })}
                </Text>
              </View>
            )}

            <FlatList
              data={providers}
              keyExtractor={(item) => item._id || item.id || Math.random().toString()}
              renderItem={renderProviderCard}
              contentContainerStyle={styles.providersList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>😔</Text>
                  <Text style={styles.emptyText}>{t('createRequest.noProvidersFound')}</Text>
                  <Text style={styles.emptySubtext}>
                    {t('createRequest.tryAgainOrExpand')}
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl
                  refreshing={isFetchingProviders}
                  onRefresh={() => handleFetchProviders()} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.surface} />
              }
            />
          </>
        )}
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <Text style={styles.title}>{t('createRequest.title')}</Text>
      <Text style={styles.subtitle}>
        {t('createRequest.subtitle')}
      </Text>

      {/* Service Location Section - Like Ola/Uber */}
      <Text style={styles.sectionTitle}>{t('createRequest.serviceLocation')}</Text>
      <View style={styles.addressSection}>
        {/* Current Address Display */}
        <TouchableOpacity 
          style={styles.addressCard}
          onPress={() => setShowAddressModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.addressIconWrap}>
            <MaterialIcon 
              name={usingCurrentLocation ? 'my-location' : 'location-on'} 
              size={24} 
              color={usingCurrentLocation ? C.accentSky : C.success} 
            />
          </View>
          <View style={styles.addressContent}>
            {locationLoading ? (
              <>
                <Text style={styles.addressTitle}>{t('createRequest.gettingLocation')}</Text>
                <ActivityIndicator size="small" color={C.accentSky} style={{ marginTop: 4 }} />
              </>
            ) : locationError ? (
              <>
                <Text style={styles.addressTitle}>{t('createRequest.locationError')}</Text>
                <Text style={styles.addressSubtitle}>{locationError}</Text>
              </>
            ) : usingCurrentLocation ? (
              <>
                <Text style={styles.addressTitle}>{t('createRequest.currentLocation')}</Text>
                <Text style={styles.addressSubtitle}>
                  {t('createRequest.usingGps')} • {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : `${t('createRequest.gettingLocation')}`}
                </Text>
              </>
            ) : selectedAddress ? (
              <>
                <Text style={styles.addressTitle}>
                  {selectedAddress.label === 'home' ? '🏠 Home' : 
                   selectedAddress.label === 'work' ? '💼 Work' : 
                   selectedAddress.customLabel || t('createRequest.savedAddresses')}
                </Text>
                <Text style={styles.addressSubtitle} numberOfLines={2}>
                  {selectedAddress.addressLine1}, {selectedAddress.city} - {selectedAddress.pincode}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.addressTitle}>{t('createRequest.selectLocation')}</Text>
                <Text style={styles.addressSubtitle}>{t('createRequest.tapToChoose')}</Text>
              </>
            )}
          </View>
          <MaterialIcon name="chevron-right" size={24} color={C.textMuted} />
        </TouchableOpacity>
        
        {/* Quick Actions */}
        <View style={styles.addressActions}>
          {!usingCurrentLocation && (
            <TouchableOpacity 
              style={styles.addressActionBtn}
              onPress={handleUseCurrentLocation}
            >
              <MaterialIcon name="my-location" size={18} color={C.accentSky} />
              <Text style={styles.addressActionText}>{t('createRequest.useCurrentLocation')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.addressActionBtn}
            onPress={() => setShowAddressModal(true)}
          >
            <MaterialIcon name="bookmark" size={18} color={C.accentSky} />
            <Text style={styles.addressActionText}>{t('createRequest.savedAddresses')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Service Type Selection */}
      <Text style={styles.sectionTitle}>{t('createRequest.selectServiceType')}</Text>
      <View style={styles.servicesGrid}>
        {Object.values(SERVICE_TYPES).map(renderServiceCard)}
      </View>

      {/* Date Selection */}
      <Text style={styles.sectionTitle}>{t('createRequest.selectServiceDate')}</Text>
      <TouchableOpacity
        style={styles.dateInput}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={serviceDate ? styles.dateInputText : styles.dateInputPlaceholder}>
          {serviceDate
            ? getDateOptions().find((d) => d.value === serviceDate)?.fullDate
            : t('createRequest.tapToSelectDate')}
        </Text>
        <Text style={styles.dateInputIcon}>📅</Text>
      </TouchableOpacity>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={styles.datePickerOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerContainer}>
            <Text style={styles.datePickerTitle}>{t('createRequest.selectDateTitle')}</Text>
            {getDateOptions().map(renderDateOption)}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Button */}
      <TouchableOpacity
        style={[
          styles.createButton,
          (!selectedService || !serviceDate || !location || isCreating) &&
            styles.createButtonDisabled,
        ]}
        onPress={handleCreateRequest}
        disabled={!selectedService || !serviceDate || !location || isCreating}
      >
        {isCreating ? (
          <ActivityIndicator color={C.infoDeep} />
        ) : (
          <Text style={styles.createButtonText}>{t('createRequest.createRequestBtn')}</Text>
        )}
      </TouchableOpacity>

      {/* If request created, show fetch providers button */}
      {createdRequest && (
        <TouchableOpacity
          style={styles.fetchProvidersButton}
          onPress={() => handleFetchProviders()}
        >
          <Text style={styles.fetchProvidersText}>🔍 {t('createRequest.findNearbyProviders')}</Text>
        </TouchableOpacity>
      )}

      {/* Cancel Request Button - only show if request is created and not yet booked */}
      {createdRequest && (
        <TouchableOpacity
          style={styles.cancelRequestButton}
          onPress={handleCancelRequest}
        >
          <Text style={styles.cancelRequestText}>❌ {t('userHome.cancelRequest')}</Text>
        </TouchableOpacity>
      )}

      {/* Providers Modal */}
      {renderProvidersModal()}
      
      {/* Saved Addresses Modal */}
      <Modal
        visible={showAddressModal}
        animationType="slide"
        onRequestClose={() => setShowAddressModal(false)}
      >
        <SavedAddresses
          userId={userId}
          selectable={true}
          showHeader={true}
          onSelectAddress={handleSelectAddress}
          onClose={() => setShowAddressModal(false)}
        />
      </Modal>
    </ScrollView>
  );
};

const makeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: C.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: C.textSecondary,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: C.textPrimary,
    marginTop: 20,
    marginBottom: 12,
  },
  locationStatus: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationText: {
    fontSize: 14,
    color: C.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
  locationError: {
    fontSize: 14,
    color: C.danger,
  },
  locationSuccess: {
    fontSize: 14,
    color: C.success,
  },
  retryText: {
    fontSize: 14,
    color: C.accent,
    fontWeight: '600',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    width: '31%',
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceCardSelected: {
    borderColor: C.accent,
    backgroundColor: C.accentContainer,
  },
  serviceIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  serviceLabel: {
    fontSize: 12,
    color: C.textBody,
    textAlign: 'center',
    fontWeight: '500',
  },
  serviceLabelSelected: {
    color: C.accent,
    fontWeight: '600',
  },
  dateInput: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateInputText: {
    fontSize: 16,
    color: C.textBody,
  },
  dateInputPlaceholder: {
    fontSize: 16,
    color: C.textMuted,
  },
  dateInputIcon: {
    fontSize: 24,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  datePickerContainer: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  dateOption: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: C.surfaceSunken,
  },
  dateOptionSelected: {
    backgroundColor: C.accent,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textBody,
  },
  dateFullLabel: {
    fontSize: 14,
    color: C.textSecondary,
    marginTop: 4,
  },
  dateLabelSelected: {
    color: C.onAccent,
  },
  createButton: {
    backgroundColor: C.infoContainer,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: C.infoBorder,
  },
  createButtonDisabled: {
    backgroundColor: C.disabledFill,
  },
  createButtonText: {
    color: C.infoDeep,
    fontSize: 18,
    fontWeight: '600',
  },
  fetchProvidersButton: {
    backgroundColor: C.successContainer,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: C.successBorder,
  },
  fetchProvidersText: {
    color: C.successDeep,
    fontSize: 18,
    fontWeight: '600',
  },
  cancelRequestButton: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: C.danger,
  },
  cancelRequestText: {
    color: C.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: C.textPrimary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.chipFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: C.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    color: C.textBody,
    marginTop: 20,
    fontWeight: '500',
  },
  loadingSubtext: {
    fontSize: 14,
    color: C.textSecondary,
    marginTop: 8,
  },
  searchInfo: {
    backgroundColor: C.accentContainer,
    padding: 12,
    alignItems: 'center',
  },
  searchInfoText: {
    fontSize: 14,
    color: C.accent,
    fontWeight: '500',
  },
  providersList: {
    padding: 16,
  },
  // Compacted: 16 -> 13 padding, 12 -> 9 gap, shadow dropped. A list of these is
  // scrolled and compared, so vertical cost per card is what matters, and the
  // border already separates them.
  providerCard: { backgroundColor: C.surface, borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  providerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  providerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInitial: {
    fontSize: 22,
    fontWeight: '600',
    color: C.onAccent,
  },
  providerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  providerName: { fontSize: 15.5, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.2 },
  providerService: {
    fontSize: 14,
    color: C.textSecondary,
    marginTop: 2,
  },
  providerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  statText: {
    fontSize: 14,
    color: C.textSecondary,
  },
  contactButton: {
    backgroundColor: C.accentContainer,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  contactButtonText: {
    color: C.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  // Phone display styles
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceSunken,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  phoneIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  phoneNumber: {
    fontSize: 16,
    color: C.textBody,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  // Action buttons container
  providerActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  // Tinted + edged, not a solid slab — the convention already applied to call
  // and directions on the history screens.
  callButton: { flex: 1, backgroundColor: C.successContainer, borderWidth: 1, borderColor: C.successBorder, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  callButtonText: {
    color: C.successDeep,
    fontSize: 16,
    fontWeight: '600',
  },
  // The ONE primary action in this card, so it stays solid. That contrast is
  // exactly what the tinted call button exists to create.
  bookButton: { flex: 2, backgroundColor: C.infoContainer, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.infoBorder,
  },
  bookButtonDisabled: {
    backgroundColor: C.disabledFill,
  },
  bookButtonText: {
    color: C.infoDeep,
    fontSize: 16,
    fontWeight: '600',
  },
  providerInstructions: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: C.textBody,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
  },
  
  // Address Section Styles - Like Ola/Uber
  addressSection: {
    marginBottom: 20,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderNeutral,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  addressIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addressContent: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textStrongNeutral,
  },
  addressSubtitle: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  addressActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  addressActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.accentContainer,
    borderRadius: 20,
  },
  addressActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accentSky,
  },
  });
};

export default CreateServiceRequestScreen;
