# Tasks Tracker — Multi-Repo Work (single source of truth)

> **Purpose:** authoritative task list. Work **one task at a time**, update status
> continuously, mark complete **only after verification**. If context is lost, re-read
> this file and continue. Do not delete a task until fully verified + done.
>
> **Repos:** renfi (RN app) · noefix (Node/Mongo) · jauth (Java/Neon) · temp_admin (React admin).
> **Created:** 2026-06-14. **Last session:** 2026-06-15.

## Status legend
`TODO` · `IN-PROGRESS` · `BLOCKED` · `DONE (verified)`

---

# ▶ RESUME HERE (read this first, then start)
**To resume: just say "continue from TASKS_TRACKER.md".** This block is the entry point.

**Where we are:** Tasks 1–9 done (notifications + verification filters/routing + per-platform
app-version control, all build-verified). Owner-complaint status is in **"SESSION CLOSE
2026-06-15"** (search that heading) — 7 done, 3 partial, 13 remaining, **TODO list below**.
NOTE: Tasks 1–8 were committed (prod). **Task 9 is NEW & uncommitted** (noefix + temp_admin).

**Do FIRST tomorrow (in order):**
1. **U#12 — Fixhomians filter bug** (All/Active/Disabled not filtering; e.g. disabled "Yogesh
   Meshram (SP)" doesn't show under Disabled). `temp_admin` (ManageFixhomians.jsx) + check the
   noefix `listFixhomians` status filter. Small, high value.
2. **U#13 — Copy from Fixhomians list** without opening profile (name/phone/email/ID). `temp_admin`.
3. **BUZZER — distinct new-request sound** (NOT done — only sound was *enabled*; no custom
   buzzer file added). Needs an actual sound asset + Android notification channel wired to it.
   See TODO item "BUZZER" below for the full scope.
Then continue down the **"REMAINING — work tomorrow"** list in SESSION CLOSE.

**Repo paths (Windows):**
`renfi C:\Projects\DOCS\fo\renfi` · `noefix C:\Projects\DOCS\fo\noefix` ·
`jauth C:\Projects\DOCS\fo\jauth` · `temp_admin C:\Projects\DOCS\fo\temp_admin`

