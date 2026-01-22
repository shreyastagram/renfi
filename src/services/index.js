/**
 * Services Index
 * 
 * Export all service modules
 * 
 * @version 2.0.0
 */

export { default as apiClient, parseApiError } from './apiClient';
export { registerUser, getErrorMessage, AUTH_CODES } from './authService';
export { 
  initializeSocket,
  disconnectSocket,
  getSocket,
  isConnected,
  startLocationTracking,
  stopLocationTracking,
  subscribeToRequest,
  unsubscribeFromRequest,
  addEventListener,
  removeEventListener,
} from './socketService';
export {
  getCurrentUser,
  getUserProfile,
  getProviderProfile,
  updateUserProfile,
  updateProviderOnlineStatus,
  fetchFullProfile,
} from './profileService';
export {
  requestNotificationPermission,
  getFcmToken,
  saveFcmTokenForUser,
  saveFcmTokenForProvider,
  setupTokenRefreshListener,
  setupForegroundMessageListener,
  setupBackgroundMessageHandler,
  getInitialNotification,
} from './fcmService';
