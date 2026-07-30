/**
 * Alert Component
 *
 * Modern floating notification card with rich animations
 * Supports success, error, warning, and info types
 * Auto-dismisses success/info messages after a delay
 *
 * @version 3.0.0 - Modern card redesign
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions} from 'react-native';
import TouchableOpacity from './TouchableOpacity';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Alert type configurations
 */
const ALERT_TYPES = {
  success: {
    bg: '#F0FDF4',
    border: '#BBF7D0',
    text: '#15803D',
    accent: '#16A34A',
    iconBg: '#16A34A',
    icon: '\u2713',
    label: 'Success',
    autoDismiss: 4000,
  },
  error: {
    bg: '#FFF1F2',
    border: '#FECDD3',
    text: '#BE123C',
    accent: '#E11D48',
    iconBg: '#E11D48',
    icon: '\u2715',
    label: 'Error',
    autoDismiss: 0, // errors stay until dismissed
  },
  warning: {
    bg: '#FFFBEB',
    border: '#FDE68A',
    text: '#92400E',
    accent: '#D97706',
    iconBg: '#D97706',
    icon: '!',
    label: 'Heads up',
    autoDismiss: 5000,
  },
  info: {
    bg: '#EFF6FF',
    border: '#BFDBFE',
    text: '#1E40AF',
    accent: '#2563EB',
    iconBg: '#2563EB',
    icon: 'i',
    label: 'Note',
    autoDismiss: 5000,
  },
};

/**
 * Alert Component
 *
 * @param {Object} props
 * @param {string} props.type - success | error | warning | info
 * @param {string|Object} props.message - Alert message
 * @param {string} props.hint - Optional secondary hint text
 * @param {Function} props.onClose - Dismiss handler
 * @param {Function} props.onDismiss - Alias for onClose
 * @param {Function} props.onAction - Optional action button handler
 * @param {string} props.actionLabel - Optional action button text
 * @param {Object} props.style - Additional container styles
 */
const Alert = ({
  type = 'info',
  message,
  hint,
  onClose,
  onDismiss,
  onAction,
  actionLabel,
  style,
}) => {
  const config = ALERT_TYPES[type] || ALERT_TYPES.info;
  const dismissHandler = onClose || onDismiss;

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const autoDismissTimer = useRef(null);

  // Ensure message is a string. The stringify is guarded: an unserializable
  // object here (e.g. a raw error with circular native refs) used to throw
  // during render — now it renders a placeholder and tags a probe event.
  const displayMessage = typeof message === 'string'
    ? message
    : message?.message
      ? String(message.message)
      : message
        ? (() => {
            try {
              return JSON.stringify(message);
            } catch (jsonErr) {
              try {
                require('../utils/storageTelemetry').reportStringifyProbeFailure('ALERT_MESSAGE', jsonErr);
              } catch (e) { /* telemetry unavailable — still render */ }
              return 'Something went wrong. Please try again.';
            }
          })()
        : '';

  const handleDismiss = useCallback(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
    }
    // Animate out
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismissHandler?.();
    });
  }, [dismissHandler, opacityAnim, scaleAnim]);

  useEffect(() => {
    if (!message) return;

    // Reset animations
    scaleAnim.setValue(0.92);
    opacityAnim.setValue(0);
    progressAnim.setValue(0);

    // Animate in with spring
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss with progress bar
    if (config.autoDismiss > 0 && dismissHandler) {
      // Animate progress bar
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: config.autoDismiss,
        useNativeDriver: false, // width animation can't use native driver
      }).start();

      autoDismissTimer.current = setTimeout(() => {
        handleDismiss();
      }, config.autoDismiss);
    }

    return () => {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
      }
    };
  }, [message]);

  if (!message || !displayMessage) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['100%', '0%'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
        style,
      ]}
    >
      {/* Main Content Row */}
      <View style={styles.row}>
        {/* Icon Circle */}
        <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
          <Text style={styles.iconText}>{config.icon}</Text>
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={[styles.label, { color: config.accent }]}>
            {config.label}
          </Text>
          <Text style={[styles.message, { color: config.text }]}>
            {displayMessage}
          </Text>
          {hint ? (
            <Text style={[styles.hint, { color: config.text }]}>
              {hint}
            </Text>
          ) : null}
          {onAction && actionLabel ? (
            <TouchableOpacity
              onPress={onAction}
              style={[styles.actionButton, { backgroundColor: config.accent }]}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>{actionLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Dismiss Button */}
        {dismissHandler && (
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.dismissButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.6}
          >
            <Text style={[styles.dismissIcon, { color: config.accent }]}>{'\u2715'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Auto-dismiss progress bar */}
      {config.autoDismiss > 0 && dismissHandler && (
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: config.accent,
                width: progressWidth,
              },
            ]}
          />
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    // Soft shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    paddingBottom: 12,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
    paddingRight: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
    opacity: 0.7,
    marginTop: 4,
  },
  actionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 4,
    marginTop: -1,
  },
  dismissIcon: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.6,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  progressBar: {
    height: 3,
    borderRadius: 1.5,
  },
});

export default Alert;
