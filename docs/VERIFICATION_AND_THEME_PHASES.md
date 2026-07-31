# Verification Rework + Dark/Light Theme — Phase Board & Session Handoff

**Branch:** `feature/verification-ui-darkmode` (off `feature/profile-redesign` @ `5cfcd56`)
**Spec:** `docs/superpowers/specs/2026-07-27-verification-ui-darkmode-design.md`
**Plan (phases 0–1):** `docs/superpowers/plans/2026-07-27-theme-foundation.md`
**Colour contract:** `docs/COLOUR_MAP.md`
**Last updated:** 2026-07-31 — **WORK PAUSED.**

> **Read this file BEFORE touching code.** If anything here contradicts the code, **STOP and
> flag it to the owner.** Do not proceed on a false premise. This repo has burned two prior
> sessions that way — see §9.

---

## ⏸ PAUSED — 2026-07-31

The owner stopped this workstream to switch to other branch work and will return later.
**This is a clean pause, not an abandonment.** Nothing is half-finished:

- All 17 commits are in. Working tree clean apart from the owner's own
  `.vscode/settings.json`, which is theirs and must never be committed.
- No stashes. `npm run verify` exits 0.
- **The app is visually unchanged**, so this branch being unmerged blocks nothing and
  breaks nothing. No screen consumes theme tokens yet.
- Safe to `git checkout` away right now.

### 🚩 This branch has NO UPSTREAM — it exists only on the owner's machine

`git log @{u}..HEAD` reports no upstream configured. 17 commits and roughly 3,500 lines of
work are local-only, so a forced checkout, a lost laptop, or a disk failure loses all of it.

**Recommended before leaving it for any length of time:**

```
git push -u origin feature/verification-ui-darkmode
```

The owner has not been asked to do this yet — raise it when they return, or do it if they
confirm.

### On resume, re-verify these FIRST — they drift while the branch sits

Do not trust the numbers in this document after other work has landed. Specifically:

| Recorded here | Why it drifts | How to re-check |
|---|---|---|
| i18n baseline **1959** keys, budget → 1967 | Any other branch adding copy changes the baseline, which makes the 8-key budget in §8 wrong | `npm run check:i18n` — it prints the live counts |
| Colour census **3,080 / 364 / 77 files** | Any screen work adds or removes colours, staling `docs/COLOUR_MAP.md` | Re-run the census described in COLOUR_MAP §5 |
| Defect line numbers in §13 (e.g. `ProfileScreen.jsx:964`) | Edits to those files shift every line | Re-locate by symbol name, not line number |
| Base is `feature/profile-redesign` @ `5cfcd56` | The base branch will very likely move | `git log --oneline feature/profile-redesign -1`, then rebase or merge before continuing |
| `npm run verify` exit 0 | A dependency bump or another branch's change can break a gate | Run it before writing any new code |

If the base branch has moved, **rebase or merge before doing anything else** — the theme
engine touches `App.tsx`, `package.json`, `jest.config.js` and `src/screens/index.js`, all
of which are plausible conflict sites.

### Where to pick up

§2 has the exact next action. In short: get the Mapbox decision (§3), build mockup 3, then
**write a Phase 3 plan before coding** — the committed plan only covers Phases 0–1.

---

## 0. TL;DR — where we are right now

**Phases 0 and 1 are DONE and committed. Phase 2 is 2 of 3 mockups approved.
Nothing is blocked except ONE owner decision (§3).**

- The theme engine exists, is tested, and is wired into `App.tsx`. **The app is visually
  unchanged** — no screen consumes tokens yet. That is deliberate.
- 16 commits on the branch. Working tree clean apart from the owner's own
  `.vscode/settings.json`, which is theirs and must not be committed.
- All gates green: `npm run verify` exits 0.
- **Nothing has been run on a device or simulator.** This environment cannot.

---

## 1. Status

- [x] **Phase 0** — Branch, phase board, harness agent spec
- [x] **Phase 1** — Theme engine, tokens, gates, dead-file deletion
- [~] **Phase 2** — HTML mockups ← **OWNER APPROVAL GATE, IN PROGRESS**
  - [x] Mockup 1 of 3 — verification surface — **APPROVED at revision 2**
  - [x] Mockup 2 of 3 — home screen density test — **DELIVERED, awaiting map decision**
  - [ ] Mockup 3 of 3 — token / component reference sheet
