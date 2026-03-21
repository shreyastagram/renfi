/**
 * FCM Service (Push Notifications)
 * 
 * Firebase Cloud Messaging integration for push notifications.
 * Uses @react-native-firebase/messaging v22+ modular API
 * 
 * @version 3.0.0
 */

import {
  getMessaging,
  getToken,
  hasPermission,
  requestPermission,
  onTokenRefresh,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance } from '@notifee/react-native';
import apiClient from './apiClient';

const FCM_TOKEN_KEY = '@fixhomi_fcm_token';

// Create the default notification channel on Android
// Must match the channelId sent by the backend ('fixhomi_notifications')
if (Platform.OS === 'android') {
  notifee.createChannel({
    id: 'fixhomi_notifications',
    name: 'Fixhomi Notifications',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  }).catch(() => {});
}

// Get messaging instance using modular API
const getMessagingInstance = () => {
  try {
    const app = getApp();
    return getMessaging(app);
  } catch (error) {
    console.log('ℹ️ Firebase app not initialized:', error.message);
    return null;
  }
};

/**
 * Request notification permission from user
 * @returns {Promise<boolean>} - Whether permission was granted
 */
export async function requestNotificationPermission() {
  try {
    const messaging = getMessagingInstance();
    if (!messaging) return false;
    
    const authStatus = await requestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('✅ Notification permission granted:', authStatus);
    } else {
      console.log('❌ Notification permission denied');
    }

    return enabled;
  } catch (error) {
    console.log('ℹ️ Notification permission request failed:', error.message);
    return false;
  }
}

/**
 * Get FCM device token
 * @returns {Promise<string|null>} - FCM token or null
 */
export async function getFcmToken() {
  try {
    const messaging = getMessagingInstance();
    if (!messaging) {
      console.log('ℹ️ FCM messaging not available (development/simulator)');
      return null;
    }
    
    // Check if permission is granted first
    const permissionStatus = await hasPermission(messaging);
    if (permissionStatus !== AuthorizationStatus.AUTHORIZED &&
        permissionStatus !== AuthorizationStatus.PROVISIONAL) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        console.log('ℹ️ Notification permission not granted - FCM disabled');
        return null;
      }
    }

    const token = await getToken(messaging);
    if (token) {
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
      console.log('✅ FCM Token retrieved');
    }
    return token;
  } catch (error) {
    // Silently handle FCM errors - not critical for app functionality
    if (__DEV__) {
      console.log('ℹ️ FCM token unavailable:', error.message);
    }
    return null;
  }
}

/**
 * Get stored FCM token (without fetching new one)
 */
export async function getStoredFcmToken() {
  try {
    return await AsyncStorage.getItem(FCM_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Save FCM token to backend for user
 * @param {string} userId - User's MongoDB ID
 * @param {string} authToken - JWT access token
 */
export async function saveFcmTokenForUser(userId, authToken) {
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 3000;

  try {
    const fcmToken = await getFcmToken();
    if (!fcmToken) {
      console.log('ℹ️ [FCM] No FCM token available to save');
      return { success: false, error: 'No FCM token' };
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await apiClient.patch(
          `/api/user/${userId}/fcm-token`,
          { fcmToken },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        console.log('✅ FCM token saved for user');
        return { success: true };
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          console.log(`ℹ️ [FCM] Save attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY / 1000}s...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY));
        } else {
          throw err;
        }
      }
    }
  } catch (error) {
    // Non-critical — log concisely without full stack trace
    console.log('ℹ️ [FCM] Could not save user FCM token:', error.message || 'Network Error');
    return { success: false, error: error.message };
  }
}

/**
 * Save FCM token to backend for provider
 * @param {string} providerId - Provider's MongoDB ID
 * @param {string} authToken - JWT access token
 */
export async function saveFcmTokenForProvider(providerId, authToken) {
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 3000;

  try {
    const fcmToken = await getFcmToken();
    if (!fcmToken) {
      console.log('ℹ️ [FCM] No FCM token available to save');
      return { success: false, error: 'No FCM token' };
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await apiClient.patch(
          `/api/provider/${providerId}/fcm-token`,
          { fcmToken },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        console.log('✅ FCM token saved for provider');
        return { success: true };
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          console.log(`ℹ️ [FCM] Save attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY / 1000}s...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY));
        } else {
          throw err;
        }
      }
    }
  } catch (error) {
    // Non-critical — log concisely without full stack trace
    console.log('ℹ️ [FCM] Could not save provider FCM token:', error.message || 'Network Error');
    return { success: false, error: error.message };
  }
}

/**
 * Set up token refresh listener
 * Call this to automatically update token when it changes
 * @param {Function} onRefreshCallback - Callback with new token
 * @returns {Function} - Unsubscribe function
 */
