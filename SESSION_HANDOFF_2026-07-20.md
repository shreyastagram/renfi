# Fixhomi — Session Handoff (2026-07-20) — READ FIRST, THEN CROSS-CHECK

**Author:** Claude (Fable 5) with the owner. **Supersedes** `SESSION_HANDOFF_2026-07.md` for
everything after 2026-07-14.

> ⚠️ **To the next session: do NOT trust this file blindly.** It is a summary written from memory
> of a long session; file/line refs drift and a claim may be wrong or overstated. For anything
> load-bearing, **verify against live code / git / the DB before acting.** Where this doc says
> "verified", re-verify. Two audit findings this session were themselves overstated by sub-agents
> and had to be corrected — expect the same discipline here.

---

## 0. TL;DR — where things stand

- **1.0.5 store status:** Android **rejected** (Photo/Video Permissions policy), **fixed as vc30**
  (`0c13f36`, READ_MEDIA_IMAGES removed → system photo picker) — awaiting resubmission/approval
  (AD_ID release-error was turned off in Play Console). iOS **1.0.5 (2)** Waiting for Review.
  The old June 1.0.5(1) TestFlight build was EXPIRED (dev-staging, never ship it).
- **Backends deployed to prod:** Node `milestone-branch` and Java `main` carry the go-live work
  (booking gate, phone verify-then-replace, premium bonus protection). **BUT** the newest fixes
  below sit on the FEATURE branches and are NOT yet merged/deployed (see §4).
- This session added: 3 prod incident fixes (booking gate, phone carve-out, **provider
  verification-dashboard stuck-pending**), a big auth-logout + low-end-Android "text jitter" fix
  set, a camera-crash recovery, and a **full VAPT security pass** (3 critical/high PII holes closed).
