/**
 * Provider Service History Screen — Unified v6.0
 *
 * Single screen for all provider jobs:
 * - Traditional, Event, and Emergency services
 * - Accept/Reject for pending requests
 * - OTP completion & cancellation modals
 * - Date filter + status filter tabs
 * - Stats pills (non-collapsible for cross-device consistency)
 * - Fixhomi logo header + drawer menu
 * - Socket + FCM real-time updates
 * - Paginated infinite scroll with background stats fetch
 *
 * @version 6.0.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Linking,
  Platform,
  ScrollView,
  AppState,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import { Icon, ServiceIcon, CancellationReasonModal } from '../components';
import ScreenShimmer from '../components/ShimmerLoader';
import {
  getProviderRequests,
  acceptRequestAsProvider,
  verifyCompletionOtp,
  providerCancelRequest,
  SERVICE_TYPE_LABELS,
} from '../services/traditionalServiceService';
import { addEventListener as addSocketListener, startRequestLocationTracking, stopRequestLocationTracking } from '../services/socketService';
import { setupForegroundMessageListener } from '../services/fcmService';
import { STATIC_NUMBER_SERVICES, getProviderEmergencyRequests } from '../services/emergencyServicesService';
import { authFetch } from '../utils/authFetch';
import { NODE_BASE_URL } from '../config/api';

const FIXHOMI_LOGO = require('../assets/fixhomi_logo.jpg');

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
  purple: '#8B5CF6',
  purpleBg: '#EDE9FE',
  blue: '#3B82F6',
  blueBg: '#DBEAFE',
  gold: '#F59E0B',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: C.primary, bgColor: '#FEF3C7', dotColor: C.primary },
  awaiting_confirmation: { label: 'Awaiting', color: C.primary, bgColor: '#FEF3C7', dotColor: C.primary },
  accepted: { label: 'Accepted', color: C.blue, bgColor: C.blueBg, dotColor: C.blue },
  'in-progress': { label: 'In Progress', color: C.purple, bgColor: C.purpleBg, dotColor: C.purple },
  in_transit: { label: 'On The Way', color: C.blue, bgColor: C.blueBg, dotColor: C.blue },
  arrived: { label: 'Arrived', color: C.blue, bgColor: C.blueBg, dotColor: C.blue },
  completed: { label: 'Completed', color: C.success, bgColor: C.successBg, dotColor: C.success },
  cancelled: { label: 'Cancelled', color: C.danger, bgColor: C.dangerBg, dotColor: C.danger },
  rejected: { label: 'Rejected', color: C.danger, bgColor: C.dangerBg, dotColor: C.danger },
  expired: { label: 'Expired', color: C.muted, bgColor: '#F1F5F9', dotColor: C.muted },
};

const FILTER_TABS = [
  { key: 'all', label: 'All Jobs' },
  { key: 'pending', label: 'New' },
  { key: 'active', label: 'Active' },
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

/* ── Stat Pill ─────────────────────────────────────────────────────── */
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

