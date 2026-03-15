/**
 * PhoneInput Component
 *
 * Indian phone number input with flag icon and +91 prefix.
 * Accepts only 10 digits. Strips any leading 91 or +91 from pasted values.
 * The value stored is always the raw 10-digit number.
 *
 * Usage:
 *   <PhoneInput
 *     label="Phone Number"
 *     value={phone}           // "9146282497" (10 digits only)
 *     onChangeText={setPhone} // receives 10-digit string
 *     error={errors.phone}
 *   />
 *
 * To get the full international number for API calls:
 *   const fullNumber = '+91' + phone;
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';

const PhoneInput = ({
  label,
  value,
  onChangeText,
  placeholder = 'Enter 10-digit number',
  error,
  editable = true,
  required = false,
  style,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (text) => {
    // Strip everything except digits
    let digits = text.replace(/[^0-9]/g, '');

    // If user pasted +919146282497 or 919146282497, strip the 91 prefix
    if (digits.length > 10 && digits.startsWith('91')) {
      digits = digits.substring(2);
    }

    // Cap at 10 digits
    digits = digits.slice(0, 10);

    onChangeText(digits);
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.requiredAsterisk}> *</Text>}
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          !editable && styles.inputDisabled,
        ]}
      >
        {/* India flag + country code prefix */}
        <View style={styles.prefixContainer}>
          <Text style={styles.flag}>🇮🇳</Text>
          <Text style={styles.countryCode}>+91</Text>
          <View style={styles.divider} />
        </View>

        {/* Phone number input */}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={10}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label || 'Phone number'}
          accessibilityHint="Enter 10-digit mobile number"
        />
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
    height: 48,
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
  prefixContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    gap: 6,
  },
  flag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#D1D5DB',
    marginLeft: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
    letterSpacing: 0.5,
  },
  error: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
});

export default PhoneInput;
