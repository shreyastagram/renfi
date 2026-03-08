/**
 * Insurance Service
 *
 * API calls for provider insurance document submission and status.
 *
 * @version 1.0.0
 */

import { NODE_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';

const BASE = `${NODE_BASE_URL}/api/insurance`;

const authHeaders = async () => {
  const tokens = await getTokens();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokens?.accessToken}`,
  };
};

/**
 * Fetch with timeout + retry
 */
const fetchWithRetry = async (url, options = {}, retries = 2, timeout = 10000) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(tid);
      return res;
    } catch (err) {
      clearTimeout(tid);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
};

/**
 * Safely parse JSON from a fetch response.
 * Returns { success: false } if the response is not valid JSON (e.g. HTML 404 page).
 */
const safeJson = async (res) => {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.warn('[InsuranceService] Non-JSON response:', res.status, text.substring(0, 200));
    return { success: false, error: `Server returned ${res.status}` };
  }
  return await safeJson(res);
};

/**
 * Get insurance document requirements
 */
export const getInsuranceRequirements = async () => {
  try {
    const res = await fetchWithRetry(`${BASE}/requirements`);
    return await safeJson(res);
  } catch (err) {
    console.error('[InsuranceService] getRequirements error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Get provider insurance verification status
 */
export const getInsuranceStatus = async (providerId) => {
  try {
    const headers = await authHeaders();
    const res = await fetchWithRetry(`${BASE}/${providerId}/status`, { headers });
    return await safeJson(res);
  } catch (err) {
    console.error('[InsuranceService] getStatus error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Submit insurance documents
 */
export const submitInsuranceDocuments = async (providerId, documents) => {
  try {
    const headers = await authHeaders();
    const res = await fetchWithRetry(
      `${BASE}/${providerId}/documents`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ documents }),
      },
      1,
      30000,
    );
    return await safeJson(res);
  } catch (err) {
    console.error('[InsuranceService] submit error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Resubmit insurance documents after rejection
 */
export const resubmitInsuranceDocuments = async (providerId, documents) => {
  try {
    const headers = await authHeaders();
    const res = await fetchWithRetry(
      `${BASE}/${providerId}/resubmit`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ documents }),
      },
      1,
      30000,
    );
    return await safeJson(res);
  } catch (err) {
    console.error('[InsuranceService] resubmit error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Delete a single insurance document
 */
export const deleteInsuranceDocument = async (providerId, documentId) => {
  try {
    const headers = await authHeaders();
    const res = await fetchWithRetry(
      `${BASE}/${providerId}/document/${documentId}`,
      { method: 'DELETE', headers },
    );
    return await safeJson(res);
  } catch (err) {
    console.error('[InsuranceService] delete error:', err);
    return { success: false, error: err.message };
  }
};
