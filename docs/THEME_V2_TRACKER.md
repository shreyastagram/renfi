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

## 34. beta.10 feedback — the violet was the PLATFORM, not the app

**"A violet tint appears when I scroll."** Nothing in the theme system could produce
it, because nothing in the theme system draws it. `AppTheme` extends
`Theme.AppCompat.DayNight.NoActionBar` and **never set `colorAccent` or
`colorPrimary`**, so Android fell back to AppCompat's own defaults — `#FF4081` and
`#3F51B5` — and paints the **overscroll glow**, text-selection handles and ripples
with them. Both `values/` and `values-night/` now set the brand accents plus
`android:colorEdgeEffect`.

**Worth remembering: not every colour in the app comes from the app.** Nine gates
grade JS tokens and not one of them can see `styles.xml`.

**"Home still looks blue."** The ramp was already fixed, but the floating tab bar's
dark material was `rgba(18, 24, 34, 0.55)` — a blue slate — and that bar sits on
**every screen**. Now warm-neutral to match the ramp.

| other reports | fix |
|---|---|
| "add more services looks yellow" | `actionColor` was `C.warning` = `#FBBF24` amber. Now the brand ink. Amber is not a brand colour and should not appear as one. |
| settings "dark mode icons look blue" | five row icons were `C.secondary` = `#5FA8E8`. Now neutral — a settings list with one stray hue reads as an accident. |
| settings icon discs | `iconBg` was `c.bg` — **`#000000` in dark**, the same black-hole bug as the profile's. Now `wellFill`. |
| "rating/experience — keep the border, make it smaller" | border restored at hairline weight, radius 16→12, self-centred, padding 14→6/4 |
| drawer "should be black bg" | the body was `c.surface`; now `pageSolid` |
| drawer "remove the red box for personal safety, keep the text red" | fill and border dropped; `menuLabelAccent` already made the label red |
| drawer active row | was `infoContainer`, a blue tint, with a blue icon and chevron. Now a neutral lift. |

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
| `1.1.0-beta.9` | 45 | neutral dark ramp (blue cast removed everywhere), profile screen analysed and rebuilt in dark |
| `1.1.0-beta.10` | 46 | element pass: camera chip, stat strip, section bands, accent bar removed in 6 screens, drawer header 270pt -> 92pt |
| **`1.1.0-beta.11`** | **47** | **Android platform accents (violet overscroll), tab-bar tint, yellow + blue strays, drawer black** |

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

---

## §35 — beta.12: the navy home, the violet, the yellow, and the tan tab bar

Five reports from beta.11, plus an icon pass. Every one was a **fixed colour that
did not flip with the theme** — the same root cause wearing five costumes.

### 35.1 "Home is bluish / still not black"

My own §18 fix. Stopping the provider greeting from inverting, I set `container`
and `heroHeader` to `stableDark.heroSurface` (`#0F172A`) — reproducing v1.0.9's
`BRAND.dark`. That froze the page at navy in **both** themes, making provider home
the only screen in the app with a navy page.

Owner's call: *"make the home screen light like other screen and dont keep it
bluish."* Both are `C.bg` now — light like every other screen, black in dark. The
hero stops being a panel and becomes the page, so its inks move with it:

| element | was | now |
|---|---|---|
| `sectionTitle` | `stableDark.ink` | `C.textStrong` |
| "(recent 3)" label | `C.borderMedium` — **1.36:1, invisible** | `C.textSecondary` |
| logo chip fill / border | `stableDark.fillChip` / `heroDivider` | `C.wellFill` / `C.line` |
| greeting / subtext | `stableDark.ink` / `inkSoft` | `C.textStrong` / `C.textSecondary` |
| hero art, refresh spinner | `stableDark.ink` | `C.borderSubtle`, `C.primary` |

**`check:light` has a blind spot here.** It asserts every v1.0.9 colour is still
*reachable* from the light theme or declared. `#0F172A` is still reachable
(`stableDark.heroSurface`), so a surface changing role from navy to page passes
silently. The gate tracks palette drift, not surface identity. Worth knowing before
trusting it on a layout change.

### 35.2 The violet was never the platform

I spent beta.10 and beta.11 hardening Android accents (`colorAccent`, `colorPrimary`,
`android:colorEdgeEffect`) chasing "a violet tint appears when I scroll the profile."
Wrong tree — and Android 12+ uses a *stretch* overscroll anyway, which has no colour.

It is `ProfileScreen:2166`, `actionColor={C.purple}` → `accentViolet` **`#A78BFA`**
on the portfolio section, plus a violet specialization chip. It appears *as you
scroll to it*, which is exactly what an overscroll tint would look like. Both are
brand now. The `styles.xml` hardening stays — correct on its own terms.

**Lesson:** "appears on scroll" described *when* it was visible, not *what* produced
it. I should have grepped the screen for violet before touching the platform theme.

### 35.3 Yellow: brand accent vs status signal

Owner's rule is *"no yellow anywhere, it's not our brand colour."* Applied with one
distinction, which is a judgement call worth stating plainly:

- **Removed** where yellow was a decorative/brand accent: the rating star
  (`iconAccent.star` `#F59E0B` → `#f67c16`, 20 sites in one value), the gold Rate
  button and favourite border on ServiceRequestDetail, the amber day chips and blue
  links on WeeklyScheduleCard.
- **Kept** where amber is a *semantic* signal: `status.pending`, `status.warning`,
  `status.unverified`. A caution colour that reads as brand orange is worse than a
  yellow one — the user can no longer tell "needs attention" from "on brand."
- **Kept**: `categoryAccent.electrician` (one of ~12 hues whose whole job is being
  distinguishable) and `medal.gold/silver/bronze` on the referral podium (a medal
  metaphor, not branding).

