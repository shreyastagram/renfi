/**
 * TouchableOpacity — Pressable-based drop-in replacement
 *
 * Uses Pressable under the hood to avoid the Android elevation strip/seam
 * artifact caused by RN TouchableOpacity's native opacity animation
 * interacting with the elevation rendering pipeline.
 *
 * All TouchableOpacity props are supported: onPress, onLongPress, onPressIn,
 * onPressOut, activeOpacity, disabled, hitSlop, delayLongPress, style,
 * accessibilityLabel, accessibilityRole, accessibilityState, ref, etc.
 *
 * See: https://github.com/facebook/react-native/issues/25093
 *      https://github.com/facebook/react-native/issues/48874
 */

import React, {useCallback, useRef} from 'react';
import {Pressable, Animated} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TouchableOpacity = React.forwardRef(
  ({activeOpacity = 0.2, style, onPressIn, onPressOut, ...props}, ref) => {
    const opacity = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(
      e => {
        Animated.timing(opacity, {
          toValue: activeOpacity,
          duration: 150,
          useNativeDriver: true,
        }).start();
        onPressIn?.(e);
      },
      [activeOpacity, onPressIn, opacity],
    );

    const handlePressOut = useCallback(
      e => {
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
        onPressOut?.(e);
      },
      [onPressOut, opacity],
    );

    return (
      <AnimatedPressable
        ref={ref}
        style={[style, {opacity}]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...props}
      />
    );
  },
);

TouchableOpacity.displayName = 'TouchableOpacity';

export default TouchableOpacity;
