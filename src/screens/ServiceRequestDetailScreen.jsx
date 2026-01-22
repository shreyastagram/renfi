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
 * @version 1.0.0
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Icon, ServiceIcon, StatusIcon } from '../components';
import Mapbox from '@rnmapbox/maps';

// Initialize Mapbox
Mapbox.setAccessToken('MAPBOX_TOKEN_REMOVED');
import { 
  getRequestDetails,
  cancelRequest,
  resendCompletionOtp,
  verifyCompletionOtp,
  SERVICE_TYPE_LABELS,
} from '../services/traditionalServiceService';

// Brand colors
const BRAND = {
  primary: '#f67c16', // Orange
  secondary: '#2b76bc', // Blue
  background: '#faf7f7',
  white: '#FFFFFF',
  neutral: '#6B7280',
  success: '#10B981',
  danger: '#EF4444',
};

// Status configuration - unified brand palette
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: BRAND.primary,
    bgColor: '#FEF3C7',
    iconName: 'clock',
    description: 'Waiting for a provider to accept your request',
    step: 1,
  },
  accepted: {
    label: 'Accepted',
    color: BRAND.secondary,
    bgColor: '#DBEAFE',
    iconName: 'check',
    description: 'A provider has accepted your request',
    step: 2,
  },
  'in-progress': {
    label: 'In Progress',
    color: BRAND.secondary,
    bgColor: '#DBEAFE',
    iconName: 'wrench',
    description: 'The service is currently being performed',
    step: 3,
  },
  completed: {
    label: 'Completed',
    color: BRAND.success,
    bgColor: '#D1FAE5',
    iconName: 'check-circle',
    description: 'The service has been successfully completed',
    step: 4,
  },
  cancelled: {
    label: 'Cancelled',
    color: BRAND.danger,
    bgColor: '#FEE2E2',
    iconName: 'close',
    description: 'This request was cancelled',
    step: 0,
  },
  rejected: {
    label: 'Rejected',
    color: BRAND.neutral,
    bgColor: '#F3F4F6',
    iconName: 'block',
    description: 'No providers were available for this request',
    step: 0,
  },
};

/**
 * Status Timeline Component
 */
