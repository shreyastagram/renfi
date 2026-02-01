/**
 * Profile Sync Service
 * 
 * Phase 3: Profile Synchronization
 * Keeps Java Auth (PostgreSQL) and MongoDB profiles in sync
 * 
 * Key Features:
 * - Bidirectional sync between Java Auth and MongoDB
 * - Conflict resolution with Java Auth as source of truth for auth data
 * - Background sync for profile updates
 * - Retry mechanism for failed syncs
 * 
 * Architecture:
 * - Java Auth: Source of truth for email, phone verification status, auth data
 * - MongoDB: Source of truth for business data (services, ratings, location)
 * - Shared: name, phone, email (synced bidirectionally)
 * 
 * @version 1.0.0
 */

import { authClient, parseApiError } from './apiClient';
import apiClient from './apiClient';
import { ENDPOINTS } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== CONSTANTS ====================

const SYNC_QUEUE_KEY = '@profile_sync_queue';
const LAST_SYNC_KEY = '@last_profile_sync';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Sync status codes
 */
export const SYNC_STATUS = {
  SUCCESS: 'SYNC_SUCCESS',
  PARTIAL: 'SYNC_PARTIAL',
  FAILED: 'SYNC_FAILED',
  CONFLICT: 'SYNC_CONFLICT',
  PENDING: 'SYNC_PENDING',
};

/**
 * Profile field mapping between Java Auth and MongoDB
 */
const FIELD_MAPPING = {
  // Java Auth field -> MongoDB field
  fullName: 'name',
  phoneNumber: 'phone',
  email: 'email',
  isEmailVerified: 'isEmailVerified',
  isPhoneVerified: 'isPhoneVerified',
};

// ==================== SYNC QUEUE ====================

/**
 * Queue item structure:
 * {
 *   id: string,
 *   type: 'user' | 'provider',
 *   mongoId: string,
 *   updates: object,
 *   target: 'javaAuth' | 'mongoDB' | 'both',
 *   retries: number,
 *   createdAt: number,
 *   lastAttempt: number,
 * }
 */

/**
 * Get pending sync queue from storage
 * @returns {Promise<Array>} Array of pending sync items
 */
const getSyncQueue = async () => {
  try {
    const queue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('❌ [ProfileSync] Failed to get sync queue:', error);
    return [];
  }
};

/**
 * Save sync queue to storage
 * @param {Array} queue - Sync queue to save
 */
const saveSyncQueue = async (queue) => {
  try {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('❌ [ProfileSync] Failed to save sync queue:', error);
  }
};

/**
 * Add item to sync queue
 * @param {Object} item - Sync item to add
 */
const addToSyncQueue = async (item) => {
  const queue = await getSyncQueue();
  queue.push({
    ...item,
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    retries: 0,
    createdAt: Date.now(),
    lastAttempt: null,
  });
  await saveSyncQueue(queue);
  console.log('📥 [ProfileSync] Added to sync queue:', item);
};

/**
 * Remove item from sync queue
 * @param {string} id - Sync item ID
 */
const removeFromSyncQueue = async (id) => {
  const queue = await getSyncQueue();
  const filtered = queue.filter(item => item.id !== id);
  await saveSyncQueue(filtered);
};

/**
 * Update item in sync queue (for retry tracking)
 * @param {string} id - Sync item ID
 * @param {Object} updates - Updates to apply
 */
const updateSyncQueueItem = async (id, updates) => {
  const queue = await getSyncQueue();
  const updatedQueue = queue.map(item =>
    item.id === id ? { ...item, ...updates, lastAttempt: Date.now() } : item
  );
  await saveSyncQueue(updatedQueue);
};

// ==================== SYNC FUNCTIONS ====================

/**
 * Sync profile updates to Java Auth
 * @param {Object} updates - Profile updates { fullName, phoneNumber }
 * @returns {Promise<Object>} Sync result
 */
export const syncToJavaAuth = async (updates) => {
  try {
    console.log('🔄 [ProfileSync] Syncing to Java Auth:', updates);
    
    // Map MongoDB field names to Java Auth field names
    const javaAuthUpdates = {};
    if (updates.name) javaAuthUpdates.fullName = updates.name;
    if (updates.fullName) javaAuthUpdates.fullName = updates.fullName;
    if (updates.phone) javaAuthUpdates.phoneNumber = updates.phone;
    if (updates.phoneNumber) javaAuthUpdates.phoneNumber = updates.phoneNumber;
    
    if (Object.keys(javaAuthUpdates).length === 0) {
      console.log('⚠️ [ProfileSync] No fields to sync to Java Auth');
      return { success: true, data: null, skipped: true };
    }
    
    const response = await authClient.put(ENDPOINTS.PROFILE.UPDATE_ME, javaAuthUpdates);
    
    console.log('✅ [ProfileSync] Synced to Java Auth:', response.data);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('❌ [ProfileSync] Sync to Java Auth failed:', error.message);
    return {
      success: false,
      error: parseApiError(error),
    };
  }
};

