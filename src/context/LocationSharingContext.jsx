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
   * Key design: TransistorSoft works with "When in Use" permission (via foreground
   * service). "Allow all the time" is only needed for killed-state tracking.
   * So we ALWAYS start TransistorSoft if we have any location permission,
   * and only prompt for "Always" once as a bonus.
   *
   * Flow:
   * 1. Always start TransistorSoft (works with foreground location permission)
   * 2. If "Always" not granted and never asked → prompt once for killed-state support
   * 3. If user declines "Always" → TransistorSoft still works in foreground+background
   */
  const startBackgroundWithPermission = useCallback(async (pid, reqId) => {
    // Always start TransistorSoft — it works with "When in Use" via foreground service
    startBackgroundTracking(pid, reqId);

    // Check if "Allow all the time" is already granted (for killed-state support)
    const alwaysGranted = await isBackgroundLocationGranted();
    if (alwaysGranted) return; // All good — killed-state tracking works too

    // Prompt for "Always" permission once — bonus for killed-state, not a blocker
    if (bgPermissionPromptedRef.current) return;

    try {
      const alreadyAsked = await AsyncStorage.getItem(BG_PERMISSION_ASKED_KEY);
      if (alreadyAsked === 'true') return;
    } catch {}

    bgPermissionPromptedRef.current = true;
    await AsyncStorage.setItem(BG_PERMISSION_ASKED_KEY, 'true').catch(() => {});

    const granted = await requestBackgroundLocationPermission(dialog);
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
      // Provider session ending (logout or unmount) — stop all background tracking
      // Critical for App Store compliance: no tracking without active requests
      stopAllBackgroundTracking();
    };
  }, []);

  // ─── Resume: fetch active requests and start tracking for enabled ones ──
  const resumeTracking = useCallback(async () => {
    if (!mountedRef.current) return;
    const pid = providerIdRef.current;
    if (!pid) return;

    try {
      const allActive = await fetchAllActiveRequests(pid);
      const alreadyTracking = new Set(getActiveTrackingRequests());
      let started = 0;

      for (const req of allActive) {
        const reqId = req._id;
        if (!reqId || alreadyTracking.has(reqId)) continue;

        const category = req._serviceCategory || 'traditional';
        const lsEnabled = req.locationSharing?.enabled === true;

        if (lsEnabled) {
          startRequestLocationTracking(reqId, pid, null, category);
          // Ensure the request room is subscribed so the backend broadcasts
          // reach this provider (and so the user's broadcasts route correctly)
          subscribeToRequest(reqId);
          // Start background tracking alongside foreground socket
          // (reads tokens from Keychain, configures TransistorSoft if needed)
          startBackgroundWithPermission(pid, reqId);
          started++;
        }
      }

      if (started > 0) {
        console.log(
          `[LocationSharingCtx] Resumed tracking for ${started} request(s)`,
        );
      }
    } catch (err) {
      console.warn('[LocationSharingCtx] Resume failed:', err.message);
    }
  }, []);

  // ─── Mount: initial resume (with small delay for socket init) ──────────
  useEffect(() => {
    if (!isProvider || !providerId) return;
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
  useEffect(() => {
    if (!isProvider || !providerId) return;

    const interval = setInterval(resumeTracking, RESYNC_INTERVAL_MS);
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
