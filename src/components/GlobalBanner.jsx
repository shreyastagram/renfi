/**
 * GlobalBanner Component
 * 
 * A centralized, app-wide notification banner (Uber/Ola style)
 * that displays FCM foreground notifications on ANY screen for
 * both user and provider roles.
 * 
 * Handles all notification types:
 * - NEW_JOB_REQUEST (provider)
 * - REQUEST_ACCEPTED (user)
 * - REQUEST_REJECTED (user)
 * - REQUEST_CANCELLED (user/provider)
 * - REQUEST_COMPLETED (user)
 * - PROVIDER_ARRIVED (user)
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
  Linking,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../components';
import { useApp } from '../context/AppContext';
import { setupForegroundMessageListener } from '../services/fcmService';
import { addEventListener } from '../services/socketService';
import { playNotificationSound } from '../utils/notificationSound';

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  white: '#FFFFFF',
};

// Banner type configuration
const BANNER_CONFIG = {
  new_request: {
    bgColor: '#1a1a2e',
    iconColor: BRAND.primary,
    iconName: 'inbox',
    autoDismissMs: 30000,
  },
  accepted: {
    bgColor: '#0d3320',
    iconColor: '#10B981',
    iconName: 'check_circle',
    autoDismissMs: 8000,
  },
  rejected: {
    bgColor: '#3d0d0d',
    iconColor: '#EF4444',
    iconName: 'cancelled',
    autoDismissMs: 8000,
  },
  cancelled: {
    bgColor: '#2d1a0d',
    iconColor: '#F59E0B',
    iconName: 'cancelled',
    autoDismissMs: 8000,
  },
  completed: {
    bgColor: '#0d2a3d',
    iconColor: '#3B82F6',
    iconName: 'check_circle',
    autoDismissMs: 8000,
  },
  arrived: {
    bgColor: '#0d3320',
    iconColor: '#10B981',
    iconName: 'location',
    autoDismissMs: 8000,
  },
};

/**
 * GlobalBanner — mounts once at app level, listens to FCM foreground
 * messages and renders an overlay banner on any screen.
 */