**How to validate (no node_modules in renfi/noefix → can't run those; temp_admin HAS them):**
- backend JS: `node --check <file>` · admin: `cd temp_admin && npx vite build` (and `npx eslint <files>`).
- eslint baseline = 3 pre-existing `set-state-in-effect` (safe; don't "fix" codebase-wide).

**Conventions:** work ONE task at a time; verify before marking done; commit messages end with
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Don't change JWT_SECRET.
Don't repoint prod DBs. iOS must stay unaffected; no missing i18n keys (en/hi/mr).

**Uncommitted at close (2026-06-15):** 4 commits prepared, NOT made — see "Commit messages
prepared". Files dirty: noefix (appControlController, appControlRoutes, pushNotification,
models/notificationBroadcast, documentVerificationController) · temp_admin (api.js, AppControl.jsx,
Dashboard.jsx, ProviderDetail.jsx) · renfi (this tracker only). Decide: commit first, or keep editing.

**Open decisions:** (a) optional index `documentVerification.services.status`; (b) push-wake
location feature (cost ~zero; see SESSION CLOSE "Proposed").

## 📦 RELEASE / DEPLOY STATE (2026-06-15) — read if version/update issues appear
- **iOS:** shipped as **Version 1.0.5, Build 1** (forced bump from 1.0.4; build reset to 1).
  Previous live = 1.0.4.
- **Android:** (record versionName/versionCode when shipped — versionCode must be > previous).
- **Task 9 (per-platform app version)** is being **deployed now** (noefix + temp_admin admin).
  After deploy, in Admin → App Version set **both** blocks: Android `latest/min`, iOS `latest 1.0.5`
  and iOS `min ≤ 1.0.5` (min = latest only if you want to FORCE everyone to 1.0.5).
- **Until you save per-platform values, the check falls back to legacy 1.0.4** (no disruption).
- **If issues tomorrow — likely causes & checks:**
  - *iOS users wrongly force-updated* → iOS `min` is set above 1.0.5; set iOS min ≤ installed.
  - *No update prompt when expected* → per-platform `latestVersion` not saved (still on fallback);
    open Admin → App Version, confirm the iOS/Android blocks show your values, re-save.
  - *Wrong store opens* → check `storeUrls.ios` / `storeUrls.android` in the config.
  - *Backend not resolving platform* → app must send `?platform=ios|android` (it does via
    `appUpdateService.js`); verify `checkAppVersion` in `noefix/controllers/adminController.js`.
  - Maintenance mode still global (not per-platform) — by design.

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
**Status:** DONE (backend node --check + temp_admin vite build both pass)

**Goal:** New **App Control** section in temp_admin with push to Users / Providers / Both.
Robust, responsive, validated; follow existing notification format/fields.

**Scope:**
- [ ] Inspect existing push infra (noefix pushNotification, FCM channels, token storage)
- [ ] Backend endpoint: send to users / providers / both (admin-auth)
- [ ] Field structure (heading/subtitle/description per existing format) + length limits
- [ ] temp_admin "App Control" page + route + sidebar
- [ ] Audience selection (Users / Providers / Both)
- [x] Mobile-responsive, admin-friendly UI

**Findings / files:**
- **Backend (noefix):**
  - `controllers/appControlController.js` (NEW) — `sendBroadcastPush`: validates audience
    (`users`/`providers`/`both`) + title (≤65) + body (≤240); collects eligible FCM tokens
    (not deleted, has token, `preferences.pushNotifications !== false` → respects opt-out);
    de-dupes; sends via existing `sendMulticastNotification` in 500-token batches; cleans up
    invalid tokens; returns sent/failed/targeted + breakdown.
  - `routes/appControlRoutes.js` (NEW) — `POST /push` behind `requireAdmin` + `auditLog('APP_CONTROL_PUSH')`.
  - `server.js` — mounted `app.use("/api/app-control", ...)`.
- **Admin (temp_admin):**
  - `src/pages/AppControl.jsx` (NEW) — "App Control" page: audience selector (Users/Providers/Both),
    Title (65) + Message (240) with live char counters + live notification preview, confirm modal
    before broadcast, success/failure result banner. Tailwind + dark mode, mobile-responsive.
  - `src/App.jsx` — lazy import + route `/app-control`.
  - `src/components/Layout.jsx` — sidebar item "App Control" (HiOutlineMegaphone).
- Follows the EXISTING push format (title + body + data via `sendMulticastNotification`); no new
  FCM channel needed (reuses `fixhomi_notifications`).

**Verification:** backend `node --check` (controller/route/server) ✅; temp_admin `vite build` ✅
(compiles, page is its own lazy chunk). Lint shows only pre-existing project-wide false-positives
(`<Icon/>` jsx-uses-vars, fast-refresh export, setState-in-effect) — same in committed `Layout.jsx`;
build success confirms none are real.

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

---

# ═══════════════════════════════════════════════════════════════════════
# SESSION 2026-06-15 — Notification feature (full build) + Verification filters/routing
# ═══════════════════════════════════════════════════════════════════════
> Follow-up session. Tasks 1–6 already done/committed (above). Below = today's work.
> Repos touched today: **noefix** + **temp_admin** only (no renfi code; this tracker is
> the only renfi file changed). **Not yet committed** at time of writing (user reviewing).

## Task 7 — Notification feature: make it full-fledged (history, retry, metadata, emoji)
**Status:** DONE (backend `node --check` + temp_admin `vite build` both pass)

**Goal (user):** App Control push must be **optimized / not DB-heavy**, have a **retry
mechanism** (same record updated, not duplicated), save **all metadata + the logged-in
admin who sent it**, show a **"notification sent history"** on the same page (new DB model),
reduce char limits to **standard**, and **skip images for now**.

**Findings / files:**
- **`noefix/models/notificationBroadcast.js` (NEW)** — one document per broadcast (written
  AFTER send+retry, so it holds FINAL numbers): `title, body, audience,
  sentBy{adminId,email,role}, targeted/sent/failed/retried/invalidCleaned,
  breakdown{users,providers}, status('completed'|'partial'|'failed'|'no_recipients'),
  createdAt`. Index `{createdAt:-1}`.
- **`noefix/utils/pushNotification.js`** — `sendMulticastNotification` now classifies each
  failure: **PERMANENT** (`invalid-registration-token` / `registration-token-not-registered`
  / `invalid-argument`) → `invalidTokens` (dead, cleaned up); everything else (server
  unavailable / internal / quota) → `retryableTokens` (transient, worth a retry).
- **`noefix/controllers/appControlController.js`** — char limits **50 / 150** counted by
  **code points** (so an emoji = 1 char); `sendInBatches` (500-token FCM batches); **one**
  retry pass for transient failures only (2s delay); `failed = targeted − sent`; dead tokens
  nulled out non-blocking; `sentBy` captured from `req.admin` (JWT, no extra query); saves the
  NotificationBroadcast record (incl. the `no_recipients` case); **`getNotificationHistory`**
  (paginated ≤50, newest-first, `.lean()`).
- **`noefix/routes/appControlRoutes.js`** — added **`GET /history`** (`requireAdmin`).
- **`temp_admin/src/pages/AppControl.jsx`** — **Compose / History tabs**; history panel
  (sender email, audience, delivered/failed/targeted, retried, status badge, timestamp) +
  pagination; send banner now surfaces **retried** and **dead-token-removed** counts (so a
  "failed" dead token reads as *removed*, not a silent failure); **emoji quick-insert bar**
  (12 common emojis) under Title & Message; **code-point counting** matches the backend.

**Emoji note:** emoji already transmit through FCM unchanged (UTF-8). The only real work was
counting (emoji = 1, not 2 UTF-16 units, on BOTH sides) + convenience inserts. Images skipped
per user instruction.

**Optimization:** `.select('fcmToken').lean()` token queries (respects soft-delete + push
opt-out in the query); 500-batch sends; retry transient-only (never re-hits dead tokens);
**1 insert** per broadcast; indexed + paginated history; sender from JWT.
**Honest caveat:** `collectTokens` loads all eligible tokens into memory for one broadcast —
correct/simplest at current scale; move to a cursor/stream only if the base hits ~100k+.

**Verification:** backend `node --check` (4 files) ✅; temp_admin `vite build` ✅.

---

## Task 8 — Admin Verification: advanced filters + user-friendly back/forward routing
**Status:** DONE (`node --check` + `vite build` pass; eslint zero-delta vs baseline)

**Goal (user):** Advanced filters in the admin **Verification** section (e.g. electrician +
verified + premium). AND fix routing so going list → provider profile → back restores the
**exact step** (filters/tab/page) and is forward/back-able — **like the Fixhomians tab**.

**Findings / files:**
- **`noefix/controllers/documentVerificationController.js`**
  - `getPendingVerifications`: new optional filters — `category` (combined into the **same**
    `$elemMatch` as status, so "Pending + Electrician" = a pending electrician submission),
    `premium`/`verified`(=`isFullyVerified`)/`aadhaar`/`online` (tri-state true/false/unset),
    `city` + `search` (name/email/phone) as **regex-escaped** case-insensitive matches.
    Response now also returns `city, isPremium, isFullyVerified, isOnline, aadhaarVerified`.
  - `getProviderDocuments`: returns the **true** `aadhaarVerified`
    (`aadhaarVerification.isVerified`, set by the DigiLocker flow — confirmed in
    `aadhaarController.js`) plus `isPremium/isFullyVerified/isOnline`. **Bug fix:** the detail
    page was mislabeling the generic `verification.isVerified` as "Aadhaar Verified".
- **`temp_admin/src/api.js`** — `getPendingVerifications(status,page,limit,filters)` builds the
  querystring from a filters object (omits empties).
- **`temp_admin/src/pages/Dashboard.jsx`** — collapsible **Filters** panel (category dropdown
  from `/verification/categories`, city, premium, verified, aadhaar, online), debounced
  search + city (400ms), active-filter count badge, clear-all. Stat counts AND cards reflect
  filters; per-card badges (premium/verified/aadhaar/online/city). **All list state
  (status/page/filters) lives in the URL** (`{replace:true}`) → browser back/forward restores
  the exact filtered view. Effect deps tuned: tab/page change → list refetch only; filter
  change → list + counts. Input boxes synced via render-time pattern (no extra effect).
- **`temp_admin/src/pages/ProviderDetail.jsx`** — robust `goBack`: uses `navigate(-1)` when
  in-app history exists (`location.key !== 'default'`), else reconstructs `/dashboard` from a
  `return` URL carried into the detail (survives refresh / direct-open). Shows correct
  Aadhaar + fully-verified + premium.
  - **Cross-link added:** a "Full profile" button (external-link icon) beside the provider
    name in the verification detail → opens `/fixhomians/:id?type=provider` in a **new tab**
    (full profile: overview, services, transactions, documents, auth DB, live status). Real
    `<a target="_blank">`, same ID space as the Fixhomians list (verified — both show `211`).

**Lint:** **net-zero new errors.** Baseline already had 3 `react-hooks/set-state-in-effect`
on the standard `useEffect(()=>fetchX(),[fetchX])` fetch pattern (codebase-wide, e.g.
ManageFixhomians) — left as-is (safe, style-only, not a build error). The one I'd have added
(input-sync effect) was rewritten to React's render-time "adjust state on change" pattern.

**DB note:** the verification base query (`$elemMatch` on `documentVerification.services.status`)
and the city/search regex are **not** index-backed — acceptable at admin scale and it was
already this way. Optional one-line upgrade if provider volume grows large:
`providerSchema.index({ "documentVerification.services.status": 1 })` (NOT added — index
changes on prod M10 are a deliberate ops decision; user's call).

**Verification:** backend `node --check` ✅; temp_admin `vite build` ✅; eslint baseline parity.

---

## Task 10 — Admin panel UI overhaul: sidebar nav + full-width responsive (frontend only)
**Status:** DONE (`vite build` ✅; Layout lint REDUCED vs baseline). No backend changes.

**Why (owner):** header-link nav looked cramped/center-only; iOS & Android version blocks looked
identical (emoji-only difference); content wasted big-screen width. Wanted a Google-Console /
ChatGPT-style **left sidebar** on desktop, same mobile drawer on phones, full-width responsive
content across all tabs, production-grade internal-tool UX. No/minimal backend.

**Findings / files (temp_admin):**
- **`components/Layout.jsx`** — rewritten. Desktop (lg+): **collapsible sticky left sidebar**
  (w-64) with logo + two labeled groups (**Operations** / **Management**). A **hamburger in the
  topbar toggles the sidebar** (hide → content goes full-width); state **persisted** in
  localStorage (`fixhomi_sidebar_collapsed`); logo moves into the topbar when collapsed.
  **User badge + theme toggle + sign-out now live in the header** (right side), NOT the sidebar.
  Removed the old header horizontal nav + "More" dropdown. Mobile (<lg): unchanged left
  **drawer** via hamburger (drawer keeps user/theme/sign-out). Content `<main>` is **full-width**
  (`px-4 sm:px-6 lg:px-8`, no `max-w-7xl` cap) → list/table pages auto-use the whole screen.
  New `SidebarGroup` shared component. Lint: net REDUCED (3 jsx-uses-vars false-positives → 1;
  dropped the route-change setState effect — drawer closes via per-link onNavigate).
- **`pages/AppVersion.jsx`** — removed 🤖/🍎 **emojis**; Android = **emerald** tint, iOS =
  **sky** tint (distinct card bg + heading color + dot) so they're not confused; container
  widened `max-w-4xl → max-w-6xl`; `PlatformVersionBlock` takes tone classes.
- **`pages/AppControl.jsx`** — widened `max-w-3xl → max-w-5xl`.

**UX principle applied:** list/table pages go **full-width**; forms (AppVersion/AppControl) keep
a comfortable max-width for readable line lengths (production best practice, not a regression).

**Verification:** `vite build` ✅ (4.36s); eslint — Layout 1 (Icon false-positive, used in JSX),
AppVersion 3 (pre-existing), AppControl 0. No backend touched.

---

## Task 11 — Admin Docs Guide (one-stop ops/infra docs for the owner) — frontend only
**Status:** DONE (`vite build` ✅). No backend. **TBD placeholders await owner input.**

**Why (owner):** wants a self-serve "everything in one place" doc — where each thing is hosted,
pricing, dashboards, how it's wired — so he isn't dependent on the dev. NOTE: "API docs" here =
**infrastructure/ops docs**, NOT REST endpoint docs (clarified by owner).

**Files (temp_admin):**
- `pages/AdminDocs.jsx` (NEW) — searchable, data-driven guide w/ in-page nav. 11 sections:
  Overview · Hosting (Render) · Databases (Mongo/Neon) · Domain & Networking (Cloudflare/GoDaddy)
  · Third-party Services · Billing & Pricing · App Stores · Common Tasks · Access & Secrets ·
  Handover & Contacts · Glossary. Unknown account/billing values render as an amber
  "To be filled" chip (sentinel `TBD`) — never guessed.
- `App.jsx` route `/admin-docs`; `Layout.jsx` sidebar item "Docs Guide" (Management group).

**Facts sourced (not assumed):** from `noefix/CLOUDFLARE_SETUP.md` — registrar=GoDaddy,
Cloudflare acct Fixhomi.team@gmail.com, DNS map (api→noefix, auth→jauth, proxied), dev URLs,
carrier-block reason; from code — services Firebase(fixhomi-f6382)/Cloudinary/Surepass/Razorpay/
MSG91/Workspace; Android pkg com.renfi. Pricing from web research (Jun 2026): Render Starter
$7/svc + bandwidth (Hobby cut 100→5GB/mo Apr-2026 → overage = the "$24"); Mongo M10 ~$57,
**M5 deprecated → Atlas Flex $8–$30**; Neon Launch $5 min (~$20 typical).

**⚠ Owner must fill (TBD chips):** login accounts for Render/Mongo/Neon/GoDaddy/Cloudinary/
Surepass/Razorpay/MSG91/Workspace/Play/Apple; exact Render bill line items + card owner + next
payment dates; GitHub repos; handover contacts.

**Verification:** `vite build` ✅; lint = Icon jsx-uses-vars false-positives only.

---

## Docs Guide — open follow-ups (fill remaining TBD chips when known)
- **Play App Signing status** — confirm in Play Console → Test and release → **App integrity**
  (or top search "app signing"). ENABLED → keystore loss recoverable (Google holds key + upload-key
  reset); legacy/OFF → loss is fatal. Record verdict in the doc's Signing section. (App is ~7 months
  old → almost certainly ENABLED.)
- **contact@fixhomi.com inbox host** — unknown; ask Vijay Chirde; fill Handover.
- **Android keystore backup** — ✅ DONE & verified: FixhomiKeys.dmg (AES-256) + FixhomiKeys.zip
  on Google Drive → Fixhomi → Keys & Secrets. Recovery steps documented.
- **iOS signing** — optional: export distribution cert as .p12 (convenience). Account-recoverable
  via Apple Developer (contact@fixhomi.com) — keep that Apple ID + 2FA safe.
- **Marketing site fixhomi.com** — migrate from developer's personal Vercel account → fixhomi.team.
- **GitHub repos** — create + hand over when work complete; then fill the Secrets section.

---

## Commit messages prepared (2026-06-15) — awaiting user commit
- **noefix (notifications):** `feat(app-control): broadcast history, retry, sender metadata, emoji-safe limits`
- **temp_admin (notifications):** `feat(app-control): Compose/History tabs, emoji support, surfaced retry/cleanup`
- **noefix (filters):** `feat(verification): advanced admin filters + correct Aadhaar status`
- **temp_admin (filters):** `feat(verification): filter bar + URL-persisted, back/forward-safe routing`
  (each ends with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`)

---

## Task 9 — Platform-specific App Version control (iOS vs Android)
**Status:** DONE (`node --check` ×2 + `vite build` pass; eslint zero-delta). **App rebuild NOT
needed** — app already sends `platform`; this is backend + admin only.

**Why:** iOS and Android version numbers diverge (App Store may need 1.0.6 while Play is on
1.0.5). The old config had ONE universal latest/min/critical → force-update + min-version
gating couldn't be managed per platform. Owner needs to set them independently.

**Findings / files:**
- **`noefix/models/appVersion.js`** — added `android` and `ios` sub-blocks
  (`{latestVersion, minVersion, isCritical}` each). Legacy top-level `latestVersion/minVersion/
  isCritical` kept as **fallback** (back-compat).
- **`noefix/controllers/adminController.js`**
  - `checkAppVersion`: resolves the requesting platform's block; if a platform block has a
    `latestVersion` it governs, else falls back to legacy fields (→ pre-platform behavior is
    identical until you split them). Returns resolved latest/min/critical + `platform`.
  - `updateAppVersion`: accepts `android`/`ios` objects (validates semver + min≤latest per
    platform), writes them with `markModified`. Legacy/maintenance paths untouched.
- **`temp_admin/src/pages/AppVersion.jsx`** — "Update Configuration" now has **two blocks
  (🤖 Android, 🍎 iOS)** each with Latest/Min/Critical + inline force/optional preview;
  "Current Live Config" shows both platforms; shared fields (title/message/notes/store URLs/
  maintenance) unchanged. New `PlatformVersionBlock` component + `compareSemverStr` helper.
- App side (`renfi/appUpdateService.js`): **no change** — already sends `platform` + consumes
  the resolved `latestVersion/minVersion/storeUrl`.

**Migration/safety:** existing prod doc (universal 1.0.4) keeps working via fallback. Admin
form pre-fills BOTH platforms from the legacy value, so first save simply splits them. No app
rebuild, no data migration needed.

**Verification:** `node --check` (model + controller) ✅; `vite build` ✅; eslint baseline parity
(3 pre-existing in AppVersion.jsx, unchanged).

---

# ═══════════════════════════════════════════════════════════════════════
# SESSION CLOSE 2026-06-15 — Owner complaint status (what to check / what's left)
# ═══════════════════════════════════════════════════════════════════════
> Buckets: **APP** = needs new app build · **ADMIN** = web panel (admin deploy).
> Owner gave two lists: "Owner complaints #1–9" and "Updates & Improvements #1–13".

## ✅ DONE — to verify in the build
- **#2 Coming Soon** (Influencer/Photographer/Solar/Salon; Traditional shows them last). APP
- **#4 App auto-exit** (cold-start crash fixed). APP
- **#7 Push notifications** to Users/Providers/Both from panel. ADMIN
- **#3 Verification → back returns to same position** (tab/page/filters preserved; +"Full
  profile" new-tab link to Fixhomians). ADMIN
- **U#2 Call & Send Request** equal 50/50 width. APP
- **U#4 Auto-logout** (refresh window 7→60d + transient-login fix). APP
- **U#5 App killed on external apps** (state restored on return). APP

## ⚠️ PARTIAL
- **#1 Account creation** — email-verify no longer blocks booking (phone-OTP only);
  **password removal from signup NOT done.** APP/jauth
- **U#3 Real-time online status** — online is now **visible/filterable** in admin, but it's a
  snapshot at load, **not live-updating.**
- **U#8 Personalized notifications** — **broadcast** done; **individual SP/SU targeting** not built.

## ❌ REMAINING — work tomorrow (priority order suggestion)
1. **U#12 Fixhomians filter bug** (All/Active/Disabled not filtering; e.g. disabled "Yogesh
   Meshram" not shown). ADMIN — small, high-value.
2. **U#13 Copy from Fixhomians list** (copy name/phone/email/ID without opening profile). ADMIN.
3. **BUZZER — #8 / U#1 distinct new-request sound** (CORRECTED: NOT done). We only set
   `defaultSound: true` on the `fixhomi_notifications` channel — that plays the **default**
   system sound, not a distinct buzzer. TODO: add a custom buzzer audio asset (Android
   `res/raw/<buzzer>.mp3|wav`), create/point a notification channel at it (`sound` =
   that resource; iOS: bundle the file + set `apns.payload.aps.sound`), and send new-request
   pushes on that channel. APP (renfi + noefix push payload). Verify on a real device.
4. **#5 Refer T&C** update. APP/content.
5. **#6 Insurance T&C** — add "free-trial not covered, paid only." APP/content.
6. **U#6 Request tracking** — which SU → which SP even before accept. noefix + ADMIN.
7. **U#8 Personalized notifications** — individual targeting (finish the partial). noefix + ADMIN.
8. **U#3 Real-time online** — live status (socket/poll) in admin (finish the partial). ADMIN.
9. **#1 Password removal** from signup (finish the partial). jauth + APP.
10. **U#9 User guides** (SU/SP tutorial links). APP/content.
11. **U#10 API management** section in admin. ADMIN.
12. **U#11 WhatsApp welcome messages** on signup. noefix + WhatsApp API.
13. **U#7 Lead-tracking** (call-only vs in-app requests) — design + build. noefix + ADMIN.

## 💡 Proposed (owner asked to evaluate) — NOT built
- **Push-wake for stale location:** silent data-push + cron for **online+stale** providers
  (every 15–30 min) to refresh location. Cost ≈ **zero** at 1,200 users (FCM free; writes
  trivial on M10; Render/Neon unaffected). Caveat: won't reach **force-stopped/OEM-killed**
  apps (same as dead tokens) — real cure = background-geo foreground service + battery
  whitelist. Needs new headless location handler in app. **Decision pending.**

## ➕ Bonus shipped (not requested)
Notification history + retry + sender log · advanced verification filters (category/premium/
verified/aadhaar/online/city/search) · dead FCM-token auto-cleanup · Aadhaar field
correctness fix in admin · emoji support in admin notifications.

---

## Change log
- 2026-06-14 — Created tracker with Tasks 1–6. Starting Task 1.
- 2026-06-14 — Tasks 1,2,3,5 DONE + agent-reviewed + graceful fixes. Ready to commit.
- 2026-06-14 — Task 6 DONE (nav-state flush on background). App.tsx.
- 2026-06-14 — Task 4 DONE (Admin "App Control" push: noefix + temp_admin). Build verified.
  ALL 6 TASKS COMPLETE.
- 2026-06-14 — HOTFIX (noefix deploy crash): emergencyServicesController defines handlers via
  `exports.X` but re-exports a CURATED `module.exports = {…}` list at the bottom (which replaces
  the exports object). `getAvailableEmergencyCategories` (Task 2) was assigned via `exports.X`
  but not added to that list → route imported `undefined` → boot crash "argument handler must be
  a function" (emergencyServicesRoutes.js:41). Fix: added it to the module.exports list.
  (Event controller was already correct — const + listed.) Lesson: when a file curates
  module.exports, new fns MUST be added there; node --check/grep don't catch this.
- 2026-06-15 — **Task 7 DONE** (Notification feature full build): NotificationBroadcast history
  model, transient-only retry, sender metadata, `GET /history`, Compose/History tabs, char
  limits 50/150 (code-point), retry/cleanup surfaced in banner, emoji quick-insert + counting.
  Images skipped per user. noefix `node --check` + temp_admin `vite build` ✅.
- 2026-06-15 — **Task 8 DONE** (Verification advanced filters + routing): backend filters
  (category/premium/verified/aadhaar/online/city/search), filter-aware counts, URL-persisted
  list state for exact back/forward, robust ProviderDetail back, Aadhaar field correctness fix.
  `node --check` + `vite build` ✅; eslint zero-delta.
- 2026-06-15 — Lint stance: pre-existing `set-state-in-effect` fetch pattern left as-is
  (codebase-wide, safe); my one addition rewritten to render-time pattern → net-zero new errors.
- 2026-06-15 — OPEN (user's call): optional index `documentVerification.services.status`;
  4 commits prepared but NOT yet made (noefix + temp_admin × notifications + filters).
- 2026-06-15 — Added "Full profile" new-tab cross-link from verification detail →
  `/fixhomians/:id?type=provider` (temp_admin ProviderDetail.jsx). `vite build` ✅.
- 2026-06-15 — **Task 9 DONE** (platform-specific app version): iOS/Android each get their own
  latest/min/critical; backend resolves per `platform` (legacy fallback = no disruption); admin
  AppVersion page split into Android/iOS blocks. App needs NO rebuild. `node --check` + build ✅.
  Uncommitted (noefix models/appVersion.js + controllers/adminController.js; temp_admin AppVersion.jsx).
- 2026-06-15 — **iOS release:** Version **1.0.5, Build 1** shipped (forced bump from 1.0.4).
  Per-platform version (Task 9) being deployed to prod (noefix + admin). See "RELEASE / DEPLOY
  STATE" near top for post-deploy admin steps + debug checklist.
- 2026-06-15 — **Task 10 DONE** (admin UI overhaul, frontend only): left sidebar nav (desktop)
  + mobile drawer kept, full-width responsive content all tabs, AppVersion emojis removed +
  Android(emerald)/iOS(sky) distinct shades + widened, AppControl widened. `vite build` ✅;
  Layout lint reduced. Uncommitted (temp_admin: Layout.jsx, AppVersion.jsx, AppControl.jsx).
- 2026-06-15 — **Task 10 REWORK** (UX fixes from owner screenshot): switched to GitHub-style
  **single full-width top header** (hamburger far-left → logo → breadcrumb → user/theme/signout)
  with the sidebar **below** it; sidebar now **slides** open/closed via `transition-[width]`
  (w-64↔w-0, overflow-hidden + inner fixed width) instead of snapping; fixed **horizontal
  overflow** (content `flex-1 min-w-0`); one breakpoint-aware hamburger (collapse on desktop,
  drawer on mobile). Removed the disjoint sidebar-logo-box. `vite build` ✅.
- 2026-06-15 — **Task 11 EXPANDED** (Admin Docs Guide): full third-party list w/ console + usage/
  billing directions (web-researched, no charges listed): Firebase (FCM + App Distribution),
  MSG91 (OTP, jauth+noefix), Brevo (auth email, jauth), Gmail SMTP (noefix email), Cloudinary,
  Surepass (Aadhaar), Razorpay, Apple Sign-In, Google OAuth. Added Websites section (admin panel
  = Netlify teadfi.netlify.app; marketing site host TBD). Email accounts (fixhomi.team@gmail.com,
  contact@fixhomi.com) + GitHub repos + marketing-site host = open questions for owner. `vite build` ✅.
- 2026-06-15 — **Android keystore SECURED**: backed up (FixhomiKeys.dmg + .zip, AES-256, on
  fixhomi.team Drive → Keys & Secrets), verified, recovery documented in Docs Guide. Open
  follow-ups (Play App Signing status, contact@ host, fixhomi.com Vercel→fixhomi.team migration,
  GitHub repos, iOS .p12) logged under "Docs Guide — open follow-ups".
- 2026-06-15 — Created **DEV_RECOVERY_AND_ONBOARDING.md** (renfi): how a new dev / repaired Mac
  restores ALL gitignored secrets (release.keystore, local.properties, .env, google-services.json,
  GoogleService-Info.plist) from the vault + builds/releases Android & iOS. Key insight: keystore
  alone won't build — all gitignored config must be restored. Recommends backing up the full set.
- 2026-06-15 — **Session closed.** Owner-complaint status mapped (see "SESSION CLOSE" above):
  7 done, 3 partial, 13 remaining (prioritized for tomorrow), 5 bonus. Push-wake location
  idea evaluated (cost ~zero; decision pending). Commits still pending user.
- 2026-06-15 — **CORRECTION:** notification "buzzer" (#8/U#1) moved DONE → REMAINING. We only
  enabled the **default** system sound (`defaultSound:true`); no distinct buzzer asset/channel
  was added. Now item #3 in REMAINING. Added a "RESUME HERE" entry-point block at top of file.
