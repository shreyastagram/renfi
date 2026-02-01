/**
 * Services Index
 * 
 * Export all service modules
 * 
 * @version 3.0.0
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

// Phase 2: Google OAuth
export {
  configureGoogleSignIn,
  signInWithGoogleAsUser,
  signInWithGoogleAsProvider,
  signOutFromGoogle,
  GOOGLE_AUTH_ROLES,
  GOOGLE_AUTH_CODES,
} from './googleAuthService';

// Phase 3: Profile Sync
export {
  syncToJavaAuth,
  syncUserToMongoDB,
  syncProviderToMongoDB,
  performFullSync,
  processSyncQueue,
  isSyncDue,
  updateProfileWithSync,
  SYNC_STATUS,
} from './profileSyncService';

// Phase 4: Auth Infrastructure
export {
  getDeviceId,
  getDeviceInfo,
  getActiveSessions,
  getCurrentSession,
  revokeSession,
  revokeAllOtherSessions,
  checkAuthHealth,
  getCachedAuthHealth,
  trustCurrentDevice,
  getTrustedDevices,
  isCurrentDeviceTrusted,
  untrustDevice,
  validateToken,
  forceTokenRefresh,
  addAuthStateListener,
  notifyAuthStateChange,
  loginWithDeviceTracking,
  logoutWithCleanup,
  AUTH_HEALTH,
  SESSION_STATUS,
} from './authInfraService';

