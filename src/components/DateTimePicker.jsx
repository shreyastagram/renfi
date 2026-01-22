/**
 * DateTime Picker Component
 * 
 * Production-grade date and time picker with:
 * - Date selection with calendar
 * - Time selection
 * - Minimum date/time validation
 * - Cross-platform support (iOS/Android)
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from './Icon';

/**
 * Quick date options generator
 */
const generateQuickDateOptions = () => {
  const options = [];
  const now = new Date();
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    date.setHours(0, 0, 0, 0);
    
    let label;
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Tomorrow';
    else label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    options.push({
      date,
      label,
      shortLabel: i <= 1 ? label : date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
    });
  }
  
  return options;
};

/**
 * Quick time slots generator
 */
const generateTimeSlots = () => {
  const slots = [];
  const now = new Date();
  const currentHour = now.getHours();
  
  // Generate slots from 6 AM to 9 PM
  for (let hour = 6; hour <= 21; hour++) {
    slots.push({
      hour,
      minute: 0,
      label: formatTime(hour, 0),
      isPast: hour <= currentHour,
    });
    
    if (hour < 21) {
      slots.push({
        hour,
        minute: 30,
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

/**
 * Date Chip Component
 */
const DateChip = ({ option, selected, onPress, disabled }) => (
  <TouchableOpacity
    style={[
      styles.dateChip,
      selected && styles.dateChipSelected,
      disabled && styles.dateChipDisabled,
    ]}
    onPress={() => !disabled && onPress(option)}
    disabled={disabled}
    activeOpacity={0.7}
  >
    <Text style={[
      styles.dateChipText,
      selected && styles.dateChipTextSelected,
      disabled && styles.dateChipTextDisabled,
    ]}>
      {option.shortLabel}
    </Text>
  </TouchableOpacity>
);

/**
 * Time Slot Component
 */
const TimeSlot = ({ slot, selected, onPress, disabled }) => (
  <TouchableOpacity
    style={[
      styles.timeSlot,
      selected && styles.timeSlotSelected,
      disabled && styles.timeSlotDisabled,
    ]}
    onPress={() => !disabled && onPress(slot)}
    disabled={disabled}
    activeOpacity={0.7}
  >
    <Text style={[
      styles.timeSlotText,
      selected && styles.timeSlotTextSelected,
      disabled && styles.timeSlotTextDisabled,
    ]}>
      {slot.label}
    </Text>
  </TouchableOpacity>
);

/**
 * DateTime Picker Component
 * 
 * @param {Date} value - Selected date/time
 * @param {Function} onChange - Callback when date/time changes
 * @param {Function} onDateTimeChange - Alternative callback (legacy support)
 * @param {Date} initialDate - Initial date value (legacy support)
 * @param {Date} initialTime - Initial time value (legacy support)
 * @param {Date} minimumDate - Minimum selectable date (default: now)
 * @param {boolean} showTime - Whether to show time picker
 * @param {string} label - Label for the picker
 * @param {string} placeholder - Placeholder text
 */
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
  // Support both new and legacy props
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
  
  // Handle change - support both onChange and onDateTimeChange
  const handleValueChange = useCallback((newValue) => {
    setInternalValue(newValue);
    
    if (onChangeProp) {
      onChangeProp(newValue);
    }
    
    if (onDateTimeChange) {
      // Legacy format: { date, time }
      onDateTimeChange({
        date: newValue,
        time: newValue,
      });
    }
  }, [onChangeProp, onDateTimeChange]);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const quickDates = generateQuickDateOptions();
  const timeSlots = generateTimeSlots();
  
  const minDate = minimumDate || new Date();
  
  const handleDateChange = useCallback((event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      const newDate = new Date(value || new Date());
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      handleValueChange(newDate);
    }
  }, [value, handleValueChange]);
  
  const handleTimeChange = useCallback((event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (selectedTime) {
      const newDate = new Date(value || new Date());
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      handleValueChange(newDate);
    }
  }, [value, handleValueChange]);
  
  const handleQuickDateSelect = useCallback((option) => {
    const newDate = new Date(option.date);
    if (value) {
      newDate.setHours(value.getHours());
      newDate.setMinutes(value.getMinutes());
    } else {
      // Default to next available slot
      const now = new Date();
      if (option.date.toDateString() === now.toDateString()) {
        // Today - set to next hour
        newDate.setHours(now.getHours() + 1);
        newDate.setMinutes(0);
      } else {
        // Future date - set to 9 AM
        newDate.setHours(9);
        newDate.setMinutes(0);
      }
    }
    handleValueChange(newDate);
  }, [value, handleValueChange]);
  
  const handleTimeSlotSelect = useCallback((slot) => {
    const newDate = new Date(value || new Date());
    newDate.setHours(slot.hour);
    newDate.setMinutes(slot.minute);
    handleValueChange(newDate);
    setShowModal(false);
  }, [value, handleValueChange]);
  
  const isToday = value && value.toDateString() === new Date().toDateString();
  
  const formatDisplayValue = () => {
    if (!value) return placeholder;
    
    const dateStr = value.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    
    if (showTime) {
      const timeStr = value.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `${dateStr} at ${timeStr}`;
    }
    
    return dateStr;
  };
  
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      {/* Quick Date Selection */}
      <View style={styles.quickDatesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickDatesScroll}
        >
          {quickDates.slice(0, 7).map((option, index) => (
            <DateChip
              key={index}
              option={option}
              selected={value && value.toDateString() === option.date.toDateString()}
              onPress={handleQuickDateSelect}
            />
          ))}
          <TouchableOpacity
            style={styles.moreDatesButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Icon name="calendar" size={18} color="#3B82F6" />
            <Text style={styles.moreDatesText}>More</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      
      {/* Time Selection */}
      {showTime && value && (
        <View style={styles.timeSection}>
          <Text style={styles.timeSectionTitle}>
            <Icon name="clock" size={16} color="#6B7280" /> Select Time
          </Text>
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
            >
              <Text style={styles.moreTimesText}>More times...</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Selected Value Display */}
      <TouchableOpacity
        style={[styles.valueDisplay, error && styles.valueDisplayError]}
        onPress={() => setShowModal(true)}
      >
        <Icon name="calendar" size={20} color="#6B7280" />
        <Text style={[styles.valueText, !value && styles.valuePlaceholder]}>
          {formatDisplayValue()}
        </Text>
        <Icon name="edit" size={18} color="#6B7280" />
      </TouchableOpacity>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      {/* Date Picker Modal (Android native) */}
      {showDatePicker && (
        <DateTimePicker
          value={value || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={handleDateChange}
          minimumDate={minDate}
        />
      )}
      
      {/* Time Picker Modal (Android native) */}
      {showTimePicker && (
        <DateTimePicker
          value={value || new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={handleTimeChange}
        />
      )}
      
      {/* Full Modal for more options */}
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
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Icon name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
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
              onPress={() => {
                setShowModal(false);
                setShowTimePicker(true);
              }}
            >
              <Icon name="clock" size={20} color="#3B82F6" />
              <Text style={styles.customTimeText}>Select custom time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  quickDatesContainer: {
    marginBottom: 12,
  },
  quickDatesScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  dateChipDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.5,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  dateChipTextSelected: {
    color: '#FFFFFF',
  },
  dateChipTextDisabled: {
    color: '#9CA3AF',
  },
  moreDatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
  },
  moreDatesText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  timeSection: {
    marginBottom: 12,
  },
  timeSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: '#2563EB',
  },
  timeSlotDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.5,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  timeSlotTextSelected: {
    color: '#FFFFFF',
  },
  timeSlotTextDisabled: {
    color: '#9CA3AF',
  },
  moreTimesButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  moreTimesText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3B82F6',
  },
  valueDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  valueDisplayError: {
    borderColor: '#EF4444',
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  valuePlaceholder: {
    color: '#9CA3AF',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalScroll: {
    padding: 16,
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
    padding: 16,
    marginHorizontal: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
  },
  customTimeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
});

export default DateTimePickerComponent;
