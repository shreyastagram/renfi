/**
 * Distance Formatting Utility
 *
 * Formats distance values based on user preference (km or meters).
 * Reads the preference from AsyncStorage synchronously via a cached value,
 * and provides a hook for React components.
 */

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Format a distance value in km to the user's preferred unit.
 *
 * @param {number} distanceKm - Distance in kilometers
 * @param {boolean} useKm - true for km display, false for meters
 * @returns {string} Formatted distance string (e.g., "2.5 km" or "2500 m")
 */
export function formatDistance(distanceKm, useKm = true) {
  if (distanceKm == null || isNaN(distanceKm)) return '--';

  if (useKm) {
    if (distanceKm < 0.1) {
      // Very short distances show in meters even in km mode
      return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
  }

  // Meters mode
  const meters = Math.round(distanceKm * 1000);
  if (meters >= 10000) {
    // Large distances still show km for readability
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}

/**
 * Format a distance that's already in meters.
 *
 * @param {number} distanceMeters - Distance in meters
 * @param {boolean} useKm - true for km display, false for meters
 * @returns {string} Formatted distance string
 */
export function formatDistanceFromMeters(distanceMeters, useKm = true) {
  if (distanceMeters == null || isNaN(distanceMeters)) return '--';
  return formatDistance(distanceMeters / 1000, useKm);
}

/**
 * React hook that provides the current distance unit preference.
 *
 * @returns {boolean} true if user prefers km, false for meters
 */
export function useDistanceUnit() {
  const [useKm, setUseKm] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('app_preferences').then(raw => {
      if (raw) {
        try {
          const prefs = JSON.parse(raw);
          if (typeof prefs.distanceInKm === 'boolean') {
            setUseKm(prefs.distanceInKm);
          }
        } catch {}
      }
    });
  }, []);

  return useKm;
}
