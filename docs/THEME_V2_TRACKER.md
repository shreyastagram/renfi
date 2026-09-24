# Dark/Light Theme v2 — Tracker (SOURCE OF TRUTH)

**Branch:** `feature/theme-v2` (off tag **`v1.0.9`** = `b74f862`)
**Colour contract:** `docs/COLOUR_MAP.md`
**Also read:** `FIXORA_APP/WORK_AVAILABILITY_TRACKER.md` — Working Hours is live in prod and
its surfaces are in theming scope.
**Created:** 2026-09-24.

> Read this BEFORE touching code. If anything here contradicts the code, **STOP and flag it.**
> Do not proceed on a false premise.

---

## ▶ START HERE — current state

**Phases 0-2 DONE. Next action is Phase 3: re-confirm the verification mockup and redo the
home-screen mockup on the near-black ramp.**

No screen is themed yet. The only rendering changes so far are the ThemedStatusBar in
App.tsx and the two accessibility fixes below — the app is otherwise visually unchanged.

- Base is the `v1.0.9` tag, which is the first git point that matches what is live in both
  stores. The 1.0.9 build previously existed only as 3 uncommitted files.
- `npm run verify` exits 0 — and now includes the owner's 5 Working Hours suites.
- The previous attempt (`feature/verification-ui-darkmode`, 19 commits, paused 2026-07-31)
  is **superseded**. Its engine was ported; its analysis was discarded and redone.

## Status

- [x] **Phase 0** — Branch off `v1.0.9`; inventory of the old branch; this tracker
- [x] **Phase 1** — Theme engine ported + gates wired + fresh colour census
- [x] **Phase 2** — Mockup: **Working Hours** surfaces, light + dark — APPROVED on the
      near-black ramp. Two shipped a11y failures found and fixed while measuring.
- [x] **Phase 3** — Mockup: verification re-confirmed + home screen rebuilt on near-black
- [x] **Phase 4** — Dead-file removal (2,105 lines, 115 colours) + DRY audit
- [ ] **Phase 5** — Verification module + defects V1–V6 + Settings theme control
- [ ] **Phase 6** — Shared chrome + `<Screen>` primitive
- [ ] **Phase 7** — User screens + Mapbox theme following
- [ ] **Phase 8** — Provider screens incl. Working Hours
- [ ] **Phase 9** — Auth screens
- [ ] **Phase 10** — Full sweep + device checklist

## Gates — run before every commit

```
npm run verify
```

| Gate | Proves |
|---|---|
| `check:i18n` | en/hi/mr key-identical, **baseline 2067** |
| `check:hex` | no raw hex in files listed in `scripts/migrated-files.json` |
| `check:contrast` | 35 semantic pairs × 2 themes meet WCAG AA |
| `check:types` | `tsc --noEmit` — the only working check for `.tsx` |
| `test:unit` | 19 theme tests |
| `test:app` | **the owner's 86 Working Hours tests — never let these regress** |

Lint: compare per-file against the `v1.0.9` baseline, never absolute counts.

### ⚠️ Syntax-checking: the babel CLI only works on plain `.js`

Corrected 2026-09-25 after it was found to fail on **unmodified** v1.0.9 files:

| File type | Use | Do NOT use |
|---|---|---|
| `.js` | `npx babel --presets module:@react-native/babel-preset <f> -o /dev/null` | — |
| `.jsx` | **`npx eslint <f>`** — reports `Parsing error` on bad syntax (verified) | babel CLI: fails on pristine files |
| `.tsx` | **`npm run check:types`** | babel CLI: chokes on `(global as any)` |

Jest is **not** a substitute — a file with a syntax error still shows PASS if no
running test imports it. Verified both ways on 2026-09-25.

## Accessibility fixes shipped on this branch (2026-09-25)

Found while measuring the Working Hours surfaces. Both are defects in the **shipped 1.0.9
build**, not caused by theming, and both are on **live controls** so WCAG's exemption for
disabled elements does not apply.

| Control | Was | Now | File |
|---|---|---|---|
| ONLINE pad label + spinner | white on `#22C55E`, **2.28** | `#0F172A` on the same green, **7.83** | `ProviderHomeTopRow.jsx` |
| Day chip, off state | `#94A3B8` on `#F8FAFC`, **2.45** | `#5B6878`, **5.43** | `WeeklyScheduleCard.jsx` |

The brand green is unchanged — only what sits on it, which is the same rule the orange
fills follow. `#5B6878` is the value `textMuted` already uses; both become tokens in the
provider-screen phase. The owner's 86 tests still pass; they assert order and text, not
colour. Lint on the two files went 4 problems to 3.

