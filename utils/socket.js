import { io } from 'socket.io-client';

// Backend socket server URL - change this to match your backend server
const SOCKET_URL = 'http://10.0.2.2:5050'; // For Android emulator
// const SOCKET_URL = 'http://localhost:5050'; // For iOS simulator
// const SOCKET_URL = 'http://192.168.1.100:5050'; // For physical device (replace with your IP)

// Simple EventEmitter implementation for React Native
class SimpleEventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    console.log('🔔 SimpleEventEmitter: Added listener for event:', event, '- Total listeners:', this.listeners[event].length);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    console.log('🔔 SimpleEventEmitter: Emitting event:', event, 'with data:', data, 'to', this.listeners[event]?.length || 0, 'listeners');
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }

  removeAllListeners(event) {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }
}

class SocketService extends SimpleEventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.isConnected = false;
  }

  // Initialize socket connection
  connect(userRole = 'user', userId = null) {
    if (this.socket && this.isConnected) {
      console.log('Socket already connected');
      return;
    }

    // Store the user ID for later use
    this.currentUserId = userId;
    this.currentUserRole = userRole;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: false,
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection event handlers
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      this.isConnected = true;
      
      // ✅ Emit status change event for UI updates
      this.emit('statusChange', true);
      
      // Register user with real authentication data
      this.socket.emit('register', {
        userId: userId || `dummy_${userRole}_${Date.now()}`,
        userType: userRole, // 'user' or 'provider'
        timestamp: new Date().toISOString(),
      });
      
      console.log('📤 Registration emitted:', { userId: userId || `dummy_${userRole}_${Date.now()}`, userType: userRole });
    });

    // ✅ CRITICAL: Listen for registration confirmation
    this.socket.on('registered', (data) => {
      console.log('✅ Registration confirmed by server:', data);
      this.isConnected = true;
      // ✅ Emit status change event for UI updates
      this.emit('statusChange', true);
      this.emit('registered', data);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.isConnected = false;
      // ✅ Emit status change event for UI updates
      this.emit('statusChange', false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔥 Socket connection error:', error);
      this.isConnected = false;
      // ✅ Emit status change event for UI updates
      this.emit('statusChange', false);
    });

    // Start connection
    this.socket.connect();
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      // ✅ Emit status change event for UI updates
      this.emit('statusChange', false);
      console.log('Socket disconnected manually');
    }
  }

  // Send service request (for users)
  sendServiceRequest(requestData) {
    console.log('🔍 sendServiceRequest called');
    console.log('🔍 Socket exists:', !!this.socket);
    console.log('🔍 isConnected:', this.isConnected);
    console.log('🔍 Socket ID:', this.socket?.id);
    
    if (this.socket && this.isConnected) {
      const payload = {
        ...requestData,
        timestamp: new Date().toISOString(),
      };
      
      console.log('📤 Emitting serviceRequest event with payload:');
      console.log('📤 Complete payload:', JSON.stringify(payload, null, 2));
      console.log('📤 userLocation specifically:', payload.userLocation);
      console.log('📤 userLocation.latitude:', payload.userLocation?.latitude, typeof payload.userLocation?.latitude);
      console.log('📤 userLocation.longitude:', payload.userLocation?.longitude, typeof payload.userLocation?.longitude);
      
      this.socket.emit('serviceRequest', payload);
      console.log('📤 Service request event emitted successfully');
    } else {
      console.error('❌ Socket not connected. Cannot send service request.');
      console.error('❌ Socket:', !!this.socket, 'Connected:', this.isConnected);
    }
  }

  // Respond to service request (for providers)
  respondToRequest(requestId, response, providerId = null, estimatedTime = null, providerData = null) {
    console.log('🔧 SocketService: respondToRequest called with:');
    console.log('  - requestId:', requestId);
    console.log('  - response:', response);
    console.log('  - providerId:', providerId);
    console.log('  - estimatedTime:', estimatedTime);
    console.log('  - providerData:', providerData);
    console.log('  - socket exists:', !!this.socket);
    console.log('  - isConnected:', this.isConnected);
    
    if (this.socket && this.isConnected) {
      const responsePayload = {
        requestId,
        providerId: providerId || `dummy_provider_${Date.now()}`,
        response, // 'accept' or 'reject'
        estimatedTime,
        timestamp: new Date().toISOString(),
        // 🔧 NEW: Extract ETA fields to top level for backend compatibility
        ...(providerData?.estimatedTimeFormatted && {
          estimatedTimeFormatted: providerData.estimatedTimeFormatted,
          estimatedDuration: providerData.estimatedDuration
        }),
        // Include additional provider information
        ...(providerData && {
          providerName: providerData.providerName,
          providerPhone: providerData.providerPhone,
          providerRating: providerData.providerRating,
          providerExperience: providerData.providerExperience,
          serviceCategories: providerData.serviceCategories
        })
      };
      
      console.log('📤 SocketService: Emitting providerResponse with complete payload:');
      console.log(JSON.stringify(responsePayload, null, 2));
      console.log('📤 SocketService: ETA fields specifically:');
      console.log('  - estimatedTime:', responsePayload.estimatedTime);
      console.log('  - estimatedTimeFormatted:', responsePayload.estimatedTimeFormatted);
      console.log('  - estimatedDuration:', responsePayload.estimatedDuration);
      
      this.socket.emit('providerResponse', responsePayload);
      console.log('✅ SocketService: Provider response emitted successfully');
    } else {
      console.error('❌ SocketService: Cannot send response - Socket not connected');
      console.error('  - Socket exists:', !!this.socket);
      console.error('  - Is connected:', this.isConnected);
    }
  }

  // Listen for incoming service requests (for providers)
  onServiceRequest(callback) {
    if (this.socket) {
      this.socket.on('incomingServiceRequest', callback);
    }
  }

  // Listen for provider responses (for users)
  onProviderResponse(callback) {
    console.log('🔔 Setting up provider response listeners for multiple events');
    if (this.socket) {
      // Listen for all possible event names that backend might emit
      const eventNames = ['providerResponse', 'serviceRequestUpdate', 'requestStatusUpdate'];
      
      eventNames.forEach(eventName => {
        this.socket.on(eventName, (data) => {
          console.log(`📥 Provider response received on event '${eventName}':`, data);
          console.log('📥 Response type:', typeof data);
          console.log('📥 Response keys:', Object.keys(data || {}));
          callback(data);
        });
        console.log(`✅ Listener attached for event: ${eventName}`);
      });
    } else {
      console.error('❌ Socket not available for provider response listeners');
    }
  }

  // 🔧 NEW: Listen for progressive search events
  onSearchPhaseUpdate(callback) {
    if (this.socket) {
      this.socket.on('searchPhaseUpdate', callback);
      console.log('✅ Listener attached for searchPhaseUpdate');
    }
  }

  onProvidersFound(callback) {
    if (this.socket) {
      this.socket.on('providersFound', callback);
      console.log('✅ Listener attached for providersFound');
    }
  }

  onSearchTimeout(callback) {
    if (this.socket) {
      this.socket.on('searchTimeout', callback);
      console.log('✅ Listener attached for searchTimeout');
    }
  }

  onServiceRequestConfirmed(callback) {
    if (this.socket) {
      this.socket.on('serviceRequestConfirmed', callback);
      console.log('✅ Listener attached for serviceRequestConfirmed');
    }
  }

  // 🔧 NEW: Location update methods for live tracking
  sendLocationUpdate(locationData) {
    if (this.socket && this.isConnected) {
      console.log('📤 Sending location update via socket:', locationData);
      this.socket.emit('providerLocationUpdate', locationData);
    } else {
      console.warn('❌ Cannot send location update - Socket not connected');
    }
  }

  onLocationUpdateConfirmed(callback) {
    if (this.socket) {
      this.socket.on('locationUpdateConfirmed', callback);
      console.log('✅ Listener attached for locationUpdateConfirmed');
    }
  }

  onNewProviderInRange(callback) {
    if (this.socket) {
      this.socket.on('newProviderInRange', callback);
      console.log('✅ Listener attached for newProviderInRange');
    }
  }

  stopLocationSharing(providerId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('providerLocationStop', {
        providerId,
        timestamp: new Date().toISOString()
      });
      console.log('📤 Sent location stop signal for provider:', providerId);
    }
  }

  // Cancel active service request
  cancelServiceRequest(requestId, userId) {
    if (this.socket && this.isConnected) {
      const cancellationData = {
        requestId,
        userId,
        timestamp: new Date().toISOString(),
        reason: 'user_cancelled'
      };
      
      console.log('📤 Sending service request cancellation:', cancellationData);
      this.socket.emit('cancelServiceRequest', cancellationData);
    } else {
      console.warn('❌ Cannot cancel request - Socket not connected');
    }
  }

  // Listen for request cancellation confirmations
  onRequestCancelled(callback) {
    if (this.socket) {
      this.socket.on('requestCancelled', callback);
      console.log('✅ Listener attached for requestCancelled');
    }
  }

  // Remove event listeners
  removeListener(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Remove all listeners for an event
  removeAllListeners(event) {
    if (this.socket) {
      if (event === 'providerResponse') {
        // Remove all provider response event variants
        const eventNames = ['providerResponse', 'serviceRequestUpdate', 'requestStatusUpdate'];
        eventNames.forEach(eventName => {
          this.socket.removeAllListeners(eventName);
          console.log(`🧹 Removed all listeners for: ${eventName}`);
        });
      } else if (event === 'progressiveSearch') {
        // Remove all progressive search events
        const searchEventNames = ['searchPhaseUpdate', 'providersFound', 'searchTimeout', 'serviceRequestConfirmed'];
        searchEventNames.forEach(eventName => {
          this.socket.removeAllListeners(eventName);
          console.log(`🧹 Removed all listeners for: ${eventName}`);
        });
      } else {
        this.socket.removeAllListeners(event);
      }
    }
  }

  // Get connection status
  getConnectionStatus() {
    const status = this.isConnected;
    // Reduced logging frequency to avoid spam
    if (Math.random() < 0.1) { // Only log 10% of the time
      console.log('🔍 getConnectionStatus called - returning:', status);
    }
    return status;
  }

  // Get socket instance (for custom events)
  getSocket() {
    return this.socket;
  }

  // Get current user ID
  getCurrentUserId() {
    return this.currentUserId;
  }

  // Get current user role
  getCurrentUserRole() {
    return this.currentUserRole;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
