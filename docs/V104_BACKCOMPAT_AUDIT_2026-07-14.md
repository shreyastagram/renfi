# v1.0.4 Backward-Compatibility Audit + Prod-Readiness Gate Check (2026-07-14)

**Scope:** Can ONE new prod backend (Node `phone-signup-providers` + Java `feature/phone-signup-users`)
serve both the app currently on the stores (v1.0.4) and the upcoming 1.0.5 build?
Plus: current state of every §8 pre-store-release gate.

**Method:** three parallel read-only audit agents + a call-site mapping agent; all claims verified
against code (`git show`/`git diff` only — nothing checked out, committed, or modified).
Companion docs: `docs/META_APP_EVENTS.md` §8 (gate list), `SESSION_HANDOFF_2026-07.md`,
jarbac `PHONE_SIGNUP_PLAN.md` §17/§18.

---

## 0. TL;DR

- **Baseline correction (important):** the app on the stores is **v1.0.4 = versionCode 22, built from
  the JUNE commits (~`6a9fc01`, 2026-06-15; window `03af1e5`..`6a9fc01`)**. The unified-auth build
  (vc28/1.0.5 era, `ff759cd`) was **never store-submitted** (jarbac tracker §17/§18: store submission
  still pending as of 2026-07-09). Any future compat reasoning must use the June ref, not `ff759cd`.
  All auth-relevant app files are byte-identical across the June window except `apiClient.js`
  (startup-refresh robustness only), so one verdict set covers it.
- **Node backend: SAFE TO DEPLOY. No breaking items** at either June ref.
- **Java backend: SAFE TO DEPLOY.** The originally-reported blocker (M1, phone-format migration) was
  **REFUTED on re-verification (2026-07-14, see §3a)**: the audit agent diffed against the STALE local
  `main` (tip `59011b7`, 2026-03-14). The deployed branch `origin/main` has had identical 10-digit
  phone normalization — lookups AND `@PrePersist/@PreUpdate` write-normalization — since `a96e721`
  (2026-03-15), i.e. before the first store submission (Apr 11). The feature branch changes NOTHING
  about phone formats (23-line diff on the phone files, none format-related). M1 is downgraded to a
  10-second belt-and-braces SQL check expected to return zero rows.
- **Release gates:** 6 of the code/build gates currently FAIL (all intentionally — tester mode);
  i18n parity and version numbers PASS; 3 Play-Console actions outstanding.

---

## 1. Which app is actually live (baseline determination)

- `versionName` became 1.0.4 + `versionCode 22` at `03af1e5` (2026-06-06). It stayed 22 through
  `ff759cd` (2026-07-09), but jarbac `PHONE_SIGNUP_PLAN.md` §17.4/§18 prove the unified-auth app was
  only dev/Firebase-distributed (planned as vc28/1.0.5) and **never uploaded to the stores**.
- The 2026-07-12 prod incident (unverified Google user booked) is consistent with the June build:
  `71cae1a` (Jun 14, "phone-only booking") added the client-side gate that fails open during profile
  load. → Most likely store commit ≈ `6a9fc01` (2026-06-15).
- The June app does NOT call: `/api/auth/phone/unified/*`, `/api/auth/signup/phone/*`,
  `/api/referral/apply-code`, `/api/user/email/:userId`, phone-change endpoints. It DOES use:
  Java OTP login (`/api/auth/login/phone|email/send-otp` + `/verify`), email/phone+password login,
  Google/Apple mobile OAuth, legacy phone verify (`/api/auth/otp/send` — **no body**, phone from JWT —
  + `/otp/verify`), all 5 forgot-password endpoints, profile PUT (Java + Node), sync-phone,
  the full Node service/booking/subscription/referral-read surface.

---

## 2. Node backend (`milestone-branch` → `phone-signup-providers`, 9 commits) — **SAFE**

