# Verification Rework + Dark/Light Theme — Design Spec

**Date:** 2026-07-27
**Branch:** `feature/verification-ui-darkmode` (off `feature/profile-redesign` @ 5cfcd56)
**Scope:** `renfi/renfi` (React Native app). Backends are **read-only audit only** — no Node/Java commits on this branch.

> Supersedes `docs/UI_VERIFICATION_AND_THEME_BRIEF.md`. That brief was written from a quick end-of-session
> scan and several of its claims are wrong; corrections are recorded in §3.1. Where this spec states a
> number or a file fact, it was measured or read from live code on 2026-07-27.

---

## 1. Goal & Non-Goals

### Goal

Two workstreams on one branch, phased:

1. **Verification rework** — redefine the verification surface end to end: UI, component structure, and
   state management. Fix the correctness and accessibility defects listed in §4. Must behave identically
   on low-RAM Android, on 3-button and gesture navigation, and on iOS.
2. **Dark / Light theme** — a reusable theming system across the **entire app**, with a Settings control
   offering Light / Dark / System Default, preserving the existing Fixhomi design language and brand.

### Non-Goals

- **No application redesign.** Outside the verification surface, screens keep their exact layout,
  spacing, copy, and flows. Theming changes colour only.
- **No new UI elements, sections, tags, or copy** anywhere except the Settings theme control (§8).
- **No backend, DB, or API changes.** The backend work on this branch is an audit that produces written
  findings, nothing more.
- **No new flows.** Every navigation path, gate, and API call stays as it is.
- **No engine migration to Unistyles in this branch** — see §5.1.

---

## 2. Decisions taken during brainstorming

| # | Decision | Rationale |
|---|---|---|
| D1 | Verification is **redesigned**, not merely themed | Owner directive. Justified independently by three measured WCAG failures (§4.1). |
| D2 | Redesign covers **UI + component code + state**, not just pixels | Owner directive: "everything needs to be redefined". |
| D3 | Theme covers the **whole app**, all ~2,910 colour literals | Owner directive: "theming of all including verification status". |
| D4 | Theme engine is **pure JS behind a swappable interface**; Unistyles deferred | See §5.1. Owner initially chose Unistyles, then chose the hedge after issue #1160 was surfaced. |
| D5 | **One branch**, each phase its own commit, each commit shippable | Reviewable and revertable in pieces; owner can cut a build at any phase boundary. |
| D6 | Security: **fix app-side, audit backends read-only** | IDOR is only decidable in the backends, but cross-repo commits would collide with the unmerged `phone-signup-providers` / `feature/phone-signup-users` branches. |
| D7 | Deliver a **phases MD** and a **harness agent spec** | Owner directive. The agent must read the phases MD first and flag contradictions rather than comply. |
| D8 | **HTML mockup (light + dark) gates RN work** | Standing owner preference — ships without local device testing. |

### Rejected options

- **Unistyles v3 now** (§5.1) — deferred, not rejected outright.
- **Restyle / styled-components** — per-render prop parsing, the exact cost the 2026-07 jitter work removed.
- **Big-bang colour codemod** — the same hex means different things in different places (`#F1F5F9` is a
  page background, a divider, and an icon chip), so a blind hex→token map produces a subtly wrong dark
  theme that cannot be reviewed.
- **Theming only the rewritten screens** — contradicts D3.

---

## 3. Current state (verified 2026-07-27)

### 3.1 Corrections to `UI_VERIFICATION_AND_THEME_BRIEF.md`

