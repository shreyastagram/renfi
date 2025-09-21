import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import socketService from '../utils/socket';
import { providerStorage } from '../utils/providerStorage';
import { formatDistance } from '../utils/locationUtils';
import liveLocationService from '../utils/liveLocationService';

// Utility functions for distance-based features
const calculateRequestPriority = (distance) => {
  if (!distance) return 'normal';
  if (distance <= 0.5) return 'urgent';
  if (distance <= 1) return 'high';
  if (distance <= 2) return 'medium';
  return 'low';
};

const calculateTravelTime = (distance) => {
  if (!distance) return null;
  // Assume 30 km/h average speed in urban areas
  const timeInHours = distance / 30;
  const timeInMinutes = Math.round(timeInHours * 60);
  return timeInMinutes < 60 ? `${timeInMinutes}min` : `${Math.round(timeInHours * 10) / 10}h`;
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'urgent': return '#FF1744';
    case 'high': return '#FF9800';
    case 'medium': return '#2196F3';
    case 'low': return '#4CAF50';
    default: return '#9E9E9E';
  }
};

const getPriorityIcon = (priority) => {
  switch (priority) {
    case 'urgent': return '🚨';
    case 'high': return '⚡';
    case 'medium': return '📍';
    case 'low': return '📌';
    default: return '📋';
  }
};

