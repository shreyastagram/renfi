/**
 * Rating Modal Component
 * 
 * Industry-grade rating modal for rating service providers
 * Features:
 * - 5-star rating with animations
 * - Optional review text
 * - Submit confirmation
 * - Loading states
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
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
  Image,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  star: '#F59E0B',
  starEmpty: '#D1D5DB',
  success: '#10B981',
  white: '#FFFFFF',
};

// Rating labels
const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

const StarRating = ({ rating, onRatingChange, disabled }) => {
  const [animatedValues] = useState(
    Array(5).fill(0).map(() => new Animated.Value(1))
  );

  const handleStarPress = (starIndex) => {
    if (disabled) return;
    
    // Animate the pressed star
    Animated.sequence([
      Animated.timing(animatedValues[starIndex], {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues[starIndex], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onRatingChange(starIndex + 1);
  };

  return (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star, index) => (
        <TouchableOpacity
          key={star}
          onPress={() => handleStarPress(index)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Animated.View style={{ transform: [{ scale: animatedValues[index] }] }}>
            <MaterialIcon
              name={star <= rating ? 'star' : 'star-border'}
              size={48}
              color={star <= rating ? BRAND.star : BRAND.starEmpty}
              style={styles.star}
            />
          </Animated.View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const RatingModal = ({
  visible,
  onClose,
  onSubmit,
  providerName,
  providerProfilePicture,
  serviceName,
  requestId,
  loading = false,
}) => {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await onSubmit(requestId, rating, review);
      if (result?.success) {
        setSubmitted(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } finally {
      setSubmitting(false);
    }
  }, [rating, review, requestId, onSubmit, submitting]);

  const handleClose = useCallback(() => {
    setRating(0);
    setReview('');
    setSubmitted(false);
    setSubmitting(false);
    onClose();
  }, [onClose]);

  if (submitted) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <View style={styles.successContainer}>
            <View style={styles.successIconContainer}>
              <MaterialIcon name="check-circle" size={64} color={BRAND.success} />
            </View>
            <Text style={styles.successTitle}>Thank You!</Text>
            <Text style={styles.successText}>
              Your rating helps improve our service quality.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <MaterialIcon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.title}>Rate Your Experience</Text>
            <View style={styles.closeButton} />
          </View>

          <ScrollView 
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Provider Info */}
            <View style={styles.providerInfo}>
              {(() => {
                const picUrl = typeof providerProfilePicture === 'string' && providerProfilePicture.length > 0
                  ? providerProfilePicture
                  : providerProfilePicture?.url || null;
                return picUrl ? (
                  <Image
                    source={{ uri: picUrl }}
                    style={styles.providerImage}
                  />
                ) : (
                  <View style={styles.providerAvatar}>
                    <Text style={styles.providerInitial}>
                      {providerName?.charAt(0)?.toUpperCase() || 'P'}
                    </Text>
                  </View>
                );
              })()}
              <View style={styles.providerDetails}>
                <Text style={styles.providerName}>{providerName || 'Provider'}</Text>
                <Text style={styles.serviceName}>{serviceName || 'Service'}</Text>
              </View>
            </View>

            {/* Star Rating */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingPrompt}>How was your service?</Text>
              <StarRating
                rating={rating}
                onRatingChange={setRating}
                disabled={loading}
              />
              {rating > 0 && (
                <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
              )}
            </View>

            {/* Review Input */}
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Write a Review (Optional)</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder="Share your experience..."
                placeholderTextColor="#9CA3AF"
                value={review}
                onChangeText={setReview}
                multiline
                maxLength={500}
                editable={!loading}
              />
              <Text style={styles.charCount}>{review.length}/500</Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (rating === 0 || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={rating === 0 || submitting || loading}
            >
              {submitting || loading ? (
                <ActivityIndicator size="small" color={BRAND.white} />
              ) : (
                <>
                  <MaterialIcon name="star" size={20} color={BRAND.white} />
                  <Text style={styles.submitButtonText}>Submit Rating</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Skip Button */}
            <TouchableOpacity style={styles.skipButton} onPress={handleClose}>
              <Text style={styles.skipButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: BRAND.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: {
    padding: 24,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  providerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  providerImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
    backgroundColor: '#E5E7EB',
  },
  providerInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: BRAND.white,
  },
  providerDetails: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  serviceName: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ratingPrompt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  star: {
    marginHorizontal: 4,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND.star,
    marginTop: 12,
  },
  reviewSection: {
    marginBottom: 24,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  reviewInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.primary,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.white,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  successContainer: {
    backgroundColor: BRAND.white,
    borderRadius: 24,
    padding: 32,
    margin: 24,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  successText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default RatingModal;
