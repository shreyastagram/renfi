import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import { useApp } from '../context/AppContext';

MapboxGL.setAccessToken(
  'MAPBOX_TOKEN_REMOVED',
);

const UserLocationScreen = ({ navigation }) => {
  const { 
    userLocation, 
    updateUserLocation, 
    isLocationLoading, 
    setIsLocationLoading,
    isSocketConnected 
  } = useApp();
  
  const cameraRef = useRef(null);

  useEffect(() => {
    requestLocationPermission();
    // Auto-get location when screen loads
    setTimeout(() => {
      getCurrentLocation();
    }, 1000);
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
        updateUserLocation(location);

        // Animate camera to user location with closer zoom
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: location,
            zoomLevel: 18, // Street level zoom
            animationDuration: 1500,
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

  const handleContinue = () => {
    if (!userLocation) {
      Alert.alert(
        'Location Required',
        'Please set your location first before continuing.',
        [{ text: 'OK' }]
      );
      return;
    }

    console.log('📍 Location confirmed:', userLocation);
    navigation.navigate('ServiceSelection');
  };

  const handleMapPress = async (feature) => {
    if (feature.geometry && feature.geometry.coordinates) {
      const [longitude, latitude] = feature.geometry.coordinates;
      const location = [longitude, latitude];
      updateUserLocation(location);
      
      // Animate camera to selected location
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: location,
          zoomLevel: 18,
          animationDuration: 1000,
        });
      }
      
      console.log('📍 Location selected from map:', { latitude, longitude });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Set Your Location</Text>
        <Text style={styles.subtitle}>
          We need to know your location to find nearby service providers
        </Text>
      </View>

      {/* Socket Status */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusIndicator, { backgroundColor: isSocketConnected ? '#4CAF50' : '#F44336' }]}>
          <Text style={styles.statusText}>
            {isSocketConnected ? '🟢 Connected' : '🔴 Connecting...'}
          </Text>
        </View>
      </View>

      {/* Map Container */}
      <View style={styles.mapContainer}>
        <MapboxGL.MapView 
          style={styles.map}
          onPress={handleMapPress}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            zoomLevel={14}
            centerCoordinate={userLocation || [77.5946, 12.9716]} // Default to Bangalore
          />
          <MapboxGL.UserLocation visible={true} />
          
          {/* Show pin at selected location */}
          {userLocation && (
            <MapboxGL.PointAnnotation
              id="selectedLocation"
              coordinate={userLocation}
            >
              <View style={styles.customPin}>
                <Text style={styles.pinEmoji}>📍</Text>
              </View>
            </MapboxGL.PointAnnotation>
          )}
        </MapboxGL.MapView>

        {/* My Location Button */}
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={getCurrentLocation}
          disabled={isLocationLoading}
        >
          {isLocationLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.myLocationText}>🎯</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Location Info */}
      {userLocation && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationTitle}>📍 Selected Location</Text>
          <Text style={styles.locationCoords}>
            Lat: {userLocation[1].toFixed(6)}, Long: {userLocation[0].toFixed(6)}
          </Text>
          <Text style={styles.locationNote}>
            Tap on the map to change your location or use the location button to get your current position
          </Text>
        </View>
      )}

      {/* Continue Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            { opacity: userLocation ? 1.0 : 0.5 }
          ]}
          onPress={handleContinue}
          disabled={!userLocation}
        >
          <Text style={styles.continueButtonText}>
            Continue to Service Selection →
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#6C6C70',
    lineHeight: 22,
  },
  statusContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  statusIndicator: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  map: {
    flex: 1,
  },
  customPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinEmoji: {
    fontSize: 30,
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 20,
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
  locationInfo: {
    margin: 20,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  locationCoords: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  locationNote: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  continueButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 12,
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
  continueButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default UserLocationScreen;