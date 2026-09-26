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
import {
  useTheme,
  useThemedStyles,
  useThemeColors,
  premium,
} from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const makeC = (c) => ({
  primary: c.brandOrange,
  secondary: c.brandBlue,
  onPrimary: c.onBrandOrange,
  white: c.surface,
  bg: c.bg,
  // Two neutral hairline weights, kept apart because this screen uses both: the
  // shipped #F1F5F9 divider and the fainter #F8FAFC row seam. Each matches its
  // light value exactly and reads as a recessed step on a dark surface.
  hairline: c.bg,
  seam: c.surfaceSunken,
  line: c.border,
  borderMedium: c.borderMedium,
  borderMediumNeutral: c.borderMediumNeutral,
  text: c.textPrimary,
  textBody: c.textBody,
  textSecondary: c.textSecondary,
  muted: c.textMuted,
  info: c.info,
  blueBg: c.infoContainer,
  blueLine: c.infoBorder,
  infoFill: c.infoFill,
  success: c.success,
  successBg: c.successContainer,
  successLine: c.successBorder,
  successFill: c.successFill,
  danger: c.danger,
  dangerBg: c.dangerContainer,
  dangerLine: c.dangerBorder,
  dangerFill: c.dangerFill,
  warning: c.warning,
  warningBg: c.warningContainer,
  warningLine: c.warningBorder,
  warningFill: c.warningFill,
  purple: c.accentViolet,
  purpleFill: c.accentVioletFill,
  overlay: c.overlay,
  shadow: c.shadow,
});

// ============================================
// PREMIUM BADGE (Header)
// ============================================
const PremiumBadge = ({ isPremium, daysRemaining, t }) => {
  const badgeStyles = useThemedStyles(makeBadgeStyles);
  const C = makeC(useThemeColors());
  if (!isPremium) return <View style={{ width: 40 }} />;
  return (
    <View style={badgeStyles.wrap}>
      <MaterialIcon name="workspace-premium" size={14} color={C.warning} />
      <Text style={badgeStyles.text}>{t('subscription.proBadge') || 'PRO'}</Text>
      {daysRemaining > 0 && (
        <Text style={badgeStyles.days}>{daysRemaining}d</Text>
      )}
    </View>
  );
};
// Tab-bar tinted-glass language: light orange wash, hairline rim, deep-orange text
const makeBadgeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.warningBg, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, gap: 4, borderWidth: 1, borderColor: C.warningLine },
  text: { fontSize: 11, fontWeight: '800', color: C.warning, letterSpacing: 0.5 },
  days: { fontSize: 10, fontWeight: '700', color: C.warning },
  });
};

