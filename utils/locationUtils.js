// Location utility functions for proximity-based provider matching
import Geolocation from '@react-native-community/geolocation';
import { LocationPermissions } from './locationPermissions';

// Haversine formula for calculating distance between coordinates
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Get current GPS location with enhanced error handling for React Native
export async function getCurrentLocation() {
  try {
    // First, ensure we have location permissions
    const hasPermission = await LocationPermissions.ensureLocationPermission();
    
    if (!hasPermission) {
      throw new Error('Location permission denied. Please enable location access in settings.');
    }

    // Now get the location
    return new Promise((resolve, reject) => {
      // Configure location request with high accuracy
      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000 // 1 minute
      };

      console.log('📍 Requesting GPS location...');

      Geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          
          console.log('📍 Raw GPS coordinates:', {
            lat: location.latitude,
            lng: location.longitude,
            accuracy: `${Math.round(location.accuracy)}m`
          });
          
          // Validate coordinates
          if (!isValidLocation(location.latitude, location.longitude)) {
            reject(new Error('Invalid GPS coordinates received'));
            return;
          }
          
          // Check accuracy (warn if > 100m)
          if (location.accuracy > 100) {
            console.warn(`⚠️ Location accuracy is low: ${Math.round(location.accuracy)}m`);
          }
          
          resolve(location);
        },
        (error) => {
          console.error('🚫 Geolocation error:', error);
          let errorMessage = 'Unable to get your location';
          
          switch (error.code) {
            case 1: // PERMISSION_DENIED
              errorMessage = 'Location access denied. Please enable location permissions in your device settings.';
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage = 'Location information is unavailable. Please check your GPS and internet connection.';
              break;
            case 3: // TIMEOUT
              errorMessage = 'Location request timed out. Please try again.';
              break;
            default:
              errorMessage = `Location error: ${error.message || 'Unknown error'}`;
          }
          
          reject(new Error(errorMessage));
        },
        options
      );
    });
  } catch (error) {
    console.error('🚫 Permission error:', error);
    throw error;
  }
}

// Enhanced location validation with detailed checks
export function validateLocationData(locationData) {
  const errors = [];
  
  if (!locationData) {
    errors.push('Location data is missing');
    return { isValid: false, errors };
  }
  
  if (typeof locationData.latitude !== 'number') {
    errors.push('Latitude must be a number');
  } else if (!isValidLocation(locationData.latitude, locationData.longitude)) {
    errors.push('Invalid latitude/longitude values');
  }
  
  if (typeof locationData.longitude !== 'number') {
    errors.push('Longitude must be a number');
  }
  
  // Check for realistic accuracy values
  if (locationData.accuracy && locationData.accuracy > 1000) {
    errors.push('Location accuracy is too low (>1km)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: locationData.accuracy > 100 ? ['Low GPS accuracy'] : []
  };
}

// Check if two locations are within 1km (for validation)
export function areLocationsNearby(location1, location2, maxDistanceKm = 1) {
  if (!location1 || !location2) return false;
  
  const distance = calculateDistance(
    location1.latitude, location1.longitude,
    location2.latitude, location2.longitude
  );
  
  return distance <= maxDistanceKm;
}

// Convert location to readable address (requires reverse geocoding API)
export function formatLocation(latitude, longitude) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

// Validate location coordinates
export function isValidLocation(latitude, longitude) {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  );
}

// Format distance for display
export function formatDistance(distance) {
  if (distance === null || distance === undefined) {
    return 'Unknown distance';
  }
  
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m away`;
  } else {
    return `${distance}km away`;
  }
}

// Location configuration constants - Updated for 1km proximity matching
export const LOCATION_CONFIG = {
  DEFAULT_RADIUS_KM: 1,      // Initial search radius: 1km for hyper-local service
  MAX_RADIUS_KM: 5,          // Maximum search radius: 5km (reduced from 50km)
  RADIUS_INCREMENT_KM: 1,    // Expansion step: 1km at a time
  LOCATION_TIMEOUT: 10000,
  HIGH_ACCURACY: true
};