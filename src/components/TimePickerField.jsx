/**
 * TimePickerField — a tappable "HH:mm" field backed by the platform time picker.
 *
 * Android: opens the system clock dialog (a native dialog, not an RN Modal, so
 * it is safe to open from inside our bottom sheet — stacked RN Modals are flaky
 * on Android, see PhoneOnboardingSheet).
 * iOS: shows an inline spinner under the field with a Done button, so no second
 * Modal is ever mounted over the sheet.
 *
 * The parent owns which field is open (one at a time).
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import TouchableOpacity from './TouchableOpacity';
import { useLanguage } from '../context/LanguageContext';
import { formatTime12, hhmmToPickerDate, pickerDateToHhmm } from '../utils/workSchedule';

const COLORS = {
  border: '#E2E8F0',
  activeBorder: '#f67c16',
  activeGlow: '#FED7AA',
  label: '#64748B',
  value: '#0F172A',
  white: '#FFFFFF',
};

const TimePickerField = ({ label, value, onChange, disabled = false, isOpen = false, onOpen, onClose, testID }) => {
  const { t } = useLanguage();

  const handleChange = useCallback((event, selected) => {
    if (Platform.OS === 'android') {
      onClose();
      if (event?.type === 'set' && selected) onChange(pickerDateToHhmm(selected));
      return;
    }
    if (selected) onChange(pickerDateToHhmm(selected));
  }, [onChange, onClose]);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.field, isOpen && styles.fieldActive, disabled && styles.fieldDisabled]}
        onPress={() => (isOpen ? onClose() : onOpen())}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatTime12(value)}`}
        testID={testID}
      >
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{formatTime12(value)}</Text>
      </TouchableOpacity>

      {isOpen && (
        <DateTimePicker
          value={hhmmToPickerDate(value)}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minuteInterval={5}
          onChange={handleChange}
          style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
        />
      )}

      {isOpen && Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.done} onPress={onClose} accessibilityRole="button">
          <Text style={styles.doneText}>{t('workHours.done')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  field: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
  },
  fieldActive: { borderColor: COLORS.activeBorder, backgroundColor: '#FFFBF6' },
  fieldDisabled: { opacity: 0.45 },
  label: { fontSize: 11.5, fontWeight: '600', color: COLORS.label },
  value: { fontSize: 18, fontWeight: '700', color: COLORS.value, marginTop: 1 },
  iosPicker: { alignSelf: 'stretch', height: 150 },
  done: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  doneText: { fontSize: 14, fontWeight: '700', color: '#2b76bc' },
});

export default React.memo(TimePickerField);
