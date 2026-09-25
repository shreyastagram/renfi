# Dark/Light Theme v2 — TRACKER (SOURCE OF TRUTH)

**Branch:** `feature/theme-v2` (off tag **`v1.0.9`** = `b74f862`)
**Colour contract:** `docs/COLOUR_MAP.md`
**Also read:** `FIXORA_APP/WORK_AVAILABILITY_TRACKER.md` — Working Hours is live in prod.
**Last updated:** 2026-09-25, after batch 6b-4 — shared chrome complete.

> **Read this file BEFORE touching code.** If it contradicts the code, **STOP and flag it** —
> do not proceed on a false premise.
>
> **UPDATE THIS FILE AFTER EVERY COMMIT**, not at phase boundaries. It drifted four commits
> behind once already; that is the exact failure this file exists to prevent.

---

## ▶ 1. WHERE WE ARE RIGHT NOW

**Phases 0–5a, 6a and ALL of 6b done. Shared chrome is complete.**

- The theme engine is live and **11 components consume it**. The Appearance control ships.
- Switching to Dark currently changes: the status bar, dialogs, alerts, inputs, icons,
  skeleton loaders, the notification banner, the drawer menu, and the tab-bar pill on
  low-end devices. **Screens themselves are not themed yet.**
- `npm run verify` exits 0. Working tree clean apart from the owner's `.vscode/settings.json`
  and `android/clean.log`.
- **Nothing is device-verified.** This environment cannot run the app.

### Next action

**Phase 7 — user screens.** This is where the app visibly goes dark. Start with the
smaller surfaces before `UserHomeScreen` (146 colours, a map, and the tab bar over it).
Swap `SafeAreaView` → `<Screen>` in each file as it is themed.

---

## 2. PHASE BOARD

Tick sub-items as they land. Add or remove items freely — this is a working plan, not a
contract.

- [x] **Phase 0** — Branch off `v1.0.9`, inventory the old branch, write this tracker
- [x] **Phase 1** — Theme engine ported, gates wired, fresh colour census
- [x] **Phase 2** — Working Hours mockup, light + dark → approved
- [x] **Phase 3** — Verification mockup re-confirmed, home mockup rebuilt on near-black
- [x] **Phase 4** — Dead-file removal (2,105 lines) + DRY audit
- [x] **Phase 5a** — Settings Appearance control (Light / Dark / System), 7 i18n keys
- [ ] **Phase 5b** — Verification module + defects V1–V6 + `profile.emailPending`
- [x] **Phase 6a** — Pilot: `CustomDialog` (proved the `useThemedStyles` pattern)
- [ ] **Phase 6b** — Rest of shared chrome
  - [x] batch 1 — `Button`, `Alert`, `ShimmerLoader` (zero security exposure)
  - [x] batch 2 — `Input`, `Icon`, `GlobalBanner` (+ category-map dedupe)
  - [x] batch 3 — `DrawerMenu` (full), `RootNavigator` (surgical — see §15)
  - [x] batch 4 — `<Screen>` primitive built + piloted on `EmailVerifyHandlerScreen`.
        **17 SafeAreaView sites still to swap** — they land with their own phases
        (auth screens in 9, verification in 5b), not as a big-bang change.
- [ ] **Phase 7** — User screens + Mapbox theme following (`TrafficNight`)
- [ ] **Phase 8** — Provider screens incl. Working Hours (5 files, 126 colours)
- [ ] **Phase 9** — Auth screens
- [ ] **Phase 10** — Full sweep + device-test checklist

---

## 3. MIGRATION PROGRESS

| Measure | Value |
|---|---|
| Colour literals remaining | **~3,150** (was 3,329 at v1.0.9) |
| Files on the hex allowlist | **19** |
| Components fully themed | **8** — CustomDialog, Button, Alert, ShimmerLoader, Input, Icon, GlobalBanner, DrawerMenu (+ RootNavigator surgically) |
| Theme unit tests | 23 across 5 suites |
| Owner's Working Hours tests | 86 — **must never regress** |
| i18n | **2074** × en/hi/mr (2067 baseline + 7 theme keys) |

**Honest split:** by "can a user see the app go dark" ≈ **10%**. By total project effort
≈ **45%** — architecture, palette, design language, census and gates are done, and the
pattern is proven. The remaining literals are mechanical.

### Remaining by area

| Area | Colours | Phase |
|---|---|---|
| Everything else (screens) | ~2,400 | 7–9 |
| Verification surfaces | 395 | 5b |
| Working Hours | 126 | 8 |
| Settings screen | 47 | 6b/7 |
| `RootNavigator` (adaptive-tone values, intentionally literal) | ~24 | n/a — see §15 |

---

## 4. GATES — run before EVERY commit

```
npm run verify
```

