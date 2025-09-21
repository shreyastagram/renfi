import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { providerStorage } from '../utils/providerStorage';
import { getCurrentLocation, isValidLocation, formatLocation } from '../utils/locationUtils';

// Service Categories Configuration - matching ServiceSelectionScreen
const AVAILABLE_SERVICES = [
  { 
    id: 'plumber', 
    name: 'Plumber', 
    icon: '🔧', 
    description: 'Pipe repairs, installations, leak fixing' 
  },
  { 
    id: 'electrician', 
    name: 'Electrician', 
    icon: '⚡', 
    description: 'Electrical wiring, outlets, lighting' 
  },
  { 
    id: 'carpenter', 
    name: 'Carpenter', 
    icon: '🔨', 
    description: 'Wood work, furniture, repairs' 
  },
  { 
    id: 'painter', 
    name: 'Painter', 
    icon: '🎨', 
    description: 'Interior/exterior painting, wall finishing' 
  },
  { 
    id: 'ac_repair', 
    name: 'AC Repair', 
    icon: '❄️', 
    description: 'Air conditioning installation & repair' 
  },
  { 
    id: 'cleaning', 
    name: 'Cleaning', 
    icon: '🧹', 
    description: 'House cleaning, deep cleaning' 
  }
];

const EXPERIENCE_OPTIONS = [
  '1 year',
  '2 years', 
  '3-5 years',
  '5+ years',
  '10+ years'
];

