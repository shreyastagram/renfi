# Dark/Light Theme v2 — TRACKER (SOURCE OF TRUTH)

**Branch:** `feature/theme-v2` (off tag **`v1.0.9`** = `b74f862`)
**Colour contract:** `docs/COLOUR_MAP.md`
**Also read:** `FIXORA_APP/WORK_AVAILABILITY_TRACKER.md` — Working Hours is live in prod.
**Last updated:** 2026-09-26. **1.1.0-beta.7 (43) distributed.** Dark mode at 0 ink failures, 94% checked.

> **Read this file BEFORE touching code.** If it contradicts the code, **STOP and flag it** —
> do not proceed on a false premise.
>
> **UPDATE THIS FILE AFTER EVERY COMMIT**, not at phase boundaries. It drifted four commits
> behind once already; that is the exact failure this file exists to prevent.

---

## ▶ 1. WHERE WE ARE RIGHT NOW

**Phases 0–9 done. Every file under `src/` is now free of colour literals.**

- **Zero colour literals remain anywhere in `src/`** — all 38 screens and every component.
  The only literals left in the app are `src/theme/tokens/palette.js` (the one file allowed
  them) and `navigation/RootNavigator.jsx` (26, intentional — see §15).
- Switching to Dark now changes the whole app, including the splash hand-off and the crash
  screen.
- `npm run verify` exits **0** — verify by exit code, never by grepping for "OK".
- **Nothing is device-verified.** This environment cannot run the app. Two Firebase builds
  have shipped to the tester: `1.1.0-beta.1` (37) and `1.1.0-beta.2` (38, the true-black ramp).

### Next action

**The colour migration is finished.** What is left is not colour work.

Remaining, in the order I would take it:

Everything in the plan is done except **V6**, which was declined on purpose — see §11.

Mockup for the last round — **approved by the owner 2026-09-26** (light + dark, real
token values): <https://claude.ai/code/artifact/12998350-dead-4762-ad87-b2566fb02eeb>

**`1.1.0-beta.3` (versionCode 39) is with the tester.** Built `USE_DEV_STAGING = false`,
so it hits PRODUCTION — same as beta.1 and beta.2, real data. The release notes carry the
checklist below. Console:
<https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/5r02mc4csrcoo>

**Owner feedback on beta.3, 2026-09-26** — "liked the work", and two directions:

1. *"dont wait for cards to separate on dark mode, give it a crystal coloured border"* —
   done. The dark border is now a lit cool edge (§19), so separation no longer depends on
   whether a panel can resolve a 14-code-value fill difference. This deliberately removes
   the one question every build had to ask a human.
2. *"change the map also to black"* — done, all six MapViews (§19).
3. *"washed out colours like black text in black bg ... lets look at it later"* —
   **found and fixed without waiting for screen names.** Root cause in §18. Ten places
   across two clusters; the worst was the provider home greeting at exactly 1.00:1.

**The build is the owner's step.** No fastlane / App Distribution automation, and
`USE_DEV_STAGING` lives in a do-not-commit file.

Open, awaiting the owner's word: deepen `surfaceElevated` from `#26262B` to `#1A1A1F`
(one usage in the whole app).

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
- [~] **Phase 5b** — V1–V4 **and V5** done, plus `profile.emailPending` (i18n 2074→2075),
      shipped in `0d61e04`. **Only V6 remains**, declined with reasons in §11 — the board
      said V5 was still blocked long after it shipped, which is exactly the drift this
      file exists to prevent.
- [x] **Phase 6a** — Pilot: `CustomDialog` (proved the `useThemedStyles` pattern)
- [x] **Phase 6b** — Rest of shared chrome
  - [x] batch 1 — `Button`, `Alert`, `ShimmerLoader` (zero security exposure)
  - [x] batch 2 — `Input`, `Icon`, `GlobalBanner` (+ category-map dedupe)
  - [x] batch 3 — `DrawerMenu` (full), `RootNavigator` (surgical — see §15)
  - [x] batch 4 — `<Screen>` primitive built + piloted on `EmailVerifyHandlerScreen`.
        **17 SafeAreaView sites still to swap** — they land with their own phases
        (auth screens in 9, verification in 5b), not as a big-bang change.
- [x] **Phase 7** — User screens + Mapbox theme following (`TrafficNight`)
  - [x] batch 1 — `PSATriggerScreen`, `PSAContactsScreen`, `ReferralScreen` (zero-security)
  - [x] batch 2 — `FavoritesScreen`, `LiveTrackingScreen`, `EventServicesScreen`
  - [x] batch 3 — `CreateServiceRequestScreen`, `UserServiceHistoryScreen`
  - [x] batch 4 — `UserHomeScreen`, `ServiceRequestDetailScreen` (+ Mapbox — the map lives
        HERE, not on the home screen as this board previously said), `SubscriptionScreen`
  - [x] batch 5 — `EmergencyServicesScreen`, `AccountSecurityScreen`, `SettingsScreen`,
        `ChangePasswordScreen` — migrated in ascending order of security exposure
        (2 / 68 / 117 / 255 sensitive lines), auth screens last
- [x] **Phase 8** — provider screens
  - [x] Working Hours cluster — `TimePickerField` (incl. the `themeVariant="light"` fix),
        `WorkAvailabilityScreen`, `ProviderHomeTopRow`, `WeeklyScheduleCard`
  - [x] `PortfolioEditScreen`, `ProviderHomeScreen`
  - [x] `ProviderRegisterScreen`, `ProviderServiceHistoryScreen`
  - [x] `ServiceApprovalsScreen`
- [x] **Phase 9** — Auth screens (and the verification + insurance screens, which shared the same ramp)
- [x] **Phase 9c** — `<Screen>` swap: all 15 remaining `SafeAreaView` roots, + a gate
- [x] **Phase 9b** — Components sweep: the last 13 files
    - [x] Proved-unused then deleted: `ThreadBackground`, `SVGFixhomi` (unreferenced at
          `v1.0.9` too — dead before this work started)
    - [x] `ErrorBoundary` — the crash screen, which needed a context-free theme read (§17)
    - [x] `GoogleLogo` → `vendor`; `SupportSheet` (+ `vendor.whatsappGreen`)
    - [x] `MaintenanceModal`, `AppUpdateModal`, `InlineFieldCollectorModal`, `WelcomeModal`
    - [x] `SplashScreen` → new `splash` group; `LocationMap` → new `mapPin` group
    - [x] `AddressForm` (37 literals, 3 components to wire — the largest single file)
    - [x] `subscriptionService.js` — the Razorpay checkout accent
