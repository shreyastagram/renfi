/**
 * User Home Screen
 * 
 * Production-grade home screen with:
 * - Full screen map with user location
 * - Hamburger menu + Avatar for profile
 * - Expandable bottom sheet for service booking
 * - Inline date picker and booking flow
 * - Find nearby providers integration
 * 
 * @version 2.0.0
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import { LocationMap, Icon, ServiceIcon, DateTimePicker, LocationPicker } from '../components';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import { useApp } from '../context/AppContext';
import {
  createServiceRequest,
  getNearbyProviders,
  sendRequestToProvider,
  cancelRequest,
} from '../services/traditionalServiceService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Bottom sheet heights
const SHEET_MIN_HEIGHT = 160;
const SHEET_MID_HEIGHT = SCREEN_HEIGHT * 0.40; // 30% for initial state - shows user location
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;

// Service categories - MUST match backend provider.js model exactly
// IDs must match backend allowedCategories for proper provider matching
const SERVICE_CATEGORIES = [
  { id: 'electrician', name: 'Electrician', iconName: 'electrician', color: '#F59E0B' },
  { id: 'plumber', name: 'Plumber', iconName: 'plumber', color: '#3B82F6' },
  { id: 'electronics_technician', name: 'Electronics Technician', iconName: 'electronics_technician', color: '#6366F1' },
  { id: 'carpenter', name: 'Carpenter', iconName: 'carpenter', color: '#8B5CF6' },
  { id: 'painter', name: 'Painter', iconName: 'painter', color: '#EC4899' },
  { id: 'solar_repairing', name: 'Solar Repairing', iconName: 'solar_repairing', color: '#EAB308' },
  { id: 'welder', name: 'Welder', iconName: 'welder', color: '#6B7280' },
  { id: 'salon', name: 'Salon', iconName: 'salon', color: '#F472B6' },
  { id: 'vehicle_cleaning', name: 'Vehicle Cleaning', iconName: 'vehicle_cleaning', color: '#22D3EE' },
  { id: 'mason_tiler', name: 'Mason & Tiler', iconName: 'mason_tiler', color: '#A78BFA' },
  { id: 'driver', name: 'Driver', iconName: 'driver', color: '#14B8A6' },
  { id: 'ac_repair', name: 'AC Repair', iconName: 'ac_repair', color: '#06B6D4' },
  { id: 'cleaning', name: 'Cleaning', iconName: 'cleaning', color: '#10B981' },
];

const ServiceCard = ({ service, onPress }) => (
  <TouchableOpacity
    style={[styles.serviceCard, { backgroundColor: `${service.color}15` }]}
    onPress={() => onPress(service)}
    activeOpacity={0.7}
  >
    <View style={[styles.serviceIconContainer, { backgroundColor: `${service.color}25` }]}>
      <ServiceIcon serviceType={service.id} size={26} color={service.color} />
    </View>
    <Text style={styles.serviceName}>{service.name}</Text>
  </TouchableOpacity>
);

const ProviderCard = ({ provider, onCall, onBook, booking }) => (
  <View style={styles.providerCard}>
    <View style={styles.providerInfo}>
      <View style={styles.providerAvatar}>
        <Text style={styles.providerInitial}>{provider.name?.charAt(0)?.toUpperCase() || 'P'}</Text>
      </View>
      <View style={styles.providerDetails}>
        <Text style={styles.providerName}>{provider.name}</Text>
        <View style={styles.providerDistanceRow}>
          <Icon name="location" size={14} color="#6B7280" />
          <Text style={styles.providerDistance}>{provider.distance || 'Nearby'}</Text>
        </View>
        {provider.rating > 0 && (
          <View style={styles.providerRatingRow}>
            <Icon name="star" size={14} color="#F59E0B" />
            <Text style={styles.providerRating}>{provider.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
    </View>
    <View style={styles.providerActions}>
      <TouchableOpacity style={styles.callButton} onPress={() => onCall(provider.phone)}>
        <Icon name="phone" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.bookButton, booking && styles.bookButtonLoading]} onPress={() => onBook(provider)} disabled={booking}>
        {booking ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.bookButtonText}>Send Request</Text>}
      </TouchableOpacity>
    </View>
  </View>
);

const UserHomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const { user, profile, userType, logout } = useApp();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
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
  
  // Permission states
  const [locationPermission, setLocationPermission] = useState('unknown'); // 'granted', 'denied', 'blocked', 'unknown'
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState('unknown');

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
        // Fetch location after permission granted
        Geolocation.getCurrentPosition(
          (position) => setCurrentLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
          (error) => console.log('Location error:', error),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
        );
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
  }, []);

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
      
      // Check location permission
      const locGranted = await checkLocationPermission();
      if (locGranted) {
        // Get location
        Geolocation.getCurrentPosition(
          (position) => {
            setCurrentLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
            setLocationEnabled(true);
          },
          (error) => {
            console.log('Location error:', error);
            if (error.code === 2) {
              setLocationEnabled(false); // GPS is off
            }
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
        );
      }
    };
    
    initializePermissions();
  }, [checkLocationPermission, checkNotificationPermission, requestNotificationPermission]);

  const handleLocationChange = useCallback((location) => setCurrentLocation(location), []);

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
      });
      if (result.success) {
        setCreatedRequest(result.request);
        Alert.alert('✅ Request Created!', 'Find nearby providers now?', [
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

  const handleCallProvider = (phone) => {
    if (!phone) { Alert.alert('Error', 'Phone number not available'); return; }
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
  };

  const handleBookProvider = async (provider) => {
    if (!createdRequest?._id) { Alert.alert('Error', 'Request not found'); return; }
    setBookingProvider(provider._id);
    try {
      const result = await sendRequestToProvider(createdRequest._id, provider._id);
      if (result.success) {
        Alert.alert('✅ Request Sent!', `Your request has been sent to ${provider.name}.`, [{ text: 'OK', onPress: resetFlow }]);
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
      '⚠️ Cancel Request',
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
                Alert.alert('✅ Cancelled', 'Your request has been cancelled.', [
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
              <View style={[styles.selectedServiceIcon, { backgroundColor: `${selectedService.color}20` }]}>
                <ServiceIcon serviceType={selectedService.id} size={28} color={selectedService.color} />
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
                    booking={bookingProvider === item._id} 
                  />
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Icon name="search" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyText}>No providers found nearby</Text>
                    <Text style={styles.emptySubtext}>Try again later or expand your search</Text>
                    <TouchableOpacity 
                      style={styles.retryButton} 
                      onPress={() => createdRequest?._id && fetchProviders(createdRequest._id)}
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
        <AvatarButton name={displayData?.fullName} onPress={handleProfilePress} isProvider={false} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, zIndex: 10 },
  topBarSpacer: { flex: 1 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  sheetHandle: { alignItems: 'center', paddingTop: 12, paddingBottom: 12, minHeight: 32 },
  sheetHandleBar: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 },
  sheetContent: { flex: 1, paddingHorizontal: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 6 },
  backText: { fontSize: 16, color: '#2563EB', fontWeight: '600' },
  cancelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 6 },
  cancelText: { fontSize: 14, color: '#EF4444', fontWeight: '600' },
  providerHeaderActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcomeSection: { marginBottom: 16 },
  welcomeText: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
  welcomeSubtext: { fontSize: 15, color: '#6B7280', marginTop: 4 },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  serviceCard: { width: (SCREEN_WIDTH - 52) / 3, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 14, alignItems: 'center' },
  serviceIconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  serviceName: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center' },
  quickActions: { flexDirection: 'row', justifyContent: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  quickActionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, gap: 8 },
  quickActionText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  selectedServiceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, marginBottom: 16 },
  selectedServiceIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  selectedServiceName: { fontSize: 18, fontWeight: '700', color: '#1F2937', flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12, marginTop: 8 },
  sectionDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  createButtonContainer: { paddingVertical: 20, paddingBottom: 40 },
  createButton: { 
    backgroundColor: '#2563EB', 
    height: 52, 
    borderRadius: 14, 
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8,
  },
  createButtonDisabled: { backgroundColor: '#9CA3AF' },
  createButtonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  providersHeader: { marginBottom: 16 },
  providersTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginTop: 8 },
  radiusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  radiusText: { fontSize: 13, color: '#6B7280' },
  providersList: { paddingBottom: 20 },
  providerCard: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 12 },
  providerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  providerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  providerInitial: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  providerDetails: { flex: 1 },
  providerName: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  providerDistanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  providerDistance: { fontSize: 13, color: '#6B7280' },
  providerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  providerRating: { fontSize: 13, color: '#F59E0B', fontWeight: '600' },
  providerActions: { flexDirection: 'row', gap: 10 },
  callButton: { width: 48, height: 44, backgroundColor: '#10B981', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookButton: { flex: 1, height: 44, backgroundColor: '#2563EB', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookButtonLoading: { backgroundColor: '#93C5FD' },
  bookButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { fontSize: 15, color: '#6B7280', marginTop: 12 },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
  emptySubtext: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  retryButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#2563EB', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 12, 
    marginTop: 16,
    gap: 8,
  },
  retryButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  servicesScrollContent: { paddingBottom: 20 },
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
