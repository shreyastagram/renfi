# Release 1.0.6 (vc31) — Stability Hotfix: crash, auto-logout, jitter & location fixes

> Written 2026-07-30 on the Windows session; execute the release from the Mac.

> Branch: `feature/profile-redesign`. Pull this on the Mac and build from HEAD.
> Everything below was investigated, implemented, and adversarially re-verified
> by two independent review passes (logout coverage + rendering correctness);
> every review finding rated serious was fixed before this handoff.

## 1. Why this release exists

Production 1.0.5 (vc30, built 2026-07-15 at `0c13f36`) shipped WITHOUT the
July-20 stability work and had four incident families:

1. **Fatal `TypeError: cyclical structure in JSON object`** (top Crashlytics
   crasher, 9 events / 7 users) — App.tsx nav-state persistence
   `JSON.stringify` of route params (held by reference, unguarded, in a
   `setTimeout`) — foreground-only, 1.0.5-only, all devices.
2. **Unexpected auto-logouts with missing Crashlytics logs** — a family:
   startup refresh-rotation race (single-use jauth tokens), headless
   TransistorSoft refresh discarding rotated tokens (vc30 log-only),
   silent logout paths with zero telemetry, plus backend-only causes (§5).
3. **Low-end-Android render storms** (Redmi 12 / Helio G88 / Mali-G52):
   online→loading→online availability-toggle loop, My Jobs full-screen
   reload loop, endless shimmer, Android BlurView flicker, OS status/nav
   bar flicker (a *symptom* of the render storms + heads-up notifications).
4. **"Enable location" while GPS is ON** — previously "fixed" (Issue 4,
   shipped in vc30) but two root causes remained: FINE-only permission
   checks (Android 12+/MIUI "Approximate" = COARSE-only read as *denied
   forever*) and GPS error code 2 misread as "GPS switch off" (sticky).

Other Crashlytics issues triaged: SoLoader `libreactnative.so` = **emulator-only**
(`Sdk_gphone64_x86_64`, ABI-mismatch splits — ignore); TransistorSoft
`onSaveInstanceState` IllegalStateException = library dialog after backgrounding,
5 events, spans 1.0.4→1.0.5 — bump plugin next cycle, not this release.

## 2. What is on this branch (commits since `5cfcd56`)

1. **feat(telemetry)** — nav-persist cycle diagnostics + reason-coded logout
   instrumentation:
   - Both nav-state stringify sites wrapped; on failure a cycle-localizing
     walker (metadata only, never serializes the suspect) emits
     `NavStatePersistNonFatal` with route / param key / constructor / cycle
     path / hazards (e.g. `axios-shape` fingerprints the AxiosError spread).
   - Every authenticated→logged-out path emits a unique reason code with
     storage truth (Keychain / fallback / userData), token expiry,
     refresh-in-flight, current route, and same+prior-session correlation
     (`LogoutDiagnostic`, enriched `ForcedLogoutNonFatal`,
     `PriorSessionDiagnostic`).
   - Persistent markers detect process death inside a refresh-rotation or
     token-write window (burned single-use token → next-boot logout).
   - Differential probes (`StringifyProbeNonFatal`) at the 3 other unguarded
     stringify sites.
