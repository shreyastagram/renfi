import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  PermissionsAndroid,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import socketService from '../utils/socket';

MapboxGL.setAccessToken(
  'MAPBOX_TOKEN_REMOVED',
);

const MapScreen = ({ navigation, route }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [realUserId, setRealUserId] = useState(null);
  const [statusCheckCount, setStatusCheckCount] = useState(0); // To prevent infinite polling
  const [selectedService, setSelectedService] = useState(null); // New state for selected service
  const [requestStatus, setRequestStatus] = useState('idle'); // 'idle', 'sending', 'pending', 'accepted', 'rejected'
  const [currentRequest, setCurrentRequest] = useState(null); // Store current request data
  const [acceptedProvider, setAcceptedProvider] = useState(null); // Store provider who accepted
  const [showRequestModal, setShowRequestModal] = useState(false); // Show request status modal
  const [currentRequestId, setCurrentRequestId] = useState(null); // Track current request ID
  const cameraRef = useRef(null);
  
  // Get real user ID from socket service or use dummy as fallback
  const userId = realUserId || socketService.getCurrentUserId() || 'dummyUser123';

  useEffect(() => {
    requestLocationPermission();

    // Handle selected service from navigation
    if (route.params?.selectedService) {
      setSelectedService(route.params.selectedService);
      console.log('Service selected:', route.params.selectedService);
    }

    // ✅ DYNAMIC STATUS UPDATE: Function to check and update connection status
    const updateConnectionStatus = () => {
      const currentStatus = socketService.getConnectionStatus();
      setIsSocketConnected(currentStatus);
      console.log('🔄 MapScreen: Connection status updated to:', currentStatus);
    };

    // Initial status check
    updateConnectionStatus();

    // ✅ REAL-TIME STATUS UPDATES: Listen for status changes from socket service
    const handleStatusChange = (connected) => {
      console.log('🔄 MapScreen: Received status change event:', connected);
      setIsSocketConnected(connected);
    };

    const handleRegistration = (data) => {
      console.log('✅ MapScreen: Registration confirmed:', data);
      setIsSocketConnected(true);
      setRealUserId(data.userId);
      console.log('🔄 Socket status updated to connected, real userId:', data.userId);
    };

    // Subscribe to socket service events
    socketService.on('statusChange', handleStatusChange);
    socketService.on('registered', handleRegistration);

    // Set up socket listeners - this will work even if socket connects later
    const setupSocketListeners = () => {
      const socket = socketService.getSocket();
      if (socket) {
        console.log('🔧 Setting up provider response listeners in MapScreen');
        
        // Enhanced provider response handler
        const handleProviderResponse = (data) => {
          console.log('🎯 RAW Provider response received in MapScreen:', JSON.stringify(data, null, 2));
          console.log('🎯 Current request ID:', currentRequestId);
          console.log('🎯 Response request ID:', data?.requestId);
          console.log('🎯 Current request status:', requestStatus);
          
          // Ensure we have the response and it matches current request
          if (!data || !data.requestId) {
            console.log('❌ Invalid response format:', data);
            return;
          }
          
          if (data.requestId !== currentRequestId) {
            console.log('⚠️ Response for different request, ignoring');
            console.log('⚠️ Expected:', currentRequestId, 'Received:', data.requestId);
            return;
          }
          
          // Force state update with explicit logging
          console.log('✅ Processing response for current request');
          
          if (data.response === 'accept') {
            console.log('🎉 PROVIDER ACCEPTED - Updating UI');
            
            // Update state immediately
            setRequestStatus('accepted');
            setAcceptedProvider({
              providerId: data.providerId,
              estimatedTime: data.estimatedTime || '30 minutes',
              providerName: data.providerName || `Provider ${data.providerId}`,
              providerPhone: data.providerPhone || 'Not available',
              providerRating: data.providerRating || 'Not rated',
              providerExperience: data.providerExperience || 'Not specified',
              timestamp: data.timestamp || new Date().toISOString()
            });
            setShowRequestModal(true);
            
            console.log('✅ State updated to accepted');
            
            // Show success alert
            Alert.alert(
              'Request Accepted! 🎉',
              `${data.providerName || 'A provider'} has accepted your ${selectedService?.name} request and will arrive in ${data.estimatedTime || '30 minutes'}.`,
              [{ text: 'OK' }]
            );
            
          } else if (data.response === 'reject') {
            console.log('❌ PROVIDER REJECTED - Updating UI');
            
            setRequestStatus('rejected');
            setAcceptedProvider(null);
            setShowRequestModal(true);
            
            console.log('✅ State updated to rejected');
            
            // Auto-hide rejection after 5 seconds
            setTimeout(() => {
              setShowRequestModal(false);
              setRequestStatus('idle');
              setCurrentRequest(null);
              setCurrentRequestId(null);
            }, 5000);
            
            // Show rejection alert
            Alert.alert(
              'Request Not Available',
              'No providers are currently available for this service. Please try again later.',
              [
                { text: 'Try Again', onPress: () => {
                  setRequestStatus('idle');
                  setCurrentRequest(null);
                  setCurrentRequestId(null);
                  setShowRequestModal(false);
                }},
                { text: 'Cancel' }
              ]
            );
          }
        };
        
        // Set up the provider response listener
        socketService.onProviderResponse(handleProviderResponse);
        
        // Also listen directly on socket for debugging
        socket.on('providerResponse', (data) => {
          console.log('📡 Direct socket providerResponse received:', data);
          handleProviderResponse(data);
        });
        socket.on('serviceRequestUpdate', (data) => {
          console.log('📡 Direct socket serviceRequestUpdate received:', data);
          handleProviderResponse(data);
        });
        socket.on('requestStatusUpdate', (data) => {
          console.log('📡 Direct socket requestStatusUpdate received:', data);
          handleProviderResponse(data);
        });
        
        console.log('✅ All provider response listeners attached');
      } else {
        console.log('❌ Socket not available for setting up listeners');
      }
    };

    // Set up listeners immediately
    setupSocketListeners();

    // ✅ SMART POLLING FIX: Check connection status periodically but avoid infinite loops
    const statusCheckInterval = setInterval(() => {
      const socket = socketService.getSocket();
      const realStatus = socketService.getConnectionStatus();
      
      // Only update if there's actually a mismatch AND we haven't checked too many times
      if (realStatus !== isSocketConnected && statusCheckCount < 5) {
        console.log('🔄 Status mismatch detected! Real:', realStatus, 'UI:', isSocketConnected, '- Fixing... (attempt', statusCheckCount + 1, ')');
        setIsSocketConnected(realStatus);
        setStatusCheckCount(prev => prev + 1);
        
        // If socket exists and we just connected, re-setup listeners
        if (socket && realStatus && !isSocketConnected) {
          setupSocketListeners();
        }
      } else if (realStatus === isSocketConnected && statusCheckCount > 0) {
        // Reset counter if status is now in sync
        console.log('✅ Status now in sync - resetting check counter');
        setStatusCheckCount(0);
      }
    }, 2000); // Check every 2 seconds (less frequent to reduce spam)

    // Cleanup on component unmount
    return () => {
      // Clear the interval
      clearInterval(statusCheckInterval);
      
      // Remove socket service event listeners
      socketService.off('statusChange', handleStatusChange);
      socketService.off('registered', handleRegistration);
      
      // Remove socket listeners
      socketService.removeAllListeners('providerResponse');
      // Don't disconnect here as user might navigate back
    };
  }, [route.params?.selectedService, currentRequestId]); // Add currentRequestId dependency

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message:
              'This app needs access to your location to show you on the map',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Location permission granted');
          await MapboxGL.requestAndroidLocationPermissions();
        } else {
          console.log('Location permission denied');
        }
      } else {
        // For iOS, MapboxGL will handle permissions
        await MapboxGL.requestAndroidLocationPermissions();
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const getCurrentLocation = () => {
    setIsLocationLoading(true);

    Geolocation.getCurrentPosition(
      position => {
        const { longitude, latitude } = position.coords;
        const location = [longitude, latitude];
        setUserLocation(location);

        // Emit location update to socket server
        if (socketService.getConnectionStatus()) {
          socketService.getSocket().emit('locationUpdate', {
            userId: userId, // Use real user ID
            latitude,
            longitude,
            timestamp: new Date().toISOString(),
          });
          console.log('📍 Location sent to server:', { latitude, longitude });
        }

        // Animate camera to user location with closer zoom
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: location,
            zoomLevel: 18, // Increased zoom for better detail (street level)
            animationDuration: 1500, // Slightly longer animation for smoother UX
          });
        }
        setIsLocationLoading(false);
      },
      error => {
        console.log('Location error:', error);
        setIsLocationLoading(false);
        Alert.alert(
          'Location Error',
          'Unable to get your current location. Please make sure location services are enabled.',
          [{ text: 'OK' }],
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  };

  const sendServiceRequest = () => {
    console.log('🔧 ===== SERVICE REQUEST BUTTON PRESSED =====');
    console.log('🔧 Selected service:', selectedService);
    console.log('🔧 User location:', userLocation);
    console.log('🔧 Socket connected:', socketService.getConnectionStatus());
    console.log('🔧 Using userId:', userId, '(real:', realUserId, ', from socket:', socketService.getCurrentUserId(), ')');
    
    // Check if service is selected
    if (!selectedService) {
      console.log('❌ No service selected - showing service selection');
      Alert.alert(
        'Service Required',
        'Please select a service type first.',
        [
          { 
            text: 'Select Service', 
            onPress: () => navigation.navigate('ServiceSelection') 
          },
          { text: 'Cancel' }
        ]
      );
      return;
    }
    
    if (!userLocation) {
      console.log('❌ No user location - showing alert');
      Alert.alert(
        'Location Required',
        'Please get your location first before requesting a service.',
      );
      return;
    }

    if (!socketService.getConnectionStatus()) {
      console.log('❌ Socket not connected - showing alert');
      Alert.alert(
        'Connection Error',
        'Socket is not connected. Please try again.',
      );
      return;
    }

    // Set status to sending
    setRequestStatus('sending');

    // Generate unique request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('📍 Generated request ID:', requestId);
    setCurrentRequestId(requestId);

    const serviceRequest = {
      userId: userId, // Use real user ID
      userLocation: {
        latitude: userLocation[1],
        longitude: userLocation[0],
      },
      serviceType: selectedService.id, // Use selected service ID
      serviceName: selectedService.name, // Add service name
      serviceIcon: selectedService.icon, // Add service icon
      serviceDescription: selectedService.description, // Add service description
      description: `I need ${selectedService.name} service - ${selectedService.description}`,
      requestId: requestId,
      timestamp: new Date().toISOString(),
    };

    // Store current request
    setCurrentRequest(serviceRequest);

    console.log('📤 About to send service request:');
    console.log('📤 Full payload:', JSON.stringify(serviceRequest, null, 2));
    console.log('📤 Service details:', { 
      type: selectedService.id, 
      name: selectedService.name 
    });
    console.log('📤 Calling socketService.sendServiceRequest...');
    
    socketService.sendServiceRequest(serviceRequest);
    
    // Set status to pending and show modal after a brief delay
    setTimeout(() => {
      setRequestStatus('pending');
      setShowRequestModal(true);
      console.log('⏳ Request status set to pending');
    }, 1000);

    // Auto-timeout after 2 minutes if no response
    setTimeout(() => {
      if (requestStatus === 'pending' && currentRequestId === requestId) {
        console.log('⏰ Request timed out for ID:', requestId);
        setRequestStatus('rejected');
        Alert.alert(
          'Request Timeout',
          'No providers responded to your request. Please try again.',
          [{ text: 'OK', onPress: () => {
            setRequestStatus('idle');
            setCurrentRequest(null);
            setCurrentRequestId(null);
            setShowRequestModal(false);
          }}]
        );
      }
    }, 120000); // 2 minutes
    
    console.log('📤 socketService.sendServiceRequest call completed');
    console.log('🔧 ===== SERVICE REQUEST FUNCTION COMPLETED =====');
  };

  const cancelRequest = () => {
    console.log('🚫 Cancelling request:', currentRequestId);
    setRequestStatus('idle');
    setCurrentRequest(null);
    setCurrentRequestId(null);
    setAcceptedProvider(null);
    setShowRequestModal(false);
  };

  const contactProvider = () => {
    if (acceptedProvider?.providerPhone && acceptedProvider.providerPhone !== 'Not available') {
      Alert.alert(
        'Contact Provider',
        `Call ${acceptedProvider.providerName}?\nPhone: ${acceptedProvider.providerPhone}`,
        [
          { text: 'Cancel' },
          { 
            text: 'Call', 
            onPress: () => {
              // You can implement actual calling functionality here
              console.log('Calling provider:', acceptedProvider.providerPhone);
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Contact Info',
        'Provider contact information is not available.',
        [{ text: 'OK' }]
      );
    }
  };

  const startNewRequest = () => {
    console.log('🔄 Starting new request');
    setRequestStatus('idle');
    setCurrentRequest(null);
    setCurrentRequestId(null);
    setAcceptedProvider(null);
    setShowRequestModal(false);
  };

  // Debug function to test provider responses
  const simulateProviderAccept = () => {
    if (currentRequest) {
      console.log('🧪 Simulating provider acceptance for request:', currentRequest.requestId);
      const mockResponse = {
        requestId: currentRequest.requestId,
        providerId: 'test_provider_123',
        response: 'accept',
        estimatedTime: '25 minutes',
        providerName: 'Test Provider',
        providerPhone: '+1-555-TEST',
        providerRating: 4.9,
        providerExperience: '3 years',
        timestamp: new Date().toISOString()
      };
      
      // Directly call the handler to test UI update
      console.log('🧪 Triggering provider response handler');
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('providerResponse', mockResponse);
      }
    } else {
      Alert.alert('Debug', 'No active request to test with');
    }
  };

  const debugCurrentState = () => {
    console.log('🐛 CURRENT STATE DEBUG:');
    console.log('  - requestStatus:', requestStatus);
    console.log('  - currentRequest:', currentRequest);
    console.log('  - isSocketConnected:', isSocketConnected);
    console.log('  - acceptedProvider:', acceptedProvider);
    console.log('  - showRequestModal:', showRequestModal);
    console.log('  - selectedService:', selectedService);
  };

  return (
    <View style={styles.container}>
      <MapboxGL.MapView style={styles.map}>
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={14}
          centerCoordinate={userLocation || [77.5946, 12.9716]} // Default to Bangalore if no user location
        />
        <MapboxGL.UserLocation visible={true} />
      </MapboxGL.MapView>

      {/* Socket Connection Status */}
      <View style={styles.statusIndicator}>
        <Text
          style={[
            styles.statusText,
            { color: isSocketConnected ? '#4CAF50' : '#F44336' },
          ]}
        >
          {isSocketConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </Text>
      </View>

      {/* Selected Service Indicator */}
      {selectedService && (
        <TouchableOpacity 
          style={styles.serviceIndicator}
          onPress={() => navigation.navigate('ServiceSelection')}
        >
          <Text style={styles.serviceIndicatorIcon}>{selectedService.icon}</Text>
          <Text style={styles.serviceIndicatorText}>{selectedService.name}</Text>
          <Text style={styles.changeServiceText}>Tap to change</Text>
        </TouchableOpacity>
      )}

      {/* My Location Button */}
      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={getCurrentLocation}
        disabled={isLocationLoading}
      >
        <Text style={styles.myLocationText}>
          {isLocationLoading ? '📍' : '🎯'}
        </Text>
      </TouchableOpacity>

      {/* Send Service Request Button */}
      <TouchableOpacity
        style={[
          styles.serviceRequestButton,
          { 
            opacity: (!isSocketConnected || !userLocation || requestStatus === 'sending') ? 0.5 : 1.0,
            backgroundColor: requestStatus === 'pending' ? '#FF9500' : 
                           requestStatus === 'accepted' ? '#4CAF50' : '#FF6B35'
          }
        ]}
        onPress={requestStatus === 'idle' ? sendServiceRequest : 
                 requestStatus === 'pending' ? () => setShowRequestModal(true) :
                 requestStatus === 'accepted' ? () => setShowRequestModal(true) :
                 sendServiceRequest}
        disabled={!isSocketConnected || !userLocation || requestStatus === 'sending'}
      >
        <Text style={styles.serviceRequestText}>
          {requestStatus === 'sending' ? '⏳ Sending Request...' :
           requestStatus === 'pending' ? '⏰ Waiting for Provider...' :
           requestStatus === 'accepted' ? '✅ Provider Assigned' :
           requestStatus === 'rejected' ? '❌ Request Declined' :
           selectedService ? `🔧 Request ${selectedService.name}` : '🔧 Select Service'
          } {!isSocketConnected ? '(Disconnected)' : !userLocation ? '(No Location)' : ''}
        </Text>
      </TouchableOpacity>

      {/* Debug button for testing - only in development */}
      {__DEV__ && (
        <TouchableOpacity
          style={[styles.serviceRequestButton, { 
            backgroundColor: '#9C27B0', 
            marginTop: 10,
            paddingVertical: 10
          }]}
          onPress={debugCurrentState}
        >
          <Text style={styles.serviceRequestText}>🐛 Debug State</Text>
        </TouchableOpacity>
      )}

      {/* Request Status Modal */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent={true}
        onRequestClose={requestStatus === 'pending' ? undefined : () => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Pending State */}
            {requestStatus === 'pending' && (
              <>
                <ActivityIndicator size="large" color="#FF6B35" style={styles.modalIcon} />
                <Text style={styles.modalTitle}>Finding Service Provider</Text>
                <Text style={styles.modalSubtitle}>
                  Looking for available {selectedService?.name} providers near you...
                </Text>
                
                <View style={styles.requestDetails}>
                  <Text style={styles.requestDetailTitle}>Request Details:</Text>
                  <Text style={styles.requestDetailItem}>🔧 Service: {selectedService?.name}</Text>
                  <Text style={styles.requestDetailItem}>📝 Description: {selectedService?.description}</Text>
                  <Text style={styles.requestDetailItem}>🕒 Requested: {new Date().toLocaleTimeString()}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={cancelRequest}
                >
                  <Text style={styles.cancelButtonText}>Cancel Request</Text>
                </TouchableOpacity>

                {/* Debug button for testing - only in development */}
                {__DEV__ && (
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#FF9500', marginTop: 10 }]}
                    onPress={simulateProviderAccept}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>🧪 Test Accept</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Accepted State */}
            {requestStatus === 'accepted' && acceptedProvider && (
              <>
                <Text style={styles.modalIcon}>✅</Text>
                <Text style={styles.modalTitle}>Provider Found!</Text>
                <Text style={styles.modalSubtitle}>
                  Your {selectedService?.name} request has been accepted
                </Text>

                <View style={styles.providerInfo}>
                  <Text style={styles.providerTitle}>Provider Information:</Text>
                  <Text style={styles.providerDetail}>👤 Name: {acceptedProvider.providerName}</Text>
                  <Text style={styles.providerDetail}>📞 Phone: {acceptedProvider.providerPhone}</Text>
                  <Text style={styles.providerDetail}>⏱️ ETA: {acceptedProvider.estimatedTime}</Text>
                  <Text style={styles.providerDetail}>🕒 Accepted: {new Date(acceptedProvider.timestamp).toLocaleTimeString()}</Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.contactButton]}
                    onPress={contactProvider}
                  >
                    <Text style={styles.contactButtonText}>📞 Contact Provider</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.newRequestButton]}
                    onPress={startNewRequest}
                  >
                    <Text style={styles.newRequestButtonText}>New Request</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Rejected State */}
            {requestStatus === 'rejected' && (
              <>
                <Text style={styles.modalIcon}>❌</Text>
                <Text style={styles.modalTitle}>Request Declined</Text>
                <Text style={styles.modalSubtitle}>
                  No providers are available for {selectedService?.name} service at this time.
                </Text>

                <TouchableOpacity
                  style={[styles.modalButton, styles.tryAgainButton]}
                  onPress={startNewRequest}
                >
                  <Text style={styles.tryAgainButtonText}>Try Again</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  statusIndicator: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  serviceIndicator: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: 'center',
    minWidth: 80,
  },
  serviceIndicatorIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  serviceIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  changeServiceText: {
    fontSize: 10,
    color: '#6C6C70',
    marginTop: 2,
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    backgroundColor: '#007AFF',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  myLocationText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  serviceRequestButton: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#FF6B35',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  serviceRequestText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxWidth: 350,
    width: '90%',
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  requestDetails: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    width: '100%',
  },
  requestDetailTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  requestDetailItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
    lineHeight: 18,
  },
  providerInfo: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    width: '100%',
  },
  providerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2E7D32',
  },
  providerDetail: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 4,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  contactButton: {
    backgroundColor: '#2196F3',
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  newRequestButton: {
    backgroundColor: '#FF6B35',
  },
  newRequestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  tryAgainButton: {
    backgroundColor: '#4CAF50',
  },
  tryAgainButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
});

export default MapScreen;
