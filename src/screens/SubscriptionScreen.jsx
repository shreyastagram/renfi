/**
 * Subscription Screen
 *
 * Professional Tools management for service providers:
 * - View current subscription status
 * - Activate professional business tools
 * - View transaction history
 *
 * Platform-specific payment:
 * - Android: Razorpay in-app checkout (real-world service provider tools)
 * - iOS: Redirects to fixhomi.com for web-based payment
 *
 * Production-grade design
 * Matches Fixhomi brand (primary=#f67c16, secondary=#2b76bc)
 *
 * @version 3.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  Linking
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { Icon } from '../components';
import ScreenShimmer from '../components/ShimmerLoader';
import {
  getSubscriptionStatus,
  getPlans,
  subscribeToplan,
  getTransactions,
  resetPremium,
} from '../services/subscriptionService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// PREMIUM BADGE (Header)
// ============================================
const PremiumBadge = ({ isPremium, daysRemaining, t }) => {
  if (!isPremium) return <View style={{ width: 40 }} />;
  return (
    <View style={badgeStyles.wrap}>
      <MaterialIcon name="workspace-premium" size={14} color="#EA580C" />
      <Text style={badgeStyles.text}>{t('subscription.proBadge') || 'PRO'}</Text>
      {daysRemaining > 0 && (
        <Text style={badgeStyles.days}>{daysRemaining}d</Text>
      )}
    </View>
  );
};
// Tab-bar tinted-glass language: light orange wash, hairline rim, deep-orange text
const badgeStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(253,242,232,0.92)', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, gap: 4, borderWidth: 1, borderColor: 'rgba(246,124,22,0.35)' },
  text: { fontSize: 11, fontWeight: '800', color: '#EA580C', letterSpacing: 0.5 },
  days: { fontSize: 10, fontWeight: '700', color: '#C2410C' },
});

// ============================================
// ACTIVE STATUS CARD
// ============================================
const ActiveStatusCard = ({ subscription, onRenew, loading, t }) => {
  const daysRemaining = subscription?.daysRemaining || 0;
  const endDate = subscription?.currentPlan?.endDate;
  const isExpiringSoon = daysRemaining <= 5;

  return (
    <View style={activeStyles.card}>
      {/* Dark premium header */}
      <View style={activeStyles.header}>
        <View style={activeStyles.decoCircle1} />
        <View style={activeStyles.decoCircle2} />
        <View style={activeStyles.headerTop}>
          <View style={activeStyles.crownBg}>
            <MaterialIcon name="workspace-premium" size={28} color="#0F172A" />
          </View>
          <View style={activeStyles.statusPill}>
            <View style={activeStyles.statusDot} />
            <Text style={activeStyles.statusText}>{t('subscription.active')}</Text>
          </View>
        </View>
        <Text style={activeStyles.title}>{t('subscription.premiumPlan')}</Text>
        <Text style={activeStyles.subtitle}>
          {endDate
            ? t('subscription.validUntil', { date: new Date(endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) })
            : t('subscription.benefitsActive')}
        </Text>
      </View>

      {/* Stats strip */}
      <View style={activeStyles.statsRow}>
        <View style={activeStyles.statItem}>
          <Text style={activeStyles.statValue}>{daysRemaining}</Text>
          <Text style={activeStyles.statLabel}>{t('subscription.daysLeft')}</Text>
        </View>
        <View style={activeStyles.statDivider} />
        <View style={activeStyles.statItem}>
          <MaterialIcon name="trending-up" size={20} color="#16A34A" />
          <Text style={activeStyles.statLabel}>{t('subscription.priority')}</Text>
        </View>
        <View style={activeStyles.statDivider} />
        <View style={activeStyles.statItem}>
          <MaterialIcon name="visibility" size={20} color="#2b76bc" />
          <Text style={activeStyles.statLabel}>{t('subscription.boosted')}</Text>
        </View>
      </View>

      {/* Renew CTA if expiring soon */}
      {isExpiringSoon && (
        <TouchableOpacity style={activeStyles.renewBtn} onPress={onRenew} disabled={loading} accessibilityLabel="Renew subscription" accessibilityRole="button">
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcon name="autorenew" size={18} color="#FFFFFF" />
              <Text style={activeStyles.renewText}>{t('subscription.renewNow')}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};
const activeStyles = StyleSheet.create({
  card: { borderRadius: 22, backgroundColor: '#FFFFFF', overflow: 'hidden', marginBottom: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 6, borderWidth: 1, borderColor: '#F1F5F9' },
  header: { backgroundColor: '#0F172A', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 22, position: 'relative', overflow: 'hidden' },
  decoCircle1: { position: 'absolute', top: -25, right: -25, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,215,0,0.07)' },
  decoCircle2: { position: 'absolute', bottom: -35, left: -15, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(99,102,241,0.06)' },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  crownBg: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(22,163,74,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#4ADE80' },
  statusText: { fontSize: 12, fontWeight: '700', color: '#4ADE80', letterSpacing: 0.3 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 12 },
  statItem: { flex: 1, alignItems: 'center', gap: 5 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 11.5, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.2 },
  statDivider: { width: 1, height: 34, backgroundColor: '#E2E8F0' },
  renewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f67c16', marginHorizontal: 18, marginBottom: 18, paddingVertical: 14, borderRadius: 14, gap: 8, shadowColor: '#f67c16', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  renewText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

// ============================================
// PREMIUM HERO — 6-months-free welcome offer (3 states)
// state: 'A' before first approval · 'B' free bonus running · 'C' bonus over
// Deep navy plate, champagne-gold accents (accents only — never fills),
// per-state glow tint: A warm amber (the gift), C steel blue (the decision).
// ============================================
const GOLD = '#E8B54D';
const GOLD_SOFT = '#F2CE8A';
const NAVY = '#0D1220';
const NAVY2 = '#161D30';

const PremiumHero = ({ state, daysRemaining, priceDisplay, t }) => {
  const gradientProps = {
    A: { colors: ['#1A1F2E', NAVY], start: { x: 0.1, y: 0 }, end: { x: 0.6, y: 1 } },
    B: { colors: [NAVY2, NAVY], start: { x: 0.1, y: 0 }, end: { x: 0.6, y: 1 } },
    C: { colors: ['#131A2A', NAVY], start: { x: 0.1, y: 0 }, end: { x: 0.6, y: 1 } },
  }[state];
  const glow = { A: 'rgba(246,124,22,0.20)', B: 'rgba(232,181,77,0.16)', C: 'rgba(43,118,188,0.22)' }[state];
  const borderColor = state === 'C' ? 'rgba(43,118,188,0.38)' : 'rgba(232,181,77,0.30)';
  const eyebrowColor = state === 'C' ? '#8FBAE3' : GOLD_SOFT;

  return (
    <LinearGradient {...gradientProps} style={[heroStyles.card, { borderColor }]}>
      {/* corner glow — warm for the gift, cool for the decision */}
      <View style={[heroStyles.glow, { backgroundColor: glow }]} />
      {/* whisper-thin inner keyline */}
      <View pointerEvents="none" style={[heroStyles.keyline, state === 'C' && heroStyles.keylineBlue]} />

      <View style={heroStyles.crown}>
        <MaterialIcon name="workspace-premium" size={26} color={GOLD} />
      </View>
      <Text style={[heroStyles.eyebrow, { color: eyebrowColor }]}>{t(`subscription.heroEyebrow${state}`)}</Text>
      <Text style={heroStyles.title}>{t(`subscription.heroTitle${state}`)}</Text>
      <Text style={heroStyles.sub}>{t(`subscription.heroSub${state}`)}</Text>

      {/* price lockup — numerals + two-line label on one visual line */}
      <View style={heroStyles.priceBlock}>
        <View style={heroStyles.numGroup}>
          {state === 'A' && (
            <View style={heroStyles.strikeWrap}>
              <Text style={heroStyles.strikeText}>{priceDisplay}</Text>
              <View style={heroStyles.strikeLine} />
            </View>
          )}
          <Text style={[heroStyles.bigNum, state === 'C' && heroStyles.bigNumIvory]}>
            {state === 'A' ? '₹0' : state === 'B' ? String(daysRemaining) : priceDisplay}
          </Text>
        </View>
        <View style={heroStyles.perCol}>
          <Text style={heroStyles.perBold}>
            {state === 'B' ? t('subscription.freeDays') : t('subscription.perMonth')}
          </Text>
          <Text style={heroStyles.perLight}>
            {state === 'A' ? t('subscription.firstSixMonths') : state === 'B' ? t('subscription.remaining') : t('subscription.perPeriod')}
          </Text>
        </View>
      </View>

      <View style={heroStyles.thenLineWrap}>
        <Text style={heroStyles.thenLine}>
          {state === 'C' ? t('subscription.thenLineC') : t(`subscription.thenLine${state}`, { price: priceDisplay })}
        </Text>
      </View>

      {state === 'A' && (
        <View style={heroStyles.assureRow}>
          <MaterialIcon name="verified-user" size={14} color="#7FD8A5" />
          <Text style={heroStyles.assureText}>{t('subscription.noPaymentToday')}</Text>
        </View>
      )}
    </LinearGradient>
  );
};

const heroStyles = StyleSheet.create({
  card: { borderRadius: 26, padding: 24, marginBottom: 18, overflow: 'hidden', position: 'relative', borderWidth: 1 },
  glow: { position: 'absolute', top: -70, right: -50, width: 220, height: 220, borderRadius: 110 },
  keyline: { position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(232,181,77,0.14)' },
  keylineBlue: { borderColor: 'rgba(43,118,188,0.16)' },
  crown: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: 'rgba(232,181,77,0.12)', borderWidth: 1, borderColor: 'rgba(232,181,77,0.35)' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2.2, marginBottom: 8 },
  title: { fontSize: 23, fontWeight: '800', letterSpacing: -0.4, lineHeight: 29, color: '#FDFBF7' },
  sub: { fontSize: 13, color: '#B9C0CF', marginTop: 8, lineHeight: 20, fontWeight: '500' },
  priceBlock: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 22 },
  numGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  strikeWrap: { position: 'relative' },
  strikeText: { fontSize: 22, fontWeight: '700', color: '#6E7891' },
  strikeLine: { position: 'absolute', left: -3, right: -3, top: '46%', height: 2, backgroundColor: GOLD, borderRadius: 2, transform: [{ rotate: '-6deg' }] },
  bigNum: { fontSize: 54, fontWeight: '800', letterSpacing: -2, color: GOLD, lineHeight: 56 },
  bigNumIvory: { color: '#F4EFE6' },
  perCol: { flex: 1, minWidth: 0 },
  perBold: { fontSize: 14, fontWeight: '700', color: '#E7E2D6', lineHeight: 20 },
  perLight: { fontSize: 13, fontWeight: '600', color: '#B9C0CF', lineHeight: 19 },
  thenLineWrap: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  thenLine: { fontSize: 12.5, color: '#B9C0CF', fontWeight: '500', lineHeight: 20 },
  assureRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  assureText: { fontSize: 12, fontWeight: '700', color: '#7FD8A5' },
});

// ============================================
// PREMIUM JOURNEY — 3-step path to (and through) the free months
// Brand-orange light-tinted nodes; done steps are filled with a check.
// ============================================
const JourneyStep = ({ icon, done, title, tag, desc, last }) => (
  <View style={journeyStyles.step}>
    <View style={journeyStyles.nodeCol}>
      <View style={[journeyStyles.node, done && journeyStyles.nodeDone]}>
        <MaterialIcon name={done ? 'check' : icon} size={17} color={done ? '#FFFFFF' : '#EA580C'} />
      </View>
      {!last && <View style={journeyStyles.thread} />}
    </View>
    <View style={journeyStyles.stepText}>
      <View style={journeyStyles.titleRow}>
        <Text style={journeyStyles.stepTitle}>{title}</Text>
        {!!tag && (
          <View style={journeyStyles.tag}>
            <Text style={journeyStyles.tagText}>{tag}</Text>
          </View>
        )}
      </View>
      <Text style={journeyStyles.stepDesc}>{desc}</Text>
    </View>
  </View>
);

const PremiumJourney = ({ state, priceDisplay, t }) => (
  <View style={journeyStyles.card}>
    <Text style={journeyStyles.title}>{t('subscription.journeyTitle')}</Text>
    <JourneyStep done icon="check" title={t('subscription.j1Title')} desc={t('subscription.j1Desc')} />
    <JourneyStep
      done={state === 'B'}
      icon="card-giftcard"
      title={t('subscription.j2Title')}
      tag={t('subscription.j2Tag')}
      desc={t('subscription.j2Desc')}
    />
    <JourneyStep last icon="event" title={t('subscription.j3Title')} desc={t('subscription.j3Desc', { price: priceDisplay })} />
  </View>
);

const journeyStyles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)', padding: 20, paddingBottom: 6, marginBottom: 18 },
  title: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: '#C77D3A', marginBottom: 18 },
  step: { flexDirection: 'row', gap: 15 },
  nodeCol: { alignItems: 'center', width: 36 },
  node: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF5EC', borderWidth: 1, borderColor: 'rgba(234,88,12,0.28)' },
  nodeDone: { backgroundColor: '#f67c16', borderColor: '#EA580C' },
  thread: { width: 2, flex: 1, minHeight: 24, backgroundColor: 'rgba(234,88,12,0.18)' },
  stepText: { flex: 1, minWidth: 0, paddingTop: 6, paddingBottom: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stepTitle: { fontSize: 14.5, fontWeight: '700', color: '#0F172A', letterSpacing: -0.1 },
  tag: { backgroundColor: '#FFF5EC', borderWidth: 1, borderColor: 'rgba(234,88,12,0.25)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9 },
  tagText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: '#EA580C' },
  stepDesc: { fontSize: 12.5, color: '#64748B', lineHeight: 19, marginTop: 4 },
});

