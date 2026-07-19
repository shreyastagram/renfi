/**
 * API Client
 *
 * Centralized HTTP client with error handling and interceptors
 * Includes separate clients for Node.js backend and Java Auth service
 *
 * Certificate Pinning:
 * - Android: Enforced via network_security_config.xml (res/xml/)
 * - iOS: Enforced via ATS (App Transport Security) in Info.plist
 * Pinning is handled at the native transport layer, not in axios.
 *
 * @version 2.1.0
 */

import axios from 'axios';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { API_CONFIG } from '../config/api';

// App version + platform, stamped on every request so the backend can safely
// serve old and new app builds from one deployment (version-gate a behavior,
// enforce a min supported version, etc.) without a second backend. Read once —
// getVersion() is a synchronous constant for the installed build.
const APP_VERSION = (() => {
  try { return DeviceInfo.getVersion(); } catch { return 'unknown'; }
})();
import { getTokens, storeTokens, clearTokens, isTokenExpired, probeStorageState } from '../utils/storage';
import { syncTokensToBackgroundService } from './backgroundLocationService';
import { reportForcedLogout, reportStorageState, logBreadcrumb } from '../utils/storageTelemetry';

// Track if we're currently refreshing tokens to avoid infinite loops
let isRefreshing = false;
let refreshSubscribers = [];
let refreshPromise = null;

/**
 * Subscribe to token refresh
 */
const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

/**
 * Notify all subscribers that token was refreshed
 */
const onTokenRefreshed = (accessToken) => {
  refreshSubscribers.forEach((callback) => callback(accessToken));
  refreshSubscribers = [];
};

/**
 * Check if an error is a transient network error (timeout, connection refused, etc.)
 * These errors should NOT cause token clearing — the auth is still valid,
 * the server is just temporarily unreachable (e.g., Render cold start)
 */
const isTransientNetworkError = (error) => {
  // No response received — pure network failure
  if (!error.response && error.request) {
    return true;
  }
  // Specific network error codes
  const transientCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNABORTED', 'ERR_NETWORK', 'ENETUNREACH'];
  if (transientCodes.includes(error.code)) {
    return true;
  }
  // 502/503/504 from gateway — server temporarily unavailable
  if (error.response?.status >= 502 && error.response?.status <= 504) {
    return true;
  }
  return false;
};

/**
 * Proactively refresh token if expired or about to expire
 * This is called before making requests to ensure we have a valid token
 * 
 * CRITICAL: Does NOT clear tokens on transient network errors (timeouts, 
 * connection refused). Only clears on definitive auth failures (invalid 
 * refresh token = 400/401 from the refresh endpoint).
 * This prevents Google OAuth providers from being logged out when Java Auth 
 * on Render has a cold start.
 * 
 * @returns {Promise<string|null>} New access token or null if refresh fails
 */
