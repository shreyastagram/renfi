# Meta App Events — Integration Tracker

**Status:** 🟡 Implemented in app · ⏳ awaiting Meta Console configuration
**Branch:** `feature/profile-redesign`
**Started:** 2026-07-09
**SDK:** `react-native-fbsdk-next` v13.4.3 (native dep — requires `pod install` + full rebuild)

> Living document. Track implementation state, decisions, limitations, console TODOs,
> and **log any future bugs/issues in the "Issues Log" section at the bottom.**

---

## 1. Credentials & Identifiers

| Item | Value |
|---|---|
| Meta App ID | `1313159510169603` |
| Meta Client Token | `f4006a48dbb2a05589073394e01a74f0` (client tokens are designed to ship in apps — NOT secret) |
| iOS bundle ID | `com.fixhomi.app` |
| Android package | `com.renfi` ⚠️ differs from iOS — BOTH must be registered in the Meta app |
| ⛔ App Secret | must NEVER be added to the app or repo if ever received |

## 2. Architecture

```
src/services/analytics/
  index.js      → public API (Analytics, EV)
  analytics.js  → core: lazy SDK access, track(), safe no-op if SDK missing,
                  param sanitization (≤40-char names, ≤25 params, str/num only),
                  __DEV__ console echo, standard-event dual-logging, logPurchase
  events.js     → EV catalog — every event name + meta (role, standard-event mapping).
                  SINGLE source of truth; no raw strings at call sites.
  dedupe.js     → onceEver(key) via AsyncStorage + oncePerSession(key) in-memory
```

Rules:
- Screens/services **never** import the FB SDK directly — only `Analytics` / `EV`.
- Events fire **only after the action definitively succeeded** (API success / SDK resolve).
- One-shot events are deduped (per requestId / per category / per user) so
  socket + FCM double-delivery or re-renders never double-log.
- If the SDK is unavailable or unconfigured, everything silently no-ops (never crashes).

## 3. Event Map (who fires what, where)

### Customer

| Event | Status | Trigger point | Dedupe |
|---|---|---|---|
| `app_opened` | ✅ | `App.tsx` cold start (+ Meta auto app-launch event) | per cold start |
| `user_registered` | ✅ | `AppContext.handleAuthSuccess` when `isNewUser===true` (covers phone OTP / Google / Apple / provider reg) | onceEver per userId |
| `login_success` | ✅ | same hook, `isNewUser` falsy | — |
| `location_selected` | ✅ | GPS success (`LocationContext`), address pick (`CreateServiceRequestScreen.handleSelectAddress`) | GPS: per session |
| `service_selected` | ✅ | `UserHomeScreen.handleServiceSelect` (after gates pass) | — |
| `booking_started` | ✅ | same select success + `CreateServiceRequestScreen` mount | — |
| `schedule_selected` | ✅ | date/time chosen in booking flow (both paths) | — |
| `booking_accepted` | ✅ | `GlobalBanner` socket `request:accepted` + FCM accepted types (user role) | per requestId (ever) |
| `service_completed` | ✅ | `GlobalBanner` socket/FCM completed types (user role) | per requestId (ever) |
| `customer_reviewed` | ✅ | `traditionalServiceService.submitRating` success (covers both rating UIs) | — |
| `repeat_booking` | ⛔ NOT IMPLEMENTED | no booking-history data at booking time; needs backend | — |
| `referral_shared` | ✅ | `ReferralScreen.handleShare` after `Share.share` (non-dismissed) | — |
| `referral_success` | ✅ (referred side only) | `referralService.applyReferralCode` success | onceEver per user |
| `customer_support_contacted` | ✅ | `SettingsScreen` WhatsApp/email/site taps (user role) | — |

### Provider