// ============================================
// PLAN CARD
// ============================================
const PlanCard = ({ plan, selected, onSelect, isCurrentPlan, launchOffer, t }) => (
  <TouchableOpacity
    style={[planStyles.card, selected && planStyles.selected, isCurrentPlan && planStyles.current]}
    onPress={() => onSelect(plan)}
    disabled={isCurrentPlan}
    activeOpacity={0.7}
    accessibilityLabel={`${plan.name} plan${selected ? ', selected' : ''}${isCurrentPlan ? ', current plan' : ''}`}
    accessibilityRole="radio"
    accessibilityState={{ selected, disabled: isCurrentPlan }}
  >
    {plan.id === 'premium_28' && (
      <View style={[planStyles.popularTag, launchOffer && planStyles.offerTag]}>
        <MaterialIcon name={launchOffer ? 'card-giftcard' : 'local-fire-department'} size={12} color={launchOffer ? '#F2CE8A' : '#FFFFFF'} />
        <Text style={[planStyles.popularText, launchOffer && planStyles.offerText]}>
          {launchOffer ? t('subscription.launchOffer') : t('subscription.popular')}
        </Text>
      </View>
    )}

    <View style={planStyles.top}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={planStyles.name}>{plan.name}</Text>
        <Text style={planStyles.desc}>{launchOffer ? t('subscription.planFreeSub') : plan.description}</Text>
      </View>
      <View style={planStyles.priceWrap}>
        {launchOffer ? (
          <>
            <Text style={planStyles.oldPrice}>{plan.priceDisplay}</Text>
            <Text style={planStyles.freePrice}>₹0</Text>
            <Text style={planStyles.duration}>{t('subscription.perMonth')}</Text>
          </>
        ) : (
          <>
            <Text style={[planStyles.price, selected && planStyles.priceSelected]}>{plan.priceDisplay}</Text>
            <Text style={planStyles.duration}>/{plan.durationDays}d</Text>
          </>
        )}
      </View>
    </View>

    <View style={planStyles.features}>
      {plan.features.map((f, i) => (
        <View key={i} style={planStyles.featureRow}>
          <MaterialIcon name="check-circle" size={16} color={selected ? '#2b76bc' : '#94A3B8'} />
          <Text style={[planStyles.featureText, selected && planStyles.featureTextSelected]}>{f}</Text>
        </View>
      ))}
    </View>

    {isCurrentPlan && (
      <View style={planStyles.currentBadge}>
        <MaterialIcon name="verified" size={14} color="#16A34A" />
        <Text style={planStyles.currentText}>{t('subscription.currentPlan')}</Text>
      </View>
    )}
  </TouchableOpacity>
);
const planStyles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 2, borderColor: '#E2E8F0', position: 'relative' },
  selected: { borderColor: '#2b76bc', backgroundColor: '#F8FBFF' },
  current: { opacity: 0.6 },
  popularTag: { position: 'absolute', top: 0, right: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f67c16', paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, gap: 4, zIndex: 2 },
  popularText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  offerTag: { backgroundColor: '#161D30', borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(232,181,77,0.4)' },
  offerText: { color: '#F2CE8A', letterSpacing: 1 },
  oldPrice: { fontSize: 14, fontWeight: '700', color: '#98A2B3', textDecorationLine: 'line-through', textDecorationColor: '#E8B54D' },
  freePrice: { fontSize: 27, fontWeight: '800', color: '#B98A2F', letterSpacing: -0.5 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  desc: { fontSize: 13, color: '#64748B', marginTop: 3, lineHeight: 18 },
  priceWrap: { alignItems: 'flex-end' },
  price: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  priceSelected: { color: '#2b76bc' },
  duration: { fontSize: 12, color: '#94A3B8', marginTop: -2 },
  features: { marginTop: 14, gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  featureTextSelected: { color: '#334155' },
  currentBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 14, backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5, borderWidth: 1, borderColor: '#BBF7D0' },
  currentText: { fontSize: 12, fontWeight: '600', color: '#16A34A' },
});

// ============================================
// TRANSACTION ITEM
// ============================================
const TransactionItem = ({ transaction, onPress }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'captured': return { color: '#16A34A', bg: '#F0FDF4', icon: 'check-circle' };
      case 'failed': return { color: '#DC2626', bg: '#FEF2F2', icon: 'cancel' };
      case 'refunded': return { color: '#EA580C', bg: '#FFF7ED', icon: 'undo' };
      default: return { color: '#D97706', bg: '#FFFBEB', icon: 'schedule' };
    }
  };
  const cfg = getStatusConfig(transaction.status);

  return (
    <TouchableOpacity style={txStyles.item} onPress={() => onPress(transaction)} activeOpacity={0.7}>
      <View style={[txStyles.iconWrap, { backgroundColor: cfg.bg }]}>
        <MaterialIcon name={cfg.icon} size={22} color={cfg.color} />
      </View>
      <View style={txStyles.info}>
        <Text style={txStyles.plan}>{transaction.planName}</Text>
        <Text style={txStyles.date}>
          {new Date(transaction.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </Text>
      </View>
      <View style={txStyles.right}>
        <Text style={txStyles.amount}>{transaction.amountDisplay}</Text>
        <View style={[txStyles.statusPill, { backgroundColor: cfg.bg }]}>
          <Text style={[txStyles.statusText, { color: cfg.color }]}>{transaction.statusDisplay}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};
const txStyles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  iconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  info: { flex: 1 },
  plan: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  date: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
});

