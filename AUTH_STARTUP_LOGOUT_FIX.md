# Auth Startup Logout Fix — Working Document

> **Purpose.** This is the single source of truth for the "users get logged out
> after 1–2 days" fix. If anything regresses later, **start here**: it records
> the root cause, the exact behavior we implemented, why it is safe, how to
> verify it in Crashlytics, and how to roll it back. Keep the **Change Log** at
> the bottom updated whenever this area is touched.
>
> **Owner context:** renfi (RN app) + jauth (Java Auth on Render) + noefix (Node).
> **Created:** 2026-06-14. **Status:** ✅ Implemented (client-only). iOS untouched.

---

## 1. TL;DR — what was wrong

On a cold start, the app's **startup token-refresh path** treated *transient*
failures (network blip, timeout, Render cold start, 5xx) as **authentication
failures** and cleared the user's tokens — logging them out.

- Access token lives **24h**; refresh token lives **7 days** (jauth prod config).
- So on a **day-2 cold start**, the app *must* refresh. If the Render auth server
  is cold-starting (30–60s spin-up), the refresh request errors → tokens cleared
  → user on the login screen, even though the refresh token was still valid.
- **Why Chinese OEMs (Xiaomi/Oppo/Vivo/Realme) and not Samsung/Pixel:** aggressive
  background process-killing forces frequent **cold starts**, so those devices hit
  this path far more often. Samsung/Pixel keep the process warm or the user
  reopens within 24h (token still valid).
- **Why the plaintext fallback didn't help:** the fallback only protects token
  *reads*. This bug *deletes* both stores (`clearTokens()` → `clearAllData()`),
  so the app destroyed its own fallback.

This is **not** a storage problem and **not** refresh-token expiry. It is
transient-error handling in one of three refresh paths.

---

## 2. System facts (verified in code — do not assume)

### Backend contract (jauth, `application-prod.yaml` + `AuthController` + `RefreshTokenService` + `GlobalExceptionHandler`)
- Access token TTL = **24h** (`jwt.expiration.ms: 86400000`).
- Refresh token TTL = **7 days** (`refresh-token.expiration.days: 7`).
- `POST /api/auth/refresh` **rotates** the refresh token: validates old → **revokes
  old** → issues new. **Refresh tokens are single-use.**
- All refresh rejections (invalid / expired / revoked / deactivated) →
  `AuthenticationException` → **HTTP 401**. There is **no** machine-readable code
  like `invalid_refresh_token` / `refresh_token_expired` / `refresh_token_revoked`.
  The only special code is `ACCOUNT_DELETED` (returned on protected endpoints).
- **Therefore the only reliable "definitive logout" signal is HTTP `401`.**
  Everything else (no response, timeout, 5xx, 503, DNS) = **transient** = keep tokens.

### Client: three refresh implementations in `src/services/apiClient.js`
| # | Where | Transient-aware? | Timeout | Retry | Verdict |
|---|-------|------------------|---------|-------|---------|
| 1 | `proactiveTokenRefresh` (req interceptor) | ✅ yes | 35s | 1 | correct |
| 2 | 401 response handler | ✅ yes | 35s | 1 | correct |
| 3 | `validateAndRefreshTokens` (**startup**) | ❌ no | none | none | **the bug** |

Paths #1 and #2 already did the right thing. Path #3 — the first thing that runs
on a cold start — did not. **The fix makes #3 behave like #1/#2.**

### Refresh-token rotation caveat (why we do NOT use exponential backoff)
Because refresh tokens are single-use, retrying a refresh is risky: if the server
processed the refresh but the **response was lost** (timeout after processing),
our stored token is now revoked, and a retry with it 401s. So: **at most one
cautious retry, only on a transient (no-response/5xx) failure** — never a
multi-attempt backoff loop.

---

## 3. The fix — principles

