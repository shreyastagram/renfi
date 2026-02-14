/**
 * Provider Jobs Screen (Unified)
 * 
 * Combines Incoming Requests and Service History into one screen
 * with tab navigation for better UX.
 * 
 * Tabs:
 * - Requests: Incoming pending requests to accept
 * - Active: Currently accepted/in-progress jobs
 * - History: Completed and cancelled jobs
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Animated,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { initiateCall } from '../services/callService';

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
  background: '#faf7f7',
  white: '#FFFFFF',
};

// Status colors - unified brand palette
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: BRAND.primary, bgColor: '#FFF7ED', iconName: 'clock' },
  awaiting_confirmation: { label: 'Awaiting Your Confirmation', color: BRAND.primary, bgColor: '#FFF7ED', iconName: 'clock' },
  accepted: { label: 'Accepted', color: BRAND.secondary, bgColor: '#EFF6FF', iconName: 'check' },
  'in-progress': { label: 'In Progress', color: BRAND.secondary, bgColor: '#EFF6FF', iconName: 'wrench' },
  in_transit: { label: 'On The Way', color: BRAND.secondary, bgColor: '#EFF6FF', iconName: 'truck-fast' },
  arrived: { label: 'Arrived', color: BRAND.secondary, bgColor: '#EFF6FF', iconName: 'map-marker-check' },
  completed: { label: 'Completed', color: BRAND.secondary, bgColor: '#EFF6FF', iconName: 'check-circle' },
  cancelled: { label: 'Cancelled', color: '#6B7280', bgColor: '#F5F5F7', iconName: 'close' },
  rejected: { label: 'Rejected', color: '#EF4444', bgColor: '#FEE2E2', iconName: 'close-circle' },
  expired: { label: 'Expired', color: '#6B7280', bgColor: '#F5F5F7', iconName: 'clock' },
};

/**
 * Stats Card Component - Brand themed
 */
const StatsCard = ({ iconName, value, label, color, bgColor }) => (
  <View style={[styles.statsCard, { backgroundColor: bgColor }]}>
    <Icon name={iconName} size={18} color={color} />
    <Text style={[styles.statsValue, { color }]}>{value}</Text>
    <Text style={styles.statsLabel}>{label}</Text>
  </View>
);

/**
 * Tab Bar Component - Sleek compact design
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
            <Icon name={tab.icon} size={16} color={isActive ? BRAND.white : '#6B7280'} />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.badge && badgeCount > 0 && (
              <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
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
 * Job Card Component
 */
