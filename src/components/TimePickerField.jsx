/**
 * TimePickerField — a tappable "HH:mm" field backed by the platform time picker.
 *
 * Android: opens the system clock dialog (a native dialog, not an RN Modal, so
 * it is safe to open from inside our bottom sheet — stacked RN Modals are flaky
 * on Android, see PhoneOnboardingSheet). Works on every supported Android (24+).
 *
 * iOS: the field only toggles; the parent renders <IosTimeWheel> at FULL sheet
 * width below the fields. The spinner needs ~220pt for hour/minute/AM-PM, so it
 * must not live inside a half-width field, and no second Modal is ever mounted.
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
  label: '#64748B',
  value: '#0F172A',
  white: '#FFFFFF',
};

// Large accessibility font sizes must not break the two-column layout.
const MAX_FONT_SCALE = 1.3;

const TimePickerField = ({ label, value, onChange, disabled = false, isOpen = false, onOpen, onClose, testID }) => {
  const handleAndroidChange = useCallback((event, selected) => {
    onClose();
    if (event?.type === 'set' && selected) onChange(pickerDateToHhmm(selected));
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
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label}</Text>
        <Text
          style={styles.value}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        >
          {formatTime12(value)}
        </Text>
      </TouchableOpacity>

      {isOpen && Platform.OS === 'android' && (
        <DateTimePicker
          value={hhmmToPickerDate(value)}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleAndroidChange}
        />
      )}
    </View>
  );
};

/**
 * iOS inline time wheel — rendered by the parent at full width.
 * Forced light appearance: the sheet is always white, and in iOS dark mode the
 * wheel's text would otherwise be white-on-white (invisible).
 */
export const IosTimeWheel = React.memo(({ value, onChange, onDone }) => {
  const { t } = useLanguage();
  const handleChange = useCallback((event, selected) => {
    if (selected) onChange(pickerDateToHhmm(selected));
  }, [onChange]);

  if (Platform.OS !== 'ios') return null;
  return (
    <View style={styles.iosWheelWrap}>
      <DateTimePicker
        value={hhmmToPickerDate(value)}
        mode="time"
        is24Hour={false}
        display="spinner"
        minuteInterval={5}
        themeVariant="light"
        textColor={COLORS.value}
        onChange={handleChange}
        style={styles.iosWheel}
      />
      <TouchableOpacity style={styles.done} onPress={onDone} accessibilityRole="button">
        <Text style={styles.doneText} maxFontSizeMultiplier={MAX_FONT_SCALE}>{t('workHours.done')}</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0 },
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
  iosWheelWrap: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    paddingBottom: 8,
  },
  iosWheel: { alignSelf: 'stretch', height: 180, backgroundColor: '#F8FAFC' },
  done: {
    paddingVertical: 8,
    paddingHorizontal: 26,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  doneText: { fontSize: 14, fontWeight: '700', color: '#2b76bc' },
});

export default React.memo(TimePickerField);
