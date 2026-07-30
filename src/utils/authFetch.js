/**
 * Authenticated Fetch Wrapper
 *
 * Drop-in replacement for `fetch()` that automatically injects
 * the Bearer token from secure storage into every request.
 *
 * Usage:
 *   import { authFetch } from '../utils/authFetch';
 *   const response = await authFetch(url, { method: 'POST', body: ... });
 *
 * @version 1.0.0
 */

import { getTokens } from './storage';

/**
 * Fetch with automatic Authorization header injection.
 * Preserves all standard fetch options; merges auth header with any
 * existing headers the caller provides.
 *
 * @param {string} url - Request URL
 * @param {RequestInit} options - Standard fetch options
 * @returns {Promise<Response>}
 */
export const authFetch = async (url, options = {}) => {
  const tokens = await getTokens();
  const headers = { ...(options.headers || {}) };

  // Only set Content-Type for non-FormData bodies (FormData needs browser to set boundary)
  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (tokens?.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  // Timeout: this used to be a bare fetch with NO timeout — a stalled
  // connection (radio doze, dead Wi-Fi) hung forever, and screens await
  // these in Promise.all, so ONE hung call pinned their loading state for
  // the whole session ("home screen continuously loading"). Callers that
  // pass their own AbortSignal keep full control (no timeout added).
  if (options.signal) {
    return fetch(url, { ...options, headers });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 30000);
  try {
    return await fetch(url, { ...options, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export default authFetch;
