/**
 * User Home Screen
 * 
 * Production-grade home screen with:
 * - Full screen map with user location
 * - Hamburger menu + Avatar for profile
 * - Expandable bottom sheet for service booking
 * - Inline date picker and booking flow
 * - Find nearby providers integration
 * - Global location context with 30-second refresh
 * - Address management icon
 * 
 * @version 3.0.0 - Global Location Context + Address Management
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Linking,
  Alert,
  ScrollView,
  Animated,
  PanResponder,
  Platform,
  PermissionsAndroid,
  Modal,
  Image,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { LocationMap, Icon, ServiceIcon, DateTimePicker, LocationPicker, ProviderDetailsModal, FixhomiLogo } from '../components';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import { useApp } from '../context/AppContext';
import { useLocation } from '../context/LocationContext';
import {
  createServiceRequest,
  getNearbyProviders,
  sendRequestToProvider,
  cancelRequest,
  getProviderDetails,
  retryProviderSearch,
} from '../services/traditionalServiceService';
import { initiateCall } from '../services/callService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Bottom sheet heights
const SHEET_MIN_HEIGHT = 160;
const SHEET_MID_HEIGHT = SCREEN_HEIGHT * 0.40; // 30% for initial state - shows user location
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;

// Brand colors
const BRAND = {
  primary: '#f67c16', // Orange
  secondary: '#2b76bc', // Blue
  background: '#faf7f7',
  white: '#FFFFFF',
  neutral: '#6B7280',
  cardBg: '#F5F7FA',
};

// Service categories - Unified neutral palette (no rainbow)
// IDs must match backend allowedCategories for proper provider matching
const SERVICE_CATEGORIES = [
  { id: 'electrician', name: 'Electrician', iconName: 'electrician' },
  { id: 'plumber', name: 'Plumber', iconName: 'plumber' },
  { id: 'electronics_technician', name: 'Electronics', iconName: 'electronics_technician' },
  { id: 'carpenter', name: 'Carpenter', iconName: 'carpenter' },
  { id: 'painter', name: 'Painter', iconName: 'painter' },
  { id: 'solar_repairing', name: 'Solar', iconName: 'solar_repairing' },
  { id: 'welder', name: 'Welder', iconName: 'welder' },
  { id: 'salon', name: 'Salon', iconName: 'salon' },
  { id: 'vehicle_cleaning', name: 'Vehicle Clean', iconName: 'vehicle_cleaning' },
  { id: 'mason_tiler', name: 'Mason & Tiler', iconName: 'mason_tiler' },
  { id: 'driver', name: 'Driver', iconName: 'driver' },
  { id: 'ac_repair', name: 'AC Repair', iconName: 'ac_repair' },
  { id: 'cleaning', name: 'Cleaning', iconName: 'cleaning' },
];

const ServiceCard = ({ service, onPress }) => (
  <TouchableOpacity
    style={styles.serviceCard}
    onPress={() => onPress(service)}
    activeOpacity={0.7}
  >
    <View style={styles.serviceIconContainer}>
      <ServiceIcon serviceType={service.id} size={24} color={BRAND.secondary} />
    </View>
    <Text style={styles.serviceName}>{service.name}</Text>
  </TouchableOpacity>
);

const ProviderCard = ({ provider, onCall, onBook, onPress, booking, contacted, calling }) => (
  <TouchableOpacity 
    style={styles.providerCard} 
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.providerInfo}>
      {/* Profile Picture or Avatar */}
      {provider.profilePicture?.url ? (
        <Image 
          source={{ uri: provider.profilePicture.url }} 
          style={styles.providerAvatarImage} 
        />
      ) : (
        <View style={styles.providerAvatar}>
          <Text style={styles.providerInitial}>{provider.name?.charAt(0)?.toUpperCase() || 'P'}</Text>
        </View>
      )}
      <View style={styles.providerDetails}>
        <View style={styles.providerNameRow}>
          <Text style={styles.providerName}>{provider.name}</Text>
          {(provider.verified || provider.verification?.isVerified) && (
            <MaterialIcon name="verified" size={16} color="#2563EB" style={styles.verifiedBadge} />
          )}
          {contacted && (
            <View style={styles.contactedBadge}>
              <MaterialIcon name="call-made" size={10} color="#FFFFFF" />
              <Text style={styles.contactedBadgeText}>Contacted</Text>
            </View>
          )}
        </View>
        <View style={styles.providerDistanceRow}>
          <Icon name="location" size={14} color="#6B7280" />
          <Text style={styles.providerDistance}>
            {provider.distanceKm ? `${provider.distanceKm} km away` : 
             typeof provider.distance === 'number' ? `${(provider.distance / 1000).toFixed(2)} km away` : 
             'Nearby'}
          </Text>
        </View>
        {(provider.rating > 0 || provider.ratings?.average > 0) && (
          <View style={styles.providerRatingRow}>
            <Icon name="star" size={14} color="#F59E0B" />
            <Text style={styles.providerRating}>
              {(provider.ratings?.average || provider.rating || 0).toFixed(1)}
              {provider.ratings?.total > 0 && (
                <Text style={styles.providerRatingCount}> ({provider.ratings.total})</Text>
              )}
            </Text>
          </View>
        )}
      </View>
      <TouchableOpacity 
        style={styles.viewDetailsIcon}
        onPress={onPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialIcon name="chevron-right" size={24} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
    <View style={styles.providerActions}>
      <TouchableOpacity 
        style={[styles.callButton, calling && styles.callButtonCalling]} 
        onPress={(e) => {
          e.stopPropagation();
          onCall(provider);
        }}
        disabled={calling}
      >
        {calling ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Icon name="phone" size={22} color="#FFFFFF" />
        )}
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.bookButton, booking && styles.bookButtonLoading]} 
        onPress={(e) => {
          e.stopPropagation();
          onBook(provider);
        }} 
        disabled={booking}
      >
        {booking ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.bookButtonText}>Send Request</Text>}
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
);

const UserHomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const { user, profile, userType, logout } = useApp();
  
  // Use global location context (fetches once, updates every 30 sec)
  const { 
    currentLocation, 
    locationAddress, 
    displayAddress, 
    locationLoading, 
    locationError, 
    locationPermission: globalLocationPermission,
    refreshLocation 
  } = useLocation();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [step, setStep] = useState('select');
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(null); // Combined date & time
  const [serviceLocation, setServiceLocation] = useState(null); // For "Book for Others"
  const [serviceDescription, setServiceDescription] = useState(''); // Optional description
  const [createdRequest, setCreatedRequest] = useState(null);
  const [providers, setProviders] = useState([]);
  const [searchRadius, setSearchRadius] = useState(0);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [fetchingProviders, setFetchingProviders] = useState(false);
  const [bookingProvider, setBookingProvider] = useState(null);
  
  // Provider details modal state
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerDetailsVisible, setProviderDetailsVisible] = useState(false);
  
  // Permission states (use global for location, local for notifications)
  const [locationPermission, setLocationPermission] = useState(globalLocationPermission);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState('unknown');
  
  // Sync location permission from global context
  useEffect(() => {
    setLocationPermission(globalLocationPermission);
  }, [globalLocationPermission]);

  // Animated sheet height
  const sheetHeight = useRef(new Animated.Value(SHEET_MID_HEIGHT)).current;
  const currentHeightRef = useRef(SHEET_MID_HEIGHT);

  // Pan responder for swipe gestures on the bottom sheet handle
  const panResponder = useMemo(() => 
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // More sensitive to vertical movement for better drag from top
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // Store current height when gesture starts
        sheetHeight.stopAnimation((value) => {
          currentHeightRef.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        // Calculate new height based on drag (negative dy = swipe up = increase height)
        const newHeight = Math.max(
          SHEET_MIN_HEIGHT,
          Math.min(SHEET_MAX_HEIGHT, currentHeightRef.current - gestureState.dy)
        );
        sheetHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const velocity = gestureState.vy;
        const currentValue = currentHeightRef.current - gestureState.dy;
        const dragDistance = gestureState.dy;
        
        let targetHeight = SHEET_MID_HEIGHT;
        
        // Lower velocity threshold for easier swiping
        if (Math.abs(velocity) > 0.3) {
          if (velocity < 0) {
            // Swiping up fast
            targetHeight = SHEET_MAX_HEIGHT;
          } else {
            // Swiping down fast - easier to go down from max
            if (currentHeightRef.current >= SHEET_MAX_HEIGHT * 0.9) {
              // From near max, go to mid
              targetHeight = SHEET_MID_HEIGHT;
            } else {
              // From mid, go to min
              targetHeight = SHEET_MIN_HEIGHT;
            }
          }
        } else if (Math.abs(dragDistance) > 50) {
          // Even slow drags of 50px should trigger state change
          if (dragDistance > 0) {
            // Dragging down
            if (currentHeightRef.current >= SHEET_MAX_HEIGHT * 0.9) {
              targetHeight = SHEET_MID_HEIGHT;
            } else {
              targetHeight = SHEET_MIN_HEIGHT;
            }
          } else {
            // Dragging up
            targetHeight = SHEET_MAX_HEIGHT;
          }
        } else {
          // Snap to nearest position based on current position
          const midPoint1 = (SHEET_MIN_HEIGHT + SHEET_MID_HEIGHT) / 2;
          const midPoint2 = (SHEET_MID_HEIGHT + SHEET_MAX_HEIGHT) / 2;
          
          if (currentValue < midPoint1) {
            targetHeight = SHEET_MIN_HEIGHT;
          } else if (currentValue < midPoint2) {
            targetHeight = SHEET_MID_HEIGHT;
          } else {
            targetHeight = SHEET_MAX_HEIGHT;
          }
        }
        
        currentHeightRef.current = targetHeight;
        Animated.spring(sheetHeight, {
          toValue: targetHeight,
          useNativeDriver: false,
          friction: 7,
          tension: 50,
        }).start();
      },
    }),
  [sheetHeight]);

  // Function to animate sheet to a specific height
  const animateSheetTo = useCallback((targetHeight) => {
    currentHeightRef.current = targetHeight;
    Animated.spring(sheetHeight, {
      toValue: targetHeight,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
  }, [sheetHeight]);

  const displayData = { ...user, ...profile };
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
  const isVerified = displayData?.isPhoneVerified && displayData?.isEmailVerified;

  // Check and request location permission
  const checkLocationPermission = useCallback(async () => {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE 
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
      
      const result = await check(permission);
      
      if (result === RESULTS.GRANTED) {
        setLocationPermission('granted');
        return true;
      } else if (result === RESULTS.DENIED) {
        setLocationPermission('denied');
        return false;
      } else if (result === RESULTS.BLOCKED) {
        setLocationPermission('blocked');
        return false;
      }
      return false;
    } catch (error) {
      console.log('Permission check error:', error);
      return false;
    }
  }, []);

  const requestLocationPermission = useCallback(async () => {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE 
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
      
      const result = await request(permission);
      
      if (result === RESULTS.GRANTED) {
        setLocationPermission('granted');
        // Refresh location from global context after permission granted
        refreshLocation();
        return true;
      } else if (result === RESULTS.BLOCKED) {
        setLocationPermission('blocked');
        Alert.alert(
          'Location Permission Required',
          'Please enable location permission in your device settings to use this app effectively.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSettings() }
          ]
        );
        return false;
      }
      return false;
    } catch (error) {
      console.log('Permission request error:', error);
      return false;
    }
  }, [refreshLocation]);

  // Check notification permission (Android 13+ requires explicit permission)
  const checkNotificationPermission = useCallback(async () => {
    try {
      // Only check on Android 13+ (API 33+) where POST_NOTIFICATIONS permission exists
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        // Verify the permission constant exists before using it
        const permission = PERMISSIONS.ANDROID?.POST_NOTIFICATIONS;
        if (!permission) {
          console.log('POST_NOTIFICATIONS permission not available');
          setNotificationPermission('granted');
          return true;
        }
        const result = await check(permission);
        if (result === RESULTS.GRANTED) {
          setNotificationPermission('granted');
          return true;
        } else if (result === RESULTS.BLOCKED) {
          setNotificationPermission('blocked');
          return false;
        }
        setNotificationPermission('denied');
        return false;
      }
      // iOS or older Android versions - notifications don't require explicit permission
      setNotificationPermission('granted');
      return true;
    } catch (error) {
      console.log('Notification permission check error:', error);
      setNotificationPermission('granted'); // Don't block on error
      return true;
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        // Verify the permission constant exists before using it
        const permission = PERMISSIONS.ANDROID?.POST_NOTIFICATIONS;
        if (!permission) {
          console.log('POST_NOTIFICATIONS permission not available for request');
          return true;
        }
        const result = await request(permission);
        if (result === RESULTS.GRANTED) {
          setNotificationPermission('granted');
          return true;
        } else if (result === RESULTS.BLOCKED) {
          setNotificationPermission('blocked');
          Alert.alert(
            'Notifications Required',
            'Notifications are required for you to receive updates about your service requests. Please enable them in settings.',
            [
              { text: 'Open Settings', onPress: () => openSettings() }
            ]
          );
          return false;
        }
        return false;
      }
      return true;
    } catch (error) {
      console.log('Notification permission request error:', error);
      return true;
    }
  }, []);

  // Initial permission checks
  // Note: Location is now handled by global LocationContext with 30-second refresh
  useEffect(() => {
    const initializePermissions = async () => {
      // Check notification permission first (required)
      const notifGranted = await checkNotificationPermission();
      if (!notifGranted) {
        const requested = await requestNotificationPermission();
        if (!requested && notificationPermission === 'blocked') {
          // Notification is blocked - show persistent warning
        }
      }
      
      // Check location permission (for UI state)
      // Actual location fetching is handled by LocationContext
      await checkLocationPermission();
    };
    
    initializePermissions();
  }, [checkLocationPermission, checkNotificationPermission, requestNotificationPermission]);

  // Handle location change - no longer needed as we use global context
  // Kept for compatibility but now just logs
  const handleLocationChange = useCallback((location) => {
    console.log('📍 [UserHomeScreen] Location updated from context');
  }, []);

  const handleServiceSelect = (service) => {
    if (!isVerified) {
      Alert.alert('Verification Required', 'Please verify your phone and email to book services.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Verify Now', onPress: () => navigation.navigate('Profile') },
      ]);
      return;
    }
    setSelectedService(service);
    setStep('date');
    animateSheetTo(SHEET_MAX_HEIGHT);
  };

  // Handle date/time selection from DateTimePicker
  const handleDateTimeChange = useCallback((dateTime) => {
    setSelectedDateTime(dateTime);
  }, []);

  // Handle location selection from LocationPicker
  const handleServiceLocationChange = useCallback((location) => {
    setServiceLocation(location);
  }, []);

  const handleCreateRequest = async () => {
    if (!selectedService || !selectedDateTime) {
      Alert.alert('Error', 'Please select service and date/time');
      return;
    }
    
    // Determine location to use (service location or current location)
    const locationToUse = serviceLocation?.isCurrentLocation === false 
      ? serviceLocation 
      : currentLocation;
    
    if (!locationToUse) {
      Alert.alert('Error', 'Please select a location for the service');
      return;
    }

    setCreatingRequest(true);
    try {
      const result = await createServiceRequest({
        userId,
        serviceType: selectedService.id,
        latitude: locationToUse.latitude,
        longitude: locationToUse.longitude,
        serviceDate: selectedDateTime.date,
        serviceTime: selectedDateTime.time,
        serviceAddress: serviceLocation?.isCurrentLocation === false ? serviceLocation.address : null,
        isOtherLocation: serviceLocation?.isCurrentLocation === false,
        description: serviceDescription || null,
        isInstant: selectedDateTime.isInstant || false, // Pass instant flag
      });
      if (result.success) {
        setCreatedRequest(result.request);
        const alertMessage = selectedDateTime.isInstant 
          ? 'Instant request created! Find nearby available providers now?'
          : 'Request created! Find nearby providers now?';
        Alert.alert('Request Created', alertMessage, [
          { text: 'Later', onPress: resetFlow },
          { text: 'Find Providers', onPress: () => fetchProviders(result.request._id) },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to create request');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setCreatingRequest(false);
    }
  };

  const fetchProviders = async (requestId) => {
    setFetchingProviders(true);
    setStep('providers');
    try {
      const result = await getNearbyProviders(requestId);
      if (result.success) {
        setProviders(result.providers || []);
        setSearchRadius(result.searchRadius || 0);
        if (!result.providers?.length) Alert.alert('No Providers Found', `No providers within ${(result.searchRadius / 1000).toFixed(1)}km. Try again later.`);
      } else {
        Alert.alert('Error', result.error || 'Failed to find providers');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setFetchingProviders(false);
    }
  };

  /**
   * Retry search for providers (clears rejected list)
   */
  const handleRetrySearch = async () => {
    if (!createdRequest?._id || !userId) return;
    
    setFetchingProviders(true);
    try {
      const result = await retryProviderSearch(createdRequest._id, userId);
      if (result.success) {
        setProviders(result.providers || []);
        setSearchRadius(result.searchRadius || 0);
        if (!result.providers?.length) {
          Alert.alert('No Providers Found', 'No more providers available in your area. Try again later.');
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to retry search');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setFetchingProviders(false);
    }
  };

  // Call masking state
  const [callingProviderId, setCallingProviderId] = useState(null);
  const [contactedProviderIds, setContactedProviderIds] = useState(new Set());

  /**
   * Initiate a masked call to a provider via Exotel.
   * User's phone rings first, then the provider is connected.
   * No real phone numbers are exposed to either party.
   */
  const handleCallProvider = async (provider) => {
    if (!provider?._id) {
      Alert.alert('Error', 'Provider information not available');
      return;
    }

    // Prevent double-tap
    if (callingProviderId) return;

    setCallingProviderId(provider._id);

    try {
      const result = await initiateCall({
        receiverId: provider._id,
        callerType: 'user',
        serviceRequestId: createdRequest?._id || null,
        serviceType: createdRequest ? 'traditional' : 'pre_booking',
      });

      if (result.success) {
        // Mark provider as contacted
        setContactedProviderIds(prev => new Set(prev).add(provider._id));
        Alert.alert(
          'Connecting Call',
          'You will receive a call shortly. Once you pick up, we will connect you to the provider.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Call Failed', result.error || 'Unable to connect the call. Please try again.');
      }
    } catch (error) {
      console.error('[UserHomeScreen] Call error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setCallingProviderId(null);
    }
  };

  /**
   * Open provider details modal
   * The modal handles its own loading and fetching
   */
  const handleViewProviderDetails = (provider) => {
    // Store provider for booking reference and open modal
    // Modal will fetch full details using providerId
    console.log('[UserHomeScreen] Opening provider details:', {
      _id: provider._id,
      id: provider.id,
      name: provider.name
    });
    setSelectedProvider(provider);
    setProviderDetailsVisible(true);
  };

  /**
   * Handle booking from provider details modal
   */
  const handleBookFromDetails = (provider) => {
    setProviderDetailsVisible(false);
    handleBookProvider(provider);
  };

  const handleBookProvider = async (provider) => {
    if (!createdRequest?._id) { Alert.alert('Error', 'Request not found'); return; }
    setBookingProvider(provider._id);
    try {
      // Pass distance from provider object (from getNearbyProviders response)
      const result = await sendRequestToProvider(createdRequest._id, provider._id, provider.distance);
      if (result.success) {
        Alert.alert('Request Sent', `Your request has been sent to ${provider.name}.`, [{ text: 'OK', onPress: resetFlow }]);
      } else {
        Alert.alert('Error', result.error || 'Failed to send request');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setBookingProvider(null);
    }
  };

  const resetFlow = () => {
    setStep('select');
    setSelectedService(null);
    setSelectedDateTime(null);
    setServiceLocation(null);
    setServiceDescription('');
    setCreatedRequest(null);
    setProviders([]);
    animateSheetTo(SHEET_MID_HEIGHT);
  };

  /**
   * Cancel the current request and go back
   */
  const handleCancelRequest = async () => {
    if (!createdRequest?._id) {
      // No request created yet, just go back
      resetFlow();
      return;
    }

    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this service request?',
      [
        { text: 'No, Keep It', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await cancelRequest(createdRequest._id, userId, 'User cancelled from app');
              if (result.success) {
                Alert.alert('Request Cancelled', 'Your request has been cancelled.', [
                  { text: 'OK', onPress: resetFlow }
                ]);
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel request');
              }
            } catch (error) {
              Alert.alert('Error', 'Something went wrong');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => await logout();
  const handleProfilePress = () => navigation.navigate('Profile');

  const renderSheetContent = () => {
    switch (step) {
      case 'date':
        return (
          <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false} bounces={false}>
            <TouchableOpacity style={styles.backRow} onPress={resetFlow}>
              <Icon name="arrow_back" size={20} color="#2563EB" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            
            {/* Selected Service Display */}
            <View style={styles.selectedServiceRow}>
              <View style={styles.selectedServiceIcon}>
                <ServiceIcon serviceType={selectedService.id} size={28} color={BRAND.secondary} />
              </View>
              <Text style={styles.selectedServiceName}>{selectedService.name}</Text>
            </View>
            
            {/* Date & Time Picker */}
            <DateTimePicker
              onDateTimeChange={handleDateTimeChange}
              initialDate={selectedDateTime?.date}
              initialTime={selectedDateTime?.time}
            />
            
            {/* Location Picker - Book for Others */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>Service Location</Text>
            <LocationPicker
              onLocationChange={handleServiceLocationChange}
              currentLocation={currentLocation}
            />
            
            {/* Create Request Button */}
            <View style={styles.createButtonContainer}>
              <TouchableOpacity 
                style={[styles.createButton, !selectedDateTime && styles.createButtonDisabled]} 
                onPress={handleCreateRequest} 
                disabled={!selectedDateTime || creatingRequest}
              >
                {creatingRequest ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Icon name="check" size={20} color="#FFFFFF" />
                    <Text style={styles.createButtonText}>Create Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      case 'providers':
        return (
          <View style={styles.sheetContent}>
            <View style={styles.providersHeader}>
              <View style={styles.providerHeaderActions}>
                <TouchableOpacity style={styles.backRow} onPress={resetFlow}>
                  <Icon name="check" size={20} color="#2563EB" />
                  <Text style={styles.backText}>Done</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelRow} onPress={handleCancelRequest}>
                  <Icon name="cancel" size={20} color="#EF4444" />
                  <Text style={styles.cancelText}>Cancel Request</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.providersTitle}>{fetchingProviders ? 'Finding Providers...' : `${providers.length} Providers Found`}</Text>
              {searchRadius > 0 && (
                <View style={styles.radiusRow}>
                  <Icon name="location" size={14} color="#6B7280" />
                  <Text style={styles.radiusText}>Within {(searchRadius / 1000).toFixed(1)}km</Text>
                </View>
              )}
            </View>
            {fetchingProviders ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Searching nearby providers...</Text>
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
                    onPress={() => handleViewProviderDetails(item)}
                    booking={bookingProvider === item._id}
                    contacted={contactedProviderIds.has(item._id)}
                    calling={callingProviderId === item._id}
                  />
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <FixhomiLogo size={64} color="#D1D5DB" />
                    <Text style={styles.emptyText}>No providers found nearby</Text>
                    <Text style={styles.emptySubtext}>We're searching for providers to fix your home</Text>
                    <TouchableOpacity 
                      style={styles.retryButton} 
                      onPress={handleRetrySearch}
                    >
                      <Icon name="refresh" size={20} color="#FFFFFF" />
                      <Text style={styles.retryButtonText}>Retry Search</Text>
                    </TouchableOpacity>
                  </View>
                }
                contentContainerStyle={styles.providersList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        );
      default:
        return (
          <ScrollView 
            style={styles.sheetContent} 
            showsVerticalScrollIndicator={false}
            bounces={true}
            alwaysBounceVertical={true}
            contentContainerStyle={styles.servicesScrollContent}
            nestedScrollEnabled={true}
          >
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Hello, {displayData?.fullName?.split(' ')[0] || 'there'}!</Text>
              <Text style={styles.welcomeSubtext}>What service do you need?</Text>
            </View>
            
            {/* Quick Access Buttons - Using MaterialIcon instead of emoji */}
            <View style={styles.quickAccessRow}>
              <TouchableOpacity 
                style={[styles.quickAccessCard, styles.quickAccessEmergency]} 
                onPress={() => navigation.navigate('EmergencyServices')}
              >
                <View style={styles.quickAccessIconContainer}>
                  <Icon name="warning" size={24} color="#DC2626" />
                </View>
                <Text style={styles.quickAccessLabel}>Emergency</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickAccessCard, styles.quickAccessEvent]} 
                onPress={() => navigation.navigate('EventServices')}
              >
                <View style={styles.quickAccessIconContainer}>
                  <Icon name="camera" size={24} color="#7C3AED" />
                </View>
                <Text style={styles.quickAccessLabel}>Events</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickAccessCard, styles.quickAccessFavorites]} 
                onPress={() => navigation.navigate('Favorites')}
              >
                <View style={styles.quickAccessIconContainer}>
                  <Icon name="heart" size={24} color="#F59E0B" />
                </View>
                <Text style={styles.quickAccessLabel}>Favorites</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.servicesSectionTitle}>Traditional Services</Text>
            <View style={styles.servicesGrid}>
              {SERVICE_CATEGORIES.map((service) => (
                <ServiceCard key={service.id} service={service} onPress={handleServiceSelect} />
              ))}
            </View>
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={styles.quickActionButton} 
                onPress={() => navigation.navigate('HistoryTab')}
              >
                <Icon name="history" size={20} color="#374151" />
                <Text style={styles.quickActionText}>History</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LocationMap ref={mapRef} onLocationChange={handleLocationChange} showUserLocation showSearchRadius={step === 'providers'} searchRadius={searchRadius} />
      
      {/* Permission Warning Bars */}
      {(locationPermission === 'denied' || locationPermission === 'blocked' || !locationEnabled) && (
        <View style={[styles.permissionBar, { top: insets.top + 60 }]}>
          <Icon name="location" size={18} color="#F59E0B" />
          <Text style={styles.permissionBarText}>
            {!locationEnabled 
              ? 'Location is turned off. Turn it on for better experience.' 
              : 'Location permission needed for finding nearby providers.'}
          </Text>
          <TouchableOpacity 
            style={styles.permissionBarButton}
            onPress={locationPermission === 'blocked' || !locationEnabled ? () => openSettings() : requestLocationPermission}
          >
            <Text style={styles.permissionBarButtonText}>
              {locationPermission === 'blocked' || !locationEnabled ? 'Settings' : 'Enable'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {notificationPermission === 'blocked' && (
        <View style={[styles.permissionBar, styles.permissionBarDanger, { top: insets.top + (locationPermission === 'denied' || locationPermission === 'blocked' || !locationEnabled ? 110 : 60) }]}>
          <Icon name="notification" size={18} color="#EF4444" />
          <Text style={[styles.permissionBarText, styles.permissionBarTextDanger]}>
            Notifications required for service updates
          </Text>
          <TouchableOpacity 
            style={[styles.permissionBarButton, styles.permissionBarButtonDanger]}
            onPress={() => openSettings()}
          >
            <Text style={[styles.permissionBarButtonText, styles.permissionBarButtonTextDanger]}>Settings</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <MenuButton onPress={() => setIsDrawerOpen(true)} />
        <View style={styles.topBarSpacer} />
        {/* Address Management Icon */}
        <TouchableOpacity 
          style={styles.addressManageButton}
          onPress={() => navigation.navigate('Profile', { scrollToAddresses: true })}
          activeOpacity={0.7}
        >
          <MaterialIcon name="bookmark" size={24} color="#374151" />
        </TouchableOpacity>
        <AvatarButton 
          name={displayData?.fullName} 
          profilePicture={displayData?.profilePicture}
          onPress={handleProfilePress} 
          isProvider={false} 
        />
      </View>
      <Animated.View style={[styles.bottomSheet, { height: sheetHeight, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sheetHandle} {...panResponder.panHandlers}>
          <View style={styles.sheetHandleBar} />
        </View>
        {renderSheetContent()}
      </Animated.View>
      <DrawerMenu visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} user={displayData} userType={userType} navigation={navigation} onLogout={handleLogout} isVerified={isVerified} />
      
      {/* Notification Permission Required Modal */}
      <Modal
        visible={notificationPermission === 'blocked'}
        animationType="fade"
        transparent
        statusBarTranslucent
      >
        <View style={styles.permissionModalOverlay}>
          <View style={styles.permissionModalContent}>
            <View style={styles.permissionModalIcon}>
              <Icon name="notification" size={48} color="#EF4444" />
            </View>
            <Text style={styles.permissionModalTitle}>Notifications Required</Text>
            <Text style={styles.permissionModalMessage}>
              FixHomi needs notification permission to send you real-time updates about your service requests, provider arrival, and payment confirmations.
            </Text>
            <TouchableOpacity 
              style={styles.permissionModalButton}
              onPress={() => openSettings()}
            >
              <Text style={styles.permissionModalButtonText}>Open Settings</Text>
            </TouchableOpacity>
            <Text style={styles.permissionModalNote}>
              Enable notifications in app settings and return here
            </Text>
          </View>
        </View>
      </Modal>
      
      {/* Provider Details Modal */}
      <ProviderDetailsModal
        visible={providerDetailsVisible}
        providerId={selectedProvider?._id || selectedProvider?.id}
        onClose={() => {
          setProviderDetailsVisible(false);
          setSelectedProvider(null);
        }}
        onBook={() => {
          if (selectedProvider) {
            handleBookFromDetails(selectedProvider);
          }
        }}
        onCall={(phone) => {
          // Called from ProviderDetailsModal - wrap in provider-like object
          if (selectedProvider) {
            handleCallProvider(selectedProvider);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.background },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, zIndex: 10 },
  addressManageButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(255,255,255,0.95)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topBarSpacer: { flex: 1 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: BRAND.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  sheetHandle: { alignItems: 'center', paddingTop: 12, paddingBottom: 12, minHeight: 32 },
  sheetHandleBar: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 },
  sheetContent: { flex: 1, paddingHorizontal: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 6 },
  backText: { fontSize: 16, color: BRAND.secondary, fontWeight: '600' },
  cancelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 6 },
  cancelText: { fontSize: 14, color: '#EF4444', fontWeight: '600' },
  providerHeaderActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcomeSection: { marginBottom: 16 },
  welcomeText: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
  welcomeSubtext: { fontSize: 15, color: '#6B7280', marginTop: 4 },
  
  // Quick Access Row
  quickAccessRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 20,
    gap: 10,
  },
  quickAccessCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  quickAccessEmergency: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  quickAccessEvent: {
    backgroundColor: '#E0E7FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  quickAccessFavorites: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  quickAccessIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickAccessLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  
  servicesSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  serviceCard: { 
    width: (SCREEN_WIDTH - 52) / 3, 
    paddingVertical: 16, 
    paddingHorizontal: 8, 
    borderRadius: 16, 
    alignItems: 'center',
    backgroundColor: BRAND.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  serviceIconContainer: { 
    width: 48, 
    height: 48, 
    borderRadius: 14, 
    backgroundColor: BRAND.secondary + '10',
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BRAND.primary + '15',
  },
  serviceName: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center', lineHeight: 14 },
  quickActions: { flexDirection: 'row', justifyContent: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  quickActionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, gap: 8 },
  quickActionText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  selectedServiceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.secondary + '10', padding: 14, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: BRAND.secondary + '25' },
  selectedServiceIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: BRAND.secondary + '18', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  selectedServiceName: { fontSize: 17, fontWeight: '700', color: '#1F2937', flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12, marginTop: 8 },
  sectionDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  createButtonContainer: { paddingVertical: 20, paddingBottom: 40 },
  createButton: { 
    backgroundColor: BRAND.primary, 
    height: 52, 
    borderRadius: 14, 
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8,
  },
  createButtonDisabled: { backgroundColor: '#9CA3AF' },
  createButtonText: { fontSize: 17, fontWeight: '700', color: BRAND.white },
  providersHeader: { marginBottom: 16 },
  providersTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginTop: 8 },
  radiusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  radiusText: { fontSize: 13, color: '#6B7280' },
  providersList: { paddingBottom: 20 },
  providerCard: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 12 },
  providerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  providerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: BRAND.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  providerAvatarImage: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  providerInitial: { fontSize: 20, fontWeight: '700', color: BRAND.white },
  providerDetails: { flex: 1 },
  providerNameRow: { flexDirection: 'row', alignItems: 'center' },
  providerName: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  verifiedBadge: { marginLeft: 4 },
  providerDistanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  providerDistance: { fontSize: 13, color: '#6B7280' },
  providerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  providerRating: { fontSize: 13, color: BRAND.primary, fontWeight: '600' },
  providerRatingCount: { fontSize: 12, color: '#6B7280', fontWeight: '400' },
  viewDetailsIcon: { padding: 4 },
  contactedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6, gap: 2 },
  contactedBadgeText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
  providerActions: { flexDirection: 'row', gap: 10 },
  callButton: { width: 48, height: 44, backgroundColor: '#10B981', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  callButtonCalling: { backgroundColor: '#6B7280' },
  bookButton: { flex: 1, height: 44, backgroundColor: BRAND.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookButtonLoading: { backgroundColor: BRAND.primary + '80' },
  bookButtonText: { fontSize: 15, fontWeight: '600', color: BRAND.white },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { fontSize: 15, color: '#6B7280', marginTop: 12 },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
  emptySubtext: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  retryButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: BRAND.secondary, 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 12, 
    marginTop: 16,
    gap: 8,
  },
  retryButtonText: { fontSize: 15, fontWeight: '600', color: BRAND.white },
  servicesScrollContent: { paddingBottom: 80 },
  // Permission bars
  permissionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    gap: 8,
  },
  permissionBarDanger: {
    backgroundColor: '#FEE2E2',
  },
  permissionBarText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  permissionBarTextDanger: {
    color: '#991B1B',
  },
  permissionBarButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  permissionBarButtonDanger: {
    backgroundColor: '#EF4444',
  },
  permissionBarButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  permissionBarButtonTextDanger: {
    color: '#FFFFFF',
  },
  
  // Notification Permission Modal
  permissionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  permissionModalIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  permissionModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionModalMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  permissionModalButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  permissionModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  permissionModalNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

export default UserHomeScreen;
