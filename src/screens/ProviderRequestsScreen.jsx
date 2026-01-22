/**
 * Provider Requests Screen
 * Shows incoming service requests for providers to accept
 * @version 1.0.0
 * 
 * Flow:
 * 1. Provider sees list of incoming requests
 * 2. Provider can refresh to get latest requests
 * 3. Provider can view request details
 * 4. Provider can accept a request
 */

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, ServiceIcon, StatusIcon } from '../components';
import { useApp } from '../context/AppContext';
import {
  getProviderRequests,
  acceptRequestAsProvider,
  verifyCompletionOtp,
  providerCancelRequest,
  SERVICE_TYPE_LABELS,
} from '../services/traditionalServiceService';

const ProviderRequestsScreen = ({ navigation }) => {
  const { user, profile } = useApp();
  const insets = useSafeAreaInsets();
  
  // State
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState(null);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState(null);
  
  // OTP completion modal state
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  
  // ✅ UNIFIED ID SYSTEM:
  // After backend update, MongoDB _id = Java Auth userId
  // So user.mongoId (from registration) or user.javaUserId (from login) will both work
  const providerId = user?.mongoId || user?.javaUserId || profile?.mongoId || profile?._id || profile?.id;

  // Debug: Log resolved ID
  console.log('[ProviderRequests] Resolved providerId:', providerId, '(unified ID system)');

  /**
   * Fetch provider's incoming requests
   */
  const fetchRequests = useCallback(async (showLoading = true) => {
    if (!providerId) {
      console.error('[ProviderRequests] No provider ID found. User:', user, 'Profile:', profile);
      setIsLoading(false);
      return;
    }

    if (showLoading) setIsLoading(true);

    try {
      const result = await getProviderRequests(providerId, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (result.success) {
        setRequests(result.requests || []);
        setStats(result.stats);
        setPagination(result.pagination);
      } else {
        console.error('[ProviderRequests] Fetch failed:', result.error);
        if (showLoading) {
          Alert.alert('Error', result.error || 'Failed to fetch requests');
        }
      }
    } catch (error) {
      console.error('[ProviderRequests] Error:', error);
      if (showLoading) {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [providerId]);

  // Fetch on mount
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  /**
   * Handle pull to refresh
   */
  const onRefresh = () => {
    setIsRefreshing(true);
    fetchRequests(false);
  };

  /**
   * Handle accepting a request
   */
  const handleAcceptRequest = async (request) => {
    if (!request?._id) {
      Alert.alert('Error', 'Request not found');
      return;
    }

    // Get user email for OTP delivery
    const userEmail = request.userDetails?.email || '';

    Alert.alert(
      '✅ Accept Request',
      `Accept this ${SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType} request?\n\nService Date: ${formatDate(request.serviceDate)}\n\nYou will be assigned to this job.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setAcceptingRequestId(request._id);

            try {
              const result = await acceptRequestAsProvider(
                request._id,
                providerId,
                userEmail
              );

              if (result.success) {
                Alert.alert(
                  '🎉 Request Accepted!',
                  `You have successfully accepted this request.\n\n${result.warning ? result.warning.message : 'The customer has been notified.'}`,
                  [
                    {
                      text: 'OK',
                      onPress: () => fetchRequests(false),
                    },
                  ]
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to accept request');
              }
            } catch (error) {
              console.error('[AcceptRequest] Error:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setAcceptingRequestId(null);
            }
          },
        },
      ]
    );
  };

  /**
   * Handle opening the OTP verification modal
   */
  const handleCompleteService = (request) => {
    setSelectedRequest(request);
    setOtpInput('');
    setOtpError('');
    setOtpModalVisible(true);
  };

  /**
   * Handle OTP verification and service completion
   */
  const handleVerifyOtp = async () => {
    if (!otpInput || otpInput.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');

    try {
      const result = await verifyCompletionOtp(selectedRequest._id, otpInput);

      if (result.success) {
        setOtpModalVisible(false);
        Alert.alert(
          '🎉 Service Completed!',
          'The service has been marked as complete. Great job!',
          [
            {
              text: 'OK',
              onPress: () => fetchRequests(false),
            },
          ]
        );
      } else {
        // Handle specific error codes
        if (result.code === 'INVALID_OTP') {
          setOtpError('Invalid OTP. Please check and try again.');
        } else if (result.code === 'OTP_EXPIRED') {
          setOtpError('OTP has expired. Ask customer for a new OTP.');
        } else {
          setOtpError(result.error || 'Failed to verify OTP');
        }
      }
    } catch (error) {
      console.error('[VerifyOTP] Error:', error);
      setOtpError('Something went wrong. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  /**
   * Handle provider cancelling an accepted request
   */
  const handleCancelRequest = (request) => {
    Alert.alert(
      'Cancel Request?',
      'Are you sure you want to cancel this request? The customer will be notified.',
      [
        { text: 'No, Keep It', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await providerCancelRequest(
                request._id,
                providerId,
                'Provider cancelled the request'
              );

              if (result.success) {
                Alert.alert('Request Cancelled', 'The request has been cancelled.');
                fetchRequests(false);
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel request');
              }
            } catch (error) {
              console.error('[CancelRequest] Error:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            }
          },
        },
      ]
    );
  };

  /**
   * Open Google Maps for directions
   */
  const handleGetDirections = (request) => {
    if (!request.location?.coordinates) {
      Alert.alert('Location Not Available', 'No location data for this request.');
      return;
    }

    const [lng, lat] = request.location.coordinates;
    const label = encodeURIComponent(request.location?.address || 'Service Location');
    
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}(${label})`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    });
    
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  /**
   * Format time ago
   */
  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  /**
   * Get status badge style
   */
  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending':
        return { bg: '#FEF3C7', text: '#B45309' };
      case 'accepted':
        return { bg: '#D1FAE5', text: '#059669' };
      case 'completed':
        return { bg: '#DBEAFE', text: '#1D4ED8' };
      case 'cancelled':
        return { bg: '#FEE2E2', text: '#DC2626' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  /**
   * Render request card
   */
  const renderRequestCard = ({ item: request }) => {
    const isAccepting = acceptingRequestId === request._id;
    const statusStyle = getStatusStyle(request.status);
    const isPending = request.status === 'pending';

    return (
      <View style={styles.requestCard}>
        {/* Header */}
        <View style={styles.requestHeader}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceType}>
              {SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}
            </Text>
            <Text style={styles.requestTime}>{formatTimeAgo(request.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {request.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* User Details */}
        {request.userDetails && (
          <View style={styles.userSection}>
            <View style={styles.userAvatar}>
              <Text style={styles.userInitial}>
                {request.userDetails.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{request.userDetails.name || 'Customer'}</Text>
              {request.userDetails.phone && (
                <View style={styles.userPhoneRow}>
                  <Icon name="phone" size={14} color="#6B7280" />
                  <Text style={styles.userPhone}>{request.userDetails.phone}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Location & Directions */}
        {request.location?.address && (
          <View style={styles.locationSection}>
            <View style={styles.locationRow}>
              <Icon name="location" size={16} color="#EF4444" />
              <Text style={styles.locationText} numberOfLines={2}>{request.location.address}</Text>
            </View>
            {request.location?.coordinates && (
              <TouchableOpacity
                style={styles.directionsButton}
                onPress={() => handleGetDirections(request)}
                activeOpacity={0.7}
              >
                <Icon name="directions" size={18} color="#FFFFFF" />
                <Text style={styles.directionsButtonText}>Get Directions</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Request Details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Icon name="calendar" size={16} color="#6B7280" />
            <Text style={styles.detailLabel}>Service Date:</Text>
            <Text style={styles.detailValue}>{formatDate(request.serviceDate)}</Text>
          </View>
          
          {request.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionLabel}>Description:</Text>
              <Text style={styles.descriptionText}>{request.description}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {isPending && (
          <TouchableOpacity
            style={[styles.acceptButton, isAccepting && styles.acceptButtonDisabled]}
            onPress={() => handleAcceptRequest(request)}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.acceptButtonContent}>
                <Icon name="check" size={18} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>Accept Request</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {(request.status === 'accepted' || request.status === 'in-progress') && (
          <View style={styles.acceptedSection}>
            <View style={styles.acceptedBanner}>
              <Icon name="check" size={18} color="#10B981" />
              <Text style={styles.acceptedText}>You accepted this request</Text>
            </View>
            
            {/* Action buttons row */}
            <View style={styles.acceptedActionsRow}>
              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => handleCompleteService(request)}
              >
                <Icon name="lock" size={16} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>Enter OTP</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cancelRequestButton}
                onPress={() => handleCancelRequest(request)}
              >
                <Icon name="close" size={16} color="#EF4444" />
                <Text style={styles.cancelRequestButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.completeHint}>
              Get the 6-digit OTP from the customer to mark service as complete
            </Text>
          </View>
        )}

        {request.status === 'completed' && (
          <View style={styles.completedBanner}>
            <Icon name="celebration" size={24} color="#10B981" />
            <Text style={styles.completedText}>Service Completed</Text>
            {request.completedAt && (
              <Text style={styles.completedDate}>
                {formatDate(request.completedAt)}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="inbox" size={64} color="#9CA3AF" />
      <Text style={styles.emptyTitle}>No Requests Yet</Text>
      <Text style={styles.emptyText}>
        You haven't received any service requests yet.{'\n'}
        Check back later or ensure your profile is complete.
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={() => fetchRequests()}>
        <Icon name="refresh" size={18} color="#FFFFFF" />
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render stats header
   */
  const renderStatsHeader = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.pending || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.accepted || 0}</Text>
          <Text style={styles.statLabel}>Accepted</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.completed || 0}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, styles.earningsValue]}>
            ₹{stats.totalEarnings || 0}
          </Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
      </View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      </View>
    );
  }

  // No provider ID
  if (!providerId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Icon name="warning" size={48} color="#F59E0B" />
          <Text style={styles.errorText}>Profile Not Loaded</Text>
          <Text style={styles.errorSubtext}>
            Your provider profile could not be loaded.{'\n\n'}
            This usually happens if you logged in before your profile was synced.{'\n\n'}
            Please logout and login again, or try re-registering as a provider.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Service Requests</Text>
        <TouchableOpacity
          style={styles.headerRefreshButton}
          onPress={() => fetchRequests()}
          disabled={isLoading}
        >
          <Icon name="refresh" size={16} color="#007AFF" />
          <Text style={styles.headerRefreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {renderStatsHeader()}

      {/* Request List */}
      <FlatList
        data={requests}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        renderItem={renderRequestCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      />

      {/* OTP Verification Modal */}
      <Modal
        visible={otpModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isVerifyingOtp) {
            setOtpModalVisible(false);
            setOtpInput('');
            setOtpError('');
            setSelectedRequest(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Icon name="lock" size={20} color="#007AFF" />
                <Text style={styles.modalTitle}>Complete Service</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  if (!isVerifyingOtp) {
                    setOtpModalVisible(false);
                    setOtpInput('');
                    setOtpError('');
                    setSelectedRequest(null);
                  }
                }}
                disabled={isVerifyingOtp}
              >
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Service Info */}
            {selectedRequest && (
              <View style={styles.modalServiceInfo}>
                <Text style={styles.modalServiceType}>
                  {selectedRequest.serviceType?.replace(/_/g, ' ') || 'Service'}
                </Text>
                <Text style={styles.modalCustomerName}>
                  Customer: {selectedRequest.userName || 'User'}
                </Text>
              </View>
            )}

            {/* OTP Instructions */}
            <View style={styles.otpInstructions}>
              <Icon name="phone" size={24} color="#007AFF" />
              <Text style={styles.otpInstructionText}>
                Ask the customer for the 6-digit OTP they received via email.
                Enter it below to mark the service as complete.
              </Text>
            </View>

            {/* OTP Input */}
            <View style={styles.otpInputContainer}>
              <TextInput
                style={[styles.otpInput, otpError ? styles.otpInputError : null]}
                value={otpInput}
                onChangeText={(text) => {
                  // Only allow digits and max 6 characters
                  const cleanText = text.replace(/[^0-9]/g, '').slice(0, 6);
                  setOtpInput(cleanText);
                  setOtpError('');
                }}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                maxLength={6}
                editable={!isVerifyingOtp}
                autoFocus={true}
              />
              {otpError ? (
                <Text style={styles.otpErrorText}>{otpError}</Text>
              ) : null}
            </View>

            {/* OTP Digits Display */}
            <View style={styles.otpDotsContainer}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <View
                  key={index}
                  style={[
                    styles.otpDot,
                    otpInput.length > index ? styles.otpDotFilled : null,
                  ]}
                >
                  <Text style={styles.otpDotText}>
                    {otpInput[index] || ''}
                  </Text>
                </View>
              ))}
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              style={[
                styles.verifyButton,
                otpInput.length !== 6 || isVerifyingOtp
                  ? styles.verifyButtonDisabled
                  : null,
              ]}
              onPress={handleVerifyOtp}
              disabled={otpInput.length !== 6 || isVerifyingOtp}
            >
              {isVerifyingOtp ? (
                <View style={styles.verifyButtonContent}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.verifyButtonText}>Verifying...</Text>
                </View>
              ) : (
                <View style={styles.verifyButtonContent}>
                  <Icon name="check" size={18} color="#FFFFFF" />
                  <Text style={styles.verifyButtonText}>Verify & Complete</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Help Text */}
            <View style={styles.modalHelpTextRow}>
              <Icon name="lightbulb" size={16} color="#F59E0B" />
              <Text style={styles.modalHelpText}>
                The OTP was sent to the customer's registered email when you accepted the request.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  headerRefreshButton: {
    backgroundColor: '#e8f4ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerRefreshText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  earningsValue: {
    color: '#28a745',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  requestTime: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  detailsSection: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  descriptionContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  descriptionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  acceptButton: {
    backgroundColor: '#28a745',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: '#ccc',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptedBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  acceptedText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc3545',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
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
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Accepted Request Section Styles
  acceptedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8f5e9',
  },
  acceptedBanner: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  acceptedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    textAlign: 'center',
  },
  completeButton: {
    flex: 2,
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  completeHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Accepted actions row
  acceptedActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  cancelRequestButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRequestButtonText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '700',
  },
  // Location section styles
  locationSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 4,
  },
  directionsButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Completed Request Styles
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e9',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  completedIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  completedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2e7d32',
  },
  completedDate: {
    fontSize: 12,
    color: '#4caf50',
    marginTop: 4,
    textAlign: 'center',
  },
  // OTP Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  modalServiceInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  modalServiceType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  modalCustomerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  otpInstructions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  otpInstructionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  otpInstructionText: {
    flex: 1,
    fontSize: 14,
    color: '#1565c0',
    lineHeight: 20,
  },
  otpInputContainer: {
    marginBottom: 16,
  },
  otpInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    color: '#1a1a1a',
  },
  otpInputError: {
    borderColor: '#dc3545',
    backgroundColor: '#fff5f5',
  },
  otpErrorText: {
    color: '#dc3545',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  otpDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
  },
  otpDot: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDotFilled: {
    borderColor: '#28a745',
    backgroundColor: '#e8f5e9',
  },
  otpDotText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#28a745',
  },
  verifyButton: {
    backgroundColor: '#28a745',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  verifyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalHelpText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    flex: 1,
  },
  modalHelpTextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  acceptButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e8f4ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  completeButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelRequestButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
});

export default ProviderRequestsScreen;
