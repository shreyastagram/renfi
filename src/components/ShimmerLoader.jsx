/**
 * ShimmerLoader - Amazon-style Skeleton Loader with Shimmer Wave Effect
 *
 * Provides a smooth right-to-left shimmer sweep animation over skeleton placeholders.
 * No external dependencies — uses React Native Animated API only.
 *
 * Components:
 * - Shimmer: Base shimmer wave effect wrapper
 * - ShimmerBlock: Rectangle/circle skeleton element
 * - ShimmerLine: Text line placeholder
 * - ShimmerAvatar: Circular avatar placeholder
 *
 * Pre-built Screen Skeletons:
 * - CardListSkeleton: Service history, job list screens
 * - ProfileSkeleton: Profile/home screen
 * - DetailSkeleton: Service request detail screen
 * - StepsSkeleton: Verification dashboard steps
 * - SubscriptionSkeleton: Premium/subscription screen
 * - SecuritySkeleton: Account security screen
 * - GridSkeleton: Stats grid (provider home)
 *
 * @version 1.0.0
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Shimmer colors
const SHIMMER = {
  base: '#E2E8F0',
  highlight: '#F8FAFC',
  dark: '#CBD5E1',
};

// ============================================
// CORE: Shimmer Wave Animation
// ============================================

/**
 * Single shared animation driver for all shimmer blocks on a screen.
 * Avoids dozens of independent Animated.loops.
 */
const useShimmerAnimation = (active = true) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // `active` gate: callers (ProviderHomeScreen) pass a loading flag so the
    // sweep stops when nothing is loading. The parameter was previously
    // ignored, so the loop ran for the entire session on every screen — a
    // constant GPU cost on weak devices (Redmi 12 class).
    if (!active) {
      animValue.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [animValue, active]);

  return animValue;
};

/**
 * ShimmerBlock — A single skeleton placeholder with shimmer sweep.
 *
 * @param {number|string} width - Block width
 * @param {number} height - Block height
 * @param {number} borderRadius - Corner radius (default 8)
 * @param {object} style - Extra styles
 * @param {Animated.Value} shimmerAnim - Shared animation value (from useShimmerAnimation)
 */
const ShimmerBlock = ({ width, height, borderRadius = 8, style, shimmerAnim }) => {
  const blockWidth = typeof width === 'number' ? width : SCREEN_WIDTH;

  const translateX = shimmerAnim
    ? shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-blockWidth, blockWidth],
      })
    : new Animated.Value(0);

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: SHIMMER.base,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {shimmerAnim && (
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            transform: [{ translateX }],
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
            }}
          >
            <View style={{ flex: 1 }} />
            <View
              style={{
                width: blockWidth * 0.5,
                backgroundColor: SHIMMER.highlight,
                opacity: 0.6,
              }}
            />
            <View style={{ flex: 1 }} />
          </View>
        </Animated.View>
      )}
    </View>
  );
};

/**
 * ShimmerLine — Text line placeholder
 */
const ShimmerLine = ({ width = '100%', height = 12, style, shimmerAnim }) => (
  <ShimmerBlock
    width={width}
    height={height}
    borderRadius={6}
    style={style}
    shimmerAnim={shimmerAnim}
  />
);

/**
 * ShimmerAvatar — Circular avatar placeholder
 */
const ShimmerAvatar = ({ size = 48, style, shimmerAnim }) => (
  <ShimmerBlock
    width={size}
    height={size}
    borderRadius={size / 2}
    style={style}
    shimmerAnim={shimmerAnim}
  />
);

// ============================================
// CARD PRIMITIVES
// ============================================

const ShimmerCard = ({ children, style, noPadding }) => (
  <View style={[s.card, noPadding && { padding: 0 }, style]}>
    {children}
  </View>
);

const ShimmerRow = ({ children, style }) => (
  <View style={[s.row, style]}>{children}</View>
);

// ============================================
// PRE-BUILT SCREEN SKELETONS
// ============================================

/**
 * CardListSkeleton — For service history, job list, favorites
 * Shows header bar + filter pills + repeated cards
 */
