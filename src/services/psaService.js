/**
 * PSA (Personal Safety Alerts) Service
 * Handles emergency contact CRUD and SOS trigger.
 *
 * @version 1.0.0
 */

import { NODE_BASE_URL, ENDPOINTS } from '../config/api';
import { authFetch } from '../utils/authFetch';

const API_BASE = `${NODE_BASE_URL}${ENDPOINTS.PSA.CONTACTS}`;
const USAGE_URL = `${NODE_BASE_URL}${ENDPOINTS.PSA.USAGE}`;
const TRIGGER_URL = `${NODE_BASE_URL}${ENDPOINTS.PSA.TRIGGER}`;

/**
 * Get all emergency contacts for the current user
 * @returns {Promise<{success: boolean, contacts?: Array, error?: string}>}
 */
export const getContacts = async () => {
  try {
    const response = await authFetch(API_BASE, { method: 'GET' });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('[PSA] getContacts error:', err.message);
    return { success: false, error: 'Unable to load your emergency contacts right now' };
  }
};

/**
 * Add a new emergency contact
 * @param {Object} contact - { name, phone, email?, relationship? }
 * @returns {Promise<{success: boolean, contact?: Object, error?: string}>}
 */
export const addContact = async (contact) => {
  try {
    const response = await authFetch(API_BASE, {
      method: 'POST',
      body: JSON.stringify(contact),
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('[PSA] addContact error:', err.message);
    return { success: false, error: 'Unable to add contact right now' };
  }
};

/**
 * Update an existing emergency contact
 * @param {string} contactId - The contact subdocument _id
 * @param {Object} updates - Fields to update
 * @returns {Promise<{success: boolean, contact?: Object, error?: string}>}
 */
export const updateContact = async (contactId, updates) => {
  try {
    const response = await authFetch(`${API_BASE}/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('[PSA] updateContact error:', err.message);
    return { success: false, error: 'Unable to update contact right now' };
  }
};

/**
 * Delete an emergency contact
 * @param {string} contactId - The contact subdocument _id
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteContact = async (contactId) => {
  try {
    const response = await authFetch(`${API_BASE}/${contactId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('[PSA] deleteContact error:', err.message);
    return { success: false, error: 'Unable to remove contact right now' };
  }
};

/**
 * Get PSA usage stats for the current month
 * @returns {Promise<{success: boolean, usage?: Object, error?: string}>}
 */
export const getUsage = async () => {
  try {
    const response = await authFetch(USAGE_URL, { method: 'GET' });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('[PSA] getUsage error:', err.message);
    return { success: false, error: 'Unable to load usage data' };
  }
};

/**
 * Trigger SOS — sends alerts to all emergency contacts
 * @param {Object} location - { latitude, longitude, address? }
 * @returns {Promise<{success: boolean, details?: Object, error?: string}>}
 */
export const triggerSOS = async (location) => {
  try {
    const response = await authFetch(TRIGGER_URL, {
      method: 'POST',
      body: JSON.stringify(location),
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('[PSA] triggerSOS error:', err.message);
    return { success: false, error: 'Unable to send your alert right now. Please call emergency services directly.' };
  }
};
