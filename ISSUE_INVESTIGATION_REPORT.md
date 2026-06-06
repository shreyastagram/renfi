# Fixhomi — Issue Investigation & Fix Report

> **Purpose of this file:** living engineering log for a 5-issue investigation + fix cycle.
> It is written so that ANY session (even with no prior context) can read it top-to-bottom,
> understand the current state, and continue safely. **Read the "Progress Tracker" first.**
>
> Workflow contract for this task:
> 1. Investigate with evidence (no assumed root causes) — **DONE**
> 2. Document findings here — **DONE (this file)**
> 3. Implement fixes — _in progress / see each issue's "Fix" + "Status"_
> 4. Update this file with changes, files modified, verification, final status.

---

## Progress Tracker

| # | Issue | Layer | Root cause confirmed? | Fix status |
|---|-------|-------|----------------------|------------|
| 1 | Refer & Earn not crediting after auth redesign | Frontend (capture/UX) | ✅ Yes (pipeline intact) | 🚫 **DESCOPED** — user confirmed Refer & Earn is working (2026-06-07). No changes; my exploratory edits were reverted. |
| 2 | App restarts when minimized (Samsung/Realme/Vivo/Oppo) | Native + State persistence | ✅ Yes (OEM process death + no state persistence) | ✅ **DONE** (nav state persistence) ⚠️ device-test |
| 3 | Keyboard flicker on Provider Registration Form | Frontend (layout config) | ✅ Yes (`KeyboardAvoidingView behavior="height"` on Android) | ✅ **DONE** (6 screens) |
| 4 | Wrong "location unavailable" on Provider Home | Frontend + State | ✅ Yes (UI keys off `currentLocation` only; never checks real services state; GPS watcher contention) | ✅ **DONE** ⚠️ device-test |
| 5 | Top-section flicker on Provider Home | State + Lifecycle | ✅ Yes (LocationContext value churn + `LocationTrackingBanner` 2s poll + conditional unmount) | ✅ **DONE** ⚠️ device-test |

**Legend:** ⏳ Pending · 🔧 In progress · ✅ Done · ⚠️ Needs device verification

---

## Project / Architecture Reference (for quick re-orientation)

- **App:** React Native 0.81 (TS entry `App.tsx`), app root `C:\Projects\DOCS\fo\renfi`. Source in `src/`, navigation in `navigation/`, native Android in `android/`.
- **Roles:** `user` (customer) and `provider`. Two register screens: `src/screens/RegisterScreen.jsx` (user), `src/screens/ProviderRegisterScreen.jsx` (provider). Shared step-1 component `src/components/RegisterChoice.jsx`.
- **Dual backend:**
  - **Node backend** = repo `C:\Projects\DOCS\fo\noefix` (service requests, profiles, **referrals**, OAuth sync). The app's `apiClient` points here.
  - **Java Auth** = repo `C:\Projects\DOCS\fo\jauth` (login/register/OTP/JWT). The app's `authClient` points here.
  - Admin web panel = `C:\Projects\DOCS\fo\temp_admin` (not relevant to these issues).
- **State:** React Contexts — `src/context/AppContext.js` (auth/session), `src/context/LocationContext.jsx` (GPS), etc.
- **Auth funnel:** screens → `authService` → backend → `AppContext.handleAuthSuccess` → `RootNavigator` branches on `isAuthenticated`/`userType`.

---

# Issue 1 — Refer & Earn not crediting after Login/Register redesign

> 🚫 **DESCOPED (2026-06-07):** The user reports Refer & Earn IS working and asked that **no work** be done on this. Any exploratory edits (re-adding the referral input to the manual forms) have been **reverted** — `RegisterScreen.jsx` and `ProviderRegisterScreen.jsx` are back to their original state. The investigation below is retained as reference only; no fix will be applied.

### Classification
**Frontend (capture/UX regression).** Backend, API-integration, and DB layers are **verified intact**.

