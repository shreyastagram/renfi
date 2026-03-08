/**
 * CustomDialog Component
 *
 * Styled modal dialog that replaces native Alert.alert() across the app.
 * Supports title, message, multiple buttons (confirm/cancel/destructive),
 * and optional text input.
 *
 * Usage via DialogContext:
 *   const { showDialog, showConfirm, showInfo } = useDialog();
 *   showDialog({ title: 'Hello', message: 'World', buttons: [...] });
 *   showConfirm('Delete?', 'This cannot be undone.', onConfirm);
 *   showInfo('Done', 'Operation completed.');
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  danger: '#EF4444',
  white: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  overlay: 'rgba(15, 23, 42, 0.55)',
};

/**
 * CustomDialog — styled modal replacement for Alert.alert()
 *
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {string} props.title
 * @param {string} props.message
 * @param {Array} props.buttons - [{ text, onPress, style: 'default'|'cancel'|'destructive' }]
 * @param {Function} props.onDismiss - called when dialog closes
 */
const CustomDialog = ({ visible, title, message, buttons = [], onDismiss }) => {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handlePress = (button) => {
    if (onDismiss) onDismiss();
    if (button.onPress) button.onPress();
  };

  // Default button if none provided
  const displayButtons = buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

  // Sort: cancel buttons first (left), then default, then destructive (right)
  const sortedButtons = [...displayButtons].sort((a, b) => {
    const order = { cancel: 0, default: 1, destructive: 2 };
    return (order[a.style] || 1) - (order[b.style] || 1);
  });

  const isSingleButton = sortedButtons.length === 1;
  const isVerticalLayout = sortedButtons.length >= 3;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        const cancelBtn = displayButtons.find(b => b.style === 'cancel');
        if (cancelBtn) {
          handlePress(cancelBtn);
        } else if (onDismiss) {
          onDismiss();
        }
      }}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.dialogContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Title */}
          {title ? (
            <Text style={styles.title}>{title}</Text>
          ) : null}

          {/* Message */}
          {message ? (
            <Text style={styles.message}>{message}</Text>
          ) : null}

          {/* Buttons */}
          <View style={[
            styles.buttonRow,
            isSingleButton && styles.buttonRowSingle,
            isVerticalLayout && styles.buttonRowVertical,
          ]}>
            {sortedButtons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    isSingleButton && styles.buttonSingle,
                    !isSingleButton && !isVerticalLayout && index > 0 && styles.buttonSpaced,
                    isVerticalLayout && styles.buttonVertical,
                    isVerticalLayout && index > 0 && styles.buttonVerticalSpaced,
                    isCancel && styles.buttonCancel,
                    isDestructive && styles.buttonDestructive,
                    !isCancel && !isDestructive && styles.buttonDefault,
                  ]}
                  onPress={() => handlePress(button)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel && styles.buttonTextCancel,
                      isDestructive && styles.buttonTextDestructive,
                      !isCancel && !isDestructive && styles.buttonTextDefault,
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: BRAND.overlay,
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
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
      },
      android: {
        elevation: 12,
      },
    }),
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonRowSingle: {
    justifyContent: 'center',
  },
  buttonRowVertical: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonSingle: {
    flex: 0,
    minWidth: 140,
    paddingHorizontal: 32,
  },
  buttonSpaced: {
    marginLeft: 10,
  },
  buttonVertical: {
    flex: 0,
    width: '100%',
  },
  buttonVerticalSpaced: {
    marginTop: 8,
  },
  buttonDefault: {
    backgroundColor: BRAND.primary,
  },
  buttonCancel: {
    backgroundColor: '#F1F5F9',
  },
  buttonDestructive: {
    backgroundColor: BRAND.danger,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonTextDefault: {
    color: BRAND.white,
  },
  buttonTextCancel: {
    color: '#64748B',
  },
  buttonTextDestructive: {
    color: BRAND.white,
  },
});

export default CustomDialog;
