/**
 * Home Screen
 * 
 * Main screen shown after successful authentication
 * Shows user profile, verification status, and relevant details
 * 
 * @version 6.0.0
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Button } from '../components';
import { useApp } from '../context/AppContext';

/**
 * HomeScreen Component
 */
const HomeScreen = ({ navigation }) => {
  const { 
    user, 
    userType, 
    profile, 
    isProfileLoading, 
    logout,
    refreshVerificationStatus,
  } = useApp();
  
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load verification status on mount
  useEffect(() => {
    refreshVerificationStatus();
  }, []);

  // Combine profile and user data - profile takes priority if available
  const displayData = { ...user, ...profile };
  
  // Get verification status - check both user and profile state
  const isEmailVerified = user?.isEmailVerified || profile?.isEmailVerified || false;
  const isPhoneVerified = user?.isPhoneVerified || profile?.isPhoneVerified || false;
  const isProvider = userType === 'provider';

  /**
   * Handle pull to refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshVerificationStatus();
    setRefreshing(false);
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  /**
   * Navigate to verification screen
   */
  const handleVerify = (type) => {
    navigation?.navigate?.('Verification', { verificationType: type });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to FixHomi!</Text>
          <Text style={styles.subtitle}>
            {displayData.fullName ? `Hello, ${displayData.fullName}` : 'You are logged in'}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, isProvider && styles.providerBadge]}>
              <Text style={[styles.badgeText, isProvider && styles.providerBadgeText]}>
                {isProvider ? '🛠 Provider' : '👤 User'}
              </Text>
            </View>
            {isProfileLoading && (
              <ActivityIndicator size="small" color="#2563EB" style={styles.loadingIndicator} />
            )}
          </View>
        </View>

        {/* Account Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Information</Text>
          
          {/* Email */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <View style={styles.infoValueRow}>
              <Text style={styles.infoValue} numberOfLines={1}>
                {displayData.email || 'Not set'}
              </Text>
              {displayData.email && (
                isEmailVerified ? (
                  <View style={styles.verifiedContainer}>
                    <Text style={styles.verifiedIcon}>✓</Text>
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.verifyButton} 
                    onPress={() => handleVerify('email')}
                  >
                    <Text style={styles.verifyButtonText}>Verify</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>

          {/* Phone */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <View style={styles.infoValueRow}>
              <Text style={styles.infoValue} numberOfLines={1}>
                {displayData.phone || 'Not set'}
              </Text>
              {displayData.phone && (
                isPhoneVerified ? (
                  <View style={styles.verifiedContainer}>
                    <Text style={styles.verifiedIcon}>✓</Text>
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.verifyButton} 
                    onPress={() => handleVerify('phone')}
                  >
                    <Text style={styles.verifyButtonText}>Verify</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>

          {/* Address */}
          {displayData.address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{displayData.address}</Text>
            </View>
          )}

          {/* City & Pincode */}
          {(displayData.city || displayData.pincode) && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>
                {[displayData.city, displayData.pincode].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
        </View>

        {/* Provider-specific Card */}
        {isProvider && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Provider Details</Text>
            
            {/* Service Categories */}
            {displayData.serviceCategories?.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Services</Text>
                <View style={styles.tagsContainer}>
                  {displayData.serviceCategories.map((cat, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{cat}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Experience */}
            {displayData.experience && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Experience</Text>
                <Text style={styles.infoValue}>{displayData.experience}</Text>
              </View>
            )}

            {/* Rating */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Rating</Text>
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingValue}>
                  ⭐ {displayData.rating?.toFixed(1) || '0.0'}
                </Text>
                {displayData.ratings?.total > 0 && (
                  <Text style={styles.ratingCount}>
                    ({displayData.ratings.total} reviews)
                  </Text>
                )}
              </View>
            </View>

            {/* Availability */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[
                styles.statusBadge,
                displayData.isAvailable ? styles.statusOnline : styles.statusOffline
              ]}>
                <Text style={[
                  styles.statusText,
                  displayData.isAvailable ? styles.statusTextOnline : styles.statusTextOffline
                ]}>
                  {displayData.isAvailable ? '● Available' : '○ Unavailable'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* User-specific Stats Card */}
        {!isProvider && displayData.stats && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Activity</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{displayData.stats.totalRequests || 0}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{displayData.stats.completedRequests || 0}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{displayData.stats.cancelledRequests || 0}</Text>
                <Text style={styles.statLabel}>Cancelled</Text>
              </View>
            </View>
          </View>
        )}

        {/* Verification Prompt - only show if loading is done and verification incomplete */}
        {!isProfileLoading && (!isEmailVerified || !isPhoneVerified) && (
          <View style={styles.verificationCard}>
            <Text style={styles.verificationTitle}>⚠️ Complete Verification</Text>
            <Text style={styles.verificationText}>
              Verify your {!isEmailVerified && !isPhoneVerified ? 'email and phone' : 
                !isEmailVerified ? 'email' : 'phone'} to unlock all features.
            </Text>
          </View>
        )}

        {/* All verified message */}
        {!isProfileLoading && isEmailVerified && isPhoneVerified && (
          <View style={styles.verifiedCard}>
            <Text style={styles.verifiedCardIcon}>🎉</Text>
            <Text style={styles.verifiedCardTitle}>Fully Verified!</Text>
            <Text style={styles.verifiedCardText}>
              Your email and phone number are verified. Enjoy all features!
            </Text>
          </View>
        )}

        {/* User Service Request Card */}
        {!isProvider && (
          <View style={styles.serviceCard}>
            <Text style={styles.serviceCardIcon}>🔧</Text>
            <Text style={styles.serviceCardTitle}>Need a Service?</Text>
            <Text style={styles.serviceCardText}>
              Find electricians, plumbers, carpenters, and more near you!
            </Text>
            <TouchableOpacity
              style={styles.requestServiceButton}
              onPress={() => navigation?.navigate?.('CreateServiceRequest')}
            >
              <Text style={styles.requestServiceButtonText}>Request Service</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* User Service History Card */}
        {!isProvider && (
          <View style={styles.historyCard}>
            <Text style={styles.historyCardIcon}>📋</Text>
            <Text style={styles.historyCardTitle}>Service History</Text>
            <Text style={styles.historyCardText}>
              View all your service requests, track progress, and see completion details.
            </Text>
            <TouchableOpacity
              style={styles.viewHistoryButton}
              onPress={() => navigation?.navigate?.('UserServiceHistory')}
            >
              <Text style={styles.viewHistoryButtonText}>View History</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Provider Dashboard Card */}
        {isProvider && (
          <View style={styles.providerDashboardCard}>
            <Text style={styles.providerDashboardIcon}>📋</Text>
            <Text style={styles.providerDashboardTitle}>Service Requests</Text>
            <Text style={styles.providerDashboardText}>
              View and accept incoming service requests from customers.
            </Text>
            <TouchableOpacity
              style={styles.viewRequestsButton}
              onPress={() => navigation?.navigate?.('ProviderRequests')}
            >
              <Text style={styles.viewRequestsButtonText}>View Requests</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Logout Button */}
        <Button
          title={loggingOut ? 'Logging out...' : 'Logout'}
          variant="outline"
          onPress={handleLogout}
          loading={loggingOut}
          disabled={loggingOut}
          style={styles.logoutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  providerBadge: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  providerBadgeText: {
    color: '#B45309',
  },
  loadingIndicator: {
    marginLeft: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 14,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoValue: {
    fontSize: 15,
    color: '#1F2937',
    flex: 1,
  },
  verifiedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedIcon: {
    color: '#059669',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  verifyButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verifyButtonText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 13,
    color: '#374151',
    textTransform: 'capitalize',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusOnline: {
    backgroundColor: '#D1FAE5',
  },
  statusOffline: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusTextOnline: {
    color: '#059669',
  },
  statusTextOffline: {
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  verificationCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  verificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  verificationText: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 20,
  },
  placeholderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  placeholderText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  verifiedCard: {
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  verifiedCardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  verifiedCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  // Service Request Card Styles
  serviceCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  serviceCardIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  serviceCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 8,
  },
  serviceCardText: {
    fontSize: 14,
    color: '#3B82F6',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  requestServiceButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  requestServiceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Provider Dashboard Card Styles
  providerDashboardCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  providerDashboardIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  providerDashboardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  providerDashboardText: {
    fontSize: 14,
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  viewRequestsButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  viewRequestsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  verifiedCardText: {
    fontSize: 13,
    color: '#047857',
    textAlign: 'center',
  },
  // User Service History Card Styles
  historyCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  historyCardIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  historyCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 8,
  },
  historyCardText: {
    fontSize: 14,
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  viewHistoryButton: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  viewHistoryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 4,
  },
});

export default HomeScreen;