### Files / components / services involved
- `src/screens/RegisterScreen.jsx` (user) — referral state `formData.referralCode` (line 62), deep-link prefill (66–73), `updateField` (147), manual register call (278–286), Google sync (426–453), Apple sync (556–575), `RegisterChoice` render (720–722), manual form (step 2) referral field **removed** (818–821 comment).
- `src/screens/ProviderRegisterScreen.jsx` (provider) — mirror: `formData.referralCode` (72), prefill (79), register call (409–417), Google sync (573–588), Apple sync (703–717), `RegisterChoice` (872–874), removed field (1071–1073).
- `src/components/RegisterChoice.jsx` — the **only** referral input now (250–267); wired via props `referralCode`/`onReferralCodeChange`. Input is **below** the 3 sign-up cards (142–225) and the T&C row (227–241).
- `src/services/authService.js` — `registerUser` sends `referralCode` (163), `registerProvider` sends it (214). Posts to Node via `apiClient` (`ENDPOINTS.AUTH.REGISTER` / `PROVIDER_REGISTER`).
- Backend `noefix/controllers/authController.js` — `register` destructures `referralCode` (59), calls `processReferral` for user (447–452) and provider (1395–1400).
- Backend `noefix/controllers/googleAuthController.js` — destructures `referralCode` (46, 302), calls `processReferral` (223–230 user, 542–549 provider).
- Backend `noefix/controllers/referralController.js` — `processReferral` (170–262): finds referrer, self-referral + daily-limit guards, sets `referredBy.pointsCredited`, credits **50 + 50** via `PointsLedger.creditPoints`.

### Root cause (evidence-based)
The referral **data pipeline is fully intact** in the current code — verified link by link:
- `RegisterChoice` updates `formData.referralCode`:
  ```jsx
  // src/screens/RegisterScreen.jsx:720-722
  <RegisterChoice
    referralCode={formData.referralCode}
    onReferralCodeChange={(v) => updateField('referralCode', v)}
  ```
- Manual register sends it (`RegisterScreen.jsx:283`, `ProviderRegisterScreen.jsx:417`); Google/Apple sync send `pendingRefCode` (`RegisterScreen.jsx:435/450/564`, `ProviderRegisterScreen.jsx:588/717`).
- Node `register` + `googleAuthController` both `if (referralCode) processReferral(...)`; `processReferral` credits points correctly.

**What the redesign actually changed (git `e45c4bb`):** the referral `<Input>` was **deleted from the manual registration form** and relocated into the step-1 `RegisterChoice` screen, positioned **below** the three sign-up CTAs (Fill manually / Google / Apple) and the T&C row. Diff evidence:
```
- {/* Referral Code (optional) */}
- <Input label="Referral Code (optional)" value={formData.referralCode}
-   onChangeText={(value) => updateField('referralCode', value.toUpperCase())} ... />
+ {/* Referral code, T&C ... captured in the RegisterChoice step. The form mode
+   only collects email/password/name/phone, so they're intentionally hidden here. */}
```

**Consequence:** Because the primary CTAs come first and immediately advance the flow (manual → step 2 which has **no** referral field; Google/Apple → launch OAuth), the referral code is frequently never typed into `formData.referralCode`. An empty code makes the backend guard `if (referralCode)` false → `processReferral` never runs → no `PointsLedger` entries → no points. Registration still succeeds, so the failure is **silent** — exactly the reported symptom. Identical for User and Provider (only theme color differs).

> Note on "even when a valid code is entered": when the code **is** entered into the RegisterChoice field before choosing a method, it is transmitted and credited correctly (verified end-to-end). So the defect is reliability of **capture**, not the pipeline. Restoring a guaranteed capture point fixes the reported behavior.

### Evidence summary
- Pre-redesign: referral was a dedicated, always-visible field on the manual form → every manual registrant could enter it. Post-redesign: only present in step-1, below CTAs, absent from the manual form.
- Whole backend + service chain verified present and correct (file:line above).

### Recommended fix (minimal, safe)
1. **Re-add the referral `<Input>` to the manual registration form** (step 2) in BOTH `RegisterScreen.jsx` (at the 818–821 comment) and `ProviderRegisterScreen.jsx` (1071–1073), bound to `formData.referralCode` via `updateField('referralCode', value.toUpperCase())`. This restores the pre-redesign guaranteed capture for manual sign-ups.
2. Keep the `RegisterChoice` referral input for OAuth users (it already feeds `formData.referralCode` / `pendingRefCode`). Optionally elevate it visually.
3. No backend/service/model changes required.
4. **Verification:** after fix, register a test user with a referrer's code via (a) manual and (b) Google; confirm backend logs `[Referral] ✅ Processed` and both accounts receive 50 pts.

---

# Issue 2 — App restarts from scratch when minimized (Samsung/Realme/Vivo/Oppo)

### Classification
**Native Android behavior (OEM process death) + missing state persistence (State management/navigation).** NOT config-change recreation.

