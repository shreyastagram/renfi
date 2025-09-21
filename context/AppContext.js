import React, { createContext, useContext, useState, useEffect } from 'react';
import socketService from '../utils/socket';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  // Location state
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  
  // Service state
  const [selectedService, setSelectedService] = useState(null);
  
  // Socket and user state
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [realUserId, setRealUserId] = useState(null);
  
  // Request state
  const [requestStatus, setRequestStatus] = useState('idle'); // 'idle', 'sending', 'pending', 'accepted', 'rejected'
  const [currentRequest, setCurrentRequest] = useState(null);
  const [acceptedProvider, setAcceptedProvider] = useState(null);
  const [currentRequestId, setCurrentRequestId] = useState(null);

  // Get real user ID from socket service or use dummy as fallback
  const userId = realUserId || socketService.getCurrentUserId() || 'dummyUser123';

  // Socket connection management
  useEffect(() => {
    // Function to check and update connection status
    const updateConnectionStatus = () => {
      const currentStatus = socketService.getConnectionStatus();
      setIsSocketConnected(currentStatus);
      console.log('🔄 AppContext: Connection status updated to:', currentStatus);
    };

    // Initial status check
    updateConnectionStatus();

    // Listen for status changes from socket service
    const handleStatusChange = (connected) => {
      console.log('🔄 AppContext: Received status change event:', connected);
      setIsSocketConnected(connected);
    };

    const handleRegistration = (data) => {
      console.log('✅ AppContext: Registration confirmed:', data);
      setIsSocketConnected(true);
      setRealUserId(data.userId);
      console.log('🔄 Socket status updated to connected, real userId:', data.userId);
    };

    // Subscribe to socket service events
    socketService.on('statusChange', handleStatusChange);
    socketService.on('registered', handleRegistration);

    // Cleanup on component unmount
    return () => {
      socketService.off('statusChange', handleStatusChange);
      socketService.off('registered', handleRegistration);
    };
  }, []);

  // Location functions
  const updateUserLocation = (location) => {
    setUserLocation(location);
    
    // Emit location update to socket server
    if (socketService.getConnectionStatus() && location) {
      socketService.getSocket().emit('locationUpdate', {
        userId: userId,
        latitude: location[1],
        longitude: location[0],
        timestamp: new Date().toISOString(),
      });
      console.log('📍 Location sent to server:', { latitude: location[1], longitude: location[0] });
    }
  };

  // Service functions
  const selectService = (service) => {
    setSelectedService(service);
    console.log('🔧 Service selected in context:', service);
  };

  // Request functions
  const sendServiceRequest = () => {
    if (!selectedService || !userLocation || !socketService.getConnectionStatus()) {
      console.log('❌ Cannot send request - missing requirements');
      return false;
    }

    // Set status to sending
    setRequestStatus('sending');

    // Generate unique request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('📍 Generated request ID:', requestId);
    setCurrentRequestId(requestId);

    const serviceRequest = {
      userId: userId,
      userLocation: {
        latitude: userLocation[1],
        longitude: userLocation[0],
      },
      serviceType: selectedService.id,
      serviceName: selectedService.name,
      serviceIcon: selectedService.icon,
      serviceDescription: selectedService.description,
      description: `I need ${selectedService.name} service - ${selectedService.description}`,
      requestId: requestId,
      timestamp: new Date().toISOString(),
    };

    // Store current request
    setCurrentRequest(serviceRequest);

    console.log('📤 About to send service request:', JSON.stringify(serviceRequest, null, 2));
    
    socketService.sendServiceRequest(serviceRequest);
    
    // Set status to pending after a brief delay
    setTimeout(() => {
      setRequestStatus('pending');
      console.log('⏳ Request status set to pending');
    }, 1000);

    // Auto-timeout after 2 minutes if no response
    setTimeout(() => {
      if (requestStatus === 'pending' && currentRequestId === requestId) {
        console.log('⏰ Request timed out for ID:', requestId);
        setRequestStatus('rejected');
        resetRequest();
      }
    }, 120000); // 2 minutes
    
    return true;
  };

  const cancelRequest = () => {
    console.log('🚫 Cancelling request:', currentRequestId);
    
    // Notify backend that request is cancelled
    if (currentRequestId && socketService.getConnectionStatus()) {
      socketService.cancelServiceRequest(currentRequestId, userId);
      console.log('📤 Request cancellation sent to backend for ID:', currentRequestId);
    }
    
    resetRequest();
  };

  const resetRequest = () => {
    setRequestStatus('idle');
    setCurrentRequest(null);
    setCurrentRequestId(null);
    setAcceptedProvider(null);
  };

  // Clear all state (useful for logout)
  const clearAppState = () => {
    setUserLocation(null);
    setSelectedService(null);
    resetRequest();
  };

  const value = {
    // Location state and functions
    userLocation,
    setUserLocation,
    updateUserLocation,
    isLocationLoading,
    setIsLocationLoading,
    
    // Service state and functions
    selectedService,
    selectService,
    
    // Socket and user state
    isSocketConnected,
    userId,
    realUserId,
    
    // Request state and functions
    requestStatus,
    setRequestStatus,
    currentRequest,
    acceptedProvider,
    setAcceptedProvider,
    currentRequestId,
    sendServiceRequest,
    cancelRequest,
    resetRequest,
    
    // General functions
    clearAppState,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};