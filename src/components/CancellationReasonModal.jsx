/**
 * CancellationReasonModal
 * 
 * Production-grade modal for collecting cancellation reasons.
 * Presents predefined reasons as selectable chips with an optional
 * free-text "Other" field. Enforces mandatory selection before submit.
 * 
 * Used by: UserHomeScreen, UserServiceHistoryScreen, ServiceRequestDetailScreen,
 *          ProviderRequestsScreen, EmergencyServicesScreen
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Predefined cancellation reasons by role ──
const USER_REASONS = [
  { id: 'found_another', label: 'Found another provider' },
  { id: 'no_longer_needed', label: 'Service no longer needed' },
  { id: 'wrong_service', label: 'Selected wrong service' },
  { id: 'scheduling_conflict', label: 'Scheduling conflict' },
  { id: 'too_expensive', label: 'Cost is too high' },
  { id: 'provider_delay', label: 'Provider took too long' },
  { id: 'personal_reason', label: 'Personal reason' },
  { id: 'other', label: 'Other' },
];

const PROVIDER_REASONS = [
  { id: 'too_far', label: 'Location too far' },
  { id: 'busy', label: 'Currently busy with another job' },
  { id: 'not_my_expertise', label: 'Not my area of expertise' },
  { id: 'scheduling_conflict', label: 'Scheduling conflict' },
  { id: 'emergency', label: 'Personal emergency' },
  { id: 'customer_unreachable', label: 'Customer not reachable' },
  { id: 'safety_concern', label: 'Safety concern' },
  { id: 'other', label: 'Other' },
];

/**
 * @param {Object} props
 * @param {boolean} props.visible - Controls modal visibility
 * @param {Function} props.onClose - Called when modal is dismissed without cancelling
 * @param {Function} props.onSubmit - Called with (reason: string) when user confirms cancel
 * @param {'user'|'provider'} props.cancellerRole - Who is cancelling (determines reason options)
 * @param {boolean} props.loading - Shows loading indicator on submit button
 * @param {string} props.serviceName - Optional service type for display context
 */
const CancellationReasonModal = ({
  visible,
  onClose,
  onSubmit,
  cancellerRole = 'user',
  loading = false,
  serviceName = '',
}) => {
  const insets = useSafeAreaInsets();
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [otherText, setOtherText] = useState('');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const otherInputRef = useRef(null);

  const reasons = cancellerRole === 'provider' ? PROVIDER_REASONS : USER_REASONS;

  // Animate in/out
  useEffect(() => {
    if (visible) {
      setSelectedReasonId(null);
      setOtherText('');
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const isOtherSelected = selectedReasonId === 'other';
  const selectedReason = reasons.find(r => r.id === selectedReasonId);

  // Build the final reason string
  const getFinalReason = useCallback(() => {
    if (!selectedReasonId) return '';
    if (isOtherSelected) {
      return otherText.trim() || 'Other reason';
    }
    return selectedReason?.label || '';
  }, [selectedReasonId, isOtherSelected, otherText, selectedReason]);

  const canSubmit = selectedReasonId && (!isOtherSelected || otherText.trim().length > 0);

  const handleSubmit = useCallback(() => {
    if (!canSubmit || loading) return;
    const reason = getFinalReason();
    onSubmit(reason);
  }, [canSubmit, loading, getFinalReason, onSubmit]);

  const handleReasonSelect = useCallback((reasonId) => {
    setSelectedReasonId(reasonId);
    if (reasonId === 'other') {
      setTimeout(() => otherInputRef.current?.focus(), 150);
    }
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={loading ? undefined : onClose}
          />
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconContainer}>
              <MaterialIcon name="cancel" size={22} color="#DC2626" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Cancel Request</Text>
              {serviceName ? (
                <Text style={styles.headerSubtitle}>{serviceName}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={loading}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialIcon name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Instruction */}
          <Text style={styles.instruction}>
            Please select a reason for cancellation
          </Text>

          {/* Reason chips */}
          <ScrollView
            style={styles.reasonsScrollView}
            contentContainerStyle={styles.reasonsContainer}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {reasons.map((reason) => {
              const isSelected = selectedReasonId === reason.id;
              return (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonChip,
                    isSelected && styles.reasonChipSelected,
                  ]}
                  onPress={() => handleReasonSelect(reason.id)}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text
                    style={[
                      styles.reasonText,
                      isSelected && styles.reasonTextSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                  {reason.id === 'other' && (
                    <MaterialIcon
                      name="edit"
                      size={16}
                      color={isSelected ? '#DC2626' : '#9CA3AF'}
                      style={{ marginLeft: 'auto' }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Other reason text input */}
            {isOtherSelected && (
              <View style={styles.otherInputContainer}>
                <TextInput
                  ref={otherInputRef}
                  style={styles.otherInput}
                  placeholder="Please describe your reason..."
                  placeholderTextColor="#9CA3AF"
                  value={otherText}
                  onChangeText={setOtherText}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                  editable={!loading}
                />
                <Text style={styles.charCount}>{otherText.length}/200</Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.actions, { paddingBottom: Math.max(16, insets.bottom) }]}>
            <TouchableOpacity
              style={styles.keepButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.keepButtonText}>Keep Request</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cancelButton,
                !canSubmit && styles.cancelButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcon name="cancel" size={18} color="#FFFFFF" />
                  <Text style={styles.cancelButtonText}>Confirm Cancel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.80,
  },
  handleBar: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instruction: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  reasonsScrollView: {
    maxHeight: SCREEN_HEIGHT * 0.38,
  },
  reasonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  reasonChipSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#DC2626',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626',
  },
  reasonText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  reasonTextSelected: {
    color: '#991B1B',
    fontWeight: '600',
  },
  otherInputContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  otherInput: {
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FEF2F2',
    minHeight: 80,
    maxHeight: 120,
    lineHeight: 20,
  },
  charCount: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
    marginRight: 4,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  keepButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  cancelButton: {
    flex: 1.3,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelButtonDisabled: {
    backgroundColor: '#FCA5A5',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default CancellationReasonModal;
