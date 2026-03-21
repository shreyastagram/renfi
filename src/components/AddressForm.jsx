/**
 * AddressForm Component
 * 
 * Form for adding/editing addresses like Ola/Uber
 * - All fields like Ola: address line 1, 2, landmark, city, pincode
 * - Location picker with lat/long (mandatory)
 * - Label selection (home/work/other)
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid,
  Linking
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useDialog } from '../context/DialogContext';
import Geolocation from '@react-native-community/geolocation';
import { addAddress, updateAddress } from '../services/addressService';
import MapPickerModal from './MapPickerModal';

// Brand colors - User side uses blue as accent
const BRAND = {
  primary: '#f67c16', // Orange
  secondary: '#2b76bc', // Blue - user side accent
  background: '#faf7f7',
  white: '#FFFFFF',
  neutral: '#6B7280',
};

// Mapbox Access Token (from .env via centralized config)
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';

/**
 * Reverse geocode coordinates using Mapbox
 */
const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?` +
      `access_token=${MAPBOX_ACCESS_TOKEN}&` +
      `types=address,poi,locality,neighborhood,place`,
      {
        headers: { 'Accept': 'application/json' },
      }
    );
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return null;
    }
    
    const feature = data.features[0];
    const context = feature.context || [];
    const locality = context.find(c => c.id?.startsWith('locality'))?.text || '';
    const place = context.find(c => c.id?.startsWith('place'))?.text || '';
    const region = context.find(c => c.id?.startsWith('region'))?.text || '';
    const postcode = context.find(c => c.id?.startsWith('postcode'))?.text || '';
    
    return {
      addressLine1: feature.text || feature.place_name?.split(',')[0] || '',
      city: place || locality || '',
      state: region || '',
      pincode: postcode || '',
      formattedAddress: feature.place_name || '',
    };
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return null;
  }
};

/**
 * Label Chip Component
 */
const LabelChip = ({ icon, label, selected, onPress }) => (
  <TouchableOpacity
    style={[styles.labelChip, selected && styles.labelChipSelected]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <MaterialIcon 
      name={icon} 
      size={18} 
      color={selected ? BRAND.white : BRAND.neutral} 
    />
    <Text style={[styles.labelChipText, selected && styles.labelChipTextSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
);

/**
 * Form Input Component
 */
const FormInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  required = false,
  error,
  multiline = false,
  keyboardType = 'default',
  maxLength,
}) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>
      {label}
      {required && <Text style={styles.requiredStar}> *</Text>}
    </Text>
    <TextInput
      style={[
        styles.input,
        multiline && styles.inputMultiline,
        error && styles.inputError,
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      multiline={multiline}
      keyboardType={keyboardType}
      maxLength={maxLength}
    />
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

/**
 * AddressForm Component
 * 
 * @param {string} userId - MongoDB user ID
 * @param {Object} address - Existing address for editing (null for new)
 * @param {Function} onSave - Callback after save
 * @param {Function} onClose - Callback to close form
 */
const AddressForm = ({ userId, address, onSave, onClose }) => {
  const { dialog } = useDialog();
  const isEditing = !!address;
  
  // Form state
  const [label, setLabel] = useState(address?.label || 'home');
  const [customLabel, setCustomLabel] = useState(address?.customLabel || '');
  const [addressLine1, setAddressLine1] = useState(address?.addressLine1 || '');
  const [addressLine2, setAddressLine2] = useState(address?.addressLine2 || '');
  const [landmark, setLandmark] = useState(address?.landmark || '');
  const [city, setCity] = useState(address?.city || '');
  const [state, setState] = useState(address?.state || '');
  const [pincode, setPincode] = useState(address?.pincode || '');
  const [latitude, setLatitude] = useState(address?.location?.latitude || null);
  const [longitude, setLongitude] = useState(address?.location?.longitude || null);
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [errors, setErrors] = useState({});
  const [showMapPicker, setShowMapPicker] = useState(false);
  
  // On edit, reverse geocode existing coordinates to show name
  useEffect(() => {
    if (latitude && longitude && !locationName) {
      reverseGeocode(latitude, longitude).then(data => {
        if (data) {
          setLocationName(data.formattedAddress || data.addressLine1 || '');
        }
      });
    }
  }, []);
  
  /**
   * Get current location with 2-stage approach (fast cached → accurate)
   * Matches the Uber/Ola pattern used in LocationContext
   */
  const handleUseCurrentLocation = useCallback(async () => {
    setGettingLocation(true);
    setErrors(prev => ({ ...prev, location: null }));
    
    // Request permission on Android
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setGettingLocation(false);
          dialog(
            'Permission Required',
            'Location permission is needed. Please enable it in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return;
        }
      } catch (err) {
        console.warn('Permission error:', err);
        setGettingLocation(false);
        return;
      }
    }
    
    // Helper to apply location + auto-fill address
    const applyLocation = async (lat, lng) => {
      setLatitude(lat);
      setLongitude(lng);
      
      const addressData = await reverseGeocode(lat, lng);
      if (addressData) {
        setLocationName(addressData.formattedAddress || addressData.addressLine1 || '');
        if (!addressLine1) setAddressLine1(addressData.addressLine1);
        if (!city) setCity(addressData.city);
        if (!state) setState(addressData.state);
        if (!pincode) setPincode(addressData.pincode);
      } else {
        setLocationName(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
      
      setGettingLocation(false);
      setErrors(prev => ({ ...prev, location: null }));
    };
    
    let resolved = false;
    
    // STAGE 1: Try cached GPS (fast — accepts up to 2 min old data)
    Geolocation.getCurrentPosition(
      (position) => {
        resolved = true;
        const { latitude: lat, longitude: lng } = position.coords;
        console.log('[AddressForm] Fast cached location:', lat, lng);
        applyLocation(lat, lng);
        
        // STAGE 2: Refine in background if accuracy > 100m
        if (position.coords.accuracy > 100) {
          Geolocation.getCurrentPosition(
            (better) => applyLocation(better.coords.latitude, better.coords.longitude),
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
      },
      () => {
        // No cache — STAGE 2: Get fresh GPS with high accuracy
        console.log('[AddressForm] No cache, trying fresh GPS...');
        Geolocation.getCurrentPosition(
          (position) => {
            resolved = true;
            applyLocation(position.coords.latitude, position.coords.longitude);
          },
          (error) => {
            if (!resolved) {
              resolved = true;
              console.error('[AddressForm] GPS error:', error);
              setGettingLocation(false);
              dialog(
                'Location Error',
                'Could not detect your location. Make sure GPS is enabled and try again.',
                [{ text: 'OK' }]
              );
            }
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 120000 }
    );
    
    // Safety timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setGettingLocation(false);
      }
    }, 20000);
  }, [addressLine1, city, state, pincode]);
  
  /**
   * Clear the current location so user can re-pick
   */
  const handleClearLocation = useCallback(() => {
    setLatitude(null);
    setLongitude(null);
    setLocationName('');
  }, []);

  /**
   * Handle location selected from MapPickerModal
   */
  const handleMapPickerSelect = useCallback((location) => {
    if (!location) return;
    
    setLatitude(location.latitude);
    setLongitude(location.longitude);
    setLocationName(location.address || location.shortAddress || 'Selected Location');
    
    // Auto-fill address fields from reverse geocoded data
    if (location.addressLine1 && !addressLine1) setAddressLine1(location.addressLine1);
    if (location.city && !city) setCity(location.city);
    if (location.state && !state) setState(location.state);
    if (location.pincode && !pincode) setPincode(location.pincode);
    
    setErrors(prev => ({ ...prev, location: null }));
    setShowMapPicker(false);
  }, [addressLine1, city, state, pincode]);
  
  /**
   * Validate form
   */
  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!addressLine1.trim()) {
      newErrors.addressLine1 = 'Address Line 1 is required';
    }
    
    if (!city.trim()) {
      newErrors.city = 'City is required';
    }
    
    if (!pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(pincode.trim())) {
      newErrors.pincode = 'Enter a valid 6-digit pincode';
    }
    
    if (!latitude || !longitude) {
      newErrors.location = 'Location is required. Please use "Use Current Location" button.';
    }
    
    if (label === 'other' && !customLabel.trim()) {
      newErrors.customLabel = 'Please enter a label name';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [addressLine1, city, pincode, latitude, longitude, label, customLabel]);
  
  /**
   * Handle save
   */
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    
    const addressData = {
      label,
      customLabel: label === 'other' ? customLabel : '',
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      latitude,
      longitude,
      isDefault: address?.isDefault || false,
    };
    
    try {
      let result;
      
      if (isEditing) {
        result = await updateAddress(userId, address._id, addressData);
      } else {
        result = await addAddress(userId, addressData);
      }
      
      if (result.success) {
        onSave?.(result.address);
      } else {
        dialog('Error', result.error || 'Failed to save address');
      }
    } catch (error) {
      dialog('Error', 'Failed to save address. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    validateForm, label, customLabel, addressLine1, addressLine2,
    landmark, city, state, pincode, latitude, longitude,
    isEditing, userId, address, onSave
  ]);
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <MaterialIcon name="close" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Edit Address' : 'Add New Address'}
        </Text>
        <View style={{ width: 32 }} />
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Label Selection */}
        <Text style={styles.sectionTitle}>Save as</Text>
        <View style={styles.labelContainer}>
          <LabelChip
            icon="home"
            label="Home"
            selected={label === 'home'}
            onPress={() => setLabel('home')}
          />
          <LabelChip
            icon="work"
            label="Work"
            selected={label === 'work'}
            onPress={() => setLabel('work')}
          />
          <LabelChip
            icon="location-on"
            label="Other"
            selected={label === 'other'}
            onPress={() => setLabel('other')}
          />
        </View>
        
        {label === 'other' && (
          <FormInput
            label="Label Name"
            value={customLabel}
            onChangeText={setCustomLabel}
            placeholder="e.g., Parents Home, Gym"
            required
            error={errors.customLabel}
          />
        )}
        
        {/* Location Section */}
        <Text style={styles.sectionTitle}>Location</Text>
        
        {(latitude && longitude) ? (
          /* Location is set — show confirmation with place name and change/clear options */
          <View style={[styles.locationButton, styles.locationButtonSuccess]}>
            <View style={styles.locationButtonIcon}>
              <MaterialIcon name="check-circle" size={22} color="#10B981" />
            </View>
            <View style={styles.locationButtonContent}>
              <Text style={styles.locationButtonTitle}>Location Set</Text>
              <Text style={[styles.locationButtonSubtitle, { color: '#374151' }]} numberOfLines={2}>
                {locationName || 'Location detected'}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={handleClearLocation}
              style={{ padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 }}
            >
              <MaterialIcon name="close" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : (
          /* No location — show two options: GPS + Map Picker */
          <View>
            <TouchableOpacity
              style={[
                styles.locationButton,
                errors.location && styles.locationButtonError,
              ]}
              onPress={handleUseCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <View style={styles.locationButtonIcon}>
                  <MaterialIcon name="my-location" size={22} color="#3B82F6" />
                </View>
              )}
              <View style={styles.locationButtonContent}>
                <Text style={styles.locationButtonTitle}>Use Current Location</Text>
                <Text style={styles.locationButtonSubtitle}>
                  Tap to detect your GPS location
                </Text>
              </View>
            </TouchableOpacity>
            
            {/* Pick from Map Button */}
            <TouchableOpacity
              style={styles.mapPickerButton}
              onPress={() => setShowMapPicker(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.locationButtonIcon, { backgroundColor: '#FFF7ED' }]}>
                <MaterialIcon name="map" size={22} color={BRAND.primary} />
              </View>
              <View style={styles.locationButtonContent}>
                <Text style={styles.locationButtonTitle}>Choose on Map</Text>
                <Text style={styles.locationButtonSubtitle}>
                  Pick a location by moving the map
                </Text>
              </View>
              <MaterialIcon name="chevron-right" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}
        {/* Always show option to re-detect or pick from map after location is set */}
        {(latitude && longitude) && (
          <View style={styles.locationActionsRow}>
            <TouchableOpacity
              style={styles.locationActionChip}
              onPress={handleUseCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <MaterialIcon name="my-location" size={16} color="#3B82F6" />
              )}
              <Text style={[styles.locationActionText, { color: '#3B82F6' }]}>
                {gettingLocation ? 'Detecting...' : 'Re-detect GPS'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.locationActionChip, { backgroundColor: '#FFF7ED' }]}
              onPress={() => setShowMapPicker(true)}
            >
              <MaterialIcon name="map" size={16} color={BRAND.primary} />
              <Text style={[styles.locationActionText, { color: BRAND.primary }]}>
                Pick on Map
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {errors.location && (
          <Text style={styles.errorText}>{errors.location}</Text>
        )}
        
        {/* Address Fields */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Address Details</Text>
        
        <FormInput
          label="Flat / House No. / Building"
          value={addressLine1}
          onChangeText={setAddressLine1}
          placeholder="e.g., Flat 101, Tower A, Hiranandani"
          required
          error={errors.addressLine1}
        />
        
        <FormInput
          label="Street / Area"
          value={addressLine2}
          onChangeText={setAddressLine2}
          placeholder="e.g., Sector 5, Kharghar"
        />
        
        <FormInput
          label="Landmark"
          value={landmark}
          onChangeText={setLandmark}
          placeholder="e.g., Near Rassaz Mall"
        />
        
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <FormInput
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="e.g., Navi Mumbai"
              required
              error={errors.city}
            />
          </View>
          <View style={styles.halfInput}>
            <FormInput
              label="Pincode"
              value={pincode}
              onChangeText={setPincode}
              placeholder="e.g., 400614"
              required
              keyboardType="numeric"
              maxLength={6}
              error={errors.pincode}
            />
          </View>
        </View>
        
        <FormInput
          label="State"
          value={state}
          onChangeText={setState}
          placeholder="e.g., Maharashtra"
        />
      </ScrollView>
      
      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcon name="check" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>
                {isEditing ? 'Update Address' : 'Save Address'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Map Picker Modal */}
      <MapPickerModal
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onLocationSelect={handleMapPickerSelect}
        initialLocation={(latitude && longitude) ? { latitude, longitude } : null}
        title="Pick Address Location"
      />
    </KeyboardAvoidingView>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.neutral,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  labelChipSelected: {
    backgroundColor: BRAND.secondary,
    borderColor: BRAND.secondary,
  },
  labelChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.neutral,
  },
  labelChipTextSelected: {
    color: BRAND.white,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: BRAND.secondary + '10',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: BRAND.secondary + '40',
    borderStyle: 'dashed',
  },
  locationButtonSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderStyle: 'solid',
  },
  locationButtonError: {
    borderColor: '#FCA5A5',
  },
  locationButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationButtonContent: {
    flex: 1,
  },
  locationButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  locationButtonSubtitle: {
    fontSize: 12,
    color: BRAND.neutral,
    marginTop: 2,
  },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: BRAND.primary + '08',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BRAND.primary + '30',
    marginTop: 10,
  },
  locationActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  locationActionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
  },
  locationActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  requiredStar: {
    color: '#EF4444',
  },
  input: {
    fontSize: 15,
    color: '#1F2937',
    padding: 14,
    backgroundColor: BRAND.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: BRAND.white,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: BRAND.secondary,
    borderRadius: 14,
    shadowColor: BRAND.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.white,
  },
});

export default AddressForm;