const StatusTimeline = ({ currentStatus }) => {
  const status = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pending;
  const isCancelled = currentStatus === 'cancelled' || currentStatus === 'rejected';
  
  const steps = [
    { key: 'pending', label: 'Created', step: 1 },
    { key: 'accepted', label: 'Accepted', step: 2 },
    { key: 'in-progress', label: 'In Progress', step: 3 },
    { key: 'completed', label: 'Completed', step: 4 },
  ];

  if (isCancelled) {
    return (
      <View style={styles.timelineContainer}>
        <View style={styles.cancelledTimeline}>
          <StatusIcon status={currentStatus} size={24} />
          <Text style={styles.cancelledText}>{status.description}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.timelineContainer}>
      <Text style={styles.timelineTitle}>Request Progress</Text>
      <View style={styles.timeline}>
        {steps.map((step, index) => {
          const isActive = status.step >= step.step;
          const isCurrent = status.step === step.step;
          const isCompleted = status.step > step.step;
          
          return (
            <View key={step.key} style={styles.timelineStep}>
              {/* Connector Line */}
              {index > 0 && (
                <View style={[
                  styles.timelineConnector,
                  isActive && styles.timelineConnectorActive,
                ]} />
              )}
              
              {/* Step Circle */}
              <View style={[
                styles.timelineCircle,
                isActive && styles.timelineCircleActive,
                isCurrent && styles.timelineCircleCurrent,
              ]}>
                {isCompleted ? (
                  <Icon name="check" size={16} color={BRAND.white} />
                ) : (
                  <Text style={[
                    styles.timelineNumber,
                    isActive && styles.timelineNumberActive,
                  ]}>
                    {step.step}
                  </Text>
                )}
              </View>
              
              {/* Step Label */}
              <Text style={[
                styles.timelineLabel,
                isActive && styles.timelineLabelActive,
              ]}>
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
 * Info Row Component
 */
const InfoRow = ({ label, value, iconName }) => (
  <View style={styles.infoRow}>
    <Icon name={iconName} size={18} color="#6B7280" />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

/**
 * OTP Display Component
 */
const OtpDisplay = ({ otp, expiresAt, onResend }) => {
  const [copied, setCopied] = useState(false);
  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  const handleCopy = () => {
    if (otp) {
      // Show the OTP in an alert for easy copying
      Alert.alert(
        'Completion OTP',
        `Your OTP is: ${otp}\n\nShare this with your service provider to mark the service as complete.`,
        [{ text: 'OK' }]
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isExpired) {
    return (
      <View style={styles.otpExpiredContainer}>
        <Icon name="clock" size={32} color="#F59E0B" />
        <Text style={styles.otpExpiredTitle}>OTP Expired</Text>
        <Text style={styles.otpExpiredText}>
          The completion OTP has expired. Request a new one to complete the service.
        </Text>
        <TouchableOpacity style={styles.resendButton} onPress={onResend}>
          <Text style={styles.resendButtonText}>Request New OTP</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.otpDisplayContainer}>
      <View style={styles.otpHeader}>
        <View style={styles.otpTitleRow}>
          <Icon name="lock" size={20} color={BRAND.secondary} />
          <Text style={styles.otpTitle}>Completion OTP</Text>
        </View>
        <Text style={styles.otpSubtitle}>Share this code with your provider</Text>
      </View>
      
      <TouchableOpacity style={styles.otpCodeBox} onPress={handleCopy} activeOpacity={0.7}>
        <Text style={styles.otpCode}>{otp}</Text>
        <View style={styles.otpCopyBadge}>
          <Icon name={copied ? 'check' : 'copy'} size={14} color={copied ? BRAND.success : BRAND.neutral} />
          <Text style={[styles.otpCopyText, copied && { color: BRAND.success }]}>
            {copied ? 'Copied!' : 'Tap to copy'}
          </Text>
        </View>
      </TouchableOpacity>

      {expiresAt && (
        <View style={styles.otpExpiryContainer}>
          <Icon name="timer" size={16} color="#6B7280" />
          <Text style={styles.otpExpiryText}>
            Expires at {new Date(expiresAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      )}

      <View style={styles.otpInfoBox}>
        <Icon name="info" size={18} color="#3B82F6" />
        <Text style={styles.otpInfoText}>
          The provider will enter this OTP to mark the service as complete. 
          Only share it after the work is satisfactorily done.
        </Text>
      </View>
    </View>
  );
};

/**
 * Provider Card Component
 */
const ProviderCard = ({ provider, onCall, onGetLocation }) => {
  if (!provider) return null;

  return (
    <View style={styles.providerCard}>
      <Text style={styles.sectionTitle}>Your Provider</Text>
      
      <View style={styles.providerContent}>
        <View style={styles.providerAvatar}>
          <Text style={styles.providerInitial}>
            {provider.name?.charAt(0).toUpperCase() || 'P'}
          </Text>
        </View>
        
        <View style={styles.providerInfo}>
          <Text style={styles.providerName}>{provider.name}</Text>
          {provider.rating > 0 && (
            <View style={styles.providerRating}>
              <Icon name="star" size={14} color="#F59E0B" />
              <Text style={styles.providerRatingText}>{provider.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.providerActionsRow}>
        {provider.phone && (
          <TouchableOpacity 
            style={styles.callButton}
            onPress={() => onCall(provider.phone)}
          >
            <Icon name="phone" size={18} color="#FFFFFF" />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        )}
        
        {onGetLocation && (
          <TouchableOpacity 
            style={styles.locationButton}
            onPress={onGetLocation}
          >
            <Icon name="location" size={18} color="#FFFFFF" />
            <Text style={styles.locationButtonText}>Track Location</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/**
 * Location Map Preview Component
 * Shows an interactive mini-map with the service location pinned
 */
const LocationMapPreview = ({ location, address }) => {
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  
  // Check if we have valid coordinates
  const hasCoordinates = location?.coordinates && 
    Array.isArray(location.coordinates) && 
    location.coordinates.length === 2;
  
  if (!hasCoordinates) {
    // Fallback to address-only display if no coordinates
    return (
      <View style={styles.locationCard}>
        <Text style={styles.sectionTitle}>Service Location</Text>
        <View style={styles.locationContent}>
          <Icon name="location" size={20} color="#EF4444" />
          <Text style={styles.locationAddress}>{address}</Text>
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
        <View style={styles.locationCardHeader}>
          <Text style={styles.sectionTitle}>Service Location</Text>
          <TouchableOpacity 
            style={styles.expandMapButton}
            onPress={() => setMapExpanded(true)}
          >
            <Icon name="zoom-in" size={16} color={BRAND.secondary} />
            <Text style={styles.expandMapText}>Expand</Text>
          </TouchableOpacity>
        </View>
        
        {/* Mini Map Preview */}
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
            <Mapbox.Camera
              centerCoordinate={[lng, lat]}
              zoomLevel={15}
              animationDuration={0}
            />
            {/* Location Pin */}
            <Mapbox.PointAnnotation
              id="service-location"
              coordinate={[lng, lat]}
            >
              <View style={styles.mapPinContainer}>
                <View style={styles.mapPin}>
                  <Icon name="location" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.mapPinShadow} />
              </View>
            </Mapbox.PointAnnotation>
          </Mapbox.MapView>
          
          {/* Overlay hint */}
          <View style={styles.mapPreviewHint}>
            <Icon name="touch" size={14} color="#FFFFFF" />
            <Text style={styles.mapPreviewHintText}>Tap to view full map</Text>
          </View>
        </TouchableOpacity>

        {/* Address */}
        <View style={styles.locationContent}>
          <Icon name="location" size={18} color="#EF4444" />
          <Text style={styles.locationAddress}>{address}</Text>
        </View>
        
        {/* Get Directions Button */}
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
  
  // State
  const [request, setRequest] = useState(initialRequest);
  const [loading, setLoading] = useState(!initialRequest);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
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
   * Fetch request details
   */
  const fetchDetails = useCallback(async () => {
    // Use requestId from route params (could be TRD-xxx format or MongoDB _id)
    const lookupId = route.params?.requestId || request?._id || request?.requestId;
    
    if (!lookupId) return;

    try {
      const result = await getRequestDetails(lookupId);
      
      if (result.success) {
        setRequest(result.request);
      } else {
        console.error('[RequestDetail] Fetch failed:', result.error);
      }
    } catch (error) {
      console.error('[RequestDetail] Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [request?._id, request?.requestId, route.params?.requestId]);

  // Initial fetch if needed
  useEffect(() => {
    if (!initialRequest || !initialRequest.providerDetails) {
      fetchDetails();
    }
  }, []);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDetails();
  }, [fetchDetails]);

  /**
   * Handle cancel request
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
            const result = await cancelRequest(request._id, userId, 'Cancelled by user');
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
          },
        },
      ]
    );
  }, [request, getUserId, navigation]);

  /**
   * Handle phone call (works for both provider calling customer and vice versa)
   */
  const handleCall = useCallback((phone) => {
    const phoneUrl = `tel:${phone}`;
    Linking.canOpenURL(phoneUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(phoneUrl);
        } else {
          Alert.alert('Error', 'Unable to make phone call');
        }
      })
      .catch((err) => console.error('Call error:', err));
  }, []);

  /**
   * Handle get provider location - navigates to live tracking screen
   */
  const handleGetProviderLocation = useCallback(() => {
    const provider = request?.providerDetails;
    
    if (!provider) {
      Alert.alert('Location Not Available', 'Provider information is not available at the moment.');
      return;
    }

    // Navigate to LiveTrackingScreen
    navigation.navigate('LiveTracking', {
      requestId: request._id,
      providerId: provider._id || provider.providerId,
      providerName: provider.name,
      serviceCategory: request.serviceCategory || request.category,
    });
  }, [request, navigation]);

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
      const result = await verifyCompletionOtp(request._id, enteredOtp);
      
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
  }, [request?._id, enteredOtp, handleRefresh]);

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
  const serviceDate = new Date(request.serviceDate);
  const createdAt = new Date(request.createdAt);
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
          <Icon name="back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            colors={['#2563EB']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Service Type Header */}
        <View style={styles.serviceHeader}>
          <ServiceIcon serviceType={request.serviceType} size={40} />
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>
              {SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}
            </Text>
            <Text style={styles.requestId}>#{request.requestId}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <StatusIcon status={request.status} size={16} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Status Description */}
        <View style={[styles.statusDescriptionBox, { backgroundColor: status.bgColor }]}>
          <Text style={[styles.statusDescription, { color: status.color }]}>
            {status.description}
          </Text>
        </View>

        {/* Status Timeline */}
        <StatusTimeline currentStatus={request.status} />

        {/* OTP Section (for accepted/in-progress) - User sees OTP to share */}
        {showOtp && (
          <OtpDisplay 
            otp={request.completionOtp}
            expiresAt={request.otpExpiresAt}
            onResend={handleResendOtp}
          />
        )}

        {/* Provider OTP Entry Section - Provider enters OTP to complete */}
        {isProvider && ['accepted', 'in-progress'].includes(request.status) && (
          <View style={styles.providerOtpSection}>
            <View style={styles.providerOtpHeader}>
              <Icon name="lock" size={24} color="#8B5CF6" />
              <Text style={styles.providerOtpTitle}>Complete Service</Text>
            </View>
            <Text style={styles.providerOtpHint}>
              Ask the customer for their completion OTP and enter it below to mark the service as complete.
            </Text>
            <View style={styles.providerOtpInputRow}>
              <TextInput
                style={styles.providerOtpInput}
                value={enteredOtp}
                onChangeText={setEnteredOtp}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity 
                style={[
                  styles.providerOtpButton,
                  enteredOtp.length !== 6 && styles.providerOtpButtonDisabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={enteredOtp.length !== 6 || verifyingOtp}
              >
                {verifyingOtp ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.providerOtpButtonText}>Complete</Text>
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
            onGetLocation={['accepted', 'in-progress'].includes(request.status) ? handleGetProviderLocation : null}
          />
        )}

        {/* User/Customer Details - Only show for providers */}
        {isProvider && request.userDetails && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Customer Details</Text>
            <View style={styles.customerInfoRow}>
              <View style={styles.customerAvatar}>
                <Text style={styles.customerInitial}>
                  {request.userDetails.name?.charAt(0).toUpperCase() || 'C'}
                </Text>
              </View>
              <View style={styles.customerDetails}>
                <Text style={styles.customerName}>{request.userDetails.name || 'Customer'}</Text>
                {request.userDetails.email && (
                  <Text style={styles.customerEmail}>{request.userDetails.email}</Text>
                )}
              </View>
            </View>
            {request.userDetails.phone && (
              <TouchableOpacity 
                style={styles.callCustomerButton}
                onPress={() => handleCall(request.userDetails.phone)}
              >
                <Icon name="phone" size={18} color="#FFFFFF" />
                <Text style={styles.callCustomerButtonText}>Call Customer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Request Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Request Details</Text>
          
          <InfoRow 
            iconName="calendar" 
            label="Service Date" 
            value={serviceDate.toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          />
          
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
        </View>

        {/* Location with Map Preview */}
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

        {/* Completed Badge */}
        {request.status === 'completed' && (
          <View style={styles.completedBanner}>
            <Icon name="celebration" size={32} color="#10B981" />
            <Text style={styles.completedBannerTitle}>Service Completed!</Text>
            <Text style={styles.completedBannerText}>
              Thank you for using FixHomi. We hope you had a great experience!
            </Text>
          </View>
        )}

        {/* Action Buttons - Allow cancel for users only (not providers) */}
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
                <Icon name="close" size={18} color="#DC2626" />
                <Text style={styles.cancelButtonText}>
                  {['accepted', 'in-progress'].includes(request.status) 
                    ? 'Cancel (Provider will be notified)' 
                    : 'Cancel Request'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpText}>
            Contact our support team for any issues with your service request.
          </Text>
          <TouchableOpacity style={styles.helpButton}>
            <Icon name="email" size={18} color="#2563EB" />
            <Text style={styles.helpButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  goBackButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#111827',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },

  // Service Header
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  serviceIcon: {
    fontSize: 40,
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  requestId: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Status Description
  statusDescriptionBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statusDescription: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Timeline
  timelineContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 16,
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
    top: 16,
    left: -30,
    right: '50%',
    height: 2,
    backgroundColor: '#E5E7EB',
    zIndex: -1,
  },
  timelineConnectorActive: {
    backgroundColor: BRAND.success,
  },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  timelineCircleActive: {
    backgroundColor: '#D1FAE5',
    borderColor: BRAND.success,
  },
  timelineCircleCurrent: {
    backgroundColor: BRAND.secondary,
    borderColor: BRAND.secondary,
  },
  timelineCheck: {
    fontSize: 14,
    color: BRAND.success,
    fontWeight: '700',
  },
  timelineNumber: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  timelineNumberActive: {
    color: BRAND.white,
  },
  timelineLabel: {
    marginTop: 8,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  timelineLabelActive: {
    color: '#374151',
    fontWeight: '500',
  },
  cancelledTimeline: {
    alignItems: 'center',
    padding: 16,
  },
  cancelledIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  cancelledText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },

  // OTP Display
  otpDisplayContainer: {
    backgroundColor: BRAND.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: BRAND.secondary,
  },
  otpHeader: {
    marginBottom: 12,
  },
  otpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.secondary,
    marginBottom: 4,
  },
  otpSubtitle: {
    fontSize: 13,
    color: BRAND.neutral,
  },
  otpCodeBox: {
    backgroundColor: BRAND.secondary + '10',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  otpCode: {
    fontSize: 32,
    fontWeight: '700',
    color: BRAND.secondary,
    letterSpacing: 8,
    marginBottom: 8,
  },
  otpCopyBadge: {
    backgroundColor: BRAND.secondary + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  otpCopyText: {
    fontSize: 12,
    color: BRAND.secondary,
    fontWeight: '500',
  },
  otpExpiryContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  otpExpiryIcon: {
    marginRight: 6,
  },
  otpExpiryText: {
    fontSize: 13,
    color: '#6B7280',
  },
  otpInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
  },
  otpInfoIcon: {
    marginRight: 8,
  },
  otpInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  otpExpiredContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  otpExpiredIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  otpExpiredTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 8,
  },
  otpExpiredText: {
    fontSize: 13,
    color: '#7F1D1D',
    textAlign: 'center',
    marginBottom: 16,
  },
  resendButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  resendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Provider Card
  providerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  providerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: BRAND.white,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  providerRating: {
    marginTop: 4,
  },
  providerRatingText: {
    fontSize: 13,
    color: BRAND.primary,
  },
  providerActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: BRAND.success,
    borderRadius: 8,
    padding: 12,
  },
  callButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  callButtonText: {
    color: BRAND.white,
    fontWeight: '600',
    fontSize: 14,
  },
  locationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: BRAND.secondary,
    borderRadius: 8,
    padding: 12,
  },
  locationButtonText: {
    color: BRAND.white,
    fontWeight: '600',
    fontSize: 14,
  },

  // Details Card
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoIcon: {
    fontSize: 18,
    marginRight: 12,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },

  // Location Card
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  locationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  expandMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    gap: 4,
  },
  expandMapText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.secondary,
  },
  mapPreviewContainer: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  mapPinShadow: {
    width: 12,
    height: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop: 2,
  },
  mapPreviewHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  mapPreviewHintText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  locationAddress: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    marginLeft: 8,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fullMapPinShadow: {
    width: 16,
    height: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginTop: 4,
  },
  fullMapTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  fullMapCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullMapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  fullMapBottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingBottom: 36,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  fullMapAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 10,
  },
  fullMapAddress: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  fullMapDirectionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  fullMapDirectionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Pricing Card
  pricingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  priceRowFinal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 12,
  },
  priceLabelFinal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  priceValueFinal: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND.success,
  },

  // Completed Banner
  completedBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  completedBannerIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  completedBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 8,
  },
  completedBannerText: {
    fontSize: 14,
    color: '#047857',
    textAlign: 'center',
  },

  // Cancel Button
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cancelButtonWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: BRAND.primary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND.danger,
  },

  // Customer Details (for provider view)
  customerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: BRAND.white,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  customerEmail: {
    fontSize: 14,
    color: BRAND.neutral,
    marginTop: 2,
  },
  callCustomerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND.success,
    borderRadius: 12,
    paddingVertical: 12,
  },
  callCustomerButtonText: {
    color: BRAND.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // Help Section
  helpSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  helpButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  helpButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  // Directions Button
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  directionsButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  directionsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // OTP styles
  otpTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otpCopyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Provider rating styles
  providerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },

  // Provider OTP Entry Styles
  providerOtpSection: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  providerOtpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  providerOtpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B21B6',
  },
  providerOtpHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  providerOtpInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerOtpInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
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
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  providerOtpButtonDisabled: {
    backgroundColor: '#C4B5FD',
  },
  providerOtpButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ServiceRequestDetailScreen;
