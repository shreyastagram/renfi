# Session Handoff — Context for Continuing Work

> **Purpose:** This file is a complete context handoff so the next AI assistant
> (e.g. Claude in VS Code) can pick up exactly where we left off without the user
> having to re-explain anything. Read this fully before starting new work.
>
> **Scope of this session:** Bug fixes (Issues 1–5) + enhancements (E1–E5) across
> a multi-repo project, plus admin-panel work and a final round of polish on the
> Emergency Services screen.
>
> **Last updated:** 2026-06 session.

---

## 0. Repositories Involved

This is a multi-repo product. Paths on this machine:

| Repo | Path | Role |
|------|------|------|
| **renfi** (this repo) | `C:\Projects\DOCS\fo\renfi` | React Native app (Fixhomi) — Users + Providers |
| **noefix** | `C:\Projects\DOCS\fo\noefix` | Node.js backend (Railway) — services, profiles, referrals, subscriptions |
| **jauth** | `C:\Projects\DOCS\fo\jauth` | Java Auth service (Render) — auth, JWT, OTP |
| **temp_admin** | `C:\Projects\DOCS\fo\temp_admin` | Admin panel (React + Vite) |

> RN app source lives at `renfi/renfi/`. Two backends: Node (port 5001 local) and
> Java Auth (port 8080 local). Toggles in `src/config/environment.js`.

**Companion reports already in this repo (read for deep detail):**
- `ISSUE_INVESTIGATION_REPORT.md` — investigation + fixes for Issues 1–5.
- `ENHANCEMENTS_REPORT.md` — investigation + implementation for E1–E5, plus a
  Deployment Runbook & Rollback Record for the E3/E4 backend migrations.

---

## 1. What Was Done — renfi (this repo)

### Issue 2 — App restarting when minimized (Samsung/Realme/Vivo/Oppo)
Root cause: Android OEM process death + no navigation/auth-flow state persistence.

- **`App.tsx`** — Navigation state persistence via `AsyncStorage` + `initialState`
  + debounced `onStateChange` on `NavigationContainer`. Restores state on launch,
  guards against deep links. Also added `lazy`/`Suspense` for code-splitting.
- **`src/hooks/usePersistedAuthFlow.js`** (NEW) — Persists OTP/auth flow
  (`authMode`, `otpData`, `savedAt`) to AsyncStorage; restores only valid,
  unexpired OTP steps.
- **`src/screens/UserAuthScreen.jsx`**, **`src/screens/ProviderAuthScreen.jsx`** —
  Replaced local `useState` for `authMode`/`otpData` with `usePersistedAuthFlow`
  so the OTP step survives app kills.

### Issue 3 — Keyboard flickering on registration / auth forms
Root cause: `KeyboardAvoidingView behavior="height"` on Android conflicting with
`windowSoftInputMode="adjustResize"`.

- Changed `behavior` from `'height'` → `undefined` (Android) in:
  `RegisterScreen.jsx`, `ProviderRegisterScreen.jsx`, `OTPVerifyScreen.jsx`,
  `OTPLoginScreen.jsx`, `ForgotPasswordScreen.jsx`, `ChangePasswordScreen.jsx`.

### Issues 4 & 5 — Incorrect location status + top-section flicker (Provider Home)
Root cause: conflated "no location yet" with "GPS disabled"; GPS contention from
multiple watchers; context value churn driving re-renders.

- **`src/context/LocationContext.jsx`** — Added `currentLocationRef` for stable
  `fetchLocation` identity; `applyLocation` with 25 m movement threshold + accuracy
  check; `fetchLocation({ silent })` to suppress loading state on background
  refresh; error/timeout now retains last known location; new derived
  **`locationStatus`** (`acquiring` / `available` / `disabled` / `denied`).
- **`src/services/socketService.js`** — Added shared `latestKnownLocation` cache
  (`setLatestLocation`/`getLatestLocation`); periodic sender reuses it (no
  redundant `getCurrentPosition`); added `subscribeTrackingChange` /
  `notifyTrackingChange`.
- **`src/components/LocationTrackingBanner.jsx`** — Switched from 2 s polling to
  `subscribeTrackingChange`.
- **`src/screens/ProviderHomeScreen.jsx`** — Consumes `locationStatus` for accurate
  messaging ("Getting your location…" vs "Location is off").

### E1 — Notification sound toggle (full control)
Was: toggle only affected foreground sound; background/quit always played sound.

- **`src/services/fcmService.js`** — Added `fixhomi_silent` Notifee channel
  (DEFAULT importance, no sound), so the backend can route to a silent channel.
