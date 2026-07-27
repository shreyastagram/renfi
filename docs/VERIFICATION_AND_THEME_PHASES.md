# Verification Rework + Dark/Light Theme — Phase Board

Spec: docs/superpowers/specs/2026-07-27-verification-ui-darkmode-design.md
Branch: feature/verification-ui-darkmode

> Read this file BEFORE touching code. If anything here contradicts the code,
> STOP and flag it to the owner. Do not proceed on a false premise.

## Status

- [x] Phase 0 — Branch, phase board, harness agent spec
- [x] Phase 1 — Theme engine, tokens, gates, dead-file deletion
- [~] Phase 2 — HTML mockup, light + dark  ← OWNER APPROVAL GATE
      mockup 1 of 3 (verification surface) APPROVED at revision 2, 2026-07-27.
      Remaining: 2 = token/component reference sheet, 3 = representative themed
      screen plus both Mapbox dark candidates.
- [ ] Phase 3 — Verification module: UI + state + defects V1–V6
- [ ] Phase 4 — Backend read-only IDOR / race audit
- [ ] Phase 5 — Shared chrome (547 hex)
- [ ] Phase 6 — User screens + Mapbox theme following (918 hex)
- [ ] Phase 7 — Auth screens (279 hex)
- [ ] Phase 8 — Provider screens (513 hex)
- [ ] Phase 9 — Full sweep + device checklist

## Gates every phase must pass

1. Parse-check every changed .js/.jsx file with module:@react-native/babel-preset.
2. npm run check:i18n — en/hi/mr key-identical, identical %{var} per key.
3. npm run check:hex — no raw hex in any file listed in scripts/migrated-files.json.
4. npm run check:contrast — every semantic pair meets WCAG AA in both themes.
5. npm run check:types — tsc --noEmit. This is the ONLY working check for .tsx.
6. npm run test:unit — pure-JS unit tests green.

Gates 2-6 run together via: npm run verify

IMPORTANT: the babel CLI parse-check does NOT work on .tsx files. It fails on
plain TypeScript syntax such as (global as any) even on an unmodified App.tsx.
Use npm run check:types for .tsx. Verified 2026-07-27.

## Known baseline facts

- npm test is RED at baseline (App.test.tsx needs native mocks). Not in scope.
  Use npm run test:unit for a trustworthy signal.
- i18n baseline: 1959 keys per locale. Exactly 8 new keys are sanctioned, taking
  all three locales to 1967: 7 for the Settings theme control, plus
  profile.emailPending ("Check inbox") for the email waiting state.
  Everything else on the verification surface reuses existing keys.
- Node >= 22.12 is required by the gate scripts (they use require on ES modules).
  Every import inside src/theme/tokens/ and src/theme/themes.js must carry an
  explicit .js extension or Node's ESM resolver rejects it.

## Phase 1 outcome (2026-07-27)

Theme engine is in place and every gate is green. No screen consumes tokens
yet, so the app is visually unchanged.

Deviations from the plan, all forced by verified blockers:

1. jest.config.js overrides the transform pattern. The react-native preset
   transforms only js|ts|tsx and OMITS jsx, so babel-jest left every .jsx file
   untransformed. This codebase is overwhelmingly .jsx, so this had blocked all
   component testing, not just ours.
2. resolveThemeName + mode constants live in src/theme/resolveThemeName.js, and
   the style cache in src/theme/createStyleCache.js, rather than inside
   ThemeContext.jsx / useThemedStyles.js. Both parents import AsyncStorage or
   react-native, which need native mocks; splitting the pure logic out keeps the
   branching logic testable with no mocks.
3. Added a check:types gate. The babel CLI parse-check DOES NOT WORK on .tsx
   and fails on an unmodified App.tsx, so .tsx changes had been going unchecked.

Numbers: 19 unit tests across 4 suites; 22 contrast pairs x 2 themes; 2109
lines deleted; lint improved by 14 problems (the deleted files' contribution),
with zero new problems from any added file.

NOT verified: nothing has been run on a device or simulator. npm test is still
red at baseline for the reason recorded above.

## Phase 4 backend audit findings

Recorded here when Phase 4 runs. No backend commits on this branch.