const JobCard = ({ job, onAccept, onReject, onComplete, onCancel, onCall, onDirections, onViewDetails, isAccepting, isRejecting }) => {
  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const serviceDate = new Date(job.serviceDate || job.createdAt);
  // Show accept/reject for both 'pending' (traditional) and 'awaiting_confirmation' (emergency assigned)
  const isPending = job.status === 'pending' || job.status === 'awaiting_confirmation';
  const isActive = ['accepted', 'in-progress'].includes(job.status);
  
  return (
    <TouchableOpacity 
      style={styles.jobCard} 
      onPress={() => onViewDetails(job)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.serviceTypeContainer}>
          <ServiceIcon serviceType={job.serviceType} size={32} />
          <View style={styles.serviceTypeInfo}>
            <Text style={styles.serviceType}>
              {SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType}
            </Text>
            <Text style={styles.requestId}>#{job.requestId}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
          <StatusIcon status={job.status} size={14} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Customer Info */}
      {job.userDetails && (
        <View style={styles.customerSection}>
          <View style={styles.customerInfo}>
            {job.userDetails.profilePicture?.url ? (
              <Image 
                source={{ uri: job.userDetails.profilePicture.url }} 
                style={styles.customerAvatarImage} 
              />
            ) : (
              <View style={styles.customerAvatar}>
                <Text style={styles.customerInitial}>
                  {job.userDetails.name?.charAt(0).toUpperCase() || 'C'}
                </Text>
              </View>
            )}
            <View style={styles.customerDetails}>
              <Text style={styles.customerName}>{job.userDetails.name || 'Customer'}</Text>
              {job.userDetails.phone && (
                <Text style={styles.customerPhone}>{job.userDetails.phone}</Text>
              )}
            </View>
            {/* Distance Badge */}
            {job.distanceToService && (
              <View style={styles.distanceBadge}>
                <Icon name="location" size={12} color="#2563EB" />
                <Text style={styles.distanceText}>{job.distanceToService.formatted}</Text>
              </View>
            )}
          </View>
          
          {/* Quick Actions */}
          {(isActive || job.status === 'completed') && (
            <View style={styles.quickActions}>
              {job.userDetails && (
                <TouchableOpacity
                  style={styles.quickActionBtn}
                  onPress={() => onCall(job)}
                >
                  <Icon name="phone" size={18} color="#10B981" />
                </TouchableOpacity>
              )}
              {job.location?.coordinates && (
                <TouchableOpacity
                  style={styles.quickActionBtn}
                  onPress={() => onDirections(job)}
                >
                  <Icon name="directions" size={18} color="#3B82F6" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Location */}
      {(job.serviceAddress || job.location?.address || job.location?.latitude) && (
        <View style={styles.locationRow}>
          <Icon name="location" size={16} color="#EF4444" />
          <Text style={styles.locationText} numberOfLines={2}>
            {job.serviceAddress || job.location?.address || 
              (job.location?.latitude ? `📍 ${job.location.latitude.toFixed(4)}, ${job.location.longitude.toFixed(4)}` : 'Location available')}
          </Text>
          {/* Show directions button for emergency services with coordinates */}
          {job.isEmergencyService && job.location?.latitude && (
            <TouchableOpacity 
              style={styles.directionsButton}
              onPress={() => onDirections(job)}
            >
              <Icon name="directions" size={16} color="#3B82F6" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Date & Distance */}
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Icon name="calendar" size={14} color="#6B7280" />
          <Text style={styles.infoText}>
            {serviceDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        {job.distance && (
          <View style={styles.infoItem}>
            <Icon name="location" size={14} color="#6B7280" />
            <Text style={styles.infoText}>{(job.distance / 1000).toFixed(1)} km</Text>
          </View>
        )}
      </View>

      {/* Description */}
      {job.description && (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionLabel}>Notes:</Text>
          <Text style={styles.descriptionText} numberOfLines={2}>{job.description}</Text>
        </View>
      )}

      {/* Actions based on status */}
      {isPending && (
        <View style={styles.pendingActions}>
          <TouchableOpacity
            style={[styles.rejectBtn, isRejecting && styles.rejectBtnDisabled]}
            onPress={() => onReject(job)}
            disabled={isRejecting || isAccepting}
          >
            {isRejecting ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <>
                <Icon name="close" size={18} color="#EF4444" />
                <Text style={styles.rejectBtnText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, isAccepting && styles.acceptBtnDisabled]}
            onPress={() => onAccept(job)}
            disabled={isAccepting || isRejecting}
          >
            {isAccepting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Icon name="check" size={18} color="#fff" />
                <Text style={styles.acceptBtnText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isActive && (
        <View style={styles.activeActions}>
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={() => onComplete(job)}
          >
            <Icon name="check-circle" size={18} color="#fff" />
            <Text style={styles.completeBtnText}>Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onCancel(job)}
          >
            <Icon name="close" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

/**
 * Empty State Component
 */
const EmptyState = ({ tab }) => {
  const getMessage = () => {
    switch (tab) {
      case 'requests':
        return { title: 'No New Requests', text: 'Stay online to receive requests from nearby customers!' };
      case 'active':
        return { title: 'No Active Jobs', text: 'Accept requests to see your active jobs here.' };
      case 'history':
        return { title: 'No History Yet', text: 'Your completed and cancelled jobs will appear here.' };
      default:
        return { title: 'No Jobs', text: 'No jobs to display.' };
    }
  };
  
  const content = getMessage();
  
  return (
    <View style={styles.emptyContainer}>
      <FixhomiLogo size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>{content.title}</Text>
      <Text style={styles.emptyText}>{content.text}</Text>
    </View>
  );
};

/**
 * OTP Verification Modal
 */
const OTPModal = ({ visible, onClose, onVerify, isVerifying, error }) => {
  const [otp, setOtp] = useState('');
  
  const handleVerify = () => {
    if (otp.length === 6) {
      onVerify(otp);
    }
  };
  
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🔐 Enter Completion OTP</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalSubtitle}>
            Ask the customer for the 6-digit OTP they received to complete this service.
          </Text>
          
          <TextInput
            style={styles.otpInput}
            value={otp}
            onChangeText={setOtp}
            placeholder="Enter 6-digit OTP"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          
          {error ? <Text style={styles.otpError}>{error}</Text> : null}
          
          <TouchableOpacity
            style={[styles.verifyBtn, otp.length !== 6 && styles.verifyBtnDisabled]}
            onPress={handleVerify}
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
  
  // Determine initial tab from route params (for notification deep linking)
  const initialTab = route?.params?.tab || 'requests';
  
  // State
  const [activeTab, setActiveTab] = useState(initialTab);
  const [allJobs, setAllJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  
  // OTP Modal state
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  
  // Provider ID
  const providerId = user?.mongoId || user?.javaUserId || profile?.mongoId || profile?._id;
  
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
   * Call customer (Exotel masked call)
   */
  const handleCall = async (job) => {
    const userId = job.userId || job.userDetails?._id;
    if (!userId) {
      Alert.alert('Error', 'Customer information not available');
      return;
    }

    try {
      const result = await initiateCall({
        receiverId: userId,
        callerType: 'provider',
        serviceRequestId: job._id || null,
        serviceType: 'traditional',
      });

      if (result.success) {
        Alert.alert(
          'Connecting Call',
          'You will receive a call shortly. Once you pick up, we will connect you to the customer.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Call Failed', result.error || 'Unable to connect. Please try again.');
      }
    } catch (error) {
      console.error('[ProviderJobs] Call error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
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
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading your jobs...</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Jobs</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Icon name="refresh" size={22} color="#2563EB" />
        </TouchableOpacity>
      </View>
      
      {/* Stats Summary - Brand themed */}
      <View style={styles.statsRow}>
        <StatsCard iconName="inbox" value={stats.pending} label="New" color={BRAND.primary} bgColor="#FFF7ED" />
        <StatsCard iconName="briefcase" value={stats.active} label="Active" color={BRAND.secondary} bgColor="#EFF6FF" />
        <StatsCard iconName="check-circle" value={stats.completed} label="Done" color={BRAND.secondary} bgColor="#EFF6FF" />
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
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#2563EB']} />
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
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  refreshBtn: {
    padding: 8,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#fff',
  },
  statsCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  statsLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  // Tab Bar - Sleek compact design
  tabBar: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabBarContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    gap: 6,
  },
  tabActive: {
    backgroundColor: BRAND.secondary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  // Job Card
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceTypeInfo: {
    marginLeft: 10,
  },
  serviceType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  requestId: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Customer
  customerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  customerInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  customerDetails: {
    marginLeft: 10,
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  customerPhone: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginLeft: 8,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  // Location
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
    lineHeight: 18,
  },
  directionsButton: {
    padding: 6,
    marginLeft: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  // Info Row
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
  },
  // Description
  descriptionContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  descriptionLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  // Accept Button - Brand orange
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  acceptBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Pending Actions - Reject and Accept side by side
  pendingActions: {
    flexDirection: 'row',
    gap: 12,
  },
  // Reject Button
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 8,
  },
  rejectBtnDisabled: {
    opacity: 0.5,
  },
  rejectBtnText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  // Active Actions
  activeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.secondary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalClose: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  otpInput: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '600',
    marginBottom: 12,
  },
  otpError: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  verifyBtn: {
    backgroundColor: BRAND.secondary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProviderJobsScreen;
