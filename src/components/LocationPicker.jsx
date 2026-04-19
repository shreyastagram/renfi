/**
 * Location Picker Component
 * 
 * Allows users to:
 * - Use their current location
 * - Search for a different address using Mapbox geocoding
 * - Select location on map
 * - Select from saved addresses (like Ola/Uber)
 * 
 * @version 5.0.0 - MapPickerModal Integration + Improved Location
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {  View,
  Text,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Linking,
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import Geolocation from '@react-native-community/geolocation';
import Icon from './Icon';
import { useDialog } from '../context/DialogContext';
import { requestForegroundLocationPermission } from '../utils/permissions';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import MapPickerModal from './MapPickerModal';
import { useApp } from '../context/AppContext';
import { getSavedAddresses } from '../services/addressService';

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

// Foreground location permission is requested via
// requestForegroundLocationPermission (Prominent Disclosure helper) inside
// the component body where useDialog() is available.

/**
 * Show location settings prompt
 */
const showLocationSettingsAlert = (dialog) => {
  dialog(
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
 * Saved Address Item (like Ola/Uber)
 */
const SavedAddressItem = ({ address, onSelect }) => {
  const getTypeIcon = (type) => {
    switch (type) {
      case 'home': return 'home';
      case 'work': return 'work';
      default: return 'location-on';
    }
  };
  
  const getTypeColor = (type) => {
    switch (type) {
      case 'home': return '#3B82F6';
      case 'work': return '#8B5CF6';
      default: return '#6B7280';
    }
  };
  
  return (
    <TouchableOpacity 
      style={styles.savedAddressItem} 
      onPress={() => onSelect({
        latitude: address.location?.coordinates?.[1] || address.location?.latitude || address.latitude,
        longitude: address.location?.coordinates?.[0] || address.location?.longitude || address.longitude,
        address: address.fullAddress || address.formattedAddress || address.address || `${address.addressLine1}, ${address.city}`,
        shortAddress: address.label || address.addressLine1,
        addressLine1: address.addressLine1 || '',
        city: address.city || '',
        state: address.state || '',
        pincode: address.pincode || '',
        isCurrentLocation: false,
        isSavedAddress: true,
        savedAddressId: address._id,
      })}
    >
      <View style={[styles.savedAddressIconContainer, { backgroundColor: `${getTypeColor(address.type)}15` }]}>
        <MaterialIcon name={getTypeIcon(address.type)} size={22} color={getTypeColor(address.type)} />
      </View>
      <View style={styles.savedAddressContent}>
        <View style={styles.savedAddressHeader}>
          <Text style={styles.savedAddressLabel}>{address.label}</Text>
          <View style={[styles.savedAddressTypeBadge, { backgroundColor: `${getTypeColor(address.type)}15` }]}>
            <Text style={[styles.savedAddressTypeText, { color: getTypeColor(address.type) }]}>
              {address.type?.charAt(0).toUpperCase() + address.type?.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={styles.savedAddressText} numberOfLines={1}>
          {address.addressLine1}
        </Text>
        <Text style={styles.savedAddressSubtext} numberOfLines={1}>
          {[address.city, address.state].filter(Boolean).join(', ')}
        </Text>
      </View>
      <MaterialIcon name="chevron-right" size={24} color="#D1D5DB" />
    </TouchableOpacity>
  );
};

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
  currentLocationAddress,
  label = 'Service Location',
  placeholder = 'Where do you need the service?',
  error,
}) => {
  const { dialog } = useDialog();

  // Guard against background geocoding race conditions:
  // Incremented each time the user explicitly selects a location.
  // Background callbacks compare the version they captured at launch
  // against the current value — if it changed, a newer user selection
  // happened and the stale callback is silently dropped.
  const selectionVersionRef = useRef(0);

  // Support both onChange and onLocationChange
  const handleChange = useCallback((locationData) => {
    if (onChangeProp) {
      onChangeProp(locationData);
    }
    if (onLocationChange) {
      onLocationChange(locationData);
    }
  }, [onChangeProp, onLocationChange]);
  
  const { user, profile } = useApp();
  
  // Get user ID for saved addresses (supports various ID fields)
  // Priority: mongoId > _id > id (covers both user and provider profiles)
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id || profile?.id;
  
  // Debug logging for userId resolution
  useEffect(() => {
    console.log('📍 [LocationPicker] User ID resolution:', {
      'user?.mongoId': user?.mongoId,
      'profile?.mongoId': profile?.mongoId,
      'user?._id': user?._id,
      'profile?._id': profile?._id,
      'profile?.id': profile?.id,
      'resolved userId': userId,
    });
  }, [user, profile, userId]);
  
  const [locationType, setLocationType] = useState('current'); // 'current' or 'other'
  const [showModal, setShowModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  
  // Saved addresses state
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingSavedAddresses, setLoadingSavedAddresses] = useState(false);
  
  // Use internal value if no value prop provided
  const displayValue = value || internalValue;
  
  const searchTimeoutRef = useRef(null);
  const locationWatchRef = useRef(null);
  
  /**
   * Handle map picker location selection
   */
  const handleMapPickerSelect = useCallback((location) => {
    selectionVersionRef.current += 1; // Invalidate pending background geocoding
    setLocationType('other');
    // CRITICAL: Mark as non-current-location so booking uses these coordinates
    const locationData = { ...location, isCurrentLocation: false };
    setInternalValue(locationData);
    handleChange(locationData);
    setShowMapPicker(false);
    setShowModal(false);
  }, [handleChange]);
  
  /**
   * Industry-grade location strategy (like Uber/Ola):
   * 1. If context already has location → use INSTANTLY (no GPS call, no loader)
   * 2. Only fall back to fresh GPS if context has no location
   * 3. Background-refine address via reverse geocode (non-blocking)
   */
  const handleUseCurrentLocation = useCallback(async () => {
    selectionVersionRef.current += 1; // Mark this as a user-initiated selection
    setLocationType('current');

    // ── INSTANT PATH: Context already has location (Ola/Uber-like) ──
    // LocationContext refreshes every 30s, so this is always fresh
    if (currentLocation?.latitude && currentLocation?.longitude) {
      console.log('📍 Instant location from context:', currentLocation.latitude.toFixed(6), currentLocation.longitude.toFixed(6));

      // Set immediately with whatever address we have — zero latency
      const locationData = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: currentLocationAddress || 'Current location',
        shortAddress: currentLocationAddress || 'My location',
        isCurrentLocation: true,
      };
      setInternalValue(locationData);
      handleChange(locationData);
      // Don't show loader — location is already set
      setGettingLocation(false);

      // Silently refine address in background (non-blocking)
      const versionAtLaunch = selectionVersionRef.current;
      reverseGeocode(currentLocation.latitude, currentLocation.longitude)
        .then(refined => {
          // Only apply if user hasn't made a different selection since
          if (refined && selectionVersionRef.current === versionAtLaunch) {
            const refinedData = { ...refined, isCurrentLocation: true };
            setInternalValue(refinedData);
            handleChange(refinedData);
          }
        })
        .catch(() => {}); // Ignore — we already have a good enough result
      return;
    }
    
    // ── FALLBACK PATH: No context location — need fresh GPS ──
    setGettingLocation(true);
    
    // Show in-app disclosure before the OS prompt (Prominent Disclosure
    // requirement — Google Play User Data policy).
    const hasPermission = await requestForegroundLocationPermission(dialog, {
      title: 'Use Your Current Location',
      message: 'Fixhomi uses your location to show nearby service providers and auto-fill your service address. You can also type the address manually or pick one on the map.',
    });
    if (!hasPermission) {
      setGettingLocation(false);
      return;
    }
    
    // Clear any existing watch
    if (locationWatchRef.current !== null) {
      Geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
    
    let locationReceived = false;
    const gpsVersionAtLaunch = selectionVersionRef.current;

    const handleLocationSuccess = async (position) => {
      if (locationReceived) return;
      locationReceived = true;

      // If user made a different selection while GPS was resolving, skip
      if (selectionVersionRef.current !== gpsVersionAtLaunch) {
        setGettingLocation(false);
        return;
      }

      const { latitude, longitude, accuracy } = position.coords;
      console.log('📍 GPS location received:', latitude.toFixed(6), longitude.toFixed(6), 'accuracy:', accuracy?.toFixed(0) || 'unknown', 'm');

      try {
        const locationData = await reverseGeocode(latitude, longitude);
        // Re-check after async geocoding
        if (selectionVersionRef.current !== gpsVersionAtLaunch) {
          setGettingLocation(false);
          return;
        }
        locationData.isCurrentLocation = true;
        locationData.accuracy = accuracy;
        setInternalValue(locationData);
        handleChange(locationData);
      } catch (err) {
        if (selectionVersionRef.current !== gpsVersionAtLaunch) {
          setGettingLocation(false);
          return;
        }
        const locationData = {
          latitude,
          longitude,
          address: 'Current location',
          shortAddress: 'My location',
          isCurrentLocation: true,
        };
        setInternalValue(locationData);
        handleChange(locationData);
      }
      setGettingLocation(false);
    };
    
    const handleLocationError = (error, isHighAccuracy = true) => {
      console.warn('📍 Location error:', error.message, 'code:', error.code);
      
      if (isHighAccuracy && !locationReceived) {
        Geolocation.getCurrentPosition(
          handleLocationSuccess,
          (lowAccErr) => {
            console.warn('📍 Low accuracy also failed:', lowAccErr.message);
            if (!locationReceived) {
              locationReceived = true;
              setGettingLocation(false);
              dialog(
                'Location Unavailable',
                'Could not determine your location. Please ensure GPS is enabled or search for your location manually.',
                [
                  { text: 'Search Manually', onPress: () => setShowModal(true) },
                  { text: 'Open Settings', onPress: () => Linking.openSettings() },
                ]
              );
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
        return;
      }
    };
    
    // Try high accuracy GPS
    Geolocation.getCurrentPosition(
      handleLocationSuccess,
      (error) => handleLocationError(error, true),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );
  }, [currentLocation, currentLocationAddress, handleChange]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationWatchRef.current !== null) {
        Geolocation.clearWatch(locationWatchRef.current);
      }
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);
  
  // Fetch saved addresses when modal opens
  const fetchSavedAddresses = useCallback(async () => {
    console.log('📍 [LocationPicker] fetchSavedAddresses called, userId:', userId);
    
    // Note: We don't check token here because addressService gets it from Keychain internally
    if (!userId) {
      console.log('📍 [LocationPicker] No userId, skipping saved addresses fetch');
      return;
    }
    
    setLoadingSavedAddresses(true);
    try {
      console.log('📍 [LocationPicker] Fetching saved addresses for userId:', userId);
      const result = await getSavedAddresses(userId);
      console.log('📍 [LocationPicker] getSavedAddresses result:', JSON.stringify(result, null, 2));
      
      if (result.success && result.addresses) {
        setSavedAddresses(result.addresses);
        console.log('📍 [LocationPicker] Loaded', result.addresses.length, 'saved addresses');
      } else {
        console.log('📍 [LocationPicker] No saved addresses found or error:', result.error);
        // Also check if addresses are in a different field
        if (result.data) {
          console.log('📍 [LocationPicker] Found addresses in result.data instead');
          setSavedAddresses(result.data);
        }
      }
    } catch (error) {
      console.error('📍 [LocationPicker] Failed to fetch saved addresses:', error);
    } finally {
      setLoadingSavedAddresses(false);
    }
  }, [userId]);
  
  // Fetch when modal opens
  useEffect(() => {
    if (showModal) {
      fetchSavedAddresses();
    }
  }, [showModal, fetchSavedAddresses]);
  
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
    selectionVersionRef.current += 1; // Invalidate pending background geocoding
    setLocationType('other');
    result.isCurrentLocation = false;
    setInternalValue(result);
    handleChange(result);
    setShowModal(false);
    setSearchQuery('');
    setSearchResults([]);
  }, [handleChange]);
  
  // Set current location on mount — INSTANT from context (Ola/Uber-like)
  // No GPS call, no loader — just use what LocationContext already has
  useEffect(() => {
    if (!displayValue && currentLocation?.latitude && currentLocation?.longitude) {
      setLocationType('current');
      const locationData = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: currentLocationAddress || 'Current location',
        shortAddress: currentLocationAddress || 'My location',
        isCurrentLocation: true,
      };
      setInternalValue(locationData);
      handleChange(locationData);

      // Background-refine address if context didn't provide one
      if (!currentLocationAddress) {
        const versionAtLaunch = selectionVersionRef.current;
        reverseGeocode(currentLocation.latitude, currentLocation.longitude)
          .then(refined => {
            // Only apply if user hasn't made a manual selection since this was launched
            if (refined && selectionVersionRef.current === versionAtLaunch) {
              const refinedData = { ...refined, isCurrentLocation: true };
              setInternalValue(refinedData);
              handleChange(refinedData);
            }
          })
          .catch(() => {});
      }
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
              // Open the map picker modal
              setTimeout(() => setShowMapPicker(true), 300);
            }}
          >
            <Icon name="map" size={20} color={BRAND.primary} />
            <Text style={[styles.chooseOnMapText, { color: BRAND.primary }]}>Choose location on map</Text>
          </TouchableOpacity>
          
          {/* Search Results or Saved Addresses */}
          {searching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : (
            <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
              {/* Show search results if there are any */}
              {searchResults.length > 0 && searchResults.map((result, index) => (
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
              
              {/* Show saved addresses when not searching */}
              {searchQuery.length === 0 && savedAddresses.length > 0 && (
                <View style={styles.savedAddressesSection}>
                  <View style={styles.savedAddressesHeader}>
                    <MaterialIcon name="bookmark" size={20} color="#3B82F6" />
                    <Text style={styles.savedAddressesTitle}>Saved Addresses</Text>
                  </View>
                  {savedAddresses.map((address) => (
                    <SavedAddressItem
                      key={address._id}
                      address={address}
                      onSelect={(loc) => {
                        handleSelectResult(loc);
                      }}
                    />
                  ))}
                </View>
              )}
              
              {/* Loading saved addresses */}
              {searchQuery.length === 0 && loadingSavedAddresses && (
                <View style={styles.savedAddressesLoading}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={styles.savedAddressesLoadingText}>Loading saved addresses...</Text>
                </View>
              )}
              
              {/* No saved addresses */}
              {searchQuery.length === 0 && !loadingSavedAddresses && savedAddresses.length === 0 && (
                <View style={styles.noSavedAddresses}>
                  <MaterialIcon name="bookmark-border" size={40} color="#D1D5DB" />
                  <Text style={styles.noSavedAddressesText}>No saved addresses</Text>
                  <Text style={styles.noSavedAddressesSubtext}>
                    Save addresses from your profile for quick access
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
      
      {/* Map Picker Modal */}
      <MapPickerModal
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onLocationSelect={handleMapPickerSelect}
        initialLocation={displayValue || currentLocation}
        title="Choose Location"
      />
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
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
  // Saved Addresses Section (like Ola/Uber)
  savedAddressesSection: {
    marginTop: 16,
  },
  savedAddressesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  savedAddressesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  savedAddressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  savedAddressIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  savedAddressContent: {
    flex: 1,
  },
  savedAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  savedAddressLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  savedAddressTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  savedAddressTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  savedAddressText: {
    fontSize: 14,
    color: '#374151',
  },
  savedAddressSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  savedAddressesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  savedAddressesLoadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  noSavedAddresses: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noSavedAddressesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  noSavedAddressesSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default LocationPicker;
