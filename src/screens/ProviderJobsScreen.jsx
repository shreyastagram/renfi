/**
 * Provider Jobs Screen (Unified) — v2.0 Revamp
 * 
 * Compact, professional-grade My Jobs screen with:
 * - Tight card layout — no wasted space
 * - Fixed icons (no more ? glyphs)
 * - Location visible before accepting/rejecting
 * - View on Map button for all trackable categories
 * - Inline header stats, tab badges
 * 
 * @version 2.0.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  Linking,
  ScrollView,
  Image,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon, ServiceIcon, StatusIcon, FixhomiLogo } from '../components';
import { useApp } from '../context/AppContext';
import { NODE_BASE_URL } from '../config/api';
import {
  getProviderRequests,
  acceptRequestAsProvider,
  verifyCompletionOtp,
  providerCancelRequest,
  SERVICE_TYPE_LABELS,
} from '../services/traditionalServiceService';
import { addEventListener as addSocketListener } from '../services/socketService';
import { setupForegroundMessageListener } from '../services/fcmService';
import { STATIC_NUMBER_SERVICES } from '../services/emergencyServicesService';
// Direct phone dialing - Exotel call masking removed

// Tab configuration - sleek with proper icons
const TABS = [
  { key: 'requests', label: 'New', icon: 'inbox', badge: true },
  { key: 'active', label: 'Active', icon: 'briefcase', badge: true },
  { key: 'history', label: 'Done', icon: 'check-circle', badge: false },
  { key: 'cancelled', label: 'Cancelled', icon: 'close-circle', badge: false },
];

// Brand colors
const BRAND = {
  primary: '#f67c16', // Orange
  secondary: '#2b76bc', // Blue
  background: '#F5F5F7',
  white: '#FFFFFF',
  success: '#10B981',
  danger: '#EF4444',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
};

// Status colors — unified brand palette
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: BRAND.primary, bgColor: '#FFF7ED', iconName: 'clock' },
  awaiting_confirmation: { label: 'Awaiting', color: BRAND.primary, bgColor: '#FFF7ED', iconName: 'clock' },
  accepted: { label: 'Accepted', color: BRAND.secondary, bgColor: '#EFF6FF', iconName: 'check' },
  'in-progress': { label: 'In Progress', color: BRAND.secondary, bgColor: '#EFF6FF', iconName: 'in-progress' },
  in_transit: { label: 'On The Way', color: BRAND.secondary, bgColor: '#EFF6FF', iconName: 'truck-fast' },
  arrived: { label: 'Arrived', color: BRAND.secondary, bgColor: '#EFF6FF', iconName: 'map-marker-check' },
  completed: { label: 'Completed', color: BRAND.success, bgColor: '#ECFDF5', iconName: 'check-circle' },
  cancelled: { label: 'Cancelled', color: BRAND.textSecondary, bgColor: '#F3F4F6', iconName: 'close' },
  rejected: { label: 'Rejected', color: BRAND.danger, bgColor: '#FEE2E2', iconName: 'close-circle' },
  expired: { label: 'Expired', color: BRAND.textSecondary, bgColor: '#F3F4F6', iconName: 'clock' },
};

/**
 * Tab Bar Component — Compact pill style
 */
const TabBar = ({ activeTab, onTabChange, stats }) => (
  <View style={styles.tabBar}>
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabBarContent}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const badgeCount = tab.key === 'requests' ? stats.pending : tab.key === 'active' ? stats.active : 0;
        
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Icon name={tab.icon} size={14} color={isActive ? BRAND.white : BRAND.textSecondary} />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.badge && badgeCount > 0 && (
              <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                <Text style={styles.tabBadgeText}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
);

/**
 * Compact Job Card — v2.0
 * Tight layout, location always visible for pending, professional grade
 */
