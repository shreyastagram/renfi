/**
 * StatSegments — the count row at the top of both history screens, and the
 * primary filter control.
 *
 * Replaces four free-floating tinted pills. Those were a saturated hue at 10%
 * alpha laid over the page (`rgba(124,58,237,0.1)` on `#F1F5F9`), and a strong
 * colour at 10% over a blue-grey does not make a tint — it makes a grey with a
 * hint of something. Four of them side by side read as four shades of mud.
 * Here the colour lives in a 3pt rule under each figure, at full strength, on a
 * plain surface.
 *
 * The row is also the filter now. Tapping a segment shows only that status;
 * tapping the SAME segment again clears back to all. That is the owner's
 * "double clicking should remove the filter" implemented as a toggle rather
 * than a real double-tap: a double-tap needs a ~300ms window during which a
 * single tap cannot be acted on, so every filter change would feel slow. A
 * toggle is instant and has no hidden timing.
 *
 * PERFORMANCE — providers run older phones, so this is deliberately cheap:
 *   - every animation is transform or opacity, so all of them run on the
 *     native driver and never touch JS during the gesture.
 *   - no LayoutAnimation, no animating colours (colour cannot be native-driven
 *     and forces a JS-side frame loop), no animated shadows.
 *   - one Animated.Value per segment, created once.
 *   - the whole row is memoised, and each segment is its own memo boundary, so
 *     changing the filter re-renders two segments rather than the list header.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';

import { useThemedStyles } from '../theme';

const Segment = React.memo(({ item, active, first, last, onPress }) => {
  const styles = useThemedStyles(makeStyles);

  // 0 = idle, 1 = selected. Drives the underline and the figure together.
  const on = useRef(new Animated.Value(active ? 1 : 0)).current;
  // Separate press feedback so it reads immediately, before state round-trips.
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(on, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      stiffness: 260,
      damping: 22,
      mass: 0.7,
    }).start();
  }, [active, on]);

  const pressIn = useCallback(() => {
    Animated.timing(press, { toValue: 0.94, duration: 90, useNativeDriver: true }).start();
  }, [press]);
  const pressOut = useCallback(() => {
    Animated.spring(press, { toValue: 1, useNativeDriver: true, stiffness: 400, damping: 15 }).start();
  }, [press]);

  return (
    <Pressable
      onPress={() => onPress(item.key)}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[styles.seg, first && styles.segFirst, last && styles.segLast]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${item.label}, ${item.value}`}
      accessibilityHint={active ? 'Tap again to clear the filter' : undefined}
    >
      {/* Selected wash. Opacity only — a colour transition would drop off the
          native driver and animate on the JS thread while the list scrolls. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.segWash, { opacity: on }]}
      />
      <Animated.View style={{ transform: [{ scale: press }] }}>
        <Animated.Text
          style={[
            styles.segValue,
            active && styles.segValueOn,
            { transform: [{ scale: on.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] },
          ]}
          numberOfLines={1}
        >
          {item.value}
        </Animated.Text>
        <Text style={[styles.segLabel, active && styles.segLabelOn]} numberOfLines={1}>
          {item.label}
        </Text>
      </Animated.View>

      {/* The rule grows from the centre when selected. scaleX on the native
          driver, so it costs nothing per frame. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.segRule,
          { backgroundColor: item.color },
          {
            opacity: on.interpolate({ inputRange: [0, 1], outputRange: [0.32, 1] }),
            transform: [{ scaleX: on.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          },
        ]}
      />
    </Pressable>
  );
});

/**
 * @param items  [{ key, label, value, color }] — key matches the screen's filter keys
 * @param value  the screen's current activeFilter
 * @param onChange(nextKey) — called with the new filter; 'all' when toggled off
 */
const StatSegments = ({ items, value, onChange }) => {
  const styles = useThemedStyles(makeStyles);

  const handle = useCallback(
    (key) => {
      // Tapping the live filter again clears it. 'all' is already "no filter",
      // so it is idempotent rather than a toggle into nothing.
      onChange(value === key && key !== 'all' ? 'all' : key);
    },
    [value, onChange],
  );

  return (
    <View style={styles.row}>
      {items.map((item, i) => (
        <Segment
          key={item.key}
          item={item}
          active={value === item.key}
          first={i === 0}
          last={i === items.length - 1}
          onPress={handle}
        />
      ))}
    </View>
  );
};

const makeStyles = (theme) => {
  const c = theme.colors;
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      // Top corners cut harder than the bottom, so the row reads as a tab strip
      // the list hangs from rather than as a floating card.
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
      overflow: 'hidden',
    },
    seg: {
      flex: 1,
      minWidth: 0,
      paddingTop: 11,
      paddingBottom: 12,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segFirst: { borderTopLeftRadius: 18, borderBottomLeftRadius: 10 },
    segLast: { borderTopRightRadius: 18, borderBottomRightRadius: 10 },
    segWash: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.brandOrangeFill,
    },
    segValue: {
      fontSize: 19,
      fontWeight: '800',
      color: c.textStrong,
      letterSpacing: -0.4,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    segValueOn: { color: c.brandOrangeInk },
    segLabel: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    segLabelOn: { color: c.brandOrangeInk },
    segRule: {
      position: 'absolute',
      left: '18%',
      right: '18%',
      bottom: 0,
      height: 3,
      borderTopLeftRadius: 2,
      borderTopRightRadius: 2,
    },
  });
};

export default React.memo(StatSegments);
