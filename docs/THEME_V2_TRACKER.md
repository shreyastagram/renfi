# Dark/Light Theme v2 — TRACKER (SOURCE OF TRUTH)

**Branch:** `feature/theme-v2` (off tag **`v1.0.9`** = `b74f862`)
**Colour contract:** `docs/COLOUR_MAP.md`
**Also read:** `FIXORA_APP/WORK_AVAILABILITY_TRACKER.md` — Working Hours is live in prod.
**Last updated:** 2026-09-25, after Phase 7 batch 1.

> **Read this file BEFORE touching code.** If it contradicts the code, **STOP and flag it** —
> do not proceed on a false premise.
>
> **UPDATE THIS FILE AFTER EVERY COMMIT**, not at phase boundaries. It drifted four commits
> behind once already; that is the exact failure this file exists to prevent.

---

## ▶ 1. WHERE WE ARE RIGHT NOW

**Phases 0–5a, 6a, ALL of 6b, and Phase 7 batches 1–3 done.**

- The theme engine is live and **11 components consume it**. The Appearance control ships.
- Switching to Dark currently changes: the status bar, dialogs, alerts, inputs, icons,
  skeleton loaders, the notification banner, the drawer menu, and the tab-bar pill on
  low-end devices. **Screens themselves are not themed yet.**
- `npm run verify` exits 0. Working tree clean apart from the owner's `.vscode/settings.json`
  and `android/clean.log`.
- **Eight user screens are now themed** (`PSATriggerScreen`, `PSAContactsScreen`,
  `ReferralScreen`, `FavoritesScreen`, `LiveTrackingScreen`, `EventServicesScreen`,
  `CreateServiceRequestScreen`, `UserServiceHistoryScreen`), and the live-tracking map
  follows the theme via `StyleURL.TrafficNight`.
- **Nothing is device-verified.** This environment cannot run the app.

### Next action

**Phase 8 is done — every user screen and every provider screen is themed.**

Next: the **~10 modals reachable from themed screens**, which is the thing blocking a
useful device test (see the table below). In rough order of impact:
`LocationPicker` (71), `ProviderDetailsModal` (60), `CancellationReasonModal` (34),
`MapPickerModal` (28), `RatingModal` (26), `AadhaarVerificationModal` (26),
`AddressAutocomplete` (25), `PhoneChangeModal` (24), `DateTimePicker` (22),
`SavedAddresses` (20). That is ~336 of the 674 component literals.

Then Phase 9 (auth screens, 242) and Phase 10 (sweep + device checklist). Phase 5b
stays open for BEHAVIOUR: verification defects V1–V6 and `profile.emailPending`.

Still outstanding regardless of phase: **17 `SafeAreaView` call sites across 15 files**
to swap for `<Screen>`, which is what makes edge-to-edge correct under `targetSdk 36`.

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
- [ ] **Phase 9** — Auth screens
- [ ] **Phase 10** — Full sweep + device-test checklist

---

## 3. MIGRATION PROGRESS

| Measure | Value |
|---|---|
| Colour literals remaining | **880** (3,329 at v1.0.9) — measured, see note |
| Files on the hex allowlist | **68** |
| Components fully themed | **8** — CustomDialog, Button, Alert, ShimmerLoader, Input, Icon, GlobalBanner, DrawerMenu (+ RootNavigator surgically) |
| Screens fully themed | **24** — the entire user side AND the entire provider side |
| Theme unit tests | 30 across 6 suites |
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
| Everything else (screens) | ~1,492 | 7–9 |
| Verification surfaces | 395 | 5b |
| Working Hours | 126 | 8 |
| Settings screen | 47 | 6b/7 |
| `RootNavigator` (adaptive-tone values, intentionally literal) | ~24 | n/a — see §15 |

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
5. Android 3-button navigation and gesture bar: `targetSdk 36` enforces edge-to-edge,
   and **17 `SafeAreaView` call sites across 15 files are still to become `<Screen>`**.
6. Light mode as a regression check: it should look like 1.0.9. 400 declared changes, all
   justified in `scripts/check-light-fidelity.js`.

Recompute reachability before trusting this (the snippet is in the commit for
`de6a23b`). Still **no fastlane / App Distribution automation**, and `USE_DEV_STAGING` is
`false` in a do-not-commit file, so the build is the owner's manual step.

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
`stableDark`, `stableEmergency`, **`premium`**.

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
