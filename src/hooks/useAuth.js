/**
 * Authentication Hook
 * 
 * A clean, focused hook for authentication state and methods.
 * This is a convenience wrapper around AppContext for auth-specific operations.
 * 
 * @module useAuth
 */

import { useApp } from '../context/AppContext';

/**
 * Custom hook for authentication state and operations
 * 
 * @returns {Object} Auth state and methods
 * 
 * @example
 * const { isAuthenticated, user, login, logout } = useAuth();
 * 
 * if (!isAuthenticated) {
 *   return <LoginScreen />;
 * }
 */
export const useAuth = () => {
  const {
    isAuthenticated,
    isAuthLoading,
    userType,
    userData,
    loginUser,
    loginProvider,
    loginWithGoogle,
    logout,
  } = useApp();

  return {
    // State
    isAuthenticated,
    isLoading: isAuthLoading,
    
    // User info
    user: userData,
    userType,
    userId: userData?.userId || userData?._id,
    email: userData?.email,
    fullName: userData?.fullName,
    role: userData?.role,
    
    // Computed
    isUser: userType === 'user',
    isProvider: userType === 'provider',
    isGoogleUser: userData?.isGoogleUser || false,
    
    // Methods
    loginUser,
    loginProvider,
    loginWithGoogle,
    logout,
  };
};

export default useAuth;
