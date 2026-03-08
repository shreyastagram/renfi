/**
 * Notification Sound Utility
 *
 * Uses @notifee/react-native (already installed) to play notification sounds
 * when in-app banners or service request events occur.
 *
 * Respects the user's "Notification Sound" preference from AsyncStorage.
 */

import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHANNEL_ID = 'fixhomi_sound_alerts';
let channelCreated = false;

/**
 * Ensure the Android notification channel exists
 */
async function ensureChannel() {
  if (channelCreated) return;
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Fixhomi Sound Alerts',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });
    channelCreated = true;
  } catch (e) {
    console.log('[NotifSound] Channel creation failed:', e.message);
  }
}

/**
 * Check if notification sound is enabled in user preferences
 */
async function isSoundEnabled() {
  try {
    const raw = await AsyncStorage.getItem('app_preferences');
    if (!raw) return true; // default enabled
    const prefs = JSON.parse(raw);
    return prefs.notificationSound !== false;
  } catch {
    return true;
  }
}

/**
 * Play a notification sound using Notifee local notification.
 * Only plays if user has "Notification Sound" enabled.
 *
 * @param {Object} options
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {boolean} options.force - Skip preference check (e.g. when toggling setting ON)
 */
export async function playNotificationSound({ title = 'Fixhomi', body = '', force = false } = {}) {
  try {
    if (!force) {
      const enabled = await isSoundEnabled();
      if (!enabled) return;
    }

    // Request notification permission on Android 13+
    if (Platform.OS === 'android') {
      const settings = await notifee.getNotificationSettings();
      if (settings.android?.alarm !== 1) {
        // Try requesting permission
        await notifee.requestPermission();
      }
    }

    await ensureChannel();

    // Display a transient local notification to trigger the system sound
    // Use ic_launcher (always exists) instead of ic_notification (may not exist)
    const notificationId = await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_launcher',
        sound: 'default',
        importance: AndroidImportance.HIGH,
        autoCancel: true,
        timeoutAfter: 5000,
      },
      ios: {
        sound: 'default',
      },
    });

    console.log('[NotifSound] Notification displayed:', notificationId);

    // Cancel the notification after 3 seconds (banner handles the UI)
    setTimeout(() => {
      notifee.cancelNotification(notificationId).catch(() => {});
    }, 3000);
  } catch (error) {
    console.log('[NotifSound] Failed to play sound:', error.message);
  }
}
