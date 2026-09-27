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

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import {
  useThemedStyles,
  useThemeColors,
} from '../theme';
import { iconAccent } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Brand colors
const makeC = (c) => ({
  brandOrangeInk: c.brandOrangeInk,
  brandOrangeBorder: c.brandOrangeBorder,
  brandOrangeFill: c.brandOrangeFill,
  star: iconAccent.star, // was #F59E0B
  starEmpty: c.borderMedium, // was #D1D5DB
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

// Rating labels
const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

const StarRating = ({ rating, onRatingChange, disabled }) => {
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
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
              color={star <= rating ? C.star : C.starEmpty}
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
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const isDismissing = useRef(false);

  useEffect(() => {
    if (visible) {
      isDismissing.current = false;
      setModalVisible(true);
      sheetTranslateY.setValue(SCREEN_HEIGHT);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 7, overshootClamping: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const animatedClose = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    Animated.parallel([
      Animated.spring(sheetTranslateY, { toValue: SCREEN_HEIGHT, useNativeDriver: true, tension: 50, friction: 7, overshootClamping: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      onClose();
    });
  }, [onClose]);

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
    animatedClose();
  }, [animatedClose]);

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
              <MaterialIcon name="check-circle" size={64} color={C.success} />
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
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.overlay, opacity: overlayOpacity }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFillObject, { justifyContent: 'flex-end', transform: [{ translateY: sheetTranslateY }] }]}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior="padding"
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <MaterialIcon name="close" size={24} color={C.textSecondary} />
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
      selectionColor={C.primary}
                style={styles.reviewInput}
                placeholder="Share your experience..."
                placeholderTextColor={C.muted}
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
                <ActivityIndicator size="small" color={C.brandOrangeInk} />
              ) : (
                <>
                  <MaterialIcon name="star" size={20} color={C.brandOrangeInk} />
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
        </Animated.View>
      </View>
    </Modal>
  );
};

const makeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: C.white,
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
    borderBottomColor: C.sunken,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  content: {
    padding: 24,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.sunken,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  providerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  providerImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
    backgroundColor: C.line,
  },
  providerInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: C.white,
  },
  providerDetails: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  serviceName: {
    fontSize: 14,
    color: C.textSecondary,
    marginTop: 4,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ratingPrompt: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textBody,
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
    color: C.star,
    marginTop: 12,
  },
  reviewSection: {
    marginBottom: 24,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textBody,
    marginBottom: 8,
  },
  reviewInput: {
    backgroundColor: C.sunken,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    fontSize: 15,
    color: C.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.brandOrangeFill,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: C.brandOrangeBorder,
  },
  submitButtonDisabled: {
    backgroundColor: C.borderMedium,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.brandOrangeInk,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textSecondary,
  },
  successContainer: {
    backgroundColor: C.white,
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
    color: C.text,
    marginBottom: 8,
  },
  successText: {
    fontSize: 15,
    color: C.textSecondary,
    textAlign: 'center',
  },
  });
};

export default RatingModal;
