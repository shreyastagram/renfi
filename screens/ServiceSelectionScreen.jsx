import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import socketService from '../utils/socket';
import { formatDistance } from '../utils/locationUtils';

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
  const alertShownRef = useRef(false);

  useEffect(() => {
    // Show modal if we have an active request
    if (requestStatus === 'pending' || requestStatus === 'accepted' || requestStatus === 'rejected') {
      setShowRequestModal(true);
    }

    // Start search timer when request becomes pending
    if (requestStatus === 'pending' && !searchTimer) {
      console.log('🕒 Starting progressive search timer');
      const startTime = Date.now();
      setSearchStartTime(startTime);
      setCurrentSearchPhase(1);
      
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setSearchElapsedTime(elapsed);
        
        const newPhase = Math.floor(elapsed / 30) + 1; // Every 30 seconds = new phase
        setCurrentSearchPhase(newPhase);
        
        console.log(`⏱️ Search timer: ${elapsed}s, Phase: ${newPhase}, Expected radius: ${newPhase}km`);
        
        // If we've been searching for 2 minutes (4 phases × 30s), timeout
        if (elapsed >= 120) {
          console.log('⏰ Search timeout reached (120 seconds)');
          clearInterval(timer);
          setSearchTimer(null);
          if (requestStatus === 'pending') {
            setRequestStatus('rejected');
            setShowRequestModal(true);
          }
        }
      }, 1000);
      
      setSearchTimer(timer);
    }

    // Clean up timer when request is no longer pending
    if (requestStatus !== 'pending' && searchTimer) {
      console.log('🛑 Clearing search timer');
      clearInterval(searchTimer);
      setSearchTimer(null);
      setSearchElapsedTime(0);
      setCurrentSearchPhase(1);
    }

    // Set up socket listeners for provider responses
    const setupSocketListeners = () => {
      const socket = socketService.getSocket();
      if (socket) {
        console.log('🔧 Setting up provider response listeners in ServiceSelectionScreen');
        
        const handleProviderResponse = (data) => {
          console.log('🎯 Provider response received:', data);
          console.log('🎯 Current request ID:', currentRequestId);
          console.log('🎯 Response request ID:', data?.requestId);
          console.log('🎯 Current request status:', requestStatus);
          console.log('🎯 Alert already shown:', alertShownRef.current);
          
          if (!data || !data.requestId || data.requestId !== currentRequestId) {
            console.log('❌ Request ID mismatch or missing data');
            return;
          }

          if (requestStatus === 'accepted' || requestStatus === 'rejected') {
            console.log('❌ Request already processed');
            return;
          }

          if (alertShownRef.current) {
            console.log('❌ Alert already shown');
            return;
          }
          
          if (data.response === 'accept') {
            console.log('✅ Processing provider acceptance');
            alertShownRef.current = true;
            setRequestStatus('accepted');
            setAcceptedProvider({
              providerId: data.providerId,
              estimatedTime: data.estimatedTime || '30 minutes',
              providerName: data.providerName || `Provider ${data.providerId}`,
              providerPhone: data.providerPhone || 'Not available',
              providerRating: data.providerRating || 'Not rated',
              providerExperience: data.providerExperience || 'Not specified',
              distance: data.distance || null, // Add distance information
              timestamp: data.timestamp || new Date().toISOString()
            });
            setShowRequestModal(true);
            console.log('✅ Provider acceptance processed successfully');
            
          } else if (data.response === 'reject') {
            alertShownRef.current = true;
            setRequestStatus('rejected');
            setAcceptedProvider(null);
            setShowRequestModal(true);
            
            // Auto-hide rejection after 5 seconds
            setTimeout(() => {
              setShowRequestModal(false);
              setRequestStatus('idle');
              alertShownRef.current = false;
            }, 5000);
          }
        };
        
        // Listen for service request confirmation with proximity data
        const handleServiceRequestConfirmed = (data) => {
          console.log('📊 Service request confirmed with proximity data:', data);
          console.log('🔍 DEBUGGING - Confirmation fields:');
          console.log('  - providerCount:', data.providerCount);
          console.log('  - searchRadius:', data.searchRadius);
          console.log('  - nearestDistance:', data.nearestDistance);
          console.log('  - message:', data.message);
          console.log('📊 RAW CONFIRMATION DATA:', JSON.stringify(data, null, 2));
          
          if (data.requestId === currentRequestId) {
            setProviderCount(data.providerCount || 0);
            setSearchRadius(data.searchRadius || 0);
            setNearestDistance(data.nearestDistance);
            setRequestStatus('pending');
            
            console.log(`Found ${data.providerCount} providers within ${data.searchRadius}km`);
            if (data.nearestDistance) {
              console.log(`Nearest provider: ${data.nearestDistance}km away`);
            }
            
            // Enhanced user feedback based on proximity results
            if (data.providerCount === 0) {
              console.log('⚠️ No providers found in initial radius, backend will expand search');
            } else if (data.searchRadius <= 1) {
              console.log('🎯 Found providers within 1km - excellent proximity match!');
            } else if (data.searchRadius <= 2) {
              console.log('✅ Found providers within 2km - good proximity match');
            } else {
              console.log('📍 Found providers within expanded search radius');
            }
          }
        };

        // 🔧 NEW: Listen for search phase updates (every 30 seconds)
        const handleSearchPhaseUpdate = (data) => {
          console.log('🔍 Search phase update received:', data);
          
          if (data.requestId === currentRequestId) {
            setSearchRadius(data.searchRadius || 0);
            setCurrentSearchPhase(data.searchPhase || 1);
            setProviderCount(0); // Reset provider count for new phase
            
            console.log(`🔄 Phase ${data.searchPhase}: Expanding search to ${data.searchRadius}km radius`);
            console.log(`⏱️ Elapsed time: ${data.elapsedTime}s`);
          }
        };

        // 🔧 NEW: Listen for providers found notifications
        const handleProvidersFound = (data) => {
          console.log('🎯 Providers found update received:', data);
          
          if (data.requestId === currentRequestId) {
            setProviderCount(data.providerCount || 0);
            setSearchRadius(data.searchRadius || 0);
            setNearestDistance(data.nearestDistance);
            setCurrentSearchPhase(data.searchPhase || 1);
            
            console.log(`✅ Found ${data.providerCount} providers in Phase ${data.searchPhase} (${data.searchRadius}km)`);
            if (data.nearestDistance) {
              console.log(`🎯 Nearest provider: ${data.nearestDistance}km away`);
            }
            
            // Show success indicators based on search phase
            if (data.searchPhase === 1) {
              console.log('🏆 Excellent proximity match - found in 1km!');
            } else if (data.searchPhase === 2) {
              console.log('✨ Good proximity match - found in 2km');
            } else {
              console.log('📍 Providers found in expanded search area');
            }
          }
        };

        // 🔧 NEW: Listen for search timeout
        const handleSearchTimeout = (data) => {
          console.log('⏰ Search timeout received:', data);
          
          if (data.requestId === currentRequestId) {
            console.log(`❌ Search timeout: No providers found within ${data.searchRadius}km after ${data.elapsedTime}s`);
            
            // Stop the local timer and update status
            if (searchTimer) {
              clearInterval(searchTimer);
              setSearchTimer(null);
            }
            
            setRequestStatus('rejected');
            setProviderCount(0);
            setSearchRadius(data.searchRadius || 4);
            setCurrentSearchPhase(data.searchPhase || 4);
            setShowRequestModal(true);
          }
        };
        
        socketService.onProviderResponse(handleProviderResponse);
        
        // Add listeners for all events
        socket.on('serviceRequestConfirmed', handleServiceRequestConfirmed);
        socket.on('searchPhaseUpdate', handleSearchPhaseUpdate);
        socket.on('providersFound', handleProvidersFound);
        socket.on('searchTimeout', handleSearchTimeout);
        
        console.log('✅ All progressive search event listeners registered');
      }
    };

    setupSocketListeners();

    return () => {
      // Clean up search timer
      if (searchTimer) {
        clearInterval(searchTimer);
      }
      
      socketService.removeAllListeners('providerResponse');
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('serviceRequestConfirmed');
        socket.off('searchPhaseUpdate');
        socket.off('providersFound');
        socket.off('searchTimeout');
        console.log('🧹 All progressive search event listeners cleaned up');
      }
    };
  }, [currentRequestId, requestStatus, searchTimer, searchStartTime]);

  const handleServiceSelect = (service) => {
    console.log('Service selected:', service);
    selectService(service);
  };

  const handleSendRequest = () => {
    console.log('🚀 HandleSendRequest called');
    console.log('🚀 Selected service:', selectedService?.name);
    console.log('🚀 User location:', userLocation);
    console.log('🚀 Socket connected:', isSocketConnected);
    console.log('🚀 Current request status:', requestStatus);
    
    if (!selectedService) {
      Alert.alert(
        'Service Required',
        'Please select a service first.',
        [{ text: 'OK' }]
      );
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
      Alert.alert(
        'Connection Error',
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Send the request and show dialog
    console.log('🚀 About to call sendServiceRequest');
    const success = sendServiceRequest();
    console.log('🚀 SendServiceRequest returned:', success);
    
    if (success) {
      console.log('✅ Request sent successfully, showing dialog');
      setShowRequestModal(true);
    } else {
      console.log('❌ Request failed to send');
      Alert.alert(
        'Request Failed',
        'Unable to send your request. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleCancelRequest = () => {
    // Clear timer immediately when cancelling
    if (searchTimer) {
      console.log('🛑 Clearing search timer on cancel');
      clearInterval(searchTimer);
      setSearchTimer(null);
      setSearchElapsedTime(0);
      setCurrentSearchPhase(1);
    }
    
    cancelRequest();
    setShowRequestModal(false);
    alertShownRef.current = false;
  };

  const contactProvider = () => {
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
      Alert.alert(
        'Contact Info',
        'Provider contact information is not available.',
        [{ text: 'OK' }]
      );
    }
  };

  const startNewRequest = () => {
    resetRequest();
    setShowRequestModal(false);
    alertShownRef.current = false;
  };

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
        
        {/* Location Status */}
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

      {/* Selected Service Info */}
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

      {/* Send Request Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.sendRequestButton,
            { 
              opacity: (selectedService && userLocation && isSocketConnected) ? 1.0 : 0.5
            }
          ]}
          onPress={handleSendRequest}
          disabled={!selectedService || !userLocation || !isSocketConnected}
        >
          <Text style={styles.sendRequestButtonText}>
            {!selectedService ? 'Select a Service First' :
             !userLocation ? 'Location Required' :
             !isSocketConnected ? 'Connection Required' :
             `🎯 Find Nearby ${selectedService.name}s`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Request Status Modal */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent={true}
        onRequestClose={requestStatus === 'pending' ? undefined : () => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Pending State */}
            {requestStatus === 'pending' && (
              <>
                <View style={styles.modalIconContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                </View>
                <Text style={styles.modalTitle}>Finding Nearby Service Provider</Text>
                <Text style={styles.modalSubtitle}>
                  🎯 Searching for {selectedService?.name} providers within 1km radius for hyper-local service...
                </Text>
                
                <View style={styles.requestDetails}>
                  <Text style={styles.requestDetailTitle}>Request Details</Text>
                  <View style={styles.requestDetailRow}>
                    <Text style={styles.requestDetailIcon}>{selectedService?.icon}</Text>
                    <View style={styles.requestDetailInfo}>
                      <Text style={styles.requestDetailService}>{selectedService?.name}</Text>
                      <Text style={styles.requestDetailDesc}>{selectedService?.description}</Text>
                    </View>
                  </View>
                  <Text style={styles.requestDetailTime}>🕒 Requested: {new Date().toLocaleTimeString()}</Text>
                  
                  {/* Enhanced Progressive Search Information */}
                  {requestStatus === 'pending' && (
                    <View style={styles.progressiveSearchInfo}>
                      <Text style={styles.progressiveSearchTitle}>🔍 Progressive Search Status</Text>
                      
                      {/* Search Phase Indicator */}
                      <View style={styles.searchPhaseContainer}>
                        <Text style={styles.searchPhaseText}>
                          Phase {currentSearchPhase}/4 • {searchElapsedTime}s elapsed
                        </Text>
                        <Text style={styles.searchPhaseRadius}>
                          {currentSearchPhase === 1 && "Searching within 1km radius..."}
                          {currentSearchPhase === 2 && "Expanding to 2km radius..."}
                          {currentSearchPhase === 3 && "Expanding to 3km radius..."}
                          {currentSearchPhase >= 4 && "Final search within 4km radius..."}
                        </Text>
                        {/* Show real-time backend updates */}
                        {searchRadius > 0 && searchRadius !== currentSearchPhase && (
                          <Text style={styles.backendUpdateText}>
                            🔄 Backend: Currently searching {searchRadius}km radius
                          </Text>
                        )}
                      </View>
                      
                      {/* Phase Progress Bar */}
                      <View style={styles.phaseProgressContainer}>
                        {[1, 2, 3, 4].map(phase => (
                          <View
                            key={phase}
                            style={[
                              styles.phaseProgressDot,
                              {
                                backgroundColor: phase <= currentSearchPhase ? '#007AFF' : '#E0E0E0',
                                transform: [{ scale: phase === currentSearchPhase ? 1.2 : 1 }]
                              }
                            ]}
                          />
                        ))}
                      </View>
                      
                      {/* Timer Progress */}
                      <View style={styles.timerContainer}>
                        <View style={styles.timerBar}>
                          <View
                            style={[
                              styles.timerFill,
                              { width: `${Math.min((searchElapsedTime % 30) / 30 * 100, 100)}%` }
                            ]}
                          />
                        </View>
                        <Text style={styles.timerText}>
                          Next expansion in {30 - (searchElapsedTime % 30)}s
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Proximity Information - Enhanced */}
                  {(providerCount > 0 || searchRadius > 0) && (
                    <View style={styles.proximityInfo}>
                      <Text style={styles.proximityTitle}>📍 Provider Search Results</Text>
                      {providerCount > 0 ? (
                        <>
                          <Text style={styles.proximityText}>
                            ✅ Found {providerCount} provider{providerCount !== 1 ? 's' : ''} within {searchRadius}km
                          </Text>
                          {nearestDistance && (
                            <Text style={styles.proximityText}>
                              🎯 Nearest provider: {formatDistance(nearestDistance)}
                            </Text>
                          )}
                          {/* Distance-based success indicators */}
                          {searchRadius <= 1 && (
                            <View style={styles.excellentProximityBadge}>
                              <Text style={styles.excellentProximityText}>🏆 Excellent proximity match!</Text>
                            </View>
                          )}
                          {searchRadius > 1 && searchRadius <= 2 && (
                            <View style={styles.goodProximityBadge}>
                              <Text style={styles.goodProximityText}>✨ Good proximity match</Text>
                            </View>
                          )}
                          {searchRadius > 2 && (
                            <View style={styles.expandedSearchBadge}>
                              <Text style={styles.expandedSearchText}>🔍 Expanded search area</Text>
                            </View>
                          )}
                        </>
                      ) : searchRadius > 0 ? (
                        <Text style={styles.proximityText}>
                          🔍 Searching within {searchRadius}km radius...
                        </Text>
                      ) : null}
                      
                      {/* Search progress indicator */}
                      <View style={styles.searchProgressContainer}>
                        <Text style={styles.searchProgressText}>
                          Search area: {searchRadius > 0 ? `${searchRadius}km` : `${currentSearchPhase}km (estimated)`} radius
                        </Text>
                        <View style={styles.searchProgressBar}>
                          <View 
                            style={[
                              styles.searchProgressFill, 
                              { width: `${Math.min((Math.max(searchRadius, currentSearchPhase) / 4) * 100, 100)}%` }
                            ]} 
                          />
                        </View>
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelRequest}
                >
                  <Text style={styles.cancelButtonText}>Cancel Request</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Accepted State */}
            {requestStatus === 'accepted' && acceptedProvider && (
              <>
                <View style={styles.modalIconContainer}>
                  <Text style={styles.successIcon}>✅</Text>
                </View>
                <Text style={styles.modalTitle}>Provider Found!</Text>
                <Text style={styles.modalSubtitle}>
                  Your {selectedService?.name} request has been accepted
                </Text>

                <View style={styles.providerCard}>
                  <View style={styles.providerHeader}>
                    <Text style={styles.providerTitle}>Provider Information</Text>
                  </View>
                  <View style={styles.providerDetails}>
                    <View style={styles.providerRow}>
                      <Text style={styles.providerLabel}>👤 Name:</Text>
                      <Text style={styles.providerValue}>{acceptedProvider.providerName}</Text>
                    </View>
                    <View style={styles.providerRow}>
                      <Text style={styles.providerLabel}>📞 Phone:</Text>
                      <Text style={styles.providerValue}>{acceptedProvider.providerPhone}</Text>
                    </View>
                    <View style={styles.providerRow}>
                      <Text style={styles.providerLabel}>⏱️ ETA:</Text>
                      <Text style={styles.providerValue}>{acceptedProvider.estimatedTime}</Text>
                    </View>
                    {acceptedProvider.distance && (
                      <View style={styles.providerRow}>
                        <Text style={styles.providerLabel}>📍 Distance:</Text>
                        <Text style={styles.providerValue}>{formatDistance(acceptedProvider.distance)}</Text>
                      </View>
                    )}
                    {acceptedProvider.distance && (
                      <View style={styles.providerRow}>
                        <Text style={styles.providerLabel}>🚗 Travel Time:</Text>
                        <Text style={styles.providerValue}>
                          ~{Math.round((acceptedProvider.distance / 30) * 60)}min drive
                        </Text>
                      </View>
                    )}
                    <View style={styles.providerRow}>
                      <Text style={styles.providerLabel}>⭐ Rating:</Text>
                      <Text style={styles.providerValue}>
                        {acceptedProvider.providerRating !== 'Not rated' ? 
                          `${acceptedProvider.providerRating}/5` : 
                          'Not rated yet'
                        }
                      </Text>
                    </View>
                    <View style={styles.providerRow}>
                      <Text style={styles.providerLabel}>🔧 Experience:</Text>
                      <Text style={styles.providerValue}>{acceptedProvider.providerExperience}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={contactProvider}
                  >
                    <Text style={styles.contactButtonText}>📞 Contact Provider</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.newRequestButton}
                    onPress={startNewRequest}
                  >
                    <Text style={styles.newRequestButtonText}>New Request</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Rejected State */}
            {requestStatus === 'rejected' && (
              <>
                <View style={styles.modalIconContainer}>
                  <Text style={styles.rejectedIcon}>❌</Text>
                </View>
                <Text style={styles.modalTitle}>No Providers Found</Text>
                <Text style={styles.modalSubtitle}>
                  Sorry, we couldn't find any {selectedService?.name} providers within our 4km search area after searching for 2 minutes. Please try again later or consider expanding your location range.
                </Text>

                <TouchableOpacity
                  style={styles.tryAgainButton}
                  onPress={startNewRequest}
                >
                  <Text style={styles.tryAgainButtonText}>Try Again</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 350,
    width: '90%',
  },
  modalIconContainer: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    fontSize: 48,
    color: '#4CAF50',
  },
  rejectedIcon: {
    fontSize: 48,
    color: '#FF6B6B',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  requestDetails: {
    backgroundColor: '#F8F9FB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E8E9EB',
  },
  requestDetailTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  requestDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestDetailIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  requestDetailInfo: {
    flex: 1,
  },
  requestDetailService: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  requestDetailDesc: {
    fontSize: 14,
    color: '#666',
  },
  requestDetailTime: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  providerCard: {
    backgroundColor: '#F0F8FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#D0E7FF',
  },
  providerHeader: {
    marginBottom: 16,
  },
  providerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  providerDetails: {
    gap: 8,
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  providerLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  providerValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  contactButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  newRequestButton: {
    backgroundColor: '#28A745',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
  },
  newRequestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  tryAgainButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  tryAgainButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  proximityInfo: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  proximityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 6,
  },
  proximityText: {
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
    marginBottom: 2,
  },
  // Enhanced proximity badges for 1km radius feedback
  excellentProximityBadge: {
    backgroundColor: '#E8F5E8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  excellentProximityText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  goodProximityBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  goodProximityText: {
    fontSize: 12,
    color: '#F57C00',
    fontWeight: '600',
  },
  expandedSearchBadge: {
    backgroundColor: '#F3E5F5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  expandedSearchText: {
    fontSize: 12,
    color: '#7B1FA2',
    fontWeight: '600',
  },
  searchProgressContainer: {
    marginTop: 8,
  },
  searchProgressText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  searchProgressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  searchProgressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  // Progressive search UI styles
  progressiveSearchInfo: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  progressiveSearchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 12,
  },
  searchPhaseContainer: {
    marginBottom: 12,
  },
  searchPhaseText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 4,
  },
  searchPhaseRadius: {
    fontSize: 12,
    color: '#1976D2',
    fontStyle: 'italic',
  },
  backendUpdateText: {
    fontSize: 11,
    color: '#FF6B35',
    fontWeight: '600',
    marginTop: 4,
    fontStyle: 'italic',
  },
  phaseProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  phaseProgressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  timerContainer: {
    marginTop: 8,
  },
  timerBar: {
    height: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  timerFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 3,
  },
  timerText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
});

export default ServiceSelectionScreen;