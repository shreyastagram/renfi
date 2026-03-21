/**
 * GlobalBanner Component
 *
 * App-wide notification banner (Uber/Ola style) for FCM foreground
 * notifications on ANY screen. Frosted glass design.
 *
 * @version 2.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {  View,
  Text,
  StyleSheet,
  Animated,
  Vibration,
  Platform,
  Linking,
  Image,
  Dimensions
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import { BlurView } from '@react-native-community/blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../components';
import { useApp } from '../context/AppContext';
import { setupForegroundMessageListener } from '../services/fcmService';
import { addEventListener } from '../services/socketService';
import { playNotificationSound } from '../utils/notificationSound';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  white: '#FFFFFF',
};

// Banner type configuration
const BANNER_CONFIG = {
  new_request: {
    accentColor: BRAND.primary,
    iconName: 'inbox',
    autoDismissMs: 30000,
  },
  accepted: {
    accentColor: '#10B981',
    iconName: 'check_circle',
    autoDismissMs: 8000,
  },
  rejected: {
    accentColor: '#EF4444',
    iconName: 'cancelled',
    autoDismissMs: 8000,
  },
  cancelled: {
    accentColor: '#F59E0B',
    iconName: 'cancelled',
    autoDismissMs: 8000,
  },
  completed: {
    accentColor: BRAND.secondary,
    iconName: 'check_circle',
    autoDismissMs: 8000,
  },
  arrived: {
    accentColor: '#10B981',
    iconName: 'location',
    autoDismissMs: 8000,
  },
};

// Off-screen position — percentage based so works on all screen sizes
const OFFSCREEN_Y = -(SCREEN_HEIGHT * 0.5);

/**
 * GlobalBanner — mounts once at app level, listens to FCM foreground
 * messages and renders an overlay banner on any screen.
 */