1. **A transient failure must NEVER log an authenticated user out.** Keep the
   tokens, restore the session, and let the per-request interceptor (#1) refresh
   lazily on the first protected call.
2. **Clear tokens ONLY on a definitive `401`** from `/refresh` (or
   `ACCOUNT_DELETED`). Match on **HTTP status**, not on string codes the backend
   never sends.
3. **Add a timeout (35s)** to the startup refresh (was unbounded) + **one cautious
   retry** on transient.
4. **Close the telemetry blind spots** so the next build *proves* the fix:
   - the startup path now emits `reportForcedLogout` (it previously emitted
     nothing — the prime suspect was invisible in Crashlytics);
   - `reportStorageState` is now actually called at boot (it was defined but never
     invoked).
5. **Scope guard:** keep the existing startup *structure* (no rewrite to
   optimistic/lazy launch — deferred, see §8). iOS + Keychain primary untouched.

---

## 4. Exact behavior after the fix (`validateAndRefreshTokens`)

```
getTokens()
 ├─ no refresh token            → { valid:false } (genuine logged-out; breadcrumb only, no clear)
 ├─ access token NOT expired    → { valid:true } + background account check (UNCHANGED)
 └─ access token expired → refresh:
      attempt 1 (timeout 35s)
        success                 → store rotated tokens, { valid:true }
        transient failure       → wait 3s, attempt 2
      attempt 2
        HTTP 401                → reportForcedLogout, clearTokens(), { valid:false }   ← ONLY logout case
        anything else           → KEEP tokens, { valid:true, accessToken: existing }
        (no response, timeout, cold start, 5xx, 500, ambiguous)
                                   (interceptor refreshes lazily on first request)
```

**Two distinct classifiers, intentionally:**
- **Retry gate** uses `isTransientNetworkError()` (already in `apiClient.js`): retry
  attempt-1 only on no-response / `ECONNREFUSED/ENOTFOUND/ETIMEDOUT/ECONNABORTED/
  ERR_NETWORK/ENETUNREACH` / HTTP 502–504. Never retry a 401 (pointless + burns the
  single-use refresh token).
- **Final logout decision** is stricter: clear **only** when
  `error.response.status === 401`. Every other outcome (including a stray `500` or
  `400`) keeps the session. This matches the verified backend contract (401 is the
  *only* definitive refresh rejection) and strictly minimizes wrongful logouts; a
  genuinely dead session is still cleared later by the 401 response handler on the
  first protected request.

---

## 5. Files changed

| File | Change | Risk |
|------|--------|------|
| `src/services/apiClient.js` | Rewrote the refresh branch of `validateAndRefreshTokens` (transient-aware, 35s timeout, 1 retry, clear only on 401). Added boot `reportStorageState`. | Low — isolated to the expired-token branch; fast path + background verify untouched. |
| `src/utils/storage.js` | Added read-only `probeStorageState()` (reads both stores, never writes/clears/retries). | Very low — pure read, fully try/caught. |
| `src/utils/storageTelemetry.js` | Documented the two new `reportForcedLogout` triggers. No logic change. | None — comments only. |

---

## 6. Why this will NOT ruin the app (safety analysis)

- **No new dependencies, no native changes, no iOS changes.** Keychain stays the
  primary on both platforms; iOS never relies on the fallback.
- **Smaller blast radius:** the change is the *expired-token refresh branch* of
  one function. The fast path (token still valid) and its delicate
  splash-race-guarded background verify are **untouched**.
- **Strictly fewer logouts, never more:** the only behavioral change is that some
  cases that previously cleared tokens now *keep* them. We never *add* a new clear.
  The definitive-401 logout still happens exactly as before.
- **Self-healing:** if we keep an expired access token and the session is actually
  dead, the next protected request 401s → the (already-correct) 401 handler
  refreshes or logs out properly. No stuck state.
- **All telemetry is fail-soft** (`safeCall`, dedup) and `probeStorageState` is
  read-only — it cannot corrupt or clear tokens.

---

## 7. Edge cases & known residual risks (accepted)

1. **Refresh token genuinely expired (7d) + server unreachable** → user sees app
   shell offline; on reconnect the first request 401s → clean logout. Standard
   offline-first behavior.
2. **Account deleted while offline** → user stays in until a request reaches the
   server → `ACCOUNT_DELETED`/401 → logout. Unavoidable while offline; handled.
3. **Rotation race (lost response):** refresh succeeded server-side but response
   lost → our token is revoked. We keep it; the user keeps working on the valid
   access token (≤24h), then a later refresh 401s → logout up to 24h later. Better
   than today (immediate logout). Full fix = backend rotation grace window (§8).

---

## 8. Verifying the fix in Crashlytics (after next release)

Non-fatal types (`src/utils/storageTelemetry.js`):
- `ForcedLogoutNonFatal` — should now include startup triggers; overall premature
  logouts on Xiaomi/Oppo/Vivo/Realme should **drop sharply**.
- `KeychainNonFatal` — keystore read/write failures (secondary signal).

New `last_logout_trigger` values to watch:
- `startup_refresh_definitive_auth_fail` — *legitimate* logout (real 401). Expected, low.
- (Transient kept-alive case logs a breadcrumb `[STARTUP_REFRESH_TRANSIENT_KEPT]`,
  **not** a forced-logout — by design.)

Boot denominator (now wired): `boot_keychain_had_tokens`,
`boot_fallback_had_tokens`, `boot_recovered_from_fallback`.

**Advanced token diagnostics on every `ForcedLogoutNonFatal` (added 2026-06-14).**
The offending access token is decoded client-side (NOT verified, fail-soft, PII-masked)
and attached as keys — this is what lets us tell the two cohorts apart at a glance:
- `last_logout_token_user_id` — the `userId` claim → look it up in Neon directly.
- `last_logout_token_email` — masked subject (e.g. `ga****@gmail.com`) → correlate with
  the jauth `user not found` log without exposing PII.
- `last_logout_token_age_hours`, `last_logout_token_iat`, `last_logout_token_expired`.
- `last_logout_request_url`, `last_logout_auth_base_url` — which endpoint/backend rejected.

Reading the cohorts from these keys:
- **Cohort B** (`trigger=response_401_account_deleted`): `token_expired=false`, a real
  `userId`/email, but jauth has no such row → token email not registered.
- **Cohort A** (startup): look for `STARTUP_REFRESH_TRANSIENT_KEPT` /
  `STARTUP_REFRESH_RECOVERED_AFTER_RETRY` breadcrumbs (session saved by the fix) and a
  low rate of `startup_refresh_definitive_auth_fail`.

**Success criteria:** premature-logout reports drop; `startup_refresh_definitive_auth_fail`
stays low; `[STARTUP_REFRESH_TRANSIENT_KEPT]` breadcrumbs appear during Render
cold starts (proving we now ride them out instead of logging out).

---

## 9. Rollback

Single-commit revert of the `apiClient.js` + `storage.js` changes restores prior
behavior. The telemetry additions are independent and safe to keep. No data
migration, no native rebuild dependency beyond a normal app build.

---

## 10. Deferred / future work (NOT in this change)

- **Optimistic + lazy startup launch** (don't block splash on any auth network
  call; restore session and refresh lazily). Bigger behavioral change — deferred.
- **Encrypt the Android fallback** (replace plaintext AsyncStorage with `crypto-js`
  AES + device-derived key; pure JS, no native, iOS untouched). Separate follow-up.
- **Backend rotation grace window** (jauth honors the old refresh token for ~30–60s
  after rotation) — the proper fix for the rotation race in §7.3.
- **Unify the three refresh paths** into one shared `refreshAccessToken()` so they
  can't drift again. (This fix aligns #3 with #1/#2 but does not yet merge them.)

---

## 11. Session longevity — how long can a user stay away?

**Binding limit today: ~7 days of inactivity.** The refresh token (`jauth:
refresh-token.expiration.days: 7`) is what governs session length; the 24h access
token is just the short-lived working credential.

- Refresh token **rotates on every refresh**, so the 7-day clock **resets** each
  time the user returns and the app refreshes.
- Return **within 7 days** → refresh succeeds → stays logged in, clock resets.
- Away **>7 days** → refresh token expired → jauth 401 → **must log in again**.
- An active user (returns ≥ weekly) effectively never logs out.

The startup transient-refresh fix in this doc does **NOT** extend this window — it
only stops the *premature* 1–2 day logouts that were happening *inside* the window
(see §12, Cohort A).

**UPDATE 2026-06-14: refresh-token TTL bumped 7 → 60 days** (jauth
`application-prod.yaml` + `application.yaml`) for an Uber/Ola-style ~2-month idle
session. So a user can now be away **up to ~60 days** and return without re-login
(clock still resets on each return via rotation).

**Security:** safe because (a) tokens **rotate on every refresh** (single-use), and
(b) they're **server-side revocable** (logout revokes; account deletion revokes all).
Access token unchanged (24h). Incremental risk = a leaked *dormant* refresh token is
usable longer — main exposure is the **plaintext AsyncStorage fallback** on rooted/
backed-up devices (→ raises priority of the deferred fallback-encryption work).
Optional future hardening: refresh-token **reuse detection** (revoke-all on replay of
an already-rotated token) — jauth does not do this today.

## 12. Two distinct logout cohorts (investigation outcome — 2026-06-14)

A long Crashlytics + jauth-log + cross-DB investigation established there are **two
unrelated logout phenomena**, not one:

- **Cohort A — "logged out after 1–2 days, only some users, healthy accounts."**
  Root cause = the startup transient-refresh bug fixed in this doc. Symptom matches
  exactly: access token expires at 24h, so the day-2 open forces a refresh; if that
  refresh hit a Render cold start / network blip, the OLD code wiped tokens. "Only
  some users" = only those whose day-2 open coincided with a cold/erroring moment.
  These users have **perfect DB data** (active, email matches) and leave **no trace**
  in jauth logs or Crashlytics (the startup path was uninstrumented) — which is the
  fingerprint. **Fixed here; verify post-release via the new `startup_*` telemetry.**

- **Cohort B — jauth `JwtAuthenticationFilter` "JWT valid but user not found" →
  `ACCOUNT_DELETED` (the 549 Crashlytics non-fatals).** Root cause = the token's
  email is **not a registered account** (e.g. `jivandhongade94@gmail.com` token vs.
  the person's actual row `jiwandhongade37@gmail.com`; `ladhesamyak590` vs.
  `samyakkhade5`). i.e. the account behind the token's email was **deleted/abandoned
  and the user re-onboarded under a different email**. The server is behaving
  **correctly**; this is **not** the 1–2 day symptom. Amplified by owner/demo
  delete-churn. Not a DB desync — cross-checked users are consistent in Mongo↔Neon.
  Latent client hardening identified (not yet done): `storage.js` `getTokens`
  re-mirrors the Keychain value onto the AsyncStorage fallback on every read, so a
  stale Keychain value could clobber a fresh fallback (only bites if Keychain writes
  fail — Crashlytics shows zero `KeychainNonFatal`, so dormant). Server hardening
  idea: revoke refresh tokens on account deletion.

**Infra confirmed during the hunt (rules out several theories):** one Neon DB
(production branch; a `development` branch exists but idle ~3 months), one Render
jauth instance (no autoscaling), single `DATABASE_HOST`, shared `JWT_SECRET`
(expected). No Hibernate query/second-level cache, no read replica. URL history
shows the app's auth URL was flipped dev↔prod across builds but **reverted before
store builds**, so production never shipped pointing at a different dataset.

## 13. Change Log

> Append an entry every time this area is touched. Newest at top.

### 2026-07-18 (later) — Adversarial review round: waiter-flush completeness + headless token persistence
- 3-agent review (client diff, OEM/platform matrix, backend) of the mutex change found and fixed:
  - **401-handler owner never flushed `refreshSubscribers` on failure** (transient + definitive +
    no-refresh-token paths) → waiters hung forever, then fired as zombies on a later successful
    refresh. All owner failure paths now flush (old token on transient, null on definitive).
  - **`refreshPromise` value contract**: the 401-handler owner resolves its retried AxiosResponse,
    not a token — both join sites now accept only string tokens and otherwise re-read storage
    (fixes the pre-existing "Bearer [object Object]" wasted round-trip).
  - **`isAuthenticatedRef` now synced synchronously** at every setIsAuthenticated site (the
    effect remains as backstop) — closes the one-commit window where a legitimate expiry right
    after login was dropped.
  - **HEADLESS TOKEN PERSISTENCE (the likely remaining provider-logout cause): `index.js`
    headless `authorization` case now persists TransistorSoft's natively-rotated token pair via
    `storeTokens`** — previously it only console.logged, so a provider whose app was killed
    during background tracking came back with an already-burned refresh token → definitive 401
    → logout. Mirrors `backgroundLocationService`'s foreground `onAuthorization` sync.
- **Scope, honestly stated: the client mutex closes the race between the three JS refresh paths
  only.** The native TransistorSoft refresher remains a fourth actor (now synced in both
  foreground and headless states, but a concurrent native-vs-JS refresh window persists), and
  process-death between server rotation and Keychain persistence remains. Both are closed only
  by the jauth rotation grace window / reuse detection (§10) — **IMPLEMENTED 2026-07-19 in
  jarbac (uncommitted): `rotated_at` + `replaced_by_token` columns (ddl-auto adds them), 45s
  grace returning the SAME successor pair (idempotent, no token chains), cleanup-job guard,
  logout stays instant (revoked-without-rotatedAt never gets grace). Compile clean. Deploy via
  normal jauth merge → main.** Backend analysis also confirmed: multi-device cross-logout is
  NOT a factor (per-device chains); password reset intentionally revokes all devices; /refresh
  429s come from a 10/min PER-IP bucket (CGNAT risk — client now treats 429/500 as transient;
  optionally re-key the bucket per user later).

### 2026-07-18 — Rotation-race fix: JS refresh paths now share ONE mutex (§7.3/§10 client side; see later entry for scope)
- **Why:** users (providers) still reported logout "after some days" WITH the 2026-06-14 fix
  shipped. Root cause = the residual this doc predicted in §7.3/§10: `validateAndRefreshTokens`
  POSTed `/refresh` OUTSIDE the interceptor's `isRefreshing/refreshPromise` single-flight. A
  protected request fired during startup (nav-state-restored screens poll immediately since
  1.0.5, FCM re-save, provider location) triggered a CONCURRENT refresh with the same
  SINGLE-USE token → loser's token already rotated → definitive 401 → wrongful logout of a
  healthy session. Not Cohort A (that fix works) — this is the §7.3 race, now more frequent
  because 1.0.5's nav-state restore fires requests earlier in startup.
- **`src/services/apiClient.js`:** startup refresh now JOINS an in-flight refresh if one
  exists, else OWNS the shared `refreshPromise` (semantics unchanged: 35s timeout, 1 transient
  retry, clear ONLY on 401, all telemetry/breadcrumbs preserved; now also flushes 401-handler
  waiters via `onTokenRefreshed`). Also closed a pre-existing waiter-hang: both owners now
  release queued 401-handler subscribers on FAILURE too (old token on transient, null on
  definitive) — previously they could hang forever.
- **`src/context/AppContext.js`:** (a) `handleAuthExpired` bails out when already logged out
  (six apiClient call sites could re-fire the full 10-setState clear cascade repeatedly —
  also a driver of the low-end-Android render-storm "text jitter"); (b) `initializeAuth`
  stays a plain function (closes over refreshProfile — a useCallback would go stale) but is
  now exposed through a stable ref-wrapper (`initializeAuthStable`) so it no longer defeats
  the context-value memo on every render (the jitter amplifier).
- **Companion render-storm fixes (same commit):** `LanguageContext`/`DialogContext` values
  memoized (were inline objects re-rendering every Text/dialog consumer app-wide).
- **Dependents verified:** `validateAndRefreshTokens` return shape `{valid, accessToken}`
  unchanged (sole caller AppContext:622); context `initializeAuth` consumer
  (EmailVerifyHandlerScreen) calls it imperatively — stable identity is strictly safer;
  `onTokenRefreshed` flush order unchanged for the success path. iOS untouched.
- **Still open (backend, recommended):** §10 rotation grace window in jauth (honor the
  just-rotated token for ~30–60s) and/or reuse detection — the server-side completion that
  makes the race structurally impossible even across devices.

### 2026-06-14 — Advanced logout telemetry (token diagnostics) + TTL-change safety audit
- **TTL-change safety audit:** confirmed nothing breaks from 7→60. `RefreshTokenService`
  reads `@Value("${jwt.refresh-token.expiration.days:7}")` → 60 from yaml; existing
  tokens keep their expiry until rotation; client never tracks refresh-token lifetime
  (only the 24h access `expiresIn`); cleanup job unaffected; `JwtProperties.days` is
  yaml-bound (also 60). No dependent code breaks.
- **`storageTelemetry.js`:** added fail-soft JWT decoder (`buildTokenContext`, `maskEmail`,
  `base64Decode`) and enriched `reportForcedLogout` with `token`/`requestUrl`/`authBaseUrl`
  → new keys `last_logout_token_user_id|email|iat|age_hours|expired`, `last_logout_request_url`,
  `last_logout_auth_base_url`. PII-masked, never throws (wrapped in `safeCall` + try/catch).
- **`apiClient.js`:** pass the offending token + url + base URL at all 4 `reportForcedLogout`
  sites; added `STARTUP_REFRESH_RECOVERED_AFTER_RETRY` breadcrumb (proves the retry rescued
  a session). No behavioral change — telemetry only.

### 2026-06-14 — Refresh-token TTL 7 → 60 days (jauth)
- `jauth application-prod.yaml` + `application.yaml`: `refresh-token.expiration.days`
  7 → 60 (~2-month idle session). Safe: rotation (single-use) + server-side
  revocation already in place. Raises priority of plaintext-fallback encryption.
  Optional later: refresh-token reuse detection. See §11.

### 2026-06-14 — Root-cause investigation (Cohorts A & B) + session-longevity note
- Added §11 (session longevity = ~7 days, refresh-token bound) and §12 (the two
  distinct logout cohorts) capturing the full Crashlytics + jauth-log + cross-DB
  investigation. Conclusion: the user-reported "logged out after 1–2 days" symptom
  is **Cohort A**, already fixed by this doc's client change; **Cohort B**
  (`ACCOUNT_DELETED`) is separate and mostly correct server behavior. No code
  changed in this entry — analysis + doc only.

### 2026-06-14 — Dead-code cleanup (post-fix)
- **Removed** `getTokenExpiry` from `src/utils/storage.js` (+ its default-export
  entry): verified zero callers repo-wide; `isTokenExpired()` covers all needs.
- **Kept + flagged** `getLatestLocation` in `src/services/socketService.js`: no
  callers, but it's the intentional read-side pair to `setLatestLocation()` for the
  shared GPS cache. Inline note added; safe to delete later if never consumed.
- **NOT touched (load-bearing — do not "clean"):** the Keychain + AsyncStorage
  dual-write fallback (the reliability mechanism for flaky OEM keystores), all
  telemetry fns (now all wired), and the three refresh paths.

### 2026-06-14 — Initial implementation (client-only)
- Created this document.
- `src/services/apiClient.js`:
  - `validateAndRefreshTokens` refresh branch rewritten: 35s timeout + 1 cautious
    retry (transient-gated); on failure, **clear tokens ONLY on HTTP 401**, keep
    the session on every other outcome (no response / timeout / cold start / 5xx /
    500 / ambiguous). Emits `reportForcedLogout('startup_refresh_definitive_auth_fail')`
    on 401 and `logBreadcrumb('STARTUP_REFRESH_TRANSIENT_KEPT')` otherwise.
  - Added read-only boot `reportStorageState` at the top of the function.
  - No-refresh-token case now leaves `logBreadcrumb('STARTUP_NO_REFRESH_TOKEN')`
    (still returns invalid; nothing to clear).
  - Imports: `+probeStorageState`, `+reportStorageState`, `+logBreadcrumb`.
- `src/utils/storage.js`: added read-only `probeStorageState()` (+ default export).
- `src/utils/storageTelemetry.js`: documented the new `startup_*` trigger.
- **Untouched (by design):** iOS, Keychain primary, the not-expired fast path, the
  splash-race-guarded background account verify, and refresh paths #1/#2.
- **Verification note:** `node_modules` is not installed in this checkout, so
  eslint/babel could not be run locally; changes were validated by full manual
  read-back of the resulting function. Run `npm run lint` once deps are installed.