| Gate | Proves |
|---|---|
| `check:i18n` | en/hi/mr key-identical, **baseline 2074** |
| `check:hex` | no raw colour literal in any allowlisted file (comments excluded) |
| `check:contrast` | 35 semantic pairs × 2 themes meet WCAG AA |
| `check:contrast` | dark device-safety: surface steps + border separation |
| `check:types` | `tsc --noEmit` |
| `test:unit` | 21 theme tests |
| `check:light` | **every migrated file still resolves its ORIGINAL light-mode colours**, or the change is declared with a reason |
| `test:app` | the owner's 86 Working Hours tests |

**Plus, per file touched:** lint against the v1.0.9 baseline for that *specific* file.
Never a global count. This caught a real crash-on-render regression in `Input`.

### Syntax checking — the babel CLI only works on plain `.js`

| File type | Use | Do NOT use |
|---|---|---|
| `.js` | `npx babel --presets module:@react-native/babel-preset <f> -o /dev/null` | — |
| `.jsx` | **`npx eslint <f>`** — reports `Parsing error` | babel CLI: fails on pristine files |
| `.tsx` | **`npm run check:types`** | babel CLI: chokes on `(global as any)` |

Jest is **not** a substitute — a file with a syntax error still shows PASS if no running
test imports it.

---

## 5. DECISIONS LOG

Including the ones that were reversed. If something stops making sense, change it and add
a row here.