- Backend side completes the loop (see §2).

### E2 — Emergency numbers for Providers
Providers can now open the Emergency Services screen, but **view-only** (no booking).

- **`navigation/RootNavigator.jsx`** — Registered `EmergencyServicesScreen` in
  `ProviderMainNavigator`.
- **`src/screens/ProviderHomeScreen.jsx`** — Added an "Emergency Numbers" card at
  the bottom → `navigation.navigate('EmergencyServices')`.
- **`src/screens/EmergencyServicesScreen.jsx`** — `handleServiceSelect` shows
  bundled offline numbers instantly, then refreshes from API in background (kills
  the open jank).
- **`src/services/emergencyServicesService.js`** — Added synchronous
  `getOfflineEmergencyNumbers`.

### E5 — "Coming Soon" for zero-provider services
- **`src/screens/UserHomeScreen.jsx`** — Imports `getAvailableCategories`; adds
  `availableCategories` state + `isCategoryComingSoon`; `ServiceCard` gets a
  `comingSoon` prop (dims card, badge, disables normal press → shows dialog).
- **`src/services/traditionalServiceService.js`** — Added `getAvailableCategories`
  client method (fails open on error).
- Backend supplies the available-categories endpoint (see §2).

### i18n (added this session — were missing, caused "[missing … translation]")
> NOTE: `i18n-js` returns a truthy `"[missing …]"` string for absent keys, so the
> `t('x') || 'fallback'` pattern did NOT mask missing keys. Keys MUST exist in
> locale files. Added to **`src/i18n/en.js`**, **`hi.js`**, **`mr.js`**:
- `userHome.comingSoon`, `userHome.comingSoonTitle`, `userHome.comingSoonMsg`
- `providerHome.emergencyNumbers`, `providerHome.emergencyNumbersSub`

### Emergency Services — provider filtering + scroll fix (final polish this session)
File: **`src/screens/EmergencyServicesScreen.jsx`**

1. **Providers see call-only numbers, no bookable services.**
   - Added `userType` from `useApp()`; `const isProvider = userType === 'provider'`.
   - Wrapped the entire **Location-based Services** section (Snake Catcher,
     Private Ambulance, Mortuary Van = `LOCATION_BASED_SERVICES`) in
     `{!isProvider && (…)}`. Providers now only see `STATIC_NUMBER_SERVICES`
     (Fire 101, Police 100, Hospital) + `GOVERNMENT_HELPLINE_SERVICES`
     (cyber crime, women & child, etc.), which are dial-only.
   - Adjusted the next section header's top margin to avoid an empty gap when the
     first section is hidden.
2. **Scroll position preserved when opening/closing a number card.**
   - Root cause: tapping a card set `step = 'static'`, and the main render had no
     branch for `'static'` → fell through to `null`, unmounting the selection
     `ScrollView` behind the transparent modal → remount on close snapped to top.
   - Fix: render `renderServiceSelection()` for **both** `'select'` and `'static'`,
     so the list stays mounted (dimmed) under the modal and scroll is retained.

---

## 2. What Was Done — noefix (Node backend) — context only

> These are already implemented and (per the user) **already pushed/deployed**.
> Listed here so the next assistant understands the full feature wiring.

- **E1 sound** — `utils/pushNotification.js` reads `preferences.notificationSound`;
  picks `fixhomi_notifications` vs `fixhomi_silent` channel; conditionally sets
  `defaultSound` / APNs `sound`.
- **E3 trial 2mo → 6mo** — `models/subscription.js`:
  `FIRST_APPROVAL_BONUS.durationDays` 60 → **180**.
  `controllers/documentVerificationController.js`: push copy "60 days" → "6 months".
  `helpers/trialMigration.js` (NEW): idempotent, hard-capped startup migration that
  extends existing `first_approval_bonus` trials to `start + 180 days`
  (proportional: already-consumed time is honored — e.g. 1 month used → 5 left).
  Supports `dryRun` and `providerId` filters.
- **E4 referral cycle 120 → 180 days (2×/year)** — `models/pointsLedger.js`
  (`getCurrentCycleId`) and `models/rewardCycle.js` (`getCycleDates`) updated to two
  calendar half-years: **C1 = Apr–Sep, C2 = Oct–Mar**. `helpers/referralCycleMigration.js`
  (NEW): extends the active `RewardCycle` window to the new scheme; preserves all
  existing `PointsLedger` entries; backward-compatible with historical aggregations.
