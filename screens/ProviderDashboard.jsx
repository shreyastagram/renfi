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

const ProviderDashboard = ({ navigation }) => {
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [providerProfile, setProviderProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    // Check socket connection
    setIsSocketConnected(socketService.getConnectionStatus());

    // Fetch provider profile on load
    fetchProviderProfile();

    // Listen for incoming service requests
    socketService.onServiceRequest((requestData) => {
      console.log('📩 Incoming service request:', requestData);
      console.log('📍 Location data:', requestData.location); // Check what backend sends
      console.log('📍 userLocation data:', requestData.userLocation); // Check if this exists
      setIncomingRequests(prev => [...prev, requestData]);
      
      // ✅ FIXED: Use 'location' field that backend actually sends
      const locationText = requestData.location?.latitude && requestData.location?.longitude 
        ? `${requestData.location.latitude}, ${requestData.location.longitude}`
        : 'Location unavailable';
      
      // Show notification
      Alert.alert(
        'New Service Request!',
        `Service: ${requestData.serviceType}\nLocation: ${locationText}`,
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

      <Text style={styles.sectionTitle}>Pending Requests ({incomingRequests.length})</Text>
      
      <ScrollView style={styles.requestsList}>
        {incomingRequests.length === 0 ? (
          <Text style={styles.noRequestsText}>No pending service requests</Text>
        ) : (
          incomingRequests.map((request) => (
            <View key={request.requestId} style={styles.requestCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceIcon}>{request.serviceIcon || '🔧'}</Text>
                <View style={styles.serviceInfo}>
                  <Text style={styles.requestType}>{request.serviceName || request.serviceType}</Text>
                  <Text style={styles.serviceDescription}>{request.serviceDescription}</Text>
                </View>
              </View>
              
              <Text style={styles.requestDescription}>{request.description}</Text>
              <Text style={styles.requestLocation}>
                📍 {request.location?.latitude?.toFixed(4)}, {request.location?.longitude?.toFixed(4)}
              </Text>
              <Text style={styles.requestTime}>
                🕒 {new Date(request.timestamp || Date.now()).toLocaleTimeString()}
              </Text>
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
});

export default ProviderDashboard;
