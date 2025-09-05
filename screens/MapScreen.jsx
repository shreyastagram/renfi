import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, PermissionsAndroid, Platform } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';

MapboxGL.setAccessToken('MAPBOX_TOKEN_REMOVED');

const MapScreen = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location to show you on the map',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
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
      (position) => {
        const { longitude, latitude } = position.coords;
        const location = [longitude, latitude];
        setUserLocation(location);
        
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
      (error) => {
        console.log('Location error:', error);
        setIsLocationLoading(false);
        Alert.alert(
          'Location Error',
          'Unable to get your current location. Please make sure location services are enabled.',
          [{ text: 'OK' }]
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  map: { 
    flex: 1 
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 100,
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
});

export default MapScreen;
