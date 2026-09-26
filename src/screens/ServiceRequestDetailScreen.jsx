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
import {  View,
  Text,
  StyleSheet,
  ScrollView,
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
  StatusBar
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Analytics, EV, onceEver } from '../services/analytics';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { useSupport } from '../context/SupportContext';
import { Icon, ServiceIcon, StatusIcon, RatingModal, CancellationReasonModal } from '../components';
import HelpSupportButton from '../components/HelpSupportButton';
import Svg, { Circle, Path } from 'react-native-svg';
import ScreenShimmer, { useShimmerAnimation, ShimmerBlock } from '../components/ShimmerLoader';
import { NODE_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';
import Mapbox from '@rnmapbox/maps';
import { initializeMapbox } from '../config/mapbox';
initializeMapbox();
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
  isTrackingRequest,
} from '../services/socketService';
import { setupForegroundMessageListener } from '../services/fcmService';
import {
  useTheme,
  useThemedStyles,
  useThemeColors,
  stableDark,
  iconAccent,
  medal,
  mapOverlay,
} from '../theme';
import { getMapStyleURL } from '../config/mapbox';

// Premium Design Language
// `primary` / `secondary` are also used with hex-alpha concatenation, so they must
// stay 6-digit hex in both themes -- asserted by the token tests.
const makeC = (c) => ({
  successBorder: c.successBorder,
  successDeep: c.successDeep,
  infoBorder: c.infoBorder,
  infoDeep: c.info,
  borderMedium: c.borderMedium,
  brandOrangeBorder: c.brandOrangeBorder,
  surface: c.surface,
  brandOrangeInk: c.brandOrangeInk,
  primary: c.brandOrange,
  secondary: c.brandBlue,
  onPrimary: c.onBrandOrange,
  onSecondary: c.onBrandBlue,
  white: c.surface,
  background: c.bg,
  sunken: c.surfaceSunken,
  // The shipped neutral hairline and chip fill were both #F1F5F9 -- exactly `bg` in
  // light, and a recessed seam on a dark surface.
  hairline: c.bg,
  border: c.bg,
  line: c.border,
  disabledFill: c.borderMedium,
  text: c.textStrongNeutral,
  textSecondary: c.textSecondary,
  textMuted: c.textMuted,
  muted: c.textMuted,
  neutral: c.textSecondary,
  info: c.info,
  blueBg: c.infoContainer,
  blueLine: c.infoBorder,
  infoFill: c.infoFill,
  success: c.success,
  onSuccess: c.onSuccess,
  successBg: c.successContainer,
  successLine: c.successBorder,
  successFill: c.successFill,
  danger: c.danger,
  onDanger: c.onDanger,
  dangerBg: c.dangerContainer,
  dangerLine: c.dangerBorder,
  dangerFill: c.dangerFill,
  warning: c.warning,
  warningBg: c.warningContainer,
  warningFill: c.warningFill,
  purple: c.accentViolet,
  purpleBg: c.accentVioletContainer,
  purpleLine: c.accentVioletBorder,
  purpleFill: c.accentVioletFill,
  // The Rate button keeps its gold fill; its label is dark ink because white on
  // gold measured 2.15:1.
  onGold: c.onBrandOrange,
  shadow: c.shadow,
});

const makeStatusConfig = (C) => ({
  pending: {
    label: 'Pending',
    color: C.warning,
    bgColor: C.warningFill,
    iconName: 'clock',
    userDescription: 'Waiting for a provider to accept your request',
    providerDescription: 'Customer is waiting for you to accept this request',
    step: 1,
  },
  accepted: {
    label: 'Accepted',
    color: C.info,
    bgColor: C.infoFill,
    iconName: 'check',
    userDescription: 'A provider has accepted your request',
    providerDescription: 'You have accepted this request',
    step: 2,
  },
  'in-progress': {
    label: 'In Progress',
    color: C.info,
    bgColor: C.infoFill,
    iconName: 'wrench',
    userDescription: 'The service is currently being performed',
    providerDescription: 'You are currently working on this service',
    step: 3,
  },
  completed: {
    label: 'Completed',
    color: C.success,
    bgColor: C.successFill,
    iconName: 'check-circle',
    userDescription: 'The service has been successfully completed',
    providerDescription: 'You have completed this service',
    step: 4,
  },
  cancelled: {
    label: 'Cancelled',
    color: C.danger,
    bgColor: C.dangerFill,
    iconName: 'close',
    userDescription: 'This request was cancelled',
    providerDescription: 'This request was cancelled',
    step: 0,
  },
  rejected: {
    label: 'Rejected',
    color: C.neutral,
    bgColor: C.hairline,
    iconName: 'block',
    userDescription: 'No providers were available for this request',
    providerDescription: 'This request was rejected',
    step: 0,
  },
  awaiting_confirmation: {
    label: 'Awaiting Confirmation',
    color: C.warning,
    bgColor: C.warningFill,
    iconName: 'hourglass-empty',
    userDescription: 'Waiting for the provider to confirm',
    providerDescription: 'Please confirm this emergency request',
    step: 1,
  },
  in_transit: {
    label: 'On the Way',
    color: C.info,
    bgColor: C.infoFill,
    iconName: 'directions-car',
    userDescription: 'The provider is on the way to you',
    providerDescription: 'You are on the way to the customer',
    step: 2,
  },
  arrived: {
    label: 'Arrived',
    color: C.success,
    bgColor: C.successFill,
    iconName: 'location-on',
    userDescription: 'The provider has arrived at your location',
    providerDescription: 'You have arrived at the customer location',
    step: 3,
  },
});

// Takes the resolved status config rather than reading a module constant: the
// colours in it are now theme-dependent, and this is a plain function that cannot
// call a hook.
const getStatusDescription = (STATUS_CONFIG, status, isProvider, cancelledBy, t) => {
  if (t && status === 'cancelled' && cancelledBy) {
    if (cancelledBy === 'user') {
      return isProvider ? t('detail.cancelledByCustomer') : t('detail.cancelledByYou');
    }
    if (cancelledBy === 'provider') {
      return isProvider ? t('detail.cancelledByYou') : t('detail.cancelledByProvider');
    }
    if (cancelledBy === 'system') {
      return t('detail.cancelledBySystem');
    }
  } else if (status === 'cancelled' && cancelledBy) {
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
const PulsingDot = ({ color, size = 8 }) => {
  const C = makeC(useThemeColors());
  // Resolved in the body, not as a default parameter: `C` is declared here, and a
  // default parameter evaluated before it would throw on every defaulted render.
  const dotColor = color || C.success;
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
      <Animated.View style={{ position: 'absolute', width: size * 2.5, height: size * 2.5, borderRadius: size * 1.25, backgroundColor: dotColor + '30', transform: [{ scale: pulseAnim }] }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dotColor }} />
    </View>
  );
};

