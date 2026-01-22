/**
 * User Service History Screen
 * 
 * Service history with:
 * - Status filtering
 * - Provider live location for active requests
 * - Call provider / Get directions
 * - OTP display for accepted requests
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import { Icon, ServiceIcon, StatusIcon } from '../components';
import { 
  getUserRequests, 
  cancelRequest,
  SERVICE_TYPE_LABELS,
} from '../services/traditionalServiceService';
import { subscribeToRequest, unsubscribeFromRequest } from '../services/socketService';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#F59E0B', bgColor: '#FEF3C7', iconName: 'pending' },
  accepted: { label: 'Accepted', color: '#3B82F6', bgColor: '#DBEAFE', iconName: 'accepted' },
  'in-progress': { label: 'In Progress', color: '#8B5CF6', bgColor: '#EDE9FE', iconName: 'in_progress' },
  completed: { label: 'Completed', color: '#10B981', bgColor: '#D1FAE5', iconName: 'completed' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bgColor: '#FEE2E2', iconName: 'cancelled' },
};

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

const FilterTabs = ({ activeFilter, onFilterChange }) => (
  <View style={styles.filterContainer}>
    {FILTER_TABS.map((tab) => (
      <TouchableOpacity
        key={tab.key}
        style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
        onPress={() => onFilterChange(tab.key)}
      >
        <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>{tab.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const RequestCard = ({ request, onPress, onCancel, onCallProvider, onTrackProvider, onDirections }) => {
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const isActive = ['accepted', 'in-progress'].includes(request.status);
  const hasProvider = request.providerDetails && request.assignedProviderId;
  
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
            <ServiceIcon serviceType={request.serviceType} size={24} color="#2563EB" />
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
                <Icon name="location" size={16} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Track</Text>
              </TouchableOpacity>
            )}
            {request.location?.coordinates && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => onDirections(request.location)}>
                <Icon name="directions" size={18} color="#2563EB" />
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
    // Navigate to a tracking screen or show modal with live location
    navigation.navigate('ServiceRequestDetail', { 
      requestId: request.requestId,
      showTracking: true,
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

  const filteredRequests = activeFilter === 'all' 
    ? requests 
    : requests.filter(r => activeFilter === 'accepted' 
        ? ['accepted', 'in-progress'].includes(r.status) 
        : r.status === activeFilter);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerPlaceholder} />
          <Text style={styles.headerTitle}>Service History</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
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
        <AvatarButton name={displayData?.fullName} onPress={() => navigation.navigate('Profile')} />
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
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="history" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No requests found</Text>
            <Text style={styles.emptySubtext}>Your service history will appear here</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  headerPlaceholder: { width: 40 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterContainer: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F3F4F6', borderRadius: 20 },
  filterTabActive: { backgroundColor: '#2563EB' },
  filterTabText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  filterTabTextActive: { color: '#fff' },
  listContent: { padding: 16, paddingBottom: 32 },
  requestCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  serviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  serviceType: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  requestId: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  dateLabel: { fontSize: 13, color: '#6B7280' },
  providerSection: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 12 },
  providerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  providerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  providerInitial: { fontSize: 16, fontWeight: '700', color: '#fff' },
  providerDetails: { flex: 1 },
  providerName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  providerRating: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#E5E7EB', paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionBtnPrimary: { backgroundColor: '#2563EB' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  actionBtnTextPrimary: { color: '#fff' },
  otpSection: { backgroundColor: '#EDE9FE', borderRadius: 12, padding: 12, marginBottom: 12 },
  otpLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  otpLabel: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  otpBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 8, padding: 12 },
  otpValue: { fontSize: 22, fontWeight: '700', color: '#1F2937', letterSpacing: 4 },
  otpCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  otpCopy: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEE2E2', paddingVertical: 12, borderRadius: 10 },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
  emptySubtext: { fontSize: 14, color: '#6B7280', marginTop: 4 },
});

export default UserServiceHistoryScreen;
