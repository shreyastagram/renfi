/**
 * Socket Service - WebSocket connection management
 * 
 * Handles Socket.IO connection to the Node.js backend
 * Used for real-time features like service requests, location updates
 * 
 * @version 1.0.0
 */

import { io } from 'socket.io-client';
import { API_CONFIG } from './apiConfig';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentUserId = null;
    this.currentUserType = null;
    this.eventListeners = {};
  }

  /**
   * Connect to socket server
   * @param {string} userType - 'user' or 'provider'
   * @param {string} userId - User or provider ID
   */
  connect(userType, userId) {
    if (this.socket?.connected) {
      console.log('🔌 [Socket] Already connected');
      return;
    }

    this.currentUserType = userType;
    this.currentUserId = userId;

    console.log(`🔌 [Socket] Connecting as ${userType}: ${userId}`);

    try {
      this.socket = io(API_CONFIG.BASE_URL, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        query: {
          userType,
          userId,
        },
      });

      this.setupListeners();
    } catch (error) {
      console.error('❌ [Socket] Connection error:', error);
    }
  }

  /**
   * Setup socket event listeners
   */
  setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ [Socket] Connected:', this.socket.id);
      this.isConnected = true;
      this.emit('statusChange', true);

      // Register with server
      this.socket.emit('register', {
        userType: this.currentUserType,
        userId: this.currentUserId,
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket] Disconnected:', reason);
      this.isConnected = false;
      this.emit('statusChange', false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ [Socket] Connection error:', error.message);
      this.isConnected = false;
      this.emit('statusChange', false);
    });

    this.socket.on('registered', (data) => {
      console.log('✅ [Socket] Registered with server:', data);
      this.emit('registered', data);
    });

    // Service request events
    this.socket.on('serviceRequestAccepted', (data) => {
      console.log('📩 [Socket] Service request accepted:', data);
      this.emit('serviceRequestAccepted', data);
    });

    this.socket.on('serviceRequestRejected', (data) => {
      console.log('📩 [Socket] Service request rejected:', data);
      this.emit('serviceRequestRejected', data);
    });

    this.socket.on('providerLocationUpdate', (data) => {
      console.log('📍 [Socket] Provider location update:', data);
      this.emit('providerLocationUpdate', data);
    });
  }

  /**
   * Disconnect from socket server
   */
  disconnect() {
    if (this.socket) {
      console.log('🔌 [Socket] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentUserId = null;
      this.currentUserType = null;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId() {
    return this.currentUserId;
  }

  /**
   * Get socket instance
   */
  getSocket() {
    return this.socket;
  }

  /**
   * Send service request
   */
  sendServiceRequest(requestData) {
    if (this.socket?.connected) {
      console.log('📤 [Socket] Sending service request:', requestData);
      this.socket.emit('serviceRequest', requestData);
    } else {
      console.error('❌ [Socket] Not connected, cannot send request');
    }
  }

  /**
   * Cancel service request
   */
  cancelServiceRequest(requestId, userId) {
    if (this.socket?.connected) {
      console.log('📤 [Socket] Cancelling request:', requestId);
      this.socket.emit('cancelRequest', { requestId, userId });
    }
  }

  /**
   * Event emitter - subscribe to events
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  /**
   * Event emitter - unsubscribe from events
   */
  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(
        (cb) => cb !== callback
      );
    }
  }

  /**
   * Event emitter - emit event to listeners
   */
  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach((callback) => callback(data));
    }
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
