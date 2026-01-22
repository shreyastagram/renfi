/**
 * Provider Home Screen
 * 
 * Dashboard for providers with:
 * - Stats overview
 * - Incoming requests
 * - Availability toggle
 * - Quick navigation
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  RefreshControl,
  Switch,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { updateProviderOnlineStatus } from '../services/profileService';
import { MenuButton, AvatarButton, DrawerMenu } from '../components/DrawerMenu';
import { Icon } from '../components';
import { 
  initializeSocket, 
  disconnectSocket, 
  startLocationTracking, 
  stopLocationTracking,
  isConnected,
} from '../services/socketService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
 * Quick Action Card
 */
const ActionCard = ({ iconName, title, subtitle, onPress, color }) => (
  <TouchableOpacity
    style={[styles.actionCard, { borderLeftColor: color }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.actionIconContainer, { backgroundColor: `${color}15` }]}>
      <Icon name={iconName} size={24} color={color} />
    </View>
    <View style={styles.actionTextContainer}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </View>
    <Icon name="chevron-right" size={20} color="#9CA3AF" />
  </TouchableOpacity>
);

/**
 * Provider Home Screen Component
 */
const ProviderHomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, logout } = useApp();

  // State - initialize from profile data
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAvailable, setIsAvailable] = useState(
    user?.isAvailable ?? profile?.isAvailable ?? user?.isOnline ?? profile?.isOnline ?? true
  );
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    earnings: 0,
    rating: 0,
  });

  // Combined user data
  const displayData = { ...user, ...profile };

  /**
   * Fetch provider stats
   */
  const fetchStats = useCallback(async () => {
    // TODO: Implement actual API call
    setStats({
      pending: user?.stats?.pendingRequests || profile?.stats?.pendingRequests || 0,
      completed: user?.stats?.completedRequests || profile?.stats?.completedRequests || 0,
      earnings: 0, // Will be implemented
      rating: user?.rating || profile?.rating || 0,
    });
  }, [user?.stats?.pendingRequests, user?.stats?.completedRequests, user?.rating, 
      profile?.stats?.pendingRequests, profile?.stats?.completedRequests, profile?.rating]);

  /**
   * Handle refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  /**
   * Handle availability toggle
   */
  const handleAvailabilityToggle = async (value) => {
    const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    
    if (!providerId) {
      Alert.alert('Error', 'Provider ID not found. Please log in again.');
      return;
    }
    
    // Optimistic update
    setIsAvailable(value);
    
    try {
      const result = await updateProviderOnlineStatus(providerId, value);
      
      if (!result.success) {
        // Revert on failure
        setIsAvailable(!value);
        Alert.alert('Error', result.error?.message || 'Failed to update availability');
      } else {
        // Start/stop location tracking based on availability
        if (value) {
          startLocationTracking(providerId);
        } else {
          stopLocationTracking();
        }
      }
    } catch (error) {
      // Revert on error
      setIsAvailable(!value);
      console.error('Failed to update availability:', error);
      Alert.alert('Error', 'Failed to update availability. Please try again.');
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    // Stop location tracking and disconnect socket
    stopLocationTracking();
    disconnectSocket();
    await logout();
  };

  // Update isAvailable when profile data changes
  useEffect(() => {
    const profileAvailable = user?.isAvailable ?? profile?.isAvailable ?? user?.isOnline ?? profile?.isOnline;
    if (profileAvailable !== undefined) {
      setIsAvailable(profileAvailable);
    }
  }, [user?.isAvailable, profile?.isAvailable, user?.isOnline, profile?.isOnline]);

  // Initialize socket and location tracking
  useEffect(() => {
    const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
    const token = user?.accessToken || profile?.accessToken;
    
    if (providerId) {
      // Initialize socket connection (if token available)
      if (token) {
        initializeSocket('provider', providerId, token);
      }
      
      // Start location tracking immediately for providers
      // This ensures location is updated even on first app open
      startLocationTracking(providerId);
    }
    
    // Cleanup on unmount
    return () => {
      stopLocationTracking();
    };
  }, [user?.mongoId, profile?.mongoId, user?._id, profile?._id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <MenuButton onPress={() => setIsDrawerOpen(true)} style={styles.headerMenuButton} />
          
          <View style={styles.headerContent}>
            <Text style={styles.greeting}>Hello, {displayData?.fullName?.split(' ')[0] || 'Provider'}!</Text>
            <Text style={styles.subGreeting}>Ready to help customers today?</Text>
          </View>

          <AvatarButton 
            name={displayData?.fullName} 
            onPress={() => navigation.navigate('Profile')}
            isProvider={true}
          />
        </View>

        {/* Availability Toggle */}
        <View style={styles.availabilityCard}>
          <View style={styles.availabilityContent}>
            <View style={[styles.availabilityDot, isAvailable && styles.availabilityDotOnline]} />
            <View>
              <Text style={styles.availabilityTitle}>
                {isAvailable ? 'You\'re Online' : 'You\'re Offline'}
              </Text>
              <Text style={styles.availabilitySubtitle}>
                {isAvailable ? 'Customers can see you' : 'Go online to receive requests'}
              </Text>
            </View>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={handleAvailabilityToggle}
            trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
            thumbColor={isAvailable ? '#22C55E' : '#9CA3AF'}
          />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatsCard
            iconName="clipboard-list"
            value={stats.pending}
            label="Pending"
            color="#F59E0B"
            bgColor="#FEF3C7"
          />
          <StatsCard
            iconName="check-circle"
            value={stats.completed}
            label="Completed"
            color="#22C55E"
            bgColor="#DCFCE7"
          />
          <StatsCard
            iconName="star"
            value={stats.rating.toFixed(1)}
            label="Rating"
            color="#3B82F6"
            bgColor="#DBEAFE"
          />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <ActionCard
          iconName="clipboard-list"
          title="View Service Requests"
          subtitle="See incoming customer requests"
          onPress={() => navigation.navigate('ProviderRequests')}
          color="#3B82F6"
        />

        <ActionCard
          iconName="history"
          title="Service History"
          subtitle="View your completed services"
          onPress={() => navigation.navigate('ProviderServiceHistory')}
          color="#8B5CF6"
        />

        {/* Service Categories */}
        <Text style={styles.sectionTitle}>Your Services</Text>
        <View style={styles.servicesContainer}>
          {(displayData?.serviceCategories || ['plumber', 'electrician']).map((cat, index) => (
            <View key={index} style={styles.serviceTag}>
              <Text style={styles.serviceTagText}>{cat}</Text>
            </View>
          ))}
        </View>

        {/* Tips Section */}
        <View style={styles.tipsCard}>
          <Icon name="lightbulb" size={24} color="#F59E0B" />
          <View style={styles.tipsContent}>
            <Text style={styles.tipsTitle}>Pro Tip</Text>
            <Text style={styles.tipsText}>
              Stay online during peak hours (9 AM - 6 PM) to receive more requests!
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Drawer Menu */}
      <DrawerMenu
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={displayData}
        userType="provider"
        navigation={navigation}
        onLogout={handleLogout}
        isVerified={displayData?.isPhoneVerified && displayData?.isEmailVerified}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  menuButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 14,
  },
  menuLine: {
    width: 18,
    height: 2,
    backgroundColor: '#374151',
    borderRadius: 1,
    marginVertical: 1.5,
  },
  menuLineMiddle: {
    width: 14,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  subGreeting: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#FEF3C7',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F59E0B',
  },

  // Availability Card
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  availabilityContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#9CA3AF',
    marginRight: 12,
  },
  availabilityDotOnline: {
    backgroundColor: '#22C55E',
  },
  availabilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  availabilitySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statsCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  statsIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statsLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },

  // Section Title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },

  // Action Cards
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 20,
    color: '#9CA3AF',
  },

  // Services Container
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  serviceTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  serviceTagText: {
    fontSize: 13,
    color: '#B45309',
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Tips Card
  tipsCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  tipsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
  },

  // Drawer styles (same as UserHomeScreen)
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: '#FFFFFF',
  },
  drawerHeader: {
    padding: 24,
    paddingTop: 20,
  },
  drawerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  drawerAvatarText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  drawerUserName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  drawerUserEmail: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  drawerUserBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  drawerUserBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  drawerContent: {
    flex: 1,
    paddingTop: 16,
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  drawerMenuIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  drawerMenuLabel: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  drawerMenuDanger: {
    color: '#EF4444',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
    marginHorizontal: 24,
  },
  drawerVersion: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingBottom: 24,
  },
});

export default ProviderHomeScreen;