const GlobalBanner = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { userType } = useApp();

  const [bannerData, setBannerData] = useState(null);
  const bannerAnim = useRef(new Animated.Value(OFFSCREEN_Y)).current;
  const bannerTimer = useRef(null);
  const lastBannerRef = useRef({ key: '', ts: 0 });

  const isProvider = userType === 'provider';

  const isPushEnabledRef = useRef(true);

  useEffect(() => {
    const loadPushPref = async () => {
      try {
        const saved = await AsyncStorage.getItem('notification_preferences');
        if (saved) {
          const parsed = JSON.parse(saved);
          isPushEnabledRef.current = parsed.pushEnabled !== false;
        }
      } catch (e) {}
    };
    loadPushPref();
    const interval = setInterval(loadPushPref, 5000);
    return () => clearInterval(interval);
  }, []);

  const showBanner = useCallback((data) => {
    if (!isPushEnabledRef.current) return;

    if (Platform.OS === 'ios') {
      Vibration.vibrate(400);
    } else {
      Vibration.vibrate([0, 400, 200, 400]);
    }

    playNotificationSound({
      title: data.title || 'Fixhomi',
      body: data.body || '',
    });

    setBannerData(data);

    Animated.spring(bannerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();

    const config = BANNER_CONFIG[data.bannerType] || BANNER_CONFIG.new_request;
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => {
      dismissBanner();
    }, config.autoDismissMs);
  }, [bannerAnim]);

  const dismissBanner = useCallback(() => {
    Animated.timing(bannerAnim, {
      toValue: OFFSCREEN_Y,
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

  const showBannerDeduped = useCallback((data) => {
    const dedupKey = `${data.requestId || data.serviceRequestId || ''}_${data.bannerType}`;
    const now = Date.now();
    if (dedupKey && dedupKey === lastBannerRef.current.key && now - lastBannerRef.current.ts < 3000) {
      return;
    }
    lastBannerRef.current = { key: dedupKey, ts: now };
    showBanner(data);
  }, [showBanner]);

  // FCM Foreground Listener
  useEffect(() => {
    const unsubscribe = setupForegroundMessageListener((remoteMessage) => {
      const msgType = remoteMessage?.data?.type;
      const data = remoteMessage?.data || {};

      if (msgType === 'new_request' || msgType === 'NEW_SERVICE_REQUEST' || msgType === 'NEW_JOB_REQUEST') {
        showBannerDeduped({ ...data, title: remoteMessage?.notification?.title || '🔔 New Service Request!', body: remoteMessage?.notification?.body || 'You have a new service request!', bannerType: 'new_request' });
      } else if (msgType === 'REQUEST_ACCEPTED' || msgType === 'PROVIDER_ACCEPTED' || msgType === 'request_accepted' || msgType === 'BOOKING_ACCEPTED') {
        showBannerDeduped({ ...data, title: remoteMessage?.notification?.title || '✅ Request Accepted!', body: remoteMessage?.notification?.body || 'A provider has accepted your request!', bannerType: 'accepted' });
      } else if (msgType === 'REQUEST_REJECTED' || msgType === 'BOOKING_REJECTED' || msgType === 'EMERGENCY_REJECTED' || msgType === 'PROVIDER_REJECTED') {
        showBannerDeduped({ ...data, title: remoteMessage?.notification?.title || '❌ Request Rejected', body: remoteMessage?.notification?.body || 'The provider has declined your request.', bannerType: 'rejected' });
      } else if (msgType === 'REQUEST_CANCELLED' || msgType === 'BOOKING_CANCELLED') {
        showBannerDeduped({ ...data, title: '⚠️ Request Cancelled', body: remoteMessage?.notification?.body || (isProvider ? 'A customer has cancelled their request.' : 'Your request has been cancelled.'), bannerType: 'cancelled' });
      } else if (msgType === 'REQUEST_COMPLETED' || msgType === 'SERVICE_COMPLETED' || msgType === 'request_completed') {
        showBannerDeduped({ ...data, title: '🎉 Service Completed!', body: remoteMessage?.notification?.body || 'The service has been completed.', bannerType: 'completed' });
      } else if (msgType === 'PROVIDER_ARRIVED' || msgType === 'provider_arrived') {
        showBannerDeduped({ ...data, title: '📍 Provider Arrived', body: remoteMessage?.notification?.body || 'Your provider has arrived at the location.', bannerType: 'arrived' });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [isProvider, showBannerDeduped]);

  // Socket Event Listeners
  useEffect(() => {
    const removeNewRequest = addEventListener('new:request', (data) => {
      showBannerDeduped({ ...data, title: '🔔 New Service Request!', body: `New ${data.serviceType || 'service'} request received`, bannerType: 'new_request' });
    });

    const removeAccepted = addEventListener('request:accepted', (data) => {
      showBannerDeduped({ ...data, title: '✅ Request Accepted!', body: isProvider ? 'You have accepted this request.' : `${data.providerName || 'A provider'} has accepted your request!`, bannerType: 'accepted' });
    });

    const removeCompleted = addEventListener('request:completed', (data) => {
      showBannerDeduped({ ...data, title: '🎉 Service Completed!', body: 'The service has been completed successfully.', bannerType: 'completed' });
    });

    const removeCancelled = addEventListener('request:cancelled', (data) => {
      const selfCancelled = (!isProvider && data.cancelledBy === 'user') || (isProvider && data.cancelledBy === 'provider');
      if (selfCancelled) return;
      showBannerDeduped({ ...data, title: '⚠️ Request Cancelled', body: data.cancelledBy === 'user' ? 'The customer has cancelled their request.' : data.cancelledBy === 'provider' ? 'The provider has cancelled the request.' : 'The request has been cancelled.', bannerType: 'cancelled' });
    });

    const removeStatus = addEventListener('request:status', (data) => {
      const statusMap = { accepted: 'accepted', completed: 'completed', cancelled: 'cancelled', rejected: 'rejected' };
      const bannerType = statusMap[data.status] || 'new_request';
      showBannerDeduped({ ...data, title: `📊 Request ${(data.status || 'updated').charAt(0).toUpperCase() + (data.status || 'updated').slice(1)}`, body: `Your request status has been updated to ${data.status || 'unknown'}.`, bannerType });
    });

    return () => { removeNewRequest(); removeAccepted(); removeCompleted(); removeCancelled(); removeStatus(); };
  }, [isProvider, showBannerDeduped]);

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
          paddingTop: insets.top + 10,
        },
      ]}
    >
      {/* Frosted glass background */}
      <BlurView
        style={[StyleSheet.absoluteFill, styles.blurFill]}
        blurType={Platform.OS === 'ios' ? 'chromeMaterialDark' : 'dark'}
        blurAmount={Platform.OS === 'ios' ? 30 : 25}
        reducedTransparencyFallbackColor="rgba(15,23,42,0.95)"
      />

      {/* Accent top stripe */}
      <View style={[styles.accentStripe, { backgroundColor: config.accentColor }]} />

      <View style={styles.pill} />

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: config.accentColor + '22' }]}>
          <Icon name={config.iconName} size={20} color={config.accentColor} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{bannerData.title || '🔔 Notification'}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>{bannerData.body || ''}</Text>
        </View>
        <TouchableOpacity onPress={dismissBanner} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="close" size={18} color="rgba(255,255,255,0.45)" />
        </TouchableOpacity>
      </View>

      {/* Person Info */}
      {(personName || personPicture) && (
        <View style={styles.personRow}>
          {personPicture ? (
            <Image source={{ uri: personPicture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{(personName || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.personDetails}>
            <Text style={styles.personName} numberOfLines={1}>{personName}</Text>
            {personPhone ? <Text style={styles.personPhone}>{personPhone}</Text> : null}
          </View>
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
        {personPhone ? (
          <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${personPhone.replace(/\s/g, '')}`).catch(() => {})}>
            <Icon name="phone" size={16} color="#10B981" />
            <Text style={styles.callText}>Call</Text>
          </TouchableOpacity>
        ) : null}

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

        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => {
            dismissBanner();
            const requestId = bannerData.requestId || bannerData.serviceRequestId;
            if (requestId) {
              const svcType = bannerData.serviceType || '';
              const EVENT_TYPES = ['photographer', 'influencer'];
              const EMERGENCY_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
              navigation.navigate('ServiceRequestDetail', {
                requestId,
                fromNotification: true,
                serviceType: svcType || undefined,
                isEventService: EVENT_TYPES.includes(svcType) || undefined,
                isEmergencyService: EMERGENCY_TYPES.includes(svcType) || undefined,
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
    paddingHorizontal: 16,
    paddingBottom: 18,
    zIndex: 9999,
    overflow: 'hidden',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  blurFill: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  accentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  pill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 12,
    marginTop: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  callText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
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