/* ── OTP Modal ─────────────────────────────────────────────────────── */
const OTPModal = ({ visible, onClose, onVerify, isVerifying, error }) => {
  const { t } = useLanguage();
  const [otp, setOtp] = useState('');
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 5;
  const isLocked = attempts >= MAX_ATTEMPTS;

  useEffect(() => { if (visible) { setOtp(''); setAttempts(0); } }, [visible]);

  const handleOtpChange = (text) => {
    // Security: Only allow numeric digits
    const sanitized = text.replace(/[^0-9]/g, '');
    if (sanitized.length <= 6) setOtp(sanitized);
  };

  const handleVerify = () => {
    if (otp.length !== 6 || isVerifying || isLocked) return;
    setAttempts(prev => prev + 1);
    onVerify(otp);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('providerHistory.enterCompletionOtp')}</Text>
                <TouchableOpacity onPress={onClose} style={styles.modalClose}>
                  <Icon name="close" size={22} color={C.textSec} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>{t('providerHistory.enterCompletionOtpSub')}</Text>
              <TextInput
                style={[styles.otpInput, isLocked && { borderColor: '#EF4444', backgroundColor: '#FEF2F2' }]}
                value={otp}
                onChangeText={handleOtpChange}
                placeholder="000000"
                placeholderTextColor="#D1D5DB"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                editable={!isLocked && !isVerifying}
                secureTextEntry={false}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                returnKeyType="done"
                onSubmitEditing={handleVerify}
              />
              {error ? <Text style={styles.otpError}>{error}</Text> : null}
              {isLocked && (
                <Text style={styles.otpError}>{t('providerHistory.tooManyAttempts')}</Text>
              )}
              {attempts > 0 && attempts < MAX_ATTEMPTS && !error && (
                <Text style={[styles.otpHintText, { color: C.muted }]}>{t('providerHistory.attemptsRemaining', { n: MAX_ATTEMPTS - attempts })}</Text>
              )}
              <TouchableOpacity
                style={[styles.verifyBtn, (otp.length !== 6 || isLocked) && styles.verifyBtnDisabled]}
                onPress={handleVerify}
                disabled={otp.length !== 6 || isVerifying || isLocked}
              >
                {isVerifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyBtnText}>{t('providerHistory.verifyComplete')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ── Request Card ──────────────────────────────────────────────────── */
const RequestCard = ({ request, onPress, onCall, onDirections, onComplete, onCancel, onAccept, onReject, isAccepting, isRejecting }) => {
  const { t } = useLanguage();
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const serviceDate = new Date(request.serviceDate || request.createdAt);
  const shortId = (request.requestId || request._id || '').slice(-6).toUpperCase();
  const isDone = ['completed', 'cancelled', 'rejected', 'expired'].includes(request.status);
  const isActive = ['accepted', 'in-progress', 'in_transit', 'arrived'].includes(request.status);
  const isPending = ['pending', 'awaiting_confirmation'].includes(request.status);
  const hasLocation = request.location?.coordinates || request.location?.latitude;
  const isLocationTrackable = !STATIC_NUMBER_SERVICES.includes(request.serviceType);
  const isEvent = request.isEventService;
  const isEmergency = request.isEmergencyService;
  const serviceAddress = request.serviceAddress || request.location?.address || request.address;

  return (
    <TouchableOpacity style={[styles.card, isPending && styles.cardPending, isDone && styles.cardCompact]} onPress={onPress} activeOpacity={0.7}>
      {/* Header */}
      <View style={[styles.cardTop, isDone && { marginBottom: 4 }]}>
        <View style={styles.cardTopLeft}>
          <View style={styles.svcIcon}>
            <ServiceIcon serviceType={request.serviceType} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.svcNameRow}>
              <Text style={styles.svcName} numberOfLines={1}>{SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}</Text>
              {isEvent && <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>EVENT</Text></View>}
              {isEmergency && <View style={[styles.typeBadge, { backgroundColor: '#FEE2E2' }]}><Text style={[styles.typeBadgeText, { color: '#DC2626' }]}>SOS</Text></View>}
            </View>
            <Text style={styles.svcId}>#{shortId}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
          <View style={[styles.statusDot, { backgroundColor: status.dotColor }]} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Cancellation strip */}
      {isDone && (request.cancellationReason || request.cancelReason || request.rejectReason) && (() => {
        const by = request.cancelledBy;
        const reason = request.rejectReason || request.cancellationReason || request.cancelReason;
        let label = by === 'user' ? t('providerHistory.cancelledByCustomer') : by === 'provider' ? t('providerHistory.cancelledByYou') : by === 'system' ? t('userHistory.cancelledBySystem') : reason || t('userHistory.requestCancelled');
        const generic = ['user cancelled', 'cancelled by user', 'cancelled by provider', 'provider cancelled'];
        if (reason && !generic.includes(reason.toLowerCase()) && by) label += ` \u2014 ${reason}`;
        return (
          <View style={styles.cancelStrip}>
            <Icon name="info" size={13} color="#B91C1C" />
            <Text style={styles.cancelStripText} numberOfLines={2}>{label}</Text>
          </View>
        );
      })()}

      {/* Compact done row */}
      {isDone && (
        <View style={styles.compactRow}>
          <Text style={styles.compactDate}>{serviceDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          {request.userDetails?.name && <Text style={styles.compactCustomer}>{request.userDetails.name}</Text>}
        </View>
      )}

      {/* Active / Pending content */}
      {!isDone && (
        <>
          {/* Customer */}
          {request.userDetails && (
            <View style={styles.customerRow}>
              <View style={styles.customerAvatar}>
                {request.userDetails.profilePicture ? (
                  <Image source={{ uri: typeof request.userDetails.profilePicture === 'string' ? request.userDetails.profilePicture : request.userDetails.profilePicture?.url }} style={styles.customerAvatarImg} />
                ) : (
                  <Text style={styles.customerInitial}>{request.userDetails.name?.charAt(0).toUpperCase() || 'C'}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName} numberOfLines={1}>{request.userDetails.name || request.userName || t('providerHistory.customer')}</Text>
                {isActive && request.userDetails.phone && <Text style={styles.customerPhone}>{request.userDetails.phone}</Text>}
              </View>
              {(isActive || isPending) && (
                <View style={styles.quickActions}>
                  <TouchableOpacity style={styles.btnCall} onPress={() => onCall(request)}><Icon name="phone" size={15} color={C.white} /></TouchableOpacity>
                  {isActive && hasLocation && isLocationTrackable && (
                    <TouchableOpacity style={styles.btnDir} onPress={() => onDirections(request)}><Icon name="directions" size={15} color={C.white} /></TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Location */}
          {serviceAddress && (
            <View style={styles.locRow}>
              <Icon name="location" size={14} color={C.danger} />
              <Text style={styles.locText} numberOfLines={2}>{serviceAddress}</Text>
            </View>
          )}

          {/* Description */}
          {request.description && (
            <Text style={styles.descInline} numberOfLines={1}>{request.description}</Text>
          )}

          {/* Date/Time */}
          <View style={styles.dtRow}>
            <View style={styles.dtItem}>
              <Text style={styles.dtLabel}>{t('common.date')}</Text>
              <Text style={styles.dtVal}>
                {isEvent && request.eventDate
                  ? new Date(request.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : serviceDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            {request.serviceTime && !isEmergency && (() => {
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

          {/* PENDING: Map + Accept/Reject in one row */}
          {isPending && (
            <View style={styles.pendingActionRow}>
              {hasLocation && isLocationTrackable && (
                <TouchableOpacity style={styles.viewMapBtnCompact} onPress={() => onDirections(request)} activeOpacity={0.7}>
                  <Icon name="navigate" size={15} color={C.secondary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.rejectBtn, isRejecting && styles.btnDisabled]}
                onPress={() => onReject(request)}
                disabled={isRejecting || isAccepting}
              >
                {isRejecting ? <ActivityIndicator color={C.danger} size="small" /> : (
                  <><Icon name="close" size={15} color={C.danger} /><Text style={styles.rejectBtnText}>{t('providerHistory.reject')}</Text></>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptBtn, isAccepting && styles.btnDisabled]}
                onPress={() => onAccept(request)}
                disabled={isAccepting || isRejecting}
              >
                {isAccepting ? <ActivityIndicator color="#fff" size="small" /> : (
                  <><Icon name="check" size={15} color="#fff" /><Text style={styles.acceptBtnText}>{t('providerHistory.accept')}</Text></>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ACTIVE: Complete + Cancel */}
          {isActive && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.completeBtn} onPress={() => onComplete(request)} activeOpacity={0.7}>
                <Icon name="check-circle" size={15} color={C.white} />
                <Text style={styles.completeBtnText}>{t('providerHistory.complete')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelIconBtn} onPress={() => onCancel(request)} activeOpacity={0.7}>
                <Icon name="close" size={17} color={C.danger} />
              </TouchableOpacity>
            </View>
          )}

          {/* View details */}
          <TouchableOpacity style={styles.detailsRow} onPress={onPress} activeOpacity={0.6}>
            <Text style={styles.detailsText}>{t('common.viewDetails')}</Text>
            <Icon name="chevron-right" size={15} color={C.secondary} />
          </TouchableOpacity>
        </>
      )}
    </TouchableOpacity>
  );
};

/* ── Empty State ───────────────────────────────────────────────────── */
const EmptyState = ({ filter }) => {
  const { t } = useLanguage();
  const msg = filter === 'pending' ? t('providerHistory.noNewRequests') : filter === 'active' ? t('providerHistory.noActiveJobs') : filter === 'completed' ? t('providerHistory.noCompletedJobs') : filter === 'cancelled' ? t('providerHistory.noCancelledJobs') : t('providerHistory.noJobsYet');
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyCircle}><Icon name="clipboard-list" size={44} color={C.muted} /></View>
      <Text style={styles.emptyTitle}>{t('providerHistory.noJobsFound')}</Text>
      <Text style={styles.emptyMsg}>{msg}</Text>
    </View>
  );
};

/* ── Main Screen ───────────────────────────────────────────────────── */
const ProviderServiceHistoryScreen = ({ navigation, route }) => {
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
  const fetchInProgressRef = useRef(false);
  const refreshDebounceRef = useRef(null);

  const initialTab = route?.params?.tab || 'all';

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allRequests, setAllRequests] = useState([]);
  const [activeFilter, setActiveFilter] = useState(initialTab);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, pending: 0, rating: 0 });

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelJob, setCancelJob] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const displayData = { ...user, ...profile };
  const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  // Load auto-refresh preference
  useEffect(() => {
    AsyncStorage.getItem('app_preferences').then(saved => {
      if (saved) { const p = JSON.parse(saved); setAutoRefreshEnabled(p.autoRefresh !== false); }
    }).catch(() => {});
  }, []);

  // Handle route params change (for deep linking)
  useEffect(() => {
    if (route?.params?.tab) setActiveFilter(route.params.tab);
  }, [route?.params?.tab]);

  /**
   * Fetch all jobs — traditional + event + emergency
   */
  const fetchJobs = useCallback(async (showLoading = true) => {
    if (!providerId) { setLoading(false); return; }
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const [traditionalResult, eventResult, emergencyResult] = await Promise.all([
        getProviderRequests(providerId, { page: 1, limit: 500, sortBy: 'createdAt', sortOrder: 'desc' }),
        authFetch(`${NODE_BASE_URL}/api/event-services/provider/${providerId}`, {
          method: 'GET', headers: { 'Content-Type': 'application/json' },
        }).then(r => r.json()).catch(err => {
          console.warn('[ProviderJobs] Event services fetch failed:', err.message);
          return { data: [] };
        }),
        getProviderEmergencyRequests(providerId).catch(err => {
          console.warn('[ProviderJobs] Emergency services fetch failed:', err.message);
          return { success: false, requests: [] };
        }),
      ]);

      // Format event services
      const eventData = Array.isArray(eventResult.data) ? eventResult.data : [];
      const eventBookings = eventData.map(b => {
        const loc = b.eventLocation || b.location || {};
        // Extract coordinates: try GeoJSON array, then separate lat/lng fields
        let coords = null;
        if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
          coords = loc.coordinates;
        } else if (loc.latitude && loc.longitude) {
          coords = [loc.longitude, loc.latitude];
        }
        return {
          ...b, _id: b._id, requestId: b.requestId || b._id, serviceType: b.serviceType, status: b.status,
          createdAt: b.createdAt, isEventService: true, eventDate: b.eventDate,
          userDetails: b.userDetails || (b.userId ? { name: b.userName || 'Customer' } : null),
          location: { address: loc.address || '', coordinates: coords, landmark: loc.landmark || '', latitude: loc.latitude, longitude: loc.longitude },
          serviceAddress: loc.address || '',
        };
      });

      // Format emergency services
      const rawEmergencyData = emergencyResult.requests || emergencyResult.data || [];
      const emergencyData = Array.isArray(rawEmergencyData) ? rawEmergencyData : [];
      const emergencyBookings = emergencyData.map(b => {
        const loc = b.location || {};
        return {
          ...b, _id: b._id, requestId: b.requestId || b._id, serviceType: b.serviceType, status: b.status,
          createdAt: b.createdAt, isEmergencyService: true,
          userDetails: b.userDetails || { name: 'Customer' },
          location: { ...loc, address: loc.address || loc.landmark || '', coordinates: loc.latitude && loc.longitude ? [loc.longitude, loc.latitude] : null },
          serviceAddress: loc.address || (loc.latitude ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : ''),
          description: b.notes,
        };
      });

      const combined = [
        ...(traditionalResult.success ? traditionalResult.requests : []),
        ...eventBookings,
        ...emergencyBookings,
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setAllRequests(combined);

      const rating = profile?.ratings?.average || profile?.rating || user?.rating || 0;
      const newStats = {
        total: combined.length,
        pending: combined.filter(r => ['pending', 'awaiting_confirmation'].includes(r.status)).length,
        active: combined.filter(r => ['accepted', 'in-progress', 'in_transit', 'arrived'].includes(r.status)).length,
        completed: combined.filter(r => r.status === 'completed').length,
        rating,
      };
      setStats(prev =>
        prev.total === newStats.total && prev.pending === newStats.pending &&
        prev.active === newStats.active && prev.completed === newStats.completed &&
        prev.rating === newStats.rating ? prev : newStats
      );
    } catch (error) {
      console.error('[ProviderJobs] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchInProgressRef.current = false;
    }
  }, [providerId, profile, user]);

  const debouncedRefresh = useCallback(() => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = null;
      fetchJobs(false);
    }, 500);
  }, [fetchJobs]);

  useEffect(() => () => { if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current); }, []);

  // Fetch on mount
  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Auto-refresh on focus (debounced to avoid duplicate calls)
  useEffect(() => { if (isFocused && autoRefreshEnabled && !loading) debouncedRefresh(); }, [isFocused]);

  // Periodic auto-refresh every 30s
  useEffect(() => {
    if (!isFocused || !autoRefreshEnabled) return;
    const interval = setInterval(() => debouncedRefresh(), 30000);
    return () => clearInterval(interval);
  }, [isFocused, autoRefreshEnabled, debouncedRefresh]);

  // AppState listener
  useEffect(() => {
    const sub = AppState.addEventListener('change', (ns) => {
      if (appStateRef.current.match(/inactive|background/) && ns === 'active' && isFocused && autoRefreshEnabled) debouncedRefresh();
      appStateRef.current = ns;
    });
    return () => sub.remove();
  }, [isFocused, autoRefreshEnabled, debouncedRefresh]);

  // Socket listeners (debounced to coalesce rapid events)
  useEffect(() => {
    const cleanups = [
      addSocketListener('new:request', () => { if (autoRefreshEnabled) debouncedRefresh(); }),
      addSocketListener('request:cancelled', () => { if (autoRefreshEnabled) debouncedRefresh(); }),
      addSocketListener('request:status', () => { if (autoRefreshEnabled) debouncedRefresh(); }),
      addSocketListener('request:accepted', () => { if (autoRefreshEnabled) debouncedRefresh(); }),
      addSocketListener('request:completed', () => { if (autoRefreshEnabled) debouncedRefresh(); }),
    ];
    return () => cleanups.forEach(fn => fn());
  }, [autoRefreshEnabled, debouncedRefresh]);

  // FCM foreground listener (debounced)
  useEffect(() => {
    const unsub = setupForegroundMessageListener(() => { if (autoRefreshEnabled) debouncedRefresh(); });
    return () => { if (unsub) unsub(); };
  }, [autoRefreshEnabled, debouncedRefresh]);

  const onRefresh = () => { setRefreshing(true); fetchJobs(false); };

  // ── Accept ──
  const handleAccept = (job) => {
    dialog(t('providerHistory.acceptRequest'), t('providerHistory.acceptRequestMsg', { type: SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('providerHistory.accept'), onPress: async () => {
        setAcceptingId(job._id);
        try {
          let result;
          if (job.isEmergencyService) {
            const r = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${job._id}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId, estimatedArrival: 15 }) });
            result = await r.json(); result.success = r.ok && result.success !== false;
          } else if (job.isEventService) {
            const r = await authFetch(`${NODE_BASE_URL}/api/event-services/${job._id}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
            result = await r.json(); result.success = r.ok && result.success !== false;
          } else {
            result = await acceptRequestAsProvider(job._id, providerId, job.userDetails?.email || '');
          }
          if (result.success) {
            // Start location tracking only for emergency (immediate) or services within 45 min
            const category = job.isEmergencyService ? 'emergency' : job.isEventService ? 'event' : 'traditional';
            const serviceTime = job.scheduledDateTime || job.eventDate || job.serviceDate;
            const parsedMs = serviceTime ? new Date(serviceTime).getTime() : null;
            const serviceMs = parsedMs && !isNaN(parsedMs) ? parsedMs : null;
            const isImminent = job.isEmergencyService || (serviceMs && (serviceMs - Date.now()) <= 45 * 60 * 1000);
            if (isImminent) {
              startRequestLocationTracking(job._id, providerId, null, category);
            }
            dialog(t('providerHistory.acceptedTitle'), t('providerHistory.acceptedMsg'));
            fetchJobs(false);
          } else {
            const errMsg = (result.error || result.message || '').toLowerCase();
            if (errMsg.includes('cancel')) {
              dialog(t('providerHistory.requestCancelledByCustomer'), t('providerHistory.requestCancelledByCustomer'));
              // Optimistic update — remove from list
              setAllRequests(prev => prev.filter(j => j._id !== job._id));
            } else if (errMsg.includes('expired') || errMsg.includes('timeout')) {
              dialog(t('providerHistory.requestExpired'), t('providerHistory.requestExpiredMsg'));
              setAllRequests(prev => prev.filter(j => j._id !== job._id));
            } else if (errMsg.includes('already') || errMsg.includes('accepted')) {
              dialog(t('providerHistory.alreadyAccepted'), t('providerHistory.alreadyAcceptedMsg'));
              setAllRequests(prev => prev.filter(j => j._id !== job._id));
            } else if (errMsg.includes('cannot') || errMsg.includes('not valid') || errMsg.includes('invalid')) {
              dialog(t('providerHistory.requestUnavailable'), t('providerHistory.requestUnavailableMsg'));
              fetchJobs(false);
            } else {
              dialog(t('providerHistory.unableToAccept'), result.error || result.message || t('common.somethingWentWrong'));
            }
          }
        } catch (e) {
          const errMsg = (e.message || '').toLowerCase();
          if (errMsg.includes('cancel')) {
            dialog(t('providerHistory.requestCancelledByCustomer'), t('providerHistory.requestCancelledByCustomer'));
            setAllRequests(prev => prev.filter(j => j._id !== job._id));
          } else if (errMsg.includes('cannot') || errMsg.includes('not valid')) {
            dialog(t('providerHistory.requestUnavailable'), t('providerHistory.requestUnavailableMsg'));
            fetchJobs(false);
          } else {
            dialog(t('common.connectionError'), t('common.connectionErrorMsg'));
          }
        }
        finally { setAcceptingId(null); }
      }},
    ]);
  };

  // ── Reject ──
  const handleReject = (job) => {
    dialog(t('providerHistory.rejectRequest'), t('providerHistory.rejectRequestMsg', { type: SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('providerHistory.reject'), style: 'destructive', onPress: async () => {
        setRejectingId(job._id);
        try {
          let result;
          if (job.isEmergencyService) {
            const r = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${job._id}/provider-reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
            result = await r.json(); result.success = result.success || r.ok;
          } else if (job.isEventService) {
            const r = await authFetch(`${NODE_BASE_URL}/api/event-services/${job._id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
            result = await r.json(); result.success = result.success || r.ok;
          } else {
            const r = await authFetch(`${NODE_BASE_URL}/api/traditional-services/${job._id}/provider-reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
            result = await r.json(); result.success = result.success || r.ok;
          }
          if (result.success) {
            dialog(t('providerHistory.rejectedTitle'), t('providerHistory.rejectedMsg'));
            setAllRequests(prev => prev.filter(j => j._id !== job._id));
            setTimeout(() => fetchJobs(false), 1500);
          } else {
            const errMsg = (result.error || result.message || '').toLowerCase();
            if (errMsg.includes('cancel')) {
              dialog(t('userHistory.alreadyCancelled'), t('providerHistory.requestCancelledByCustomer'));
              setAllRequests(prev => prev.filter(j => j._id !== job._id));
            } else {
              dialog(t('providerHistory.unableToReject'), result.error || result.message || t('common.somethingWentWrong'));
            }
          }
        } catch (e) {
          dialog(t('common.connectionError'), t('common.connectionErrorMsg'));
        }
        finally { setRejectingId(null); }
      }},
    ]);
  };

  // ── Call ──
  const handleCall = (req) => {
    const phone = req.userDetails?.phone || req.userDetails?.verifiedPhone || req.userPhone;
    if (!phone) { dialog(t('common.error'), t('providerHistory.phoneNotAvailable')); return; }
    dialog(t('providerHistory.callCustomer'), t('providerHistory.callCustomerMsg', { name: req.userDetails?.name || t('providerHistory.customer'), phone }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.callNow'), onPress: () => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => dialog(t('common.error'), t('providerHistory.cannotMakeCalls'))) },
    ]);
  };

  // ── Directions ──
  const handleDirections = (job) => {
    let lat, lng;
    if (job.location?.coordinates && Array.isArray(job.location.coordinates) && job.location.coordinates.length === 2) {
      [lng, lat] = job.location.coordinates;
    } else if (job.location?.latitude && job.location?.longitude) {
      lat = job.location.latitude; lng = job.location.longitude;
    } else if (job.eventLocation?.coordinates) {
      const coords = job.eventLocation.coordinates;
      if (Array.isArray(coords) && coords.length === 2) { [lng, lat] = coords; }
      else if (coords.latitude && coords.longitude) { lat = coords.latitude; lng = coords.longitude; }
    } else if (job.eventLocation?.latitude && job.eventLocation?.longitude) {
      lat = job.eventLocation.latitude; lng = job.eventLocation.longitude;
    }
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) { dialog(t('providerHistory.locationError'), t('providerHistory.locationErrorMsg')); return; }
    const url = Platform.select({ ios: `maps:?daddr=${lat},${lng}`, android: `google.navigation:q=${lat},${lng}` });
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`));
  };

  const handleViewDetails = (req) => navigation.navigate('ServiceRequestDetail', {
    requestId: req._id,
    request: (req.isEventService || req.isEmergencyService) ? req : undefined,
    isEventService: req.isEventService,
    isEmergencyService: req.isEmergencyService,
  });

  // ── Complete (OTP) ──
  const handleComplete = (req) => { setSelectedJob(req); setOtpError(''); setOtpModalVisible(true); };

  const handleVerifyOtp = async (otp) => {
    const job = selectedJob; // Capture in local variable to avoid stale closure
    if (!job) return;
    setIsVerifyingOtp(true); setOtpError('');
    try {
      let result;
      if (job.isEmergencyService) {
        const r = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${job._id}/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp }) });
        result = await r.json(); result.success = r.ok && result.success !== false;
      } else if (job.isEventService) {
        const r = await authFetch(`${NODE_BASE_URL}/api/event-services/${job._id}/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp }) });
        result = await r.json(); result.success = r.ok && result.success !== false;
      } else {
        result = await verifyCompletionOtp(job._id, otp);
      }
      if (result.success) { stopRequestLocationTracking(job._id); setOtpModalVisible(false); setSelectedJob(null); dialog(t('providerHistory.serviceCompleted'), t('providerHistory.serviceCompletedMsg')); fetchJobs(false); }
      else if (result.code === 'OTP_EXPIRED') setOtpError(t('providerHistory.otpExpiredError'));
      else setOtpError(result.error || result.message || t('providerHistory.invalidOtp'));
    } catch (e) { setOtpError(e.message || 'Failed to verify OTP.'); }
    finally { setIsVerifyingOtp(false); }
  };

  // ── Cancel ──
  const handleCancel = (req) => { setCancelJob(req); setCancelModalVisible(true); };

  const executeCancellation = async (reason) => {
    if (!cancelJob) return;
    setCancellingId(cancelJob._id);
    try {
      let result;
      if (cancelJob.isEmergencyService) {
        const r = await authFetch(`${NODE_BASE_URL}/api/emergency-services/${cancelJob._id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancelledBy: 'provider', reason }) });
        result = await r.json(); result.success = result.success || r.ok;
      } else if (cancelJob.isEventService) {
        const r = await authFetch(`${NODE_BASE_URL}/api/event-services/${cancelJob._id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: providerId, reason, cancelledBy: 'provider' }) });
        result = await r.json(); result.success = result.success || r.ok;
      } else {
        result = await providerCancelRequest(cancelJob._id, providerId, reason);
      }
      if (result.success !== false) { stopRequestLocationTracking(cancelJob._id); setCancelModalVisible(false); setCancelJob(null); dialog(t('status.cancelled'), t('providerHistory.cancelledDialog')); fetchJobs(false); }
      else dialog(t('common.error'), result.message || t('providerHistory.cancelError'));
    } catch (e) { dialog(t('common.error'), e.message || t('providerHistory.cancelError')); }
    finally { setCancellingId(null); }
  };

  // ── Filter ──
  const filteredRequests = useMemo(() => {
    let f = allRequests;
    // Category filter
    if (categoryFilter === 'emergency') f = f.filter(r => r.isEmergencyService);
    else if (categoryFilter === 'event') f = f.filter(r => r.isEventService);
    else if (categoryFilter === 'traditional') f = f.filter(r => !r.isEmergencyService && !r.isEventService);
    // Status filter
    switch (activeFilter) {
      case 'all': break;
      case 'pending': f = f.filter(r => ['pending', 'awaiting_confirmation'].includes(r.status)); break;
      case 'active': f = f.filter(r => ['accepted', 'in-progress', 'in_transit', 'arrived'].includes(r.status)); break;
      case 'completed': f = f.filter(r => r.status === 'completed'); break;
      case 'cancelled': f = f.filter(r => ['cancelled', 'rejected', 'expired'].includes(r.status)); break;
      default: break;
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
        <TouchableOpacity onPress={() => setIsDrawerOpen(true)} activeOpacity={0.7} style={styles.headerLogoBtn}>
          <Image source={FIXHOMI_LOGO} style={styles.headerLogoImg} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('providerHistory.myJobs')}</Text>
        <AvatarButton name={displayData?.fullName} profilePicture={displayData?.profilePicture} onPress={() => navigation.navigate('Profile')} isProvider={true} />
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statsRow}>
          <StatPill value={stats.total} label="Total" color={C.secondary} bgColor="#EFF6FF" />
          <StatPill value={stats.pending} label="New" color={C.primary} bgColor="#FFF7ED" />
          <StatPill value={stats.active} label="Active" color={C.purple} bgColor="#FAF5FF" />
          <StatPill value={stats.completed} label="Done" color={C.success} bgColor="#ECFDF5" />
        </View>
      </View>

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
      <FlatList
        data={filteredRequests}
        keyExtractor={item => item._id}
        ListHeaderComponent={
          (activeFilter !== 'all' || categoryFilter !== 'all' || datePreset !== 'all') ? (
            <Text style={styles.resultCount}>{filteredRequests.length} {filteredRequests.length === 1 ? t('providerHistory.job') : t('providerHistory.jobs')}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            onPress={() => handleViewDetails(item)}
            onCall={handleCall}
            onDirections={handleDirections}
            onComplete={handleComplete}
            onCancel={handleCancel}
            onAccept={handleAccept}
            onReject={handleReject}
            isAccepting={acceptingId === item._id}
            isRejecting={rejectingId === item._id}
          />
        )}
        ListEmptyComponent={<EmptyState filter={activeFilter} />}
        contentContainerStyle={[styles.listPad, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      />

      <DrawerMenu visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} user={displayData} userType={userType} navigation={navigation} onLogout={logout} isVerified={displayData?.isPhoneVerified && displayData?.isEmailVerified} activeTab="jobs" />
      <OTPModal visible={otpModalVisible} onClose={() => { setOtpModalVisible(false); setSelectedJob(null); setOtpError(''); }} onVerify={handleVerifyOtp} isVerifying={isVerifyingOtp} error={otpError} />
      <CancellationReasonModal visible={cancelModalVisible} onClose={() => { setCancelModalVisible(false); setCancelJob(null); }} onSubmit={executeCancellation} loading={!!cancellingId} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, backgroundColor: C.white },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  headerLogoBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  headerLogoImg: { width: 30, height: 30, borderRadius: 8 },

  // Loader
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 12, fontSize: 14, fontWeight: '500', color: C.textSec },

  // Stats
  statsBar: { backgroundColor: C.white, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
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

  resultCount: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 6 },
  listPad: { padding: 14 },

  // Card
  card: { backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
  cardPending: { borderColor: C.primary + '50', borderWidth: 1.5, borderLeftWidth: 4, borderLeftColor: C.primary },
  cardCompact: { padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  svcIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  svcNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  svcName: { fontSize: 15, fontWeight: '700', color: C.text, textTransform: 'capitalize', flexShrink: 1 },
  typeBadge: { backgroundColor: '#F3E8FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 8, fontWeight: '800', color: C.purple, letterSpacing: 0.5 },
  svcId: { fontSize: 11, fontWeight: '500', color: C.muted, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Cancel strip
  cancelStrip: { backgroundColor: C.dangerBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cancelStripText: { fontSize: 11, fontWeight: '500', color: '#991B1B', flex: 1, lineHeight: 16 },

  // Compact
  compactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  compactDate: { fontSize: 12, fontWeight: '500', color: C.muted },
  compactCustomer: { fontSize: 12, fontWeight: '500', color: C.textSec },

  // Customer
  customerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, marginBottom: 10 },
  customerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.secondary + '18', alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden' },
  customerAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  customerInitial: { fontSize: 15, fontWeight: '700', color: C.secondary },
  customerName: { fontSize: 14, fontWeight: '600', color: C.text },
  customerPhone: { fontSize: 11, color: C.textSec, marginTop: 1 },
  quickActions: { flexDirection: 'row', gap: 7 },
  btnCall: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center', shadowColor: C.success, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  btnDir: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.secondary, alignItems: 'center', justifyContent: 'center', shadowColor: C.secondary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },

  // Location
  locRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 6 },
  locText: { flex: 1, fontSize: 12, fontWeight: '500', color: C.textSec, lineHeight: 18 },
  descInline: { fontSize: 12, color: C.textSec, marginBottom: 8 },

  // Date/Time
  dtRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#EEF2F6' },
  dtItem: { flex: 1, alignItems: 'center' },
  dtLabel: { fontSize: 9, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  dtVal: { fontSize: 13, fontWeight: '600', color: C.text },
  dtDiv: { width: 1, height: 28, backgroundColor: '#E2E8F0', marginHorizontal: 4 },

  // Pending: Map + Accept/Reject row
  pendingActionRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  viewMapBtnCompact: { width: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.secondary + '12', borderRadius: 10, borderWidth: 1, borderColor: C.secondary + '30' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEE2E2', paddingVertical: 11, borderRadius: 10, gap: 5, borderWidth: 1, borderColor: C.danger + '40' },
  rejectBtnText: { color: C.danger, fontSize: 14, fontWeight: '600' },
  acceptBtn: { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, paddingVertical: 11, borderRadius: 10, gap: 5 },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },

  // Active: Complete + Cancel
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  completeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.success, borderRadius: 12, paddingVertical: 11, gap: 6, shadowColor: C.success, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  completeBtnText: { fontSize: 14, fontWeight: '700', color: C.white },
  cancelIconBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: C.danger, backgroundColor: C.dangerBg, alignItems: 'center', justifyContent: 'center' },

  // Details row
  detailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  detailsText: { fontSize: 13, fontWeight: '600', color: C.secondary },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 40 },
  emptyCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 6 },
  emptyMsg: { fontSize: 13, fontWeight: '500', color: C.textSec, textAlign: 'center', lineHeight: 20 },

  // OTP Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: C.text },
  modalClose: { padding: 4 },
  modalSubtitle: { fontSize: 13, fontWeight: '500', color: C.textSec, lineHeight: 19, marginBottom: 18 },
  otpInput: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, fontSize: 26, fontWeight: '700', color: C.text, textAlign: 'center', paddingVertical: 14, letterSpacing: 10, marginBottom: 10 },
  otpError: { fontSize: 12, fontWeight: '500', color: C.danger, textAlign: 'center', marginBottom: 10 },
  otpHintText: { fontSize: 11, fontWeight: '500', textAlign: 'center', marginBottom: 10 },
  verifyBtn: { backgroundColor: C.success, borderRadius: 14, paddingVertical: 15, alignItems: 'center', shadowColor: C.success, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  verifyBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  verifyBtnText: { fontSize: 15, fontWeight: '700', color: C.white },
});

export default ProviderServiceHistoryScreen;
