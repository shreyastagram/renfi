/**
 * SafeBlurView — device-class gate for @react-native-community/blur.
 *
 * Android's BlurView renders through a GPU texture-copy loop that visibly
 * flickers/repaints on weak GPUs (Mali-G52 class: Redmi 12 and similar
 * low-end devices) — a driver of the "renders, blanks, renders" jitter
 * reports (docs/PENDING_STABILITY_WORK_2026-07.md §C). Blur is cosmetic,
 * so this release keeps native blur iOS-only; Android always renders the
 * flat fallback color (each call site's reducedTransparencyFallbackColor).
 *
 * To re-enable Android blur for capable devices later, widen
 * DEVICE_SUPPORTS_BLUR here — do NOT re-import the lib directly at call sites.
 */
import React from 'react';
import { Platform, View } from 'react-native';
import { BlurView as NativeBlurView } from '@react-native-community/blur';

export const DEVICE_SUPPORTS_BLUR = Platform.OS === 'ios';

export const BlurView = ({
  blurType,
  blurAmount,
  reducedTransparencyFallbackColor,
  overlayColor,
  style,
  children,
  ...rest
}) => {
  if (DEVICE_SUPPORTS_BLUR) {
    return (
      <NativeBlurView
        blurType={blurType}
        blurAmount={blurAmount}
        reducedTransparencyFallbackColor={reducedTransparencyFallbackColor}
        overlayColor={overlayColor}
        style={style}
        {...rest}
      >
        {children}
      </NativeBlurView>
    );
  }
  const fallback = reducedTransparencyFallbackColor
    || (String(blurType || '').toLowerCase().includes('dark')
      ? 'rgba(15, 23, 42, 0.92)'
      : 'rgba(255, 255, 255, 0.92)');
  return (
    <View style={[style, { backgroundColor: fallback }]} {...rest}>
      {children}
    </View>
  );
};

export default BlurView;
