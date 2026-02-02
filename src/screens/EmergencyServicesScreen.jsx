/**
 * Emergency Services Screen
 * 
 * Handles two types of emergency services:
 * 1. Location-based: Snake Catcher, Private Ambulance, Mortuary Van
 * 2. Static Numbers: Fire Brigade, Police, Hospital
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { useLocation } from '../context/LocationContext';
import {
  EMERGENCY_SERVICE_TYPES,
  LOCATION_BASED_SERVICES,
  STATIC_NUMBER_SERVICES,
  EMERGENCY_SERVICE_LABELS,
  EMERGENCY_SERVICE_ICONS,
  getStaticEmergencyNumbers,
  createEmergencyRequest,
  getNearbyEmergencyProviders,
  acceptEmergencyRequest,
  rejectEmergencyProvider,
  cancelEmergencyRequest,
} from '../services/emergencyServicesService';
import { addToFavorites } from '../services/favoritesService';

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  background: '#faf7f7',
  white: '#FFFFFF',
  danger: '#DC2626',
  warning: '#F59E0B',
  success: '#10B981',
  neutral: '#6B7280',
};

/**
 * Service Card Component - Using MaterialIcon instead of emoji
 */
const ServiceCard = ({ service, onPress, isStatic }) => (
  <TouchableOpacity
    style={[styles.serviceCard, isStatic && styles.staticServiceCard]}
    onPress={() => onPress(service)}
    activeOpacity={0.7}
  >
    <View style={[styles.serviceIconContainer, isStatic && styles.staticIconContainer]}>
      <MaterialIcon 
        name={EMERGENCY_SERVICE_ICONS[service.id]} 
        size={28} 
        color={isStatic ? BRAND.danger : BRAND.secondary} 
      />
    </View>
    <Text style={styles.serviceName}>{service.name}</Text>
    {isStatic && (
      <View style={styles.staticBadge}>
        <MaterialIcon name="phone" size={12} color={BRAND.danger} />
        <Text style={styles.staticBadgeText}>Call</Text>
      </View>
    )}
  </TouchableOpacity>
);

/**
 * Provider Card Component
 */
const ProviderCard = ({ provider, onCall, onBook, onPress, booking, isFavorite }) => (
  <TouchableOpacity 
    style={styles.providerCard} 
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.providerInfo}>
      <View style={styles.providerAvatar}>
        <Text style={styles.providerInitial}>
          {provider.name?.charAt(0)?.toUpperCase() || 'P'}
        </Text>
        {isFavorite && (
          <View style={styles.favoriteBadge}>
            <MaterialIcon name="star" size={10} color="#F59E0B" />
          </View>
        )}
      </View>
      <View style={styles.providerDetails}>
        <View style={styles.providerNameRow}>
          <Text style={styles.providerName}>{provider.name}</Text>
          {provider.verified && (
            <MaterialIcon name="verified" size={16} color="#2563EB" style={styles.verifiedBadge} />
          )}
        </View>
        <View style={styles.providerDistanceRow}>
          <MaterialIcon name="location-on" size={14} color="#6B7280" />
          <Text style={styles.providerDistance}>
            {provider.distanceKm ? `${provider.distanceKm.toFixed(1)} km` : provider.distance || 'Nearby'}
          </Text>
        </View>
        {(provider.rating > 0 || provider.ratings?.average > 0) && (
          <View style={styles.providerRatingRow}>
            <MaterialIcon name="star" size={14} color="#F59E0B" />
            <Text style={styles.providerRating}>
              {(provider.ratings?.average || provider.rating || 0).toFixed(1)}
            </Text>
          </View>
        )}
      </View>
    </View>
    <View style={styles.providerActions}>
      <TouchableOpacity 
        style={styles.callButton} 
        onPress={(e) => {
          e.stopPropagation();
          onCall(provider.phone);
        }}
      >
        <MaterialIcon name="phone" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.bookButton, booking && styles.bookButtonLoading]} 
        onPress={(e) => {
          e.stopPropagation();
          onBook(provider);
        }} 
        disabled={booking}
      >
        {booking ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.bookButtonText}>Send Request</Text>
        )}
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
);

/**
 * Static Numbers Modal
 */
