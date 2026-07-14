# Fixhomi — Session Handoff (2026-07) — everything the next session needs

**Last updated:** 2026-07-14
**Author:** Claude (Fable 5) working with the owner (borkarshreyas123@gmail.com)
**Supersedes:** the older `SESSION_HANDOFF.md` (June session, different work — kept for reference only).
**Read this whole file first.** Single source of truth for where things stand, what was done, why,
what's pending, and every gotcha. Verify claims against live code before acting — file/line refs drift.

> ## ⚡ 2026-07-14 GO-LIVE ADDENDUM — supersedes §5/§9 below
> The 1.0.5 release SHIPPED on 2026-07-14: DB migrations applied (Neon email nullable, Mongo email
> index sparse-unique), both backends merged + live on prod Render (jauth `main` @ `732af22`+docs,
> noefix `milestone-branch` @ `e8f1f6f` merge), all §8 gates flipped (app commit `220059d`, iOS
> build bump `7c1c4fa`), Meta §9 release-build verification PASSED and closed. **Both stores:
> SUBMITTED FOR REVIEW (Play vc29 with Managed Publishing ON; App Store build 1.0.5 (2), manual
> release). NOT yet approved or published.** Two prod hotfixes shipped during go-live (jauth
> `b6673c9` add-only phone carve-out; noefix `e8f1f6f` booking-gate mirror self-heal) — full
> incident record, verdicts, and the REVERT/SUNSET LEDGER live in
> `docs/V104_BACKCOMPAT_AUDIT_2026-07-14.md` (authoritative go-live doc). Remaining tail: publish
> on Play after approval, §N/§O with store builds, Meta dataset-Overview check, Meta console §5
> (client access), force-update flip → carve-out revert, payment money-path fixes (~Dec 2026
> deadline), pin facebookSdkVersion, revert jauth ddl-auto to validate.

---

## 0. TL;DR for the next session

- Three repos changed this session: **app** (`renfi/renfi`), **Node backend** (`noefi/fixhomi-backend`),
  **Java Auth** (`java_auth-fxmi/jarbac`). All work is **committed** on feature branches.
- The release is **feature-complete and verified** (both app bundles compile, iOS parity reviewed,
  i18n parity holds). It is **NOT one-click deployable** — release-day flips and deploy actions are
  deliberately left undone while testers use dev-staging.
- **Living tracker docs already exist — read them:**
  - `docs/META_APP_EVENTS.md` §8 = the **PRE-STORE-RELEASE CHECKLIST** (authoritative gate list).
  - `RELEASE_TEST_GUIDE_1.0.5.md` = tester/client test guide (sections A–O).
  - Java repo has its own tracker with a §17/§18 go-live ledger.
- **When the owner asks "are you ready for prod?"** — re-verify every gate in §5 below against the
  actual code at that moment (do NOT answer from memory).

---

## 1. Project layout & how it fits together

- **App:** `renfi/renfi/` — React Native 0.81, New Architecture (`newArchEnabled=true`), TS entry + JSX
  screens. Home-services marketplace "Fixhomi". Two roles: **User** (customer), **Provider**.
- **Node backend:** `noefi/fixhomi-backend/` — Express on **Render**, **deploys from `milestone-branch`**.
  Service requests, profiles, addresses, subscriptions/payments, admin.
- **Java Auth:** `java_auth-fxmi/jarbac/` — Spring Boot on Render. Auth, JWT, OTP, phone/email
  verification. **Source of truth for phone/email + their verified flags.**
- **Website:** `flapage/…` — Next.js. Not touched this session.

**Dual-backend config (app):** `src/config/environment.js` + `src/config/api.js`. `apiClient` (Node) and
`authClient` (Java) are two axios instances in `src/services/apiClient.js`, both routing through
`addAuthHeader`.
**ID system:** MongoDB `_id` == Java `userId` (unified); stored as `mongoId` + `javaUserId`. Use
`user.mongoId` for profile/service queries.
**State:** no Redux — `AppContext` (`src/context/AppContext.js`) + `LocationContext`; `useApp()` /
`useLocation()`.

---

## 2. Current git state (exact, as of handoff)