const CardListSkeleton = ({ cardCount = 4, showStats = true, showFilters = true, shimmerAnim }) => (
  <View style={s.fill}>
    {/* Stats bar */}
    {showStats && (
      <View style={[s.card, { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14 }]}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ alignItems: 'center', gap: 6 }}>
            <ShimmerBlock width={36} height={20} borderRadius={6} shimmerAnim={shimmerAnim} />
            <ShimmerLine width={50} height={10} shimmerAnim={shimmerAnim} />
          </View>
        ))}
      </View>
    )}

    {/* Filter pills */}
    {showFilters && (
      <ShimmerRow style={{ gap: 8, marginBottom: 12, paddingHorizontal: 16 }}>
        {[70, 85, 65, 80].map((w, i) => (
          <ShimmerBlock key={i} width={w} height={32} borderRadius={16} shimmerAnim={shimmerAnim} />
        ))}
      </ShimmerRow>
    )}

    {/* Service cards */}
    {Array.from({ length: cardCount }).map((_, i) => (
      <ShimmerCard key={i} style={{ marginHorizontal: 16, marginBottom: 12 }}>
        <ShimmerRow style={{ marginBottom: 12 }}>
          <ShimmerAvatar size={44} shimmerAnim={shimmerAnim} />
          <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
            <ShimmerLine width="60%" height={14} shimmerAnim={shimmerAnim} />
            <ShimmerLine width="40%" height={11} shimmerAnim={shimmerAnim} />
          </View>
          <ShimmerBlock width={70} height={24} borderRadius={12} shimmerAnim={shimmerAnim} />
        </ShimmerRow>
        <View style={{ gap: 8 }}>
          <ShimmerLine width="90%" shimmerAnim={shimmerAnim} />
          <ShimmerLine width="70%" shimmerAnim={shimmerAnim} />
        </View>
      </ShimmerCard>
    ))}
  </View>
);

/**
 * ProfileSkeleton — For profile screen, settings, home screen
 * Shows avatar + info fields + action cards
 */
const ProfileSkeleton = ({ showAvatar = true, fieldCount = 5, cardCount = 2, shimmerAnim }) => (
  <View style={s.fill}>
    {/* Profile header */}
    {showAvatar && (
      <View style={[s.card, { alignItems: 'center', paddingVertical: 24, marginHorizontal: 16 }]}>
        <ShimmerAvatar size={80} shimmerAnim={shimmerAnim} style={{ marginBottom: 14 }} />
        <ShimmerLine width={140} height={18} shimmerAnim={shimmerAnim} style={{ marginBottom: 8 }} />
        <ShimmerLine width={180} height={12} shimmerAnim={shimmerAnim} />
      </View>
    )}

    {/* Info fields */}
    <ShimmerCard style={{ marginHorizontal: 16, marginTop: 12 }}>
      {Array.from({ length: fieldCount }).map((_, i) => (
        <View key={i} style={[s.fieldRow, i < fieldCount - 1 && s.fieldBorder]}>
          <ShimmerLine width={80} height={11} shimmerAnim={shimmerAnim} />
          <ShimmerLine width={150} height={13} shimmerAnim={shimmerAnim} />
        </View>
      ))}
    </ShimmerCard>

    {/* Action cards */}
    {Array.from({ length: cardCount }).map((_, i) => (
      <ShimmerCard key={i} style={{ marginHorizontal: 16, marginTop: 12 }}>
        <ShimmerRow>
          <ShimmerBlock width={40} height={40} borderRadius={10} shimmerAnim={shimmerAnim} />
          <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
            <ShimmerLine width="50%" height={14} shimmerAnim={shimmerAnim} />
            <ShimmerLine width="75%" height={11} shimmerAnim={shimmerAnim} />
          </View>
        </ShimmerRow>
      </ShimmerCard>
    ))}
  </View>
);

/**
 * DetailSkeleton — For service request detail, event detail
 * Shows status bar + detail sections
 */
