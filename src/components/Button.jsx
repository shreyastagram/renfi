/**
 * Button Component
 * 
 * Reusable button with loading state and variants
 * 
 * @version 1.0.0
 */

import React from 'react';
import {  Text,
  StyleSheet,
  ActivityIndicator} from 'react-native';
import TouchableOpacity from './TouchableOpacity';

/**
 * Button variants
 */
const VARIANTS = {
  primary: {
    button: { backgroundColor: '#2563EB' },
    text: { color: '#FFFFFF' },
  },
  secondary: {
    button: { backgroundColor: '#E5E7EB' },
    text: { color: '#374151' },
  },
  outline: {
    button: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2563EB' },
    text: { color: '#2563EB' },
  },
};

/**
 * Button Component
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Button text
 * @param {Function} props.onPress - Press handler
 * @param {boolean} props.loading - Loading state
 * @param {boolean} props.disabled - Disabled state
 * @param {string} props.variant - Button variant (primary, secondary, outline)
 * @param {Object} props.style - Additional button styles
 * @param {Object} props.textStyle - Additional text styles
 */
const Button = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
}) => {
  const variantStyle = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variantStyle.button,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'primary' ? '#FFFFFF' : '#2563EB'} 
        />
      ) : (
        <Text style={[styles.text, variantStyle.text, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default Button;
