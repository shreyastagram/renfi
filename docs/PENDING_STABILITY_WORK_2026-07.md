# Pending Stability Work — parked 2026-07-19 (resume here)

> Snapshot of the post-1.0.5 stability workstream, parked to handle the provider
> verification-dashboard incident. Everything below is DONE-but-UNCOMMITTED or
> TODO. Companion docs: `AUTH_STARTUP_LOGOUT_FIX.md` (change log 2026-07-18/19),
> memory `post-105-stability-work`.

## A. ✅ COMMITTED 2026-07-20 (da6ab7d feature / ca553cd stability / 554376a analytics)

1. **Auth refresh hardening (apiClient.js)** — one single-flight mutex across all
   three JS refresh paths; 401-ONLY logout contract on every path (429/500 no
   longer log out — CGNAT per-IP bucket + Neon blips); refreshSubscribers flushed
   on every owner failure (no hangs/zombies); join sites accept string tokens only.
2. **index.js** — headless TransistorSoft `authorization` event now persists the
   natively-rotated token pair (was log-only → burned refresh token → provider
   logout after kill).
3. **AppContext.js** — handleAuthExpired already-logged-out bailout (sync'd
   isAuthenticatedRef at every setIsAuthenticated site); initializeAuth exposed
   via stable ref-wrapper (context-value memo now real); phoneOnboardingPending.
4. **LanguageContext / DialogContext** — value useMemo (whole-app Text re-render
   amplifier killed).
5. **socketService.js** — initializeSocket orphan guard (teardown live-but-
   disconnected instance before creating a new one).
6. **PhoneOnboardingSheet feature** — post-Google-signup phone prompt
   (UserHomeScreen gate: profileReady && no phone, del_-tombstone aware);
   i18n ×3 (1957 keys parity); mockup artifact e22e0cfe.

## B. ✅ COMMITTED 2026-07-20 (jarbac 0d0ade9) — MERGE TO main TO DEPLOY

7. **45s refresh-rotation grace window** — RefreshToken +rotated_at
   +replaced_by_token (ddl-auto adds), rotateRefreshToken returns the SAME
   successor within grace (idempotent, no chains), cleanup-job grace guard,
   logout stays instant. Config `jwt.refresh-token.rotation-grace-seconds: 45`
   both yamls. Deploy via normal merge → main.

## C. Jitter secondary fixes — PARTIALLY DONE 2026-07-20 (commit 5b25bc5)

DONE: startup profile retry (30s/2min), GlobalBanner vibration cooldown +
no-heads-up-while-banner-visible + 60s Map dedupe, LocationContext address
identity guard. STILL TODO (deliberately deferred):

- Startup `refreshProfile` retry with backoff when the first attempt dies
  (stuck-null profile = perpetual loading branches all session).
- Gate `useShimmerAnimation`'s Animated.loop on an `active` prop (sweep runs
  forever on ProviderHome even when nothing is loading).
- ProviderHomeScreen socket/GPS effect deps include live `location.latitude`
  (re-runs init constantly while moving) — drop it.
- BlurView device-class gate (tab bar SUPPORTS_BLUR = API>=31 admits weak GPUs;
  GlobalBanner's Android BlurView has NO gate) — candidate visual-jitter fix.
- GlobalBanner: per-requestId dedupe map + vibration cooldown + suppress notifee
  heads-up while in-app banner shows + skip stale (>60s) events.
- LocationContext: return prev from setLocationAddress when unchanged (residual
  30s churn).
- refreshProfile/refreshVerificationStatus: bail out of setUser/setProfile on
  shallow-equal snapshots (identity churn without value change).

## C2. ✅ DONE 2026-07-20 (commit 47c9f01) — app-side verification hardening

- `PhoneChangeModal.jsx:178` — pass `phoneNumber: newPhone` to syncPhoneToMongoDB
  and check/retry on `success:false` (today: single best-effort shot, result ignored).
- **`AppContext.js` `refreshVerificationStatus` is DEAD-CODE syncing**: useCallback
  with `[]` deps but reads user/profile/userType → permanently captures nulls →
  the `syncPhoneToMongoDB` call inside NEVER runs for anyone. Fix via refs.
- `VerificationScreen.jsx:352` — on the "already verified" bounce, also fire
  provider `syncVerificationStatus(providerId)` so the dashboard heals app-side too.
- Optionally: PhoneChangeModal success path calls `syncVerificationStatus` for
  providers (the endpoint the dashboard already trusts).

## D. TODO — process / release

- Owner's Firebase/GA4 analytics additions are in the tree (analytics.js,
  @react-native-firebase/analytics, google-services.json) → Play Data Safety +
  Apple App Privacy labels need another pass before the next store build.
- Diagnostic [JITTER] build option still available (counters designed, not added).
- Commit plan when owner says go: (1) feature sheet, (2) auth-race + render
  fixes + docs, (3) jarbac grace window.
- Backend nice-to-haves: /refresh rate-limit keyed per user (not IP), JWT clock
  tolerance 30s both backends, reuse-detection logging.
- Revert ledger (V104_BACKCOMPAT_AUDIT_2026-07-14.md §4a): jauth add-only phone
  carve-out is TEMPORARY (revert after 1.0.5 fleet + force-update); payment
  money-path fixes before ~Dec 2026.