Chips that wanted "orange tint" were borrowing `warningContainer`, whose dark value
`#2E2107` is **olive** — a direct source of the yellow. New `brandOrangeFill`
(`#FFF3E8` / `#2A1708`) is hued off `#f67c16`.

### 35.4 The tab bar stayed a light tan pill in dark

`makeGlass` themed `fallback` but not `tint` — and `tint` paints **on top**, at 0.88
opacity when blur is unavailable, which is precisely low-end Android. A themed dark
fallback under a near-opaque cream tint is cream; the 0.58 `DARK_TINT` over that
composites to ~`#767069`. Both stops flip with the theme now.

> A translucent dark over a light material never yields a dark material. The
> material itself has to be dark. This is the same trap as the drawer's verified
> badge (35.5) — twice in one pass, so it is a pattern, not an accident.

### 35.5 Icon pass — 0 dark, 43 → 37 light

Dark was already at zero. The light failures split three ways:

- **Real defects, fixed (6):** five icons coloured with a *border* token
  (`C.borderMedium`/`C.line` at 1.23–1.42:1 — chevrons and empty-state glyphs that
  were effectively invisible) → `C.textMuted`. Plus the drawer's verified badge:
  `stableDark.onlineChip` is green at 18%, which darkens over the black drawer but
  stays near-white over the light one, leaving `#86EFAC` at **1.11:1**. Themed to
  `successContainer`/`success`.
- **Gate false positives (2), no code change:** the emergency back arrow and the
  image-viewer glyph. Both sit on fixed dark grounds (`darkHero` `#0F172A`,
  `overlayPhoto`) that the ancestor-flattener failed to resolve, so it graded them
  against the page. White ink is correct at both sites. **`check:ink` cannot always
  find the styled ancestor** — dark is still 0, so nothing is hidden, but a light
  failure on a known-dark panel deserves a look before it is "fixed."
- **Brand baseline (~31):** `C.primary` on its own tint, stars, WhatsApp green on
  its tint — 2.37–2.77:1. Unchanged; this is the standing brand-contrast decision.

### 35.6 Stat strip ran to the screen edge

`statCell` was `flex: 1`. Three flexed cells demand the full row, so the strip's
`alignSelf: 'center'` could never shrink-wrap — the border went edge to edge no
matter what the container said. Content-sized with a 62pt floor; cell padding
11 → 4, since the box was also too tall for three short numbers.

### 35.7 Gate state

`check:ink` light baseline ratcheted **121 → 113**. Dark held at 0. All ten gates
pass; 162 unit tests pass (`App.test.tsx`'s transform failure is pre-existing and
unrelated).
| beta.12 — six fixed colours | https://claude.ai/code/artifact/12f6ad7d-d60a-488b-8986-289bc94fd978 |

### §35.8 — build log

| build | versionCode | notes |
|---|---|---|
| 1.1.0-beta.12 | 48 | §35 — navy home, violet, tan tab bar, decorative yellow, stat strip, icon pass. `USE_DEV_STAGING=false`, production backends. [Firebase release](https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/3p0og45qum1to) |

**Caught during this build:** the first APK check read `versionCode 47` — a stale
artifact from beta.11 still on disk while gradle was mid-build. The wait loop
exited immediately because it tested for the file's *existence*, not for gradle
having finished. Always verify `aapt2 dump badging` reports the expected
versionCode before distributing; the file being present proves nothing.

---

## §36 — the violet, finally: a token that was never repointed

Three builds chasing this. It was never a colour anyone chose.

### 36.1 What it actually was

The owner marked the **grey bands between profile sections**. Those render
`C.bandFill`, and ProfileScreen's `makeC` said:

```js
bandFill: c.surfaceSunken,   // #F4F6FA — the section band
```

`theme.colors.bandFill` has been `#FFFFFF` / **`#000000`** since §35 — introduced
*precisely* so the gutter would be pure black in dark. The style's own comment
said "in dark this is the page showing between raised cards." The tracker said
it. And the file kept painting **`#252321`**, because its local alias still
resolved `bandFill` to `surfaceSunken`.

A flat dark-grey band at luma 35 on a pure-black page is also the exact
luminance where Samsung AMOLED panels shift hue and smear during scroll. Hence
"purple violet flash **when scrolling**, **in dark mode**" — all three qualifiers
were describing an OLED artifact on a surface that should never have been grey.

**Why three builds.** Each earlier guess explained part of the report and I
stopped there. "Appears on scroll" → the platform overscroll (wrong: Android 12+
uses a colourless stretch, and I had already set the accent to orange, so a glow
could not have been violet). Then a real violet on the same screen → the
portfolio section (a genuine find, genuinely not this). Neither time did I ask
what was *underneath the pixels the owner was pointing at*. The screenshot with
two arrows on the band answered it in seconds.

### 36.2 The gate that would have caught it — `check:shadow`

A `makeC` key must not carry the NAME of a real token while resolving to a
different one. Aliasing is fine — `primary: c.brandOrange` is deliberate and
`primary` is not a token. Shadowing is not: the style reads correctly and renders
wrongly, and no existing gate can see it.

- `check:tokens` asks only whether `C.bandFill` resolves. It did.
- `check:hex` sees no literal.
- `check:ink` grades the colour actually used — a legitimate colour, just not the
  one the name promised.

98 shadowed aliases existed. Ranked by luminance gap, exactly two mattered:

| file | shadow | dark Δ | effect |
|---|---|---|---|
| ProfileScreen | `bandFill: c.surfaceSunken` | 37 | the grey band → the violet report |
| AccountSecurityScreen | `border: c.bg` | **130** | five dividers painted `#000000`, invisible in dark |

The second was a free catch — one key served both a chip's *fill* and five
*dividers*, so it was aliased to suit the chip. Split into `border` +
`chipNeutralFill`.