// ============================================
// ACTIVE STATUS CARD
// ============================================
const ActiveStatusCard = ({ subscription, onRenew, loading, t }) => {
  const activeStyles = useThemedStyles(makeActiveStyles);
  const C = makeC(useThemeColors());
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
            <MaterialIcon name="workspace-premium" size={28} color={C.onPrimary} />
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
          <MaterialIcon name="trending-up" size={20} color={C.success} />
          <Text style={activeStyles.statLabel}>{t('subscription.priority')}</Text>
        </View>
        <View style={activeStyles.statDivider} />
        <View style={activeStyles.statItem}>
          <MaterialIcon name="visibility" size={20} color={C.secondary} />
          <Text style={activeStyles.statLabel}>{t('subscription.boosted')}</Text>
        </View>
      </View>

      {/* Renew CTA if expiring soon */}
      {isExpiringSoon && (
        <TouchableOpacity style={activeStyles.renewBtn} onPress={onRenew} disabled={loading} accessibilityLabel="Renew subscription" accessibilityRole="button">
          {loading ? (
            <ActivityIndicator size="small" color={C.onPrimary} />
          ) : (
            <>
              <MaterialIcon name="autorenew" size={18} color={C.onPrimary} />
              <Text style={activeStyles.renewText}>{t('subscription.renewNow')}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};
const makeActiveStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  card: { borderRadius: 22, backgroundColor: C.white, overflow: 'hidden', marginBottom: 20, shadowColor: C.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 6, borderWidth: 1, borderColor: C.hairline },
  header: { backgroundColor: premium.slateHeader, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 22, position: 'relative', overflow: 'hidden' },
  decoCircle1: { position: 'absolute', top: -25, right: -25, width: 100, height: 100, borderRadius: 50, backgroundColor: premium.decoGold },
  decoCircle2: { position: 'absolute', bottom: -35, left: -15, width: 80, height: 80, borderRadius: 40, backgroundColor: premium.decoIndigo },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  crownBg: { width: 50, height: 50, borderRadius: 16, backgroundColor: premium.crown, alignItems: 'center', justifyContent: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: premium.statusFill, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: premium.statusDot },
  statusText: { fontSize: 12, fontWeight: '700', color: premium.statusDot, letterSpacing: 0.3 },
  title: { fontSize: 24, fontWeight: '800', color: premium.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: premium.inkMuted, marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 12 },
  statItem: { flex: 1, alignItems: 'center', gap: 5 },
  statValue: { fontSize: 28, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 11.5, fontWeight: '600', color: C.muted, letterSpacing: 0.2 },
  statDivider: { width: 1, height: 34, backgroundColor: C.line },
  renewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, marginHorizontal: 18, marginBottom: 18, paddingVertical: 14, borderRadius: 14, gap: 8, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  renewText: { fontSize: 15, fontWeight: '700', color: C.onPrimary },
  });
};

// ============================================
// PREMIUM HERO — 2-months-free welcome offer (3 states)
// state: 'A' before first approval · 'B' free bonus running · 'C' bonus over
// Deep navy plate, champagne-gold accents (accents only — never fills),
// per-state glow tint: A warm amber (the gift), C steel blue (the decision).
// ============================================
const GOLD = premium.gold;
const GOLD_SOFT = premium.goldSoft;
const NAVY = premium.navy;
const NAVY2 = premium.navyLift;

const PremiumHero = ({ state, daysRemaining, priceDisplay, t }) => {
  const gradientProps = {
    A: { colors: [premium.navyGradA, NAVY], start: { x: 0.1, y: 0 }, end: { x: 0.6, y: 1 } },
    B: { colors: [NAVY2, NAVY], start: { x: 0.1, y: 0 }, end: { x: 0.6, y: 1 } },
    C: { colors: [premium.navyGradC, NAVY], start: { x: 0.1, y: 0 }, end: { x: 0.6, y: 1 } },
  }[state];
  const glow = { A: premium.glowOrange, B: premium.glowGold, C: premium.glowBlue }[state];
  const borderColor = state === 'C' ? premium.borderBlue : premium.borderGold;
  const eyebrowColor = state === 'C' ? premium.inkBlue : GOLD_SOFT;

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
            <Text style={heroStyles.strikeText}>{priceDisplay}</Text>
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
          <MaterialIcon name="verified-user" size={14} color={premium.assure} />
          <Text style={heroStyles.assureText}>{t('subscription.noPaymentToday')}</Text>
        </View>
      )}
    </LinearGradient>
  );
};

// Not a themed factory: every value here comes from the theme-independent
// `premium` group, because this hero is dark in both themes.
const heroStyles = StyleSheet.create({
  card: { borderRadius: 26, padding: 24, marginBottom: 18, overflow: 'hidden', position: 'relative', borderWidth: 1 },
  glow: { position: 'absolute', top: -70, right: -50, width: 220, height: 220, borderRadius: 110 },
  keyline: { position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderRadius: 20, borderWidth: 1, borderColor: premium.keyline },
  keylineBlue: { borderColor: premium.keylineBlue },
  crown: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: premium.crownFill, borderWidth: 1, borderColor: premium.crownLine },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2.2, marginBottom: 8 },
  title: { fontSize: 23, fontWeight: '800', letterSpacing: -0.4, lineHeight: 29, color: premium.ink },
  sub: { fontSize: 13, color: premium.inkMuted, marginTop: 8, lineHeight: 20, fontWeight: '500' },
  priceBlock: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 22 },
  numGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  // Native strikethrough — the OS draws the line through the actual glyphs on
  // both iOS and Android (an absolutely-positioned line drifted off the digits
  // depending on font/locale). Same approach the plan card's oldPrice uses.
  strikeText: {
    fontSize: 22, fontWeight: '700', color: premium.inkFaint,
    textDecorationLine: 'line-through', textDecorationColor: GOLD,
  },
  bigNum: { fontSize: 54, fontWeight: '800', letterSpacing: -2, color: GOLD, lineHeight: 56 },
  bigNumIvory: { color: premium.inkIvory },
  perCol: { flex: 1, minWidth: 0 },
  perBold: { fontSize: 14, fontWeight: '700', color: premium.inkPer, lineHeight: 20 },
  perLight: { fontSize: 13, fontWeight: '600', color: premium.inkMuted, lineHeight: 19 },
  thenLineWrap: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: premium.divider },
  thenLine: { fontSize: 12.5, color: premium.inkMuted, fontWeight: '500', lineHeight: 20 },
  assureRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  assureText: { fontSize: 12, fontWeight: '700', color: premium.assure },
});