- [ ] **Phase 3** — Verification module: UI + state + defects V1–V6 + Settings theme control
- [ ] **Phase 4** — Backend read-only IDOR / race audit
- [ ] **Phase 5** — Shared chrome (547 hex)
- [ ] **Phase 6** — User screens + Mapbox theme following (918 hex)
- [ ] **Phase 7** — Auth screens (279 hex)
- [ ] **Phase 8** — Provider screens (513 hex)
- [ ] **Phase 9** — Full sweep + device checklist

### Mockup links (private artifacts)

| # | What | URL |
|---|---|---|
| 1 | Verification surface, light + dark, rev 2 | https://claude.ai/code/artifact/f5961c34-2e16-4418-9c08-7f9bac4ba605 |
| 2 | Home screen density test + Mapbox candidates | https://claude.ai/code/artifact/6c393bd8-9fb4-46d7-ad6f-496a335bd502 |

---

## 2. Resume here — the exact next action

0. **Run the drift checks in the PAUSED section above** before anything else, and rebase
   onto `feature/profile-redesign` if it has moved.
1. **Get the owner's Mapbox pick (§3).** That is the only open blocker.
2. Build **mockup 3** — token / component reference sheet (all swatches, all component
   states, both themes).
3. Then start **Phase 3**. It needs its own plan written first via the writing-plans skill;
   the phases 0–1 plan does not cover it. **Do not start coding the verification module
   straight from the spec** — this is the easiest step to skip and the most costly.

---

## 3. 🚩 OPEN DECISION — owner input needed

**Which Mapbox style for dark mode?** All 6 map call sites currently hardcode
`Mapbox.StyleURL.Street`. Light mode keeps Streets either way.

The ideal option is **unavailable**: the Standard style's `lightPreset: day|night` needs
Mapbox SDK **v11**, and this project resolves **v10** (`ios/Podfile.lock` pins
`MapboxMaps (10.19.5)`; Android takes the `10.19.0` default). Reaching v11 is a native
major upgrade on both platforms — the same class of unverifiable-native risk that deferred
Unistyles. Not undertaken.

| Option | Character | Note |
|---|---|---|
| A — `StyleURL.Dark` (`dark-v10`) | Monochrome data-viz basemap | De-emphasises roads; neutral grey clashes with the blue-tinted `#0B1220` surface |
| **B — `StyleURL.TrafficNight` (`navigation-preview-night-v4`)** | Dark **street** map | **RECOMMENDED.** Fixhomi is a dispatch app — roads are the content. Cool cast matches the slate palette and stays closer to the Streets style light mode keeps |

A manual Light/Dark override is respected automatically either way, because the style
derives from the resolved theme via `useTheme()`.

**Caveat to remember:** changing `styleURL` at runtime forces a full Mapbox style reload.
Only happens on a theme switch, which is rare, but maps mounted at that moment will flicker.

---

## 4. Owner decisions already made (binding)

| Date | Decision | Why it matters |
|---|---|---|
| 07-27 | **Redesign verification first**, then theme everything | Both workstreams, not just theming |
| 07-27 | Security = **app-side fixes + read-only backend audit** | No backend commits on this branch |
| 07-27 | Harness = **an agent/skill spec**, not a test harness | Must read this MD first and **flag, not comply** |
| 07-27 | Theme engine = **pure JS now, Unistyles later** behind a swappable interface | See §9.5 for why |
| 07-27 | **One branch**, phases as separate commits | Each commit shippable |
| 07-27 | Neutrals: **model both ramps, unify only in dark** | Light mode stays pixel-identical |
| 07-27 | Non-brand blues: **keep as distinct tokens** | Brand-consistency debt, deliberate later pass |
| 07-27 | Purple: **give it a token, keep it scoped** | "Maintain brand colours but not everywhere" |
| 07-27 | **No progress count, no progress bar** on the verification card | New UI concept — forbidden by the brief |
| 07-27 | **Dedicated i18n key** for the email pending state | Do not borrow an unrelated key to keep the count at zero |
| 07-27 | **WCAG AA required in BOTH themes** | Enforced by `npm run check:contrast` |
| 07-27 | **This design language carries to the whole app** | Phases 5–8 inherit the §7 rules |

---

## 5. Gates — how to verify anything

