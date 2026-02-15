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
 * @version 2.0.0 — Compact professional revamp
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  Platform,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Icon, ServiceIcon, StatusIcon, RatingModal } from '../components';
import { NODE_BASE_URL } from '../config/api';
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
} from '../services/traditionalServiceService';
import { addToFavorites, removeFromFavorites, checkIsFavorite } from '../services/favoritesService';
// Direct phone dialing - Exotel call masking removed

// Brand colors — unified across all screens
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

// Status configuration - unified brand palette
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

/**
 * Get status description based on user type
 */
const getStatusDescription = (status, isProvider) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return isProvider ? config.providerDescription : config.userDescription;
};

/**
 * Status Timeline Component — compact inline progress bar
 */
const StatusTimeline = ({ currentStatus, isProvider = false }) => {
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
      <View style={styles.timelineContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.color }} />
          <Text style={{ fontSize: 13, color: BRAND.textSecondary }}>{getStatusDescription(currentStatus, isProvider)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.timelineContainer}>
      <Text style={styles.timelineTitle}>Progress</Text>
      <View style={styles.timeline}>
        {steps.map((step, index) => {
          const isActive = status.step >= step.step;
          const isCurrent = status.step === step.step;
          const isCompleted = status.step > step.step;
          
          return (
            <View key={step.key} style={styles.timelineStep}>
              {index > 0 && (
                <View style={[
                  styles.timelineConnector,
                  isActive && styles.timelineConnectorActive,
                ]} />
              )}
              <View style={[
                styles.timelineCircle,
                isActive && styles.timelineCircleActive,
                isCurrent && styles.timelineCircleCurrent,
              ]}>
                {isCompleted ? (
                  <Icon name="check" size={12} color={BRAND.white} />
                ) : (
                  <Text style={[styles.timelineNumber, isActive && styles.timelineNumberActive]}>
                    {step.step}
                  </Text>
                )}
              </View>
              <Text style={[styles.timelineLabel, isActive && styles.timelineLabelActive]}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

/**
 * Info Row Component — compact single-line
 */
const InfoRow = ({ label, value, iconName }) => (
  <View style={styles.infoRow}>
    <Icon name={iconName} size={15} color={BRAND.textMuted} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
  </View>
);

/**
 * OTP Display Component — compact inline
 */
const OtpDisplay = ({ otp, expiresAt, onResend }) => {
  const [copied, setCopied] = useState(false);
  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  const handleCopy = () => {
    if (otp) {
      Alert.alert('Completion OTP', `Your OTP is: ${otp}\n\nShare this with your service provider to mark the service as complete.`, [{ text: 'OK' }]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isExpired) {
    return (
      <View style={styles.otpExpiredContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="clock" size={20} color="#F59E0B" />
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC2626' }}>OTP Expired</Text>
        </View>
        <Text style={{ fontSize: 12, color: '#7F1D1D', textAlign: 'center', marginBottom: 10 }}>
          The completion OTP has expired. Request a new one.
        </Text>
        <TouchableOpacity style={styles.resendButton} onPress={onResend}>
          <Text style={styles.resendButtonText}>Request New OTP</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.otpDisplayContainer}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="lock" size={16} color={BRAND.secondary} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND.secondary }}>Completion OTP</Text>
        </View>
        <Text style={{ fontSize: 11, color: BRAND.textMuted }}>Share with provider</Text>
      </View>
      
      <TouchableOpacity style={styles.otpCodeBox} onPress={handleCopy} activeOpacity={0.7}>
        <Text style={styles.otpCode}>{otp}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name={copied ? 'check' : 'copy'} size={12} color={copied ? BRAND.success : BRAND.textMuted} />
          <Text style={{ fontSize: 11, color: copied ? BRAND.success : BRAND.textMuted, fontWeight: '500' }}>
            {copied ? 'Copied!' : 'Tap to copy'}
          </Text>
        </View>
      </TouchableOpacity>

      {expiresAt && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          <Icon name="timer" size={13} color={BRAND.textMuted} />
          <Text style={{ fontSize: 11, color: BRAND.textMuted }}>
            Expires {new Date(expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', backgroundColor: '#FEF3C7', borderRadius: 8, padding: 8, marginTop: 10, gap: 6 }}>
        <Icon name="info" size={14} color="#92400E" />
        <Text style={{ flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16 }}>
          Only share after the work is satisfactorily done.
        </Text>
      </View>
    </View>
  );
};

/**
 * Resolve profile picture URL from any format
 * Handles: string, { url: '...' }, { url: { url: '...' } }, null
 */
const resolveProfilePic = (pic) => {
  if (!pic) return null;
  if (typeof pic === 'string' && pic.length > 0) return pic;
  if (typeof pic === 'object' && pic.url) {
    if (typeof pic.url === 'string') return pic.url;
  }
  return null;
};

/**
 * Provider Card Component — compact with profile picture
 */
const ProviderCard = ({ provider, onCall, onGetLocation, showActions }) => {
  if (!provider) return null;

  const profilePicUrl = resolveProfilePic(provider.profilePicture) || resolveProfilePic(provider.profileImage);
  const ratingValue = provider.ratings?.average || provider.rating || 0;
  const reviewCount = provider.ratings?.total || provider.totalRatings || 0;

  return (
    <View style={styles.providerCard}>
      <Text style={styles.sectionTitle}>Your Provider</Text>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: showActions ? 10 : 0 }}>
        <View style={{ position: 'relative', marginRight: 10 }}>
          {profilePicUrl ? (
            <Image source={{ uri: profilePicUrl }} style={styles.providerAvatarImage} />
          ) : (
            <View style={styles.providerAvatar}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.white }}>
                {provider.name?.charAt(0).toUpperCase() || 'P'}
              </Text>
            </View>
          )}
          {(provider.isVerified || provider.verified) && (
            <View style={styles.providerVerifiedBadge}>
              <Icon name="verified" size={10} color="#FFFFFF" />
            </View>
          )}
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: BRAND.text }}>{provider.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            {ratingValue > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Icon name="star" size={13} color="#F59E0B" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: BRAND.text }}>{ratingValue.toFixed(1)}</Text>
                {reviewCount > 0 && <Text style={{ fontSize: 11, color: BRAND.textMuted }}>({reviewCount})</Text>}
              </View>
            )}
            {showActions && (provider.phone || provider.verifiedPhone) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 4 }}>
                <Icon name="phone" size={11} color={BRAND.textMuted} />
                <Text style={{ fontSize: 11, color: BRAND.textMuted }}>{provider.phone || provider.verifiedPhone}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {showActions && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.callButton} onPress={onCall}>
            <Icon name="phone" size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Call</Text>
          </TouchableOpacity>
          {onGetLocation && (
            <TouchableOpacity style={styles.locationButton} onPress={onGetLocation}>
              <Icon name="location" size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Track</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

/**
 * Location Map Preview Component — compact with mini-map
 */
const LocationMapPreview = ({ location, address }) => {
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  
  const hasValidCoordinates = location?.coordinates && 
    Array.isArray(location.coordinates) && 
    location.coordinates.length === 2 &&
    typeof location.coordinates[0] === 'number' &&
    typeof location.coordinates[1] === 'number' &&
    !isNaN(location.coordinates[0]) &&
    !isNaN(location.coordinates[1]);
  
  if (!hasValidCoordinates) {
    if (!address) return null;
    return (
      <View style={styles.locationCard}>
        <Text style={styles.sectionTitle}>Service Location</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="location" size={16} color="#EF4444" />
          <Text style={{ flex: 1, fontSize: 13, color: BRAND.text, lineHeight: 18 }}>{address}</Text>
        </View>
      </View>
    );
  }

  const [lng, lat] = location.coordinates;
  
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
    <>
      <View style={styles.locationCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Service Location</Text>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#EFF6FF', borderRadius: 12, gap: 3 }}
            onPress={() => setMapExpanded(true)}
          >
            <Icon name="zoom-in" size={13} color={BRAND.secondary} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: BRAND.secondary }}>Expand</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.mapPreviewContainer}
          onPress={() => setMapExpanded(true)}
          activeOpacity={0.9}
        >
          {mapLoading && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="small" color={BRAND.secondary} />
            </View>
          )}
          <Mapbox.MapView
            style={styles.mapPreview}
            styleURL={Mapbox.StyleURL.Street}
            scrollEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            zoomEnabled={false}
            onDidFinishLoadingMap={() => setMapLoading(false)}
          >
            <Mapbox.Camera centerCoordinate={[lng, lat]} zoomLevel={15} animationDuration={0} />
            <Mapbox.PointAnnotation id="service-location" coordinate={[lng, lat]}>
              <View style={styles.mapPinContainer}>
                <View style={styles.mapPin}>
                  <Icon name="location" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.mapPinShadow} />
              </View>
            </Mapbox.PointAnnotation>
          </Mapbox.MapView>
          
          <View style={styles.mapPreviewHint}>
            <Icon name="touch" size={12} color="#FFFFFF" />
            <Text style={{ fontSize: 10, fontWeight: '500', color: '#FFFFFF' }}>Tap for full map</Text>
          </View>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 6 }}>
          <Icon name="location" size={15} color="#EF4444" />
          <Text style={{ flex: 1, fontSize: 13, color: BRAND.text, lineHeight: 18 }}>{address}</Text>
        </View>
        
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={handleGetDirections}
          activeOpacity={0.7}
        >
          <Icon name="directions" size={18} color="#FFFFFF" />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </TouchableOpacity>
      </View>

      {/* Fullscreen Map Modal */}
      <Modal
        visible={mapExpanded}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMapExpanded(false)}
      >
        <View style={styles.fullMapContainer}>
          <Mapbox.MapView
            style={styles.fullMap}
            styleURL={Mapbox.StyleURL.Street}
          >
            <Mapbox.Camera
              centerCoordinate={[lng, lat]}
              zoomLevel={16}
              animationDuration={500}
            />
            {/* Location Pin */}
            <Mapbox.PointAnnotation
              id="service-location-full"
              coordinate={[lng, lat]}
            >
              <View style={styles.fullMapPinContainer}>
                <View style={styles.fullMapPin}>
                  <Icon name="location" size={28} color="#FFFFFF" />
                </View>
                <View style={styles.fullMapPinShadow} />
              </View>
            </Mapbox.PointAnnotation>
          </Mapbox.MapView>
          
          {/* Top Bar */}
          <View style={styles.fullMapTopBar}>
            <TouchableOpacity 
              style={styles.fullMapCloseButton}
              onPress={() => setMapExpanded(false)}
            >
              <Icon name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.fullMapTitle}>Service Location</Text>
            <View style={{ width: 40 }} />
          </View>
          
          {/* Bottom Card */}
          <View style={styles.fullMapBottomCard}>
            <View style={styles.fullMapAddressRow}>
              <Icon name="location" size={20} color="#EF4444" />
              <Text style={styles.fullMapAddress} numberOfLines={2}>{address}</Text>
            </View>
            <TouchableOpacity
              style={styles.fullMapDirectionsButton}
              onPress={handleGetDirections}
            >
              <Icon name="directions" size={20} color="#FFFFFF" />
              <Text style={styles.fullMapDirectionsText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

/**
 * ServiceRequestDetailScreen Component
 */
const ServiceRequestDetailScreen = ({ navigation, route }) => {
  const { user, profile, userType } = useApp();
  const initialRequest = route.params?.request;
  
  // Detect event service by checking if serviceType is photographer or influencer
  const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
  const isEventService = route.params?.isEventService || 
    initialRequest?.isEventService || 
    EVENT_SERVICE_TYPES.includes(initialRequest?.serviceType) ||
    EVENT_SERVICE_TYPES.includes(route.params?.serviceType);
  
  // Detect emergency service by checking if serviceType is an emergency type
  const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
  const isEmergencyService = route.params?.isEmergencyService || 
    initialRequest?.isEmergencyService || 
    EMERGENCY_SERVICE_TYPES.includes(initialRequest?.serviceType) ||
    EMERGENCY_SERVICE_TYPES.includes(route.params?.serviceType);
  
  // State
  const [request, setRequest] = useState(initialRequest);
  const [loading, setLoading] = useState(!initialRequest);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  // Accept/Reject state (for providers on pending requests)
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  
  // Rating state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingStatus, setRatingStatus] = useState({ rated: false, rating: null });
  
  // Favorites state
  const [isFavorited, setIsFavorited] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  
  // Provider OTP entry state
  const [enteredOtp, setEnteredOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Determine if viewer is the request owner (user who created the request)
  // vs the provider who is handling/viewing the request
  const isProvider = userType === 'provider';
  
  // Get unified userId
  const getUserId = useCallback(() => {
    const mongoId = user?.mongoId || profile?._id;
    const javaUserId = user?.javaUserId || user?.userId || profile?.userId;
    return mongoId || javaUserId;
  }, [user, profile]);

  /**
   * Fetch request details - supports traditional, event, and emergency services.
   * Detects service category from route params and fetches from the correct API.
   */
  const fetchDetails = useCallback(async () => {
    // For event/emergency services, use the data passed via route params (when navigated from list)
    if ((isEventService || isEmergencyService) && initialRequest) {
      setRequest(initialRequest);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    // Use requestId from route params (could be TRD-xxx format or MongoDB _id)
    const lookupId = route.params?.requestId || request?._id || request?.requestId;
    
    if (!lookupId) return;

    try {
      let result;

      if (isEventService) {
        // Fetch from event services API
        console.log('[RequestDetail] Fetching event service:', lookupId);
        const response = await fetch(`${NODE_BASE_URL}/api/event-services/${lookupId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        result = { success: data.success, request: data.request, error: data.error };
      } else if (isEmergencyService) {
        // Fetch from emergency services API
        console.log('[RequestDetail] Fetching emergency service:', lookupId);
        const response = await fetch(`${NODE_BASE_URL}/api/emergency-services/${lookupId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        result = { success: data.success, request: data.request, error: data.error };
      } else {
        // Traditional service - use existing helper
        result = await getRequestDetails(lookupId);
      }
      
      if (result.success && result.request) {
        // Normalize: emergency backend may return providerInfo instead of providerDetails
        const req = result.request;
        if (req.providerInfo && !req.providerDetails) {
          req.providerDetails = req.providerInfo;
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

  // Initial fetch if needed
  useEffect(() => {
    // Initialize Mapbox on first render (lazy, idempotent)
    initializeMapbox();
    
    // For event/emergency services with passed data, just use it
    if ((isEventService || isEmergencyService) && initialRequest) {
      setRequest(initialRequest);
      setLoading(false);
      return;
    }
    
    // For notification-based navigation (no initialRequest), or traditional services, fetch details
    if (!initialRequest || !initialRequest.providerDetails) {
      fetchDetails();
    }
  }, [isEventService, isEmergencyService]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDetails();
  }, [fetchDetails]);

  /**
   * Handle cancel request - supports traditional, event, and emergency services
   */
  const handleCancel = useCallback(() => {
    const isAccepted = ['accepted', 'in-progress'].includes(request?.status);
    
    const title = isAccepted ? '⚠️ Cancel Accepted Request?' : 'Cancel Request?';
    const message = isAccepted 
      ? 'A provider has already accepted this request. Are you sure you want to cancel? The provider will be notified and your cancellation will be recorded.'
      : 'Are you sure you want to cancel this service request? This action cannot be undone.';

    Alert.alert(
      title,
      message,
      [
        { text: 'No, Keep It', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            const userId = getUserId();
            
            try {
              let result;
              
              // Detect service types from request's serviceType field
              const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
              const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
              
              const isEventServiceRequest = isEventService || request?.isEventService || EVENT_SERVICE_TYPES.includes(request?.serviceType);
              const isEmergencyServiceRequest = isEmergencyService || request?.isEmergencyService || EMERGENCY_SERVICE_TYPES.includes(request?.serviceType);
              
              console.log('[Cancel] Service type detection:', { 
                serviceType: request?.serviceType, 
                isEventService: isEventServiceRequest, 
                isEmergencyService: isEmergencyServiceRequest 
              });
              
              // Determine which cancel endpoint to use based on service type
              if (isEventServiceRequest) {
                // Event service cancel
                console.log('[Cancel] Using event-services endpoint');
                const response = await fetch(`${NODE_BASE_URL}/api/event-services/${request._id}/cancel`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, reason: 'Cancelled by user' }),
                });
                const data = await response.json();
                result = {
                  success: response.ok && data.statusCode !== 500,
                  error: data.error || data.message,
                };
              } else if (isEmergencyServiceRequest) {
                // Emergency service cancel
                console.log('[Cancel] Using emergency-services endpoint');
                const response = await fetch(`${NODE_BASE_URL}/api/emergency-services/${request._id}/cancel`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, reason: 'Cancelled by user' }),
                });
                const data = await response.json();
                result = {
                  success: response.ok && data.statusCode !== 500,
                  error: data.error || data.message,
                };
              } else {
                // Traditional service cancel (existing function)
                console.log('[Cancel] Using traditional-services endpoint');
                result = await cancelRequest(request._id, userId, 'Cancelled by user');
              }
              
              setCancelling(false);
              
              if (result.success) {
                const successMsg = result.details?.wasAccepted 
                  ? 'Your request has been cancelled and the provider has been notified.'
                  : 'Your request has been cancelled.';
                Alert.alert('Cancelled', successMsg, [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel request');
              }
            } catch (error) {
              setCancelling(false);
              console.error('[Cancel] Error:', error);
              Alert.alert('Error', 'Failed to cancel request. Please try again.');
            }
          },
        },
      ]
    );
  }, [request, getUserId, navigation, isEventService, isEmergencyService]);

  /**
   * Handle phone call - direct dialing
   * Works for both user calling provider and provider calling user
   */
  const handleCall = useCallback(() => {
    const callerIsProvider = isProvider;
    let phone, contactName;
    
    if (callerIsProvider) {
      // Provider calling the user
      phone = request?.userDetails?.phone || request?.userDetails?.verifiedPhone || request?.userPhone;
      contactName = request?.userDetails?.name || request?.userName || 'Customer';
    } else {
      // User calling the provider
      phone = request?.providerDetails?.phone || request?.providerDetails?.verifiedPhone || request?.providerPhone;
      contactName = request?.providerDetails?.name || request?.providerName || 'Provider';
    }
    
    if (!phone) {
      Alert.alert('Phone Not Available', 'The phone number is not available yet. Please try again later.');
      return;
    }

    const phoneNumber = phone.replace(/\s/g, '');
    const url = `tel:${phoneNumber}`;

    Alert.alert(
      `📞 Call ${callerIsProvider ? 'Customer' : 'Provider'}`,
      `Call ${contactName} at ${phone}?`,
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
  }, [isProvider, request]);

  /**
   * Handle get provider location - navigates to live tracking screen
   */
  const handleGetProviderLocation = useCallback(() => {
    const providerDetails = request?.providerDetails;
    // Get providerId from request - emergency services store it at request.providerId
    const providerIdValue = request?.providerId || request?.assignedProviderId || providerDetails?._id || providerDetails?.providerId;
    
    if (!providerIdValue) {
      Alert.alert('Location Not Available', 'Provider ID is not available at the moment.');
      return;
    }

    // Extract service location from request for destination marker
    let serviceLocation = null;
    if (request?.location?.coordinates && Array.isArray(request.location.coordinates) && request.location.coordinates.length === 2) {
      const [lng, lat] = request.location.coordinates;
      serviceLocation = { latitude: lat, longitude: lng };
    } else if (request?.location?.latitude && request?.location?.longitude) {
      serviceLocation = { 
        latitude: request.location.latitude, 
        longitude: request.location.longitude 
      };
    }

    // Navigate to LiveTrackingScreen with service location
    navigation.navigate('LiveTracking', {
      requestId: request._id,
      providerId: providerIdValue,
      providerName: providerDetails?.name || 'Provider',
      providerPhone: providerDetails?.phone,
      serviceCategory: request.serviceCategory || request.category || request.serviceType,
      serviceLocation: serviceLocation,
      serviceAddress: request.serviceAddress || request.address || request.location?.address || '',
    });
  }, [request, navigation]);

  /**
   * Handle accept request — for providers on pending requests
   * Supports traditional, event, and emergency services
   */
  const handleAcceptRequest = useCallback(() => {
    const serviceLabel = SERVICE_TYPE_LABELS[request?.serviceType] || request?.serviceType;
    const providerId = user?.mongoId || user?.javaUserId || profile?.mongoId || profile?._id;
    
    const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
    const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
    const isEventReq = request?.isEventService || EVENT_SERVICE_TYPES.includes(request?.serviceType);
    const isEmergencyReq = request?.isEmergencyService || EMERGENCY_SERVICE_TYPES.includes(request?.serviceType);
    
    Alert.alert(
      'Accept Request',
      `Accept this ${serviceLabel} request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setAccepting(true);
            try {
              let result;
              
              if (isEmergencyReq) {
                const response = await fetch(`${NODE_BASE_URL}/api/emergency-services/${request._id}/accept`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    providerId,
                    userEmail: request.userDetails?.email || '',
                    estimatedArrival: 15,
                  }),
                });
                result = await response.json();
                result.success = result.success || response.ok;
              } else if (isEventReq) {
                const response = await fetch(`${NODE_BASE_URL}/api/event-services/${request._id}/accept`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    providerId,
                    userEmail: request.userDetails?.email || request.userEmail || '',
                  }),
                });
                result = await response.json();
                result.success = result.success || result.statusCode === 200;
              } else {
                result = await acceptRequestAsProvider(
                  request._id,
                  providerId,
                  request.userDetails?.email || ''
                );
              }
              
              if (result.success) {
                Alert.alert('Request Accepted', 'You have accepted this request. The customer has been notified.');
                fetchDetails(); // Refresh to show updated status
              } else {
                Alert.alert('Error', result.error || 'Failed to accept request');
              }
            } catch (error) {
              console.error('[RequestDetail] Accept error:', error);
              Alert.alert('Error', 'Something went wrong');
            } finally {
              setAccepting(false);
            }
          },
        },
      ]
    );
  }, [request, user, profile, fetchDetails]);

  /**
   * Handle reject request — for providers on pending requests
   * Supports traditional, event, and emergency services
   */
  const handleRejectRequest = useCallback(() => {
    const serviceLabel = SERVICE_TYPE_LABELS[request?.serviceType] || request?.serviceType;
    const providerId = user?.mongoId || user?.javaUserId || profile?.mongoId || profile?._id;
    
    const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
    const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
    const isEventReq = request?.isEventService || EVENT_SERVICE_TYPES.includes(request?.serviceType);
    const isEmergencyReq = request?.isEmergencyService || EMERGENCY_SERVICE_TYPES.includes(request?.serviceType);
    
    Alert.alert(
      'Reject Request',
      `Are you sure you want to reject this ${serviceLabel} request? The customer will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejecting(true);
            try {
              let result;
              
              if (isEmergencyReq) {
                const response = await fetch(`${NODE_BASE_URL}/api/emergency-services/${request._id}/provider-reject`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ providerId }),
                });
                result = await response.json();
                result.success = result.success || response.ok;
              } else if (isEventReq) {
                const response = await fetch(`${NODE_BASE_URL}/api/event-services/${request._id}/reject`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ providerId }),
                });
                result = await response.json();
                result.success = result.success || result.statusCode === 200 || response.ok;
              } else {
                const response = await fetch(`${NODE_BASE_URL}/api/traditional-services/${request._id}/provider-reject`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ providerId }),
                });
                result = await response.json();
                result.success = result.success || response.ok;
              }
              
              if (result.success) {
                Alert.alert('Request Rejected', 'You have rejected this request. The customer has been notified.', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert('Error', result.error || result.message || 'Failed to reject request');
              }
            } catch (error) {
              console.error('[RequestDetail] Reject error:', error);
              Alert.alert('Error', 'Something went wrong');
            } finally {
              setRejecting(false);
            }
          },
        },
      ]
    );
  }, [request, user, profile, navigation]);

  /**
   * Handle resend OTP
   */
  const handleResendOtp = useCallback(async () => {
    Alert.alert('Resend OTP', 'A new OTP will be sent to your email.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send OTP',
        onPress: async () => {
          try {
            const result = await resendCompletionOtp(request._id);
            
            if (result.success) {
              Alert.alert('✅ OTP Sent', 'A new completion OTP has been sent to your email.');
              // Refresh to get the new OTP
              handleRefresh();
            } else {
              Alert.alert('Error', result.error || 'Failed to resend OTP');
            }
          } catch (error) {
            console.error('[ResendOTP] Error:', error);
            Alert.alert('Error', 'Something went wrong. Please try again.');
          }
        },
      },
    ]);
  }, [request?._id, handleRefresh]);

  /**
   * Handle OTP verification by provider to complete service
   */
  const handleVerifyOtp = useCallback(async () => {
    if (enteredOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit OTP');
      return;
    }

    setVerifyingOtp(true);
    try {
      // Detect event service by serviceType (photographer, influencer)
      const EVENT_SERVICE_TYPES = ['photographer', 'influencer'];
      const EMERGENCY_SERVICE_TYPES = ['snake_catcher', 'private_ambulance', 'mortuary_van', 'fire_brigade', 'police', 'hospital'];
      
      const isEventServiceRequest = isEventService || request?.isEventService || EVENT_SERVICE_TYPES.includes(request?.serviceType);
      const isEmergencyServiceRequest = isEmergencyService || request?.isEmergencyService || EMERGENCY_SERVICE_TYPES.includes(request?.serviceType);
      
      console.log('[VerifyOTP] Service type detection:', { 
        serviceType: request?.serviceType, 
        isEventService: isEventServiceRequest, 
        isEmergencyService: isEmergencyServiceRequest 
      });
      
      let result;
      
      if (isEmergencyServiceRequest) {
        // Use emergency service verify endpoint
        console.log('[VerifyOTP] Using emergency-service endpoint');
        const response = await fetch(`${NODE_BASE_URL}/api/emergency-services/${request._id}/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otp: enteredOtp }),
        });
        result = await response.json();
        result.success = result.success || response.ok;
      } else if (isEventServiceRequest) {
        // Use event service verify endpoint
        console.log('[VerifyOTP] Using event-service endpoint');
        result = await verifyEventCompletionOtp(request._id, enteredOtp);
      } else {
        // Use traditional service verify
        console.log('[VerifyOTP] Using traditional-service endpoint');
        result = await verifyCompletionOtp(request._id, enteredOtp);
      }
      
      if (result.success) {
        Alert.alert(
          '✅ Service Completed!',
          'The service has been marked as completed successfully.',
          [{ text: 'OK', onPress: () => {
            setEnteredOtp('');
            handleRefresh();
          }}]
        );
      } else {
        Alert.alert('Verification Failed', result.error || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('[VerifyOTP] Error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  }, [request?._id, enteredOtp, handleRefresh, isEventService, isEmergencyService, request?.isEventService, request?.isEmergencyService]);

  /**
   * Handle rating submission — Provider-level centralized rating.
   * Sends the service request ID (for verification + dedup) and
   * the provider ID (who is being rated).
   */
  const handleSubmitRating = useCallback(async (requestId, rating, review) => {
    const userId = getUserId();
    if (!requestId || !userId) {
      return { success: false, error: 'Missing request or user information' };
    }
    
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return { success: false, error: 'Please select a valid rating (1-5 stars)' };
    }

    // Resolve the provider ID from the request
    const providerId = request?.providerId
      || request?.assignedProviderId
      || request?.providerDetails?._id
      || request?.assignedProviderDetails?._id
      || null;

    try {
      console.log('[Rating] Submitting provider rating:', { requestId, providerId });
      
      const result = await submitRating(requestId, userId, Math.round(rating), review || '', providerId);
      
      if (result.success) {
        setRequest(prev => ({
          ...prev,
          _rated: true,
        }));
      }
      
      return result;
    } catch (error) {
      console.error('[Rating] Error:', error);
      return { success: false, error: error.message || 'Failed to submit rating' };
    }
  }, [getUserId, request]);

  /**
   * Check if provider is favorited on mount
   */
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!request?.providerId && !request?.assignedProviderDetails?._id) return;
      const userId = getUserId();
      if (!userId) return;
      
      const providerId = request?.providerId || request?.assignedProviderDetails?._id;
      const result = await checkIsFavorite(userId, providerId, request?.serviceType);
      if (result.success) {
        setIsFavorited(result.isFavorite);
      }
    };
    
    if (request?.status === 'completed' && !isProvider) {
      checkFavoriteStatus();
    }
  }, [request?.providerId, request?.assignedProviderDetails?._id, request?.status, request?.serviceType, getUserId, isProvider]);

  /**
   * Toggle favorite status for provider
   */
  const handleToggleFavorite = useCallback(async () => {
    const userId = getUserId();
    const providerId = request?.providerId || request?.assignedProviderDetails?._id;
    
    if (!userId || !providerId) {
      Alert.alert('Error', 'Unable to update favorites. Please try again.');
      return;
    }

    setTogglingFavorite(true);
    try {
      let result;
      if (isFavorited) {
        result = await removeFromFavorites(userId, providerId, request?.serviceType);
      } else {
        const providerName = request?.providerDetails?.name || request?.assignedProviderDetails?.name || 'Provider';
        result = await addToFavorites(userId, providerId, request?.serviceType, `Saved from ${SERVICE_TYPE_LABELS[request?.serviceType] || request?.serviceType} service`);
      }

      if (result.success) {
        setIsFavorited(!isFavorited);
        Alert.alert(
          isFavorited ? 'Removed from Favorites' : 'Added to Favorites',
          isFavorited 
            ? 'Provider has been removed from your favorites.'
            : 'Provider has been added to your favorites. They will appear at the top when you search for this service.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to update favorites');
      }
    } catch (error) {
      console.error('[Favorites] Toggle error:', error);
      Alert.alert('Error', 'Failed to update favorites');
    } finally {
      setTogglingFavorite(false);
    }
  }, [getUserId, request, isFavorited]);

  // Check if user has already rated this service (from central Rating collection)
  const hasRated = request?._rated || ratingStatus.rated;
  const canRate = !isProvider && request?.status === 'completed' && !hasRated;

  useEffect(() => {
    if (request?._id && request?.status === 'completed' && !isProvider) {
      checkRatingStatus(request._id).then(setRatingStatus).catch(() => {});
    }
  }, [request?._id, request?.status, isProvider]);

  // Loading state
  if (loading) {
    const insets = useSafeAreaInsets();
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      </View>
    );
  }

  if (!request) {
    const insets = useSafeAreaInsets();
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Request Not Found</Text>
          <TouchableOpacity 
            style={styles.goBackButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  // Resolve service date across all service categories:
  // Traditional → serviceDate, Event → eventDate, Emergency → createdAt (immediate)
  const rawServiceDate = request.serviceDate || request.eventDate || request.assignedAt || request.createdAt;
  const serviceDate = rawServiceDate ? new Date(rawServiceDate) : null;
  const createdAt = request.createdAt ? new Date(request.createdAt) : null;
  const isActive = ['pending', 'accepted', 'in-progress'].includes(request.status);
  // Only show OTP for users (not providers) - providers should NOT see the OTP
  const showOtp = !isProvider && request.completionOtp && ['accepted', 'in-progress'].includes(request.status);
  // Only show cancel button for users (not providers)
  const canCancel = !isProvider && isActive;

  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Icon name="back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            colors={[BRAND.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Service Type Header — compact */}
        <View style={styles.serviceHeader}>
          <ServiceIcon serviceType={request.serviceType} size={32} />
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>
              {SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <Text style={styles.requestId}>#{request.requestId}</Text>
              {isEventService && (
                <View style={{ backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#7C3AED' }}>EVENT</Text>
                </View>
              )}
              {isEmergencyService && (
                <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#DC2626' }}>EMERGENCY</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: status.color, marginRight: 5 }} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Status Description — compact pill */}
        <View style={[styles.statusDescriptionBox, { backgroundColor: status.bgColor }]}>
          <Text style={[styles.statusDescription, { color: status.color }]}>
            {getStatusDescription(request.status, isProvider)}
          </Text>
        </View>

        {/* Location Map — ALWAYS show for providers on pending (before accept/reject) */}
        {isProvider && ['pending', 'awaiting_confirmation'].includes(request.status) && request.location?.address && (
          <LocationMapPreview 
            location={request.location}
            address={request.location.address}
          />
        )}

        {/* Accept / Reject Buttons — for providers on pending requests */}
        {isProvider && ['pending', 'awaiting_confirmation'].includes(request.status) && (
          <View style={styles.providerActionContainer}>
            <Text style={styles.providerActionTitle}>Respond to request</Text>
            <View style={styles.providerActionRow}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={handleRejectRequest}
                disabled={rejecting || accepting}
              >
                {rejecting ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <>
                    <Icon name="close" size={16} color="#DC2626" />
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={handleAcceptRequest}
                disabled={accepting || rejecting}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Cancel Button */}
        {canCancel && (
          <TouchableOpacity
            style={[
              styles.cancelButton,
              ['accepted', 'in-progress'].includes(request.status) && styles.cancelButtonWarning
            ]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <>
                <Icon name="close" size={15} color="#DC2626" />
                <Text style={styles.cancelButtonText}>
                  {['accepted', 'in-progress'].includes(request.status) 
                    ? 'Cancel (Provider notified)' 
                    : 'Cancel Request'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Status Timeline */}
        <StatusTimeline currentStatus={request.status} isProvider={isProvider} />

        {/* OTP Section (for accepted/in-progress) - User sees OTP to share */}
        {showOtp && (
          <OtpDisplay 
            otp={request.completionOtp}
            expiresAt={request.otpExpiresAt}
            onResend={handleResendOtp}
          />
        )}

        {/* Provider OTP Entry — compact */}
        {isProvider && ['accepted', 'in-progress'].includes(request.status) && (
          <View style={styles.providerOtpSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Icon name="lock" size={18} color="#8B5CF6" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#5B21B6' }}>Complete Service</Text>
            </View>
            <Text style={{ fontSize: 12, color: BRAND.textSecondary, marginBottom: 10, lineHeight: 16 }}>
              Enter the customer's 6-digit OTP to mark complete.
            </Text>
            <View style={styles.providerOtpInputRow}>
              <TextInput
                style={styles.providerOtpInput}
                value={enteredOtp}
                onChangeText={setEnteredOtp}
                placeholder="000000"
                placeholderTextColor="#D1D5DB"
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity 
                style={[styles.providerOtpButton, enteredOtp.length !== 6 && styles.providerOtpButtonDisabled]}
                onPress={handleVerifyOtp}
                disabled={enteredOtp.length !== 6 || verifyingOtp}
              >
                {verifyingOtp ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="check" size={15} color="#FFFFFF" />
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>Done</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Provider Card - Only show for users (not providers) */}
        {!isProvider && request.providerDetails && (
          <ProviderCard 
            provider={request.providerDetails}
            onCall={handleCall}
            showActions={['pending', 'accepted', 'in-progress'].includes(request.status)}
            onGetLocation={
              // Only show track location for traditional services (not event services)
              !request.isEventService && ['accepted', 'in-progress'].includes(request.status) 
                ? handleGetProviderLocation 
                : null
            }
          />
        )}

        {/* Customer Details — compact, for providers only */}
        {isProvider && request.userDetails && (
          <View style={styles.customerCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Customer</Text>
              {request.userDetails.isRepeatCustomer && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3E7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                  <Icon name="heart" size={10} color={BRAND.primary} />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: BRAND.primary }}>Repeat</Text>
                </View>
              )}
            </View>

            {/* Customer Profile — compact */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BRAND.border }}>
              {resolveProfilePic(request.userDetails.profilePicture) ? (
                <Image
                  source={{ uri: resolveProfilePic(request.userDetails.profilePicture) }}
                  style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: '#E5E7EB' }}
                />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.white }}>
                    {request.userDetails.name?.charAt(0).toUpperCase() || 'C'}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND.text }}>{request.userDetails.name || 'Customer'}</Text>
                  {request.userDetails.isVerified && (
                    <Icon name="verified" size={14} color={BRAND.success} />
                  )}
                </View>
                {request.userDetails.memberSince && (
                  <Text style={{ fontSize: 11, color: BRAND.textMuted, marginTop: 1 }}>Member since {request.userDetails.memberSince}</Text>
                )}
                {request.userDetails.previousServicesWithProvider > 0 && (
                  <Text style={{ fontSize: 11, color: BRAND.primary, fontWeight: '500', marginTop: 1 }}>
                    {request.userDetails.previousServicesWithProvider} previous service{request.userDetails.previousServicesWithProvider > 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            </View>

            {/* Contact Info — show for pending + active */}
            {['pending', 'awaiting_confirmation', 'accepted', 'in-progress'].includes(request.status) && (
              <View style={{ marginBottom: 10 }}>
                {request.userDetails.email && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 }}>
                    <Icon name="mail" size={13} color={BRAND.textMuted} />
                    <Text style={{ fontSize: 12, color: BRAND.text }}>{request.userDetails.email}</Text>
                  </View>
                )}
                {(request.userDetails.address || request.userDetails.city) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 }}>
                    <Icon name="location" size={13} color={BRAND.textMuted} />
                    <Text style={{ fontSize: 12, color: BRAND.text }}>
                      {[request.userDetails.address, request.userDetails.city].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Service Location — show for pending + active (key fix: show before accept) */}
            {request.location?.address && ['pending', 'awaiting_confirmation', 'accepted', 'in-progress'].includes(request.status) && (
              <View style={{ backgroundColor: '#FEF9F4', borderRadius: 8, padding: 8, marginBottom: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: BRAND.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Service Location</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <Icon name="pin" size={13} color={BRAND.primary} />
                  <Text style={{ flex: 1, fontSize: 12, color: BRAND.text, lineHeight: 17 }}>{request.location.address}</Text>
                </View>
              </View>
            )}

            {/* Call Button — for active requests */}
            {['pending', 'awaiting_confirmation', 'accepted', 'in-progress'].includes(request.status) && (
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: BRAND.success, borderRadius: 10, paddingVertical: 10 }}
                onPress={handleCall}
              >
                <Icon name="phone" size={15} color="#FFFFFF" />
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>Call Customer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Request Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Request Details</Text>
          
          {serviceDate && !isNaN(serviceDate.getTime()) && (
            <InfoRow 
              iconName="calendar" 
              label={isEmergencyService ? "Requested On" : "Service Date"}
              value={serviceDate.toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            />
          )}
          
          {createdAt && !isNaN(createdAt.getTime()) && (
            <InfoRow 
              iconName="clock" 
              label="Created On" 
              value={createdAt.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          )}

          {request.acceptedAt && (
            <InfoRow 
              iconName="check" 
              label="Accepted On" 
              value={new Date(request.acceptedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          )}

          {request.completedAt && (
            <InfoRow 
              iconName="celebration" 
              label="Completed On" 
              value={new Date(request.completedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          )}

          {request.description && (
            <InfoRow 
              iconName="description" 
              label="Description" 
              value={request.description}
            />
          )}

          {/* Event-specific fields */}
          {isEventService && request.venue && (
            <InfoRow 
              iconName="place" 
              label="Venue" 
              value={request.venue}
            />
          )}

          {isEventService && request.budget && (
            <InfoRow 
              iconName="currency-rupee" 
              label="Budget" 
              value={`₹${Number(request.budget).toLocaleString()}`}
            />
          )}

          {isEventService && request.additionalRequirements && (
            <InfoRow 
              iconName="checklist" 
              label="Additional Requirements" 
              value={request.additionalRequirements}
            />
          )}

          {/* Emergency-specific fields */}
          {isEmergencyService && request.urgencyLevel && (
            <InfoRow 
              iconName="warning" 
              label="Urgency Level" 
              value={request.urgencyLevel.charAt(0).toUpperCase() + request.urgencyLevel.slice(1)}
            />
          )}
        </View>

        {/* Location with Map Preview — show for ALL statuses (not just active) */}
        {request.location?.address && (
          <LocationMapPreview 
            location={request.location}
            address={request.location.address}
          />
        )}

        {/* Pricing (if available) */}
        {(request.pricing?.estimatedCost || request.pricing?.actualCost) && (
          <View style={styles.pricingCard}>
            <Text style={styles.sectionTitle}>Pricing</Text>
            {request.pricing.estimatedCost && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Estimated Cost</Text>
                <Text style={styles.priceValue}>
                  ₹{request.pricing.estimatedCost.toLocaleString()}
                </Text>
              </View>
            )}
            {request.pricing.actualCost && (
              <View style={[styles.priceRow, styles.priceRowFinal]}>
                <Text style={styles.priceLabelFinal}>Final Amount</Text>
                <Text style={styles.priceValueFinal}>
                  ₹{request.pricing.actualCost.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Completed Badge — compact */}
        {request.status === 'completed' && (
          <View style={styles.completedBanner}>
            <Icon name="celebration" size={24} color="#10B981" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#065F46', marginTop: 6 }}>Service Completed!</Text>
            <Text style={{ fontSize: 12, color: '#047857', textAlign: 'center', marginTop: 4 }}>
              Thank you for using FixHomi.
            </Text>
          </View>
        )}

        {/* Rating Section — compact */}
        {request.status === 'completed' && !isProvider && (
          <View style={styles.ratingSection}>
            {hasRated ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Icon name="star" size={18} color="#F59E0B" />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: BRAND.text }}>You rated this provider</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 3, marginBottom: 8 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Icon key={star} name="star" size={22} color={star <= (ratingStatus.rating?.rating || 0) ? '#F59E0B' : '#E5E7EB'} />
                  ))}
                </View>
                {ratingStatus.rating?.review ? (
                  <Text style={{ fontSize: 12, color: BRAND.textSecondary, fontStyle: 'italic', textAlign: 'center' }}>"{ratingStatus.rating.review}"</Text>
                ) : null}
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: BRAND.text, marginBottom: 3 }}>How was your experience?</Text>
                <Text style={{ fontSize: 12, color: BRAND.textSecondary, marginBottom: 12 }}>Help others by rating this provider</Text>
                <TouchableOpacity
                  style={styles.rateButton}
                  onPress={() => setRatingModalVisible(true)}
                >
                  <Icon name="star" size={16} color="#FFFFFF" />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>Rate Provider</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Favorites — compact */}
        {request.status === 'completed' && !isProvider && (request?.providerId || request?.assignedProviderDetails?._id) && (
          <TouchableOpacity
            style={[styles.favoriteButton, isFavorited && styles.favoriteButtonActive]}
            onPress={handleToggleFavorite}
            disabled={togglingFavorite}
          >
            {togglingFavorite ? (
              <ActivityIndicator color={isFavorited ? '#DC2626' : '#F59E0B'} size="small" />
            ) : (
              <>
                <Icon name={isFavorited ? 'favorite' : 'favorite-border'} size={16} color={isFavorited ? '#DC2626' : '#F59E0B'} />
                <Text style={[styles.favoriteButtonText, isFavorited && styles.favoriteButtonTextActive]}>
                  {isFavorited ? 'Remove Favorite' : 'Add to Favorites'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Help — compact */}
        <View style={styles.helpSection}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: BRAND.text, marginBottom: 4 }}>Need Help?</Text>
          <Text style={{ fontSize: 11, color: BRAND.textSecondary, textAlign: 'center', marginBottom: 8 }}>
            Contact support for any issues.
          </Text>
          <TouchableOpacity style={styles.helpButton}>
            <Icon name="email" size={14} color={BRAND.secondary} />
            <Text style={{ fontSize: 12, color: BRAND.secondary, fontWeight: '500' }}>Contact Support</Text>
          </TouchableOpacity>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: BRAND.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.text,
    marginTop: 10,
    marginBottom: 12,
  },
  goBackButton: {
    backgroundColor: BRAND.secondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },

  // Header — compact
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: BRAND.primary,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
  },

  // Service Header — compact
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  serviceInfo: {
    flex: 1,
    marginLeft: 10,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.text,
  },
  requestId: {
    fontSize: 11,
    color: BRAND.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Status Description — compact
  statusDescriptionBox: {
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  statusDescription: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Timeline — compact
  timelineContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  timelineTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  timelineStep: {
    alignItems: 'center',
    flex: 1,
  },
  timelineConnector: {
    position: 'absolute',
    top: 12,
    left: -28,
    right: '50%',
    height: 2,
    backgroundColor: BRAND.border,
    zIndex: -1,
  },
  timelineConnectorActive: {
    backgroundColor: BRAND.success,
  },
  timelineCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BRAND.border,
  },
  timelineCircleActive: {
    backgroundColor: '#D1FAE5',
    borderColor: BRAND.success,
  },
  timelineCircleCurrent: {
    backgroundColor: BRAND.secondary,
    borderColor: BRAND.secondary,
  },
  timelineNumber: {
    fontSize: 11,
    color: BRAND.textMuted,
    fontWeight: '600',
  },
  timelineNumberActive: {
    color: BRAND.white,
  },
  timelineLabel: {
    marginTop: 4,
    fontSize: 10,
    color: BRAND.textMuted,
    textAlign: 'center',
  },
  timelineLabelActive: {
    color: BRAND.text,
    fontWeight: '500',
  },

  // OTP Display — compact
  otpDisplayContainer: {
    backgroundColor: BRAND.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: BRAND.secondary,
  },
  otpCodeBox: {
    backgroundColor: BRAND.secondary + '10',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  otpCode: {
    fontSize: 26,
    fontWeight: '700',
    color: BRAND.secondary,
    letterSpacing: 6,
    marginBottom: 4,
  },
  otpExpiredContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  resendButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },

  // Provider Card — compact
  providerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  providerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    borderWidth: 1.5,
    borderColor: BRAND.secondary + '30',
  },
  providerVerifiedBadge: {
    position: 'absolute',
    bottom: -1,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BRAND.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: BRAND.success,
    borderRadius: 8,
    paddingVertical: 9,
  },
  locationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: BRAND.secondary,
    borderRadius: 8,
    paddingVertical: 9,
  },

  // Details Card — compact
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    gap: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: BRAND.textMuted,
    marginRight: 6,
    minWidth: 70,
  },
  infoValue: {
    flex: 1,
    fontSize: 12,
    color: BRAND.text,
    fontWeight: '500',
  },

  // Location Card — compact
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  mapPreviewContainer: {
    height: 130,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  mapPreview: {
    flex: 1,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  mapPinContainer: {
    alignItems: 'center',
  },
  mapPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  mapPinShadow: {
    width: 10,
    height: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginTop: 1,
  },
  mapPreviewHint: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },

  // Fullscreen Map Modal
  fullMapContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fullMap: {
    flex: 1,
  },
  fullMapPinContainer: {
    alignItems: 'center',
  },
  fullMapPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  fullMapPinShadow: {
    width: 14,
    height: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop: 3,
  },
  fullMapTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  fullMapCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullMapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.text,
  },
  fullMapBottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  fullMapAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  fullMapAddress: {
    flex: 1,
    fontSize: 14,
    color: BRAND.text,
    lineHeight: 20,
  },
  fullMapDirectionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.secondary,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  fullMapDirectionsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Pricing — compact
  pricingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  priceLabel: {
    fontSize: 13,
    color: BRAND.textSecondary,
  },
  priceValue: {
    fontSize: 13,
    color: BRAND.text,
    fontWeight: '500',
  },
  priceRowFinal: {
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    marginTop: 6,
    paddingTop: 8,
  },
  priceLabelFinal: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.text,
  },
  priceValueFinal: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.success,
  },

  // Completed Banner — compact
  completedBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },

  // Rating — compact
  ratingSection: {
    backgroundColor: BRAND.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },

  // Favorites — compact
  favoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  favoriteButtonActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  favoriteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  favoriteButtonTextActive: {
    color: '#DC2626',
  },

  // Cancel — compact
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cancelButtonWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: BRAND.primary,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.danger,
  },

  // Provider Accept/Reject — compact
  providerActionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: BRAND.primary + '40',
    shadowColor: BRAND.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  providerActionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  providerActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  acceptButton: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: BRAND.success,
    borderRadius: 10,
    paddingVertical: 11,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Customer Card — compact
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // Help — compact
  helpSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },

  // Directions Button
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: BRAND.secondary,
    borderRadius: 10,
    padding: 10,
  },
  directionsButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Provider OTP Entry — compact
  providerOtpSection: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  providerOtpInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  providerOtpInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 4,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    textAlign: 'center',
  },
  providerOtpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  providerOtpButtonDisabled: {
    backgroundColor: '#C4B5FD',
  },
});

export default ServiceRequestDetailScreen;
