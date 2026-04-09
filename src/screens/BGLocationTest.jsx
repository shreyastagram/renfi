/**
 * Background Location Diagnostic Screen
 *
 * Temporary test screen to verify TransistorSoft background tracking
 * and the backend POST endpoint independently.
 *
 * Add to your navigator temporarily:
 *   <Stack.Screen name="BGLocationTest" component={BGLocationTest} />
 *
 * Remove before production release.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import BackgroundGeolocation from 'react-native-background-geolocation';
import Geolocation from '@react-native-community/geolocation';
import { getTokens } from '../utils/storage';
import { NODE_BASE_URL } from '../config/api';
import { useApp } from '../context/AppContext';
import {
  startBackgroundTracking,
  stopAllBackgroundTracking,
  isBackgroundTrackingRunning,
  getBackgroundTrackingCount,
} from '../services/backgroundLocationService';

const BGLocationTest = () => {
  const [logs, setLogs] = useState([]);
  const { user, profile } = useApp();
  const providerId =
    user?.mongoId || profile?.mongoId || user?._id || profile?._id || null;

  const log = useCallback((msg, type = 'info') => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${ts}] ${type.toUpperCase()}: ${msg}`, ...prev].slice(0, 100));
  }, []);

  // ─── Test 1: Check tokens ───
  const testTokens = async () => {
    log('--- TEST: Tokens ---');
    try {
      const tokens = await getTokens();
      if (tokens?.accessToken) {
        log(`Access token: ${tokens.accessToken.substring(0, 30)}...`);
        log(`Refresh token: ${tokens.refreshToken ? 'present' : 'MISSING'}`, tokens.refreshToken ? 'info' : 'error');
      } else {
        log('NO TOKENS IN KEYCHAIN', 'error');
      }
    } catch (e) {
      log(`Token read failed: ${e.message}`, 'error');
    }
  };

  // ─── Test 2: Get current GPS ───
  const testGPS = async () => {
    log('--- TEST: GPS ---');
    Geolocation.getCurrentPosition(
      (pos) => {
        log(`GPS: lat=${pos.coords.latitude.toFixed(6)}, lng=${pos.coords.longitude.toFixed(6)}`);
        log(`Accuracy: ${pos.coords.accuracy}m, Speed: ${pos.coords.speed}`);
      },
      (err) => log(`GPS error: ${err.message}`, 'error'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // ─── Test 3: Direct HTTP POST to backend (bypass TransistorSoft) ───
  const testDirectPost = async () => {
    log('--- TEST: Direct POST to backend ---');
    try {
      const tokens = await getTokens();
      if (!tokens?.accessToken) {
        log('No token — cannot POST', 'error');
        return;
      }

      // Get current location first
      const pos = await new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const body = {
        providerId: String(providerId),
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: new Date().toISOString(),
        source: 'test-direct',
      };

      log(`POSTing to ${NODE_BASE_URL}/api/provider/location-update`);
      log(`Body: lat=${body.latitude.toFixed(4)}, lng=${body.longitude.toFixed(4)}, pid=${body.providerId}`);

      const res = await fetch(`${NODE_BASE_URL}/api/provider/location-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      log(`Response ${res.status}: ${text}`, res.status === 200 ? 'info' : 'error');
    } catch (e) {
      log(`Direct POST failed: ${e.message}`, 'error');
    }
  };

  // ─── Test 4: Start TransistorSoft ───
  const testStartBG = async () => {
    log('--- TEST: Start TransistorSoft ---');
    log(`Provider ID: ${providerId}`);
    const fakeRequestId = 'test-request-' + Date.now();
    log(`Using test request ID: ${fakeRequestId}`);

    const result = await startBackgroundTracking(providerId, fakeRequestId);
    log(`startBackgroundTracking returned: ${result}`, result ? 'info' : 'error');
    log(`isRunning: ${isBackgroundTrackingRunning()}, count: ${getBackgroundTrackingCount()}`);
  };

  // ─── Test 5: Check TransistorSoft state ───
  const testBGState = async () => {
    log('--- TEST: TransistorSoft State ---');
    try {
      const state = await BackgroundGeolocation.getState();
      log(`enabled: ${state.enabled}`);
      log(`trackingMode: ${state.trackingMode}`);
      log(`url: ${state.url}`);
      log(`distanceFilter: ${state.distanceFilter}`);
      log(`stopOnTerminate: ${state.stopOnTerminate}`);
      log(`startOnBoot: ${state.startOnBoot}`);
      log(`isMoving: ${state.isMoving}`);
      log(`authorization.accessToken: ${state.authorization?.accessToken ? state.authorization.accessToken.substring(0, 20) + '...' : 'NONE'}`);
      log(`Module isRunning: ${isBackgroundTrackingRunning()}, requests: ${getBackgroundTrackingCount()}`);
    } catch (e) {
      log(`State check failed: ${e.message}`, 'error');
    }
  };

  // ─── Test 6: Force a TransistorSoft location event ───
  const testForceLocation = async () => {
    log('--- TEST: Force getCurrentPosition via TransistorSoft ---');
    try {
      const location = await BackgroundGeolocation.getCurrentPosition({
        extras: {
          providerId: String(providerId),
          source: 'test-force',
        },
      });
      log(`TransistorSoft GPS: lat=${location.coords.latitude.toFixed(6)}, lng=${location.coords.longitude.toFixed(6)}`);
      log(`Accuracy: ${location.coords.accuracy}m`);
      log('This should trigger an HTTP POST — check backend logs!');
    } catch (e) {
      log(`Force location failed: ${e.message}`, 'error');
    }
  };

  // ─── Test 7: Stop TransistorSoft ───
  const testStopBG = async () => {
    log('--- TEST: Stop TransistorSoft ---');
    await stopAllBackgroundTracking();
    log(`Stopped. isRunning: ${isBackgroundTrackingRunning()}, count: ${getBackgroundTrackingCount()}`);
  };

  const clearLogs = () => setLogs([]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BG Location Diagnostics</Text>
      <Text style={styles.subtitle}>Provider: {providerId || 'NOT LOGGED IN'}</Text>
      <Text style={styles.subtitle}>Backend: {NODE_BASE_URL}</Text>

      <ScrollView horizontal style={styles.buttonRow} showsHorizontalScrollIndicator={false}>
        <Btn label="1. Tokens" onPress={testTokens} />
        <Btn label="2. GPS" onPress={testGPS} />
        <Btn label="3. Direct POST" onPress={testDirectPost} color="#e67e22" />
        <Btn label="4. Start BG" onPress={testStartBG} color="#27ae60" />
        <Btn label="5. BG State" onPress={testBGState} />
        <Btn label="6. Force Loc" onPress={testForceLocation} color="#e67e22" />
        <Btn label="7. Stop BG" onPress={testStopBG} color="#c0392b" />
        <Btn label="Clear" onPress={clearLogs} color="#7f8c8d" />
      </ScrollView>

      <ScrollView style={styles.logArea}>
        {logs.map((l, i) => (
          <Text
            key={i}
            style={[
              styles.logLine,
              l.includes('ERROR') && styles.logError,
            ]}
          >
            {l}
          </Text>
        ))}
        {logs.length === 0 && (
          <Text style={styles.logHint}>
            Tap buttons above in order (1→7).{'\n\n'}
            Test 3 (Direct POST) is the most important —{'\n'}
            it bypasses TransistorSoft and hits the backend directly.{'\n'}
            Check your backend terminal for [BackgroundLocation] logs.{'\n\n'}
            Test 4→6 tests TransistorSoft itself.
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

const Btn = ({ label, onPress, color = '#3498db' }) => (
  <TouchableOpacity
    style={[styles.btn, { backgroundColor: color }]}
    onPress={onPress}
  >
    <Text style={styles.btnText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', paddingTop: 50, paddingHorizontal: 12 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 4 },
  buttonRow: { flexDirection: 'row', marginVertical: 12, maxHeight: 50 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, marginRight: 8 },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logArea: { flex: 1, backgroundColor: '#0d0d1a', borderRadius: 8, padding: 10 },
  logLine: { color: '#0f0', fontSize: 12, fontFamily: 'monospace', marginBottom: 2 },
  logError: { color: '#ff4444' },
  logHint: { color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 },
});

export default BGLocationTest;
