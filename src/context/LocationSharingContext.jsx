/**
 * Location Sharing Context
 *
 * Centralises per-request provider location-sharing lifecycle so that the GPS
 * watcher keeps running regardless of which screen the provider is on.
 *
 * Responsibilities:
 * - Resume tracking on mount (fetch active requests, start for enabled ones)
 * - React to socket events: request:location:status, request:completed, request:cancelled
 * - Health-check the GPS watcher every 30 s and force-restart if it died
 * - Periodically re-sync with the backend every 60 s
 * - Re-subscribe request rooms on socket reconnect
 *
 * Must be wrapped inside AppProvider (needs useApp) and mounted for the entire
 * provider session (wrap ProviderMainNavigator).
 *
 * @version 1.0.0
 */

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useApp } from './AppContext';
import { useDialog } from './DialogContext';
import {
  addEventListener,
  startRequestLocationTracking,
  stopRequestLocationTracking,
  getActiveTrackingRequests,
  isTrackingRequest,
  isGpsWatcherRunning,
  getLastGpsUpdateTime,
  restartGpsWatcher,
  subscribeToRequest,
} from '../services/socketService';
import {
  startBackgroundTracking,
  stopBackgroundTrackingForRequest,
  stopAllBackgroundTracking,
} from '../services/backgroundLocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestBackgroundLocationPermission,
  showBatteryOptimizationDialog,
  isBackgroundLocationGranted,
} from '../utils/permissions';
import { getProviderRequests } from '../services/traditionalServiceService';
import { authFetch } from '../utils/authFetch';
import { NODE_BASE_URL } from '../config/api';

const BG_PERMISSION_ASKED_KEY = 'fixhomi_bg_location_asked';

const LocationSharingContext = createContext(null);

// ─── Interval constants ─────────────────────────────────────────────────────
const HEALTH_CHECK_INTERVAL_MS = 30_000; // 30 s
const RESYNC_INTERVAL_MS = 60_000; // 60 s
const GPS_STALE_THRESHOLD_MS = 30_000; // If no GPS reading in 30 s, watcher is stale

/**
 * Fetch all provider requests (accepted / in-progress / in_transit) across the
 * 3 service categories and return a flat array annotated with `_serviceCategory`.
 */
const fetchAllActiveRequests = async (providerId) => {
  const fetchCategory = async (url, category) => {
    try {
      const res = await authFetch(url);
      const data = await res.json();
      return (data.requests || data.data || []).map((r) => ({
        ...r,
        _serviceCategory: category,
      }));
    } catch {
      return [];
    }
  };

  const [tradAccepted, tradInProgress, eventReqs, emergencyReqs] = await Promise.all([
    getProviderRequests(providerId, { page: 1, limit: 50, status: 'accepted' })
      .then((r) =>
        (r?.requests || r?.data || []).map((x) => ({
          ...x,
          _serviceCategory: 'traditional',
        })),
      )
      .catch(() => []),
    getProviderRequests(providerId, { page: 1, limit: 50, status: 'in-progress' })
      .then((r) =>
        (r?.requests || r?.data || []).map((x) => ({
          ...x,
          _serviceCategory: 'traditional',
        })),
      )
      .catch(() => []),
    fetchCategory(
      `${NODE_BASE_URL}/api/event-services/provider/${providerId}?status=accepted&limit=50`,
      'event',
    ),
    fetchCategory(
      `${NODE_BASE_URL}/api/emergency-services/provider/${providerId}?status=accepted&limit=50`,
      'emergency',
    ),
  ]);

  return [...tradAccepted, ...tradInProgress, ...eventReqs, ...emergencyReqs];
};

