/**
 * DateTime Picker Component
 *
 * Premium date and time picker with:
 * - Instant / Today / Tomorrow / calendar quick picks
 * - Time slot grid with smart filtering
 * - Smooth animations and polished UI
 * - Cross-platform (iOS/Android)
 *
 * @version 2.0.0
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import {
  useThemedStyles,
  useThemeColors,
} from '../theme';

const makeC = (c) => ({
  selected: c.altBlueIndigo, // was #2563EB
  instant: c.warning, // was #F59E0B amber accent
  instantLight: c.warningBg, // was #FFFBEB
  instantBorder: c.warningBorder, // was #FDE68A
  primaryLight: c.infoBg, // was #EFF6FF
  primaryBorder: c.infoBorder, // was #DBEAFE
  primary: c.brandOrange,
  onPrimary: c.onBrandOrange,
  secondary: c.brandBlue,
  onSecondary: c.onBrandBlue,
  white: c.surface,
  bg: c.bg,
  sunken: c.surfaceSunken,
  // The shipped neutral hairline was #F1F5F9 -- exactly `bg` in light, a recessed
  // seam on a dark surface.
  hairline: c.bg,
  line: c.borderNeutral,
  borderMedium: c.borderMediumNeutral,
  text: c.textStrongNeutral,
  textStrong: c.textStrong,
  textBody: c.textBodyNeutral,
  textSecondary: c.textSecondary,
  muted: c.textMuted,
  info: c.info,
  infoBg: c.infoContainer,
  infoFill: c.infoFill,
  indigo: c.altBlueIndigo,
  accentSky: c.altBlueSky,
  purple: c.accentViolet,
  purpleBg: c.accentVioletContainer,
  success: c.success,
  successBg: c.successContainer,
  successFill: c.successFill,
  danger: c.danger,
  onDanger: c.onDanger,
  dangerBg: c.dangerContainer,
  dangerFill: c.dangerFill,
  dangerLine: c.dangerBorder,
  warning: c.warning,
  warningBg: c.warningContainer,
  warningLine: c.warningBorder,
  overlay: c.overlay,
  shadow: c.shadow,
});

const generateQuickDateOptions = () => {
  const options = [];
  const now = new Date();

  options.push({
    date: new Date(),
    label: 'Instant',
    shortLabel: 'Now',
    isInstant: true,
    icon: 'flash-on',
  });

  for (let i = 0; i < 14; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    date.setHours(0, 0, 0, 0);

    let label, shortLabel;
    if (i === 0) { label = 'Today'; shortLabel = 'Today'; }
    else if (i === 1) { label = 'Tomorrow'; shortLabel = 'Tmrw'; }
    else {
      label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      shortLabel = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    }

    options.push({ date, label, shortLabel, isInstant: false });
  }

  return options;
};

const generateTimeSlots = () => {
  const slots = [];
  const now = new Date();
  const currentHour = now.getHours();

  for (let hour = 6; hour <= 21; hour++) {
    slots.push({
      hour, minute: 0,
      label: formatTime(hour, 0),
      isPast: hour <= currentHour,
    });
    if (hour < 21) {
      slots.push({
        hour, minute: 30,
        label: formatTime(hour, 30),
        isPast: hour < currentHour || (hour === currentHour && now.getMinutes() >= 30),
      });
    }
  }
  return slots;
};

const formatTime = (hour, minute) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
};

/* ── Date Chip ──────────────────────────────────────────── */
const DateChip = ({ option, selected, onPress }) => {
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }).start();
  };

  const isInstant = option.isInstant;
  const chipBg = selected
    ? (isInstant ? C.instant : C.selected)
    : (isInstant ? C.instantLight : C.bg);
  const chipBorder = selected
    ? (isInstant ? C.instant : C.selected)
    : (isInstant ? C.instantBorder : C.line);
  const textColor = selected ? C.onSecondary : (isInstant ? C.warning : C.text);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.dateChip, { backgroundColor: chipBg, borderColor: chipBorder }]}
        onPress={() => onPress(option)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {isInstant && (
          <MaterialIcon name="flash-on" size={14} color={selected ? C.onSecondary : C.warning} style={{ marginRight: 4 }} />
        )}
        <Text style={[styles.dateChipText, { color: textColor }]}>
          {option.shortLabel}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ── Time Slot ──────────────────────────────────────────── */
const TimeSlot = ({ slot, selected, onPress }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[
        styles.timeSlot,
        selected && styles.timeSlotSelected,
      ]}
      onPress={() => onPress(slot)}
      activeOpacity={0.7}
    >
      <Text style={[styles.timeSlotText, selected && styles.timeSlotTextSelected]}>
        {slot.label}
      </Text>
    </TouchableOpacity>
  );
};

