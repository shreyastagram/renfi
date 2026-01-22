/**
 * LocationMap Component (Mapbox)
 * 
 * Reusable map component using Mapbox GL
 * Used for both User and Provider screens
 * 
 * @version 2.0.0
 */

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';

// Initialize Mapbox with public token
Mapbox.setAccessToken('MAPBOX_TOKEN_REMOVED');

// Default location (India - Mumbai)
const DEFAULT_LOCATION = {
  latitude: 19.0760,
  longitude: 72.8777,
};

const DEFAULT_ZOOM = 14;

/**
 * Request location permission for Android
 */
const requestLocationPermission = async () => {
  if (Platform.OS === 'ios') {
    Geolocation.requestAuthorization();
    return true;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'FixHomi needs access to your location to show nearby services.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Location permission error:', err);
    return false;
  }
};

/**
 * Custom Marker Component
 */
const CustomMarker = ({ coordinate, title, color = '#2563EB', icon = '📍', onPress }) => (
  <Mapbox.PointAnnotation
    id={`marker-${coordinate.latitude}-${coordinate.longitude}`}
    coordinate={[coordinate.longitude, coordinate.latitude]}
    title={title}
    onSelected={onPress}
  >
    <View style={[styles.markerContainer, { backgroundColor: color }]}>
      <Text style={styles.markerIcon}>{icon}</Text>
    </View>
  </Mapbox.PointAnnotation>
);

/**
 * User Location Marker
 */
const UserLocationMarker = ({ coordinate }) => (
  <Mapbox.PointAnnotation
    id="user-location"
    coordinate={[coordinate.longitude, coordinate.latitude]}
    anchor={{ x: 0.5, y: 0.5 }}
  >
    <View style={styles.userMarkerOuter}>
      <View style={styles.userMarkerInner} />
    </View>
  </Mapbox.PointAnnotation>
);

/**
 * LocationMap Component
 */
