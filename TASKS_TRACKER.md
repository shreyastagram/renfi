# Tasks Tracker — Multi-Repo Work (single source of truth)

> **Purpose:** authoritative task list. Work **one task at a time**, update status
> continuously, mark complete **only after verification**. If context is lost, re-read
> this file and continue. Do not delete a task until fully verified + done.
>
> **Repos:** renfi (RN app) · noefix (Node/Mongo) · jauth (Java/Neon) · temp_admin (React admin).
> **Created:** 2026-06-14.

## Status legend
`TODO` · `IN-PROGRESS` · `BLOCKED` · `DONE (verified)`

---

## ✅ Incident resolved (2026-06-14) — was NOT a new bug; tasks resumed
OTP flow healthy, cross-account ruled out (see `INCIDENT_OTP_LOGOUT.md`). Auto-logouts =
known Cohort A (transient-refresh) — cure is shipping the already-coded fix + optional
keep-jauth-warm stop-gap. **Tasks resumed; now on Task 3.**

---

## Task 1 — Remove email-verification requirement for booking (service users)
**Status:** DONE (verified by code review)

**Goal:** A service user must be able to **book** with **phone (OTP) verification only**.
Email verification (which sends a link; can fail if device storage is full) must **not**
block booking. Applies to: traditional service booking, **Emergency** (Snake Catcher,
Ambulance, Mortuary Van), and **Events** (Influencer, Photographer).

**Scope to cover:**
- [ ] Frontend: any `isEmailVerified`/email-verified gate on booking flows (User app)
- [ ] Frontend: verification dialogs/badges that block booking
- [ ] Backend (noefix): any booking endpoint requiring email verification
- [ ] Backend (jauth): any check tied to booking that requires email verified
- [ ] Emergency services booking (snake/ambulance/mortuary)
- [ ] Events booking (influencer/photographer)
- [ ] Keep phone-verification gating intact
- [ ] Verify nothing else depends on the removed gate

**Findings / files:**
- The email gate was **frontend-only**, a single line: `UserHomeScreen.jsx:586`
  `isVerified = isPhoneVerified && isEmailVerified` → blocked booking at `:766`.
  **Changed to phone-only** (`isVerified = displayData?.isPhoneVerified`).
- Updated dialog copy `userHome.verificationRequiredMsg` (en/hi/mr) → phone-only wording.
- **Backend (noefix): NO user-side email gate exists.** All booking-related gates are
  **provider-side** (`RSAS_NOT_APPROVED`, `SERVICE_NOT_VERIFIED`, `PROVIDER_NOT_VERIFIED`,
  and the `isFullyVerified` provider-search filter in `traditionalServiceController.js:400`).
  Left untouched (correct — they gate provider eligibility, not user booking).
- **Emergency (snake/ambulance/mortuary)** `handleBookProvider`: no email gate (only a
  call-first rule). **Events (influencer/photographer)** booking: no email gate. So both
  already allow phone-verified booking without email — goal met.
- i18n files parse OK (`node --check`). No `isEmailVerified` gate remains in any booking screen.

**Verification:** code review across renfi (booking screens), noefix (controllers), jauth.
i18n syntax validated. (Full runtime test pending an app build — no `node_modules` here.)

**Flag RESOLVED (user: yes, require phone on those too):** Added a **phone-only**
verification gate to emergency `handleServiceSelect` (location-based branch) and events
`handleServiceSelect` — same dialog (`userHome.verificationRequired*` + "Verify Now" →
Profile). Email still NOT required anywhere. Pulled `isAuthLoading`/`isProfileLoading`
into both screens' `useApp()` to avoid false-gating during profile load.

---

## Task 2 — Dynamic ordering + "Coming Soon"
**Status:** DONE (verified by code review; backend `node --check` passed)

**Goal:** Order services so **available-provider** services come **first**, **no-provider**
services come **last** and keep showing **"Coming Soon"**. Apply to traditional services,
Events (influencer/photographer), and Emergency (snake/ambulance/mortuary).

**Scope:**
- [ ] User home traditional services: sort available-first, unavailable-last
- [ ] Events section: Coming Soon when no providers + same ordering
- [ ] Emergency (snake/ambulance/mortuary): same availability logic
- [x] Backend availability source (`getAvailableCategories` + new equivalents)

**Findings / files:**
- **Traditional (UserHomeScreen.jsx):** added `orderedServiceCategories` (useMemo, stable
  sort: available-first, coming-soon-last) and render now maps the ordered list. Reused
  existing `isCategoryComingSoon`/`getAvailableCategories`.