/* ── Main Component ─────────────────────────────────────── */
const DateTimePickerComponent = ({
  value: valueProp,
  onChange: onChangeProp,
  onDateTimeChange,
  initialDate,
  initialTime,
  minimumDate,
  showTime = true,
  label,
  placeholder = 'Select date and time',
  error,
}) => {
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const [internalValue, setInternalValue] = useState(() => {
    if (valueProp) return valueProp;
    if (initialDate) {
      const date = new Date(initialDate);
      if (initialTime) {
        const time = new Date(initialTime);
        date.setHours(time.getHours());
        date.setMinutes(time.getMinutes());
      }
      return date;
    }
    return null;
  });

  const value = valueProp || internalValue;
  const [isInstantSelected, setIsInstantSelected] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Fade animation for time section appearing
  const timeFadeAnim = useRef(new Animated.Value(0)).current;

  const quickDates = useMemo(() => generateQuickDateOptions(), []);
  const timeSlots = useMemo(() => generateTimeSlots(), []);
  const minDate = minimumDate || new Date();

  const handleValueChange = useCallback((newValue, isInstant = false) => {
    setInternalValue(newValue);
    setIsInstantSelected(isInstant);

    if (onChangeProp) onChangeProp(newValue);
    if (onDateTimeChange) {
      onDateTimeChange({ date: newValue, time: newValue, isInstant });
    }
  }, [onChangeProp, onDateTimeChange]);

  // Animate time section in when date is selected
  useEffect(() => {
    if (value && !isInstantSelected) {
      Animated.timing(timeFadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      timeFadeAnim.setValue(0);
    }
  }, [value, isInstantSelected, timeFadeAnim]);

  const handleDateChange = useCallback((event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(value || new Date());
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      handleValueChange(newDate);
    }
  }, [value, handleValueChange]);

  const handleTimeChange = useCallback((event, selectedTime) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(value || new Date());
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      handleValueChange(newDate);
    }
  }, [value, handleValueChange]);

  const handleQuickDateSelect = useCallback((option) => {
    if (option.isInstant) {
      handleValueChange(new Date(), true);
      return;
    }

    const newDate = new Date(option.date);
    if (value) {
      newDate.setHours(value.getHours());
      newDate.setMinutes(value.getMinutes());
    } else {
      const now = new Date();
      if (option.date.toDateString() === now.toDateString()) {
        newDate.setHours(now.getHours() + 1);
        newDate.setMinutes(0);
      } else {
        newDate.setHours(9);
        newDate.setMinutes(0);
      }
    }
    handleValueChange(newDate, false);
  }, [value, handleValueChange]);

  const handleTimeSlotSelect = useCallback((slot) => {
    const newDate = new Date(value || new Date());
    newDate.setHours(slot.hour);
    newDate.setMinutes(slot.minute);
    handleValueChange(newDate, false);
    setShowModal(false);
  }, [value, handleValueChange]);

  const isToday = value && value.toDateString() === new Date().toDateString();

  const formatDisplayValue = () => {
    if (!value) return placeholder;
    if (isInstantSelected) return 'Instant Service — ASAP';

    const dateStr = value.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

    if (showTime) {
      const timeStr = value.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
      return `${dateStr} at ${timeStr}`;
    }
    return dateStr;
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Section title */}
      <View style={styles.sectionHeader}>
        <MaterialIcon name="event" size={16} color={C.muted} />
        <Text style={styles.sectionTitle}>When do you need service?</Text>
      </View>

      {/* Quick Date Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickDatesScroll}
        style={styles.quickDatesContainer}
      >
        {quickDates.slice(0, 8).map((option, index) => (
          <DateChip
            key={index}
            option={option}
            selected={option.isInstant ? isInstantSelected : (!isInstantSelected && value && value.toDateString() === option.date.toDateString())}
            onPress={handleQuickDateSelect}
          />
        ))}
        <TouchableOpacity
          style={styles.moreDatesButton}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <MaterialIcon name="date-range" size={16} color={C.selected} />
          <Text style={styles.moreDatesText}>More</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Time Selection — appears with fade when a date is selected */}
      {showTime && value && !isInstantSelected && (
        <Animated.View style={[styles.timeSection, { opacity: timeFadeAnim }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcon name="schedule" size={16} color={C.muted} />
            <Text style={styles.sectionTitle}>Preferred time</Text>
          </View>
          <View style={styles.timeSlotsGrid}>
            {timeSlots
              .filter((slot) => !isToday || !slot.isPast)
              .slice(0, 8)
              .map((slot, index) => (
                <TimeSlot
                  key={index}
                  slot={slot}
                  selected={value && value.getHours() === slot.hour && value.getMinutes() === slot.minute}
                  onPress={handleTimeSlotSelect}
                />
              ))}
            <TouchableOpacity
              style={styles.moreTimesButton}
              onPress={() => setShowModal(true)}
              activeOpacity={0.7}
            >
              <MaterialIcon name="more-horiz" size={18} color={C.selected} />
              <Text style={styles.moreTimesText}>More</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Summary bar */}
      <View style={[styles.summaryBar, isInstantSelected && styles.summaryBarInstant]}>
        <MaterialIcon
          name={isInstantSelected ? 'flash-on' : 'event-available'}
          size={18}
          color={isInstantSelected ? C.instant : C.selected}
        />
        <Text style={[styles.summaryText, !value && styles.summaryPlaceholder]}>
          {formatDisplayValue()}
        </Text>
        {value && !isInstantSelected && (
          <TouchableOpacity onPress={() => setShowModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcon name="edit" size={16} color={C.muted} />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Native date picker */}
      {showDatePicker && (
        <DateTimePicker
          value={value || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={handleDateChange}
          minimumDate={minDate}
        />
      )}

      {/* Native time picker */}
      {showTimePicker && (
        <DateTimePicker
          value={value || new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={handleTimeChange}
        />
      )}

      {/* All times modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Time</Text>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <MaterialIcon name="close" size={22} color={C.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.allTimeSlotsGrid}>
                {timeSlots
                  .filter((slot) => !isToday || !slot.isPast)
                  .map((slot, index) => (
                    <TimeSlot
                      key={index}
                      slot={slot}
                      selected={value && value.getHours() === slot.hour && value.getMinutes() === slot.minute}
                      onPress={handleTimeSlotSelect}
                    />
                  ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.customTimeButton}
              onPress={() => { setShowModal(false); setShowTimePicker(true); }}
              activeOpacity={0.7}
            >
              <MaterialIcon name="schedule" size={18} color={C.selected} />
              <Text style={styles.customTimeText}>Pick exact time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickDatesContainer: {
    marginBottom: 16,
  },
  quickDatesScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  moreDatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.primaryLight,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
  },
  moreDatesText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.selected,
  },
  timeSection: {
    marginBottom: 16,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.line,
    minWidth: 82,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: C.selected,
    borderColor: C.selected,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
  },
  timeSlotTextSelected: {
    color: C.onSecondary,
  },
  moreTimesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.primaryLight,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
  },
  moreTimesText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.selected,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: C.bg,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.line,
  },
  summaryBarInstant: {
    backgroundColor: C.instantLight,
    borderColor: C.instantBorder,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },
  summaryPlaceholder: {
    color: C.muted,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: C.danger,
    marginTop: 6,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    padding: 20,
  },
  allTimeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginHorizontal: 20,
    backgroundColor: C.primaryLight,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
  },
  customTimeText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.selected,
  },
  });
};

export default DateTimePickerComponent;
