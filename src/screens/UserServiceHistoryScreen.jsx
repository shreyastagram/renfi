/**
 * User Service History Screen -- v5.0 Dynamic Collapsible UI
 *
 * Production-grade user bookings screen with:
 * - Animated collapsible stats header (shrinks on scroll)
 * - Stats always show full totals regardless of filter
 * - Filter tabs + date filter behind filter icon button
 * - Premium card design with press feedback
 * - Provider avatars with verified badges
 * - OTP section, rating, cancellation
 * - Paginated infinite scroll
 * - Active requests bypass date filter
 *
 * @version 5.0.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
  ScrollView,
  Image,
  AppState,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import { Icon, ServiceIcon, StatusIcon, RatingModal, FixhomiLogo, CancellationReasonModal } from '../components';
import ScreenShimmer, { useShimmerAnimation, ShimmerBlock } from '../components/ShimmerLoader';

const FIXHOMI_LOGO = require('../assets/fixhomi_logo.jpg');
import {
  getUserRequests,
  cancelRequest,
  submitRating,
  checkRatingStatus,
  resendCompletionOtp,
  SERVICE_TYPE_LABELS,
} from '../services/traditionalServiceService';
import { subscribeToRequest, unsubscribeFromRequest, addEventListener as addSocketListener } from '../services/socketService';
import { setupForegroundMessageListener } from '../services/fcmService';
import { NODE_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';
import { getUserEmergencyRequests } from '../services/emergencyServicesService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const C = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  dark: '#0F172A',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  border: '#F1F5F9',
  muted: '#94A3B8',
  text: '#0F172A',
  textSec: '#64748B',
  success: '#10B981',
  successBg: '#ECFDF5',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  purple: '#7C3AED',
  purpleBg: '#EDE9FE',
  blue: '#3B82F6',
  blueBg: '#DBEAFE',
  gold: '#F59E0B',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#D97706', bgColor: '#FEF3C7', dotColor: '#D97706' },
  awaiting_confirmation: { label: 'Awaiting', color: '#D97706', bgColor: '#FEF3C7', dotColor: '#D97706' },
  accepted: { label: 'Accepted', color: C.blue, bgColor: C.blueBg, dotColor: C.blue },
  'in-progress': { label: 'In Progress', color: C.purple, bgColor: C.purpleBg, dotColor: C.purple },
  in_transit: { label: 'On the Way', color: C.purple, bgColor: C.purpleBg, dotColor: C.purple },
  arrived: { label: 'Arrived', color: C.blue, bgColor: C.blueBg, dotColor: C.blue },
  completed: { label: 'Completed', color: '#059669', bgColor: '#D1FAE5', dotColor: '#059669' },
  cancelled: { label: 'Cancelled', color: '#DC2626', bgColor: '#FEE2E2', dotColor: '#DC2626' },
  rejected: { label: 'Rejected', color: '#DC2626', bgColor: '#FEE2E2', dotColor: '#DC2626' },
  expired: { label: 'Expired', color: C.muted, bgColor: '#F1F5F9', dotColor: C.muted },
};

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Active' },
  { key: 'completed', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
];

const CATEGORY_TABS = [
  { key: 'all', label: 'All Types' },
  { key: 'traditional', label: 'Services' },
  { key: 'event', label: 'Events' },
  { key: 'emergency', label: 'Emergency' },
];

const DATE_PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '3months', label: '3 Months' },
  { key: '6months', label: '6 Months' },
  { key: 'year', label: 'This Year' },
];

const ACTIVE_STATUSES = ['pending', 'accepted', 'in-progress', 'awaiting_confirmation', 'in_transit', 'arrived'];
const PAGE_SIZE = 20;
const STATS_HEIGHT = 100;

const getDateRange = (preset) => {
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case 'today': return { start: sod, end: now };
    case 'week': { const w = new Date(sod); w.setDate(w.getDate() - w.getDay()); return { start: w, end: now }; }
    case 'month': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    case '3months': { const d = new Date(now); d.setMonth(d.getMonth() - 3); return { start: d, end: now }; }
    case '6months': { const d = new Date(now); d.setMonth(d.getMonth() - 6); return { start: d, end: now }; }
    case 'year': return { start: new Date(now.getFullYear(), 0, 1), end: now };
    default: return null;
  }
};

/* -- Stat Pill ----------------------------------------------------------- */
const StatPill = ({ value, label, color, bgColor }) => (
  <View style={[styles.statPill, { backgroundColor: bgColor }]}>
    <View style={styles.statSvgBg}>
      <Svg width="100%" height="100%" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice">
        <Circle cx="85" cy="-5" r="35" fill={color} opacity={0.06} />
        <Circle cx="90" cy="60" r="20" fill={color} opacity={0.05} />
        <Path d="M0 50 Q25 30 50 45 T100 35" stroke={color} strokeWidth="1" fill="none" opacity={0.1} />
        <Path d="M0 60 Q30 40 60 55 T100 50" stroke={color} strokeWidth="0.8" fill="none" opacity={0.07} />
      </Svg>
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: color + 'B0' }]}>{label}</Text>
  </View>
);