const StaticNumbersModal = ({ visible, onClose, numbers, serviceType }) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {EMERGENCY_SERVICE_LABELS[serviceType] || 'Emergency'} Numbers
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcon name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.numbersContainer}>
          {numbers.length === 0 ? (
            <Text style={styles.noNumbersText}>No numbers available</Text>
          ) : (
            numbers.map((item, index) => (
              <View key={index} style={styles.numberCard}>
                <View style={styles.numberInfo}>
                  <Text style={styles.numberLabel}>{item.label || item.name}</Text>
                  {item.description && (
                    <Text style={styles.numberDescription}>{item.description}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.callNumberButton}
                  onPress={() => Linking.openURL(`tel:${item.number}`)}
                >
                  <MaterialIcon name="phone" size={20} color="#FFFFFF" />
                  <Text style={styles.callNumberText}>{item.number}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
        
        <TouchableOpacity style={styles.closeModalButton} onPress={onClose}>
          <Text style={styles.closeModalButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const EmergencyServicesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile } = useApp();
  const { currentLocation, displayAddress, locationLoading, refreshLocation } = useLocation();
  
  // User ID
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
  
  // State
  const [selectedService, setSelectedService] = useState(null);
  const [step, setStep] = useState('select'); // select, providers, static
  const [isLoading, setIsLoading] = useState(false);
  const [createdRequest, setCreatedRequest] = useState(null);
  const [providers, setProviders] = useState([]);
  const [staticNumbers, setStaticNumbers] = useState([]);
  const [bookingProvider, setBookingProvider] = useState(null);
  const [notes, setNotes] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Service categories
  const locationBasedServices = LOCATION_BASED_SERVICES.map(id => ({
    id,
    name: EMERGENCY_SERVICE_LABELS[id],
  }));
  
  const staticServices = STATIC_NUMBER_SERVICES.map(id => ({
    id,
    name: EMERGENCY_SERVICE_LABELS[id],
  }));

  /**
   * Handle service selection
   */
  const handleServiceSelect = async (service) => {
    setSelectedService(service);
    
    if (STATIC_NUMBER_SERVICES.includes(service.id)) {
      // Static service - fetch numbers
      setIsLoading(true);
      const result = await getStaticEmergencyNumbers(service.id);
      setIsLoading(false);
      
      if (result.success) {
        // Handle both array format and object format
        const numbers = Array.isArray(result.data) 
          ? result.data 
          : result.data?.numbers || [];
        setStaticNumbers(numbers);
        setStep('static');
      } else {
        Alert.alert('Error', result.error || 'Failed to fetch emergency numbers');
      }
    } else {
      // Location-based service - show notes input
      setShowNotesInput(true);
    }
  };

  /**
   * Create emergency request and fetch providers
   */
  const handleCreateRequest = async () => {
    if (!currentLocation) {
      Alert.alert('Location Required', 'Please enable location to request emergency services.');
      refreshLocation();
      return;
    }

    setIsLoading(true);
    setShowNotesInput(false);
    
    // Create request
    const createResult = await createEmergencyRequest({
      userId,
      serviceType: selectedService.id,
      location: {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: displayAddress,
      },
      notes,
    });
    
    if (!createResult.success) {
      setIsLoading(false);
      Alert.alert('Error', createResult.error || 'Failed to create request');
      return;
    }
    
    setCreatedRequest(createResult.data);
    
    // Fetch nearby providers
    const providersResult = await getNearbyEmergencyProviders(createResult.data._id);
    setIsLoading(false);
    
    if (providersResult.success) {
      setProviders(providersResult.data?.providers || []);
      setStep('providers');
    } else {
      Alert.alert('No Providers', providersResult.error || 'No providers available nearby');
    }
  };

  /**
   * Handle calling provider
   */
  const handleCallProvider = (phone) => {
    if (!phone) {
      Alert.alert('Error', 'Provider phone number not available');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  /**
   * Handle booking provider
   */
  const handleBookProvider = async (provider) => {
    if (!createdRequest) return;
    
    setBookingProvider(provider._id);
    
    const result = await acceptEmergencyRequest(createdRequest._id, provider._id);
    
    setBookingProvider(null);
    
    if (result.success) {
      Alert.alert(
        'Request Sent!',
        `Your request has been sent to ${provider.name}. They will contact you soon.`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      Alert.alert('Error', result.error || 'Failed to send request');
    }
  };

  /**
   * Handle reject provider
   */
  const handleRejectProvider = async (providerId) => {
    if (!createdRequest) return;
    
    Alert.alert(
      'Reject Provider',
      'Are you sure you want to remove this provider from the list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            const result = await rejectEmergencyProvider(createdRequest._id, providerId);
            if (result.success) {
              setProviders(prev => prev.filter(p => p._id !== providerId));
            }
          },
        },
      ]
    );
  };

  /**
   * Retry search for providers
   */
  const handleRetrySearch = async () => {
    if (!createdRequest) return;
    
    setRefreshing(true);
    
    // Re-fetch nearby providers
    const result = await getNearbyEmergencyProviders(createdRequest._id);
    
    setRefreshing(false);
    
    if (result.success) {
      setProviders(result.data?.providers || []);
      if ((result.data?.providers || []).length === 0) {
        Alert.alert('No Providers', 'No more providers available in your area.');
      }
    } else {
      Alert.alert('Error', result.error || 'Failed to refresh providers');
    }
  };

  /**
   * Handle cancel request
   */
  const handleCancelRequest = () => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this emergency request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            if (createdRequest) {
              await cancelEmergencyRequest(createdRequest._id, userId, 'Cancelled by user');
            }
            resetState();
          },
        },
      ]
    );
  };

  /**
   * Reset state
   */
  const resetState = () => {
    setSelectedService(null);
    setStep('select');
    setCreatedRequest(null);
    setProviders([]);
    setStaticNumbers([]);
    setNotes('');
    setShowNotesInput(false);
  };

  /**
   * Render header
   */
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => {
          if (step === 'select') {
            navigation.goBack();
          } else {
            if (step === 'providers' && createdRequest) {
              handleCancelRequest();
            } else {
              resetState();
            }
          }
        }}
      >
        <MaterialIcon name="arrow-back" size={24} color="#1F2937" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        {step === 'select' ? 'Emergency Services' : 
         step === 'static' ? EMERGENCY_SERVICE_LABELS[selectedService?.id] :
         'Nearby Providers'}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  /**
   * Render service selection
   */
  const renderServiceSelection = () => (
    <ScrollView 
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Location-based Services */}
      <View style={styles.sectionHeader}>
        <MaterialIcon name="location-on" size={20} color={BRAND.primary} />
        <Text style={styles.sectionTitle}>Location-Based Services</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        Find nearby providers for these services
      </Text>
      
      <View style={styles.servicesGrid}>
        {locationBasedServices.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            onPress={handleServiceSelect}
            isStatic={false}
          />
        ))}
      </View>
      
      {/* Static Number Services */}
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <MaterialIcon name="phone" size={20} color={BRAND.danger} />
        <Text style={styles.sectionTitle}>Emergency Helplines</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        Call these numbers directly for immediate help
      </Text>
      
      <View style={styles.servicesGrid}>
        {staticServices.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            onPress={handleServiceSelect}
            isStatic={true}
          />
        ))}
      </View>
    </ScrollView>
  );

  /**
   * Render providers list
   */
  const renderProvidersList = () => (
    <View style={styles.providersContainer}>
      <View style={styles.providersHeader}>
        <Text style={styles.providersTitle}>
          {providers.length} Provider{providers.length !== 1 ? 's' : ''} Found
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={handleRetrySearch}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={BRAND.primary} />
          ) : (
            <>
              <MaterialIcon name="refresh" size={18} color={BRAND.primary} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      {providers.length === 0 ? (
        <View style={styles.emptyProviders}>
          <MaterialIcon name="search-off" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>No providers available</Text>
          <Text style={styles.emptySubtext}>
            All providers have been rejected or none are available nearby
          </Text>
          <TouchableOpacity 
            style={styles.retryLargeButton}
            onPress={handleRetrySearch}
          >
            <Text style={styles.retryLargeButtonText}>Search Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ProviderCard
              provider={item}
              onCall={handleCallProvider}
              onBook={handleBookProvider}
              onPress={() => {}}
              booking={bookingProvider === item._id}
              isFavorite={item.isFavorite}
            />
          )}
          contentContainerStyle={styles.providersList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRetrySearch}
              colors={[BRAND.primary]}
            />
          }
        />
      )}
      
      <TouchableOpacity 
        style={styles.cancelButton}
        onPress={handleCancelRequest}
      >
        <Text style={styles.cancelButtonText}>Cancel Request</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render notes input modal
   */
  const renderNotesInput = () => (
    <Modal
      visible={showNotesInput}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowNotesInput(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.notesModalContent}>
          <Text style={styles.notesModalTitle}>
            {EMERGENCY_SERVICE_LABELS[selectedService?.id]} Request
          </Text>
          <Text style={styles.notesModalSubtitle}>
            Add any details that might help the provider
          </Text>
          
          <TextInput
            style={styles.notesInput}
            placeholder="e.g., Snake spotted in backyard near the fence..."
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          
          <View style={styles.locationPreview}>
            <MaterialIcon name="location-on" size={18} color={BRAND.primary} />
            <Text style={styles.locationText} numberOfLines={2}>
              {displayAddress || 'Fetching location...'}
            </Text>
          </View>
          
          <View style={styles.notesModalActions}>
            <TouchableOpacity 
              style={styles.notesModalCancelButton}
              onPress={() => {
                setShowNotesInput(false);
                setSelectedService(null);
              }}
            >
              <Text style={styles.notesModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.notesModalConfirmButton}
              onPress={handleCreateRequest}
              disabled={isLoading || locationLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.notesModalConfirmText}>Find Providers</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {isLoading && step === 'select' ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={styles.loadingText}>Finding providers...</Text>
        </View>
      ) : step === 'select' ? (
        renderServiceSelection()
      ) : step === 'providers' ? (
        renderProvidersList()
      ) : null}
      
      {/* Static Numbers Modal */}
      <StaticNumbersModal
        visible={step === 'static'}
        onClose={resetState}
        numbers={staticNumbers}
        serviceType={selectedService?.id}
      />
      
      {/* Notes Input Modal */}
      {renderNotesInput()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: BRAND.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    marginLeft: 28,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  serviceCard: {
    width: '31%',
    marginHorizontal: '1.16%',
    backgroundColor: BRAND.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  staticServiceCard: {
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  staticIconContainer: {
    backgroundColor: '#FEE2E2',
  },
  serviceIconEmoji: {
    fontSize: 24,
  },
  serviceName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  staticBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
  },
  staticBadgeText: {
    fontSize: 10,
    color: BRAND.danger,
    marginLeft: 2,
    fontWeight: '500',
  },
  
  // Providers
  providersContainer: {
    flex: 1,
    padding: 16,
  },
  providersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  providersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
  },
  retryButtonText: {
    fontSize: 13,
    color: BRAND.primary,
    fontWeight: '500',
    marginLeft: 4,
  },
  providersList: {
    paddingBottom: 80,
  },
  providerCard: {
    backgroundColor: BRAND.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerInitial: {
    fontSize: 20,
    fontWeight: '600',
    color: BRAND.white,
  },
  favoriteBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BRAND.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  providerDetails: {
    flex: 1,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  providerDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  providerDistance: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  providerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  providerRating: {
    fontSize: 13,
    color: '#374151',
    marginLeft: 4,
  },
  providerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bookButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookButtonLoading: {
    opacity: 0.7,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.white,
  },
  
  // Empty state
  emptyProviders: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  retryLargeButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: BRAND.primary,
    borderRadius: 24,
  },
  retryLargeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.white,
  },
  
  // Cancel button
  cancelButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.danger,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: BRAND.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  numbersContainer: {
    maxHeight: 400,
  },
  noNumbersText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 32,
  },
  numberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  numberInfo: {
    flex: 1,
    marginRight: 16,
  },
  numberLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  numberDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  callNumberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.danger,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  callNumberText: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.white,
    marginLeft: 8,
  },
  closeModalButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  
  // Notes Modal
  notesModalContent: {
    backgroundColor: BRAND.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  notesModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  notesModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 100,
    backgroundColor: '#F9FAFB',
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    marginLeft: 8,
  },
  notesModalActions: {
    flexDirection: 'row',
    marginTop: 20,
  },
  notesModalCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  notesModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  notesModalConfirmButton: {
    flex: 2,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  notesModalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.white,
  },
});

export default EmergencyServicesScreen;
