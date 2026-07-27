# Verification Rework + Dark/Light Theme — Phase Board

Spec: docs/superpowers/specs/2026-07-27-verification-ui-darkmode-design.md
Branch: feature/verification-ui-darkmode

> Read this file BEFORE touching code. If anything here contradicts the code,
> STOP and flag it to the owner. Do not proceed on a false premise.

## Status

- [x] Phase 0 — Branch, phase board, harness agent spec
- [ ] Phase 1 — Theme engine, tokens, gates, dead-file deletion
- [ ] Phase 2 — HTML mockup, light + dark  ← OWNER APPROVAL GATE
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
- i18n baseline: 1959 keys per locale. Only Phase 3's Settings control may add
  keys, and exactly 7 of them, taking all three locales to 1966.
- Node >= 22.12 is required by the gate scripts (they use require on ES modules).
  Every import inside src/theme/tokens/ and src/theme/themes.js must carry an
  explicit .js extension or Node's ESM resolver rejects it.

## Phase 4 backend audit findings

Recorded here when Phase 4 runs. No backend commits on this branch.
