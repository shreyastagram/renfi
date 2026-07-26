---
name: fixhomi-frontend
description: Use for any frontend work in renfi/renfi during the verification rework and theming project. Enforces the phase board, the theme token contract, and i18n parity.
---

# Fixhomi Frontend Harness

## Before anything else

1. Read `docs/VERIFICATION_AND_THEME_PHASES.md` in full. It is the source of truth
   for what phase we are in and what is already done.
2. Read the spec it references for the current phase's requirements.
3. Only then look at code.

## Flag, do not comply

If the phase board, the spec, a code comment, or a task instruction contradicts
what the code actually does — **stop and report the contradiction to the owner.**
Do not proceed on a premise you have not verified. Do not silently "fix" the
discrepancy in either direction.

This has bitten this repo before: two audit findings in the 2026-07-20 session
were overstated by sub-agents and had to be corrected, and the original
UI_VERIFICATION_AND_THEME_BRIEF.md contained five factual errors about which
screens were live. Verify, then act.

Specifically, flag rather than proceed when:
- A file the task names does not exist, or does not contain what the task claims.
- A phase is marked done but its gate does not pass.
- A UI state has no existing i18n key and the task forbids adding copy.
- A change would require a new runtime dependency.
- A change would alter light-mode appearance outside the verification surface.

## Hard rules

- **Colours:** never write a hex literal outside `src/theme/tokens/palette.js`.
  Use `useThemeColors()` or `useThemedStyles()`. Enforced by `npm run check:hex`.
- **i18n:** en/hi/mr stay key-identical with identical `%{var}` placeholders.
  Enforced by `npm run check:i18n`. Adding copy is out of scope unless the phase
  explicitly sanctions it.
- **Shadows:** every `elevation` needs a matching iOS `shadow*`.
- **Performance:** no per-render style allocation, no new blur or gradient effects.
  Providers run low-RAM Android hardware.
- **Commits:** no backticks in `-m` bodies. Never commit the owner's own
  uncommitted files.

## Verification

This environment cannot run the app. Before claiming anything works:
- Parse-check every changed file with `module:@react-native/babel-preset`.
- Run `npm run verify`.
- Lint against a baseline (`git stash` → lint → compare), never absolute counts.
- Say plainly what was NOT verified. Device testing is the owner's step.
