# Brief: Verification-status UI redesign + Dark/Light mode (user pages first)

**For:** the next Claude session. **Created:** 2026-07-26 by the prior session (Fable 5).
**Task owner:** borkarshreyas123@gmail.com.

> ⚠️ **Cross-check everything in this doc against live code before acting.** It was written from a
> quick scan at the end of a long session; file/line refs and counts drift. Treat every claim as a
> lead to verify, not a fact. Where it says "verified", re-verify.

---

## 1. What the owner wants

Two related UI workstreams, **user-facing pages first**:

1. **Verification-status UI redesign** — improve how verification status is presented to the USER
   (phone/email/Aadhaar verification state, the verification dashboard/steps as the *user* sees them).
   Cover the **user** pages first. If a page is shared/overlapping between user and provider, update
   it too so it stays consistent — but don't go chase provider-only screens in this pass.

2. **Dark mode / Light mode** feature — user pages first, same overlap rule.

**Process the owner expects:**
- **Create a NEW branch** off `feature/profile-redesign` before touching anything
  (e.g. `feature/verification-ui-darkmode`).
- The owner **ships without local device testing** → for any UI change, produce a **live HTML mockup
  artifact** they can eyeball first (this is a standing preference — see memory
  `mockup-before-firebase-ship`). Get their sign-off on the look before wiring it into RN.
- **Brainstorm scope with the owner before implementing** (invoke the brainstorming skill) — dark
  mode especially is bigger than it looks (see §3).

---

## 2. Grounding facts (verified this session, but RE-VERIFY)

- **User-facing verification screens** (`src/screens/`): `VerificationScreen.jsx` (phone/email OTP
  verify — the main USER one), `VerificationDashboardScreen.jsx` (steps/progress — largely PROVIDER
  onboarding, confirm which parts users see), `DocumentVerificationScreen.jsx` (PROVIDER),
  `EmailVerifyHandlerScreen.jsx` (deep-link email verify), `OTPVerifyScreen.jsx` (login OTP).
  Aadhaar UI lives in `src/components/AadhaarVerificationModal.jsx` + a Profile card.
  **→ First task: map which of these the USER actually sees vs provider-only** (check
  `navigation/RootNavigator.jsx` UserMainNavigator vs ProviderMainNavigator).
- **There is NO theming/dark-mode infrastructure today.** Zero `useColorScheme`, `ThemeContext`,
  `useTheme`, or `Appearance` usage in `src/`. Colors are **hardcoded hex literals everywhere**
  (~136 in `UserHomeScreen.jsx`, ~19 in `VerificationDashboardScreen.jsx`). So dark mode = **build a
  theme system + migrate hardcoded colors**, not flip a switch. This is the single biggest scoping
  fact — surface it to the owner immediately.
- Some screens do define a local palette object (e.g. `InsuranceScreen.jsx` has `const C = {...}`),
  but it's per-file, not shared. No central token file exists.
- **Tab bar already has a light/dark ADAPTIVE tone system** for the floating bar
  (`src/components/tabBarTone.js` + `TabBarDarkZone.jsx` + `navigation/RootNavigator.jsx`) — that is
  *scroll-adaptive coloring*, NOT an app theme. Don't confuse the two; but it's prior art for how the
  team handles light/dark contrast.

---

## 3. Recommended approach for dark mode (propose to owner, don't assume)

Because there's no theme system and colors are inline, a realistic path:
1. **Introduce a `ThemeContext`** (light/dark tokens) + a `useTheme()` hook, seeded from RN
   `Appearance`/`useColorScheme`, with a manual override toggle persisted in AsyncStorage.
2. **Define a token set** (background, surface, text primary/secondary, border, accent orange
   `#f67c16` / blue `#2b76bc`, semantic success/warning/danger). Pick neutrals deliberately for both
   themes — don't naively invert.
3. **Migrate screens incrementally**, starting with the verification/user pages in scope. Converting
   all ~136 hex in Home in one pass is large — scope it with the owner (maybe theme the in-scope
   pages only this branch, migrate the rest later).
4. Follow the artifact-design skill for the mockup; make it theme-aware (both modes) so the owner
   sees light AND dark before you build.

---

## 4. Conventions that MUST hold (repo rules)

- **i18n parity:** `src/i18n/en.js` / `hi.js` / `mr.js` must stay key-identical (**1959** keys as of
  this session) with identical `%{var}` placeholders per key. Any new copy → add to all three.
  Re-run the flatten+diff parity check (there's a node one-liner pattern used in prior commits).
- **Verify method:** this environment can Babel-parse RN (`module:@react-native/babel-preset`) but
  CANNOT run the app. So parse-check every changed file; rely on the owner's device/Firebase test for
  runtime.
- Every `elevation` needs a matching iOS `shadow*`. RN Modal + KeyboardAvoidingView quirks documented
  in `SESSION_HANDOFF_2026-07.md` §7.
- Commit `-m` bodies: avoid backticks. Don't commit the owner's own uncommitted files.
- Providers use older/low-RAM Android phones → keep effects light (memory `lightweight-ui-for-providers`).

---

## 5. State of the repo when this branch starts (2026-07-26)

- **Branch to fork from:** `feature/profile-redesign` (clean, fully pushed).
- **Deploy plan in motion (owner):** backend to DEV + a Firebase App Distribution build — so the
  dev-staging flags may be toggled around this time; don't fight the owner's env toggles.
- **Recent big work (context, NOT this task):** see `SESSION_HANDOFF_2026-07-20.md` — auth-logout +
  jitter fixes, camera-crash recovery, provider verification-dashboard self-heal (backend), and a
  full VAPT security pass. The #1 open owner action there is **rotate `JWT_SECRET`** (unrelated to
  this UI task but don't undo it).
- Junk dirs `.scannerwork/` and `fixhomi-m10-backup/` are now gitignored — ignore them.

---

## 6. First moves for the next session (suggested order)

1. Read this brief + skim `SESSION_HANDOFF_2026-07-20.md` for repo state. **Cross-check** the §2 facts.
2. Invoke the **brainstorming** skill with the owner: nail scope (which user pages; theme-system-now
   vs theme-in-scope-pages-only; toggle placement).
3. Create the branch.
4. Map user vs provider verification screens from the navigators.
5. Build a **theme-aware HTML mockup artifact** of the redesigned verification UI in light + dark →
   owner sign-off.
6. Implement: ThemeContext + tokens, then the in-scope screens; parse-check + i18n parity each step.