- **Backend — two new endpoints** (separate gates; can't reuse traditional which requires
  premium):
  - `noefix/controllers/emergencyServicesController.js`: `getAvailableEmergencyCategories`
    (GET `/api/emergency-services/available-categories`) — **no-premium** gate (emergency is
    free) + reverse-maps provider categories → emergency serviceTypes; 30s cache.
  - `noefix/controllers/eventServicesController.js`: `getAvailableEventCategories`
    (GET `/api/event-services/available-categories`) — verified+premium gate; 30s cache.
  - Routes wired in both `*Routes.js` (authenticated). `node --check` passed on all 4.
- **Emergency (EmergencyServicesScreen.jsx):** added `getAvailableEmergencyCategories` to
  `emergencyServicesService.js` (fail-open→null); screen fetches on mount, `isEmergencyComingSoon`,
  `orderedLocationServices` (available-first), ServiceCard `comingSoon` badge + dim, and
  `handleServiceSelect` shows a Coming-Soon dialog instead of starting a request. Static/govt
  call-only numbers are unaffected.
- **Events (EventServicesScreen.jsx):** inline fetch of available-categories (fail-open),
  `isEventComingSoon`, `orderedEventServices`, ServiceCard `comingSoon` badge + dim, and
  `handleServiceSelect` shows Coming-Soon dialog instead of fetching providers.
- Reused existing `userHome.comingSoon*` i18n keys (already in en/hi/mr).

**Verification:** code review + backend `node --check` (4 files OK). Client JSX not lint-run
(`node_modules` absent) — validated by targeted reads; run `npm run lint` after install.

---

## Task 3 — App blinks & closes on open (cold start)
**Status:** DONE (root-caused + fixed; runtime verify needs a build)

**Goal:** Logged-in user taps icon → app **blinks and closes**; must open smoothly.
Investigate root cause (likely startup/nav-restore/splash race) and fix.

**Scope:**
- [ ] Reproduce / identify the crash-on-open (check Crashlytics startup crashes)
- [ ] App.tsx nav-state restore + splash + Suspense/lazy interplay
- [ ] AppContext init race
- [x] Fix + verify smooth cold start (runtime verify pending a build)

**Findings / files:**
- "Blink & close" = a **native Android crash** (ErrorBoundary wraps the whole app, so a JS
  render error would show a fallback, not close the process). Matches the Crashlytics native
  crash `IndexOutOfBoundsException: getChildDrawingOrder() returned invalid index 2 (child
  count is 2)` (1.0.2–1.0.4).
- **Root cause:** Android puts a ViewGroup into `ReactZIndexedViewGroup` mode when a child has
  `zIndex`; **adding/removing** that zIndex child desyncs the drawing-order array → off-by-one
  → crash. There were **two** such 2-child parents, each with a `zIndex` child that
  mounts/unmounts:
  1. **App root `<View>`** = `NavigationContainer` + **`SplashScreen`** (`zIndex:9999`,
     unmounts on EVERY launch at splash→home) — the strongest launch-crash match.
  2. **`NavigationContainer` wrapper** = `RootNavigator` + **`GlobalBanner`** (`zIndex:9999`,
     mounts when a banner arrives).
