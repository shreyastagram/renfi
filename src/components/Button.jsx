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
import { useThemeColors } from '../theme';

/**
 * Button variants.
 *
 * Built from theme colours rather than literals. Kept as a function at module
 * scope and memoised by the caller, so nothing is allocated per render.
 *
 * Note this uses altBlueIndigo, not brandBlue: #2563EB is what the component
 * has always shipped, and preserving it keeps light mode pixel-identical.
 * Folding it into the brand blue would be a redesign, not a theme change.
 */
const makeVariants = (c) => ({
  primary: {
    button: { backgroundColor: c.altBlueIndigo },
    text: { color: c.onAltBlueIndigo },
  },
  secondary: {
    button: { backgroundColor: c.borderNeutral },
    text: { color: c.textBodyNeutral },
  },
  outline: {
    button: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.altBlueIndigo },
    text: { color: c.altBlueIndigo },
  },
});

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
  const c = useThemeColors();
  const variants = React.useMemo(() => makeVariants(c), [c]);
  const variantStyle = variants[variant] || variants.primary;
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
          color={variant === 'primary' ? c.onAltBlueIndigo : c.altBlueIndigo}
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