const DetailSkeleton = ({ sectionCount = 3, shimmerAnim }) => (
  <View style={s.fill}>
    {/* Status timeline */}
    <ShimmerCard style={{ marginHorizontal: 16 }}>
      <ShimmerRow style={{ marginBottom: 16 }}>
        <ShimmerBlock width={80} height={28} borderRadius={14} shimmerAnim={shimmerAnim} />
        <View style={{ flex: 1 }} />
        <ShimmerLine width={90} height={11} shimmerAnim={shimmerAnim} />
      </ShimmerRow>
      <ShimmerBlock width="100%" height={4} borderRadius={2} shimmerAnim={shimmerAnim} />
    </ShimmerCard>

    {/* Detail sections */}
    {Array.from({ length: sectionCount }).map((_, i) => (
      <ShimmerCard key={i} style={{ marginHorizontal: 16, marginTop: 12 }}>
        <ShimmerLine width={100} height={11} shimmerAnim={shimmerAnim} style={{ marginBottom: 14 }} />
        <ShimmerRow style={{ marginBottom: 10 }}>
          <ShimmerAvatar size={44} shimmerAnim={shimmerAnim} />
          <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
            <ShimmerLine width="55%" height={14} shimmerAnim={shimmerAnim} />
            <ShimmerLine width="35%" height={11} shimmerAnim={shimmerAnim} />
          </View>
        </ShimmerRow>
        <View style={{ gap: 8 }}>
          <ShimmerLine width="85%" shimmerAnim={shimmerAnim} />
          <ShimmerLine width="65%" shimmerAnim={shimmerAnim} />
        </View>
      </ShimmerCard>
    ))}
  </View>
);

/**
 * StepsSkeleton — For verification dashboard
 * Shows progress circle + step cards
 */
const StepsSkeleton = ({ stepCount = 5, shimmerAnim }) => (
  <View style={s.fill}>
    {/* Progress overview */}
    <ShimmerCard style={{ marginHorizontal: 16, alignItems: 'center', paddingVertical: 24 }}>
      <ShimmerAvatar size={90} shimmerAnim={shimmerAnim} style={{ marginBottom: 14 }} />
      <ShimmerLine width={160} height={16} shimmerAnim={shimmerAnim} style={{ marginBottom: 8 }} />
      <ShimmerLine width={120} height={12} shimmerAnim={shimmerAnim} />
    </ShimmerCard>

    {/* Step cards */}
    {Array.from({ length: stepCount }).map((_, i) => (
      <ShimmerCard key={i} style={{ marginHorizontal: 16, marginTop: 10 }}>
        <ShimmerRow>
          <ShimmerAvatar size={40} shimmerAnim={shimmerAnim} />
          <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
            <ShimmerLine width="50%" height={14} shimmerAnim={shimmerAnim} />
            <ShimmerLine width="70%" height={11} shimmerAnim={shimmerAnim} />
          </View>
          <ShimmerBlock width={24} height={24} borderRadius={12} shimmerAnim={shimmerAnim} />
        </ShimmerRow>
      </ShimmerCard>
    ))}
  </View>
);

/**
 * SubscriptionSkeleton — For premium/subscription screen
 * Shows status card + plan card + transactions
 */
