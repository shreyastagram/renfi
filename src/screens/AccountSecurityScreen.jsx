/**
 * Account Security Screen
 * 
 * Phase 4: Auth Infrastructure UI
 * Allows users to manage their account security:
 * - View active sessions
 * - Sign out from other devices
 * - Trust/Untrust devices
 * - View auth health status
 * - Change password
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  getActiveSessions,
  revokeSession,
  revokeAllOtherSessions,
  checkAuthHealth,
  getDeviceInfo,
  isCurrentDeviceTrusted,
  trustCurrentDevice,
  untrustDevice,
  AUTH_HEALTH,
  SESSION_STATUS,
} from '../services/authInfraService';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';

// ==================== COLORS ====================

const COLORS = {
  primary: '#1a73e8',
  success: '#34a853',
  warning: '#fbbc05',
  danger: '#ea4335',
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#212121',
  textSecondary: '#757575',
  border: '#e0e0e0',
};

// ==================== COMPONENTS ====================

/**
 * Section Header
 */
const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

/**
 * Health Status Badge
 */
const HealthBadge = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case AUTH_HEALTH.HEALTHY:
        return { bg: COLORS.success, text: 'Healthy' };
      case AUTH_HEALTH.TOKEN_EXPIRING:
        return { bg: COLORS.warning, text: 'Token Expiring' };
      case AUTH_HEALTH.TOKEN_EXPIRED:
        return { bg: COLORS.danger, text: 'Token Expired' };
      case AUTH_HEALTH.NO_SESSION:
        return { bg: COLORS.textSecondary, text: 'No Session' };
      case AUTH_HEALTH.SERVICE_ERROR:
        return { bg: COLORS.warning, text: 'Service Unavailable' };
      default:
        return { bg: COLORS.textSecondary, text: 'Unknown' };
    }
  };

  const style = getStyle();
  
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={styles.badgeText}>{style.text}</Text>
    </View>
  );
};

/**
 * Session Card
 */
