/**
 * Provider Service History Screen
 * 
 * Comprehensive view of provider's completed and ongoing services:
 * - Status filtering (All, In Progress, Completed, Cancelled)
 * - Earnings summary
 * - Pull-to-refresh
 * - Customer details with contact options
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import { Icon, ServiceIcon, StatusIcon } from '../components';
import { 
  getProviderRequests,
  SERVICE_TYPE_LABELS,
} from '../services/traditionalServiceService';
// Direct phone dialing - Exotel call masking removed
import { NODE_BASE_URL } from '../config/api';

// Brand colors
const BRAND = {
  primary: '#f67c16', // Orange
  secondary: '#2b76bc', // Blue
  background: '#faf7f7',
  white: '#FFFFFF',
};

// Status configuration
const STATUS_CONFIG = {
  'in-progress': {
    label: 'In Progress',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    iconName: 'wrench',
  },
  'accepted': {
    label: 'Accepted',
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    iconName: 'check',
  },
  'completed': {
    label: 'Completed',
    color: '#10B981',
    bgColor: '#D1FAE5',
    iconName: 'check-circle',
  },
  'cancelled': {
    label: 'Cancelled',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    iconName: 'close',
  },
};

// Filter tabs
const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'in-progress', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

/**
 * Stats Card Component
 */
const StatsCard = ({ iconName, value, label, color, bgColor }) => (
  <View style={[styles.statsCard, { backgroundColor: bgColor }]}>
    <Icon name={iconName} size={24} color={color} />
    <Text style={[styles.statsValue, { color }]}>{value}</Text>
    <Text style={styles.statsLabel}>{label}</Text>
  </View>
);

/**
 * Stats Dashboard
 */
const StatsDashboard = ({ stats }) => (
  <View style={styles.statsContainer}>
    <Text style={styles.statsTitle}>Your Performance</Text>
    <View style={styles.statsGrid}>
      <StatsCard
        iconName="chart-bar"
        value={stats?.total || 0}
        label="Total Jobs"
        color="#1a1a1a"
        bgColor="#f5f5f5"
      />
      <StatsCard
        iconName="wrench"
        value={stats?.active || 0}
        label="Active"
        color="#8B5CF6"
        bgColor="#EDE9FE"
      />
      <StatsCard
        iconName="check-circle"
        value={stats?.completed || 0}
        label="Completed"
        color="#10B981"
        bgColor="#D1FAE5"
      />
      <StatsCard
        iconName="star"
        value={stats?.rating?.toFixed(1) || '0.0'}
        label="Rating"
        color={BRAND.primary}
        bgColor={BRAND.primary + '20'}
      />
    </View>
  </View>
);

/**
 * Filter Tabs
 */
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

/**
 * Service Request Card
 */