- **E5 available categories** — `controllers/traditionalServiceController.js`:
  `getAvailableCategories` endpoint (30 s TTL cache); route registered in
  `routes/traditionalServiceRoutes.js` as `/available-categories`.
- **Migrations orchestration** — `server.js`: runs `trialMigration` +
  `referralCycleMigration` on startup; honors `MIGRATION_DRY_RUN` and
  `MIGRATION_PROVIDER_ID` env vars.
- **Admin data** — `controllers/referralController.js`: `adminDashboard` now returns
  a detailed `cycle` object (window, FY, status, days remaining).

**Migration timing note (answered for the user):** a provider's extended trial /
cycle is applied by the **startup migration** (runs once on deploy), not on next
login. New approvals get the full 6 months going forward.

---

## 3. What Was Done — temp_admin (Admin panel) — context only

- Navigation history made URL-driven (`setSearchParams`) so browser back/forward
  preserves tab/detail/filter/pagination state.
- Extracted a 3.6 MB base64 logo (`FixhomiLogo.jsx`) to a static asset → smaller
  initial JS bundle.
- Services "Demand Map" geographic analytics + cost-optimized heatmap: single cached
  backend aggregation endpoint with server-side grid binning; client-side, on-demand,
  cached (to avoid hammering the M10 MongoDB cluster).
- **`src/pages/FixhomianDetail.jsx`** — Added "Premium / Subscription" card
  (status, plan, dates, days remaining) for providers.
- **`src/pages/ReferralDashboard.jsx`** — Added "Current Cycle" card (window, FY,
  status, days remaining, progress bar).

---

## 4. Known / Deferred Items (NOT yet done)

- **Website (Next.js) terms** for the 6-month trial — intentionally deferred by the
  user ("we will update the next js later … extension does not require immediate
  update to terms on website").
- **CORS for local admin dev** — Not a code change. The Node backend intentionally
  strips `localhost` origins in production. For local admin dev use a Vite proxy or
  run the backend locally. (No `NODE_ENV` set on their host.) `server.js` CORS was
  briefly modified then **reverted** to original at the user's request.
- **Issue 1 (Refer & Earn)** — Descoped. User confirmed it works; "not a little work
  should be done for this task."

---

## 5. Working Conventions (please follow)

- **No assumptions, no workarounds** — investigate root cause from real code first.
- Production-grade, optimized, cost-efficient (startup; M10 cluster is expensive —
  avoid query-heavy patterns; cache where sensible).
- Keep proper folder structure; prefer editing existing files.
- Update `ISSUE_INVESTIGATION_REPORT.md` / `ENHANCEMENTS_REPORT.md` when continuing
  related work.
- i18n: always add real keys to `en.js` / `hi.js` / `mr.js` (don't rely on `||`).
- Provide clear commit messages for frontend and backend separately.
- Environment: Windows + PowerShell (use `;` to chain, not `&&`; `Get-ChildItem`).
- Model preference for this work: **Claude Opus 4.8**.

---

## 6. Quick File Index (renfi changes this session)

```
App.tsx                                  Issue 2 — nav state persistence
navigation/RootNavigator.jsx             E2 — register EmergencyServices for providers
src/hooks/usePersistedAuthFlow.js  (NEW) Issue 2 — OTP flow persistence
src/context/LocationContext.jsx          Issues 4/5 — locationStatus + thresholding
src/services/socketService.js            Issues 4/5 — shared location cache
src/components/LocationTrackingBanner.jsx Issue 5 — subscribe vs poll
src/services/fcmService.js               E1 — fixhomi_silent channel
src/services/emergencyServicesService.js E2 — getOfflineEmergencyNumbers
src/services/traditionalServiceService.js E5 — getAvailableCategories
src/screens/ProviderHomeScreen.jsx       Issues 4/5 + E2
src/screens/UserHomeScreen.jsx           E5 — Coming Soon cards
src/screens/EmergencyServicesScreen.jsx  E2 + provider filter + scroll fix
src/screens/UserAuthScreen.jsx           Issue 2
src/screens/ProviderAuthScreen.jsx       Issue 2
src/screens/RegisterScreen.jsx           Issue 3
src/screens/ProviderRegisterScreen.jsx   Issue 3
src/screens/OTPVerifyScreen.jsx          Issue 3
src/screens/OTPLoginScreen.jsx           Issue 3
src/screens/ForgotPasswordScreen.jsx     Issue 3
src/screens/ChangePasswordScreen.jsx     Issue 3
src/i18n/en.js | hi.js | mr.js           i18n keys (E2 + E5)
```
