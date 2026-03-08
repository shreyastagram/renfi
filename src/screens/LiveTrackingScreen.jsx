/**
 * Live Tracking Screen -- v3.0 Premium Revamp
 *
 * Real-time provider location tracking with:
 * - Fast initial load with aggressive retry (2s intervals)
 * - Proper coordinate extraction from all backend formats
 * - Premium bottom sheet with glassmorphism
 * - Animated provider marker, route line, ETA
 * - Responsive touch feedback on all actions
 *
 * @version 3.0.0
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
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { Icon, FixhomiLogo } from '../components';
import { useDialog } from '../context/DialogContext';
import { NODE_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';
import { MAPBOX_ACCESS_TOKEN, initializeMapbox } from '../config/mapbox';
import { formatDistance, useDistanceUnit } from '../utils/formatDistance';
import {
  addEventListener as addSocketListener,
  subscribeToRequest,
  unsubscribeFromRequest,
} from '../services/socketService';

const { width: SCREEN_W } = Dimensions.get('window');

const C = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  text: '#0F172A',
  textSec: '#64748B',
  muted: '#94A3B8',
  success: '#10B981',
  danger: '#EF4444',
  purple: '#8B5CF6',
};

// Fast initial polling: 2s for first 30s, then 15s steady state
const FAST_POLL_INTERVAL = 2000;
const FAST_POLL_DURATION = 30000;
const STEADY_POLL_INTERVAL = 15000;
const ROUTE_REFETCH_THRESHOLD_KM = 0.15;

const formatTimeAgo = (date) => {
  if (!date) return 'Unknown';
  const diffSecs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diffSecs < 10) return 'Just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const m = Math.floor(diffSecs / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
};

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Extract valid lat/lng from any backend location format:
 * - currentLocation: {lat, lng}
 * - location: {latitude, longitude}
 * - geoLocation: {type: "Point", coordinates: [lng, lat]}
 */
const extractCoords = (loc) => {
  if (!loc) return null;
  // {lat, lng} format (currentLocation)
  if (loc.lat != null && loc.lng != null && !isNaN(loc.lat) && !isNaN(loc.lng) && loc.lat !== 0 && loc.lng !== 0) {
    return { latitude: loc.lat, longitude: loc.lng };
  }
  // {latitude, longitude} format (location)
  if (loc.latitude != null && loc.longitude != null && !isNaN(loc.latitude) && !isNaN(loc.longitude) && loc.latitude !== 0 && loc.longitude !== 0) {
    return { latitude: loc.latitude, longitude: loc.longitude };
  }
  // GeoJSON {type: "Point", coordinates: [lng, lat]}
  if (loc.coordinates && Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
    const [lng, lat] = loc.coordinates;
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return { latitude: lat, longitude: lng };
  }
  return null;
};

const LiveTrackingScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { dialog } = useDialog();
  const useKm = useDistanceUnit();
  const {
    requestId,
    providerId,
    providerName,
    providerPhone,
    serviceCategory,
    userLocation: initialUserLocation,
    serviceLocation: passedServiceLocation,
    serviceAddress,
  } = route.params || {};

  const cameraRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const mapReadyRef = useRef(false);
  const initialCameraSetRef = useRef(false);
  const lastRouteFetchRef = useRef(null);
  const mountTimeRef = useRef(Date.now());
  const pollIntervalRef = useRef(null);

  const [providerLocation, setProviderLocation] = useState(null);
  const [destinationLocation] = useState(passedServiceLocation || initialUserLocation || null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [providerData, setProviderData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [error, setError] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);
  const [routeDistance, setRouteDistance] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [locationSharingStopped, setLocationSharingStopped] = useState(false);
  const providerLocRef = useRef(null);

  const getInitialCenter = useCallback(() => {
    if (passedServiceLocation?.longitude && passedServiceLocation?.latitude) return [passedServiceLocation.longitude, passedServiceLocation.latitude];
    if (initialUserLocation?.longitude && initialUserLocation?.latitude) return [initialUserLocation.longitude, initialUserLocation.latitude];
    return [72.8777, 19.0760];
  }, [passedServiceLocation, initialUserLocation]);

  const [initialCenter] = useState(getInitialCenter);

  // Fetch driving route
  const fetchRoute = useCallback(async (provLoc, destLoc) => {
    if (!provLoc || !destLoc) return;
    const last = lastRouteFetchRef.current;
    if (last) {
      const moved = haversine(last.latitude, last.longitude, provLoc.latitude, provLoc.longitude);
      if (moved < ROUTE_REFETCH_THRESHOLD_KM) return;
    }
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${provLoc.longitude},${provLoc.latitude};${destLoc.longitude},${destLoc.latitude}?geometries=geojson&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes?.[0]) {
        const r = data.routes[0];
        setRouteCoordinates(r.geometry.coordinates);
        setRouteDuration(Math.ceil(r.duration / 60));
        setRouteDistance(r.distance / 1000);
        lastRouteFetchRef.current = { ...provLoc };
      }
    } catch (e) { console.error('[LiveTracking] Route error:', e.message); }
  }, []);

  // Fetch provider location — handles ALL backend response formats
  const fetchProviderLocation = useCallback(async () => {
    if (!providerId) { setError('Provider ID not available'); setIsLoading(false); return; }
    try {
      const response = await authFetch(`${NODE_BASE_URL}/api/auth/provider/location/${providerId}`, { method: 'GET' });
      const data = await response.json();

      if (data.success && data.data) {
        const d = data.data;
        // Try currentLocation first, then location, then geoLocation
        const coords = extractCoords(d.location) || extractCoords(d.currentLocation) || extractCoords(d.geoLocation);

        if (coords) {
          setProviderLocation(coords);
          providerLocRef.current = coords;
          setLastFetchedAt(new Date());
          setProviderData(d);
          setIsOnline(d.isOnline || false);
          setError(null);

          if (destinationLocation) {
            fetchRoute(coords, destinationLocation);
          }
        } else {
          // Location exists but has null/zero values
          if (!providerLocRef.current) setError('Waiting for provider to share location...');
        }
      } else {
        if (!providerLocRef.current) setError('Provider location not available yet');
      }
    } catch (err) {
      console.error('[LiveTracking] Fetch error:', err);
      if (!providerLocRef.current) setError('Connecting to provider...');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [providerId, destinationLocation, fetchRoute]);

  // Get user GPS
  const getUserLocation = useCallback(() => {
    Geolocation.getCurrentPosition(
      (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, []);

  // Center map
  const centerMap = useCallback((animate = true) => {
    if (!cameraRef.current || !mapReadyRef.current) return;
    const locs = [];
    if (providerLocation) locs.push(providerLocation);
    if (destinationLocation) locs.push(destinationLocation);
    if (locs.length === 0 && userLocation) locs.push(userLocation);
    if (locs.length === 0) return;
    if (locs.length > 1) {
      const lngs = locs.map(l => l.longitude);
      const lats = locs.map(l => l.latitude);
      cameraRef.current?.fitBounds(
        [Math.max(...lngs) + 0.008, Math.max(...lats) + 0.008],
        [Math.min(...lngs) - 0.008, Math.min(...lats) - 0.008],
        [100, 100, 220, 100], animate ? 800 : 0
      );
    } else {
      cameraRef.current?.setCamera({ centerCoordinate: [locs[0].longitude, locs[0].latitude], zoomLevel: 15, animationDuration: animate ? 600 : 0, animationMode: 'easeTo' });
    }
  }, [providerLocation, destinationLocation, userLocation]);

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    setIsMapReady(true);
    if (providerLocation && !initialCameraSetRef.current) {
      initialCameraSetRef.current = true;
      setTimeout(() => centerMap(true), 300);
    }
  }, [providerLocation, centerMap]);

  // Tick for time-ago display
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pulse animation
  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.4, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]));
    p.start();
    return () => p.stop();
  }, [pulseAnim]);

  // Slide-up bottom sheet
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, tension: 50, friction: 9, useNativeDriver: true }).start();
  }, [slideAnim]);

  // Smart polling: fast initially, then slow
  useEffect(() => {
    initializeMapbox();
    getUserLocation();
    fetchProviderLocation(); // Immediate first fetch

    // Fast poll for first 30 seconds (every 2s), then switch to 15s
    let fastInterval = setInterval(fetchProviderLocation, FAST_POLL_INTERVAL);

    const switchTimer = setTimeout(() => {
      clearInterval(fastInterval);
      pollIntervalRef.current = setInterval(fetchProviderLocation, STEADY_POLL_INTERVAL);
    }, FAST_POLL_DURATION);

    return () => {
      clearInterval(fastInterval);
      clearTimeout(switchTimer);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchProviderLocation, getUserLocation]);

  // Socket: listen for real-time location updates & sharing status changes
  useEffect(() => {
    if (!requestId) return;
    subscribeToRequest(requestId);

    // Real-time provider location via socket
    const cleanupLocation = addSocketListener('request:provider:location', (data) => {
      if (data?.requestId === requestId) {
        const coords = extractCoords(data);
        if (coords) {
          setProviderLocation(coords);
          providerLocRef.current = coords;
          setLastFetchedAt(new Date());
          setError(null);
          setLocationSharingStopped(false);
          if (destinationLocation) fetchRoute(coords, destinationLocation);
        }
      }
    });

    // Real-time location sharing status (provider toggled off)
    const cleanupStatus = addSocketListener('request:location:status', (data) => {
      if (data?.requestId === requestId && data.enabled === false) {
        setLocationSharingStopped(true);
        setIsOnline(false);
        setError('Provider stopped sharing location');
      } else if (data?.requestId === requestId && data.enabled === true) {
        setLocationSharingStopped(false);
        setIsOnline(true);
        setError(null);
      }
    });

    return () => {
      unsubscribeFromRequest(requestId);
      cleanupLocation();
      cleanupStatus();
    };
  }, [requestId, destinationLocation, fetchRoute]);

  // Center map on first provider location
  useEffect(() => {
    if (providerLocation && mapReadyRef.current && !initialCameraSetRef.current) {
      initialCameraSetRef.current = true;
      requestAnimationFrame(() => centerMap(true));
    }
  }, [providerLocation, centerMap]);

  const openDirections = useCallback(() => {
    if (!providerLocation) return;
    const { latitude, longitude } = providerLocation;
    const url = Platform.select({ ios: `maps:?daddr=${latitude},${longitude}`, android: `google.navigation:q=${latitude},${longitude}` });
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`));
  }, [providerLocation]);

  const callProvider = useCallback(() => {
    const phone = providerPhone || providerData?.phone;
    if (!phone) { dialog('Error', 'Provider phone number not available'); return; }
    const num = phone.replace(/\s/g, '');
    dialog('Call Provider', `Call ${providerName || 'Provider'} at ${phone}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call Now', onPress: () => Linking.openURL(`tel:${num}`).catch(() => dialog('Error', 'Cannot make calls')) },
    ]);
  }, [providerPhone, providerData, providerName]);

  const straightDist = providerLocation && destinationLocation
    ? haversine(providerLocation.latitude, providerLocation.longitude, destinationLocation.latitude, destinationLocation.longitude)
    : null;

  const displayDist = routeDistance ?? straightDist;
  const displayEta = routeDuration ?? (straightDist ? Math.ceil((straightDist / 30) * 60) : null);

  const sheetTranslate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });

  return (
    <View style={styles.container}>
      {/* Map loading overlay */}
      {!isMapReady && (
        <View style={styles.mapOverlay}>
          <View style={styles.mapOverlayInner}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.mapOverlayText}>Loading map...</Text>
          </View>
        </View>
      )}

      {/* Map */}
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street} logoEnabled={false} attributionEnabled={false} compassEnabled scaleBarEnabled={false} onDidFinishLoadingMap={handleMapReady}>
        <Mapbox.Camera ref={cameraRef} defaultSettings={{ centerCoordinate: initialCenter, zoomLevel: 14 }} animationMode="flyTo" animationDuration={0} />

        {/* User marker */}
        {userLocation && (!destinationLocation || Math.abs(userLocation.latitude - destinationLocation.latitude) > 0.001 || Math.abs(userLocation.longitude - destinationLocation.longitude) > 0.001) && (
          <Mapbox.PointAnnotation id="user-marker" coordinate={[userLocation.longitude, userLocation.latitude]}>
            <View style={styles.userMarker}><MaterialIcon name="person-pin" size={16} color={C.white} /></View>
          </Mapbox.PointAnnotation>
        )}

        {/* Destination marker */}
        {destinationLocation && (
          <Mapbox.PointAnnotation id="dest-marker" coordinate={[destinationLocation.longitude, destinationLocation.latitude]}>
            <View style={styles.destMarker}><MaterialIcon name="home" size={18} color={C.white} /></View>
          </Mapbox.PointAnnotation>
        )}

        {/* Provider marker */}
        {providerLocation && (
          <Mapbox.PointAnnotation id="provider-marker" coordinate={[providerLocation.longitude, providerLocation.latitude]}>
            <View style={styles.providerMarker}><FixhomiLogo size={22} color={C.white} /></View>
          </Mapbox.PointAnnotation>
        )}

        {/* Route line */}
        {destinationLocation && providerLocation && (
          <Mapbox.ShapeSource id="route" shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoordinates || [[providerLocation.longitude, providerLocation.latitude], [destinationLocation.longitude, destinationLocation.latitude]] } }}>
            <Mapbox.LineLayer id="routeOutline" style={{ lineColor: '#c45a00', lineWidth: 8, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.4 }} />
            <Mapbox.LineLayer id="routeLine" style={{ lineColor: C.primary, lineWidth: 5, lineCap: 'round', lineJoin: 'round', lineOpacity: 1 }} />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Icon name="arrow_back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          {isOnline && (
            <View style={styles.liveBadge}>
              <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => centerMap(true)} activeOpacity={0.7}>
          <MaterialIcon name="my-location" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: sheetTranslate }] }]}>
        {isLoading ? (
          <View style={styles.sheetCenter}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.sheetLoadingText}>Finding provider...</Text>
            <Text style={styles.sheetSubText}>This usually takes a few seconds</Text>
          </View>
        ) : locationSharingStopped ? (
          <View style={styles.sheetCenter}>
            <View style={[styles.errorIcon, { backgroundColor: '#FEF2F2' }]}><MaterialIcon name="location-off" size={28} color={C.danger} /></View>
            <Text style={styles.errorTitle}>Provider stopped sharing location</Text>
            <Text style={styles.errorSubText}>Their last known position is shown on the map</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: C.secondary }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.retryBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : error && !providerLocation ? (
          <View style={styles.sheetCenter}>
            <View style={styles.errorIcon}><MaterialIcon name="location-searching" size={28} color={C.primary} /></View>
            <Text style={styles.errorTitle}>{error}</Text>
            <Text style={styles.errorSubText}>We're polling every 2 seconds</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => { setIsRefreshing(true); fetchProviderLocation(); }} activeOpacity={0.7}>
              {isRefreshing ? <ActivityIndicator size="small" color={C.white} /> : <Text style={styles.retryBtnText}>Retry Now</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Provider row */}
            <View style={styles.providerRow}>
              <View style={styles.avatar}>
                {providerData?.profilePicture?.url || (typeof providerData?.profilePicture === 'string' && providerData.profilePicture) ? (
                  <Image source={{ uri: providerData.profilePicture?.url || providerData.profilePicture }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>{(providerName || 'P').charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.providerName}>{providerName || providerData?.name || 'Provider'}</Text>
                <Text style={styles.providerSvc}>{serviceCategory || 'Service Provider'}</Text>
              </View>
              <View style={[styles.statusChip, isOnline && styles.statusChipOnline]}>
                <View style={[styles.statusChipDot, isOnline && styles.statusChipDotOn]} />
                <Text style={[styles.statusChipText, isOnline && styles.statusChipTextOn]}>{isOnline ? 'Online' : 'Offline'}</Text>
              </View>
            </View>

            {/* Service address */}
            {serviceAddress ? (
              <View style={styles.addressBar}>
                <View style={styles.addressDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>HEADING TO</Text>
                  <Text style={styles.addressText} numberOfLines={2}>{serviceAddress}</Text>
                </View>
              </View>
            ) : null}

            {/* Stats row */}
            {displayDist != null && (
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#FFF7ED' }]}>
                    <MaterialIcon name="directions-car" size={18} color={C.primary} />
                  </View>
                  <Text style={styles.statVal}>{formatDistance(Number(displayDist), useKm)}</Text>
                  <Text style={styles.statSub}>{routeDistance != null ? 'via road' : 'straight'}</Text>
                </View>
                {displayEta != null && (
                  <View style={styles.statItem}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#EDE9FE' }]}>
                      <MaterialIcon name="schedule" size={18} color={C.purple} />
                    </View>
                    <Text style={styles.statVal}>{displayEta < 60 ? `${displayEta} min` : `${Math.floor(displayEta / 60)}h ${displayEta % 60}m`}</Text>
                    <Text style={styles.statSub}>ETA</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.statItem} onPress={() => { setIsRefreshing(true); fetchProviderLocation(); }} activeOpacity={0.6}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#ECFDF5' }]}>
                    {isRefreshing ? <ActivityIndicator size={16} color={C.success} /> : <MaterialIcon name="refresh" size={18} color={C.success} />}
                  </View>
                  <Text style={styles.statVal}>{formatTimeAgo(lastFetchedAt)}</Text>
                  <Text style={styles.statSub}>tap to refresh</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.callBtn} onPress={callProvider} activeOpacity={0.8}>
                <MaterialIcon name="phone" size={20} color={C.white} />
                <Text style={styles.callBtnText}>Call Provider</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dirBtn} onPress={openDirections} activeOpacity={0.8}>
                <MaterialIcon name="directions" size={20} color={C.primary} />
                <Text style={styles.dirBtnText}>Directions</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  map: { flex: 1 },

  // Map overlay
  mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(248,250,252,0.95)', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  mapOverlayInner: { alignItems: 'center', gap: 12 },
  mapOverlayText: { fontSize: 14, fontWeight: '600', color: C.textSec },

  // Header
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(255,255,255,0.96)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 5 },
  headerBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.danger },
  liveText: { fontSize: 10, fontWeight: '800', color: C.danger, letterSpacing: 0.5 },

  // Markers
  userMarker: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.secondary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  destMarker: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  providerMarker: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.white, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 8 },

  // Bottom sheet
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12 },

  // Loading/Error in sheet
  sheetCenter: { alignItems: 'center', paddingVertical: 20 },
  sheetLoadingText: { marginTop: 14, fontSize: 16, fontWeight: '700', color: C.text },
  sheetSubText: { marginTop: 4, fontSize: 13, fontWeight: '500', color: C.muted },
  errorIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  errorTitle: { fontSize: 15, fontWeight: '700', color: C.text, textAlign: 'center' },
  errorSubText: { fontSize: 12, fontWeight: '500', color: C.muted, marginTop: 4 },
  retryBtn: { marginTop: 16, backgroundColor: C.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: C.white },

  // Provider row
  providerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 },
  avatarImg: { width: 48, height: 48, borderRadius: 16 },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: C.white },
  providerName: { fontSize: 16, fontWeight: '700', color: C.text },
  providerSvc: { fontSize: 12, fontWeight: '500', color: C.muted, marginTop: 2, textTransform: 'capitalize' },
  statusChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 6 },
  statusChipOnline: { backgroundColor: '#ECFDF5' },
  statusChipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.muted },
  statusChipDotOn: { backgroundColor: C.success },
  statusChipText: { fontSize: 11, fontWeight: '700', color: C.muted },
  statusChipTextOn: { color: '#059669' },

  // Address bar
  addressBar: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F0FDF4', borderRadius: 14, padding: 12, marginBottom: 14, gap: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  addressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.success, marginTop: 4 },
  addressLabel: { fontSize: 9, fontWeight: '800', color: C.success, letterSpacing: 0.8, marginBottom: 2 },
  addressText: { fontSize: 13, fontWeight: '500', color: C.text, lineHeight: 18 },

  // Stats row
  statsRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginBottom: 14, gap: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  statItem: { flex: 1, alignItems: 'center' },
  statIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statVal: { fontSize: 14, fontWeight: '700', color: C.text },
  statSub: { fontSize: 10, fontWeight: '500', color: C.muted, marginTop: 2 },

  // Action buttons
  actionsRow: { flexDirection: 'row', gap: 10 },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.success, paddingVertical: 14, borderRadius: 16, gap: 8, shadowColor: C.success, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  callBtnText: { fontSize: 15, fontWeight: '700', color: C.white },
  dirBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED', paddingVertical: 14, borderRadius: 16, gap: 8, borderWidth: 1.5, borderColor: C.primary },
  dirBtnText: { fontSize: 15, fontWeight: '700', color: C.primary },
});

export default LiveTrackingScreen;
