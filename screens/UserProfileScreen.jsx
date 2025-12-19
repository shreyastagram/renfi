import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Linking,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import socketService from '../utils/socket';
import { userStorage } from '../utils/userStorage';
import { formatDistance } from '../utils/locationUtils';
import { API_CONFIG } from '../utils/apiConfig';
import { useApp } from '../context/AppContext';
import { getUserProfile as getJarbacProfile, getErrorMessage } from '../src/api/authApi';
import tokenService from '../src/services/tokenService';

// 🔧 NEW: Helper function to format estimated time for display
const formatEstimatedTime = (timeData) => {
  // If it's already a formatted string (like "10:27 pm"), return as is
  if (typeof timeData === 'string' && !timeData.includes('T') && !timeData.includes('Z')) {
    return timeData;
  }
  
  // If it's an ISO string, format it to IST display time
  if (typeof timeData === 'string' && (timeData.includes('T') || timeData.includes('Z'))) {
    try {
      const date = new Date(timeData);
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return timeData; // Return original if formatting fails
    }
  }
  
  return timeData || 'Not specified';
};

const UserProfileScreen = ({ navigation, route }) => {
  const { logout } = useApp();
  const [userProfile, setUserProfile] = useState(null);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isEditing, setIsEditing] = useState(route?.params?.edit || false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    pincode: ''
  });
  const [editErrors, setEditErrors] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);

  const [userId, setUserId] = useState(null);
  const [userToken, setUserToken] = useState(null);

  // Validation functions
  const validateFullName = (value) => {
    if (!value) return 'Full name is required.';
    if (value.length < 2) return 'Name must be at least 2 characters.';
    return '';
  };

  const validatePhone = (value) => {
    const phoneRegex = /^\+?\d{10,15}$/;
    if (!value) return 'Phone number is required.';
    if (!phoneRegex.test(value)) return 'Enter a valid phone number (10-15 digits).';
    return '';
  };

  const validateAddress = (value) => {
    if (!value) return 'Address is required.';
    if (value.length < 5) return 'Address must be at least 5 characters.';
    return '';
  };

  const validateCity = (value) => {
    if (!value) return 'City is required.';
    if (value.length < 2) return 'City must be at least 2 characters.';
    return '';
  };

  const validatePincode = (value) => {
    const pincodeRegex = /^\d{5,6}$/;
    if (!value) return 'Pincode is required.';
    if (!pincodeRegex.test(value)) return 'Enter a valid pincode (5-6 digits).';
    return '';
  };

  useEffect(() => {
    initializeUser();
  }, []);

  // Populate edit form when entering edit mode via route params
  useEffect(() => {
    if (isEditing && userProfile && (!editForm.fullName && !editForm.phone)) {
      console.log('🔧 Populating edit form from route params with userProfile:', userProfile);
      setEditForm({
        fullName: userProfile?.name || '',
        phone: userProfile?.phone || '',
        address: userProfile?.address || '',
        city: userProfile?.city || '',
        pincode: userProfile?.pincode || ''
      });
    }
  }, [isEditing, userProfile]);

  // Check authentication every time screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const checkAuthAndRefresh = async () => {
        const storedUserId = await userStorage.getUserId();
        const storedToken = await userStorage.getUserToken();
        
        if (!storedUserId || !storedToken) {
          Alert.alert('Session Expired', 'Please login again', [
            { text: 'OK', onPress: () => logout() }
          ]);
          return;
        }
        
        // If we have different stored data than current state, refresh
        if (storedUserId !== userId || storedToken !== userToken) {
          console.log('🔄 Authentication changed, refreshing...');
          setUserId(storedUserId);
          setUserToken(storedToken);
          
          const storedUserData = await userStorage.getUserData();
          if (storedUserData) {
            setUserProfile({
              name: storedUserData.name || 'User',
              email: storedUserData.email || '',
              phone: storedUserData.phone || '',
              emergencyContact: storedUserData.emergencyContact || '',
              address: storedUserData.address || ''
            });
          }
        }
      };
      
      checkAuthAndRefresh();
    }, [userId, userToken])
  );

  const initializeUser = async () => {
    try {
      // First check JARBAC tokens
      const hasJarbacTokens = await tokenService.isLoggedIn();
      
      if (hasJarbacTokens) {
        console.log('🔐 JARBAC tokens found');
        const jarbacUserData = await tokenService.getUserData();
        const jarbacAccessToken = await tokenService.getAccessToken();
        
        if (jarbacUserData && jarbacAccessToken) {
          const uid = jarbacUserData.userId;
          setUserId(uid);
          setUserToken(jarbacAccessToken);
          
          // Set initial profile from stored data
          setUserProfile({
            name: jarbacUserData.fullName || 'User',
            email: jarbacUserData.email || '',
            phone: jarbacUserData.phoneNumber || '',
            role: jarbacUserData.role || 'USER',
          });
          console.log('📱 Loaded profile from JARBAC storage:', jarbacUserData);
          
          // Load full profile from server
          loadUserProfile(uid, jarbacAccessToken);
          loadServiceHistory(uid, jarbacAccessToken);
          return;
        }
      }
      
      // Fall back to legacy storage
      console.log('🔍 Checking legacy storage...');
      const storedUserId = await userStorage.getUserId();
      const storedToken = await userStorage.getUserToken();
      const storedUserData = await userStorage.getUserData();
      
      if (!storedUserId || !storedToken) {
        Alert.alert('Authentication Error', 'Please login again', [
          { text: 'OK', onPress: () => logout() }
        ]);
        return;
      }
      
      setUserId(storedUserId);
      setUserToken(storedToken);
      
      // Load basic profile from stored data first (for offline capability)
      if (storedUserData) {
        setUserProfile({
          name: storedUserData.name || 'User',
          email: storedUserData.email || '',
          phone: storedUserData.phone || '',
          emergencyContact: storedUserData.emergencyContact || '',
          address: storedUserData.address || ''
        });
        console.log('📱 Loaded profile from legacy storage:', storedUserData);
      }
      
      // Load data from server (will update with latest info if available)
      loadUserProfile(storedUserId, storedToken);
      loadServiceHistory(storedUserId, storedToken);
    } catch (error) {
      console.error('Error initializing user:', error);
      Alert.alert('Error', 'Failed to initialize user data');
    }
  };

  const loadUserProfile = async (uid = userId, token = userToken) => {
    try {
      if (!uid || !token) {
        console.warn('Missing user ID or token for profile load');
        return;
      }
      
      console.log('🔍 Loading profile for user:', uid);
      setLoading(true);
      
      // Try JARBAC profile API first
      try {
        console.log('🔐 Trying JARBAC profile API...');
        const jarbacProfile = await getJarbacProfile();
        
        if (jarbacProfile) {
          console.log('✅ JARBAC profile loaded:', jarbacProfile);
          setUserProfile({
            name: jarbacProfile.fullName || jarbacProfile.name || 'User',
            email: jarbacProfile.email || '',
            phone: jarbacProfile.phoneNumber || jarbacProfile.phone || '',
            emergencyContact: jarbacProfile.emergencyContact || '',
            address: jarbacProfile.address || '',
            city: jarbacProfile.city || '',
            pincode: jarbacProfile.pincode || '',
            role: jarbacProfile.role || 'USER',
          });
          setLoading(false);
          return; // Success with JARBAC, don't need Node.js
        }
      } catch (jarbacError) {
        console.log('⚠️ JARBAC profile failed, trying Node.js:', jarbacError.message);
        // Fall through to Node.js backend
      }
      
      // Fall back to Node.js backend
      console.log('📡 Trying Node.js profile API...');
      const response = await fetch(API_CONFIG.USER.PROFILE(uid), {
        headers: API_CONFIG.HEADERS.AUTH(token),
      });
      
      console.log('📡 Profile response status:', response.status);
      const data = await response.json();
      console.log('📋 Profile response data:', data);
      
      if (response.ok) {
        setUserProfile(data.profile);
        console.log('✅ Profile loaded successfully:', data.profile);
      } else {
        if (response.status === 401) {
          Alert.alert('Session Expired', 'Please login again', [
            { text: 'OK', onPress: () => logout() }
          ]);
          return;
        }
        if (response.status === 404) {
          Alert.alert('Feature Not Available', 'User profile endpoint is not implemented yet');
          return;
        }
        Alert.alert('Error', data.message || 'Failed to load profile');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Network Error', 'Unable to connect to server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

    const loadServiceHistory = async (uid = userId, token = userToken) => {
    try {
      if (!uid || !token) {
        console.warn('Missing user ID or token for history load');
        return;
      }
      
      console.log('🔍 Loading service history for user:', uid);
      console.log('🔑 Using token:', token ? `${token.substring(0, 20)}...` : 'null');
      
      setHistoryLoading(true);
      const response = await fetch(API_CONFIG.USER.SERVICE_HISTORY(uid), {
        headers: API_CONFIG.HEADERS.AUTH(token),
      });
      
      console.log('📡 History response status:', response.status);
      const data = await response.json();
      console.log('📋 History response data:', data);
      
      if (response.ok) {
        setServiceHistory(data.history);
        console.log('✅ Service history loaded successfully:', data.history);
      } else {
        console.log('❌ Service history request failed');
        console.log('❌ Response status:', response.status);
        console.log('❌ Response data:', data);
        
        if (response.status === 401) {
          console.log('❌ 401 Unauthorized - Token might be invalid or expired');
          Alert.alert('Session Expired', 'Please login again', [
            { text: 'OK', onPress: () => logout() }
          ]);
          return;
        }
        if (response.status === 403) {
          console.log('❌ 403 Forbidden - Access denied to this resource');
          Alert.alert('Access Denied', 'You do not have permission to access this service history');
          return;
        }
        if (response.status === 404) {
          Alert.alert('Feature Not Available', 'Service history endpoint is not implemented yet');
          return;
        }
        
        // Show the specific error message from backend
        const errorMessage = data.message || data.error || 'Failed to load service history';
        Alert.alert('Error', `Service history error: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error loading service history:', error);
      Alert.alert('Network Error', 'Unable to connect to server. Please check your connection.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      console.log('🔄 Pull-to-refresh triggered');
      setRefreshing(true);
      
      // Get fresh credentials from storage
      const storedUserId = await userStorage.getUserId();
      const storedToken = await userStorage.getUserToken();
      
      if (!storedUserId || !storedToken) {
        Alert.alert('Authentication Error', 'Please login again', [
          { text: 'OK', onPress: () => navigation.replace('UserLoginSignup') }
        ]);
        setRefreshing(false);
        return;
      }
      
      // Update state if needed
      if (storedUserId !== userId) {
        setUserId(storedUserId);
      }
      if (storedToken !== userToken) {
        setUserToken(storedToken);
      }
      
      // Load both profile and history with fresh credentials
      await Promise.all([
        loadUserProfile(storedUserId, storedToken), 
        loadServiceHistory(storedUserId, storedToken)
      ]);
    } catch (error) {
      console.error('Error during pull-to-refresh:', error);
      Alert.alert('Error', 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const refreshServiceHistory = async () => {
    try {
      console.log('🔄 Manual refresh triggered');
      const storedUserId = await userStorage.getUserId();
      const storedToken = await userStorage.getUserToken();
      
      console.log('🔄 Stored User ID:', storedUserId);
      console.log('🔄 Stored Token:', storedToken ? 'Present' : 'Missing');
      console.log('🔄 Current userId state:', userId);
      console.log('🔄 Current userToken state:', userToken ? 'Present' : 'Missing');
      
      if (!storedUserId || !storedToken) {
        Alert.alert('Authentication Error', 'Please login again to refresh service history', [
          { text: 'OK', onPress: () => navigation.replace('UserLoginSignup') }
        ]);
        return;
      }
      
      // Update state if needed
      if (storedUserId !== userId) {
        setUserId(storedUserId);
      }
      if (storedToken !== userToken) {
        setUserToken(storedToken);
      }
      
      // Load service history with fresh credentials
      await loadServiceHistory(storedUserId, storedToken);
    } catch (error) {
      console.error('Error during manual refresh:', error);
      Alert.alert('Error', 'Failed to refresh service history');
    }
  };

  const createTestServiceHistory = async () => {
    try {
      const uid = await userStorage.getUserId();
      const token = await userStorage.getUserToken();
      
      if (!uid || !token) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }
      
      console.log('🧪 Creating test service history entry');
      console.log('🧪 User ID:', uid);
      console.log('🧪 Token:', token ? 'Present' : 'Missing');
      
      // Create a test service request entry via API
      const testRequest = {
        userId: uid,
        serviceName: 'Test Plumber',
        serviceIcon: '🔧',
        serviceDescription: 'Test service request for debugging',
        status: 'completed',
        providerId: 'test_provider_123',
        providerName: 'Test Provider',
        providerPhone: '+1234567890',
        estimatedTime: '30 minutes',
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/user/create-test-history`, {
        method: 'POST',
        headers: API_CONFIG.HEADERS.AUTH(token),
        body: JSON.stringify(testRequest)
      });
      
      console.log('🧪 Test creation response status:', response.status);
      const result = await response.json();
      console.log('🧪 Test creation response:', result);
      
      if (response.ok) {
        Alert.alert('Success', 'Test service history created. Refreshing...');
        // Refresh the service history
        loadServiceHistory(uid, token);
      } else {
        Alert.alert('Error', result.message || 'Failed to create test history');
      }
    } catch (error) {
      console.error('🧪 Error creating test history:', error);
      Alert.alert('Error', 'Network error while creating test history');
    }
  };

  const startEditing = () => {
    // Initialize edit form with current profile data
    setEditForm({
      fullName: userProfile?.name || '',
      phone: userProfile?.phone || '',
      address: userProfile?.address || '',
      city: userProfile?.city || '',
      pincode: userProfile?.pincode || ''
    });
    setEditErrors({});
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({});
    setEditErrors({});
  };

  const validateEditForm = () => {
    const errors = {
      fullName: validateFullName(editForm.fullName),
      phone: validatePhone(editForm.phone),
      address: validateAddress(editForm.address),
      city: validateCity(editForm.city),
      pincode: validatePincode(editForm.pincode)
    };

    setEditErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  const saveProfile = async () => {
    if (!validateEditForm()) {
      Alert.alert('Validation Error', 'Please fix the errors in the form.');
      return;
    }

    try {
      setSaveLoading(true);
      
      const storedUserId = await userStorage.getUserId();
      const storedToken = await userStorage.getUserToken();
      
      if (!storedUserId || !storedToken) {
        Alert.alert('Authentication Error', 'Please login again');
        return;
      }

      console.log('🔄 Updating user profile:', editForm);
      
      const response = await fetch(`http://10.0.2.2:5050/api/user/profile/${storedUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storedToken}`
        },
        body: JSON.stringify(editForm)
      });

      const data = await response.json();
      console.log('📡 Profile update response:', data);

      if (response.ok) {
        // Update local profile state
        setUserProfile({
          ...userProfile,
          name: editForm.fullName,
          phone: editForm.phone,
          address: editForm.address,
          city: editForm.city,
          pincode: editForm.pincode
        });

        // Update stored user data
        const storedUserData = await userStorage.getUserData();
        const updatedUserData = {
          ...storedUserData,
          name: editForm.fullName,
          fullName: editForm.fullName,
          phone: editForm.phone,
          address: editForm.address,
          city: editForm.city,
          pincode: editForm.pincode
        };
        await userStorage.saveUserData(updatedUserData);

        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        Alert.alert('Error', data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Network Error', 'Unable to connect to server. Please check your connection.');
    } finally {
      setSaveLoading(false);
    }
  };

  const openServiceDetails = (request) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const contactProvider = (phone) => {
    if (phone && phone !== 'Not available') {
      const phoneUrl = `tel:${phone}`;
      Linking.openURL(phoneUrl);
    } else {
      Alert.alert('Error', 'Provider phone number not available');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'accepted': return '#2196F3';
      case 'cancelled': return '#F44336';
      case 'rejected': return '#FF9800';
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return '✅';
      case 'accepted': return '🔵';
      case 'cancelled': return '❌';
      case 'rejected': return '⚠️';
      default: return '⏳';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Profile Section */}
      <View style={styles.profileSection}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{userProfile?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{userProfile?.email || 'No email'}</Text>
            <Text style={styles.userPhone}>{userProfile?.phone || 'No phone'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={startEditing}
          >
            <Text style={styles.editButtonText}>✏️</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{serviceHistory.length}</Text>
            <Text style={styles.statLabel}>Total Requests</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {serviceHistory.filter(s => s.status === 'completed').length}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {serviceHistory.filter(s => s.status === 'cancelled').length}
            </Text>
            <Text style={styles.statLabel}>Cancelled</Text>
          </View>
        </View>
      </View>

      {/* Service History Section */}
      <View style={styles.historySection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Service History</Text>
          <TouchableOpacity onPress={refreshServiceHistory} disabled={historyLoading}>
            <Text style={styles.refreshButton}>
              {historyLoading ? '🔄' : '↻'}
            </Text>
          </TouchableOpacity>
        </View>

        {historyLoading ? (
          <ActivityIndicator size="small" color="#007AFF" style={styles.historyLoader} />
        ) : serviceHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No service requests yet</Text>
            <TouchableOpacity 
              style={styles.requestButton}
              onPress={() => navigation.navigate('ServiceSelection')}
            >
              <Text style={styles.requestButtonText}>Request a Service</Text>
            </TouchableOpacity>
            
            {/* Debug button for testing */}
            <TouchableOpacity 
              style={[styles.requestButton, { backgroundColor: '#FF6B6B', marginTop: 10 }]}
              onPress={createTestServiceHistory}
            >
              <Text style={styles.requestButtonText}>🧪 Create Test History</Text>
            </TouchableOpacity>
          </View>
        ) : (
          serviceHistory.map((request, index) => (
            <TouchableOpacity
              key={request.requestId || index}
              style={styles.historyItem}
              onPress={() => openServiceDetails(request)}
            >
              <View style={styles.historyHeader}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceIcon}>{request.serviceIcon}</Text>
                  <View>
                    <Text style={styles.serviceName}>{request.serviceName}</Text>
                    <Text style={styles.requestDate}>{formatDate(request.createdAt)}</Text>
                  </View>
                </View>
                <View style={styles.statusContainer}>
                  <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                    {getStatusIcon(request.status)} {request.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              {request.provider && (
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName}>
                    Provider: {request.provider.name}
                  </Text>
                  <Text style={styles.providerDetails}>
                    📞 {request.provider.phone} • ⭐ {request.provider.rating || 'N/A'}
                  </Text>
                </View>
              )}
              
              <View style={styles.requestDetails}>
                <Text style={styles.requestDescription} numberOfLines={2}>
                  {request.description}
                </Text>
                {request.estimatedTime && (
                  <Text style={styles.estimatedTime}>
                    ⏱️ {formatEstimatedTime(request.estimatedTime)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Service Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Service Details</Text>
            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {selectedRequest && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Service Information</Text>
                <Text style={styles.modalServiceName}>
                  {selectedRequest.serviceIcon} {selectedRequest.serviceName}
                </Text>
                <Text style={styles.modalDescription}>{selectedRequest.description}</Text>
                <Text style={styles.modalDate}>
                  Requested: {formatDate(selectedRequest.createdAt)}
                </Text>
                <Text style={[styles.modalStatus, { color: getStatusColor(selectedRequest.status) }]}>
                  Status: {getStatusIcon(selectedRequest.status)} {selectedRequest.status.toUpperCase()}
                </Text>
              </View>

              {selectedRequest.provider && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Provider Details</Text>
                  <Text style={styles.modalProviderName}>{selectedRequest.provider.name}</Text>
                  <Text style={styles.modalProviderInfo}>
                    📞 {selectedRequest.provider.phone}
                  </Text>
                  <Text style={styles.modalProviderInfo}>
                    ⭐ Rating: {selectedRequest.provider.rating || 'Not rated'}
                  </Text>
                  <Text style={styles.modalProviderInfo}>
                    🔧 Experience: {selectedRequest.provider.experience || 'Not specified'}
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => contactProvider(selectedRequest.provider.phone)}
                  >
                    <Text style={styles.contactButtonText}>📞 Contact Provider</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedRequest.estimatedTime && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Service Details</Text>
                  <Text style={styles.modalInfo}>
                    ⏱️ Estimated Completion Time: {formatEstimatedTime(selectedRequest.estimatedTime)}
                  </Text>
                </View>
              )}

              {selectedRequest.completedAt && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Completion</Text>
                  <Text style={styles.modalInfo}>
                    ✅ Completed: {formatDate(selectedRequest.completedAt)}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditing}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={cancelEditing}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.editForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={[styles.editInput, editErrors.fullName ? styles.inputError : null]}
                  value={editForm.fullName}
                  onChangeText={(text) => {
                    setEditForm({...editForm, fullName: text});
                    if (editErrors.fullName) {
                      setEditErrors({...editErrors, fullName: validateFullName(text)});
                    }
                  }}
                  placeholder="Enter your full name"
                />
                {!!editErrors.fullName && <Text style={styles.errorText}>{editErrors.fullName}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={[styles.editInput, editErrors.phone ? styles.inputError : null]}
                  value={editForm.phone}
                  onChangeText={(text) => {
                    setEditForm({...editForm, phone: text});
                    if (editErrors.phone) {
                      setEditErrors({...editErrors, phone: validatePhone(text)});
                    }
                  }}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                />
                {!!editErrors.phone && <Text style={styles.errorText}>{editErrors.phone}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Home Address</Text>
                <TextInput
                  style={[styles.editInput, styles.textArea, editErrors.address ? styles.inputError : null]}
                  value={editForm.address}
                  onChangeText={(text) => {
                    setEditForm({...editForm, address: text});
                    if (editErrors.address) {
                      setEditErrors({...editErrors, address: validateAddress(text)});
                    }
                  }}
                  placeholder="Enter your home address"
                  multiline
                  numberOfLines={3}
                />
                {!!editErrors.address && <Text style={styles.errorText}>{editErrors.address}</Text>}
              </View>

              <View style={styles.row}>
                <View style={styles.halfInputContainer}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={[styles.editInput, editErrors.city ? styles.inputError : null]}
                    value={editForm.city}
                    onChangeText={(text) => {
                      setEditForm({...editForm, city: text});
                      if (editErrors.city) {
                        setEditErrors({...editErrors, city: validateCity(text)});
                      }
                    }}
                    placeholder="City"
                  />
                  {!!editErrors.city && <Text style={styles.errorText}>{editErrors.city}</Text>}
                </View>

                <View style={styles.halfInputContainer}>
                  <Text style={styles.inputLabel}>Pincode</Text>
                  <TextInput
                    style={[styles.editInput, editErrors.pincode ? styles.inputError : null]}
                    value={editForm.pincode}
                    onChangeText={(text) => {
                      setEditForm({...editForm, pincode: text});
                      if (editErrors.pincode) {
                        setEditErrors({...editErrors, pincode: validatePincode(text)});
                      }
                    }}
                    placeholder="Pincode"
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  {!!editErrors.pincode && <Text style={styles.errorText}>{editErrors.pincode}</Text>}
                </View>
              </View>

              <View style={styles.editButtonContainer}>
                <TouchableOpacity 
                  style={[styles.editActionButton, styles.cancelButton]}
                  onPress={cancelEditing}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.editActionButton, styles.saveButton]}
                  onPress={saveProfile}
                  disabled={saveLoading}
                >
                  <Text style={styles.saveButtonText}>
                    {saveLoading ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  profileSection: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  editButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  editButtonText: {
    fontSize: 18,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  historySection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    fontSize: 18,
    color: '#007AFF',
  },
  historyLoader: {
    marginVertical: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  requestButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  requestDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  providerInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  providerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  providerDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  requestDetails: {
    marginTop: 8,
  },
  requestDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  estimatedTime: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  modalServiceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  modalDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalStatus: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalProviderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalProviderInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  contactButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  editForm: {
    padding: 4,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#ff4d4f',
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 14,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInputContainer: {
    width: '48%',
  },
  editButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  editActionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default UserProfileScreen;