### App — branch `feature/profile-redesign` (isolated for a later release, per owner)
Session commits, newest first:
```
e0e7b1d feat(api): stamp X-App-Version + X-App-Platform on every request
71b1dbd fix(ios+layout): native strike, modal keyboard/safe-area, 3-button nav clearance
cc2a083 fix(phone-change): keyboard avoidance + calm inline errors + guarded refresh
0c21c7b docs(test-guide): section O — phone change tests
8b30ad6 feat(profile): verify-then-replace phone change in Contact and Location
3ba7d49 docs(test-guide): F-13/F-14 bonus-protection tests
60c734e fix(premium): stale-response guard + durable bonus-popup dedup
7cbac22 fix(premium): strike line crosses ₹299 on all locales/fonts
84b1e65 docs: release checklist — backend milestone merge must ship with 1.0.5
103d062 docs(test-guide): section N booking-gate security tests
cc58983 docs: tester/client release test guide 1.0.5
1c0172d fix(i18n,state): 2nd audit — broken keys, HI/MR coverage, fail-safe premium
0083dcc fix(review): pre-prod audit — honest premium states, i18n tab labels, dead-code purge
e81ac05 feat(premium): 6-months-free offer across every premium touchpoint
2b17fe1/409b299 brand footers · 1681963/1b97d59/97354d1 liquid-glass tab bar
c43f54e/370ea51/a72aca8 3D icons · f9d0f72/297e484 Meta App Events
(profile redesign + auth commits earlier on the branch)
```
**Uncommitted in app working tree = the OWNER's — do NOT commit without asking:**
`OWNER_TEST_GUIDE.md`, `android/app/build.gradle` (version 29/1.0.5),
`ios/renfi.xcodeproj/project.pbxproj` (1.0.5/build 1), `src/assets/hero_home_services.png`,
`src/screens/UserTypeScreen.jsx` (hero ratio).