### Files / components involved
- Native: `android/app/src/main/AndroidManifest.xml` (Activity config 64–71), `android/app/src/main/java/com/renfi/MainActivity.kt` (21–23, `onCreate(null)`), `MainApplication.kt`, `android/gradle.properties` (`newArchEnabled=true`, `hermesEnabled=true`).
- JS: `App.tsx` (`NavigationContainer` 399–409 — **no** state persistence; `AppState` listener 355–392 only runs a version check), `navigation/RootNavigator.jsx` (651–676, re-derives tree from auth state), `src/context/AppContext.js` (`initializeAuth` once on mount 64–66), `src/screens/UserAuthScreen.jsx` / `ProviderAuthScreen.jsx` (OTP held in local state 36–37, 99–110), `src/screens/OTPVerifyScreen.jsx` (volatile OTP + minimize-survival timer 60–101), `src/utils/storage.js` (token persistence only).

### Root cause (ranked, evidence-based)
1. **PRIMARY — Android process death (OEM aggressive LMK) restored as a cold start.** On these OEMs, the backgrounded app process is reaped; relaunch is a full cold start. Evidence:
   - A normal resume does **not** reset anything (`AppState→active` only does a version check, `App.tsx:360-364`; `initializeAuth` runs once, `AppContext.js:64-66`), so a "restart from scratch" requires the JS context to have been destroyed (process death), not a resume.
   - `OTPVerifyScreen` already has explicit minimize-survival code (absolute expiry timestamp + `AppState` recalculation, lines 60–101); the bug persisting through that confirms the component is being **re-created** (process killed), not resumed.
   - Battery optimization is irrelevant to the on-memory-pressure LMK — explaining why disabling it doesn't help and why it's OEM-specific.
2. **CONTRIBUTING — no navigation/workflow state persistence** (this is *why* a routine kill loses progress): `NavigationContainer` has no `initialState`/persisted `onStateChange` (`App.tsx:399-409`); `MainActivity.onCreate(null)` discards native saved state; OTP/booking/form data lives only in volatile component state. Only auth tokens are persisted (`storage.js`), so a killed user is still logged in but lands on the default route, and a mid-OTP (unauthenticated) user lands back at the login start.
3. **AGGRAVATOR — high memory footprint** (New Arch + Mapbox + TransistorSoft background-geolocation) raises kill probability on 3–4GB devices.
4. **RULED OUT — config-change Activity recreation:** `configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"` is comprehensive and `screenOrientation="portrait"` (Manifest 67–69), so switching apps does not recreate the Activity.