| Brief claim | Verified reality |
|---|---|
| `DocumentVerificationScreen.jsx` is a provider screen | **Dead code.** 1,365 lines, exported from `src/screens/index.js:53`, never routed. The `DocumentVerification` route in *both* navigators points at `ServiceApprovalsScreen`. |
| `VerificationDashboardScreen` — "confirm which parts users see" | **Provider-only.** Registered solely in `ProviderMainNavigator` (`navigation/RootNavigator.jsx:825`). |
| Aadhaar UI is a shared Profile card | Provider-gated: `{isProvider && ...}` at `ProfileScreen.jsx:2422`. **Users never see Aadhaar.** Out of user scope. |
| "~136 hex in UserHomeScreen, ~19 in VerificationDashboard" | Understates the problem by an order of magnitude: **2,910 hex literals app-wide**; `ProfileScreen.jsx` alone has 305. |
| "Some screens define a local palette (e.g. `InsuranceScreen`)" | **~30 files** already define `const BRAND` / `COLORS` / `C`. This is an accelerator, not a footnote. |

Also dead: `src/screens/HomeScreen.jsx` (740 lines, 47 hex), referenced nowhere.
**Both are excluded from theming scope and deleted in Phase 1 after re-verification — see §17.**

Confirmed correct in the brief: no theming infrastructure exists (zero `useColorScheme` / `Appearance` /
`ThemeContext` / `useTheme` matches in `src/`, `navigation/`, `App.tsx`); i18n parity is exactly
**1959 / 1959 / 1959** keys across en/hi/mr; `tabBarTone.js` is scroll-adaptive tinting, not a theme.

### 3.2 Facts neither handoff doc records

- **`targetSdkVersion = 36`** → Android 15+ **edge-to-edge is already enforced**. 38 files use
  `useSafeAreaInsets`; there are **18 `<SafeAreaView>` usages of which only 3 declare an `edges` prop**,
  leaving 15 relying on defaults. `VerificationScreen.jsx` contributes two of the undeclared ones. This
  inconsistency is a live defect source on 3-button navigation.
- **`AppTheme` extends `Theme.AppCompat.DayNight.NoActionBar`** — the native Android window already
  follows system dark mode while the JS UI never does. There is no `values-night` resource dir, so a
  system-dark device can flash a light launch background on cold start today.
- **`android:configChanges` includes `uiMode`** → the Activity does not recreate on a system theme
  change. RN's `Appearance` listener fires and JS handles it. This is the correct config for a
  JS-driven theme; no manifest change needed.
- iOS `Info.plist` does not pin `UIUserInterfaceStyle`, so iOS follows the system.
- `StatusBar` is hardcoded `barStyle="dark-content"` in ~75 places, including `App.tsx:470`.
- `BlurView blurType="light"` at 7 sites; 11 files use `LinearGradient`; `GraphBackground`,
  `ThreadBackground`, and `SvgArt` all assume a light canvas.
- The palette is essentially Tailwind slate/gray plus `#f67c16` and `#2b76bc`, so token mapping is
  largely mechanical once semantics are decided per site.

### 3.3 Verification surfaces the USER actually reaches

| Surface | File | Shared? |
|---|---|---|
| Status pills in the profile header | `ProfileScreen.jsx:1492-1536` | both roles |
| "Not verified" warning banner | `ProfileScreen.jsx:1538-1545` | both roles |
| Verification section (phone + email rows, inline OTP) | `ProfileScreen.jsx:2178-2300` | user branch |
| Full-screen OTP / add-contact screen | `VerificationScreen.jsx` | both navigators |
| Verify-then-replace phone sheet | `components/PhoneChangeModal.jsx` | both roles |
| Deep-link email verification result | `EmailVerifyHandlerScreen.jsx` | both navigators |

Provider-only and **out of scope for the redesign** (they still get themed in Phase 8):
`VerificationDashboardScreen`, the Aadhaar card and `AadhaarVerificationModal`, `ServiceApprovalsScreen`,
`InsuranceScreen`.

### 3.4 Colour migration sizing

| Tier | Files | Hex literals |
|---|---|---|
| T1 verification + settings core | 6 | 436 |
| T2 remaining user screens | 14 | 918 |
| T3 shared chrome and components | 26 | 547 |
| T4 auth / logged-out | 12 | 279 |
| T5 provider-only | 8 | 513 |
| Uncategorised (incl. 119 in the two dead files) | — | 217 |
| **Total** | | **2,910** |

---

## 4. Defects this branch fixes