| Change | June-app (6a9fc01) behavior | Verdict |
|---|---|---|
| 403 `PROFILE_INCOMPLETE` on traditional/event/emergency create (`utils/serviceHelpers.js:150`) | Client gate blocks most cases pre-flight (fails open while profile loads; absent on FavoritesScreen); server 403 surfaces as a friendly dialog with the server sentence via `data.message \|\| data.error` on every create surface. At `03af1e5` the event/emergency client gate doesn't exist → dialog path used more often, still fine | **COMPATIBLE** |
| `phone` ignored in user/provider/admin profile PUT + sync-phone ignores client body (fetches from Java, token via `authenticateToken`) | With BOTH backends deployed: phone edit = clean silent no-op — success toast, old number reappears on refresh; no crash/loop/desync. (Node-agent caveat "change still propagates via Java-first" is closed by the Java deploy: new Java PUT also ignores `phoneNumber`.) | **DEGRADED-ACCEPTABLE** (the designed degradation) |
| `createOrder` 409 `PREMIUM_STILL_ACTIVE` (>5 days left) | Purchase UI already unreachable outside the last-5-days window at 6a9fc01 (`SubscriptionScreen.jsx:675`); stale-race → "Payment failed" dialog with friendly server text | **COMPATIBLE** (this is what protects the 180-day bonus) |
| Stricter `phoneVerified` (Java number must == Mongo number, `helpers/verificationHelper.js:139-160`) | Drifted accounts flip to unverified once; June app has full re-verify UI (Java OTP + sync-phone self-heal) | **DEGRADED-ACCEPTABLE** (one-time, self-recoverable) |
| `verifyPayment` extension-from-endDate, additive `experienceStartDate`, referral/bonus internals, email sparse-unique index | Displayed as-is / ignored / server-internal | **COMPATIBLE** |
| New endpoints (unified auth, apply-code, add-email) | Never called by the June app | N/A for store users |

`server.js` untouched; only `authRoutes.js`, `referralRoutes.js`, `userRoutes.js` changed (additions).
Nothing removed or renamed. No route branches on `X-App-Version` (header absent = old behavior). ✔

**Deploy note:** `models/user.js` email index required+unique → **sparse** unique — needs a manual
index migration on the live collection; check for legacy `email: ""` docs first.

---

## 3. Java Auth (`main` → `feature/phone-signup-users`, 20 commits vs origin/main) 

Prod branch confirmed = **`main`** (Render auto-deploy; `RENDER_DEPLOYMENT_GUIDE.md:73,186`,
`PHONE_SIGNUP_PLAN.md`). Every DTO the June app parses (`LoginResponse`, `UserProfileResponse`,
`VerificationResponse`, refresh response, error codes) is byte-identical across branches.

