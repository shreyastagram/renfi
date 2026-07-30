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
3. **Device test on the Redmi 12 (release build)** — the checklist:
   - Location permission "Approximate": provider home shows map/"Getting
     your location…", NOT "Enable location"; a coarse fix arrives.
   - Turn GPS off → "Location is off" appears; turn ON in Settings, return
     → recovers without app restart.
   - Provider home: availability toggle stays stable across foreground/
     background cycles and permission dialogs (no online→loading loop).
   - My Jobs tab: header + list render once; background refreshes don't
     blank the screen; system bars don't flicker.
   - Phone-OTP login, logout, re-login; kill app mid-session → relaunch
     stays logged in.
   - Pull-to-refresh on provider home with airplane mode → spinner ends.
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
- Shimmer loops still ungated on 3 always-mounted sites (worst:
  `UserServiceHistoryScreen` per-row `Animated.loop`; also ProfileScreen
  inline, ServiceRequestDetail OTP) — next perf pass.
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

## 6. Reference docs

`AUTH_STARTUP_LOGOUT_FIX.md` (auth contract + change log),
`docs/PENDING_STABILITY_WORK_2026-07.md` (parked jitter list — partially
superseded by this session), `ISSUE_INVESTIGATION_REPORT.md` (Issue 4
history), `RELEASE_TEST_GUIDE_1.0.5.md` (fuller manual test matrix).