### 4.1 Accessibility — measured, not opinion

WCAG 2.1 AA requires 4.5:1 for normal text, 3:1 for large text and UI components.

| Rendered pair | Ratio | Verdict |
|---|---|---|
| White text on the orange **Verify** button (`#FFFFFF` on `#f67c16`) | **2.69** | ✗ FAIL |
| Unverified pill label (`#94A3B8` on `#F1F5F9`) | **2.34** | ✗ FAIL |
| Green "Verified" badge text (`#16A34A` on `#F0FDF4`) | **3.15** | ✗ FAIL |
| White on the blue verified pill (`#FFFFFF` on `#2b76bc`) | 4.75 | ✓ |
| Warning banner text (`#C2410C` on `#FFF7ED`) | 4.88 | ✓ |
| Inline amber message (`#92400E` on `#FFFBEB`) | 6.84 | ✓ |

Three of the six verification states — including the primary call to action — are below standard.
**The remedy is not less orange.** `#f67c16` is a sound brand fill; it simply must never carry white
text. It will be used as a fill under dark text, or as an accent/border, never as a bed for `#FFFFFF`.

### 4.2 Correctness and race conditions (app-side)

| ID | Defect | Location |
|---|---|---|
| V1 | No in-flight reentry guard. Both handlers gate only on `disabled={verifyingPhone}`, which is async state — a double tap within one frame fires two OTP requests. `PhoneChangeModal` solved this properly with an `inFlight` ref; ProfileScreen never did. | `ProfileScreen.jsx:964`, `:994` |
| V2 | **Verified-flag downgrade.** `isEmailVerified: data.isEmailVerified ?? false` and the same for phone — a partial or malformed response silently marks a verified user unverified. Same bug class as the Aadhaar `\|\| true` fixed in `3a3cec3`. | `AppContext.js` `refreshVerificationStatus` |
| V3 | Concurrent `refreshVerificationStatus` calls race `setIsProfileLoading`: the first to settle clears the flag while another is still in flight. Callers include a focus effect, `PhoneChangeModal`, and the OTP handler. | `AppContext.js` |
| V4 | No cancellation. A screen unmounted mid-request still writes state on completion. | all verification call sites |
| V5 | Email verification has no persistent pending state — `otpSent` is passed for phone only, so after tapping Verify on email the row is visually unchanged. | `ProfileScreen.jsx:2290-2297` |
| V6 | Three separate presentations of the same two booleans on one screen (pills, banner, section), with **verified rendered blue in the pill and green in the badge**. | `ProfileScreen.jsx` |

Verified as **already correct** and not to be "fixed": `otpPhoneRef` / `otpExpiryRef` handle wall-clock OTP
expiry and invalidate on phone change (`ProfileScreen.jsx:433-460`); `PhoneChangeModal` has a reentry
guard, a mirror-sync retry, and mid-flow process-death resume.

---

## 5. Architecture — theme layer

### 5.1 Engine choice and the deferred Unistyles migration