const SubscriptionSkeleton = ({ shimmerAnim }) => (
  <View style={s.fill}>
    {/* Active status card */}
    <ShimmerCard style={{ marginHorizontal: 16, paddingVertical: 24, alignItems: 'center' }}>
      <ShimmerAvatar size={56} shimmerAnim={shimmerAnim} style={{ marginBottom: 14 }} />
      <ShimmerLine width={150} height={18} shimmerAnim={shimmerAnim} style={{ marginBottom: 8 }} />
      <ShimmerLine width={100} height={12} shimmerAnim={shimmerAnim} style={{ marginBottom: 16 }} />
      <ShimmerBlock width="90%" height={40} borderRadius={10} shimmerAnim={shimmerAnim} />
    </ShimmerCard>

    {/* Plan card */}
    <ShimmerCard style={{ marginHorizontal: 16, marginTop: 12 }}>
      <ShimmerRow style={{ marginBottom: 12 }}>
        <ShimmerLine width={100} height={16} shimmerAnim={shimmerAnim} />
        <View style={{ flex: 1 }} />
        <ShimmerBlock width={70} height={24} borderRadius={6} shimmerAnim={shimmerAnim} />
      </ShimmerRow>
      {[1, 2, 3].map(i => (
        <ShimmerRow key={i} style={{ marginBottom: 8 }}>
          <ShimmerBlock width={16} height={16} borderRadius={8} shimmerAnim={shimmerAnim} />
          <ShimmerLine width="70%" height={12} shimmerAnim={shimmerAnim} style={{ marginLeft: 10 }} />
        </ShimmerRow>
      ))}
    </ShimmerCard>

    {/* Transaction section */}
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <ShimmerLine width={120} height={14} shimmerAnim={shimmerAnim} style={{ marginBottom: 12 }} />
      {[1, 2].map(i => (
        <ShimmerCard key={i} style={{ marginBottom: 10 }}>
          <ShimmerRow>
            <ShimmerBlock width={36} height={36} borderRadius={8} shimmerAnim={shimmerAnim} />
            <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
              <ShimmerLine width="45%" height={13} shimmerAnim={shimmerAnim} />
              <ShimmerLine width="30%" height={10} shimmerAnim={shimmerAnim} />
            </View>
            <ShimmerLine width={60} height={14} shimmerAnim={shimmerAnim} />
          </ShimmerRow>
        </ShimmerCard>
      ))}
    </View>
  </View>
);

/**
 * SecuritySkeleton — For account security screen
 * Shows status card + device cards + session cards
 */
const SecuritySkeleton = ({ shimmerAnim }) => (
  <View style={s.fill}>
    {/* Account status */}
    <ShimmerCard style={{ marginHorizontal: 16 }}>
      <ShimmerRow style={{ marginBottom: 12 }}>
        <ShimmerAvatar size={40} shimmerAnim={shimmerAnim} />
        <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
          <ShimmerLine width="40%" height={14} shimmerAnim={shimmerAnim} />
          <ShimmerLine width="60%" height={11} shimmerAnim={shimmerAnim} />
        </View>
      </ShimmerRow>
    </ShimmerCard>

    {/* This device */}
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <ShimmerLine width={100} height={13} shimmerAnim={shimmerAnim} style={{ marginBottom: 10 }} />
    </View>
    <ShimmerCard style={{ marginHorizontal: 16 }}>
      <ShimmerRow>
        <ShimmerBlock width={40} height={40} borderRadius={10} shimmerAnim={shimmerAnim} />
        <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
          <ShimmerLine width="50%" height={13} shimmerAnim={shimmerAnim} />
          <ShimmerLine width="35%" height={10} shimmerAnim={shimmerAnim} />
        </View>
        <ShimmerBlock width={60} height={28} borderRadius={6} shimmerAnim={shimmerAnim} />
      </ShimmerRow>
    </ShimmerCard>

    {/* Sessions */}
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <ShimmerLine width={120} height={13} shimmerAnim={shimmerAnim} style={{ marginBottom: 10 }} />
    </View>
    {[1, 2].map(i => (
      <ShimmerCard key={i} style={{ marginHorizontal: 16, marginBottom: 10 }}>
        <ShimmerRow>
          <ShimmerBlock width={36} height={36} borderRadius={8} shimmerAnim={shimmerAnim} />
          <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
            <ShimmerLine width="55%" height={13} shimmerAnim={shimmerAnim} />
            <ShimmerLine width="40%" height={10} shimmerAnim={shimmerAnim} />
          </View>
        </ShimmerRow>
      </ShimmerCard>
    ))}
  </View>
);

/**
 * GridSkeleton — For stats grids (provider home)
 * Shows 2x2 or 4-across stat cards
 */