/* ─── Cancellation Info Card ──────────────────────────────────────── */
const CancellationInfoCard = ({ request, isProvider }) => {
  const s = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const { t } = useLanguage();
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
          <Icon name="warning" size={18} color={C.danger} />
        </View>
        <Text style={s.cancellationTitle}>{t('detail.requestCancelled')}</Text>
      </View>
      {cancelledByLabel && (
        <View style={s.cancellationRow}>
          <Icon name="person" size={14} color={C.danger} />
          <Text style={s.cancellationRowText}>{t('detail.cancelledBy', { who: '' })}<Text style={{ fontWeight: '700' }}>{cancelledByLabel}</Text></Text>
        </View>
      )}
      {displayReason ? (
        <View style={s.cancellationRow}>
          <Icon name="info" size={14} color={C.danger} style={{ marginTop: 1 }} />
          <Text style={[s.cancellationRowText, { flex: 1, lineHeight: 18 }]}>{displayReason}</Text>
        </View>
      ) : null}
      {cancelledAt && !isNaN(cancelledAt.getTime()) && (
        <View style={s.cancellationRow}>
          <Icon name="clock" size={14} color={C.danger} />
          <Text style={[s.cancellationRowText, { fontSize: 12, color: C.danger }]}>
            {cancelledAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}
    </View>
  );
};

/* ─── Status Timeline ─────────────────────────────────────────────── */
const StatusTimeline = ({ currentStatus, isProvider = false, cancelledBy = null }) => {
  const s = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const STATUS_CONFIG = makeStatusConfig(C);
  const { t } = useLanguage();
  const status = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pending;
  const isCancelled = currentStatus === 'cancelled' || currentStatus === 'rejected';
  const steps = [
    { key: 'pending', label: t('detail.stepCreated'), step: 1 },
    { key: 'accepted', label: t('detail.stepAccepted'), step: 2 },
    { key: 'in-progress', label: t('detail.stepWorking'), step: 3 },
    { key: 'completed', label: t('detail.stepDone'), step: 4 },
  ];
  if (isCancelled) {
    return (
      <View style={s.timelineContainer}>
        <View style={s.timelineCancelledPill}>
          <View style={s.timelineCancelledIcon}>
            <Icon name="close" size={12} color={C.white} />
          </View>
          <Text style={s.timelineCancelledText}>{getStatusDescription(STATUS_CONFIG, currentStatus, isProvider, cancelledBy, t)}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={s.timelineContainer}>
      <Text style={s.sectionLabel}>{t('detail.progress')}</Text>
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
                    <Icon name="check" size={14} color={C.onPrimary} />
                  ) : isCurrent ? (
                    <PulsingDot color={C.white} size={5} />
                  ) : (
                    <Text style={s.timelineNumber}>{step.step}</Text>
                  )}
                </View>
                <Text
                  style={[
                    s.timelineLabel,
                    isActive && s.timelineLabelActive,
                    isCurrent && s.timelineLabelCurrent,
                  ]}
                  numberOfLines={1}
                >{step.label}</Text>
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
const InfoRow = ({ label, value, iconName }) => {
  const s = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  return (
    <View style={s.infoRow}>
      <View style={s.infoRowLeft}>
        <Icon name={iconName} size={15} color={C.textMuted} />
        <Text style={s.infoLabel}>{label}</Text>
      </View>
      <Text style={s.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
};

/* ─── OTP Display (User side) ─────────────────────────────────────── */
const OtpDisplay = ({ otp, expiresAt, onResend, resending }) => {
  const s = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [resendPressed, setResendPressed] = useState(false);
  const shimmerAnim = useShimmerAnimation();
  const isExpired = expiresAt && new Date(expiresAt) < new Date();
  const handleCopy = () => {
    if (otp && !resending) {
      Clipboard.setString(String(otp));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  const otpDigits = otp ? String(otp).split('') : [];
  if (isExpired && !resending) {
    return (
      <View style={s.otpExpiredCard}>
        <View style={s.otpExpiredHeader}>
          <View style={s.otpExpiredIconCircle}><Icon name="clock" size={22} color={C.danger} /></View>
          <Text style={s.otpExpiredTitle}>{t('detail.otpExpiredTitle')}</Text>
        </View>
        <Text style={s.otpExpiredDesc}>{t('detail.otpExpiredDesc')}</Text>
        <TouchableOpacity style={[s.otpResendBtn, resendPressed && { opacity: 0.6 }]} onPress={() => { if (resendPressed) return; setResendPressed(true); onResend(); setTimeout(() => setResendPressed(false), 5000); }} disabled={resendPressed}>
          <Icon name="refresh" size={15} color={C.danger} />
          <Text style={s.otpResendBtnText}>{resendPressed ? t('detail.requesting') : t('detail.requestNewOtp')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={s.otpCard}>
      <View style={s.otpHeaderRow}>
        <View style={s.otpHeaderLeft}>
          <View style={s.otpLockCircle}><Icon name="lock" size={16} color={C.purple} /></View>
          <Text style={s.otpHeaderTitle}>{t('detail.completionOtp')}</Text>
        </View>
        {resending ? (
          <Text style={[s.otpHeaderSub, { color: C.primary }]}>{t('detail.generating')}</Text>
        ) : (
          <Text style={s.otpHeaderSub}>{t('detail.shareWithProvider')}</Text>
        )}
      </View>
      {resending ? (
        <View style={s.otpDigitsRow}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={s.otpDigitBox}>
              <ShimmerBlock width={32} height={28} borderRadius={6} shimmerAnim={shimmerAnim} />
            </View>
          ))}
        </View>
      ) : (
        <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={s.otpDigitsRow}>
          {otpDigits.map((digit, i) => (
            <View key={i} style={s.otpDigitBox}>
              <Text style={s.otpDigit}>{digit}</Text>
            </View>
          ))}
        </TouchableOpacity>
      )}
      {!resending && (
        <TouchableOpacity onPress={handleCopy} style={s.otpCopyRow}>
          <Icon name={copied ? 'check' : 'copy'} size={13} color={copied ? C.success : C.textMuted} />
          <Text style={[s.otpCopyText, copied && { color: C.success }]}>{copied ? t('common.copied') : t('detail.tapToCopy')}</Text>
        </TouchableOpacity>
      )}
      {resending && (
        <View style={s.otpCopyRow}>
          <ActivityIndicator size={12} color={C.brandOrangeInk} />
          <Text style={[s.otpCopyText, { color: C.primary }]}>{t('detail.generatingNewOtp')}</Text>
        </View>
      )}
      {expiresAt && !resending && (
        <View style={s.otpExpiryRow}>
          <Icon name="timer" size={13} color={C.textMuted} />
          <Text style={s.otpExpiryText}>{t('detail.expires', { time: new Date(expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) })}</Text>
        </View>
      )}
      <View style={s.otpWarningStrip}>
        <Icon name="info" size={14} color={C.warning} />
        <Text style={s.otpWarningText}>{t('detail.otpWarning')}</Text>
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
  const s = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const { t } = useLanguage();
  if (!provider) return null;
  const profilePicUrl = resolveProfilePic(provider.profilePicture) || resolveProfilePic(provider.profileImage);
  const ratingValue = provider.ratings?.average || provider.rating || 0;
  const reviewCount = provider.ratings?.total || provider.totalRatings || 0;
  return (
    <View style={s.card}>
      <Text style={s.sectionLabel}>{t('detail.yourProvider')}</Text>
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
            <View style={s.verifiedBadge}><Icon name="verified" size={10} color={C.onSuccess} /></View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.providerName}>{provider.name}</Text>
          <View style={[s.rowCenter, { gap: 8, marginTop: 3 }]}>
            {ratingValue > 0 && (
              <View style={[s.rowCenter, { gap: 3 }]}>
                <Icon name="star" size={13} color={iconAccent.star} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{ratingValue.toFixed(1)}</Text>
                {reviewCount > 0 && <Text style={{ fontSize: 11, color: C.textMuted }}>({reviewCount})</Text>}
              </View>
            )}
            {showActions && (provider.phone || provider.verifiedPhone) && (
              <View style={[s.rowCenter, { gap: 3 }]}>
                <Icon name="phone" size={11} color={C.textMuted} />
                <Text style={{ fontSize: 11, color: C.textMuted }}>{provider.phone || provider.verifiedPhone}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      {showActions && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={s.callBtn} onPress={onCall}>
            <Icon name="phone" size={16} color={C.successDeep} />
            <Text style={s.callBtnText}>Call</Text>
          </TouchableOpacity>
          {onGetLocation && (
            <TouchableOpacity style={s.trackBtn} onPress={onGetLocation}>
              <Icon name="location" size={16} color={C.infoDeep} />
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
  const { isDark } = useTheme();
  const s = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const { t } = useLanguage();
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
        <Text style={s.sectionLabel}>{t('detail.serviceLocation')}</Text>
        <View style={[s.rowCenter, { gap: 8 }]}>
          <Icon name="location" size={16} color={C.danger} />
          <Text style={{ flex: 1, fontSize: 13, color: C.text, lineHeight: 19 }}>{address}</Text>
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
      <Text style={[s.sectionLabel, { marginBottom: 10 }]}>{t('detail.serviceLocation')}</Text>
      <View style={s.mapPreviewWrap}>
        {mapLoading && (<View style={s.mapLoadingOverlay}><ActivityIndicator size="small" color={C.secondary} /></View>)}
        <Mapbox.MapView style={s.mapPreview} styleURL={getMapStyleURL(isDark)} scrollEnabled={false} pitchEnabled={false} rotateEnabled={false} zoomEnabled={false} onDidFinishLoadingMap={() => setMapLoading(false)}>
          <Mapbox.Camera centerCoordinate={[lng, lat]} zoomLevel={15} animationDuration={0} />
          {Platform.OS === 'ios' ? (
            <Mapbox.MarkerView id="service-location" coordinate={[lng, lat]}>
              <View style={s.mapPinOuter}>
                <View style={s.mapPin}><Icon name="location" size={16} color={C.onDanger} /></View>
                <View style={s.mapPinShadow} />
              </View>
            </Mapbox.MarkerView>
          ) : (
            <Mapbox.PointAnnotation id="service-location" coordinate={[lng, lat]}>
              <View style={s.mapPinOuter}>
                <View style={s.mapPin}><Icon name="location" size={16} color={C.onDanger} /></View>
                <View style={s.mapPinShadow} />
              </View>
            </Mapbox.PointAnnotation>
          )}
        </Mapbox.MapView>
      </View>
      <View style={[s.rowCenter, { gap: 8, marginBottom: 10 }]}>
        <Icon name="location" size={15} color={C.danger} />
        <Text style={{ flex: 1, fontSize: 13, color: C.text, lineHeight: 19 }}>{address}</Text>
      </View>
      <TouchableOpacity style={s.directionsBtn} onPress={handleGetDirections} activeOpacity={0.7}>
        <Icon name="directions" size={18} color={C.infoDeep} />
        <Text style={s.directionsBtnText}>{t('detail.getDirections')}</Text>
      </TouchableOpacity>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN SCREEN COMPONENT — all business logic preserved exactly
   ═══════════════════════════════════════════════════════════════════════ */
const ServiceRequestDetailScreen = ({ navigation, route }) => {
  const { isDark } = useTheme();
  const s = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const STATUS_CONFIG = makeStatusConfig(C);
  const { t } = useLanguage();
  const { dialog } = useDialog();
  const { user, profile, userType } = useApp();
  const { openSupport } = useSupport();
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

  const serviceCategory = isEventService ? 'event' : isEmergencyService ? 'emergency' : 'traditional';

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
  const [resendingOtp, setResendingOtp] = useState(false);

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
    if (!reqId) return;
    if (!['accepted', 'in-progress', 'in_transit'].includes(request?.status)) return;
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
  }, [request?._id, request?.status, serviceCategory]);

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
          }, serviceCategory);
        } else {
          stopRequestLocationTracking(reqId);
          setProviderLiveLocation(null);
          setLastLocationUpdate(null);
        }
      } else {
        dialog(t('common.error'), result.error || t('common.somethingWentWrong'));
      }
    } catch (error) {
      console.error('[LocationSharing] Toggle error:', error);
      dialog(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setLocationSharingLoading(false);
    }
  }, [request?._id, getProviderId, serviceCategory]);

  // ─── Location Sharing: Fetch initial state on mount ─────────────────
  useEffect(() => {
    const reqId = request?._id;
    if (!reqId) return;
    if (!['accepted', 'in-progress', 'in_transit'].includes(request?.status)) return;
    fetchLocationSharingStatus();
    // NOTE: We do NOT stop location tracking on unmount here.
    // Provider location sharing must persist across screen navigations.
    // Tracking is stopped only when: provider toggles OFF, request completes/cancels, or provider logs out.
  }, [request?._id, request?.status, fetchLocationSharingStatus]);

  useEffect(() => {
    if (!isProvider) return;
    if (!['accepted', 'in-progress', 'in_transit'].includes(request?.status)) return;
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
  }, [isProvider, request?.status, locationSharingData?.scheduledTime, handleToggleLocationSharing]);

  useEffect(() => {
    if (!isProvider || !locationSharingEnabled || !request?._id) return;
    if (!['accepted', 'in-progress', 'in_transit'].includes(request?.status)) return;
    const providerId = getProviderId();
    if (!providerId) return;
    // Start tracking if not already tracking this request
    if (!isTrackingRequest(request._id)) {
      startRequestLocationTracking(request._id, providerId, (loc) => {
        setProviderLiveLocation(loc);
        setLastLocationUpdate(new Date());
      }, serviceCategory);
    }
    // Do NOT stop on unmount — tracking persists across screens.
    // Stopped only via explicit toggle OFF or request completion/cancellation.
  }, [isProvider, locationSharingEnabled, request?._id, request?.status, getProviderId, serviceCategory]);

  // Listen for real-time provider location updates (user side only)
  // request:location:status is handled in the main socket useEffect below (no status guard)
  useEffect(() => {
    if (isProvider || !request?._id) return;
    if (!['accepted', 'in-progress', 'in_transit'].includes(request?.status)) return;
    const cleanupLocation = addSocketListener('request:provider:location', (data) => {
      if (data?.requestId === request._id) {
        setProviderLiveLocation({ latitude: data.latitude, longitude: data.longitude, accuracy: data.accuracy });
        setLastLocationUpdate(new Date(data.timestamp || Date.now()));
      }
    });
    return () => { cleanupLocation(); };
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
    // Poll as fallback only until socket delivers the first location update
    const interval = setInterval(poll, 5000);
    const timeout = setTimeout(() => setLocationAcquireTimeout(true), 15000);
    return () => { cancelled = true; clearInterval(interval); clearTimeout(timeout); };
  }, [isProvider, locationSharingEnabled, providerLiveLocation, request?._id, serviceCategory]);

  // Clear timeout flag when location arrives
  useEffect(() => {
    if (providerLiveLocation) setLocationAcquireTimeout(false);
  }, [providerLiveLocation]);

  const hasDoneInitialLoad = useRef(false);
  const fetchDetails = useCallback(async () => {
    // Use initialRequest only for the very first render to show data instantly;
    // subsequent calls (from socket events, refreshes) always fetch fresh data
    if (!hasDoneInitialLoad.current && (isEventService || isEmergencyService) && initialRequest) {
      hasDoneInitialLoad.current = true;
      setRequest(initialRequest);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    hasDoneInitialLoad.current = true;
    // Always prefer MongoDB _id for API lookups (not human-readable requestId like TRD-xxx/EMR-xxx/EVT-xxx)
    const lookupId = request?._id || initialRequest?._id || route.params?.requestId;
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
      hasDoneInitialLoad.current = true; // Mark as loaded so socket-triggered fetches get fresh data
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
      addSocketListener('request:accepted', (data) => { if (data?.requestId === requestId) { console.log('[RequestDetail] Socket: request accepted'); debouncedFetchDetails(); fetchLocationSharingStatus(); } }),
      addSocketListener('request:completed', (data) => { if (data?.requestId === requestId) { console.log('[RequestDetail] Socket: request completed'); stopRequestLocationTracking(requestId); debouncedFetchDetails(); } }),
      addSocketListener('request:cancelled', (data) => { if (data?.requestId === requestId) { console.log('[RequestDetail] Socket: request cancelled'); stopRequestLocationTracking(requestId); debouncedFetchDetails(); } }),
      addSocketListener('request:status', (data) => { if (data?.requestId === requestId) { console.log('[RequestDetail] Socket: status update:', data.status); debouncedFetchDetails(); } }),
      addSocketListener('provider:assigned', (data) => { if (data?.requestId === requestId) { console.log('[RequestDetail] Socket: provider assigned'); debouncedFetchDetails(); } }),
      addSocketListener('provider:location', (data) => { console.log('[RequestDetail] Socket: provider location update'); }),
      // Handle location sharing status changes immediately (e.g., auto-enabled on acceptance)
      addSocketListener('request:location:status', (data) => {
        if (data?.requestId === requestId) {
          console.log('[RequestDetail] Socket: location sharing status:', data.enabled);
          setLocationSharingEnabled(data.enabled);
          locationSharingRef.current = data.enabled;
          if (!data.enabled) { setProviderLiveLocation(null); setLastLocationUpdate(null); }
        }
      }),
    ];
    return () => { unsubscribeFromRequest(requestId); cleanups.forEach(fn => fn()); };
  }, [request?._id, route.params?.requestId, debouncedFetchDetails, fetchLocationSharingStatus]);

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
        stopRequestLocationTracking(request?._id);
        const successMsg = result.details?.wasAccepted ? t('detail.cancelSuccessAccepted') : t('detail.cancelSuccessDefault');
        dialog(t('status.cancelled'), successMsg, [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
      } else {
        const errMsg = (result.error || '').toLowerCase();
        if (errMsg.includes('already cancel')) {
          dialog(t('detail.alreadyCancelled'), t('detail.alreadyCancelled'), [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
        } else if (errMsg.includes('completed')) {
          dialog(t('userHistory.cannotCancel'), t('detail.cannotCancelCompleted'));
          fetchDetails();
        } else if (errMsg.includes('accepted') || errMsg.includes('in-progress') || errMsg.includes('in progress')) {
          dialog(t('detail.cancellationNote'), result.error || t('detail.cancellationNote'), [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
        } else {
          dialog(t('userHistory.unableToCancel'), result.error || t('detail.unableToCancel'));
        }
      }
    } catch (error) {
      setCancelling(false);
      console.error('[Cancel] Error:', error);
      dialog(t('common.connectionError'), t('common.connectionErrorMsg'));
    }
  }, [request, getUserId, navigation, isEventService, isEmergencyService, isProvider]);

  const handleCall = useCallback(() => {
    const callerIsProvider = isProvider;
    let phone, contactName;
    if (callerIsProvider) {
      phone = request?.userDetails?.phone || request?.userDetails?.verifiedPhone || request?.userPhone;
      contactName = request?.userDetails?.name || request?.userName || t('providerHistory.customer');
    } else {
      phone = request?.providerDetails?.phone || request?.providerDetails?.verifiedPhone || request?.providerPhone;
      contactName = request?.providerDetails?.name || request?.providerName || t('eventServices.provider');
    }
    if (!phone) { dialog(t('detail.phoneNotAvailable'), t('detail.phoneNotAvailable')); return; }
    const phoneNumber = phone.replace(/\s/g, '');
    const url = `tel:${phoneNumber}`;
    dialog(
      t('detail.callDialogTitle', { role: callerIsProvider ? t('providerHistory.customer') : t('eventServices.provider') }),
      t('detail.callDialogMsg', { name: contactName, phone }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.callNow'), onPress: () => {
          if (callerIsProvider) {
            Analytics.track(EV.CUSTOMER_CALLED, { role: 'provider', request_id: String(request?._id || '') });
          }
          Linking.openURL(url).catch(() => { dialog(t('common.error'), t('detail.unableToCall')); });
        } },
      ]
    );
  }, [isProvider, request]);

  const handleGetProviderLocation = useCallback(() => {
    const providerDetails = request?.providerDetails;
    const providerIdValue = request?.providerId || request?.assignedProviderId || providerDetails?._id || providerDetails?.providerId;
    if (!providerIdValue) { dialog(t('detail.providerLocation'), t('detail.locationNotAvailable')); return; }
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
      isEmergencyService,
      isEventService,
    });
  }, [request, navigation]);

  const handleAcceptRequest = useCallback(() => {
    const serviceLabel = SERVICE_TYPE_LABELS[request?.serviceType] || request?.serviceType;
    const providerId = user?.mongoId || user?.javaUserId || profile?.mongoId || profile?._id;
    const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
    const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
    const isEventReq = request?.isEventService || EVENT_SERVICE_TYPES.includes(request?.serviceType);
    const isEmergencyReq = request?.isEmergencyService || EMERGENCY_SERVICE_TYPES.includes(request?.serviceType);
    dialog(t('providerHistory.acceptRequest'), t('providerHistory.acceptRequestMsg', { type: serviceLabel }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('providerHistory.accept'),
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
              // Analytics: emergency/event accepts bypass the instrumented
              // traditional-service function — log them here (traditional path
              // already logs inside acceptRequestAsProvider).
              if (isEmergencyReq || isEventReq) {
                Analytics.track(EV.JOB_REQUEST_ACCEPTED, { role: 'provider', request_id: String(request._id) });
              }
              // Start location tracking immediately on acceptance
              const cat = isEmergencyReq ? 'emergency' : isEventReq ? 'event' : 'traditional';
              startRequestLocationTracking(request._id, providerId, (loc) => {
                setProviderLiveLocation(loc);
                setLastLocationUpdate(new Date());
              }, cat);
              setLocationSharingEnabled(true);
              locationSharingRef.current = true;
              dialog(t('detail.requestAccepted'), t('detail.requestAcceptedMsg'));
              fetchDetails();
            } else {
              const errMsg = (result.error || result.message || '').toLowerCase();
              if (errMsg.includes('cancel')) {
                dialog(t('providerHistory.requestCancelled'), t('providerHistory.requestCancelledByCustomer'));
              } else if (errMsg.includes('expired') || errMsg.includes('timeout')) {
                dialog(t('providerHistory.requestExpired'), t('providerHistory.requestExpiredMsg'));
              } else if (errMsg.includes('already') || errMsg.includes('accepted')) {
                dialog(t('providerHistory.alreadyAccepted'), t('providerHistory.alreadyAcceptedMsg'));
              } else if (errMsg.includes('cannot') || errMsg.includes('not valid') || errMsg.includes('invalid')) {
                dialog(t('providerHistory.requestUnavailable'), t('providerHistory.requestUnavailableMsg'));
              } else {
                dialog(t('providerHistory.unableToAccept'), result.error || result.message || t('common.somethingWentWrong'));
              }
              fetchDetails();
            }
          } catch (error) {
            clearTimeout(timeoutId);
            console.error('[RequestDetail] Accept error:', error);
            const errMsg = (error.message || '').toLowerCase();
            if (error.name === 'AbortError') {
              dialog(t('detail.connectionTimeout'), t('detail.connectionTimeoutMsg'));
            } else if (errMsg.includes('cancel')) {
              dialog(t('providerHistory.requestCancelled'), t('providerHistory.requestCancelledByCustomer'));
            } else if (errMsg.includes('cannot') || errMsg.includes('not valid')) {
              dialog(t('providerHistory.requestUnavailable'), t('providerHistory.requestUnavailableMsg'));
            } else {
              dialog(t('common.connectionError'), t('common.connectionErrorMsg'));
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
    dialog(t('providerHistory.rejectRequest'), t('detail.rejectRequestMsg', { service: serviceLabel }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('providerHistory.reject'),
        style: 'destructive',
        onPress: async () => {
          setRejecting(true);
          try {
            let result;
            // ok && not explicitly failed — an HTTP 200 with {success:false} is a failure
            if (isEmergencyReq) {
              const response = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${request._id}/provider-reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
              result = await response.json();
              result.success = result.success === true || (response.ok && result.success !== false);
            } else if (isEventReq) {
              const response = await authFetch(`${NODE_BASE_URL}/api/event-services/${request._id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
              result = await response.json();
              result.success = result.success === true || (response.ok && result.success !== false);
            } else {
              const response = await authFetch(`${NODE_BASE_URL}/api/traditional-services/${request._id}/provider-reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
              result = await response.json();
              result.success = result.success === true || (response.ok && result.success !== false);
            }
            if (result.success) {
              Analytics.track(EV.JOB_REQUEST_REJECTED, { role: 'provider', request_id: String(request._id) });
              dialog(t('detail.requestRejected'), t('detail.requestRejectedMsg'), [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
            } else {
              const errMsg = (result.error || result.message || '').toLowerCase();
              if (errMsg.includes('cancel')) {
                dialog(t('detail.alreadyCancelled'), t('detail.alreadyCancelled'), [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
              } else {
                dialog(t('providerHistory.unableToReject'), result.error || result.message || t('common.somethingWentWrong'));
              }
            }
          } catch (error) {
            console.error('[RequestDetail] Reject error:', error);
            dialog(t('common.connectionError'), t('common.connectionErrorMsg'));
          }
          finally { setRejecting(false); }
        },
      },
    ]);
  }, [request, user, profile, navigation]);

  const handleResendOtp = useCallback(async () => {
    const isEventServiceRequest = isEventService || request?.isEventService;
    const isEmergencyServiceRequest = isEmergencyService || request?.isEmergencyService;
    dialog(t('detail.resendOtpTitle'), t('detail.resendOtpMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('detail.resendOtpBtn'),
        onPress: async () => {
          setResendingOtp(true);
          try {
            let result;
            if (isEventServiceRequest) {
              const response = await authFetch(`${NODE_BASE_URL}/api/event-services/${request._id}/resend-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
              result = await response.json();
              if (!response.ok) result.success = false;
            } else if (isEmergencyServiceRequest) {
              const response = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${request._id}/resend-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
              result = await response.json();
              if (!response.ok) result.success = false;
            } else {
              result = await resendCompletionOtp(request._id);
            }
            if (result.success) {
              await handleRefresh();
              dialog(t('detail.resendOtpTitle'), t('detail.otpGenerated'));
            } else {
              dialog(t('common.error'), result.error || result.message || t('detail.otpResendFail'));
            }
          } catch (error) {
            console.error('[ResendOTP] Error:', error);
            dialog(t('common.error'), t('common.somethingWentWrong'));
          } finally {
            setResendingOtp(false);
          }
        },
      },
    ]);
  }, [request?._id, isEventService, isEmergencyService, request?.isEventService, request?.isEmergencyService, handleRefresh]);

  const handleVerifyOtp = useCallback(async () => {
    if (enteredOtp.length !== 6) { dialog(t('detail.invalidOtpTitle'), t('detail.invalidOtpMsg')); return; }
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
        // Analytics: emergency/event completions bypass the instrumented
        // traditional-service function — log them here.
        if (isEmergencyServiceRequest || isEventServiceRequest) {
          Analytics.track(EV.SERVICE_COMPLETED, { role: 'provider', request_id: String(request._id) });
        }
        // Repeat customer served — backend-computed flag on the request
        if (request?.userDetails?.isRepeatCustomer === true) {
          onceEver(`repeat_served:${request._id}`).then((first) => {
            if (first) Analytics.track(EV.REPEAT_CUSTOMER_SERVED, { role: 'provider', request_id: String(request._id) });
          });
        }
        dialog(t('detail.serviceCompletedTitle'), t('detail.serviceCompletedDialog'), [{ text: t('common.ok'), onPress: () => { setEnteredOtp(''); handleRefresh(); } }]);
      } else if (result.code === 'OTP_EXPIRED') {
        dialog(t('detail.otpExpiredTitle'), t('detail.otpExpiredDialog'), [{ text: t('common.ok'), onPress: () => setEnteredOtp('') }]);
      } else {
        dialog(t('detail.verificationFailedTitle'), result.error || t('detail.verificationFailedMsg'));
      }
    } catch (error) { console.error('[VerifyOTP] Error:', error); dialog(t('common.error'), t('common.somethingWentWrong')); }
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
    if (!userId || !providerId) { dialog(t('common.error'), t('detail.favoritesError')); return; }
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
        dialog(isFavorited ? t('detail.removedFromFavorites') : t('detail.addedToFavorites'), isFavorited ? t('detail.removedFromFavoritesMsg') : t('detail.addedToFavoritesMsg'), [{ text: t('common.ok') }]);
      } else { dialog(t('common.error'), result.error || t('detail.favoritesError')); }
    } catch (error) { console.error('[Favorites] Toggle error:', error); dialog(t('common.error'), t('detail.favoritesError')); }
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
        <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
        <ScreenShimmer type="detail" />
      </View>
    );
  }
  if (!request) {
    const insets = useSafeAreaInsets();
    return (
      <View style={[s.screenContainer, { paddingTop: insets.top }]}>
        <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
        <View style={s.errorWrap}>
          <Icon name="error" size={52} color={C.danger} />
          <Text style={s.errorTitle}>{t('detail.requestNotFound')}</Text>
          <TouchableOpacity style={s.goBackBtn} onPress={() => navigation.goBack()}><Text style={s.goBackBtnText}>{t('common.goBack')}</Text></TouchableOpacity>
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
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      {/* ─── Simple Fixed Header ────────────────────────────────── */}
      <View style={[s.headerOuter, { paddingTop: insets.top + 8, overflow: 'hidden' }]}>
        <View style={s.headerTopRow}>
          <TouchableOpacity style={s.headerBackBtn} onPress={() => navigation.goBack()}>
            <Icon name="back" size={20} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={s.headerServiceName} numberOfLines={1}>{SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}</Text>
            <View style={[s.rowCenter, { gap: 6, marginTop: 2 }]}>
              <Text style={s.headerRequestId}>#{request.requestId}</Text>
              {isEventService && (
                <View style={s.headerEventBadge}><Text style={s.headerEventBadgeText}>{t('detail.eventBadge')}</Text></View>
              )}
              {isEmergencyService && (
                <View style={s.headerEmergencyBadge}><Text style={s.headerEmergencyBadgeText}>{t('detail.emergencyBadge')}</Text></View>
              )}
            </View>
          </View>
          <HelpSupportButton size={24} style={{ marginRight: 10 }} />
          <View style={[s.headerStatusBadge, { backgroundColor: status.bgColor }]}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: status.color, marginRight: 6 }} />
            <Text style={[s.headerStatusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[C.primary]} tintColor={C.primary} progressBackgroundColor={C.surface} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Description Pill — only show for terminal states */}
        {!['accepted', 'in-progress'].includes(request.status) && (
          <View style={[s.statusPill, { backgroundColor: status.bgColor }]}>
            <Text style={[s.statusPillText, { color: status.color }]}>{getStatusDescription(STATUS_CONFIG, request.status, isProvider, t)}</Text>
          </View>
        )}

        {/* Accept / Reject (provider pending) */}
        {isProvider && ['pending', 'awaiting_confirmation'].includes(request.status) && (
          <View style={s.acceptRejectCard}>
            {/* SVG accent art */}
            <View style={s.acceptRejectSvgBg}>
              <Svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="xMidYMid slice">
                <Path d="M0 70 Q60 35 140 60 T280 45 T400 65" stroke={C.primary} strokeWidth="1.2" fill="none" opacity={0.1} />
                <Path d="M0 85 Q90 50 180 75 T360 55 T400 80" stroke={C.primary} strokeWidth="0.8" fill="none" opacity={0.06} />
                <Circle cx="360" cy="20" r="30" fill={C.primary} opacity={0.04} />
                <Circle cx="30" cy="15" r="18" fill={C.primary} opacity={0.03} />
              </Svg>
            </View>
            <Text style={s.acceptRejectTitle}>{t('detail.respondToRequest')}</Text>
            <View style={s.acceptRejectRow}>
              <TouchableOpacity style={s.rejectBtn} onPress={handleRejectRequest} disabled={rejecting || accepting}>
                {rejecting ? <ActivityIndicator size="small" color={C.textSecondary} /> : (<><Icon name="close" size={16} color={C.muted} /><Text style={s.rejectBtnText}>{t('providerHistory.reject')}</Text></>)}
              </TouchableOpacity>
              <TouchableOpacity style={s.acceptBtn} onPress={handleAcceptRequest} disabled={accepting || rejecting}>
                {accepting ? <ActivityIndicator size="small" color={C.onPrimary} /> : (<><Icon name="check" size={16} color={C.onPrimary} /><Text style={s.acceptBtnText}>{t('providerHistory.accept')}</Text></>)}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Status Timeline */}
        <StatusTimeline currentStatus={request.status} isProvider={isProvider} cancelledBy={request.cancelledBy} />

        {/* Cancellation Details */}
        <CancellationInfoCard request={request} isProvider={isProvider} />

        {/* OTP Section (user) */}
        {showOtp && <OtpDisplay otp={request.completionOtp} expiresAt={request.otpExpiresAt} onResend={handleResendOtp} resending={resendingOtp} />}

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
              // Analytics: provider navigation to the customer — once per job
              onceEver(`nav_started:${request._id}`).then((first) => {
                if (first) Analytics.track(EV.NAVIGATION_STARTED, { role: 'provider', request_id: String(request._id) });
              });
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
                    <View style={[s.compactActionIcon, { backgroundColor: C.infoFill }]}>
                      <Icon name="directions" size={18} color={C.secondary} />
                    </View>
                    <Text style={s.compactActionLabel}>{t('detail.directions')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.compactActionBtn} onPress={handleCall} activeOpacity={0.7}>
                  <View style={[s.compactActionIcon, { backgroundColor: C.successFill }]}>
                    <Icon name="phone" size={18} color={C.success} />
                  </View>
                  <Text style={s.compactActionLabel}>{t('common.call')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.compactActionBtn}
                  onPress={() => !locationSharingLoading && handleToggleLocationSharing(!locationSharingEnabled)}
                  activeOpacity={0.7}
                >
                  <View style={[s.compactActionIcon, { backgroundColor: locationSharingEnabled ? C.successFill : C.hairline }]}>
                    {locationSharingLoading ? (
                      <ActivityIndicator size={16} color={C.secondary} />
                    ) : (
                      <Icon name="location" size={18} color={locationSharingEnabled ? C.success : C.textMuted} />
                    )}
                  </View>
                  <Text style={[s.compactActionLabel, locationSharingEnabled && { color: C.success, fontWeight: '700' }]}>
                    {locationSharingEnabled ? t('detail.sharing') : t('detail.share')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Location sharing status (compact) */}
              {locationSharingEnabled && (
                <View style={[s.locSharingActiveBox, { marginTop: 10 }]}>
                  <View style={[s.rowCenter, { gap: 8 }]}>
                    <PulsingDot color={C.success} size={4} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: C.success }}>{t('detail.liveSharing')}</Text>
                  </View>
                </View>
              )}

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: C.hairline, marginVertical: 12 }} />

              {/* Row 2: OTP Entry */}
              <View style={[s.rowCenter, { gap: 8, marginBottom: 8 }]}>
                <View style={s.providerOtpIconCircle}><Icon name="lock" size={16} color={C.purple} /></View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.purple }}>{t('detail.completeService')}</Text>
              </View>
              <View style={s.providerOtpInputRow}>
                <TextInput
      selectionColor={C.primary} style={s.providerOtpInput} value={enteredOtp} onChangeText={setEnteredOtp} placeholder="000000" placeholderTextColor={C.muted} keyboardType="number-pad" maxLength={6} />
                <TouchableOpacity style={[s.providerOtpBtn, enteredOtp.length === 6 ? s.providerOtpBtnEnabled : s.providerOtpBtnDisabled]} onPress={handleVerifyOtp} disabled={enteredOtp.length !== 6 || verifyingOtp}>
                  {verifyingOtp ? <ActivityIndicator size="small" color={C.successDeep} /> : (<><Icon name="check" size={15} color={enteredOtp.length === 6 ? C.successDeep : C.muted} /><Text style={[s.providerOtpBtnText, enteredOtp.length !== 6 && s.providerOtpBtnTextDisabled]}>{t('providerHistory.complete')}</Text></>)}
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
            showActions={['pending', 'awaiting_confirmation', 'accepted', 'in-progress', 'in_transit', 'arrived'].includes(request.status)}
          />
        )}

        {/* Sent to provider — awaiting acceptance */}
        {!isProvider && !request.providerDetails && (request.assignedProviderId || request.providerId || request.lastSentProviderId || request.sentAt) && ['pending', 'awaiting_confirmation'].includes(request.status) && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>{t('detail.requestSentTo')}</Text>

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
                    <View style={s.verifiedBadge}><Icon name="verified" size={10} color={C.onSuccess} /></View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.providerName}>{sentProviderDetails.name}</Text>
                  <View style={[s.rowCenter, { gap: 8, marginTop: 3 }]}>
                    {(sentProviderDetails.ratings?.average || sentProviderDetails.rating) > 0 && (
                      <View style={[s.rowCenter, { gap: 3 }]}>
                        <Icon name="star" size={13} color={iconAccent.star} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{(sentProviderDetails.ratings?.average || sentProviderDetails.rating || 0).toFixed(1)}</Text>
                        {(sentProviderDetails.ratings?.total || sentProviderDetails.totalRatings || 0) > 0 && (
                          <Text style={{ fontSize: 11, color: C.textMuted }}>({sentProviderDetails.ratings?.total || sentProviderDetails.totalRatings})</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <View style={[s.rowCenter, { gap: 10, marginBottom: 14 }]}>
                <View style={[s.noProviderIcon, { backgroundColor: C.infoFill, borderColor: C.secondary + '30' }]}>
                  <Icon name="send" size={20} color={C.secondary} />
                </View>
                <View style={s.noProviderInfo}>
                  <Text style={s.noProviderTitle}>{t('detail.requestSentTitle')}</Text>
                  <Text style={s.noProviderDesc}>{t('detail.loadingProvider')}</Text>
                </View>
              </View>
            )}

            {/* Waiting status pill */}
            <View style={s.waitingPill}>
              <PulsingDot color={C.secondary} size={6} />
              <Text style={s.waitingPillText}>{t('detail.waitingForProvider')}</Text>
            </View>

            {/* Find New Provider + Cancel */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={[s.findProvidersBtn, { flex: 1 }]}
                onPress={() => navigation.navigate('UserTabs', { screen: 'HomeTab', params: { resumeRequest: request } })}
                activeOpacity={0.7}
              >
                <Icon name="search" size={16} color={C.infoDeep} />
                <Text style={s.findProvidersBtnText}>{t('detail.findNewProvider')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.cancelSentBtn, { flex: 1 }]}
                onPress={handleCancel}
                disabled={cancelling}
                activeOpacity={0.7}
              >
                {cancelling ? (
                  <ActivityIndicator color={C.danger} size="small" />
                ) : (
                  <>
                    <Icon name="close" size={16} color={C.danger} />
                    <Text style={s.cancelSentBtnText}>{t('common.cancel')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Waiting for provider card (pending, no provider at all, not sent to anyone) */}
        {!isProvider && !request.providerDetails && !request.assignedProviderId && !request.providerId && !request.lastSentProviderId && !request.sentAt && request.status === 'pending' && (() => {
          const ageMs = Date.now() - new Date(request.createdAt).getTime();
          const isWithin30Min = ageMs < 30 * 60 * 1000;
          const minsLeft = Math.max(0, Math.ceil((30 * 60 * 1000 - ageMs) / 60000));
          return (
            <View style={s.card}>
              <Text style={s.sectionLabel}>{t('detail.noProviderSelected')}</Text>
              <View style={[s.rowCenter, s.noProviderRow]}>
                <View style={[s.noProviderIcon, isWithin30Min ? s.noProviderIconActive : s.noProviderIconExpiring]}>
                  <Icon name={isWithin30Min ? 'search' : 'clock'} size={22} color={isWithin30Min ? C.primary : C.danger} />
                </View>
                <View style={s.noProviderInfo}>
                  <Text style={s.noProviderTitle}>
                    {isWithin30Min ? t('detail.findProviderTitle') : t('detail.requestExpiring')}
                  </Text>
                  <Text style={s.noProviderDesc}>
                    {isWithin30Min
                      ? t('detail.findProviderDesc', { min: minsLeft })
                      : t('detail.expiringDesc')}
                  </Text>
                </View>
              </View>
              {isWithin30Min && (
                <TouchableOpacity
                  style={s.findProvidersBtn}
                  onPress={() => navigation.navigate('UserTabs', { screen: 'HomeTab', params: { resumeRequest: request } })}
                  activeOpacity={0.7}
                >
                  <Icon name="search" size={18} color={C.infoDeep} />
                  <Text style={s.findProvidersBtnText}>{t('userHistory.findProviders')}</Text>
                </TouchableOpacity>
              )}
              {!isWithin30Min && (
                <View style={s.noProviderWarning}>
                  <Icon name="info" size={16} color={C.danger} />
                  <Text style={s.noProviderWarningText}>{t('detail.autoCancelWarning')}</Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* User-side Provider Location Status */}
        {!isProvider && ['accepted', 'in-progress', 'in_transit'].includes(request.status) && request.providerDetails && (() => {
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
            if (diffMs < 10000) lastUpdateLabel = t('detail.justNow');
            else if (diffMs < 60000) lastUpdateLabel = `${Math.floor(diffMs / 1000)}s ago`;
            else if (diffMs < 3600000) lastUpdateLabel = `${Math.floor(diffMs / 60000)}m ago`;
            else lastUpdateLabel = `${Math.floor(diffMs / 3600000)}h ago`;
          }
          if (locationSharingEnabled && providerLiveLocation) {
            return (
              <View style={s.card}>
                <View style={[s.rowCenter, { gap: 10, marginBottom: 12 }]}>
                  <View style={[s.iconCircle, { backgroundColor: C.successFill }]}><Icon name="location" size={18} color={C.success} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{t('detail.providerLocation')}</Text>
                    <View style={[s.rowCenter, { gap: 5, marginTop: 2 }]}><PulsingDot color={C.success} size={4} /><Text style={{ fontSize: 11, color: C.success, fontWeight: '600' }}>{t('detail.liveStatus')}</Text></View>
                  </View>
                </View>
                {lastUpdateLabel ? (<View style={[s.rowCenter, { gap: 6, marginBottom: 10, paddingLeft: 44 }]}><Icon name="clock" size={11} color={C.textMuted} /><Text style={{ fontSize: 11, color: C.textMuted }}>{t('detail.updated', { time: lastUpdateLabel })}</Text></View>) : null}
                <TouchableOpacity style={s.trackLiveBtn} onPress={handleGetProviderLocation} activeOpacity={0.7}>
                  <Icon name="location" size={16} color={C.infoDeep} /><Text style={s.trackLiveBtnText}>{t('detail.trackLive')}</Text><Icon name="chevron-right" size={14} color={C.infoDeep} />
                </TouchableOpacity>
              </View>
            );
          } else if (locationSharingEnabled && !providerLiveLocation) {
            return (
              <View style={s.card}>
                <View style={[s.rowCenter, { gap: 10, marginBottom: 8 }]}>
                  <View style={[s.iconCircle, { backgroundColor: C.warningFill }]}><ActivityIndicator size="small" color={C.warning} /></View>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{t('detail.providerLocation')}</Text><Text style={{ fontSize: 11, color: C.warning }}>{t('detail.acquiringLocation')}</Text></View>
                </View>
                <Text style={{ fontSize: 11, color: C.textMuted, paddingLeft: 44, lineHeight: 17 }}>{t('detail.acquiringLocationDesc')}</Text>
                {locationAcquireTimeout && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.secondary, borderRadius: 12, paddingVertical: 10, marginTop: 8 }}
                    onPress={() => { setLocationAcquireTimeout(false); fetchLocationSharingStatus(); }}
                  >
                    <Icon name="refresh" size={14} color={C.onSecondary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.onSecondary }}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          } else {
            return (
              <View style={s.card}>
                <View style={[s.rowCenter, { gap: 10, marginBottom: 10 }]}>
                  <View style={[s.iconCircle, { backgroundColor: C.hairline }]}><Icon name="location" size={18} color={C.textMuted} /></View>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{t('detail.providerLocation')}</Text><Text style={{ fontSize: 11, color: C.textMuted }}>{t('detail.notSharingYet')}</Text></View>
                </View>
                {!isWithin45Min && msUntilService != null && msUntilService > 0 ? (
                  <View style={s.infoBoxBlue}><Icon name="clock" size={13} color={C.secondary} style={{ marginTop: 1 }} /><Text style={s.infoBoxBlueText}>{t('detail.locationBefore45', { time: timeUntilLabel ? ` Service in ${timeUntilLabel}.` : '' })}</Text></View>
                ) : isWithin45Min || (msUntilService != null && msUntilService <= 0) ? (
                  <View style={s.infoBoxAmber}><Icon name="clock" size={13} color={C.warning} style={{ marginTop: 1 }} /><Text style={s.infoBoxAmberText}>{t('detail.waitingForSharing')}</Text></View>
                ) : (
                  <View style={[s.infoBoxBlue, { backgroundColor: C.hairline }]}><Icon name="info" size={13} color={C.textMuted} style={{ marginTop: 1 }} /><Text style={[s.infoBoxBlueText, { color: C.textSecondary }]}>{t('detail.providerWillShare')}</Text></View>
                )}
              </View>
            );
          }
        })()}

        {/* Customer Details (provider view) */}
        {isProvider && request.userDetails && (
          <View style={s.card}>
            <View style={[s.rowBetween, { marginBottom: 12 }]}>
              <Text style={[s.sectionLabel, { marginBottom: 0 }]}>{t('detail.customerLabel')}</Text>
              {request.userDetails.isRepeatCustomer && (
                <View style={s.repeatBadge}><Icon name="heart" size={10} color={C.brandOrangeInk} /><Text style={s.repeatBadgeText}>{t('detail.repeatBadge')}</Text></View>
              )}
            </View>
            <View style={[s.rowCenter, { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }]}>
              {resolveProfilePic(request.userDetails.profilePicture) ? (
                <Image source={{ uri: resolveProfilePic(request.userDetails.profilePicture) }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: C.line }} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: C.white }}>{request.userDetails.name?.charAt(0).toUpperCase() || 'C'}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={[s.rowCenter, { gap: 5 }]}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{request.userDetails.name || t('providerHistory.customer')}</Text>
                  {request.userDetails.isVerified && <Icon name="verified" size={14} color={C.success} />}
                </View>
                {request.userDetails.memberSince && <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{t('detail.memberSince', { date: request.userDetails.memberSince })}</Text>}
                {request.userDetails.previousServicesWithProvider > 0 && (
                  <Text style={{ fontSize: 11, color: C.primary, fontWeight: '500', marginTop: 2 }}>{t('detail.previousServices', { n: request.userDetails.previousServicesWithProvider })}</Text>
                )}
              </View>
            </View>
            {['pending', 'awaiting_confirmation', 'accepted', 'in-progress'].includes(request.status) && (
              <View style={{ marginBottom: 12 }}>
                {request.userDetails.email && (
                  <View style={[s.rowCenter, { gap: 8, paddingVertical: 4 }]}><Icon name="mail" size={13} color={C.textMuted} /><Text style={{ fontSize: 12, color: C.text }}>{request.userDetails.email}</Text></View>
                )}
                {(request.userDetails.address || request.userDetails.city) && (
                  <View style={[s.rowCenter, { gap: 8, paddingVertical: 4 }]}><Icon name="location" size={13} color={C.textMuted} /><Text style={{ fontSize: 12, color: C.text }}>{[request.userDetails.address, request.userDetails.city].filter(Boolean).join(', ')}</Text></View>
                )}
              </View>
            )}
            {(() => {
              const loc = request.location || request.eventLocation;
              const locAddr = request.serviceAddress || loc?.address || request.eventLocation?.address || request.address;
              if (!(loc?.coordinates || loc?.latitude || locAddr) || !['pending', 'awaiting_confirmation', 'accepted', 'in-progress'].includes(request.status)) return null;
              return (
                <View style={s.serviceLocationBox}>
                  <Text style={s.serviceLocationLabel}>{t('detail.serviceLocation')}</Text>
                  <View style={[s.rowCenter, { gap: 8, marginBottom: 8 }]}><Icon name="pin" size={13} color={C.brandOrangeInk} /><Text style={{ flex: 1, fontSize: 12, color: C.text, lineHeight: 17 }}>{locAddr || t('detail.serviceLocation')}</Text></View>
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
                    <Icon name="directions" size={14} color={C.secondary} />
                    <Text style={s.openInMapsBtnText}>{t('detail.openInMaps')}</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
            {['pending', 'awaiting_confirmation', 'accepted', 'in-progress'].includes(request.status) && (
              <TouchableOpacity style={s.callCustomerBtn} onPress={handleCall}>
                <Icon name="phone" size={15} color={C.successDeep} /><Text style={s.callCustomerBtnText}>{t('detail.callCustomer')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Request Details */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>{t('detail.requestDetails')}</Text>
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
            return <InfoRow iconName="calendar" label={isEmergencyService ? t('detail.requestedOn') : t('detail.serviceDate')} value={dateStr} />;
          })()}
          {createdAt && !isNaN(createdAt.getTime()) && (
            <InfoRow iconName="clock" label={t('detail.createdOn')} value={createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          )}
          {request.acceptedAt && (
            <InfoRow iconName="check" label={t('detail.acceptedOn')} value={new Date(request.acceptedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          )}
          {request.completedAt && (
            <InfoRow iconName="celebration" label={t('detail.completedOn')} value={new Date(request.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          )}
          {request.description && <InfoRow iconName="description" label={t('detail.description')} value={request.description} />}
          {isEventService && request.venue && <InfoRow iconName="place" label={t('detail.venue')} value={request.venue} />}
          {isEventService && request.budget && <InfoRow iconName="currency-rupee" label={t('detail.budget')} value={`₹${Number(request.budget).toLocaleString()}`} />}
          {isEventService && request.additionalRequirements && <InfoRow iconName="checklist" label={t('detail.additionalRequirements')} value={request.additionalRequirements} />}
          {isEmergencyService && request.urgencyLevel && <InfoRow iconName="warning" label={t('detail.urgencyLevel')} value={request.urgencyLevel.charAt(0).toUpperCase() + request.urgencyLevel.slice(1)} />}
        </View>

        {/* Location Map — provider only, at bottom after request details */}
        {isProvider && ['pending', 'awaiting_confirmation', 'accepted', 'in-progress'].includes(request.status) && (request.location?.coordinates || request.location?.latitude) && (
          <LocationMapPreview location={request.location || request.eventLocation} address={request.serviceAddress || request.location?.address || request.eventLocation?.address || request.address || 'Service Location'} />
        )}

        {/* Pricing */}
        {(request.pricing?.estimatedCost || request.pricing?.actualCost) && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>{t('detail.pricing')}</Text>
            {request.pricing.estimatedCost && (
              <View style={s.priceRow}><Text style={s.priceLabel}>{t('detail.estimatedCost')}</Text><Text style={s.priceValue}>₹{request.pricing.estimatedCost.toLocaleString()}</Text></View>
            )}
            {request.pricing.actualCost && (
              <View style={[s.priceRow, s.priceRowFinal]}><Text style={s.priceLabelFinal}>{t('detail.finalAmount')}</Text><Text style={s.priceValueFinal}>₹{request.pricing.actualCost.toLocaleString()}</Text></View>
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
              <ActivityIndicator color={C.danger} size="small" />
            ) : (
              <Text style={s.cancelActionBtnText}>
                {['accepted', 'in-progress'].includes(request.status) ? t('detail.cancelBooking') : t('detail.cancelRequest')}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Completed Banner */}
        {request.status === 'completed' && (
          <View style={s.completedBanner}>
            <Icon name="celebration" size={28} color={C.success} />
            <Text style={s.completedTitle}>{t('detail.serviceCompletedTitle')}</Text>
            <Text style={s.completedSub}>{t('detail.serviceCompletedSub')}</Text>
          </View>
        )}

        {/* Rating Section */}
        {request.status === 'completed' && !isProvider && (
          <View style={s.card}>
            {ratingCheckLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <ActivityIndicator size="small" color={C.brandOrangeInk} />
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{t('detail.checkingRating')}</Text>
              </View>
            ) : hasRated ? (
              <View style={{ alignItems: 'center' }}>
                <View style={[s.rowCenter, { gap: 8, marginBottom: 10 }]}><Icon name="star" size={18} color={iconAccent.star} /><Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{t('detail.youRated')}</Text></View>
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map((star) => (<Icon key={star} name="star" size={24} color={star <= (ratingStatus.rating?.rating || 0) ? iconAccent.star : C.line} />))}
                </View>
                {ratingStatus.rating?.review ? <Text style={{ fontSize: 12, color: C.textSecondary, fontStyle: 'italic', textAlign: 'center' }}>"{ratingStatus.rating.review}"</Text> : null}
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 }}>{t('detail.rateTitle')}</Text>
                <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 14 }}>{t('detail.rateSub')}</Text>
                <TouchableOpacity style={s.rateBtn} onPress={() => setRatingModalVisible(true)}>
                  <Icon name="star" size={16} color={C.onGold} /><Text style={s.rateBtnText}>{t('detail.rateBtn')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Favorites */}
        {request.status === 'completed' && !isProvider && (request?.providerId || request?.assignedProviderDetails?._id) && (
          <TouchableOpacity style={[s.favBtn, isFavorited && s.favBtnActive]} onPress={handleToggleFavorite} disabled={togglingFavorite}>
            {togglingFavorite ? <ActivityIndicator color={isFavorited ? C.danger : C.brandOrangeInk} size="small" /> : (
              <><Icon name={isFavorited ? 'favorite' : 'favorite-border'} size={16} color={isFavorited ? C.danger : C.brandOrangeInk} /><Text style={[s.favBtnText, isFavorited && s.favBtnTextActive]}>{isFavorited ? t('detail.removeFavorite') : t('detail.addToFavorites')}</Text></>
            )}
          </TouchableOpacity>
        )}

        {/* Help */}
        <View style={[s.card, { alignItems: 'center' }]}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 4 }}>{t('detail.needHelp')}</Text>
          <Text style={{ fontSize: 12, color: C.textSecondary, textAlign: 'center', marginBottom: 10 }}>{t('detail.needHelpSub')}</Text>
          <TouchableOpacity style={s.helpBtn} onPress={() => openSupport(userType)}><Icon name="email" size={14} color={C.info} /><Text style={s.helpBtnText}>{t('detail.contactSupport')}</Text></TouchableOpacity>
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
const makeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  // Screen
  screenContainer: { flex: 1, backgroundColor: C.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: C.textSecondary },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 12, marginBottom: 16 },
  goBackBtn: { backgroundColor: C.secondary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  goBackBtnText: { color: C.onSecondary, fontWeight: '700', fontSize: 14 },

  // Simple White Header
  headerOuter: { backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.hairline, zIndex: 10 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderMedium,
  },
  headerServiceName: { fontSize: 17, fontWeight: '700', color: C.text },
  headerRequestId: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  headerEventBadge: { backgroundColor: C.purpleFill, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  headerEventBadgeText: { fontSize: 9, fontWeight: '700', color: C.purple },
  headerEmergencyBadge: { backgroundColor: C.dangerFill, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  headerEmergencyBadgeText: { fontSize: 9, fontWeight: '700', color: C.danger },
  headerStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  headerStatusText: { fontSize: 12, fontWeight: '700' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 44 },

  // Shared
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // Card base
  card: { backgroundColor: C.white, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.line, shadowColor: C.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8, overflow: 'hidden' },

  // Status Pill
  statusPill: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 14 },
  statusPillText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // Timeline
  timelineContainer: { backgroundColor: C.white, borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.line, shadowColor: C.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8, overflow: 'hidden' },
  timelineCancelledPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.dangerBg, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: C.dangerLine },
  timelineCancelledIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.danger, justifyContent: 'center', alignItems: 'center' },
  timelineCancelledText: { fontSize: 13, color: C.danger, fontWeight: '600', letterSpacing: 0.1 },
  timeline: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 2, paddingTop: 2 },
  timelineStep: { alignItems: 'center', minWidth: 52, flexShrink: 0 },
  timelineConnectorWrapper: { flex: 1, justifyContent: 'center', paddingTop: 2, height: 32 },
  timelineConnector: { height: 3, backgroundColor: C.line, borderRadius: 1.5 },
  timelineConnectorActive: { backgroundColor: C.success },
  timelineCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.sunken, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.line },
  timelineCircleCompleted: { backgroundColor: C.success, borderColor: C.success, shadowColor: C.success, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 },
  timelineCircleCurrent: { backgroundColor: C.primary, borderColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 },
  timelineNumber: { fontSize: 12, // on C.primary, so the ink must be its on-colour; C.muted was 1.1-1.6:1 in dark
    color: C.onPrimary, fontWeight: '700', letterSpacing: -0.2 },
  timelineLabel: { marginTop: 8, fontSize: 11, color: C.textMuted, textAlign: 'center', fontWeight: '500', letterSpacing: 0.1 },
  timelineLabelActive: { color: C.text, fontWeight: '600' },
  timelineLabelCurrent: { color: C.primary, fontWeight: '700' },

  // Cancellation Card
  cancellationCard: { backgroundColor: C.dangerBg, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.dangerLine },
  cancellationHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cancellationIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.dangerFill, alignItems: 'center', justifyContent: 'center' },
  cancellationTitle: { fontSize: 15, fontWeight: '700', color: C.danger },
  cancellationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, paddingLeft: 44 },
  cancellationRowText: { fontSize: 13, color: C.danger },

  // Info Row
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.background },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 12, color: C.textMuted },
  infoValue: { flex: 1, fontSize: 13, color: C.text, fontWeight: '600', textAlign: 'right', marginLeft: 12 },

  // OTP Card (User)
  otpCard: { backgroundColor: C.white, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1.5, borderColor: C.purpleLine, shadowColor: C.purple, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  otpHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  otpHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  otpLockCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.purpleBg, alignItems: 'center', justifyContent: 'center' },
  otpHeaderTitle: { fontSize: 15, fontWeight: '700', color: C.purple },
  otpHeaderSub: { fontSize: 11, color: C.textMuted },
  otpDigitsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 },
  otpDigitBox: { width: 44, height: 52, borderRadius: 14, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.purpleLine, justifyContent: 'center', alignItems: 'center', shadowColor: C.purple, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  otpDigit: { fontSize: 24, fontWeight: '800', color: C.purple },
  otpCopyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 },
  otpCopyText: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  otpExpiryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 10 },
  otpExpiryText: { fontSize: 11, color: C.textMuted },
  otpWarningStrip: { flexDirection: 'row', backgroundColor: C.warningBg, borderRadius: 12, padding: 10, gap: 8 },
  otpWarningText: { flex: 1, fontSize: 11, color: C.warning, lineHeight: 16, fontWeight: '500' },

  // OTP Expired
  otpExpiredCard: { backgroundColor: C.dangerBg, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.dangerLine, alignItems: 'center' },
  otpExpiredHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  otpExpiredIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.dangerFill, alignItems: 'center', justifyContent: 'center' },
  otpExpiredTitle: { fontSize: 16, fontWeight: '700', color: C.danger },
  otpExpiredDesc: { fontSize: 13, color: C.danger, textAlign: 'center', marginBottom: 14, lineHeight: 18 },
  otpResendBtn: { flexDirection: 'row', backgroundColor: C.dangerFill, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, gap: 6, alignItems: 'center',
    borderWidth: 1,
    borderColor: C.dangerLine,
  },
  otpResendBtnText: { color: C.danger, fontWeight: '700', fontSize: 14 },

  // Provider Card
  providerName: { fontSize: 16, fontWeight: '700', color: C.text },
  providerAvatarImg: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.line, borderWidth: 2.5, borderColor: C.secondary + '30' },
  providerAvatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.secondary, justifyContent: 'center', alignItems: 'center' },
  providerAvatarChar: { fontSize: 18, fontWeight: '700', color: C.white },
  verifiedBadge: { position: 'absolute', bottom: -1, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: C.success, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.white },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.successFill, borderRadius: 14, paddingVertical: 11,
    borderWidth: 1,
    borderColor: C.successBorder,
  },
  callBtnText: { color: C.successDeep, fontWeight: '700', fontSize: 14 },
  trackBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.infoFill, borderRadius: 14, paddingVertical: 11,
    borderWidth: 1,
    borderColor: C.infoBorder,
  },
  trackBtnText: { color: C.infoDeep, fontWeight: '700', fontSize: 14 },

  // Map
  mapPreviewWrap: { height: 160, borderRadius: 20, overflow: 'hidden', marginBottom: 10, backgroundColor: C.sunken },
  mapPreview: { flex: 1 },
  mapLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.sunken, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  mapPinOuter: { width: 40, height: 44, alignItems: 'center', justifyContent: 'flex-start' },
  mapPinWrap: { alignItems: 'center' },
  mapPin: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.danger, justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: stableDark.ink, shadowColor: stableDark.shadowBase, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
  mapPinShadow: { width: 12, height: 4, borderRadius: 6, backgroundColor: mapOverlay.pinShadowSoft, marginTop: 1 },
  mapHint: { position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: mapOverlay.hint, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 4 },
  mapHintText: { fontSize: 10, fontWeight: '600', color: stableDark.ink },
  expandPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.blueBg, borderRadius: 14, gap: 4 },
  expandPillText: { fontSize: 11, fontWeight: '600', color: C.secondary },

  // Fullscreen Map
  fullMapContainer: { flex: 1, backgroundColor: C.white },
  fullMap: { flex: 1 },
  fullMapPinWrap: { alignItems: 'center' },
  fullMapPin: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.danger, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: stableDark.ink, shadowColor: stableDark.shadowBase, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
  fullMapPinShadow: { width: 14, height: 5, borderRadius: 7, backgroundColor: mapOverlay.pinShadowStrong, marginTop: 3 },
  fullMapTopBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: C.white },
  fullMapCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderMedium,
  },
  fullMapTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  fullMapBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, paddingTop: 18, paddingBottom: 34, paddingHorizontal: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: C.shadow, shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },
  fullMapAddr: { flex: 1, fontSize: 14, color: C.text, lineHeight: 20 },
  fullMapDirBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.infoFill, paddingVertical: 13, borderRadius: 14, gap: 8,
    borderWidth: 1,
    borderColor: C.infoBorder,
  },
  fullMapDirText: { fontSize: 15, fontWeight: '700', color: C.onSecondary },

  // Directions
  directionsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.infoFill, borderRadius: 14, paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.infoBorder,
  },
  directionsBtnText: { fontSize: 14, fontWeight: '700', color: C.infoDeep },

  // Compact Action Card (provider)
  compactActionCard: { backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line, shadowColor: C.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  compactActionRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  compactActionBtn: { alignItems: 'center', gap: 6, minWidth: 64 },
  compactActionIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  compactActionLabel: { fontSize: 11, fontWeight: '600', color: C.text },

  // Provider OTP
  providerOtpCard: { backgroundColor: C.purpleBg, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.purpleLine },
  providerOtpIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.purpleFill, alignItems: 'center', justifyContent: 'center' },
  providerOtpTitle: { fontSize: 15, fontWeight: '700', color: C.purple },
  providerOtpDesc: { fontSize: 12, color: C.textSecondary, marginBottom: 12, lineHeight: 17 },
  providerOtpInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  providerOtpInput: { flex: 1, backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700', letterSpacing: 6, borderWidth: 1.5, borderColor: C.purpleLine, textAlign: 'center' },
  providerOtpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, paddingHorizontal: 16 },
  providerOtpBtnEnabled: { backgroundColor: C.successFill, shadowColor: C.success, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
    borderWidth: 1,
    borderColor: C.successBorder,
  },
  providerOtpBtnDisabled: { backgroundColor: C.disabledFill },
  providerOtpBtnText: { fontSize: 14, fontWeight: '700', color: C.successDeep },
  providerOtpBtnTextDisabled: {
    color: C.muted },

  // Accept/Reject
  acceptRejectCard: { backgroundColor: C.white, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1.5, borderColor: C.primary + '25', shadowColor: C.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8, overflow: 'hidden' },
  acceptRejectSvgBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 100 },
  acceptRejectTitle: { fontSize: 14, fontWeight: '700', color: C.brandOrangeInk, marginBottom: 12, textAlign: 'center' },
  acceptRejectRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: C.line },
  rejectBtnText: { fontSize: 15, fontWeight: '600', color: C.textSecondary },
  acceptBtn: { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 13, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  acceptBtnText: { fontSize: 15, fontWeight: '700', color: C.onPrimary },

  // Cancel
  cancelActionBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: C.dangerLine, backgroundColor: C.dangerBg, marginBottom: 12 },
  cancelActionBtnWarning: { borderColor: C.dangerLine },
  cancelActionBtnText: { fontSize: 15, fontWeight: '600', color: C.danger },

  // Location sharing
  locSharingActiveBox: { backgroundColor: C.successBg, borderRadius: 14, padding: 12, gap: 6 },

  // No Provider Selected
  noProviderRow: { gap: 12, marginBottom: 12 },
  noProviderIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  noProviderIconActive: { backgroundColor: C.warningFill, borderColor: C.primary + '30' },
  noProviderIconExpiring: { backgroundColor: C.dangerFill, borderColor: C.dangerLine },
  noProviderInfo: { flex: 1 },
  noProviderTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  noProviderDesc: { fontSize: 12, color: C.textMuted, marginTop: 3 },
  findProvidersBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.infoFill, borderRadius: 12, paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.infoBorder,
  },
  findProvidersBtnText: { fontSize: 15, fontWeight: '700', color: C.infoDeep },
  waitingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.blueBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.secondary + '20' },
  waitingPillText: { fontSize: 13, fontWeight: '600', color: C.info, flex: 1 },
  cancelSentBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, backgroundColor: C.dangerBg, borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: C.dangerLine },
  cancelSentBtnText: { fontSize: 14, fontWeight: '700', color: C.danger },
  noProviderWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.dangerBg, borderRadius: 12, padding: 12 },
  noProviderWarningText: { flex: 1, fontSize: 12, color: C.danger, lineHeight: 17 },

  // Info boxes
  infoBoxAmber: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.warningBg, borderRadius: 12, padding: 10 },
  infoBoxAmberText: { flex: 1, fontSize: 11, color: C.warning, lineHeight: 17, fontWeight: '500' },
  infoBoxBlue: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.blueBg, borderRadius: 12, padding: 10 },
  infoBoxBlueText: { flex: 1, fontSize: 11, color: C.info, lineHeight: 17, fontWeight: '500' },

  // Customer card extras
  repeatBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.warningBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  repeatBadgeText: { fontSize: 10, fontWeight: '700', color: C.brandOrangeInk },
  serviceLocationBox: { backgroundColor: C.warningBg, borderRadius: 14, padding: 10, marginBottom: 12 },
  serviceLocationLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  openInMapsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.blueBg, borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: C.blueLine },
  openInMapsBtnText: { fontSize: 12, fontWeight: '600', color: C.info },
  callCustomerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.successFill, borderRadius: 14, paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.successBorder,
  },
  callCustomerBtnText: { color: C.successDeep, fontSize: 14, fontWeight: '700' },

  // Track provider
  trackLiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.infoFill, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, gap: 8,
    borderWidth: 1,
    borderColor: C.infoBorder,
  },
  trackLiveBtnText: { color: C.infoDeep, fontWeight: '700', fontSize: 14 },

  // Pricing
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  priceLabel: { fontSize: 13, color: C.textSecondary },
  priceValue: { fontSize: 14, color: C.text, fontWeight: '600' },
  priceRowFinal: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 6, paddingTop: 10 },
  priceLabelFinal: { fontSize: 15, fontWeight: '700', color: C.text },
  priceValueFinal: { fontSize: 18, fontWeight: '800', color: C.success },

  // Completed
  completedBanner: { backgroundColor: C.successBg, borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: C.successLine },
  completedTitle: { fontSize: 17, fontWeight: '800', color: C.success, marginTop: 8 },
  completedSub: { fontSize: 13, color: C.success, textAlign: 'center', marginTop: 4 },

  // Rate
  rateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  rateBtnText: { fontSize: 15, fontWeight: '700', color: C.onGold },

  // Favorites
  favBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.warningBg, borderRadius: 16, paddingVertical: 13, marginBottom: 12, borderWidth: 1, borderColor: C.brandOrangeBorder },
  favBtnActive: { backgroundColor: C.dangerBg, borderColor: C.danger },
  favBtnText: { fontSize: 14, fontWeight: '700', color: C.warning },
  favBtnTextActive: { color: C.danger },

  // Help
  helpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.blueBg, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 14 },
  helpBtnText: { fontSize: 13, color: C.info, fontWeight: '600' },
  });
};

export default ServiceRequestDetailScreen;