`react-native-unistyles@3.3.0` was evaluated and **is compatible** with this stack: its own example app runs
RN 0.85.3 (newer than this app's 0.84.1), the new architecture is enabled, `minSdkVersion 24` is fine, and
`react-native-reanimated` / `react-native-edge-to-edge` are **optional** peer deps so the app's `Animated`
usage would be untouched. Only `react-native-nitro-modules` would be genuinely new.

It is nonetheless **deferred**, because of a specific documented risk:

> [jpudysz/react-native-unistyles#1160](https://github.com/jpudysz/react-native-unistyles/issues/1160) —
> native SIGABRT on iOS, `folly::dynamic` fatal in `ShadowTreeManager::updateShadowTree`, reported on
> **react-native 0.84.1 with `adaptiveThemes: true`**, reproducing **only in release/TestFlight builds**
> after tens of minutes, never in local debug. The maintainer advised upgrading and closed it the next day
> for lack of a minimal repro — with the words "there's a good chance this is already resolved". **It was
> never confirmed fixed.**

Three factors make that risk asymmetric here: this project ships without local device testing, so a
release-only crash reaches testers rather than the developer; the crash path is the *suspended nodes*
path, and both tab navigators set `freezeOnBlur: true` (`RootNavigator.jsx:499`, `:566`); and v3.3.0 was
still adding "react-navigation inactive behaviour" support three weeks ago, so the area is live.

**Decision:** ship a pure-JS engine now behind an interface that Unistyles can later implement. Screens
never import tokens directly, so the engine swap touches three files rather than 178.

### 5.2 Module layout

```
src/theme/
  tokens/
    palette.js       raw colour scales — the ONLY file permitted to contain hex literals
    semantic.js      light + dark semantic token maps, built from palette
    typography.js    existing sizes/weights, named
    spacing.js       spacing, radii, and paired elevation/shadow values
  ThemeContext.jsx   mode state, AsyncStorage persistence, Appearance subscription
  useTheme.js        → { theme, mode, setMode, isDark }
  useThemedStyles.js makeStyles(theme) → cached per (module, themeName)
  index.js           public surface — screens import from here and nowhere else
```

### 5.3 Runtime behaviour

- `ThemeProvider` mounts between `SafeAreaProvider` and `LanguageProvider` in `App.tsx`.
- Context value is `useMemo`'d on `[mode, systemScheme]`. This is mandatory, not stylistic: an inline
  context value here would hand a new identity to every themed component on each provider render, which is
  precisely the whole-app re-render amplifier diagnosed as the low-end-Android "text jitter" in
  `AUTH_STARTUP_LOGOUT_FIX.md`.
- `useThemedStyles(makeStyles)` caches by theme name, so `makeStyles` executes at most twice per module for
  the process lifetime. No `StyleSheet` object is allocated during render.
- Mode is persisted to AsyncStorage under `app_theme_mode` (`'light' | 'dark' | 'system'`), read during
  boot before the splash hides so there is no light-to-dark flash.
- `'system'` subscribes via `Appearance.addChangeListener`. A manual Light or Dark choice always wins and
  is never overwritten by a system change.

### 5.4 Token set

Semantic names only. No screen refers to a raw scale step.

`bg` · `surface` · `surfaceElevated` · `surfaceSunken` · `border` · `borderStrong` · `textPrimary` ·
`textSecondary` · `textMuted` · `textInverse` · `brandOrange` · `brandBlue` · `accentOnBrand` ·
`success` · `warning` · `danger` · `info`, each semantic additionally exposing a `*Container` tinted
variant (the chip backgrounds already in use), plus `overlay` and `shadow`.

Dark surface ramp: `#0B1220` base → `#111827` surface → `#1E293B` elevated. Per Material 3, the base is a
dark neutral rather than pure black and surfaces lighten as they elevate.

Measured constraints the token values must satisfy:

- `#f67c16` scores **6.60** on `#111827` — the brand orange **survives dark mode unchanged**.
- `#2b76bc` scores only **3.73** on `#111827` — insufficient for text. Dark mode uses a lightened brand
  blue; `#5FA8E8` scores **6.97** and is the working candidate.
- A muted text token of `#7A8699` scores **3.97 on `#1E293B`** — **fails**. `textMuted` must be lightened
  until it passes against all three dark surfaces.

**Every token pair is validated by script, not by eye.** The validator is part of the harness (§10) and
runs in the Phase 9 gate.

The ~30 files that already declare `const BRAND` / `COLORS` / `C` convert cheaply: the literal object
becomes `const C = useThemeColors()` and the bulk of each file follows without further edits.

---

## 6. Verification feature module

```
src/features/verification/
  useVerificationMachine.js    reducer: idle → sending → otpSent → verifying → verified | error
  verificationSelectors.js     single source of truth deriving status from user/profile
  components/
    VerificationStatusCard.jsx   replaces pills + banner + section (3 surfaces → 1)
    VerificationChannelRow.jsx   phone and email, one interaction model
    OtpEntry.jsx                 the 6-box OTP input, extracted once
```

The reducer owns the in-flight guard (V1), a cancellation token (V4), and every transition, so those
defects are fixed structurally rather than patched per call site. It is a pure function with no network or
native dependency, making it **unit-testable without any device or native mock** — which is what makes
"behaves the same on every phone" an assertion this environment can actually verify.

`verificationSelectors.js` removes V2 and V6: one derivation of verified/pending/unverified state, and
`??` defaulting is replaced by explicit "unknown" handling so an absent field never downgrades a verified
flag. `refreshVerificationStatus` gets a request-generation counter so a stale response cannot clobber a
newer one and cannot clear `isProfileLoading` early (V3).

Presentational components consume theme tokens only and hold no network knowledge. `ProfileScreen` loses
three ad-hoc verification blocks and gains one component.

---

## 7. Verification visual design

Locked constraints: no new copy beyond what already exists, no new sections, no flow changes, and every
state readable to WCAG AA in **both** themes.

- **One status semantic.** Verified, pending, and unverified each get exactly one colour treatment used
  everywhere. The blue-pill / green-badge contradiction (V6) is resolved to a single verified treatment.
- **Unverified reads as actionable**, not disabled — the current `#94A3B8`-on-`#F1F5F9` chip at 2.34:1 is
  both illegible and semantically wrong.
- **Orange never carries white text.** It appears as a fill under dark text, or as accent/border/icon.
- **Pending is a real state** for email as well as phone (V5).
- Redundancy is removed rather than restyled: three presentations collapse to one authoritative card.

Exact values are settled in the Phase 2 mockup and validated by the contrast script before any RN code.

---

## 8. Settings — the only new UI

A `SectionHeader` plus three selectable rows, following the existing language-picker pattern
(`SettingsScreen.jsx:1408-1450`) so it is visually native to the screen:

| Option | Explanatory line |
|---|---|
| Light | Always use the light appearance. |
| Dark | Always use the dark appearance. |
| System Default | Match your device setting; changes automatically. |

Shown identically for **User and Provider**. Selecting Light or Dark overrides the system permanently
until changed. This adds **7** i18n keys (one section title, three labels, three explanatory lines) to
**all three** locales — the only new keys in the entire project (§9).

---

## 9. Internationalisation

- en / hi / mr must remain key-identical at every commit, with identical `%{var}` placeholders per key.
- **The only sanctioned new keys are the Settings theme control** (§8): one section title, three option
  labels, three explanatory lines — **7 keys**, taking all three locales from 1959 to **1966**.
- The verification rework (§6, §7) adds **no** new keys. It reuses existing ones; where a state has no
  existing string, the design uses an existing key rather than inventing copy, per the "no new text"
  constraint in §1. If a phase finds a state that genuinely cannot be expressed with an existing key,
  that is a scope conflict — the harness agent must flag it to the owner rather than silently adding copy.
- The flatten-and-diff parity check runs in every phase gate, not only at the end.

---

## 10. Deliverables beyond code

1. **`docs/VERIFICATION_AND_THEME_PHASES.md`** — the phase board: per-phase scope, status checkboxes,
   acceptance criteria, and the backend audit findings from Phase 4.
2. **`.claude/agents/fixhomi-frontend.md`** — the harness agent spec. It must read the phases MD **before
   any other action**, and it must **flag contradictions rather than comply** with them: if the MD, this
   spec, or a code comment conflicts with what the code actually does, it reports the conflict and stops
   rather than proceeding on a false premise. It encodes the standing repo rules — parse-check every
   changed file, i18n parity, no raw hex in migrated files, every `elevation` paired with iOS `shadow*`,
   no backticks in commit `-m` bodies, never commit the owner's uncommitted files.
3. **Theme-aware HTML mockup**, light and dark, covering the redesigned verification surface and a
   representative themed screen. **Gates all RN work** (D8).

---

## 11. Phases

Each phase is one commit and leaves the app shippable and parse-clean.

| # | Phase | Output | Gate |
|---|---|---|---|
| 0 | Branch, phases MD, harness agent spec | docs only | — |
| 1 | Theme engine, tokens, contrast validator + dead-file deletion (§17) | no visual change | validator passes; non-use re-verified |
| 2 | HTML mockup, light + dark, incl. both Mapbox dark candidates (§16) | no code | **owner approval** |
| 3 | Verification module: UI + state + V1–V6 | user + shared surfaces | unit tests on the reducer |
| 4 | Backend read-only IDOR / race audit | findings written into the phases MD | — |
| 5 | Shared chrome: `<Screen>`, dialogs, banner, tab bar, StatusBar | 547 hex | hex lint |
| 6 | User screens, incl. Mapbox theme following at all 6 map sites (§16) | 918 hex | hex lint |
| 7 | Auth screens | 279 hex | hex lint |
| 8 | Provider screens | 513 hex | hex lint |
| 9 | Full sweep | — | all gates |

---

## 12. Platform correctness

- `targetSdk 36` enforces edge-to-edge. The 18 `<SafeAreaView>` usages and 38 `useSafeAreaInsets` call
  sites are standardised onto one `<Screen>` primitive with explicit `edges`, fixing the **15** that
  declare no `edges` at all. Must be correct for both gesture and 3-button navigation.
- A `values-night` resource dir is added so the native launch background stops flashing light on cold
  start under system dark mode.
- `StatusBar` becomes theme-driven; `barStyle` follows the active theme instead of the hardcoded
  `dark-content` at ~75 sites.
- `BlurView blurType` follows the theme at all 7 sites.
- Every `elevation` keeps a matching iOS `shadow*` pair, per repo rule.
- Effects stay light: no new blur, no new gradients, no runtime colour computation in render — providers
  run older, low-RAM Android hardware.

---

## 13. Backend audit scope (Phase 4, read-only)

Findings are written into the phases MD with severity and a proposed fix. **No backend commits.**

- `GET /api/provider/:providerId/verification-dashboard` and
  `POST /api/provider/:providerId/sync-verification` take a **client-supplied ID in the URL path**
  (`src/services/verificationService.js:43`, `:104`). Confirm the handler enforces JWT subject ==
  `providerId` rather than trusting the path.
- `syncPhoneToMongoDB` sends a client-supplied `mongoId`, `userType`, **and `phoneNumber`**
  (`components/PhoneChangeModal.jsx:208-213`). The code comment asserts "the server re-reads truth from
  Java" — verify that claim in the handler. If the server trusts the supplied `phoneNumber`, a caller
  could mark an arbitrary number verified.
- Check OTP send/verify endpoints for per-account rate limiting and for replay of a consumed OTP.
- Cross-check against `noefi/fixhomi-backend/SECURITY_REVIEW_2026-07.md` so already-fixed items
  (`34360b8`, `173442e`, `89ee926`) are not re-reported.

Out of scope: the owner action to rotate `JWT_SECRET`, tracked in `SESSION_HANDOFF_2026-07-20.md` §3.

---

## 14. Validation

This environment can Babel-parse RN and run Jest, but **cannot run the app**. Accordingly:

- **Parse-check** every changed file with `module:@react-native/babel-preset`.
- **i18n parity** — flatten and diff en/hi/mr, key sets and `%{var}` placeholders identical.
- **Hex lint** — fail on any raw colour literal in a file marked migrated, so finished phases cannot
  regress. `src/theme/tokens/palette.js` is the sole exemption.
- **Contrast validator** — every semantic foreground/background pair in both themes meets AA.
- **Reducer unit tests** — the verification state machine, including double-submit and unmount-mid-request.
- **Lint against a baseline** (`git stash` → lint → compare), never absolute counts.
- Device verification remains the owner's step. Phase 9 produces the device test checklist.

---

## 15. Risks and open items

| Risk | Mitigation |
|---|---|
| A 2,910-literal migration silently changes a colour meaning | Per-file semantic review; each phase is its own reviewable commit; hex lint prevents regression. |
| Dark mode looks wrong on decorative SVG backgrounds (`GraphBackground`, `ThreadBackground`, `SvgArt`) | Handled explicitly in Phase 5; they take theme-aware stroke/fill rather than being hidden. |
| Mapbox dark basemap differs in character from the current street map | §16. Both candidate dark styles are shown at the Phase 2 mockup gate. |
| Runtime `styleURL` change forces a full Mapbox style reload | Only occurs on a theme switch, a rare user action. Maps not mounted at that moment are unaffected. |
| Owner ships without device testing | Phase 9 produces an explicit device checklist; no store submission until it passes. |
| Deferred Unistyles migration never happens | Acceptable — the pure-JS engine is a complete solution, not a stub. The interface simply keeps the option open. |

---

## 16. Mapbox theme following

**Supported on the installed stack — with one constraint.**

All 6 map sites currently hardcode `Mapbox.StyleURL.Street`:
`ServiceRequestDetailScreen.jsx:550`, `LiveTrackingScreen.jsx:449`, `ProviderHomeScreen.jsx:1100` and
`:1457`, `MapPickerModal.jsx:563`, `MapView/LocationMap.jsx:314`.

`@rnmapbox/maps@10.1.42` exports `StyleURL.Dark` (`mapbox://styles/mapbox/dark-v10`) and `.Light`, and
`styleURL` is a live prop, so the map re-styles when the theme changes. Because the style is derived from
the resolved theme via `useTheme()`, **a manual Light/Dark override is respected automatically** — the map
follows whatever the theme resolves to, whether that came from the system or from the user's choice.

**Constraint:** the Standard style's `lightPreset: day|night` — which would give a true same-map day/night
transition — is **not available**. `StyleImport` is documented "**V11 only**", and this project resolves
Mapbox SDK **v10**: `ios/Podfile.lock` pins `MapboxMaps (10.19.5)`, and Android sets no
`RNMapboxMapsVersion` override so it takes the `10.19.0` default. Reaching v11 means a native SDK major
upgrade on both platforms — the same class of unverifiable-native risk that deferred Unistyles in §5.1.
**Not undertaken on this branch.**

Light mode keeps `StyleURL.Street` unchanged, per the no-redesign constraint in §1. For dark mode there
are two candidates, and they differ enough to matter:

| Candidate | Character | Trade-off |
|---|---|---|
| `StyleURL.Dark` (`dark-v10`) | Monochrome greyscale, designed as a data-viz backdrop | Cleanest dark surface; noticeably less POI detail than the light-mode street map |
| `StyleURL.TrafficNight` (`navigation-preview-night-v4`) | Dark **street** map, roads prominent | Much closer in character to `streets-v11`; busier |

Both are rendered at the **Phase 2 mockup gate** for the owner to choose. Default if unspecified:
`StyleURL.Dark`.

---

## 17. Dead code removal

Both files were re-verified on 2026-07-27 with an exhaustive search across all `.js/.jsx/.ts/.tsx/.json`
sources: no import, no dynamic `require()`/`import()`, no string-keyed screen lookup, no test reference,
and the screens barrel is never star-imported.

| File | Lines | Hex | Only reference |
|---|---|---|---|
| `src/screens/DocumentVerificationScreen.jsx` | 1,365 | 72 | `src/screens/index.js:53` |
| `src/screens/HomeScreen.jsx` | 740 | 47 | `src/screens/index.js:35` |

The `DocumentVerification` **route name** remains live in both navigators but resolves to
`ServiceApprovalsScreen` — deleting the file does not affect it.

`RootNavigator` imports from the barrel `../src/screens`, and **Metro does not tree-shake barrel
re-exports**, so both files are currently compiled into the production bundle despite being unreachable.
Deleting them removes 2,105 lines and 119 hex literals from the migration and measurably reduces bundle
parse time on low-RAM devices.

**Deleted in Phase 1**, together with their two barrel export lines, as an isolated commit that can be
reverted independently. Re-verification of non-use is a precondition of that commit, not an assumption
carried over from this spec.