const ProviderDashboard = ({ navigation }) => {
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [providerProfile, setProviderProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  
  // 🔧 NEW: Live location tracking state
  const [isLocationTracking, setIsLocationTracking] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);

  useEffect(() => {
    // Check socket connection
    setIsSocketConnected(socketService.getConnectionStatus());

    // Fetch provider profile on load
    fetchProviderProfile();

    // Listen for incoming service requests
    socketService.onServiceRequest((requestData) => {
      console.log('📩 Incoming service request:', requestData);
      console.log('� DEBUGGING - All fields in request:');
      console.log('  - distance:', requestData.distance);
      console.log('  - userDistance:', requestData.userDistance);
      console.log('  - searchRadius:', requestData.searchRadius);
      console.log('  - location:', requestData.location);
      console.log('  - userLocation:', requestData.userLocation);
      console.log('  - providerId:', requestData.providerId);
      console.log('📍 RAW REQUEST DATA:', JSON.stringify(requestData, null, 2));
      
      // Enhance request with distance-based priority
      const enhancedRequest = {
        ...requestData,
        priority: calculateRequestPriority(requestData.distance),
        distanceDisplay: requestData.userDistance || (requestData.distance ? `${requestData.distance}km away` : 'Distance unknown'),
        isUrgent: requestData.distance && requestData.distance <= 0.5, // Within 500m
        isNearby: requestData.distance && requestData.distance <= 1,   // Within 1km
        estimatedTravelTime: requestData.distance ? calculateTravelTime(requestData.distance) : null
      };
      
      // Sort requests by distance when adding new ones
      setIncomingRequests(prev => {
        const updated = [...prev, enhancedRequest];
        return updated.sort((a, b) => {
          // Prioritize by distance (closest first), then by timestamp
          const distanceA = a.distance || 999;
          const distanceB = b.distance || 999;
          if (distanceA !== distanceB) {
            return distanceA - distanceB;
          }
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
      });
      
      // Enhanced notification with distance information
      const locationText = requestData.location?.latitude && requestData.location?.longitude 
        ? `${requestData.location.latitude.toFixed(4)}, ${requestData.location.longitude.toFixed(4)}`
        : 'Location unavailable';
      
      const distanceInfo = requestData.distance 
        ? ` (${requestData.distance}km away)` 
        : '';
      
      const urgencyPrefix = enhancedRequest.isUrgent ? '🚨 URGENT: ' : 
                           enhancedRequest.isNearby ? '⚡ NEARBY: ' : '';
      
      Alert.alert(
        `${urgencyPrefix}New Service Request!`,
        `Service: ${requestData.serviceType}\nLocation: ${locationText}${distanceInfo}`,
        [{ text: 'View Dashboard', onPress: () => {} }],
      );
    });

    // Listen for socket connection status
    const socket = socketService.getSocket();
    if (socket) {
      socket.on('connect', () => setIsSocketConnected(true));
      socket.on('disconnect', () => setIsSocketConnected(false));
    }

    return () => {
      socketService.removeAllListeners('incomingServiceRequest');
    };
  }, []);

  // 🔧 NEW: Live location tracking management
  useEffect(() => {
    // Resume location tracking if it was active
    liveLocationService.resumeTrackingIfNeeded();
    
    // Set up location update listeners
    socketService.onLocationUpdateConfirmed((data) => {
      console.log('📍 Location update confirmed:', data);
      if (data.success) {
        setLastLocationUpdate(new Date().toISOString());
      } else {
        console.error('❌ Location update failed:', data.error);
      }
    });

    // Listen for new providers coming in range during active requests
    socketService.onNewProviderInRange((data) => {
      console.log('🎯 New provider in range notification:', data);
      // Could show notification about new opportunities
    });

    // Listen for request cancellations
    socketService.onRequestCancelled((data) => {
      console.log('🚫 Request cancelled:', data);
      
      // Remove the cancelled request from incoming requests
      setIncomingRequests(prev => {
        const updated = prev.filter(request => request.requestId !== data.requestId);
        console.log(`📝 Removed cancelled request ${data.requestId}. Remaining: ${updated.length} requests`);
        return updated;
      });

      // Also remove from responded requests if exists
      setRespondedRequests(prev => {
        const updated = prev.filter(request => request.requestId !== data.requestId);
        return updated;
      });

      // Show notification that request was cancelled
      Alert.alert(
        'Request Cancelled',
        `Service request was cancelled by the user.`,
        [{ text: 'OK' }]
      );
    });

    // Check current tracking status
    const trackingStatus = liveLocationService.getTrackingStatus();
    setIsLocationTracking(trackingStatus.isTracking);
    if (trackingStatus.lastLocation) {
      setLastLocationUpdate(trackingStatus.lastLocation.timestamp);
    }

    return () => {
      // Clean up listeners but don't stop tracking
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('locationUpdateConfirmed');
        socket.off('newProviderInRange');
        socket.off('requestCancelled');
      }
    };
  }, []);

  // 🔧 NEW: Toggle online/offline status with location tracking
  const toggleOnlineStatus = async () => {
    const providerId = await providerStorage.getProviderId();
    
    if (!providerId) {
      Alert.alert('Error', 'Provider ID not found. Please login again.');
      return;
    }

    if (!isOnline) {
      // Going online - start location tracking
      Alert.alert(
        'Go Online',
        'This will start sharing your live location with customers for better service matching. Continue?',
        [
          { text: 'Cancel' },
          { 
            text: 'Go Online', 
            onPress: async () => {
              console.log('🟢 Provider going online with live location');
              
              const success = await liveLocationService.startTracking(providerId);
              if (success) {
                setIsOnline(true);
                setIsLocationTracking(true);
                
                // Notify backend about online status
                socketService.getSocket()?.emit('providerStatusUpdate', {
                  providerId,
                  isAvailable: true,
                  timestamp: new Date().toISOString()
                });
                
                Alert.alert('Online', 'You are now online and sharing live location!');
              } else {
                Alert.alert('Error', 'Failed to start location tracking');
              }
            }
          }
        ]
      );
    } else {
      // Going offline - stop location tracking
      Alert.alert(
        'Go Offline',
        'This will stop sharing your location and you won\'t receive new service requests. Continue?',
        [
          { text: 'Cancel' },
          { 
            text: 'Go Offline', 
            onPress: async () => {
              console.log('🔴 Provider going offline');
              
              await liveLocationService.stopTracking();
              setIsOnline(false);
              setIsLocationTracking(false);
              setLastLocationUpdate(null);
              
              // Notify backend about offline status
              socketService.getSocket()?.emit('providerStatusUpdate', {
                providerId,
                isAvailable: false,
                timestamp: new Date().toISOString()
              });
              
              Alert.alert('Offline', 'You are now offline and not receiving requests.');
            }
          }
        ]
      );
    }
  };

  // Fetch provider profile to check completion status
  const fetchProviderProfile = async () => {
    try {
      setProfileLoading(true);
      
      // Get real provider ID from storage
      const providerId = await providerStorage.getProviderId();
      
      if (!providerId) {
        console.log('❌ No provider ID found - redirecting to login');
        navigation.replace('ProviderLoginSignup', { mode: 'login' });
        return;
      }
      
      console.log('🔍 Fetching profile for provider ID:', providerId);
      
      const response = await fetch(`http://10.0.2.2:5050/auth/provider/profile/${providerId}`);
      const data = await response.json();
      
      if (data.success) {
        setProviderProfile(data.data);
        console.log('✅ Provider profile loaded:', data.data);
        
        // Also update stored provider data
        await providerStorage.saveProviderData(data.data);
      } else {
        console.log('❌ Failed to load provider profile:', data.message);
        // If profile doesn't exist, redirect to profile setup
        if (data.message.includes('not found')) {
          navigation.replace('ProviderProfileSetup', {
            providerId: providerId,
            isEditing: false
          });
        }
      }
    } catch (error) {
      console.error('❌ Error fetching provider profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const editProfile = async () => {
    const providerId = await providerStorage.getProviderId();
    
    if (providerId && providerProfile) {
      navigation.navigate('ProviderProfileSetup', {
        providerId: providerId,
        isEditing: true,
        existingProfile: providerProfile
      });
    } else {
      Alert.alert('Error', 'Unable to edit profile. Please login again.');
    }
  };

  const handleRequestResponse = async (request, response) => {
    console.log('🔧 ProviderDashboard: Handling request response:', { requestId: request.requestId, response });
    setSelectedRequest(request);
    if (response === 'accept') {
      setShowResponseModal(true);
    } else {
      // Direct reject
      await respondToRequest(request.requestId, 'reject', null);
    }
  };

  const respondToRequest = async (requestId, response, estimatedTime = null) => {
    console.log('🔧 ProviderDashboard: Responding to request:', { requestId, response, estimatedTime });
    
    // Get real provider ID from storage
    const realProviderId = await providerStorage.getProviderId();
    
    if (!realProviderId) {
      Alert.alert('Error', 'Provider ID not found. Please login again.');
      navigation.replace('ProviderLoginSignup', { mode: 'login' });
      return;
    }
    
    // Use real provider data from profile or storage
    const providerData = {
      providerId: realProviderId,
      providerName: providerProfile?.name || 'Provider',
      providerPhone: providerProfile?.phone || 'Not provided',
      providerRating: providerProfile?.rating || 0,
      providerExperience: providerProfile?.experience || 'Not specified',
      serviceCategories: providerProfile?.serviceCategories || []
    };
    
    console.log('📤 ProviderDashboard: Sending response with REAL provider data:', providerData);
    console.log('📤 ProviderDashboard: Final payload will be:', {
      requestId,
      response,
      providerId: providerData.providerId,
      estimatedTime,
      ...providerData
    });
    
    socketService.respondToRequest(
      requestId, 
      response, 
      providerData.providerId, 
      estimatedTime,
      providerData // Send real provider info
    );
    
    // Remove from pending requests
    setIncomingRequests(prev => prev.filter(req => req.requestId !== requestId));
    
    Alert.alert(
      'Response Sent',
      `You have ${response}ed the service request.`,
      [{ text: 'OK' }],
    );
    
    setShowResponseModal(false);
    setSelectedRequest(null);
    setEstimatedTime('');
  };

  const submitAcceptance = async () => {
    if (!estimatedTime) {
      Alert.alert('Error', 'Please provide estimated time');
      return;
    }
    await respondToRequest(selectedRequest.requestId, 'accept', estimatedTime);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Provider Dashboard</Text>
        <View style={styles.statusIndicator}>
          <Text style={[styles.statusText, { color: isSocketConnected ? '#4CAF50' : '#F44336' }]}>
            {isSocketConnected ? '🟢 Online' : '🔴 Offline'}
          </Text>
        </View>
      </View>

      {/* Profile Status Section */}
      {!profileLoading && (
        <View style={styles.profileSection}>
          {providerProfile && providerProfile.serviceCategories && providerProfile.serviceCategories.length > 0 ? (
            // Profile Complete
            <View style={styles.profileCompleteCard}>
              <View style={styles.profileHeader}>
                <Text style={styles.profileName}>{providerProfile.name || 'Provider'}</Text>
                <TouchableOpacity style={styles.editButton} onPress={editProfile}>
                  <Text style={styles.editButtonText}>✏️ Edit</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.profileDetails}>
                📞 {providerProfile.phone} | 🛠️ {providerProfile.experience}
              </Text>
              <View style={styles.servicesContainer}>
                <Text style={styles.servicesTitle}>Services:</Text>
                <View style={styles.serviceChips}>
                  {providerProfile.serviceCategories.map((category) => (
                    <View key={category} style={styles.serviceChip}>
                      <Text style={styles.serviceChipText}>{category}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            // Profile Incomplete
            <View style={styles.profileIncompleteCard}>
              <Text style={styles.incompleteTitle}>⚠️ Complete Your Profile</Text>
              <Text style={styles.incompleteMessage}>
                Set up your service specializations to start receiving targeted requests
              </Text>
              <TouchableOpacity 
                style={styles.completeProfileButton}
                onPress={async () => {
                  const providerId = await providerStorage.getProviderId();
                  navigation.navigate('ProviderProfileSetup', {
                    providerId: providerId,
                    isEditing: false
                  });
                }}
              >
                <Text style={styles.completeProfileButtonText}>Complete Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 🔧 NEW: Online/Offline Status & Live Location Toggle */}
      <View style={styles.statusSection}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Service Status</Text>
            <TouchableOpacity 
              style={[styles.statusToggle, { backgroundColor: isOnline ? '#4CAF50' : '#757575' }]}
              onPress={toggleOnlineStatus}
            >
              <Text style={styles.statusToggleText}>
                {isOnline ? '🟢 ONLINE' : '⚫ OFFLINE'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.statusDetails}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>📍 Location Tracking:</Text>
              <Text style={[styles.statusValue, { color: isLocationTracking ? '#4CAF50' : '#757575' }]}>
                {isLocationTracking ? 'Active' : 'Inactive'}
              </Text>
            </View>
            
            {lastLocationUpdate && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>🕒 Last Update:</Text>
                <Text style={styles.statusValue}>
                  {new Date(lastLocationUpdate).toLocaleTimeString()}
                </Text>
              </View>
            )}
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>🔗 Connection:</Text>
              <Text style={[styles.statusValue, { color: isSocketConnected ? '#4CAF50' : '#F44336' }]}>
                {isSocketConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
          </View>
          
          {isOnline && isLocationTracking && (
            <View style={styles.onlineIndicator}>
              <Text style={styles.onlineText}>
                ✨ You're live! Customers can find you based on your current location.
              </Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Pending Requests ({incomingRequests.length})</Text>
      
      <ScrollView style={styles.requestsList}>
        {incomingRequests.length === 0 ? (
          <Text style={styles.noRequestsText}>No pending service requests</Text>
        ) : (
          incomingRequests.map((request) => (
            <View key={request.requestId} style={[
              styles.requestCard,
              { borderLeftColor: getPriorityColor(request.priority) }
            ]}>
              {/* Priority and Distance Header */}
              <View style={styles.requestHeader}>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityIcon}>{getPriorityIcon(request.priority)}</Text>
                  <Text style={[styles.priorityText, { color: getPriorityColor(request.priority) }]}>
                    {request.priority?.toUpperCase() || 'NORMAL'}
                  </Text>
                </View>
                {request.distanceDisplay && (
                  <View style={[styles.distanceBadge, { 
                    backgroundColor: request.isUrgent ? '#FFEBEE' : request.isNearby ? '#E8F5E8' : '#F5F5F5' 
                  }]}>
                    <Text style={[styles.distanceText, {
                      color: request.isUrgent ? '#C62828' : request.isNearby ? '#2E7D32' : '#666'
                    }]}>
                      📍 {request.distanceDisplay}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.serviceHeader}>
                <Text style={styles.serviceIcon}>{request.serviceIcon || '🔧'}</Text>
                <View style={styles.serviceInfo}>
                  <Text style={styles.requestType}>{request.serviceName || request.serviceType}</Text>
                  <Text style={styles.serviceDescription}>{request.serviceDescription}</Text>
                </View>
              </View>
              
              <Text style={styles.requestDescription}>{request.description}</Text>
              
              {/* Enhanced location and travel info */}
              <View style={styles.locationInfoContainer}>
                <Text style={styles.requestLocation}>
                  📍 {request.location?.latitude?.toFixed(4)}, {request.location?.longitude?.toFixed(4)}
                </Text>
                {request.estimatedTravelTime && (
                  <Text style={styles.travelTime}>
                    🚗 Est. travel: {request.estimatedTravelTime}
                  </Text>
                )}
              </View>
              
              <View style={styles.timeInfoContainer}>
                <Text style={styles.requestTime}>
                  🕒 {new Date(request.timestamp || Date.now()).toLocaleTimeString()}
                </Text>
                {request.searchRadius && (
                  <Text style={styles.searchRadius}>
                    🔍 Search radius: {request.searchRadius}km
                  </Text>
                )}
              </View>
              
              <Text style={styles.requestUser}>
                👤 User: {request.userId}
              </Text>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.acceptButton]}
                  onPress={() => handleRequestResponse(request, 'accept')}
                >
                  <Text style={styles.buttonText}>✅ Accept</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.button, styles.rejectButton]}
                  onPress={() => handleRequestResponse(request, 'reject')}
                >
                  <Text style={styles.buttonText}>❌ Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Response Modal */}
      <Modal
        visible={showResponseModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowResponseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Accept Service Request</Text>
            <Text style={styles.modalSubtitle}>Provide estimated completion time:</Text>
            
            <TextInput
              style={styles.input}
              placeholder="e.g., 30 minutes, 1 hour"
              value={estimatedTime}
              onChangeText={setEstimatedTime}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowResponseModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={submitAcceptance}
              >
                <Text style={styles.buttonText}>Confirm Accept</Text>
              </TouchableOpacity>
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
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  profileSection: {
    marginBottom: 20,
  },
  profileCompleteCard: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  profileIncompleteCard: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  editButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  editButtonText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  profileDetails: {
    fontSize: 14,
    color: '#388e3c',
    marginBottom: 12,
  },
  servicesContainer: {
    marginTop: 8,
  },
  servicesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 6,
  },
  serviceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  serviceChip: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  serviceChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  incompleteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  incompleteMessage: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  completeProfileButton: {
    backgroundColor: '#ffc107',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  completeProfileButtonText: {
    color: '#212529',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  requestsList: {
    flex: 1,
  },
  noRequestsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 50,
  },
  requestCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#9E9E9E',
  },
  // Enhanced request header with priority and distance
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  distanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  locationInfoContainer: {
    marginBottom: 8,
  },
  timeInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  travelTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  searchRadius: {
    fontSize: 11,
    color: '#888',
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  requestType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  requestDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  requestLocation: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  requestTime: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  requestUser: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
  },
  confirmButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  // 🔧 NEW: Live location status UI styles
  statusSection: {
    marginBottom: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  statusToggleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusDetails: {
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  onlineIndicator: {
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  onlineText: {
    fontSize: 13,
    color: '#2E7D32',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ProviderDashboard;
