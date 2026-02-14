/**
 * MapPickerModal Component
 * 
 * Full-screen map picker for selecting locations
 * Ultra-smooth with center pin marker (like Uber/Ola)
 * 
 * @version 1.0.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mapbox Access Token (from .env via centralized config)
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  background: '#faf7f7',
  white: '#FFFFFF',
};

// Default location (Mumbai, India)
const DEFAULT_LOCATION = {
  latitude: 19.0760,
  longitude: 72.8777,
};

/**
 * Reverse geocode using Mapbox
 */
const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?` +
      `access_token=${MAPBOX_ACCESS_TOKEN}&` +
      `types=address,poi,locality,neighborhood,place`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return { 
        latitude, 
        longitude, 
        address: 'Selected Location', 
        shortAddress: 'Selected Location' 
      };
    }
    
    const feature = data.features[0];
    const context = feature.context || [];
    const locality = context.find(c => c.id?.startsWith('locality'))?.text || '';
    const place = context.find(c => c.id?.startsWith('place'))?.text || '';
    const region = context.find(c => c.id?.startsWith('region'))?.text || '';
    const postcode = context.find(c => c.id?.startsWith('postcode'))?.text || '';
    
    const shortParts = [locality || feature.text, place].filter(Boolean);
    const shortAddress = shortParts.length > 0 ? shortParts.slice(0, 2).join(', ') : feature.place_name?.split(',').slice(0, 2).join(',');
    
    return {
      latitude,
      longitude,
      address: feature.place_name,
      shortAddress: shortAddress || 'Selected Location',
      addressLine1: feature.text || feature.place_name?.split(',')[0] || '',
      city: place || locality || '',
      state: region || '',
      pincode: postcode || '',
      isCurrentLocation: false,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return { 
      latitude, 
      longitude, 
      address: 'Selected Location', 
      shortAddress: 'Selected Location',
      isCurrentLocation: false,
    };
  }
};

/**
 * MapPickerModal Component
 */
const MapPickerModal = ({
  visible,
  onClose,
  onLocationSelect,
  initialLocation,
  title = 'Select Location',
}) => {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  
  // Validate initialLocation has valid numeric coordinates
  const getValidInitialLocation = () => {
    if (initialLocation && 
        typeof initialLocation.longitude === 'number' && !isNaN(initialLocation.longitude) &&
        typeof initialLocation.latitude === 'number' && !isNaN(initialLocation.latitude)) {
      return initialLocation;
    }
    return DEFAULT_LOCATION;
  };
  const [centerLocation, setCenterLocation] = useState(getValidInitialLocation());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isMapMoving, setIsMapMoving] = useState(false);
  
  // Animation for pin bounce
  const pinBounce = useRef(new Animated.Value(0)).current;
  
  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      const startLocation = initialLocation || DEFAULT_LOCATION;
      setCenterLocation(startLocation);
      setSelectedAddress(null);
      setIsMapMoving(false);
      
      // Initial geocode
      handleRegionChange(startLocation.latitude, startLocation.longitude);
    }
  }, [visible, initialLocation]);
  
  // Animate pin when map is moving
  useEffect(() => {
    if (isMapMoving) {
      Animated.spring(pinBounce, {
        toValue: -10,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(pinBounce, {
        toValue: 0,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [isMapMoving]);
  
  /**
   * Handle map region change (when user drags the map)
   */
  const handleRegionChange = useCallback(async (latitude, longitude) => {
    setCenterLocation({ latitude, longitude });
    setIsLoading(true);
    
    try {
      const result = await reverseGeocode(latitude, longitude);
      setSelectedAddress(result);
    } catch (error) {
      console.error('Error getting address:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Handle map camera change
   */
  const onCameraChanged = useCallback((event) => {
    const { center } = event.properties;
    if (center) {
      setCenterLocation({
        latitude: center[1],
        longitude: center[0],
      });
    }
  }, []);
  
  /**
   * Handle map region did change (user stopped dragging)
   */
  const onMapIdle = useCallback(() => {
    setIsMapMoving(false);
    handleRegionChange(centerLocation.latitude, centerLocation.longitude);
  }, [centerLocation, handleRegionChange]);
  
  /**
   * Handle confirm location
   */
  const handleConfirm = useCallback(() => {
    if (selectedAddress) {
      onLocationSelect(selectedAddress);
      onClose();
    }
  }, [selectedAddress, onLocationSelect, onClose]);
  
  /**
   * Center to user location
   */
  const centerToUserLocation = useCallback(() => {
    const validLocation = getValidInitialLocation();
    if (validLocation && typeof validLocation.longitude === 'number' && typeof validLocation.latitude === 'number') {
      cameraRef.current?.setCamera({
        centerCoordinate: [validLocation.longitude, validLocation.latitude],
        zoomLevel: 16,
        animationDuration: 1000,
      });
    }
  }, [initialLocation]);
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialIcon name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>
        
        {/* Map */}
        <View style={styles.mapContainer}>
          <Mapbox.MapView
            style={styles.map}
            styleURL={Mapbox.StyleURL.Street}
            zoomEnabled
            scrollEnabled
            pitchEnabled={false}
            rotateEnabled={false}
            onCameraChanged={onCameraChanged}
            onMapIdle={onMapIdle}
            onTouchStart={() => setIsMapMoving(true)}
          >
            <Mapbox.Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: [centerLocation.longitude, centerLocation.latitude],
                zoomLevel: 16,
              }}
              animationMode="flyTo"
              animationDuration={1000}
            />
          </Mapbox.MapView>
          
          {/* Center Pin (fixed in center of map) */}
          <View style={styles.centerPinContainer} pointerEvents="none">
            <Animated.View style={[
              styles.centerPin,
              { transform: [{ translateY: pinBounce }] }
            ]}>
              <View style={styles.pinHead}>
                <MaterialIcon name="place" size={40} color={BRAND.primary} />
              </View>
            </Animated.View>
            <View style={styles.pinShadow} />
          </View>
          
          {/* My Location Button */}
          {initialLocation && (
            <TouchableOpacity 
              style={[styles.myLocationButton, { bottom: 200 }]}
              onPress={centerToUserLocation}
            >
              <MaterialIcon name="my-location" size={24} color={BRAND.secondary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Bottom Card */}
        <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 16 }]}>
          {/* Address Display */}
          <View style={styles.addressContainer}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={BRAND.primary} />
                <Text style={styles.loadingText}>Finding address...</Text>
              </View>
            ) : (
              <>
                <View style={styles.addressIconContainer}>
                  <MaterialIcon name="location-on" size={24} color={BRAND.primary} />
                </View>
                <View style={styles.addressTextContainer}>
                  <Text style={styles.addressTitle} numberOfLines={1}>
                    {selectedAddress?.shortAddress || 'Move map to select location'}
                  </Text>
                  <Text style={styles.addressSubtitle} numberOfLines={2}>
                    {selectedAddress?.address || 'Drag the map to position the pin'}
                  </Text>
                </View>
              </>
            )}
          </View>
          
          {/* Confirm Button */}
          <TouchableOpacity 
            style={[
              styles.confirmButton,
              (!selectedAddress || isLoading) && styles.confirmButtonDisabled
            ]}
            onPress={handleConfirm}
            disabled={!selectedAddress || isLoading}
          >
            <MaterialIcon name="check" size={22} color={BRAND.white} />
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: BRAND.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -48,
    alignItems: 'center',
  },
  centerPin: {
    alignItems: 'center',
  },
  pinHead: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  pinShadow: {
    width: 10,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 5,
    marginTop: -2,
  },
  myLocationButton: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  bottomCard: {
    backgroundColor: BRAND.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    minHeight: 60,
  },
  loadingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
  },
  addressIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: BRAND.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  addressSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    backgroundColor: BRAND.primary,
    borderRadius: 14,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: BRAND.white,
  },
});

export default MapPickerModal;
