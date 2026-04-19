/**
 * MapPickerModal Component
 *
 * Full-screen map picker for selecting locations
 * Ultra-smooth with center pin marker (like Uber/Ola)
 * Includes location search with Mapbox geocoding
 * Uses device GPS for initial position instead of hardcoded Mumbai
 *
 * @version 2.0.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  ActivityIndicator,
  Platform,
  Animated,
  TextInput,
  FlatList,
  Keyboard
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Geolocation from '@react-native-community/geolocation';
import { check, PERMISSIONS, RESULTS } from 'react-native-permissions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  background: '#faf7f7',
  white: '#FFFFFF',
};

// Fallback location (Mumbai) — only used if GPS fails AND no initialLocation
const FALLBACK_LOCATION = {
  latitude: 19.0760,
  longitude: 72.8777,
};

/**
 * Reverse geocode using Mapbox
 */
const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?` +
      `access_token=${MAPBOX_ACCESS_TOKEN}&` +
      `types=address,poi,locality,neighborhood,place`,
      { headers: { 'Accept': 'application/json' } }
    );
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return { latitude, longitude, address: 'Selected Location', shortAddress: 'Selected Location' };
    }

    const feature = data.features[0];
    const context = feature.context || [];
    const locality = context.find(c => c.id?.startsWith('locality'))?.text || '';
    const place = context.find(c => c.id?.startsWith('place'))?.text || '';
    const region = context.find(c => c.id?.startsWith('region'))?.text || '';
    const postcode = context.find(c => c.id?.startsWith('postcode'))?.text || '';

    const shortParts = [locality || feature.text, place].filter(Boolean);
    const shortAddress = shortParts.length > 0 ? shortParts.slice(0, 2).join(', ') : feature.place_name?.split(',').slice(0, 2).join(',');

    return {
      latitude,
      longitude,
      address: feature.place_name,
      shortAddress: shortAddress || 'Selected Location',
      addressLine1: feature.text || feature.place_name?.split(',')[0] || '',
      city: place || locality || '',
      state: region || '',
      pincode: postcode || '',
      isCurrentLocation: false,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return { latitude, longitude, address: 'Selected Location', shortAddress: 'Selected Location', isCurrentLocation: false };
  }
};

/**
 * Forward geocode (search) using Mapbox
 */
const forwardGeocode = async (query, proximity) => {
  if (!query || query.length < 2) return [];
  try {
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      `access_token=${MAPBOX_ACCESS_TOKEN}&` +
      `country=in&limit=5&language=en`;
    if (proximity) {
      url += `&proximity=${proximity.longitude},${proximity.latitude}`;
    }
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await response.json();
    if (!data.features) return [];
    return data.features.map(f => ({
      id: f.id,
      name: f.text,
      fullAddress: f.place_name,
      latitude: f.center[1],
      longitude: f.center[0],
    }));
  } catch (error) {
    console.error('Forward geocoding error:', error);
    return [];
  }
};

/**
 * MapPickerModal Component
 */
const MapPickerModal = ({
  visible,
  onClose,
  onLocationSelect,
  initialLocation,
  title = 'Select Location',
}) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

  const getValidInitialLocation = () => {
    if (initialLocation &&
        typeof initialLocation.longitude === 'number' && !isNaN(initialLocation.longitude) &&
        typeof initialLocation.latitude === 'number' && !isNaN(initialLocation.latitude)) {
      return initialLocation;
    }
    return null; // Will be resolved by GPS
  };

  const [centerLocation, setCenterLocation] = useState(getValidInitialLocation() || FALLBACK_LOCATION);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const isMapMovingRef = useRef(false);
  const [pinLifted, setPinLifted] = useState(false);
  const centerRef = useRef(getValidInitialLocation() || FALLBACK_LOCATION);
  const geocodeTimer = useRef(null);
  const pinBounce = useRef(new Animated.Value(0)).current;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimer = useRef(null);
  const searchInputRef = useRef(null);
  // Track if GPS location was fetched
  const gpsLocationRef = useRef(null);
  // Flag to skip onMapIdle geocode during programmatic camera moves
  const isProgrammaticMoveRef = useRef(false);

  // Get device GPS on modal open
  useEffect(() => {
    if (visible) {
      const validInitial = getValidInitialLocation();

      if (validInitial) {
        // Has valid initial location — use it
        setCenterLocation(validInitial);
        centerRef.current = validInitial;
        // Trigger initial geocode directly — also queries native map center as fallback
        setTimeout(() => handleRegionChange(validInitial.latitude, validInitial.longitude), 600);
      } else {
        // No initial location — try GPS, but only if permission is already
        // granted. Never trigger a cold OS prompt here — upstream screens
        // own the prominent-disclosure flow (Google Play User Data policy).
        const useFallback = () => {
          setCenterLocation(FALLBACK_LOCATION);
          centerRef.current = FALLBACK_LOCATION;
          setTimeout(() => handleRegionChange(FALLBACK_LOCATION.latitude, FALLBACK_LOCATION.longitude), 500);
        };

        const permission = Platform.OS === 'ios'
          ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
          : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

        check(permission).then((status) => {
          if (status !== RESULTS.GRANTED && status !== RESULTS.LIMITED) {
            useFallback();
            return;
          }
          Geolocation.getCurrentPosition(
            (position) => {
              const loc = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              };
              gpsLocationRef.current = loc;
              setCenterLocation(loc);
              centerRef.current = loc;
              isProgrammaticMoveRef.current = true;
              cameraRef.current?.setCamera({
                centerCoordinate: [loc.longitude, loc.latitude],
                zoomLevel: 16,
                animationDuration: 800,
              });
            },
            () => useFallback(),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
          );
        }).catch(() => useFallback());
      }

      setSelectedAddress(null);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearchResults(false);
      isMapMovingRef.current = false;
      setPinLifted(false);
      lastGeocodedRef.current = null;
      isGeocodingRef.current = false;
    }
    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (cameraIdleTimer.current) clearTimeout(cameraIdleTimer.current);
      if (touchSafetyTimer.current) clearTimeout(touchSafetyTimer.current);
    };
  }, [visible, initialLocation]);

  // Animate pin
  useEffect(() => {
    Animated.spring(pinBounce, {
      toValue: pinLifted ? -10 : 0,
      friction: pinLifted ? 8 : 5,
      tension: pinLifted ? 100 : 80,
      useNativeDriver: true,
    }).start();
  }, [pinLifted]);

  // Track geocode request to cancel stale ones
  const geocodeIdRef = useRef(0);

  const handleRegionChange = useCallback(async (latitude, longitude) => {
    centerRef.current = { latitude, longitude };
    const requestId = ++geocodeIdRef.current;
    setIsLoading(true);
    try {
      const result = await reverseGeocode(latitude, longitude);
      // Only apply if this is still the latest request
      if (requestId === geocodeIdRef.current) {
        setSelectedAddress(result);
      }
    } catch (error) {
      console.error('Error getting address:', error);
    } finally {
      if (requestId === geocodeIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Uber/Ola approach: bypass all Mapbox event callbacks (unreliable on iOS
  // with Fabric/New Architecture inside Modal). Instead:
  // 1. Detect touch start/end on the map's wrapper View (always fires on iOS)
  // 2. After touch end + deceleration delay, query the native MapView for
  //    the coordinate at the screen center using getCoordinateFromView()
  // 3. This converts the pin's pixel position → map coordinate, 100% reliable
  const cameraIdleTimer = useRef(null);
  const lastGeocodedRef = useRef(null);
  const mapLayoutRef = useRef({ width: 0, height: 0 });
  const touchActiveRef = useRef(false);
  // Guard: prevents overlapping geocode calls and re-entrant loops
  const isGeocodingRef = useRef(false);

  // Query the native map for the coordinate at the screen center (where the pin is)
  const geocodeMapCenter = useCallback(async () => {
    // Prevent re-entrant calls (onMapIdle can fire after state updates)
    if (isGeocodingRef.current) return;
    if (!mapRef.current) return;

    try {
      isGeocodingRef.current = true;
      let latitude, longitude;

      // Primary: getCoordinateFromView — converts screen pixel → map coordinate
      if (mapLayoutRef.current.width > 0) {
        const screenCenter = [
          mapLayoutRef.current.width / 2,
          mapLayoutRef.current.height / 2,
        ];
        const coord = await mapRef.current.getCoordinateFromView(screenCenter);
        if (coord) {
          longitude = coord[0];
          latitude = coord[1];
        }
      }

      // Fallback: getCenter()
      if (latitude === undefined) {
        const center = await mapRef.current.getCenter();
        if (center) {
          longitude = center[0];
          latitude = center[1];
        }
      }

      if (latitude === undefined || longitude === undefined) return;

      // Dedup: skip if we already geocoded this exact spot
      const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
      if (lastGeocodedRef.current === key) return;
      lastGeocodedRef.current = key;

      centerRef.current = { latitude, longitude };
      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
      }
      handleRegionChange(latitude, longitude);
    } catch (err) {
      console.warn('geocodeMapCenter error:', err.message);
      // Don't call handleRegionChange in catch — avoids loop if native calls keep failing
    } finally {
      isGeocodingRef.current = false;
    }
  }, [handleRegionChange]);

  // Called when user touches the map — lift pin
  // Safety: auto-reset touchActive after 3s in case onTouchEnd never fires
  // (Android's MapView can swallow touch events from the parent View)
  const touchSafetyTimer = useRef(null);
  const handleMapTouchStart = useCallback(() => {
    if (showSearchResults) {
      setShowSearchResults(false);
      Keyboard.dismiss();
    }
    touchActiveRef.current = true;
    if (!isProgrammaticMoveRef.current) {
      isMapMovingRef.current = true;
      setPinLifted(true);
    }
    // Safety net: if onTouchEnd never fires, reset after 3s
    if (touchSafetyTimer.current) clearTimeout(touchSafetyTimer.current);
    touchSafetyTimer.current = setTimeout(() => {
      if (touchActiveRef.current) {
        touchActiveRef.current = false;
      }
    }, 3000);
  }, [showSearchResults]);

  // Called when user lifts finger — wait for deceleration then geocode
  const handleMapTouchEnd = useCallback(() => {
    touchActiveRef.current = false;
    if (touchSafetyTimer.current) clearTimeout(touchSafetyTimer.current);
    if (cameraIdleTimer.current) clearTimeout(cameraIdleTimer.current);
    cameraIdleTimer.current = setTimeout(() => {
      isMapMovingRef.current = false;
      setPinLifted(false);
      geocodeMapCenter();
    }, 800);
  }, [geocodeMapCenter]);

  // onCameraChanged — center tracking + debounced geocode trigger
  // This is the PRIMARY geocode path on Android (where touch events may not fire)
  const onCameraChanged = useCallback((event) => {
    const props = event.properties || {};
    const center = props.center;
    if (center && Array.isArray(center)) {
      centerRef.current = { latitude: center[1], longitude: center[0] };
    }

    // Lift pin if not already (Android path — touch events may not reach wrapper)
    if (!isProgrammaticMoveRef.current && !isMapMovingRef.current) {
      isMapMovingRef.current = true;
      setPinLifted(true);
    }

    // Debounce: when camera stops for 500ms, geocode the center
    if (cameraIdleTimer.current) clearTimeout(cameraIdleTimer.current);
    cameraIdleTimer.current = setTimeout(() => {
      touchActiveRef.current = false; // Always reset — prevents stuck state
      isMapMovingRef.current = false;
      setPinLifted(false);
      geocodeMapCenter();
    }, 500);
  }, [geocodeMapCenter]);

  // onMapIdle — backup trigger. Only geocode if map was actually moving
  // (prevents loop: geocode → state update → re-render → onMapIdle → geocode)
  const onMapIdle = useCallback(() => {
    if (cameraIdleTimer.current) clearTimeout(cameraIdleTimer.current);
    touchActiveRef.current = false; // Always reset
    const wasMoving = isMapMovingRef.current;
    isMapMovingRef.current = false;
    setPinLifted(false);
    if (wasMoving) {
      geocodeMapCenter();
    }
  }, [geocodeMapCenter]);

  const handleConfirm = useCallback(() => {
    if (selectedAddress) {
      onLocationSelect(selectedAddress);
      onClose();
    }
  }, [selectedAddress, onLocationSelect, onClose]);

  const centerToUserLocation = useCallback(() => {
    // Prefer GPS location, then initialLocation, then fallback
    const loc = gpsLocationRef.current || getValidInitialLocation();
    if (!loc) {
      // Only fetch GPS if permission is already granted — never cold-trigger
      // the OS prompt here (upstream screens own the disclosure).
      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
      check(permission).then((status) => {
        if (status !== RESULTS.GRANTED && status !== RESULTS.LIMITED) return;
        Geolocation.getCurrentPosition(
          (position) => {
            const gpsLoc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            gpsLocationRef.current = gpsLoc;
            isProgrammaticMoveRef.current = true;
            cameraRef.current?.setCamera({
              centerCoordinate: [gpsLoc.longitude, gpsLoc.latitude],
              zoomLevel: 16,
              animationDuration: 1000,
            });
            lastGeocodedRef.current = null;
            setTimeout(() => geocodeMapCenter(), 1200);
          },
          () => {},
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
        );
      }).catch(() => {});
      return;
    }
    isProgrammaticMoveRef.current = true;
    cameraRef.current?.setCamera({
      centerCoordinate: [loc.longitude, loc.latitude],
      zoomLevel: 16,
      animationDuration: 1000,
    });
    lastGeocodedRef.current = null;
    setTimeout(() => geocodeMapCenter(), 1200);
  }, [initialLocation, geocodeMapCenter]);

  // Search handler with debounce
  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (text.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setShowSearchResults(true);
    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      const results = await forwardGeocode(text, centerRef.current);
      setSearchResults(results);
      setIsSearching(false);
    }, 350);
  }, []);

  // Select a search result — fly to it
  const handleSearchSelect = useCallback((result) => {
    Keyboard.dismiss();
    setSearchQuery(result.name);
    setShowSearchResults(false);
    setSearchResults([]);

    const loc = { latitude: result.latitude, longitude: result.longitude };
    centerRef.current = loc;
    isProgrammaticMoveRef.current = true;

    cameraRef.current?.setCamera({
      centerCoordinate: [result.longitude, result.latitude],
      zoomLevel: 16,
      animationDuration: 1000,
    });

    // Programmatic move — geocode after animation settles (touch events won't fire)
    lastGeocodedRef.current = null; // Force re-geocode
    setTimeout(() => geocodeMapCenter(), 1200);
  }, [geocodeMapCenter]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialIcon name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <MaterialIcon name="search" size={22} color="#9CA3AF" />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search area, landmark, or address..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }}>
                <MaterialIcon name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Search Results Dropdown */}
          {showSearchResults && (
            <View style={styles.searchResultsContainer}>
              {isSearching ? (
                <View style={styles.searchLoadingRow}>
                  <ActivityIndicator size="small" color={BRAND.primary} />
                  <Text style={styles.searchLoadingText}>Searching...</Text>
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.searchLoadingRow}>
                  <MaterialIcon name="search-off" size={20} color="#9CA3AF" />
                  <Text style={styles.searchLoadingText}>No results found</Text>
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 220 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.searchResultItem}
                      onPress={() => handleSearchSelect(item)}
                    >
                      <MaterialIcon name="location-on" size={20} color={BRAND.primary} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.searchResultAddress} numberOfLines={1}>{item.fullAddress}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}
        </View>

        {/* Map */}
        <View
          style={styles.mapContainer}
          onLayout={(e) => {
            mapLayoutRef.current = {
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            };
          }}
          onTouchStart={handleMapTouchStart}
          onTouchEnd={handleMapTouchEnd}
        >
          <Mapbox.MapView
            ref={mapRef}
            style={styles.map}
            styleURL={Mapbox.StyleURL.Street}
            zoomEnabled
            scrollEnabled
            pitchEnabled={false}
            rotateEnabled={false}
            onCameraChanged={onCameraChanged}
            onMapIdle={onMapIdle}
          >
            <Mapbox.Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: [centerLocation.longitude, centerLocation.latitude],
                zoomLevel: 16,
              }}
              animationMode="flyTo"
              animationDuration={1000}
            />
          </Mapbox.MapView>

          {/* Center Pin */}
          <View style={styles.centerPinContainer} pointerEvents="none">
            <Animated.View style={[styles.centerPin, { transform: [{ translateY: pinBounce }] }]}>
              <View style={styles.pinHead}>
                <MaterialIcon name="place" size={40} color={BRAND.primary} />
              </View>
            </Animated.View>
            <View style={styles.pinShadow} />
          </View>

          {/* My Location Button */}
          <TouchableOpacity
            style={[styles.myLocationButton, { bottom: 200 }]}
            onPress={centerToUserLocation}
          >
            <MaterialIcon name="my-location" size={24} color={BRAND.secondary} />
          </TouchableOpacity>
        </View>

        {/* Bottom Card */}
        <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.addressContainer}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={BRAND.primary} />
                <Text style={styles.loadingText}>Finding address...</Text>
              </View>
            ) : (
              <>
                <View style={styles.addressIconContainer}>
                  <MaterialIcon name="location-on" size={24} color={BRAND.primary} />
                </View>
                <View style={styles.addressTextContainer}>
                  <Text style={styles.addressTitle} numberOfLines={1}>
                    {selectedAddress?.shortAddress || 'Move map to select location'}
                  </Text>
                  <Text style={styles.addressSubtitle} numberOfLines={2}>
                    {selectedAddress?.address || 'Drag the map to position the pin'}
                  </Text>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, (!selectedAddress || isLoading) && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!selectedAddress || isLoading}
          >
            <MaterialIcon name="check" size={22} color={BRAND.white} />
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: BRAND.white,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: BRAND.white,
    zIndex: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    padding: 0,
  },
  searchResultsContainer: {
    backgroundColor: BRAND.white,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  searchLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  searchLoadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  searchResultAddress: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // Map
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -48,
    alignItems: 'center',
  },
  centerPin: {
    alignItems: 'center',
  },
  pinHead: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  pinShadow: {
    width: 10,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 5,
    marginTop: -2,
  },
  myLocationButton: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  // Bottom card
  bottomCard: {
    backgroundColor: BRAND.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    minHeight: 60,
  },
  loadingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
  },
  addressIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: BRAND.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  addressSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    backgroundColor: BRAND.primary,
    borderRadius: 14,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: BRAND.white,
  },
});

export default MapPickerModal;
