/**
 * DialogContext
 *
 * Global dialog provider that replaces Alert.alert() with styled CustomDialog.
 * Wrap at the app root level, then use useDialog() anywhere.
 *
 * API matches Alert.alert() signature for easy migration:
 *   Alert.alert(title, message, buttons)
 *   becomes
 *   dialog(title, message, buttons)
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import CustomDialog from '../components/CustomDialog';

const DialogContext = createContext(null);

/**
 * DialogProvider — mount once at the app root
 */
export const DialogProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  /**
   * Show a dialog. Same signature as Alert.alert():
   *   dialog(title, message?, buttons?)
   */
  const dialog = useCallback((title, message, buttons) => {
    setDialogState({
      visible: true,
      title: title || '',
      message: message || '',
      buttons: buttons || [{ text: 'OK', style: 'default' }],
    });
  }, []);

  /**
   * Show a dialog with full options object:
   *   showDialog({ title, message, buttons })
   */
  const showDialog = useCallback((options) => {
    setDialogState({
      visible: true,
      title: options.title || '',
      message: options.message || '',
      buttons: options.buttons || [{ text: 'OK', style: 'default' }],
    });
  }, []);

  /**
   * Convenience: confirmation dialog with Cancel + Confirm
   */
  const showConfirm = useCallback((title, message, onConfirm, confirmText = 'Confirm') => {
    setDialogState({
      visible: true,
      title,
      message: message || '',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmText, style: 'default', onPress: onConfirm },
      ],
    });
  }, []);

  /**
   * Convenience: destructive confirmation (Delete, Remove, etc.)
   */
  const showDestructive = useCallback((title, message, onConfirm, confirmText = 'Delete') => {
    setDialogState({
      visible: true,
      title,
      message: message || '',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmText, style: 'destructive', onPress: onConfirm },
      ],
    });
  }, []);

  /**
   * Convenience: simple info dialog with OK button
   */
  const showInfo = useCallback((title, message) => {
    setDialogState({
      visible: true,
      title,
      message: message || '',
      buttons: [{ text: 'OK', style: 'default' }],
    });
  }, []);

  const dismissDialog = useCallback(() => {
    setDialogState(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <DialogContext.Provider value={{ dialog, showDialog, showConfirm, showDestructive, showInfo }}>
      {children}
      <CustomDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        buttons={dialogState.buttons}
        onDismiss={dismissDialog}
      />
    </DialogContext.Provider>
  );
};

/**
 * Hook to access dialog functions from any component.
 *
 * Returns:
 * - dialog(title, message?, buttons?) — drop-in Alert.alert() replacement
 * - showDialog({ title, message, buttons })
 * - showConfirm(title, message, onConfirm, confirmText?)
 * - showDestructive(title, message, onConfirm, confirmText?)
 * - showInfo(title, message)
 */
export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    // Fallback to native Alert if context not available
    return {
      dialog: require('react-native').Alert.alert,
      showDialog: ({ title, message, buttons }) => require('react-native').Alert.alert(title, message, buttons),
      showConfirm: (title, message, onConfirm, text) => require('react-native').Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: text || 'Confirm', onPress: onConfirm },
      ]),
      showDestructive: (title, message, onConfirm, text) => require('react-native').Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: text || 'Delete', style: 'destructive', onPress: onConfirm },
      ]),
      showInfo: (title, message) => require('react-native').Alert.alert(title, message, [{ text: 'OK' }]),
    };
  }
  return ctx;
};
