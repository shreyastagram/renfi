/**
 * useExitConfirmation Hook
 *
 * Shows a branded confirmation dialog when the user presses the hardware
 * back button on a root screen. Android only.
 *
 * Uses native ExitApp module to truly kill the process (not just minimize).
 *
 * @version 2.0.0
 */

import { useCallback } from 'react';
import { BackHandler, Platform, NativeModules } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDialog } from '../context/DialogContext';

const exitApp = () => {
  if (NativeModules.ExitApp?.exit) {
    // Native module: finishAndRemoveTask + killProcess (truly closes the app)
    NativeModules.ExitApp.exit();
  } else {
    // Fallback: standard RN (moves to background)
    BackHandler.exitApp();
  }
};

const useExitConfirmation = (enabled = true) => {
  const { dialog } = useDialog();

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || !enabled) return;

      const onBackPress = () => {
        dialog(
          'Exit Fixhomi',
          'Are you sure you want to exit the app?',
          [
            { text: 'Stay', style: 'cancel' },
            { text: 'Exit', style: 'destructive', onPress: exitApp },
          ]
        );
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [enabled, dialog])
  );
};

export default useExitConfirmation;
