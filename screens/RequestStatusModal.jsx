import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';

const RequestStatusModal = ({
  visible,
  onClose,
  requestStatus,
  selectedService,
  requestSentTime,
  currentSearchPhase,
  searchElapsedTime,
  providerCount,
  searchRadius,
  nearestDistance,
  formatDistance,
  acceptedProvider,
  handleCancelRequest,
  contactProvider,
  startNewRequest,
}) => {
  // Format time function to handle both formatted strings and ISO strings
  const formatEstimatedTime = (timeValue) => {
    if (!timeValue) return 'Not specified';
    
    // If it's already a formatted time (like "5:30 PM"), return as is
    if (typeof timeValue === 'string' && !timeValue.includes('T')) {
      return timeValue;
    }
    
    // If it's an ISO string, format it
    try {
      const date = new Date(timeValue);
      if (isNaN(date.getTime())) {
        return timeValue; // Return original if invalid date
      }
      
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      });
    } catch (error) {
      console.log('Error formatting time:', error);
      return timeValue; // Return original if formatting fails
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={requestStatus === 'pending' ? undefined : onClose}
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
                <Text style={styles.requestDetailTime}>
                  🕒 Requested: {requestSentTime ? requestSentTime.toLocaleTimeString() : 'Just now'}
                </Text>
                
                {/* Progressive Search Information */}
                <View style={styles.progressiveSearchInfo}>
                  <Text style={styles.progressiveSearchTitle}>🔍 Progressive Search Status</Text>
                  
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
                    {searchRadius > 0 && searchRadius !== currentSearchPhase && (
                      <Text style={styles.backendUpdateText}>
                        🔄 Backend: Currently searching {searchRadius}km radius
                      </Text>
                    )}
                  </View>
                  
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
                    <Text style={styles.providerLabel}>⏱️ Expected Arrival:</Text>
                    <Text style={styles.providerValue}>{formatEstimatedTime(acceptedProvider.estimatedTime)}</Text>
                  </View>
                  {acceptedProvider.distance && (
                    <>
                      <View style={styles.providerRow}>
                        <Text style={styles.providerLabel}>📍 Distance:</Text>
                        <Text style={styles.providerValue}>{formatDistance(acceptedProvider.distance)}</Text>
                      </View>
                      <View style={styles.providerRow}>
                        <Text style={styles.providerLabel}>🚗 Travel Time:</Text>
                        <Text style={styles.providerValue}>
                          ~{Math.round((acceptedProvider.distance / 30) * 60)}min drive
                        </Text>
                      </View>
                    </>
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
  );
};

const styles = StyleSheet.create({
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

export default RequestStatusModal;