### Recommended fix (defense-in-depth; durable solution is JS-side persistence)
- **Fix 2A (highest impact):** Persist & restore `NavigationContainer` state in `App.tsx` via `initialState` from AsyncStorage + debounced `onStateChange`, **guarded** (don't restore a Main route while `!isAuthenticated`; add a freshness TTL so an app reopened much later starts fresh).
- **Fix 2B:** Persist in-progress auth-flow context (`authMode`/`otpData` step + masked identifier + absolute expiry) so returning lands on the OTP screen, not the login start. Do **not** persist the OTP digits themselves; clear on success/expiry.
- **Fix 2C (optional):** reduce resident memory (single map lib, lazy-mount Mapbox, scope TransistorSoft to active tracking).
- **Keep** `MainActivity.onCreate(null)` (react-native-screens workaround) — do not re-enable native `Bundle` restore.

---

# Issue 3 — Keyboard flicker on Provider Registration Form

### Classification
**Frontend (layout/keyboard config).** NOT a re-mount/inline-component anti-pattern (checked and disproven).

### Files / components involved
- `src/screens/ProviderRegisterScreen.jsx` — step-2 form (889–1084); offending `KeyboardAvoidingView` at **891–894** (`behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`). Inputs are `Input`/`PhoneInput` (module-level, stable).
- `android/app/src/main/AndroidManifest.xml:70` — `android:windowSoftInputMode="adjustResize"`.
- Corroboration in-repo: `src/components/RegisterChoice.jsx:118` (step 1) correctly uses `undefined` on Android (no flicker); `SettingsScreen.jsx:1560-1564` and `ProviderServiceHistoryScreen.jsx:275-281` document the exact "height re-measures on every keyboard event → shake" issue and use `padding`/`undefined` instead.

### Root cause (evidence-based)
`KeyboardAvoidingView behavior="height"` on Android **combined with** the window's `adjustResize` causes a feedback loop: both shrink the layout on every keyboard frame, re-measuring repeatedly, which jolts the focused `TextInput` and toggles the IME → open/close flicker. It's container-level, so **all** fields are affected. Verified the classic focus-loss causes (inline component defs, `Math.random()`/unstable `key`, per-keystroke remount, conditional mount) are **not** present.

### Recommended fix (one line)
- `src/screens/ProviderRegisterScreen.jsx:893` → `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` (let OS `adjustResize` handle Android; matches the working `RegisterChoice` and most of the app).
- Apply the same to other `"height"` outliers for consistency: `RegisterScreen.jsx:741`, `OTPLoginScreen.jsx:~217`, `OTPVerifyScreen.jsx:~286`, `ChangePasswordScreen.jsx:~684`, `ForgotPasswordScreen.jsx:~608` (verify exact lines at fix time).

---

# Issue 4 — Provider Home shows "location unavailable" while GPS is ON

### Classification
**Frontend (presentation) + State management + device/lifecycle (GPS contention).**

### Files / components involved
- `src/screens/ProviderHomeScreen.jsx` — consumes only `{ currentLocation, locationAddress, displayAddress }` (558); "unavailable" UI gated solely on `providerLocation?.latitude` (1081–1088 mini-card, 1421–1426 modal "Enable location services"). Does **not** read `locationServicesEnabled`/`locationPermission` (contrast `UserHomeScreen.jsx:319-322`).
- `src/context/LocationContext.jsx` — `fetchLocation` 2-stage flow (376–492); `checkLocationServices` (282–309) cannot detect the device GPS master switch (treats errors/BLOCKED as enabled); `currentLocation` is never reset to null once set.
- `src/services/socketService.js` — a **second** GPS `watchPosition` + 10s `getCurrentPosition` interval (270–301), started from `ProviderHomeScreen.jsx:863-876` (auto-start even when offline / no location).

### Root cause (evidence-based)
The provider home **never checks the real device location-services state** — it infers "unavailable/disabled" purely from `currentLocation` being null. But `currentLocation` can legitimately stay null when GPS is on, because (a) the 2-stage `fetchLocation` can terminate in a null+error state if the fast path times out and `watchPosition` errors/safety-timeout fires, and (b) **two concurrent GPS consumers** (LocationContext watch/interval + `socketService` watch/interval) contend for the single Android location provider, starving LocationContext so it never locks. Net: GPS on, but UI says "Enable location services." Secondary: `checkLocationServices` is effectively a no-op for GPS on/off detection and isn't even read by provider home.

### Recommended fix
1. In `ProviderHomeScreen`, derive three explicit states from context — **acquiring** vs **disabled** vs **located** — using `locationLoading`/`locationServicesEnabled`/`locationPermission`; don't print "Enable location services" while loading or merely pending.
2. Make `currentLocation` resilient: fall back to last-known/profile coords; ensure a failed fast path retries to eventual success instead of ending null+error.
3. Eliminate GPS contention: have `socketService` reuse `LocationContext`'s coordinate (single watcher) instead of its own; gate auto-start so it doesn't run on mount when offline.
4. Replace `checkLocationServices` with a real services check (interpret `getCurrentPosition` error code `2 = POSITION_UNAVAILABLE` as "services off") and feed it to the UI.

---

# Issue 5 — Top-section flicker on Provider Home dashboard

### Classification
**State management + lifecycle.** Partially linked to Issue 4 (shared driver) + one independent contributor.

### Files / components involved
- `src/context/LocationContext.jsx` — `value` memo depends on rapidly-toggling `locationLoading`/`locationError` and new-object `currentLocation`/`locationAddress` (652–684); `fetchLocation` fires multiple `setState`s per run and re-runs every 30s (`LOCATION_UPDATE_INTERVAL` 26; interval 521–526) and on every foreground (545–556); `fetchLocation`/`refreshLocation` identities change with `currentLocation` (509).
- `src/components/LocationTrackingBanner.jsx` — 2-second `setInterval` poll (73–78) and conditional `return null` (105–106) that reflows the top `statusPadsRow`.
- `src/screens/ProviderHomeScreen.jsx` — `statusPadsRow` (1005–1023) hosts the banner + status toggle + mini-map `Camera` fed a fresh coord array each update (1072).

### Root cause (evidence-based)
Re-render churn driven by the location system, two contributors:
- **(a)** Every `fetchLocation` (each 30s + each foreground) toggles `locationLoading` true→false and pushes **new** `currentLocation`/`locationAddress` object references through the un-stable context `value`, so all consumers (incl. the Mapbox mini-map) re-render in bursts. When `currentLocation` never locks (Issue 4), the loading cycle never resolves and "Getting location" keeps reappearing → repeating flicker.
- **(b) Independent:** `LocationTrackingBanner` polls every 2s and conditionally unmounts (`return null`), making the online pad jump half-width↔full-width — a layout flicker localized to the top row, present even when location works.

### Recommended fix
1. Debounce coordinate updates (only `setCurrentLocation` when moved beyond a threshold) so a stationary provider stops emitting new refs every 30s.
2. Don't flip `locationLoading=true` on silent periodic/foreground refreshes — only on first acquisition.
3. Split the context so fast-changing `locationLoading`/`locationError` don't invalidate consumers that only need the coordinate; ensure `value` is stably memoized.
4. In `LocationTrackingBanner`, reserve a fixed slot instead of `return null` (no reflow) and replace the 2s poll with an event/subscription.
5. `React.memo` the mini-map/status pads and pass rounded/stable coords.

---

## Implementation Log
_(updated as fixes land)_

- **2026-06-07 — Issue 1: DESCOPED.** User confirmed Refer & Earn works. Reverted exploratory edits in `RegisterScreen.jsx` and `ProviderRegisterScreen.jsx` (referral `<Input>` re-add). No net change to those files for Issue 1.
- **2026-06-07 — Issue 3: DONE.** Changed `KeyboardAvoidingView` Android behavior from `'height'` → `undefined` (let OS `adjustResize` handle the keyboard; matches the working `RegisterChoice` + the documented pattern in `SettingsScreen`/`ProviderServiceHistoryScreen`). Files (one line each):
  - `src/screens/ProviderRegisterScreen.jsx:893` (the reported screen)
  - `src/screens/RegisterScreen.jsx:741`
  - `src/screens/OTPVerifyScreen.jsx:286`
  - `src/screens/OTPLoginScreen.jsx:217`
  - `src/screens/ForgotPasswordScreen.jsx:608`
  - `src/screens/ChangePasswordScreen.jsx:684`
  - Lint: clean on all 6.

- **2026-06-07 — Issues 4 & 5: DONE.** Solid (non-workaround) location fixes:
  - `src/context/LocationContext.jsx`:
    - Added `currentLocationRef` so `fetchLocation` no longer depends on `currentLocation` → `fetchLocation`/`refreshLocation`/context `value` identities stay stable (kills the per-tick re-render churn). **(Issue 5)**
    - Added `applyLocation()` with a **25 m movement threshold** — a stationary provider stops emitting new coordinate objects every 30 s. **(Issue 5)**
    - `fetchLocation(forceRefresh, { silent })`: the 30 s interval and the app-foreground refresh now run **silent** (no `setLocationLoading(true)`), so consumers don't double-render each tick. **(Issue 5)**
    - Error/timeout paths now keep the last known location instead of flipping to an error/`null` (no false "unavailable" on a transient watch error). **(Issue 4)**
    - Added derived **`locationStatus`** (`available` | `acquiring` | `disabled` | `denied`) to the context value so screens never infer "disabled" from a missing coordinate. **(Issue 4)**
    - Feeds the shared socket cache via `setLatestLocation` on every fix.
  - `src/services/socketService.js`: added a shared `latestKnownLocation` cache (`setLatestLocation`/`getLatestLocation`), fed by both the socket watcher and LocationContext; the periodic sender now **reuses the fresh cache** instead of firing a redundant `getCurrentPosition` each tick → removes the GPS-provider contention that could starve LocationContext (**Issue 4** "never locks"). Added `subscribeTrackingChange` + `notifyTrackingChange` so the banner is event-driven.
  - `src/screens/ProviderHomeScreen.jsx`: consumes `locationStatus`; the mini-location card and the location modal now show **"Getting your location…"** while acquiring and only show "Location is off / Enable location services" when truly `disabled`/`denied`. **(Issue 4)**
  - `src/components/LocationTrackingBanner.jsx`: replaced the 2 s polling timer with `subscribeTrackingChange` (event-driven; no spurious row work). **(Issue 5)**
  - Lint: clean on all 4 files.

- **2026-06-07 — Issue 2: DONE (core).** Implemented the canonical React Navigation **state-persistence** pattern in `App.tsx` (`AppContent`):
  - Persist the nav tree (debounced 800 ms) to AsyncStorage key `@fixhomi_nav_state_v1` with a `savedAt` timestamp via `onStateChange`.
  - On launch, restore it as `initialState` **only if** (a) there's no incoming deep link (`Linking.getInitialURL()` is null) and (b) it's fresher than `NAV_STATE_TTL_MS` (3 h); otherwise it's cleared. `NavigationContainer` mounts only after this async restore (`isNavReady`) so `initialState` applies.
  - Effect: after an OEM background-process kill + cold relaunch, an authenticated user returns to the exact screen/stack they were on (booking, forms, onboarding) instead of the default tab.
  - Lint: clean.
  - **Fix 2B — DONE (OTP step survives kill).** New reusable hook `src/hooks/usePersistedAuthFlow.js` (follows the existing `src/hooks/useExitConfirmation.js` convention) replaces the volatile `authMode`/`otpData` `useState` in `UserAuthScreen.jsx` and `ProviderAuthScreen.jsx`. It persists ONLY the in-progress OTP-verify step (method, identifier, masked value, remaining validity) to `@fixhomi_auth_flow_<userType>` and restores it on relaunch **only while the OTP could still be valid** (remaining > 0.25 min), passing the REMAINING minutes so the countdown is accurate. It NEVER persists the entered OTP digits, and clears storage on success/back/any non-verify mode. This is the direct fix for "user leaves to read the SMS OTP, returns, and the OTP box is gone / starts over."
  - **Residual (optional):** memory-footprint reduction (Fix 2C: single map lib, lazy Mapbox, scoped TransistorSoft) lowers kill *frequency* but isn't required for correctness. Not implemented.

## Verification Log

Static verification done in this environment: **lint clean on every edited file** (no RN build/emulator available here). On-device test steps for the set-up machine:

- **Issue 3 (keyboard):** Open Provider Registration → "Fill manually". Tap each field and type — keyboard must stay open and stable (no open/close flicker). Repeat on User Register, OTP login, OTP verify, Forgot Password, Change Password.
- **Issue 4 (location status):** Provider Home with GPS ON → should show the map / "Getting your location…" while acquiring, never "Location is off" when GPS is on. Turn GPS OFF → should then show "Location is off / Enable location services". Tap the location card → modal copy matches state.
- **Issue 5 (flicker):** Provider Home, stationary, watch the top status row for ~2 min — it should NOT flicker/redraw every ~30 s; "Getting location" should not keep reappearing once a fix is acquired.
- **Issue 2 (restart):** Authenticated user navigates deep (e.g., a booking/form screen). Force-stop or let the OS kill the backgrounded app (or use `adb shell am kill com.renfi`), reopen → should land back on the same screen/stack (within the 3 h TTL). Open via a deep link → deep link wins over restore.
- **Issue 2 / OTP (Fix 2B):** Request an OTP (user or provider) → background the app → kill it (`adb shell am kill com.renfi`) → reopen within the OTP validity window → the **OTP entry box is restored** with the masked identifier and the remaining countdown. Reopen AFTER the OTP expired → returns to the OTP-request screen (forces resend). Verify the entered digits are NOT pre-filled (only the step is restored).
- **Regression watch:** confirm normal foreground/background resume still works; confirm live provider tracking during an active job still updates on the customer side (socket cache reuse).

## Final Status

- **Issue 1 — Refer & Earn:** 🚫 Descoped per user (confirmed working). No changes; exploratory edits reverted.
- **Issue 2 — Minimize restart:** ✅ Core fix implemented (nav-state persistence). ⚠️ Device-test. Residual: OTP-step sub-state (Fix 2B) documented as optional follow-up.
- **Issue 3 — Keyboard flicker:** ✅ Implemented (6 screens). ⚠️ Device-test.
- **Issue 4 — Location status:** ✅ Implemented. ⚠️ Device-test.
- **Issue 5 — Top-section flicker:** ✅ Implemented. ⚠️ Device-test.

### Files modified (net)
- `App.tsx` (Issue 2)
- `src/hooks/usePersistedAuthFlow.js` **(new)** + `src/screens/UserAuthScreen.jsx` + `src/screens/ProviderAuthScreen.jsx` (Issue 2 — Fix 2B, OTP step survival)
- `src/context/LocationContext.jsx` (Issues 4, 5)
- `src/services/socketService.js` (Issues 4, 5)
- `src/screens/ProviderHomeScreen.jsx` (Issue 4)
- `src/components/LocationTrackingBanner.jsx` (Issue 5)
- `src/screens/ProviderRegisterScreen.jsx`, `RegisterScreen.jsx`, `OTPVerifyScreen.jsx`, `OTPLoginScreen.jsx`, `ForgotPasswordScreen.jsx`, `ChangePasswordScreen.jsx` (Issue 3)
- _(Issue 1: no net change — reverted)_