/**
 * Sync profile updates to MongoDB (User)
 * @param {string} userId - MongoDB user ID
 * @param {Object} updates - Profile updates
 * @returns {Promise<Object>} Sync result
 */
export const syncUserToMongoDB = async (userId, updates) => {
  try {
    console.log(`🔄 [ProfileSync] Syncing user ${userId} to MongoDB:`, updates);
    
    // Map Java Auth field names to MongoDB field names
    const mongoUpdates = { ...updates };
    if (updates.fullName) {
      mongoUpdates.name = updates.fullName;
      delete mongoUpdates.fullName;
    }
    if (updates.phoneNumber) {
      mongoUpdates.phone = updates.phoneNumber;
      delete mongoUpdates.phoneNumber;
    }
    
    const response = await apiClient.put(`${ENDPOINTS.USER.UPDATE}/${userId}`, mongoUpdates);
    
    console.log('✅ [ProfileSync] Synced user to MongoDB:', response.data);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('❌ [ProfileSync] Sync user to MongoDB failed:', error.message);
    return {
      success: false,
      error: parseApiError(error),
    };
  }
};

/**
 * Sync profile updates to MongoDB (Provider)
 * @param {string} providerId - MongoDB provider ID
 * @param {Object} updates - Profile updates
 * @returns {Promise<Object>} Sync result
 */
export const syncProviderToMongoDB = async (providerId, updates) => {
  try {
    console.log(`🔄 [ProfileSync] Syncing provider ${providerId} to MongoDB:`, updates);
    
    // Map Java Auth field names to MongoDB field names
    const mongoUpdates = { ...updates };
    if (updates.fullName) {
      mongoUpdates.name = updates.fullName;
      delete mongoUpdates.fullName;
    }
    if (updates.phoneNumber) {
      mongoUpdates.phone = updates.phoneNumber;
      delete mongoUpdates.phoneNumber;
    }
    
    const response = await apiClient.put(`${ENDPOINTS.PROVIDER.UPDATE}/${providerId}`, mongoUpdates);
    
    console.log('✅ [ProfileSync] Synced provider to MongoDB:', response.data);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('❌ [ProfileSync] Sync provider to MongoDB failed:', error.message);
    return {
      success: false,
      error: parseApiError(error),
    };
  }
};

// ==================== BIDIRECTIONAL SYNC ====================

/**
 * Perform full bidirectional profile sync
 * Fetches from both sources and resolves conflicts
 * 
 * @param {Object} params - Sync parameters
 * @param {string} params.type - 'user' or 'provider'
 * @param {string} params.mongoId - MongoDB document ID
 * @returns {Promise<Object>} Sync result with merged profile
 */
export const performFullSync = async ({ type, mongoId }) => {
  try {
    console.log(`🔄 [ProfileSync] Starting full sync for ${type}: ${mongoId}`);
    
    // Fetch from Java Auth
    const javaAuthResult = await fetchFromJavaAuth();
    if (!javaAuthResult.success) {
      console.error('❌ [ProfileSync] Failed to fetch from Java Auth');
      return {
        success: false,
        error: javaAuthResult.error,
        status: SYNC_STATUS.FAILED,
      };
    }
    
    // Fetch from MongoDB
    const mongoResult = type === 'user'
      ? await fetchUserFromMongoDB(mongoId)
      : await fetchProviderFromMongoDB(mongoId);
    
    if (!mongoResult.success) {
      console.warn('⚠️ [ProfileSync] Failed to fetch from MongoDB, using Java Auth only');
      return {
        success: true,
        data: javaAuthResult.data,
        status: SYNC_STATUS.PARTIAL,
        source: 'javaAuth',
      };
    }
    
    // Merge profiles with conflict resolution
    const merged = mergeProfiles(javaAuthResult.data, mongoResult.data, type);
    
    // Sync any differences back
    const syncNeeded = detectSyncNeeded(javaAuthResult.data, mongoResult.data);
    if (syncNeeded.toJavaAuth) {
      await addToSyncQueue({
        type,
        mongoId,
        updates: syncNeeded.toJavaAuth,
        target: 'javaAuth',
      });
    }
    if (syncNeeded.toMongoDB) {
      await addToSyncQueue({
        type,
        mongoId,
        updates: syncNeeded.toMongoDB,
        target: 'mongoDB',
      });
    }
    
    // Record sync time
    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    
    console.log('✅ [ProfileSync] Full sync completed');
    
    return {
      success: true,
      data: merged,
      status: SYNC_STATUS.SUCCESS,
    };
  } catch (error) {
    console.error('❌ [ProfileSync] Full sync failed:', error);
    return {
      success: false,
      error: { message: error.message },
      status: SYNC_STATUS.FAILED,
    };
  }
};