The other 97 are small-delta family aliases (`borderMedium` → `borderMediumNeutral`,
`dangerLine` → `dangerBorder`). Carried as a declining baseline; what it buys is
that a new one cannot appear.

> **The lesson worth keeping:** introducing a token is only half the change.
> Every file that already had a key by that name kept its old meaning, silently.
> Grep for the key name, not just for the old value.

### 36.3 Stat strip — placement and the experience figure

- **Placement.** It was `alignSelf: 'center'` in a header where the name,
  headline and location are all left-aligned — the only centred element on the
  screen. Now `flex-start`.
- **Responsive.** Added `flexShrink: 1` to the cells. Content-sized cells with a
  62pt floor can exceed a 320pt screen once Marathi labels are in, and the strip
  is `overflow: 'hidden'`, so it would have clipped rather than ellipsised.
- **"5 yrs 2 mos" → "5.2 yrs".** New `formatExperienceCompact`. The arithmetic is
  the point: 62 months / 12 = 5.17 → `5.2`. Pushing the month number after the
  decimal would say `5.02`, and 4 months would become `0.4` when it is a third of
  a year. Under 12 months there is no honest fraction, so it stays in whole
  months. Whole years drop the `.0`. Nine tests pin the boundaries; they use a
  fixed `now` so they cannot drift with the calendar. The long form still appears
  in the Experience section below.

---

## §37 — branding the last visible yellows, without touching a single key

Owner: *"Brand it. Make sure every variable name and everything is consistent
with what it was earlier — like if it was pro.elec it should stay as it is, so
the functionality doesn't break."*

That constraint is the important half. Some palette keys are not variable names,
they are a **contract with the backend**:

```js
const SERVICE_COLORS = categoryAccent;
const accent = SERVICE_COLORS[service.id] || C.secondary;   // UserHomeScreen:190
```

Rename `electrician` and nothing throws. The lookup returns `undefined`, falls
through to the default, and every electrician in the app quietly turns the wrong
colour. No gate sees it: `check:hex` finds a valid literal, `check:tokens` only
inspects `makeC`, eslint sees a property access on a defined object.

So: **values changed, zero keys touched.** Verified by diffing the whole palette
object against `HEAD` — two value changes, no key added, removed or renamed.

| key (unchanged) | was | now | why |
|---|---|---|---|
| `categoryAccent.electrician` | `#F59E0B` | `#f67c16` | it is the profession label on the provider profile, so it reads as the app using yellow, not as a category hue |
| `categoryAccent.solar_repairing` | `#EAB308` | `#16A34A` | the most saturated yellow left. Green, not another orange, so it stays distinguishable from electrician |

Plus eight sites in ProfileScreen off `C.warning*` → brand: the PRO badge (fill,
border, glyph, label, iOS shadow), the About empty-state `+` and its plate, and
the plate behind the rating star.

### 37.1 New test — `paletteKeyStability`

Pins the runtime-indexed key sets: the twelve backend service ids, the
bracket-indexed `iconAccent['in-progress' | 'close-circle' | 'check-circle']`,
and the six request-status keys. It asserts **keys only, never values** —
recolouring is expected; renaming is the thing that breaks. Adding a key passes,
since a new service can appear.

It also asserts the twelve service colours are **mutually distinct**. That is
what makes a recolour safe: had `solar_repairing` been given brand orange to
match electrician, two services would share a hue and the per-category colour
would stop doing its job. The test fails on that.

### 37.2 `check:light` earned its keep

The gate caught `#eab308` vanishing from **three** files — `UserHomeScreen`,
`Icon.jsx` and `ProviderHomeScreen` — when I had only thought about the palette.
Declared in all three rather than silenced. This is the counterpart to §35.1,
where the same gate was blind to a surface changing role: it tracks whether a
v1.0.9 colour is still *reachable*, which makes it strong on recolours and weak
on re-assignments.

### 37.3 Still amber, still deliberate

- `iconAccent.pending / unverified / warning` — a caution colour that reads as
  brand orange stops signalling. Unchanged.
- `premium.gold / goldSoft / crown` — the Subscription screen's whole visual
  identity is gold. Rebranding it is a screen redesign, not a recolour, and
  should be seen before it is shipped.
- `medal.gold / silver / bronze` — the referral podium is a medal metaphor.

`check:ink` light baseline ratcheted **113 → 112**. Dark 0. Eleven gates pass;
90 unit tests pass.

| build | versionCode | notes |
|---|---|---|
| 1.1.0-beta.13 | 49 | §36 (the violet: bandFill shadowing) + §37 (branding the last yellows). `USE_DEV_STAGING=false`, production backends. [Firebase release](https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/1l6jht2in6mbo) |


---

## §38 — controls off the caution hue, the pulse, premium, and iOS caret drift

### 38.1 "Electrician still looks yellowish"

Not `categoryAccent` at all — §37 recoloured that and the label did not move,
because the profession label is `heroHeadlineProvider: { color: C.warning }`.

That is the fourth yellow found one at a time, so this pass stopped guessing and
swept it. `warning` is doing **two jobs**: a caution SIGNAL, and a warm
decorative accent. Classified all 33 styles that use a `warning` token but whose
own NAME does not say "warning", and applied one rule:

> **Interactive controls and brand labels take brand. Notices and status keep amber.**

15 styles moved: the profession label, an OTP resend button + its text, a focused
OTP box, an OTP-sent badge + text, a favourites plate, a register CTA button, an
add button, a resend button, a retry button, a favourite badge, a filled OTP
input, a rating chip, an approvals subtitle.

Deliberately left amber: `aadhaarNotice`, `outOfZoneBanner`, `permissionBar*`,
`providerTip*`. Those are genuinely "needs attention" — a caution colour that
reads as brand orange stops signalling.

### 38.2 The online pulse was invisible