- **Fix:** removed `zIndex` from both. Each is already the **last child** (paints on top); kept
  Android `elevation` (`GlobalBanner` 24, `SplashScreen` 9999) to guarantee layering. With no
  `zIndex` child, the parents no longer use `ReactZIndexedViewGroup` → the crash path is gone.
  Files: `src/components/SplashScreen.jsx`, `src/components/GlobalBanner.jsx` (+ explanatory
  comments so the `zIndex` isn't re-added).
- **Note (not changed):** `LocationTrackingBanner` (`zIndex:20`, conditional mount) lives in a
  multi-child parent so it doesn't match the "child count is 2" signature; left as-is. Revisit
  only if a new crash points there.

**Verification:** code review + exact match to the Crashlytics crash signature. Runtime confirm
needs an Android build (no `node_modules` here). This is a CLIENT fix → ships with the next build.

---

## Task 4 — Admin push notifications ("App Control" in temp_admin)
**Status:** TODO

**Goal:** New **App Control** section in temp_admin with push to Users / Providers / Both.
Robust, responsive, validated; follow existing notification format/fields.

**Scope:**
- [ ] Inspect existing push infra (noefix pushNotification, FCM channels, token storage)
- [ ] Backend endpoint: send to users / providers / both (admin-auth)
- [ ] Field structure (heading/subtitle/description per existing format) + length limits
- [ ] temp_admin "App Control" page + route + sidebar
- [ ] Audience selection (Users / Providers / Both)
- [ ] Mobile-responsive, admin-friendly UI

**Findings / files:**

**Verification:**

---

## Task 5 — Traditional provider list: Call & Send Request 50/50 width
**Status:** DONE (verified by code review)

**Goal:** In the provider list after "Find Providers", make **Call** and **Send Request**
each **50%** width. Skip button unchanged; Send Request style unchanged; Call icon unchanged.
Only the width distribution changes.

**Scope:**
- [ ] Locate the provider-card action row (likely UserHomeScreen / a provider card component)
- [x] Adjust flex so Call + Send Request are equal width

**Findings / files:**
- `UserHomeScreen.jsx` `ProviderCard` action row = Call (`width:46`) · Send Request (`flex:1`)
  · Skip (`width:46`). Changed `callButton` `width:46` → `flex:1` so Call & Send Request split
  the row 50/50; Skip unchanged (46); Send Request style unchanged; Call icon stays centered.
- `CreateServiceRequestScreen.jsx` already had both as `flex:1` (no change needed) — confirms
  the intended design; UserHomeScreen was the outlier.

**Verification:** code review.

---

## Task 6 — App killed/restarted when opening external apps + OTP/flow loss
**Status:** DONE (verified existing + one hardening added)

**Goal:** App restarts when returning from external pages (Aadhaar, gallery, doc upload,
browser) and loses in-progress state (OTP screen gone, Gmail verify, booking). Already
fixed once — re-verify coverage; determine if more is needed. Mainly Chinese OEMs; iOS OK.

**Scope:**
- [ ] Re-read nav-state persistence (App.tsx) + usePersistedAuthFlow (OTP) — coverage check
- [ ] Android process-death / `android:configChanges` / launchMode / state save
- [ ] External-app return (document picker, linking) state retention
- [x] Determine if anything additional is required

**Findings / files:**
- **Existing implementation is correct & well-architected (verified):**
  - Native `MainActivity.kt:22` uses `super.onCreate(null)` — the react-native-screens pattern
    that PREVENTS the fragment-restore crash after an OEM process kill (clean relaunch, no crash).
    `launchMode=singleTask` + broad `configChanges` (won't recreate on rotation/keyboard/uiMode).
  - JS restore: `App.tsx` nav-state persistence (AsyncStorage `@fixhomi_nav_state_v1`, 3h TTL,
    deep-link precedence) + `usePersistedAuthFlow` (writes the OTP-verify step IMMEDIATELY, not
    debounced → survives a kill). Architecture = native discards stale state, JS restores. Sound.
- **Hardening ADDED (App.tsx):** flush the latest nav state on `AppState` `background`/`inactive`
  (cancel the 800ms debounce + write `navigationRef.getRootState()` now). Closes the window where
  an OEM kills the backgrounded process (opening gallery/doc-picker/browser/Aadhaar) before the
  debounced write fired → relaunch now restores the exact screen. Best-effort, never throws.
- **Known residual limitation (OS-level, documented, not fixable in app):** if the OS kills the
  process *while an external picker/browser is open*, the picker RESULT (chosen file/image) can be
  lost on return — the user is restored to the correct screen but must re-pick. This is Android
  process-death during `onActivityResult`; mitigated (back on the right screen), not eliminable.
- iOS unaffected (AppState flush is harmless on iOS; iOS already works per report).

**Verification:** native config + JS persistence reviewed; `getRootState`/scope confirmed; OTP
write confirmed immediate. Runtime confirm needs an Android build on a Chinese-OEM device.

**Uncommitted:** App.tsx (this Task-6 hardening) — needs a follow-up commit (Tasks 1,2,3,5 already pushed).

---

## Verification pass (2026-06-14) — 3 parallel review agents on Tasks 1,2,3,5
**Result: no High/blocking bugs.** Confirmed: i18n keys exist (en/hi/mr), no false-gating
(user carries isPhoneVerified pre-profile-load), fail-open availability (null→show all), stable
copy-then-sort ordering, crash-fix overlays stay on top (last-child + elevation), button 50/50,
backend gate parity + emergency reverse-mapping + route order (no `/:id` swallow) + `node --check` OK.

**Graceful-handling fixes applied from the review (good-dev polish):**
- Localized the "Coming Soon" **badge** on emergency/event cards (`t('userHome.comingSoon')`) —
  was hardcoded English; added `useLanguage` to both `ServiceCard` sub-components.
- `SplashScreen` `elevation: 9999` → `12` (last-child already ensures on-top; removes code smell).
- Corrected backend doc-comments (return 500 → client fails OPEN; not "[]").
- Left benign (no change): emergency/event `profileReady` is actually stricter than UserHome
  (gates on `user.isPhoneVerified` immediately) — safe; useMemo dep note — safe.

## Change log
- 2026-06-14 — Created tracker with Tasks 1–6. Starting Task 1.
- 2026-06-14 — Tasks 1,2,3,5 DONE + agent-reviewed + graceful fixes. Ready to commit.
