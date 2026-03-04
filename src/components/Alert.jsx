/**
 * Alert Component
 * 
 * Premium-quality notification banners with rich UI
 * Supports success, error, warning, and info types
 * 
 * @version 2.0.0 - Premium UI redesign
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

/**
 * Alert types with premium styling
 */
const ALERT_TYPES = {
  success: {
    backgroundColor: '#ECFDF5',
    borderColor: '#34D399',
    textColor: '#065F46',
    titleColor: '#047857',
    iconBg: '#D1FAE5',
    iconColor: '#059669',
    icon: '✓',
    title: 'Success',
  },
  error: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    textColor: '#991B1B',
    titleColor: '#B91C1C',
    iconBg: '#FEE2E2',
    iconColor: '#DC2626',
    icon: '!',
    title: 'Error',
  },
  warning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FBBF24',
    textColor: '#92400E',
    titleColor: '#B45309',
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    icon: '!',
    title: 'Attention',
  },
  info: {
    backgroundColor: '#EFF6FF',
    borderColor: '#60A5FA',
    textColor: '#1E40AF',
    titleColor: '#1D4ED8',
    iconBg: '#DBEAFE',
    iconColor: '#2563EB',
    icon: 'i',
    title: 'Info',
  },
};

/**
 * Alert Component — Premium UI
 * 
 * @param {Object} props - Component props
 * @param {string} props.type - Alert type (success, error, warning, info)
 * @param {string|Object} props.message - Alert message (handles strings or objects)
 * @param {Function} props.onClose - Close handler (optional)
 * @param {Function} props.onDismiss - Dismiss handler (alias for onClose)
 * @param {Object} props.style - Additional styles
 */
const Alert = ({ type = 'info', message, onClose, onDismiss, style }) => {
  const alertConfig = ALERT_TYPES[type] || ALERT_TYPES.info;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-8)).current;
  const dismissHandler = onClose || onDismiss;

  useEffect(() => {
    if (message) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [message]);

  if (!message) return null;

  // Ensure message is always a string
  const displayMessage = typeof message === 'string' 
    ? message 
    : message?.message 
      ? String(message.message)
      : JSON.stringify(message);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: alertConfig.backgroundColor,
          borderLeftColor: alertConfig.borderColor,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        style,
      ]}
    >
      {/* Icon Badge */}
      <View style={[styles.iconBadge, { backgroundColor: alertConfig.iconBg }]}>
        <Text style={[styles.iconText, { color: alertConfig.iconColor }]}>
          {alertConfig.icon}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: alertConfig.titleColor }]}>
          {alertConfig.title}
        </Text>
        <Text style={[styles.message, { color: alertConfig.textColor }]}>
          {displayMessage}
        </Text>
      </View>

      {/* Dismiss Button */}
      {dismissHandler && (
        <TouchableOpacity 
          onPress={dismissHandler} 
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[styles.closeBadge, { backgroundColor: alertConfig.iconBg }]}>
            <Text style={[styles.closeIcon, { color: alertConfig.iconColor }]}>×</Text>
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  iconText: {
    fontSize: 16,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    paddingRight: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  closeButton: {
    padding: 2,
    marginLeft: 8,
    marginTop: 1,
  },
  closeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
});

export default Alert;