export function setupTokenRefreshListener(onRefreshCallback) {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};
  
  return onTokenRefresh(messaging, async (newToken) => {
    console.log('🔄 FCM token refreshed');
    await AsyncStorage.setItem(FCM_TOKEN_KEY, newToken);
    if (onRefreshCallback) {
      onRefreshCallback(newToken);
    }
  });
}

/**
 * Set up foreground message listener
 * Called when app receives notification while in foreground
 * @param {Function} onMessageCallback - Callback with remote message
 * @returns {Function} - Unsubscribe function
 */
export function setupForegroundMessageListener(onMessageCallback) {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};
  
  return onMessage(messaging, async (remoteMessage) => {
    console.log('📩 Foreground notification:', remoteMessage.notification?.title);
    if (onMessageCallback) {
      onMessageCallback(remoteMessage);
    }
  });
}

/**
 * Set up background message handler
 * Must be called outside of React component (e.g., in index.js)
 * Note: setBackgroundMessageHandler still uses legacy API as it must be called at module level
 * @param {Function} handler - Async handler function
 */
export function setupBackgroundMessageHandler(handler) {
  // Background handler still needs legacy import as it runs before app init
  // This is the only exception for modular migration
  const legacyMessaging = require('@react-native-firebase/messaging').default;
  legacyMessaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('📩 Background notification:', remoteMessage.notification?.title);
    if (handler) {
      await handler(remoteMessage);
    }
  });
}

/**
 * Get initial notification that opened the app
 * @returns {Promise<Object|null>}
 */
export async function getAppInitialNotification() {
  const messaging = getMessagingInstance();
  if (!messaging) return null;
  
  const remoteMessage = await getInitialNotification(messaging);
  if (remoteMessage) {
    console.log('📩 App opened from notification:', remoteMessage.notification?.title);
  }
  return remoteMessage;
}

/**
 * Handle notification open (when user taps notification while app is in background)
 * @param {Function} onNotificationOpened - Callback with remote message
 * @returns {Function} - Unsubscribe function
 */
export function setupNotificationOpenedHandler(onNotificationOpened) {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};
  
  return onNotificationOpenedApp(messaging, (remoteMessage) => {
    console.log('📩 Notification opened:', remoteMessage.notification?.title);
    if (onNotificationOpened) {
      onNotificationOpened(remoteMessage);
    }
  });
}

/**
 * Delete FCM token (useful for logout)
 */
export async function deleteFcmToken() {
  try {
    const messaging = getMessagingInstance();
    if (!messaging) return { success: false, error: 'Messaging not available' };

    // Use legacy API for deleteToken as modular doesn't export it yet
    const legacyMessaging = require('@react-native-firebase/messaging').default;
    try {
      await legacyMessaging().deleteToken();
    } catch (deleteError) {
      // iOS: "Failed to checkin before token registration" happens when the
      // FCM/APNs checkin hasn't completed (common during logout).
      // Safe to ignore — clearing the local token is sufficient; FCM will
      // issue a fresh token on next login.
      if (Platform.OS === 'ios' && deleteError.code === 'messaging/unknown') {
        console.log('iOS FCM deleteToken checkin not ready — clearing local token only');
      } else {
        throw deleteError;
      }
    }
    await AsyncStorage.removeItem(FCM_TOKEN_KEY);
    console.log('✅ FCM token deleted');
    return { success: true };
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    // Always clear local token even if server-side delete fails
    await AsyncStorage.removeItem(FCM_TOKEN_KEY).catch(() => {});
    return { success: false, error: error.message };
  }
}

/**
 * Check if device has APNs token (iOS only)
 */
export async function getAPNsToken() {
  try {
    // Use legacy API for getAPNSToken
    const legacyMessaging = require('@react-native-firebase/messaging').default;
    const token = await legacyMessaging().getAPNSToken();
    return token;
  } catch (error) {
    console.error('Error getting APNs token:', error);
    return null;
  }
}

/**
 * Subscribe to a topic
 * @param {string} topic - Topic name
 */
export async function subscribeToTopic(topic) {
  try {
    await messaging().subscribeToTopic(topic);
    console.log(`✅ Subscribed to topic: ${topic}`);
    return { success: true };
  } catch (error) {
    console.error(`Error subscribing to topic ${topic}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Unsubscribe from a topic
 * @param {string} topic - Topic name
 */
export async function unsubscribeFromTopic(topic) {
  try {
    await messaging().unsubscribeFromTopic(topic);
    console.log(`✅ Unsubscribed from topic: ${topic}`);
    return { success: true };
  } catch (error) {
    console.error(`Error unsubscribing from topic ${topic}:`, error);
    return { success: false, error: error.message };
  }
}