// ============================================
// PREMIUM JOURNEY — 3-step path to (and through) the free months
// Brand-orange light-tinted nodes; done steps are filled with a check.
// ============================================
const JourneyStep = ({ icon, done, title, tag, desc, last }) => {
  const journeyStyles = useThemedStyles(makeJourneyStyles);
  const C = makeC(useThemeColors());
  return (
    <View style={journeyStyles.step}>
      <View style={journeyStyles.nodeCol}>
        <View style={[journeyStyles.node, done && journeyStyles.nodeDone]}>
          <MaterialIcon name={done ? 'check' : icon} size={17} color={done ? C.onPrimary : C.warning} />
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
};

const PremiumJourney = ({ state, priceDisplay, t }) => {
  const journeyStyles = useThemedStyles(makeJourneyStyles);
  return (
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
};

const makeJourneyStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 20, paddingBottom: 6, marginBottom: 18 },
  title: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: C.warning, marginBottom: 18 },
  step: { flexDirection: 'row', gap: 15 },
  nodeCol: { alignItems: 'center', width: 36 },
  node: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.warningBg, borderWidth: 1, borderColor: C.warningLine },
  nodeDone: { backgroundColor: C.primary, borderColor: C.warning },
  thread: { width: 2, flex: 1, minHeight: 24, backgroundColor: C.warningLine },
  stepText: { flex: 1, minWidth: 0, paddingTop: 6, paddingBottom: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stepTitle: { fontSize: 14.5, fontWeight: '700', color: C.text, letterSpacing: -0.1 },
  tag: { backgroundColor: C.warningFill, borderWidth: 1, borderColor: C.warningLine, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9 },
  tagText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: C.warning },
  stepDesc: { fontSize: 12.5, color: C.textSecondary, lineHeight: 19, marginTop: 4 },
  });
};

// ============================================
// PLAN CARD
// ============================================
const PlanCard = ({ plan, selected, onSelect, isCurrentPlan, launchOffer, t }) => {
  const planStyles = useThemedStyles(makePlanStyles);
  const C = makeC(useThemeColors());
  return (
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
          <MaterialIcon name={launchOffer ? 'card-giftcard' : 'local-fire-department'} size={12} color={launchOffer ? premium.goldSoft : C.onPrimary} />
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
            <MaterialIcon name="check-circle" size={16} color={selected ? C.secondary : C.muted} />
            <Text style={[planStyles.featureText, selected && planStyles.featureTextSelected]}>{f}</Text>
          </View>
        ))}
      </View>

      {isCurrentPlan && (
        <View style={planStyles.currentBadge}>
          <MaterialIcon name="verified" size={14} color={C.success} />
          <Text style={planStyles.currentText}>{t('subscription.currentPlan')}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
const makePlanStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 2, borderColor: C.line, position: 'relative' },
  selected: { borderColor: C.secondary, backgroundColor: C.blueBg },
  current: { opacity: 0.6 },
  popularTag: { position: 'absolute', top: 0, right: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, gap: 4, zIndex: 2 },
  popularText: { fontSize: 10, fontWeight: '800', color: C.onPrimary, letterSpacing: 0.5 },
  offerTag: { backgroundColor: premium.navyLift, borderWidth: 1, borderTopWidth: 0, borderColor: premium.offerLine },
  offerText: { color: premium.goldSoft, letterSpacing: 1 },
  oldPrice: { fontSize: 14, fontWeight: '700', color: C.muted, textDecorationLine: 'line-through', textDecorationColor: premium.gold },
  freePrice: { fontSize: 27, fontWeight: '800', color: premium.goldInk, letterSpacing: -0.5 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { fontSize: 18, fontWeight: '700', color: C.text },
  desc: { fontSize: 13, color: C.textSecondary, marginTop: 3, lineHeight: 18 },
  priceWrap: { alignItems: 'flex-end' },
  price: { fontSize: 26, fontWeight: '800', color: C.text },
  priceSelected: { color: C.info },
  duration: { fontSize: 12, color: C.muted, marginTop: -2 },
  features: { marginTop: 14, gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
  featureTextSelected: { color: C.textBody },
  currentBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 14, backgroundColor: C.successBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5, borderWidth: 1, borderColor: C.successLine },
  currentText: { fontSize: 12, fontWeight: '600', color: C.success },
  });
};