```
npm run verify     # runs all of: check:i18n, check:hex, check:contrast, check:types, test:unit
```

| Gate | What it proves |
|---|---|
| `npm run check:i18n` | en/hi/mr key-identical + identical `%{var}` per key |
| `npm run check:hex` | no raw hex in any file listed in `scripts/migrated-files.json` |
| `npm run check:contrast` | all 35 semantic pairs × 2 themes meet WCAG AA |
| `npm run check:types` | `tsc --noEmit` — **the ONLY working check for .tsx** |
| `npm run test:unit` | 19 pure-JS unit tests, 4 suites |

Plus, for `.js`/`.jsx` only:
`npx babel --presets module:@react-native/babel-preset <file> -o /dev/null`

**Lint against a baseline, never absolute counts.** Baseline is ~1500 problems. Comparing
via `git stash` is useless once work is committed (it lints the same tree twice) — instead
lint the specific files you changed and confirm they add zero.

---

## 6. What exists now (Phase 1 output)

```
src/theme/
  tokens/palette.js       ONLY file allowed to contain hex literals
  tokens/semantic.js      lightColors + darkColors, identical key sets
  tokens/spacing.js       spacing, radii, makeElevation(shadowColor)
  themes.js               lightTheme / darkTheme / themes
  resolveThemeName.js     PURE — mode resolution, no React, no native
  createStyleCache.js     PURE — per-theme memo
  ThemeContext.jsx        provider, persistence, Appearance listener
  useThemedStyles.js      the hook screens call
  index.js                public surface — screens import ONLY from here
scripts/
  check-contrast.js  check-hex.js  check-i18n-parity.js  migrated-files.json
```

`ThemeProvider` is mounted in `App.tsx` between `SafeAreaProvider` and `LanguageProvider`.
`StatusBar` is now `<ThemedStatusBar />` and follows the theme.
`android/app/src/main/res/values-night/` adds the night launch background (`#0B1220`,
must stay in sync with `darkColors.bg`).

**Usage pattern for later phases:**

```js
import { useThemedStyles, useThemeColors } from '../theme';

// MUST be module scope, never inline in the component
const makeStyles = (theme) => StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
});

const MyScreen = () => {
  const styles = useThemedStyles(makeStyles);
  const c = useThemeColors();   // for inline JSX props like icon color
};
```

---

## 7. The design language Phases 5–8 must follow

Established by mockups 1 and 2, approved by the owner:

1. **Orange is a fill, never text or an icon on a light ground.** White on `#f67c16` is
   2.69:1; orange as text on white is also 2.69:1. It works only as a ground under dark
   text (`onBrandOrange` = `#0F172A`, 6.64:1).
2. **One state, one colour, app-wide.** Green = done, amber = waiting, orange = act.
   Never two colours for one state. (The current blue-pill / green-badge split for
   "verified" is the defect being removed.)
3. **Cards carry a 1px token border, not a heavy shadow.** Shadows read as noise on dark.
4. **A resolved state removes chrome**, it does not add a success banner.
5. **Restraint:** roughly one orange and one blue per screen. On Home: Send request, and
   the active tab.
6. **Every pair meets AA in both themes**, proven by script not by eye.

---

## 8. i18n budget — EXACTLY 8 new keys

Baseline **1959** per locale → **1967**. Nothing else may be added.

- **7** for the Settings theme control (Phase 3): section title, 3 option labels
  (Light / Dark / System Default), 3 explanatory lines.
- **1** `profile.emailPending` = "Check inbox" — the email waiting state.
  HI "इनबॉक्स देखें", MR "इनबॉक्स पाहा".

Every other string on the verification surface reuses an existing key — verified against
`en.js`: `profile.verification`, `profile.phoneLabel`, `profile.emailLabel`,
`profile.verifyBtn`, `profile.verifiedLabel`, `profile.verifyWarning`, `profile.enterOtp`,
`profile.otpTimer`, `profile.resendOtp`, `verificationScreen.emailSent`.

If a phase finds a state that genuinely cannot use an existing key, **flag it — do not
invent copy.**

---

## 9. Gotchas discovered this session — do not rediscover these

### 9.1 The RN jest preset does NOT transform `.jsx`
Its pattern is `'^.+\\.(js|ts|tsx)$'` — `jsx` is omitted. This codebase is overwhelmingly
`.jsx`, so this had blocked **all** component testing. Fixed by a `transform` override in
`jest.config.js`. Do not revert it.

