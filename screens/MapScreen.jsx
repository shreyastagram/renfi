import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import socketService from '../utils/socket';

MapboxGL.setAccessToken(
  'MAPBOX_TOKEN_REMOVED',
);

const MapScreen = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [realUserId, setRealUserId] = useState(null);
  const [statusCheckCount, setStatusCheckCount] = useState(0); // To prevent infinite polling
  const cameraRef = useRef(null);
  
  // Get real user ID from socket service or use dummy as fallback
  const userId = realUserId || socketService.getCurrentUserId() || 'dummyUser123';

  useEffect(() => {
    requestLocationPermission();

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
        // Listen for provider responses
        socketService.onProviderResponse(data => {
          console.log('Provider response received:', data);
          Alert.alert(
            'Provider Response',
            `Provider ${data.response} your service request!`,
            [{ text: 'OK' }],
          );
        });
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
  }, []);

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
    console.log('🔧 User location:', userLocation);
    console.log('🔧 User location type:', typeof userLocation);
    console.log('🔧 User location is array:', Array.isArray(userLocation));
    console.log('🔧 User location length:', userLocation?.length);
    if (userLocation) {
      console.log('🔧 userLocation[0] (lng):', userLocation[0], typeof userLocation[0]);
      console.log('🔧 userLocation[1] (lat):', userLocation[1], typeof userLocation[1]);
    }
    console.log('🔧 Socket connected:', socketService.getConnectionStatus());
    console.log('🔧 isSocketConnected state:', isSocketConnected);
    console.log('🔧 Using userId:', userId, '(real:', realUserId, ', from socket:', socketService.getCurrentUserId(), ')');
    
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

    const serviceRequest = {
      userId: userId, // Use real user ID
      userLocation: {
        latitude: userLocation[1],
        longitude: userLocation[0],
      },
      serviceType: 'general_help', // dummy service type
      description: 'I need help with my service request',
      requestId: `req_${Date.now()}`,
    };

    console.log('📤 About to send service request:');
    console.log('📤 Full payload:', JSON.stringify(serviceRequest, null, 2));
    console.log('📤 userLocation object specifically:', serviceRequest.userLocation);
    console.log('📤 Calling socketService.sendServiceRequest...');
    
    socketService.sendServiceRequest(serviceRequest);
    
    console.log('📤 socketService.sendServiceRequest call completed');

    Alert.alert(
      'Service Request Sent',
      'Your service request has been sent to nearby providers. You will be notified when a provider responds.',
      [{ text: 'OK' }],
    );
    
    console.log('🔧 ===== SERVICE REQUEST FUNCTION COMPLETED =====');
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
          { opacity: (!isSocketConnected || !userLocation) ? 0.5 : 1.0 }
        ]}
        onPress={sendServiceRequest}
        disabled={!isSocketConnected || !userLocation}
      >
        <Text style={styles.serviceRequestText}>
          🔧 Request Service {!isSocketConnected ? '(Disconnected)' : !userLocation ? '(No Location)' : ''}
        </Text>
      </TouchableOpacity>
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
});

export default MapScreen;