const proactiveTokenRefresh = async () => {
  // Check if token is expired or expiring soon (5 minute buffer)
  const expired = await isTokenExpired(5 * 60 * 1000);
  
  if (!expired) {
    const tokens = await getTokens();
    return tokens?.accessToken || null;
  }
  
  console.log('🔄 [API] Token expired/expiring, proactive refresh needed');
  
  // If already refreshing, wait for the existing refresh to complete
  if (isRefreshing && refreshPromise) {
    console.log('🔄 [API] Waiting for existing refresh...');
    const joined = await refreshPromise.catch(() => null);
    // Owners resolve a token string — EXCEPT the 401-handler owner, which
    // resolves its own retried AxiosResponse. Never hand a non-string to the
    // Authorization header ("Bearer [object Object]"); read the freshly
    // stored pair instead.
    if (typeof joined === 'string') return joined;
    const stored = await getTokens();
    return stored?.accessToken || null;
  }
  
  isRefreshing = true;
  
  refreshPromise = (async () => {
    try {
      const tokens = await getTokens();
      if (!tokens?.refreshToken) {
        console.log('❌ [API] No refresh token available');
        reportForcedLogout({ trigger: 'refresh_no_token' });
        await clearTokens();
        if (global.onAuthExpired) {
          global.onAuthExpired();
        }
        // Release any waiters that queued while this owner was reading storage.
        onTokenRefreshed(null);
        return null;
      }
      
      console.log('🔄 [API] Refreshing tokens proactively...');
      
      // Retry once on transient failure (handles Java Auth cold starts on Render)
      let lastError;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await axios.post(
            `${API_CONFIG.JAVA_AUTH_URL}/api/auth/refresh`,
            { refreshToken: tokens.refreshToken },
            { 
              headers: API_CONFIG.HEADERS,
              timeout: 35000, // 35s timeout for Render cold starts
            }
          );
          
          const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
          await storeTokens(accessToken, newRefreshToken, expiresIn || 86400);
          
          console.log('✅ [API] Proactive token refresh successful');
          onTokenRefreshed(accessToken);
          syncTokensToBackgroundService(accessToken, newRefreshToken);

          return accessToken;
        } catch (err) {
          lastError = err;
          if (attempt === 1 && isTransientNetworkError(err)) {
            console.warn(`⚠️ [API] Refresh attempt ${attempt} failed (transient), retrying in 3s...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue;
          }
          break;
        }
      }
      
      // Refresh failed — clear tokens ONLY on a definitive HTTP 401 from
      // /refresh (the contract in AUTH_STARTUP_LOGOUT_FIX.md §4: jauth 401s
      // every real refresh rejection; EVERYTHING else — network, timeout,
      // 429 rate-limit (CGNAT-shared IP buckets!), 500 (Neon/Hikari blip),
      // 502-504 — keeps the session). Previously this path treated 429/500
      // as definitive and wrongfully logged healthy users out.
      const error = lastError;
      if (error?.response?.status !== 401) {
        console.warn(`⚠️ [API] Proactive refresh failed (status=${error?.response?.status ?? 'none'}, non-401), keeping tokens.`);
        // Release any queued 401-handler waiters with the old token so they
        // never hang on a refresh that ended without calling onTokenRefreshed.
        onTokenRefreshed(tokens.accessToken);
        // Return the existing (possibly expired) token — the request might still work
        // if the backend validates the token itself with the shared JWT secret
        return tokens.accessToken;
      }

      // Definitive auth failure (HTTP 401 = invalid/expired/revoked refresh token)
      console.error('❌ [API] Proactive token refresh failed (auth rejected):', error.message);
      reportForcedLogout({
        trigger: 'refresh_definitive_auth_fail',
        error,
        token: tokens?.accessToken || null,
        authBaseUrl: API_CONFIG.JAVA_AUTH_URL,
      });
      await clearTokens();
      if (global.onAuthExpired) {
        global.onAuthExpired();
      }

      // Release queued waiters with null → they reject cleanly instead of hanging.
      onTokenRefreshed(null);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Create axios instance for Node.js backend (registration, profiles)
 */
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
});

/**
 * Create axios instance for Java Auth service (login, logout, verification)
 */
export const authClient = axios.create({
  baseURL: API_CONFIG.JAVA_AUTH_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
});

/**
 * Add auth header to config with proactive token refresh
 */
const addAuthHeader = async (config) => {
  // Stamp app version + platform on every request (both Node and Java clients
  // route through here). Lets the backend distinguish app builds.
  config.headers['X-App-Version'] = APP_VERSION;
  config.headers['X-App-Platform'] = Platform.OS;

  // Skip token check for auth endpoints that don't need tokens
  const skipRefreshUrls = ['/refresh', '/login', '/register', '/forgot-password', '/oauth2', '/google'];
  const shouldSkip = skipRefreshUrls.some(url => config.url?.includes(url));
  
  if (shouldSkip) {
    // For login/register, just add existing token if available (optional)
    const tokens = await getTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  }
  
  // For protected endpoints, do proactive token refresh
  const accessToken = await proactiveTokenRefresh();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else {
    console.warn('⚠️ [API] No valid token available for request');
  }
  return config;
};

/**
 * Request interceptor for Node.js backend
 */
apiClient.interceptors.request.use(
  async (config) => {
    console.log(`📤 [API] ${config.method?.toUpperCase()} ${config.url}`);
    return addAuthHeader(config);
  },
  (error) => {
    console.error('❌ [API] Request error:', error);
    return Promise.reject(error);
  }
);

/**
 * Request interceptor for Java Auth client
 */
authClient.interceptors.request.use(
  async (config) => {
    console.log(`📤 [AUTH] ${config.method?.toUpperCase()} ${config.url}`);
    return addAuthHeader(config);
  },
  (error) => {
    console.error('❌ [AUTH] Request error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response error handler with token refresh
 * 
 * CRITICAL: Does NOT clear tokens on transient network errors during refresh.
 * Only clears tokens when the refresh endpoint explicitly rejects the token
 * (400/401 response). This prevents Google OAuth users from being logged out
 * when Java Auth on Render is cold-starting.
 */
const handleResponseError = async (error, client) => {
  const originalRequest = error.config;

  // Detailed error logging
  const errorInfo = {
    url: error.config?.url,
    baseURL: error.config?.baseURL,
    method: error.config?.method,
    status: error.response?.status,
    statusText: error.response?.statusText,
    message: error.response?.data?.message || error.message,
    data: error.response?.data,
    code: error.code,
  };
  console.error('❌ [API] Response error:', errorInfo);

  // ──────────────────────────────────────────────────────────────────
  // AUTO-RETRY for transient network errors (no response received)
  // Handles: cold-start connections, mobile DNS flakiness, TLS init
  // This is the same pattern Uber/Zomato/Swiggy use on mobile apps
  // ──────────────────────────────────────────────────────────────────
  if (!error.response && error.request && isTransientNetworkError(error) && !originalRequest._networkRetry) {
    originalRequest._networkRetry = true;
    console.log(`🔄 [API] Transient network error (${error.code || 'unknown'}), auto-retrying in 1.5s...`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    return client(originalRequest);
  }

  // Log network errors specifically (after retry exhausted)
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    console.error('🚫 [API] Cannot connect to server after retry. Is the backend running?');
  }

  // Handle 429 Too Many Requests — silently retry after the server-specified delay
  // This prevents rate-limit errors from surfacing to users on normal app usage (open/close)
  if (error.response?.status === 429 && !originalRequest._retried429) {
    originalRequest._retried429 = true;
    const retryAfter = (error.response?.data?.retryAfter || 5) * 1000;
    const delayMs = Math.min(retryAfter, 10000); // cap at 10s
    console.log(`⏳ [API] Rate limited, retrying in ${delayMs / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return client(originalRequest);
  }

  // Handle 503 Service Unavailable — auth service temporarily down (e.g., Render cold start)
  // Do NOT treat as auth failure, do NOT trigger token refresh/clearing
  if (error.response?.status === 503 && error.response?.data?.isTransient) {
    console.warn('⚠️ [API] Service temporarily unavailable (auth service may be cold-starting)');
    // Retry once after a delay
    if (!originalRequest._retried503) {
      originalRequest._retried503 = true;
      console.log('🔄 [API] Retrying request after 503...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return client(originalRequest);
    }
    return Promise.reject(error);
  }
  
  // Handle 401 Unauthorized - Token expired or account deleted
  if (error.response?.status === 401 && !originalRequest._retry) {
    // ACCOUNT_DELETED: force immediate logout, do NOT try to refresh
    const errorCode = error.response?.data?.code;
    if (errorCode === 'ACCOUNT_DELETED') {
      console.warn('🚫 [API] Account deleted — forcing logout');
      // Capture WHICH token/account/endpoint triggered this (Cohort B diagnostics).
      const acctToken = originalRequest?.headers?.Authorization?.replace?.('Bearer ', '') || null;
      reportForcedLogout({
        trigger: 'response_401_account_deleted',
        error,
        httpStatus: 401,
        token: acctToken,
        requestUrl: originalRequest?.url || null,
        authBaseUrl: originalRequest?.baseURL || null,
      });
      await clearTokens();
      if (global.onAuthExpired) {
        global.onAuthExpired();
      }
      return Promise.reject(error);
    }

    // Don't retry auth endpoints — these are login/signup requests, not token-protected
    const skipRetryUrls = ['/refresh', '/logout', '/login', '/register', '/forgot-password', '/oauth2', '/google', '/send-otp', '/verify'];
    const shouldSkipRetry = skipRetryUrls.some(url => originalRequest.url?.includes(url));
    if (shouldSkipRetry) {
      return Promise.reject(error);
    }
    
    originalRequest._retry = true;
    
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = (async () => {
        try {
          const tokens = await getTokens();
          if (tokens?.refreshToken) {
            console.log('🔄 [API] Attempting token refresh (401 handler)...');
            
            // Retry once on transient failure (Java Auth cold starts)
            let lastRefreshError;
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                const response = await axios.post(
                  `${API_CONFIG.JAVA_AUTH_URL}/api/auth/refresh`,
                  { refreshToken: tokens.refreshToken },
                  { 
                    headers: API_CONFIG.HEADERS,
                    timeout: 35000, // 35s for Render cold starts
                  }
                );
                
                const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
                await storeTokens(accessToken, newRefreshToken, expiresIn || 86400);
                
                console.log('✅ [API] Token refresh successful');
                isRefreshing = false;
                refreshPromise = null;
                onTokenRefreshed(accessToken);
                syncTokensToBackgroundService(accessToken, newRefreshToken);

                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return client(originalRequest);
              } catch (err) {
                lastRefreshError = err;
                if (attempt === 1 && isTransientNetworkError(err)) {
                  console.warn(`⚠️ [API] Refresh attempt ${attempt} failed (transient), retrying in 3s...`);
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  continue;
                }
                break;
              }
            }
            
            // Refresh failed — clear ONLY on definitive HTTP 401 (contract:
            // AUTH_STARTUP_LOGOUT_FIX.md §4). 429 (shared CGNAT rate-limit
            // bucket), 500 (DB blip), timeouts etc. must KEEP the session.
            const refreshError = lastRefreshError;

            if (refreshError?.response?.status !== 401) {
              // Non-definitive — DON'T clear tokens, DON'T force logout
              console.warn(`⚠️ [API] Token refresh failed (status=${refreshError?.response?.status ?? 'none'}, non-401), keeping tokens. Will retry on next request.`);
              isRefreshing = false;
              refreshPromise = null;
              // Release queued waiters with the old token so they never hang.
              // Their retried request may 401 once and then reject cleanly
              // (_retry is set) — strictly better than waiting forever.
              onTokenRefreshed(tokens.accessToken);
              // Reject with a user-friendly error but keep session alive
              return Promise.reject({
                ...refreshError,
                _isTransientAuthError: true,
                response: {
                  status: 503,
                  data: {
                    message: 'We\'re having trouble connecting. Please try again in a moment.',
                    code: 'AUTH_SERVER_UNAVAILABLE',
                  },
                },
              });
            }
            
            // Definitive auth failure — clear tokens
            throw refreshError;
          } else {
            const noTokenErr = new Error('No refresh token available');
            noTokenErr._noRefreshToken = true; // genuinely logged out — must clear
            throw noTokenErr;
          }
        } catch (refreshError) {
          console.error('❌ [API] Token refresh failed:', refreshError.message);
          isRefreshing = false;
          refreshPromise = null;
          
          // Clear tokens ONLY on definitive HTTP 401 from /refresh, or when
          // there is genuinely no refresh token (contract: 401-only, §4).
          if (refreshError?.response?.status === 401 || refreshError?._noRefreshToken) {
            reportForcedLogout({
              trigger: 'response_401_refresh_failed',
              error: refreshError,
              token: originalRequest?.headers?.Authorization?.replace?.('Bearer ', '') || null,
              requestUrl: originalRequest?.url || null,
              authBaseUrl: originalRequest?.baseURL || null,
            });
            await clearTokens();
            if (global.onAuthExpired) {
              global.onAuthExpired();
            }
          }

          // Release queued waiters with null → they reject with their original
          // 401 instead of hanging forever (and never fire later as zombies).
          onTokenRefreshed(null);
          return Promise.reject(refreshError);
        }
      })();
      
      return refreshPromise;
    } else {
      // Wait for refresh to complete
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((accessToken) => {
          if (accessToken) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            resolve(client(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }
  }
  
  return Promise.reject(error);
};

/**
 * Response interceptor for Node.js backend
 */
apiClient.interceptors.response.use(
  (response) => {
    console.log(`📥 [API] Response ${response.status}:`, response.config.url);
    return response;
  },
  (error) => handleResponseError(error, apiClient)
);

/**
 * Response interceptor for Java Auth client
 */
authClient.interceptors.response.use(
  (response) => {
    console.log(`📥 [AUTH] Response ${response.status}:`, response.config.url);
    return response;
  },
  (error) => handleResponseError(error, authClient)
);

/**
 * Parse API error response
 * @param {Error} error - Axios error object
 * @returns {Object} Parsed error object
 */
export const parseApiError = (error) => {
  // Handle synthetic transient auth errors (from our 401 handler)
  if (error._isTransientAuthError && error.response) {
    return {
      status: error.response.status,
      code: error.response.data?.code || 'AUTH_SERVER_UNAVAILABLE',
      message: error.response.data?.message || 'We\'re having trouble connecting. Please try again in a moment.',
      errors: null,
      hint: 'Please wait a moment and try again.',
      isTransient: true,
    };
  }

  if (error.response) {
    // Server responded with error status
    const { data, status } = error.response;
    // Java Auth GlobalExceptionHandler puts structured codes in validationErrors.code
    let code = data.code || data.validationErrors?.code || data.error || 'UNKNOWN_ERROR';
    let message = data.message || 'An error occurred';

    // Java Auth sometimes returns 500 for OTP/verification errors instead of 400.
    // Detect these by URL + message and map to proper codes so screens can handle them.
    const url = error.config?.url || '';
    const msgLower = (data.message || '').toLowerCase();
    if (status === 500 && (url.includes('/verify') || url.includes('/otp'))) {
      if (msgLower.includes('verification') || msgLower.includes('otp') || msgLower.includes('invalid')) {
        code = 'INVALID_OTP';
        message = 'The OTP you entered is incorrect. Please check and try again.';
      }
    }

    // Map generic 500 errors to user-friendly messages
    if (status === 500 && code === 'UNKNOWN_ERROR') {
      message = 'Something went wrong on our end. Please try again.';
    }

    return {
      status,
      code,
      message,
      errors: data.errors || null,
      hint: data.hint || null,
      success: data.success ?? false,
    };
  } else if (error.request) {
    // Request made but no response — differentiate server-side vs client-side
    let message = 'Something went wrong. Please try again.';
    let hint = 'If the problem persists, try again in a few minutes';
    let code = 'NETWORK_ERROR';

    // Check for specific network errors
    if (error.code === 'ECONNREFUSED') {
      code = 'SERVER_UNREACHABLE';
      message = 'We\'re having trouble connecting. Please try again in a moment.';
      hint = 'Please try again in a moment';
    } else if (error.code === 'ENOTFOUND') {
      code = 'SERVER_UNREACHABLE';
      message = 'Please check your internet connection and try again.';
      hint = 'Make sure WiFi or mobile data is on';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      code = 'SERVER_TIMEOUT';
      message = 'This is taking longer than usual. Please try again.';
      hint = 'Wait a moment and try again';
    } else if (error.code === 'ERR_NETWORK' || error.code === 'ENETUNREACH') {
      code = 'NO_INTERNET';
      message = 'No internet connection. Please check your WiFi or mobile data.';
      hint = 'Make sure WiFi or mobile data is turned on';
    }

    return {
      status: 0,
      code,
      message,
      errors: null,
      hint,
      errorCode: error.code,
      isTransient: true,
    };
  } else {
    // Error in request setup
    return {
      status: 0,
      code: 'REQUEST_ERROR',
      message: error.message || 'An unexpected error occurred',
      errors: null,
      hint: null,
    };
  }
};

/**
 * Warm up the React Native networking stack.
 *
 * On mobile, the FIRST HTTP request after app launch initializes DNS resolution,
 * TLS session negotiation, and the native connection pool (OkHttp on Android,
 * NSURLSession on iOS). This initialization can cause the first user-triggered
 * request to fail with ERR_NETWORK before it even leaves the device.
 *
 * This function sends lightweight HEAD requests to both backend URLs during
 * app startup, so by the time the user taps "Create Account" or "Login",
 * the networking stack is fully warm and ready.
 *
 * Called from AppContext.initializeAuth() on every app start.
 */
export const warmUpNetworkStack = async () => {
  try {
    console.log('🌐 [API] Warming up network stack...');

    // Fire both warm-up requests in parallel — we don't care about the response
    const warmups = [
      axios.head(API_CONFIG.BASE_URL, { timeout: 10000 }).catch(() => {}),
      axios.head(API_CONFIG.JAVA_AUTH_URL, { timeout: 10000 }).catch(() => {}),
    ];

    await Promise.allSettled(warmups);
    console.log('✅ [API] Network stack warmed up');
  } catch {
    // Swallow all errors — this is a best-effort optimization
    console.log('⚠️ [API] Network warm-up failed (non-critical)');
  }
};

/**
 * Validate and refresh tokens on app startup
 * Call this from AppContext during initialization
 * @returns {Promise<{valid: boolean, accessToken: string|null}>}
 */
export const validateAndRefreshTokens = async () => {
  console.log('🔄 [API] Validating tokens on startup...');

  // Boot storage-state telemetry (read-only) — the denominator for "of N cold
  // starts, how many had working Keychain vs. needed the fallback". Fail-soft.
  try {
    const { keychainHadTokens, fallbackHadTokens } = await probeStorageState();
    reportStorageState({
      keychainHadTokens,
      fallbackHadTokens,
      recoveredFromFallback: !keychainHadTokens && fallbackHadTokens,
    });
  } catch (e) {
    // Never let telemetry affect startup.
  }

  const tokens = await getTokens();

  if (!tokens?.refreshToken) {
    // Genuine logged-out state (no session). NOT a forced logout — do not clear
    // (nothing to clear) and do not report a logout; just leave a breadcrumb.
    console.log('❌ [API] No refresh token found');
    logBreadcrumb('STARTUP_NO_REFRESH_TOKEN', {});
    return { valid: false, accessToken: null };
  }
  
  // Check if access token is expired
  const expired = await isTokenExpired(0); // No buffer for startup check

  if (!expired && tokens.accessToken) {
    // Token is locally valid — trust it immediately for fast startup.
    // Account existence is verified in the background (non-blocking).
    // If account was deleted, the background check will force logout.
    // This prevents Render cold-start delays (30-60s) from blocking app launch.
    console.log('✅ [API] Access token valid locally — launching app');

    // Background verification (doesn't block startup)
    // Delay 3.5s so splash animation (~3s) completes first.
    // This prevents a race where the background check triggers logout
    // (for deleted accounts) while the splash screen is still animating,
    // which causes cascading state resets and a native crash.
    setTimeout(async () => {
      try {
        const verifyRes = await axios.get(
          `${API_CONFIG.JAVA_AUTH_URL}/api/users/me`,
          {
            headers: { ...API_CONFIG.HEADERS, Authorization: `Bearer ${tokens.accessToken}` },
            timeout: 35000, // 35s for Render cold starts
          }
        );
        if (verifyRes.data?.isActive === false) {
          console.warn('🚫 [API] Background check: account deactivated — forcing logout');
          await clearTokens();
          if (global.onAuthExpired) global.onAuthExpired();
        }
      } catch (verifyErr) {
        const status = verifyErr.response?.status;
        const code = verifyErr.response?.data?.code;
        if (status === 401 && (code === 'ACCOUNT_DELETED' || !verifyErr.response?.data?.message?.includes('expired'))) {
          console.warn('🚫 [API] Background check: account deleted — forcing logout');
          await clearTokens();
          if (global.onAuthExpired) global.onAuthExpired();
        }
      }
    }, 3500); // Wait for splash animation to complete before potentially forcing logout

    return { valid: true, accessToken: tokens.accessToken };
  }
  
  // Token is expired or expiring, try to refresh.
  //
  // CRITICAL (see AUTH_STARTUP_LOGOUT_FIX.md): this path must behave like the
  // request interceptor / 401 handler — a TRANSIENT failure (network, timeout,
  // Render cold start, 5xx) must NOT clear tokens or log the user out. We only
  // clear on a DEFINITIVE auth failure, which for our jauth backend is HTTP 401
  // (it returns 401 for invalid/expired/revoked refresh tokens — no other code).
  //
  // Refresh tokens are SINGLE-USE (jauth rotates on every refresh), so we retry
  // at most once and only on a transient failure — never a backoff storm, which
  // would risk burning a refresh token that the server may have already rotated.
  console.log('🔄 [API] Access token expired, refreshing on startup...');

  // ── ROTATION-RACE FIX (AUTH_STARTUP_LOGOUT_FIX.md §7.3/§10, 2026-07-18) ──
  // jauth refresh tokens are SINGLE-USE (rotated on every refresh). This
  // startup path used to POST /refresh OUTSIDE the interceptor's single-flight
  // mutex, so any protected request fired during startup (nav-state-restored
  // screens, FCM save, provider location) could refresh CONCURRENTLY with the
  // same token. The loser's token was already rotated server-side → definitive
  // 401 → wrongful logout ("logged out after some days" with healthy sessions).
  // All three refresh paths now share ONE in-flight promise.
  if (isRefreshing && refreshPromise) {
    console.log('🔄 [API] Startup refresh joining in-flight refresh...');
    const joined = await refreshPromise.catch(() => null);
    // Only trust a string token (the 401-handler owner resolves its retried
    // AxiosResponse instead) — anything else falls through to stored-token state.
    if (typeof joined === 'string' && joined) return { valid: true, accessToken: joined };
    // In-flight refresh failed. If it cleared the tokens it was definitive;
    // otherwise it kept them (transient) and the session survives.
    const after = await getTokens();
    return after?.refreshToken
      ? { valid: true, accessToken: after.accessToken }
      : { valid: false, accessToken: null };
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      let lastError;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await axios.post(
            `${API_CONFIG.JAVA_AUTH_URL}/api/auth/refresh`,
            { refreshToken: tokens.refreshToken },
            { headers: API_CONFIG.HEADERS, timeout: 35000 } // 35s for Render cold starts
          );

          const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
          await storeTokens(accessToken, newRefreshToken, expiresIn || 86400);

          console.log('✅ [API] Token refresh successful on startup');
          // Cohort A signal: a refresh that needed a retry to succeed = a session the
          // OLD code would have wrongly logged out. Proves the fix is working.
          if (attempt > 1) logBreadcrumb('STARTUP_REFRESH_RECOVERED_AFTER_RETRY', { attempt: String(attempt) });
          // Flush any 401-handler waiters queued on this shared refresh.
          onTokenRefreshed(accessToken);
          syncTokensToBackgroundService(accessToken, newRefreshToken);
          return accessToken;
        } catch (err) {
          lastError = err;
          if (attempt === 1 && isTransientNetworkError(err)) {
            console.warn('⚠️ [API] Startup refresh attempt 1 failed (transient), retrying in 3s...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue;
          }
          break;
        }
      }

      const error = lastError;
      const status = error?.response?.status;

      // Definitive logout ONLY on an explicit HTTP 401 from /refresh. Our jauth
      // backend returns 401 for every refresh-token rejection (invalid / expired /
      // revoked / deactivated) and emits no other machine code — so 401 is the one
      // reliable "this session is really dead" signal (see AUTH_STARTUP_LOGOUT_FIX.md).
      if (status === 401) {
        console.error('❌ [API] Startup refresh rejected (401, definitive auth failure). Logging out.');
        reportForcedLogout({
          trigger: 'startup_refresh_definitive_auth_fail',
          error,
          httpStatus: 401,
          token: tokens?.accessToken || null,
          authBaseUrl: API_CONFIG.JAVA_AUTH_URL,
        });
        await clearTokens();
        // Release queued waiters with null → reject cleanly instead of hanging.
        onTokenRefreshed(null);
        return null;
      }

      // EVERYTHING else (no response, timeout, Render cold start, 5xx, 500, or any
      // unexpected/ambiguous status) is treated as transient: KEEP the tokens and
      // restore the session. The request interceptor refreshes lazily (transient-
      // aware) on the first protected call, and a genuinely dead session will be
      // cleared there on a real 401. A transient/ambiguous error must never force a
      // logout — that is the exact bug this change fixes.
      console.warn(`⚠️ [API] Startup refresh failed (status=${status ?? 'none'}, non-401), keeping session. Will refresh on next request.`);
      logBreadcrumb('STARTUP_REFRESH_TRANSIENT_KEPT', { status: String(status ?? 'none'), code: error?.code || 'none' });
      // Release queued waiters with the old token so they never hang.
      onTokenRefreshed(tokens.accessToken);
      return tokens.accessToken;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  const refreshed = await refreshPromise;
  return refreshed
    ? { valid: true, accessToken: refreshed }
    : { valid: false, accessToken: null };
};

export default apiClient;
