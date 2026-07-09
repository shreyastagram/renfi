/**
 * Meta App Events — Centralized Event Catalog
 *
 * SINGLE source of truth for every analytics event name in the app.
 * Never use raw event-name strings at call sites — always `EV.<NAME>`.
 *
 * Naming: client-specified names kept verbatim (Meta allows ≤40 chars,
 * letters/digits/underscores/dashes/spaces, must start with a letter).
 *
 * `STANDARD_MAP` dual-logs selected events under Meta's standard event names —
 * standard events unlock ad-delivery optimization in Meta campaigns.
 *
 * Docs: docs/META_APP_EVENTS.md (event → trigger-point map + limitations)
 */

export const EV = {
  // ── Shared (both roles) ──
  APP_OPENED: 'app_opened',
  USER_REGISTERED: 'user_registered',
  LOGIN_SUCCESS: 'login_success',
  REFERRAL_SHARED: 'referral_shared',
  REFERRAL_SUCCESS: 'referral_success',
  SERVICE_COMPLETED: 'service_completed', // role param distinguishes sides

  // ── Customer ──
  LOCATION_SELECTED: 'location_selected',
  SERVICE_SELECTED: 'service_selected',
  // SEARCH_PERFORMED intentionally absent — the app has no search feature.
  BOOKING_STARTED: 'booking_started',
  SCHEDULE_SELECTED: 'schedule_selected',
  BOOKING_ACCEPTED: 'booking_accepted',
  CUSTOMER_REVIEWED: 'customer_reviewed',
  // REPEAT_BOOKING intentionally absent — needs backend booking-history data.
  CUSTOMER_SUPPORT_CONTACTED: 'customer_support_contacted',

  // ── Provider ──
  PROFILE_COMPLETED: 'profile_completed',
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_VERIFIED: 'document_verified',
  ONLINE_STATUS_ENABLED: 'online_status_enabled',
  ONLINE_STATUS_DISABLED: 'online_status_disabled',
  JOB_REQUEST_RECEIVED: 'job_request_received',
  JOB_REQUEST_ACCEPTED: 'job_request_accepted',
  JOB_REQUEST_REJECTED: 'job_request_rejected',
  NAVIGATION_STARTED: 'navigation_started',
  SUBSCRIPTION_COMPLETED: 'Subscription_completed', // client-specified casing
  CUSTOMER_CALLED: 'customer_called',
  SUPPORT_CONTACTED: 'support_contacted',
  // RATING_RECEIVED intentionally absent — no push/notification mechanism exists.
  REPEAT_CUSTOMER_SERVED: 'repeat_customer_served',
};

/**
 * Events additionally logged under Meta STANDARD event names
 * (AppEventsLogger.AppEvents constants) for ad-optimization.
 * Key = our event name → value = fbsdk AppEvents key.
 */
export const STANDARD_MAP = {
  [EV.USER_REGISTERED]: 'CompletedRegistration',
  [EV.SCHEDULE_SELECTED]: 'Schedule',
  [EV.CUSTOMER_REVIEWED]: 'Rated',
  [EV.CUSTOMER_SUPPORT_CONTACTED]: 'Contact',
  [EV.SUPPORT_CONTACTED]: 'Contact',
  [EV.SUBSCRIPTION_COMPLETED]: 'Subscribe',
};

export default EV;