| Event | Status | Trigger point | Dedupe |
|---|---|---|---|
| `app_opened` / `user_registered` / `login_success` | ✅ | shared hooks above (role param) | — |
| `profile_completed` | ✅ (== registration) | provider registration success (single-submit form; no separate "complete profile" state exists) | onceEver per userId |
| `document_uploaded` | ✅ | `DocumentVerificationScreen.handleSubmit` per-service success | — |
| `document_verified` | ⚠️ fetch-diff | `AppContext.refreshProfile`: newly-appeared `verifiedServiceCategories` — fires on next app use after approval, NOT at approval moment | onceEver per category |
| `online_status_enabled` / `_disabled` | ✅ | `AppContext.updateProviderAvailability` API success | — |
| `job_request_received` | ✅ | `GlobalBanner` FCM `new_request`/socket `new:request` (provider role) | per requestId (ever) |
| `job_request_accepted` | ✅ | `traditionalServiceService.acceptRequestAsProvider` success (covers both UIs) | — |
| `job_request_rejected` | ✅ | both reject-success points (detail screen + history screen) | — |
| `navigation_started` | ✅ | Directions tap (`ProviderServiceHistoryScreen`, `LiveTrackingScreen`) | per requestId (ever) |
| `service_completed` | ✅ | `verifyCompletionOtp` success (role=provider) | — |
| `Subscription_completed` | ⚠️ Android only | `SubscriptionScreen.handleSubscribe` success — with amount/currency; dual-logs Meta `Subscribe` + `logPurchase` for value optimization. **iOS pays via external web — no in-app event (by design, not faked)** | — |
| `customer_called` | ✅ | Call Now taps (detail / history / live-tracking screens) | — |
| `support_contacted` | ✅ | `SettingsScreen` taps (provider role) | — |
| `rating_received` | ⛔ NOT IMPLEMENTED | no push/notification for new ratings exists; aggregate-only. Needs backend push or Conversions API | — |
| `repeat_customer_served` | ✅ | provider completion success when `request.userDetails.isRepeatCustomer===true` | per requestId (ever) |
| `referral_shared` | ✅ | shared ReferralScreen (role param) | — |
| `referral_success` | ✅ (registration-with-code) | provider registration success with non-empty referralCode | onceEver per user |
| `search_performed` | ⛔ NOT IMPLEMENTED | app has no search feature (category grid only) — per decision, not repurposed | — |

### Standard-event dual logging (ad-optimization)
- `user_registered` → `CompleteRegistration`
- `schedule_selected` → `Schedule`
- `customer_reviewed` → `Rate`
- `customer_support_contacted`/`support_contacted` → `Contact`
- `Subscription_completed` → `Subscribe` + `logPurchase(amount, INR)`

## 4. Native configuration (done in app)

- **iOS** `Info.plist`: `FacebookAppID`, `FacebookClientToken`, `FacebookDisplayName`,
  `FacebookAutoLogAppEventsEnabled=true`, SKAdNetwork IDs (`v9wttpbfk9`, `n38lu8286q`).
- **iOS** `AppDelegate.swift`: `ApplicationDelegate.shared.application(...)` init.
- **Android** `strings.xml`: `facebook_app_id`, `facebook_client_token`;
  `AndroidManifest.xml`: `com.facebook.sdk.ApplicationId` + `ClientToken` meta-data.
- **ATT prompt: intentionally NOT implemented** (decision 2026-07-09). Events log without
  it; only IDFA-based attribution is limited. Revisit in a future release if needed.

## 5. ⏳ Meta Developer Console TODO (once client grants access)

- [ ] Verify App ID `1313159510169603` is the correct app + is Live (not Dev mode — Dev mode only logs events from registered testers)
- [ ] Add **iOS platform**: bundle `com.fixhomi.app`
- [ ] Add **Android platform**: package `com.renfi`, class `com.renfi.MainActivity`, **release + debug key hashes**
- [ ] Confirm the Client Token matches (App Settings → Advanced → Client Token)
- [ ] Events Manager → Test Events: verify each event arrives from a test device
- [ ] Configure Aggregated Event Measurement priorities for iOS campaigns (8-slot limit — suggest: Subscribe/Purchase > user_registered > booking_accepted > service_completed > booking_started > schedule_selected > login_success > app_opened)
- [ ] If value optimization wanted: verify `Subscribe`/`Purchase` value+currency arrive

## 6. Known limitations (documented, intentional)