2. **fix(location+jitter)** — see §1 items 3–4:
   - COARSE ("Approximate") accepted as granted in LocationContext,
     UserHomeScreen (check + request paths), LocationMap.
   - Acquisition follows the grant: `enableHighAccuracy` only under a FINE
     grant (`fineGrantedRef`) — a coarse grant now yields a coarse FIX, not
     a permanent "Waiting for GPS signal" (adversarial-review catch).
   - Real GPS-off detection via `DeviceInfo.isLocationEnabled()`; code 2 no
     longer claims "location off"; foreground re-checks permission+switch so
     returning from Settings recovers; `NEVER_ASK_AGAIN` on EITHER
     permission → 'blocked' (Settings deep-link preserved).
   - `refreshVerificationStatus` no longer flips global `isProfileLoading`
     per foreground and keeps user/profile identity when unchanged (was the
     toggle-loop + effect-churn driver).
   - ProviderServiceHistoryScreen: `fetchJobs` deps narrowed to primitives;
     full-screen shimmer only before first successful load; reset on
     providerId change.
   - `useShimmerAnimation(active)` gate actually implemented (the July-20
     "stop shimmer when idle" was a NO-OP — the hook ignored its argument).
     Additionally, on low-end devices (`IS_LOW_END_ANDROID` in
     src/utils/deviceClass.js: Android <12 or ≤6GB RAM — the Redmi 12 class)
     ALL shimmer sweeps render static — one gate inside the hook covers
     every screen, including the per-row loops in UserServiceHistory that
     were the worst remaining GPU offender. High-end keeps the animation.
   - `SafeBlurView`: Android blur disabled app-wide (iOS keeps blur); the
     only real Android call sites were GlobalBanner + the tab bar.
   - `authFetch`: 30s AbortController timeout (one hung request used to pin
     Promise.all loading states forever); callers with own `signal` untouched;
     ProviderHome `onRefresh` wrapped in try/finally so an abort can't strand
     the spinner.
   - ProfileScreen stuck-in-loading: the skeleton gate no longer requires
     `profile` when `user` data is renderable (a dead startup fetch kept the
     full-screen shimmer all session), and while `profile` is null the screen
     retries `refreshProfile` every 15s (previously no retry path unless the
     user refocused the tab).
   - socketService: handshake `auth` is now a function (evaluated per
     reconnection attempt) so reconnects present the CURRENT access token —
     the static snapshot meant every reconnect after the 24h token expiry
     was rejected and providers silently stopped receiving job events.
     (Orphan-socket teardown guard + no-reinit-on-GPS-move were already on
     this branch from July 20 and were verified by the review pass.)
3. **release(1.0.6)** — Android `versionCode 31` / `versionName "1.0.6"`;
   iOS `MARKETING_VERSION 1.0.6` / `CURRENT_PROJECT_VERSION 3`.
4. **fix(review)** — adversarial-review findings (this commit):
   - Startup refresh re-reads tokens INSIDE the single-flight mutex (the
     pre-mutex snapshot could still double-spend a rotated token).
   - Headless + foreground TransistorSoft persist require BOTH token halves
     (persisting `refreshToken: undefined` wrote a pair that read back as
     "no session" → guaranteed logout next launch).
   - `refresh_no_token` no longer clears tokens when the storage PROBE still
     sees a pair (a Keychain read error is not a logout).
   - Logout telemetry is strictly read-only (was calling `getTokens()`,
     which re-writes storage — could resurrect a cleared session);
     `auth_expired_signal` is now `lite` (no post-clear attribute overwrite).
   - `handleAuthExpired` try/finally (a throw could latch
     `logoutInProgressRef` and permanently block all logout handling);
     `initializeAuth` outer catch now reason-coded (`startup_init_threw`);
     `boot_no_user_data` probe non-blocking (was adding up to ~1.5s to
     logged-out boots); prior-session markers consumed on logged-out boots.

## 3. Verification status

- All changed files parse clean under the project Babel config; the cycle
  walker has a 17-case functional test (cycle attribution, DAG-alias
  no-false-positive, hazards, depth bail, garbage safety) — all passing.
- **Logout verdicts after fixes**: rotation race CLOSED app-side (mutex +
  in-mutex re-read); headless burn CLOSED; 401-only contract HOLDS incl.
  storage-read-failure guard; every logout path reason-coded.
- **Rendering verdicts after fixes**: toggle loop, Jobs reload loop,
  ProviderHome shimmer, BlurView flicker, stuck loading — all closed at the
  mechanism level. Device-test on the Redmi 12 remains mandatory (§4).