// ============================================
// TRANSACTION ITEM
// ============================================
const TransactionItem = ({ transaction, onPress }) => {
  const txStyles = useThemedStyles(makeTxStyles);
  const C = makeC(useThemeColors());
  const getStatusConfig = (status) => {
    switch (status) {
      case 'captured': return { color: C.success, bg: C.successFill, icon: 'check-circle' };
      case 'failed': return { color: C.danger, bg: C.dangerFill, icon: 'cancel' };
      case 'refunded': return { color: C.warning, bg: C.warningFill, icon: 'undo' };
      default: return { color: C.warning, bg: C.warningBg, icon: 'schedule' };
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
const makeTxStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.hairline },
  iconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  info: { flex: 1 },
  plan: { fontSize: 15, fontWeight: '600', color: C.text },
  date: { fontSize: 12, color: C.muted, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '700', color: C.text },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  });
};

// ============================================
// TRANSACTION DETAIL MODAL
// ============================================
const TransactionDetailModal = ({ visible, transaction, onClose, t }) => {
  const modalStyles = useThemedStyles(makeModalStyles);
  const C = makeC(useThemeColors());
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
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.overlay, opacity: overlayOpacity }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={animatedClose} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFillObject, { justifyContent: 'flex-end', transform: [{ translateY: sheetTranslateY }] }]}>
        <View style={modalStyles.content}>
          <View style={modalStyles.dragBar} />

          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{t('subscription.transactionDetails')}</Text>
            <TouchableOpacity style={modalStyles.closeBtn} onPress={animatedClose}>
              <MaterialIcon name="close" size={20} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>
            <View style={modalStyles.amountSection}>
              <Text style={modalStyles.amountLabel}>{t('subscription.amountPaid')}</Text>
              <Text style={modalStyles.amountValue}>{transaction.amountDisplay}</Text>
              <View style={[modalStyles.statusBadge, {
                backgroundColor: transaction.status === 'captured' ? C.successFill : C.dangerFill,
              }]}>
                <MaterialIcon
                  name={transaction.status === 'captured' ? 'check-circle' : 'error'}
                  size={16}
                  color={transaction.status === 'captured' ? C.success : C.danger}
                />
                <Text style={[modalStyles.statusBadgeText, {
                  color: transaction.status === 'captured' ? C.success : C.danger,
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
                <MaterialIcon name="error-outline" size={16} color={C.danger} />
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
const makeModalStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  content: { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '82%' },
  dragBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderMediumNeutral, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.hairline, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 22 },
  amountSection: { alignItems: 'center', paddingVertical: 16 },
  amountLabel: { fontSize: 12, color: C.muted, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  amountValue: { fontSize: 36, fontWeight: '800', color: C.text, marginTop: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 10, gap: 5 },
  statusBadgeText: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.hairline, marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.seam },
  label: { fontSize: 13, color: C.muted, fontWeight: '600' },
  value: { fontSize: 14, color: C.text, fontWeight: '600', textAlign: 'right', maxWidth: '60%' },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.dangerBg, padding: 14, borderRadius: 12, gap: 8, marginTop: 12, marginBottom: 8 },
  errorText: { flex: 1, fontSize: 13, color: C.danger, lineHeight: 18 },
  doneBtn: { marginHorizontal: 22, marginTop: 8, marginBottom: Platform.OS === 'ios' ? 36 : 24, backgroundColor: C.hairline, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: C.text },
  });
};