- [x] **Phase 10** — Full sweep + device-test checklist (see below; the device test
      itself is the owner's manual step — this environment cannot run the app)

---

## 3. MIGRATION PROGRESS

| Measure | Value |
|---|---|
| Colour literals remaining | **0 in `src/`** (3,329 at v1.0.9). Repo total 414: 321 in `palette.js` (the one file allowed them), 26 in `RootNavigator` (§15), the rest is comment prose |
| Files on the hex allowlist | **93** |
| Components fully themed | **ALL OF THEM** |
| Screens fully themed | **ALL OF THEM** — 38 screens |
| Theme unit tests | 40 across 8 suites |
| Owner's Working Hours tests | 86 — **must never regress** |
| i18n | **2074** × en/hi/mr (2067 baseline + 7 theme keys) |

**On the literal count.** 3,329 was v1.0.9 counted over its own 164 source files. Today's
**2,365** covers the 173 that exist now.

**Recount at every commit — do not carry the previous number forward.** I left this cell
at batch 3's value through batch 4a, then guessed at 4b; both were wrong by ~300. Verified
series, one measurement per commit:

| Commit | Literals | Files |
|---|---|---|
| `v1.0.9` | 3,329 | 164 |
| batch 2 `11da936` | 3,021 | 173 |
| batch 3 `f3a1ac6` | 2,848 | 173 |
| batch 4a `2f9939e` | 2,520 | 173 |
| batch 4b `605c97f` | 2,365 | 173 |
| batch 5 | **2,249** | 173 |
| ProfileScreen | **1,961** | 173 |
| components sweep | **414** | 175 |

At 414 the formula has bottomed out: it counts comment text and `palette.js`, so it can
never reach zero. The measure that matters from here is the comment-excluding count over
`src/` minus `palette.js`, which is **0**.

Recount with:

```
git ls-files | grep -E '\.(jsx?|tsx?)$' \
  | grep -vE '^scripts/|__tests__' \
  | xargs grep -ohE '#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)' | wc -l
```

Note the count can go UP when a palette group is added (the `premium` group added 31), so a
drop smaller than the screen's own literal count is expected, not a mistake. Recount with:
`git ls-files | grep -E '\.(jsx?|tsx?)$'` filtered to exclude `scripts/` and tests, matching
`#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)`. Quoting a smaller number than that is overclaiming.

**Honest split:** by "can a user see the app go dark" ≈ **40%**. By total project effort
≈ **65%** — architecture, palette, design language, census and gates are done, and the
pattern is proven. The remaining literals are mechanical.

### Remaining by area

| Area | Colours | Phase |
|---|---|---|
| `RootNavigator` (adaptive-tone values, intentionally literal) | 26 | n/a — see §15 |

Everything else is done.

---

### `scripts/migration/migrate.py` — the shared migration mechanics

Written after hand-rolling the same steps nine times. Every function in it encodes a
mistake that actually happened and had to be backed out:

| Function | The mistake it prevents |
|---|---|
| `insert_theme_import` | inserting by line index split a multi-line import — twice |
| `to_factory` | closing a sheet with `}));` instead of `});` broke a `React.memo` file |
| `wire` | a multi-line destructured parameter list ends in `({`, so hooks landed inside the params |
| `to_block_body` | `React.memo(arrow)` closes with `});`, a plain arrow with `};` |
| `drop_unused` | hooks a component turned out not to need show up as new `no-unused-vars` |

It decides no colours — the caller supplies the mapping. Every step asserts its anchor,
so a wrong guess fails loudly instead of corrupting the file.

**Also fixed the lint comparator** (`/tmp/cmpdiag.py` pattern, worth keeping): eslint
pretty-prints an inline-style object across MULTIPLE lines when it holds a literal and
on ONE line when it holds an identifier. A line-based reader reports the same warning
as both removed and added. It now reassembles each record before normalising — which is
why three "new diagnostics" on `ProviderHomeScreen` turned out to be the same warnings
reformatted.

### ✅ DEVICE TEST IS UNBLOCKED

**Zero unthemed components are reachable from a themed screen.** Measured 22 → 14 → 2 → 0.

Every screen and every component a user can reach is themed: 24 screens plus 40
components. A dark build will now be internally consistent — no white modal over a dark
screen, no light art on a dark surface.

**The one thing no gate can check, and the reason to build:** how the near-black ramp
reads on a real low-end 6-bit panel. Contrast ratio is meaningless near black, so the
dark surface steps were sized on 8-bit code-value gap (`MIN_SURFACE_GAP 10`) and the card
border was leaned on to hold definition when fills crush. That is an engineering judgement
with no automated check — it needs eyes on a cheap Android device.

**Suggested tester checklist**, in order of what is most likely to be wrong:

1. Dark mode on the cheapest Android you have — do cards separate from the background?
2. Settings → Appearance: Light / Dark / System, and confirm System follows the OS.
3. Open a modal from a dark screen (Book, Rate, Cancel, Change phone, a date field).
4. The premium and profile heroes — they stay dark/navy in BOTH themes by design.
5. Android 3-button navigation and gesture bar: `targetSdk 36` enforces edge-to-edge.
   All roots are now `<Screen>`, and the survey found no screen mishandling insets, so
   this is a confirmation pass, not a suspected fault.
6. Light mode as a regression check: it should look like 1.0.9. **464** declared changes,
   all justified in `scripts/check-light-fidelity.js`.
7. The crash screen in dark mode. No way to trigger it deliberately in a release build,
   so this one is opportunistic — but it is the only surface whose theme comes from a
   module singleton rather than context (§17).

### Phase 10 sweep — what was actually checked, 2026-09-26

Not a rubber stamp. Each check below is a failure the other gates CANNOT see, and each
was found by hand at least once during the migration. All four are now locked in
`src/theme/__tests__/themeEngineUsage.test.js`, **every one proven to fail on a canary
file before it passed**:

| Check | Why the other gates miss it | Result |
|---|---|---|
| `makeStyles` at module scope | A factory redeclared per render is a new cache key every render, so `useThemedStyles` rebuilds the whole sheet each time | clean |
| No module-scope `StyleSheet.create` reading a fixed theme | Resolves once at import and never repaints on switch — renders correctly in light, so it stays invisible until dark | clean |
| The barrel is the only entry point | A deep import bypasses the indirection the engine swap depends on | clean; 1 documented exception (`ErrorBoundary`, which must not pull AsyncStorage in) |
| `useMemo` reading `styles.*` lists `styles` | Serves the PREVIOUS theme's sheet after a switch — one stale card on a repainted screen | clean |

Also confirmed directly:

- **0 parsing errors** across `src`, `navigation`, `App.tsx` — the "a lint DROP is a red
  flag" trap in §4.
- **`check:types` exits 0.**
- **0 files** have a `StyleSheet.create` without consuming the theme. That is a stronger
  statement than "no literals left": every sheet in the app is reactive.
- **§15 re-verified rather than assumed.** `accent` in `TabIcon` is painted only on the
  light tone (`dark ? '#FFFFFF' : accent`), so the scroll-tone literals genuinely are not
  app-theme values and are correctly left alone. `BRAND` in that file is live (10
  references), not dead — an earlier grep with the wrong pattern suggested otherwise.

Still **no fastlane / App Distribution automation**, and `USE_DEV_STAGING` is `false` in
a do-not-commit file, so the build is the owner's manual step.

## 4. GATES — run before EVERY commit

```
npm run verify
```

| Gate | Proves |
|---|---|
| `check:i18n` | en/hi/mr key-identical, **baseline 2074** |
| `check:hex` | no raw colour literal in any allowlisted file (comments excluded) |
| `check:contrast` | 41 semantic pairs × 2 themes meet WCAG AA — including **every ink/fill pair**, which it did not assert until batch 3 |
| `check:contrast` | dark device-safety: surface steps + border separation |
| `check:types` | `tsc --noEmit` |
| `test:unit` | 24 theme tests |
| `check:light` | **every migrated file still resolves its ORIGINAL light-mode colours**, or the change is declared with a reason |
| `check:collapse` | no style's `borderColor` resolves to the same token as its `backgroundColor` — i.e. no hairline was erased by mapping two literals onto one token |
| `test:app` | the owner's 86 Working Hours tests |

**Plus, per file touched:** lint against the v1.0.9 baseline for that *specific* file.
Never a global count. This caught a real crash-on-render regression in `Input`.

⚠️ **A sudden lint DROP is a red flag, not a win.** When a file stops parsing, eslint
reports one `Parsing error` and suppresses every other diagnostic — so a regression looks
like an improvement. `ReferralScreen` went "6 → 1" and I reported it as progress; it was
actually a broken import. **Always check `grep -c "Parsing error"` and `npm run check:types`
before believing a lower number.**

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
- **An "insert after the last import" heuristic split a multi-line import in half.** It
  produced a file that eslint reported as a single `Parsing error`, which I misread as a
  lint improvement from 6 to 1. `check:types` caught the real problem. Never insert imports
  positionally; anchor on a complete statement.
- **No gate verified light-mode fidelity.** Every check passed even if a colour was mapped
  to the WRONG token — hex lint only wants no literal, contrast only checks token pairs,
  tests and lint never look at values. Added `check:light`, which immediately found a
  **shipped regression**: `DrawerMenu` used `dangerBorder` for a visible hairline, but that
  token is `transparent` in light mode, so the logout item's red border had disappeared.
  Fixed with new `dangerLine` / `dangerFill` tokens. **Lesson: a gate that cannot fail is
  not a gate — prove each one fails before trusting it.**
- **The `transparent`-in-light border family was wrong, and the `dangerLine` fix had treated
  the symptom.** The four `*Border` tokens were `transparent` in light mode on the theory
  that a light chip reads fine on its fill alone. Migrating `EventServicesScreen` showed the
  premise was false for **every** consumer: at v1.0.9 `Alert` drew `borderWidth: 1` in all
  four hues, the tracking screen's address bar had `#BBF7D0`, and the event screen's venue
  buttons had `#BFDBFE` / `#A7F3D0`. So the token being transparent had silently erased
  hairlines in `Alert` (4) and `LiveTrackingScreen` (1) — a light-mode regression already on
  the branch. Gave the family its shipped light values via a new `semanticLightBorder` group
  (plus `brandOrangeBorder` for the `#FDBA74` summary card), which is both the fix and exact
  light fidelity. `semanticLine` now means only "row hairline", which is what it was for.
  Added a unit test asserting **no `*Border` / `*Line` token ever resolves to transparent**,
  proven to fail on the old value first. **Lesson: when a fix is scoped to the one file that
  exposed a bug, check every other consumer of the same token before calling it done.**
- **`onSuccess` and `onWarning` were still failing after the "fix".** The original reasoning
  was "white fails on the mid-saturation green (3.30) and amber (3.19), so use dark ink" —
  but those ratios were measured against the SHIPPED fills, and the same pass also darkened
  the fills to `#15803D` / `#B45309`. Against the fills the ink actually sits on, dark ink is
  **3.56** and white is **5.02**, so both badges still failed AA. The fill and the ink were
  changed independently and the combination was never re-measured. Light-mode `onSuccess` /
  `onWarning` are now white (dark ink stays correct in dark mode, where the fills lighten),
  and **five ink/fill pairs were added to `check:contrast`** — it never asserted them, which
  is how this survived. 40 pairs now. **Lesson: when you change both sides of a contrast
  pair, re-measure the pair, not each side.**
- **`*Fill` and `*Container` were IDENTICAL in dark mode.** On dark surfaces a fill
  cannot be a low-alpha wash, so the dark `dangerFill` / `warningFill` were pointed at
  the matching container value — which made a tinted chip the same colour as the tinted
  card it sits on (a warning bar's icon wrap). Gave the dark fills their own lighter
  step, completed the family with `successFill` / `infoFill` / `accentVioletFill`, and
  added a test asserting a fill is never equal to its container. Proven failing first.
- **A default parameter cannot see a body-scoped const.** `PulsingDot` had
  `({ color = BRAND.success })`; once `BRAND` became a hook-derived `C` inside the body,
  the default referenced a variable in its own TDZ — a `ReferenceError` on every
  defaulted render, not a lint nit. Defaults that need theme values must be resolved in
  the body. Caught by `no-undef`.
- **Rewriting a config block wholesale nearly dropped three statuses.** I was about to
  replace `ServiceRequestDetailScreen`'s `STATUS_CONFIG` with a hand-written factory
  covering the six statuses I had read; it actually has **nine**
  (`awaiting_confirmation`, `in_transit`, `arrived` were below the fold). Converted it
  in place instead, asserting the key count. **Lesson: convert config blocks in place
  and assert the shape; never retype one from what you happened to read.**
- **Two literals mapped onto one token erased a hairline.** `UserServiceHistoryScreen`'s OTP
  bar had fill `#F3E8FF` and border `#DDD6FE`; both resolved to `accentVioletContainer`, so
  the border became invisible. Completed the violet container/border pair, and added
  **`check:collapse`** — a gate that fails when a style's `borderColor` resolves to the same
  expression as its `backgroundColor`, with an allowlist for the two solid "selected" pills
  that were deliberately like that at v1.0.9. Proven to fail on the OTP bar first.

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

### Theme-independent groups (added as screens needed them)

`categoryAccent`, `iconAccent`, `medal`, `brandTint`, `vendor`, `mapRoute`, `mapOverlay`,
`stableDark`, `stableEmergency`, `premium`, `heroGradient`, **`mapPin`**, **`splash`**.

`mapPin` is markers and geofence geometry drawn ON the map. They sit over Mapbox tiles, not
over our surfaces: a pin that inverted with the app theme would still have to stay legible
against satellite imagery and street tiles, which no single flip achieves. Same rule as
`mapRoute` and `mapOverlay`.

`splash` is the cold-start brand panel — deep navy, white ink, orange glow. It is shown
*before* the theme has been read from storage, so flipping it would mean a light splash
handing off to a dark app on every cold start: exactly the flash this work exists to remove.

**When you add a group, add it to the `resolvable` list in `scripts/check-light-fidelity.js`**
or the gate reports its colours as unexplained drift.

`premium` is the navy + gold subscription system — the hero, the active-plan header band
and the launch-offer chip. Deliberately separate from `stableDark` (slate + white chrome):
both are "dark in both themes", but they are different visual languages and mixing them
would blur both. A sheet whose every value is theme-independent should stay a plain
`StyleSheet.create` rather than becoming a factory — `heroStyles` does.

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

### Pre-existing bugs found while migrating (NOT caused by this work)

- **`ServiceRequestDetailScreen` header help icon was white on a white header** —
  `HelpSupportButton` got `color="#FFFFFF"` while `headerOuter` is `BRAND.white`, so the
  control was invisible at v1.0.9. Now brand orange, matching `UserHomeScreen`. This is
  the item flagged earlier as "the help icon as a fill still looks white".
  `ProviderHomeScreen:1001` passes the same white — check its header in Phase 8.
- **`getStatusDescription` is called with three arguments where it takes four** at
  `ServiceRequestDetailScreen`, so `t` lands in `cancelledBy` and the i18n branch never
  runs. Preserved verbatim; fixing it changes copy, which is the owner's call.
- **Status pills failed AA at 2.4:1** — brand orange on amber-100, brand blue on
  blue-100, for both the label and the dot. Each status keeps its hue family but takes
  the accessible token from it.

### Still awaiting an owner decision

| Control | Ratio | Where |
|---|---|---|
| Provider rating "4.8" as orange **text** | 2.69 → **17.85** | fixed — numeral takes body ink, the orange moves into the star |
| Help & support icon (lone orange glyph) | 2.69 → **4.19** | fixed — new `brandOrangeInk`, deepened in light only |

**The help icon is NOT a filled chip**, which is what this section used to propose. That
button and the bookmark beside it share one style and read as a matched pair on
UserHomeScreen; filling one would have broken the pair to fix a number. Deepening the
glyph fixes the ratio and touches no layout. `brand.orangeDeep` (#C2610B) follows the
`brand.blueDeep` precedent already in the palette — "dark enough to read on light
surfaces" — and dark keeps true brand orange, which is already 7.17:1 there.

Both are guarded: `check:contrast` now carries `brandOrangeInk` against `surface` and
`bg` at the UI threshold, **proven to fail** when the glyph is reverted to plain
`brandOrange`.

---

## 10. i18n BUDGET

Baseline 2067 → **2074 now** → 2075 when 5b lands.

- [x] 7 keys — `settings.theme*` (Appearance control)
- [ ] 1 key — `profile.emailPending` = "Check inbox" (HI इनबॉक्स देखें, MR इनबॉक्स पाहा)

Nothing else. A missing key renders `[missing …]`, so parity is gated every commit. If a
state genuinely needs new copy, **flag it — do not invent.**

---

## 11. PHASE 5b — verification defects, all RE-CONFIRMED at v1.0.9

| ID | Defect | Status |
|---|---|---|
| V1 | No in-flight reentry guard; double tap fires two OTP sends | **fixed** |
| V2 | **`?? false` downgrades a verified flag** on a partial response | **fixed + 12 tests** |
| V3 | Concurrent `refreshVerificationStatus` race `setIsProfileLoading` | **fixed** |
| V4 | No cancellation — unmounted screen still writes state | **fixed, dialogs only** |
| V5 | Email has no persistent pending state | **fixed + 12 tests** |
| V6 | Three presentations of the same two booleans | **declined, with reasons** |
| V7 | Five verification rows rendered English in every language | **fixed** (found during V5) |

**V1.** `disabled={verifyingPhone}` is state-driven, so it only applies on the NEXT
render; a fast double tap on a slow device lands both presses inside that window. Two
SMS charged, and the second OTP invalidates the first, so the code the user is reading
stops working. Fixed with synchronous `useRef` guards in `handlePhoneVerify`,
`handleVerifyPhoneOtp` and `handleEmailVerify` — the same pattern as AppContext's
`profileFetchInFlight` and the guard already in `PhoneChangeModal`.

**V2.** The merge is now `src/context/mergeVerificationFields.js`, pure and directly
tested. `?? false` became `?? prev ?? false`, so an omitted field keeps what we already
knew while an explicit `false` from the server still un-verifies. `getCurrentUser`
returns `response.data` verbatim with no schema check, so a backend shape change was all
it would have taken to re-prompt every verified user — and, for providers, to re-trigger
the "verify all" gate on Add Services. `isActive` had the mirror-image bug: `?? true`
would have silently reactivated a deactivated account. **5 of the 12 tests fail against
the old behaviour**, so the defect was real, not theoretical.

**V3 — and why the obvious fix was wrong.** First attempt shared one in-flight promise
between concurrent callers. That is unsafe *here*: ProfileScreen calls
`refreshVerificationStatus()` immediately after a successful OTP, and the AppState
listener fires one when the user returns from their SMS app — a very plausible overlap.
Joining them would hand the post-OTP caller data fetched BEFORE the OTP was accepted and
leave the badge stale, which is the exact bug that call exists to prevent. Replaced with
a reference count on `isProfileLoading`: the requests stay independent, only the flag is
shared, and it clears when the LAST one finishes. **Not unit-tested** — it lives inside
the provider, which needs AsyncStorage, Keychain and axios mocks to mount; noted here
rather than covered by a test that would only assert the mocks.

**V4.** Gated the dialogs, not the state. ProfileScreen is a bottom-tab screen (stays
mounted) but ALSO a stack screen, so it can unmount mid-request; `DialogProvider` is at
the app root, so its dialog outlives the screen and would surface "OTP sent" over
wherever the user landed. `safeDialog` suppresses that. The 11 post-`await` dialogs in
the three verification handlers use it; the 2 pre-`await` ones do not need it. Every
state write after an `await` is deliberately left alone — `refreshVerificationStatus`,
`syncVerificationStatus` and `refreshProfile` write to AppContext and Mongo, and skipping
them would leave a provider's verified flag unsynced.

**V5 — and why it needed no new UI.** Tapping Verify fired a link and showed a one-shot
dialog; the user then leaves to read that mail, and returns to a row that looks untouched,
so they tap again and the backend answers "please wait 85 seconds". The app taught them to
do the thing it then refuses. `InfoRow` already had a styled pending badge
(`otpSentBadge`) that nothing had ever switched on — so this is persistence plus one
label, not a new component. `src/utils/emailVerificationPending.js` keys the record on the
ADDRESS, not just the account, so changing your email drops a link that no longer matters;
it expires after 24h so a missed clear heals itself. Pure core, 12 tests.

**V7 — found while doing V5.** `InfoRow` fell back to literal `'Verified'` / `'Verify'`
and NO caller passed the labels, so all five verification rows rendered English in Hindi
and Marathi. Both keys already existed and were in use elsewhere on the same screen. Only
`profile.emailPending` is new: 2074 → 2075.

**V6 — declined, and this is the reasoning, not a deferral.** Phone and email status does
appear three times (pill strip, contact rows, verification section). But the affordances
already differ — a chevron means "go somewhere", a Verify button means "act here" — so it
reads as redundancy, not a malfunction, and nothing is blocked by it. Against that:
restructuring a 4,409-line screen with two role branches and an inline OTP flow, in an
environment that cannot run the app, to fix something cosmetic. That is not a trade worth
making unasked. **If the owner wants it, it wants a device in hand, not a green suite.**

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
9. **A gate that does not list your file passes vacuously.** `check:light` iterates
   `scripts/migrated-files.json`. The components sweep passed all five gates while those 13
   files were unlisted; adding them surfaced 16 real undeclared changes. **Register a file
   in `migrated-files.json` in the same commit that migrates it**, and re-run the gate to
   confirm it now has something to say.
10. **Track the style block by a line that ENDS with `{`.** A rule keyed on the enclosing
   style key silently moved scope when it hit `shadowOffset: { width: 0, height: 4 },` — a
   nested object on one line, not a new block. Anchor the regex with `\s*$`.
11. **Zero literals is not working code.** The no-undef count is the check that matters:
   `LocationMap` reached zero literals while `CustomMarker` and `UserLocationMarker` still
   referenced a `styles` that no longer existed at module scope. Run eslint per file and
   compare it rule-for-rule against the same file at `HEAD` before calling it done.
12. **Replace order matters when one rule feeds another.** Renaming `WHATSAPP_GREEN` →
   `vendor.whatsappGreen` consumed its own `const` declaration, so the later rule that was
   meant to delete that line found nothing. Delete declarations before renaming references.

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

**Done — all 15 call sites swapped** (the "17 across 15 files" this section used to claim
was stale; the real figure was 15 sites across 14 files). `screenRoots.test.js` now fails
the build if any file outside `Screen.jsx` renders or imports `SafeAreaView`.

**This fixed no live bug, and the tracker previously overstated it.** A survey of all 37
screens found every one already handled insets: 14 via `SafeAreaView`, 21 via
`useSafeAreaInsets`, and `UserAuthScreen` / `ProviderAuthScreen` are pure routers whose
children own their own. Every swapped root also already had a themed background. The swap
buys one primitive, `edges` explicit at 9 call sites that relied on the implicit default,
and a gate — not a repaired screen.

`useSafeAreaInsets` is deliberately NOT restricted by the gate. Padding where it is needed
— a sticky footer, a floating button — is a different and often better pattern than
wrapping the whole tree, and 21 screens legitimately use it.

## 15. RootNavigator — deliberately only PARTIALLY migrated

The floating tab bar carries **two independent light/dark systems** and they must not be
conflated:

1. **Scroll-adaptive tone** (`tabBarTone.js`) — the bar crossfades to a dark material when
   a dark surface slides under it. Its mechanics are still left alone: it is a module-level
   singleton precisely to avoid re-rendering the navigator on every scroll tick.

   ⚠️ **This section used to say "in app-dark mode the content beneath the bar is dark, so
   this system already picks the dark tone by itself". That was FALSE**, and it is the
   reason the owner saw a pale bar on a black app across three builds. The system does not
   sample anything — it reads explicit `<TabBarDarkZone>` markers, and **exactly two
   screens place one** (`ProfileScreen`'s premium cards, `ProviderHomeScreen`'s tips card),
   each around a single dark CARD. In app-dark mode every page is `#000000` and none of
   them registers, so the bar stayed in its LIGHT material — a near-white pill with a blue
   lens — on pure black. That is the "dark blue in black grey" half of the report.

   Fixed by giving the theme the **floor**, not the mechanism: when the app theme is dark
   the tone rests dark and the zone system is not consulted; in light mode the scroll
   behaviour is byte-for-byte what it was. Guarded by `tabBarTone.test.js`, proven to fail
   when the floor is removed.

   **The lesson worth keeping:** this survived because a comment asserted it was fine and
   this tracker repeated the claim, so every later pass trusted the prose instead of
   reading `tabBarTone.js`. When a doc says "this is already handled", check.
2. **App theme** — only ONE value here actually needed it: `glass.fallback`, used solely
   when `SUPPORTS_BLUR` is false, i.e. **low-end Android**. Without the fix a provider on a
   cheap phone in dark mode would have seen a LIGHT pill floating on a dark screen.

Everything else in that file (`tint`, `lensBg`, `lensBorder`, `DARK_*`) belongs to system 1
and is intentionally still literal. **Do not "finish" this file without re-reading the
above** — RootNavigator is therefore NOT on the hex allowlist, on purpose.

## 18. FIXED — washed-out / invisible colours (owner report, beta.3)

Their words: *"black text in black bg or dark blue in black grey"*. I went looking rather
than waiting for screen names. **Both clusters were regressions I introduced during the
migration**, not pre-existing.

### Cluster 1 — an INK token used as a BACKGROUND (the serious one)

`ProviderHomeScreen` and `ProviderHomeTopRow` said `backgroundColor: C.dark`, and `C.dark`
mapped to `textPrimary`. At v1.0.9 those styles said `BRAND.dark = '#0F172A'` — a **fixed
navy brand panel**. `textPrimary` is ink, and ink flips.

| | light | dark |
|---|---|---|
| panel intended | fixed navy | fixed navy |
| panel actual | navy (looked fine) | **near-white** |
| `heroNameInline` on it | **1.00:1** — literally the same colour | fine |
| white subtext on it | fine | **invisible on near-white** |

Three surfaces (the provider home page, its hero header, the mini map card) plus the
greeting. In light the greeting was invisible; in dark the whole screen inverted. That is
the "washed out" report.

Fixed with `stableDark.heroSurface` — the token that exists for a panel that must stay
dark in both themes — and `stableDark.ink` for the greeting, matching the subtext beside
it. Greeting went **1.00 → 17.85:1**.

### Cluster 2 — `on*` ink on a ground that is not its fill

Six styles in `ServiceApprovalsScreen`. All were `'#FFFFFF'` at v1.0.9 and the batch
mapped them to `C.onPrimary` (`onBrandOrange`, near-black in **both** themes):

| style | ground | was | now |
|---|---|---|---|
| `fullscreenDocName` | photo lightbox | **1.18** | 17.6 |
| `uploadingText` | uploading overlay | **1.18** | 17.6 |
| `tapToZoomText` | photo lightbox | **1.18** | 17.6 |
| `imageCounterText` | white-alpha chip | **1.41** | 9.6 |
| `modalRejectionTitle` | danger banner | **2.76** light | 6.47 |
| `modalRejectionText` | danger banner | 3.09 light | 5.91 |

Plus `MapPickerModal`'s confirm button, found by the new gate: its disabled fill was
`textMuted` (ink again) and its label was white on brand orange at **2.69** — the failure
already fixed on every other orange button and simply missed here.

### Why no gate saw any of it

`check:hex` — they are tokens, not literals. `check:contrast` — it grades the 43 pairs it
is *told* about, and nobody declared these. `check:light` — it asks "is this v1.0.9 colour
still reachable from the light theme?", and `#FFFFFF` always is. `check:collapse` — border
never matched fill. **Every one was a correct token used in the wrong place, and nothing
in the suite read usage.**

### The gate that now does

`src/theme/__tests__/inkNotBackground.test.js` — an ink token may never be a
`backgroundColor`. Narrow on purpose: a surface that must stay dark in both themes already
has `stableDark.*` / `premium.*` / `heroGradient.*`, so reaching for ink is always a
mistake and can be enforced rather than reviewed. **Proven to catch the real bug** by
reverting `heroHeader` and watching it fail. Two inverted "selected" filter pills are
allowlisted with reasons.

I also tried a broader polarity detector — "did this ink flip light↔dark since v1.0.9?" —
and **threw it away**: 312 hits, almost all of them correct dark-mode inversion. Recording
that so nobody rebuilds it. The tractable rule was the narrow one.

### Cluster 3 — the floating tab bar (the "dark blue in black grey" half)

Found by checking §15's claim instead of trusting it. The bar never consulted the app
theme, so in dark mode it was a near-white, blue-lensed pill on a black page. Full write-up
in §15. Fixed; the zone system and light-mode scroll behaviour are untouched.

### Owner instructions, 2026-09-26

- **Stop shipping an APK per change.** Builds only when asked, or when a batch is worth
  looking at. Everything still has to pass `npm run verify` before it is called done.
- **Layout and placement in dark mode are a separate, deliberate pass** — the owner's
  words: *"the current ui looks very weird in black dark mode ... i am not talking about
  the colour but the placements of everything"*. That is a real workstream and it is NOT
  colour work; do not start nibbling at it inside colour commits.

## 20. Tonal elevation — why dark mode read as a LAYOUT problem

**The owner said the placements look weird in dark mode, explicitly not the colours.
Measuring first showed nothing had moved.** The same spacing ships in both themes. What
had gone was the cards' ability to read as objects:

| Separation cue | light | dark |
|---|---|---|
| card fill vs page | 11 code values | 14 |
| **shadow vs page** | **221** | **0** |
| elevated surfaces with no border | 48 of 65 | 48 of 65 |

A `#000000` shadow on a `#000000` page contributes exactly nothing, and in light that
shadow is carrying most of the separation. So for 48 of 65 elevated surfaces the only
remaining cue was 14 code values of fill. When a container stops being visible, the
padding INSIDE it and the gap BETWEEN it and the next one become indistinguishable — and
that is what reads as bad placement.

**This is the lesson to keep: a layout complaint in dark mode is usually not a layout
bug.** Moving things to compensate for an invisible container is how a layout becomes
permanently strange.

### What shipped

Elevation by tone, which is what Material 3 and iOS both do on dark for exactly this
reason. The page stays true black — that was the owner's earlier call and is not in
question. Ladder, in code values above the page:

| | was | now | step |
|---|---|---|---|
| `bg` | `#000000` | `#000000` | 0 |
| `surface` | `#0E0E12` (14) | **`#16161C`** | **23** |
| `sunken` | `#18181D` (25) | **`#22222A`** | 35 |
| `elevated` | `#26262B` (39) | **`#2C2C35`** | 45 |

`elevated` is **capped** there: any lighter and `border` drops under 3:1 against it, and
`textMuted` under 4.5. Both were caught by the gates while tuning, not by eye.

New gate: **`MIN_CARD_STEP_DARK = 20`** in `check:contrast`. The page→card step is held to
a higher bar than the rest of the ladder because it is the only cue a borderless card has
left on black. Proven to fail against the old 14-value card before it passed.

### The one place I departed from what the owner approved

The approved plan said the 48 borderless surfaces would also get the crystal border. **I
did not do that**, having read the current guidance: restrained strokes plus tonal
layering is the recommendation, and outlining every card at 4:1 produces the wireframe
look and *attentional fragmentation* — when everything is emphasised, nothing is. Tone now
carries separation; the crystal border stays only where a border was already a deliberate
part of the component. Flagged to the owner rather than done quietly.

Mockup, updated to the shipped state:
<https://claude.ai/code/artifact/908abe2e-f245-4f33-b987-c375aa795ed2>

Sources: Material 3 *Applying elevation* and *Dark theme*; 2026 dark-mode UX write-ups on
cognitive load and figure-ground.

---

## 31. beta.7 feedback — "still not pure black" and the refresh spinner

Owner on beta.7: everything fixed **except pull-to-refresh**, plus "it still doesn't
look pure black", the profile hero looks wrong in dark with no photo, and the profile
has too many breaker lines.

### Why it was not pure black — 12 whole screens

The page token IS `#000000`. But **twelve screens painted their entire page with
`c.surface`** (`#16161C`), so most of the auth flow was a dark grey sheet, not black.

The cause is honest and specific: at v1.0.9 those screens were solid `#FFFFFF`, and the
migration mapped white to `surface`. That is correct in light and wrong in dark, and no
gate could see it — `surface` is a perfectly legitimate token.

Fixed with a new semantic token, **`pageSolid`**: `#FFFFFF` in light (byte-identical to
v1.0.9) and `#000000` in dark. A full-bleed page with no cards on it is a different
thing from a card, and now has its own name.

### Pull-to-refresh — the spinner was fine, the disc was not

I set `tintColor` and `colors` last round and missed the third prop. Android draws the
spinner **on a disc**, and `progressBackgroundColor` defaults to WHITE — a white circle
on a black page. Set on all 15.

**Lesson: `tintColor` + `colors` + `progressBackgroundColor` is three properties, not
two.** Fixing two of three looked complete and was not.

### Profile in dark — approved and shipped

Mockup: <https://claude.ai/code/artifact/74d9ca73-b62a-494d-8b30-f14ee9074692>

**The hero.** One fixed gradient served both themes and its first stop is `#FFF3EA`,
luma **246** — effectively white. It blends into a white page and glares on black,
worst with no photo, when the solid orange avatar disc sits on top of it. Added
`heroGradient.dark`: stops that open at the page and still END on brand
(`#A85408` / `#174A7A`), with `navInk` flipped light. **Ink clears 4.5 against every
one of the eight stops, worst case 4.87** — verified stop by stop, not just at the ends.

**The bands.** 11 sections × a hairline top and bottom = 22 lit 4.26:1 rules in dark.
New `bandFill` token: the v1.0.9 grey band in light, the black page in dark, with the
rules dropped and the gutter widened 9px → 14px. **The breakers stay** — the owner
asked for that explicitly; only how they separate changed, which is the same tonal
logic as §20.

Both dark-only. Light is byte-identical: `navInk` on the light stop still measures
16.37, exactly as before.

---

## 32. beta.8 feedback — the whole ramp was blue, and the profile analysed

### "The home screen bg is bluish"

Not the home screen. **The entire dark ramp carried a blue bias** — every surface in
the app:

| token | was | bias | now | bias |
|---|---|---|---|---|
| `surface` | `#16161C` | +6 | `#191716` | −2 |
| `surfaceSunken` | `#22222A` | +8 | `#252321` | −3 |
| `surfaceElevated` | `#2C2C35` | +9 | `#2F2D2B` | −3 |
| `border` | `#627896` | **+41** | `#84827E` | −5 |

The page was always `#000000`, so the cast only showed on cards and chips — which is
most of the home screen, hence "the home screen". **The luma ladder is unchanged
(0 / 23 / 35 / 45)**, so every contrast ratio and the elevation steps survive the swap
untouched. Barely warm rather than dead neutral, because the brand is orange.

This is the second time the owner has reported "bluish" — the first led to the
true-black page, which fixed the page and left the cast on every surface above it.

### The profile screen, analysed

| symptom | cause | fix |
|---|---|---|
| "bg is grey" | `profileSection` = `surface`, and there are **11 full-bleed sections** — they cover the page | `pageSolid`: `#FFFFFF` in light exactly as v1.0.9, the page in dark |
| "icons dark bg looks weird" | `infoIconContainer` = `C.hairline` → **`bg` = `#000000`** — black holes punched through a card | new `wellFill`: `#F1F5F9` in light exactly as v1.0.9, a LIFTED `#252321` in dark |
| "cover svg cut off half way" | `viewBox="0 0 400 70"` with `slice`, inside a **56pt** band — it scaled to cover and cropped 14 units, cutting the wave tails | viewBox retargeted to `0 0 400 56` and all five paths rescaled ×0.8 |
| rows looked inconsistent | `infoRow`'s rule resolved to `#000000` (invisible on a dark section) while `detailRow`'s used the CARD border at 5.48:1 (far too loud for a row) | new `rowRule`, quiet in both: 1.10 in light, exactly v1.0.9's `#F1F5F9`; 1.34 in dark |

Section gaps widened 14 → 20 in dark, since sections no longer have a fill to group
them — the rhythm now comes from the gap and the section title, which is the standard
grouped-list treatment on black.

**A token named for a colour will eventually lie.** `hairline`, `white`, `darkHero`
were all named after what they looked like in light, and each broke the moment dark
needed something different. `pageSolid`, `wellFill`, `rowRule` and `bandFill` are named
for their JOB, which is why they can hold two values without becoming wrong.

---

## 33. beta.9 feedback — element-level design pass

| report | cause | fix |
|---|---|---|
| "camera icon bg is orange fill fully" | a saturated 32px brand disc at the avatar corner, fighting the avatar | a neutral dark chip with a white glyph, both themes |
| "rating and experience doesn't need that big box" | `statStrip` had a border, radius and a tinted fill around three short numbers | borderless and transparent — the figures are the content |
| "in-between grey of sections looks weird" | the band was fenced by a hairline top AND bottom | no rules in either theme; the gap is the separator |
| "settings orange strip beside the label looks weird" | a 4×18 solid brand slab beside every section header, in **six** screens | removed in all six — the uppercase label carries it, which is what the profile already does, so it is now in sync |
| "drawer name/email/badges/view profile takes too much space" | a CENTRED STACK costing ~270pt before a single menu item | a horizontal row: ~92pt for the same information, whole row still tappable so the "View Profile" link is redundant |

The drawer's slide was already a spring with a parallel backdrop fade and
`useNativeDriver`, so the animation itself was not the problem — the header height was.

**The gate caught a half-fix mid-change.** Repointing the camera chip to a dark fill,
I changed the spinner's colour and missed the glyph beside it, leaving `#0F172A` on
`#0F172A` — exactly 1.00:1. `check:ink` failed the build before it shipped.

### Still open from this round

- **"home should be in sync"** — home's cards are `surface` while the profile's
  sections are now the page. That is a deliberate difference (cards vs a flat list),
  but it may be what reads as out of sync. Needs the owner's eye on beta.10 first.
- **"contrast of some titles and lines is off"** — not specific enough to act on.
  `check:ink` reports dark at 0 and light at 121 known brand-colour items, so a named
  screen is needed.
- **Responsive / overflow audit across device sizes** — not started.

---

## 30. Builds

| build | code | what it carried |
|---|---|---|
| `1.1.0-beta.1` | 37 | first themed build |
| `1.1.0-beta.2` | 38 | true-black dark ramp |
| `1.1.0-beta.3` | 39 | screens complete, `<Screen>`, V1–V4, both AA fixes |
| `1.1.0-beta.4` | 40 | crystal borders, all six maps black |
| `1.1.0-beta.5` | 41 | washed-out colour fixes (ink-as-background) |
| `1.1.0-beta.6` | 42 | tab-bar tone, tonal elevation, icon tiles, logo plate |
| **`1.1.0-beta.7`** | 43 | 60 undefined tokens, dark ink at 0, light brand pass, switch/refresh fixes |
| `1.1.0-beta.8` | 44 | pageSolid (12 screens truly black), refresh disc, dark hero ramp, section gutters |
| **`1.1.0-beta.9`** | **45** | **neutral dark ramp (blue cast removed everywhere), profile screen analysed and rebuilt in dark** |

All built with `USE_DEV_STAGING = false`, so every one hits PRODUCTION on real data.
`android/app/build.gradle` stays UNCOMMITTED per the owner's rule — the version bump
lives in the working tree only.

**beta.7 is the one to look at.** Everything before it was mostly colour; this one
carries the defect that was actually making text invisible (§27) and the first build
where dark mode has been measured end to end rather than eyeballed.

---

## 29. Closing the gate's blind spot — coverage 77% -> 94%

"Dark = 0" is only worth what the checker can actually read. It was skipping **516 of
2,279 pairs (23%)**, so the claim covered three quarters of the app. Instrumenting the
skips by cause showed two dominant, fixable reasons — and fixing them surfaced **10
more real dark bugs that had been hiding in the blind spot**.

| cause | pairs | robust fix |
|---|---|---|
| no ancestor declares a fill | 184 | nothing paints a fill, so what shows through IS the page — grade against it |
| legacy `COLORS` / `BRAND` local palettes | ~130 | read those objects too; they were the least-migrated files and therefore the least checked |
| ground is a `LinearGradient` | 45 | read `colors={[...]}` and grade against every stop — clearing the worst one clears the gradient |
| background is an absolutely-positioned SIBLING | — | model it; `SplashScreen` paints its ground with `<View style={bgBase}/>`, not an ancestor |

Coverage is now **2,007 pairs, 272 unresolvable (12%)**, and the remainder are genuinely
runtime values — a colour from a prop, or a ternary on state.

### The 10 bugs that were hiding in it

`GlobalBanner` — white ink on its orange action button and avatar placeholder (2.69).
`PhoneOnboardingSheet` — near-white ink on the warm CTA gradient (2.07).
`SavedAddresses` — the fixed navy PANEL token used as ink in three more places (1.18).
`SplashScreen` — the version label at 25% white (2.21). `PSATriggerScreen` — a **red**
error icon on the deep-red emergency surface (1.79), and a muted slider label (4.31).

**None of these were reachable before**, because each sat in a file or a pattern the
checker could not resolve. That is the argument for measuring coverage rather than
just failures: a gate that reads 77% of the app reports a clean bill of health for the
other 23%.

---

## 28. DARK MODE IS AT ZERO — the parser-based ink gate

`npm run check:ink` (`scripts/check-ink-on-ground.js`) parses every `.jsx`, walks the
real JSX tree, resolves each `<Text>` / icon / spinner colour against the **flattened
stack of ancestor fills**, and grades the pair in both themes. Text needs 4.5, a
control needs 3.

**Dark: 0 failures, and the gate holds it there.** Light: 98, ratcheted — the baseline
may only go down.

### Why a parser, after three regex attempts

Regex walkers mis-attributed the ground **five** separate times: a footer instead of
the button inside it, props split over lines, the wrong member of a style array, a
translucent chip graded as if opaque, and a single-line style containing a nested
object silently dropped (that last one lost **60 of 191 style blocks per file** and
made correct ink look broken). Every wrong answer was confident and plausible.

### What the gate had to learn to be trustworthy

| It reported | Why that was wrong | Fix |
|---|---|---|
| red icon on a pale red chip, 1.72 | the chip is `rgba(...,0.08)`; graded it as opaque | flatten the whole ancestor stack |
| every button in its disabled state | `cond && styles.xDisabled` is last in the array | skip disabled layers; WCAG exempts inactive controls |
| white title on a navy header, 1.10 | `makeC` values that are not `c.*` resolved to null | resolve through palette groups too |
| a hero back arrow, 1.18 | it sits on a `LinearGradient` this cannot read | mark unresolvable, never guess |
| light baseline 94 | two files had a parse error and were **skipped silently** | unparsed files now fail the gate |

That last one is the sharpest lesson: **a checker that skips what it cannot read
reports progress it has not made.** 94 looked better than the true 101.

### Real bugs it found, after all that

Provider tips card — white ink on its own orange fill (2.00 and 2.22). `SavedAddresses`
header title using the fixed navy panel token as **ink** (1.01 in dark). The rate
button's star, white on gold (2.15). Map service pins, white on orange (2.69). Every
Apple-black spinner and label. And the whole `C.white`-as-ink family, which resolves to
`c.surface` — near-black in dark — on headers and chips that are dark in both themes.

### The 98 light failures that remain, and why they are not a bug list

They are overwhelmingly brand orange at 2.69:1 and brand blue at ~4.4 — **the app's
design language since v1.0.9**, which this whole project has spent 464 declared changes
protecting. Converting them is a brand decision, not a correctness one, and 98 at once
is not a review anyone can do. The gate reports and ratchets them instead.

---

## 27. THE BIG ONE — 60 `C.*` references that resolved to `undefined`

Found while building a parser-based ink auditor. **This is the worst defect in the
project and the most likely source of the owner's original "black text in black bg".**

`C` is a plain object, so `C.textMuted` on a `makeC` that only defines `muted` is not
an error — it is `undefined`. React Native then drops the property:

| written | actual |
|---|---|
| `color: undefined` | falls back to the platform default — **BLACK** |
| `backgroundColor: undefined` | transparent; the surface disappears |
| `borderColor: undefined` | the hairline vanishes |

**60 such references across 19 files**, verified at runtime, not inferred:
`VerificationScreen` alone had 27 (`C.textMuted` ×14, `C.border` ×5, `C.successGreen`
×5, `C.red` ×3). `VerificationDashboardScreen`'s "Premium Header" referenced `C.hero`,
which never existed — so the header had **no background at all** and its near-white ink
rendered on the page: invisible in BOTH themes.

**Nothing could have caught it.** eslint's `no-undef` sees a property access on a
defined object and is satisfied. `check:hex` sees no literal. `check:contrast` never
learns the pair exists. It is only wrong at runtime, on a device, and often in only one
theme. That is why it survived every previous sweep in this file.

### The fix

118 references repointed to keys that exist, and 18 keys added where the name was
meaningful — each reproducing its **v1.0.9 value**, recovered from git rather than
guessed: `hero`/`darkHero` → `stableDark.heroSurface` (`#0F172A`), `star` →
`iconAccent.star` (`#F59E0B`), `selected` → `altBlueIndigo` (`#2563EB`), and so on.

### And the gate caught me mid-fix

Mapping `C.dark` → `C.text` was right in two files, where `dark` was a text colour. In
`InsuranceScreen` it was the **heroHeader's background**, so the repoint recreated
exactly the ink-as-background inversion from §18. `inkNotBackground.test.js` failed the
build before it shipped. **A gate written for an earlier bug caught a new one — that is
the whole return on writing them.**

### New gate

`npm run check:tokens` → `scripts/check-token-refs.js`, wired into `verify` before
`check:hex`. Deliberately dumb and exact: collect the keys `makeC` returns, collect
every `C.` reference, diff them. No heuristics, so no false positives. Proven to fail on
a reintroduced typo.

---

## 26. Switch thumbs — one was invisible, and the three disagreed

Continuing §25's theme: native props the colour gates cannot see.

**`SettingsScreen`, Android, switch ON: `thumbColor` was `C.primary` and
`trackColor.true` was also `C.primary` — 1.00:1.** The thumb vanished into the track in
BOTH themes, on every toggle in Settings. Material's own switch gets away with
thumb-equals-primary because its track is translucent; this track is fully opaque, so
the two matched exactly.

The three switches also disagreed. The other two used `C.white`, which maps to
`c.surface` — so their thumb turned **near-black in dark**. Readable (6.7:1) but not what
a switch thumb should do, and not what iOS does two screens away.

All three now use `brand.plate`: a fixed white thumb, identical in both themes, which is
what iOS ships natively and what the `onIosAccent` branch in Settings was already doing.

**Rule worth keeping: a switch thumb must never resolve to its own track.** That is not
something any existing gate can express, because both live in JSX props rather than a
stylesheet.

---

## 25. Native component colour props — RefreshControl

The last class the gates cannot reach: props on NATIVE components. They are not in a
StyleSheet, so `check:hex`, `check:contrast` and `check:collapse` never see them, and a
missing one silently falls back to a platform default.

All 18 `<RefreshControl>` were inconsistent three ways:

- **3 declared no colour at all** — `CreateServiceRequestScreen`, `ServiceApprovalsScreen`,
  `SubscriptionScreen`. They got the platform default, which is a mid-grey on iOS: dim on
  a black page, and nothing like the brand orange the other 15 use.
- **6 set only ONE platform.** `tintColor` is iOS, `colors` is Android; setting one leaves
  the other on its default, so the two platforms disagreed on the same screen.
- The remaining 9 were already correct.

All 18 now set both props to the same value, each screen keeping its own accent —
`C.primary` on most, `C.secondary` on the blue ones, `C.accent` on
`CreateServiceRequestScreen`, and `stableDark.ink` on the provider hero, where the
spinner sits on the navy panel and must stay white in both themes.

**`tintColor` and `colors` are one setting wearing two names.** Worth remembering for any
future native prop: `placeholderTextColor`, `Switch`'s `trackColor`/`thumbColor`,
`selectionColor`. None of them are reachable by the colour gates.

---

## 24. Icon and skeleton audit — mostly a clean negative

Audited all **674** icon colour props. 59 use an ink that is dark in both themes;
resolving each one's real ground showed all but one sit correctly on a bright fill.
Skeletons are fine too: `ShimmerLoader` goes through `useSkeletonSurface()`, and the
provider-hero skeletons use `stableDark.*` on the navy hero, which is right in both
themes. **A clean negative is worth recording** — it stops the next person re-running it.

### The one real find, and why I nearly dismissed it

`UserHomeScreen` has two identical-looking retry buttons:

```
L1615  style={[styles.retryButton, { backgroundColor: C.primary }]}   <- orange override
L1627  style={styles.retryButton}                                      <- base blue fill
```

Both painted their icon `C.onSecondary`. I first called this "a harmless semantic slip,
since both inks resolve to the same near-black" — **that was wrong**. `onBrandBlue` is
**`#FFFFFF`** in light; only `onBrandOrange` is near-black. So the overridden button was
**white on orange, 2.69:1**. The unoverridden one is correct and stays as it is.

### On the tooling

The ground-resolver mis-attributed three times across this and §23 — it read a footer
instead of the button, missed multi-line JSX props, and picked the wrong member of a
style array. I patched it twice and it still only went from 22 to 24 correct out of 59,
so I stopped and finished by hand. **Resolving a JSX ancestor chain properly needs a real
parser, not a regex walker**; that is worth building only if this class recurs. What
carried the audits was measuring a specific pair, not trusting the tool's grouping.

---

## 23. Apple sign-in spinners — near-black on Apple black

Audited every `<ActivityIndicator>` colour: 48 use an ink that is dark in BOTH themes,
which is correct on a bright button and invisible anywhere else. Almost all sit on
`C.primary` / `C.secondary` / `C.success` and are fine. Three were not:

| site | ground | was | now |
|---|---|---|---|
| `LoginScreen` apple pill | `vendor.appleBlack` | **1.18** | 21 |
| `UnifiedUserAuthScreen` apple circle | white 20% over appleBlack = `#333333` | **1.41** | 12.63 |
| `RegisterChoice` apple circle | same | **1.41** | 12.63 |

Also fixed an inconsistency between two copies of the same row: `RegisterChoice`'s
`appleGlyph` correctly used `vendor.onVendor`, `UnifiedUserAuthScreen`'s used
`C.onPrimary`. Both are now white, which is Apple's spec for their black button.

**Two near-misses worth recording**, because the method matters more than the fix:

1. The `providerOtpInput` spinner measured 1.00:1 and looked like the worst bug of the
   set. It is **not a bug** — my container-finder had walked up to the wrong style. The
   spinner's real ground is `providerOtpBtnEnabled` (`C.success`, 5.02 / 9.29), and the
   disabled fill is only reachable when no spinner is showing. I nearly "fixed" working
   code.
2. I then computed the Apple circle against `optionCard` (white) and concluded my own
   fix was a light-mode regression. Wrong again: the row is
   `[optionCard, appleCard]`, and `appleCard` is `vendor.appleBlack`. **A composite is
   only as good as its base — resolve the base from the JSX, not from the first style
   whose name looks right.**

---

## 22. Service icons — twenty opaque white PNGs (owner report)

Owner, 2026-09-26: *"they are looking very weird with black around them and they are
white bg ... make a foggy black white aesthetic behind them and round their corners"*.

**All 20** 3D service icons are 240×240 PNGs with an **opaque pure-white background**
baked in. Nothing in the theme can reach inside an image, so on black they rendered as
twenty hard white squares.

Every one of them goes through `ServiceIcon` in `Icon.jsx`, so this was a single change:

- **clip to a squircle** — `borderRadius = 0.26 × size`, so it reads as an app tile
  rather than artwork pasted down
- **a fog plate behind it** — `icon3dPlate`, which is `stableDark.fillSubtle`
  (rgba white 0.08) in dark and **`transparent` in light**, where the icons already sit
  on white cards and need no help
- **footprint unchanged at `size`**; the artwork insets to 88% so the halo is visible.
  No layout moves.

`overflow: 'hidden'` on the wrapper because Android will not clip a child's corner radius
without it.

⚠️ **The component's comment claimed these tiles had "rounded-squircle corners baked in
(transparent corners)". They do not** — measured, all 20 opaque. That is the second false
comment to cost real time this week, after §15's tab-bar claim. Both are now replaced
with what was measured.

Mockup: <https://claude.ai/code/artifact/d04d1ed1-14c9-4ee9-b368-8c6c4a6f7437>

---

## 21. Opaque image assets — the logo was a white square on black

Audited the image assets after the elevation work, on the theory that a themed surface
cannot fix an asset that carries its own background.

| asset | format | alpha | corner |
|---|---|---|---|
| `fixhomi_logo.jpg` | JPEG | **none** | pure white — used in **11 places** |
| `brand_footer_user.jpg` | JPEG | **none** | light blue |
| `brand_footer_provider.jpg` | JPEG | **none** | light blue |
| `hero_home_services.png` | PNG | yes | transparent — fine |

A JPEG cannot be transparent. The logo is an orange-and-blue mark (18% / 8% of pixels)
**on a white plate**, and that plate ships with it.

**The defect** was the two CIRCULAR logo buttons whose fill was `C.white`
(`UserHomeScreen.topBarLogoBtn`, `ProviderServiceHistoryScreen.headerLogoBtn`). In light,
white circle + white-backed logo read as one tile. In dark the circle became `#16161C`
and the logo stayed pure white: **a white SQUARE floating inside a near-black CIRCLE.**

**Fixed with `brand.plate` (`#FFFFFF`)** — the container stays light in both themes, so
the mark renders as the brand tile it already is in light. Light mode is pixel-identical.

**Why not make the logo transparent instead**, which was the first instinct: the mark is
specified against white, and its blue component is only 3.0:1 on black. Punching the
plate out would put the brand on a ground it was never designed for, and would also
change the splash screen, where the white disc is deliberate. A light plate under a brand
mark is standard on dark UIs and keeps brand fidelity.

**Not changed:** `ProviderHomeScreen.headerLogoBtn` (already a white tile on the navy hero
in both themes since v1.0.9) and the two modal `logoContainer`s (72px rounded brand tiles,
which is what they look like). The two brand-footer JPEGs are light rectangles by design.

---

## 19. Crystal borders and black maps (owner request, 2026-09-26)

**Borders.** The dark border ramp is now a lit, cool edge instead of a dull grey:

| Token | Was | Now | vs card | vs page | vs elevated |
|---|---|---|---|---|---|
| `border` | `#42424A` | `#627896` | 4.26 | 4.65 | 3.33 |
| `borderMedium` | `#52525C` | `#7C93AC` | 6.08 | 6.63 | 4.75 |
| `borderStrong` | `#757581` | `#9DB2C7` | 8.83 | 9.63 | 6.90 |

Cool and slightly blue, not grey — a neutral line at this brightness reads as a wireframe;
biasing it toward the light end of the slate ramp reads as glass catching light.

`MIN_BORDER_SEP` in `check:contrast` went **1.45 → 3.0** to match: the border is now *how*
a card separates, not merely a help, so it must clear the 3:1 a meaningful boundary needs
on its own. **The raised floor immediately earned itself** — the first candidate (`#5C7089`)
looked right at 3.79 on a card but was 2.96 against `surfaceElevated`, and the gate caught
it. Reverting to the old dull border now fails the build; proven.

**Maps.** All six `MapView` sites now take their style from `getMapStyleURL(isDark)` in
`src/config/mapbox.js`. Before: two flipped to `TrafficNight`, and **four were hardcoded to
`Street`, so a dark-mode user got a glaring white map on four of six screens**.

`StyleURL.Dark` (`dark-v10`), not `TrafficNight` — the latter is
`navigation-preview-night`, a NAVY basemap built to sit under turn-by-turn directions, and
against a true-black app it reads as a blue panel.

**`useIsDark()` came out of this.** Wiring the four hardcoded maps with `useTheme()` broke
6 of the owner's `providerHomeTopRow` tests, which render the component bare — `useTheme`
throws without a provider, by design. Fixed at the root, not in the owner's test: a
read-only `useIsDark()` that falls back to light. It also surfaced a real latent bug —
`FALLBACK_CONTEXT` had no `isDark` at all, so every read-only consumer got `undefined`
rather than `false`. Both are now regression-tested.

---

## 17. The crash screen reads the theme WITHOUT context

`ErrorBoundary` is mounted **above** `ThemeProvider` in `App.tsx` — deliberately, or it
could not catch a crash inside the provider. That placement means it can never read theme
context: `useThemeColors()` called from there, or from a wrapper around it, is outside the
provider and always returns the light fallback. A dark-mode user would get a full-screen
white flash at the exact moment the app fails.

So `src/theme/lastResolvedTheme.js` is a module singleton: `ThemeProvider` **pushes** its
resolved name in an effect, and the crash screen **pulls** it synchronously — no context,
no hooks, no storage read on the crash path. It falls back to `Appearance.getColorScheme()`
(covers a crash before the provider ever mounted), then to light, and every step is wrapped
because a throw there would take down the one screen whose job is surviving a throw.

**This is not a general escape hatch.** A module singleton does not re-render, so any live
component reading it would go stale on a theme switch. The crash screen is exempt only
because it renders once, after the tree it would have re-rendered with is already gone.
`src/theme/__tests__/lastResolvedTheme.test.js` asserts the dark path and asserts that
`ErrorBoundary` contains no hook *call*.

---

## 14. MOCKUPS (approved)

| What | URL |
|---|---|
| Verification surface (rev 2) | https://claude.ai/code/artifact/f5961c34-2e16-4418-9c08-7f9bac4ba605 |
| Working Hours, light + dark | https://claude.ai/code/artifact/4c095340-50d6-4cf7-be3d-3aeb083cbab1 |
| Home + verification, near-black | https://claude.ai/code/artifact/98258b2b-958d-4a9f-b55e-2a8b1b76ecfb |
| Dark ramp options (decision record) | https://claude.ai/code/artifact/35b84bee-5966-4e05-8533-2ea20ad5a079 |
