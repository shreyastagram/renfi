/**
 * User Service History Screen — v2.0 Revamp
 * 
 * Compact professional service history with:
 * - Tight card layout — no wasted space
 * - Fixed icons
 * - Better info density
 * - Inline rating, OTP, and actions
 * 
 * @version 2.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Alert,
  Linking,
  Platform,
  Clipboard,
  ScrollView,
  Image,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import { Icon, ServiceIcon, StatusIcon, RatingModal, FixhomiLogo, CancellationReasonModal } from '../components';
import { 
  getUserRequests, 
  cancelRequest,
  submitRating,
  checkRatingStatus,
  SERVICE_TYPE_LABELS,
} from '../services/traditionalServiceService';
import { subscribeToRequest, unsubscribeFromRequest, addEventListener as addSocketListener } from '../services/socketService';
import { setupForegroundMessageListener } from '../services/fcmService';
// Direct phone dialing - Exotel call masking removed
import { NODE_BASE_URL } from '../config/api';

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  background: '#F5F5F7',
  white: '#FFFFFF',
  neutral: '#6B7280',
  success: '#10B981',
  danger: '#EF4444',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: BRAND.primary, bgColor: '#FEF3C7', iconName: 'pending' },
  accepted: { label: 'Accepted', color: BRAND.secondary, bgColor: '#DBEAFE', iconName: 'accepted' },
  'in-progress': { label: 'In Progress', color: BRAND.secondary, bgColor: '#DBEAFE', iconName: 'in_progress' },
  completed: { label: 'Completed', color: '#10B981', bgColor: '#D1FAE5', iconName: 'completed' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bgColor: '#FEE2E2', iconName: 'cancelled' },
  rejected: { label: 'Rejected', color: '#EF4444', bgColor: '#FEE2E2', iconName: 'cancelled' },
  expired: { label: 'Expired', color: BRAND.neutral, bgColor: '#F3F4F6', iconName: 'cancelled' },
};

const FILTER_TABS = [
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'pending', label: 'Pending', icon: 'clock' },
  { key: 'accepted', label: 'Active', icon: 'location' },
  { key: 'completed', label: 'Done', icon: 'check_circle' },
  { key: 'cancelled', label: 'Cancelled', icon: 'close_circle' },
];

const FilterTabs = ({ activeFilter, onFilterChange }) => (
  <View style={styles.filterContainer}>
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      contentContainerStyle={styles.filterScroll}
      bounces={false}
    >
      {FILTER_TABS.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
          onPress={() => onFilterChange(tab.key)}
          activeOpacity={0.7}
        >
          <Icon name={tab.icon} size={13} color={activeFilter === tab.key ? BRAND.white : BRAND.neutral} />
          <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

/**
 * Compact Request Card — v2.0
 */
