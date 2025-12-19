import React, { createContext, useContext, useState, useEffect } from 'react';
import socketService from '../utils/socket';
import { userStorage } from '../utils/userStorage';
import { providerStorage } from '../utils/providerStorage';
import client from '../src/api/client';
import tokenService from '../src/services/tokenService';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  // Welcome screen state
  const [isWelcomeShown, setIsWelcomeShown] = useState(false);
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState(null); // 'user' or 'provider'
  const [userData, setUserData] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
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

  // Check authentication status on app start
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setIsAuthLoading(true);
        
        // First check JARBAC tokens (secure keychain storage)
        const hasJarbacTokens = await tokenService.isLoggedIn();
        
        if (hasJarbacTokens) {
          console.log('🔐 JARBAC tokens found, restoring session...');
          
          // Get user data from secure storage
          const jarbacUserData = await tokenService.getUserData();
          
          if (jarbacUserData && jarbacUserData.userId) {
            const role = jarbacUserData.role;
            const userId = jarbacUserData.userId;
            
            if (role === 'SERVICE_PROVIDER') {
              setIsAuthenticated(true);
              setUserType('provider');
              setUserData({
                providerId: userId,
                _id: userId,
                ...jarbacUserData,
              });
              
              // Connect to socket
              console.log('🔌 Connecting provider to socket:', userId);
              socketService.connect('provider', String(userId));
              console.log('✅ Provider authentication restored from JARBAC');
            } else {
              // USER role
              setIsAuthenticated(true);
              setUserType('user');
              setUserData({
                userId: userId,
                _id: userId,
                ...jarbacUserData,
              });
              
              // Connect to socket
              console.log('🔌 Connecting user to socket:', userId);
              socketService.connect('user', String(userId));
              console.log('✅ User authentication restored from JARBAC');
            }
          } else {
            // Tokens exist but no user data, try to get from legacy storage
            console.log('⚠️ JARBAC tokens found but no user data, checking legacy storage...');
            await checkLegacyAuth();
          }
        } else {
          // No JARBAC tokens, check legacy storage for backward compatibility
          console.log('🔍 No JARBAC tokens, checking legacy storage...');
          await checkLegacyAuth();
        }
      } catch (error) {
        console.error('❌ Error checking auth status:', error);
        setIsAuthenticated(false);
        setUserType(null);
        setUserData(null);
      } finally {
        setIsAuthLoading(false);
      }
    };
    
    // Check legacy AsyncStorage for backward compatibility
    const checkLegacyAuth = async () => {
      const isUserLoggedIn = await userStorage.isUserLoggedIn();
      const isProviderLoggedIn = await providerStorage.isProviderLoggedIn();
      
      if (isUserLoggedIn) {
        const userData = await userStorage.getUserData();
        const userId = await userStorage.getUserId();
        setIsAuthenticated(true);
        setUserType('user');
        setUserData(userData);
        
        if (userId) {
          console.log('🔌 Connecting user to socket:', userId);
          socketService.connect('user', userId);
        }
        
        console.log('✅ User authentication restored from legacy storage');
      } else if (isProviderLoggedIn) {
        const providerData = await providerStorage.getProviderData();
        const providerId = await providerStorage.getProviderId();
        setIsAuthenticated(true);
        setUserType('provider');
        setUserData(providerData);
        
        if (providerId) {
          console.log('🔌 Connecting provider to socket:', providerId);
          socketService.connect('provider', providerId);
        }
        
        console.log('✅ Provider authentication restored from legacy storage');
      } else {
        setIsAuthenticated(false);
        setUserType(null);
        setUserData(null);
        console.log('❌ No authentication found');
      }
    };

    checkAuthStatus();
  }, []);

  // Authentication functions
  const loginUser = async (userData, token) => {
    try {
      // Extract user ID from different possible locations in userData
      const userId = userData.userId || userData.data?._id || userData.user?._id || userData._id;
      
      console.log('LoginUser - Full userData:', userData);
      console.log('LoginUser - Extracted userId:', userId);
      console.log('LoginUser - Token:', token ? 'Present' : 'Missing');
      
      if (!userId) {
        console.error('❌ No user ID found in userData:', Object.keys(userData));
        throw new Error('User ID not found in login response');
      }
      
      if (!token) {
        console.error('❌ No token provided');
        throw new Error('Authentication token not provided');
      }
      
      // Extract actual user data (profile info)
      const actualUserData = userData.data || userData.user || userData;
      
      await userStorage.saveUserData(actualUserData);
      await userStorage.saveUserToken(token);
      await userStorage.saveUserId(userId);
      
      setIsAuthenticated(true);
      setUserType('user');
      setUserData(actualUserData);
      console.log('✅ User logged in successfully');
    } catch (error) {
      console.error('❌ Error saving user data:', error);
      throw error; // Re-throw to let the calling function handle it
    }
  };

  const loginProvider = async (providerData, token) => {
    try {
      // Extract provider ID from different possible locations
      const providerId = providerData.providerId || providerData.data?._id || providerData.provider?._id || providerData._id || providerData.id;
      
      console.log('LoginProvider - Full providerData:', providerData);
      console.log('LoginProvider - Extracted providerId:', providerId);
      console.log('LoginProvider - Token:', token ? 'Present' : 'Missing');
      
      if (!providerId) {
        console.error('❌ No provider ID found in providerData:', Object.keys(providerData));
        throw new Error('Provider ID not found in login response');
      }
      
      if (!token) {
        console.error('❌ No token provided');
        throw new Error('Authentication token not provided');
      }
      
      // Extract actual provider data (profile info)
      const actualProviderData = providerData.data || providerData.provider || providerData;
      
      await providerStorage.saveProviderData(actualProviderData);
      await providerStorage.saveProviderToken(token);
      await providerStorage.saveProviderId(providerId);
      
      setIsAuthenticated(true);
      setUserType('provider');
      setUserData(actualProviderData);
      console.log('✅ Provider logged in successfully');
    } catch (error) {
      console.error('❌ Error saving provider data:', error);
      throw error; // Re-throw to let the calling function handle it
    }
  };

  const logout = async () => {
    try {
      // Logout from JARBAC (clears tokens from Keychain and revokes on server)
      try {
        await client.logout();
        console.log('✅ JARBAC logout successful');
      } catch (jarbacError) {
        console.warn('⚠️ JARBAC logout failed:', jarbacError.message);
        // Continue with local cleanup even if JARBAC logout fails
      }
      
      // Clear legacy storage based on user type
      if (userType === 'user') {
        await userStorage.clearUserData();
      } else if (userType === 'provider') {
        await providerStorage.clearProviderData();
      }
      
      // Disconnect socket
      if (socketService.getConnectionStatus()) {
        socketService.disconnect();
      }
      
      // Clear app state
      setIsAuthenticated(false);
      setUserType(null);
      setUserData(null);
      clearAppState();
      
      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('❌ Error during logout:', error);
    }
  };

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
    // Welcome screen state
    isWelcomeShown,
    setIsWelcomeShown,
    
    // Authentication state and functions
    isAuthenticated,
    userType,
    userData,
    isAuthLoading,
    loginUser,
    loginProvider,
    logout,
    
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