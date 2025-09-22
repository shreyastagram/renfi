import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import socketService from '../utils/socket';
import { formatDistance } from '../utils/locationUtils';
import RequestStatusModal from './RequestStatusModal';

const SERVICES = [
  {
    id: 'plumber',
    name: 'Plumber',
    icon: '🔧',
    description: 'Pipe repairs, installations, leak fixing',
    color: '#007AFF',
  },
  {
    id: 'electrician',
    name: 'Electrician',
    icon: '⚡',
    description: 'Wiring, electrical repairs, installations',
    color: '#FF9500',
  },
  {
    id: 'carpenter',
    name: 'Carpenter',
    icon: '🔨',
    description: 'Wood work, furniture repair, installations',
    color: '#8E4B00',
  },
  {
    id: 'painter',
    name: 'Painter',
    icon: '🎨',
    description: 'Wall painting, touch-ups, decorations',
    color: '#34C759',
  },
  {
    id: 'ac_repair',
    name: 'AC Repair',
    icon: '❄️',
    description: 'AC maintenance, repairs, installations',
    color: '#5AC8FA',
  },
  {
    id: 'cleaning',
    name: 'Cleaning',
    icon: '🧹',
    description: 'House cleaning, deep cleaning services',
    color: '#AF52DE',
  },
];