| Change | June-app behavior | Verdict |
|---|---|---|
| `PUT /api/users/profile` ignores `phoneNumber` (`UserService.java:150-162`) | Silent no-op (app reads only `result.success`; old number returns on `GET /api/users/me` refresh) | **DEGRADED-ACCEPTABLE** (designed) |
| Legacy `/api/auth/otp/send` (no body) + `/otp/verify` kept, re-keyed email→userId | Still works; "already verified"/"no phone" 400s render as inline text the app already handles | **COMPATIBLE** |
| **Can the old app resurrect the unverified-phone hole? NO.** PUT no longer stores arbitrary numbers; legacy OTP is only delivered to the *stored* number (possession proven); change flow commits number+verified atomically | — | **COMPATIBLE** (residual low-risk race → M3) |
| JWT principal re-keyed email→userId with legacy fallback; `main` already stamps `userId` claims | Live v1.0.4 sessions survive the deploy, no re-login | **COMPATIBLE** |
| 401 `ACCOUNT_DELETED` from filter; refresh rejects inactive accounts | June `apiClient.js` handles that exact code → clean forced logout | **COMPATIBLE** |
| Refresh contract unchanged; refresh TTL 7d→60d; auth bucket 10/min/IP | Users stay logged in longer | **COMPATIBLE** |
| OTP login race fix + message wording (drops "N attempts remaining") | App switches on `error.code` (INVALID_OTP/OTP_EXPIRED), never parses counts | **COMPATIBLE** |
| ~~Phone stored-format normalization~~ **REFUTED — see §3a.** Normalization is NOT new: `origin/main` (deployed) has had the same 10-digit lookups + `@PrePersist/@PreUpdate` write-normalization since `a96e721` (2026-03-15, pre-launch). The agent diffed the stale local `main` (2026-03-14). Feature-branch delta on `User.java`/`OtpLoginService.java`/`PasswordResetService.java` contains zero format changes | No change in phone reachability vs today's prod. Residual: only rows created before 2026-03-15 (pre-launch dev/test era) could hold non-10-digit formats | **COMPATIBLE** (run the M1 SQL check once as belt-and-braces; expected zero rows) |
| All send-otp paths strict 5/min/IP | Interceptor silently retries first 429; heavy resenders see generic message | **DEGRADED-ACCEPTABLE** |
| Google unverified-email reclaim (also in register): deactivates an active-but-unverified email account and creates a fresh one | That cohort's Mongo profile/history orphaned on first Google sign-in | **DEGRADED → M2 (size cohort first)** |
| June add-email via profile PUT | `UpdateProfileRequest` has no `email` field on EITHER branch → already a silent no-op on today's prod. Not a new break | **COMPATIBLE** (pre-existing) |
| Apple mobile OAuth + forgot-password/email endpoints (new branch) | June app already calls them; not on `main` → either broken on prod today (deploy FIXES them) or prod runs an apple-era build. Findings hold either way | **COMPATIBLE / FIXES** |
| Delete-account OTP → DB; email-verification null guard; DB-backed unified lockout | Same endpoints/shapes; restart-proof now | **COMPATIBLE** |
| CORS fail-fast (`ALLOWED_ORIGINS` unset/`*` → won't boot); Hikari 5→25; yaml base-URL → auth.fixhomi.com | Native app sends no Origin; risk is ops-side only | **OPS GATE → M4** |

### 3a. M1 re-verification (2026-07-14) — evidence trail

1. Local `main` tip = `59011b7` (2026-03-14); `origin/main` tip = `f6fa102` (2026-04-17).
   The BREAKING verdict came from diffing local `main` — one day older than the normalization commit.
2. `a96e721` ("phone and email avaialble verify", **2026-03-15**) introduced on what is now
   `origin/main`: `User.normalizePhoneNumber()` ("+919356011874" → "9356011874"),
   `@PrePersist/@PreUpdate normalizeFields()` (every JPA write stores 10 digits),
   and single normalized lookups in `OtpLoginService`/`PasswordResetService`/`UserService`
   ("All phones are now stored as 10 digits, so a single lookup suffices" — comment on origin/main).
3. `git diff origin/main..feature/phone-signup-users` on `User.java`, `OtpLoginService.java`,
   `PasswordResetService.java` = 16+/7- lines total: email nullable (the known §18 migration),
   fullName `@NotBlank`→`@Size`, the OTP auto-verify race fix, and OAuth-only reset feedback.
   **No phone-format logic changes.**
4. `git grep nativeQuery` / raw `UPDATE users` on the feature branch: zero hits — no write path
   bypasses the JPA normalization hooks.
5. Timeline: first Play submission 2026-04-11, TestFlight 1.0.2 April (LAUNCH_PLAN.md) — both AFTER
   normalization was live, so real production users' numbers were normalized at write time.

### Blockers / actions (Java side)

- **M1 — DOWNGRADED to belt-and-braces check (was wrongly reported BREAKING):** optionally run on prod Neon
  (read-only, expected zero rows; only pre-2026-03-15 rows could match):
  ```sql
  SELECT id, phone_number FROM users
  WHERE phone_number IS NOT NULL AND phone_number NOT LIKE 'del\_%'
    AND phone_number !~ '^[0-9]{10}$';
  ```
  Zero rows → moot. Otherwise resolve normalization collisions manually, then:
  ```sql
  UPDATE users SET phone_number = right(regexp_replace(phone_number,'[^0-9]','','g'), 10)
  WHERE <same predicate>;
  ```
- **M2 — size the reclaim cohort:** `SELECT count(*) FROM users WHERE is_active AND NOT is_email_verified AND password_hash IS NOT NULL;`
  If material, pre-verify historic Google-created accounts or gate the reclaim on "never logged in".
- **M3 (optional hardening):** legacy `/otp/verify` — add commit-time cross-user uniqueness re-check +
  (userId,phone)-scoped OTP lookup (`PhoneVerificationService.java:114-166`).
- **M4 — ops env gates (mostly already in §17.4/§18):** non-wildcard `ALLOWED_ORIGINS` (else no boot);
  `SMS_PROVIDER=msg91`/`EMAIL_PROVIDER=brevo` + keys (default `stub` = OTPs silently never send);
  `FIXHOMI_BASE_URL` live; single Render instance (in-memory rate buckets).

---

## 4. Release-gate status (verified against live code, 2026-07-14)

| # | Gate | Required | Current | Store-today | Evidence |
|---|---|---|---|---|---|
| 1 | USE_DEV_STAGING | false | **true** | FAIL (intentional) | `src/config/environment.js:48` |
| 2 | DEBUG_ANALYTICS | false | **true** | FAIL (intentional; coupled to §9 Meta release-build verification, still open) | `src/services/analytics/analytics.js:30` |
| 3 | Crashlytics mapping upload | true | **false** | FAIL | `android/app/build.gradle:127` |
| 4a | Node merge → milestone-branch | merged | **9 commits unmerged** | FAIL | `git log milestone-branch..phone-signup-providers` |
| 4b | Java merge → main | merged | **20 commits unmerged (vs origin/main)** | FAIL | `git log origin/main..feature/phone-signup-users` |
| 5 | pod install after dep removals | lockfile clean | **react-native-background-timer pod still in Podfile.lock** | FAIL | `ios/Podfile.lock:1537` etc. |
| 6 | iOS versions | consistent | CURRENT_PROJECT_VERSION=1, MARKETING_VERSION=1.0.5 (both configs) | PASS (+ App Store Connect collision check pending) | pbxproj:298/307/328/336 |
| 7 | Android version | set | versionCode 29 / 1.0.5 | PASS | `android/app/build.gradle:100-101` |
| 8a | READ_PHONE_STATE | declare or strip | merges from Razorpay; no `tools:node="remove"` rule | ACTION (console) | AndroidManifest.xml:21-28 |
| 8b | AD_ID | declare | merges via facebook-core | ACTION (console) | not in app manifest |
| 8c | ACCESS_BACKGROUND_LOCATION | declaration+disclosure+video | explicitly present | ACTION (console) | AndroidManifest.xml:9 |
| 9 | facebookSdkVersion pin | pinned | **floats on 18.+** | FAIL (soft) | android/build.gradle ext (absent) |
| 10 | i18n EN/HI/MR parity | identical | **identical — 1950 keys each, placeholders match** | PASS | flatten-diff script, zero diffs |
| 11 | ~~Java phone-format migration (M1)~~ | — | **REFUTED — downgraded to optional SQL sanity check** | N/A | this doc §3a |

Post-deploy: run test guide **§N** (N-3/N-4 must block server-side) + **§O**. App Store copy gate:
keep "fixhomi.com" payment wording, never name the processor.

---

## 4a. DEPLOYMENT ADDENDUM (2026-07-14, during go-live)

The audit's "phone edit = silent no-op, DEGRADED-ACCEPTABLE" verdict **under-weighted the ADD case**:
v1.0.4 has no phone-change UI, so profile-PUT was a phone-less account's ONLY way to attach a first
phone. With the PUT ignored, Google/Apple (and all new store-app) users could never verify a phone —
and after C2's booking gate, could never book. Found live during C1 smoke (owner account 2040:
Java `phone_number=null` after add; Mongo had the number because old Node — pre-C2 — still stored it;
verify failed with "No phone number registered").

