# Fixhomi — Enhancements Investigation & Implementation Report

> **Purpose:** living engineering doc for a 5-item enhancement request. Investigation-first
> (evidence, no assumptions). **Read the "Status Tracker" first.** Spans four repos:
> `renfi` (RN app), `noefix` (Node backend), `jauth` (Java auth — not involved here),
> `temp_admin` (admin panel). Workflow: investigate → document (this file) → confirm risky
> items → implement → update this file.

---

## Status Tracker

| # | Enhancement | Verdict from investigation | Layers | Risk | Status |
|---|-------------|----------------------------|--------|------|--------|
| 1 | Notification sound | Foreground-only today → now full toggle control; background keeps sound | FE + native + BE (no added load) | Low–Med | ✅ **DONE** ⚠️ device-test |
| 2 | Emergency numbers for Providers | Provider-stack route + bottom card; reuse + jank fix | FE only | Low | ✅ **DONE** ⚠️ device-test |
| 3 | Free trial → 6mo | 60-day "First Approval Bonus" → 180d; auto-extend existing, hard-capped at 6mo | BE + auto-migration | **High** | ✅ **DONE** ⚠️ device-test |
| 4 | Referral cycle → 180d | 2 cycles/yr (C1 Apr–Sep, C2 Oct–Mar); current cycle window extended; points untouched | BE only (FE auto-adapts) | **High** | ✅ **DONE** ⚠️ device-test |
| 5 | "Coming Soon" services | Cached availability endpoint + card states | FE + BE | Low–Med | ✅ **DONE** ⚠️ device-test |

**Decisions captured (2026-06-07):** #1 full (background sound too); #3 auto-extend existing proportionally to 6mo from start + new providers 180d, fully automatic; #4 two cycles/yr, current cycle extended to a full 180 days then rolls, app/backend now & website legal later, must not break schema.

---

# Enhancement 1 — Notification Sound Verification & Fix

### Current implementation (verified, not assumed)
- **Toggle:** `renfi/src/screens/SettingsScreen.jsx:1191-1197` — `appPreferences.notificationSound` (default `true`, line ~367). Saved to AsyncStorage key `app_preferences` (`savePreferences`, ~440) **and** synced to backend `PATCH /api/{user|provider}/{id}/preferences` (`syncPreferencesToBackend`, ~451). Toggling ON plays a test chirp (line 563).
- **The toggle's only consumer:** `renfi/src/utils/notificationSound.js` → `isSoundEnabled()` (39-48) reads `app_preferences.notificationSound`; used only inside `playNotificationSound()` (59-104), which displays a transient Notifee notification on channel `fixhomi_sound_alerts` (`sound:'default'`) to trigger the system chirp.
- **`playNotificationSound` callers (only 2):** `GlobalBanner.jsx:120` (foreground FCM + socket banners) and `SettingsScreen.jsx:563` (test chirp).
- **App default channel:** `renfi/src/services/fcmService.js:31-39` creates `fixhomi_notifications` (importance HIGH, `sound:'default'`). Background handler (`fcmService.js:253-263`, registered `index.js:57`) only logs.
- **Backend send:** `noefix/utils/pushNotification.js:70-104` sets `android.notification.channelId:'fixhomi_notifications'` + `defaultSound:true`, and `apns ... sound:'default'`. Per-user gating checks `preferences.pushNotifications` only (51-60) — **never `notificationSound`**.
- **Native:** `android/app/src/main/res/raw/` does **not exist** (no custom sounds); `AndroidManifest.xml` has **no** `default_notification_channel_id` meta-data.
- **Flows:** "request sent" → provider push (`traditionalServiceController.js:2270-2302`) carries sound ✓; "accepted" → user push (`:2600`) carries sound ✓. **There is no "request sent" confirmation push to the requesting user** (socket/UI only). (Minor bug: the provider push passes `options:{...}` but `sendPushNotification` reads `android`/`apns`, so its `color`/`clickAction` are silently ignored — cosmetic, not sound.)

### Current behavior
| State | Sound source | Respects "Notification Sound" toggle? |
|---|---|---|
| Foreground | `playNotificationSound` (Notifee) via `GlobalBanner` | **YES** |
| Background | OS renders payload on `fixhomi_notifications` channel | **NO** (always plays) |
| Quit | same | **NO** (always plays) |

