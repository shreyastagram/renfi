import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Linking,
} from 'react-native';
import socketService from '../utils/socket';
import { providerStorage } from '../utils/providerStorage';
import { formatDistance } from '../utils/locationUtils';

const ProviderHistoryScreen = ({ navigation }) => {
  const [acceptedRequests, setAcceptedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [providerId, setProviderId] = useState(null);
  const [providerToken, setProviderToken] = useState(null);

  useEffect(() => {
    initializeProvider();
  }, []);

  const initializeProvider = async () => {
    try {
      const storedProviderId = await providerStorage.getProviderId();
      const storedToken = await providerStorage.getProviderToken();
      
      if (!storedProviderId || !storedToken) {
        Alert.alert('Authentication Error', 'Please login again', [
          { text: 'OK', onPress: () => navigation.replace('ProviderLoginSignup') }
        ]);
        return;
      }
      
      setProviderId(storedProviderId);
      setProviderToken(storedToken);
      
      // Load data after setting auth info
      loadAcceptedRequests(storedProviderId, storedToken);
    } catch (error) {
      console.error('Error initializing provider:', error);
      Alert.alert('Error', 'Failed to initialize provider data');
    }
  };

  const loadAcceptedRequests = async (pid = providerId, token = providerToken) => {
    try {
      if (!pid || !token) {
        console.warn('Missing provider ID or token for history load');
        return;
      }
      
      setLoading(true);
      const response = await fetch(`http://10.0.2.2:5050/api/provider/accepted-requests/${pid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (response.ok) {
        setAcceptedRequests(data.requests);
      } else {
        if (response.status === 401) {
          Alert.alert('Session Expired', 'Please login again', [
            { text: 'OK', onPress: () => navigation.replace('ProviderLoginSignup') }
          ]);
          return;
        }
        Alert.alert('Error', data.message || 'Failed to load request history');
      }
    } catch (error) {
      console.error('Error loading accepted requests:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAcceptedRequests();
    setRefreshing(false);
  };

  const openRequestDetails = (request) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const openMapsNavigation = (userLat, userLng, userAddress) => {
    if (!userLat || !userLng) {
      Alert.alert('Error', 'User location not available');
      return;
    }

    const destination = `${userLat},${userLng}`;
    const label = encodeURIComponent(userAddress || 'Service Location');
    
    Alert.alert(
      'Open Navigation',
      'Choose your preferred navigation app:',
      [
        {
          text: 'Google Maps',
          onPress: () => {
            const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&destination_place_id=${label}`;
            Linking.openURL(googleMapsUrl);
          }
        },
        {
          text: 'Apple Maps',
          onPress: () => {
            const appleMapsUrl = `http://maps.apple.com/?daddr=${destination}&dirflg=d`;
            Linking.openURL(appleMapsUrl);
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const contactUser = (phone) => {
    if (phone && phone !== 'Not available') {
      const phoneUrl = `tel:${phone}`;
      Linking.openURL(phoneUrl);
    } else {
      Alert.alert('Error', 'User phone number not available');
    }
  };

  const markAsCompleted = async (requestId) => {
    try {
      if (!providerId || !providerToken) {
        Alert.alert('Error', 'Authentication required');
        return;
      }
      
      const response = await fetch(`http://10.0.2.2:5050/api/provider/complete-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${providerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          providerId,
          completedAt: new Date().toISOString()
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        Alert.alert('Success', 'Request marked as completed!');
        loadAcceptedRequests(); // Refresh the list
        setShowDetailsModal(false);
      } else {
        if (response.status === 401) {
          Alert.alert('Session Expired', 'Please login again', [
            { text: 'OK', onPress: () => navigation.replace('ProviderLoginSignup') }
          ]);
          return;
        }
        Alert.alert('Error', data.message || 'Failed to mark as completed');
      }
    } catch (error) {
      console.error('Error marking as completed:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'accepted': return '#2196F3';
      case 'in-progress': return '#FF9800';
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return '✅';
      case 'accepted': return '🔵';
      case 'in-progress': return '🔄';
      default: return '⏳';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDistance = (userLat, userLng, providerLat, providerLng) => {
    if (!userLat || !userLng || !providerLat || !providerLng) return 'N/A';
    return formatDistance(userLat, userLng, providerLat, providerLng);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading Request History...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Service History</Text>
        <Text style={styles.headerSubtitle}>
          {acceptedRequests.length} total requests
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {acceptedRequests.filter(r => r.status === 'completed').length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {acceptedRequests.filter(r => r.status === 'accepted' || r.status === 'in-progress').length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {acceptedRequests.length > 0 ? 
              (acceptedRequests.filter(r => r.userRating).reduce((acc, r) => acc + r.userRating, 0) / 
               acceptedRequests.filter(r => r.userRating).length).toFixed(1) : 'N/A'}
          </Text>
          <Text style={styles.statLabel}>Avg Rating</Text>
        </View>
      </View>

      {/* Request List */}
      <View style={styles.requestsSection}>
        {acceptedRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No accepted requests yet</Text>
            <Text style={styles.emptySubtext}>Accepted requests will appear here</Text>
          </View>
        ) : (
          acceptedRequests.map((request, index) => (
            <TouchableOpacity
              key={request.requestId || index}
              style={styles.requestItem}
              onPress={() => openRequestDetails(request)}
            >
              <View style={styles.requestHeader}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceIcon}>{request.serviceIcon}</Text>
                  <View>
                    <Text style={styles.serviceName}>{request.serviceName}</Text>
                    <Text style={styles.requestDate}>{formatDate(request.acceptedAt)}</Text>
                  </View>
                </View>
                <View style={styles.statusContainer}>
                  <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                    {getStatusIcon(request.status)} {request.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  👤 {request.user.name}
                </Text>
                <Text style={styles.userDetails}>
                  📞 {request.user.phone} • 📍 {calculateDistance(
                    request.user.lat, 
                    request.user.lng, 
                    request.provider?.lat, 
                    request.provider?.lng
                  )}
                </Text>
              </View>
              
              <View style={styles.requestDetails}>
                <Text style={styles.requestDescription} numberOfLines={2}>
                  {request.description}
                </Text>
                {request.estimatedTime && (
                  <Text style={styles.estimatedTime}>
                    ⏱️ {request.estimatedTime}
                  </Text>
                )}
              </View>

              {request.status !== 'completed' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.navigationButton}
                    onPress={() => openMapsNavigation(
                      request.user.lat, 
                      request.user.lng, 
                      request.user.address
                    )}
                  >
                    <Text style={styles.navigationButtonText}>🗺️ Navigate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={() => markAsCompleted(request.requestId)}
                  >
                    <Text style={styles.completeButtonText}>✅ Complete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Request Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Details</Text>
            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {selectedRequest && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Service Information</Text>
                <Text style={styles.modalServiceName}>
                  {selectedRequest.serviceIcon} {selectedRequest.serviceName}
                </Text>
                <Text style={styles.modalDescription}>{selectedRequest.description}</Text>
                <Text style={styles.modalDate}>
                  Accepted: {formatDate(selectedRequest.acceptedAt)}
                </Text>
                <Text style={[styles.modalStatus, { color: getStatusColor(selectedRequest.status) }]}>
                  Status: {getStatusIcon(selectedRequest.status)} {selectedRequest.status.toUpperCase()}
                </Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Customer Details</Text>
                <Text style={styles.modalUserName}>{selectedRequest.user.name}</Text>
                <Text style={styles.modalUserInfo}>
                  📞 {selectedRequest.user.phone}
                </Text>
                <Text style={styles.modalUserInfo}>
                  📍 {selectedRequest.user.address || 'Location provided'}
                </Text>
                <Text style={styles.modalUserInfo}>
                  📏 Distance: {calculateDistance(
                    selectedRequest.user.lat, 
                    selectedRequest.user.lng, 
                    selectedRequest.provider?.lat, 
                    selectedRequest.provider?.lng
                  )}
                </Text>
                
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    style={styles.modalContactButton}
                    onPress={() => contactUser(selectedRequest.user.phone)}
                  >
                    <Text style={styles.modalContactButtonText}>📞 Call Customer</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.modalNavigateButton}
                    onPress={() => openMapsNavigation(
                      selectedRequest.user.lat, 
                      selectedRequest.user.lng, 
                      selectedRequest.user.address
                    )}
                  >
                    <Text style={styles.modalNavigateButtonText}>🗺️ Navigate</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {selectedRequest.estimatedTime && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Service Details</Text>
                  <Text style={styles.modalInfo}>
                    ⏱️ Estimated Time: {selectedRequest.estimatedTime}
                  </Text>
                </View>
              )}

              {selectedRequest.completedAt && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Completion</Text>
                  <Text style={styles.modalInfo}>
                    ✅ Completed: {formatDate(selectedRequest.completedAt)}
                  </Text>
                  {selectedRequest.userRating && (
                    <Text style={styles.modalInfo}>
                      ⭐ Customer Rating: {selectedRequest.userRating}/5
                    </Text>
                  )}
                </View>
              )}

              {selectedRequest.status !== 'completed' && (
                <View style={styles.modalSection}>
                  <TouchableOpacity
                    style={styles.modalCompleteButton}
                    onPress={() => markAsCompleted(selectedRequest.requestId)}
                  >
                    <Text style={styles.modalCompleteButtonText}>✅ Mark as Completed</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  requestsSection: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  requestItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  requestDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  userInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  userDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  requestDetails: {
    marginTop: 8,
  },
  requestDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  estimatedTime: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  navigationButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  navigationButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  completeButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  modalServiceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  modalDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalStatus: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalUserName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalUserInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalButtonRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  modalContactButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  modalContactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalNavigateButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  modalNavigateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalCompleteButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
    alignSelf: 'center',
  },
  modalCompleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});

export default ProviderHistoryScreen;