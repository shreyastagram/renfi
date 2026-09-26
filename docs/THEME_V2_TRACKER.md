# Dark/Light Theme v2 — TRACKER (SOURCE OF TRUTH)

**Branch:** `feature/theme-v2` (off tag **`v1.0.9`** = `b74f862`)
**Colour contract:** `docs/COLOUR_MAP.md`
**Also read:** `FIXORA_APP/WORK_AVAILABILITY_TRACKER.md` — Working Hours is live in prod.
**Last updated:** 2026-09-26. **§18 washed-out colours: root cause found and fixed.** 10 places, 2 clusters.

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
- [~] **Phase 5b** — V1–V4 done (pure logic). V5/V6 + `profile.emailPending` blocked on
      an owner decision, because both change the verification UI.
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

### Still open from that report

The owner also said *"dark blue in black grey"*. Cluster 1 plausibly accounts for it (navy
panel + navy ink), but if it persists, the prime suspect is `navigation/RootNavigator.jsx`
— deliberately off the hex allowlist (§15) and still holding `VERIFIED_BLUE = '#2b76bc'`
and a `BRAND` block, none of which flip. **Ask for the screen before touching it.**

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