const SessionCard = ({ session, isCurrentDevice, onRevoke, isRevoking }) => {
  const getDeviceIcon = () => {
    const platform = session.platform || session.deviceInfo?.platform || 'unknown';
    if (platform === 'ios') return '📱';
    if (platform === 'android') return '📱';
    if (platform === 'web') return '💻';
    return '📟';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <View style={[styles.sessionCard, isCurrentDevice && styles.currentSessionCard]}>
      <View style={styles.sessionHeader}>
        <Text style={styles.deviceIcon}>{getDeviceIcon()}</Text>
        <View style={styles.sessionInfo}>
          <Text style={styles.deviceName}>
            {session.deviceName || session.deviceModel || 'Unknown Device'}
            {isCurrentDevice && ' (This Device)'}
          </Text>
          <Text style={styles.deviceDetails}>
            {session.platform || 'Unknown Platform'} {session.systemVersion || ''}
          </Text>
        </View>
        {!isCurrentDevice && (
          <TouchableOpacity
            style={styles.revokeButton}
            onPress={() => onRevoke(session.id || session.sessionId)}
            disabled={isRevoking}
          >
            {isRevoking ? (
              <ActivityIndicator size="small" color={COLORS.danger} />
            ) : (
              <Text style={styles.revokeButtonText}>Sign Out</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.sessionMeta}>
        <Text style={styles.sessionMetaText}>
          Last active: {formatDate(session.lastActive || session.lastActivityAt)}
        </Text>
        {session.location && (
          <Text style={styles.sessionMetaText}>
            📍 {session.location}
          </Text>
        )}
      </View>
    </View>
  );
};

// ==================== MAIN SCREEN ====================

const AccountSecurityScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useApp();
  const { dialog } = useDialog();
  
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [isTrusted, setIsTrusted] = useState(false);
  const [revokingSession, setRevokingSession] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);

  /**
   * Load all security data
   */
  const loadSecurityData = useCallback(async () => {
    try {
      console.log('🔒 [AccountSecurity] Loading security data...');
      
      // Fetch all data in parallel
      const [healthResult, sessionsResult, deviceInfo, trusted] = await Promise.all([
        checkAuthHealth(),
        getActiveSessions(),
        getDeviceInfo(),
        isCurrentDeviceTrusted(),
      ]);
      
      setHealthStatus(healthResult);
      setCurrentDeviceId(deviceInfo.deviceId);
      setIsTrusted(trusted);
      
      if (sessionsResult.success) {
        setSessions(sessionsResult.data || []);
      }
      
      console.log('✅ [AccountSecurity] Security data loaded');
    } catch (error) {
      console.error('❌ [AccountSecurity] Failed to load:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSecurityData();
  }, [loadSecurityData]);

  /**
   * Refresh data
   */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSecurityData();
  }, [loadSecurityData]);

  /**
   * Handle revoking a specific session
   */
  const handleRevokeSession = async (sessionId) => {
    dialog(
      'Sign Out Device',
      'Are you sure you want to sign out this device? They will need to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setRevokingSession(sessionId);
            const result = await revokeSession(sessionId);
            setRevokingSession(null);
            
            if (result.success) {
              setSessions(prev => prev.filter(s => (s.id || s.sessionId) !== sessionId));
              dialog('Success', 'Device signed out successfully');
            } else {
              dialog('Error', result.error?.message || 'Failed to sign out device');
            }
          },
        },
      ],
    );
  };

  /**
   * Handle revoking all other sessions
   */
  const handleRevokeAll = async () => {
    dialog(
      'Sign Out All Devices',
      'Are you sure you want to sign out all other devices? They will all need to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out All',
          style: 'destructive',
          onPress: async () => {
            setRevokingAll(true);
            const result = await revokeAllOtherSessions();
            setRevokingAll(false);
            
            if (result.success) {
              setSessions(prev => prev.filter(s => s.deviceId === currentDeviceId));
              dialog('Success', `Signed out ${result.revokedCount || 0} device(s)`);
            } else {
              dialog('Error', result.error?.message || 'Failed to sign out devices');
            }
          },
        },
      ],
    );
  };

  /**
   * Handle trusting/untrusting current device
   */
  const handleTrustDevice = async () => {
    if (isTrusted) {
      const result = await untrustDevice(currentDeviceId);
      if (result.success) {
        setIsTrusted(false);
        dialog('Device Untrusted', 'This device is no longer trusted');
      }
    } else {
      const result = await trustCurrentDevice();
      if (result.success) {
        setIsTrusted(true);
        dialog('Device Trusted', 'This device is now trusted for future logins');
      }
    }
  };

  /**
   * Navigate to change password
   */
  const handleChangePassword = () => {
    navigation.navigate('ChangePassword');
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading security settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      {/* Auth Health Section */}
      <SectionHeader title="Account Status" />
      <View style={styles.card}>
        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>Authentication Status</Text>
          <HealthBadge status={healthStatus?.status} />
        </View>
        <Text style={styles.healthMessage}>
          {healthStatus?.message || 'Checking status...'}
        </Text>
      </View>

      {/* Current Device Section */}
      <SectionHeader title="This Device" />
      <View style={styles.card}>
        <View style={styles.deviceRow}>
          <Text style={styles.deviceLabel}>Device ID</Text>
          <Text style={styles.deviceValue} numberOfLines={1}>
            {currentDeviceId?.substring(0, 20)}...
          </Text>
        </View>
        <View style={styles.deviceRow}>
          <Text style={styles.deviceLabel}>Trusted Device</Text>
          <TouchableOpacity
            style={[styles.trustButton, isTrusted && styles.trustedButton]}
            onPress={handleTrustDevice}
          >
            <Text style={[styles.trustButtonText, isTrusted && styles.trustedButtonText]}>
              {isTrusted ? '✓ Trusted' : 'Trust Device'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.trustHint}>
          Trusted devices may have longer session durations
        </Text>
      </View>

      {/* Password Section */}
      <SectionHeader title="Password" />
      <TouchableOpacity style={styles.card} onPress={handleChangePassword}>
        <View style={styles.menuRow}>
          <Text style={styles.menuLabel}>Change Password</Text>
          <Text style={styles.menuArrow}>›</Text>
        </View>
      </TouchableOpacity>

      {/* Active Sessions Section */}
      <SectionHeader title="Active Sessions" />
      
      {sessions.length > 1 && (
        <TouchableOpacity
          style={styles.revokeAllButton}
          onPress={handleRevokeAll}
          disabled={revokingAll}
        >
          {revokingAll ? (
            <ActivityIndicator size="small" color={COLORS.surface} />
          ) : (
            <Text style={styles.revokeAllButtonText}>
              Sign Out All Other Devices
            </Text>
          )}
        </TouchableOpacity>
      )}
      
      {sessions.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.noSessionsText}>
            No active sessions found. This could be because session tracking is not yet enabled on the server.
          </Text>
        </View>
      ) : (
        sessions.map((session, index) => (
          <SessionCard
            key={session.id || session.sessionId || index}
            session={session}
            isCurrentDevice={session.deviceId === currentDeviceId}
            onRevoke={handleRevokeSession}
            isRevoking={revokingSession === (session.id || session.sessionId)}
          />
        ))
      )}

      {/* Danger Zone */}
      <SectionHeader title="Danger Zone" />
      <TouchableOpacity
        style={[styles.card, styles.dangerCard]}
        onPress={() => logout(true)}
      >
        <Text style={styles.dangerText}>Sign Out from This Device</Text>
      </TouchableOpacity>

      <View style={styles.footer} />
    </ScrollView>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  healthMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.surface,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deviceLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  deviceValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
    maxWidth: '50%',
  },
  trustButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  trustedButton: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  trustButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.primary,
  },
  trustedButtonText: {
    color: COLORS.surface,
  },
  trustHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  menuArrow: {
    fontSize: 24,
    color: COLORS.textSecondary,
  },
  sessionCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  currentSessionCard: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  deviceDetails: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  revokeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  revokeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.danger,
  },
  sessionMeta: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sessionMetaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  revokeAllButton: {
    backgroundColor: COLORS.danger,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  revokeAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.surface,
  },
  noSessionsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  dangerText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.danger,
    textAlign: 'center',
  },
  footer: {
    height: 40,
  },
});

export default AccountSecurityScreen;
