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

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid, Alert, Linking, AppState } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import DeviceInfo from 'react-native-device-info';

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
  // Location state
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState(null);
  const [locationPermission, setLocationPermission] = useState('unknown');
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [isEmulator, setIsEmulator] = useState(false);
  
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
   * Request location permission
   */
  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'ios') {
      // iOS - permissions handled through Info.plist
      setLocationPermission('granted');
      return true;
    }
    
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'FixHomi needs location access to find nearby service providers.',
          buttonNeutral: 'Ask Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        }
      );
      
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setLocationPermission('granted');
        return true;
      } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        setLocationPermission('blocked');
        return false;
      } else {
        setLocationPermission('denied');
        return false;
      }
    } catch (error) {
      console.error('[LocationContext] Permission error:', error);
      setLocationPermission('denied');
      return false;
    }
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
    
    // Check permission first
    if (locationPermission !== 'granted') {
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
          console.log('⚠️ [LocationContext] No cached location, trying fresh GPS...');
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
                setLocationError(watchError.message || 'Failed to get location');
                setLocationLoading(false);
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
              setLocationError('Location timeout');
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
        // App came to foreground - refresh location
        console.log('📱 [LocationContext] App foregrounded - refreshing location');
        fetchLocation(true);
      }
      appStateRef.current = nextAppState;
    });
    
    return () => {
      subscription?.remove();
    };
  }, [fetchLocation]);
  
  /**
   * Initialize location on mount
   */
  useEffect(() => {
    const init = async () => {
      // Fetch location immediately
      await fetchLocation(true);
      
      // Start periodic updates
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
  
  // Context value
  const value = {
    // Location data
    currentLocation,
    locationAddress,
    
    // Status
    locationLoading,
    locationError,
    locationPermission,
    isEmulator,
    
    // Actions
    refreshLocation,
    requestPermission,
    openLocationSettings,
    
    // Formatted display
    displayAddress: locationAddress?.shortAddress || 
      (currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : 'Getting location...'),
  };
  
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