### Gaps (root analysis)
1. The toggle only mutes the **in-app foreground** chirp. Background/quit sound is governed by the Android **channel** + payload `defaultSound`, which never consult `notificationSound`. Users will expect it to silence push sound everywhere.
2. Backend has the synced value but ignores it (only checks `pushNotifications`).
3. Android channel sound is **immutable after creation** — muting requires a **second silent channel** (e.g. `fixhomi_silent`) and the backend choosing `channelId` per preference.
4. No custom sound asset; no manifest default channel.

### Proposed implementation
**Decide scope first** — two honest options:
- **Option 1A (smallest, honest relabel):** keep behavior; reword the setting subtitle to "Play sound for in-app notifications" (the en string at `i18n` already nearly says this). Confirms the toggle does what it says. *No real cross-state muting.*
- **Option 1B (full, "toggle silences all push sound"):** (a) FE: create a second Notifee channel `fixhomi_silent` (`sound: undefined`, importance DEFAULT) in `fcmService.js`; (b) BE: in `pushNotification.js`, read the recipient's `preferences.notificationSound` (already stored) and set `channelId` to silent + omit `defaultSound`/`apns.sound` when false; (c) confirm FE sync writes `notificationSound` into the same `preferences` doc the backend reads. This makes background/quit honor the toggle. **Recommended if the product intent is "silence all notification sound."**

### Impact: FE (channel + maybe copy) · BE (payload channel selection) · Native (no new files needed for 1B; silent channel is created from JS) · DB (none — `preferences` already stored). 
### Risks: channel creation is one-time per install (existing users already have `fixhomi_notifications`; the new silent channel is additive — safe). Verify the backend `preferences` doc actually contains `notificationSound` for both user & provider before relying on it.

---

# Enhancement 2 — Emergency Numbers for Providers

