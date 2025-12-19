/**
 * Token Service - Secure Token Storage
 * 
 * This service handles secure storage of authentication tokens using:
 * - react-native-keychain for sensitive data (access & refresh tokens) - iOS Keychain / Android Keystore
 * - @react-native-async-storage/async-storage for non-sensitive user data
 * 
 * NO FALLBACKS - If keychain fails, it fails. This ensures we always know the real problem.
 * 
 * @version 2.0.0
 * @author FixHomi Team
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  // Keychain service names (for secure storage)
  ACCESS_TOKEN_SERVICE: 'com.fixhomi.auth.accessToken',
  REFRESH_TOKEN_SERVICE: 'com.fixhomi.auth.refreshToken',
  
  // AsyncStorage keys (for non-sensitive data)
  USER_DATA: '@fixhomi/userData',
  USER_ID: '@fixhomi/userId',
  USER_EMAIL: '@fixhomi/userEmail',
  USER_ROLE: '@fixhomi/userRole',
  TOKEN_EXPIRY: '@fixhomi/tokenExpiry',
};

// ============================================================================
// Keychain Storage Functions (Secure - No Fallbacks)
// ============================================================================

/**
 * Save data to secure keychain (iOS Keychain / Android Keystore)
 * @param {string} service - Keychain service name
 * @param {string} value - Value to store
 * @throws {Error} If keychain operation fails
 */
const saveToKeychain = async (service, value) => {
  console.log(`💾 [TokenService] Saving to keychain: ${service}`);
  
  await Keychain.setGenericPassword('token', value, { service });
  
  console.log(`✅ [TokenService] Saved to keychain: ${service}`);
};

/**
 * Get data from secure keychain
 * @param {string} service - Keychain service name
 * @returns {Promise<string|null>} - Stored value or null if not found
 * @throws {Error} If keychain operation fails
 */
const getFromKeychain = async (service) => {
  const credentials = await Keychain.getGenericPassword({ service });
  
  if (credentials) {
    return credentials.password;
  }
  
  return null;
};

/**
 * Delete data from secure keychain
 * @param {string} service - Keychain service name
 * @throws {Error} If keychain operation fails
 */
const deleteFromKeychain = async (service) => {
  console.log(`🗑️ [TokenService] Deleting from keychain: ${service}`);
  
  await Keychain.resetGenericPassword({ service });
  
  console.log(`✅ [TokenService] Deleted from keychain: ${service}`);
};

// ============================================================================
// Token Storage Functions
// ============================================================================

/**
 * Store both access and refresh tokens securely
 * 
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - Refresh token UUID
 * @throws {Error} If storage fails
 */
export const storeTokens = async (accessToken, refreshToken) => {
  console.log('💾 [TokenService] Storing tokens securely');
  
  if (!accessToken || !refreshToken) {
    throw new Error('Both accessToken and refreshToken are required');
  }
  
  // Store both tokens in parallel
  await Promise.all([
    saveToKeychain(STORAGE_KEYS.ACCESS_TOKEN_SERVICE, accessToken),
    saveToKeychain(STORAGE_KEYS.REFRESH_TOKEN_SERVICE, refreshToken),
  ]);
  
  console.log('✅ [TokenService] Tokens stored successfully');
};

/**
 * Get stored access token
 * @returns {Promise<string|null>} - Access token or null if not found
 */
export const getAccessToken = async () => {
  return getFromKeychain(STORAGE_KEYS.ACCESS_TOKEN_SERVICE);
};

/**
 * Get stored refresh token
 * @returns {Promise<string|null>} - Refresh token or null if not found
 */
export const getRefreshToken = async () => {
  return getFromKeychain(STORAGE_KEYS.REFRESH_TOKEN_SERVICE);
};

/**
 * Clear all stored tokens (for logout)
 * @throws {Error} If clearing fails
 */
export const clearTokens = async () => {
  console.log('🗑️ [TokenService] Clearing all tokens');
  
  await Promise.all([
    deleteFromKeychain(STORAGE_KEYS.ACCESS_TOKEN_SERVICE),
    deleteFromKeychain(STORAGE_KEYS.REFRESH_TOKEN_SERVICE),
    AsyncStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY),
  ]);
  
  console.log('✅ [TokenService] All tokens cleared');
};

/**
 * Check if user is logged in (has tokens stored)
 * @returns {Promise<boolean>} - True if tokens exist
 */
export const isLoggedIn = async () => {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();
  
  return !!(accessToken && refreshToken);
};

// ============================================================================
// Token Expiry Tracking
// ============================================================================

/**
 * Save token expiry time
 * @param {number} expiresIn - Expiry time in seconds
 */
export const saveTokenExpiry = async (expiresIn) => {
  const expiryTime = Date.now() + (expiresIn * 1000);
  await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
  console.log('💾 [TokenService] Token expiry saved:', new Date(expiryTime).toISOString());
};

/**
 * Check if access token is expired (with 5 minute buffer for proactive refresh)
 * @returns {Promise<boolean>} - True if token is expired or will expire soon
 */
