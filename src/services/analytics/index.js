/**
 * Meta App Events — public API.
 *
 *   import { Analytics, EV, onceEver, oncePerSession } from '../services/analytics';
 *   ...
 *   Analytics.track(EV.BOOKING_STARTED, { service_type: 'plumber' });
 *
 * Never import react-native-fbsdk-next directly anywhere else.
 * Event map + limitations: docs/META_APP_EVENTS.md
 */

export { default as Analytics } from './analytics';
export { EV, STANDARD_MAP } from './events';
export { onceEver, oncePerSession } from './dedupe';