### Current implementation (verified)
- Users open it from `UserHomeScreen.jsx:1454-1461` (`QuickAccessCard` → `navigation.navigate('EmergencyServices')`).
- Screen: `renfi/src/screens/EmergencyServicesScreen.jsx` — handles **both** static helpline numbers (`step='static'` + `StaticNumbersModal`) **and** location-based emergency booking (snake catcher/ambulance/mortuary). Component signature is `({ navigation })` only — **no route param** (line 623).
- Data: `renfi/src/services/emergencyServicesService.js` — API-first `getStaticEmergencyNumbers()` (134-179) with hardcoded offline fallback `OFFLINE_HELPLINE_NUMBERS` (82-126: Police 100, Fire 101, Ambulance 102/108, 112, etc.). Category metadata in `STATIC_NUMBER_SERVICES` / `GOVERNMENT_HELPLINE_SERVICES`.
- **Route registration:** `navigation/RootNavigator.jsx:489-493` registers `EmergencyServices` in **`UserMainNavigator` only**. `ProviderMainNavigator` (531-633) does **not** — so a provider calling `navigate('EmergencyServices')` would currently fail. **This is the one structural gap.**
- Provider Home (`ProviderHomeScreen.jsx`) uses a single `ScrollView` (974-979); last element is the "Tips" card (1315-1331) — natural bottom insertion point. Existing tappable-card pattern at 1041-1045.
- Distinct from **PSA** (`PSAContactsScreen`/`psaService.js`, user's own SOS contacts) — not this.

### Gaps / root analysis
Functionality fully exists and is reusable; it's simply **not reachable from the Provider stack**. No backend/data work needed.

### Proposed implementation (FE only)
1. `navigation/RootNavigator.jsx`: register `EmergencyServices` in `ProviderMainNavigator` (screen already imported, line 48), mirroring 489-493.
2. `ProviderHomeScreen.jsx`: add an "Emergency Numbers" `TouchableOpacity` card after the Tips card (~1329) → `navigation.navigate('EmergencyServices', { mode: 'helplines' })`.
3. **Recommended (Option B):** add an optional `route.params.mode` to `EmergencyServicesScreen` so providers land directly on the static helpline numbers (numbers-only), hiding the location-based booking tiles. If product wants providers to also use booking, skip the param (Option A) and just navigate.
### Impact: FE only (`RootNavigator.jsx`, `ProviderHomeScreen.jsx`, optionally `EmergencyServicesScreen.jsx`). No BE/DB/Admin. Risk: minimal.

---

# Enhancement 3 — Free Trial 2 months → 6 months  ⚠️ needs decision

### Current implementation (verified — important correction)
- It is **NOT a registration trial.** It's a **"First Approval Bonus"** of **60 days** granted **once**, server-side, when an admin approves a provider's **first** service category.
- **Duration constant (single source):** `noefix/models/subscription.js:45` → `SUBSCRIPTION_PLANS.FIRST_APPROVAL_BONUS.durationDays = 60`. Hardcoded literals also at: description string (`subscription.js:44` "60 days…") and push text (`documentVerificationController.js:913` "Enjoy 60 days…").
- **Grant trigger/logic:** `documentVerificationController.js:642-650` (on first approval) → `grantFirstApprovalBonus` (858-901): computes `endDate = now + durationDays*86400000`, writes `Subscription.activatePremium(...)` (`subscription.js:392-415`, stamps `currentPlan.startDate=now`, `endDate`) and `Provider { isPremium:true, premiumExpiresAt:endDate, firstApprovalBonusPending:true }`.
- **Provider fields:** `provider.js:482-491` — `isPremium`, `premiumExpiresAt`, `firstApprovalBonusGranted` (idempotency), `firstApprovalBonusPending` (UI). **No `trialStartedAt`/`trialEndsAt`.**
- **Entitlement:** date comparison `isPremium && premiumExpiresAt > now` (`verificationHelper.js:200-203`); gates search visibility (291-297).
- **Expiry cron:** `server.js:227-246` (startup + every 30 min) → `expirePremiumsAndRecompute` (`verificationHelper.js:334-363`) flips `isPremium=false` when `premiumExpiresAt < now`; `Subscription.updateExpiredSubscriptions` (`subscription.js:339-357`) keys off `currentPlan.endDate` (3-day grace).
- **Admin controls:** **none** — `temp_admin` only *displays* premium (`FixhomianDetail.jsx:363`); only mutating premium endpoints are the Razorpay paid flow and a dev-only `reset-premium`.

### Architecture gap to flag
> **No provider-level `trialStartedAt`.** To extend *proportionally* you must read the trial start from `Subscription.currentPlan.startDate` (only valid while `currentPlan.planId === 'first_approval_bonus'`). Providers who later bought `premium_28` have their `currentPlan` overwritten — the original trial start is only in `history[]` or the `BONUS_*` Transaction. This must be special-cased.

### Proposed implementation
1. **Constant:** `subscription.js:45` `durationDays: 60 → 180` (or calendar `addMonths(…,6)`); fix description (`:44`) and push text (`documentVerificationController.js:913`). → New providers get 6 months automatically.
2. **Migration (one-off script in `noefix`)** — re-anchor on start (gives the exact proportional result requested):
   - For each `Subscription` with `currentPlan.planId === 'first_approval_bonus'`: `newEnd = currentPlan.startDate + 6 months`; set `Subscription.currentPlan.endDate = max(currentEnd, newEnd)`, `isPremium=true`, clear `gracePeriod`; set matching `Provider.premiumExpiresAt = same`, `isPremium=true`; then `recomputeVerificationStatus(providerId)`.
   - Edge cases: providers now on a **paid** plan (`max(paidEnd, bonusStart+6mo)` or skip); providers without the bonus (`firstApprovalBonusGranted=false`) — leave (they get 180 on approval); always use `max(...)` so no one's time is reduced.
   - Write to **both** `Provider.premiumExpiresAt` **and** `Subscription.currentPlan.endDate` (cron uses provider field; Subscription expiry uses currentPlan.endDate) — mismatch would re-expire them.
3. **Optional hardening:** add a real `trialStartedAt` + `trialDurationDays` to `provider.js` and backfill, so future changes don't need a Subscription join.

### Impact: BE (constant + literals), DB (migration script + run against prod), Admin (none required; optionally add a "grant/extend premium" endpoint — currently absent). 
### Risks: production data migration; the paid-plan edge case; provider/subscription field consistency vs the cron. **Decision needed:** (a) confirm "total 6 months from original start" semantics (vs "+4 months to whatever's left"); (b) who runs the migration & against which DB; (c) calendar months vs 180 days.

---

# Enhancement 4 — Referral Cycle 120 → 180 days  ⚠️ needs decision (semantic change)

### Current implementation (verified — major correction)
- **There is no `120`/`cycleDays`/4-month numeric constant.** The cycle is **calendar-month-aligned, financial-year-tied**, computed from "now":
  - `noefix/models/pointsLedger.js:91-101` `getCurrentCycleId()` → `YYYY-C1` (Apr–Jul), `C2` (Aug–Nov), `C3` (Dec–Mar). **3 cycles/year.**
  - `noefix/models/rewardCycle.js:251-282` `getCycleDates()` → start/end dates per cycle (this is where the 4-month length materializes).
  - `pointsLedger.js:117-121` `getCycleIdsForYear()` hardcodes `[C1,C2,C3]`; `getFinancialYear()` (107-111).
  - `rewardCycle.js:41` `cycleNumber: { enum: [1,2,3] }` — **hard constraint blocking a 2-cycle scheme.**
- **No cron** closes cycles (confirmed); cycle docs created lazily via `getOrCreateCurrentCycle` upsert (`rewardCycle.js:71-93`). `endDate` is **display-only** (`getCycleInfo`, `referralController.js:546-552` computes `daysRemaining`/`totalDays` dynamically — would show ~180 automatically once windows change).
- **DB:** `RewardCycle` docs (`cycleId`,`year`,`cycleNumber`,`startDate`,`endDate`,`status`) + every `PointsLedger` entry carries `cycleId` (the bucketing key for all leaderboard aggregations).
- **Admin (`temp_admin`):** fully backend-driven (`ReferralDashboard.jsx` shows `dashboard.cycleId`); **no hardcoded period.** No change.
- **App (`renfi`):** `ReferralScreen.jsx` renders dates/`daysRemaining` from backend `cycle-info`; **no "120"/"4 months" copy.** i18n has no referral-cycle length strings. No change.
- **⚠️ Legal/static text is OUTSIDE these repos:** a separate Next.js site `fixhomi.com` (`app/privacy/page.js` ~line 392, `app/terms/page.js` Section 6.5) states **"4-month cycle (3 cycles per Indian financial year)"** — per `noefix/LAUNCH_PLAN.md:1095,1186-1192`. Store-review collateral quotes the same. **Not present in this workspace.**

### Root analysis / gap
"Change 120→180 days" is **semantic, not numeric.** 180-day windows = **2 cycles/year**, which breaks the `enum:[1,2,3]`, the hardcoded `[C1,C2,C3]` yearly aggregation, and requires migrating the live `RewardCycle` doc + existing `PointsLedger.cycleId` buckets so historical referrals keep counting correctly. FY alignment (Apr-start) also must be redefined for a 2-cycle scheme.

### Proposed implementation (pending the decision below)
- **If 2 cycles/year (true 6-month):** rewrite `getCurrentCycleId` + `getCycleDates` (e.g. H1 Apr–Sep, H2 Oct–Mar), change `enum:[1,2,3] → [1,2]`, fix `getCycleIdsForYear`/`getFinancialYear`, migrate the active `RewardCycle` doc's `endDate`, and decide how in-flight `2026-C1/C2/C3` ledger entries remap into `2026-H1/H2` (or freeze old cycle, start new scheme next FY).
- **Update external web legal text** (`fixhomi.com` privacy §, terms §6.5) + store collateral — outside this workspace; must be coordinated.
- **In-repo docs** to update: `noefix/REFERRAL_REWARDS_SYSTEM.md`, `renfi/REFERRAL_REWARDS_SYSTEM.md`, `noefix/LAUNCH_PLAN.md`.

### Impact: BE (2 model files), DB (live `RewardCycle` + `PointsLedger` migration/reconciliation), External web (legal — not in repo), Docs. Admin/App/i18n: none (auto-adapt).
### Risks (high): mid-year scheme change can split/mismatch historical leaderboard buckets; `enum` + yearly aggregation assume 3 cycles; legal-text consistency is a store-review risk. **Decision needed:** confirm the exact desired scheme (2 cycles/year H1/H2? when does it take effect — now mid-cycle, or next FY?), how to handle in-flight cycle data, and who updates the external legal site.

---

# Enhancement 5 — "Coming Soon" for zero-provider services

### Current implementation (verified)
- **Categories are hardcoded** in `renfi/src/screens/UserHomeScreen.jsx:84-97` (`SERVICE_CATEGORIES`, `{id,name,iconName}`), rendered via `.map` → memoized `ServiceCard` (131-158, 1481-1486). Always clickable; **no disabled/coming-soon state exists.** (Emergency categories are a separate hardcoded list on `EmergencyServicesScreen`.)
- **Availability is only evaluated AFTER a request is created** (tap → date sheet → create request → `getNearbyProviders`). No pre-tap availability check.
- **Backend availability gate** (`noefix/controllers/traditionalServiceController.js:352-411`): `$geoNear` with `verifiedServiceCategories`, `isFullyVerified`, `documentVerification.canReceiveRequests`, `isPremium`, `isAvailable`, 16h location staleness, geofence. There's an existing non-geo `countDocuments` (449-457) used only for reject logic.
- **No category model, no availability/counts endpoint, no enable flag.** Admin `Categories` page is read-only. Precedent for a cached singleton config: `noefix/models/appVersion.js` (`getActive()`).

### Root analysis
To show "Coming Soon" we need the **set of categories that currently have ≥1 available provider**, without exposing counts and without 12 per-card queries.

### Proposed implementation (recommended: cached "available-categories" endpoint)
1. **BE:** new `GET /api/traditional-services/available-categories` → one aggregation using the **same gates** as the count query (449-457) but `$unwind` + `$group` on `verifiedServiceCategories` → returns **only category keys** (e.g. `['electrician','plumber']`), never counts. Index-supported (`verifiedServiceCategories` index, `provider.js:791`). Server-side **TTL cache (60–120s)** (appVersion singleton pattern) so concurrent loads collapse to ~1 aggregation/window. (v1 can be global/no-location given the single Yavatmal zone; area-aware = one `$geoNear` variant.)
2. **FE:** `UserHomeScreen` fetches once on focus, builds a `Set` of available ids, passes `comingSoon = !set.has(service.id)` into `ServiceCard`; when true → render "Coming Soon" badge, disable press. **Fail open** (on error/loading, show active) to avoid blanking the grid. Keep `ServiceCard` memoized (no icon remounts).
3. **Optional:** an emergency-categories variant (omit `isPremium`) for `EmergencyServicesScreen`, and/or an admin override flag (singleton config) to force-hide a category.

### Impact: BE (new endpoint + cache), FE (`UserHomeScreen` + `ServiceCard`; optionally Emergency screen), DB (none new; uses existing index), Admin (optional override). 
### Risks: low; keep fail-open; ensure cache TTL keeps "auto-activate when a provider appears" within ~1–2 min (acceptable). Note the 16h staleness gate means availability can change with no DB write — TTL refresh (not a materialized view) is the right call.

---

## Cross-cutting decisions needed before implementing #3 and #4
1. **#3 Trial:** confirm "total 6 months measured from original trial start" (re-anchor) vs "+4 months on top of remaining"; who runs the migration and on which DB; calendar-months vs 180 days.
2. **#4 Referral cycle:** confirm the target scheme (2 cycles/year H1/H2?), effective timing (mid-cycle now vs next FY), in-flight `cycleId` data handling, and ownership of the **external** `fixhomi.com` legal-text update (not in this workspace).

## Implementation Log
_(updated as changes land)_

- **E2 — DONE (app-side reuse + jank fix).**
  - `navigation/RootNavigator.jsx`: registered `EmergencyServices` in `ProviderMainNavigator` (was User-only).
  - `src/screens/ProviderHomeScreen.jsx`: added an "Emergency Numbers" card at the bottom of the home ScrollView (after Tips) → `navigation.navigate('EmergencyServices', { mode: 'helplines' })`; added card styles.
  - `src/services/emergencyServicesService.js`: added `getOfflineEmergencyNumbers(type)` (sync).
  - `src/screens/EmergencyServicesScreen.jsx`: `handleServiceSelect` now opens the numbers sheet INSTANTLY from the offline list, then refreshes from the API in the background (fixes the "wait → cards flash → numbers" jank). No data duplication — reuses the same screen + data source.
  - Lint clean. _Note:_ providers currently land on the full emergency screen (which includes the static numbers). A numbers-only `mode` is passed but not yet consumed (future polish); de-scoped to avoid touching the large select-grid render.

- **E5 — DONE ("Coming Soon", fail-open, no stale, no counts).**
  - Backend `noefix/controllers/traditionalServiceController.js`: `getAvailableCategories` — one `$unwind`+`$group` aggregation over the same gates as provider search (verified + premium + available + 16h-fresh), returns **category keys only**, **30s TTL cache**.
  - Backend `noefix/routes/traditionalServiceRoutes.js`: `GET /api/traditional-services/available-categories` (auth; registered before `/:id`).
  - Frontend `src/services/traditionalServiceService.js`: `getAvailableCategories()` — **fails open** (returns null → show all active).
  - Frontend `src/screens/UserHomeScreen.jsx`: refetch on focus (no stale); `isCategoryComingSoon(id)`; `handleServiceSelect` shows a "Coming Soon to your city" dialog and aborts; `ServiceCard` gains a `comingSoon` prop (dimmed icon/label + "Coming Soon" badge, no press-shrink); added badge styles.
  - Lint clean; backend `node --check` clean. _Note:_ applies to the traditional-services home grid (per-category cards). Emergency/Event are single quick-access buttons (different UX) — not in scope here. i18n keys (`userHome.comingSoon*`) use English literal fallbacks; add hi/mr translations as polish.

- **E1 — DONE (full toggle control; no added server load).**
  - Backend `noefix/utils/pushNotification.js`: reads `preferences.notificationSound` in the **same existing** preference query (no extra query/load); when off → targets a silent channel + omits `defaultSound`/APNs `sound`, so the toggle silences notifications in **all** states (foreground/background/quit). Default stays sound-on.
  - App `renfi/src/services/fcmService.js`: added `fixhomi_silent` channel (DEFAULT importance, no sound). Existing `fixhomi_notifications` (sound) unchanged. Foreground path already respected the toggle.
  - Lint clean; backend `node --check` clean.
  - ⚠️ **Known coverage limitation (pre-existing, not a regression):** the per-user gating in `sendPushNotification` (BOTH the existing `pushNotifications` check AND the new `notificationSound` check) only runs when a call passes **top-level `userId`/`userType`**. Several key flows pass `token` directly WITHOUT them — e.g. "New Service Request → provider" (`traditionalServiceController.js:2314`), so the sound toggle (and the push toggle) do NOT silence those; they always play the default sound. Default-on behavior is correct everywhere; only toggle-OFF is partial. To make the toggle fully effective, those call sites must pass `userId`+`userType` (recipient). Deferred as a focused follow-up to avoid blindly editing ~8 call sites.
- **E3 — DONE (auto-extend to 6 months, hard-capped).**
  - `noefix/models/subscription.js`: `FIRST_APPROVAL_BONUS.durationDays 60 → 180` (+ description). New approvals now grant 180 days.
  - `noefix/controllers/documentVerificationController.js`: push copy "60 days" → "6 months".
  - `noefix/helpers/trialMigration.js` **(new)**: idempotent, automatic migration. Re-anchors each existing `first_approval_bonus` trial to **exactly `start + 180 days`** (consumed 1mo → 5mo left; lapsed → stays lapsed). **Safety guards: target is a fixed offset from a fixed start (never from `now`), HARD CEILING at start+185d, skips invalid/missing start dates, skips implausible results, only touches the trial plan (never paid), idempotent (re-runs skip ≥6-month windows).** Writes the same bounded end to BOTH `Provider.premiumExpiresAt` and `Subscription.currentPlan.endDate`; recomputes `isFullyVerified` for re-activated trials. **An infinite/over-6-month date is structurally impossible.**
  - `noefix/server.js`: runs the migration once on startup (after premium-expiry), idempotent. No admin/provider action required.
  - Backend `node --check` clean on all four files.

- **E4 — DONE (2 cycles/year, points fully preserved).**
  - `noefix/models/pointsLedger.js`: `getCurrentCycleId` now maps **C1 = Apr–Sep, C2 = Oct–Mar** (was 3×4-month). The current period KEEPS the same `<year>-C1` id, so **no `PointsLedger` entry is re-tagged** — all collected referral AND service-completion points stay in their existing bucket. `getCycleIdsForYear` left as the `[C1,C2,C3]` superset so legacy-C3 years still total correctly; `enum [1,2,3]` retained for legacy docs.
  - `noefix/models/rewardCycle.js`: `getCycleDates` C1 → Apr 1–Sep 30, C2 → Oct 1–Mar 31; case 3 retained read-only for legacy docs; header comment updated.
  - `noefix/helpers/referralCycleMigration.js` **(new)** + `server.js`: idempotent startup migration that extends the **active** cycle doc's window (e.g. Jul 31 → Sep 30). **Touches only `RewardCycle` docs — never `PointsLedger`**, so no points of any kind are altered. `getCycleInfo` already computes `daysRemaining`/`totalDays` dynamically → app shows the new ~180-day window automatically (no FE change).
  - Backend `node --check` clean.
  - Assumption: run while the active cycle is still `<year>-C1` (true in Apr–Sep). In-repo docs (`REFERRAL_REWARDS_SYSTEM.md`) and the external `fixhomi.com` legal text still say "4-month" — to be updated later (per your call: app-side first).

- **Follow-on admin visibility (requested during rollout) — DONE.**
  - `noefix/controllers/referralController.js`: `adminDashboard` now returns a `cycle` object (cycleId, cycleNumber, status, start/end, daysRemaining, daysElapsed, totalDays, progress, financialYear) + user/provider referral split. Null-safe.
  - `temp_admin/src/pages/FixhomianDetail.jsx`: added a provider **"Premium / Subscription"** card (status Active/Expired, plan, premium start/expiry, days remaining) using data the detail API already returns.
  - `temp_admin/src/pages/ReferralDashboard.jsx`: added a **"Current Cycle"** card (window, FY, status, days remaining, progress bar) from `dashboard.cycle`.
  - Admin panel `npm run build` clean; backend `node --check` clean.
  - Deploy note: the cycle card needs BOTH `noefix` + `temp_admin` deployed; the premium card needs only `temp_admin`.

## Migration tooling (env-controlled, idempotent)
- `MIGRATION_DRY_RUN=true` → preview both startup migrations (logs WOULD-change, writes nothing). Safe on live data.
- `MIGRATION_PROVIDER_ID=<id>` → scope the trial migration to ONE provider (cycle migration skipped while set).
- Both migrations are **idempotent** (re-anchor/recompute to fixed targets) → repeated deploys never double-extend.
- Observed dry-run (prod): `WOULD extend 72/73 trial(s) (skipped 1 = already-done test provider)`, cycle `2026-C1: Jul 31 → Sep 30`.

## Deployment Runbook & Rollback Record
**Order used:** backend (`noefix`) + admin (`temp_admin`) pushed/deployed first; app (`renfi`) pushed separately for local testing.

**To roll the trial extension to ALL providers (Render env):**
1. (Safe) `MIGRATION_DRY_RUN=true`, remove `MIGRATION_PROVIDER_ID` → redeploy → verify log `WOULD extend N/total`.
2. Set `MIGRATION_DRY_RUN=false` (or remove), keep `MIGRATION_PROVIDER_ID` removed → redeploy → log `Extended N/total` + `CycleMigration Extended 1/1`.
3. Verify: `db.subscriptions.countDocuments({'currentPlan.planId':'first_approval_bonus', $expr:{$gt:[{$subtract:['$currentPlan.endDate','$currentPlan.startDate']}, 185*864e5]}})` → expect `0`.
4. Leave env vars removed; future restarts are no-ops (idempotent).

**Rollback notes (if something looks wrong):**
- **Trial (E3):** data change = `Provider.premiumExpiresAt` + `Subscription.currentPlan.endDate` extended to start+180. To revert a provider: set those back to `start + 60 days` (`isPremium` recomputed by the expiry cron). No points/other data touched.
- **Cycle (E4):** data change = active `RewardCycle` doc `endDate` (Jul 31 → Sep 30). To revert: set `endDate` back to Jul 31 and revert `getCurrentCycleId`/`getCycleDates`. **No `PointsLedger` entries were modified**, so all referral + completion points are intact regardless.
- **Code revert:** all changes are isolated to the files listed in "Files changed" below; reverting those commits restores prior behavior. The constant `FIRST_APPROVAL_BONUS.durationDays` (180) and the cycle month-maps are the behavioral switches.

## Verification Log
_(updated after each change)_
- _Static: all edited files lint-clean / `node --check` clean. On-device + a staging-DB dry-run of the E3 migration recommended before prod (it writes premium dates). E4 migration only extends a cycle's date window — no points touched._
- **Dry-run preview added:** set env `MIGRATION_DRY_RUN=true` and boot the backend → both startup migrations log exactly what they WOULD change (with sample provider/cycle date diffs) and **write nothing**. Safe to run against live data. Unset/`false` to apply for real. (`helpers/trialMigration.js`, `helpers/referralCycleMigration.js`, `server.js`.)
- **Single-provider test mode added:** set env `MIGRATION_PROVIDER_ID=<providerId>` → the trial migration extends ONLY that provider; the global referral-cycle migration is skipped while set. Combine with `MIGRATION_DRY_RUN=true` to preview that one provider first. Idempotent (re-anchors to exactly start+6mo), so redeploys never double-extend ("6+6" impossible). Remove the var to run for all providers.

## Final Status
All 5 enhancements implemented + admin visibility follow-ons. Static-verified (lint / `node --check` / admin build all clean). Backend + admin deployed; app (`renfi`) pending local test.

### Files changed — by repo (backtrack inventory)
**`noefix` (backend) — deployed:**
- `models/subscription.js` (E3: bonus 60→180)
- `controllers/documentVerificationController.js` (E3: push copy)
- `helpers/trialMigration.js` *(new)* (E3: idempotent capped trial migration + dry-run + single-provider)
- `models/pointsLedger.js`, `models/rewardCycle.js` (E4: 2-cycle scheme)
- `helpers/referralCycleMigration.js` *(new)* (E4: idempotent cycle-window migration + dry-run)
- `server.js` (E3+E4 startup migrations + env flags)
- `controllers/traditionalServiceController.js` (E5: available-categories endpoint)
- `routes/traditionalServiceRoutes.js` (E5: route)
- `utils/pushNotification.js` (E1: notificationSound channel selection)
- `controllers/referralController.js` (admin dashboard cycle info)

**`temp_admin` (admin panel) — deployed:**
- `src/pages/FixhomianDetail.jsx` (provider Premium/Subscription card)
- `src/pages/ReferralDashboard.jsx` (Current Cycle details card)

**`renfi` (app) — pending push/local test:**
- E1: `src/services/fcmService.js` (silent channel)
- E2: `navigation/RootNavigator.jsx`, `src/screens/ProviderHomeScreen.jsx`, `src/services/emergencyServicesService.js`, `src/screens/EmergencyServicesScreen.jsx`
- E5: `src/screens/UserHomeScreen.jsx`, `src/services/traditionalServiceService.js`
- (Prior bug-fix batch — see ISSUE_INVESTIGATION_REPORT.md): `App.tsx`, `src/context/LocationContext.jsx`, `src/components/LocationTrackingBanner.jsx`, `src/services/socketService.js`, `src/screens/{ProviderHomeScreen,RegisterScreen,ProviderRegisterScreen,OTPLoginScreen,OTPVerifyScreen,ForgotPasswordScreen,ChangePasswordScreen,UserAuthScreen,ProviderAuthScreen}.jsx`, `src/hooks/usePersistedAuthFlow.js` *(new)*
- Docs: `ENHANCEMENTS_REPORT.md`, `ISSUE_INVESTIGATION_REPORT.md`

### Known open items (not blockers)
- E1 toggle reach: silences only pushes that pass `userId`/`userType` (some token-only calls still sound by default).
- E2: providers land on the full emergency screen (numbers reachable); numbers-only `mode` param passed but not yet consumed.
- E4: external `fixhomi.com` legal text + in-repo `REFERRAL_REWARDS_SYSTEM.md` still say "4-month" — update later.
- E5 i18n: `userHome.comingSoon*` use English literal fallbacks; add hi/mr.
