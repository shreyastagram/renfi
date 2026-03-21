/**
 * Account Security Screen
 *
 * Premium design matching Settings screen.
 * Features:
 * - Auth health status with visual indicator
 * - Device trust management
 * - Active sessions list with revoke
 * - Change password navigation
 * - Sign out (this device / all devices)
 *
 * @version 2.0.0 — Premium UI revamp
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
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
} from '../services/authInfraService';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { Icon } from '../components';
import ScreenShimmer from '../components/ShimmerLoader';
import GraphBackground from '../components/GraphBackground';
import SvgArt from '../components/SvgArt';

// ─── Design Tokens (matching Settings / Profile) ────────────────────
const C = {
  dark: '#0F172A',
  bg: '#F1F5F9',
  white: '#FFFFFF',
  primary: '#f67c16',
  secondary: '#2b76bc',
  success: '#10B981',
  successBg: '#ECFDF5',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  text: '#1E293B',
  textSec: '#64748B',
  muted: '#94A3B8',
  border: '#F1F5F9',
  iconBg: '#F1F5F9',
};

const SHADOWS = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 20 },
  android: { elevation: 5 },
});

const CARD_RADIUS = 22;
const ICON_SIZE = 42;

// ─── Health config (labels are translation keys) ────────────────────
const HEALTH_MAP = {
  [AUTH_HEALTH.HEALTHY]: { icon: 'verified-user', color: C.success, bg: C.successBg, labelKey: 'accountSecurity.healthy' },
  [AUTH_HEALTH.TOKEN_EXPIRING]: { icon: 'schedule', color: C.warning, bg: C.warningBg, labelKey: 'accountSecurity.tokenExpiring' },
  [AUTH_HEALTH.TOKEN_EXPIRED]: { icon: 'error-outline', color: C.danger, bg: C.dangerBg, labelKey: 'accountSecurity.tokenExpired' },
  [AUTH_HEALTH.NO_SESSION]: { icon: 'cancel', color: C.muted, bg: C.border, labelKey: 'accountSecurity.noSession' },
  [AUTH_HEALTH.SERVICE_ERROR]: { icon: 'cloud-off', color: C.warning, bg: C.warningBg, labelKey: 'accountSecurity.serviceUnavailable' },
};

// ─── Section Header ─────────────────────────────────────────────────
const SectionHeader = ({ title }) => (
  <View style={s.sectionHeaderWrap}>
    <View style={s.sectionAccent} />
    <Text style={s.sectionTitle}>{title}</Text>
  </View>
);

// ─── Menu Row ───────────────────────────────────────────────────────
const MenuRow = ({ icon, iconBg, iconColor, label, sublabel, onPress, trailing, disabled }) => (
  <TouchableOpacity style={s.menuRow} onPress={onPress} activeOpacity={0.7} disabled={disabled}>
    <View style={[s.menuIcon, { backgroundColor: iconBg || C.iconBg }]}>
      <MaterialIcon name={icon} size={22} color={iconColor || C.textSec} />
    </View>
    <View style={s.menuTextWrap}>
      <Text style={s.menuLabel}>{label}</Text>
      {sublabel ? <Text style={s.menuSublabel} numberOfLines={1}>{sublabel}</Text> : null}
    </View>
    {trailing || <MaterialIcon name="chevron-right" size={22} color={C.muted} />}
  </TouchableOpacity>
);

// ─── Session Card ───────────────────────────────────────────────────
const SessionCard = ({ session, isCurrentDevice, onRevoke, isRevoking }) => {
  const platformIcon = (session.platform || '').toLowerCase() === 'ios' ? 'phone-iphone' : 'phone-android';
  const formatDate = (d) => {
    if (!d) return 'Unknown';
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[s.sessionCard, isCurrentDevice && s.sessionCardCurrent]}>
      <View style={s.sessionRow}>
        <View style={[s.menuIcon, { backgroundColor: isCurrentDevice ? '#EFF6FF' : C.iconBg }]}>
          <MaterialIcon name={platformIcon} size={22} color={isCurrentDevice ? C.secondary : C.textSec} />
        </View>
        <View style={s.menuTextWrap}>
          <Text style={s.menuLabel}>
            {session.deviceName || session.deviceModel || 'Unknown Device'}
          </Text>
          <Text style={s.menuSublabel}>
            {session.platform || 'Unknown'} {session.systemVersion || ''}
            {isCurrentDevice ? '  —  This device' : ''}
          </Text>
        </View>
        {!isCurrentDevice && (
          <TouchableOpacity
            style={s.sessionRevokeBtn}
            onPress={() => onRevoke(session.id || session.sessionId)}
            disabled={isRevoking}
            activeOpacity={0.7}
          >
            {isRevoking ? (
              <ActivityIndicator size="small" color={C.danger} />
            ) : (
              <MaterialIcon name="logout" size={18} color={C.danger} />
            )}
          </TouchableOpacity>
        )}
      </View>
      <View style={s.sessionMeta}>
        <MaterialIcon name="access-time" size={13} color={C.muted} />
        <Text style={s.sessionMetaText}>{formatDate(session.lastActive || session.lastActivityAt)}</Text>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
const AccountSecurityScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, profile, logout } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [isTrusted, setIsTrusted] = useState(false);
  const [trustLoading, setTrustLoading] = useState(false);
  const [revokingSession, setRevokingSession] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const loadSecurityData = useCallback(async () => {
    try {
      const [healthResult, sessionsResult, deviceInfo, trusted] = await Promise.all([
        checkAuthHealth(),
        getActiveSessions(),
        getDeviceInfo(),
        isCurrentDeviceTrusted(),
      ]);
      setHealthStatus(healthResult);
      setCurrentDeviceId(deviceInfo.deviceId);
      setIsTrusted(trusted);
      if (sessionsResult.success) setSessions(sessionsResult.data || []);
    } catch (error) {
      console.error('[AccountSecurity] Load failed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadSecurityData(); }, [loadSecurityData]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadSecurityData(); }, [loadSecurityData]);

  const handleTrustDevice = async () => {
    setTrustLoading(true);
    try {
      if (isTrusted) {
        const result = await untrustDevice(currentDeviceId);
        if (result.success) { setIsTrusted(false); dialog(t('accountSecurity.deviceUntrusted'), t('accountSecurity.deviceUntrustedMsg')); }
      } else {
        const result = await trustCurrentDevice();
        if (result.success) { setIsTrusted(true); dialog(t('accountSecurity.deviceTrusted'), t('accountSecurity.deviceTrustedMsg')); }
      }
    } catch {} finally { setTrustLoading(false); }
  };

  const handleRevokeSession = (sessionId) => {
    dialog(t('accountSecurity.signOutDevice'), t('accountSecurity.signOutDeviceMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('accountSecurity.signOut'), style: 'destructive',
        onPress: async () => {
          setRevokingSession(sessionId);
          const result = await revokeSession(sessionId);
          setRevokingSession(null);
          if (result.success) {
            setSessions(prev => prev.filter(s => (s.id || s.sessionId) !== sessionId));
            dialog(t('common.success'), t('accountSecurity.deviceSignedOut'));
          } else {
            dialog(t('common.error'), result.error?.message || t('accountSecurity.signOutFailed'));
          }
        },
      },
    ]);
  };

  const handleRevokeAll = () => {
    dialog(t('accountSecurity.signOutAll'), t('accountSecurity.signOutAllMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('accountSecurity.signOutAllBtn'), style: 'destructive',
        onPress: async () => {
          setRevokingAll(true);
          const result = await revokeAllOtherSessions();
          setRevokingAll(false);
          if (result.success) {
            setSessions(prev => prev.filter(ses => ses.deviceId === currentDeviceId));
            dialog(t('common.success'), t('accountSecurity.signedOutDevices', { count: result.revokedCount || 0 }));
          } else {
            dialog(t('common.error'), result.error?.message || t('accountSecurity.signOutAllFailed'));
          }
        },
      },
    ]);
  };

  const handleSignOut = () => {
    dialog(t('accountSecurity.signOutThisDevice'), t('accountSecurity.signOutThisDeviceMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('accountSecurity.signOut'), style: 'destructive', onPress: () => logout(true) },
    ]);
  };

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ScreenShimmer type="security" />
      </View>
    );
  }

  const health = HEALTH_MAP[healthStatus?.status] || HEALTH_MAP[AUTH_HEALTH.NO_SESSION];
  const displayData = { ...user, ...profile };
  const maskedEmail = displayData?.email ? displayData.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null;

  return (
    <View style={s.container}>
      <GraphBackground />
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, overflow: 'hidden' }]}>
        <SvgArt color="#f67c16" height={70} />
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcon name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('accountSecurity.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Auth Health Card ────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader title={t('accountSecurity.accountStatus')} />
          <View style={s.healthCard}>
            <View style={[s.healthIconWrap, { backgroundColor: health.bg }]}>
              <MaterialIcon name={health.icon} size={26} color={health.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.healthLabel, { color: health.color }]}>{t(health.labelKey)}</Text>
              <Text style={s.healthMsg} numberOfLines={2}>{healthStatus?.message || t('accountSecurity.checkingStatus')}</Text>
            </View>
          </View>
          {maskedEmail && (
            <View style={s.infoRow}>
              <MaterialIcon name="email" size={16} color={C.muted} />
              <Text style={s.infoText}>{maskedEmail}</Text>
            </View>
          )}
        </View>

        {/* ─── This Device ────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader title={t('accountSecurity.thisDeviceSection')} />
          <View style={s.deviceTrustRow}>
            <View style={[s.menuIcon, { backgroundColor: isTrusted ? C.successBg : C.iconBg }]}>
              <MaterialIcon name={isTrusted ? 'verified-user' : 'security'} size={22} color={isTrusted ? C.success : C.textSec} />
            </View>
            <View style={s.menuTextWrap}>
              <Text style={s.menuLabel}>{isTrusted ? t('accountSecurity.trusted') : t('accountSecurity.notTrusted')}</Text>
              <Text style={s.menuSublabel}>{t('accountSecurity.trustHint')}</Text>
            </View>
            <TouchableOpacity
              style={[s.trustBtn, isTrusted ? s.trustBtnOn : s.trustBtnOff]}
              onPress={handleTrustDevice}
              disabled={trustLoading}
              activeOpacity={0.7}
            >
              {trustLoading ? (
                <ActivityIndicator size="small" color={isTrusted ? C.white : C.secondary} />
              ) : (
                <Text style={[s.trustBtnText, isTrusted ? s.trustBtnTextOn : s.trustBtnTextOff]}>
                  {isTrusted ? t('accountSecurity.removeTrust') : t('accountSecurity.trustDevice')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {currentDeviceId && (
            <View style={s.deviceIdRow}>
              <MaterialIcon name="fingerprint" size={14} color={C.muted} />
              <Text style={s.deviceIdText}>{currentDeviceId.substring(0, 24)}...</Text>
            </View>
          )}
        </View>

        {/* ─── Security Actions ───────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader title={t('accountSecurity.securityActions')} />
          <MenuRow
            icon="lock-reset"
            iconBg="#EFF6FF"
            iconColor={C.secondary}
            label={t('accountSecurity.changePasswordMenu')}
            sublabel={t('accountSecurity.changePasswordSub')}
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <View style={s.divider} />
          <MenuRow
            icon="refresh"
            iconBg="#FFF7ED"
            iconColor={C.primary}
            label={t('accountSecurity.refreshToken')}
            sublabel={t('accountSecurity.refreshTokenSub')}
            onPress={async () => {
              const result = await checkAuthHealth();
              setHealthStatus(result);
              dialog(t('accountSecurity.tokenStatus'), result?.message || t('accountSecurity.checkingStatus'));
            }}
          />
        </View>

        {/* ─── Active Sessions ────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader title={t('accountSecurity.activeSessions')} />
          {sessions.length === 0 ? (
            <View style={s.emptySessionWrap}>
              <MaterialIcon name="devices" size={36} color={C.muted} />
              <Text style={s.emptySessionText}>{t('accountSecurity.noActiveSessions')}</Text>
              <Text style={s.emptySessionHint}>{t('accountSecurity.sessionTrackingHint')}</Text>
            </View>
          ) : (
            <>
              {sessions.map((session, index) => (
                <SessionCard
                  key={session.id || session.sessionId || index}
                  session={session}
                  isCurrentDevice={session.deviceId === currentDeviceId}
                  onRevoke={handleRevokeSession}
                  isRevoking={revokingSession === (session.id || session.sessionId)}
                />
              ))}
              {sessions.length > 1 && (
                <TouchableOpacity style={s.revokeAllBtn} onPress={handleRevokeAll} disabled={revokingAll} activeOpacity={0.7}>
                  {revokingAll ? (
                    <ActivityIndicator size="small" color={C.danger} />
                  ) : (
                    <>
                      <MaterialIcon name="logout" size={16} color={C.danger} />
                      <Text style={s.revokeAllText}>{t('accountSecurity.signOutAllOther')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ─── Danger Zone ────────────────────────────────────── */}
        <View style={[s.section, s.dangerSection]}>
          <SectionHeader title={t('accountSecurity.dangerZone')} />
          <TouchableOpacity style={s.dangerBtn} onPress={handleSignOut} activeOpacity={0.7}>
            <MaterialIcon name="exit-to-app" size={20} color={C.danger} />
            <Text style={s.dangerBtnText}>{t('accountSecurity.signOutThisDevice') || 'Sign out of this device'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header — matches Settings
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.iconBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  // Section card — matches Settings
  section: { backgroundColor: C.white, borderRadius: CARD_RADIUS, padding: 20, marginBottom: 16, ...SHADOWS },
  sectionHeaderWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionAccent: { width: 4, height: 18, backgroundColor: C.primary, borderRadius: 2, marginRight: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: C.text, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Health card
  healthCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  healthIconWrap: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  healthLabel: { fontSize: 16, fontWeight: '700' },
  healthMsg: { fontSize: 12, color: C.textSec, marginTop: 2, lineHeight: 17 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  infoText: { fontSize: 13, color: C.muted, fontWeight: '500' },

  // Menu row — matches Settings
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuIcon: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  menuTextWrap: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  menuSublabel: { fontSize: 12, color: C.textSec, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginLeft: ICON_SIZE + 14 },

  // Device trust
  deviceTrustRow: { flexDirection: 'row', alignItems: 'center' },
  trustBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, minWidth: 70, alignItems: 'center' },
  trustBtnOn: { backgroundColor: C.danger + '12', borderWidth: 1, borderColor: C.danger + '30' },
  trustBtnOff: { backgroundColor: C.secondary, },
  trustBtnText: { fontSize: 13, fontWeight: '700' },
  trustBtnTextOn: { color: C.danger },
  trustBtnTextOff: { color: C.white },
  deviceIdRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  deviceIdText: { fontSize: 11, color: C.muted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Sessions
  sessionCard: { backgroundColor: C.bg, borderRadius: 16, padding: 14, marginBottom: 8 },
  sessionCardCurrent: { borderWidth: 1.5, borderColor: C.secondary + '40' },
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
  sessionRevokeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.dangerBg, alignItems: 'center', justifyContent: 'center' },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, marginLeft: ICON_SIZE + 14 },
  sessionMetaText: { fontSize: 11, color: C.muted },

  // Empty sessions
  emptySessionWrap: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptySessionText: { fontSize: 14, fontWeight: '600', color: C.textSec },
  emptySessionHint: { fontSize: 12, color: C.muted, textAlign: 'center' },

  // Revoke all
  revokeAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginTop: 4, borderRadius: 12, backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.danger + '30' },
  revokeAllText: { fontSize: 14, fontWeight: '700', color: C.danger },

  // Danger zone
  dangerSection: { borderWidth: 1, borderColor: C.danger + '20' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.danger + '30' },
  dangerBtnText: { fontSize: 15, fontWeight: '700', color: C.danger },
});

export default AccountSecurityScreen;