// ============================================
// TRANSACTION DETAIL MODAL
// ============================================
const TransactionDetailModal = ({ visible, transaction, onClose, t }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(800)).current;
  const isDismissing = useRef(false);

  useEffect(() => {
    if (visible && transaction) {
      isDismissing.current = false;
      setModalVisible(true);
      sheetTranslateY.setValue(800);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 7, overshootClamping: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, transaction]);

  const animatedClose = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    Animated.parallel([
      Animated.spring(sheetTranslateY, { toValue: 800, useNativeDriver: true, tension: 50, friction: 7, overshootClamping: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      onClose();
    });
  }, [onClose]);

  if (!transaction) return null;

  const DetailRow = ({ label, value, valueStyle }) => (
    <View style={modalStyles.row}>
      <Text style={modalStyles.label}>{label}</Text>
      <Text style={[modalStyles.value, valueStyle]}>{value || t('subscription.na')}</Text>
    </View>
  );

  return (
    <Modal visible={modalVisible} animationType="none" transparent statusBarTranslucent onRequestClose={animatedClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 23, 42, 0.6)', opacity: overlayOpacity }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={animatedClose} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFillObject, { justifyContent: 'flex-end', transform: [{ translateY: sheetTranslateY }] }]}>
        <View style={modalStyles.content}>
          <View style={modalStyles.dragBar} />

          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{t('subscription.transactionDetails')}</Text>
            <TouchableOpacity style={modalStyles.closeBtn} onPress={animatedClose}>
              <MaterialIcon name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>
            <View style={modalStyles.amountSection}>
              <Text style={modalStyles.amountLabel}>{t('subscription.amountPaid')}</Text>
              <Text style={modalStyles.amountValue}>{transaction.amountDisplay}</Text>
              <View style={[modalStyles.statusBadge, {
                backgroundColor: transaction.status === 'captured' ? '#F0FDF4' : '#FEF2F2',
              }]}>
                <MaterialIcon
                  name={transaction.status === 'captured' ? 'check-circle' : 'error'}
                  size={16}
                  color={transaction.status === 'captured' ? '#16A34A' : '#DC2626'}
                />
                <Text style={[modalStyles.statusBadgeText, {
                  color: transaction.status === 'captured' ? '#16A34A' : '#DC2626',
                }]}>{transaction.statusDisplay}</Text>
              </View>
            </View>

            <View style={modalStyles.divider} />

            <DetailRow label={t('subscription.plan')} value={transaction.planName} />
            <DetailRow label={t('subscription.receiptNo')} value={transaction.receiptNumber} />
            <DetailRow label={t('subscription.orderId')} value={transaction.orderId} />
            {transaction.paymentId && (
              <DetailRow label={t('subscription.paymentId')} value={transaction.paymentId} />
            )}
            <DetailRow label={t('subscription.paymentMethod')} value={transaction.paymentMethodDisplay} />
            <DetailRow
              label={t('subscription.date')}
              value={new Date(transaction.createdAt).toLocaleString('en-IN')}
            />
            {transaction.subscriptionPeriod && (
              <DetailRow
                label={t('subscription.period')}
                value={`${new Date(transaction.subscriptionPeriod.startDate).toLocaleDateString('en-IN')} \u2192 ${new Date(transaction.subscriptionPeriod.endDate).toLocaleDateString('en-IN')}`}
              />
            )}
            {transaction.error && (
              <View style={modalStyles.errorBox}>
                <MaterialIcon name="error-outline" size={16} color="#DC2626" />
                <Text style={modalStyles.errorText}>{transaction.error}</Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={modalStyles.doneBtn} onPress={animatedClose}>
            <Text style={modalStyles.doneBtnText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
        </Animated.View>
      </View>
    </Modal>
  );
};
const modalStyles = StyleSheet.create({
  content: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '82%' },
  dragBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 22 },
  amountSection: { alignItems: 'center', paddingVertical: 16 },
  amountLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  amountValue: { fontSize: 36, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 10, gap: 5 },
  statusBadgeText: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  label: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  value: { fontSize: 14, color: '#0F172A', fontWeight: '600', textAlign: 'right', maxWidth: '60%' },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF2F2', padding: 14, borderRadius: 12, gap: 8, marginTop: 12, marginBottom: 8 },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626', lineHeight: 18 },
  doneBtn: { marginHorizontal: 22, marginTop: 8, marginBottom: Platform.OS === 'ios' ? 36 : 24, backgroundColor: '#F1F5F9', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
});

// ============================================
// MAIN SCREEN
// ============================================
const SubscriptionScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { userType, profile } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [statusLoadFailed, setStatusLoadFailed] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statusResult, plansResult, transactionsResult] = await Promise.all([
        getSubscriptionStatus(),
        getPlans(),
        getTransactions(1, 10),
      ]);

      // The service swallows network errors into {success:false}. Rendering
      // that as "not premium" would invite an active subscriber to pay again —
      // surface a retry state instead (unless we still have data from before).
      setStatusLoadFailed(!statusResult.success);
      if (statusResult.success) setSubscription(statusResult.subscription);
      if (plansResult.success) {
        // Filter out the first approval bonus — it's auto-granted, not a user-selectable plan
        const selectablePlans = plansResult.plans.filter(p => p.id !== 'first_approval_bonus');
        setPlans(selectablePlans);
        if (!statusResult.subscription?.isPremium && selectablePlans.length > 0) {
          setSelectedPlan(selectablePlans[0]);
        }
      }
      if (transactionsResult.success) setTransactions(transactionsResult.transactions);
    } catch (error) {
      console.error('[SubscriptionScreen] Load error:', error);
      dialog(t('common.error'), t('subscription.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSubscribe = useCallback(async () => {
    // Gate: Provider must have at least one approved service before subscribing
    if (!profile?.verifiedServiceCategories || profile.verifiedServiceCategories.length === 0) {
      dialog(
        t('subscription.approvedRequired'),
        t('subscription.approvedRequiredMsg'),
        [{ text: t('common.ok') }]
      );
      return;
    }

    if (!selectedPlan) {
      dialog(t('subscription.selectPlan'), t('subscription.selectPlanMsg'));
      return;
    }

    // ── iOS: Open web-based subscription page ──
    // Apple does not allow in-app Razorpay checkout for provider tools.
    // Users are redirected to fixhomi.com to complete payment securely.
    if (Platform.OS === 'ios') {
      handleWebSubscribe();
      return;
    }

    // ── Android: Use Razorpay in-app checkout ──
    setSubscribing(true);
    setSubscriptionStatus('');
    try {
      const result = await subscribeToplan(selectedPlan.id, (status) => {
        setSubscriptionStatus(status);
      });
      if (result.success) {
        dialog(
          t('subscription.welcomePremium'),
          result.message || t('subscription.welcomePremiumMsg'),
          [{ text: t('subscription.great'), onPress: () => loadData() }]
        );
      } else if (result.cancelled) {
        setSubscriptionStatus('');
      } else {
        dialog(
          t('subscription.paymentFailed'),
          result.error || t('subscription.paymentFailedMsg')
        );
      }
    } catch (error) {
      dialog(t('common.error'), t('common.somethingWentWrong'));
    } finally {
      setSubscribing(false);
      setSubscriptionStatus('');
    }
  }, [selectedPlan, loadData, profile]);

  /**
   * iOS: Open manage account page on fixhomi.com
   * The web page authenticates the provider via OTP, then shows
   * subscription management with Razorpay payment.
   * After payment, the provider returns to the app and pulls to refresh.
   */
  const handleWebSubscribe = useCallback(() => {
    const webUrl = 'https://fixhomi.com/manage-account';

    dialog(
      t('subscription.webSubscribeTitle'),
      t('subscription.webSubscribeMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('subscription.webSubscribeBtn'),
          onPress: () => {
            Linking.openURL(webUrl).catch(() => {
              dialog(t('common.error'), 'Unable to open the page. Please visit fixhomi.com in your browser.');
            });
          },
        },
      ]
    );
  }, [dialog, t]);

  const handleTransactionPress = useCallback((tx) => {
    setSelectedTransaction(tx);
    setShowTransactionModal(true);
  }, []);

  const handleResetPremium = useCallback(async () => {
    dialog(
      '\u26A0\uFE0F Reset Premium',
      'This will remove your premium status. Continue?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const result = await resetPremium();
              if (result.success) {
                dialog(t('common.success'), result.message || 'Premium reset');
                loadData();
              } else {
                dialog(t('common.error'), result.error || 'Failed to reset');
              }
            } catch (e) {
              dialog(t('common.error'), t('common.somethingWentWrong'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [loadData]);

  // Not a provider
  if (userType !== 'provider') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
            <MaterialIcon name="arrow-back-ios-new" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('subscription.premium')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <MaterialIcon name="lock-outline" size={56} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>{t('subscription.premiumOnly')}</Text>
          <Text style={styles.emptyDesc}>{t('subscription.premiumOnlySub')}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ScreenShimmer type="subscription" />
      </View>
    );
  }

  // Status fetch failed and we have nothing cached — showing the purchase UI
  // here would tell an active premium provider they're unsubscribed.
  if (statusLoadFailed && !subscription) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
            <MaterialIcon name="arrow-back-ios-new" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('subscription.premium')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <MaterialIcon name="cloud-off" size={56} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>{t('subscription.loadFailed')}</Text>
          <TouchableOpacity
            style={styles.subscribeBtn}
            onPress={() => { setLoading(true); setStatusLoadFailed(false); loadData(); }}
            accessibilityLabel={t('common.retry')}
            accessibilityRole="button"
          >
            <MaterialIcon name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.subscribeBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isPremium = subscription?.isPremium;
  const bonusActive = isPremium && subscription?.currentPlan?.planId === 'first_approval_bonus';
  // The ₹0 pitch (state A) needs the profile to confirm no approved service
  // yet. While the profile is still loading (or failed on a cold start) we
  // fall back to the paid pitch — never promise free months we can't verify.
  const bonusPitch = !isPremium && !!profile && !(profile?.verifiedServiceCategories?.length > 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
          <MaterialIcon name="arrow-back-ios-new" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('subscription.premium')}</Text>
        <PremiumBadge isPremium={isPremium} daysRemaining={subscription?.daysRemaining} t={t} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 6-months-free offer states ──
            A: no approved service yet → the gift pitch (routes to verification)
            B: first-approval bonus running → free-days status
            C: bonus over / paid flow → standard pricing
            Paid-active keeps the existing ActiveStatusCard. */}
        {(() => {
          const offerState = bonusActive ? 'B' : bonusPitch ? 'A' : 'C';
          const monthlyPrice = plans?.find((p) => p.id !== 'first_approval_bonus')?.priceDisplay || '₹299';

          if (isPremium && !bonusActive) {
            return <ActiveStatusCard subscription={subscription} onRenew={handleSubscribe} loading={subscribing} t={t} />;
          }
          // Profile unknown (still loading or fetch failed): state C's copy
          // claims "your 6 free months are complete", which we can't assert —
          // skip the hero and let the plans below carry honest standard pricing.
          if (!isPremium && !profile) {
            return null;
          }
          return (
            <>
              <PremiumHero state={offerState} daysRemaining={subscription?.daysRemaining || 0} priceDisplay={monthlyPrice} t={t} />
              {offerState !== 'C' && <PremiumJourney state={offerState} priceDisplay={monthlyPrice} t={t} />}
            </>
          );
        })()}

        {subscriptionStatus ? (
          <View style={styles.processingBar}>
            <ActivityIndicator size="small" color="#2b76bc" />
            <Text style={styles.processingText}>{subscriptionStatus}</Text>
          </View>
        ) : null}

        {(!isPremium || subscription?.daysRemaining <= 5) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('subscription.chooseYourPlan')}</Text>
            {plans.filter((p) => p.id !== 'first_approval_bonus').map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan?.id === plan.id}
                onSelect={setSelectedPlan}
                isCurrentPlan={subscription?.currentPlan?.planId === plan.id && isPremium}
                launchOffer={bonusPitch}
                t={t}
              />
            ))}

            {selectedPlan && (() => {
              // Before the first approval, the honest CTA routes to
              // verification — paying does nothing for them yet, the free
              // bonus is waiting behind document approval.
              if (bonusPitch) {
                return (
                  <>
                    <TouchableOpacity
                      style={styles.subscribeBtn}
                      onPress={() => navigation.navigate('DocumentVerification')}
                      accessibilityLabel={t('subscription.ctaGetVerified')}
                      accessibilityRole="button"
                    >
                      <MaterialIcon name="verified" size={20} color="#FFFFFF" />
                      <Text style={styles.subscribeBtnText}>{t('subscription.ctaGetVerified')}</Text>
                    </TouchableOpacity>
                    <Text style={styles.webPaymentNote}>{t('subscription.ctaGetVerifiedSub')}</Text>
                  </>
                );
              }
              return (
                <>
                  <TouchableOpacity
                    style={[styles.subscribeBtn, subscribing && styles.subscribeBtnDisabled]}
                    onPress={handleSubscribe}
                    disabled={subscribing}
                    accessibilityLabel={t('subscription.ctaContinue', { price: selectedPlan.priceDisplay })}
                    accessibilityRole="button"
                  >
                    {subscribing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialIcon name="bolt" size={20} color="#FFFFFF" />
                        <Text style={styles.subscribeBtnText}>{t('subscription.ctaContinue', { price: selectedPlan.priceDisplay })}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.webPaymentNote}>{t('subscription.ctaContinueSub')}</Text>
                </>
              );
            })()}

            {/* iOS: web payment note — only under a payment CTA, never the
                state-A verification CTA ("no payment details needed today") */}
            {Platform.OS === 'ios' && selectedPlan && !bonusPitch && (
              <Text style={styles.webPaymentNote}>
                {t('subscription.webSubscribeNote')}
              </Text>
            )}
          </View>
        )}

        {subscription?.stats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('subscription.yourStats')}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{subscription.stats.totalSubscriptions}</Text>
                <Text style={styles.statDesc}>{t('subscription.subscriptions')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{subscription.stats.totalSpentDisplay}</Text>
                <Text style={styles.statDesc}>{t('subscription.totalSpent')}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('subscription.transactionHistory')}</Text>
          <View style={styles.sectionCard}>
            {transactions.length === 0 ? (
              <View style={styles.emptyTx}>
                <MaterialIcon name="receipt-long" size={44} color="#E2E8F0" />
                <Text style={styles.emptyTxTitle}>{t('subscription.noTransactions')}</Text>
                <Text style={styles.emptyTxDesc}>{t('subscription.noTransactionsSub')}</Text>
              </View>
            ) : (
              transactions.map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} onPress={handleTransactionPress} />
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('subscription.premiumBenefits')}</Text>
          <View style={styles.sectionCard}>
            {[
              { icon: 'trending-up', titleKey: 'subscription.priorityListing', descKey: 'subscription.priorityListingSub', color: '#16A34A', bg: '#F0FDF4' },
              { icon: 'workspace-premium', titleKey: 'subscription.premiumBadge', descKey: 'subscription.premiumBadgeSub', color: '#D97706', bg: '#FFFBEB' },
              { icon: 'location-on', titleKey: 'subscription.extendedReach', descKey: 'subscription.extendedReachSub', color: '#2b76bc', bg: '#EFF6FF' },
              { icon: 'analytics', titleKey: 'subscription.analytics', descKey: 'subscription.analyticsSub', color: '#7C3AED', bg: '#F5F3FF' },
              { icon: 'support-agent', titleKey: 'subscription.prioritySupport', descKey: 'subscription.prioritySupportSub', color: '#0EA5E9', bg: '#F0F9FF' },
            ].map((b, i) => (
              <View key={i} style={[styles.benefitRow, i === 4 && { borderBottomWidth: 0 }]}>
                <View style={[styles.benefitIcon, { backgroundColor: b.bg }]}>
                  <MaterialIcon name={b.icon} size={22} color={b.color} />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>{t(b.titleKey)}</Text>
                  <Text style={styles.benefitDesc}>{t(b.descKey)}</Text>
                </View>
                <MaterialIcon name="check" size={18} color="#16A34A" />
              </View>
            ))}
          </View>
        </View>

        {__DEV__ && isPremium && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>{'\uD83D\uDD27'} Developer</Text>
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetPremium}>
              <MaterialIcon name="refresh" size={18} color="#EF4444" />
              <Text style={styles.resetBtnText}>Reset Premium (Dev)</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <TransactionDetailModal
        visible={showTransactionModal}
        transaction={selectedTransaction}
        onClose={() => { setShowTransactionModal(false); setSelectedTransaction(null); }}
        t={t}
      />
    </View>
  );
};

// ============================================
// MAIN STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  processingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  processingText: {
    fontSize: 14,
    color: '#2b76bc',
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f67c16',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
    gap: 8,
    shadowColor: '#f67c16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  subscribeBtnDisabled: {
    opacity: 0.7,
  },
  webPaymentNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
  subscribeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  statDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },
  emptyTx: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTxTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 12,
  },
  emptyTxDesc: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 14,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  benefitDesc: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});

export default SubscriptionScreen;