const JobCard = ({ job, onAccept, onReject, onComplete, onCancel, onCall, onDirections, onViewDetails, isAccepting, isRejecting }) => {
  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const serviceDate = new Date(job.serviceDate || job.createdAt);
  const isPending = job.status === 'pending' || job.status === 'awaiting_confirmation';
  const isActive = ['accepted', 'in-progress'].includes(job.status);
  const isCancelled = ['cancelled', 'rejected', 'expired'].includes(job.status);
  const hasLocation = job.location?.coordinates || job.location?.latitude;
  const isLocationTrackable = !STATIC_NUMBER_SERVICES.includes(job.serviceType);
  const serviceAddress = job.serviceAddress || job.location?.address || 
    (job.location?.latitude ? `${job.location.latitude.toFixed(4)}, ${job.location.longitude.toFixed(4)}` : null);
  
  return (
    <TouchableOpacity 
      style={[styles.jobCard, isPending && styles.jobCardPending]}
      onPress={() => onViewDetails(job)}
      activeOpacity={0.7}
    >
      {/* Row 1: Service + Status — Single tight row */}
      <View style={styles.cardRow1}>
        <View style={styles.serviceChip}>
          <ServiceIcon serviceType={job.serviceType} size={18} />
          <Text style={styles.serviceLabel} numberOfLines={1}>
            {SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: status.bgColor }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Rejection / Cancellation Reason — compact strip */}
      {isCancelled && (job.rejectReason || job.cancellationReason || job.cancelReason) && (
        <View style={styles.reasonStrip}>
          <Icon name="info" size={12} color="#92400E" />
          <Text style={styles.reasonStripText} numberOfLines={1}>
            {job.cancelledBy === 'user' ? 'User: ' : job.cancelledBy === 'provider' ? 'You: ' : ''}
            {job.rejectReason || job.cancellationReason || job.cancelReason}
          </Text>
        </View>
      )}

      {/* Row 2: Customer + Quick Actions */}
      {job.userDetails && (
        <View style={styles.cardRow2}>
          <View style={styles.customerChip}>
            {job.userDetails.profilePicture?.url ? (
              <Image source={{ uri: job.userDetails.profilePicture.url }} style={styles.customerThumb} />
            ) : (
              <View style={styles.customerThumbPlaceholder}>
                <Text style={styles.customerThumbInitial}>
                  {job.userDetails.name?.charAt(0).toUpperCase() || 'C'}
                </Text>
              </View>
            )}
            <View style={styles.customerMeta}>
              <Text style={styles.customerName} numberOfLines={1}>{job.userDetails.name || 'Customer'}</Text>
              {isActive && job.userDetails.phone && (
                <Text style={styles.customerPhone}>{job.userDetails.phone}</Text>
              )}
            </View>
          </View>
          
          {/* Quick Actions — Call & Directions for active jobs */}
          {isActive && (
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickActionBtn} onPress={() => onCall(job)}>
                <Icon name="phone" size={15} color={BRAND.success} />
              </TouchableOpacity>
              {hasLocation && isLocationTrackable && (
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => onDirections(job)}>
                  <Icon name="directions" size={15} color={BRAND.secondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {/* Distance badge for non-active */}
          {!isActive && job.distanceToService && (
            <View style={styles.distancePill}>
              <Icon name="location" size={10} color={BRAND.secondary} />
              <Text style={styles.distancePillText}>{job.distanceToService.formatted}</Text>
            </View>
          )}
        </View>
      )}

      {/* Row 3: Location + Date — Compact info strip */}
      <View style={styles.cardInfoStrip}>
        {serviceAddress && (
          <View style={styles.infoChip}>
            <Icon name="location" size={12} color={BRAND.danger} />
            <Text style={styles.infoChipText} numberOfLines={1}>{serviceAddress}</Text>
          </View>
        )}
        <View style={styles.infoChipRight}>
          <Icon name="calendar" size={11} color={BRAND.textMuted} />
          <Text style={styles.infoChipDate}>
            {serviceDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </Text>
          {job.distance && (
            <>
              <Text style={styles.infoDot}>·</Text>
              <Text style={styles.infoChipDate}>{(job.distance / 1000).toFixed(1)} km</Text>
            </>
          )}
        </View>
      </View>

      {/* Description — Only if present, single line */}
      {job.description && (
        <Text style={styles.descriptionInline} numberOfLines={1}>
          📝 {job.description}
        </Text>
      )}

      {/* PENDING: View on Map + Accept/Reject */}
      {isPending && (
        <View style={styles.pendingSection}>
          {hasLocation && isLocationTrackable && (
            <TouchableOpacity
              style={styles.viewMapBtn}
              onPress={() => onDirections(job)}
              activeOpacity={0.7}
            >
              <Icon name="navigate" size={14} color={BRAND.secondary} />
              <Text style={styles.viewMapBtnText}>View on Map</Text>
              <Icon name="open-in-new" size={12} color={BRAND.secondary} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}
          <View style={styles.pendingActionRow}>
            <TouchableOpacity
              style={[styles.rejectBtn, isRejecting && styles.btnDisabled]}
              onPress={() => onReject(job)}
              disabled={isRejecting || isAccepting}
            >
              {isRejecting ? (
                <ActivityIndicator color={BRAND.danger} size="small" />
              ) : (
                <>
                  <Icon name="close" size={15} color={BRAND.danger} />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, isAccepting && styles.btnDisabled]}
              onPress={() => onAccept(job)}
              disabled={isAccepting || isRejecting}
            >
              {isAccepting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Icon name="check" size={15} color="#fff" />
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ACTIVE: Complete + Cancel */}
      {isActive && (
        <View style={styles.activeActions}>
          <TouchableOpacity style={styles.completeBtn} onPress={() => onComplete(job)}>
            <Icon name="check-circle" size={15} color="#fff" />
            <Text style={styles.completeBtnText}>Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(job)}>
            <Icon name="close" size={15} color={BRAND.danger} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

/**
 * Empty State Component — Compact
 */
const EmptyState = ({ tab }) => {
  const messages = {
    requests: { title: 'No New Requests', text: 'Stay online to receive requests from nearby customers!' },
    active: { title: 'No Active Jobs', text: 'Accept requests to see your active jobs here.' },
    history: { title: 'No History Yet', text: 'Your completed jobs will appear here.' },
    cancelled: { title: 'No Cancelled Jobs', text: 'Cancelled and rejected jobs show here.' },
  };
  const content = messages[tab] || messages.requests;
  
  return (
    <View style={styles.emptyContainer}>
      <FixhomiLogo size={48} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>{content.title}</Text>
      <Text style={styles.emptyText}>{content.text}</Text>
    </View>
  );
};

/**
 * OTP Verification Modal — Compact
 */
const OTPModal = ({ visible, onClose, onVerify, isVerifying, error }) => {
  const [otp, setOtp] = useState('');
  
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🔐 Enter Completion OTP</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Icon name="close" size={22} color={BRAND.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalSubtitle}>
            Ask the customer for the 6-digit OTP to complete this service.
          </Text>
          
          <TextInput
            style={styles.otpInput}
            value={otp}
            onChangeText={setOtp}
            placeholder="000000"
            placeholderTextColor="#D1D5DB"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          
          {error ? <Text style={styles.otpError}>{error}</Text> : null}
          
          <TouchableOpacity
            style={[styles.verifyBtn, otp.length !== 6 && styles.verifyBtnDisabled]}
            onPress={() => { if (otp.length === 6) onVerify(otp); }}
            disabled={otp.length !== 6 || isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyBtnText}>Verify & Complete</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Main Provider Jobs Screen
 */
const ProviderJobsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user, profile } = useApp();
  const isFocused = useIsFocused();
  
  // Determine initial tab from route params (for notification deep linking)
  const initialTab = route?.params?.tab || 'requests';
  
  // State
  const [activeTab, setActiveTab] = useState(initialTab);
  const [allJobs, setAllJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  
  // Auto-refresh setting
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  // OTP Modal state
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  
  // Provider ID
  const providerId = user?.mongoId || user?.javaUserId || profile?.mongoId || profile?._id;
  
  // Load auto-refresh preference
  useEffect(() => {
    const loadPref = async () => {
      try {
        const saved = await AsyncStorage.getItem('app_preferences');
        if (saved) {
          const prefs = JSON.parse(saved);
          setAutoRefreshEnabled(prefs.autoRefresh !== false);
        }
      } catch (e) { /* default true */ }
    };
    loadPref();
  }, []);
  
  // Auto-refresh on screen focus (when returning from detail screen)
  useEffect(() => {
    if (isFocused && autoRefreshEnabled && !isLoading) {
      console.log('[ProviderJobs] Screen focused — auto-refreshing');
      fetchJobs(false);
    }
  }, [isFocused]);
  
  // Periodic auto-refresh every 30s when screen is focused and autoRefresh is on
  useEffect(() => {
    if (!isFocused || !autoRefreshEnabled) return;
    
    const interval = setInterval(() => {
      console.log('[ProviderJobs] Periodic auto-refresh');
      fetchJobs(false);
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [isFocused, autoRefreshEnabled, fetchJobs]);
  
  // AppState listener — refresh when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && autoRefreshEnabled && isFocused) {
        console.log('[ProviderJobs] App foregrounded — auto-refreshing');
        fetchJobs(false);
      }
    });
    return () => sub.remove();
  }, [autoRefreshEnabled, isFocused, fetchJobs]);
  
  // Socket listener — refresh on real-time events
  useEffect(() => {
    const cleanups = [
      addSocketListener('new:request', (data) => {
        console.log('[ProviderJobs] Socket: new request received');
        if (autoRefreshEnabled) fetchJobs(false);
      }),
      addSocketListener('request:cancelled', () => {
        if (autoRefreshEnabled) fetchJobs(false);
      }),
      addSocketListener('request:status', () => {
        if (autoRefreshEnabled) fetchJobs(false);
      }),
    ];
    return () => cleanups.forEach(fn => fn());
  }, [autoRefreshEnabled, fetchJobs]);
  
  // FCM foreground listener — auto-refresh only (banner handled by GlobalBanner)
  useEffect(() => {
    const unsubscribe = setupForegroundMessageListener((remoteMessage) => {
      const msgType = remoteMessage?.data?.type;
      console.log('[ProviderJobs] FCM foreground message (auto-refresh):', msgType);
      if (autoRefreshEnabled) fetchJobs(false);
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [autoRefreshEnabled, fetchJobs]);
  
  // Calculate stats - ensure allJobs is always an array
  const jobs = Array.isArray(allJobs) ? allJobs : [];
  
  const stats = useMemo(() => {
    return {
      // Include 'awaiting_confirmation' as pending (for emergency services)
      pending: jobs.filter(j => j.status === 'pending' || j.status === 'awaiting_confirmation').length,
      active: jobs.filter(j => ['accepted', 'in-progress', 'in_transit', 'arrived'].includes(j.status)).length,
      completed: jobs.filter(j => j.status === 'completed').length,
      total: jobs.length,
    };
  }, [jobs]);
  
  // Filter jobs based on active tab
  const filteredJobs = useMemo(() => {
    switch (activeTab) {
      case 'requests':
        // Include 'awaiting_confirmation' as pending requests (for emergency services)
        return jobs.filter(j => j.status === 'pending' || j.status === 'awaiting_confirmation');
      case 'active':
        // Include all active statuses including emergency-specific ones
        return jobs.filter(j => ['accepted', 'in-progress', 'in_transit', 'arrived'].includes(j.status));
      case 'history':
        return jobs.filter(j => j.status === 'completed');
      case 'cancelled':
        // Include rejected status in cancelled tab
        return jobs.filter(j => ['cancelled', 'expired', 'rejected'].includes(j.status));
      default:
        return jobs;
    }
  }, [jobs, activeTab]);
  
  /**
   * Fetch all jobs - includes traditional, event, and emergency services
   */
  const fetchJobs = useCallback(async (showLoading = true) => {
    if (!providerId) {
      setIsLoading(false);
      return;
    }
    
    if (showLoading) setIsLoading(true);
    
    console.log('[ProviderJobs] Fetching jobs for providerId:', providerId);
    
    try {
      // Fetch traditional, event, and emergency services in parallel
      const [traditionalResult, eventResult, emergencyResult] = await Promise.all([
        getProviderRequests(providerId, {
          page: 1,
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
        fetch(`${NODE_BASE_URL}/api/event-services/provider/${providerId}`)
          .then(r => r.json())
          .catch(() => ({ data: [] })),
        fetch(`${NODE_BASE_URL}/api/emergency-services/provider/${providerId}`)
          .then(r => r.json())
          .catch(() => ({ data: [] })),
      ]);
      
      console.log('[ProviderJobs] Event services result:', eventResult);
      console.log('[ProviderJobs] Emergency services result:', JSON.stringify(emergencyResult));
      console.log('[ProviderJobs] Emergency data extracted:', emergencyResult.requests || emergencyResult.data || []);
      
      // Format event services to match traditional service structure
      const eventBookings = (eventResult.data || []).map(booking => {
        // Handle both old 'location' and new 'eventLocation' fields
        const eventLoc = booking.eventLocation || booking.location || {};
        const normalizedLocation = {
          address: eventLoc.address || '',
          // Handle both array format [lng, lat] and object format { longitude, latitude }
          coordinates: eventLoc.coordinates 
            ? (Array.isArray(eventLoc.coordinates) 
                ? eventLoc.coordinates 
                : [eventLoc.coordinates.longitude, eventLoc.coordinates.latitude])
            : null,
          landmark: eventLoc.landmark || '',
        };
        
        return {
          ...booking,
          _id: booking._id,
          requestId: booking.serviceId || booking._id,
          serviceType: booking.serviceType,
          status: booking.status,
          createdAt: booking.createdAt,
          isEventService: true, // Flag to identify event services
          userName: booking.userDetails?.name || booking.userName || 'Customer',
          userPhone: booking.userDetails?.phone || booking.userPhone,
          eventDate: booking.eventDate,
          completionOtp: booking.completionOtp,
          // Normalized location for display and directions
          location: normalizedLocation,
          serviceAddress: normalizedLocation.address,
        };
      });
      
      // Format emergency services to match traditional service structure
      // Backend returns { requests: [...] } or { data: [...] }
      const emergencyData = emergencyResult.requests || emergencyResult.data || [];
      const emergencyBookings = emergencyData.map(booking => {
        // Normalize location for emergency services
        const emergencyLocation = booking.location || {};
        const locationAddress = emergencyLocation.address || emergencyLocation.landmark || '';
        
        return {
          ...booking,
          _id: booking._id,
          requestId: booking.requestId || booking._id,
          serviceType: booking.serviceType,
          status: booking.status,
          createdAt: booking.createdAt,
          isEmergencyService: true, // Flag to identify emergency services
          userName: booking.userDetails?.name || 'Customer',
          userPhone: booking.userDetails?.phone,
          location: {
            ...emergencyLocation,
            address: locationAddress,
            // Add coordinates array for directions button
            coordinates: emergencyLocation.latitude && emergencyLocation.longitude 
              ? [emergencyLocation.longitude, emergencyLocation.latitude] 
              : null
          },
          serviceAddress: locationAddress || `Lat: ${emergencyLocation.latitude?.toFixed(4)}, Lng: ${emergencyLocation.longitude?.toFixed(4)}`,
          completionOtp: booking.completionOtp,
          notes: booking.notes,
          description: booking.notes, // Map notes to description for display
        };
      });
      
      // Combine and sort all jobs by date
      const allRequests = [
        ...(traditionalResult.success ? traditionalResult.requests : []),
        ...eventBookings,
        ...emergencyBookings,
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      console.log('[ProviderJobs] Total jobs:', allRequests.length, '(Traditional:', traditionalResult.requests?.length || 0, ', Event:', eventBookings.length, ', Emergency:', emergencyBookings.length, ')');
      
      setAllJobs(allRequests);
    } catch (error) {
      console.error('[ProviderJobs] Error:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [providerId]);
  
  // Fetch on mount
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);
  
  // Handle route params change (for deep linking)
  useEffect(() => {
    if (route?.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route?.params?.tab]);
  
  /**
   * Handle refresh
   */
  const onRefresh = () => {
    setIsRefreshing(true);
    fetchJobs(false);
  };
  
  /**
   * Accept a request - handles traditional, event, and emergency services
   */
  const handleAccept = async (job) => {
    const isEvent = job.isEventService;
    const isEmergency = job.isEmergencyService;
    const serviceLabel = SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType;
    
    Alert.alert(
      'Accept Request',
      `Accept this ${serviceLabel} request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setAcceptingId(job._id);
            try {
              let result;
              
              if (isEmergency) {
                // Use emergency service accept endpoint
                const response = await fetch(`${NODE_BASE_URL}/api/emergency-services/${job._id}/accept`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    providerId,
                    userEmail: job.userDetails?.email || '',
                    estimatedArrival: 15,
                  }),
                });
                result = await response.json();
                result.success = result.success || response.ok;
              } else if (isEvent) {
                // Use event service accept endpoint
                const response = await fetch(`${NODE_BASE_URL}/api/event-services/${job._id}/accept`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    providerId,
                    userEmail: job.userDetails?.email || job.userEmail || '',
                  }),
                });
                result = await response.json();
                result.success = result.success || result.statusCode === 200;
              } else {
                // Use traditional service accept
                result = await acceptRequestAsProvider(
                  job._id,
                  providerId,
                  job.userDetails?.email || ''
                );
              }
              
              if (result.success) {
                Alert.alert('Request Accepted', 'You have accepted this request. The customer has been notified.');
                fetchJobs(false);
                setActiveTab('active');
              } else {
                Alert.alert('Error', result.error || 'Failed to accept request');
              }
            } catch (error) {
              console.error('[ProviderJobs] Accept error:', error);
              Alert.alert('Error', 'Something went wrong');
            } finally {
              setAcceptingId(null);
            }
          },
        },
      ]
    );
  };
  
  /**
   * Reject a pending request - handles traditional, event, and emergency services
   */
  const handleReject = async (job) => {
    const isEvent = job.isEventService;
    const isEmergency = job.isEmergencyService;
    const serviceLabel = SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType;
    
    Alert.alert(
      'Reject Request',
      `Are you sure you want to reject this ${serviceLabel} request? The customer will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejectingId(job._id);
            try {
              let result;
              
              if (isEmergency) {
                // Use emergency service provider-reject endpoint
                const response = await fetch(`${NODE_BASE_URL}/api/emergency-services/${job._id}/provider-reject`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ providerId }),
                });
                result = await response.json();
                result.success = result.success || response.ok;
              } else if (isEvent) {
                // Use event service reject endpoint
                const response = await fetch(`${NODE_BASE_URL}/api/event-services/${job._id}/reject`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ providerId }),
                });
                result = await response.json();
                result.success = result.success || result.statusCode === 200 || response.ok;
              } else {
                // Use traditional service provider-reject endpoint
                const response = await fetch(`${NODE_BASE_URL}/api/traditional-services/${job._id}/provider-reject`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ providerId }),
                });
                result = await response.json();
                result.success = result.success || response.ok;
              }
              
              if (result.success) {
                Alert.alert('Request Rejected', 'You have rejected this request. The customer has been notified.');
                fetchJobs(false);
              } else {
                Alert.alert('Error', result.error || result.message || 'Failed to reject request');
              }
            } catch (error) {
              console.error('[ProviderJobs] Reject error:', error);
              Alert.alert('Error', 'Something went wrong');
            } finally {
              setRejectingId(null);
            }
          },
        },
      ]
    );
  };
  
  /**
   * Complete a service
   */
  const handleComplete = (job) => {
    setSelectedJob(job);
    setOtpError('');
    setOtpModalVisible(true);
  };
  
  /**
   * Verify OTP and complete - handles traditional, event, and emergency services
   */
  const handleVerifyOtp = async (otp) => {
    if (!selectedJob) return;
    
    setIsVerifyingOtp(true);
    setOtpError('');
    
    try {
      let result;
      
      if (selectedJob.isEmergencyService) {
        // Use emergency service verify endpoint
        const response = await fetch(`${NODE_BASE_URL}/api/emergency-services/${selectedJob._id}/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otp }),
        });
        result = await response.json();
        result.success = result.success || response.ok;
      } else if (selectedJob.isEventService) {
        // Use event service verify endpoint
        const response = await fetch(`${NODE_BASE_URL}/api/event-services/${selectedJob._id}/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otp }),
        });
        result = await response.json();
        result.success = result.success || result.statusCode === 200;
      } else {
        // Use traditional service verify
        result = await verifyCompletionOtp(selectedJob._id, otp);
      }
      
      if (result.success) {
        setOtpModalVisible(false);
        Alert.alert('🎉 Service Completed!', 'Great job! The service has been marked as complete.');
        fetchJobs(false);
      } else {
        setOtpError(result.error || 'Invalid OTP');
      }
    } catch (error) {
      setOtpError('Something went wrong');
    } finally {
      setIsVerifyingOtp(false);
    }
  };
  
  /**
   * Cancel a job - handles traditional, event, and emergency services
   */
  const handleCancel = (job) => {
    Alert.alert(
      'Cancel Job?',
      'Are you sure you want to cancel this job? The customer will be notified.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              let result;
              
              if (job.isEmergencyService) {
                // Use emergency service cancel endpoint
                const response = await fetch(`${NODE_BASE_URL}/api/emergency-services/${job._id}/cancel`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    reason: 'Provider cancelled',
                    cancelledBy: 'provider'
                  }),
                });
                result = await response.json();
                result.success = result.success || response.ok;
              } else if (job.isEventService) {
                // Use event service reject endpoint (provider rejection)
                const response = await fetch(`${NODE_BASE_URL}/api/event-services/${job._id}/reject`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    providerId,
                    reason: 'Provider cancelled' 
                  }),
                });
                result = await response.json();
                result.success = result.success || result.statusCode === 200;
              } else {
                // Use traditional service cancel
                result = await providerCancelRequest(job._id, providerId, 'Provider cancelled');
              }
              
              if (result.success) {
                Alert.alert('Cancelled', 'The job has been cancelled.');
                fetchJobs(false);
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel');
              }
            } catch (error) {
              Alert.alert('Error', 'Something went wrong');
            }
          },
        },
      ]
    );
  };
  
  /**
   * Call customer - direct phone dialing
   */
  const handleCall = (job) => {
    const phone = job.userDetails?.phone || job.userDetails?.verifiedPhone || job.userPhone;
    const customerName = job.userDetails?.name || job.userName || 'Customer';
    
    if (!phone) {
      Alert.alert('Error', 'Customer phone number not available');
      return;
    }

    const phoneNumber = phone.replace(/\s/g, '');
    const url = `tel:${phoneNumber}`;

    Alert.alert(
      '📞 Call Customer',
      `Call ${customerName} at ${phone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          onPress: () => {
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'Unable to make phone calls on this device');
            });
          },
        },
      ]
    );
  };
  
  /**
   * Get directions
   */
  const handleDirections = (job) => {
    let lat, lng;
    
    // Handle different location formats
    if (job.location?.coordinates && Array.isArray(job.location.coordinates)) {
      [lng, lat] = job.location.coordinates;
    } else if (job.location?.latitude && job.location?.longitude) {
      lat = job.location.latitude;
      lng = job.location.longitude;
    } else {
      Alert.alert('Location Error', 'Location coordinates not available');
      return;
    }
    
    const label = encodeURIComponent(job.serviceAddress || job.location?.address || 'Service Location');
    
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}(${label})`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    });
    
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };
  
  /**
   * View job details - pass full job data for event and emergency services
   */
  const handleViewDetails = (job) => {
    navigation.navigate('ServiceRequestDetail', { 
      requestId: job._id,
      request: (job.isEventService || job.isEmergencyService) ? job : undefined, // Pass full data for event/emergency services
      isEventService: job.isEventService,
      isEmergencyService: job.isEmergencyService,
    });
  };
  
  /**
   * Render job item
   */
  const renderJob = ({ item }) => (
    <JobCard
      job={item}
      onAccept={handleAccept}
      onReject={handleReject}
      onComplete={handleComplete}
      onCancel={handleCancel}
      onCall={handleCall}
      onDirections={handleDirections}
      onViewDetails={handleViewDetails}
      isAccepting={acceptingId === item._id}
      isRejecting={rejectingId === item._id}
    />
  );
  
  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND.secondary} />
          <Text style={styles.loadingText}>Loading your jobs...</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header — Compact with inline stats */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="back" size={22} color={BRAND.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Jobs</Text>
          <View style={styles.headerStats}>
            <View style={[styles.headerStatDot, { backgroundColor: BRAND.primary }]} />
            <Text style={styles.headerStatText}>{stats.pending} new</Text>
            <View style={[styles.headerStatDot, { backgroundColor: BRAND.secondary }]} />
            <Text style={styles.headerStatText}>{stats.active} active</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Icon name="refresh" size={20} color={BRAND.secondary} />
        </TouchableOpacity>
      </View>
      
      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} stats={stats} />
      
      {/* Jobs List */}
      <FlatList
        data={filteredJobs}
        renderItem={renderJob}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[BRAND.secondary]} />
        }
        ListEmptyComponent={<EmptyState tab={activeTab} />}
        showsVerticalScrollIndicator={false}
      />
      
      {/* OTP Modal */}
      <OTPModal
        visible={otpModalVisible}
        onClose={() => setOtpModalVisible(false)}
        onVerify={handleVerifyOtp}
        isVerifying={isVerifyingOtp}
        error={otpError}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.background },
  
  // Header — Compact with inline stats
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BRAND.white,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  backBtn: { padding: 6 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: BRAND.text },
  headerStats: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  headerStatDot: { width: 6, height: 6, borderRadius: 3 },
  headerStatText: { fontSize: 11, color: BRAND.textSecondary, fontWeight: '500' },
  refreshBtn: { padding: 6 },
  
  // Tab Bar — Compact pills
  tabBar: {
    backgroundColor: BRAND.white,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  tabBarContent: { paddingHorizontal: 12, gap: 6 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    gap: 5,
  },
  tabActive: { backgroundColor: BRAND.secondary },
  tabLabel: { fontSize: 12, fontWeight: '600', color: BRAND.textSecondary },
  tabLabelActive: { color: BRAND.white },
  tabBadge: {
    backgroundColor: BRAND.danger,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    alignItems: 'center',
  },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  
  // List
  listContent: { padding: 12, paddingBottom: 24 },
  
  // Job Card — Compact v2.0
  jobCard: {
    backgroundColor: BRAND.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  jobCardPending: {
    borderColor: BRAND.primary + '30',
    borderWidth: 1.5,
  },
  
  // Row 1: Service + Status
  cardRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceChip: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  serviceLabel: { fontSize: 14, fontWeight: '600', color: BRAND.text, flex: 1 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    marginLeft: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  
  // Reason strip — compact
  reasonStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  reasonStripText: { fontSize: 11, color: '#92400E', fontWeight: '500', flex: 1 },
  
  // Row 2: Customer
  cardRow2: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  customerChip: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  customerThumb: { width: 28, height: 28, borderRadius: 14 },
  customerThumbPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerThumbInitial: { fontSize: 12, fontWeight: '600', color: '#fff' },
  customerMeta: { flex: 1 },
  customerName: { fontSize: 13, fontWeight: '500', color: BRAND.text },
  customerPhone: { fontSize: 11, color: BRAND.textSecondary },
  
  // Quick actions
  quickActions: { flexDirection: 'row', gap: 6 },
  quickActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Distance pill
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  distancePillText: { fontSize: 10, fontWeight: '600', color: BRAND.secondary },
  
  // Info strip
  cardInfoStrip: { marginBottom: 6 },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  infoChipText: { fontSize: 12, color: BRAND.textSecondary, flex: 1 },
  infoChipRight: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  infoChipDate: { fontSize: 11, color: BRAND.textMuted },
  infoDot: { fontSize: 11, color: BRAND.textMuted },
  
  // Description inline
  descriptionInline: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginBottom: 8,
    paddingLeft: 2,
  },
  
  // Pending section
  pendingSection: { marginTop: 4 },
  viewMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.secondary + '10',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.secondary + '30',
    marginBottom: 8,
    gap: 6,
  },
  viewMapBtnText: { fontSize: 13, fontWeight: '600', color: BRAND.secondary },
  pendingActionRow: { flexDirection: 'row', gap: 8 },
  
  // Reject Button
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: BRAND.danger + '40',
  },
  rejectBtnText: { color: BRAND.danger, fontSize: 14, fontWeight: '600' },
  
  // Accept Button
  acceptBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.primary,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 5,
  },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  
  // Active actions
  activeActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.secondary,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  completeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
  },
  
  // Loading & Empty
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: BRAND.textSecondary, marginTop: 10 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: BRAND.text, marginTop: 12 },
  emptyText: { fontSize: 13, color: BRAND.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 18, paddingHorizontal: 32 },
  
  // Modal — Compact
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: BRAND.text },
  modalClose: { padding: 4 },
  modalSubtitle: { fontSize: 13, color: BRAND.textSecondary, marginBottom: 16, lineHeight: 18 },
  otpInput: {
    borderWidth: 2,
    borderColor: BRAND.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '700',
    marginBottom: 10,
    color: BRAND.text,
  },
  otpError: { color: BRAND.danger, fontSize: 13, textAlign: 'center', marginBottom: 10 },
  verifyBtn: {
    backgroundColor: BRAND.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyBtnDisabled: { backgroundColor: '#9CA3AF' },
  verifyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

export default ProviderJobsScreen;
