/**
 * CustomDialog Component
 *
 * Platform-specific alert dialog:
 *   - iOS: Rich frosted glass card with pill buttons, feels personal to iOS
 *   - Android: Material card with filled buttons (unchanged)
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_IOS = Platform.OS === 'ios';

const BRAND = {
  primary: '#f67c16',
  danger: '#EF4444',
  white: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
};

const CustomDialog = ({ visible, title, message, buttons = [], onDismiss }) => {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(IS_IOS ? 0.92 : 0.85);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: IS_IOS ? 250 : 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: IS_IOS ? 220 : 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(IS_IOS ? 0.92 : 0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handlePress = (button) => {
    if (onDismiss) onDismiss();
    if (button.onPress) button.onPress();
  };

  const displayButtons = buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

  const sortedButtons = [...displayButtons].sort((a, b) => {
    const order = { cancel: 0, default: 1, destructive: 2 };
    return (order[a.style] || 1) - (order[b.style] || 1);
  });

  // Separate cancel from action buttons
  const cancelButton = sortedButtons.find(b => b.style === 'cancel');
  const actionButtons = sortedButtons.filter(b => b.style !== 'cancel');
  const isSingleButton = sortedButtons.length === 1;

  // ─── iOS: Rich frosted glass ──────────────────────────────────
  if (IS_IOS) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => {
          if (cancelButton) handlePress(cancelButton);
          else if (onDismiss) onDismiss();
        }}
      >
        <Animated.View style={[iosStyles.overlay, { opacity: opacityAnim }]}>
          <Animated.View
            style={[
              iosStyles.dialogWrap,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            {/* Main card */}
            <View style={iosStyles.cardOuter}>
              <BlurView
                style={iosStyles.blurFill}
                blurType="light"
                blurAmount={80}
                reducedTransparencyFallbackColor="#F2F2F7"
              >
                {/* Content */}
                <View style={iosStyles.content}>
                  {title ? <Text style={iosStyles.title}>{title}</Text> : null}
                  {message ? (
                    <Text style={[iosStyles.message, !title && { marginTop: 0 }]}>
                      {message}
                    </Text>
                  ) : null}
                </View>

                {/* Action buttons */}
                <View style={iosStyles.actionsWrap}>
                  {isSingleButton ? (
                    // Single button — full width pill
                    <TouchableOpacity
                      style={iosStyles.primaryBtn}
                      onPress={() => handlePress(sortedButtons[0])}
                      activeOpacity={0.7}
                    >
                      <Text style={iosStyles.primaryBtnText}>
                        {sortedButtons[0].text || 'OK'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      {/* Action buttons (non-cancel) */}
                      {actionButtons.map((button, index) => {
                        const isDestructive = button.style === 'destructive';
                        return (
                          <TouchableOpacity
                            key={index}
                            style={[
                              iosStyles.primaryBtn,
                              isDestructive && iosStyles.destructiveBtn,
                              index > 0 && { marginTop: 8 },
                            ]}
                            onPress={() => handlePress(button)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                iosStyles.primaryBtnText,
                                isDestructive && iosStyles.destructiveBtnText,
                              ]}
                            >
                              {button.text || 'OK'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}
                </View>
              </BlurView>
            </View>

            {/* Cancel button — separate card below (iOS action sheet pattern) */}
            {cancelButton && !isSingleButton && (
              <View style={iosStyles.cancelOuter}>
                <BlurView
                  style={iosStyles.blurFill}
                  blurType="light"
                  blurAmount={80}
                  reducedTransparencyFallbackColor="#F2F2F7"
                >
                  <TouchableOpacity
                    style={iosStyles.cancelBtn}
                    onPress={() => handlePress(cancelButton)}
                    activeOpacity={0.7}
                  >
                    <Text style={iosStyles.cancelBtnText}>
                      {cancelButton.text || 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                </BlurView>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  }

  // ─── Android (unchanged) ──────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (cancelButton) handlePress(cancelButton);
        else if (onDismiss) onDismiss();
      }}
    >
      <View style={androidStyles.overlay}>
        <Animated.View
          style={[
            androidStyles.dialogContainer,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {title ? <Text style={androidStyles.title}>{title}</Text> : null}
          {message ? <Text style={androidStyles.message}>{message}</Text> : null}

          <View style={[
            androidStyles.buttonRow,
            isSingleButton && androidStyles.buttonRowSingle,
            sortedButtons.length >= 3 && androidStyles.buttonRowVertical,
          ]}>
            {sortedButtons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    androidStyles.button,
                    isSingleButton && androidStyles.buttonSingle,
                    !isSingleButton && sortedButtons.length < 3 && index > 0 && androidStyles.buttonSpaced,
                    sortedButtons.length >= 3 && androidStyles.buttonVertical,
                    sortedButtons.length >= 3 && index > 0 && androidStyles.buttonVerticalSpaced,
                    isCancel && androidStyles.buttonCancel,
                    isDestructive && androidStyles.buttonDestructive,
                    !isCancel && !isDestructive && androidStyles.buttonDefault,
                  ]}
                  onPress={() => handlePress(button)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      androidStyles.buttonText,
                      isCancel && androidStyles.buttonTextCancel,
                      isDestructive && androidStyles.buttonTextDestructive,
                      !isCancel && !isDestructive && androidStyles.buttonTextDefault,
                    ]}
                    numberOfLines={1}
                  >
                    {button.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── iOS Styles ───────────────────────────────────────────────────
const iosStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  dialogWrap: {
    width: Math.min(SCREEN_WIDTH - 56, 300),
  },
  cardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  blurFill: {
    // BlurView — no explicit bg, native blur does the work
  },
  content: {
    paddingTop: 28,
    paddingBottom: 6,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: -0.45,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(0, 0, 0, 0.55)',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: -0.15,
    marginTop: 6,
  },
  actionsWrap: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
  },
  primaryBtn: {
    backgroundColor: 'rgba(0, 122, 255, 1)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.41,
  },
  destructiveBtn: {
    backgroundColor: 'rgba(255, 59, 48, 1)',
  },
  destructiveBtnText: {
    color: '#FFFFFF',
  },
  cancelOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 10,
  },
  cancelBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: -0.41,
  },
});

// ─── Android Styles (unchanged) ───────────────────────────────────
const androidStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  dialogContainer: {
    width: Math.min(SCREEN_WIDTH - 48, 360),
    backgroundColor: BRAND.white,
    borderRadius: 22,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 22,
    elevation: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.text,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    color: BRAND.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  buttonRowSingle: { justifyContent: 'center' },
  buttonRowVertical: { flexDirection: 'column' },
  button: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  buttonSingle: { flex: 0, minWidth: 140, paddingHorizontal: 32 },
  buttonSpaced: { marginLeft: 10 },
  buttonVertical: { flex: 0, width: '100%' },
  buttonVerticalSpaced: { marginTop: 8 },
  buttonDefault: { backgroundColor: BRAND.primary },
  buttonCancel: { backgroundColor: '#F1F5F9' },
  buttonDestructive: { backgroundColor: BRAND.danger },
  buttonText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  buttonTextDefault: { color: BRAND.white },
  buttonTextCancel: { color: '#64748B' },
  buttonTextDestructive: { color: BRAND.white },
});

export default CustomDialog;
