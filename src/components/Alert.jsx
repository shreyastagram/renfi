/**
 * Alert Component
 * 
 * Displays success, error, warning, and info messages
 * 
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

/**
 * Alert types with their styling
 */
const ALERT_TYPES = {
  success: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
    textColor: '#065F46',
    icon: '✓',
  },
  error: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    textColor: '#991B1B',
    icon: '✕',
  },
  warning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    textColor: '#92400E',
    icon: '⚠',
  },
  info: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
    textColor: '#1E40AF',
    icon: 'ℹ',
  },
};

/**
 * Alert Component
 * 
 * @param {Object} props - Component props
 * @param {string} props.type - Alert type (success, error, warning, info)
 * @param {string|Object} props.message - Alert message (handles strings or objects)
 * @param {Function} props.onClose - Close handler (optional)
 * @param {Object} props.style - Additional styles
 */
const Alert = ({ type = 'info', message, onClose, style }) => {
  const alertStyle = ALERT_TYPES[type] || ALERT_TYPES.info;

  if (!message) return null;

  // Ensure message is always a string (handle objects/error objects)
  const displayMessage = typeof message === 'string' 
    ? message 
    : message?.message 
      ? String(message.message)
      : JSON.stringify(message);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: alertStyle.backgroundColor,
          borderColor: alertStyle.borderColor,
        },
        style,
      ]}
    >
      <Text style={[styles.icon, { color: alertStyle.textColor }]}>
        {alertStyle.icon}
      </Text>
      <Text style={[styles.message, { color: alertStyle.textColor }]}>
        {displayMessage}
      </Text>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeIcon, { color: alertStyle.textColor }]}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  icon: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  closeIcon: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default Alert;
