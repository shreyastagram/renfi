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
import { check, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { requestForegroundLocationPermission } from '../utils/permissions';

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

  // Track if user declined the location disclosure in this session so we
  // don't re-prompt them on every app foregrounding or location fetch.
  // Cleared on successful grant or when user explicitly requests location.
  const permissionDeclinedThisSessionRef = useRef(false);
  
  // Refs
  const locationIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastFetchTimeRef = useRef(0);
  
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

      // Android: check fine location permission
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (granted) {
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
   * Request location permission (only called when NOT already granted).
   * Shows an in-app disclosure dialog before firing the OS permission prompt
   * — required by Google Play's Prominent Disclosure & Consent policy.
   */
  const requestPermission = useCallback(async () => {
    // First, silently check current status
    const currentStatus = await checkPermissionStatus();

    // Already granted → no dialog needed
    if (currentStatus === 'granted') {
      permissionDeclinedThisSessionRef.current = false;
      console.log('📍 [LocationContext] Location permission already granted');
      return true;
    }

    // If user declined earlier this session, skip re-prompting on background
    // triggers (app foreground, periodic fetch). Explicit user actions bypass
    // this via forceLocationPermission().
    if (permissionDeclinedThisSessionRef.current) {
      return false;
    }

    // Delegates to the prominent-disclosure helper. Copy is intentionally
    // ROLE-NEUTRAL because this code path can run before the user has
    // picked User vs Service Provider on UserTypeScreen (e.g. via an
    // AppState foreground event during cold launch). Status is re-synced
    // after the call via checkPermissionStatus().
    const granted = await requestForegroundLocationPermission(dialog, {
      title: 'Location Access',
      message:
        'Fixhomi uses your location to:\n' +
        '• As a User — find nearby service providers and auto-fill your service address\n' +
        '• As a Service Provider — match you with nearby service requests and show your position on the map\n\n' +
        'Service Providers will be asked separately for background access during an active service. Users do not need background access.\n\n' +
        'Your location is never used for advertising or profiling.',
    });

    if (!granted) permissionDeclinedThisSessionRef.current = true;
    else permissionDeclinedThisSessionRef.current = false;

    // Refresh cached status based on the new OS-level state
    await checkPermissionStatus();
    return granted;
  }, [checkPermissionStatus, dialog]);

  /**
   * Explicit user-initiated permission request (e.g., user taps a "Use Current
   * Location" button). Resets the session-declined flag so the disclosure
   * dialog will be shown again even if the user previously said "Not Now".
   */
  const forceLocationPermission = useCallback(async () => {
    permissionDeclinedThisSessionRef.current = false;
    return await requestPermission();
  }, [requestPermission]);
  
  /**
   * Check if device location services (GPS) are enabled.
   * Shows user-friendly popup if GPS is turned off.
   */
  const checkLocationServices = useCallback(async () => {
    try {
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
  const fetchLocation = useCallback(async (forceRefresh = false) => {
    // Throttle: Don't fetch if last fetch was less than 3 seconds ago
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTimeRef.current < 3000 && currentLocation) {
      console.log('📍 [LocationContext] Using recently cached location');
      return currentLocation;
    }
    
    // Check permission first — silently check, only request if needed
    const currentStatus = locationPermission === 'granted' ? 'granted' : await checkPermissionStatus();
    if (currentStatus !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        setLocationLoading(false);
        setLocationError('Location permission not granted');
        return null;
      }
    }
    
    setLocationLoading(true);
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
          
          const newLocation = { latitude, longitude, accuracy };
          setCurrentLocation(newLocation);
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
            if (address) setLocationAddress(address);
          });
          
          // STAGE 2: If accuracy is poor (>100m), get better location in background
          if (accuracy > 100) {
            console.log('📍 [LocationContext] Improving accuracy in background...');
            Geolocation.getCurrentPosition(
              (betterPosition) => {
                const better = betterPosition.coords;
                if (better.accuracy < accuracy) {
                  console.log(`✅ [LocationContext] Improved: ${better.latitude.toFixed(6)}, ${better.longitude.toFixed(6)} (±${better.accuracy?.toFixed(0)}m)`);
                  setCurrentLocation({ latitude: better.latitude, longitude: better.longitude, accuracy: better.accuracy });
                  reverseGeocode(better.latitude, better.longitude).then(addr => {
                    if (addr) setLocationAddress(addr);
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
              
              const newLocation = { latitude, longitude, accuracy };
              setCurrentLocation(newLocation);
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
                if (address) setLocationAddress(address);
              });
            },
            (watchError) => {
              if (!resolved) {
                resolved = true;
                console.error('[LocationContext] Watch error:', watchError);
                // Check if this is GPS-off error
                if (watchError.code === 2) {
                  showGpsOffAlert();
                } else {
                  setLocationError(watchError.message || 'Failed to get location');
                  setLocationLoading(false);
                }
                resolve(null);
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
              setLocationError('Location timeout. Please check if location services are enabled.');
              resolve(null);
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
          if (currentLocation) {
            console.log('📍 [LocationContext] Using previous location as fallback');
            resolve(currentLocation);
          } else {
            setLocationError('Location timeout');
            resolve(null);
          }
        }
      }, LOCATION_TIMEOUT + 3000);
    });
  }, [locationPermission, currentLocation, requestPermission]);
  
  /**
   * Start periodic location updates
   */
  const startLocationUpdates = useCallback(() => {
    // Clear existing interval
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
    }
    
    // Update location every 30 seconds
    locationIntervalRef.current = setInterval(() => {
      // Only update if app is in foreground
      if (appStateRef.current === 'active') {
        fetchLocation(true);
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
        // App came to foreground. Only refresh location if permission was
        // already granted — never show a permission dialog in response to a
        // foreground event. Prompts must only come from user-initiated
        // actions (UserTypeScreen first-launch flow, banner taps, etc.).
        if (locationPermission === 'granted') {
          console.log('📱 [LocationContext] App foregrounded — refreshing location');
          fetchLocation(true);
        } else {
          // Silent re-check in case user granted via Settings while away
          checkPermissionStatus();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [fetchLocation, locationPermission, checkPermissionStatus]);
  
  // Init: silent permission check only. Permission prompts are owned by the
  // first screen the user sees (UserTypeScreen for unauthenticated users) so
  // the copy can be role-aware and the prompts aren't shown before any UI is
  // visible. A separate reactive effect below starts/stops the location
  // fetch + periodic updates whenever the permission state becomes granted.
  useEffect(() => {
    const init = async () => {
      // Small delay to ensure Android Activity is fully attached
      // Prevents: "Tried to use permissions API while not attached to an Activity"
      await new Promise(resolve => setTimeout(resolve, 500));
      const status = await checkPermissionStatus();
      console.log('📍 [LocationContext] Initial permission status:', status);
    };
    init();
    return () => {
      stopLocationUpdates();
    };
  }, []);

  // Reactive: whenever permission becomes granted (first-time grant via
  // UserType, or later via a banner/settings), fetch the current location
  // and start periodic updates. If permission is revoked, stop updates.
  useEffect(() => {
    if (locationPermission === 'granted') {
      fetchLocation(true);
      startLocationUpdates();
    } else {
      stopLocationUpdates();
    }
  }, [locationPermission]);
  
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

  const value = useMemo(() => ({
    currentLocation,
    locationAddress,
    locationLoading,
    locationError,
    locationPermission,
    locationServicesEnabled,
    isEmulator,
    refreshLocation,
    requestPermission,
    forceLocationPermission,
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
    isEmulator,
    refreshLocation,
    requestPermission,
    forceLocationPermission,
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