const LocationMap = forwardRef(({
  onLocationChange,
  onMapReady,
  showUserLocation = true,
  showSearchRadius = false,
  searchRadius = 1000, // meters
  markers = [],
  selectedLocation = null,
  allowLocationSelection = false,
  mapStyle = {},
  initialRegion = null,
  children,
}, ref) => {
  const cameraRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const watchIdRef = useRef(null);

  /**
   * Initialize location tracking
   */
  const initializeLocation = useCallback(async () => {
    const granted = await requestLocationPermission();
    setHasPermission(granted);

    if (!granted) {
      setLocationError('Location permission denied');
      setIsLoading(false);
      return;
    }

    // Strategy: Get fast low-accuracy location first, then upgrade to high-accuracy
    // This gives instant map display while GPS locks on
    
    // First: Quick low-accuracy position (network/cell tower)
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log('\u2705 Got quick location (low accuracy)');
        setUserLocation({ latitude, longitude });
        onLocationChange?.({ latitude, longitude });
        setIsLoading(false);
        
        // Then: Upgrade to high-accuracy GPS position
        Geolocation.getCurrentPosition(
          (highAccPos) => {
            const { latitude: lat, longitude: lng } = highAccPos.coords;
            console.log('\u2705 Upgraded to high accuracy location');
            setUserLocation({ latitude: lat, longitude: lng });
            onLocationChange?.({ latitude: lat, longitude: lng });
          },
          (error) => {
            // High accuracy failed, but we already have low accuracy - that's fine
            console.log('\u26a0\ufe0f High accuracy unavailable, using low accuracy');
          },
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 5000,
          }
        );
      },
      (error) => {
        console.warn('Low accuracy location error:', error);
        // Fallback: Try high accuracy directly
        Geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ latitude, longitude });
            onLocationChange?.({ latitude, longitude });
            setIsLoading(false);
          },
          (highAccError) => {
            console.warn('All location attempts failed:', highAccError);
            setLocationError(highAccError.message);
            setIsLoading(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 60000,
          }
        );
      },
      {
        enableHighAccuracy: false, // Low accuracy for speed
        timeout: 5000, // Fast timeout
        maximumAge: 60000, // Accept cached location up to 1 minute old
      }
    );

    // Watch position for real-time updates
    if (showUserLocation) {
      watchIdRef.current = Geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
          onLocationChange?.({ latitude, longitude });
        },
        (error) => console.warn('Watch position error:', error),
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 5000,
          fastestInterval: 2000,
        }
      );
    }
  }, [onLocationChange, showUserLocation]);

  useEffect(() => {
    initializeLocation();

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [initializeLocation]);

  /**
   * Expose methods to parent via ref
   */
  useImperativeHandle(ref, () => ({
    animateToLocation: (location, duration = 500) => {
      if (cameraRef.current && location) {
        cameraRef.current.setCamera({
          centerCoordinate: [location.longitude, location.latitude],
          zoomLevel: DEFAULT_ZOOM,
          animationDuration: duration,
        });
      }
    },
    animateToUserLocation: () => {
      if (cameraRef.current && userLocation) {
        cameraRef.current.setCamera({
          centerCoordinate: [userLocation.longitude, userLocation.latitude],
          zoomLevel: DEFAULT_ZOOM,
          animationDuration: 500,
        });
      }
    },
    getCurrentLocation: () => userLocation,
    getCameraRef: () => cameraRef.current,
  }));

  /**
   * Handle map press for location selection
   */
  const handleMapPress = (event) => {
    if (allowLocationSelection && event.geometry?.coordinates) {
      const [longitude, latitude] = event.geometry.coordinates;
      onLocationChange?.({ latitude, longitude });
    }
  };

  /**
   * Handle map ready
   */
  const handleMapReady = () => {
    setIsMapReady(true);
    onMapReady?.();
  };

  /**
   * Generate circle coordinates for search radius
   */
  const generateCircleCoordinates = (center, radiusInMeters) => {
    const points = 64;
    const coords = [];
    const distanceX = radiusInMeters / (111320 * Math.cos(center.latitude * Math.PI / 180));
    const distanceY = radiusInMeters / 110540;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([center.longitude + x, center.latitude + y]);
    }
    coords.push(coords[0]); // Close the circle
    return coords;
  };

  // Initial center - validate coordinates are valid numbers to prevent Mapbox Camera errors
  const getValidCenter = () => {
    if (initialRegion && 
        typeof initialRegion.longitude === 'number' && !isNaN(initialRegion.longitude) &&
        typeof initialRegion.latitude === 'number' && !isNaN(initialRegion.latitude)) {
      return [initialRegion.longitude, initialRegion.latitude];
    }
    if (userLocation && 
        typeof userLocation.longitude === 'number' && !isNaN(userLocation.longitude) &&
        typeof userLocation.latitude === 'number' && !isNaN(userLocation.latitude)) {
      return [userLocation.longitude, userLocation.latitude];
    }
    return [DEFAULT_LOCATION.longitude, DEFAULT_LOCATION.latitude];
  };
  const initialCenter = getValidCenter();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, mapStyle]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  if (locationError && !userLocation) {
    return (
      <View style={[styles.container, styles.errorContainer, mapStyle]}>
        <Text style={styles.errorIcon}>📍</Text>
        <Text style={styles.errorText}>Location unavailable</Text>
        <Text style={styles.errorSubtext}>{locationError}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, mapStyle]}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        onDidFinishLoadingMap={handleMapReady}
        onPress={handleMapPress}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={DEFAULT_ZOOM}
          centerCoordinate={initialCenter}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {/* User location indicator - only render after map is ready */}
        {isMapReady && showUserLocation && userLocation && (
          <UserLocationMarker coordinate={userLocation} />
        )}

        {/* Search radius circle - only render after map is ready */}
        {isMapReady && showSearchRadius && userLocation && (
          <Mapbox.ShapeSource
            id="search-radius"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [generateCircleCoordinates(userLocation, searchRadius)],
              },
            }}
          >
            <Mapbox.FillLayer
              id="search-radius-fill"
              style={{
                fillColor: 'rgba(37, 99, 235, 0.1)',
                fillOutlineColor: 'rgba(37, 99, 235, 0.5)',
              }}
            />
            <Mapbox.LineLayer
              id="search-radius-line"
              style={{
                lineColor: 'rgba(37, 99, 235, 0.5)',
                lineWidth: 2,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Selected location marker - only render after map is ready */}
        {isMapReady && selectedLocation && (
          <CustomMarker
            coordinate={selectedLocation}
            title="Selected Location"
            color="#EF4444"
            icon="📍"
          />
        )}

        {/* Custom markers - only render after map is ready */}
        {isMapReady && markers.map((marker, index) => (
          <CustomMarker
            key={marker.id || index}
            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude,
            }}
            title={marker.title}
            color={marker.color || '#2563EB'}
            icon={marker.icon || '📍'}
            onPress={() => marker.onPress?.(marker)}
          />
        ))}

        {/* Children (custom overlay components) - only render after map is ready */}
        {isMapReady && children}
      </Mapbox.MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#EF4444',
  },
  // Marker styles
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerIcon: {
    fontSize: 18,
  },
  // User location marker
  userMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default LocationMap;