const RequestCard = ({ request, onPress, onCall, onDirections }) => {
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG['in-progress'];
  const serviceDate = new Date(request.serviceDate || request.createdAt);

  return (
    <TouchableOpacity 
      style={styles.requestCard} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.serviceTypeContainer}>
          <ServiceIcon serviceType={request.serviceType} size={28} />
          <View style={styles.serviceTypeTextContainer}>
            <Text style={styles.serviceType}>
              {SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}
            </Text>
            <Text style={styles.requestId}>#{request.requestId}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
          <StatusIcon status={request.status} size={14} />
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* Customer Info */}
      {request.userDetails && (
        <View style={styles.customerContainer}>
          <View style={styles.customerInfo}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerInitial}>
                {request.userDetails.name?.charAt(0).toUpperCase() || 'C'}
              </Text>
            </View>
            <View style={styles.customerDetails}>
              <Text style={styles.customerName}>
                {request.userDetails.name || 'Customer'}
              </Text>
            </View>
          </View>
          
          {/* Quick Actions - Only for active requests */}
          {['pending', 'accepted', 'in-progress'].includes(request.status) && (
            <View style={styles.quickActions}>
              {request.userDetails && (
                <TouchableOpacity
                  style={styles.quickActionBtn}
                  onPress={() => onCall(request)}
                >
                  <Icon name="phone" size={18} color="#10B981" />
                </TouchableOpacity>
              )}
              {['accepted', 'in-progress'].includes(request.status) && request.location?.coordinates && (
                <TouchableOpacity
                  style={styles.quickActionBtn}
                  onPress={() => onDirections(request.location)}
                >
                  <Icon name="directions" size={18} color={BRAND.secondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Location */}
      {request.location?.address && (
        <View style={styles.locationRow}>
          <Icon name="location" size={16} color="#EF4444" />
          <Text style={styles.locationText} numberOfLines={2}>
            {request.location.address}
          </Text>
        </View>
      )}

      {/* Date & Time */}
      <View style={styles.dateRow}>
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>Service Date</Text>
          <Text style={styles.dateValue}>
            {serviceDate.toLocaleDateString('en-IN', { 
              day: 'numeric', 
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
        {request.completedAt && (
          <>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Completed</Text>
              <Text style={styles.dateValue}>
                {new Date(request.completedAt).toLocaleDateString('en-IN', { 
                  day: 'numeric', 
                  month: 'short',
                })}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Earnings (for completed) */}
      {request.status === 'completed' && request.earnings && (
        <View style={styles.earningsContainer}>
          <View style={styles.earningsLabelRow}>
            <Icon name="money" size={16} color="#10B981" />
            <Text style={styles.earningsLabel}>Earnings</Text>
          </View>
          <Text style={styles.earningsValue}>₹{request.earnings}</Text>
        </View>
      )}

      {/* View Details */}
      <View style={styles.viewDetails}>
        <Text style={styles.viewDetailsText}>View Details</Text>
        <Icon name="chevron-right" size={16} color={BRAND.secondary} />
      </View>
    </TouchableOpacity>
  );
};

/**
 * Empty State
 */
const EmptyState = ({ filter }) => {
  const getMessage = () => {
    switch (filter) {
      case 'in-progress':
        return 'No active jobs right now.\nAccept new requests to get started!';
      case 'completed':
        return 'No completed jobs yet.\nComplete your first job to see it here.';
      case 'cancelled':
        return 'No cancelled jobs.\nGreat job maintaining your service quality!';
      default:
        return 'No service history yet.\nStart accepting requests to build your history.';
    }
  };

  return (
    <View style={styles.emptyContainer}>
      <Icon name="clipboard-list" size={64} color="#9CA3AF" />
      <Text style={styles.emptyTitle}>No Jobs Found</Text>
      <Text style={styles.emptyText}>{getMessage()}</Text>
    </View>
  );
};

/**
 * Provider Service History Screen
 */
const ProviderServiceHistoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, userType, logout } = useApp();

  // State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    rating: 0,
  });

  // Get provider ID
  const displayData = { ...user, ...profile };
  const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
  
  console.log('[ProviderHistory] Provider ID resolution:', {
    'user?.mongoId': user?.mongoId,
    'profile?.mongoId': profile?.mongoId,
    'user?._id': user?._id,
    'profile?._id': profile?._id,
    'resolved providerId': providerId,
  });

  /**
   * Fetch service history - includes both traditional and event services
   */
  const fetchHistory = useCallback(async () => {
    if (!providerId) {
      setLoading(false);
      return;
    }
    
    console.log('[ProviderHistory] Fetching event services for providerId:', providerId);

    try {
      // Fetch both traditional services and event services
      const [traditionalResult, eventResult] = await Promise.all([
        getProviderRequests(providerId, {
          limit: 100,
          status: activeFilter !== 'all' ? activeFilter : undefined,
        }),
        fetch(`${NODE_BASE_URL}/api/event-services/provider/${providerId}`).then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      
      console.log('[ProviderHistory] Event services result:', eventResult);

      // Format event services to match traditional service structure
      const eventBookings = (eventResult.data || []).map(booking => ({
        ...booking,
        _id: booking._id,
        requestId: booking.serviceId || booking._id,
        serviceType: booking.serviceType,
        status: booking.status,
        createdAt: booking.createdAt,
        isEventService: true, // Flag to identify event services
        userName: booking.userName || 'Customer',
        userPhone: booking.userPhone,
        eventDate: booking.eventDate,
        completionOtp: booking.completionOtp,
      }));
      
      // Filter event bookings if filter is active
      const filteredEventBookings = activeFilter === 'all' 
        ? eventBookings 
        : eventBookings.filter(b => b.status === activeFilter);

      // Combine and sort by date
      const allRequests = [
        ...(traditionalResult.success ? traditionalResult.requests : []),
        ...filteredEventBookings,
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setRequests(allRequests);
      
      // Calculate stats from combined requests
      setStats({
        total: allRequests.length,
        active: allRequests.filter(r => ['accepted', 'in-progress'].includes(r.status)).length,
        completed: allRequests.filter(r => r.status === 'completed').length,
        rating: user?.rating || profile?.rating || 0,
      });
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, [providerId, activeFilter]);

  /**
   * Handle refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  /**
   * Handle call customer - direct phone dialing
   */
  const handleCall = (request) => {
    const phone = request.userDetails?.phone || request.userDetails?.verifiedPhone || request.userPhone;
    const customerName = request.userDetails?.name || request.userName || 'Customer';
    
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
   * Handle get directions
   */
  const handleDirections = (location) => {
    const { latitude, longitude, lat, lng } = location.coordinates || location;
    const destLat = latitude || lat;
    const destLng = longitude || lng;
    
    if (!destLat || !destLng) {
      Alert.alert('Error', 'Location coordinates not available');
      return;
    }

    const url = Platform.select({
      ios: `maps:?daddr=${destLat},${destLng}`,
      android: `google.navigation:q=${destLat},${destLng}`,
    });

    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`);
    });
  };

  /**
   * Handle view details
   */
  const handleViewDetails = (request) => {
    // Pass both _id and requestId for maximum compatibility
    // ServiceRequestDetailScreen will use requestId for API calls
    navigation.navigate('ServiceRequestDetail', { 
      requestId: request.requestId || request._id,
      request: request, // Pass full request for immediate display
    });
  };

  // Effects
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Filter requests
  const filteredRequests = activeFilter === 'all' 
    ? requests 
    : requests.filter(r => r.status === activeFilter || 
        (activeFilter === 'in-progress' && ['accepted', 'in-progress'].includes(r.status)));

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <MenuButton onPress={() => setIsDrawerOpen(true)} />
        <Text style={styles.headerTitle}>Service History</Text>
        <AvatarButton 
          name={displayData?.fullName} 
          profilePicture={displayData?.profilePicture}
          onPress={() => navigation.navigate('Profile')} 
          isProvider={true}
        />
      </View>

      <FilterTabs activeFilter={activeFilter} onFilterChange={handleFilterChange} />

      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.requestId || item._id}
        ListHeaderComponent={<StatsDashboard stats={stats} />}
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            onPress={() => handleViewDetails(item)}
            onCall={handleCall}
            onDirections={handleDirections}
          />
        )}
        ListEmptyComponent={<EmptyState filter={activeFilter} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
  container: { flex: 1, backgroundColor: BRAND.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: BRAND.white, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  listContent: { padding: 16, paddingBottom: 32 },
  // Stats
  statsContainer: { backgroundColor: BRAND.white, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statsTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statsCard: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, marginHorizontal: 4 },
  statsIcon: { fontSize: 20, marginBottom: 4 },
  statsValue: { fontSize: 20, fontWeight: '700' },
  statsLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  // Filter
  filterContainer: { flexDirection: 'row', backgroundColor: BRAND.white, paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F3F4F6', borderRadius: 20 },
  filterTabActive: { backgroundColor: BRAND.primary },
  filterTabText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  filterTabTextActive: { color: BRAND.white },
  // Request Card
  requestCard: {
    backgroundColor: BRAND.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  },
  serviceTypeIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  serviceType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    textTransform: 'capitalize',
  },
  requestId: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Customer
  customerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    backgroundColor: BRAND.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  customerInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND.secondary,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  customerPhone: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIcon: {
    fontSize: 18,
  },
  // Location
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 2,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  // Date
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  dateDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e8e8e8',
    marginHorizontal: 16,
  },
  // Earnings
  earningsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  earningsLabel: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
  },
  // View Details
  viewDetails: {
    alignItems: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  viewDetailsText: {
    fontSize: 14,
    color: BRAND.secondary,
    fontWeight: '500',
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 12,
  },
  // Additional styles for icon integration
  serviceTypeTextContainer: {
    marginLeft: 10,
  },
  customerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  earningsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 40,
  },
});

export default ProviderServiceHistoryScreen;
