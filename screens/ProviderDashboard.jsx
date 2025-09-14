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

const ProviderDashboard = () => {
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [showResponseModal, setShowResponseModal] = useState(false);

  useEffect(() => {
    // Check socket connection
    setIsSocketConnected(socketService.getConnectionStatus());

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

  const handleRequestResponse = (request, response) => {
    setSelectedRequest(request);
    if (response === 'accept') {
      setShowResponseModal(true);
    } else {
      // Direct reject
      respondToRequest(request.requestId, 'reject', null);
    }
  };

  const respondToRequest = (requestId, response, estimatedTime = null) => {
    const providerId = 'dummyProvider123'; // TODO: Get from real auth
    
    socketService.respondToRequest(requestId, response, providerId, estimatedTime);
    
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

  const submitAcceptance = () => {
    if (!estimatedTime) {
      Alert.alert('Error', 'Please provide estimated time');
      return;
    }
    respondToRequest(selectedRequest.requestId, 'accept', estimatedTime);
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

      <Text style={styles.sectionTitle}>Pending Requests ({incomingRequests.length})</Text>
      
      <ScrollView style={styles.requestsList}>
        {incomingRequests.length === 0 ? (
          <Text style={styles.noRequestsText}>No pending service requests</Text>
        ) : (
          incomingRequests.map((request) => (
            <View key={request.requestId} style={styles.requestCard}>
              <Text style={styles.requestType}>{request.serviceType}</Text>
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
  requestType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  requestDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
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