**Fix 1 shipped: jauth `b6673c9`** — add-ONLY carve-out in `UserService.updateProfile` (accept phone via
PUT only when the account has none; stored normalized+unverified; 409 if any active account holds it;
verified numbers still OTP-only) + commit-time cross-user re-check in legacy `verifyOtp` (audit M3).
Merged to main (PR #10, deploy `732af22`); prod smoke PASSED end-to-end (add → OTP → verify → phone-OTP
login, accounts 2047/2048).

**Fix 2 shipped: noefix `e8f1f6f`** — second incident during C2 smoke: verified account 2048 still got
403 PROFILE_INCOMPLETE. Root cause: profile PUTs no longer write `phone` to Mongo, so a fresh add left
the mirror EMPTY (`phone: ""`), and `ensureBookingProfileComplete` only ran its Java self-heal when the
mirror already had a phone (`hasPhone && !phoneVerified`). Gate now asks Java whenever the mirror can't
prove verification (empty OR drifted) and heals the full mirror (`phone`,`verifiedPhone`,`phoneVerified`)
on a verified answer. Fail-open semantics unchanged (only when the mirror records a phone).

### ⏳ REVERT / SUNSET LEDGER (check when 1.0.5 fleet dominates)

| Patch | Lifespan | Revert condition & how |
|---|---|---|
| jauth `b6673c9` **carve-out half** (add-phone via profile PUT) | **TEMPORARY** — exists only because pre-1.0.5 builds have no phone-change UI | Revert AFTER: 1.0.5 live on both stores **+** force-update gate flipped (admin `PUT /api/admin/app-version/update`, minVersion ≥ 1.0.5) **+** old-build traffic ≈ 0 (measure: requests WITHOUT `X-App-Version` header — only 1.0.5+ sends it). Revert = restore the unconditional "Ignoring phoneNumber" branch in `UserService.updateProfile`. |
| jauth `b6673c9` **M3 half** (commit-time re-check in legacy `verifyOtp`) | **PERMANENT** | Security hardening — keep even after the carve-out is reverted (the legacy verify endpoint itself stays for old builds' re-verify flows). |
| noefix `e8f1f6f` (gate self-heal for empty/drifted mirror) | **PERMANENT** | Keep — not an old-app bridge. Even 1.0.5's post-verify mirror write is best-effort; without this, any Java-verified/Mongo-stale account gets wrongly blocked. |

## 4b. FINAL GO-LIVE STATUS (2026-07-14) — ⏳ AWAITING STORE REVIEW

Engineering release COMPLETE. Both stores submitted, **neither approved nor published yet**.

- **Backends LIVE on prod:** jauth `main` (PR #9 `cefe0e8` + hotfix PR #10 `732af22`), noefix
  `milestone-branch` (feature merge + `e8f1f6f` gate self-heal). Post-deploy smoke passed: booking
  gate blocks phone-less accounts, verified users book, add→verify→OTP-login works on the store-era
  flow, admin panel OK.
- **Play (Android):** ~~vc29 IN REVIEW~~ → **REJECTED 2026-07-14** under the "Photo and Video
  Permissions" policy (READ_MEDIA_IMAGES; rolling enforcement — the permission dates back to 1.0.4,
  the new submission simply hit the sweep). **Fixed 2026-07-15, commit `0c13f36` (vc30):** permission
  removed from the manifest (all 5 media flows are picker-only; react-native-image-picker 8.2.1 uses
  the permissionless Android 13+ system Photo Picker); `requestGalleryPermission` returns true on
  API 33+ (else the gate would return UNAVAILABLE and block the picker); API ≤32 + iOS + camera
  unchanged. **Status: awaiting owner device test → rebuild AAB (vc30) → resubmit.** Test-guide note:
  I-6 (deny photo permission) is impossible on Android 13+ now — applies only to ≤12. AD_ID
  declaration (YES: Analytics + Advertising) and Data Safety (Device/other IDs + App activity→Other
  actions: collected+shared, App Func/Analytics/Advertising) submitted as an App Content change and
  unaffected by the rejection.
- **App Store (iOS):** version 1.0.5, build **1.0.5 (2)** (build 1 = Jun-15 dev-staging tester
  build — EXPIRED in TestFlight, never attach it), Waiting for Review, manual release. App Privacy
  published: User ID (App Func+Analytics+Dev Advertising, linked, no tracking), Product Interaction
  (Analytics+Dev Advertising, linked, no tracking), Device ID unchanged (App Func only), NO IDFA.
- **App release commits** (branch `feature/profile-redesign`): `eb9041d` owner welcome-screen
  content, `220059d` release flags/pods/docs, `7c1c4fa` iOS build 2.

**Post-approval tail (in order):** (1) press Publish on Play; release iOS manually. (2) Run test
guide §N + §O with the real store builds; client M-section language sweep. (3) Meta Events Manager
dataset Overview — confirm release events from real users (hours-delayed; Test Events won't show
release builds). (4) §5 Meta console config once client grants access (platforms, key hashes, AEM
priorities). (5) Weeks later at high 1.0.5 adoption: flip force-update minVersion (admin endpoint),
watch for zero no-X-App-Version traffic, then execute the REVERT LEDGER above (jauth carve-out).
(6) Before ~Dec 2026 (first 180-day bonuses expiring): fix the deferred payment money-path bugs.
(7) Housekeeping next deploy: pin facebookSdkVersion; revert jauth ddl-auto update→validate.
If either store rejects: reopen the relevant section here and in META_APP_EVENTS.md §8/§9.

## 5. Not verifiable from the repos

1. Which build Java prod Render actually runs (docs say `main`; June app's Apple/forgot-email calls
   suggest either those flows 404 on prod today or prod runs an apple-era build — check Render dashboard;
   verdicts hold either way).
2. Actual `phone_number` formats in prod Postgres (decides whether M1 is a no-op or a blocker).
3. App Store Connect build-number state for 1.0.5.
4. Prod Render env vars / instance count.
5. Exact store commit (`6a9fc01` vs `03af1e5`) — immaterial; surfaces byte-identical where it matters.