export const LocationSharingProvider = ({ children }) => {
  const { user, profile, userType } = useApp();
  const { dialog } = useDialog();
  const isProvider = userType === 'provider';
  const providerId =
    user?.mongoId || profile?.mongoId || user?._id || profile?._id || null;

  // Stable ref so intervals/callbacks always see the latest providerId
  const providerIdRef = useRef(providerId);
  providerIdRef.current = providerId;

  // Track whether we've already prompted this session (in-memory guard)
  const bgPermissionPromptedRef = useRef(false);

  /**
   * Start background tracking with permission check.
   *
   * Key design: TransistorSoft works with "When in Use" permission (via
   * foreground service). "Allow all the time" is only needed for
   * killed-state tracking.
   *
   * Flow (updated for Prominent Disclosure compliance — Google Play User
   * Data policy):
   * 1. If "Always" is already granted → start tracking immediately.
   * 2. Else, if never asked this install → show OUR in-app disclosure FIRST,
   *    wait for the user's tap, then (if granted) let the OS prompt fire
   *    via react-native-permissions. Only AFTER the user has responded
   *    do we start TransistorSoft. This prevents the native OS prompt from
   *    racing with our disclosure.
   * 3. If user declines "Always" → still start TransistorSoft with foreground
   *    permission (it works via the foreground service).
   * 4. If already asked earlier → just start TransistorSoft without
   *    re-prompting.
   */
  const startBackgroundWithPermission = useCallback(async (pid, reqId) => {
    // Fast path: BG already granted → start tracking and return
    const alwaysGranted = await isBackgroundLocationGranted();
    if (alwaysGranted) {
      startBackgroundTracking(pid, reqId);
      return;
    }

    // Already asked this session or this install → start with FG-only
    if (bgPermissionPromptedRef.current) {
      startBackgroundTracking(pid, reqId);
      return;
    }
    try {
      const alreadyAsked = await AsyncStorage.getItem(BG_PERMISSION_ASKED_KEY);
      if (alreadyAsked === 'true') {
        startBackgroundTracking(pid, reqId);
        return;
      }
    } catch {}

    // First-time ask: show OUR disclosure → OS prompt → THEN start tracking.
    // Ordering matters — TransistorSoft's start() can trigger its own OS
    // prompt, which must never appear while our disclosure is still visible.
    bgPermissionPromptedRef.current = true;
    await AsyncStorage.setItem(BG_PERMISSION_ASKED_KEY, 'true').catch(() => {});

    const granted = await requestBackgroundLocationPermission(dialog);

    // Start tracking regardless of outcome — TransistorSoft works with
    // foreground permission via the foreground service. "Allow all the
    // time" only adds killed-state coverage.
    startBackgroundTracking(pid, reqId);

    if (granted) {
      setTimeout(() => showBatteryOptimizationDialog(dialog), 800);
    }
  }, [dialog]);

  // Mounted guard — prevents interval/async callbacks from running after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // DO NOT call stopAllBackgroundTracking() here!
      // When the app is swiped away, React unmounts components which triggers
      // this cleanup. If we call stop() here, we kill the native service right
      // before the process dies, preventing killed-state tracking entirely.
      // TransistorSoft's stopOnTerminate:false handles the kill case natively.
      // Background tracking is stopped on logout via the isProvider/providerId effect below.
    };
  }, []);

  // Stop background tracking when provider logs out (isProvider becomes false or providerId becomes null)
  const prevIsProviderRef = useRef(isProvider);
  const prevProviderIdRef = useRef(providerId);
  useEffect(() => {
    const wasProvider = prevIsProviderRef.current;
    const hadId = prevProviderIdRef.current;
    prevIsProviderRef.current = isProvider;
    prevProviderIdRef.current = providerId;

    // Detect logout: was a provider, now isn't
    if (wasProvider && hadId && (!isProvider || !providerId)) {
      console.log('[LocationSharingCtx] Provider logged out — stopping background tracking');
      stopAllBackgroundTracking();
    }
  }, [isProvider, providerId]);

  // ─── Resume: fetch active requests and start tracking for enabled ones ──
  const resumeTracking = useCallback(async () => {
    if (!mountedRef.current) {
      console.log('[LocationSharingCtx] resumeTracking: NOT MOUNTED — skipping');
      return;
    }
    const pid = providerIdRef.current;
    if (!pid) {
      console.log('[LocationSharingCtx] resumeTracking: NO providerId — skipping');
      return;
    }

    console.log(`[LocationSharingCtx] resumeTracking: starting for provider ${pid}`);

    try {
      const allActive = await fetchAllActiveRequests(pid);
      console.log(`[LocationSharingCtx] resumeTracking: fetched ${allActive.length} active request(s)`);

      const alreadyTracking = new Set(getActiveTrackingRequests());
      console.log(`[LocationSharingCtx] resumeTracking: already tracking ${alreadyTracking.size} request(s):`, [...alreadyTracking]);

      let started = 0;
      let skippedAlreadyTracking = 0;
      let skippedNoLocationSharing = 0;

      for (const req of allActive) {
        const reqId = req._id;
        if (!reqId) continue;

        if (alreadyTracking.has(reqId)) {
          skippedAlreadyTracking++;
          continue;
        }

        const category = req._serviceCategory || 'traditional';
        const lsEnabled = req.locationSharing?.enabled === true;

        console.log(`[LocationSharingCtx] Request ${reqId}: locationSharing=${JSON.stringify(req.locationSharing)}, enabled=${lsEnabled}, category=${category}, status=${req.status}`);

        if (lsEnabled) {
          startRequestLocationTracking(reqId, pid, null, category);
          subscribeToRequest(reqId);
          startBackgroundWithPermission(pid, reqId);
          started++;
        } else {
          skippedNoLocationSharing++;
        }
      }

      console.log(`[LocationSharingCtx] resumeTracking DONE: started=${started}, skippedAlreadyTracking=${skippedAlreadyTracking}, skippedNoLocationSharing=${skippedNoLocationSharing}`);
    } catch (err) {
      console.warn('[LocationSharingCtx] Resume failed:', err.message, err.stack);
    }
  }, []);

  // ─── Mount: initial resume (with small delay for socket init) ──────────
  useEffect(() => {
    console.log(`[LocationSharingCtx] Mount effect: isProvider=${isProvider}, providerId=${providerId}`);
    if (!isProvider || !providerId) {
      console.log('[LocationSharingCtx] Mount effect: SKIPPING — not a provider or no ID');
      return;
    }
    console.log('[LocationSharingCtx] Mount effect: scheduling resumeTracking in 2s');
    const timer = setTimeout(resumeTracking, 2000);
    return () => clearTimeout(timer);
  }, [isProvider, providerId, resumeTracking]);

  // ─── Socket: react to location-sharing status changes ──────────────────
  useEffect(() => {
    if (!isProvider || !providerId) return;

    const cleanupStatus = addEventListener(
      'request:location:status',
      (data) => {
        const pid = providerIdRef.current;
        if (!pid || !data?.requestId) return;

        if (data.enabled) {
          const category = data.serviceCategory || 'traditional';
          if (!isTrackingRequest(data.requestId)) {
            console.log(
              `[LocationSharingCtx] ENABLED ${data.requestId} — starting tracking`,
            );
            startRequestLocationTracking(
              data.requestId,
              pid,
              null,
              category,
            );
            subscribeToRequest(data.requestId);
            startBackgroundWithPermission(pid, data.requestId);
          }
        } else {
          console.log(
            `[LocationSharingCtx] DISABLED ${data.requestId} — stopping tracking`,
          );
          stopRequestLocationTracking(data.requestId);
          stopBackgroundTrackingForRequest(data.requestId);
        }
      },
    );

    return cleanupStatus;
  }, [isProvider, providerId]);

  // ─── Socket: stop tracking on completion / cancellation ────────────────
  useEffect(() => {
    if (!isProvider) return;

    const cleanupCompleted = addEventListener('request:completed', (data) => {
      if (data?.requestId) {
        console.log(
          `[LocationSharingCtx] Request ${data.requestId} completed — stopping tracking`,
        );
        stopRequestLocationTracking(data.requestId);
        stopBackgroundTrackingForRequest(data.requestId);
      }
    });

    const cleanupCancelled = addEventListener('request:cancelled', (data) => {
      if (data?.requestId) {
        console.log(
          `[LocationSharingCtx] Request ${data.requestId} cancelled — stopping tracking`,
        );
        stopRequestLocationTracking(data.requestId);
        stopBackgroundTrackingForRequest(data.requestId);
      }
    });

    return () => {
      cleanupCompleted();
      cleanupCancelled();
    };
  }, [isProvider]);

  // ─── Health check: verify GPS watcher is alive ─────────────────────────
  useEffect(() => {
    if (!isProvider) return;

    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      const activeCount = getActiveTrackingRequests().length;
      if (activeCount === 0) return; // Nothing to check

      // Check 1: watcher variables are alive
      if (!isGpsWatcherRunning()) {
        console.warn(
          `[LocationSharingCtx] Health: GPS watcher died with ${activeCount} active request(s) — restarting`,
        );
        restartGpsWatcher();
        return;
      }

      // Check 2: watcher is alive but hasn't produced a reading recently
      const lastUpdate = getLastGpsUpdateTime();
      if (lastUpdate && Date.now() - lastUpdate > GPS_STALE_THRESHOLD_MS) {
        console.warn(
          `[LocationSharingCtx] Health: No GPS reading in ${Math.round(
            (Date.now() - lastUpdate) / 1000,
          )}s — restarting watcher`,
        );
        restartGpsWatcher();
      }
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isProvider]);

  // ─── Periodic re-sync with backend ─────────────────────────────────────
  // Catches any requests whose sharing was enabled/disabled while the socket
  // was disconnected or events were missed.
  // Only runs the full resumeTracking when there are active tracked requests,
  // otherwise just checks once (lightweight).
  useEffect(() => {
    if (!isProvider || !providerId) return;

    const interval = setInterval(() => {
      const activeCount = getActiveTrackingRequests().length;
      // If already tracking requests, resync to catch missed events
      // If NOT tracking, still check once in case a new request was enabled while socket was down
      if (activeCount > 0 || !mountedRef.current) {
        resumeTracking();
      }
    }, RESYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isProvider, providerId, resumeTracking]);

  // ─── Socket reconnect: ensure rooms + watcher are alive ────────────────
  // The socketService reconnect handler re-subscribes rooms for tracked
  // requests and calls ensureGpsWatcherRunning(). This effect triggers an
  // additional resume to catch any requests enabled while disconnected.
  useEffect(() => {
    if (!isProvider || !providerId) return;

    const cleanupReconnect = addEventListener('__internal:reconnected', () => {
      console.log('[LocationSharingCtx] Socket reconnected — resuming tracking');
      resumeTracking();
    });

    return cleanupReconnect;
  }, [isProvider, providerId, resumeTracking]);

  return (
    <LocationSharingContext.Provider value={null}>
      {children}
    </LocationSharingContext.Provider>
  );
};

export const useLocationSharing = () => useContext(LocationSharingContext);
