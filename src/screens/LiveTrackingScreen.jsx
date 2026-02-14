/**
 * Live Tracking Screen
 * 
 * Real-time provider location tracking (like Swiggy/Zomato)
 * Shows provider's current location on map with live updates
 * Displays actual driving route from provider to user
 * 
 * @version 2.0.0 - Added route visualization
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Image,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { Icon, FixhomiLogo } from '../components';
import { NODE_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';
import { initiateCall } from '../services/callService';
import { MAPBOX_ACCESS_TOKEN, initializeMapbox } from '../config/mapbox';

// Initialize Mapbox from .env
initializeMapbox();

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  background: '#faf7f7',
  white: '#FFFFFF',
};

// Location update interval (10 seconds)
const LOCATION_UPDATE_INTERVAL = 10000;

/**
 * Format time ago
 */
const formatTimeAgo = (date) => {
  if (!date) return 'Unknown';
  const now = new Date();
  const updated = new Date(date);
  const diffMs = now - updated;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m ago`;
};

/**
 * Calculate distance between two points in km
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Live Tracking Screen Component
 */
const LiveTrackingScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { 
    requestId, 
    providerId, 
    providerName, 
    serviceCategory, 
    userLocation: initialUserLocation,
    serviceLocation: passedServiceLocation, // Service location from request
    serviceAddress,
  } = route.params || {};
  
  const cameraRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mapReadyRef = useRef(false);
  const initialCameraSetRef = useRef(false);
  
  // State - Use serviceLocation as destination (where provider needs to go)
  const [providerLocation, setProviderLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(passedServiceLocation || initialUserLocation || null);
  const [userLocation, setUserLocation] = useState(null); // User's actual current location for context
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [providerData, setProviderData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [error, setError] = useState(null);
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);
  const [routeDistance, setRouteDistance] = useState(null);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  
  // ✅ PRODUCTION: Calculate initial camera center immediately (no jumps)
  const getInitialCenter = useCallback(() => {
    if (passedServiceLocation?.longitude && passedServiceLocation?.latitude) {
      return [passedServiceLocation.longitude, passedServiceLocation.latitude];
    }
    if (initialUserLocation?.longitude && initialUserLocation?.latitude) {
      return [initialUserLocation.longitude, initialUserLocation.latitude];
    }
    // Fallback to Mumbai only if no location data
    return [72.8777, 19.0760];
  }, [passedServiceLocation, initialUserLocation]);
  
  const [initialCenter] = useState(getInitialCenter);

  /**
   * Fetch driving route from Mapbox Directions API
   */
  const fetchRoute = useCallback(async (providerLoc, userLoc) => {
    if (!providerLoc || !userLoc) return;
    
    setIsFetchingRoute(true);
    
    try {
      // Mapbox Directions API - driving route from provider to user
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${providerLoc.longitude},${providerLoc.latitude};${userLoc.longitude},${userLoc.latitude}?geometries=geojson&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // Route geometry is in GeoJSON format
        setRouteCoordinates(route.geometry.coordinates);
        // Duration in seconds, convert to minutes
        setRouteDuration(Math.ceil(route.duration / 60));
        // Distance in meters, convert to km
        setRouteDistance((route.distance / 1000).toFixed(1));
        
        console.log('[LiveTracking] Route fetched:', {
          duration: Math.ceil(route.duration / 60) + ' min',
          distance: (route.distance / 1000).toFixed(1) + ' km',
          steps: route.legs?.[0]?.steps?.length || 0,
        });
      }
    } catch (err) {
      console.error('[LiveTracking] Route fetch error:', err);
      // Fall back to straight line (already handled by routeCoordinates being null)
    } finally {
      setIsFetchingRoute(false);
    }
  }, []);

  /**
   * Fetch provider location from API
   */
  const fetchProviderLocation = useCallback(async () => {
    if (!providerId) {
      setError('Provider ID not available');
      setIsLoading(false);
      return;
    }

    try {
      const { accessToken } = await getTokens();
      const response = await fetch(`${NODE_BASE_URL}/api/auth/provider/location/${providerId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (data.success && data.data?.location) {
        const loc = data.data.location;
        const newLocation = {
          latitude: loc.lat || loc.latitude,
          longitude: loc.lng || loc.longitude,
        };
        
        setProviderLocation(newLocation);
        setLastUpdated(loc.lastUpdated || data.data.lastUpdated);
        setProviderData(data.data);
        setIsOnline(data.data.isOnline);
        setError(null);

        // Calculate distance to destination (service location)
        if (destinationLocation && newLocation.latitude && newLocation.longitude) {
          const dist = calculateDistance(
            destinationLocation.latitude,
            destinationLocation.longitude,
            newLocation.latitude,
            newLocation.longitude
          );
          setDistance(dist);
          // Estimate ETA (assuming 30 km/h average speed in city) - will be overwritten by route API
          const etaMinutes = Math.ceil((dist / 30) * 60);
          setEta(etaMinutes);
          
          // Fetch actual driving route from provider to service location
          fetchRoute(newLocation, destinationLocation);
        }
      } else {
        console.log('[LiveTracking] No location data:', data);
        if (!providerLocation) {
          setError('Provider location not available yet');
        }
      }
    } catch (err) {
      console.error('[LiveTracking] Fetch error:', err);
      if (!providerLocation) {
        setError('Failed to fetch provider location');
      }
    } finally {
      setIsLoading(false);
    }
  }, [providerId, destinationLocation, providerLocation, fetchRoute]);

  /**
   * Get user's current location (for context, not for route)
   */
  const getUserLocation = useCallback(() => {
    Geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        // If no service location was passed, use current location as destination
        if (!destinationLocation) {
          setDestinationLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      },
      (error) => console.log('[LiveTracking] User location error:', error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, [destinationLocation]);

  /**
   * Center map to show provider, destination, and optionally user location
   * ✅ PRODUCTION: Smooth animation, proper padding, no jarring jumps
   */
  const centerMap = useCallback((animate = true) => {
    if (!cameraRef.current || !mapReadyRef.current) return;
    
    // Collect all available locations for bounds calculation
    const locations = [];
    if (providerLocation) locations.push(providerLocation);
    if (destinationLocation) locations.push(destinationLocation);
    if (userLocation && !destinationLocation) locations.push(userLocation); // Only show user if no destination
    
    if (locations.length === 0) return;
    
    if (locations.length > 1) {
      // Calculate bounds to show all markers with padding
      const lngs = locations.map(loc => loc.longitude);
      const lats = locations.map(loc => loc.latitude);
      
      // Add padding for markers (0.005 degrees ≈ 500m)
      const bounds = {
        ne: [Math.max(...lngs) + 0.008, Math.max(...lats) + 0.008],
        sw: [Math.min(...lngs) - 0.008, Math.min(...lats) - 0.008],
      };
      
      cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [100, 100, 180, 100], animate ? 800 : 0);
    } else {
      // Just show single location
      const loc = locations[0];
      cameraRef.current?.setCamera({
        centerCoordinate: [loc.longitude, loc.latitude],
        zoomLevel: 15,
        animationDuration: animate ? 600 : 0,
        animationMode: 'easeTo',
      });
    }
  }, [providerLocation, destinationLocation, userLocation]);
  
  /**
   * Handle map ready - set initial camera position smoothly
   */
  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    setIsMapReady(true);
    
    // If we already have provider location, fit bounds after a short delay
    if (providerLocation && !initialCameraSetRef.current) {
      initialCameraSetRef.current = true;
      setTimeout(() => centerMap(true), 300);
    }
  }, [providerLocation, centerMap]);

  /**
   * Start pulse animation for live indicator
   */
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  /**
   * Initial load and periodic updates
   */
  useEffect(() => {
    getUserLocation();
    fetchProviderLocation();

    // Set up periodic location updates
    const interval = setInterval(fetchProviderLocation, LOCATION_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchProviderLocation, getUserLocation]);

  /**
   * Center map when locations are available
   * ✅ PRODUCTION: Only animate once after first provider location fetch
   */
  useEffect(() => {
    if (providerLocation && mapReadyRef.current && !initialCameraSetRef.current) {
      initialCameraSetRef.current = true;
      // Smooth delay for initial animation
      requestAnimationFrame(() => centerMap(true));
    }
  }, [providerLocation, centerMap]);

  /**
   * Open directions in maps app
   */
  const openDirections = useCallback(() => {
    if (!providerLocation) return;
    
    const { latitude, longitude } = providerLocation;
    const label = encodeURIComponent(`${providerName || 'Provider'}`);
    
    const url = Platform.select({
      ios: `maps:?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
    });
    
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
    });
  }, [providerLocation, providerName]);

  /**
   * Call provider (Exotel masked call)
   */
  const callProvider = useCallback(async () => {
    if (!providerId) return;

    try {
      const result = await initiateCall({
        receiverId: providerId,
        callerType: 'user',
        serviceRequestId: requestId || null,
        serviceType: 'traditional',
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
      console.error('[LiveTracking] Call error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  }, [providerId, requestId]);

  return (
    <View style={styles.container}>
      {/* Map Loading Overlay - Shows while map is initializing */}
      {!isMapReady && (
        <View style={styles.mapLoadingOverlay}>
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={styles.mapLoadingText}>Loading map...</Text>
        </View>
      )}
      
      {/* Map */}
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        scaleBarEnabled={false}
        onDidFinishLoadingMap={handleMapReady}
      >
        {/* ✅ PRODUCTION: Use initial center from service location to avoid jumps */}
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: initialCenter,
            zoomLevel: 14,
          }}
          animationMode="flyTo"
          animationDuration={0}
        />

        {/* User's Current Location Marker (Blue) - Only show if user is at different location than destination */}
        {userLocation && (!destinationLocation || (
          Math.abs(userLocation.latitude - destinationLocation.latitude) > 0.001 ||
          Math.abs(userLocation.longitude - destinationLocation.longitude) > 0.001
        )) && (
          <Mapbox.PointAnnotation
            id="user-marker"
            coordinate={[userLocation.longitude, userLocation.latitude]}
          >
            <View style={styles.userMarker}>
              <MaterialIcon name="person-pin" size={18} color="#FFFFFF" />
            </View>
          </Mapbox.PointAnnotation>
        )}

        {/* Destination Marker (Service Location - Green) */}
        {destinationLocation && (
          <Mapbox.PointAnnotation
            id="destination-marker"
            coordinate={[destinationLocation.longitude, destinationLocation.latitude]}
          >
            <View style={styles.destinationMarker}>
              <MaterialIcon name="home" size={20} color="#FFFFFF" />
            </View>
          </Mapbox.PointAnnotation>
        )}

        {/* Provider Location Marker - FixHomi Logo (Orange) */}
        {providerLocation && (
          <Mapbox.PointAnnotation
            id="provider-marker"
            coordinate={[providerLocation.longitude, providerLocation.latitude]}
          >
            <View style={styles.providerMarker}>
              <FixhomiLogo size={24} color="#FFFFFF" />
            </View>
          </Mapbox.PointAnnotation>
        )}

        {/* Route line from provider to destination */}
        {destinationLocation && providerLocation && (
          <Mapbox.ShapeSource
            id="route"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates || [
                  [providerLocation.longitude, providerLocation.latitude],
                  [destinationLocation.longitude, destinationLocation.latitude],
                ],
              },
            }}
          >
            {/* Route outline for better visibility - draw first (below main line) */}
            <Mapbox.LineLayer
              id="routeLineOutline"
              style={{
                lineColor: '#c45a00', // Darker orange outline
                lineWidth: 8,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.5,
              }}
            />
            {/* Main route line - solid orange */}
            <Mapbox.LineLayer
              id="routeLine"
              style={{
                lineColor: BRAND.primary, // Always orange (#f67c16)
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 1,
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow_back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          {isOnline && (
            <View style={styles.liveIndicator}>
              <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.centerButton} onPress={centerMap}>
          <MaterialIcon name="my-location" size={24} color={BRAND.primary} />
        </TouchableOpacity>
      </View>

      {/* Provider Info Card */}
      <View style={[styles.infoCard, { paddingBottom: insets.bottom + 16 }]}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BRAND.primary} />
            <Text style={styles.loadingText}>Finding provider location...</Text>
          </View>
        ) : error && !providerLocation ? (
          <View style={styles.errorContainer}>
            <MaterialIcon name="location-off" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchProviderLocation}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Provider Details */}
            <View style={styles.providerRow}>
              <View style={styles.providerAvatar}>
                {providerData?.profilePicture?.url ? (
                  <Image source={{ uri: providerData.profilePicture.url }} style={styles.avatarImage} />
                ) : (
                  <MaterialIcon name="person" size={24} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{providerName || providerData?.name || 'Provider'}</Text>
                <Text style={styles.providerService}>{serviceCategory || 'Service Provider'}</Text>
              </View>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
                <Text style={[styles.statusText, isOnline && styles.statusTextOnline]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>

            {/* Service Location */}
            {serviceAddress && (
              <View style={styles.serviceLocationRow}>
                <MaterialIcon name="home" size={18} color="#10B981" />
                <View style={styles.serviceLocationInfo}>
                  <Text style={styles.serviceLocationLabel}>Service Location</Text>
                  <Text style={styles.serviceLocationAddress} numberOfLines={2}>{serviceAddress}</Text>
                </View>
              </View>
            )}

            {/* ETA & Distance - Use route data when available */}
            {(distance !== null || routeDistance !== null) && (
              <View style={styles.etaRow}>
                <View style={styles.etaItem}>
                  <MaterialIcon name="directions-car" size={20} color={BRAND.primary} />
                  <Text style={styles.etaValue}>
                    {routeDistance !== null ? `${routeDistance} km` : `${distance.toFixed(1)} km`}
                  </Text>
                  <Text style={styles.etaLabel}>{routeDistance !== null ? 'via road' : 'away'}</Text>
                </View>
                {(routeDuration !== null || eta !== null) && (
                  <View style={styles.etaItem}>
                    <MaterialIcon name="schedule" size={20} color={BRAND.primary} />
                    <Text style={styles.etaValue}>
                      {(() => {
                        const time = routeDuration !== null ? routeDuration : eta;
                        return time < 60 ? `${time} min` : `${Math.floor(time/60)}h ${time%60}m`;
                      })()}
                    </Text>
                    <Text style={styles.etaLabel}>{routeDuration !== null ? 'ETA (route)' : 'ETA (est.)'}</Text>
                  </View>
                )}
                <View style={styles.etaItem}>
                  <MaterialIcon name="update" size={20} color="#6B7280" />
                  <Text style={styles.etaValue}>{formatTimeAgo(lastUpdated)}</Text>
                  <Text style={styles.etaLabel}>updated</Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={callProvider}>
                <MaterialIcon name="phone" size={22} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={openDirections}>
                <MaterialIcon name="directions" size={22} color={BRAND.primary} />
                <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>Directions</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  map: {
    flex: 1,
  },
  // ✅ PRODUCTION: Map loading overlay
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  centerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // User's current location marker (blue)
  userMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2b76bc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  
  // Destination marker (service location - green)
  destinationMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  
  // Provider marker
  providerMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  // Info Card
  infoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Provider Row
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  providerService: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  statusDotOnline: {
    backgroundColor: '#22C55E',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusTextOnline: {
    color: '#16A34A',
  },

  // Service Location Row
  serviceLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  serviceLocationInfo: {
    flex: 1,
  },
  serviceLocationLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  serviceLocationAddress: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },

  // ETA Row
  etaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  etaItem: {
    alignItems: 'center',
  },
  etaValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 4,
  },
  etaLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: BRAND.primary,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonTextSecondary: {
    color: BRAND.primary,
  },
});

export default LiveTrackingScreen;
