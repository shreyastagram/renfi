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
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

import { initializeMapbox } from '../../config/mapbox';
import {
  useThemedStyles,
  mapPin,
} from '../../theme';
import { getMapStyleURL } from '../../config/mapbox';
import { useIsDark } from '../../theme';

// Initialize Mapbox at module level — BEFORE any MapView renders.
// In release builds, useEffect runs after first render, by which time
// the native MapView has already tried to load tiles without a token.
initializeMapbox();

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
    // Shared helper — single source of truth for FINE/COARSE semantics.
    const { requestAndroidLocationPermission } = require('../../utils/locationPermission');
    const { granted } = await requestAndroidLocationPermission();
    return granted;
  } catch (err) {
    console.warn('Location permission error:', err);
    return false;
  }
};

/**
 * Custom Marker Component
 * Uses MarkerView on iOS (PointAnnotation has bugs with Fabric/New Architecture)
 * Uses PointAnnotation on Android (works correctly)
 */
const CustomMarker = ({ coordinate, title, color = mapPin.markerDefault, icon = '📍', onPress }) => {
  const styles = useThemedStyles(makeStyles);
  const coord = [coordinate.longitude, coordinate.latitude];
  if (Platform.OS === 'ios') {
    return (
      <Mapbox.MarkerView
        id={`marker-${coordinate.latitude}-${coordinate.longitude}`}
        coordinate={coord}
      >
        <View style={[styles.markerContainer, { backgroundColor: color }]}>
          <Text style={styles.markerIcon}>{icon}</Text>
        </View>
      </Mapbox.MarkerView>
    );
  }
  return (
    <Mapbox.PointAnnotation
      id={`marker-${coordinate.latitude}-${coordinate.longitude}`}
      coordinate={coord}
      title={title}
      onSelected={onPress}
    >
      <View style={[styles.markerContainer, { backgroundColor: color }]}>
        <Text style={styles.markerIcon}>{icon}</Text>
      </View>
    </Mapbox.PointAnnotation>
  );
};

/**
 * User Location Marker
 */