| Date | Decision | Status |
|---|---|---|
| 07-27 | Redesign verification first, then theme everything | active |
| 07-27 | Security = app-side fixes + read-only backend audit | active |
| 07-27 | Harness = an agent spec that flags rather than complies | active |
| 07-27 | Theme engine pure JS; Unistyles deferred (issue #1160) | active |
| 07-27 | Neutrals: model both ramps, unify only in dark | active |
| 07-27 | Non-brand blues kept distinct (light unchanged) | active |
| 07-27 | Violet gets a token but stays scoped | active |
| 07-27 | No progress bar on the verification card | active |
| 07-27 | Dedicated i18n key for the email pending state | active |
| 09-24 | Restart from `v1.0.9`, discard the old analysis | active |
| 09-24 | Do NOT port `jest.config.js` — v1.0.9 already identical | active |
| **09-25** | **Dark ramp REVERSED: slate-tinted → near-black neutral** | **supersedes 07-27** |
| 09-25 | Dark surface steps sized by code-value gap, not contrast ratio | active |
| 09-25 | Mapbox dark = `TrafficNight`, not `dark-v10` | active |
| 09-25 | Fix shipped a11y failures as found, not deferred | active |
| 09-25 | Apple system colours preserved as a documented AA exception | active |
| 09-25 | Category/icon accents are THEME-INDEPENDENT | active |
| 09-25 | Permanently-dark surfaces use `stableDark`, never flipping tokens | active |
| 09-25 | Alert's parallel palette converged onto the semantic tokens | active |

### Changed our mind — and why

- **The dark ramp.** Originally derived from the light theme's slate palette. The owner saw
  it read as navy; measured at 39% saturation with blue 22 points above red. Replaced with a
  near-black neutral at ~5%. **Lesson: I presented an aesthetic choice as a default. Always
  say which parts are choices.**
- **Raw near-black was worse than the old ramp on cheap panels** (surface→elevated 1.10 vs
  1.21). Fixed by sizing steps on code-value gap and leaning on the card border.
- **The hex linter flagged its own comments.** Fixed the linter, not the comments.
- **No gate verified light-mode fidelity.** Every check passed even if a colour was mapped
  to the WRONG token — hex lint only wants no literal, contrast only checks token pairs,
  tests and lint never look at values. Added `check:light`, which immediately found a
  **shipped regression**: `DrawerMenu` used `dangerBorder` for a visible hairline, but that
  token is `transparent` in light mode, so the logout item's red border had disappeared.
  Fixed with new `dangerLine` / `dangerFill` tokens. **Lesson: a gate that cannot fail is
  not a gate — prove each one fails before trusting it.**

---

## 6. SECURITY DISCIPLINE (owner instruction, 2026-09-25)

**Theming must not touch security logic.** Method, applied per batch:

1. **Rank files by exposure first:**
   `grep -cE "token|auth|logout|isAuthenticated|password|secret|Keychain|credential|userType"`
2. Migrate lowest-exposure first so the pattern is proven before the risky files.
3. **Audit the diff afterwards** — filter out colour/style lines and confirm nothing
   remains. Anything left must be an object-literal → factory conversion, nothing else.

Exposure ranking for the chrome:

| File | Security-ish lines | What they actually are | Status |
|---|---|---|---|
| Button, Alert, ShimmerLoader | 0 | — | ✅ done |
| Icon | 1 | a `logout` icon **name** in a map | ✅ done |
| GlobalBanner | 2 | reads `userType` to branch display | ✅ done |
| Input | 3 | password **visibility** toggle (UI only) | ✅ done |
| DrawerMenu | 12 | contains logout | ✅ done — logout wiring provably untouched |
| RootNavigator | 15 | auth-state branching | ✅ surgical — auth/deep-links provably untouched |

---

## 7. TOKEN ARCHITECTURE

`src/theme/tokens/palette.js` is the only file allowed colour literals. Groups:

| Group | Flips with theme? | Purpose |
|---|---|---|
| `brand` | orange no, blue yes | Fixhomi identity. Orange is a **fill only**. |
| `slate` / `gray` | n/a (light source) | Two neutral ramps; unify in dark |
| `dark` | n/a (dark source) | Near-black ramp, device-hardened |
| `semanticLight` / `semanticDark` | yes | success / warning / danger / info |
| `semanticDarkBorder` | dark only | status chips need a border on near-black |
| `violet` | yes | categorical accent, scoped |
| `altBlue` | yes | non-brand blues, preserved |
| `iosSystem` | yes | Apple HIG light + dark |
| `categoryAccent` | **NO** | identifies a trade — must stay recognisable |
| `iconAccent` | **NO** | icon-map fallbacks (identity/status) |
| `stableDark` | **NO** | surfaces that are dark in BOTH themes |
| `vendor` | **NO** | Google brand blue — never themed |

**The `stableDark` rule matters most.** A flipping token on a permanently dark surface goes
invisible in light mode. The Fixhomi website hit this exact bug. `GlobalBanner` is the first
in-app case; there will be more (dark heroes).

### Usage

```js
import { useThemedStyles, useThemeColors } from '../theme';

const makeStyles = (theme) => StyleSheet.create({   // MUST be module scope
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
});

const MyScreen = () => {
  const styles = useThemedStyles(makeStyles);
  const c = useThemeColors();  // for inline JSX props like icon color
};
```

---

## 8. DESIGN LANGUAGE (approved, binding)

1. **Orange is a fill, never text or an icon on a light ground.** White on `#f67c16` is
   2.69:1; orange as text on white is also 2.69:1. Only works under dark text
   (`onBrandOrange`, 6.64:1).
2. **One state, one colour, app-wide.** Green done, amber waiting, orange act.
3. **Cards carry a 1px token border, not a heavy shadow** — also a device-robustness rule.
4. **A resolved state removes chrome**, it does not add a success banner.
5. **Restraint** — roughly one orange and one blue per screen.
6. **Every pair meets AA in both themes**, proven by script.

---

## 9. ACCESSIBILITY FIXES SHIPPED

All were defects in the **shipped 1.0.9 build**, all on **live controls** (so no WCAG
disabled-element exemption), all the same root cause: a mid-saturation fill carrying white.

| Control | Was | Now | File |
|---|---|---|---|
| ONLINE pad + spinner | 2.28 | 7.83 | `ProviderHomeTopRow` |
| Day chip, off state | 2.45 | 5.43 | `WeeklyScheduleCard` |
| Dialog primary button | 2.69 | 6.64 | `CustomDialog` |
| Alert success badge | 3.30 | 5.42 | `Alert` |
| Alert warning badge | 3.19 | 5.60 | `Alert` |

### Still awaiting an owner decision

| Control | Ratio | Where |
|---|---|---|
| Provider rating "4.8" as orange **text** | **2.69** | `UserHomeScreen` — every provider card |
| Help & support icon (lone orange glyph) | **2.69** | `HelpSupportButton` |

Both shown in the Phase 3 mockup. Fixes proposed: rating in body ink, help icon as an
orange fill. Light-mode changes, so the owner's call.

---

## 10. i18n BUDGET

Baseline 2067 → **2074 now** → 2075 when 5b lands.

- [x] 7 keys — `settings.theme*` (Appearance control)
- [ ] 1 key — `profile.emailPending` = "Check inbox" (HI इनबॉक्स देखें, MR इनबॉक्स पाहा)

Nothing else. A missing key renders `[missing …]`, so parity is gated every commit. If a
state genuinely needs new copy, **flag it — do not invent.**

---

## 11. PHASE 5b — verification defects, all RE-CONFIRMED at v1.0.9

| ID | Defect | Location |
|---|---|---|
| V1 | No in-flight reentry guard; double tap fires two OTP sends | `ProfileScreen.jsx:996`, `:1026` |
| V2 | **`?? false` downgrades a verified flag** on a partial response | `AppContext.js:488-489` |
| V3 | Concurrent `refreshVerificationStatus` race `setIsProfileLoading` | `AppContext.js` |
| V4 | No cancellation — unmounted screen still writes state | all call sites |
| V5 | Email has no persistent pending state | `ProfileScreen.jsx:2329`, `:2452` |
| V6 | Three presentations of the same two booleans | `ProfileScreen.jsx` |

**Already correct — do NOT "fix":** `otpPhoneRef`/`otpExpiryRef` handle wall-clock OTP
expiry; `PhoneChangeModal` has a reentry guard, mirror-sync retry and process-death resume.

**Read backend PR noefix #36 first** (2026-09-14, token validation moved to jauth
`/api/users/me`) — it may already cover part of the planned audit.

