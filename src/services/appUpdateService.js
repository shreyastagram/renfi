/**
 * App Update Service
 *
 * Checks app version against backend and manages update prompts.
 *
 * Industry-standard approach:
 * - Compares installed version (via react-native-device-info) against backend
 * - Force update: user MUST update, can only close the app
 * - Optional update: shown once per version, dismissed = never shown again for that version
 * - Auto-update setting: opens store page automatically when update detected
 *
 * Note: "Auto-update" on mobile doesn't mean the app updates itself.
 * Apps cannot self-update — the OS store handles that.
 * Our "auto-update" = automatically open store page on app launch when update available.
 *
 * @version 1.0.0
 */

import { Platform, Linking } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_CONFIG } from '../config/api';

// Storage keys
const STORAGE_KEYS = {
  DISMISSED_VERSION: '@app_update_dismissed_version',
  AUTO_UPDATE_ENABLED: '@app_update_auto_update',
};

/**
 * Check if app update is available
 * Called on every app launch from AppContext
 *
 * @returns {Object|null} Update info or null if no update needed
 *   { forceUpdate, isCritical, latestVersion, updateTitle, updateMessage, releaseNotes, storeUrl }
 */
export const checkForAppUpdate = async () => {
  try {
    const currentVersion = DeviceInfo.getVersion(); // e.g., "1.2.3"
    const platform = Platform.OS; // "android" or "ios"

    console.log(`[AppUpdate] Checking version: ${currentVersion} on ${platform}`);

    const response = await axios.get(
      `${API_CONFIG.BASE_URL}/api/admin/app-version/check`,
      {
        params: { currentVersion, platform },
        timeout: 10000,
      }
    );

    const data = response.data?.data;

    // Check maintenance mode first — takes priority over updates
    if (data?.maintenance?.enabled) {
      console.log('[AppUpdate] Maintenance mode active');
      return {
        maintenance: true,
        maintenanceTitle: data.maintenance.title,
        maintenanceMessage: data.maintenance.message,
        maintenanceNotes: data.maintenance.notes,
        maintenanceStartTime: data.maintenance.startTime,
        maintenanceEndTime: data.maintenance.endTime,
      };
    }

    if (!data || !data.updateRequired) {
      console.log('[AppUpdate] App is up to date');
      return null;
    }

    // Validate response shape — backend must return a valid latestVersion
    if (!data.latestVersion || typeof data.latestVersion !== 'string') {
      console.log('[AppUpdate] Invalid response from server, skipping');
      return null;
    }

    // Force update — always show, can't dismiss
    if (data.forceUpdate || data.isCritical) {
      console.log(`[AppUpdate] Force update required: ${currentVersion} → ${data.latestVersion}`);
      return {
        ...data,
        forceUpdate: true,
      };
    }

    // Optional update — check if already dismissed for this version
    const dismissedVersion = await AsyncStorage.getItem(STORAGE_KEYS.DISMISSED_VERSION);
    if (dismissedVersion === data.latestVersion) {
      console.log(`[AppUpdate] Update ${data.latestVersion} already dismissed by user`);
      return null;
    }

    // Check auto-update preference
    const autoUpdate = await getAutoUpdateEnabled();
    if (autoUpdate) {
      console.log('[AppUpdate] Auto-update enabled, will redirect to store');
      return {
        ...data,
        forceUpdate: false,
        autoRedirect: true,
      };
    }

    console.log(`[AppUpdate] Optional update available: ${currentVersion} → ${data.latestVersion}`);
    return {
      ...data,
      forceUpdate: false,
    };
  } catch (error) {
    // Never block the app on version check failure
    console.log('[AppUpdate] Version check failed (non-blocking):', error.message);
    return null;
  }
};

/**
 * Dismiss an optional update (won't show again for this version)
 */
export const dismissUpdate = async (version) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DISMISSED_VERSION, version);
    console.log(`[AppUpdate] Dismissed update for version ${version}`);
  } catch (error) {
    console.error('[AppUpdate] Failed to save dismissed version:', error);
  }
};

/**
 * Open the appropriate store page for the current platform
 */
export const openStorePage = async (storeUrl) => {
  try {
    const url = storeUrl || (Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/fixhomi/id6760935950'
      : 'https://play.google.com/store/apps/details?id=com.renfi');

    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  } catch (error) {
    console.error('[AppUpdate] Failed to open store:', error);
  }
};

/**
 * Get auto-update setting
 */
export const getAutoUpdateEnabled = async () => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_UPDATE_ENABLED);
    return value === 'true';
  } catch {
    return false;
  }
};

/**
 * Set auto-update setting
 */
export const setAutoUpdateEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_UPDATE_ENABLED, String(enabled));
    console.log(`[AppUpdate] Auto-update ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('[AppUpdate] Failed to save auto-update setting:', error);
  }
};

/**
 * Get the current installed app version
 */
export const getCurrentAppVersion = () => {
  return DeviceInfo.getVersion();
};