/* -- Request Card -------------------------------------------------------- */
const RequestCard = ({ request, onPress, onCancel, onCallProvider, onTrackProvider, onRate, onFindProviders, ratingStatus, onResendOtp, resendingOtpId }) => {
  const { dialog } = useDialog();
  const { t } = useLanguage();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useShimmerAnimation();
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const isActive = ['accepted', 'in-progress', 'in_transit', 'arrived'].includes(request.status);
  const isCompleted = request.status === 'completed';
  const isPending = ['pending', 'awaiting_confirmation'].includes(request.status);
  const isCancelled = ['cancelled', 'rejected', 'expired'].includes(request.status);
  const isDone = isCompleted || isCancelled;
  const hasProvider = request.assignedProviderId || request.providerId || request.lastSentProviderId || (request.providerDetails && request.providerDetails._id);
  const isSentToProvider = !!request.lastSentProviderId || !!request.sentAt;
  const ratingChecking = ratingStatus === undefined;
  const hasRated = request.ratings?.userRating > 0 || request._rated || ratingStatus?.rated;
  const ratedStars = ratingStatus?.rating?.rating || request.ratings?.userRating;
  const isEventService = request.isEventService;
  const isEmergencyService = request.isEmergencyService;
  const serviceDate = new Date(request.serviceDate || request.createdAt);
  const isOtpExpired = request.otpExpiresAt && new Date(request.otpExpiresAt) < new Date();
  const isResendingThis = resendingOtpId === request._id;

  const providerProfilePicture = request.providerDetails?.profilePicture ||
    (typeof request.providerDetails?.profilePicture === 'string' ? request.providerDetails?.profilePicture : request.providerDetails?.profilePicture?.url);

  const handleCopyOtp = () => {
    if (request.completionOtp && !isOtpExpired && !isResendingThis) {
      Clipboard.setString(request.completionOtp);
      dialog(t('common.copied'), t('userHistory.copiedToClipboard'));
    }
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.card, isPending && styles.cardPending, isDone && styles.cardCompact]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {/* Header */}
        <View style={[styles.cardTop, isDone && { marginBottom: 4 }]}>
          <View style={styles.cardTopLeft}>
            <View style={styles.svcIcon}>
              <ServiceIcon serviceType={request.serviceType} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.svcNameRow}>
                <Text style={styles.svcName} numberOfLines={1}>
                  {SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}
                </Text>
                {isEventService && (
                  <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>EVENT</Text></View>
                )}
                {isEmergencyService && (
                  <View style={[styles.typeBadge, { backgroundColor: '#FEE2E2' }]}><Text style={[styles.typeBadgeText, { color: '#DC2626' }]}>SOS</Text></View>
                )}
              </View>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <View style={[styles.statusDot, { backgroundColor: status.dotColor }]} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Cancellation strip */}
        {isCancelled && (() => {
          const by = request.cancelledBy;
          const reason = request.rejectReason || request.cancellationReason || request.cancelReason;
          let label = '';
          if (request.status === 'rejected') label = reason || t('userHistory.noProviderAvailable');
          else if (by === 'provider') label = t('userHistory.cancelledByProvider');
          else if (by === 'user') label = t('userHistory.cancelledByUser');
          else if (by === 'system') label = t('userHistory.cancelledBySystem');
          else label = reason || t('userHistory.requestCancelled');
          const generic = ['user cancelled', 'cancelled by user', 'cancelled by provider', 'provider cancelled'];
          if (reason && !generic.includes(reason.toLowerCase()) && by) label += ` \u2014 ${reason}`;
          const isRejected = request.status === 'rejected';
          return (
            <View style={[styles.cancelStrip, isRejected && styles.cancelStripDanger]}>
              <Icon name="info" size={13} color={isRejected ? '#DC2626' : '#92400E'} />
              <Text style={[styles.cancelStripText, { color: isRejected ? '#991B1B' : '#92400E' }]} numberOfLines={2}>{label}</Text>
            </View>
          );
        })()}

        {/* Compact done row */}
        {isDone && (
          <View style={styles.compactRow}>
            <Text style={styles.compactDate}>{serviceDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            {hasProvider && request.providerDetails?.name && <Text style={styles.compactProvider}>{request.providerDetails.name}</Text>}
          </View>
        )}

        {/* Rating row for completed */}
        {isCompleted && hasProvider && (
          <View style={styles.ratingRow}>
            {hasRated ? (
              <View style={styles.ratedStrip}>
                <Icon name="star" size={13} color="#D97706" />
                <Text style={styles.ratedText}>{ratedStars ? t('userHistory.ratedStars', { stars: ratedStars }) : ''}</Text>
              </View>
            ) : ratingChecking ? (
              <View style={[styles.ratedStrip, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                <ActivityIndicator size={12} color={C.muted} />
                <Text style={[styles.ratedText, { color: C.muted }]}>{t('userHistory.checking')}</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.rateBtn} onPress={() => onRate(request)} activeOpacity={0.7}>
                <Icon name="star" size={14} color={C.white} />
                <Text style={styles.rateBtnText}>{t('userHistory.rate')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Active/Pending content */}
        {!isDone && (
          <>
            {/* Date/Time */}
            <View style={styles.dtRow}>
              <View style={styles.dtItem}>
                <Text style={styles.dtLabel}>{t('common.date')}</Text>
                <Text style={styles.dtVal}>
                  {isEventService && request.eventDate
                    ? new Date(request.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : serviceDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  }
                </Text>
              </View>
              {request.serviceTime && !isEmergencyService && (() => {
                let h, m;
                const d = new Date(request.serviceTime);
                if (!isNaN(d.getTime()) && request.serviceTime.length > 5) { h = d.getHours(); m = d.getMinutes(); }
                else { [h, m] = String(request.serviceTime).split(':').map(Number); }
                if (isNaN(h) || isNaN(m)) return null;
                const p = h >= 12 ? 'PM' : 'AM';
                const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
                return (<><View style={styles.dtDiv} /><View style={styles.dtItem}><Text style={styles.dtLabel}>{t('common.time')}</Text><Text style={styles.dtVal}>{dh}:{String(m).padStart(2, '0')} {p}</Text></View></>);
              })()}
            </View>

            {/* Provider — accepted/assigned with details */}
            {hasProvider && (
              <>
              {isPending && (
                <View style={styles.sentToStrip}>
                  <View style={styles.sentToStripRow}>
                    <Icon name="send" size={11} color={C.secondary} />
                    <Text style={styles.sentToStripText}>
                      {request.providerDetails?.name
                        ? t('userHistory.sentToProvider', { name: request.providerDetails.name })
                        : t('userHistory.sentToProviderDefault')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cancelSentStripBtn}
                    onPress={() => onCancel(request)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelSentStripBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {request.providerDetails && (
              <View style={styles.providerRow}>
                <View style={styles.providerLeft}>
                  <View style={styles.avatarWrap}>
                    {providerProfilePicture ? (
                      <Image source={{ uri: providerProfilePicture }} style={styles.providerAvatar} />
                    ) : (
                      <View style={styles.providerAvatarFallback}>
                        <Text style={styles.providerInitial}>{request.providerDetails.name?.charAt(0)?.toUpperCase() || 'P'}</Text>
                      </View>
                    )}
                    {!isCompleted && (
                      <View style={styles.verifiedBadge}>
                        <Icon name="check_circle" size={8} color={C.white} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.providerName} numberOfLines={1}>{request.providerDetails.name}</Text>
                    {request.providerDetails.rating > 0 && (
                      <View style={styles.ratingChip}>
                        <Icon name="star" size={10} color="#D97706" />
                        <Text style={styles.ratingChipText}>{Number(request.providerDetails.rating).toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {(isActive || isPending) && (
                  <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.btnCall} onPress={() => onCallProvider(request)} activeOpacity={0.7}>
                      <Icon name="phone" size={15} color={C.white} />
                    </TouchableOpacity>
                    {isActive && (
                      <TouchableOpacity style={styles.btnTrack} onPress={() => onTrackProvider(request)} activeOpacity={0.7}>
                        <Icon name="location" size={15} color={C.white} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
              )}
              </>
            )}

            {/* Sent to provider — waiting for acceptance (lastSentProviderId set but no providerId yet) */}
            {isPending && !hasProvider && isSentToProvider && (
              <View style={styles.sentToStrip}>
                <View style={styles.sentToStripRow}>
                  <Icon name="send" size={11} color={C.secondary} />
                  <Text style={styles.sentToStripText}>
                    {t('userHistory.waitingForAcceptance')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.findProvidersBtn}
                    onPress={() => onFindProviders(request)}
                    activeOpacity={0.7}
                  >
                    <Icon name="search" size={12} color={C.white} />
                    <Text style={styles.findProvidersBtnText}>{t('userHistory.find')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelSentStripBtn}
                    onPress={() => onCancel(request)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelSentStripBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* No provider at all — show Find Providers */}
            {isPending && !hasProvider && !isSentToProvider && (() => {
              const ageMs = Date.now() - new Date(request.createdAt).getTime();
              const isWithin30Min = ageMs < 30 * 60 * 1000;
              return (
                <View style={styles.noProviderStrip}>
                  <Icon name="clock" size={11} color={isWithin30Min ? '#92400E' : C.muted} />
                  <Text style={styles.noProviderStripText}>
                    {isWithin30Min ? t('userHistory.noProviderSelected') : t('userHistory.autoCancelWarning')}
                  </Text>
                  {isWithin30Min && (
                    <TouchableOpacity
                      style={styles.findProvidersBtn}
                      onPress={() => onFindProviders(request)}
                      activeOpacity={0.7}
                    >
                      <Icon name="search" size={12} color={C.white} />
                      <Text style={styles.findProvidersBtnText}>{t('userHistory.findProviders')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}

            {/* OTP */}
            {isActive && request.completionOtp && (
              isResendingThis ? (
                <View style={styles.otpBar}>
                  <View style={styles.otpLeft}>
                    <Icon name="lock" size={14} color={C.purple} />
                    <Text style={styles.otpLabel}>{t('userHistory.generatingOtp')}</Text>
                  </View>
                  <View style={styles.otpRight}>
                    <ShimmerBlock width={120} height={22} borderRadius={6} shimmerAnim={shimmerAnim} />
                  </View>
                </View>
              ) : isOtpExpired ? (
                <View style={[styles.otpBar, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <View style={styles.otpLeft}>
                    <Icon name="clock" size={14} color={C.danger} />
                    <Text style={[styles.otpLabel, { color: C.danger }]}>{t('userHistory.otpExpired')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.otpResendBtn}
                    onPress={() => onResendOtp(request)}
                    activeOpacity={0.7}
                  >
                    <Icon name="refresh" size={12} color={C.white} />
                    <Text style={styles.otpResendBtnText}>{t('userHistory.resend')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.otpBar} onPress={handleCopyOtp} activeOpacity={0.7}>
                  <View style={styles.otpLeft}>
                    <Icon name="lock" size={14} color={C.purple} />
                    <Text style={styles.otpLabel}>{t('userHistory.completionOtp')}</Text>
                  </View>
                  <View style={styles.otpRight}>
                    <Text style={styles.otpDigits}>{request.completionOtp}</Text>
                    <Icon name="copy" size={13} color={C.purple} />
                  </View>
                </TouchableOpacity>
              )
            )}

            {/* Cancel */}
            {isPending && (
              <TouchableOpacity style={styles.cancelRequestBtn} onPress={() => onCancel(request)} activeOpacity={0.7}>
                <Icon name="close" size={15} color={C.danger} />
                <Text style={styles.cancelRequestText}>{t('userHistory.cancelRequestBtn')}</Text>
              </TouchableOpacity>
            )}

            {/* View details */}
            <TouchableOpacity style={styles.detailsRow} onPress={onPress} activeOpacity={0.6}>
              <Text style={styles.detailsText}>{t('common.viewDetails')}</Text>
              <Icon name="chevron-right" size={15} color={C.secondary} />
            </TouchableOpacity>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

/* -- Empty State --------------------------------------------------------- */
const EmptyState = ({ filter, onBookService }) => {
  const { t } = useLanguage();
  const msg = filter === 'pending' ? t('userHistory.noPendingBookings') : filter === 'accepted' ? t('userHistory.noActiveBookings') : filter === 'completed' ? t('userHistory.noCompletedBookings') : filter === 'cancelled' ? t('userHistory.noCancelledBookings') : t('userHistory.noBookingsYet');
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyCircle}><Icon name="clipboard-list" size={44} color={C.muted} /></View>
      <Text style={styles.emptyTitle}>{t('userHistory.noBookingsFound')}</Text>
      <Text style={styles.emptyMsg}>{msg}</Text>
      {filter === 'all' && (
        <TouchableOpacity style={styles.emptyCta} onPress={onBookService} activeOpacity={0.7}>
          <Icon name="add" size={16} color={C.white} />
          <Text style={styles.emptyCtaText}>{t('userHistory.bookService')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/* -- Main Screen --------------------------------------------------------- */
const UserServiceHistoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { user, profile, userType, logout } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();

  // Set status bar for light background when this tab is focused
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor('transparent');
    }, [])
  );

  const appStateRef = useRef(AppState.currentState);
  const scrollY = useRef(new Animated.Value(0)).current;

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allRequests, setAllRequests] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0 });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [requestToRate, setRequestToRate] = useState(null);
  const [resendingOtpId, setResendingOtpId] = useState(null);
  const [ratingStatuses, setRatingStatuses] = useState({});
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState(null);

  const displayData = { ...user, ...profile };
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  // Animated collapse — fade + translate for smooth visual instead of height clip
  const statsOpacity = scrollY.interpolate({ inputRange: [0, 60], outputRange: [1, 0], extrapolate: 'clamp' });
  const statsHeight = scrollY.interpolate({ inputRange: [0, 100], outputRange: [STATS_HEIGHT, 0], extrapolate: 'clamp' });
  const statsTranslateY = scrollY.interpolate({ inputRange: [0, 100], outputRange: [0, -20], extrapolate: 'clamp' });

  // Prevent concurrent fetches from multiple triggers
  const fetchInProgressRef = useRef(false);
  const hasMountedRef = useRef(false);
  const refreshDebounceRef = useRef(null);

  const fetchRequests = useCallback(async (pageNum = 1, append = false) => {
    if (!userId) { setLoading(false); return; }
    // Guard against concurrent calls (except pagination appends)
    if (!append && fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;
    try {
      // Fetch all three service types in parallel using authenticated calls
      const fetchPromises = [
        getUserRequests(userId, { limit: PAGE_SIZE, page: pageNum, sortBy: 'createdAt', sortOrder: 'desc' }),
      ];
      if (pageNum === 1) {
        fetchPromises.push(
          // Event services — use authFetch for proper auth headers
          authFetch(`${NODE_BASE_URL}/api/event-services/user/${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }).then(r => r.json()).catch(err => {
            console.warn('[History] Event services fetch failed:', err.message);
            return { data: [] };
          }),
          // Emergency services — use the dedicated service function
          getUserEmergencyRequests(userId).catch(err => {
            console.warn('[History] Emergency services fetch failed:', err.message);
            return { success: false, requests: [] };
          }),
        );
      }

      const results = await Promise.all(fetchPromises);
      const traditionalResult = results[0];
      const eventResult = pageNum === 1 ? results[1] : null;
      const emergencyResult = pageNum === 1 ? results[2] : null;

      // Parse event bookings — handle both { data: [...] } and { services: [...] } response shapes
      const eventRaw = eventResult ? (eventResult.data || eventResult.services || []) : [];
      const eventBookings = (Array.isArray(eventRaw) ? eventRaw : []).map(b => {
        const loc = b.eventLocation || b.location || {};
        let coords = null;
        if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) { coords = loc.coordinates; }
        else if (loc.latitude && loc.longitude) { coords = [loc.longitude, loc.latitude]; }
        return {
          ...b, _id: b._id, requestId: b.requestId || b._id, serviceType: b.serviceType, status: b.status, createdAt: b.createdAt, isEventService: true,
          providerDetails: b.providerDetails || (b.providerId ? { _id: b.providerId, name: b.providerName || 'Provider' } : null),
          assignedProviderId: b.providerId, providerId: b.providerId, completionOtp: b.completionOtp, otpExpiresAt: b.otpExpiresAt || b.completionOtpExpiresAt, eventDate: b.eventDate,
          location: { address: loc.address || '', coordinates: coords, landmark: loc.landmark || '', latitude: loc.latitude, longitude: loc.longitude },
          serviceAddress: loc.address || '',
        };
      });

      // Parse emergency bookings — handle both { requests: [...] } and { data: [...] } response shapes
      const emergencyRaw = emergencyResult ? (emergencyResult.requests || emergencyResult.data || []) : [];
      const emergencyBookings = (Array.isArray(emergencyRaw) ? emergencyRaw : []).map(b => {
        // Build providerDetails — ensure _id is always set for hasProvider checks
        let pDetails = b.providerDetails || null;
        if (pDetails && b.providerId && !pDetails._id) {
          pDetails = { ...pDetails, _id: b.providerId };
        }
        if (!pDetails && b.providerId) {
          pDetails = { _id: b.providerId, name: b.providerInfo?.name || 'Provider', phone: b.providerInfo?.phone };
        }
        return {
          ...b, _id: b._id, requestId: b.requestId || b._id, serviceType: b.serviceType, status: b.status, createdAt: b.createdAt, isEmergencyService: true,
          providerDetails: pDetails,
          assignedProviderId: b.providerId, providerId: b.providerId, completionOtp: b.completionOtp, otpExpiresAt: b.otpExpiresAt || b.completionOtpExpiresAt, location: b.location, notes: b.notes,
        };
      });

      if (__DEV__) {
        console.log('[History] Fetched:', { traditional: (traditionalResult.success ? traditionalResult.requests : []).length, event: eventBookings.length, emergency: emergencyBookings.length });
      }

      const newTraditional = traditionalResult.success ? traditionalResult.requests : [];
      const pagination = traditionalResult.pagination;
      if (pagination) setHasMore(pageNum < (pagination.totalPages || 1));
      else setHasMore(newTraditional.length === PAGE_SIZE);

      if (append) {
        setAllRequests(prev => {
          const ids = new Set(prev.map(r => r._id));
          return [...prev, ...newTraditional.filter(r => !ids.has(r._id))];
        });
      } else {
        const combined = [...newTraditional, ...eventBookings, ...emergencyBookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setAllRequests(combined);

        // If there are more traditional requests than loaded, fetch ALL for accurate stats before setting
        if ((traditionalResult.count || 0) > PAGE_SIZE) {
          getUserRequests(userId, { limit: 500, page: 1 }).then(allResult => {
            if (allResult.success) {
              const allTraditional = allResult.requests || [];
              const allCombined = [...allTraditional, ...eventBookings, ...emergencyBookings];
              const ns = {
                total: allCombined.length,
                active: allCombined.filter(r => ACTIVE_STATUSES.includes(r.status)).length,
                completed: allCombined.filter(r => r.status === 'completed').length,
              };
              setStats(prev => prev.total === ns.total && prev.active === ns.active && prev.completed === ns.completed ? prev : ns);
            }
          }).catch(() => {
            // Fallback to partial stats if full fetch fails
            const ns = {
              total: combined.length,
              active: combined.filter(r => ACTIVE_STATUSES.includes(r.status)).length,
              completed: combined.filter(r => r.status === 'completed').length,
            };
            setStats(prev => prev.total === ns.total && prev.active === ns.active && prev.completed === ns.completed ? prev : ns);
          });
        } else {
          // All data already loaded — set stats once
          const ns = {
            total: combined.length,
            active: combined.filter(r => ACTIVE_STATUSES.includes(r.status)).length,
            completed: combined.filter(r => r.status === 'completed').length,
          };
          setStats(prev => prev.total === ns.total && prev.active === ns.active && prev.completed === ns.completed ? prev : ns);
        }
      }
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      fetchInProgressRef.current = false;
    }
  }, [userId]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    fetchRequests(page + 1, true);
  }, [loadingMore, hasMore, loading, page, fetchRequests]);

  const onRefresh = async () => { setRefreshing(true); setPage(1); setHasMore(true); await fetchRequests(1, false); setRefreshing(false); };

  // Initial fetch on mount
  useEffect(() => { fetchRequests(1, false); hasMountedRef.current = true; }, [fetchRequests]);

  // Rating statuses
  useEffect(() => {
    const fetchRatingStatuses = async () => {
      const completed = allRequests.filter(r => r.status === 'completed');
      if (completed.length === 0) return;
      const statuses = {};
      await Promise.all(completed.map(async (req) => {
        if (ratingStatuses[req._id]) { statuses[req._id] = ratingStatuses[req._id]; return; }
        try { statuses[req._id] = await checkRatingStatus(req._id); }
        catch { statuses[req._id] = { rated: false }; }
      }));
      setRatingStatuses(prev => ({ ...prev, ...statuses }));
    };
    if (allRequests.length > 0) fetchRatingStatuses();
  }, [allRequests]);

  // Auto-refresh preference
  useEffect(() => {
    AsyncStorage.getItem('app_preferences').then(saved => {
      if (saved) { const p = JSON.parse(saved); setAutoRefreshEnabled(p.autoRefresh !== false); }
    }).catch(() => {});
  }, []);

  /**
   * Debounced refresh — coalesces multiple rapid triggers (socket, FCM, focus, appstate)
   * into a single API call. Waits 500ms after the last trigger before firing.
   */
  const debouncedRefresh = useCallback(() => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = null;
      fetchRequests();
    }, 500);
  }, [fetchRequests]);

  // Cleanup debounce on unmount
  useEffect(() => () => { if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current); }, []);

  // Auto-refresh on focus (skip initial mount — mount effect handles it)
  useEffect(() => {
    if (!hasMountedRef.current) return;
    if (isFocused && autoRefreshEnabled && !loading) debouncedRefresh();
  }, [isFocused]);

  // Periodic refresh — 30s interval (only when focused)
  useEffect(() => {
    if (!isFocused || !autoRefreshEnabled) return;
    const interval = setInterval(() => fetchRequests(), 30000);
    return () => clearInterval(interval);
  }, [isFocused, autoRefreshEnabled, fetchRequests]);

  // AppState listener — refresh when returning to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (ns) => {
      if (appStateRef.current.match(/inactive|background/) && ns === 'active' && isFocused && autoRefreshEnabled) debouncedRefresh();
      appStateRef.current = ns;
    });
    return () => sub.remove();
  }, [isFocused, autoRefreshEnabled, debouncedRefresh]);

  // Socket listeners — debounced to coalesce rapid events
  useEffect(() => {
    const cleanups = [
      addSocketListener('request:accepted', () => { if (autoRefreshEnabled) debouncedRefresh(); }),
      addSocketListener('request:completed', () => { if (autoRefreshEnabled) debouncedRefresh(); }),
      addSocketListener('request:status', () => { if (autoRefreshEnabled) debouncedRefresh(); }),
      addSocketListener('provider:assigned', () => { if (autoRefreshEnabled) debouncedRefresh(); }),
    ];
    return () => cleanups.forEach(fn => fn());
  }, [autoRefreshEnabled, debouncedRefresh]);

  // FCM foreground — debounced
  useEffect(() => {
    const unsub = setupForegroundMessageListener(() => { if (autoRefreshEnabled) debouncedRefresh(); });
    return () => { if (unsub) unsub(); };
  }, [autoRefreshEnabled, debouncedRefresh]);

  const handleCallProvider = (request) => {
    const phone = request.providerDetails?.phone || request.providerDetails?.verifiedPhone;
    if (!phone) { dialog(t('common.error'), t('userHistory.phoneUnavailable')); return; }
    dialog(t('userHistory.callProviderTitle'), t('userHistory.callProviderMsg', { name: request.providerDetails?.name || 'Provider', phone }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.callNow'), onPress: () => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => dialog(t('common.error'), t('userHistory.cannotCall'))) },
    ]);
  };

  const handleTrackProvider = (request) => {
    let serviceCoords = null;
    if (request.location?.coordinates && Array.isArray(request.location.coordinates)) {
      const [lng, lat] = request.location.coordinates;
      if (lat && lng) serviceCoords = { latitude: lat, longitude: lng };
    } else if (request.location?.latitude && request.location?.longitude) {
      serviceCoords = { latitude: request.location.latitude, longitude: request.location.longitude };
    } else if (request.eventLocation?.coordinates) {
      const coords = request.eventLocation.coordinates;
      if (coords.latitude && coords.longitude) serviceCoords = { latitude: coords.latitude, longitude: coords.longitude };
      else if (Array.isArray(coords) && coords.length === 2) serviceCoords = { latitude: coords[1], longitude: coords[0] };
    }
    navigation.navigate('LiveTracking', {
      requestId: request._id,
      providerId: request.assignedProviderId || request.providerId,
      providerName: request.providerDetails?.name || request.providerName,
      providerPhone: request.providerDetails?.phone,
      serviceCategory: request.serviceType || request.serviceCategory || request.category,
      serviceLocation: serviceCoords,
      serviceAddress: request.serviceAddress || request.address || request.location?.address || request.eventLocation?.address,
      isEmergencyService: request.isEmergencyService,
      isEventService: request.isEventService,
    });
  };

  const handleCancel = (request) => { setRequestToCancel(request); setCancelModalVisible(true); };

  const executeCancellation = async (reason) => {
    if (!requestToCancel) return;
    setCancellingRequest(true);
    try {
      let result;
      const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
      const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
      const isEvent = requestToCancel.isEventService || EVENT_SERVICE_TYPES.includes(requestToCancel?.serviceType);
      const isEmergency = requestToCancel.isEmergencyService || EMERGENCY_SERVICE_TYPES.includes(requestToCancel?.serviceType);

      if (isEvent) {
        const r = await authFetch(`${NODE_BASE_URL}/api/event-services/${requestToCancel._id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, reason, cancelledBy: 'user' }) });
        result = await r.json(); result.success = r.ok && result.statusCode !== 500;
      } else if (isEmergency) {
        const r = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${requestToCancel._id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, reason, cancelledBy: 'user' }) });
        result = await r.json(); result.success = r.ok && result.statusCode !== 500;
      } else {
        result = await cancelRequest(requestToCancel._id, userId, reason);
      }

      setCancelModalVisible(false);
      if (result.success) {
        // Optimistic update — immediately mark cancelled in local state
        setAllRequests(prev => prev.map(r =>
          r._id === requestToCancel._id ? { ...r, status: 'cancelled' } : r
        ));
        dialog(t('userHistory.cancelledTitle'), t('userHistory.cancelledMsg'));
        // Background refresh to sync with backend
        setTimeout(() => onRefresh(), 1500);
      }
      else {
        const errMsg = (result.error || result.message || '').toLowerCase();
        if (errMsg.includes('already cancel')) {
          // Already cancelled — update UI anyway
          setAllRequests(prev => prev.map(r =>
            r._id === requestToCancel._id ? { ...r, status: 'cancelled' } : r
          ));
          dialog(t('userHistory.alreadyCancelled'), t('userHistory.alreadyCancelledMsg'));
        } else if (errMsg.includes('completed')) {
          dialog(t('userHistory.cannotCancel'), t('userHistory.cannotCancelMsg'));
          onRefresh();
        } else {
          dialog(t('userHistory.unableToCancel'), result.error || result.message || t('common.somethingWentWrong'));
        }
      }
    } catch (e) {
      dialog(t('common.connectionError'), t('common.connectionErrorMsg'));
    }
    finally { setCancellingRequest(false); setRequestToCancel(null); }
  };

  const handleViewDetails = (request) => navigation.navigate('ServiceRequestDetail', { requestId: request._id, request });

  const handleFindProviders = (request) => navigation.navigate('HomeTab', { resumeRequest: request });

  const handleResendOtp = useCallback(async (request) => {
    setResendingOtpId(request._id);
    try {
      let result;
      if (request.isEventService) {
        const response = await authFetch(`${NODE_BASE_URL}/api/event-services/${request._id}/resend-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        result = await response.json();
        if (!response.ok) result.success = false;
      } else if (request.isEmergencyService) {
        const response = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${request._id}/resend-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        result = await response.json();
        if (!response.ok) result.success = false;
      } else {
        result = await resendCompletionOtp(request._id);
      }
      if (result.success) {
        await fetchRequests(1, false);
        dialog(t('userHistory.otpSent'), t('userHistory.otpSentMsg'));
      } else {
        dialog(t('common.error'), result.error || result.message || t('userHistory.otpResendError'));
      }
    } catch (error) {
      console.error('[History ResendOTP] Error:', error);
      dialog(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setResendingOtpId(null);
    }
  }, [fetchRequests]);

  const handleOpenRating = (request) => { setRequestToRate(request); setRatingModalVisible(true); };

  const handleSubmitRating = async (requestId, rating, review) => {
    if (!requestToRate) return;
    const providerId = requestToRate.assignedProviderId || requestToRate.providerId || requestToRate.providerDetails?._id;
    const result = await submitRating(requestToRate._id, userId, rating, review, providerId);
    if (result.success) {
      const finalRating = result.alreadyRated ? result.existingRating : rating;
      setAllRequests(prev => prev.map(r => r._id === requestToRate._id ? { ...r, _rated: true, ratings: { ...r.ratings, userRating: finalRating, userReview: review, ratedAt: new Date().toISOString() } } : r));
      setRatingStatuses(prev => ({ ...prev, [requestToRate._id]: { rated: true, rating: { rating: finalRating, review, date: new Date().toISOString() } } }));
    }
    return result;
  };

  const filteredRequests = useMemo(() => {
    let f = allRequests;
    // Category filter
    if (categoryFilter === 'emergency') f = f.filter(r => r.isEmergencyService);
    else if (categoryFilter === 'event') f = f.filter(r => r.isEventService);
    else if (categoryFilter === 'traditional') f = f.filter(r => !r.isEmergencyService && !r.isEventService);
    // Status filter
    switch (activeFilter) {
      case 'all': break;
      case 'accepted': f = f.filter(r => ['accepted', 'in-progress', 'awaiting_confirmation', 'in_transit', 'arrived'].includes(r.status)); break;
      case 'cancelled': f = f.filter(r => ['cancelled', 'expired', 'rejected'].includes(r.status)); break;
      default: f = f.filter(r => r.status === activeFilter); break;
    }
    const dr = getDateRange(datePreset);
    if (dr) f = f.filter(r => ACTIVE_STATUSES.includes(r.status) ? true : new Date(r.serviceDate || r.createdAt) >= dr.start && new Date(r.serviceDate || r.createdAt) <= dr.end);
    return f;
  }, [allRequests, activeFilter, categoryFilter, datePreset]);

  if (loading) return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenShimmer type="cardList" />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setIsDrawerOpen(true)} activeOpacity={0.7} style={styles.logoBtn}>
          <Image source={FIXHOMI_LOGO} style={styles.logoImg} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('userHistory.myBookings')}</Text>
        <AvatarButton name={displayData?.fullName} profilePicture={displayData?.profilePicture} onPress={() => navigation.navigate('Profile')} />
      </View>

      {/* Collapsible Stats */}
      <Animated.View style={{ height: statsHeight, overflow: 'hidden', backgroundColor: C.white }}>
        <Animated.View style={[styles.statsBar, { opacity: statsOpacity, transform: [{ translateY: statsTranslateY }] }]}>
          <View style={styles.statsRow}>
            <StatPill value={stats.total} label="Total" color={C.primary} bgColor="#FFF7ED" />
            <StatPill value={stats.active} label="Active" color={C.success} bgColor={C.successBg} />
            <StatPill value={stats.completed} label="Done" color={C.secondary} bgColor="#EFF6FF" />
          </View>
        </Animated.View>
      </Animated.View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        {/* Status filters */}
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll} style={{ flex: 1 }}>
            {FILTER_TABS.map(t => {
              const active = activeFilter === t.key;
              return (
                <TouchableOpacity key={t.key} style={[styles.filterPill, active && styles.filterPillActive]} onPress={() => setActiveFilter(t.key)} activeOpacity={0.7}>
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.filterIconSeparator} />
          <TouchableOpacity style={[styles.filterIconBtn, showDateFilter && styles.filterIconBtnOn]} onPress={() => setShowDateFilter(v => !v)} activeOpacity={0.7}>
            <Icon name={showDateFilter || datePreset !== 'all' ? 'filter-outline' : 'filter-off-outline'} size={18} color={showDateFilter ? C.white : C.textSec} />
            {datePreset !== 'all' && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>

        {/* Category filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORY_TABS.map(t => {
            const active = categoryFilter === t.key;
            return (
              <TouchableOpacity key={t.key} style={[styles.categoryChip, active && styles.categoryChipActive]} onPress={() => setCategoryFilter(t.key)} activeOpacity={0.7}>
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Date chips */}
        {showDateFilter && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
            {DATE_PRESETS.map(p => {
              const a = datePreset === p.key;
              return (
                <TouchableOpacity key={p.key} style={[styles.dateChip, a && styles.dateChipOn]} onPress={() => setDatePreset(p.key)} activeOpacity={0.7}>
                  <Text style={[styles.dateChipText, a && styles.dateChipTextOn]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* List */}
      <Animated.FlatList
        data={filteredRequests}
        keyExtractor={item => item.requestId || item._id}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={8}
        ListHeaderComponent={
          (activeFilter !== 'all' || categoryFilter !== 'all' || datePreset !== 'all') ? (
            <Text style={styles.resultCount}>{filteredRequests.length} {filteredRequests.length === 1 ? 'booking' : 'bookings'}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            onPress={() => handleViewDetails(item)}
            onCancel={handleCancel}
            onCallProvider={handleCallProvider}
            onTrackProvider={handleTrackProvider}
            onRate={handleOpenRating}
            onFindProviders={handleFindProviders}
            ratingStatus={ratingStatuses[item._id]}
            onResendOtp={handleResendOtp}
            resendingOtpId={resendingOtpId}
          />
        )}
        ListEmptyComponent={<EmptyState filter={activeFilter} onBookService={() => navigation.navigate('Home')} />}
        ListFooterComponent={loadingMore ? <View style={styles.footerLoader}><ActivityIndicator size="small" color={C.primary} /><Text style={styles.footerText}>Loading more...</Text></View> : null}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={[styles.listPad, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      />

      <DrawerMenu visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} user={displayData} userType={userType} navigation={navigation} onLogout={logout} isVerified={displayData?.isPhoneVerified && displayData?.isEmailVerified} activeTab="history" />

      <RatingModal
        visible={ratingModalVisible}
        providerName={requestToRate?.providerDetails?.name}
        providerProfilePicture={requestToRate?.providerDetails?.profilePicture}
        serviceName={SERVICE_TYPE_LABELS[requestToRate?.serviceType] || requestToRate?.serviceType}
        requestId={requestToRate?._id}
        onClose={() => { setRatingModalVisible(false); setRequestToRate(null); }}
        onSubmit={handleSubmitRating}
      />

      <CancellationReasonModal
        visible={cancelModalVisible}
        onClose={() => { setCancelModalVisible(false); setRequestToCancel(null); }}
        onSubmit={executeCancellation}
        cancellerRole="user"
        loading={cancellingRequest}
        serviceName={SERVICE_TYPE_LABELS[requestToCancel?.serviceType] || requestToCancel?.serviceType}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, backgroundColor: C.white, zIndex: 10 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  logoBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  logoImg: { width: 40, height: 40, borderRadius: 20 },

  // Loader
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 12, fontSize: 14, fontWeight: '500', color: C.textSec },

  // Collapsible Stats
  statsBar: { backgroundColor: C.white, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statPill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  statSvgBg: { ...StyleSheet.absoluteFillObject },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 1 },
  statLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Filter section — unified container
  filterSection: { backgroundColor: C.white, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#E8ECF0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 3 },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  filterPillActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterPillText: { fontSize: 13, fontWeight: '600', color: C.textSec },
  filterPillTextActive: { color: C.white },
  filterIconSeparator: { width: 1, height: 24, backgroundColor: '#E2E8F0', marginRight: 10 },
  filterIconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  filterIconBtnOn: { backgroundColor: C.secondary, borderColor: C.secondary },
  filterDot: { position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary, borderWidth: 1.5, borderColor: C.white },

  // Category chips
  categoryScroll: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8, gap: 6 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  categoryChipActive: { backgroundColor: '#EFF6FF', borderColor: C.secondary },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: C.muted },
  categoryChipTextActive: { color: C.secondary },

  // Date chips
  dateScroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 6 },
  dateChip: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  dateChipOn: { backgroundColor: C.secondary, borderColor: C.secondary },
  dateChipText: { fontSize: 12, fontWeight: '600', color: C.textSec },
  dateChipTextOn: { color: C.white },

  // Result count
  resultCount: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 6 },

  // List
  listPad: { padding: 14, paddingBottom: 40 },

  // Card
  card: { backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E8ECF0', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6 },
  cardPending: { borderColor: C.primary + '50', borderWidth: 1.5, borderLeftWidth: 4, borderLeftColor: C.primary },
  cardCompact: { padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  svcIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  svcNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  svcName: { fontSize: 15, fontWeight: '700', color: C.text, textTransform: 'capitalize', flexShrink: 1 },
  typeBadge: { backgroundColor: '#F3E8FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 8, fontWeight: '800', color: C.purple, letterSpacing: 0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Cancel strip
  cancelStrip: { backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#FDE68A' },
  cancelStripDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  cancelStripText: { fontSize: 11, fontWeight: '500', flex: 1, lineHeight: 16 },

  // Compact
  compactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  compactDate: { fontSize: 12, fontWeight: '500', color: C.muted },
  compactProvider: { fontSize: 12, fontWeight: '500', color: C.textSec },

  // Rating row (for compact done cards)
  ratingRow: { marginTop: 8 },
  ratedStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A' },
  ratedText: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  rateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.gold, paddingVertical: 10, borderRadius: 12, shadowColor: C.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  rateBtnText: { fontSize: 13, fontWeight: '700', color: C.white },

  // Date/Time
  dtRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#EEF2F6' },
  dtItem: { flex: 1, alignItems: 'center' },
  dtLabel: { fontSize: 9, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  dtVal: { fontSize: 13, fontWeight: '600', color: C.text },
  dtDiv: { width: 1, height: 28, backgroundColor: '#E2E8F0', marginHorizontal: 4 },

  // Provider
  providerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, marginBottom: 10 },
  providerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  avatarWrap: { position: 'relative' },
  providerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: C.secondary },
  providerAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.secondary, alignItems: 'center', justifyContent: 'center' },
  providerInitial: { fontSize: 15, fontWeight: '700', color: C.white },
  verifiedBadge: { position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: 7, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white },
  providerName: { fontSize: 14, fontWeight: '600', color: C.text },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start', marginTop: 2 },
  ratingChipText: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  quickActions: { flexDirection: 'row', gap: 7 },
  btnCall: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center', shadowColor: C.success, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  btnTrack: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },

  // OTP
  otpBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.purpleBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: '#DDD6FE' },
  otpLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  otpLabel: { fontSize: 12, fontWeight: '600', color: C.purple },
  otpRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  otpDigits: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: 6 },
  otpResendBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.danger, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  otpResendBtnText: { fontSize: 12, fontWeight: '700', color: C.white },

  // Cancel request
  cancelRequestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#FEF2F2', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', marginBottom: 10 },
  cancelRequestText: { fontSize: 13, fontWeight: '600', color: C.danger },

  // Details row
  detailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  detailsText: { fontSize: 13, fontWeight: '600', color: C.secondary },

  // Footer
  footerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  footerText: { fontSize: 13, fontWeight: '500', color: C.muted },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 40 },
  emptyCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 6 },
  emptyMsg: { fontSize: 13, fontWeight: '500', color: C.textSec, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.primary, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  emptyCtaText: { fontSize: 14, fontWeight: '700', color: C.white },

  // Sent-to / no-provider strips
  sentToStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: C.secondary + '20' },
  sentToStripRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  sentToStripText: { fontSize: 11, fontWeight: '600', color: C.secondary },
  cancelSentStripBtn: { backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FECACA', marginLeft: 8 },
  cancelSentStripBtnText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  noProviderStrip: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#FDE68A' },
  noProviderStripText: { fontSize: 11, fontWeight: '600', color: '#92400E', flex: 1 },
  findProvidersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.secondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  findProvidersBtnText: { fontSize: 11, fontWeight: '700', color: C.white },
});

export default UserServiceHistoryScreen;