---

## 12. GOTCHAS — do not rediscover

1. **The RN jest preset omits `.jsx`** from its transform. Already fixed at v1.0.9 by
   another agent; do not re-add.
2. **The babel CLI parse-check fails on `.tsx` AND `.jsx`** even on pristine files. See §4.
3. **Node ESM needs explicit `.js` extensions** in `src/theme/tokens/` and `themes.js`.
   Never add `"type": "module"` — it breaks RN.
4. **`npm test` is red at baseline** (`App.test.tsx` needs native mocks). Use
   `test:unit` + `test:app`.
5. **Unistyles v3 deferred** — still valid: RN 0.84.1, no dep changes, `freezeOnBlur` still
   set on both navigators, which is the unresolved crash path in issue #1160.
6. **Releases were cut from working branches**; `main` is a year-stale artefact. `v1.0.9` is
   the only reliable reference.
7. **Contrast ratio is meaningless near black** — it compresses toward 1.0. Judge dark
   surface separation by 8-bit code-value gap instead.
8. **`formatServiceName` ×3 have DIVERGED** — do not merge. `getErrorMessage` ×2 are
   different functions sharing a name — do not merge.

---

## 13. RULES

- Never stage the owner's files: `.vscode/settings.json`, `android/clean.log`.
- Do not commit `environment.js` / `build.gradle` / `project.pbxproj` unless asked.
- `USE_DEV_STAGING` **false** for store builds, **true** only for Firebase dev builds.
- Owner ships without local testing → **every UI change needs an HTML mockup (light + dark)
  approved before building.**
- Push only when the owner says.
- Providers run low-end Android — no per-render allocation, no new blur or gradients.
- Commit `-m` bodies: no backticks.

## 16. `<Screen>` — the safe-area primitive

`src/components/Screen.jsx`. Themed background + explicit `edges`, because targetSdk 36
enforces edge-to-edge and at v1.0.9 only 4 of 18 `SafeAreaView` usages declared `edges`.

**`edges` defaults to all four on purpose** — that is what `SafeAreaView` itself does when
the prop is omitted, so swapping it in is behaviour-neutral. Narrowing insets must be an
explicit choice at the call site, never something the primitive does to 14 screens
silently. Guarded by `screenEdges.test.js`.

`ALL_EDGES` lives in its own dependency-free module (`screenEdges.js`) because `Screen`
reaches AsyncStorage through the theme context, so importing it in a test needs native
mocks. Third time this pattern was needed — see also `resolveThemeName` and
`createStyleCache`.

**17 call sites still to swap.** They land with their own phases rather than as a big-bang
change: auth screens in Phase 9, verification surfaces in 5b.

## 15. RootNavigator — deliberately only PARTIALLY migrated

The floating tab bar carries **two independent light/dark systems** and they must not be
conflated:

1. **Scroll-adaptive tone** (`tabBarTone.js`) — the bar crossfades to a dark material when a
   dark surface slides under it. **Left completely alone.** In app-dark mode the content
   beneath the bar is dark, so this system already picks the dark tone by itself. Touching
   it would break scroll behaviour, and it is a module-level singleton precisely to avoid
   re-rendering the navigator on every scroll tick.
2. **App theme** — only ONE value here actually needed it: `glass.fallback`, used solely
   when `SUPPORTS_BLUR` is false, i.e. **low-end Android**. Without the fix a provider on a
   cheap phone in dark mode would have seen a LIGHT pill floating on a dark screen.

Everything else in that file (`tint`, `lensBg`, `lensBorder`, `DARK_*`) belongs to system 1
and is intentionally still literal. **Do not "finish" this file without re-reading the
above** — RootNavigator is therefore NOT on the hex allowlist, on purpose.

## 14. MOCKUPS (approved)

| What | URL |
|---|---|
| Verification surface (rev 2) | https://claude.ai/code/artifact/f5961c34-2e16-4418-9c08-7f9bac4ba605 |
| Working Hours, light + dark | https://claude.ai/code/artifact/4c095340-50d6-4cf7-be3d-3aeb083cbab1 |
| Home + verification, near-black | https://claude.ai/code/artifact/98258b2b-958d-4a9f-b55e-2a8b1b76ecfb |
| Dark ramp options (decision record) | https://claude.ai/code/artifact/35b84bee-5966-4e05-8533-2ea20ad5a079 |