export const isTokenExpired = async () => {
  const expiryStr = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
  
  if (!expiryStr) {
    // No expiry stored, assume expired
    return true;
  }
  
  const expiryTime = parseInt(expiryStr, 10);
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
  
  return Date.now() >= (expiryTime - bufferTime);
};

// ============================================================================
// User Data Storage Functions (Non-sensitive - AsyncStorage)
// ============================================================================

/**
 * Save user data from JARBAC login/register response
 * 
 * @param {Object} userData - User data from JARBAC
 * @param {number} userData.userId - User ID
 * @param {string} userData.email - User email
 * @param {string} userData.fullName - User full name
 * @param {string} userData.role - User role (USER, SERVICE_PROVIDER)
 * @throws {Error} If storage fails
 */
export const saveUserData = async (userData) => {
  console.log('💾 [TokenService] Saving user data');
  
  const { userId, email, fullName, role } = userData;
  
  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.USER_ID, userId?.toString() || ''),
    AsyncStorage.setItem(STORAGE_KEYS.USER_EMAIL, email || ''),
    AsyncStorage.setItem(STORAGE_KEYS.USER_ROLE, role || ''),
    AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify({
      userId,
      email,
      fullName,
      role,
      updatedAt: new Date().toISOString(),
    })),
  ]);
  
  console.log('✅ [TokenService] User data saved for:', email);
};

/**
 * Get stored user data
 * @returns {Promise<Object|null>} - User data object or null
 */
export const getUserData = async () => {
  const dataStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
  return dataStr ? JSON.parse(dataStr) : null;
};

/**
 * Get stored user ID
 * @returns {Promise<string|null>} - User ID or null
 */
export const getUserId = async () => {
  return AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
};

/**
 * Get stored user role
 * @returns {Promise<string|null>} - User role or null
 */
export const getUserRole = async () => {
  return AsyncStorage.getItem(STORAGE_KEYS.USER_ROLE);
};

/**
 * Clear all user data
 * @throws {Error} If clearing fails
 */
export const clearUserData = async () => {
  console.log('🗑️ [TokenService] Clearing user data');
  
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.USER_ID),
    AsyncStorage.removeItem(STORAGE_KEYS.USER_EMAIL),
    AsyncStorage.removeItem(STORAGE_KEYS.USER_ROLE),
    AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
  ]);
  
  console.log('✅ [TokenService] User data cleared');
};

// ============================================================================
// Complete Auth State Functions
// ============================================================================

/**
 * Save complete authentication state from JARBAC login/register response
 * 
 * @param {Object} loginResponse - Complete login response from JARBAC
 * @param {string} loginResponse.accessToken - JWT access token
 * @param {string} loginResponse.refreshToken - Refresh token UUID
 * @param {number} loginResponse.expiresIn - Token expiry in seconds
 * @param {number} loginResponse.userId - User ID
 * @param {string} loginResponse.email - User email
 * @param {string} loginResponse.fullName - User full name
 * @param {string} loginResponse.role - User role
 * @throws {Error} If storage fails
 */
export const saveAuthState = async (loginResponse) => {
  console.log('💾 [TokenService] Saving complete auth state');
  
  const { accessToken, refreshToken, expiresIn, userId, email, fullName, role } = loginResponse;
  
  // Store tokens securely
  await storeTokens(accessToken, refreshToken);
  
  // Store token expiry
  await saveTokenExpiry(expiresIn);
  
  // Store user data
  await saveUserData({ userId, email, fullName, role });
  
  console.log('✅ [TokenService] Auth state saved completely');
};

/**
 * Clear all authentication state (for logout)
 * @throws {Error} If clearing fails
 */
export const clearAuthState = async () => {
  console.log('🗑️ [TokenService] Clearing complete auth state');
  
  await Promise.all([
    clearTokens(),
    clearUserData(),
  ]);
  
  console.log('✅ [TokenService] Auth state cleared completely');
};

/**
 * Update tokens after refresh (new access token and rotated refresh token)
 * 
 * @param {Object} refreshResponse - Response from token refresh API
 * @param {string} refreshResponse.accessToken - New JWT access token
 * @param {string} refreshResponse.refreshToken - New refresh token (rotated)
 * @param {number} refreshResponse.expiresIn - Token expiry in seconds
 * @throws {Error} If storage fails
 */
export const updateTokensAfterRefresh = async (refreshResponse) => {
  console.log('🔄 [TokenService] Updating tokens after refresh');
  
  const { accessToken, refreshToken, expiresIn } = refreshResponse;
  
  // Store new tokens
  await storeTokens(accessToken, refreshToken);
  
  // Update expiry
  await saveTokenExpiry(expiresIn);
  
  console.log('✅ [TokenService] Tokens updated after refresh');
};

// ============================================================================
// Default Export
// ============================================================================

const tokenService = {
  // Core token operations (as per specification)
  storeTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  isLoggedIn,
  
  // Token expiry
  saveTokenExpiry,
  isTokenExpired,
  
  // User data operations
  saveUserData,
  getUserData,
  getUserId,
  getUserRole,
  clearUserData,
  
  // Complete auth state
  saveAuthState,
  clearAuthState,
  updateTokensAfterRefresh,
};

export default tokenService;