## Phase 1 result (2026-09-24)

Ported from the old branch, conflict-free: `src/theme/` (9 files + 4 test suites),
`scripts/` (4 gates), `android/.../values-night/` (2), the agent spec.

Hand-applied to existing files:
- `App.tsx` — `ThemeProvider` between `SafeAreaProvider` and `LanguageProvider`;
  `StatusBar` → `<ThemedStatusBar />`. **+19/−1. The only rendering change so far.**
- `package.json` — scripts only, **zero dependency changes**.

**Deliberately NOT ported:**
- `jest.config.js` — v1.0.9 already has a **byte-identical** transform block (the other
  agent hit the same `.jsx` gap independently). Only the comment differed.
- The old spec/plan/phases docs — superseded; analysis redone from scratch.
- The dead-screen deletion — deferred to Phase 4 so non-use is re-verified on the new base.

Verified: i18n 2067×3 · hex clean · 35 contrast pairs · 19 + 86 tests pass ·
`App.tsx` lint **8 problems at v1.0.9 and 8 now** (unchanged) · 0 lint problems in new files.

## Census summary (full detail in COLOUR_MAP.md)

| | vs old base `5cfcd56` | **v1.0.9** |
|---|---|---|
| Occurrences | 3,080 | **3,329** |
| Distinct | 364 | **373** |
| Files | 77 | **88** |
| Multi-role | 64 | **65** |
| One-off | 175 | **179** |

Tiers: T1 verification+settings 468 · **T2 Working Hours 121 (new)** · T3 user 1,001 ·
T4 provider 551 · T5 auth 319 · T6 shared+rest 749 · dead files 120 (exclude).

## i18n budget — exactly 8 new keys, 2067 → 2075

- **7** Settings theme control: section title, 3 option labels (Light / Dark / System
  Default), 3 explanatory lines.
- **1** `profile.emailPending` = "Check inbox" — HI "इनबॉक्स देखें", MR "इनबॉक्स पाहा".

Everything else reuses existing keys. A missing key renders as `[missing …]`, so parity is
enforced at every commit. If a state genuinely needs new copy, **flag it — do not invent.**

## DRY audit (2026-09-25) — findings, and what was deliberately NOT merged

The single biggest duplication in this codebase is **46 files each defining their own
local `BRAND` / `COLORS` / `C` palette object**. Collapsing those onto one token source is
precisely what this project is doing, so it is not a separate task.

Two other candidates were examined and **both were left alone on purpose**:

| Candidate | Verdict |
|---|---|
| `formatServiceName` in ProfileScreen, ProviderHomeScreen, ProviderDetailsModal | **Do not merge blindly.** The three are NOT identical: ProfileScreen falls back through `SERVICE_CATEGORIES`, the other two do not; ProviderDetailsModal is null-safe (`service?.`) while the other two would throw on undefined. Merging changes behaviour at 2 of 3 call sites, so it belongs in its own reviewed change, not bundled into theming. |
| `getErrorMessage` in ProfileScreen and authService | **Not a duplicate at all.** Different functions sharing a name: authService maps an auth CODE to a user message; ProfileScreen stringifies an arbitrary error object. Merging them would be a real bug. Verified ProfileScreen does not import the other, so there is no shadowing. |

Principle applied: DRY only where the duplicated code is genuinely identical. Where copies
have diverged, consolidating them is a behaviour change and needs its own review.

## Decisions taken 2026-09-25

**Dark ramp = near-black neutral, hardened.** Sunken `#000000`, base `#0A0A0C`, surface
`#17171B`, elevated `#26262B`. ~5% saturation, replacing a slate-derived ramp that read
navy at 39%. Steps sized by 8-bit code-value gap (10/13/15) because contrast ratio is
meaningless this close to black and budget 6-bit LCD panels crush dark values together.
The 1px card border is the fallback that keeps cards visible if fills crush anyway —
which makes "border not shadow" a device-robustness rule, not only an aesthetic one.
Enforced by the dark device-safety audit in `check:contrast`.

**Two shipped a11y failures fixed** (done, not deferred — see below).

**Mapbox dark style = `StyleURL.TrafficNight`** (`navigation-preview-night-v4`), not
`dark-v10`. Fixhomi is a dispatch app: a customer watches a provider travel to their
address, so roads are the content, and `dark-v10` is a data-viz basemap that de-emphasises
exactly that. Light mode keeps `StyleURL.Street` unchanged. Implementation at all 6 map
sites is one derived value:

