/**
 * Location Picker Component
 * 
 * Allows users to:
 * - Use their current location
 * - Search for a different address using Mapbox geocoding
 * - Select location on map
 * - Select from saved addresses (like Ola/Uber)
 * 
 * @version 3.0.0 - Mapbox Geocoding + Saved Addresses
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  Linking,
  PermissionsAndroid,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import Icon from './Icon';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mapbox Access Token (same as used in LocationMap)
const MAPBOX_ACCESS_TOKEN = 'MAPBOX_TOKEN_REMOVED';

/**
 * Request location permission (Android)
 */
const requestLocationPermission = async () => {
  if (Platform.OS === 'ios') {
    return true; // iOS handles permissions through Info.plist
  }
  
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission Required',
        message: 'FixHomi needs access to your location to find nearby service providers.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Location permission error:', err);
    return false;
  }
};

/**
 * Show location settings prompt
 */
const showLocationSettingsAlert = () => {
  Alert.alert(
    'Location Services Disabled',
    'Please enable location services in your device settings to use this feature.',
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Open Settings', 
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
        }
      },
    ]
  );
};

/**
 * Mapbox Geocoding - Search for addresses
 * Using Mapbox Geocoding API for better India results
 */
const geocodeAddress = async (address) => {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?` +
      `access_token=${MAPBOX_ACCESS_TOKEN}&` +
      `country=IN&` +
      `limit=5&` +
      `types=address,poi,locality,neighborhood,place`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return [];
    }
    
    return data.features.map((feature) => {
      // Extract structured address components
      const context = feature.context || [];
      const locality = context.find(c => c.id?.startsWith('locality'))?.text || '';
      const place = context.find(c => c.id?.startsWith('place'))?.text || '';
      const region = context.find(c => c.id?.startsWith('region'))?.text || '';
      const postcode = context.find(c => c.id?.startsWith('postcode'))?.text || '';
      
      return {
        latitude: feature.center[1],
        longitude: feature.center[0],
        address: feature.place_name,
        shortAddress: feature.text + (locality ? `, ${locality}` : (place ? `, ${place}` : '')),
        addressLine1: feature.text || feature.place_name?.split(',')[0] || '',
        city: place || locality || '',
        state: region || '',
        pincode: postcode || '',
      };
    });
  } catch (error) {
    console.error('Mapbox geocoding error:', error);
    return [];
  }
};

/**
 * Mapbox Reverse Geocoding - Get address from coordinates
 * Returns actual address like "Vashi, Navi Mumbai" instead of "My Location"
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
        address: 'Current Location', 
        shortAddress: 'Current Location' 
      };
    }
    
    const feature = data.features[0];
    const context = feature.context || [];
    const locality = context.find(c => c.id?.startsWith('locality'))?.text || '';
    const place = context.find(c => c.id?.startsWith('place'))?.text || '';
    const region = context.find(c => c.id?.startsWith('region'))?.text || '';
    const postcode = context.find(c => c.id?.startsWith('postcode'))?.text || '';
    
    // Create a nice short address like "Vashi, Navi Mumbai"
    const shortParts = [locality || feature.text, place].filter(Boolean);
    const shortAddress = shortParts.length > 0 ? shortParts.slice(0, 2).join(', ') : feature.place_name?.split(',').slice(0, 2).join(',');
    
    return {
      latitude,
      longitude,
      address: feature.place_name,
      shortAddress: shortAddress || 'Current Location',
      addressLine1: feature.text || feature.place_name?.split(',')[0] || '',
      city: place || locality || '',
      state: region || '',
      pincode: postcode || '',
    };
  } catch (error) {
    console.error('Mapbox reverse geocoding error:', error);
    return { 
      latitude, 
      longitude, 
      address: 'Current Location', 
      shortAddress: 'Current Location' 
    };
  }
};

/**
 * Location Chip for quick selection
 */
const LocationChip = ({ icon, label, selected, onPress, loading }) => (
  <TouchableOpacity
    style={[styles.locationChip, selected && styles.locationChipSelected]}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={loading}
  >
    {loading ? (
      <ActivityIndicator size="small" color={selected ? '#FFFFFF' : '#3B82F6'} />
    ) : (
      <Icon name={icon} size={18} color={selected ? '#FFFFFF' : '#374151'} />
    )}
    <Text style={[styles.locationChipText, selected && styles.locationChipTextSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
);

/**
 * Search Result Item
 */
const SearchResultItem = ({ result, onSelect }) => (
  <TouchableOpacity style={styles.searchResultItem} onPress={() => onSelect(result)}>
    <Icon name="location" size={20} color="#6B7280" />
    <View style={styles.searchResultContent}>
      <Text style={styles.searchResultTitle} numberOfLines={1}>
        {result.shortAddress}
      </Text>
      <Text style={styles.searchResultSubtitle} numberOfLines={1}>
        {result.address}
      </Text>
    </View>
  </TouchableOpacity>
);

/**
 * Location Picker Component
 * 
 * @param {Object} value - Selected location { latitude, longitude, address }
 * @param {Function} onChange - Callback when location changes
 * @param {Function} onLocationChange - Alternative callback (legacy support)
 * @param {Object} currentLocation - User's current location
 * @param {string} label - Label for the picker
 * @param {string} placeholder - Placeholder text
 */
const LocationPicker = ({
  value,
  onChange: onChangeProp,
  onLocationChange,
  currentLocation,
  label = 'Service Location',
  placeholder = 'Where do you need the service?',
  error,
}) => {
  // Support both onChange and onLocationChange
  const handleChange = useCallback((locationData) => {
    if (onChangeProp) {
      onChangeProp(locationData);
    }
    if (onLocationChange) {
      onLocationChange(locationData);
    }
  }, [onChangeProp, onLocationChange]);
  
  const [locationType, setLocationType] = useState('current'); // 'current' or 'other'
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  
  // Use internal value if no value prop provided
  const displayValue = value || internalValue;
  
  const searchTimeoutRef = useRef(null);
  const locationWatchRef = useRef(null);
  
  /**
   * Industry-grade location strategy (like Uber/Ola):
   * Uses watchPosition for instant cached location + GPS refinement
   */
  const handleUseCurrentLocation = useCallback(async () => {
    setLocationType('current');
    setGettingLocation(true);
    
    // Request permission first on Android
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setGettingLocation(false);
      Alert.alert(
        'Permission Required',
        'Location permission is needed to get your current location. Please enable it in settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    
    // Clear any existing watch
    if (locationWatchRef.current !== null) {
      Geolocation.clearWatch(locationWatchRef.current);
    }
    
    let locationReceived = false;
    
    // Use watchPosition for instant location (like Uber/Ola)
    const watchId = Geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log('📍 Location update:', latitude.toFixed(6), longitude.toFixed(6), 'accuracy:', accuracy?.toFixed(0) || 'unknown', 'm');
        
        // Accept first location immediately
        if (!locationReceived) {
          locationReceived = true;
          const locationData = await reverseGeocode(latitude, longitude);
          locationData.isCurrentLocation = true;
          locationData.accuracy = accuracy;
          setInternalValue(locationData);
          handleChange(locationData);
          setGettingLocation(false);
          
          // Stop watching once we have a location
          Geolocation.clearWatch(watchId);
          locationWatchRef.current = null;
        }
      },
      (error) => {
        console.warn('📍 Location watch error:', error.message);
        
        if (!locationReceived) {
          // Fallback to provided currentLocation or show error
          if (currentLocation) {
            const locationData = {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              address: 'Current location',
              shortAddress: 'My location',
              isCurrentLocation: true,
            };
            setInternalValue(locationData);
            handleChange(locationData);
          } else if (error.code === 1) {
            Alert.alert(
              'Permission Denied',
              'Please enable location access in your device settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
            );
          } else {
            showLocationSettingsAlert();
          }
          setGettingLocation(false);
        }
        
        Geolocation.clearWatch(watchId);
        locationWatchRef.current = null;
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 1000,
        fastestInterval: 500,
        timeout: 15000,
        maximumAge: 1000, // Use cached location for instant result
      }
    );
    
    locationWatchRef.current = watchId;
    
    // Safety timeout
    setTimeout(() => {
      if (!locationReceived && locationWatchRef.current !== null) {
        Geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
        setGettingLocation(false);
        
        if (currentLocation) {
          const locationData = {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address: 'Current location',
            shortAddress: 'My location',
            isCurrentLocation: true,
          };
          setInternalValue(locationData);
          handleChange(locationData);
        } else {
          Alert.alert('Location Timeout', 'Unable to get your location. Please try again or enter an address manually.');
        }
      }
    }, 10000);
  }, [currentLocation, handleChange]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationWatchRef.current !== null) {
        Geolocation.clearWatch(locationWatchRef.current);
      }
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);
  
  // Handle search query change with debounce
  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (text.length >= 3) {
      setSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        const results = await geocodeAddress(text);
        setSearchResults(results);
        setSearching(false);
      }, 500);
    } else {
      setSearchResults([]);
    }
  }, []);
  
  // Handle search result selection
  const handleSelectResult = useCallback((result) => {
    setLocationType('other');
    result.isCurrentLocation = false;
    setInternalValue(result);
    handleChange(result);
    setShowModal(false);
    setSearchQuery('');
    setSearchResults([]);
  }, [handleChange]);
  
  // Set current location on mount if not already set
  useEffect(() => {
    if (!displayValue && currentLocation) {
      handleUseCurrentLocation();
    }
  }, []);
  
  const formatDisplayValue = () => {
    if (gettingLocation) return 'Getting location...';
    if (!displayValue) return placeholder;
    return displayValue.shortAddress || displayValue.address || `${displayValue.latitude.toFixed(4)}, ${displayValue.longitude.toFixed(4)}`;
  };
  
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      {/* Quick Location Options */}
      <View style={styles.locationOptions}>
        <LocationChip
          icon="my_location"
          label={gettingLocation ? 'Getting...' : 'My Location'}
          selected={locationType === 'current'}
          onPress={handleUseCurrentLocation}
          loading={gettingLocation}
        />
        <LocationChip
          icon="other_location"
          label="Other Location"
          selected={locationType === 'other'}
          onPress={() => {
            setLocationType('other');
            setShowModal(true);
          }}
        />
      </View>
      
      {/* Selected Location Display */}
      <TouchableOpacity
        style={[styles.valueDisplay, error && styles.valueDisplayError]}
        onPress={() => setShowModal(true)}
      >
        {gettingLocation ? (
          <ActivityIndicator size="small" color="#3B82F6" />
        ) : (
          <Icon 
            name={locationType === 'current' ? 'my_location' : 'location'} 
            size={20} 
            color={locationType === 'current' ? '#3B82F6' : '#6B7280'} 
          />
        )}
        <Text style={[styles.valueText, !value && styles.valuePlaceholder]} numberOfLines={2}>
          {formatDisplayValue()}
        </Text>
        <Icon name="edit" size={18} color="#6B7280" />
      </TouchableOpacity>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      {/* Location Search Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Icon name="back" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Search Location</Text>
            <View style={{ width: 24 }} />
          </View>
          
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Icon name="search_location" size={20} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Enter address, landmark, or area"
              placeholderTextColor="#9CA3AF"
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}>
                <Icon name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Quick Actions - Locate Me Button (like Google Maps) */}
          <TouchableOpacity
            style={styles.locateMeButton}
            onPress={() => {
              handleUseCurrentLocation();
              setShowModal(false);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.locateMeIconContainer}>
              <MaterialIcon name="my-location" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.locateMeTextContainer}>
              <Text style={styles.locateMeTitle}>Use my current location</Text>
              <Text style={styles.locateMeSubtitle}>Using GPS</Text>
            </View>
            {gettingLocation && <ActivityIndicator size="small" color="#3B82F6" />}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.chooseOnMapButton}
            onPress={() => {
              setShowModal(false);
              // Show map picker alert - in a full implementation, this would open a map screen
              Alert.alert(
                'Choose on Map',
                'Map picker feature coming soon! For now, please search for your location above.',
                [{ text: 'OK' }]
              );
            }}
          >
            <Icon name="map" size={20} color="#8B5CF6" />
            <Text style={styles.chooseOnMapText}>Choose location on map</Text>
          </TouchableOpacity>
          
          {/* Search Results */}
          {searching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : (
            <ScrollView style={styles.resultsContainer}>
              {searchResults.map((result, index) => (
                <SearchResultItem
                  key={index}
                  result={result}
                  onSelect={handleSelectResult}
                />
              ))}
              
              {searchQuery.length >= 3 && searchResults.length === 0 && (
                <View style={styles.noResultsContainer}>
                  <Icon name="search_location" size={48} color="#D1D5DB" />
                  <Text style={styles.noResultsText}>No locations found</Text>
                  <Text style={styles.noResultsSubtext}>Try a different search term</Text>
                </View>
              )}
              
              {searchQuery.length < 3 && searchQuery.length > 0 && (
                <Text style={styles.hintText}>Type at least 3 characters to search</Text>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  locationOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  locationChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  locationChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  locationChipTextSelected: {
    color: '#FFFFFF',
  },
  valueDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  valueDisplayError: {
    borderColor: '#EF4444',
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  valuePlaceholder: {
    color: '#9CA3AF',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 16,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    padding: 0,
  },
  useCurrentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
  },
  useCurrentText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  // Locate Me Button (like Google Maps style)
  locateMeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  locateMeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateMeTextContainer: {
    flex: 1,
  },
  locateMeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  locateMeSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  chooseOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
  },
  chooseOnMapText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  resultsContainer: {
    flex: 1,
    padding: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  searchResultSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 12,
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  hintText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default LocationPicker;