const UserLocationMarker = ({ coordinate }) => {
  const styles = useThemedStyles(makeStyles);
  const coord = [coordinate.longitude, coordinate.latitude];
  if (Platform.OS === 'ios') {
    return (
      <Mapbox.MarkerView id="user-location" coordinate={coord}>
        <View style={styles.userMarkerOuter}>
          <View style={styles.userMarkerInner} />
        </View>
      </Mapbox.MarkerView>
    );
  }
  return (
    <Mapbox.PointAnnotation
      id="user-location"
      coordinate={coord}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.userMarkerOuter}>
        <View style={styles.userMarkerInner} />
      </View>
    </Mapbox.PointAnnotation>
  );
};

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
  externalLocation = null, // From LocationContext — skips independent GPS
  children,
}, ref) => {
  const styles = useThemedStyles(makeStyles);
  const isDark = useIsDark();
  const cameraRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState(externalLocation || null);
  const [hasPermission, setHasPermission] = useState(!!externalLocation);
  const [locationError, setLocationError] = useState(null);
  const watchIdRef = useRef(null);
  const hasFallbackInit = useRef(false);

  // ── Sync from LocationContext (instant, no GPS call) ──
  useEffect(() => {
    if (externalLocation?.latitude && externalLocation?.longitude) {
      setUserLocation(externalLocation);
      setHasPermission(true);
      setLocationError(null);
    }
  }, [externalLocation]);

  /**
   * Fallback: Only do independent GPS if externalLocation is never provided
   * This handles ProviderHomeScreen or other screens that don't use LocationContext
   */
  const initializeLocation = useCallback(async () => {
    // Skip entirely if we already have external location
    if (externalLocation?.latitude) return;
    if (hasFallbackInit.current) return;
    hasFallbackInit.current = true;

    const granted = await requestLocationPermission();
    setHasPermission(granted);
    if (!granted) {
      setLocationError('Location permission denied');
      return;
    }

    // Single fast attempt — no timeout chain
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });
        onLocationChange?.({ latitude, longitude });
      },
      (error) => {
        console.warn('[LocationMap] Fallback GPS failed:', error.message);
        setLocationError(error.message);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 }
    );

    // Background watch for real-time
    if (showUserLocation) {
      watchIdRef.current = Geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
          onLocationChange?.({ latitude, longitude });
        },
        (error) => console.warn('Watch position error:', error),
        { enableHighAccuracy: true, distanceFilter: 10, interval: 5000, fastestInterval: 2000 }
      );
    }
  }, [externalLocation, onLocationChange, showUserLocation]);

  useEffect(() => {
    initializeMapbox();
    // Only run fallback GPS if no external location after a tick
    const timer = setTimeout(() => {
      if (!externalLocation?.latitude) {
        initializeLocation();
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [initializeLocation, externalLocation]);

  /**
   * Expose methods to parent via ref
   */
  useImperativeHandle(ref, () => ({
    animateToLocation: (location, duration = 500) => {
      try {
        if (cameraRef.current && location) {
          cameraRef.current.setCamera({
            centerCoordinate: [location.longitude, location.latitude],
            zoomLevel: DEFAULT_ZOOM,
            animationDuration: duration,
          });
        }
      } catch (e) {
        // Mapbox native view may be recycled — safe to ignore
      }
    },
    animateToUserLocation: (loc) => {
      try {
        const target = loc || userLocation;
        if (cameraRef.current && target) {
          cameraRef.current.setCamera({
            centerCoordinate: [target.longitude, target.latitude],
            zoomLevel: DEFAULT_ZOOM,
            animationDuration: 500,
          });
        }
      } catch (e) {
        // Mapbox native view may be recycled — safe to ignore
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

  // Never block the UI — always show the map (with default center if location pending)
  return (
    <View style={[styles.container, mapStyle]}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={getMapStyleURL(isDark)}
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
                fillColor: mapPin.geofenceFill,
                fillOutlineColor: mapPin.geofenceLine,
              }}
            />
            <Mapbox.LineLayer
              id="search-radius-line"
              style={{
                lineColor: mapPin.geofenceLine,
                lineWidth: 2,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Selected location marker (service address) - industry-grade pin */}
        {isMapReady && selectedLocation && (
          Platform.OS === 'ios' ? (
            <Mapbox.MarkerView
              key={`sel-${selectedLocation.latitude.toFixed(4)}-${selectedLocation.longitude.toFixed(4)}`}
              id="selected-service-location"
              coordinate={[selectedLocation.longitude, selectedLocation.latitude]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.serviceLocationMarker}>
                <View style={styles.serviceLocationPin}>
                  <MaterialIcon name="place" size={32} color={mapPin.onServicePin} />
                </View>
                <View style={styles.serviceLocationPinTail} />
              </View>
            </Mapbox.MarkerView>
          ) : (
            <Mapbox.PointAnnotation
              id="selected-service-location"
              coordinate={[selectedLocation.longitude, selectedLocation.latitude]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.serviceLocationMarker}>
                <View style={styles.serviceLocationPin}>
                  <MaterialIcon name="place" size={32} color={mapPin.onServicePin} />
                </View>
                <View style={styles.serviceLocationPinTail} />
              </View>
              <Mapbox.Callout title={selectedLocation.shortAddress || selectedLocation.address || 'Service Location'} />
            </Mapbox.PointAnnotation>
          )
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
            color={marker.color || mapPin.markerDefault}
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

const makeStyles = (theme) => {
  const C = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    map: {
      flex: 1,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.surfaceSunken,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: C.textSecondary,
    },
    errorContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.dangerContainer,
    },
    errorIcon: {
      fontSize: 48,
      marginBottom: 12,
    },
    errorText: {
      fontSize: 16,
      fontWeight: '600',
      color: C.danger,
      marginBottom: 4,
    },
    errorSubtext: {
      fontSize: 14,
      color: C.danger,
    },
    // Marker styles
    markerContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: mapPin.shadow,
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
      backgroundColor: mapPin.userHalo,
      alignItems: 'center',
      justifyContent: 'center',
    },
    userMarkerInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: mapPin.userDot,
      borderWidth: 2,
      borderColor: mapPin.ring,
    },
    // Selected service location marker (orange pin)
    serviceLocationMarker: {
      alignItems: 'center',
    },
    serviceLocationPin: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: mapPin.servicePin,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: mapPin.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 8,
      borderWidth: 3,
      borderColor: mapPin.ring,
    },
    serviceLocationPinTail: {
      width: 0,
      height: 0,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderTopWidth: 10,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: mapPin.servicePin,
      marginTop: -2,
    },
  });
};

export default LocationMap;