const RequestCard = ({ request, onPress, onCancel, onCallProvider, onTrackProvider, onDirections, onRate, ratingStatus }) => {
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const isActive = ['accepted', 'in-progress'].includes(request.status);
  const isCompleted = request.status === 'completed';
  const isPending = request.status === 'pending';
  const isCancelled = ['cancelled', 'rejected', 'expired'].includes(request.status);
  const hasProvider = request.providerDetails && (request.assignedProviderId || request.providerId);
  const hasRated = request.ratings?.userRating > 0 || request._rated || ratingStatus?.rated;
  const ratedStars = ratingStatus?.rating?.rating || request.ratings?.userRating;
  const isEventService = request.isEventService;
  const isEmergencyService = request.isEmergencyService;
  const serviceDate = new Date(request.serviceDate || request.createdAt);
  
  const providerProfilePicture = request.providerDetails?.profilePicture || 
    (typeof request.providerDetails?.profilePicture === 'string' ? request.providerDetails?.profilePicture : request.providerDetails?.profilePicture?.url);
  
  const handleCopyOtp = () => {
    if (request.completionOtp) {
      Clipboard.setString(request.completionOtp);
      Alert.alert('Copied!', 'OTP copied to clipboard');
    }
  };

  return (
    <TouchableOpacity style={[styles.requestCard, isPending && styles.requestCardPending]} onPress={onPress} activeOpacity={0.7}>
      {/* Row 1: Service + Status + Service Badge */}
      <View style={styles.cardRow1}>
        <View style={styles.serviceChip}>
          <ServiceIcon serviceType={request.serviceType} size={18} />
          <View style={styles.serviceChipMeta}>
            <Text style={styles.serviceLabel} numberOfLines={1}>
              {SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}
            </Text>
            {isEventService && (
              <View style={styles.eventTag}>
                <Text style={styles.eventTagText}>EVENT</Text>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: status.bgColor }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Cancellation/Rejection info — production-grade */}
      {isCancelled && (() => {
        const cancelledBy = request.cancelledBy;
        const reason = request.rejectReason || request.cancellationReason || request.cancelReason;
        // Build a clean label: "Cancelled by You" or "Cancelled by Provider" + optional reason
        let label = '';
        if (request.status === 'rejected') {
          label = reason || 'No providers available';
        } else if (cancelledBy === 'provider') {
          label = 'Cancelled by Service Provider';
        } else if (cancelledBy === 'user') {
          label = 'Cancelled by You';
        } else if (cancelledBy === 'system') {
          label = 'Cancelled by System';
        } else {
          label = reason || 'Request cancelled';
        }
        // Append custom reason if different from generic defaults
        const genericReasons = ['user cancelled', 'cancelled by user', 'cancelled by provider', 'provider cancelled'];
        const hasCustomReason = reason && !genericReasons.includes(reason.toLowerCase());
        if (hasCustomReason && cancelledBy) {
          label += ` — ${reason}`;
        }
        return (
          <View style={styles.reasonStrip}>
            <Icon name="info" size={12} color="#92400E" />
            <Text style={styles.reasonStripText} numberOfLines={2}>
              {label}
            </Text>
          </View>
        );
      })()}

      {/* Row 2: Date & Time strip */}
      <View style={styles.dateStrip}>
        <Icon name="calendar" size={11} color={BRAND.textMuted} />
        <Text style={styles.dateStripText}>
          {isEventService && request.eventDate 
            ? `Event: ${new Date(request.eventDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`
            : serviceDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          }
        </Text>
        {/* Service Time — for scheduled/future bookings */}
        {request.serviceTime && !isEmergencyService && (() => {
          let h, m;
          const asDate = new Date(request.serviceTime);
          if (!isNaN(asDate.getTime()) && request.serviceTime.length > 5) {
            h = asDate.getHours();
            m = asDate.getMinutes();
          } else {
            [h, m] = String(request.serviceTime).split(':').map(Number);
          }
          if (isNaN(h) || isNaN(m)) return null;
          const period = h >= 12 ? 'PM' : 'AM';
          const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
          return (
            <>
              <Text style={styles.dateStripText}> · </Text>
              <Icon name="clock" size={11} color={BRAND.textMuted} />
              <Text style={styles.dateStripText}>
                {` ${displayHour}:${String(m).padStart(2, '0')} ${period}`}
              </Text>
            </>
          );
        })()}
      </View>

      {/* Provider Row — compact inline */}
      {hasProvider && (
        <View style={styles.providerRow}>
          <View style={styles.providerChip}>
            {providerProfilePicture ? (
              <Image source={{ uri: providerProfilePicture }} style={styles.providerThumb} />
            ) : (
              <View style={styles.providerThumbPlaceholder}>
                <Text style={styles.providerThumbInitial}>
                  {request.providerDetails.name?.charAt(0).toUpperCase() || 'P'}
                </Text>
              </View>
            )}
            <View style={styles.providerMeta}>
              <Text style={styles.providerName} numberOfLines={1}>{request.providerDetails.name}</Text>
              {request.providerDetails.rating > 0 && (
                <View style={styles.providerRatingChip}>
                  <Icon name="star" size={10} color="#F59E0B" />
                  <Text style={styles.providerRatingText}>{Number(request.providerDetails.rating).toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Inline quick action buttons */}
          {(isActive || isPending) && (
            <View style={styles.quickActions}>
              {hasProvider && (
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => onCallProvider(request)}>
                  <Icon name="phone" size={14} color={BRAND.success} />
                </TouchableOpacity>
              )}
              {isActive && hasProvider && (
                <TouchableOpacity style={[styles.quickActionBtn, styles.quickActionBtnPrimary]} onPress={() => onTrackProvider(request)}>
                  <Icon name="location" size={14} color={BRAND.white} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* OTP Section — compact inline */}
      {isActive && request.completionOtp && (
        <TouchableOpacity style={styles.otpStrip} onPress={handleCopyOtp} activeOpacity={0.7}>
          <Icon name="lock" size={13} color="#7C3AED" />
          <Text style={styles.otpStripLabel}>OTP</Text>
          <Text style={styles.otpStripValue}>{request.completionOtp}</Text>
          <Icon name="copy" size={12} color="#7C3AED" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      )}

      {/* Cancel Button — compact */}
      {isPending && (
        <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(request)}>
          <Icon name="close" size={14} color={BRAND.danger} />
          <Text style={styles.cancelBtnText}>Cancel Request</Text>
        </TouchableOpacity>
      )}

      {/* Rating Section — compact */}
      {isCompleted && hasProvider && (
        hasRated ? (
          <View style={styles.ratedStrip}>
            <Icon name="star" size={13} color="#F59E0B" />
            <Text style={styles.ratedStripText}>
              Rated {ratedStars} stars
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.rateBtn} onPress={() => onRate(request)}>
            <Icon name="star" size={14} color="#FFFFFF" />
            <Text style={styles.rateBtnText}>Rate Service</Text>
          </TouchableOpacity>
        )
      )}
    </TouchableOpacity>
  );
};

const UserServiceHistoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, userType, logout } = useApp();
  const isFocused = useIsFocused();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  
  // Auto-refresh setting
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  // Rating modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [requestToRate, setRequestToRate] = useState(null);
  
  // Rating statuses from central Rating collection
  const [ratingStatuses, setRatingStatuses] = useState({});

  // Cancel reason modal state
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState(null);

  const displayData = { ...user, ...profile };
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  const fetchRequests = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      // Fetch traditional, event, and emergency services in parallel
      // Use limit: 500 to ensure ALL bookings are fetched (backend default is only 10)
      const [traditionalResult, eventResult, emergencyResult] = await Promise.all([
        getUserRequests(userId, { limit: 500, sortBy: 'createdAt', sortOrder: 'desc' }),
        fetch(`${NODE_BASE_URL}/api/event-services/user/${userId}`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${NODE_BASE_URL}/api/emergency-services/user/${userId}?limit=500`).then(r => r.json()).catch(() => ({ requests: [] })),
      ]);
      
      // Event services now come with providerDetails from backend
      const eventBookings = (eventResult.data || []).map(booking => ({
        ...booking,
        _id: booking._id,
        requestId: booking.serviceId || booking._id,
        serviceType: booking.serviceType,
        status: booking.status,
        createdAt: booking.createdAt,
        isEventService: true, // Flag to identify event services
        // Backend now returns providerDetails with full info
        providerDetails: booking.providerDetails || (booking.providerId ? { 
          _id: booking.providerId,
          name: booking.providerName || 'Provider',
        } : null),
        assignedProviderId: booking.providerId,
        providerId: booking.providerId,
        completionOtp: booking.completionOtp,
        eventDate: booking.eventDate,
      }));
      
      // Emergency services
      const emergencyData = emergencyResult.requests || emergencyResult.data || [];
      const emergencyBookings = emergencyData.map(booking => ({
        ...booking,
        _id: booking._id,
        requestId: booking.requestId || booking._id,
        serviceType: booking.serviceType,
        status: booking.status,
        createdAt: booking.createdAt,
        isEmergencyService: true, // Flag to identify emergency services
        providerDetails: booking.providerDetails || (booking.providerId ? {
          _id: booking.providerId,
          name: booking.providerInfo?.name || 'Provider',
          phone: booking.providerInfo?.phone,
        } : null),
        assignedProviderId: booking.providerId,
        providerId: booking.providerId,
        completionOtp: booking.completionOtp,
        location: booking.location,
        notes: booking.notes,
      }));
      
      // Combine and sort by date
      const allRequests = [
        ...(traditionalResult.success ? traditionalResult.requests : []),
        ...eventBookings,
        ...emergencyBookings,
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setRequests(allRequests);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  
  // Fetch rating statuses for completed requests from central Rating collection
  useEffect(() => {
    const fetchRatingStatuses = async () => {
      const completedRequests = requests.filter(r => r.status === 'completed');
      if (completedRequests.length === 0) return;
      
      const statuses = {};
      await Promise.all(
        completedRequests.map(async (req) => {
          const reqId = req._id;
          // Skip if we already have this status cached
          if (ratingStatuses[reqId]) {
            statuses[reqId] = ratingStatuses[reqId];
            return;
          }
          try {
            const result = await checkRatingStatus(reqId);
            statuses[reqId] = result;
          } catch (e) {
            statuses[reqId] = { rated: false };
          }
        })
      );
      setRatingStatuses(prev => ({ ...prev, ...statuses }));
    };
    
    if (requests.length > 0) {
      fetchRatingStatuses();
    }
  }, [requests]);
  
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
    if (isFocused && autoRefreshEnabled && !loading) {
      console.log('[UserHistory] Screen focused — auto-refreshing');
      fetchRequests();
    }
  }, [isFocused]);
  
  // Periodic auto-refresh every 30s
  useEffect(() => {
    if (!isFocused || !autoRefreshEnabled) return;
    
    const interval = setInterval(() => {
      console.log('[UserHistory] Periodic auto-refresh');
      fetchRequests();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isFocused, autoRefreshEnabled, fetchRequests]);
  
  // AppState listener — refresh when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && autoRefreshEnabled && isFocused) {
        console.log('[UserHistory] App foregrounded — auto-refreshing');
        fetchRequests();
      }
    });
    return () => sub.remove();
  }, [autoRefreshEnabled, isFocused, fetchRequests]);
  
  // Socket listener — real-time status updates for user
  useEffect(() => {
    const cleanups = [
      addSocketListener('request:accepted', () => {
        if (autoRefreshEnabled) fetchRequests();
      }),
      addSocketListener('request:completed', () => {
        if (autoRefreshEnabled) fetchRequests();
      }),
      addSocketListener('request:status', () => {
        if (autoRefreshEnabled) fetchRequests();
      }),
      addSocketListener('provider:assigned', () => {
        if (autoRefreshEnabled) fetchRequests();
      }),
    ];
    return () => cleanups.forEach(fn => fn());
  }, [autoRefreshEnabled, fetchRequests]);
  
  // FCM foreground listener — show banners for status changes
  // FCM foreground listener — auto-refresh only (banner handled by GlobalBanner)
  useEffect(() => {
    const unsubscribe = setupForegroundMessageListener((remoteMessage) => {
      const msgType = remoteMessage?.data?.type;
      console.log('[UserHistory] FCM foreground (auto-refresh):', msgType);
      if (autoRefreshEnabled) fetchRequests();
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [autoRefreshEnabled, fetchRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  const handleCallProvider = (request) => {
    const phone = request.providerDetails?.phone || request.providerDetails?.verifiedPhone;
    const providerName = request.providerDetails?.name || 'Provider';
    
    if (!phone) {
      Alert.alert('Error', 'Provider phone number not available');
      return;
    }

    const phoneNumber = phone.replace(/\s/g, '');
    const url = `tel:${phoneNumber}`;

    Alert.alert(
      '📞 Call Provider',
      `Call ${providerName} at ${phone}?`,
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

  const handleTrackProvider = (request) => {
    // Get service location from request
    const serviceLocation = request.location?.coordinates || request.location;
    const serviceCoords = serviceLocation ? {
      latitude: serviceLocation.latitude || serviceLocation.lat || (serviceLocation[1]),
      longitude: serviceLocation.longitude || serviceLocation.lng || (serviceLocation[0]),
    } : null;
    
    // Navigate to live tracking screen with service location
    navigation.navigate('LiveTracking', { 
      requestId: request.requestId || request._id,
      providerId: request.assignedProviderId || request.providerId,
      providerName: request.providerDetails?.name || request.providerName,
      providerPhone: request.providerDetails?.phone,
      serviceCategory: request.serviceType || request.serviceCategory || request.category,
      serviceLocation: serviceCoords,
      serviceAddress: request.serviceAddress || request.address || request.location?.address,
    });
  };

  const handleDirections = (location) => {
    if (!location) { Alert.alert('Error', 'Location not available'); return; }

    let destLat, destLng;

    // Handle GeoJSON format: location.coordinates = [lng, lat]
    if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
      destLng = location.coordinates[0];
      destLat = location.coordinates[1];
    } else if (location.coordinates?.latitude && location.coordinates?.longitude) {
      destLat = location.coordinates.latitude;
      destLng = location.coordinates.longitude;
    } else if (location.latitude && location.longitude) {
      destLat = location.latitude;
      destLng = location.longitude;
    } else if (location.lat && location.lng) {
      destLat = location.lat;
      destLng = location.lng;
    }

    if (!destLat || !destLng) { Alert.alert('Error', 'Location not available'); return; }
    const url = Platform.select({
      ios: `maps:?daddr=${destLat},${destLng}`,
      android: `google.navigation:q=${destLat},${destLng}`,
    });
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`));
  };

  /**
   * Open cancellation reason modal instead of bare Alert
   */
  const handleCancel = (request) => {
    setRequestToCancel(request);
    setCancelModalVisible(true);
  };

  /**
   * Execute cancellation after user selects a reason from the modal
   */
  const executeCancellation = async (reason) => {
    if (!requestToCancel) return;
    setCancellingRequest(true);
    try {
      let result;
      
      // Detect service types from request's serviceType field
      const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
      const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
      
      const isEventServiceRequest = requestToCancel.isEventService || EVENT_SERVICE_TYPES.includes(requestToCancel?.serviceType);
      const isEmergencyServiceRequest = requestToCancel.isEmergencyService || EMERGENCY_SERVICE_TYPES.includes(requestToCancel?.serviceType);
      
      console.log('[UserHistory] Cancel service type detection:', { 
        serviceType: requestToCancel?.serviceType, 
        isEventService: isEventServiceRequest, 
        isEmergencyService: isEmergencyServiceRequest 
      });
      
      if (isEventServiceRequest) {
        console.log('[UserHistory] Cancelling event service:', requestToCancel._id);
        const response = await fetch(`${NODE_BASE_URL}/api/event-services/${requestToCancel._id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, reason, cancelledBy: 'user' }),
        });
        result = await response.json();
        result.success = response.ok && result.statusCode !== 500;
      } else if (isEmergencyServiceRequest) {
        console.log('[UserHistory] Cancelling emergency service:', requestToCancel._id);
        const response = await fetch(`${NODE_BASE_URL}/api/emergency-services/${requestToCancel._id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, reason, cancelledBy: 'user' }),
        });
        result = await response.json();
        result.success = response.ok && result.statusCode !== 500;
      } else {
        console.log('[UserHistory] Cancelling traditional service:', requestToCancel._id);
        result = await cancelRequest(requestToCancel._id, userId, reason);
      }
      
      setCancelModalVisible(false);
      if (result.success) { 
        Alert.alert('Cancelled', 'Your booking has been cancelled successfully.'); 
        onRefresh(); 
      } else {
        Alert.alert('Error', result.error || 'Failed to cancel');
      }
    } catch (error) {
      console.error('Cancel error:', error);
      Alert.alert('Error', 'Failed to cancel booking');
    } finally {
      setCancellingRequest(false);
      setRequestToCancel(null);
    }
  };

  const handleViewDetails = (request) => {
    navigation.navigate('ServiceRequestDetail', { 
      requestId: request.requestId || request._id,
      request: request,
    });
  };

  /**
   * Open rating modal for a completed service
   */
  const handleOpenRating = (request) => {
    setRequestToRate(request);
    setRatingModalVisible(true);
  };

  /**
   * Submit rating and update local state
   */
  const handleSubmitRating = async (requestId, rating, review) => {
    if (!requestToRate) return;
    
    // Resolve providerId from the request object
    const providerId = requestToRate.assignedProviderId || requestToRate.providerId || requestToRate.providerDetails?._id;
    
    const result = await submitRating(
      requestToRate._id,
      userId,
      rating,
      review,
      providerId
    );
    
    if (result.success) {
      // Update local state to reflect the rating
      setRequests(prev => prev.map(r => 
        r._id === requestToRate._id 
          ? { 
              ...r, 
              _rated: true,
              ratings: { 
                ...r.ratings, 
                userRating: rating, 
                userReview: review,
                ratedAt: new Date().toISOString()
              } 
            } 
          : r
      ));
      // Update rating statuses cache
      setRatingStatuses(prev => ({
        ...prev,
        [requestToRate._id]: { rated: true, rating: { rating, review, date: new Date().toISOString() } },
      }));
    }
    
    return result;
  };

  // Filter requests based on active filter
  const filteredRequests = (() => {
    switch (activeFilter) {
      case 'all':
        return requests;
      case 'accepted':
        return requests.filter(r => ['accepted', 'in-progress'].includes(r.status));
      case 'cancelled':
        return requests.filter(r => ['cancelled', 'expired', 'rejected'].includes(r.status));
      default:
        return requests.filter(r => r.status === activeFilter);
    }
  })();

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerPlaceholder} />
          <Text style={styles.headerTitle}>Service History</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND.secondary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <MenuButton onPress={() => setIsDrawerOpen(true)} />
        <Text style={styles.headerTitle}>Service History</Text>
        <AvatarButton 
          name={displayData?.fullName} 
          profilePicture={displayData?.profilePicture}
          onPress={() => navigation.navigate('Profile')} 
        />
      </View>

      <FilterTabs activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.requestId || item._id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            onPress={() => handleViewDetails(item)}
            onCancel={handleCancel}
            onCallProvider={handleCallProvider}
            onTrackProvider={handleTrackProvider}
            onDirections={handleDirections}
            onRate={handleOpenRating}
            ratingStatus={ratingStatuses[item._id]}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FixhomiLogo size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No requests yet</Text>
            <Text style={styles.emptySubtext}>Book a service to get started!</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      />

      <DrawerMenu
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={displayData}
        userType={userType}
        navigation={navigation}
        onLogout={logout}
        isVerified={displayData?.isPhoneVerified && displayData?.isEmailVerified}
      />

      {/* Rating Modal */}
      <RatingModal
        visible={ratingModalVisible}
        providerName={requestToRate?.providerDetails?.name}
        serviceName={SERVICE_TYPE_LABELS[requestToRate?.serviceType] || requestToRate?.serviceType}
        onClose={() => {
          setRatingModalVisible(false);
          setRequestToRate(null);
        }}
        onSubmit={handleSubmitRating}
      />

      {/* Cancellation Reason Modal */}
      <CancellationReasonModal
        visible={cancelModalVisible}
        onClose={() => {
          setCancelModalVisible(false);
          setRequestToCancel(null);
        }}
        onSubmit={executeCancellation}
        cancellerRole="user"
        loading={cancellingRequest}
        serviceName={SERVICE_TYPE_LABELS[requestToCancel?.serviceType] || requestToCancel?.serviceType}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.background },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: BRAND.white, borderBottomWidth: 1, borderBottomColor: BRAND.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: BRAND.text },
  headerPlaceholder: { width: 36 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  // Filter tabs — compact pills
  filterContainer: { backgroundColor: BRAND.white, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BRAND.border },
  filterScroll: { paddingHorizontal: 12, gap: 6 },
  filterTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#F3F4F6', borderRadius: 18, gap: 5 },
  filterTabActive: { backgroundColor: BRAND.secondary },
  filterTabText: { fontSize: 12, fontWeight: '600', color: BRAND.neutral },
  filterTabTextActive: { color: BRAND.white },
  
  // List
  listContent: { padding: 12, paddingBottom: 24 },
  
  // Request Card — Compact v2.0
  requestCard: {
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
  requestCardPending: {
    borderColor: BRAND.primary + '30',
    borderWidth: 1.5,
  },
  
  // Row 1: Service + Status
  cardRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  serviceChip: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  serviceChipMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  serviceLabel: { fontSize: 14, fontWeight: '600', color: BRAND.text },
  eventTag: { backgroundColor: '#F3E8FF', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  eventTagText: { fontSize: 8, fontWeight: '700', color: '#7C3AED', letterSpacing: 0.5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 4, marginLeft: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  
  // Reason strip
  reasonStrip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  reasonStripText: { fontSize: 11, color: '#92400E', fontWeight: '500', flex: 1 },
  
  // Date strip
  dateStrip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  dateStripText: { fontSize: 12, color: BRAND.textMuted },
  
  // Provider row — compact inline
  providerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  providerChip: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  providerThumb: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: BRAND.secondary },
  providerThumbPlaceholder: { width: 28, height: 28, borderRadius: 14, backgroundColor: BRAND.secondary, alignItems: 'center', justifyContent: 'center' },
  providerThumbInitial: { fontSize: 12, fontWeight: '600', color: '#fff' },
  providerMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  providerName: { fontSize: 13, fontWeight: '500', color: BRAND.text },
  providerRatingChip: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#FEF3C7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  providerRatingText: { fontSize: 10, fontWeight: '600', color: '#92400E' },
  
  // Quick action buttons — compact circles
  quickActions: { flexDirection: 'row', gap: 6 },
  quickActionBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  quickActionBtnPrimary: { backgroundColor: BRAND.primary },
  
  // OTP strip — compact inline
  otpStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 6,
  },
  otpStripLabel: { fontSize: 11, color: '#7C3AED', fontWeight: '600' },
  otpStripValue: { fontSize: 17, fontWeight: '700', color: BRAND.text, letterSpacing: 3 },
  
  // Cancel button — compact
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#FEE2E2', paddingVertical: 9, borderRadius: 10 },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: BRAND.danger },
  
  // Rating — compact
  rateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F59E0B', paddingVertical: 9, borderRadius: 10, marginTop: 2 },
  rateBtnText: { fontSize: 13, fontWeight: '600', color: BRAND.white },
  ratedStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingVertical: 7, borderRadius: 8, marginTop: 2 },
  ratedStripText: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  
  // Empty state
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, fontWeight: '600', color: BRAND.text, marginTop: 12 },
  emptySubtext: { fontSize: 13, color: BRAND.textSecondary, marginTop: 4 },
});

export default UserServiceHistoryScreen;