const ProviderProfileSetup = ({ route, navigation }) => {
  // Form state
  const [providerName, setProviderName] = useState('');
  const [phone, setPhone] = useState('');
  const [experience, setExperience] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [serviceTypes, setServiceTypes] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  
  // Get providerId from route params (from login/signup)
  const providerId = route?.params?.providerId;
  const isEditing = route?.params?.isEditing || false;
  const existingProfile = route?.params?.existingProfile;

  useEffect(() => {
    console.log('ProviderProfileSetup initialized with:', { providerId, isEditing, existingProfile });
    
    // If editing, populate existing data
    if (isEditing && existingProfile) {
      setProviderName(existingProfile.name || '');
      setPhone(existingProfile.phone || '');
      setExperience(existingProfile.experience || '');
      setSelectedCategories(existingProfile.serviceCategories || []);
      setServiceTypes(existingProfile.serviceTypes?.join(', ') || '');
      
      // Populate location data if available
      if (existingProfile.location) {
        setLatitude(existingProfile.location.latitude);
        setLongitude(existingProfile.location.longitude);
      }
    }
  }, [isEditing, existingProfile]);

  // Get current GPS location
  const getCurrentGPSLocation = async () => {
    setLocationLoading(true);
    setErrors(prev => ({ ...prev, location: '' }));
    
    try {
      const location = await getCurrentLocation();
      setLatitude(location.latitude);
      setLongitude(location.longitude);
      console.log('📍 Provider location updated:', formatLocation(location.latitude, location.longitude));
    } catch (error) {
      console.error('Location error:', error);
      setErrors(prev => ({ ...prev, location: 'Unable to get location. Please check permissions.' }));
      
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please check location permissions and try again.',
        [
          { text: 'Cancel' },
          { text: 'Retry', onPress: getCurrentGPSLocation }
        ]
      );
    } finally {
      setLocationLoading(false);
    }
  };

  // Validation functions
  const validateName = (name) => {
    if (!name.trim()) return 'Provider name is required';
    if (name.trim().length < 2) return 'Name must be at least 2 characters';
    return null;
  };

  const validatePhone = (phoneNumber) => {
    if (!phoneNumber.trim()) return 'Phone number is required';
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
    if (!phoneRegex.test(phoneNumber.trim())) return 'Please enter a valid phone number';
    return null;
  };

  const validateCategories = (categories) => {
    if (categories.length === 0) return 'Please select at least one service category';
    return null;
  };

  const validateExperience = (exp) => {
    if (!exp) return 'Please select your experience level';
    return null;
  };

  // Handle category selection (multi-select)
  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev => {
      const isSelected = prev.includes(categoryId);
      const updated = isSelected 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId];
      
      // Clear category validation error when selecting
      if (updated.length > 0 && errors.categories) {
        setErrors(prev => ({ ...prev, categories: null }));
      }
      
      return updated;
    });
  };

  // Validate all fields
  const validateForm = () => {
    const newErrors = {};
    
    const nameError = validateName(providerName);
    if (nameError) newErrors.name = nameError;
    
    const phoneError = validatePhone(phone);
    if (phoneError) newErrors.phone = phoneError;
    
    const categoriesError = validateCategories(selectedCategories);
    if (categoriesError) newErrors.categories = categoriesError;
    
    const experienceError = validateExperience(experience);
    if (experienceError) newErrors.experience = experienceError;
    
    // Validate location (optional but recommended)
    if (!latitude || !longitude) {
      newErrors.location = 'Location is recommended for better service matching';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit profile to backend
  const updateProfile = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors above');
      return;
    }

    if (!providerId) {
      Alert.alert('Error', 'Provider ID not found. Please login again.');
      return;
    }

    setLoading(true);
    
    try {
      console.log('🔄 Updating provider profile...');
      
      // Parse service types from text input
      const serviceTypesArray = serviceTypes
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const profileData = {
        providerId: providerId,
        name: providerName.trim(),
        phone: phone.trim(),
        serviceCategories: selectedCategories,
        serviceTypes: serviceTypesArray,
        experience: experience,
        location: latitude && longitude ? {
          lat: latitude,
          lng: longitude,
          address: '', // Could be enhanced with address lookup
          lastUpdated: new Date().toISOString()
        } : null
      };

      console.log('📤 Sending profile data:', profileData);

      const response = await fetch('http://10.0.2.2:5050/auth/provider/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });

      const responseData = await response.json();
      console.log('📥 Profile update response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to update profile');
      }

      if (responseData.success) {
        // Save updated provider data to storage
        if (responseData.data) {
          await providerStorage.saveProviderData(responseData.data);
          console.log('✅ Updated provider data saved to storage');
        }
        
        Alert.alert(
          'Success!', 
          isEditing ? 'Profile updated successfully!' : 'Profile setup completed!',
          [
            {
              text: 'Continue',
              onPress: () => {
                if (isEditing) {
                  navigation.goBack();
                } else {
                  navigation.replace('ProviderDashboard');
                }
              }
            }
          ]
        );
      } else {
        throw new Error(responseData.message || 'Update failed');
      }
      
    } catch (error) {
      console.error('❌ Profile update error:', error);
      Alert.alert(
        'Error', 
        error.message || 'Failed to update profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const selectExperience = (exp) => {
    setExperience(exp);
    setShowExperienceModal(false);
    // Clear experience validation error
    if (errors.experience) {
      setErrors(prev => ({ ...prev, experience: null }));
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          {isEditing ? 'Edit Profile' : 'Complete Your Profile'}
        </Text>
        <Text style={styles.subtitle}>
          {isEditing 
            ? 'Update your service specializations and contact information'
            : 'Set up your service specializations to start receiving requests'
          }
        </Text>

        {/* Provider Name */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : null]}
            placeholder="Enter your full name"
            value={providerName}
            onChangeText={(text) => {
              setProviderName(text);
              if (errors.name) {
                setErrors(prev => ({ ...prev, name: validateName(text) }));
              }
            }}
            onBlur={() => setErrors(prev => ({ ...prev, name: validateName(providerName) }))}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Phone Number */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={[styles.input, errors.phone ? styles.inputError : null]}
            placeholder="Enter your phone number"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (errors.phone) {
                setErrors(prev => ({ ...prev, phone: validatePhone(text) }));
              }
            }}
            onBlur={() => setErrors(prev => ({ ...prev, phone: validatePhone(phone) }))}
            keyboardType="phone-pad"
          />
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>

        {/* Experience Level */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Experience Level *</Text>
          <TouchableOpacity
            style={[styles.input, styles.selectInput, errors.experience ? styles.inputError : null]}
            onPress={() => setShowExperienceModal(true)}
          >
            <Text style={[styles.selectText, !experience && styles.placeholderText]}>
              {experience || 'Select your experience level'}
            </Text>
            <Text style={styles.selectArrow}>▼</Text>
          </TouchableOpacity>
          {errors.experience && <Text style={styles.errorText}>{errors.experience}</Text>}
        </View>

        {/* Service Categories */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Service Categories * ({selectedCategories.length} selected)</Text>
          {errors.categories && <Text style={styles.errorText}>{errors.categories}</Text>}
          
          <View style={styles.categoriesGrid}>
            {AVAILABLE_SERVICES.map((service) => {
              const isSelected = selectedCategories.includes(service.id);
              return (
                <TouchableOpacity
                  key={service.id}
                  style={[
                    styles.categoryCard,
                    isSelected ? styles.categoryCardSelected : null
                  ]}
                  onPress={() => toggleCategory(service.id)}
                >
                  <Text style={styles.categoryIcon}>{service.icon}</Text>
                  <Text style={[
                    styles.categoryName,
                    isSelected ? styles.categoryNameSelected : null
                  ]}>
                    {service.name}
                  </Text>
                  <Text style={[
                    styles.categoryDescription,
                    isSelected ? styles.categoryDescriptionSelected : null
                  ]}>
                    {service.description}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Specific Services (Optional) */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Specific Services (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g., Pipe repair, Leak fixing, Drain cleaning"
            value={serviceTypes}
            onChangeText={setServiceTypes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={styles.helpText}>Separate multiple services with commas</Text>
        </View>

        {/* Location Section */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>📍 Service Location (Recommended)</Text>
          <Text style={styles.helpText}>
            Your location helps us match you with nearby service requests
          </Text>
          
          {latitude && longitude ? (
            <View style={styles.locationInfo}>
              <Text style={styles.locationText}>✅ Location Set</Text>
              <Text style={styles.locationCoords}>
                {formatLocation(latitude, longitude)}
              </Text>
              <TouchableOpacity 
                style={styles.locationButton}
                onPress={getCurrentGPSLocation}
                disabled={locationLoading}
              >
                <Text style={styles.locationButtonText}>
                  {locationLoading ? '🔄 Updating...' : '🔄 Update Location'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.locationButton, styles.getLocationButton]}
              onPress={getCurrentGPSLocation}
              disabled={locationLoading}
            >
              <Text style={styles.locationButtonText}>
                {locationLoading ? '🔄 Getting Location...' : '📍 Get My Location'}
              </Text>
            </TouchableOpacity>
          )}
          
          {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading ? styles.submitButtonDisabled : null]}
          onPress={updateProfile}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading 
              ? (isEditing ? 'Updating...' : 'Setting up...') 
              : (isEditing ? 'Update Profile' : 'Complete Setup')
            }
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Experience Selection Modal */}
      <Modal
        visible={showExperienceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowExperienceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Experience Level</Text>
            
            {EXPERIENCE_OPTIONS.map((exp) => (
              <TouchableOpacity
                key={exp}
                style={styles.modalOption}
                onPress={() => selectExperience(exp)}
              >
                <Text style={styles.modalOptionText}>{exp}</Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowExperienceModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 32,
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#ff4d4f',
  },
  textArea: {
    minHeight: 80,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  selectArrow: {
    fontSize: 12,
    color: '#666',
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 14,
    marginTop: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  categoryCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  categoryIcon: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    color: '#333',
  },
  categoryNameSelected: {
    color: '#1976D2',
  },
  categoryDescription: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
    lineHeight: 16,
  },
  categoryDescriptionSelected: {
    color: '#1565C0',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 40,
  },
  locationInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  locationButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  getLocationButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 8,
    width: '100%',
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  modalCancelButton: {
    paddingVertical: 12,
    marginTop: 12,
  },
  modalCancelText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default ProviderProfileSetup;