### Node backend — branch `phone-signup-providers`  (⚠️ prod = merge to `milestone-branch`)
```
999abb5 fix(phone): phone changes only via OTP flow; kill mirror-corruption paths
28054eb fix(premium): protect the 180-day bonus from clobbering and lost grants
b6bbc9b fix(security): rate-limit the set-email route
```
**Uncommitted (OWNER's, leave alone):** `controllers/adminServicesController.js`.

### Java Auth — branch `feature/phone-signup-users`
```
11a83e2 feat(phone): verify-then-replace phone change — number commits only with OTP
```
(Java repo has its own tracker MD — read it.)

---

## 3. What was built this session (with the WHY)

### 3.1 Premium "6 months free" redesign + robustness  (app + Node)
Model: ₹299/28d via Razorpay, BUT **6 months free auto-granted on FIRST service approval**
(`FIRST_APPROVAL_BONUS`, 180 days, price 0). No auto-renewal. iOS pays via **web redirect** (no IAP).
- `SubscriptionScreen.jsx` = **3 states**: A no approved service (gift pitch → DocumentVerification, NOT
  payment), B bonus running, C bonus over (₹299). State detection gated on `!!profile`.
- **Store-safe copy** (no processor named; "then ₹299/month" wherever ₹0 shows; "no automatic renewal").
- **₹299 strike** = native `textDecorationLine:'line-through'` (gold), NOT an absolute line (old one
  drifted off the digits by font/locale). Verified on iOS.
- **Node robustness (`28054eb`):** `createOrder` → 409 PREMIUM_STILL_ACTIVE if plan has >5 days left
  (can't pay over an active bonus → no collapsing 180 free days into 28); `activatePremium` extends from
  endDate not `now`; bonus grant rolls back its idempotency claim on failure + re-triggers (`>= 1`).
- **App state races (`60c734e`):** write-sequence guard on `premiumStatus` (3 uncoordinated writers);
  bonus congrats popup dedups durably in AsyncStorage (was re-firing every restart).

### 3.2 Booking verification gate  (Node — big security fix)
Incident: a Google user with NO verified phone had pending bookings on prod (user 2037). Enforcement was
**client-side only** and fails open while profile loads. Server gate `ensureBookingProfileComplete()`
(`utils/serviceHelpers.js`) → 403 for users without name+verified phone, wired into createRequest of
traditional/emergency/event controllers. **Lives on `phone-signup-providers`, NOT prod's
`milestone-branch` yet** — that's why the backend MUST merge before/with the app (§5).

### 3.3 Phone-change verify-then-replace flow  (all 3 repos — newest, biggest)
Bug: user with verified phone edits it → new number unverified → **could still book** (5 bypasses across
layers). Fix (architecture, not patch): an unverified number **never enters the DB** — number + verified
flag commit together, atomically, only after OTP.
- **Java (`11a83e2`):** `POST /api/users/phone/change/send-otp` + `/verify` (OTP to NEW number; commit on
  verify only; OTP scoped to `(userId,phone)`; uniqueness re-checked at commit; per-user+per-number rate
  limits). Plain `PUT /api/users/profile` ignores `phoneNumber`. OtpLogin verify-after-change race fixed.
- **Node (`999abb5`):** `/api/auth/sync-phone` always fetches phone+verified from Java (never trusts
  client body). User/provider/admin profile updates ignore `phone`. `verificationHelper` marks verified
  only when Java number == Mongo number. Dead duplicate route neutralized.
- **App (`8b30ad6`/`cc2a083`/`71b1dbd`):** phone edit **moved from top identity block to Contact &
  Location**, both roles. New `src/components/PhoneChangeModal.jsx` (Add/re-verify/change; mirrors
  email-change UX). Row states: Not set→Add / verified→number+✓+Change / unverified→Verify. On success:
  mirror to Mongo + force-refresh context (real-time). Guards: reentry ref, countdown, **calm amber
  inline errors** (not red labels), dialogs only for network; post-success refresh is best-effort.
  iOS: OTP keyboard via ref+delay (autoFocus unreliable in RN Modal), letter-spacing centering,
  **3-button nav clearance** (parent's safe-area inset passed as prop — `useSafeAreaInsets` returns 0 in
  a Modal). Services `sendPhoneChangeOtp`/`verifyPhoneChangeOtp` in `authService.js`; endpoints
  `VERIFICATION.PHONE_CHANGE_*` in `api.js`.

### 3.4 X-App-Version header  (app `e0e7b1d`)
`addAuthHeader` stamps `X-App-Version` + `X-App-Platform` on EVERY request (both clients) →one prod
backend can serve old and new app builds without a second backend. Read once from `DeviceInfo.getVersion()`.

### 3.5 Earlier session work (stable, committed)
Profile redesign (flat sections, inline editors, gradient header); Meta App Events
(`src/services/analytics/*`, App ID `1313159510169603`, client token `f4006a48dbb2a05589073394e01a74f0`);
liquid-glass tab bar (`RootNavigator.jsx` + `tabBarTone.js` + `TabBarDarkZone.jsx`, iOS always blurs,
old-Android skips); brand footers (`BrandFooter.jsx`); 3D icons (`Icon.jsx` ICON_3D); i18n EN/HI/MR
**1950 keys identical across locales — keep parity**.

---

## 4. Backend deploy / versioning strategy (decided this session)

Owner needs the new backend on prod for store review while current live users still hit prod.
- **Do NOT** run two backends keyed by app version → splits DB, breaks upgraders.
- **Deploy ONE backward-compatible prod backend** for both old and new builds. Yours is nearly
  compatible — only known degradation for old apps = phone-edit becomes a silent no-op (the buggy path
  we removed). No crashes.
- **X-App-Version header** (now added) = per-version behavior control.
- **Min-version / force-update gate ALREADY EXISTS + wired:** app `appUpdateService.js` +
  `AppUpdateModal.jsx` (runs on launch `App.tsx:386`, `forceUpdate`); backend
  `GET /api/admin/app-version/check` (per-platform `minVersion`) + admin `PUT /api/admin/app-version/update`.
- **Still recommended, NOT done:** a focused **v1.04 backward-compat audit** of the new backend before
  deploying to prod. Offer this to the owner.

---

## 5. RELEASE GATES — verify each against live code before saying "ready"

(Authoritative: `docs/META_APP_EVENTS.md` §8. Current state in brackets.)
1. `src/config/environment.js` → `USE_DEV_STAGING = false` **[is `true`]** — #1 gate; a store build with
   `true` sends ALL users to dev-staging Render. Intentionally `true` now for testers.
2. `src/services/analytics/analytics.js` → `DEBUG_ANALYTICS = false` **[is `true`]** — after Meta
   verification.
3. `android/app/build.gradle` → `mappingFileUploadEnabled true` **[is `false`]**.
4. **Merge Node `phone-signup-providers` → `milestone-branch`** (auto-deploys) BEFORE/WITH the app;
   merge Java branch to its prod branch too. Prod has NO server booking gate until this lands.
5. After backend deploy: run test-guide **§N** (booking gate) + **§O** (phone change).
6. iOS: `bundle exec pod install` before archiving (removed deps: `@react-navigation/drawer`,
   `react-native-background-timer`).
7. iOS `CURRENT_PROJECT_VERSION = 1` for 1.0.5 — confirm no existing 1.0.5 build ≥1 in App Store Connect.
8. Play Console: declare **AD_ID**, **READ_PHONE_STATE** (or strip), **ACCESS_BACKGROUND_LOCATION**
   (+ disclosure + demo video).

**Resolved (no action):** phone-change verification bypass — fully rebuilt this session.

---

## 6. Deferred / known issues (NOT blockers, but track)

- **Payment money-path bugs (deferred):** launch gives every provider 180 free days, so real payments
  start ~6 months out. **Fix before the first bonuses expire (~5 months post-launch):** verify-payment
  not atomic/idempotent ("already verified" without granting); client discards payment proof on failed
  verify (no retry); webhook records but never grants premium; refunded payment replayable; no iOS
  web-payment return detection; no reentry guard on pay button.
- **Expired-premium search visibility** stale up to ~30 min (cron); low.
- **Dead code (harmless):** old inline phone-verify handlers in ProfileScreen (`handlePhoneVerify` /
  `handleVerifyPhoneOtp` + gated OTP boxes) now inert. Left deliberately (risky ~150-line deletion).
- **`npm test`** broken since repo's first commit (jest ESM config) — not our regression.
- **`facebookSdkVersion` unpinned** (`android/build.gradle` `18.+`).

---

## 7. Gotchas & conventions

- **Lint against a baseline, never absolute counts.** ProfileScreen/SubscriptionScreen have many
  pre-existing `react-hooks/exhaustive-deps` errors. Method: `git stash` → lint → compare → `stash pop`.
  Bar = "zero NEW errors".
- **Verification method:** Babel parse (`module:@react-native/babel-preset`); i18n parity node script
  (flatten EN/HI/MR, diff keys + `%{var}`); release bundles BOTH platforms are the definitive compile gate.
- **i18n:** after any edit, re-run parity. Identical key sets + identical `%{var}` per key across locales.
  Missing-in-all renders literal `[missing "..."]` on screen — worst bug class (happened twice, fixed).
- **RN Modal + safe area:** `useSafeAreaInsets()` returns 0 in a Modal → pass parent's inset as prop.
  RN Modal on Android ignores `adjustResize` → `KeyboardAvoidingView behavior="padding"` both platforms.
  `autoFocus` unreliable in a Modal on iOS → focus via ref + delay.
- **iOS vs Android:** every `elevation` needs a matching iOS `shadow*`; `textDecorationColor` honored on
  iOS in RN 0.81; `autoComplete="sms-otp"` Android / `textContentType="oneTimeCode"` iOS;
  `statusBarTranslucent` Android-only (harmless on iOS).
- **Owner ships without local testing** → give a live HTML mockup artifact for UI changes.
  **Providers use older Android phones** → keep assets light.
- **Commit `-m` bodies:** avoid backticks (shell evaluates them).
- **The owner's uncommitted files in each repo are THEIRS** — never commit without asking.

---

## 8. The other tracker docs (read, don't duplicate)

- `docs/META_APP_EVENTS.md` — Meta events + §8 pre-release checklist (authoritative) + §9 issues log + §5
  Meta console TODO (needs client to grant console access).
- `RELEASE_TEST_GUIDE_1.0.5.md` — owner/client test guide A–O (N=booking gate, O=phone change,
  F-13/F-14=bonus protection).
- Java repo tracker MD — §17 audit, §18 resume, go-live ledger.
- **Auto-memory (persists across sessions):** `prod-release-gates` (release ritual + resolved
  phone-change + payment-path deadline), `lightweight-ui-for-providers`, `mockup-before-firebase-ship`.

---

## 9. Immediate next actions (when the owner returns)

1. Likely: **"run the v1.04 backward-compatibility audit"** (offered, not done) — de-risks deploying the
   new backend to prod.
2. Or **"are we ready for prod?"** → re-verify every §5 gate against live code, report honestly.
3. Or a new feature — branch is stable, everything compiles.

**Do NOT** flip release flags, commit the owner's uncommitted files, or merge branches unless explicitly
told. Everything in-flight is committed and safe.