/**
 * Fetch current user from Java Auth
 * @returns {Promise<Object>} Java Auth profile
 */
const fetchFromJavaAuth = async () => {
  try {
    const response = await authClient.get(ENDPOINTS.PROFILE.ME);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: parseApiError(error) };
  }
};

/**
 * Fetch user from MongoDB
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<Object>} MongoDB profile
 */
const fetchUserFromMongoDB = async (userId) => {
  try {
    const response = await apiClient.get(`${ENDPOINTS.PROFILE.USER}/${userId}`);
    return { success: true, data: response.data.profile || response.data };
  } catch (error) {
    return { success: false, error: parseApiError(error) };
  }
};

/**
 * Fetch provider from MongoDB
 * @param {string} providerId - MongoDB provider ID
 * @returns {Promise<Object>} MongoDB profile
 */
const fetchProviderFromMongoDB = async (providerId) => {
  try {
    const response = await apiClient.get(`${ENDPOINTS.PROFILE.PROVIDER}/${providerId}`);
    return { success: true, data: response.data.data || response.data };
  } catch (error) {
    return { success: false, error: parseApiError(error) };
  }
};

// ==================== CONFLICT RESOLUTION ====================

/**
 * Merge profiles from Java Auth and MongoDB
 * Resolution rules:
 * - Auth data (email, verification status): Java Auth wins
 * - Profile data (name, phone): Most recently updated wins
 * - Business data (services, ratings): MongoDB wins
 * 
 * @param {Object} javaAuth - Java Auth profile
 * @param {Object} mongo - MongoDB profile
 * @param {string} type - 'user' or 'provider'
 * @returns {Object} Merged profile
 */
const mergeProfiles = (javaAuth, mongo, type) => {
  const merged = {
    // Auth data from Java Auth (source of truth)
    email: javaAuth.email,
    isEmailVerified: javaAuth.isEmailVerified,
    isPhoneVerified: javaAuth.isPhoneVerified,
    role: javaAuth.role,
    
    // Use Java Auth for shared fields (as it has auth validation)
    fullName: javaAuth.fullName,
    name: javaAuth.fullName, // MongoDB format
    phone: javaAuth.phoneNumber || mongo.phone,
    phoneNumber: javaAuth.phoneNumber || mongo.phone,
    
    // MongoDB specific data
    mongoId: mongo._id,
    createdAt: mongo.createdAt,
    updatedAt: mongo.updatedAt,
  };
  
  if (type === 'user') {
    // User-specific MongoDB data
    merged.preferences = mongo.preferences;
    merged.favoriteProviders = mongo.favoriteProviders;
    merged.savedAddresses = mongo.savedAddresses;
  } else if (type === 'provider') {
    // Provider-specific MongoDB data
    merged.services = mongo.services;
    merged.ratings = mongo.ratings;
    merged.averageRating = mongo.averageRating;
    merged.totalReviews = mongo.totalReviews;
    merged.isOnline = mongo.isOnline;
    merged.isVerified = mongo.isVerified;
    merged.location = mongo.location;
    merged.serviceArea = mongo.serviceArea;
    merged.documents = mongo.documents;
  }
  
  return merged;
};

/**
 * Detect if sync is needed between Java Auth and MongoDB
 * @param {Object} javaAuth - Java Auth profile
 * @param {Object} mongo - MongoDB profile
 * @returns {Object} { toJavaAuth: updates, toMongoDB: updates }
 */
const detectSyncNeeded = (javaAuth, mongo) => {
  const toJavaAuth = {};
  const toMongoDB = {};
  
  // Check name sync
  const javaName = javaAuth.fullName;
  const mongoName = mongo.name || mongo.fullName;
  
  if (javaName !== mongoName) {
    // Java Auth is source of truth, sync to MongoDB
    if (javaName) {
      toMongoDB.name = javaName;
    }
  }
  
  // Check phone sync
  const javaPhone = javaAuth.phoneNumber;
  const mongoPhone = mongo.phone || mongo.phoneNumber;
  
  if (javaPhone !== mongoPhone) {
    // If Java Auth has phone, sync to MongoDB
    if (javaPhone) {
      toMongoDB.phone = javaPhone;
    } else if (mongoPhone) {
      // If only MongoDB has phone, sync to Java Auth
      toJavaAuth.phoneNumber = mongoPhone;
    }
  }
  
  return {
    toJavaAuth: Object.keys(toJavaAuth).length > 0 ? toJavaAuth : null,
    toMongoDB: Object.keys(toMongoDB).length > 0 ? toMongoDB : null,
  };
};