- **Companion docs (authoritative, read them):**
  - `AUTH_STARTUP_LOGOUT_FIX.md` — logout root causes + change log (2026-07-18/19).
  - `docs/PENDING_STABILITY_WORK_2026-07.md` — jitter/stability board (what's done vs TODO).
  - `docs/V104_BACKCOMPAT_AUDIT_2026-07-14.md` — go-live record + revert ledger.
  - `docs/META_APP_EVENTS.md` §8/§9 — release gates + Meta events.
  - `noefi/fixhomi-backend/SECURITY_REVIEW_2026-07.md` — VAPT findings, owner actions, accepted risks.
  - jarbac `PHONE_SIGNUP_PLAN.md` — Java go-live ledger.

---

## 1. Is the app / frontend STABLE? (honest answer)

**Code-stability: yes — every change compiled/parsed clean and was reviewed; nothing is known-broken.**
But "stable" ≠ "device-verified". This session's work was validated by **Babel parse, Java compile,
i18n parity, static review, and one in-memory Mongo test** — NOT by running the app on devices or by
integration-testing the Java auth flows. So:

- **Safe to start testing: YES.** Nothing here is expected to crash; the changes are defensive and
  parse/compile-clean. Begin the RELEASE_TEST_GUIDE passes.
- **Must be device-tested before shipping** (this env couldn't):
  1. **Camera capture recovery** (`1397de1`) — on a low-RAM Android (the Realme that crashed): take a
     photo via camera in Profile / Document / Insurance / ServiceApprovals → if the app restarts, it
     should offer the photo back. Gallery unaffected.
  2. **Provider verification dashboard** — email-first provider adds+verifies phone → the phone step
     must show verified (server self-heal `0b1757d`+`77bf636`, DEPLOYED on Node). Re-test on prod.
  3. **Phone-change OTP resume** (`7b8c60d`) — start a phone change, background to SMS app, reopen →
     resumes on OTP step within 5 min.
  4. **Low-end-Android "text jitter"** — the root fixes (`ca553cd`, `6672926`) target a launch-race
     render storm; needs the affected device to confirm the shimmer/jitter is gone after a bad launch.
  5. **Auth: no wrongful logout** — needs jarbac grace window deployed (§4) + Crashlytics watch.
  6. **Password reset / email verify** (jarbac `565814e`, token hashing) — dev smoke test before prod
     merge (invalidates in-flight raw tokens — fine, users re-request).

**Bottom line:** start testing now; treat items 1–6 as the must-pass list before the 1.0.6 build.

---

## 2. What was built/fixed this session (with WHY)

### 2.1 Three prod incident fixes (Node, DEPLOYED on milestone-branch)
- `e8f1f6f` booking gate self-heals the Mongo mirror from Java (users could be wrongly blocked).
- `0b1757d`+`77bf636` **provider verification dashboard stuck at "phone pending"** — email-first
  providers verify phone in Java only; the Mongo provider mirror stayed empty so the dashboard step
  never flipped. `syncJavaAuthVerification` now self-heals from Java (source of truth) and the GET
  awaits the sync when steps are pending, so it auto-updates like Aadhaar. **Bug = Node mirror, not
  Java/app.** Verified against prod DB (providers 2175/2174/2167/2162 were stuck).
- C2 app-side hardening `47c9f01` — PhoneChangeModal sends the number + retries the mirror sync;
  fixed a DEAD-CODE `refreshVerificationStatus` (its Mongo sync never ran for anyone due to a stale
  `[]` closure); heal-on-"already-verified"-bounce.

### 2.2 Auth logout family + low-end-Android render "jitter" (`ca553cd`, `6672926`, `5b25bc5`)
Root causes (see AUTH_STARTUP_LOGOUT_FIX.md change log): single-use refresh tokens + multiple refresh
actors → wrongful logout; and a defeated context-memo (`initializeAuth` in the value-memo deps) +
inline LanguageContext/DialogContext values re-rendering every Text on low-end phones. Fixes: one
shared refresh mutex; **401-ONLY logout contract** (429/500 no longer log out); headless
TransistorSoft token persistence (`index.js`); socket orphan guard; memoized contexts; shimmer stops
when idle; provider socket effect no longer re-inits on every GPS move; redundant profile writes
skipped; startup profile retry; banner vibration cooldown + 60s dedupe.
- **Java `0d0ade9` 45s rotation grace window** = the server-side backstop. NOT deployed (see §4).

### 2.3 Camera recovery (`1397de1`) + phone-OTP resume (`7b8c60d`)
Low-RAM process death survival: `utils/cameraRecovery.js` + `hooks/useCameraRecovery.js`, wired into
all 4 camera flows; PhoneChangeModal persists the pending OTP step.

### 2.4 Analytics (`554376a`) — OWNER addition
Firebase/GA4 mirror alongside Meta. **RELEASE GATE:** update Play Data Safety + Apple App Privacy for
Firebase Analytics before the next store build.

### 2.5 VAPT security pass (see SECURITY_REVIEW_2026-07.md)
Fixed: `34360b8` (3 CRITICAL/HIGH PII endpoints — full user-table dump ×2 + provider IDOR),
`173442e` (rate-limiter IP-spoof + per-user key), `89ee926` (provider email enumeration),
jarbac `2f71589` (revoke sessions on password change), `565814e` (hash reset/verify tokens),
`3a3cec3` (aadhaar `|| true`), `bb44ddd` (scrub secret fragments).
**Production-readiness scored 7.5/10 — capped by ONE owner action (below).**

---

## 3. 🚨 OWNER ACTIONS (only you can do — not code)
1. **Rotate `JWT_SECRET`** in BOTH backends' Render env if not already rotated since the April
   SECRETS_AUDIT — the full shared HS512 signing secret is in git HISTORY of both backends; if still
   live, anyone with history access can forge tokens for any account. Also rotate **Surepass token**
   (valid to 2046, flagged skipped) + **Neon password**. This is the single highest risk.
2. **Confirm the `jauth` GitHub repo is PRIVATE.**
3. Play Console: complete the vc30 resubmission; keep AD_ID release-errors off or declare properly.

---

## 4. What is NOT deployed yet (feature branches — merge to ship)
- **Node `phone-signup-providers`** (has ALL the VAPT + verification fixes past `e8f1f6f`) → merge to
  **`milestone-branch`** (Render auto-deploys). NOTE: `e8f1f6f`/`0b1757d`/`77bf636` ARE already on
  milestone per earlier merges — VERIFY which commits are actually on milestone before assuming.
- **Java `feature/phone-signup-users`** (grace window `0d0ade9`, M-J1 `2f71589`, M-J5 `565814e`) →
  merge to **`main`**. Grace window needs the `rotated_at`/`replaced_by_token` columns (ddl-auto adds
  them). Token hashing: dev smoke-test password-reset + email-verify first.
- **App `feature/profile-redesign`** — all app fixes are here; they ship in the **1.0.6** build (the
  1.0.5 vc30 that's in Play review does NOT include this session's app fixes — it's the pre-session
  release + the photo-permission fix only). Decide: hotfix into 1.0.5 or hold for 1.0.6.

---

## 5. Remaining TODO (from docs/PENDING_STABILITY_WORK + VAPT accepted risks)
- Jitter: BlurView device-class gate (needs an affected device field test — `SUPPORTS_BLUR=false`).
- Security later: shared-store (Redis) rate-limit/blacklist for multi-instance; shorter access-TTL +
  `tokensValidAfter`; encrypt the AsyncStorage token fallback; grace-window device binding; hash
  6-digit OTPs was DECLINED (marginal value — documented).
- Payment money-path bugs — before ~Dec 2026 (first 180-day bonuses expire).
- jauth add-only phone carve-out is TEMPORARY — revert after 1.0.5 fleet + force-update gate.

---

## 6. Conventions / gotchas (unchanged, still true)
- Lint against a baseline (`git stash` → lint → compare), never absolute counts.
- i18n: EN/HI/MR must stay key-identical (now **1959** keys) with identical `%{var}` per key.
- Commit `-m` bodies: avoid backticks. Owner's uncommitted files in each repo are THEIRS
  (`adminServicesController.js`, `AUDIT_LOG_FEATURE.md`) — don't commit them.
- This env can compile Java + Babel-parse RN, but CANNOT run the app or Java auth flows — device/dev
  smoke tests are the owner's step.
