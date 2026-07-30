/**
 * Location Context
 * 
 * Production-grade location management:
 * - Fetches location ONCE on app start with HIGH SPEED
 * - Uses cached GPS for INSTANT results (like Uber/Ola)
 * - Updates every 30 seconds in background
 * - Works across all screens
 * - Optimized for fast location acquisition
 * 
 * @version 2.0.0 - Optimized for speed
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Platform, PermissionsAndroid, Linking, AppState } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useDialog } from './DialogContext';
import DeviceInfo from 'react-native-device-info';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { requestNotificationPermission } from '../services/fcmService';
import { setLatestLocation } from '../services/socketService';
import { Analytics, EV, oncePerSession } from '../services/analytics';

// Mapbox Access Token (from .env via centralized config)
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';

// Location update interval (30 seconds)
const LOCATION_UPDATE_INTERVAL = 30000;

// OPTIMIZED: Faster timeout settings
const LOCATION_TIMEOUT = 10000; // 10 seconds max
const LOCATION_TIMEOUT_FAST = 3000; // 3 seconds for initial fast fetch
const LOCATION_MAX_AGE = 120000; // 2 minutes cached is OK for instant result
const LOCATION_MAX_AGE_FAST = 300000; // 5 minutes for first fast fetch

// Minimum interval between reverse geocode calls (prevents rapid API calls)
const REVERSE_GEOCODE_THROTTLE = 10000; // 10 seconds
let lastReverseGeocodeTime = 0;
let lastReverseGeocodeResult = null;

/**
 * Reverse geocode using Mapbox with retry logic, timeout, and throttling
 */