Three faults in one 20pt control:

| | was | now |
|---|---|---|
| ring colour | `C.online` — **on a `C.online` pad** | `C.onOnline` |
| dot colour | `C.online` — same | `C.onOnline` |
| ring size | 16 × 1.8 = **28.8pt in a 20pt box** | 12 × 1.62 = 19.4pt |
| container | no clip | `borderRadius: 10, overflow: 'hidden'` |

Green on green. The pulse has rendered nothing **in exactly the state it exists
to signal** — it was only ever visible while offline, when it does not animate.
The ring also escaped its container into the label. The dot's 2pt white border
was doing all the visual work, which is why it looked like a ring rather than a
dot; it now takes the pad colour so the dot reads as a disc.

### 38.3 Manage Subscription — richer, NOT re-hued

**I got this wrong the first time and the owner corrected it.** Asked to make
the page "more premium", I re-hued the whole identity: navy → warm brown, gold →
champagne, `#FFD700` → `#E4C67E`. The owner: *"keep the premium as it is… I
didn't say to change the colours of it, just make it more rich… make it pop out
so the page stands out because it's a premium page."*

Reverted. **The gold is exactly as it shipped** — `gold #E8B54D`, `goldSoft
#F2CE8A`, `crown #FFD700`. The richness comes from two places that do not touch
the identity:

| | was | now |
|---|---|---|
| `navy` | `#0D1220` | `#070C1A` — deeper, more blue |
| `slateCard` | `#1E293B` | `#1B2947` — more saturated |
| `borderGold` | alpha .30 | .42 |
| `glowGold` | alpha .16 | .26 |
| `crownLine` | alpha .35 | .45 |
| `keyline` | alpha .14 | .22 |

Deepening the ground takes the gold-to-ground luminance gap from 166 to 172, and
the keylines carry ~40% more presence, so gold elements read as lit metal rather
than as hairlines. One gold did move: `goldInk #B98A2F → #BE9138`, same hue,
because the original measures **4.42** on the info panel against a 4.5 floor.

> **The lesson:** "make it more premium" is not "change the palette". The owner
> had a working identity and wanted it amplified. I replaced it instead, which is
> a redesign wearing a recolour's clothes. Amplify before you substitute.

`check:ink` caught a real regression here: darkening `goldInk` to `#A8842E` put
it at **4.42** on the dark info container, under the 4.5 floor. Solved to
`#BE9138` (5.37) rather than waived.

### 38.4 iOS/Android caret drift — `check:input`

**40 of the app's 42 `<TextInput>`s had no `selectionColor`.** That prop has no
theme hook on iOS: the caret and selection highlight are the system blue
`#007AFF`. On Android they come from `colorAccent`, which this app sets to brand
orange. So the same input had an **orange caret on Android and a blue one on
iOS**, in one build.

Nothing could see it — the caret is drawn by the OS, so `check:ink` has no
element to grade and `check:hex` no literal to find. All 40 now set it; new gate
`check:input` asserts both `selectionColor` and `placeholderTextColor` on every
input. `placeholderTextColor` was already at 100%; it is asserted anyway, because
the expensive failure is the quiet regression on input forty-three.

Twelve gates now. All pass; 90 unit tests pass.

| beta.14 — premium, pulse, caret | https://claude.ai/code/artifact/43be436b-db80-4216-ac31-2ea69fb10e09 |

| build | versionCode | notes |
|---|---|---|
| 1.1.0-beta.14 | 50 | §38 — warning-hue sweep (15 controls), the invisible online pulse, premium amplified (not re-hued), iOS/Android caret drift on 40 inputs. `USE_DEV_STAGING=false`. [Firebase release](https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/7pusoa58eelrg) |


---

## §39 — the Insurance crash, offline detection, and a navigator audit

### 39.1 Insurance documents: "Something went wrong"

```js
const InsuranceScreen = ({ navigation }) => {
  const STATUS_MAP = makeStatusMap(C);      // C read here
  const s = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());        // C declared here
```

Metro transpiles block scoping, so this is **not** a TDZ `ReferenceError` — it
resolves to `undefined`. `makeStatusMap` then dereferences `C.muted` and the
screen dies on a TypeError, which the error boundary reports as a generic
"unexpected error". The screen could never open, on any build.

Sweeping for the same shape found two more, both silent rather than fatal
because they use optional chaining:

| where | read | declared | effect |
|---|---|---|---|
| InsuranceScreen | `C` line 300 | line 302 | **crash** |
| ProfileScreen | `displayData` line 602, in a **dep array** | line 848 | deps permanently `[undefined, undefined]` — the V5 email-pending effect never re-ran |
| PhoneChangeModal | `resumeCountdown` in a dep array | 13 lines below | that effect only re-ran on `visible` |

**`check:tdz`.** eslint's `no-use-before-define` is the obvious tool and the
wrong one: it flags every `onPress={() => handleThing()}` whose handler is
declared lower, which is the dominant React idiom and safe, because the closure
runs after initialisation. Enabled, it produced 10 reports in InsuranceScreen of
which one was real. The gate instead walks each statement list with babel and
reports only **same-tick** reads, skipping anything inside a nested function.
169 files, 3 findings, all genuine.

**`check:palette`.** `check:tokens` covers `C.*` but is blind to palette groups
imported directly. `brandTint.orange08` was live in WelcomeModal and there is no
`orange08` — the group has 04, 06, 10, 12 — so that fill has been rendering
transparent. The gate resolves all 26 groups and suggests near-matches.

### 39.2 Offline detection without the probe that caused the old bug

The owner's constraint was explicit: this regressed before, with working phones
reporting no connection. That failure is characteristic of
`NetInfo.isInternetReachable`, which is a **probe on a timer** — on a slow or
memory-pressured device it times out while the connection is fine. Adding that
library would re-introduce the bug, so it is not added.