1. **Observed-not-actual timing** for `booking_accepted`, customer `service_completed`,
   `document_verified`: fire when the DEVICE learns of the state (socket/FCM/fetch).
   If the app stays closed, the event logs on next open (deduped). Exact-time server
   truth requires **Meta Conversions API** on the backend (recommended long-term).
2. `referral_success` only fires on the **referred** user's device; the referrer is
   never notified in-app → referrer-side conversion needs backend/CAPI.
3. `Subscription_completed` absent on iOS (external web payment).
4. `search_performed`, `repeat_booking`, `rating_received`: not implemented (see map).
5. Until console config is complete, events are sent but may be rejected/未attributed
   server-side — the app is safe either way (silent no-op design).

## 7. Production-readiness audit (2026-07-09)

Four-agent audit (auth flows, call sites, native config, core module) + fixes applied same day:

| Severity | Finding | Fix |
|---|---|---|
| Critical | `DocumentVerificationScreen` used `Analytics` without importing it → runtime crash on document submit | import added; systematic import check across all 18 instrumented files |
| High | Email/password provider registration logged `login_success` (response carries no `isNewUser`) | derive `isNewUser` from `REGISTRATION_SUCCESS` code + `authMethod:'email'` |
| Medium | Registration lost if app killed on Welcome popup | `user_registered` now fires (deduped) when the popup opens — account already exists server-side |
| Medium | `schedule_selected` fired on EVERY picker tap (inflated Meta `Schedule` signal) | once-per-booking-flow ref guard (both booking paths) |
| Medium | "Continue Anyway" (GPS-off) booking path skipped `service_selected`/`booking_started` | tracks added to that path |
| Medium | Reject success coerced `success \|\| response.ok` → event (and success UI) on HTTP-200 failure | `success === true \|\| (ok && success !== false)` in all 6 branches |
| Medium | Emergency/event accepts + completions logged nothing (inline fetches bypass instrumented service) | tracked at UI success points for non-traditional branches |
| Medium | Provider `referral_success` fired on already-exists auto-login; deduped by code not account | gated on `REGISTRATION_SUCCESS`; keyed per account email |
| Medium | iOS advertiser-ID collection defaulted ON with no ATT prompt (App Review posture) | `FacebookAdvertiserIDCollectionEnabled=false` (Info.plist + Android meta-data) |
| Low | Detail-screen Directions button didn't log `navigation_started` | added (deduped per job) |
| Low | Socket `request:status` unmapped statuses defaulted to `new_request` type → could log `job_request_received` | default changed to `status_update` (banner UI unchanged) |
| Low | Whole-submit retry re-logged already-uploaded doc categories | `oncePerSession` per category |
| Low | Dead email fallback in `Analytics.setUser` (PII hygiene) | removed — only opaque unified ID is sent |
| Low | Param sanitizer produced `'[object Object]'` / `'NaN'` | objects JSON-stringified, non-finite numbers dropped |
| Low | SDK-absent detection probed the JS wrapper (always present) | probes `NativeModules.FBAppEventsLogger` |

**Verified clean by audit:** fbsdk-next API usage (logEvent/logPurchase/setUserID/AppEvents
constants — checked against actual 13.4.3 source), dedupe race-safety, offline persistence
(native SDK queues + flushes), zero SDK imports outside the module, zero raw event strings,
`__DEV__`-gated logging, no secrets beyond App ID + client token, AppDelegate ordering,
privacy manifests (FBSDK ships its own), APP_OPENED once per cold start.

**Deferred (documented, not bugs):** pin `facebookSdkVersion` in `android/build.gradle` ext
(currently floats on `18.+`); declare AD_ID / advertising data in **Play Console Data Safety**;
run one minified **release** build per platform and confirm events in Events Manager (the FB
SDK has never been exercised in a release build); `method` param is `'unknown'` on a few legacy
login paths; referrer-side referral + iOS subscription still need backend/CAPI.

## 8. Issues Log

> Add future bugs/observations here as dated entries.

| Date | Issue | Status | Notes |
|---|---|---|---|
| 2026-07-09 | Initial production audit — 15 findings | ✅ all fixed | see §7 |
