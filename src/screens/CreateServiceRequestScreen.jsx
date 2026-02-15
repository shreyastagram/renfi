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

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  FlatList,
  RefreshControl,
  Linking,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import {
  createServiceRequest,
  getNearbyProviders,
  sendRequestToProvider,
  cancelRequest,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
} from '../services/traditionalServiceService';
import SavedAddresses from '../components/SavedAddresses';
import { getSavedAddresses, getDefaultAddress } from '../services/addressService';

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

const CreateServiceRequestScreen = ({ navigation }) => {
  const { user, profile } = useApp();
  
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
  
  // Saved address selection state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(true);
  
  // Get user's MongoDB ID
  const userId = user?.mongoId || profile?.id || profile?._id;

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
      setLocationError('Failed to get location permission');
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
        setLocationError(error.message || 'Failed to get location');
        setLocationLoading(false);
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
      
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', {
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
      Alert.alert('Error', 'Please select a service type');
      return;
    }
    if (!serviceDate) {
      Alert.alert('Error', 'Please select a service date');
      return;
    }
    if (!location) {
      Alert.alert('Error', 'Location is required. Please enable location services.');
      return;
    }
    if (!userId) {
      Alert.alert('Error', 'User not found. Please login again.');
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
        Alert.alert(
          '✅ Request Created!',
          'Your service request has been created. Please find a provider to complete the booking.',
          [
            {
              text: 'Cancel Request',
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
              text: 'Find Providers',
              onPress: () => handleFetchProviders(result.request._id),
            },
          ],
          { cancelable: false } // Force user to make a choice
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to create request');
      }
    } catch (error) {
      console.error('[CreateRequest] Error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFetchProviders = async (requestId = null) => {
    const id = requestId || createdRequest?._id;
    
    if (!id) {
      Alert.alert('Error', 'Request not found');
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
          Alert.alert(
            'No Providers Found',
            `No providers were found within ${result.searchRadius / 1000}km of your location. Please try again later.`
          );
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to fetch providers');
        setShowProvidersModal(false);
      }
    } catch (error) {
      console.error('[FetchProviders] Error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
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
      Alert.alert('Error', 'No request to cancel');
      return;
    }

    Alert.alert(
      '⚠️ Cancel Request',
      'Are you sure you want to cancel this service request?',
      [
        {
          text: 'No, Keep It',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await cancelRequest(
                createdRequest._id,
                userId,
                'User cancelled from app'
              );

              if (result.success) {
                Alert.alert(
                  '✅ Cancelled',
                  'Your service request has been cancelled.',
                  [
                    {
                      text: 'OK',
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
                Alert.alert('Error', result.error || 'Failed to cancel request');
              }
            } catch (error) {
              console.error('[CancelRequest] Error:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
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
      Alert.alert('Error', 'Phone number not available');
      return;
    }

    // Format phone number for dialing
    const phoneNumber = phone.replace(/\s/g, '');
    const url = `tel:${phoneNumber}`;

    Alert.alert(
      '📞 Call Provider',
      `Call ${providerName} at ${phone}?\n\nDiscuss your requirements before booking.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
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
                  Alert.alert('Error', 'Unable to make phone calls');
                }
              })
              .catch((err) => {
                console.error('[CallProvider] Error:', err);
                Alert.alert('Error', 'Failed to open phone dialer');
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
      Alert.alert('Error', 'Service request not found');
      return;
    }

    if (!provider?._id) {
      Alert.alert('Error', 'Provider information not found');
      return;
    }

    // Require contact before booking
    if (!contactedProviderIds.has(provider._id)) {
      Alert.alert('Call First', 'Please call the provider to discuss your requirement before booking.', [{ text: 'OK' }]);
      return;
    }

    // Confirm booking
    Alert.alert(
      '📋 Book Provider',
      `Send your service request to ${provider.name}?\n\nThey will be notified and can accept your request.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Book Now',
          onPress: async () => {
            setBookingProviderId(provider._id);

            try {
              // Pass distance from provider object (from getNearbyProviders response)
              const result = await sendRequestToProvider(requestId, provider._id, provider.distance);

              if (result.success) {
                Alert.alert(
                  '✅ Request Sent!',
                  `Your request has been sent to ${provider.name}. They will review and accept it shortly.\n\n${result.notificationSent ? 'Provider has been notified.' : 'Provider will see your request when they check their app.'}`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        setShowProvidersModal(false);
                        navigation.goBack();
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to send request to provider');
              }
            } catch (error) {
              console.error('[BookProvider] Error:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
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
            <Text style={styles.providerName}>{provider.name || 'Provider'}</Text>
            <Text style={styles.providerService}>
              {SERVICE_TYPE_LABELS[provider.serviceType] || provider.serviceType}
            </Text>
          </View>
        </View>
        
        <View style={styles.providerStats}>
          {provider.distance !== undefined && (
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>📍</Text>
              <Text style={styles.statText}>
                {(provider.distance / 1000).toFixed(1)} km away
              </Text>
            </View>
          )}
          {provider.rating !== undefined && (
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>⭐</Text>
              <Text style={styles.statText}>{provider.rating.toFixed(1)}</Text>
            </View>
          )}
          {provider.totalJobs !== undefined && (
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>✅</Text>
              <Text style={styles.statText}>{provider.totalJobs} jobs</Text>
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
                {contactedProviderIds.has(provider._id) ? '✅ Called' : '📞 Call'}
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
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.bookButtonText}>📋 Book Provider</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.bookButton, { backgroundColor: '#E5E7EB' }]}>
              <Text style={[styles.bookButtonText, { color: '#999' }]}>Call first to book</Text>
            </View>
          )}
        </View>

        {/* Instructions */}
        <Text style={styles.providerInstructions}>
          💡 Call to discuss your issue, then book the provider
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
      Alert.alert(
        'Cancel Request?',
        'No provider was selected. The request will be cancelled.',
        [
          {
            text: 'Keep Looking',
            style: 'cancel',
          },
          {
            text: 'Cancel Request',
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
          <Text style={styles.modalTitle}>Nearby Providers</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleCloseProvidersModal}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {isFetchingProviders ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Finding nearby providers...</Text>
            <Text style={styles.loadingSubtext}>
              Searching within 5-10km radius
            </Text>
          </View>
        ) : (
          <>
            {searchRadius > 0 && (
              <View style={styles.searchInfo}>
                <Text style={styles.searchInfoText}>
                  Found {providers.length} provider{providers.length !== 1 ? 's' : ''} within{' '}
                  {(searchRadius / 1000).toFixed(0)}km
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
                  <Text style={styles.emptyText}>No providers found nearby</Text>
                  <Text style={styles.emptySubtext}>
                    Try again later or expand your search area
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl
                  refreshing={isFetchingProviders}
                  onRefresh={() => handleFetchProviders()}
                />
              }
            />
          </>
        )}
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Service Request</Text>
      <Text style={styles.subtitle}>
        Select a service and we'll find providers near you
      </Text>

      {/* Service Location Section - Like Ola/Uber */}
      <Text style={styles.sectionTitle}>Service Location</Text>
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
              color={usingCurrentLocation ? '#3B82F6' : '#10B981'} 
            />
          </View>
          <View style={styles.addressContent}>
            {locationLoading ? (
              <>
                <Text style={styles.addressTitle}>Getting location...</Text>
                <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 4 }} />
              </>
            ) : locationError ? (
              <>
                <Text style={styles.addressTitle}>Location Error</Text>
                <Text style={styles.addressSubtitle}>{locationError}</Text>
              </>
            ) : usingCurrentLocation ? (
              <>
                <Text style={styles.addressTitle}>Current Location</Text>
                <Text style={styles.addressSubtitle}>
                  Using GPS • {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Detecting...'}
                </Text>
              </>
            ) : selectedAddress ? (
              <>
                <Text style={styles.addressTitle}>
                  {selectedAddress.label === 'home' ? '🏠 Home' : 
                   selectedAddress.label === 'work' ? '💼 Work' : 
                   selectedAddress.customLabel || 'Saved Address'}
                </Text>
                <Text style={styles.addressSubtitle} numberOfLines={2}>
                  {selectedAddress.addressLine1}, {selectedAddress.city} - {selectedAddress.pincode}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.addressTitle}>Select Location</Text>
                <Text style={styles.addressSubtitle}>Tap to choose a saved address</Text>
              </>
            )}
          </View>
          <MaterialIcon name="chevron-right" size={24} color="#9CA3AF" />
        </TouchableOpacity>
        
        {/* Quick Actions */}
        <View style={styles.addressActions}>
          {!usingCurrentLocation && (
            <TouchableOpacity 
              style={styles.addressActionBtn}
              onPress={handleUseCurrentLocation}
            >
              <MaterialIcon name="my-location" size={18} color="#3B82F6" />
              <Text style={styles.addressActionText}>Use Current Location</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.addressActionBtn}
            onPress={() => setShowAddressModal(true)}
          >
            <MaterialIcon name="bookmark" size={18} color="#3B82F6" />
            <Text style={styles.addressActionText}>Saved Addresses</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Service Type Selection */}
      <Text style={styles.sectionTitle}>Select Service Type</Text>
      <View style={styles.servicesGrid}>
        {Object.values(SERVICE_TYPES).map(renderServiceCard)}
      </View>

      {/* Date Selection */}
      <Text style={styles.sectionTitle}>Select Service Date</Text>
      <TouchableOpacity
        style={styles.dateInput}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={serviceDate ? styles.dateInputText : styles.dateInputPlaceholder}>
          {serviceDate
            ? getDateOptions().find((d) => d.value === serviceDate)?.fullDate
            : 'Tap to select date'}
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
            <Text style={styles.datePickerTitle}>Select Date</Text>
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
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>Create Request</Text>
        )}
      </TouchableOpacity>

      {/* If request created, show fetch providers button */}
      {createdRequest && (
        <TouchableOpacity
          style={styles.fetchProvidersButton}
          onPress={() => handleFetchProviders()}
        >
          <Text style={styles.fetchProvidersText}>🔍 Find Nearby Providers</Text>
        </TouchableOpacity>
      )}

      {/* Cancel Request Button - only show if request is created and not yet booked */}
      {createdRequest && (
        <TouchableOpacity
          style={styles.cancelRequestButton}
          onPress={handleCancelRequest}
        >
          <Text style={styles.cancelRequestText}>❌ Cancel Request</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 12,
  },
  locationStatus: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
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
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  locationError: {
    fontSize: 14,
    color: '#dc3545',
  },
  locationSuccess: {
    fontSize: 14,
    color: '#28a745',
  },
  retryText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f7ff',
  },
  serviceIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  serviceLabel: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  serviceLabelSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  dateInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateInputText: {
    fontSize: 16,
    color: '#333',
  },
  dateInputPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  dateInputIcon: {
    fontSize: 24,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  datePickerContainer: {
    backgroundColor: '#fff',
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
    backgroundColor: '#f8f9fa',
  },
  dateOptionSelected: {
    backgroundColor: '#007AFF',
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dateFullLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  dateLabelSelected: {
    color: '#fff',
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  fetchProvidersButton: {
    backgroundColor: '#28a745',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  fetchProvidersText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelRequestButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#dc3545',
  },
  cancelRequestText: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
    marginTop: 20,
    fontWeight: '500',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  searchInfo: {
    backgroundColor: '#e8f4ff',
    padding: 12,
    alignItems: 'center',
  },
  searchInfoText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  providersList: {
    padding: 16,
  },
  providerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  providerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInitial: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
  },
  providerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  providerService: {
    fontSize: 14,
    color: '#666',
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
    color: '#666',
  },
  contactButton: {
    backgroundColor: '#f0f7ff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  contactButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Phone display styles
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
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
    color: '#333',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  // Action buttons container
  providerActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  callButton: {
    flex: 1,
    backgroundColor: '#28a745',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bookButton: {
    flex: 2,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#ccc',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  providerInstructions: {
    fontSize: 12,
    color: '#888',
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
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  addressIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
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
    color: '#1F2937',
  },
  addressSubtitle: {
    fontSize: 13,
    color: '#6B7280',
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
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
  },
  addressActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
});

export default CreateServiceRequestScreen;
