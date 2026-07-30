/**
 * Device performance tier — SINGLE place for "is this a weak device?"
 * decisions. Consumers gate cosmetic GPU work (shimmer sweeps, etc.) here
 * instead of inventing their own heuristics.
 *
 * Heuristic: Android below 12 (API 31) or ≤6 GB RAM ⇒ low-end. Catches the
 * Redmi-12/Helio-G88/Mali-G52 class where continuous Animated loops and
 * blur produce visible flicker, while 8 GB+ devices keep the full polish.
 * (GPU model isn't queryable from JS — RAM+API is the best available proxy.)
 */
import { Platform } from 'react-native';

let totalMemBytes = 0;
try {
  totalMemBytes = require('react-native-device-info').default.getTotalMemorySync();
} catch (e) {
  // device-info unavailable — treat as capable (no gating).
}

const SIX_GB = 6 * 1024 * 1024 * 1024;

export const IS_LOW_END_ANDROID = Platform.OS === 'android' && (
  Number(Platform.Version) < 31 ||
  (totalMemBytes > 0 && totalMemBytes <= SIX_GB)
);

export default { IS_LOW_END_ANDROID };