// ============================================
// MAIN SCREEN
// ============================================
const SubscriptionScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
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
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
            <MaterialIcon name="arrow-back-ios-new" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('subscription.premium')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <MaterialIcon name="lock-outline" size={56} color={C.borderMedium} />
          <Text style={styles.emptyTitle}>{t('subscription.premiumOnly')}</Text>
          <Text style={styles.emptyDesc}>{t('subscription.premiumOnlySub')}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
        <ScreenShimmer type="subscription" />
      </View>
    );
  }

  // Status fetch failed and we have nothing cached — showing the purchase UI
  // here would tell an active premium provider they're unsubscribed.
  if (statusLoadFailed && !subscription) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
            <MaterialIcon name="arrow-back-ios-new" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('subscription.premium')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <MaterialIcon name="cloud-off" size={56} color={C.borderMedium} />
          <Text style={styles.emptyTitle}>{t('subscription.loadFailed')}</Text>
          <TouchableOpacity
            style={styles.subscribeBtn}
            onPress={() => { setLoading(true); setStatusLoadFailed(false); loadData(); }}
            accessibilityLabel={t('common.retry')}
            accessibilityRole="button"
          >
            <MaterialIcon name="refresh" size={20} color={C.onPrimary} />
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
      <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
          <MaterialIcon name="arrow-back-ios-new" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('subscription.premium')}</Text>
        <PremiumBadge isPremium={isPremium} daysRemaining={subscription?.daysRemaining} t={t} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 2-months-free offer states ──
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
          // claims "your 2 free months are complete", which we can't assert —
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
            <ActivityIndicator size="small" color={C.secondary} />
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
                      <MaterialIcon name="verified" size={20} color={C.onPrimary} />
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
                      <ActivityIndicator size="small" color={C.onPrimary} />
                    ) : (
                      <>
                        <MaterialIcon name="bolt" size={20} color={C.onPrimary} />
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
                <MaterialIcon name="receipt-long" size={44} color={C.line} />
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
              { icon: 'trending-up', titleKey: 'subscription.priorityListing', descKey: 'subscription.priorityListingSub', color: C.success, bg: C.successFill },
              { icon: 'workspace-premium', titleKey: 'subscription.premiumBadge', descKey: 'subscription.premiumBadgeSub', color: C.warning, bg: C.warningFill },
              { icon: 'location-on', titleKey: 'subscription.extendedReach', descKey: 'subscription.extendedReachSub', color: C.info, bg: C.infoFill },
              { icon: 'analytics', titleKey: 'subscription.analytics', descKey: 'subscription.analyticsSub', color: C.purple, bg: C.purpleFill },
              { icon: 'support-agent', titleKey: 'subscription.prioritySupport', descKey: 'subscription.prioritySupportSub', color: C.info, bg: C.infoFill },
            ].map((b, i) => (
              <View key={i} style={[styles.benefitRow, i === 4 && { borderBottomWidth: 0 }]}>
                <View style={[styles.benefitIcon, { backgroundColor: b.bg }]}>
                  <MaterialIcon name={b.icon} size={22} color={b.color} />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>{t(b.titleKey)}</Text>
                  <Text style={styles.benefitDesc}>{t(b.descKey)}</Text>
                </View>
                <MaterialIcon name="check" size={18} color={C.success} />
              </View>
            ))}
          </View>
        </View>

        {__DEV__ && isPremium && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: C.danger }]}>{'\uD83D\uDD27'} Developer</Text>
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetPremium}>
              <MaterialIcon name="refresh" size={18} color={C.danger} />
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
const makeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: C.muted,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: C.text,
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
    backgroundColor: C.blueBg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: C.blueLine,
  },
  processingText: {
    fontSize: 14,
    color: C.info,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.muted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
    gap: 8,
    shadowColor: C.primary,
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
    color: C.muted,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
  subscribeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.onPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: C.text,
  },
  statDesc: {
    fontSize: 12,
    color: C.muted,
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
    color: C.muted,
    marginTop: 12,
  },
  emptyTxDesc: {
    fontSize: 13,
    color: C.muted,
    marginTop: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.seam,
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
    color: C.text,
  },
  benefitDesc: {
    fontSize: 12.5,
    color: C.muted,
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
    color: C.textSecondary,
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: C.dangerBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.dangerLine,
    gap: 8,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.danger,
  },
  });
};

export default SubscriptionScreen;