const ServiceSelectionScreen = ({ navigation }) => {
  const { 
    selectedService, 
    selectService, 
    userLocation, 
    isSocketConnected,
    sendServiceRequest,
    requestStatus,
    setRequestStatus,
    acceptedProvider,
    setAcceptedProvider,
    currentRequestId,
    cancelRequest,
    resetRequest
  } = useApp();

  const [showRequestModal, setShowRequestModal] = React.useState(false);
  const [providerCount, setProviderCount] = React.useState(0);
  const [searchRadius, setSearchRadius] = React.useState(0);
  const [nearestDistance, setNearestDistance] = React.useState(null);
  const [searchStartTime, setSearchStartTime] = React.useState(null);
  const [searchElapsedTime, setSearchElapsedTime] = React.useState(0);
  const [currentSearchPhase, setCurrentSearchPhase] = React.useState(1);
  const [searchTimer, setSearchTimer] = React.useState(null);
  const [requestSentTime, setRequestSentTime] = React.useState(null);
  const [isRequestInProgress, setIsRequestInProgress] = React.useState(false);
  
  // Refs to prevent race conditions
  const alertShownRef = useRef(false);
  const modalShownRef = useRef(false);
  const requestInProgressRef = useRef(false);
  const currentRequestIdRef = useRef(null);
  const requestStatusRef = useRef(requestStatus);
  const searchTimerRef = useRef(searchTimer);

  // Update ref when currentRequestId changes
  useEffect(() => {
    currentRequestIdRef.current = currentRequestId;
  }, [currentRequestId]);

  useEffect(() => {
    requestStatusRef.current = requestStatus;
  }, [requestStatus]);

  useEffect(() => {
    searchTimerRef.current = searchTimer;
  }, [searchTimer]);

  // Debounced modal show function
  const showModalSafely = useCallback((shouldShow) => {
    if (shouldShow && !modalShownRef.current) {
      modalShownRef.current = true;
      setShowRequestModal(true);
      console.log('✅ Modal shown safely');
    } else if (!shouldShow && modalShownRef.current) {
      modalShownRef.current = false;
      setShowRequestModal(false);
      console.log('✅ Modal hidden safely');
    }
  }, []);

  // Clear all timers function
  const clearAllTimers = useCallback(() => {
    if (searchTimerRef.current) {
      console.log('🛑 Clearing search timer');
      clearInterval(searchTimerRef.current);
      setSearchTimer(null);
    }
  }, []);

  // Reset all search state
  const resetSearchState = useCallback(() => {
    setSearchElapsedTime(0);
    setCurrentSearchPhase(1);
    setProviderCount(0);
    setSearchRadius(0);
    setNearestDistance(null);
    setSearchStartTime(null);
    clearAllTimers();
  }, [clearAllTimers]);

  useEffect(() => {
    // Only show modal based on request status changes, not on every render
    const shouldShowModal = requestStatus === 'pending' || 
                           requestStatus === 'accepted' || 
                           requestStatus === 'rejected';
    
    if (shouldShowModal !== showRequestModal) {
      showModalSafely(shouldShowModal);
    }

    // Start search timer when request becomes pending (only once)
    if (requestStatus === 'pending' && !searchTimer && !searchStartTime) {
      console.log('🕒 Starting progressive search timer');
      const startTime = Date.now();
      setSearchStartTime(startTime);
      setCurrentSearchPhase(1);
      
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setSearchElapsedTime(elapsed);
        
        const newPhase = Math.floor(elapsed / 30) + 1;
        setCurrentSearchPhase(newPhase);
        
        console.log(`⏱️ Search timer: ${elapsed}s, Phase: ${newPhase}`);
        
        // Timeout after 120 seconds
        if (elapsed >= 120) {
          console.log('⏰ Search timeout reached (120 seconds)');
          clearInterval(timer);
          setSearchTimer(null);
          if (requestStatus === 'pending') {
            setRequestStatus('rejected');
          }
        }
      }, 1000);
      
      setSearchTimer(timer);
    }

    // Clean up timer when request is no longer pending
    if (requestStatus !== 'pending') {
      clearAllTimers();
    }

    return () => {
      // Cleanup on unmount or dependency change
      clearAllTimers();
    };
  }, [requestStatus, searchTimer, searchStartTime, showRequestModal, showModalSafely, clearAllTimers]);

  // Socket event listeners setup
  useEffect(() => {
    const setupSocketListeners = () => {
      const socket = socketService.getSocket();
      if (!socket) return;

      console.log('🔧 Setting up socket listeners');
      
      const handleProviderResponse = (data) => {
        console.log('🎯 Provider response received:', data);
        console.log('🎯 Current request ID:', currentRequestIdRef.current);
        console.log('🎯 Response request ID:', data?.requestId);
        
        // Strict validation
        if (!data || !data.requestId || data.requestId !== currentRequestIdRef.current) {
          console.log('❌ Request ID mismatch or missing data');
          return;
        }

        if (requestStatusRef.current === 'accepted' || requestStatusRef.current === 'rejected') {
          console.log('❌ Request already processed');
          return;
        }

        if (alertShownRef.current) {
          console.log('❌ Alert already shown, ignoring duplicate');
          return;
        }
        
        if (data.response === 'accept') {
          console.log('✅ Processing provider acceptance');
          alertShownRef.current = true;
          setRequestStatus('accepted');
          setAcceptedProvider({
            providerId: data.providerId,
            estimatedTime: data.estimatedTimeFormatted || data.estimatedTime || '30 minutes', // 🔧 FIXED: Use formatted time
            estimatedTimeRaw: data.estimatedTime, // Keep raw ISO for backend compatibility
            estimatedDuration: data.estimatedDuration, // Also store duration
            providerName: data.providerName || `Provider ${data.providerId}`,
            providerPhone: data.providerPhone || 'Not available',
            providerRating: data.providerRating || 'Not rated',
            providerExperience: data.providerExperience || 'Not specified',
            distance: data.distance || null,
            timestamp: data.timestamp || new Date().toISOString()
          });
          clearAllTimers();
          
        } else if (data.response === 'reject') {
          console.log('❌ Processing provider rejection');
          alertShownRef.current = true;
          setRequestStatus('rejected');
          setAcceptedProvider(null);
          clearAllTimers();
          
          // Auto-hide rejection after 5 seconds
          setTimeout(() => {
            if (requestStatusRef.current === 'rejected') {
              showModalSafely(false);
              setRequestStatus('idle');
              alertShownRef.current = false;
              modalShownRef.current = false;
            }
          }, 5000);
        }
      };
        
      const handleServiceRequestConfirmed = (data) => {
        console.log('📊 Service request confirmed:', data);
        
        if (data.requestId === currentRequestIdRef.current) {
          setProviderCount(data.providerCount || 0);
          setSearchRadius(data.searchRadius || 0);
          setNearestDistance(data.nearestDistance);
          // Don't set status here - let the main flow handle it
          
          console.log(`Found ${data.providerCount} providers within ${data.searchRadius}km`);
        }
      };

      const handleSearchPhaseUpdate = (data) => {
        console.log('🔍 Search phase update:', data);
        
        if (data.requestId === currentRequestIdRef.current) {
          setSearchRadius(data.searchRadius || 0);
          setCurrentSearchPhase(data.searchPhase || 1);
          setProviderCount(0);
          
          console.log(`🔄 Phase ${data.searchPhase}: ${data.searchRadius}km radius`);
        }
      };

      const handleProvidersFound = (data) => {
        console.log('🎯 Providers found:', data);
        
        if (data.requestId === currentRequestIdRef.current) {
          setProviderCount(data.providerCount || 0);
          setSearchRadius(data.searchRadius || 0);
          setNearestDistance(data.nearestDistance);
          setCurrentSearchPhase(data.searchPhase || 1);
          
          console.log(`✅ Found ${data.providerCount} providers`);
        }
      };

      const handleSearchTimeout = (data) => {
        console.log('⏰ Search timeout:', data);
        
        if (data.requestId === currentRequestIdRef.current) {
          console.log(`❌ Search timeout after ${data.elapsedTime}s`);
          
          clearAllTimers();
          setRequestStatus('rejected');
          setProviderCount(0);
          setSearchRadius(data.searchRadius || 4);
          setCurrentSearchPhase(data.searchPhase || 4);
        }
      };
        
      // Register all listeners
      socketService.onProviderResponse(handleProviderResponse);
      socket.on('serviceRequestConfirmed', handleServiceRequestConfirmed);
      socket.on('searchPhaseUpdate', handleSearchPhaseUpdate);
      socket.on('providersFound', handleProvidersFound);
      socket.on('searchTimeout', handleSearchTimeout);
      
      console.log('✅ Socket listeners registered');
    };

    setupSocketListeners();

    return () => {
      console.log('🧹 Cleaning up socket listeners');
      socketService.removeAllListeners('providerResponse');
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('serviceRequestConfirmed');
        socket.off('searchPhaseUpdate');
        socket.off('providersFound');
        socket.off('searchTimeout');
      }
    };
  }, []);

  const handleServiceSelect = useCallback((service) => {
    console.log('Service selected:', service.name);
    selectService(service);
  }, [selectService]);

  const handleSendRequest = useCallback(() => {
    console.log('🚀 HandleSendRequest called');
    console.log('🚀 Request in progress:', requestInProgressRef.current);
    console.log('🚀 Current status:', requestStatus);
    
    // Prevent duplicate requests
    if (requestInProgressRef.current) {
      console.log('⚠️ Request already in progress, ignoring');
      return;
    }

    if (requestStatus === 'pending' || requestStatus === 'accepted') {
      console.log('⚠️ Request already active, ignoring');
      return;
    }

    // Validation
    if (!selectedService) {
      Alert.alert('Service Required', 'Please select a service first.');
      return;
    }

    if (!userLocation) {
      Alert.alert(
        'Location Required',
        'Please go back and set your location first.',
        [
          { text: 'Go Back', onPress: () => navigation.goBack() },
          { text: 'Cancel' }
        ]
      );
      return;
    }

    if (!isSocketConnected) {
      Alert.alert('Connection Error', 'Please check your internet connection and try again.');
      return;
    }

    // Set request in progress flag
    requestInProgressRef.current = true;
    setIsRequestInProgress(true);
    
    console.log('🚀 About to call sendServiceRequest');
    const success = sendServiceRequest();
    console.log('🚀 SendServiceRequest returned:', success);
    
    if (success) {
      console.log('✅ Request sent successfully');
      setRequestSentTime(new Date());
      // Reset flags
      alertShownRef.current = false;
      modalShownRef.current = false;
      // Don't show modal here - let the status change trigger it
    } else {
      console.log('❌ Request failed to send');
      Alert.alert('Request Failed', 'Unable to send your request. Please try again.');
    }
    
    // Reset request in progress flag after a short delay
    setTimeout(() => {
      requestInProgressRef.current = false;
      setIsRequestInProgress(false);
    }, 1000);
  }, [selectedService, userLocation, isSocketConnected, requestStatus, sendServiceRequest, navigation]);

  const handleCancelRequest = useCallback(() => {
    console.log('🚀 Cancel request called');
    
    clearAllTimers();
    resetSearchState();
    setRequestSentTime(null);
    
    cancelRequest();
    showModalSafely(false);
    alertShownRef.current = false;
    modalShownRef.current = false;
    requestInProgressRef.current = false;
    setIsRequestInProgress(false);
  }, [clearAllTimers, resetSearchState, cancelRequest, showModalSafely]);

  const contactProvider = useCallback(() => {
    if (acceptedProvider?.providerPhone && acceptedProvider.providerPhone !== 'Not available') {
      Alert.alert(
        'Contact Provider',
        `Call ${acceptedProvider.providerName}?\nPhone: ${acceptedProvider.providerPhone}`,
        [
          { text: 'Cancel' },
          { 
            text: 'Call', 
            onPress: () => {
              console.log('Calling provider:', acceptedProvider.providerPhone);
            }
          }
        ]
      );
    } else {
      Alert.alert('Contact Info', 'Provider contact information is not available.');
    }
  }, [acceptedProvider]);

  const startNewRequest = useCallback(() => {
    console.log('🚀 Start new request called');
    
    resetRequest();
    resetSearchState();
    setRequestSentTime(null);
    showModalSafely(false);
    alertShownRef.current = false;
    modalShownRef.current = false;
    requestInProgressRef.current = false;
    setIsRequestInProgress(false);
  }, [resetRequest, resetSearchState, showModalSafely]);

  const renderServiceCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.serviceCard, 
        { 
          borderLeftColor: item.color,
          backgroundColor: selectedService?.id === item.id ? '#F0F8FF' : '#fff',
          borderColor: selectedService?.id === item.id ? item.color : '#E5E5E7'
        }
      ]}
      onPress={() => handleServiceSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.serviceIconContainer}>
        <Text style={styles.serviceIcon}>{item.icon}</Text>
      </View>
      <View style={styles.serviceInfo}>
        <Text style={styles.serviceName}>{item.name}</Text>
        <Text style={styles.serviceDescription}>{item.description}</Text>
      </View>
      <View style={styles.arrowContainer}>
        {selectedService?.id === item.id ? (
          <Text style={[styles.arrow, { color: item.color }]}>✓</Text>
        ) : (
          <Text style={styles.arrow}>›</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Select a Service</Text>
            <Text style={styles.subtitle}>Choose the type of service you need</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => navigation.navigate('UserProfile')}
          >
            <Text style={styles.profileButtonText}>👤 Profile</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>
            📍 Location: {userLocation ? '✅ Set' : '❌ Not Set'}
          </Text>
          <Text style={styles.statusLabel}>
            🌐 Connection: {isSocketConnected ? '✅ Connected' : '❌ Disconnected'}
          </Text>
        </View>
      </View>
      
      <FlatList
        data={SERVICES}
        keyExtractor={(item) => item.id}
        renderItem={renderServiceCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {selectedService && (
        <View style={styles.selectedServiceContainer}>
          <View style={styles.selectedServiceInfo}>
            <Text style={styles.selectedServiceTitle}>Selected Service:</Text>
            <View style={styles.selectedServiceRow}>
              <Text style={styles.selectedServiceIcon}>{selectedService.icon}</Text>
              <View style={styles.selectedServiceDetails}>
                <Text style={styles.selectedServiceName}>{selectedService.name}</Text>
                <Text style={styles.selectedServiceDesc}>{selectedService.description}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.sendRequestButton,
            { 
              opacity: (selectedService && userLocation && isSocketConnected && !isRequestInProgress) ? 1.0 : 0.5
            }
          ]}
          onPress={handleSendRequest}
          disabled={!selectedService || !userLocation || !isSocketConnected || isRequestInProgress}
        >
          <Text style={styles.sendRequestButtonText}>
            {isRequestInProgress ? 'Sending Request...' :
             !selectedService ? 'Select a Service First' :
             !userLocation ? 'Location Required' :
             !isSocketConnected ? 'Connection Required' :
             `🎯 Find Nearby ${selectedService.name}s`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Request Status Modal */}
      <RequestStatusModal
        visible={showRequestModal}
        onClose={() => showModalSafely(false)}
        requestStatus={requestStatus}
        selectedService={selectedService}
        requestSentTime={requestSentTime}
        currentSearchPhase={currentSearchPhase}
        searchElapsedTime={searchElapsedTime}
        providerCount={providerCount}
        searchRadius={searchRadius}
        nearestDistance={nearestDistance}
        formatDistance={formatDistance}
        acceptedProvider={acceptedProvider}
        handleCancelRequest={handleCancelRequest}
        contactProvider={contactProvider}
        startNewRequest={startNewRequest}
      />
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
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  profileButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  profileButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#6C6C70',
    marginBottom: 16,
  },
  statusContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderLeftWidth: 4,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  serviceIconContainer: {
    width: 50,
    height: 50,
    backgroundColor: '#F2F2F7',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  serviceIcon: {
    fontSize: 24,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#6C6C70',
    lineHeight: 18,
  },
  arrowContainer: {
    marginLeft: 12,
  },
  arrow: {
    fontSize: 24,
    color: '#C7C7CC',
    fontWeight: '300',
  },
  selectedServiceContainer: {
    margin: 20,
    marginBottom: 10,
  },
  selectedServiceInfo: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  selectedServiceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  selectedServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedServiceIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  selectedServiceDetails: {
    flex: 1,
  },
  selectedServiceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 2,
  },
  selectedServiceDesc: {
    fontSize: 14,
    color: '#2E7D32',
    opacity: 0.8,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sendRequestButton: {
    backgroundColor: '#007AFF',
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
  sendRequestButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default ServiceSelectionScreen;