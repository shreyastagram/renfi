/**
 * Referral & Rewards Screen
 *
 * Full Refer & Earn hub accessible from Settings.
 * Modern celebratory design with icons (no emojis).
 *
 * @version 2.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import TouchableOpacity from '../components/TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path } from 'react-native-svg';
import {
  getMyReferralCode,
  getMyStats,
  getCycleLeaderboard,
  getMyHistory,
  getCycleInfo,
} from '../services/referralService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  darkHero: '#0F172A',
  darkCard: '#1E293B',
  background: '#F1F5F9',
  cardWhite: '#FFFFFF',
  primary: '#f67c16',
  secondary: '#2b76bc',
  accent: '#7C3AED',
  muted: '#94A3B8',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  gold: '#F59E0B',
  silver: '#94A3B8',
  bronze: '#CD7F32',
  success: '#10B981',
  divider: '#F1F5F9',
};

const SHADOWS = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
  android: { elevation: 3 },
});

// ── SVG Background for hero card ─────────────────────────────────────────

const HeroBackground = () => (
  <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
    <Defs>
      <LinearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#1E293B" />
        <Stop offset="1" stopColor="#0F172A" />
      </LinearGradient>
    </Defs>
    <Rect width="100%" height="100%" fill="url(#heroBg)" />
    <Circle cx="85%" cy="15%" r="80" fill="rgba(246,124,22,0.06)" />
    <Circle cx="10%" cy="85%" r="60" fill="rgba(43,118,188,0.06)" />
    <Circle cx="70%" cy="75%" r="40" fill="rgba(124,58,237,0.04)" />
  </Svg>
);

const ReferralScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { userType, user, profile } = useApp();
  const currentUserId = String(user?.mongoId || profile?.mongoId || user?._id || profile?._id || '');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [history, setHistory] = useState([]);
  const [cycleInfo, setCycleInfo] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [codeRes, statsRes, lbRes, histRes, cycleRes] = await Promise.all([
        getMyReferralCode(), getMyStats(), getCycleLeaderboard(), getMyHistory(1, 5), getCycleInfo(),
      ]);
      if (codeRes.success) setReferralCode(codeRes.referralCode);
      if (statsRes.success) setStats(statsRes.stats);
      if (lbRes.success) { setLeaderboard(lbRes.leaderboard || []); setMyRank(lbRes.myRank); }
      if (histRes.success) setHistory(histRes.history || []);
      if (cycleRes.success) setCycleInfo(cycleRes.cycle);
      setLoadError(null);
    } catch (err) {
      console.error('[ReferralScreen] Load error:', err.message);
      setLoadError('Unable to load rewards data. Pull down to retry.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleCopyCode = () => {
    if (!referralCode) return;
    Clipboard.setString(referralCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message: `Join Fixhomi - India's home services app!\n\nUse my referral code ${referralCode} to get 50 bonus points when you sign up!\n\nDownload now: https://fixhomi.com/ref/${referralCode}`,
      });
    } catch {}
  };

  const getPointIcon = (type) => {
    switch (type) {
      case 'referral_bonus': return { name: 'account-plus', family: 'mci' };
      case 'referral_welcome': return { name: 'gift', family: 'feather' };
      case 'service_completion': return { name: 'checkmark-done-circle', family: 'ion' };
      case 'admin_adjustment': return { name: 'settings-outline', family: 'ion' };
      default: return { name: 'star', family: 'ion' };
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (loadError && !referralCode && !stats) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={COLORS.muted} />
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* ── Hero Card ── */}
        <View style={[styles.heroCard, SHADOWS]}>
          <HeroBackground />
          <View style={styles.heroContent}>
            <View style={styles.heroIconRow}>
              <View style={styles.heroIconCircle}>
                <MaterialIcons name="card-giftcard" size={28} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.heroTitle}>Invite Friends, Earn Rewards</Text>
            <Text style={styles.heroSub}>Share your code and both of you earn 50 points</Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{referralCode || '---'}</Text>
            </View>

            <View style={styles.codeActions}>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode} activeOpacity={0.8}>
                <Feather name={codeCopied ? 'check' : 'copy'} size={16} color="#FFF" />
                <Text style={styles.actionBtnText}>{codeCopied ? 'Copied!' : 'Copy Code'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
                <Feather name="share-2" size={16} color="#FFF" />
                <Text style={styles.actionBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, SHADOWS]}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(246,124,22,0.1)' }]}>
              <MaterialCommunityIcons name="star-four-points" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>{stats?.cyclePoints || 0}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={[styles.statCard, SHADOWS]}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(43,118,188,0.1)' }]}>
              <MaterialIcons name="leaderboard" size={20} color={COLORS.secondary} />
            </View>
            <Text style={styles.statValue}>{stats?.cycleRank ? `#${stats.cycleRank}` : '—'}</Text>
            <Text style={styles.statLabel}>Rank</Text>
          </View>
          <View style={[styles.statCard, SHADOWS]}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(124,58,237,0.1)' }]}>
              <MaterialCommunityIcons name="account-group" size={20} color={COLORS.accent} />
            </View>
            <Text style={styles.statValue}>{stats?.referralCount || 0}</Text>
            <Text style={styles.statLabel}>Referrals</Text>
          </View>
        </View>

        {/* ── Leaderboard ── */}
        <View style={[styles.section, SHADOWS]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="emoji-events" size={20} color={COLORS.gold} />
              <Text style={styles.sectionTitle}>Leaderboard</Text>
            </View>
            <Text style={styles.badge}>
              {userType === 'provider' ? 'Providers' : 'Users'}
            </Text>
          </View>

          {leaderboard.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="trophy-outline" size={36} color={COLORS.muted} style={{ opacity: 0.4 }} />
              <Text style={styles.emptyText}>No rankings yet. Be the first!</Text>
            </View>
          ) : (
            leaderboard.slice(0, 5).map((entry) => {
              const isMe = currentUserId && String(entry.userId) === currentUserId;
              return (
                <View key={entry.rank} style={[styles.leaderRow, isMe && styles.leaderRowMe]}>
                  <RankIcon rank={entry.rank} />
                  <Text style={[styles.leaderName, isMe && styles.leaderNameMe]} numberOfLines={1}>
                    {isMe ? 'You' : entry.displayName}
                  </Text>
                  <Text style={[styles.leaderPoints, isMe && { color: COLORS.secondary }]}>
                    {entry.totalPoints.toLocaleString()} pts
                  </Text>
                </View>
              );
            })
          )}

          {myRank?.rank && myRank.rank > 5 && (
            <>
              <View style={styles.leaderDivider}><Text style={styles.dotSep}>...</Text></View>
              <View style={[styles.leaderRow, styles.leaderRowMe]}>
                <RankIcon rank={myRank.rank} />
                <Text style={[styles.leaderName, styles.leaderNameMe]}>You</Text>
                <Text style={[styles.leaderPoints, { color: COLORS.secondary }]}>{myRank.totalPoints.toLocaleString()} pts</Text>
              </View>
            </>
          )}
        </View>

        {/* ── How It Works ── */}
        <View style={[styles.section, SHADOWS]}>
          <View style={styles.sectionTitleRow}>
            <Feather name="info" size={18} color={COLORS.secondary} />
            <Text style={styles.sectionTitle}>How It Works</Text>
          </View>
          <Step icon="share-2" iconFamily="feather" num="1" text="Share your referral code with friends" />
          <Step icon="person-add-outline" iconFamily="ion" num="2" text="They sign up using your code" />
          <Step icon="gift-outline" iconFamily="ion" num="3" text="Both of you earn 50 points" />
          <Step icon="checkmark-done-circle-outline" iconFamily="ion" num="4" text="Complete services to earn 250 points each" />
        </View>

        {/* ── Recent Activity ── */}
        {history.length > 0 && (
          <View style={[styles.section, SHADOWS]}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="history" size={18} color={COLORS.textSecondary} />
              <Text style={styles.sectionTitle}>Recent Activity</Text>
            </View>
            {history.map((entry, i) => {
              const pi = getPointIcon(entry.type);
              return (
                <View key={i} style={[styles.historyRow, i < history.length - 1 && styles.historyBorder]}>
                  <View style={styles.historyIconBg}>
                    {pi.family === 'mci' && <MaterialCommunityIcons name={pi.name} size={18} color={COLORS.secondary} />}
                    {pi.family === 'feather' && <Feather name={pi.name} size={18} color={COLORS.accent} />}
                    {pi.family === 'ion' && <Ionicons name={pi.name} size={18} color={COLORS.success} />}
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyDesc} numberOfLines={1}>{entry.description}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Text style={styles.historyPoints}>+{entry.points}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Cycle Progress ── */}
        {cycleInfo?.startDate && cycleInfo?.endDate && (
          <View style={[styles.section, SHADOWS]}>
            <View style={styles.sectionTitleRow}>
              <Feather name="calendar" size={18} color={COLORS.textSecondary} />
              <Text style={styles.sectionTitle}>Current Cycle</Text>
            </View>
            <Text style={styles.cycleDate}>
              {new Date(cycleInfo.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(cycleInfo.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min((cycleInfo.progress || 0) * 100, 100)}%` }]} />
            </View>
            <Text style={styles.cycleDays}>{cycleInfo.daysRemaining} days remaining</Text>
          </View>
        )}

        {/* ── Prizes ── */}
        <View style={[styles.section, SHADOWS]}>
          <View style={styles.sectionTitleRow}>
            <MaterialIcons name="emoji-events" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Cycle Prizes</Text>
          </View>
          <View style={styles.prizeRow}>
            <PrizeCard rank="1st" amount={'\u20B95,000'} color={COLORS.gold} iconColor="#B7791F" />
            <PrizeCard rank="2nd" amount={'\u20B93,000'} color={COLORS.silver} iconColor="#64748B" />
            <PrizeCard rank="3rd" amount={'\u20B91,000'} color={COLORS.bronze} iconColor="#92400E" />
          </View>
          <View style={styles.annualBanner}>
            <MaterialCommunityIcons name="party-popper" size={16} color={COLORS.primary} />
            <Text style={styles.annualText}>Exciting annual prizes for top performers!</Text>
          </View>
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────

const RankIcon = ({ rank }) => {
  if (rank <= 3) {
    const colors = { 1: COLORS.gold, 2: COLORS.silver, 3: COLORS.bronze };
    return (
      <View style={[styles.rankBadge, { backgroundColor: `${colors[rank]}18` }]}>
        <MaterialIcons name="emoji-events" size={16} color={colors[rank]} />
      </View>
    );
  }
  return (
    <View style={styles.rankNum}>
      <Text style={styles.rankNumText}>{rank}</Text>
    </View>
  );
};

const Step = ({ icon, iconFamily, num, text }) => (
  <View style={styles.howStep}>
    <View style={styles.howNum}>
      <Text style={styles.howNumText}>{num}</Text>
    </View>
    <Text style={styles.howText}>{text}</Text>
  </View>
);

const PrizeCard = ({ rank, amount, color, iconColor }) => (
  <View style={[styles.prizeCard, { borderColor: `${color}30` }]}>
    <View style={[styles.prizeIconBg, { backgroundColor: `${color}15` }]}>
      <MaterialIcons name="emoji-events" size={22} color={iconColor} />
    </View>
    <Text style={styles.prizeRank}>{rank}</Text>
    <Text style={styles.prizeAmount}>{amount}</Text>
  </View>
);

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, gap: 12 },
  errorText: { fontSize: 15, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 32, marginTop: 8 },
  retryBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 28, backgroundColor: COLORS.primary, borderRadius: 12 },
  retryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '700', color: COLORS.textPrimary },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Hero Card
  heroCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 16 },
  heroContent: { padding: 24, alignItems: 'center' },
  heroIconRow: { marginBottom: 12 },
  heroIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(246,124,22,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 4 },
  heroSub: { fontSize: 13, color: COLORS.muted, textAlign: 'center', marginBottom: 18 },
  codeBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', borderStyle: 'dashed',
    marginBottom: 18,
  },
  codeText: { fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: 5, textAlign: 'center' },
  codeActions: { flexDirection: 'row', gap: 10 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.secondary, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 20,
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 20,
  },
  actionBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.cardWhite, borderRadius: 16, padding: 14, alignItems: 'center' },
  statIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Section
  section: { backgroundColor: COLORS.cardWhite, borderRadius: 18, padding: 18, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 0 },
  badge: {
    fontSize: 11, fontWeight: '600', color: COLORS.secondary,
    backgroundColor: 'rgba(43,118,188,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, color: COLORS.muted },

  // Leaderboard
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12, marginBottom: 2 },
  leaderRowMe: { backgroundColor: 'rgba(43,118,188,0.05)' },
  rankBadge: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rankNum: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  rankNumText: { fontSize: 14, fontWeight: '700', color: COLORS.muted },
  leaderName: { flex: 1, fontSize: 14, color: COLORS.textPrimary, marginLeft: 10, fontWeight: '500' },
  leaderNameMe: { fontWeight: '700', color: COLORS.secondary },
  leaderPoints: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  leaderDivider: { alignItems: 'center', paddingVertical: 2 },
  dotSep: { fontSize: 18, color: COLORS.muted, letterSpacing: 6 },

  // How It Works
  howStep: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  howNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  howNumText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  howText: { flex: 1, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },

  // History
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  historyBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  historyIconBg: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.divider, justifyContent: 'center', alignItems: 'center',
  },
  historyInfo: { flex: 1, marginLeft: 12 },
  historyDesc: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  historyDate: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  historyPoints: { fontSize: 15, fontWeight: '800', color: COLORS.success },

  // Cycle
  cycleDate: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 10 },
  progressBar: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  cycleDays: { fontSize: 12, color: COLORS.muted, textAlign: 'right', fontWeight: '500' },

  // Prizes
  prizeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  prizeCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8,
    backgroundColor: COLORS.cardWhite, borderRadius: 14, borderWidth: 1,
  },
  prizeIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  prizeRank: { fontSize: 11, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  prizeAmount: { fontSize: 17, fontWeight: '900', color: COLORS.textPrimary, marginTop: 2 },
  annualBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(246,124,22,0.06)', borderRadius: 10, padding: 12, justifyContent: 'center',
  },
  annualText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
});

export default ReferralScreen;