## 4. Mac session — exact steps

1. `git checkout feature/profile-redesign && git pull` (expect HEAD = the
   fix(review) commit; hashes were rewritten once for author identity —
   if the Mac clone has stale local commits, `git reset --hard origin/feature/profile-redesign`).
2. `npm install`; `cd ios && pod install && cd ..`.
3. **Device test (release build)** — run the FULL user-facing test suite in
   §7 below. Minimum device matrix: Redmi 12 (Android 13, the reported
   device class) + one high-end Android + one iPhone.
4. Build: Android AAB (vc31) → Play Console; iOS archive (1.0.6/3) →
   App Store Connect. **Play Data Safety + Apple Privacy labels**: re-check —
   Firebase/GA4 analytics were added this cycle (PENDING_STABILITY_WORK §D).
5. **Backend deploys (required — app fixes alone don't stop all logouts)**, in
   order:
   a. jauth: merge `245be10` (refresh TTL 7→60 days) into `main`, push
      (Render auto-deploys). Prod still issues 7-DAY refresh tokens.
   b. jauth: merge `3ef879b` Phase 0 (JWT re-keyed email→userId). Without
      it, prod 401s `ACCOUNT_DELETED` for phone-only users → the app force-
      logs them out ~3.5s after EVERY launch (app-side this is correct
      delete-handling; only the backend can fix it). Deploy before or with
      the app release.
   c. **Find the 45s rotation-grace commit (`jarbac 0d0ade9`)** — it is NOT
      in any repo on the Windows machine; it should be on this Mac. Merge →
      jauth main. If lost, re-implement (AUTH_STARTUP_LOGOUT_FIX.md §B).
   d. Confirm in the Render dashboard which branches actually deploy
      (jauth=`main`; noefix=`milestone-branch` or `june_enhancement_bugs`).
6. Post-release: watch Crashlytics for `NavStatePersistNonFatal` (names the
   screen+param of the old top crash), `LogoutDiagnostic` reason codes,
   `PriorSessionDiagnostic` (crash→logout correlation). The old fatal
   becoming a non-fatal will IMPROVE crash-free rate before the root cause
   is removed — read the new events, not the headline number.

## 5. Known-remaining (deliberately not in this release) — flags

- **Backend-only logout causes** until §4.5 deploys: 7-day TTL expiry,
  phone-only `ACCOUNT_DELETED` loop, no rotation grace/reuse-detection
  (native TransistorSoft refresh still races JS by design; grace window is
  the real fix). noefix returns 401 on Mongo/DB errors (infra failure looks
  like auth failure → needless rotations) — schedule a middleware fix.
- The `/users/me` background check still string-matches `!message.includes('expired')`
  and treats a missing message as logout-worthy — instrumented
  (`bg_check_401_non_expired`), revisit after backend deploys.
- AxiosError spread `{...refreshError}` in apiClient (~line 455) is still the
  suspected cycle SOURCE — the crash is now caught+diagnosed instead;
  remove the spread once `nav_fail_hazards=axios-shape` confirms it in field data.
- Shimmer loops on 3 always-mounted sites (UserServiceHistory per-row,
  ProfileScreen inline, ServiceRequestDetail OTP) still animate on HIGH-END
  devices — harmless there; low-end devices render them static via the
  device-class gate. Passing real `active` flags per site = next perf pass.
- Single-source consolidations done late in the session: Android FINE/COARSE
  permission semantics live ONLY in src/utils/locationPermission.js (used by
  LocationContext, UserHomeScreen, LocationMap); the TransistorSoft
  rotated-pair guard lives ONLY in storage.storeRotatedTokenPair (used by
  index.js headless + backgroundLocationService); the socket handshake token
  is refreshed ONLY via the auth-function in socketService (no other updater
  exists — verified).
- Imperative StatusBar focus-effects desync RN's prop stack (8 screens) and
  `VerificationDashboardScreen` flips barStyle between loading/loaded —
  minor visual; next pass.
- `markRefreshWindowClosed`/`markTokenWriteEnd` are fire-and-forget removes —
  rare false-positive `PriorSessionDiagnostic` after a kill right at
  refresh-success; acceptable noise, read accordingly.
- Permission dialogs lost their custom rationale copy (`requestMultiple` has
  no rationale overload) — cosmetic.
- TransistorSoft plugin bump (onSaveInstanceState crash) — next cycle.
- `LocationSharingContext` 30s/60s always-on polling — next perf pass.

## 6. Reference docs (see §7 below for the test suite)

`AUTH_STARTUP_LOGOUT_FIX.md` (auth contract + change log),
`docs/PENDING_STABILITY_WORK_2026-07.md` (parked jitter list — partially
superseded by this session), `ISSUE_INVESTIGATION_REPORT.md` (Issue 4
history), `RELEASE_TEST_GUIDE_1.0.5.md` (fuller manual test matrix).

## 7. Full manual test suite — as an APP USER (no logs, no dashboards)

Everything below is pass/fail from what you SEE on the device. Do the whole
suite on the Redmi 12; A, B, C, D, E and H are the release gates. "Provider"
cases need a provider account; G needs two devices.

### A. Session & staying logged in

| # | Steps | Expected |
|---|-------|----------|
| A1 | Fresh install → phone-OTP signup → land on home. Swipe-kill the app → reopen | Still logged in, home loads |
| A2 | Google sign-in → kill → reopen | Still logged in |
| A3 | Navigate deep (e.g., open a request detail) → swipe-kill → reopen | Logged in AND restored to (or near) where you were |
| A4 | Background the app 30+ min → reopen | Logged in, no logout flash, no login screen flicker |
| A5 | Airplane mode ON → open the app | Opens with cached data, does NOT log you out; radio back on → app recovers on its own |
| A6 | Leave the app unopened overnight → open next day | Still logged in (silent token refresh) |
| A7 | Logout → login screen appears once (no OTP screen restored) → log back in | Clean logout, clean re-login |
| A8 | Logout → kill app → reopen | Still logged out (no zombie session) |
| A9 | Provider with an active/tracked job: force-stop from Settings → wait 10 min → reopen | Still logged in, job still visible |
| A10 | Open/close the app 10× in a row quickly | Never lands on the login screen while logged in |

### B. Location correctness (the "Enable location while GPS on" family)

| # | Steps | Expected |
|---|-------|----------|
| B1 | Android 12+: at the permission dialog choose **"Approximate"** | Accepted as granted. Provider home shows the map/"Getting your location…" and then an (approximate) position. NEVER "Enable location" |
| B2 | Choose "Precise" | Normal accurate behavior |
| B3 | Turn the phone's location switch OFF → open provider home | "Location is off" / enable prompt (correct). Tap Enable → lands in Settings. Turn ON, return to app | Recovers WITHOUT restarting the app |
| B4 | Deny the permission twice (so the dialog stops appearing) | App shows a blocked state with an "Open Settings" action that actually opens Settings |
| B5 | Location ON but indoors/basement (no fix) | Shows "Getting your location…" — never claims location is off; UI stays usable |
| B6 | Foreground/background the app 5× with location ON | No false "Location is Turned Off" popups |
| B7 | User side: book with Approximate-only granted | Booking works, address/GPS attaches |

### C. Provider home stability (Redmi 12 focus)

| # | Steps | Expected |
|---|-------|----------|
| C1 | Sit on provider home 3 min; background/foreground twice; trigger any permission dialog | Availability pad stays "Online" (or Offline) — NO online→loading→online loop |
| C2 | Toggle Offline→Online→Offline | Instant UI change each time; state survives app restart |
| C3 | Pull-to-refresh with good network | Completes, spinner ends |
| C4 | Pull-to-refresh in airplane mode | Spinner ENDS within ~30s (no stuck spinner) |
| C5 | Watch the Android status bar + navigation bar for 2 min of normal use | No flickering/repainting of the system bars |
| C6 | Have a user book your service | ONE banner, ONE vibration; request appears; "View Details" opens the right request |

### D. My Jobs screen

| # | Steps | Expected |
|---|-------|----------|
| D1 | Open Jobs tab, leave it 2 min | Loads once (skeleton → list) then STABLE — header/list never blank and reload in a loop |
| D2 | Switch to another tab and back | List updates without a full-screen blank |
| D3 | Accept a job; complete with the customer OTP | Flow works; completion card renders (frosted on iOS, flat card on Android — intended) |
| D4 | Open Jobs in airplane mode | Settles (cached/empty) within ~30s, no infinite skeleton |
| D5 | Receive a new request while on Jobs tab | Appears without the screen blanking |

### E. Profile screen

| # | Steps | Expected |
|---|-------|----------|
| E1 | Open Profile on good network | Renders promptly |
| E2 | Open Profile right after app start on slow network | Your name/email render from stored data quickly; details fill in — NO permanent full-screen shimmer |
| E3 | Stay on a "loading" Profile without touching it | It fills in by itself within ~15–30s (auto-retry) |
| E4 | Edit name/photo → save → restart app | Changes persist |
| E5 | Background/foreground from Profile 5× | No loading-flash loop |

### F. User home & booking end-to-end

| # | Steps | Expected |
|---|-------|----------|
| F1 | Login → home | Services grid renders promptly, no endless spinner |
| F2 | Full booking: pick service → date/time → search providers → send request | Request created, appears in History |
| F3 | From History/Detail tap "Find new provider" | Home resumes the provider search for that request |
| F4 | Cancel a request from History | Status updates everywhere (no ghost active request) |

### G. Real-time & notifications (two devices)

| # | Steps | Expected |
|---|-------|----------|
| G1 | User books → watch provider device | Banner + list update within seconds |
| G2 | Provider accepts → watch user device | User sees accepted status/notification promptly |
| G3 | Kill the provider app → user books → tap the push notification | App opens directly on the request detail |
| G4 | Send 3 requests rapidly | One banner each; no duplicate banner/vibration storms |
| G5 | EXTENDED (overnight): leave provider app running overnight → book next morning | Real-time event STILL arrives (socket re-auth works) — this was broken before |

### H. Low-end polish (Redmi 12 — intended behavior)

| # | Steps | Expected |
|---|-------|----------|
| H1 | Look at any loading skeleton | STATIC placeholder blocks (no moving light sweep) — intended on this device |
| H2 | Tab bar + notification banner | Solid/tinted surfaces (no blur) — intended on Android |
| H3 | Cycle all 5 tabs ×10 | Smooth, no white flashes, no system-bar blinking |
| H4 | Home hero/status area for 1 min idle | Nothing repaints or shimmers while idle |

### I. iOS smoke

| # | Steps | Expected |
|---|-------|----------|
| I1 | Login → home → booking → jobs → profile → logout | All work |
| I2 | Banner/dialogs/tab bar | Blur effects present (iOS keeps them) |
| I3 | Location permission variants + background/foreground | Same correctness as B1–B6 |

### J. Regression quickies

| # | Steps | Expected |
|---|-------|----------|
| J1 | Switch language EN→HI→MR | Screens translate, no layout breaks |
| J2 | Settings: toggle notification prefs; open delete-account flow (cancel it) | Works |
| J3 | Emergency services + Events flows: open, submit one | Works |
| J4 | Subscription + Referral screens | Load and render |

**Release gate:** all of A–F and H pass on the Redmi 12, G1–G4 pass on the
two-device pair, I passes on iPhone. G5 is extended (run it in parallel with
the rollout day). Any FAIL on A/B/C/D/E blocks the store push.