// ==================== BACKGROUND SYNC ====================

/**
 * Process pending sync queue
 * Called periodically or when app comes to foreground
 * @returns {Promise<Object>} Processing result
 */
export const processSyncQueue = async () => {
  const queue = await getSyncQueue();
  
  if (queue.length === 0) {
    console.log('✅ [ProfileSync] Sync queue empty');
    return { processed: 0, failed: 0 };
  }
  
  console.log(`🔄 [ProfileSync] Processing ${queue.length} sync items`);
  
  let processed = 0;
  let failed = 0;
  
  for (const item of queue) {
    // Skip items that have failed too many times
    if (item.retries >= 3) {
      console.warn(`⚠️ [ProfileSync] Removing failed item after 3 retries:`, item.id);
      await removeFromSyncQueue(item.id);
      failed++;
      continue;
    }
    
    let result;
    
    if (item.target === 'javaAuth') {
      result = await syncToJavaAuth(item.updates);
    } else if (item.target === 'mongoDB') {
      result = item.type === 'user'
        ? await syncUserToMongoDB(item.mongoId, item.updates)
        : await syncProviderToMongoDB(item.mongoId, item.updates);
    }
    
    if (result?.success) {
      await removeFromSyncQueue(item.id);
      processed++;
    } else {
      await updateSyncQueueItem(item.id, { retries: item.retries + 1 });
      failed++;
    }
  }
  
  console.log(`✅ [ProfileSync] Queue processed: ${processed} success, ${failed} failed`);
  
  return { processed, failed };
};

/**
 * Check if sync is needed based on last sync time
 * @returns {Promise<boolean>} True if sync is due
 */
export const isSyncDue = async () => {
  try {
    const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (!lastSync) return true;
    
    const elapsed = Date.now() - parseInt(lastSync, 10);
    return elapsed > SYNC_INTERVAL_MS;
  } catch {
    return true;
  }
};

// ==================== UPDATE WITH SYNC ====================

/**
 * Update profile with automatic sync to both databases
 * This is the main function to use when updating profile
 * 
 * @param {Object} params - Update parameters
 * @param {string} params.type - 'user' or 'provider'
 * @param {string} params.mongoId - MongoDB document ID
 * @param {Object} params.updates - Profile updates
 * @returns {Promise<Object>} Update result
 */
export const updateProfileWithSync = async ({ type, mongoId, updates }) => {
  try {
    console.log(`📝 [ProfileSync] Updating ${type} profile with sync:`, updates);
    
    // Sync to Java Auth first (for name/phone)
    const authUpdates = {};
    if (updates.name || updates.fullName) {
      authUpdates.fullName = updates.name || updates.fullName;
    }
    if (updates.phone || updates.phoneNumber) {
      authUpdates.phoneNumber = updates.phone || updates.phoneNumber;
    }
    
    if (Object.keys(authUpdates).length > 0) {
      const javaAuthResult = await syncToJavaAuth(authUpdates);
      if (!javaAuthResult.success && !javaAuthResult.skipped) {
        console.warn('⚠️ [ProfileSync] Java Auth sync failed, queuing for retry');
        await addToSyncQueue({
          type,
          mongoId,
          updates: authUpdates,
          target: 'javaAuth',
        });
      }
    }
    
    // Sync to MongoDB
    const mongoResult = type === 'user'
      ? await syncUserToMongoDB(mongoId, updates)
      : await syncProviderToMongoDB(mongoId, updates);
    
    if (!mongoResult.success) {
      console.warn('⚠️ [ProfileSync] MongoDB sync failed, queuing for retry');
      await addToSyncQueue({
        type,
        mongoId,
        updates,
        target: 'mongoDB',
      });
      
      return {
        success: false,
        error: mongoResult.error,
        status: SYNC_STATUS.PENDING,
      };
    }
    
    console.log('✅ [ProfileSync] Profile updated with sync');
    
    return {
      success: true,
      data: mongoResult.data,
      status: SYNC_STATUS.SUCCESS,
    };
  } catch (error) {
    console.error('❌ [ProfileSync] Update with sync failed:', error);
    return {
      success: false,
      error: { message: error.message },
      status: SYNC_STATUS.FAILED,
    };
  }
};

// ==================== EXPORTS ====================

export default {
  syncToJavaAuth,
  syncUserToMongoDB,
  syncProviderToMongoDB,
  performFullSync,
  processSyncQueue,
  isSyncDue,
  updateProfileWithSync,
  SYNC_STATUS,
};
