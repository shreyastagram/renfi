/**
 * User Service History Screen
 * 
 * Service history with:
 * - Status filtering
 * - Provider live location for active requests
 * - Call provider / Get directions
 * - OTP display for accepted requests
 * - Rating system for completed services
 * 
 * @version 2.1.0 - Added rating system
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import { Icon, ServiceIcon, StatusIcon, RatingModal, FixhomiLogo } from '../components';
import { 
  getUserRequests, 
  cancelRequest,
  submitRating,
  SERVICE_TYPE_LABELS,
} from '../services/traditionalServiceService';
import { subscribeToRequest, unsubscribeFromRequest } from '../services/socketService';

// Brand colors - User side uses blue as accent
const BRAND = {
  primary: '#f67c16', // Orange
  secondary: '#2b76bc', // Blue - user side accent
  background: '#faf7f7',
  white: '#FFFFFF',
  neutral: '#6B7280',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: BRAND.primary, bgColor: '#FEF3C7', iconName: 'pending' },
  accepted: { label: 'Accepted', color: BRAND.secondary, bgColor: '#DBEAFE', iconName: 'accepted' },
  'in-progress': { label: 'In Progress', color: BRAND.secondary, bgColor: '#DBEAFE', iconName: 'in_progress' },
  completed: { label: 'Completed', color: '#10B981', bgColor: '#D1FAE5', iconName: 'completed' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bgColor: '#FEE2E2', iconName: 'cancelled' },
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
          <Icon name={tab.icon} size={14} color={activeFilter === tab.key ? BRAND.white : BRAND.neutral} />
          <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

const RequestCard = ({ request, onPress, onCancel, onCallProvider, onTrackProvider, onDirections, onRate }) => {
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const isActive = ['accepted', 'in-progress'].includes(request.status);
  const isCompleted = request.status === 'completed';
  const hasProvider = request.providerDetails && request.assignedProviderId;
  const hasRated = request.ratings?.userRating > 0;
  
  const handleCopyOtp = () => {
    if (request.completionOtp) {
      Clipboard.setString(request.completionOtp);
      Alert.alert('Copied!', 'OTP copied to clipboard');
    }
  };

  return (
    <TouchableOpacity style={styles.requestCard} onPress={onPress} activeOpacity={0.8}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.serviceInfo}>
          <View style={styles.serviceIconContainer}>
            <ServiceIcon serviceType={request.serviceType} size={24} color={BRAND.secondary} />
          </View>
          <View>
            <Text style={styles.serviceType}>{SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}</Text>
            <Text style={styles.requestId}>#{request.requestId}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
          <StatusIcon status={request.status} size={14} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Date */}
      <View style={styles.dateRow}>
        <Icon name="calendar" size={14} color="#6B7280" />
        <Text style={styles.dateLabel}>{new Date(request.serviceDate || request.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
      </View>

      {/* Provider Info */}
      {hasProvider && (
        <View style={styles.providerSection}>
          <View style={styles.providerInfo}>
            <View style={styles.providerAvatar}>
              <Text style={styles.providerInitial}>{request.providerDetails.name?.charAt(0).toUpperCase() || 'P'}</Text>
            </View>
            <View style={styles.providerDetails}>
              <Text style={styles.providerName}>{request.providerDetails.name}</Text>
              {request.providerDetails.rating > 0 && (
                <View style={styles.ratingRow}>
                  <Icon name="star" size={12} color="#F59E0B" />
                  <Text style={styles.providerRating}>{request.providerDetails.rating.toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {request.providerDetails.phone && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => onCallProvider(request.providerDetails.phone)}>
                <Icon name="phone" size={16} color="#10B981" />
                <Text style={styles.actionBtnText}>Call</Text>
              </TouchableOpacity>
            )}
            {isActive && (
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => onTrackProvider(request)}>
                <Icon name="location" size={16} color={BRAND.white} />
                <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Track</Text>
              </TouchableOpacity>
            )}
            {request.location?.coordinates && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => onDirections(request.location)}>
                <Icon name="directions" size={18} color={BRAND.secondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* OTP Section */}
      {isActive && request.completionOtp && (
        <TouchableOpacity style={styles.otpSection} onPress={handleCopyOtp}>
          <View style={styles.otpLabelRow}>
            <Icon name="lock" size={14} color="#7C3AED" />
            <Text style={styles.otpLabel}>OTP for Completion</Text>
          </View>
          <View style={styles.otpBox}>
            <Text style={styles.otpValue}>{request.completionOtp}</Text>
            <View style={styles.otpCopyBtn}>
              <Icon name="copy" size={14} color="#7C3AED" />
              <Text style={styles.otpCopy}>Copy</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Cancel Button */}
      {request.status === 'pending' && (
        <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(request)}>
          <Icon name="close" size={16} color="#EF4444" />
          <Text style={styles.cancelBtnText}>Cancel Request</Text>
        </TouchableOpacity>
      )}

      {/* Rating Section for Completed Requests */}
      {isCompleted && hasProvider && (
        hasRated ? (
          <View style={styles.ratedSection}>
            <Icon name="star" size={16} color="#F59E0B" />
            <Text style={styles.ratedText}>
              You rated this service {request.ratings.userRating} stars
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.rateBtn} onPress={() => onRate(request)}>
            <Icon name="star" size={16} color="#FFFFFF" />
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

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  
  // Rating modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [requestToRate, setRequestToRate] = useState(null);

  const displayData = { ...user, ...profile };
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  const fetchRequests = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const result = await getUserRequests(userId, { limit: 100 });
      if (result.success) setRequests(result.requests || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  const handleCallProvider = (phone) => {
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
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
      serviceCategory: request.serviceType || request.serviceCategory || request.category,
      serviceLocation: serviceCoords, // Pass the service location where work needs to be done
      serviceAddress: request.serviceAddress || request.address || request.location?.address,
    });
  };

  const handleDirections = (location) => {
    const { latitude, longitude, lat, lng } = location.coordinates || location;
    const destLat = latitude || lat;
    const destLng = longitude || lng;
    if (!destLat || !destLng) { Alert.alert('Error', 'Location not available'); return; }
    const url = Platform.select({
      ios: `maps:?daddr=${destLat},${destLng}`,
      android: `google.navigation:q=${destLat},${destLng}`,
    });
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`));
  };

  const handleCancel = async (request) => {
    Alert.alert('Cancel Request?', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: async () => {
        const result = await cancelRequest(request._id, userId, 'Cancelled by user');
        if (result.success) { Alert.alert('Cancelled'); onRefresh(); }
        else Alert.alert('Error', result.error || 'Failed to cancel');
      }},
    ]);
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
  const handleSubmitRating = async (rating, review) => {
    if (!requestToRate) return;
    
    const result = await submitRating(
      requestToRate._id,
      userId,
      rating,
      review
    );
    
    if (result.success) {
      // Update local state to reflect the rating
      setRequests(prev => prev.map(r => 
        r._id === requestToRate._id 
          ? { 
              ...r, 
              ratings: { 
                ...r.ratings, 
                userRating: rating, 
                userReview: review,
                ratedAt: new Date().toISOString()
              } 
            } 
          : r
      ));
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
        return requests.filter(r => ['cancelled', 'expired'].includes(r.status));
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
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FixhomiLogo size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No requests yet</Text>
            <Text style={styles.emptySubtext}>Book a service to get started with FixHomi</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: BRAND.white, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  headerPlaceholder: { width: 40 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterContainer: { backgroundColor: BRAND.white, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F3F4F6', borderRadius: 20, gap: 6 },
  filterTabActive: { backgroundColor: BRAND.secondary },
  filterTabText: { fontSize: 13, fontWeight: '600', color: BRAND.neutral },
  filterTabTextActive: { color: BRAND.white },
  listContent: { padding: 16, paddingBottom: 32 },
  requestCard: { backgroundColor: BRAND.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  serviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND.secondary + '20', alignItems: 'center', justifyContent: 'center' },
  serviceType: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  requestId: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  dateLabel: { fontSize: 13, color: '#6B7280' },
  providerSection: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 12 },
  providerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  providerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  providerInitial: { fontSize: 16, fontWeight: '700', color: BRAND.white },
  providerDetails: { flex: 1 },
  providerName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  providerRating: { fontSize: 12, color: BRAND.primary, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#E5E7EB', paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionBtnPrimary: { backgroundColor: BRAND.primary },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  actionBtnTextPrimary: { color: BRAND.white },
  otpSection: { backgroundColor: '#EDE9FE', borderRadius: 12, padding: 12, marginBottom: 12 },
  otpLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  otpLabel: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  otpBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BRAND.white, borderRadius: 8, padding: 12 },
  otpValue: { fontSize: 22, fontWeight: '700', color: '#1F2937', letterSpacing: 4 },
  otpCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  otpCopy: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEE2E2', paddingVertical: 12, borderRadius: 10 },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  rateBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    backgroundColor: '#F59E0B', 
    paddingVertical: 12, 
    borderRadius: 10,
    marginTop: 4,
  },
  rateBtnText: { fontSize: 14, fontWeight: '600', color: BRAND.white },
  ratedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  ratedText: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
  emptySubtext: { fontSize: 14, color: '#6B7280', marginTop: 4 },
});

export default UserServiceHistoryScreen;