const GridSkeleton = ({ columns = 4, rows = 1, shimmerAnim }) => (
  <View style={{ gap: 10 }}>
    {Array.from({ length: rows }).map((_, r) => (
      <View key={r} style={{ flexDirection: 'row', gap: 10 }}>
        {Array.from({ length: columns }).map((_, c) => (
          <View key={c} style={[s.card, { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 8 }]}>
            <ShimmerAvatar size={36} shimmerAnim={shimmerAnim} />
            <ShimmerBlock width={30} height={18} borderRadius={6} shimmerAnim={shimmerAnim} />
            <ShimmerLine width={50} height={10} shimmerAnim={shimmerAnim} />
          </View>
        ))}
      </View>
    ))}
  </View>
);

/**
 * ServiceApprovalSkeleton — For service approvals screen
 * Shows filter tabs + service cards with document slots
 */
const ServiceApprovalSkeleton = ({ cardCount = 3, shimmerAnim }) => (
  <View style={s.fill}>
    {/* Filter tabs */}
    <ShimmerRow style={{ gap: 8, paddingHorizontal: 16, marginBottom: 14 }}>
      {[60, 75, 70, 65].map((w, i) => (
        <ShimmerBlock key={i} width={w} height={32} borderRadius={16} shimmerAnim={shimmerAnim} />
      ))}
    </ShimmerRow>

    {/* Service cards */}
    {Array.from({ length: cardCount }).map((_, i) => (
      <ShimmerCard key={i} style={{ marginHorizontal: 16, marginBottom: 12 }}>
        <ShimmerRow style={{ marginBottom: 14 }}>
          <ShimmerBlock width={44} height={44} borderRadius={12} shimmerAnim={shimmerAnim} />
          <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
            <ShimmerLine width="55%" height={14} shimmerAnim={shimmerAnim} />
            <ShimmerBlock width={80} height={22} borderRadius={11} shimmerAnim={shimmerAnim} />
          </View>
        </ShimmerRow>
        {/* Document slots */}
        <View style={{ gap: 8 }}>
          {[1, 2].map(j => (
            <ShimmerRow key={j}>
              <ShimmerBlock width={20} height={20} borderRadius={4} shimmerAnim={shimmerAnim} />
              <ShimmerLine width="60%" height={12} shimmerAnim={shimmerAnim} style={{ marginLeft: 10 }} />
            </ShimmerRow>
          ))}
        </View>
      </ShimmerCard>
    ))}
  </View>
);

// ============================================
// MAIN WRAPPER COMPONENT
// ============================================

/**
 * ScreenShimmer — Drop-in full-screen skeleton loader
 *
 * Usage:
 *   <ScreenShimmer type="cardList" />
 *   <ScreenShimmer type="profile" />
 *   <ScreenShimmer type="detail" />
 *
 * @param {string} type - Skeleton type
 * @param {object} props - Pass-through props for the skeleton
 * @param {object} style - Container style overrides
 */
const ScreenShimmer = ({ type = 'cardList', style, ...props }) => {
  const shimmerAnim = useShimmerAnimation();

  const SkeletonMap = {
    cardList: CardListSkeleton,
    profile: ProfileSkeleton,
    detail: DetailSkeleton,
    steps: StepsSkeleton,
    subscription: SubscriptionSkeleton,
    security: SecuritySkeleton,
    grid: GridSkeleton,
    serviceApproval: ServiceApprovalSkeleton,
  };

  const SkeletonComponent = SkeletonMap[type] || CardListSkeleton;

  return (
    <View style={[s.container, style]}>
      <SkeletonComponent shimmerAnim={shimmerAnim} {...props} />
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
  },
  fill: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  fieldBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
});

// ============================================
// EXPORTS
// ============================================

export {
  useShimmerAnimation,
  ShimmerBlock,
  ShimmerLine,
  ShimmerAvatar,
  ShimmerCard,
  ShimmerRow,
  CardListSkeleton,
  ProfileSkeleton,
  DetailSkeleton,
  StepsSkeleton,
  SubscriptionSkeleton,
  SecuritySkeleton,
  GridSkeleton,
  ServiceApprovalSkeleton,
};

export default ScreenShimmer;