const reverseGeocode = async (latitude, longitude, retryCount = 0) => {
  const MAX_RETRIES = 2;
  const TIMEOUT_MS = 10000; // 10 seconds timeout for slow networks
  
  // Throttle: Return cached result if called too frequently
  const now = Date.now();
  if (now - lastReverseGeocodeTime < REVERSE_GEOCODE_THROTTLE && lastReverseGeocodeResult) {
    console.log('[LocationContext] Using cached reverse geocode result');
    return lastReverseGeocodeResult;
  }
  
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?` +
      `access_token=${MAPBOX_ACCESS_TOKEN}&` +
      `types=address,poi,locality,neighborhood,place`,
      { 
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return lastReverseGeocodeResult; // Return cached if no results
    }
    
    const feature = data.features[0];
    const context = feature.context || [];
    const locality = context.find(c => c.id?.startsWith('locality'))?.text || '';
    const place = context.find(c => c.id?.startsWith('place'))?.text || '';
    const region = context.find(c => c.id?.startsWith('region'))?.text || '';
    const postcode = context.find(c => c.id?.startsWith('postcode'))?.text || '';
    
    const shortParts = [locality || feature.text, place].filter(Boolean);
    
    const result = {
      addressLine1: feature.text || '',
      shortAddress: shortParts.slice(0, 2).join(', ') || 'Current Location',
      fullAddress: feature.place_name || '',
      city: place || locality || '',
      state: region || '',
      pincode: postcode || '',
    };
    
    // Cache the result
    lastReverseGeocodeTime = now;
    lastReverseGeocodeResult = result;
    
    return result;
  } catch (error) {
    // Retry on network failures
    if (retryCount < MAX_RETRIES && (error.name === 'AbortError' || error.message?.includes('Network'))) {
      console.log(`[LocationContext] Reverse geocode retry ${retryCount + 1}/${MAX_RETRIES}`);
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return reverseGeocode(latitude, longitude, retryCount + 1);
    }
    console.error('[LocationContext] Reverse geocode error:', error.message || error);
    return lastReverseGeocodeResult; // Return cached result on error
  }
};

/**
 * Location Context
 */
const LocationContext = createContext(null);

/**
 * Location Provider Component
 */
export const LocationProvider = ({ children }) => {
  const { dialog } = useDialog();

  // Location state
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState(null);
  const [locationPermission, setLocationPermission] = useState('unknown');
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [isEmulator, setIsEmulator] = useState(false);
  const [locationServicesEnabled, setLocationServicesEnabled] = useState(true);
  
  // Track if we've shown the GPS-off alert this session (don't spam)
  const gpsAlertShownRef = useRef(false);
  
  // Refs
  const locationIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastFetchTimeRef = useRef(0);
  // Mirror of currentLocation so fetchLocation can read it WITHOUT depending on
  // the state value (keeps fetchLocation/refreshLocation identities stable and
  // stops the context value from churning on every fix → fixes top-section flicker).
  const currentLocationRef = useRef(null);

  // Minimum movement (meters) before we publish a new coordinate. A stationary
  // provider stops emitting new object references every 30s, which is the main
  // driver of the dashboard top-section re-render flicker.
  const MIN_LOCATION_DELTA_M = 25;

  /**
   * Apply a GPS fix: update state ONLY when the position meaningfully changed
   * (moved > MIN_LOCATION_DELTA_M, or accuracy improved, or first fix). Always
   * keeps the shared socket cache fresh. Returns the location actually in effect.
   */
  const applyLocation = useCallback((coords) => {
    const { latitude, longitude, accuracy } = coords;
    // Always feed the shared cache (single GPS source for socketService).
    try { setLatestLocation({ latitude, longitude, accuracy }); } catch (e) { /* ignore */ }

    // Analytics: device location resolved — once per app session (GPS refreshes
    // continuously; only the first successful fix is a meaningful "selection").
    if (oncePerSession('location_gps')) {
      Analytics.track(EV.LOCATION_SELECTED, { source: 'gps' });
    }

    const prev = currentLocationRef.current;
    let changed = !prev;
    if (prev) {
      const dLat = (latitude - prev.latitude) * 111320;
      const dLng = (longitude - prev.longitude) * 111320 * Math.cos((latitude * Math.PI) / 180);
      const movedMeters = Math.sqrt(dLat * dLat + dLng * dLng);
      const accuracyImproved =
        typeof accuracy === 'number' && typeof prev.accuracy === 'number' && accuracy < prev.accuracy * 0.7;
      changed = movedMeters > MIN_LOCATION_DELTA_M || accuracyImproved;
    }

    if (!changed) return prev;
    const next = { latitude, longitude, accuracy };
    currentLocationRef.current = next;
    setCurrentLocation(next);
    return next;
  }, []);
  
  /**
   * Detect if running on emulator using react-native-device-info
   */
  useEffect(() => {
    const checkEmulator = async () => {
      try {
        const emulator = await DeviceInfo.isEmulator();
        setIsEmulator(emulator);
        console.log(`📱 [LocationContext] Device: ${emulator ? 'Emulator' : 'Physical'}`);
      } catch (error) {
        console.log('[LocationContext] Emulator check failed:', error);
        setIsEmulator(false);
      }
    };
    checkEmulator();
  }, []);
  
  /**
   * Check current permission status WITHOUT requesting (silent check)
   * Returns: 'granted' | 'denied' | 'blocked' | 'unknown'
   */
  const checkPermissionStatus = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        const result = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
          setLocationPermission('granted');
          return 'granted';
        } else if (result === RESULTS.BLOCKED) {
          setLocationPermission('blocked');
          return 'blocked';
        } else if (result === RESULTS.DENIED) {
          setLocationPermission('denied');
          return 'denied';
        }
        setLocationPermission('unknown');
        return 'unknown';
      }

      // Android: FINE first, then COARSE. On Android 12+/MIUI the dialog
      // offers "Precise / Approximate" — Approximate grants COARSE only.
      // Treating that as 'denied' produced "Enable location" while GPS was
      // ON (Issue 4 residual): a coarse fix is still a usable fix.
      const fine = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (fine) {
        setLocationPermission('granted');
        return 'granted';
      }
      const coarse = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );
      if (coarse) {
        setLocationPermission('granted');
        return 'granted';
      }
      setLocationPermission('denied');
      return 'denied';
    } catch (error) {
      console.warn('[LocationContext] Permission check error:', error.message);
      setLocationPermission('unknown');
      return 'unknown';
    }
  }, []);
  
  /**
   * Request location permission (only called when NOT already granted)
   * Production-grade: checks first, only prompts when necessary
   */
  const requestPermission = useCallback(async () => {
    // First, silently check current status
    const currentStatus = await checkPermissionStatus();
    
    // Already granted → no dialog needed
    if (currentStatus === 'granted') {
      console.log('📍 [LocationContext] Location permission already granted');
      return true;
    }
    
    // Blocked (user selected "Never ask again") → send to Settings
    if (currentStatus === 'blocked') {
      console.log('🔒 [LocationContext] Location permission blocked, directing to Settings');
      dialog(
        'Location Permission Required',
        'FixHomi needs location access to find nearby service providers. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            },
          },
        ],
        { cancelable: true }
      );
      return false;
    }

    // Not yet granted → request
    if (Platform.OS === 'ios') {
      const result = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
      if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
        setLocationPermission('granted');
        return true;
      }
      setLocationPermission(result === RESULTS.BLOCKED ? 'blocked' : 'denied');
      return false;
    }
    
    try {
      // Request BOTH accuracies: the "Approximate" choice on Android 12+/MIUI
      // grants COARSE only, and that must count as granted (see
      // checkPermissionStatus). FINE-only requests came back 'denied' for
      // every approximate-location user — permanent "Enable location".
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);
      const fine = results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const coarse = results[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];

      if (fine === PermissionsAndroid.RESULTS.GRANTED || coarse === PermissionsAndroid.RESULTS.GRANTED) {
        setLocationPermission('granted');
        return true;
      } else if (fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN && coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        setLocationPermission('blocked');
        return false;
      } else {
        setLocationPermission('denied');
        return false;
      }
    } catch (error) {
      console.error('[LocationContext] Permission request error:', error);
      setLocationPermission('denied');
      return false;
    }
  }, [checkPermissionStatus]);
  
  /**
   * Check if device location services (GPS) are enabled.
   * Shows user-friendly popup if GPS is turned off.
   */
  const checkLocationServices = useCallback(async () => {
    try {
      // First ask the OS for the actual location master switch — the
      // permission API below can't see it (the historical gap that made this
      // check "treat errors/BLOCKED as enabled" and never detect real GPS-off,
      // nor recovery once the user re-enabled it).
      try {
        const enabled = await DeviceInfo.isLocationEnabled();
        if (enabled === false) {
          setLocationServicesEnabled(false);
          return false;
        }
        setLocationServicesEnabled(true);
      } catch (e) {
        // Switch state unknown — fall through to the permission heuristics.
      }

      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      const result = await check(permission);
      
      if (result === RESULTS.UNAVAILABLE) {
        // Location services are not available on this device/OS
        setLocationServicesEnabled(false);
        return false;
      }
      
      // BLOCKED means user denied the permission permanently — but GPS hardware may still be on.
      // Don't conflate permission denial with GPS being off.
      if (result === RESULTS.BLOCKED) {
        // Permission blocked, but GPS hardware could still be enabled
        // Let locationServicesEnabled remain true (or its current state)
        return true;
      }
      
      return true;
    } catch (error) {
      console.warn('[LocationContext] Location services check failed:', error.message);
      return true; // Assume enabled if check fails
    }
  }, []);

  /**
   * Show GPS-off alert with "Enable" and "Cancel" options.
   * Only shows once per foreground session to avoid spamming.
   */
  const showGpsOffAlert = useCallback(() => {
    if (gpsAlertShownRef.current) return;
    gpsAlertShownRef.current = true;
    
    setLocationServicesEnabled(false);
    setLocationLoading(false);
    setLocationError('Location services are turned off');
    
    dialog(
      'Location is Turned Off',
      'Please enable location services to find nearby service providers and use FixHomi effectively.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable Location',
          onPress: () => {
            gpsAlertShownRef.current = false; // Allow re-showing after user goes to settings
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              // Open Android location settings directly
              Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
                Linking.openSettings();
              });
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, []);

  /**
   * Fetch current location - ULTRA FAST with 2-stage approach
   * Stage 1: Get ANY cached location instantly (maximumAge: 5 min)
   * Stage 2: Get accurate location in background
   * This is how Uber/Ola achieve instant location display
   */
  const fetchLocation = useCallback(async (forceRefresh = false, { silent = false } = {}) => {
    // Throttle: Don't fetch if last fetch was less than 3 seconds ago
    const now = Date.now();
    const existing = currentLocationRef.current;
    if (!forceRefresh && now - lastFetchTimeRef.current < 3000 && existing) {
      console.log('📍 [LocationContext] Using recently cached location');
      return existing;
    }
    
    // Check permission first — silently check, only request if needed
    const currentStatus = locationPermission === 'granted' ? 'granted' : await checkPermissionStatus();
    if (currentStatus !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        setLocationLoading(false);
        if (!existing) setLocationError('Location permission not granted');
        return null;
      }
    }
    
    // Only show the loading state for the FIRST acquisition or an explicit
    // (non-silent) refresh. Silent background refreshes (30s interval / app
    // foreground) must NOT toggle loading — otherwise every consumer re-renders
    // twice per tick, which is the dashboard top-section flicker.
    if (!silent || !existing) setLocationLoading(true);
    setLocationError(null);
    lastFetchTimeRef.current = now;
    
    return new Promise((resolve) => {
      let resolved = false;
      let hasReceivedLocation = false;
      
      // STAGE 1: Try to get ANY cached location INSTANTLY (even if old)
      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log(`⚡ [LocationContext] FAST cached location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy?.toFixed(0) || '?'}m)`);
          
          const newLocation = applyLocation({ latitude, longitude, accuracy });
          setLocationServicesEnabled(true); // GPS is working
          gpsAlertShownRef.current = false; // GPS confirmed working — allow future alerts if it goes off
          setLocationLoading(false);
          hasReceivedLocation = true;
          
          if (!resolved) {
            resolved = true;
            resolve(newLocation);
          }
          
          // Get address in background (don't block)
          reverseGeocode(latitude, longitude).then(address => {
            if (address) setLocationAddress(prev =>
              (prev && prev.shortAddress === address.shortAddress && prev.fullAddress === address.fullAddress)
                ? prev // identical address → keep identity, don't re-render every consumer each 30s tick
                : address);
          });
          
          // STAGE 2: If accuracy is poor (>100m), get better location in background
          if (accuracy > 100) {
            console.log('📍 [LocationContext] Improving accuracy in background...');
            Geolocation.getCurrentPosition(
              (betterPosition) => {
                const better = betterPosition.coords;
                if (better.accuracy < accuracy) {
                  console.log(`✅ [LocationContext] Improved: ${better.latitude.toFixed(6)}, ${better.longitude.toFixed(6)} (±${better.accuracy?.toFixed(0)}m)`);
                  applyLocation({ latitude: better.latitude, longitude: better.longitude, accuracy: better.accuracy });
                  reverseGeocode(better.latitude, better.longitude).then(addr => {
                    if (addr) setLocationAddress(prev =>
                      (prev && prev.shortAddress === addr.shortAddress && prev.fullAddress === addr.fullAddress)
                        ? prev : addr);
                  });
                }
              },
              () => {}, // Ignore errors in background refinement
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
          }
        },
        (error) => {
          // Fast path failed — this is NORMAL when there's no cached location.
          // ERROR CODE 2 = POSITION_UNAVAILABLE (GPS off OR temporary)
          // ERROR CODE 1 = PERMISSION_DENIED
          // ERROR CODE 3 = TIMEOUT (no cached location within 3s — cold GPS start)
          // NEVER show GPS-off alert here — always retry with watchPosition first.
          // The fast path is optimistic (3s, cached); only the watchPosition retry
          // (10s, high accuracy) can reliably determine if GPS is truly off.
          console.log(`⚠️ [LocationContext] Fast path failed (code ${error.code}): ${error.message || 'unknown'}. Retrying with fresh GPS...`);
          // No cached location - fall back to watchPosition
          const watchId = Geolocation.watchPosition(
            (position) => {
              if (resolved || hasReceivedLocation) {
                Geolocation.clearWatch(watchId);
                return;
              }
              
              const { latitude, longitude, accuracy } = position.coords;
              console.log(`📍 [LocationContext] Fresh location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy?.toFixed(0) || '?'}m)`);
              
              const newLocation = applyLocation({ latitude, longitude, accuracy });
              setLocationServicesEnabled(true); // GPS is working
              gpsAlertShownRef.current = false; // GPS confirmed working
              setLocationLoading(false);
              hasReceivedLocation = true;
              
              if (!resolved) {
                resolved = true;
                resolve(newLocation);
              }
              
              Geolocation.clearWatch(watchId);
              reverseGeocode(latitude, longitude).then(address => {
                if (address) setLocationAddress(prev =>
              (prev && prev.shortAddress === address.shortAddress && prev.fullAddress === address.fullAddress)
                ? prev // identical address → keep identity, don't re-render every consumer each 30s tick
                : address);
              });
            },
            (watchError) => {
              if (!resolved) {
                resolved = true;
                console.error('[LocationContext] Watch error:', watchError);
                if (watchError.code === 2) {
                  // Code 2 (POSITION_UNAVAILABLE) does NOT mean the GPS master
                  // switch is off — MIUI battery savers, indoor no-fix, and
                  // fused-provider hiccups all surface as code 2. Ask the OS
                  // for the real switch state and only claim "location off"
                  // when it actually is (the "Enable location while GPS is ON"
                  // report — ISSUE_INVESTIGATION_REPORT.md Issue 4 residual).
                  DeviceInfo.isLocationEnabled()
                    .then((enabled) => {
                      if (enabled === false) {
                        showGpsOffAlert();
                      } else {
                        setLocationLoading(false);
                        setLocationServicesEnabled(true);
                        if (!currentLocationRef.current) setLocationError('Waiting for GPS signal…');
                      }
                    })
                    .catch(() => {
                      // Can't determine the switch state — treat as transient,
                      // never claim GPS is off on a guess.
                      setLocationLoading(false);
                      if (!currentLocationRef.current) setLocationError(watchError.message || 'Failed to get location');
                    });
                } else {
                  setLocationLoading(false);
                  // Don't surface an error (or wipe the screen) if we already
                  // have a usable location — a transient watch error shouldn't
                  // make the UI claim "location unavailable".
                  if (!currentLocationRef.current) setLocationError(watchError.message || 'Failed to get location');
                }
                resolve(currentLocationRef.current || null);
              }
            },
            { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT, maximumAge: 0, distanceFilter: 0 }
          );
          
          // Safety timeout for watch
          setTimeout(() => {
            if (!resolved && !hasReceivedLocation) {
              resolved = true;
              Geolocation.clearWatch(watchId);
              setLocationLoading(false);
              if (currentLocationRef.current) {
                resolve(currentLocationRef.current);
              } else {
                setLocationError('Location timeout. Please check if location services are enabled.');
                resolve(null);
              }
            }
          }, LOCATION_TIMEOUT + 2000);
        },
        {
          enableHighAccuracy: false, // FALSE for SPEED - get any cached location
          timeout: LOCATION_TIMEOUT_FAST, // Short timeout
          maximumAge: LOCATION_MAX_AGE_FAST, // Accept 5-min old cache
        }
      );
      
      // Ultimate safety timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          setLocationLoading(false);
          if (currentLocationRef.current) {
            console.log('📍 [LocationContext] Using previous location as fallback');
            resolve(currentLocationRef.current);
          } else {
            setLocationError('Location timeout');
            resolve(null);
          }
        }
      }, LOCATION_TIMEOUT + 3000);
    });
  }, [locationPermission, requestPermission, applyLocation]);
  
  /**
   * Start periodic location updates
   */
  const startLocationUpdates = useCallback(() => {
    // Clear existing interval
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
    }
    
    // Update location every 30 seconds (SILENT — no loading toggle, no flicker)
    locationIntervalRef.current = setInterval(() => {
      // Only update if app is in foreground
      if (appStateRef.current === 'active') {
        fetchLocation(true, { silent: true });
      }
    }, LOCATION_UPDATE_INTERVAL);
    
    console.log('🔄 [LocationContext] Started 30-second location updates');
  }, [fetchLocation]);
  
  /**
   * Stop periodic location updates
   */
  const stopLocationUpdates = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
      console.log('⏹️ [LocationContext] Stopped location updates');
    }
  }, []);
  
  /**
   * Handle app state changes
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current !== 'active' && nextAppState === 'active') {
        // App came to foreground - refresh location
        // DON'T reset gpsAlertShownRef here — it's only reset when GPS
        // successfully returns a position (in fetchLocation success callbacks).
        // This prevents false "enable location" alerts on every foreground.
        console.log('📱 [LocationContext] App foregrounded - refreshing location');
        // Re-check permission + the OS location switch first: 'denied' and
        // 'disabled' used to be sticky for the whole session, so returning
        // from Settings after enabling location never recovered the UI.
        checkPermissionStatus();
        checkLocationServices();
        // Silent: we already have a location; don't flash the loading state.
        fetchLocation(true, { silent: true });
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [fetchLocation, checkPermissionStatus, checkLocationServices]);
  
  /**
   * Request notification permission (Android 13+ requires POST_NOTIFICATIONS)
   * Called once during app init — non-blocking, doesn't affect location flow
   */
  const requestNotificationPermissionOnce = useCallback(async () => {
    try {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        // Android 13+ (API 33) requires explicit POST_NOTIFICATIONS permission
        const notifStatus = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (!notifStatus) {
          console.log('🔔 [LocationContext] Requesting notification permission...');
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            {
              title: 'Notification Permission',
              message: 'FixHomi needs notifications to alert you about service requests, provider updates, and important messages.',
              buttonNegative: 'Deny',
              buttonPositive: 'Allow',
            }
          );
          console.log('🔔 [LocationContext] Notification permission:', result);
        } else {
          console.log('🔔 [LocationContext] Notification permission already granted');
        }
      }
      // Also ensure FCM messaging permission is set (works on both platforms)
      await requestNotificationPermission();
    } catch (err) {
      console.warn('⚠️ [LocationContext] Notification permission request failed:', err.message);
    }
  }, []);

  /**
   * Initialize location on mount
   * Production-grade flow:
   * 1. Small delay for Android Activity attachment
   * 2. Silently check location permission (no dialog if already granted)
   * 3. Request notification permission (non-blocking)
   * 4. Fetch location (will request permission only if not yet granted)
   * 5. Start periodic updates
   */
  useEffect(() => {
    const init = async () => {
      // Small delay to ensure Android Activity is fully attached
      // Prevents: "Tried to use permissions API while not attached to an Activity"
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 1: Silently check if location permission is already granted
      const status = await checkPermissionStatus();
      console.log('📍 [LocationContext] Initial permission status:', status);
      
      // Step 2: Request notification permission (non-blocking, parallel-safe)
      requestNotificationPermissionOnce();
      
      // Step 3: Fetch location — will prompt for permission only if needed
      await fetchLocation(true);
      
      // Step 4: Start periodic updates
      startLocationUpdates();
    };
    
    init();
    
    return () => {
      stopLocationUpdates();
    };
  }, []);
  
  /**
   * Open settings for location permission
   */
  const openLocationSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);
  
  /**
   * Manually refresh location
   */
  const refreshLocation = useCallback(async () => {
    return await fetchLocation(true);
  }, [fetchLocation]);
  
  // Memoize context value to prevent unnecessary re-renders of consumers
  const displayAddress = locationAddress?.shortAddress ||
    locationAddress?.city ||
    (currentLocation ? 'Location detected ✓' : 'Getting location...');

  /**
   * Explicit, UI-ready location status so screens never have to infer
   * "disabled" from a merely-missing coordinate. Precedence:
   *   available  → we have a coordinate (regardless of any background refresh)
   *   acquiring  → still trying for the first fix (or actively loading), not an error
   *   disabled   → device location services are OFF
   *   denied     → permission denied/blocked
   *   acquiring  → default fallback
   */
  const locationStatus =
    currentLocation ? 'available'
      : (locationServicesEnabled === false ? 'disabled'
        : (locationPermission === 'denied' || locationPermission === 'blocked') ? 'denied'
          : 'acquiring');

  const value = useMemo(() => ({
    currentLocation,
    locationAddress,
    locationLoading,
    locationError,
    locationPermission,
    locationServicesEnabled,
    locationStatus,
    isEmulator,
    refreshLocation,
    requestPermission,
    checkPermissionStatus,
    openLocationSettings,
    showGpsOffAlert,
    displayAddress,
  }), [
    currentLocation,
    locationAddress,
    locationLoading,
    locationError,
    locationPermission,
    locationServicesEnabled,
    locationStatus,
    isEmulator,
    refreshLocation,
    requestPermission,
    checkPermissionStatus,
    openLocationSettings,
    showGpsOffAlert,
    displayAddress,
  ]);
  
  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

/**
 * Hook to use location context
 */
export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export default LocationContext;
