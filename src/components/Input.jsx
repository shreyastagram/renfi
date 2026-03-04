/**
 * Input Component
 * 
 * Reusable text input with label, error handling, password toggle icon,
 * optional right icon support, and mandatory field asterisk.
 * 
 * @version 2.0.0
 */

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet,
  TouchableOpacity 
} from 'react-native';

/**
 * Input Component
 * 
 * @param {Object} props - Component props
 * @param {string} props.label - Input label
 * @param {string} props.value - Input value
 * @param {Function} props.onChangeText - Change handler
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.error - Error message
 * @param {boolean} props.secureTextEntry - Password input
 * @param {string} props.keyboardType - Keyboard type
 * @param {string} props.autoCapitalize - Auto capitalize setting
 * @param {boolean} props.editable - Editable state
 * @param {boolean} props.required - Show asterisk for mandatory fields
 * @param {string} props.rightIcon - Name of right icon ('eye', 'eye-off', etc.)
 * @param {Function} props.onRightIconPress - Handler for right icon press
 * @param {Object} props.style - Additional container styles
 */
const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  required = false,
  rightIcon,
  onRightIconPress,
  style,
  ...props
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  // Determine which icon to show for password toggle
  const renderPasswordIcon = () => {
    const isVisible = rightIcon ? rightIcon === 'eye-off' : isPasswordVisible;
    return (
      <Text style={styles.eyeIcon}>
        {isVisible ? '◉' : '◎'}
      </Text>
    );
  };

  // Check if we should show the toggle button
  const hasRightAction = secureTextEntry || (rightIcon && onRightIconPress);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.requiredAsterisk}> *</Text>}
        </Text>
      )}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.inputFocused,
        error && styles.inputError,
        !editable && styles.inputDisabled,
      ]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={
            rightIcon 
              ? (rightIcon === 'eye' ? true : false)  // controlled by parent
              : (secureTextEntry && !isPasswordVisible) // internal toggle
          }
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {hasRightAction && (
          <TouchableOpacity 
            onPress={onRightIconPress || togglePasswordVisibility}
            style={styles.eyeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {renderPasswordIcon()}
          </TouchableOpacity>
        )}
      </View>
      
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: '#EF4444',
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  inputFocused: {
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111827',
  },
  eyeButton: {
    padding: 12,
  },
  eyeIcon: {
    fontSize: 20,
    color: '#6B7280',
  },
  error: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
});

export default Input;
