/**
 * App Update Modal
 *
 * Full-screen modal shown when an app update is available.
 *
 * Behavior:
 * - Critical/Force update: No dismiss option, must update or close app
 * - Optional update: Can dismiss once, won't show again for that version
 * - Auto-redirect: Opens store page automatically (when auto-update is ON)
 *
 * @version 1.0.0
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  BackHandler,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dismissUpdate, openStorePage } from '../services/appUpdateService';

const FIXHOMI_LOGO = require('../assets/fixhomi_logo.jpg');

const COLORS = {
  primary: '#f67c16',
  primaryDark: '#e06b0a',
  background: '#FFFFFF',
  darkText: '#0F172A',
  secondaryText: '#64748B',
  border: '#E2E8F0',
  criticalRed: '#DC2626',
  criticalRedLight: '#FEF2F2',
  updateGreen: '#059669',
  updateGreenLight: '#ECFDF5',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

const AppUpdateModal = ({
  visible,
  updateInfo,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const isCritical = updateInfo?.forceUpdate || updateInfo?.isCritical;
  const autoRedirectTimerRef = useRef(null);

  const handleUpdate = useCallback(() => {
    openStorePage(updateInfo?.storeUrl);
  }, [updateInfo?.storeUrl]);

  const handleDismiss = useCallback(async () => {
    // Save dismissed version first, then close modal
    if (updateInfo?.latestVersion) {
      await dismissUpdate(updateInfo.latestVersion);
    }
    onDismiss?.();
  }, [updateInfo?.latestVersion, onDismiss]);

  const handleCloseApp = useCallback(() => {
    BackHandler.exitApp();
  }, []);

  // Animate in/out and handle auto-redirect
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

      // Auto-redirect to store if auto-update is on
      if (updateInfo?.autoRedirect && !isCritical) {
        autoRedirectTimerRef.current = setTimeout(() => {
          handleUpdate();
        }, 1500);
      }
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }

    // Always clean up timer on unmount or when visible/updateInfo changes
    return () => {
      if (autoRedirectTimerRef.current) {
        clearTimeout(autoRedirectTimerRef.current);
        autoRedirectTimerRef.current = null;
      }
    };
  }, [visible, updateInfo, isCritical, handleUpdate]);

  // Handle Android back button
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isCritical) {
        BackHandler.exitApp();
        return true;
      }
      handleDismiss();
      return true;
    });

    return () => backHandler.remove();
  }, [visible, isCritical, handleDismiss]);

  if (!visible || !updateInfo) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (isCritical) {
          BackHandler.exitApp();
        } else {
          handleDismiss();
        }
      }}
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
          <View style={[
            styles.badge,
            isCritical ? styles.badgeCritical : styles.badgeOptional,
          ]}>
            <Text style={[
              styles.badgeText,
              isCritical ? styles.badgeTextCritical : styles.badgeTextOptional,
            ]}>
              {isCritical ? 'Required Update' : 'Update Available'}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {updateInfo.updateTitle || (isCritical ? 'Update Required' : 'Update Available')}
          </Text>

          {/* Message */}
          <Text style={styles.message}>
            {updateInfo.updateMessage ||
              (isCritical
                ? 'A critical update is required to continue using FixHomi. Please update to the latest version.'
                : 'A new version of FixHomi is available with improvements and bug fixes.')}
          </Text>

          {/* Version info */}
          <View style={styles.versionRow}>
            <View style={styles.versionItem}>
              <Text style={styles.versionLabel}>Current</Text>
              <Text style={styles.versionValue}>{updateInfo.currentVersion}</Text>
            </View>
            <View style={styles.versionArrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
            <View style={styles.versionItem}>
              <Text style={styles.versionLabel}>Latest</Text>
              <Text style={[styles.versionValue, styles.versionValueNew]}>
                {updateInfo.latestVersion}
              </Text>
            </View>
          </View>

          {/* Release notes */}
          {updateInfo.releaseNotes ? (
            <View style={styles.releaseNotes}>
              <Text style={styles.releaseNotesTitle}>What's New</Text>
              <Text style={styles.releaseNotesText}>{updateInfo.releaseNotes}</Text>
            </View>
          ) : null}

          {/* Auto-redirect notice */}
          {updateInfo.autoRedirect && !isCritical ? (
            <Text style={styles.autoRedirectText}>
              Opening {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}...
            </Text>
          ) : null}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdate}
              activeOpacity={0.8}
            >
              <Text style={styles.updateButtonText}>
                Update Now
              </Text>
            </TouchableOpacity>

            {isCritical ? (
              <TouchableOpacity
                style={styles.closeAppButton}
                onPress={handleCloseApp}
                activeOpacity={0.7}
              >
                <Text style={styles.closeAppButtonText}>Close App</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissButtonText}>Not Now</Text>
              </TouchableOpacity>
            )}
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
  },
  badgeCritical: {
    backgroundColor: COLORS.criticalRedLight,
  },
  badgeOptional: {
    backgroundColor: COLORS.updateGreenLight,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeTextCritical: {
    color: COLORS.criticalRed,
  },
  badgeTextOptional: {
    color: COLORS.updateGreen,
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
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    width: '100%',
  },
  versionItem: {
    alignItems: 'center',
    flex: 1,
  },
  versionLabel: {
    fontSize: 12,
    color: COLORS.secondaryText,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  versionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  versionValueNew: {
    color: COLORS.primary,
  },
  versionArrow: {
    paddingHorizontal: 12,
  },
  arrowText: {
    fontSize: 20,
    color: COLORS.secondaryText,
  },
  releaseNotes: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  releaseNotesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: 8,
  },
  releaseNotesText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    lineHeight: 20,
  },
  autoRedirectText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 16,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  updateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  dismissButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: COLORS.secondaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  closeAppButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeAppButtonText: {
    color: COLORS.criticalRed,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AppUpdateModal;