```js
styleURL={isDark ? Mapbox.StyleURL.TrafficNight : Mapbox.StyleURL.Street}
```

A manual Light/Dark override is respected for free since it derives from the resolved
theme. Caveat: changing `styleURL` at runtime forces a full style reload, so a mounted map
flickers on theme switch. Lands in Phase 7. **The Standard style's `lightPreset` day/night
is V11-only and this project is on Mapbox SDK v10 — not undertaken.**

## Design language (approved from the v1 mockups, still binding)

1. **Orange is a fill, never text or an icon on a light ground.** White on `#f67c16` is
   2.69:1; orange as text on white is also 2.69:1. Only works as a ground under dark text
   (`onBrandOrange` `#0F172A`, 6.64:1).
2. **One state, one colour, app-wide.** Green = done, amber = waiting, orange = act.
3. **Cards carry a 1px token border, not a heavy shadow** — shadows read as noise on dark.
4. **A resolved state removes chrome**, it does not add a success banner.
5. **Restraint** — roughly one orange and one blue per screen.
6. **Every pair meets AA in both themes**, proven by script.

Approved mockups (v1, verification surface + home density test) remain valid as design
references: the verification surface mockup is revision 2, with the progress bar removed.

## Defects to fix in Phase 5 — all RE-CONFIRMED present at v1.0.9

| ID | Defect | Location at v1.0.9 |
|---|---|---|
| V1 | No in-flight reentry guard; gates only on async state, so a double tap fires two OTP sends. `PhoneChangeModal` has an `inFlight` ref; ProfileScreen does not. | `ProfileScreen.jsx:996`, `:1026` |
| V2 | **Verified-flag downgrade** — `?? false` marks a verified user unverified on a partial response. | `AppContext.js:488-489` |
| V3 | Concurrent `refreshVerificationStatus` calls race `setIsProfileLoading` | `AppContext.js` |
| V4 | No cancellation — unmounted screen still writes state | all verification call sites |
| V5 | Email has no persistent pending state (`otpSent` is phone-only) | `ProfileScreen.jsx:2329`, `:2452` |
| V6 | Three presentations of the same two booleans; verified is blue in one, green in another | `ProfileScreen.jsx` |

**Already correct — do NOT "fix":** `otpPhoneRef`/`otpExpiryRef` handle wall-clock OTP expiry
and invalidate on phone change; `PhoneChangeModal` has a reentry guard, mirror-sync retry,
and mid-flow process-death resume.

Backend PR **noefix #36** (2026-09-14) changed token validation to jauth `/api/users/me` and
unblocked change-phone / account deletion. **Re-read it before touching `PhoneChangeModal`** —
it may already cover part of the planned Phase-4-era audit.

## Gotchas — do not rediscover

1. **The RN jest preset omits `.jsx`** from its transform. Already fixed at v1.0.9 by the
   other agent; do not re-add.
2. **The babel CLI parse-check does NOT work on `.tsx` OR `.jsx`** — it fails on
   `(global as any)` in an unmodified `App.tsx`, and on an unmodified
   `ProviderHomeTopRow.jsx` too. Only plain `.js` is checkable that way. Use eslint for
   `.jsx` and `npm run check:types` for `.tsx`. See the gates section.
3. **Node ESM needs explicit `.js` extensions** in `src/theme/tokens/` and `themes.js`; the
   gate scripts load them via `require(esm)`. Never add `"type": "module"` — it breaks RN.
4. **`npm test` is red at baseline** — `App.test.tsx` needs native mocks nobody built. Use
   `test:unit` + `test:app`.
5. **Unistyles v3 was evaluated and deferred** — still valid: RN is still 0.84.1, no dep
   changes, and `freezeOnBlur` is still set on both navigators, which is the code path in
   the unresolved release-only iOS crash (issue #1160). The `src/theme` interface keeps the
   swap open.
6. **Releases were cut directly from working branches**, so `main` is a year-stale artefact.
   `v1.0.9` is the only reliable reference point.

## Rules

- Never stage the owner's local files: `.vscode/settings.json`, `android/clean.log`.
- Do not commit `environment.js` / `build.gradle` / `project.pbxproj` unless asked.
- `USE_DEV_STAGING` must be **false** for store builds, **true** only for Firebase dev builds.
- Owner ships without local testing → **every UI change needs an HTML mockup (light + dark)
  approved before building.**
- Push only when the owner says.
- Providers run low-end Android — no per-render allocation, no new blur or gradients.