const GlobalBanner = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { userType } = useApp();

  const [bannerData, setBannerData] = useState(null);
  const bannerAnim = useRef(new Animated.Value(-300)).current;
  const bannerTimer = useRef(null);
  // Dedup: prevent showing same notification from both FCM and Socket
  const lastBannerRef = useRef({ key: '', ts: 0 });

  const isProvider = userType === 'provider';

  /**
   * Check if push notifications are enabled in user preferences
   */
  const isPushEnabledRef = useRef(true);

  useEffect(() => {
    const loadPushPref = async () => {
      try {
        const saved = await AsyncStorage.getItem('notification_preferences');
        if (saved) {
          const parsed = JSON.parse(saved);
          isPushEnabledRef.current = parsed.pushEnabled !== false;
        }
      } catch (e) {
        // Default to enabled
      }
    };
    loadPushPref();
    // Re-check when component re-renders (userType change etc.)
    const interval = setInterval(loadPushPref, 5000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Show the banner with slide-in animation
   */
  const showBanner = useCallback((data) => {
    // Respect user's push notification preference
    if (!isPushEnabledRef.current) {
      console.log('[GlobalBanner] Push notifications disabled — suppressing banner');
      return;
    }

    // Vibrate to alert
    Vibration.vibrate([0, 400, 200, 400]);

    // Play notification sound (respects user preference)
    playNotificationSound({
      title: data.title || 'Fixhomi',
      body: data.body || '',
    });

    setBannerData(data);

    // Slide in
    Animated.spring(bannerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();

    // Auto-dismiss
    const config = BANNER_CONFIG[data.bannerType] || BANNER_CONFIG.new_request;
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => {
      dismissBanner();
    }, config.autoDismissMs);
  }, [bannerAnim]);

  /**
   * Dismiss the banner with slide-out animation
   */
  const dismissBanner = useCallback(() => {
    Animated.timing(bannerAnim, {
      toValue: -300,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setBannerData(null);
    });
    if (bannerTimer.current) {
      clearTimeout(bannerTimer.current);
      bannerTimer.current = null;
    }
  }, [bannerAnim]);

  /**
   * Show banner with deduplication — prevents showing the same event
   * from both FCM and Socket within 3 seconds
   */
  const showBannerDeduped = useCallback((data) => {
    const dedupKey = `${data.requestId || data.serviceRequestId || ''}_${data.bannerType}`;
    const now = Date.now();
    if (dedupKey && dedupKey === lastBannerRef.current.key && now - lastBannerRef.current.ts < 3000) {
      console.log('[GlobalBanner] Dedup: skipping duplicate banner', dedupKey);
      return;
    }
    lastBannerRef.current = { key: dedupKey, ts: now };
    showBanner(data);
  }, [showBanner]);

  /**
   * FCM Foreground Listener — single, global listener
   */
  useEffect(() => {
    const unsubscribe = setupForegroundMessageListener((remoteMessage) => {
      const msgType = remoteMessage?.data?.type;
      const data = remoteMessage?.data || {};
      console.log('[GlobalBanner] FCM foreground:', msgType, data);

      // ---- Provider-facing notifications ----
      if (msgType === 'new_request' || msgType === 'NEW_SERVICE_REQUEST' || msgType === 'NEW_JOB_REQUEST') {
        showBannerDeduped({
          ...data,
          title: remoteMessage?.notification?.title || '🔔 New Service Request!',
          body: remoteMessage?.notification?.body || 'You have a new service request!',
          bannerType: 'new_request',
        });
      }
      // ---- User-facing notifications ----
      else if (msgType === 'REQUEST_ACCEPTED' || msgType === 'PROVIDER_ACCEPTED' || msgType === 'request_accepted' || msgType === 'BOOKING_ACCEPTED') {
        showBannerDeduped({
          ...data,
          title: remoteMessage?.notification?.title || '✅ Request Accepted!',
          body: remoteMessage?.notification?.body || 'A provider has accepted your request!',
          bannerType: 'accepted',
        });
      }
      else if (msgType === 'REQUEST_REJECTED' || msgType === 'BOOKING_REJECTED' || msgType === 'EMERGENCY_REJECTED' || msgType === 'PROVIDER_REJECTED') {
        showBannerDeduped({
          ...data,
          title: remoteMessage?.notification?.title || '❌ Request Rejected',
          body: remoteMessage?.notification?.body || 'The provider has declined your request.',
          bannerType: 'rejected',
        });
      }
      else if (msgType === 'REQUEST_CANCELLED' || msgType === 'BOOKING_CANCELLED') {
        showBannerDeduped({
          ...data,
          title: '⚠️ Request Cancelled',
          body: remoteMessage?.notification?.body || (isProvider
            ? 'A customer has cancelled their request.'
            : 'Your request has been cancelled.'),
          bannerType: 'cancelled',
        });
      }
      else if (msgType === 'REQUEST_COMPLETED' || msgType === 'SERVICE_COMPLETED' || msgType === 'request_completed') {
        showBannerDeduped({
          ...data,
          title: '🎉 Service Completed!',
          body: remoteMessage?.notification?.body || 'The service has been completed.',
          bannerType: 'completed',
        });
      }
      else if (msgType === 'PROVIDER_ARRIVED' || msgType === 'provider_arrived') {
        showBannerDeduped({
          ...data,
          title: '📍 Provider Arrived',
          body: remoteMessage?.notification?.body || 'Your provider has arrived at the location.',
          bannerType: 'arrived',
        });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [isProvider, showBannerDeduped]);

  /**
   * Socket Event Listeners — real-time events via Socket.IO
   * These fire instantly (before FCM push arrives), giving true
   * real-time banners on any screen. Dedup prevents double-showing
   * when FCM arrives 1-2s later.
   */
  useEffect(() => {
    // new:request — provider receives a new service request
    const removeNewRequest = addEventListener('new:request', (data) => {
      console.log('[GlobalBanner] Socket: new:request', data);
      showBannerDeduped({
        ...data,
        title: '🔔 New Service Request!',
        body: `New ${data.serviceType || 'service'} request received`,
        bannerType: 'new_request',
      });
    });

    // request:accepted — user/provider sees acceptance
    const removeAccepted = addEventListener('request:accepted', (data) => {
      console.log('[GlobalBanner] Socket: request:accepted', data);
      showBannerDeduped({
        ...data,
        title: '✅ Request Accepted!',
        body: isProvider
          ? 'You have accepted this request.'
          : `${data.providerName || 'A provider'} has accepted your request!`,
        bannerType: 'accepted',
      });
    });

    // request:completed — both sides see completion
    const removeCompleted = addEventListener('request:completed', (data) => {
      console.log('[GlobalBanner] Socket: request:completed', data);
      showBannerDeduped({
        ...data,
        title: '🎉 Service Completed!',
        body: 'The service has been completed successfully.',
        bannerType: 'completed',
      });
    });

    // request:cancelled — only show banner if the OTHER party cancelled
    // If user cancelled their own request, they already see the Alert confirmation
    // If provider cancelled their own, they already know — no redundant banner
    const removeCancelled = addEventListener('request:cancelled', (data) => {
      console.log('[GlobalBanner] Socket: request:cancelled', data);

      // Skip banner if this user initiated the cancel (they already see Alert)
      const selfCancelled =
        (!isProvider && data.cancelledBy === 'user') ||
        (isProvider && data.cancelledBy === 'provider');

      if (selfCancelled) {
        console.log('[GlobalBanner] Skipping cancel banner — self-initiated cancellation');
        return;
      }

      showBannerDeduped({
        ...data,
        title: '⚠️ Request Cancelled',
        body: data.cancelledBy === 'user'
          ? 'The customer has cancelled their request.'
          : data.cancelledBy === 'provider'
            ? 'The provider has cancelled the request.'
            : 'The request has been cancelled.',
        bannerType: 'cancelled',
      });
    });

    // request:status — generic status update fallback
    const removeStatus = addEventListener('request:status', (data) => {
      console.log('[GlobalBanner] Socket: request:status', data);
      const statusMap = {
        accepted: 'accepted',
        completed: 'completed',
        cancelled: 'cancelled',
        rejected: 'rejected',
      };
      const bannerType = statusMap[data.status] || 'new_request';
      showBannerDeduped({
        ...data,
        title: `📊 Request ${(data.status || 'updated').charAt(0).toUpperCase() + (data.status || 'updated').slice(1)}`,
        body: `Your request status has been updated to ${data.status || 'unknown'}.`,
        bannerType,
      });
    });

    return () => {
      removeNewRequest();
      removeAccepted();
      removeCompleted();
      removeCancelled();
      removeStatus();
    };
  }, [isProvider, showBannerDeduped]);

  // Nothing to render
  if (!bannerData) return null;

  const config = BANNER_CONFIG[bannerData.bannerType] || BANNER_CONFIG.new_request;
  const personName = bannerData.userName || bannerData.providerName || bannerData.name || null;
  const personPhone = bannerData.userPhone || bannerData.providerPhone || bannerData.phone || null;
  const personPicture = bannerData.userProfilePicture || bannerData.profilePicture || bannerData.providerProfilePicture || null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: bannerAnim }],
          paddingTop: insets.top + 8,
          backgroundColor: config.bgColor,
        },
      ]}
    >
      <View style={styles.pill} />

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.pulse, { backgroundColor: config.iconColor }]}>
          <Icon name={config.iconName} size={20} color="#fff" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {bannerData.title || '🔔 Notification'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {bannerData.body || ''}
          </Text>
        </View>
        <TouchableOpacity onPress={dismissBanner} style={styles.closeBtn}>
          <Icon name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Person Info (customer for providers, provider for users) */}
      {(personName || personPicture) && (
        <View style={styles.personRow}>
          {personPicture ? (
            <Image source={{ uri: personPicture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(personName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.personDetails}>
            <Text style={styles.personName} numberOfLines={1}>{personName}</Text>
            {personPhone ? (
              <Text style={styles.personPhone}>{personPhone}</Text>
            ) : null}
          </View>

          {/* Distance badge (new request) */}
          {bannerData.distance ? (
            <View style={styles.distanceBadge}>
              <Icon name="location" size={12} color="#fff" />
              <Text style={styles.distanceText}>
                {parseFloat(bannerData.distance) < 1000
                  ? `${Math.round(parseFloat(bannerData.distance))} m`
                  : `${(parseFloat(bannerData.distance) / 1000).toFixed(1)} km`}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        {/* Call */}
        {personPhone ? (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${personPhone.replace(/\s/g, '')}`)}
          >
            <Icon name="phone" size={16} color="#10B981" />
            <Text style={styles.callText}>Call</Text>
          </TouchableOpacity>
        ) : null}

        {/* Directions (new request with location) */}
        {(bannerData.latitude || bannerData.lat) ? (
          <TouchableOpacity
            style={styles.directionsBtn}
            onPress={() => {
              const lat = bannerData.latitude || bannerData.lat;
              const lng = bannerData.longitude || bannerData.lng;
              const url = Platform.select({
                ios: `maps:0,0?q=${lat},${lng}(Service Location)`,
                android: `geo:${lat},${lng}?q=${lat},${lng}(Service Location)`,
              });
              Linking.openURL(url).catch(() => {
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
              });
            }}
          >
            <Icon name="directions" size={16} color="#3B82F6" />
            <Text style={styles.directionsText}>Directions</Text>
          </TouchableOpacity>
        ) : null}

        {/* View Details */}
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => {
            dismissBanner();
            const requestId = bannerData.requestId || bannerData.serviceRequestId;
            if (requestId) {
              // Detect service category from FCM data
              const svcType = bannerData.serviceType || '';
              const EVENT_TYPES = ['photographer', 'influencer'];
              const EMERGENCY_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
              const isEvent = EVENT_TYPES.includes(svcType);
              const isEmergency = EMERGENCY_TYPES.includes(svcType);

              navigation.navigate('ServiceRequestDetail', {
                requestId,
                fromNotification: true,
                serviceType: svcType || undefined,
                isEventService: isEvent || undefined,
                isEmergencyService: isEmergency || undefined,
                serviceName: bannerData.serviceName || undefined,
              });
            }
          }}
        >
          <Text style={styles.viewText}>View Details</Text>
          <Icon name="chevron-right" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 9999,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  pill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  pulse: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  // Person row
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: BRAND.primary,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  personDetails: {
    flex: 1,
    marginLeft: 12,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  personPhone: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  // Actions
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  callText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  directionsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  viewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.primary,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  viewText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

export default GlobalBanner;
