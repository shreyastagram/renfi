/**
 * Service Request Detail Screen
 *
 * Comprehensive view of a single service request with:
 * - Full request details
 * - Provider information
 * - OTP display and copy functionality
 * - Status timeline
 * - Action buttons based on status
 *
 * @version 3.0.0 — Premium Uber/Ola-quality UI revamp
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Platform,
  TextInput,
  Modal,
  Image,
  Switch,
  AppState,
  Animated,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { Icon, ServiceIcon, StatusIcon, RatingModal, CancellationReasonModal } from '../components';
import { NODE_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';
import Mapbox from '@rnmapbox/maps';
import { initializeMapbox } from '../config/mapbox';
import {
  getRequestDetails,
  cancelRequest,
  acceptRequestAsProvider,
  resendCompletionOtp,
  verifyCompletionOtp,
  verifyEventCompletionOtp,
  submitRating,
  checkRatingStatus,
  SERVICE_TYPE_LABELS,
  toggleLocationSharing,
  getRequestProviderLocation,
} from '../services/traditionalServiceService';
import { addToFavorites, removeFromFavorites, checkIsFavorite } from '../services/favoritesService';
import { getProviderProfile } from '../services/profileService';
import {
  addEventListener as addSocketListener,
  subscribeToRequest,
  unsubscribeFromRequest,
  startRequestLocationTracking,
  stopRequestLocationTracking,
} from '../services/socketService';
import { setupForegroundMessageListener } from '../services/fcmService';
// Direct phone dialing - Exotel call masking removed

// Premium Design Language
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  dark: '#0F172A',
  background: '#F8FAFC',
  white: '#FFFFFF',
  neutral: '#6B7280',
  success: '#10B981',
  danger: '#EF4444',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#94A3B8',
  border: '#F1F5F9',
  cardBg: '#FFFFFF',
};

// Status configuration
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: BRAND.primary,
    bgColor: '#FEF3C7',
    iconName: 'clock',
    userDescription: 'Waiting for a provider to accept your request',
    providerDescription: 'Customer is waiting for you to accept this request',
    step: 1,
  },
  accepted: {
    label: 'Accepted',
    color: BRAND.secondary,
    bgColor: '#DBEAFE',
    iconName: 'check',
    userDescription: 'A provider has accepted your request',
    providerDescription: 'You have accepted this request',
    step: 2,
  },
  'in-progress': {
    label: 'In Progress',
    color: BRAND.secondary,
    bgColor: '#DBEAFE',
    iconName: 'wrench',
    userDescription: 'The service is currently being performed',
    providerDescription: 'You are currently working on this service',
    step: 3,
  },
  completed: {
    label: 'Completed',
    color: BRAND.success,
    bgColor: '#D1FAE5',
    iconName: 'check-circle',
    userDescription: 'The service has been successfully completed',
    providerDescription: 'You have completed this service',
    step: 4,
  },
  cancelled: {
    label: 'Cancelled',
    color: BRAND.danger,
    bgColor: '#FEE2E2',
    iconName: 'close',
    userDescription: 'This request was cancelled',
    providerDescription: 'This request was cancelled',
    step: 0,
  },
  rejected: {
    label: 'Rejected',
    color: BRAND.neutral,
    bgColor: '#F3F4F6',
    iconName: 'block',
    userDescription: 'No providers were available for this request',
    providerDescription: 'This request was rejected',
    step: 0,
  },
};

const getStatusDescription = (status, isProvider, cancelledBy) => {
  if (status === 'cancelled' && cancelledBy) {
    if (cancelledBy === 'user') {
      return isProvider ? 'Cancelled by the customer' : 'You cancelled this request';
    }
    if (cancelledBy === 'provider') {
      return isProvider ? 'You cancelled this request' : 'The service provider cancelled';
    }
    if (cancelledBy === 'system') {
      return 'Automatically cancelled by the system';
    }
  }
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return isProvider ? config.providerDescription : config.userDescription;
};

/* ─── Pulsing Dot ─────────────────────────────────────────────────── */
const PulsingDot = ({ color = BRAND.success, size = 8 }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.8, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);
  return (
    <View style={{ width: size * 2.5, height: size * 2.5, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size * 2.5, height: size * 2.5, borderRadius: size * 1.25, backgroundColor: color + '30', transform: [{ scale: pulseAnim }] }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
};

/* ─── Cancellation Info Card ──────────────────────────────────────── */
const CancellationInfoCard = ({ request, isProvider }) => {
  if (request.status !== 'cancelled') return null;
  const cancelledBy = request.cancelledBy || null;
  const reason = request.cancellationReason || request.cancelReason || null;
  const cancelledAt = request.cancelledAt ? new Date(request.cancelledAt) : null;
  let cancelledByLabel;
  if (cancelledBy === 'user') cancelledByLabel = isProvider ? 'Customer' : 'You';
  else if (cancelledBy === 'provider') cancelledByLabel = isProvider ? 'You' : 'Service Provider';
  else if (cancelledBy === 'system') cancelledByLabel = 'System';
  else cancelledByLabel = null;
  let displayReason = reason;
  if (displayReason) {
    displayReason = displayReason.replace(/^(User cancelled|Cancelled by user|Cancelled by provider|Provider cancelled)$/i, '').trim();
  }
  return (
    <View style={s.cancellationCard}>
      <View style={s.cancellationHeader}>
        <View style={s.cancellationIconCircle}>
          <Icon name="warning" size={18} color="#DC2626" />
        </View>
        <Text style={s.cancellationTitle}>Request Cancelled</Text>
      </View>
      {cancelledByLabel && (
        <View style={s.cancellationRow}>
          <Icon name="person" size={14} color="#B91C1C" />
          <Text style={s.cancellationRowText}>Cancelled by: <Text style={{ fontWeight: '700' }}>{cancelledByLabel}</Text></Text>
        </View>
      )}
      {displayReason ? (
        <View style={s.cancellationRow}>
          <Icon name="info" size={14} color="#B91C1C" style={{ marginTop: 1 }} />
          <Text style={[s.cancellationRowText, { flex: 1, lineHeight: 18 }]}>{displayReason}</Text>
        </View>
      ) : null}
      {cancelledAt && !isNaN(cancelledAt.getTime()) && (
        <View style={s.cancellationRow}>
          <Icon name="clock" size={14} color="#B91C1C" />
          <Text style={[s.cancellationRowText, { fontSize: 12, color: '#9B2C2C' }]}>
            {cancelledAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}
    </View>
  );
};

/* ─── Status Timeline ─────────────────────────────────────────────── */
const StatusTimeline = ({ currentStatus, isProvider = false, cancelledBy = null }) => {
  const status = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pending;
  const isCancelled = currentStatus === 'cancelled' || currentStatus === 'rejected';
  const steps = [
    { key: 'pending', label: 'Created', step: 1 },
    { key: 'accepted', label: 'Accepted', step: 2 },
    { key: 'in-progress', label: 'Working', step: 3 },
    { key: 'completed', label: 'Done', step: 4 },
  ];
  if (isCancelled) {
    return (
      <View style={s.timelineContainer}>
        <View style={s.timelineCancelledPill}>
          <View style={s.timelineCancelledIcon}>
            <Icon name="close" size={12} color={BRAND.white} />
          </View>
          <Text style={s.timelineCancelledText}>{getStatusDescription(currentStatus, isProvider, cancelledBy)}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={s.timelineContainer}>
      <Text style={s.sectionLabel}>PROGRESS</Text>
      <View style={s.timeline}>
        {steps.map((step, index) => {
          const isActive = status.step >= step.step;
          const isCurrent = status.step === step.step;
          const isCompleted = status.step > step.step;
          return (
            <React.Fragment key={step.key}>
              <View style={s.timelineStep}>
                <View style={[
                  s.timelineCircle,
                  isCompleted && s.timelineCircleCompleted,
                  isCurrent && s.timelineCircleCurrent,
                ]}>
                  {isCompleted ? (
                    <Icon name="check" size={14} color={BRAND.white} />
                  ) : isCurrent ? (
                    <PulsingDot color={BRAND.white} size={5} />
                  ) : (
                    <Text style={s.timelineNumber}>{step.step}</Text>
                  )}
                </View>
                <Text style={[
                  s.timelineLabel,
                  isActive && s.timelineLabelActive,
                  isCurrent && s.timelineLabelCurrent,
                ]}>{step.label}</Text>
              </View>
              {index < steps.length - 1 && (
                <View style={s.timelineConnectorWrapper}>
                  <View style={[
                    s.timelineConnector,
                    status.step > step.step && s.timelineConnectorActive,
                  ]} />
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

/* ─── Info Row ────────────────────────────────────────────────────── */
const InfoRow = ({ label, value, iconName }) => (
  <View style={s.infoRow}>
    <View style={s.infoRowLeft}>
      <Icon name={iconName} size={15} color={BRAND.textMuted} />
      <Text style={s.infoLabel}>{label}</Text>
    </View>
    <Text style={s.infoValue} numberOfLines={2}>{value}</Text>
  </View>
);

/* ─── OTP Display (User side) ─────────────────────────────────────── */
const OtpDisplay = ({ otp, expiresAt, onResend }) => {
  const { dialog } = useDialog();
  const [copied, setCopied] = useState(false);
  const isExpired = expiresAt && new Date(expiresAt) < new Date();
  const handleCopy = () => {
    if (otp) {
      dialog('Completion OTP', `Your OTP is: ${otp}\n\nShare this with your service provider to mark the service as complete.`, [{ text: 'OK' }]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  const otpDigits = otp ? String(otp).split('') : [];
  if (isExpired) {
    return (
      <View style={s.otpExpiredCard}>
        <View style={s.otpExpiredHeader}>
          <View style={s.otpExpiredIconCircle}><Icon name="clock" size={22} color="#DC2626" /></View>
          <Text style={s.otpExpiredTitle}>OTP Expired</Text>
        </View>
        <Text style={s.otpExpiredDesc}>The completion OTP has expired. Request a new one to continue.</Text>
        <TouchableOpacity style={s.otpResendBtn} onPress={onResend}>
          <Icon name="refresh" size={15} color="#FFFFFF" />
          <Text style={s.otpResendBtnText}>Request New OTP</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={s.otpCard}>
      <View style={s.otpHeaderRow}>
        <View style={s.otpHeaderLeft}>
          <View style={s.otpLockCircle}><Icon name="lock" size={16} color="#6D28D9" /></View>
          <Text style={s.otpHeaderTitle}>Completion OTP</Text>
        </View>
        <Text style={s.otpHeaderSub}>Share with provider</Text>
      </View>
      <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={s.otpDigitsRow}>
        {otpDigits.map((digit, i) => (
          <View key={i} style={s.otpDigitBox}>
            <Text style={s.otpDigit}>{digit}</Text>
          </View>
        ))}
      </TouchableOpacity>
      <TouchableOpacity onPress={handleCopy} style={s.otpCopyRow}>
        <Icon name={copied ? 'check' : 'copy'} size={13} color={copied ? BRAND.success : BRAND.textMuted} />
        <Text style={[s.otpCopyText, copied && { color: BRAND.success }]}>{copied ? 'Copied!' : 'Tap to copy'}</Text>
      </TouchableOpacity>
      {expiresAt && (
        <View style={s.otpExpiryRow}>
          <Icon name="timer" size={13} color={BRAND.textMuted} />
          <Text style={s.otpExpiryText}>Expires {new Date(expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      )}
      <View style={s.otpWarningStrip}>
        <Icon name="info" size={14} color="#92400E" />
        <Text style={s.otpWarningText}>Only share after the work is satisfactorily done.</Text>
      </View>
    </View>
  );
};

/* ─── Resolve profile pic ─────────────────────────────────────────── */
const resolveProfilePic = (pic) => {
  if (!pic) return null;
  if (typeof pic === 'string' && pic.length > 0) return pic;
  if (typeof pic === 'object' && pic.url) {
    if (typeof pic.url === 'string') return pic.url;
  }
  return null;
};

/* ─── Provider Card ───────────────────────────────────────────────── */
const ProviderCard = ({ provider, onCall, onGetLocation, showActions }) => {
  if (!provider) return null;
  const profilePicUrl = resolveProfilePic(provider.profilePicture) || resolveProfilePic(provider.profileImage);
  const ratingValue = provider.ratings?.average || provider.rating || 0;
  const reviewCount = provider.ratings?.total || provider.totalRatings || 0;
  return (
    <View style={s.card}>
      <Text style={s.sectionLabel}>YOUR PROVIDER</Text>
      <View style={[s.rowCenter, { marginBottom: showActions ? 14 : 0 }]}>
        <View style={{ position: 'relative', marginRight: 12 }}>
          {profilePicUrl ? (
            <Image source={{ uri: profilePicUrl }} style={s.providerAvatarImg} />
          ) : (
            <View style={s.providerAvatarFallback}>
              <Text style={s.providerAvatarChar}>{provider.name?.charAt(0).toUpperCase() || 'P'}</Text>
            </View>
          )}
          {(provider.isVerified || provider.verified) && (
            <View style={s.verifiedBadge}><Icon name="verified" size={10} color="#FFFFFF" /></View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.providerName}>{provider.name}</Text>
          <View style={[s.rowCenter, { gap: 8, marginTop: 3 }]}>
            {ratingValue > 0 && (
              <View style={[s.rowCenter, { gap: 3 }]}>
                <Icon name="star" size={13} color="#F59E0B" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: BRAND.text }}>{ratingValue.toFixed(1)}</Text>
                {reviewCount > 0 && <Text style={{ fontSize: 11, color: BRAND.textMuted }}>({reviewCount})</Text>}
              </View>
            )}
            {showActions && (provider.phone || provider.verifiedPhone) && (
              <View style={[s.rowCenter, { gap: 3 }]}>
                <Icon name="phone" size={11} color={BRAND.textMuted} />
                <Text style={{ fontSize: 11, color: BRAND.textMuted }}>{provider.phone || provider.verifiedPhone}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      {showActions && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={s.callBtn} onPress={onCall}>
            <Icon name="phone" size={16} color="#FFFFFF" />
            <Text style={s.callBtnText}>Call</Text>
          </TouchableOpacity>
          {onGetLocation && (
            <TouchableOpacity style={s.trackBtn} onPress={onGetLocation}>
              <Icon name="location" size={16} color="#FFFFFF" />
              <Text style={s.trackBtnText}>Track</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

/* ─── Location Map Preview ────────────────────────────────────────── */
const LocationMapPreview = ({ location, address }) => {
  const [mapLoading, setMapLoading] = useState(true);

  // Support both GeoJSON [lng, lat] and {latitude, longitude} formats
  let lng = null, lat = null;
  if (location?.coordinates && Array.isArray(location.coordinates) && location.coordinates.length === 2 && typeof location.coordinates[0] === 'number' && typeof location.coordinates[1] === 'number' && !isNaN(location.coordinates[0]) && !isNaN(location.coordinates[1])) {
    [lng, lat] = location.coordinates;
  } else if (location?.latitude && location?.longitude && !isNaN(location.latitude) && !isNaN(location.longitude)) {
    lat = location.latitude;
    lng = location.longitude;
  }
  const hasValidCoordinates = lng !== null && lat !== null;
  if (!hasValidCoordinates) {
    if (!address) return null;
    return (
      <View style={s.card}>
        <Text style={s.sectionLabel}>SERVICE LOCATION</Text>
        <View style={[s.rowCenter, { gap: 8 }]}>
          <Icon name="location" size={16} color="#EF4444" />
          <Text style={{ flex: 1, fontSize: 13, color: BRAND.text, lineHeight: 19 }}>{address}</Text>
        </View>
      </View>
    );
  }
  const handleGetDirections = () => {
    const label = encodeURIComponent(address || 'Service Location');
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}(${label})`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };
  return (
    <View style={s.card}>
      <Text style={[s.sectionLabel, { marginBottom: 10 }]}>SERVICE LOCATION</Text>
      <View style={s.mapPreviewWrap}>
        {mapLoading && (<View style={s.mapLoadingOverlay}><ActivityIndicator size="small" color={BRAND.secondary} /></View>)}
        <Mapbox.MapView style={s.mapPreview} styleURL={Mapbox.StyleURL.Street} scrollEnabled={false} pitchEnabled={false} rotateEnabled={false} zoomEnabled={false} onDidFinishLoadingMap={() => setMapLoading(false)}>
          <Mapbox.Camera centerCoordinate={[lng, lat]} zoomLevel={15} animationDuration={0} />
          <Mapbox.PointAnnotation id="service-location" coordinate={[lng, lat]}>
            <View style={s.mapPinOuter}>
              <View style={s.mapPin}><Icon name="location" size={16} color="#FFFFFF" /></View>
              <View style={s.mapPinShadow} />
            </View>
          </Mapbox.PointAnnotation>
        </Mapbox.MapView>
      </View>
      <View style={[s.rowCenter, { gap: 8, marginBottom: 10 }]}>
        <Icon name="location" size={15} color="#EF4444" />
        <Text style={{ flex: 1, fontSize: 13, color: BRAND.text, lineHeight: 19 }}>{address}</Text>
      </View>
      <TouchableOpacity style={s.directionsBtn} onPress={handleGetDirections} activeOpacity={0.7}>
        <Icon name="directions" size={18} color="#FFFFFF" />
        <Text style={s.directionsBtnText}>Get Directions</Text>
      </TouchableOpacity>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN SCREEN COMPONENT — all business logic preserved exactly
   ═══════════════════════════════════════════════════════════════════════ */
const ServiceRequestDetailScreen = ({ navigation, route }) => {
  const { dialog } = useDialog();
  const { user, profile, userType } = useApp();
  const initialRequest = route.params?.request;

  const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
  const isEventService = route.params?.isEventService ||
    initialRequest?.isEventService ||
    EVENT_SERVICE_TYPES.includes(initialRequest?.serviceType) ||
    EVENT_SERVICE_TYPES.includes(route.params?.serviceType);

  const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
  const isEmergencyService = route.params?.isEmergencyService ||
    initialRequest?.isEmergencyService ||
    EMERGENCY_SERVICE_TYPES.includes(initialRequest?.serviceType) ||
    EMERGENCY_SERVICE_TYPES.includes(route.params?.serviceType);

  const serviceCategory = isEventService ? 'event' : 'traditional';

  const [request, setRequest] = useState(initialRequest);
  const [loading, setLoading] = useState(!initialRequest);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingStatus, setRatingStatus] = useState({ rated: false, rating: null });
  const [isFavorited, setIsFavorited] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Clear OTP field when navigating to a different request (prevents auto-fill from previous job)
  useEffect(() => {
    setEnteredOtp('');
  }, [route.params?.requestId]);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [locationSharingLoading, setLocationSharingLoading] = useState(false);
  const [locationSharingData, setLocationSharingData] = useState(null);
  const [providerLiveLocation, setProviderLiveLocation] = useState(null);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);
  const [locationAcquireTimeout, setLocationAcquireTimeout] = useState(false);
  const locationSharingRef = useRef(false);
  const [sentProviderDetails, setSentProviderDetails] = useState(null);
  // scrollY removed — header is now fixed (no collapsible animation)

  const isProvider = userType === 'provider';

  const getUserId = useCallback(() => {
    const mongoId = user?.mongoId || profile?._id;
    const javaUserId = user?.javaUserId || user?.userId || profile?.userId;
    return mongoId || javaUserId;
  }, [user, profile]);

  const getProviderId = useCallback(() => {
    return user?.mongoId || user?.javaUserId || profile?.mongoId || profile?._id;
  }, [user, profile]);

  // ─── Location Sharing: Fetch initial state ─────────────────────────
  const fetchLocationSharingStatus = useCallback(async () => {
    const reqId = request?._id;
    if (!reqId || isEmergencyService) return;
    if (!['accepted', 'in-progress'].includes(request?.status)) return;
    try {
      const result = await getRequestProviderLocation(reqId, serviceCategory);
      if (result.success && result.locationSharing) {
        const ls = result.locationSharing;
        setLocationSharingData(ls);
        setLocationSharingEnabled(ls.enabled || false);
        locationSharingRef.current = ls.enabled || false;
        if (ls.providerLocation) {
          setProviderLiveLocation(ls.providerLocation);
          setLastLocationUpdate(ls.providerLocation.updatedAt ? new Date(ls.providerLocation.updatedAt) : null);
        }
      }
    } catch (error) {
      console.warn('[LocationSharing] Fetch status error:', error);
    }
  }, [request?._id, request?.status, serviceCategory, isEmergencyService]);

  // ─── Location Sharing: Toggle handler (provider) ───────────────────
  const handleToggleLocationSharing = useCallback(async (newValue) => {
    const reqId = request?._id;
    const providerId = getProviderId();
    if (!reqId || !providerId) return;
    setLocationSharingLoading(true);
    try {
      const result = await toggleLocationSharing(reqId, providerId, newValue, serviceCategory);
      if (result.success) {
        setLocationSharingEnabled(newValue);
        locationSharingRef.current = newValue;
        if (newValue) {
          startRequestLocationTracking(reqId, providerId, (loc) => {
            setProviderLiveLocation(loc);
            setLastLocationUpdate(new Date());
          });
        } else {
          stopRequestLocationTracking();
          setProviderLiveLocation(null);
          setLastLocationUpdate(null);
        }
      } else {
        dialog('Error', result.error || 'Failed to toggle location sharing');
      }
    } catch (error) {
      console.error('[LocationSharing] Toggle error:', error);
      dialog('Error', 'Failed to update location sharing');
    } finally {
      setLocationSharingLoading(false);
    }
  }, [request?._id, getProviderId, serviceCategory]);

  // ─── Location Sharing: Auto-enable logic & cleanup ─────────────────
  useEffect(() => {
    const reqId = request?._id;
    if (!reqId || isEmergencyService) return;
    if (!['accepted', 'in-progress'].includes(request?.status)) return;
    fetchLocationSharingStatus();
    return () => { stopRequestLocationTracking(); };
  }, [request?._id, request?.status, isEmergencyService, fetchLocationSharingStatus]);

  useEffect(() => {
    if (!isProvider || isEmergencyService) return;
    if (!['accepted', 'in-progress'].includes(request?.status)) return;
    if (locationSharingRef.current) return;
    const scheduledTime = locationSharingData?.scheduledTime;
    if (!scheduledTime) return;
    const serviceMs = new Date(scheduledTime).getTime();
    const autoEnableMs = serviceMs - (45 * 60 * 1000);
    const now = Date.now();
    if (now >= autoEnableMs) {
      console.log('[LocationSharing] Auto-enabling (within 45 min threshold)');
      handleToggleLocationSharing(true);
    } else {
      const delay = autoEnableMs - now;
      console.log(`[LocationSharing] Will auto-enable in ${Math.round(delay / 60000)} min`);
      const timer = setTimeout(() => {
        if (!locationSharingRef.current) handleToggleLocationSharing(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isProvider, isEmergencyService, request?.status, locationSharingData?.scheduledTime, handleToggleLocationSharing]);

  useEffect(() => {
    if (!isProvider || !locationSharingEnabled || !request?._id) return;
    if (!['accepted', 'in-progress'].includes(request?.status)) return;
    const providerId = getProviderId();
    if (!providerId) return;
    startRequestLocationTracking(request._id, providerId, (loc) => {
      setProviderLiveLocation(loc);
      setLastLocationUpdate(new Date());
    });
    return () => stopRequestLocationTracking();
  }, [isProvider, locationSharingEnabled, request?._id, request?.status, getProviderId]);

  useEffect(() => {
    if (isProvider || !request?._id) return;
    if (!['accepted', 'in-progress'].includes(request?.status)) return;
    const cleanupLocation = addSocketListener('request:provider:location', (data) => {
      if (data?.requestId === request._id) {
        setProviderLiveLocation({ latitude: data.latitude, longitude: data.longitude, accuracy: data.accuracy });
        setLastLocationUpdate(new Date(data.timestamp || Date.now()));
      }
    });
    const cleanupStatus = addSocketListener('request:location:status', (data) => {
      if (data?.requestId === request._id) {
        setLocationSharingEnabled(data.enabled);
        locationSharingRef.current = data.enabled;
        if (!data.enabled) { setProviderLiveLocation(null); setLastLocationUpdate(null); }
      }
    });
    return () => { cleanupLocation(); cleanupStatus(); };
  }, [isProvider, request?._id, request?.status]);

  // Fast poll REST for location when sharing is enabled but no location yet (user side)
  useEffect(() => {
    if (isProvider || !locationSharingEnabled || providerLiveLocation) return;
    const reqId = request?._id;
    if (!reqId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await getRequestProviderLocation(reqId, serviceCategory);
        if (cancelled) return;
        if (result.success && result.locationSharing?.providerLocation?.latitude) {
          const loc = result.locationSharing.providerLocation;
          setProviderLiveLocation(loc);
          setLastLocationUpdate(loc.updatedAt ? new Date(loc.updatedAt) : new Date());
          setLocationAcquireTimeout(false);
        }
      } catch (e) { /* silent */ }
    };
    poll(); // immediate first attempt
    const interval = setInterval(poll, 3000); // then every 3s
    const timeout = setTimeout(() => setLocationAcquireTimeout(true), 15000);
    return () => { cancelled = true; clearInterval(interval); clearTimeout(timeout); };
  }, [isProvider, locationSharingEnabled, providerLiveLocation, request?._id, serviceCategory]);

  // Clear timeout flag when location arrives
  useEffect(() => {
    if (providerLiveLocation) setLocationAcquireTimeout(false);
  }, [providerLiveLocation]);

  const fetchDetails = useCallback(async () => {
    if ((isEventService || isEmergencyService) && initialRequest) {
      setRequest(initialRequest);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const lookupId = route.params?.requestId || request?._id || request?.requestId;
    if (!lookupId) return;
    try {
      let result;
      if (isEventService) {
        console.log('[RequestDetail] Fetching event service:', lookupId);
        const response = await authFetch(`${NODE_BASE_URL}/api/event-services/${lookupId}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        const data = await response.json();
        result = { success: data.success, request: data.request, error: data.error };
      } else if (isEmergencyService) {
        console.log('[RequestDetail] Fetching emergency service:', lookupId);
        const response = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${lookupId}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        const data = await response.json();
        result = { success: data.success, request: data.request, error: data.error };
      } else {
        result = await getRequestDetails(lookupId);
      }
      if (result.success && result.request) {
        const req = result.request;
        if (req.providerInfo && !req.providerDetails) req.providerDetails = req.providerInfo;
        // Normalize location: ensure request.location is populated for event/emergency services
        if (!req.location && req.eventLocation) {
          req.location = req.eventLocation;
        }
        if (req.location && !req.location.coordinates) {
          if (req.location.latitude && req.location.longitude) {
            req.location.coordinates = [req.location.longitude, req.location.latitude];
          }
        }
        setRequest(req);
      } else {
        console.error('[RequestDetail] Fetch failed:', result.error);
      }
    } catch (error) {
      console.error('[RequestDetail] Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [request?._id, request?.requestId, route.params?.requestId, isEventService, isEmergencyService, initialRequest]);

  useEffect(() => {
    initializeMapbox();
    if ((isEventService || isEmergencyService) && initialRequest) {
      setRequest(initialRequest);
      setLoading(false);
      return;
    }
    if (!initialRequest || !initialRequest.providerDetails) fetchDetails();
  }, [isEventService, isEmergencyService]);

  // Fetch sent provider details when request has lastSentProviderId but no providerDetails
  useEffect(() => {
    const sentId = request?.lastSentProviderId;
    if (!sentId || request?.providerDetails || isProvider) return;
    if (request?.status !== 'pending') return;
    (async () => {
      try {
        const result = await getProviderProfile(sentId);
        if (result.success && result.data) {
          setSentProviderDetails(result.data);
        }
      } catch (e) {
        console.warn('[RequestDetail] Failed to fetch sent provider details:', e);
      }
    })();
  }, [request?.lastSentProviderId, request?.providerDetails, request?.status, isProvider]);

  const lastFetchRef = useRef(0);
  const DEDUP_WINDOW_MS = 2000;
  const debouncedFetchDetails = useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current < DEDUP_WINDOW_MS) { console.log('[RequestDetail] Dedup: skipping duplicate fetch'); return; }
    lastFetchRef.current = now;
    fetchDetails();
  }, [fetchDetails]);

  useEffect(() => {
    const requestId = request?._id || route.params?.requestId;
    if (!requestId) return;
    subscribeToRequest(requestId);
    const cleanups = [
      addSocketListener('request:accepted', (data) => { if (data?.requestId === requestId) { console.log('[RequestDetail] Socket: request accepted'); debouncedFetchDetails(); } }),
      addSocketListener('request:completed', (data) => { if (data?.requestId === requestId) { console.log('[RequestDetail] Socket: request completed'); debouncedFetchDetails(); } }),
      addSocketListener('request:cancelled', (data) => { if (data?.requestId === requestId) { console.log('[RequestDetail] Socket: request cancelled'); debouncedFetchDetails(); } }),
      addSocketListener('request:status', (data) => { if (data?.requestId === requestId) { console.log('[RequestDetail] Socket: status update:', data.status); debouncedFetchDetails(); } }),
      addSocketListener('provider:assigned', (data) => { if (data?.requestId === requestId) { console.log('[RequestDetail] Socket: provider assigned'); debouncedFetchDetails(); } }),
      addSocketListener('provider:location', (data) => { console.log('[RequestDetail] Socket: provider location update'); }),
    ];
    return () => { unsubscribeFromRequest(requestId); cleanups.forEach(fn => fn()); };
  }, [request?._id, route.params?.requestId, debouncedFetchDetails]);

  useEffect(() => {
    const requestId = request?._id || route.params?.requestId;
    const unsubscribe = setupForegroundMessageListener((remoteMessage) => {
      const msgRequestId = remoteMessage?.data?.requestId;
      const msgType = remoteMessage?.data?.type;
      if (msgRequestId === requestId) { console.log('[RequestDetail] FCM foreground for this request:', msgType); debouncedFetchDetails(); }
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [request?._id, route.params?.requestId, debouncedFetchDetails]);

  useEffect(() => {
    const isActive = request && ['pending', 'accepted', 'in-progress', 'in_transit', 'arrived', 'awaiting_confirmation'].includes(request.status);
    if (!isActive) return;
    const interval = setInterval(() => { console.log('[RequestDetail] Polling refresh (active request)'); fetchDetails(); }, 30000);
    return () => clearInterval(interval);
  }, [request?.status, fetchDetails]);

  const handleRefresh = useCallback(() => { setRefreshing(true); fetchDetails(); }, [fetchDetails]);

  const handleCancel = useCallback(() => { setCancelModalVisible(true); }, []);

  const executeCancellation = useCallback(async (reason) => {
    setCancelling(true);
    const userId = getUserId();
    try {
      let result;
      const isEventServiceRequest = isEventService || request?.isEventService;
      const isEmergencyServiceRequest = isEmergencyService || request?.isEmergencyService;
      console.log('[Cancel] Service type detection:', { serviceType: request?.serviceType, isEventService: isEventServiceRequest, isEmergencyService: isEmergencyServiceRequest });
      if (isEventServiceRequest) {
        console.log('[Cancel] Using event-services endpoint');
        const response = await authFetch(`${NODE_BASE_URL}/api/event-services/${request._id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, reason, cancelledBy: isProvider ? 'provider' : 'user' }) });
        const data = await response.json();
        result = { success: response.ok && data.statusCode !== 500, error: data.error || data.message, details: data };
      } else if (isEmergencyServiceRequest) {
        console.log('[Cancel] Using emergency-services endpoint');
        const response = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${request._id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, reason, cancelledBy: isProvider ? 'provider' : 'user' }) });
        const data = await response.json();
        result = { success: response.ok && data.statusCode !== 500, error: data.error || data.message, details: data };
      } else {
        console.log('[Cancel] Using traditional-services endpoint');
        result = await cancelRequest(request._id, userId, reason);
      }
      setCancelling(false);
      setCancelModalVisible(false);
      if (result.success) {
        const successMsg = result.details?.wasAccepted ? 'Your request has been cancelled and the provider has been notified.' : 'Your request has been cancelled.';
        dialog('Cancelled', successMsg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        const errMsg = (result.error || '').toLowerCase();
        if (errMsg.includes('already cancel')) {
          dialog('Already Cancelled', 'This request has already been cancelled.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } else if (errMsg.includes('completed')) {
          dialog('Cannot Cancel', 'This request has already been completed and cannot be cancelled.');
          fetchDetails();
        } else if (errMsg.includes('accepted') || errMsg.includes('in-progress') || errMsg.includes('in progress')) {
          dialog('Cancellation Note', result.error || 'This request is already in progress. The provider has been notified about the cancellation.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } else {
          dialog('Unable to Cancel', result.error || 'Failed to cancel request. Please try again.');
        }
      }
    } catch (error) {
      setCancelling(false);
      console.error('[Cancel] Error:', error);
      dialog('Connection Error', 'We\'re having trouble connecting. Please try again.');
    }
  }, [request, getUserId, navigation, isEventService, isEmergencyService, isProvider]);

  const handleCall = useCallback(() => {
    const callerIsProvider = isProvider;
    let phone, contactName;
    if (callerIsProvider) {
      phone = request?.userDetails?.phone || request?.userDetails?.verifiedPhone || request?.userPhone;
      contactName = request?.userDetails?.name || request?.userName || 'Customer';
    } else {
      phone = request?.providerDetails?.phone || request?.providerDetails?.verifiedPhone || request?.providerPhone;
      contactName = request?.providerDetails?.name || request?.providerName || 'Provider';
    }
    if (!phone) { dialog('Phone Not Available', 'The phone number is not available yet. Please try again later.'); return; }
    const phoneNumber = phone.replace(/\s/g, '');
    const url = `tel:${phoneNumber}`;
    dialog(
      `Call ${callerIsProvider ? 'Customer' : 'Provider'}`,
      `Call ${contactName} at ${phone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call Now', onPress: () => { Linking.openURL(url).catch(() => { dialog('Error', 'Unable to make phone calls on this device'); }); } },
      ]
    );
  }, [isProvider, request]);

  const handleGetProviderLocation = useCallback(() => {
    const providerDetails = request?.providerDetails;
    const providerIdValue = request?.providerId || request?.assignedProviderId || providerDetails?._id || providerDetails?.providerId;
    if (!providerIdValue) { dialog('Location Not Available', 'Provider ID is not available at the moment.'); return; }
    let serviceLocation = null;
    if (request?.location?.coordinates && Array.isArray(request.location.coordinates) && request.location.coordinates.length === 2) {
      const [lng, lat] = request.location.coordinates;
      serviceLocation = { latitude: lat, longitude: lng };
    } else if (request?.location?.latitude && request?.location?.longitude) {
      serviceLocation = { latitude: request.location.latitude, longitude: request.location.longitude };
    } else if (request?.eventLocation?.coordinates) {
      const coords = request.eventLocation.coordinates;
      if (coords.latitude && coords.longitude) serviceLocation = { latitude: coords.latitude, longitude: coords.longitude };
      else if (Array.isArray(coords) && coords.length === 2) serviceLocation = { latitude: coords[1], longitude: coords[0] };
    }
    navigation.navigate('LiveTracking', {
      requestId: request._id,
      providerId: providerIdValue,
      providerName: providerDetails?.name || 'Provider',
      providerPhone: providerDetails?.phone,
      serviceCategory: request.serviceCategory || request.category || request.serviceType,
      serviceLocation: serviceLocation,
      serviceAddress: request.serviceAddress || request.address || request.location?.address || request.eventLocation?.address || '',
    });
  }, [request, navigation]);

  const handleAcceptRequest = useCallback(() => {
    const serviceLabel = SERVICE_TYPE_LABELS[request?.serviceType] || request?.serviceType;
    const providerId = user?.mongoId || user?.javaUserId || profile?.mongoId || profile?._id;
    const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
    const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
    const isEventReq = request?.isEventService || EVENT_SERVICE_TYPES.includes(request?.serviceType);
    const isEmergencyReq = request?.isEmergencyService || EMERGENCY_SERVICE_TYPES.includes(request?.serviceType);
    dialog('Accept Request', `Accept this ${serviceLabel} request?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          setAccepting(true);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000);
          try {
            let result;
            if (isEmergencyReq) {
              const response = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${request._id}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId, userEmail: request.userDetails?.email || '', estimatedArrival: 15 }), signal: controller.signal });
              result = await response.json();
              result.success = result.success || response.ok;
            } else if (isEventReq) {
              const response = await authFetch(`${NODE_BASE_URL}/api/event-services/${request._id}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId, userEmail: request.userDetails?.email || request.userEmail || '' }), signal: controller.signal });
              result = await response.json();
              result.success = result.success || result.statusCode === 200;
            } else {
              result = await acceptRequestAsProvider(request._id, providerId, request.userDetails?.email || '');
            }
            clearTimeout(timeoutId);
            if (result.success) {
              dialog('Request Accepted', 'You have accepted this request. The customer has been notified.');
              fetchDetails();
            } else {
              const errMsg = (result.error || result.message || '').toLowerCase();
              if (errMsg.includes('cancel')) {
                dialog('Request Cancelled', 'This request was cancelled by the customer and is no longer available.');
              } else if (errMsg.includes('expired') || errMsg.includes('timeout')) {
                dialog('Request Expired', 'This request has expired and is no longer available.');
              } else if (errMsg.includes('already') || errMsg.includes('accepted')) {
                dialog('Already Accepted', 'This request has already been accepted by another provider.');
              } else if (errMsg.includes('cannot') || errMsg.includes('not valid') || errMsg.includes('invalid')) {
                dialog('Request Unavailable', 'This request is no longer available. It may have been cancelled, expired, or accepted by another provider.');
              } else {
                dialog('Unable to Accept', result.error || result.message || 'This request could not be accepted. Please try again.');
              }
              fetchDetails();
            }
          } catch (error) {
            clearTimeout(timeoutId);
            console.error('[RequestDetail] Accept error:', error);
            const errMsg = (error.message || '').toLowerCase();
            if (error.name === 'AbortError') {
              dialog('Connection Timeout', 'Request timed out. Please check your connection and try again.');
            } else if (errMsg.includes('cancel')) {
              dialog('Request Cancelled', 'This request was cancelled by the customer and is no longer available.');
            } else if (errMsg.includes('cannot') || errMsg.includes('not valid')) {
              dialog('Request Unavailable', 'This request is no longer available. It may have been cancelled or expired.');
            } else {
              dialog('Connection Error', 'We\'re having trouble connecting. Please try again.');
            }
          } finally { setAccepting(false); }
        },
      },
    ]);
  }, [request, user, profile, fetchDetails]);

  const handleRejectRequest = useCallback(() => {
    const serviceLabel = SERVICE_TYPE_LABELS[request?.serviceType] || request?.serviceType;
    const providerId = user?.mongoId || user?.javaUserId || profile?.mongoId || profile?._id;
    const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
    const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
    const isEventReq = request?.isEventService || EVENT_SERVICE_TYPES.includes(request?.serviceType);
    const isEmergencyReq = request?.isEmergencyService || EMERGENCY_SERVICE_TYPES.includes(request?.serviceType);
    dialog('Reject Request', `Are you sure you want to reject this ${serviceLabel} request? The customer will be notified.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setRejecting(true);
          try {
            let result;
            if (isEmergencyReq) {
              const response = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${request._id}/provider-reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
              result = await response.json();
              result.success = result.success || response.ok;
            } else if (isEventReq) {
              const response = await authFetch(`${NODE_BASE_URL}/api/event-services/${request._id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
              result = await response.json();
              result.success = result.success || result.statusCode === 200 || response.ok;
            } else {
              const response = await authFetch(`${NODE_BASE_URL}/api/traditional-services/${request._id}/provider-reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
              result = await response.json();
              result.success = result.success || response.ok;
            }
            if (result.success) {
              dialog('Request Rejected', 'You have rejected this request. The customer has been notified.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
            } else {
              const errMsg = (result.error || result.message || '').toLowerCase();
              if (errMsg.includes('cancel')) {
                dialog('Already Cancelled', 'This request was already cancelled by the customer.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
              } else {
                dialog('Unable to Reject', result.error || result.message || 'Could not reject this request. Please try again.');
              }
            }
          } catch (error) {
            console.error('[RequestDetail] Reject error:', error);
            dialog('Connection Error', 'We\'re having trouble connecting. Please try again.');
          }
          finally { setRejecting(false); }
        },
      },
    ]);
  }, [request, user, profile, navigation]);

  const handleResendOtp = useCallback(async () => {
    dialog('Resend OTP', 'A new OTP will be sent to your email.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send OTP',
        onPress: async () => {
          try {
            const result = await resendCompletionOtp(request._id);
            if (result.success) { dialog('OTP Sent', 'A new completion OTP has been sent to your email.'); handleRefresh(); }
            else { dialog('Error', result.error || 'Failed to resend OTP'); }
          } catch (error) { console.error('[ResendOTP] Error:', error); dialog('Error', 'Something went wrong. Please try again.'); }
        },
      },
    ]);
  }, [request?._id, handleRefresh]);

  const handleVerifyOtp = useCallback(async () => {
    if (enteredOtp.length !== 6) { dialog('Invalid OTP', 'Please enter a valid 6-digit OTP'); return; }
    setVerifyingOtp(true);
    try {
      const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
      const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
      const isEventServiceRequest = isEventService || request?.isEventService || EVENT_SERVICE_TYPES.includes(request?.serviceType);
      const isEmergencyServiceRequest = isEmergencyService || request?.isEmergencyService || EMERGENCY_SERVICE_TYPES.includes(request?.serviceType);
      console.log('[VerifyOTP] Service type detection:', { serviceType: request?.serviceType, isEventService: isEventServiceRequest, isEmergencyService: isEmergencyServiceRequest });
      let result;
      if (isEmergencyServiceRequest) {
        console.log('[VerifyOTP] Using emergency-service endpoint');
        const response = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${request._id}/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp: enteredOtp }) });
        result = await response.json();
        if (!response.ok) result.success = false;
        else result.success = result.success !== false;
      } else if (isEventServiceRequest) {
        console.log('[VerifyOTP] Using event-service endpoint');
        result = await verifyEventCompletionOtp(request._id, enteredOtp);
      } else {
        console.log('[VerifyOTP] Using traditional-service endpoint');
        result = await verifyCompletionOtp(request._id, enteredOtp);
      }
      if (result.success) {
        dialog('Service Completed!', 'The service has been marked as completed successfully.', [{ text: 'OK', onPress: () => { setEnteredOtp(''); handleRefresh(); } }]);
      } else if (result.code === 'OTP_EXPIRED') {
        dialog('OTP Expired', 'The OTP has expired. Please request a new one.', [{ text: 'OK', onPress: () => setEnteredOtp('') }]);
      } else {
        dialog('Verification Failed', result.error || 'Invalid OTP. Please try again.');
      }
    } catch (error) { console.error('[VerifyOTP] Error:', error); dialog('Error', 'Something went wrong. Please try again.'); }
    finally { setVerifyingOtp(false); }
  }, [request?._id, enteredOtp, handleRefresh, isEventService, isEmergencyService, request?.isEventService, request?.isEmergencyService]);

  const handleSubmitRating = useCallback(async (requestId, rating, review) => {
    const userId = getUserId();
    if (!requestId || !userId) return { success: false, error: 'Missing request or user information' };
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) return { success: false, error: 'Please select a valid rating (1-5 stars)' };
    const providerId = request?.providerId || request?.assignedProviderId || request?.providerDetails?._id || request?.assignedProviderDetails?._id || null;
    try {
      console.log('[Rating] Submitting provider rating:', { requestId, providerId });
      const result = await submitRating(requestId, userId, Math.round(rating), review || '', providerId);
      if (result.success) {
        const finalRating = result.alreadyRated ? result.existingRating : rating;
        setRequest(prev => ({ ...prev, _rated: true }));
        setRatingStatus({ rated: true, rating: { rating: finalRating, review } });
      }
      return result;
    } catch (error) { console.error('[Rating] Error:', error); return { success: false, error: error.message || 'Failed to submit rating' }; }
  }, [getUserId, request]);

  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!request?.providerId && !request?.assignedProviderDetails?._id) return;
      const userId = getUserId();
      if (!userId) return;
      const providerId = request?.providerId || request?.assignedProviderDetails?._id;
      const result = await checkIsFavorite(userId, providerId);
      if (result.success) setIsFavorited(result.isFavorite);
    };
    if (request?.status === 'completed' && !isProvider) checkFavoriteStatus();
  }, [request?.providerId, request?.assignedProviderDetails?._id, request?.status, request?.serviceType, getUserId, isProvider]);

  const handleToggleFavorite = useCallback(async () => {
    const userId = getUserId();
    const providerId = request?.providerId || request?.assignedProviderDetails?._id;
    if (!userId || !providerId) { dialog('Error', 'Unable to update favorites. Please try again.'); return; }
    setTogglingFavorite(true);
    try {
      let result;
      if (isFavorited) { result = await removeFromFavorites(userId, providerId, request?.serviceType); }
      else {
        const providerName = request?.providerDetails?.name || request?.assignedProviderDetails?.name || 'Provider';
        result = await addToFavorites(userId, providerId, request?.serviceType, `Saved from ${SERVICE_TYPE_LABELS[request?.serviceType] || request?.serviceType} service`);
      }
      if (result.success) {
        setIsFavorited(!isFavorited);
        dialog(isFavorited ? 'Removed from Favorites' : 'Added to Favorites', isFavorited ? 'Provider has been removed from your favorites.' : 'Provider has been added to your favorites. They will appear at the top when you search for this service.', [{ text: 'OK' }]);
      } else { dialog('Error', result.error || 'Failed to update favorites'); }
    } catch (error) { console.error('[Favorites] Toggle error:', error); dialog('Error', 'Failed to update favorites'); }
    finally { setTogglingFavorite(false); }
  }, [getUserId, request, isFavorited]);

  const [ratingCheckLoading, setRatingCheckLoading] = useState(false);
  const hasRated = request?._rated || ratingStatus.rated;
  const canRate = !isProvider && request?.status === 'completed' && !hasRated && !ratingCheckLoading;

  useEffect(() => {
    if (request?._id && request?.status === 'completed' && !isProvider) {
      setRatingCheckLoading(true);
      checkRatingStatus(request._id)
        .then(setRatingStatus)
        .catch(() => {})
        .finally(() => setRatingCheckLoading(false));
    }
  }, [request?._id, request?.status, isProvider]);

  // ─── Loading state ─────────────────────────────────────────────────
  if (loading) {
    const insets = useSafeAreaInsets();
    return (
      <View style={[s.screenContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={s.loadingWrap}><ActivityIndicator size="large" color={BRAND.primary} /><Text style={s.loadingText}>Loading details...</Text></View>
      </View>
    );
  }
  if (!request) {
    const insets = useSafeAreaInsets();
    return (
      <View style={[s.screenContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={s.errorWrap}>
          <Icon name="error" size={52} color="#EF4444" />
          <Text style={s.errorTitle}>Request Not Found</Text>
          <TouchableOpacity style={s.goBackBtn} onPress={() => navigation.goBack()}><Text style={s.goBackBtnText}>Go Back</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const rawServiceDate = request.serviceDate || request.eventDate || request.assignedAt || request.createdAt;
  const serviceDate = rawServiceDate ? new Date(rawServiceDate) : null;
  const createdAt = request.createdAt ? new Date(request.createdAt) : null;
  const serviceTime = request.serviceTime || null;
  const isActive = ['pending', 'accepted', 'in-progress'].includes(request.status);
  const showOtp = !isProvider && request.completionOtp && ['accepted', 'in-progress'].includes(request.status);
  const canCancel = !isProvider && isActive;

  const insets = useSafeAreaInsets();

  return (
    <View style={s.screenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      {/* ─── Simple Fixed Header ────────────────────────────────── */}
      <View style={[s.headerOuter, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTopRow}>
          <TouchableOpacity style={s.headerBackBtn} onPress={() => navigation.goBack()}>
            <Icon name="back" size={20} color={BRAND.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={s.headerServiceName} numberOfLines={1}>{SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}</Text>
            <View style={[s.rowCenter, { gap: 6, marginTop: 2 }]}>
              <Text style={s.headerRequestId}>#{request.requestId}</Text>
              {isEventService && (
                <View style={s.headerEventBadge}><Text style={s.headerEventBadgeText}>EVENT</Text></View>
              )}
              {isEmergencyService && (
                <View style={s.headerEmergencyBadge}><Text style={s.headerEmergencyBadgeText}>EMERGENCY</Text></View>
              )}
            </View>
          </View>
          <View style={[s.headerStatusBadge, { backgroundColor: status.bgColor }]}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: status.color, marginRight: 6 }} />
            <Text style={[s.headerStatusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[BRAND.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Description Pill — only show for terminal states */}
        {!['accepted', 'in-progress'].includes(request.status) && (
          <View style={[s.statusPill, { backgroundColor: status.bgColor }]}>
            <Text style={[s.statusPillText, { color: status.color }]}>{getStatusDescription(request.status, isProvider)}</Text>
          </View>
        )}

        {/* Accept / Reject (provider pending) */}
        {isProvider && ['pending', 'awaiting_confirmation'].includes(request.status) && (
          <View style={s.acceptRejectCard}>
            <Text style={s.acceptRejectTitle}>Respond to request</Text>
            <View style={s.acceptRejectRow}>
              <TouchableOpacity style={s.rejectBtn} onPress={handleRejectRequest} disabled={rejecting || accepting}>
                {rejecting ? <ActivityIndicator size="small" color="#DC2626" /> : (<><Icon name="close" size={16} color="#DC2626" /><Text style={s.rejectBtnText}>Reject</Text></>)}
              </TouchableOpacity>
              <TouchableOpacity style={s.acceptBtn} onPress={handleAcceptRequest} disabled={accepting || rejecting}>
                {accepting ? <ActivityIndicator size="small" color="#FFFFFF" /> : (<><Icon name="check" size={16} color="#FFFFFF" /><Text style={s.acceptBtnText}>Accept</Text></>)}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Status Timeline */}
        <StatusTimeline currentStatus={request.status} isProvider={isProvider} cancelledBy={request.cancelledBy} />

        {/* Cancellation Details */}
        <CancellationInfoCard request={request} isProvider={isProvider} />

        {/* OTP Section (user) */}
        {showOtp && <OtpDisplay otp={request.completionOtp} expiresAt={request.otpExpiresAt} onResend={handleResendOtp} />}

        {/* Provider Compact Action Card — Directions | Call | Location Toggle | OTP */}
        {isProvider && ['accepted', 'in-progress'].includes(request.status) && (() => {
          const hasCoords = request.location?.coordinates || request.location?.latitude || request.eventLocation?.coordinates || request.eventLocation?.latitude;
          const handleDirections = () => {
            let lat, lng;
            if (request.location?.coordinates && Array.isArray(request.location.coordinates) && request.location.coordinates.length === 2) {
              [lng, lat] = request.location.coordinates;
            } else if (request.location?.latitude && request.location?.longitude) {
              lat = request.location.latitude; lng = request.location.longitude;
            } else if (request.eventLocation?.coordinates) {
              const coords = request.eventLocation.coordinates;
              if (Array.isArray(coords) && coords.length === 2) { [lng, lat] = coords; }
              else if (coords.latitude && coords.longitude) { lat = coords.latitude; lng = coords.longitude; }
            } else if (request.eventLocation?.latitude && request.eventLocation?.longitude) {
              lat = request.eventLocation.latitude; lng = request.eventLocation.longitude;
            }
            if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
              const label = encodeURIComponent(request.serviceAddress || request.location?.address || 'Service Location');
              const url = Platform.select({ ios: `maps:0,0?q=${lat},${lng}(${label})`, android: `google.navigation:q=${lat},${lng}` });
              Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`));
            }
          };
          return (
            <View style={s.compactActionCard}>
              {/* Row 1: Action Buttons */}
              <View style={s.compactActionRow}>
                {hasCoords && (
                  <TouchableOpacity style={s.compactActionBtn} onPress={handleDirections} activeOpacity={0.7}>
                    <View style={[s.compactActionIcon, { backgroundColor: '#EFF6FF' }]}>
                      <Icon name="directions" size={18} color={BRAND.secondary} />
                    </View>
                    <Text style={s.compactActionLabel}>Directions</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.compactActionBtn} onPress={handleCall} activeOpacity={0.7}>
                  <View style={[s.compactActionIcon, { backgroundColor: '#ECFDF5' }]}>
                    <Icon name="phone" size={18} color={BRAND.success} />
                  </View>
                  <Text style={s.compactActionLabel}>Call</Text>
                </TouchableOpacity>
                {!isEmergencyService && (
                  <TouchableOpacity
                    style={s.compactActionBtn}
                    onPress={() => !locationSharingLoading && handleToggleLocationSharing(!locationSharingEnabled)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.compactActionIcon, { backgroundColor: locationSharingEnabled ? '#D1FAE5' : '#F1F5F9' }]}>
                      {locationSharingLoading ? (
                        <ActivityIndicator size={16} color={BRAND.secondary} />
                      ) : (
                        <Icon name="location" size={18} color={locationSharingEnabled ? BRAND.success : BRAND.textMuted} />
                      )}
                    </View>
                    <Text style={[s.compactActionLabel, locationSharingEnabled && { color: BRAND.success, fontWeight: '700' }]}>
                      {locationSharingEnabled ? 'Sharing' : 'Share'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Location sharing status (compact) */}
              {locationSharingEnabled && !isEmergencyService && (
                <View style={[s.locSharingActiveBox, { marginTop: 10 }]}>
                  <View style={[s.rowCenter, { gap: 8 }]}>
                    <PulsingDot color={BRAND.success} size={4} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#065F46' }}>Live — customer can see your location</Text>
                  </View>
                </View>
              )}

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />

              {/* Row 2: OTP Entry */}
              <View style={[s.rowCenter, { gap: 8, marginBottom: 8 }]}>
                <View style={s.providerOtpIconCircle}><Icon name="lock" size={16} color="#8B5CF6" /></View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#5B21B6' }}>Complete Service</Text>
              </View>
              <View style={s.providerOtpInputRow}>
                <TextInput style={s.providerOtpInput} value={enteredOtp} onChangeText={setEnteredOtp} placeholder="000000" placeholderTextColor="#D1D5DB" keyboardType="number-pad" maxLength={6} />
                <TouchableOpacity style={[s.providerOtpBtn, enteredOtp.length === 6 ? s.providerOtpBtnEnabled : s.providerOtpBtnDisabled]} onPress={handleVerifyOtp} disabled={enteredOtp.length !== 6 || verifyingOtp}>
                  {verifyingOtp ? <ActivityIndicator size="small" color="#FFFFFF" /> : (<><Icon name="check" size={15} color={enteredOtp.length === 6 ? '#FFFFFF' : '#94A3B8'} /><Text style={[s.providerOtpBtnText, enteredOtp.length !== 6 && s.providerOtpBtnTextDisabled]}>Complete</Text></>)}
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* Provider Card (user view) — Track button removed; use Provider Location card below */}
        {!isProvider && request.providerDetails && (
          <ProviderCard
            provider={request.providerDetails}
            onCall={handleCall}
            showActions={['pending', 'accepted', 'in-progress'].includes(request.status)}
          />
        )}

        {/* Sent to provider — awaiting acceptance */}
        {!isProvider && !request.providerDetails && (request.assignedProviderId || request.providerId || request.lastSentProviderId || request.sentAt) && request.status === 'pending' && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>REQUEST SENT TO</Text>

            {/* Provider info */}
            {sentProviderDetails ? (
              <View style={[s.rowCenter, { marginBottom: 14 }]}>
                <View style={{ position: 'relative', marginRight: 12 }}>
                  {resolveProfilePic(sentProviderDetails.profilePicture) || resolveProfilePic(sentProviderDetails.profileImage) ? (
                    <Image source={{ uri: resolveProfilePic(sentProviderDetails.profilePicture) || resolveProfilePic(sentProviderDetails.profileImage) }} style={s.providerAvatarImg} />
                  ) : (
                    <View style={s.providerAvatarFallback}>
                      <Text style={s.providerAvatarChar}>{sentProviderDetails.name?.charAt(0).toUpperCase() || 'P'}</Text>
                    </View>
                  )}
                  {(sentProviderDetails.isVerified || sentProviderDetails.verified) && (
                    <View style={s.verifiedBadge}><Icon name="verified" size={10} color="#FFFFFF" /></View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.providerName}>{sentProviderDetails.name}</Text>
                  <View style={[s.rowCenter, { gap: 8, marginTop: 3 }]}>
                    {(sentProviderDetails.ratings?.average || sentProviderDetails.rating) > 0 && (
                      <View style={[s.rowCenter, { gap: 3 }]}>
                        <Icon name="star" size={13} color="#F59E0B" />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: BRAND.text }}>{(sentProviderDetails.ratings?.average || sentProviderDetails.rating || 0).toFixed(1)}</Text>
                        {(sentProviderDetails.ratings?.total || sentProviderDetails.totalRatings || 0) > 0 && (
                          <Text style={{ fontSize: 11, color: BRAND.textMuted }}>({sentProviderDetails.ratings?.total || sentProviderDetails.totalRatings})</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <View style={[s.rowCenter, { gap: 10, marginBottom: 14 }]}>
                <View style={[s.noProviderIcon, { backgroundColor: '#EFF6FF', borderColor: BRAND.secondary + '30' }]}>
                  <Icon name="send" size={20} color={BRAND.secondary} />
                </View>
                <View style={s.noProviderInfo}>
                  <Text style={s.noProviderTitle}>Request Sent</Text>
                  <Text style={s.noProviderDesc}>Loading provider details...</Text>
                </View>
              </View>
            )}

            {/* Waiting status pill */}
            <View style={s.waitingPill}>
              <PulsingDot color={BRAND.secondary} size={6} />
              <Text style={s.waitingPillText}>Waiting for provider to accept your request</Text>
            </View>

            {/* Cancel button */}
            <TouchableOpacity
              style={s.cancelSentBtn}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.7}
            >
              {cancelling ? (
                <ActivityIndicator color="#DC2626" size="small" />
              ) : (
                <>
                  <Icon name="close" size={16} color="#DC2626" />
                  <Text style={s.cancelSentBtnText}>Cancel Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Waiting for provider card (pending, no provider at all, not sent to anyone) */}
        {!isProvider && !request.providerDetails && !request.assignedProviderId && !request.providerId && !request.lastSentProviderId && !request.sentAt && request.status === 'pending' && (() => {
          const ageMs = Date.now() - new Date(request.createdAt).getTime();
          const isWithin30Min = ageMs < 30 * 60 * 1000;
          const minsLeft = Math.max(0, Math.ceil((30 * 60 * 1000 - ageMs) / 60000));
          return (
            <View style={s.card}>
              <Text style={s.sectionLabel}>NO PROVIDER SELECTED</Text>
              <View style={[s.rowCenter, s.noProviderRow]}>
                <View style={[s.noProviderIcon, isWithin30Min ? s.noProviderIconActive : s.noProviderIconExpiring]}>
                  <Icon name={isWithin30Min ? 'search' : 'clock'} size={22} color={isWithin30Min ? BRAND.primary : BRAND.danger} />
                </View>
                <View style={s.noProviderInfo}>
                  <Text style={s.noProviderTitle}>
                    {isWithin30Min ? 'Find a provider for this request' : 'Request expiring soon'}
                  </Text>
                  <Text style={s.noProviderDesc}>
                    {isWithin30Min
                      ? `You have ${minsLeft} min to find and book a provider before this request is auto-cancelled`
                      : 'This request will be automatically cancelled as no provider was selected'}
                  </Text>
                </View>
              </View>
              {isWithin30Min && (
                <TouchableOpacity
                  style={s.findProvidersBtn}
                  onPress={() => navigation.navigate('UserTabs', { screen: 'HomeTab', params: { resumeRequest: request } })}
                  activeOpacity={0.7}
                >
                  <Icon name="search" size={18} color="#fff" />
                  <Text style={s.findProvidersBtnText}>Find Providers</Text>
                </TouchableOpacity>
              )}
              {!isWithin30Min && (
                <View style={s.noProviderWarning}>
                  <Icon name="info" size={16} color={BRAND.danger} />
                  <Text style={s.noProviderWarningText}>Requests without a provider are auto-cancelled after 30 minutes.</Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* User-side Provider Location Status */}
        {!isProvider && !isEmergencyService && ['accepted', 'in-progress'].includes(request.status) && request.providerDetails && (() => {
          const scheduledTime = locationSharingData?.scheduledTime;
          const now = Date.now();
          const serviceMs = scheduledTime ? new Date(scheduledTime).getTime() : null;
          const msUntilService = serviceMs ? serviceMs - now : null;
          const AUTO_THRESHOLD = 45 * 60 * 1000;
          const isWithin45Min = msUntilService != null && msUntilService <= AUTO_THRESHOLD;
          let timeUntilLabel = '';
          if (msUntilService != null && msUntilService > 0) {
            const hrs = Math.floor(msUntilService / 3600000);
            const mins = Math.floor((msUntilService % 3600000) / 60000);
            if (hrs > 0) timeUntilLabel = `${hrs}h ${mins}m`;
            else timeUntilLabel = `${mins} min`;
          }
          let lastUpdateLabel = '';
          if (lastLocationUpdate) {
            const diffMs = now - lastLocationUpdate.getTime();
            if (diffMs < 10000) lastUpdateLabel = 'Just now';
            else if (diffMs < 60000) lastUpdateLabel = `${Math.floor(diffMs / 1000)}s ago`;
            else if (diffMs < 3600000) lastUpdateLabel = `${Math.floor(diffMs / 60000)}m ago`;
            else lastUpdateLabel = `${Math.floor(diffMs / 3600000)}h ago`;
          }
          if (locationSharingEnabled && providerLiveLocation) {
            return (
              <View style={s.card}>
                <View style={[s.rowCenter, { gap: 10, marginBottom: 12 }]}>
                  <View style={[s.iconCircle, { backgroundColor: '#D1FAE5' }]}><Icon name="location" size={18} color={BRAND.success} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND.text }}>Provider Location</Text>
                    <View style={[s.rowCenter, { gap: 5, marginTop: 2 }]}><PulsingDot color={BRAND.success} size={4} /><Text style={{ fontSize: 11, color: '#059669', fontWeight: '600' }}>Live -- sharing location</Text></View>
                  </View>
                </View>
                {lastUpdateLabel ? (<View style={[s.rowCenter, { gap: 6, marginBottom: 10, paddingLeft: 44 }]}><Icon name="clock" size={11} color={BRAND.textMuted} /><Text style={{ fontSize: 11, color: BRAND.textMuted }}>Updated {lastUpdateLabel}</Text></View>) : null}
                <TouchableOpacity style={s.trackLiveBtn} onPress={handleGetProviderLocation} activeOpacity={0.7}>
                  <Icon name="location" size={16} color="#FFFFFF" /><Text style={s.trackLiveBtnText}>Track Live Location</Text><Icon name="chevron-right" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            );
          } else if (locationSharingEnabled && !providerLiveLocation) {
            return (
              <View style={s.card}>
                <View style={[s.rowCenter, { gap: 10, marginBottom: 8 }]}>
                  <View style={[s.iconCircle, { backgroundColor: '#FEF3C7' }]}><ActivityIndicator size="small" color="#F59E0B" /></View>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '700', color: BRAND.text }}>Provider Location</Text><Text style={{ fontSize: 11, color: '#B45309' }}>Acquiring location...</Text></View>
                </View>
                <Text style={{ fontSize: 11, color: BRAND.textMuted, paddingLeft: 44, lineHeight: 17 }}>Provider has enabled location sharing. Their position will appear shortly.</Text>
                {locationAcquireTimeout && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: BRAND.secondary, borderRadius: 12, paddingVertical: 10, marginTop: 8 }}
                    onPress={() => { setLocationAcquireTimeout(false); fetchLocationSharingStatus(); }}
                  >
                    <Icon name="refresh" size={14} color="#FFFFFF" />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          } else {
            return (
              <View style={s.card}>
                <View style={[s.rowCenter, { gap: 10, marginBottom: 10 }]}>
                  <View style={[s.iconCircle, { backgroundColor: '#F1F5F9' }]}><Icon name="location" size={18} color={BRAND.textMuted} /></View>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '700', color: BRAND.text }}>Provider Location</Text><Text style={{ fontSize: 11, color: BRAND.textMuted }}>Not sharing yet</Text></View>
                </View>
                {!isWithin45Min && msUntilService != null && msUntilService > 0 ? (
                  <View style={s.infoBoxBlue}><Icon name="clock" size={13} color={BRAND.secondary} style={{ marginTop: 1 }} /><Text style={s.infoBoxBlueText}>Provider location will be available 45 min before service time.{timeUntilLabel ? ` Service in ${timeUntilLabel}.` : ''}</Text></View>
                ) : isWithin45Min || (msUntilService != null && msUntilService <= 0) ? (
                  <View style={s.infoBoxAmber}><Icon name="clock" size={13} color="#B45309" style={{ marginTop: 1 }} /><Text style={s.infoBoxAmberText}>Waiting for the provider to start sharing their location...</Text></View>
                ) : (
                  <View style={[s.infoBoxBlue, { backgroundColor: '#F1F5F9' }]}><Icon name="info" size={13} color={BRAND.textMuted} style={{ marginTop: 1 }} /><Text style={[s.infoBoxBlueText, { color: BRAND.textSecondary }]}>The provider will share their live location before the scheduled service time.</Text></View>
                )}
              </View>
            );
          }
        })()}

        {/* Customer Details (provider view) */}
        {isProvider && request.userDetails && (
          <View style={s.card}>
            <View style={[s.rowBetween, { marginBottom: 12 }]}>
              <Text style={[s.sectionLabel, { marginBottom: 0 }]}>CUSTOMER</Text>
              {request.userDetails.isRepeatCustomer && (
                <View style={s.repeatBadge}><Icon name="heart" size={10} color={BRAND.primary} /><Text style={s.repeatBadgeText}>Repeat</Text></View>
              )}
            </View>
            <View style={[s.rowCenter, { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BRAND.border }]}>
              {resolveProfilePic(request.userDetails.profilePicture) ? (
                <Image source={{ uri: resolveProfilePic(request.userDetails.profilePicture) }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#E5E7EB' }} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: BRAND.white }}>{request.userDetails.name?.charAt(0).toUpperCase() || 'C'}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={[s.rowCenter, { gap: 5 }]}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: BRAND.text }}>{request.userDetails.name || 'Customer'}</Text>
                  {request.userDetails.isVerified && <Icon name="verified" size={14} color={BRAND.success} />}
                </View>
                {request.userDetails.memberSince && <Text style={{ fontSize: 11, color: BRAND.textMuted, marginTop: 2 }}>Member since {request.userDetails.memberSince}</Text>}
                {request.userDetails.previousServicesWithProvider > 0 && (
                  <Text style={{ fontSize: 11, color: BRAND.primary, fontWeight: '500', marginTop: 2 }}>{request.userDetails.previousServicesWithProvider} previous service{request.userDetails.previousServicesWithProvider > 1 ? 's' : ''}</Text>
                )}
              </View>
            </View>
            {['pending', 'awaiting_confirmation', 'accepted', 'in-progress'].includes(request.status) && (
              <View style={{ marginBottom: 12 }}>
                {request.userDetails.email && (
                  <View style={[s.rowCenter, { gap: 8, paddingVertical: 4 }]}><Icon name="mail" size={13} color={BRAND.textMuted} /><Text style={{ fontSize: 12, color: BRAND.text }}>{request.userDetails.email}</Text></View>
                )}
                {(request.userDetails.address || request.userDetails.city) && (
                  <View style={[s.rowCenter, { gap: 8, paddingVertical: 4 }]}><Icon name="location" size={13} color={BRAND.textMuted} /><Text style={{ fontSize: 12, color: BRAND.text }}>{[request.userDetails.address, request.userDetails.city].filter(Boolean).join(', ')}</Text></View>
                )}
              </View>
            )}
            {(() => {
              const loc = request.location || request.eventLocation;
              const locAddr = request.serviceAddress || loc?.address || request.eventLocation?.address || request.address;
              if (!(loc?.coordinates || loc?.latitude || locAddr) || !['pending', 'awaiting_confirmation', 'accepted', 'in-progress'].includes(request.status)) return null;
              return (
                <View style={s.serviceLocationBox}>
                  <Text style={s.serviceLocationLabel}>SERVICE LOCATION</Text>
                  <View style={[s.rowCenter, { gap: 8, marginBottom: 8 }]}><Icon name="pin" size={13} color={BRAND.primary} /><Text style={{ flex: 1, fontSize: 12, color: BRAND.text, lineHeight: 17 }}>{locAddr || 'Service Location'}</Text></View>
                  <TouchableOpacity
                    style={s.openInMapsBtn}
                    onPress={() => {
                      let lat, lng;
                      const l = request.location || request.eventLocation;
                      if (l?.coordinates && Array.isArray(l.coordinates) && l.coordinates.length === 2) {
                        [lng, lat] = l.coordinates;
                      } else if (l?.latitude && l?.longitude) {
                        lat = l.latitude; lng = l.longitude;
                      } else if (request.eventLocation?.coordinates) {
                        const coords = request.eventLocation.coordinates;
                        if (Array.isArray(coords) && coords.length === 2) { [lng, lat] = coords; }
                        else if (coords.latitude && coords.longitude) { lat = coords.latitude; lng = coords.longitude; }
                      }
                      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                        const label = encodeURIComponent(locAddr || 'Service Location');
                        const url = Platform.select({
                          ios: `maps:0,0?q=${lat},${lng}(${label})`,
                          android: `google.navigation:q=${lat},${lng}`,
                        });
                        Linking.openURL(url).catch(() => {
                          Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
                        });
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon name="directions" size={14} color={BRAND.secondary} />
                    <Text style={s.openInMapsBtnText}>Open in Maps</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
            {['pending', 'awaiting_confirmation', 'accepted', 'in-progress'].includes(request.status) && (
              <TouchableOpacity style={s.callCustomerBtn} onPress={handleCall}>
                <Icon name="phone" size={15} color="#FFFFFF" /><Text style={s.callCustomerBtnText}>Call Customer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Request Details */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>REQUEST DETAILS</Text>
          {serviceDate && !isNaN(serviceDate.getTime()) && (() => {
            let dateStr = serviceDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            if (serviceTime && !isEmergencyService) {
              let h, m;
              const asDate = new Date(serviceTime);
              if (!isNaN(asDate.getTime()) && serviceTime.length > 5) { h = asDate.getHours(); m = asDate.getMinutes(); }
              else { [h, m] = String(serviceTime).split(':').map(Number); }
              if (!isNaN(h) && !isNaN(m)) {
                const period = h >= 12 ? 'PM' : 'AM';
                const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
                const displayMin = String(m).padStart(2, '0');
                dateStr += `  ·  ${displayHour}:${displayMin} ${period}`;
              }
            }
            return <InfoRow iconName="calendar" label={isEmergencyService ? "Requested On" : "Service Date"} value={dateStr} />;
          })()}
          {createdAt && !isNaN(createdAt.getTime()) && (
            <InfoRow iconName="clock" label="Created On" value={createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          )}
          {request.acceptedAt && (
            <InfoRow iconName="check" label="Accepted On" value={new Date(request.acceptedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          )}
          {request.completedAt && (
            <InfoRow iconName="celebration" label="Completed On" value={new Date(request.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          )}
          {request.description && <InfoRow iconName="description" label="Description" value={request.description} />}
          {isEventService && request.venue && <InfoRow iconName="place" label="Venue" value={request.venue} />}
          {isEventService && request.budget && <InfoRow iconName="currency-rupee" label="Budget" value={`₹${Number(request.budget).toLocaleString()}`} />}
          {isEventService && request.additionalRequirements && <InfoRow iconName="checklist" label="Additional Requirements" value={request.additionalRequirements} />}
          {isEmergencyService && request.urgencyLevel && <InfoRow iconName="warning" label="Urgency Level" value={request.urgencyLevel.charAt(0).toUpperCase() + request.urgencyLevel.slice(1)} />}
        </View>

        {/* Location Map — provider only, at bottom after request details */}
        {isProvider && ['pending', 'awaiting_confirmation', 'accepted', 'in-progress'].includes(request.status) && (request.location?.coordinates || request.location?.latitude) && (
          <LocationMapPreview location={request.location || request.eventLocation} address={request.serviceAddress || request.location?.address || request.eventLocation?.address || request.address || 'Service Location'} />
        )}

        {/* Pricing */}
        {(request.pricing?.estimatedCost || request.pricing?.actualCost) && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>PRICING</Text>
            {request.pricing.estimatedCost && (
              <View style={s.priceRow}><Text style={s.priceLabel}>Estimated Cost</Text><Text style={s.priceValue}>₹{request.pricing.estimatedCost.toLocaleString()}</Text></View>
            )}
            {request.pricing.actualCost && (
              <View style={[s.priceRow, s.priceRowFinal]}><Text style={s.priceLabelFinal}>Final Amount</Text><Text style={s.priceValueFinal}>₹{request.pricing.actualCost.toLocaleString()}</Text></View>
            )}
          </View>
        )}

        {/* Cancel Button */}
        {canCancel && (
          <TouchableOpacity
            style={[s.cancelActionBtn, ['accepted', 'in-progress'].includes(request.status) && s.cancelActionBtnWarning]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <Text style={s.cancelActionBtnText}>
                {['accepted', 'in-progress'].includes(request.status) ? 'Cancel Booking' : 'Cancel Request'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Completed Banner */}
        {request.status === 'completed' && (
          <View style={s.completedBanner}>
            <Icon name="celebration" size={28} color="#10B981" />
            <Text style={s.completedTitle}>Service Completed!</Text>
            <Text style={s.completedSub}>Thank you for using FixHomi.</Text>
          </View>
        )}

        {/* Rating Section */}
        {request.status === 'completed' && !isProvider && (
          <View style={s.card}>
            {ratingCheckLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <ActivityIndicator size="small" color={BRAND.primary} />
                <Text style={{ fontSize: 12, color: BRAND.textMuted, marginTop: 6 }}>Checking rating...</Text>
              </View>
            ) : hasRated ? (
              <View style={{ alignItems: 'center' }}>
                <View style={[s.rowCenter, { gap: 8, marginBottom: 10 }]}><Icon name="star" size={18} color="#F59E0B" /><Text style={{ fontSize: 14, fontWeight: '600', color: BRAND.text }}>You rated this provider</Text></View>
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map((star) => (<Icon key={star} name="star" size={24} color={star <= (ratingStatus.rating?.rating || 0) ? '#F59E0B' : '#E5E7EB'} />))}
                </View>
                {ratingStatus.rating?.review ? <Text style={{ fontSize: 12, color: BRAND.textSecondary, fontStyle: 'italic', textAlign: 'center' }}>"{ratingStatus.rating.review}"</Text> : null}
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.text, marginBottom: 4 }}>How was your experience?</Text>
                <Text style={{ fontSize: 13, color: BRAND.textSecondary, marginBottom: 14 }}>Help others by rating this provider</Text>
                <TouchableOpacity style={s.rateBtn} onPress={() => setRatingModalVisible(true)}>
                  <Icon name="star" size={16} color="#FFFFFF" /><Text style={s.rateBtnText}>Rate This Service</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Favorites */}
        {request.status === 'completed' && !isProvider && (request?.providerId || request?.assignedProviderDetails?._id) && (
          <TouchableOpacity style={[s.favBtn, isFavorited && s.favBtnActive]} onPress={handleToggleFavorite} disabled={togglingFavorite}>
            {togglingFavorite ? <ActivityIndicator color={isFavorited ? '#DC2626' : '#F59E0B'} size="small" /> : (
              <><Icon name={isFavorited ? 'favorite' : 'favorite-border'} size={16} color={isFavorited ? '#DC2626' : '#F59E0B'} /><Text style={[s.favBtnText, isFavorited && s.favBtnTextActive]}>{isFavorited ? 'Remove Favorite' : 'Add to Favorites'}</Text></>
            )}
          </TouchableOpacity>
        )}

        {/* Help */}
        <View style={[s.card, { alignItems: 'center' }]}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND.text, marginBottom: 4 }}>Need Help?</Text>
          <Text style={{ fontSize: 12, color: BRAND.textSecondary, textAlign: 'center', marginBottom: 10 }}>Contact support for any issues.</Text>
          <TouchableOpacity style={s.helpBtn}><Icon name="email" size={14} color={BRAND.secondary} /><Text style={s.helpBtnText}>Contact Support</Text></TouchableOpacity>
        </View>
      </ScrollView>

      {/* Rating Modal */}
      <RatingModal
        visible={ratingModalVisible}
        providerName={request?.providerDetails?.name || request?.assignedProviderDetails?.name}
        providerProfilePicture={request?.providerDetails?.profilePicture || request?.assignedProviderDetails?.profilePicture}
        serviceName={SERVICE_TYPE_LABELS[request?.serviceType] || request?.serviceType}
        requestId={request?._id}
        onClose={() => setRatingModalVisible(false)}
        onSubmit={handleSubmitRating}
      />

      {/* Cancellation Reason Modal */}
      <CancellationReasonModal
        visible={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        onSubmit={executeCancellation}
        cancellerRole={isProvider ? 'provider' : 'user'}
        loading={cancelling}
        serviceName={SERVICE_TYPE_LABELS[request?.serviceType] || request?.serviceType}
      />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   STYLES — Premium Uber/Ola-quality design system
   ═══════════════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  // Screen
  screenContainer: { flex: 1, backgroundColor: BRAND.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: BRAND.textSecondary },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: BRAND.text, marginTop: 12, marginBottom: 16 },
  goBackBtn: { backgroundColor: BRAND.secondary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  goBackBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Simple White Header
  headerOuter: { backgroundColor: BRAND.white, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', zIndex: 10 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerServiceName: { fontSize: 17, fontWeight: '700', color: BRAND.text },
  headerRequestId: { fontSize: 12, color: BRAND.textMuted, fontWeight: '500' },
  headerEventBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  headerEventBadgeText: { fontSize: 9, fontWeight: '700', color: '#7C3AED' },
  headerEmergencyBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  headerEmergencyBadgeText: { fontSize: 9, fontWeight: '700', color: '#DC2626' },
  headerStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  headerStatusText: { fontSize: 12, fontWeight: '700' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 44 },

  // Shared
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: BRAND.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // Card base
  card: { backgroundColor: BRAND.white, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: BRAND.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },

  // Status Pill
  statusPill: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 14 },
  statusPillText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // Timeline
  timelineContainer: { backgroundColor: BRAND.white, borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: BRAND.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  timelineCancelledPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: '#FECACA' },
  timelineCancelledIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: BRAND.danger, justifyContent: 'center', alignItems: 'center' },
  timelineCancelledText: { fontSize: 13, color: '#B91C1C', fontWeight: '600', letterSpacing: 0.1 },
  timeline: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 2, paddingTop: 2 },
  timelineStep: { alignItems: 'center', width: 52 },
  timelineConnectorWrapper: { flex: 1, justifyContent: 'center', paddingTop: 2, height: 32 },
  timelineConnector: { height: 3, backgroundColor: '#E2E8F0', borderRadius: 1.5 },
  timelineConnectorActive: { backgroundColor: BRAND.success },
  timelineCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0' },
  timelineCircleCompleted: { backgroundColor: BRAND.success, borderColor: BRAND.success, shadowColor: BRAND.success, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 },
  timelineCircleCurrent: { backgroundColor: BRAND.primary, borderColor: BRAND.primary, shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 },
  timelineNumber: { fontSize: 12, color: '#B0BEC5', fontWeight: '700', letterSpacing: -0.2 },
  timelineLabel: { marginTop: 8, fontSize: 11, color: BRAND.textMuted, textAlign: 'center', fontWeight: '500', letterSpacing: 0.1 },
  timelineLabelActive: { color: BRAND.text, fontWeight: '600' },
  timelineLabelCurrent: { color: BRAND.primary, fontWeight: '700' },

  // Cancellation Card
  cancellationCard: { backgroundColor: '#FEF2F2', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  cancellationHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cancellationIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  cancellationTitle: { fontSize: 15, fontWeight: '700', color: '#991B1B' },
  cancellationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, paddingLeft: 44 },
  cancellationRowText: { fontSize: 13, color: '#7F1D1D' },

  // Info Row
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: BRAND.background },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 12, color: BRAND.textMuted },
  infoValue: { flex: 1, fontSize: 13, color: BRAND.text, fontWeight: '600', textAlign: 'right', marginLeft: 12 },

  // OTP Card (User)
  otpCard: { backgroundColor: BRAND.white, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1.5, borderColor: '#DDD6FE', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  otpHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  otpHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  otpLockCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  otpHeaderTitle: { fontSize: 15, fontWeight: '700', color: '#5B21B6' },
  otpHeaderSub: { fontSize: 11, color: BRAND.textMuted },
  otpDigitsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 },
  otpDigitBox: { width: 44, height: 52, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E9D5FF', justifyContent: 'center', alignItems: 'center', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  otpDigit: { fontSize: 24, fontWeight: '800', color: '#5B21B6' },
  otpCopyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 },
  otpCopyText: { fontSize: 12, color: BRAND.textMuted, fontWeight: '500' },
  otpExpiryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 10 },
  otpExpiryText: { fontSize: 11, color: BRAND.textMuted },
  otpWarningStrip: { flexDirection: 'row', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 10, gap: 8 },
  otpWarningText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16, fontWeight: '500' },

  // OTP Expired
  otpExpiredCard: { backgroundColor: '#FEF2F2', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA', alignItems: 'center' },
  otpExpiredHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  otpExpiredIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  otpExpiredTitle: { fontSize: 16, fontWeight: '700', color: '#DC2626' },
  otpExpiredDesc: { fontSize: 13, color: '#7F1D1D', textAlign: 'center', marginBottom: 14, lineHeight: 18 },
  otpResendBtn: { flexDirection: 'row', backgroundColor: '#DC2626', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, gap: 6, alignItems: 'center' },
  otpResendBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Provider Card
  providerName: { fontSize: 16, fontWeight: '700', color: BRAND.text },
  providerAvatarImg: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB', borderWidth: 2.5, borderColor: BRAND.secondary + '30' },
  providerAvatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: BRAND.secondary, justifyContent: 'center', alignItems: 'center' },
  providerAvatarChar: { fontSize: 18, fontWeight: '700', color: BRAND.white },
  verifiedBadge: { position: 'absolute', bottom: -1, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: BRAND.success, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: BRAND.success, borderRadius: 14, paddingVertical: 11 },
  callBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  trackBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: BRAND.primary, borderRadius: 14, paddingVertical: 11 },
  trackBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // Map
  mapPreviewWrap: { height: 160, borderRadius: 20, overflow: 'hidden', marginBottom: 10, backgroundColor: '#F1F5F9' },
  mapPreview: { flex: 1 },
  mapLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  mapPinOuter: { width: 40, height: 44, alignItems: 'center', justifyContent: 'flex-start' },
  mapPinWrap: { alignItems: 'center' },
  mapPin: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
  mapPinShadow: { width: 12, height: 4, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.15)', marginTop: 1 },
  mapHint: { position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 4 },
  mapHintText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
  expandPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EFF6FF', borderRadius: 14, gap: 4 },
  expandPillText: { fontSize: 11, fontWeight: '600', color: BRAND.secondary },

  // Fullscreen Map
  fullMapContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  fullMap: { flex: 1 },
  fullMapPinWrap: { alignItems: 'center' },
  fullMapPin: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
  fullMapPinShadow: { width: 14, height: 5, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.2)', marginTop: 3 },
  fullMapTopBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(255,255,255,0.95)' },
  fullMapCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  fullMapTitle: { fontSize: 17, fontWeight: '700', color: BRAND.text },
  fullMapBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingTop: 18, paddingBottom: 34, paddingHorizontal: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },
  fullMapAddr: { flex: 1, fontSize: 14, color: BRAND.text, lineHeight: 20 },
  fullMapDirBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.secondary, paddingVertical: 13, borderRadius: 14, gap: 8 },
  fullMapDirText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Directions
  directionsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND.secondary, borderRadius: 14, paddingVertical: 12 },
  directionsBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Compact Action Card (provider)
  compactActionCard: { backgroundColor: BRAND.white, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: BRAND.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  compactActionRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  compactActionBtn: { alignItems: 'center', gap: 6, minWidth: 64 },
  compactActionIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  compactActionLabel: { fontSize: 11, fontWeight: '600', color: BRAND.text },

  // Provider OTP
  providerOtpCard: { backgroundColor: '#F5F3FF', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#DDD6FE' },
  providerOtpIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  providerOtpTitle: { fontSize: 15, fontWeight: '700', color: '#5B21B6' },
  providerOtpDesc: { fontSize: 12, color: BRAND.textSecondary, marginBottom: 12, lineHeight: 17 },
  providerOtpInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  providerOtpInput: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700', letterSpacing: 6, borderWidth: 1.5, borderColor: '#DDD6FE', textAlign: 'center' },
  providerOtpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, paddingHorizontal: 16 },
  providerOtpBtnEnabled: { backgroundColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  providerOtpBtnDisabled: { backgroundColor: '#E2E8F0' },
  providerOtpBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  providerOtpBtnTextDisabled: { color: '#94A3B8' },

  // Accept/Reject
  acceptRejectCard: { backgroundColor: BRAND.white, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 2, borderColor: BRAND.primary + '30', shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  acceptRejectTitle: { fontSize: 14, fontWeight: '700', color: BRAND.primary, marginBottom: 12, textAlign: 'center' },
  acceptRejectRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#FECACA' },
  rejectBtnText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  acceptBtn: { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: BRAND.primary, borderRadius: 14, paddingVertical: 13, shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  acceptBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Cancel
  cancelActionBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FFF5F5', marginBottom: 12 },
  cancelActionBtnWarning: { borderColor: '#FCA5A5' },
  cancelActionBtnText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },

  // Location sharing
  locSharingActiveBox: { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 12, gap: 6 },

  // No Provider Selected
  noProviderRow: { gap: 12, marginBottom: 12 },
  noProviderIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  noProviderIconActive: { backgroundColor: '#FFF7ED', borderColor: BRAND.primary + '30' },
  noProviderIconExpiring: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  noProviderInfo: { flex: 1 },
  noProviderTitle: { fontSize: 15, fontWeight: '700', color: BRAND.text },
  noProviderDesc: { fontSize: 12, color: BRAND.textMuted, marginTop: 3 },
  findProvidersBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND.secondary, borderRadius: 12, paddingVertical: 14 },
  findProvidersBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  waitingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: BRAND.secondary + '20' },
  waitingPillText: { fontSize: 13, fontWeight: '600', color: BRAND.secondary, flex: 1 },
  cancelSentBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: '#FECACA' },
  cancelSentBtnText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  noProviderWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12 },
  noProviderWarningText: { flex: 1, fontSize: 12, color: '#991B1B', lineHeight: 17 },

  // Info boxes
  infoBoxAmber: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 10 },
  infoBoxAmberText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 17, fontWeight: '500' },
  infoBoxBlue: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 10 },
  infoBoxBlueText: { flex: 1, fontSize: 11, color: '#1E40AF', lineHeight: 17, fontWeight: '500' },

  // Customer card extras
  repeatBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3E7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  repeatBadgeText: { fontSize: 10, fontWeight: '700', color: BRAND.primary },
  serviceLocationBox: { backgroundColor: '#FEF9F4', borderRadius: 14, padding: 10, marginBottom: 12 },
  serviceLocationLabel: { fontSize: 10, fontWeight: '700', color: BRAND.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  openInMapsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#DBEAFE' },
  openInMapsBtnText: { fontSize: 12, fontWeight: '600', color: BRAND.secondary },
  callCustomerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND.success, borderRadius: 14, paddingVertical: 12 },
  callCustomerBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // Track provider
  trackLiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.secondary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, gap: 8 },
  trackLiveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // Pricing
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  priceLabel: { fontSize: 13, color: BRAND.textSecondary },
  priceValue: { fontSize: 14, color: BRAND.text, fontWeight: '600' },
  priceRowFinal: { borderTopWidth: 1, borderTopColor: BRAND.border, marginTop: 6, paddingTop: 10 },
  priceLabelFinal: { fontSize: 15, fontWeight: '700', color: BRAND.text },
  priceValueFinal: { fontSize: 18, fontWeight: '800', color: BRAND.success },

  // Completed
  completedBanner: { backgroundColor: '#D1FAE5', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  completedTitle: { fontSize: 17, fontWeight: '800', color: '#065F46', marginTop: 8 },
  completedSub: { fontSize: 13, color: '#047857', textAlign: 'center', marginTop: 4 },

  // Rate
  rateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F59E0B', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  rateBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Favorites
  favBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 16, paddingVertical: 13, marginBottom: 12, borderWidth: 1, borderColor: '#F59E0B' },
  favBtnActive: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
  favBtnText: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  favBtnTextActive: { color: '#DC2626' },

  // Help
  helpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 14 },
  helpBtnText: { fontSize: 13, color: BRAND.secondary, fontWeight: '600' },
});

export default ServiceRequestDetailScreen;
