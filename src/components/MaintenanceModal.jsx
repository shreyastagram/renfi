/**
 * Maintenance Modal
 *
 * Full-screen blocking modal shown when the app is under maintenance.
 * Cannot be dismissed — user can only close the app.
 *
 * @version 1.0.0
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  BackHandler,
  Platform,
  Image,
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FIXHOMI_LOGO = require('../assets/fixhomi_logo.jpg');

const COLORS = {
  background: '#FFFFFF',
  darkText: '#0F172A',
  secondaryText: '#64748B',
  amber: '#D97706',
  amberLight: '#FFFBEB',
  overlay: 'rgba(0, 0, 0, 0.7)',
  primary: '#f67c16',
};

/**
 * Format a date string for display
 */
const formatTime = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return null;
  }
};

const MaintenanceModal = ({ visible, info }) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }
  }, [visible, fadeAnim, slideAnim]);

  // Block Android back button — only allow closing the app
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => backHandler.remove();
  }, [visible]);

  if (!visible || !info) return null;

  const isIOS = Platform.OS === 'ios';

  const startFormatted = formatTime(info.maintenanceStartTime);
  const endFormatted = formatTime(info.maintenanceEndTime);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => { if (Platform.OS === 'android') BackHandler.exitApp(); }}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: Math.max(24, insets.bottom),
              paddingTop: Math.max(24, insets.top),
            },
          ]}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image source={FIXHOMI_LOGO} style={styles.logo} />
          </View>

          {/* Badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Under Maintenance</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {info.maintenanceTitle || 'Scheduled Maintenance'}
          </Text>

          {/* Message */}
          <Text style={styles.message}>
            {info.maintenanceMessage || 'We are performing scheduled maintenance. The app will be back shortly.'}
          </Text>

          {/* Time Window */}
          {(startFormatted || endFormatted) && (
            <View style={styles.timeContainer}>
              {startFormatted && (
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>From</Text>
                  <Text style={styles.timeValue}>{startFormatted}</Text>
                </View>
              )}
              {endFormatted && (
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>Until</Text>
                  <Text style={styles.timeValue}>{endFormatted}</Text>
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          {info.maintenanceNotes ? (
            <View style={styles.notesContainer}>
              <Text style={styles.notesTitle}>Details</Text>
              <Text style={styles.notesText}>{info.maintenanceNotes}</Text>
            </View>
          ) : null}

          {/* Close App / Info */}
          <View style={styles.buttonContainer}>
            {isIOS ? (
              <Text style={styles.iosHint}>
                Please close the app and try again later.
              </Text>
            ) : (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => BackHandler.exitApp()}
                activeOpacity={0.8}
              >
                <Text style={styles.closeButtonText}>Close App</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.retryHint}>
              We apologise for the inconvenience
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: COLORS.background,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  logo: {
    width: 72,
    height: 72,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: COLORS.amberLight,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: COLORS.amber,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.darkText,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: COLORS.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  timeContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 13,
    color: COLORS.secondaryText,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  notesContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  iosHint: {
    fontSize: 15,
    color: COLORS.darkText,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
    paddingVertical: 16,
  },
  retryHint: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.secondaryText,
    fontWeight: '500',
  },
});

export default MaintenanceModal;