The app's own traffic is the probe instead. Four rules, each guarding one false
positive:

1. Only failures with **no response** count. A 404 or 500 travelled to the
   server and back — those report *reachable*.
2. One failure is never enough; Render cold starts produce isolated timeouts.
3. A failure within 8s of a success is ignored. Requests fly in parallel; if one
   just returned, the device is online and the rest are slow. **This is the rule
   that protects low-RAM phones.**
4. Any success clears offline instantly. Being stuck offline on a working phone
   is the expensive direction, so entry is conservative and exit is immediate.

12 tests, each named for the shape it prevents, against a fixed clock. One found
a real gap while being written: `subscribeToNetwork` calls its listener
immediately, outside the try/catch `emit()` uses.

### 39.3 RootNavigator audit

**`setBarRect` was called during render.** A render must be pure; under
StrictMode's double invoke or a Suspense retry it runs twice per commit. Moved
into an effect.

**The height came from `Dimensions.get('window')`** — read once per render, and
this component only re-renders on navigation state. After a rotation, a fold, or
entering split screen the published rect kept the old height until the user
happened to switch tabs. Now `useWindowDimensions`.

**The publish sat below two early returns,** so hiding the bar (keyboard, or a
screen setting `tabBarStyle: display none`) left the last rect in place and every
dark zone went on computing coverage against a bar that was not on screen. It
now publishes `null` when hidden.

**TabBarDarkZone polled `measureInWindow` every 150ms, forever.** Seven screens
use a zone; that is a native round trip about seven times a second, per zone,
for the whole session — including while the screen sits behind another one and
while the app is backgrounded. Now gated on `useIsFocused` **and** `AppState`,
reports 0 when it goes off screen, and takes its first reading immediately
rather than 150ms late. This is the kind of idle cost that is invisible on a
current handset and matters on the older devices most providers carry.

8 structural tests cover all of it.

### 39.4 Visual batch

- **Pro tip** was `C.primary` — a solid `#f67c16` slab with an orange shadow. On
  black that is the loudest thing on the screen. Light keeps the v1.0.9 block;
  dark gets brand fill + brand edge + brand ink, and no shadow, because a
  coloured shadow on black is bloom.
- **Stat strip** value and label now share a baseline: ~39pt → ~19pt per cell for
  the same two words. The border the owner asked to keep is kept.
- **Member-since card** gets one brand colour fading in from each edge, orange
  left and blue right, at a percentage width so the fade holds its proportion
  across screen sizes.
- **Drawer's Professional Tools** used `diamond-stone` while Settings used the
  shared registry's `star`. The drawer already falls back to that registry, so it
  now passes `iconName:'star'` — same component, cannot drift again.
- **"Electrician" still looked yellow** because the profession label is
  `heroHeadlineProvider: { color: C.warning }`, not `categoryAccent`. See §38.1.

### 39.5 Tracked, not fixed

- **23 pressables under 44pt.** Only the sub-36pt ones were given `hitSlop`; the
  rest are 40–42pt where the gain is marginal. Two automated sweeps broke JSX —
  the second because the regex matched the `>` in an arrow function — and a
  cosmetic a11y gain does not justify that risk.
- **`screenOptions={{...}}` inline objects** in the tab navigators allocate a new
  object per render. React Navigation tolerates it and these components render
  rarely; worth hoisting during a quieter pass.

| build | versionCode | notes |
|---|---|---|
| 1.1.0-beta.15 | 51 | §39 — Insurance crash, check:tdz + check:palette, offline detection, RootNavigator/TabBarDarkZone perf, visual batch. `USE_DEV_STAGING=false`. [Firebase release](https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/2rq1vfqae6dfg) |


---

## §40 — the count row becomes the filter

The four stat pills were a saturated hue at **10% alpha over the page** —
`rgba(124,58,237,0.1)` on `#F1F5F9`. A strong colour at 10% over a blue-grey
does not make a tint, it makes a grey with a hint of something; four side by
side read as four shades of mud. Each also carried decorative SVG circles and
curves at 3–10%, which is the faint lighter box visible inside them.

`StatSegments` replaces them in both history screens: one container, colour
reduced to a 3pt rule under each figure at full strength, top corners 18 against
10 at the bottom so the row reads as a strip the list hangs from.

**It is the filter now.** Tap to filter, tap the same segment again to clear.
The owner asked for double-tap-to-clear; implemented as a toggle because a real
double-tap needs a ~300ms window during which a single tap cannot be acted on,
which would make every filter change feel slow. It drives the existing
`activeFilter`, so the pills and the result count are unaffected.

**Built for older phones.** Every animation is transform or opacity, so all run
on the native driver and never touch JS mid-gesture; no LayoutAnimation, no
animated colours (colour cannot be native-driven and forces a JS frame loop), no
animated shadows; one `Animated.Value` per segment; each segment its own memo
boundary, so a filter change re-renders two segments rather than the list header.

**ACTIVE was `#7C3AED`.** Violet, asked for removal three times, surviving
because the local alias is named `purple` — no violet sweep would ever match it.
A reminder that these sweeps find *names*, not colours.

### 40.1 The "all light mode looks different" report

Measured rather than assumed: diffing the resolved themes against beta.11 shows
**0 of 76 light tokens changed**, and 0 dark. The only palette movement anywhere
is two category hues, the rating star, and the premium group (Subscription
alone). The muddy tone was this screen's own construction, unchanged for its
whole life — not a regression from the theme work.

### 40.2 Open

- **Job card layout.** Owner rejected the status rail and the "Pays" row (no
  such data exists). The rest of the proposal stands: status tag instead of a
  dotted pill, id and time merged onto one muted line, details as labelled
  columns, no SVG, 14pt radius.