### 9.2 The babel CLI parse-check does NOT work on `.tsx`
It fails on plain TypeScript syntax like `(global as any)` — **even on an unmodified
`App.tsx`**. So `.tsx` changes were going effectively unchecked. Use `npm run check:types`.

### 9.3 Node ESM needs explicit `.js` extensions
The gate scripts load theme modules via `require(esm)` (Node ≥ 22.12; owner is on v25.8.1).
Node's ESM resolver rejects extensionless specifiers, so **every import inside
`src/theme/tokens/` and `src/theme/themes.js` must carry `.js`**. Metro accepts both.
Do NOT add `"type": "module"` to package.json — it breaks the RN CommonJS tooling.

### 9.4 `npm test` is RED at baseline
`__tests__/App.test.tsx` fails on ESM and then on missing native mocks. Repairing it means
building the native-mock render harness the owner **declined**. Use `npm run test:unit`.

### 9.5 Unistyles v3 was evaluated and deliberately deferred
It IS compatible (its example runs RN 0.85.3; Reanimated is an *optional* peer). Deferred
because of [issue #1160](https://github.com/jpudysz/react-native-unistyles/issues/1160):
release-only iOS SIGABRT on **RN 0.84.1 with adaptive themes**, in the **suspended-nodes**
path this app exercises via `freezeOnBlur: true` on both tab navigators. Closed for lack of
a repro, **never confirmed fixed**. The owner ships without device testing, so that risk
profile is unacceptable. The `src/theme` interface keeps the swap available later.

### 9.6 Two dead screens were deleted
`HomeScreen.jsx` (740 lines) and `DocumentVerificationScreen.jsx` (1,365) were exported
from the screens barrel but never routed. Because `RootNavigator` imports from that barrel
and **Metro does not tree-shake barrel re-exports**, both were being compiled into the
production bundle. The `DocumentVerification` **route** stays live and resolves to
`ServiceApprovalsScreen`.

### 9.7 Stale comment in `UserHomeScreen.jsx`
The comment above `SERVICE_CATEGORIES` reads "Unified neutral palette (no rainbow)" while
`SERVICE_COLORS` directly beneath it is a twelve-hue rainbow. **The comment is stale, not
the code.** Left alone deliberately — flag, don't silently fix.

### 9.8 The original brief had five factual errors
`docs/UI_VERIFICATION_AND_THEME_BRIEF.md` is superseded. Corrections in spec §3.1.

---

## 10. Colour census results (see `docs/COLOUR_MAP.md` for the full contract)

3,080 occurrences, 364 distinct colours, 77 files.

- **64 of 364 colours are multi-role** — same hex as foreground AND surface AND border.
  `#ffffff` is foreground 164×, surface 100×, border 11×. **A blind codemod would corrupt
  every one of these.** Migration is per-site semantic judgement.
- **175 colours appear exactly once** — long tail, decide per site and record the decision.
- Two neutral ramps: slate (669) and gray (321), 13 files mix both.
- **The 12 service-category accents need NO changes** — all clear 3:1 on dark. Six of them
  sit below 3:1 on *white* today (Solar 1.92, Electrician 2.15, AC 2.43, Driver 2.49,
  Salon 2.65, Vehicle Clean 2.77). Not a WCAG failure — each icon sits above a text label
  so it is supplementary — but dark mode renders them *better* than light does.

Still needing per-site decisions before Phase 5:
- **Translucent scrims** (~50 `rgba(255,255,255,0.08–0.7)`) need `overlayOnDark` /
  `overlayOnLight` tokens whose base and alpha flip with the theme — **not** a colour map.
- **`#4285F4` Google brand blue** — recorded under `palette.vendor`, **never themed**.
  Theming it breaks sign-in brand compliance. Audit for an Apple equivalent too.

---

## 11. What is NOT done / NOT verified

- **No screen consumes tokens yet.** Not one. The app looks exactly as before.
- **No Settings theme control yet** — that is Phase 3.
- **Zero device or simulator testing.** Everything is static analysis, unit tests, and
  contrast math.
- **`npm test` still red** (§9.4).
- **No backend work at all** — Phase 4 is a read-only audit producing findings in §12.
- The 8 new i18n keys are **not yet added**.

---

## 12. Phase 4 backend audit findings

Not yet run. When it runs, record findings here with severity. **No backend commits on this
branch.** Targets:
- `GET /api/provider/:providerId/verification-dashboard` and
  `POST /api/provider/:providerId/sync-verification` take a client-supplied ID in the path
  (`src/services/verificationService.js:43`, `:104`). Confirm JWT subject == `providerId`.
- `syncPhoneToMongoDB` sends client-supplied `mongoId`, `userType` **and `phoneNumber`**
  (`components/PhoneChangeModal.jsx:208-213`). The comment claims the server re-reads truth
  from Java — verify that.
- OTP send/verify: per-account rate limiting, replay of a consumed OTP.
- Cross-check `noefi/fixhomi-backend/SECURITY_REVIEW_2026-07.md` so already-fixed items
  (`34360b8`, `173442e`, `89ee926`) are not re-reported.

Unrelated but still open from the previous session: **rotate `JWT_SECRET`**
(`SESSION_HANDOFF_2026-07-20.md` §3). Owner action, not code.

---

## 13. App-side verification defects to fix in Phase 3

| ID | Defect | Location |
|---|---|---|
| V1 | No in-flight reentry guard — gates only on `disabled={verifyingPhone}`, which is async state. A double tap fires two OTP requests. `PhoneChangeModal` solved this with an `inFlight` ref; ProfileScreen never did. | `ProfileScreen.jsx:964`, `:994` |
| V2 | **Verified-flag downgrade.** `isEmailVerified: data.isEmailVerified ?? false` — a partial response silently marks a verified user unverified. Same class as the Aadhaar `\|\| true` fixed in `3a3cec3`. | `AppContext.js` `refreshVerificationStatus` |
| V3 | Concurrent `refreshVerificationStatus` calls race `setIsProfileLoading` | `AppContext.js` |
| V4 | No cancellation — unmounted screen still writes state | all verification call sites |
| V5 | Email has no persistent pending state (`otpSent` is phone-only) | `ProfileScreen.jsx:2290-2297` |
| V6 | Three presentations of the same two booleans, verified blue in one and green in the other | `ProfileScreen.jsx` |

**Already correct — do NOT "fix":** `otpPhoneRef`/`otpExpiryRef` handle wall-clock OTP
expiry and invalidate on phone change (`ProfileScreen.jsx:433-460`); `PhoneChangeModal` has
a reentry guard, mirror-sync retry, and mid-flow process-death resume.

---

## 14. Commit log for this branch

```
b7aa2a8 docs(phase2): record owner decisions from the mockup 1 approval
e1bb5ba feat(theme): add scoped violet accent and vendor colour tokens
ef4a1bd feat(theme): extend tokens from a full colour census
11392bf docs(phase1): mark theme foundation complete
dbbf51e chore(cleanup): delete unreachable HomeScreen and DocumentVerificationScreen
04203a0 feat(theme): add night launch background for Android dark mode
3404403 feat(theme): mount ThemeProvider and make StatusBar theme-driven
53ae900 feat(gates): add hex lint, i18n parity, and verify script
c707f04 feat(theme): add useThemedStyles with per-theme style caching
29785f3 feat(theme): add ThemeContext with system, light and dark modes
0004c02 feat(theme): add WCAG contrast validator over all token pairs
6170882 feat(theme): add design tokens for light and dark themes
650279a docs(phase0): add phase board and frontend harness agent spec
1884aa4 docs(plan): add theme foundation implementation plan for phases 0-1
77f3672 docs(spec): resolve Mapbox theming and dead-code open items
5420bf2 docs(spec): verification rework + dark/light theme design
```

---

## 15. Repo conventions that still apply

- Commit `-m` bodies: **no backticks**.
- **Never commit the owner's own uncommitted files** — currently `.vscode/settings.json`.
- Every `elevation` needs a matching iOS `shadow*`.
- Providers run older, low-RAM Android — keep effects light, no per-render allocation, no
  new blur or gradients.
- `targetSdk 36` → edge-to-edge is enforced. 18 `<SafeAreaView>` usages, only 3 declare
  `edges`. Phase 5 standardises these onto one `<Screen>` primitive.
- Deploy state and other open items: `SESSION_HANDOFF_2026-07-20.md`.
