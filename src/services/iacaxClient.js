/**
 * iacax HTTP client — demo branch only.
 *
 * Axios instance pointed at the iacax calling backend. Every request
 * carries:
 *   - X-API-Key: the demo tenant key (identifies "Fixhomi" to iacax)
 *   - Authorization: Bearer <jauth_jwt> (identifies the caller — iacax
 *     verifies this with tenant zero's JWTSecret, which is synced to
 *     jauth's JWT_SECRET)
 *
 * Errors are parsed into user-friendly messages matching the same
 * production-grade pattern as src/services/apiClient.js so the calling
 * UI can surface them directly without leaking technical jargon.
 */

import axios from 'axios';
import { getTokens } from '../utils/storage';
import { IACAX_URL, IACAX_API_KEY } from '../config/iacax';

const iacaxClient = axios.create({
  baseURL: IACAX_URL,
  // Call setup involves a LiveKit room create round-trip from Render
  // (US/EU) to LiveKit Cloud, which can be slow on a cold start. 15s
  // is generous; the user-facing UI shows "Connecting..." during this
  // window so the wait isn't silent.
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

iacaxClient.interceptors.request.use(
  async (config) => {
    config.headers['X-API-Key'] = IACAX_API_KEY;
    try {
      const tokens = await getTokens();
      if (tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
    } catch (err) {
      // If Keychain is locked or storage hiccups we still send the
      // request — iacax will return 401 and the caller surfaces a
      // clean "please sign in again" message.
      console.warn('[iacaxClient] could not read tokens:', err?.message);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

iacaxClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Normalise to a stable shape the screens can rely on. Avoid leaking
    // axios internals or raw stack traces into user-visible messages.
    const parsed = parseIacaxError(error);
    error.parsed = parsed;
    return Promise.reject(error);
  },
);

/**
 * Map raw axios errors to user-friendly call-flow messages.
 * Returns { code, message } where:
 *   - code: machine-readable, screens can branch on it
 *   - message: production-grade, safe to render verbatim
 */
export function parseIacaxError(error) {
  if (!error) {
    return { code: 'UNKNOWN', message: 'Something went wrong. Please try again.' };
  }

  // Network-level (no response received).
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
      return {
        code: 'TIMEOUT',
        message: 'Call setup is taking longer than usual. Please try again.',
      };
    }
    return {
      code: 'NETWORK',
      message: 'Connection issue. Please check your network and try again.',
    };
  }

  const { status, data } = error.response;
  const serverMsg = typeof data === 'object' ? data?.error || data?.message : null;

  switch (status) {
    case 401:
      return {
        code: 'UNAUTHORIZED',
        message: 'Your session has expired. Please sign in again.',
      };
    case 403:
      return {
        code: 'FORBIDDEN',
        message: 'You don’t have permission to make this call.',
      };
    case 404:
      return {
        code: 'NOT_FOUND',
        message: 'This call is no longer available.',
      };
    case 409:
      // Iacax 409s mean ErrUserBusy or ErrCallNotAcceptable per the Go
      // service. Both map to "the other person is busy" from the
      // caller's POV.
      return {
        code: 'BUSY',
        message: 'The other person is in another call right now.',
      };
    case 429:
      return {
        code: 'RATE_LIMITED',
        message: 'Please wait a moment before trying again.',
      };
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        code: 'SERVER_ERROR',
        message: 'Calling service is temporarily unavailable. Please try again shortly.',
      };
    default:
      return {
        code: 'UNKNOWN',
        message: serverMsg || 'Could not start the call. Please try again.',
      };
  }
}

export default iacaxClient;