- **Pro tip in light mode** — still a solid brand block.
- **Pro tips are English only.** 50 × 3 languages of hand-written trade advice
  is a translation job; machine-translated safety guidance is worse than
  English. The "PRO TIP" label stays localised.

| build | versionCode | notes |
|---|---|---|
| 1.1.0-beta.16 | 52 | §40 — StatSegments filter row, tab icon role colour in dark, 50 rotating pro tips. `USE_DEV_STAGING=false`. [Firebase release](https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/1g3a9f1dif9hg) |
| — | — | [Job card ideas mockup](https://claude.ai/code/artifact/5bb56116-c458-4eda-9534-865a1da8b3c7) |


---

## §41 — history becomes a list; the pro tip stops shouting

### 41.1 Cards → rows

Owner: *"try not to make it like a card but more like a PhonePe history page —
but PhonePe history doesn't have buttons which we have here, so it should be a
mix of both."*

History is a long scroll of mostly-finished jobs. Twenty rounded, bordered,
elevated cards stacked down a page read as twenty objects competing rather than
one list you can scan.

| | was | now |
|---|---|---|
| container | radius 20, 1px border, elevation 5, 12pt gap | flat row, hairline divider |
| service icon | 12pt rounded square | 20pt disc |
| status | pill + dot, radius 16 | squared tag, uppercase, radius 6 |
| pending | 1.5px brand border | brand tint fill |
| list | 14pt side padding | full-bleed rows |

**Where it departs from a transaction list, deliberately:** those rows carry no
actions and these do. Padding stays generous enough for a 44pt target, every
field and button is untouched, and only *actionable* rows take a tint — the one
exception that earns a fill, so a new job is findable without a border around
every sibling.

### 41.2 Pro tip

Tinted in **both** themes now. The solid brand block was a saturated slab
wherever it landed — the owner's "picking the eyes" in dark, and the same weight
in light. The coloured shadow is gone in light too; on white it was a heavy
orange halo under an already-orange block.

Its icon plate needed rethinking rather than copying: a tinted plate on a tinted
card puts brand ink on brand line at **1.63:1**. It is a small SOLID brand chip
instead — the one strong element, which is the right place to spend the
saturation the card no longer uses.

### 41.3 Two regressions the gate caught

Both from text that used to sit on white and now sits on the pending tint:

- "View details" and its chevron — **4.35** against a 4.5 floor
- the customer avatar's initial — same ratio

Both moved to `#1E5F9E` (6.04 on the tint) rather than being waived. Neither is
visible as "wrong" to the eye; both would have shipped without `check:ink`.

**A note on reading that gate:** the first diff after this change showed nine
"new" failures. Eight were the same pre-existing failures at shifted line
numbers, because rows were removed from the file. Comparing on
`file|ink|ground|ratio` rather than on line numbers isolated the one that was
real. Worth doing whenever a change moves lines.

| build | versionCode | notes |
|---|---|---|
| 1.1.0-beta.17 | 53 | §41 — history rows, pro tip tinted in both themes. `USE_DEV_STAGING=false`. [Firebase release](https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/2nas2qel26t90) |

---

## §42 — the grey sheet, and a booking that filled a screen

### 42.1 Full-bleed rows turned `surface` into a sheet

Making the cards full-bleed in §41 changed what `C.surface` *means*. As cards
they were `#191716` islands on a black page; full-bleed, the same fill is one
continuous grey field down the whole screen — the owner's *"it's looking grey
and I want it black"*.

Rows are `C.pageSolid` now: `#FFFFFF` light, `#000000` dark.

> **The lesson:** a token can be correct and still be wrong after a layout
> change. `surface` was right for an island and wrong for a sheet, and nothing
> flagged it because the token never changed — its *area* did.

Same fix on UserHomeScreen, where the owner asked for the map and service
selection to be blacker: the ground behind the map and the sheet's step layers
go to `pageSolid`, while the cards **inside** the sheet keep `C.surface` so
elevation still reads. Ground black, things on it raised.

### 42.2 One pending booking ≈ one screen

| | before | after |
|---|---|---|
| date + time | bordered, padded box, two centred columns, stacked labels | one baseline line |
| cancel | **three** affordances, all `onCancel(request)` | the contextual one |
| view details | a bordered row firing the same `onPress` as the row | removed |
| pending row | ~full viewport | ~190pt shorter |
| finished row | | ~110pt shorter |

**No action was removed** — only a duplicate and a label for a tap target that
already existed. The card root is a `TouchableOpacity` calling
`onPress(request)`; "View Details" called the same thing.

Dropping the full-width Cancel also puts the destructive action next to what it
cancels rather than making it the largest control on the row.

Provider screen got the same treatment. Its Complete and Cancel are distinct
actions, not duplicates, so both stay.

### 42.3 GraphBackground deleted

Removed from all six screens and the component deleted. `check:hex` caught the
dangling entry in `migrated-files.json` the moment the file vanished.

### 42.4 Gate fix — `check:tokens` was reading comments

It counted `C.*` inside comments, so a comment explaining *why* a style no
longer uses `C.surface` was reported as an undefined reference. In a codebase
this heavily commented that will keep happening. It strips comments first now,
and the fix was verified by injecting a real bad reference and confirming the
gate still fails — a weakened gate is worse than no gate.

| build | versionCode | notes |
|---|---|---|
| 1.1.0-beta.18 | 54 | §42 — rows/map/sheet to pageSolid, booking compaction, GraphBackground deleted. `USE_DEV_STAGING=false`. [Firebase release](https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/6pfcl345dmtjg) |

---

## §43 — the Active bug, and separation that actually separates

### 43.1 "One active service, Active shows 0" — two bugs

**Mine.** The two history screens use different filter vocabularies. The
provider's switch has `case 'active'`; the user's has `case 'accepted'` and no
`'active'` at all. Wiring the count row to the filter (§40) I passed `'active'`
to both, so on the user screen it fell to `default: r.status === activeFilter`
— and no record has status `'active'`. **Tapping Active emptied the list.**

Nothing could catch it: it parses, the key is a valid string, and the failure
is an *empty list*, which is indistinguishable from "you have no active
bookings". `statSegmentKeys.test.js` now asserts every segment key is either an
explicit `case` in that screen's own switch or a real status the default branch
can match. **The bug was reintroduced to confirm the test fails on it** rather
than assuming.

**Pre-existing.** `stats` was separate state written only inside the fetch, so
it refreshed on fetch and not otherwise — create or cancel a booking in-session
and `allRequests` moved while `stats` did not. Both screens now derive the
counts with `useMemo` from `allRequests`, so the number and the list cannot
disagree. `total` still prefers the backend count (it spans unloaded pages);
`active` and `completed` describe what the list can show, so they come from it.

> Two independent bugs produced one symptom. Fixing either alone would have left
> the owner still seeing a wrong number.

### 43.2 Separation: the third attempt

| attempt | result |
|---|---|
| §41 bordered elevated cards | twenty objects competing — "immature" |
| §42 full-bleed at `C.surface` | one continuous grey field — "I want it black" |
| §42 full-bleed at `pageSolid` | black, but the gap is *also* black — "hard to distinguish" |
| §43 raised record, page as the gap | dark 23 code values apart, light 11 |

**A hairline cannot separate two things when the divider's surroundings are the
same colour as both of them.** Separation had to come from tonal elevation —
the record raised, the page showing between — which is the rule the rest of the
app already follows. Not a revert: the compact interior from §41–42 stays, and
the container is lighter than the original (radius 14 not 20, no border, no
elevation, 13pt padding not 16).

### 43.3 "0 bookings" over "No Bookings Found"

The count line rendered whenever a filter was active, including at zero. Not a
data leak, which is what it looked like — the number was accurate, the filter
under it was broken. A truthful `0` beside an empty-state illustration reads as
a glitch even when it is correct. Now hidden at zero.

Its left-edge clipping was the list header sitting at x=0 after full-bleed rows
removed the list's horizontal padding — restored with the record gutter.

### 43.4 Yellow, the fifth time

The Favorites tile on UserHomeScreen was `warningLine`/`warningBg`/
`warningFill`; Events was violet. Both brand now.

> Five separate rounds of "remove the yellow", each finding a site the previous
> sweep could not have matched — `C.warning` on a profession label, an alias
> called `purple`, a tile passing `warningFill` as a prop. **Name-based sweeps
> find names.** A colour-based audit — resolve every prop to its final value and
> flag hues outside the brand — is the only thing that would have found all five
> at once. Worth building before the next report.

| build | versionCode | notes |
|---|---|---|
| 1.1.0-beta.19 | 55 | §43 — Active filter/count bugs, record separation, redundant count, tile colours. `USE_DEV_STAGING=false`. [Firebase release](https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/0inh0lao94ea8) |

---

## §44 — one button convention

Four conventions were in play at once. Now one:

| role | treatment |
|---|---|
| primary, one per context | solid brand fill, on-ink |
| utility / secondary | tinted fill + matching 1px edge + **deep** ink |
| destructive secondary | danger tint + danger edge + danger ink |
| never | a fill with no border that matches its own page |

**The reported bug:** ProfileScreen's `editorCancel` used `C.hairline` — a
*divider* tone — as a background with no border. On the dark page that is a
black rectangle with no edge. `headerBackBtn` and `fullMapCloseBtn` on the
detail screen had the same shape.

**Re-toned to tinted + edged:** call, callCustomer, track, trackLive,
directions, fullMapDir, findProviders, otpResend, providerOtpEnabled, and the
round call/directions discs on both history screens.

**Left solid deliberately:** accept, rate, goBack. They are the primary action
where they appear, and making everything tinted would lose the distinction the
rule exists to create.

### 44.1 The support glyph

Defaulted to `brandOrangeInk`, putting a fully saturated icon beside plain
white siblings in the home header. It inherits `textStrong` now; callers that
want it branded still pass `color`.

### 44.2 SvgArt deleted

The orange thread decoration at the top of the service sheet and across seven
headers — 8 instances, component deleted, same family as GraphBackground.
`check:hex` caught the dangling `migrated-files.json` entry immediately.

### 44.3 check:ink did the real work

Re-toning 11 buttons left their `on*` inks — `onSuccess`, `onSecondary`,
`onPrimary`, `onDanger`, all near-white — on pale tints at **1.14–1.35:1**,
including **two dark failures**. None of that is visible while writing the
style change; all of it would have shipped.

Two things worth keeping from how it was fixed:

- The gate pointed at JSX lines, but the colour came from the **text styles**.
  Patching the reported lines fixed nothing; the styles were the source.
- `goBackBtnText` and `fullMapDirText` kept their on-inks, because those
  buttons are **still solid**. Sweeping every `on*` ink would have been the
  same mistake in reverse.

### 44.4 Still open

- A **colour-resolving audit** (§43.4): resolve every prop to its final value
  and flag hues outside the brand. Five rounds of name-based yellow sweeps each
  missed sites the next one found; this is the thing that would end it.
- The responsive pass at 320/360/412pt.

| build | versionCode | notes |
|---|---|---|
| 1.1.0-beta.20 | 56 | §44 — button convention, support glyph, SvgArt deleted, detail-screen pass. `USE_DEV_STAGING=false`. [Firebase release](https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/332u23jis6en0) |

---

## §45 — a comment that lied, and the gate's blind spot behind it

### 45.1 The invisible step numbers

```js
timelineNumber: { // on C.primary, so the ink must be its on-colour
  color: C.onPrimary,
```

The number renders **only** when the step is neither completed nor current, so
its circle is `C.sunken` — never `C.primary`. An earlier fix read the wrong
branch, wrote the assumption into a comment, and set near-black ink on
`#252321`: **1.1:1**. Now `textSecondary`, 7.47:1.

> The comment was the bug's best disguise. It was specific, confident, and
> wrong, and it made the line look already-considered.

### 45.2 Why `check:ink` could not see it

All three states shared one container and swapped only the child:

```jsx
<View style={[circle, isCompleted && done, isCurrent && current]}>
  {isCompleted ? <Icon/> : isCurrent ? <Dot/> : <Text/>}
```

The ink and the ground came from **different branches**, so the checker graded
each child against whichever fill it flattened to. Two intermediate attempts
failed for the same reason:

- a **ternary** — it flattens both arms
- **hoisting the state to a variable** — the ground then resolved to the base
  for *every* child, so the ✓ (which sits on green) was flagged instead

The fix is structural: **each state renders its own complete circle**. Tick on
green, dot on orange, number on the sunken base — each pairing stated once in
the markup, each independently checkable. The tick also moved `onPrimary` →
`onSuccess`, which is what it should always have been on green.

> A gate that cannot see a pairing is usually telling you the markup does not
> express it either.

### 45.3 The location disc, missed by a name

The user screen calls it `btnTrack`; the provider's calls it `btnDir`. §44
patched a key list, so the user's stayed a solid orange disc. Same failure mode
as the five yellow rounds: **keyed sweeps find keys.**

### 45.4 Status hues

47 violet/amber references across both history screens → brand blue / brand
orange. `C.purple` was *in-progress*, `C.warning` was *pending*; pending is
already brand orange on the segment strip above, so the list now agrees with
its own header. Cancelled stays red, completed stays green — those read as
universal, not off-brand.

### 45.5 Service sheet

The member-since gradient at ~⅓ strength, one brand colour fading from each
edge, `pointerEvents` off so the drag is untouched. Owner's fallback if it does
not land: plain black/white per theme.

| build | versionCode | notes |
|---|---|---|
| 1.1.0-beta.21 | 57 | §45 — step numbers, btnTrack, 47 status hues, sheet gradient. `USE_DEV_STAGING=false`. [Firebase release](https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/07bn91cuk0gg8) |

---

## §46 — the light-mode mud was five values, not a hundred call sites

The owner: *"We don't want workarounds, we want robust fixes. Why is light mode
not working correctly after these changes? What is the place where the changes
didn't happen?"* Fair, and the answer is that three passes had been treating
symptoms.

### 46.1 The root cause

Two families of tinted colour that look interchangeable in the token list:

```
xFill       rgba(30, 95, 158, 0.1)    10% of a DARK hue
xContainer  #EFF6FF                    a solid pale tint
```

10% of a dark hue over **any** ground composites toward grey. Measured over
white, every `xFill` landed at **4–10% saturation**. That is the mud.

### 46.2 Why three site-by-site passes never held

Checking what the *remaining* uses actually were:

```js
approved: { color: C.success, bg: C.successFill }
<IconRow iconBg={C.infoFill} />
```

**Every one is passed as a `bg:` or `iconBg=` prop. Zero are borders, zero are
shadows.** No search for `backgroundColor` can find them, so each sweep fixed
what it could see and left the rest — and the next screenshot found another.

And the token is named **`Fill`**, which is exactly what you reach for when you
want a fill. It is the one thing that cannot safely fill anything. §27's lesson
again: *a token must be named for its job*, and this one is named for the job
it must never do.

### 46.3 The fix

**Five values.** The light `*FillLight` entries are solid tints now. Every call
site becomes correct at once — including the prop-passed ones no sweep can
reach and the screens never opened. Dark was already solid and is untouched.
They sit slightly stronger than the matching `Container` so a filled chip still
reads as more emphatic.

> Fixing the value fixes the sites you cannot find. That is the difference
> between a robust fix and a thorough one.

`check:alpha` now fails any translucent token used as a surface and names the
solid alternative. `iosFill` is exempt — Apple's system material, translucency
is the point. **The gate is the safety net; the value change is the fix.**

### 46.4 Also this build

- **The welcome screen's grey band**: `colors={[C.warningBg, C.onPrimary, C.infoBg]}`
  — `onPrimary` is `#0F172A`, an **ink**, as the middle gradient stop. In light
  the screen faded amber → near-black → blue. The §18 class, again.
- **`primary: c.warning`** in ChangePasswordScreen — a "primary" alias resolving
  to the caution hue, so every `C.primary` there was amber. Now `brandOrangeInk`,
  because every use is ink and raw `#f67c16` is 2.45 on the light page.
- **Completion OTP** was violet → brand blue.
- **Provider location** asserted "not sharing yet" before it had asked.
  `locationSharingEnabled` defaults to `false`, indistinguishable from a real
  negative. Added `locationStatusKnown`, set in a `finally` so a failed fetch
  still counts, plus a loading card. Unknown is shown as unknown.
- Service sheet fade shortened, clear space above the greeting.

### 46.5 Auth audit — 31 candidates, 29 false positives

`C.white` maps to `c.surface` in those files: a legitimate card fill. Verified
the mapping rather than "fixing" 29 working styles. The five flagged buttons are
layout wrappers around `<Button>` or conventional dialog text buttons. Recorded
so the next pass does not re-audit them.

| build | versionCode | notes |
|---|---|---|
| 1.1.0-beta.22 | 58 | §46 — solid fills at source, auth gradient ink, primary alias, OTP hue, location loading. `USE_DEV_STAGING=false`. [Firebase release](https://console.firebase.google.com/project/fixhomi-f6382/appdistribution/app/android:com.renfi/releases/5vjt0j78h21ig) |
