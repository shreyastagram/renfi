# Theme Foundation Implementation Plan (Phases 0–1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the theming foundation — design tokens, `ThemeContext`, `useThemedStyles`, and the automated gates — so that every later phase has a validated, enforceable base to migrate onto, with zero visual change to the app.

**Architecture:** A two-layer theme system. `src/theme/tokens/` holds raw palette and semantic light/dark maps; `src/theme/` exposes `ThemeProvider`, `useTheme()`, `useThemeColors()`, and `useThemedStyles()`. Screens import only from `src/theme` so the engine can later be swapped to Unistyles without touching consumers. Three scripts (contrast validator, hex lint, i18n parity) become the repeatable gates the harness agent runs.

**Tech Stack:** React Native 0.84.1, React 19.2.3, JavaScript (no TypeScript in `src/`), Jest with `preset: 'react-native'`, AsyncStorage for persistence. **No new runtime dependencies.**

## Global Constraints

Copied verbatim from `docs/superpowers/specs/2026-07-27-verification-ui-darkmode-design.md`. Every task's requirements implicitly include this section.

- **No new runtime dependencies.** The pure-JS engine is deliberate; Unistyles v3 is deferred (spec §5.1).
- **No visual change in this plan.** Phases 0–1 add infrastructure only. No screen renders differently.
- **i18n parity:** `src/i18n/en.js` / `hi.js` / `mr.js` must stay key-identical with identical `%{var}` placeholders. Currently **1959 keys each**. **This plan adds zero i18n keys.**
- **`src/theme/tokens/palette.js` is the ONLY file permitted to contain raw hex literals.** Everything else uses tokens.
- **Every `elevation` needs a matching iOS `shadow*`.**
- **Commit `-m` bodies: avoid backticks.** Do not commit the owner's uncommitted files.
- **Parse-check every changed file** with `module:@react-native/babel-preset`. This environment cannot run the app.
- **Providers use older, low-RAM Android phones** — keep effects light, no per-render allocation.
- Branch: `feature/verification-ui-darkmode`. Each task is its own commit.
- **Node >= 22.12 required** for the gate scripts. They use plain `require()` on ES modules
  (`require(esm)`). Verified on the owner's Node **v25.8.1**. Consequence: **every import inside
  `src/theme/tokens/` and `src/theme/themes.js` MUST carry an explicit `.js` extension** — Node's ESM
  resolver rejects extensionless specifiers while Metro accepts both. Files the scripts never load
  (`ThemeContext.jsx`, `useThemedStyles.js`, `index.js`) are unaffected.

### Baseline facts (verified 2026-07-27 — do not re-litigate)

- **`npm test` is RED at baseline.** `__tests__/App.test.tsx` fails: `@react-navigation/native` ships ESM and the preset's `transformIgnorePatterns` excludes it. Fixing it fully requires native mocks for gesture-handler, safe-area-context, Firebase, Mapbox and Keychain — that is the render-harness the owner **declined**. **Do not attempt to fix `App.test.tsx` in this plan.** New tests are pure JS and run green under a scoped `test:unit` script (proven).
- Zero theming infrastructure exists — no `useColorScheme`, `Appearance`, `ThemeContext`, or `useTheme` anywhere in `src/`, `navigation/`, `App.tsx`.
- `AppTheme` already extends `Theme.AppCompat.DayNight.NoActionBar`; `android:configChanges` already includes `uiMode`, so the Activity does **not** recreate on a system theme change. **No manifest change is needed.**
- `targetSdkVersion = 36` → edge-to-edge is enforced.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/theme/tokens/palette.js` | **Create.** Raw colour scales. The only file with hex literals. |
| `src/theme/tokens/semantic.js` | **Create.** `lightColors` and `darkColors` semantic maps built from palette. |
| `src/theme/tokens/spacing.js` | **Create.** Spacing, radii, and paired elevation/shadow values. |
| `src/theme/themes.js` | **Create.** Assembles `lightTheme` / `darkTheme` objects. |
| `src/theme/ThemeContext.jsx` | **Create.** Provider: mode state, persistence, `Appearance` subscription. |
| `src/theme/useThemedStyles.js` | **Create.** Cached `makeStyles(theme)` hook. |
| `src/theme/index.js` | **Create.** Public surface. Screens import only from here. |
| `src/theme/__tests__/*.test.js` | **Create.** Pure-JS unit tests. |
| `scripts/check-contrast.js` | **Create.** WCAG validator over every semantic pair. |
| `scripts/check-hex.js` | **Create.** Fails on raw hex in migrated files. |
| `scripts/check-i18n-parity.js` | **Create.** Key + placeholder parity across en/hi/mr. |
| `scripts/migrated-files.json` | **Create.** The allowlist `check-hex.js` enforces. Starts nearly empty; each later phase appends. |
| `App.tsx:466-510` | **Modify.** Mount `ThemeProvider`; make `StatusBar` theme-driven. |
| `package.json` | **Modify.** Add `test:unit`, `check:contrast`, `check:hex`, `check:i18n`, `verify` scripts. |
| `android/app/src/main/res/values-night/styles.xml` | **Create.** Night launch background. |
| `src/screens/HomeScreen.jsx` | **Delete.** Dead (spec §17). |
| `src/screens/DocumentVerificationScreen.jsx` | **Delete.** Dead (spec §17). |
| `src/screens/index.js:35,53` | **Modify.** Remove the two dead barrel exports. |

---

### Task 1: Phase board and harness agent spec

**Files:**
- Create: `docs/VERIFICATION_AND_THEME_PHASES.md`
- Create: `.claude/agents/fixhomi-frontend.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the phase board every later task ticks off, and the agent contract every later session reads first.

- [ ] **Step 1: Create the phase board**

Create `docs/VERIFICATION_AND_THEME_PHASES.md`:

```markdown
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

1. Parse-check every changed file.
2. npm run check:i18n — en/hi/mr key-identical, identical %{var} per key.
3. npm run check:hex — no raw hex in any file listed in scripts/migrated-files.json.
4. npm run check:contrast — every semantic pair meets WCAG AA in both themes.
5. npm run test:unit — pure-JS unit tests green.

## Known baseline facts

- npm test is RED at baseline (App.test.tsx needs native mocks). Not in scope.
  Use npm run test:unit for a trustworthy signal.
- i18n baseline: 1959 keys per locale. Only Phase 3's Settings control may add
  keys, and exactly 7 of them, taking all three locales to 1966.

## Phase 4 backend audit findings

Recorded here when Phase 4 runs. No backend commits on this branch.
```

- [ ] **Step 2: Create the harness agent spec**

Create `.claude/agents/fixhomi-frontend.md`:

```markdown
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
```

- [ ] **Step 3: Verify both files exist and are non-empty**

Run: `wc -l docs/VERIFICATION_AND_THEME_PHASES.md .claude/agents/fixhomi-frontend.md`
Expected: both non-zero.

- [ ] **Step 4: Commit**

```bash
git add docs/VERIFICATION_AND_THEME_PHASES.md .claude/agents/fixhomi-frontend.md
git commit -m "docs(phase0): add phase board and frontend harness agent spec"
```

---

### Task 2: Design tokens

**Files:**
- Create: `src/theme/tokens/palette.js`
- Create: `src/theme/tokens/semantic.js`
- Create: `src/theme/tokens/spacing.js`
- Create: `src/theme/themes.js`
- Test: `src/theme/__tests__/tokens.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `palette` — nested object of raw scales.
  - `lightColors` / `darkColors` — flat objects, **identical key sets**.
  - `spacing`, `radii`, `elevation` — from `spacing.js`.
  - `lightTheme` / `darkTheme` — `{ name: 'light'|'dark', colors, spacing, radii, elevation }`.
  - Every semantic colour key name used by Tasks 3–6 and all later phases.

- [ ] **Step 1: Write the failing test**

Create `src/theme/__tests__/tokens.test.js`:

```javascript
const { lightTheme, darkTheme } = require('../themes');

describe('theme tokens', () => {
  it('exposes matching key sets for light and dark', () => {
    expect(Object.keys(lightTheme.colors).sort())
      .toEqual(Object.keys(darkTheme.colors).sort());
  });

  it('names each theme', () => {
    expect(lightTheme.name).toBe('light');
    expect(darkTheme.name).toBe('dark');
  });

  it('preserves the Fixhomi brand orange unchanged in both themes', () => {
    expect(lightTheme.colors.brandOrange).toBe('#f67c16');
    expect(darkTheme.colors.brandOrange).toBe('#f67c16');
  });

  it('never puts white on brand orange', () => {
    expect(lightTheme.colors.onBrandOrange).not.toBe('#FFFFFF');
    expect(darkTheme.colors.onBrandOrange).not.toBe('#FFFFFF');
  });

  it('exposes spacing, radii and elevation on both themes', () => {
    for (const theme of [lightTheme, darkTheme]) {
      expect(typeof theme.spacing.md).toBe('number');
      expect(typeof theme.radii.card).toBe('number');
      expect(theme.elevation.card).toHaveProperty('elevation');
    }
  });

  it('pairs every elevation with iOS shadow properties', () => {
    for (const level of Object.values(lightTheme.elevation)) {
      expect(level).toHaveProperty('shadowColor');
      expect(level).toHaveProperty('shadowOffset');
      expect(level).toHaveProperty('shadowOpacity');
      expect(level).toHaveProperty('shadowRadius');
      expect(level).toHaveProperty('elevation');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/theme/__tests__/tokens.test.js`
Expected: FAIL — "Cannot find module '../themes'".

- [ ] **Step 3: Create the palette**

Create `src/theme/tokens/palette.js`. **This is the only file in the app permitted to contain hex literals.**

```javascript
/**
 * Raw colour palette — the single source of hex literals in this app.
 *
 * Nothing outside this file may contain a hex literal; scripts/check-hex.js
 * enforces that for every file listed in scripts/migrated-files.json.
 *
 * Values were chosen against WCAG AA and are proven by scripts/check-contrast.js.
 * Do not hand-edit a value without re-running that script.
 */

// Fixhomi brand — unchanged from the existing app. Do not alter.
export const brand = {
  orange: '#f67c16',
  blue: '#2b76bc',
  blueDeep: '#1E5F9E', // blue dark enough to be readable AS TEXT on light surfaces
  blueLight: '#5FA8E8', // blue light enough to be readable on dark surfaces
};

// Neutral slate ramp — matches the Tailwind slate scale the app already uses.
export const slate = {
  0: '#FFFFFF',
  25: '#F8FAFC',
  50: '#F1F5F9',
  200: '#E2E8F0',
  400: '#78879C',
  500: '#5B6878',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
};

// Dark-mode surface ramp. Base is a dark neutral, not pure black (Material 3);
// surfaces get lighter as they elevate.
export const dark = {
  sunken: '#080D18',
  base: '#0B1220',
  surface: '#111827',
  elevated: '#1E293B',
  border: '#263449',
  borderStrong: '#64748B',
  textPrimary: '#F1F5F9',
  textSecondary: '#A9B4C4',
  textMuted: '#8B96A8',
};

// Semantic hues, light-surface variants (all >= 4.5:1 on white and on slate.50).
export const semanticLight = {
  success: '#15803D',
  warning: '#B45309',
  danger: '#B91C1C',
  successContainer: '#F0FDF4',
  warningContainer: '#FFF7ED',
  dangerContainer: '#FEF2F2',
  infoContainer: '#EFF6FF',
};

// Semantic hues, dark-surface variants (all >= 4.5:1 on every dark surface).
export const semanticDark = {
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  successContainer: '#0C2A1E',
  warningContainer: '#2B1F06',
  dangerContainer: '#2C1416',
  infoContainer: '#0E2236',
};

export const overlay = {
  light: 'rgba(15,23,42,0.45)',
  dark: 'rgba(0,0,0,0.65)',
};
```

- [ ] **Step 4: Create the semantic maps**

Create `src/theme/tokens/semantic.js`:

```javascript
/**
 * Semantic colour tokens.
 *
 * lightColors and darkColors MUST have identical key sets — tokens.test.js
 * asserts this. Screens name intent (surface, textMuted, danger), never a
 * palette step.
 */

import { brand, slate, dark, semanticLight, semanticDark, overlay } from './palette.js';

export const lightColors = {
  // Surfaces
  bg: slate[50],
  surface: slate[0],
  surfaceElevated: slate[0],
  surfaceSunken: slate[25],

  // Lines
  border: slate[200],
  borderStrong: slate[400],

  // Text
  textPrimary: slate[900],
  textSecondary: slate[600],
  textMuted: slate[500],
  textInverse: slate[0],

  // Brand
  brandOrange: brand.orange,
  onBrandOrange: slate[900], // NEVER white — white on orange is 2.69:1
  brandBlue: brand.blue,
  onBrandBlue: slate[0],
  info: brand.blueDeep, // brand blue readable as text on light surfaces

  // Semantic
  success: semanticLight.success,
  warning: semanticLight.warning,
  danger: semanticLight.danger,
  successContainer: semanticLight.successContainer,
  warningContainer: semanticLight.warningContainer,
  dangerContainer: semanticLight.dangerContainer,
  infoContainer: semanticLight.infoContainer,

  // Misc
  overlay: overlay.light,
  shadow: slate[900],
};

export const darkColors = {
  // Surfaces
  bg: dark.base,
  surface: dark.surface,
  surfaceElevated: dark.elevated,
  surfaceSunken: dark.sunken,

  // Lines
  border: dark.border,
  borderStrong: dark.borderStrong,

  // Text
  textPrimary: dark.textPrimary,
  textSecondary: dark.textSecondary,
  textMuted: dark.textMuted,
  textInverse: slate[900],

  // Brand — orange survives dark mode unchanged, blue must lighten
  brandOrange: brand.orange,
  onBrandOrange: slate[900],
  brandBlue: brand.blueLight,
  onBrandBlue: slate[900],
  info: brand.blueLight,

  // Semantic
  success: semanticDark.success,
  warning: semanticDark.warning,
  danger: semanticDark.danger,
  successContainer: semanticDark.successContainer,
  warningContainer: semanticDark.warningContainer,
  dangerContainer: semanticDark.dangerContainer,
  infoContainer: semanticDark.infoContainer,

  // Misc
  overlay: overlay.dark,
  shadow: '#000000',
};
```

> **Note for the implementer:** `darkColors.shadow` is the one hex literal outside
> `palette.js`. Move it into `palette.js` as `dark.shadow` rather than leaving it —
> `check-hex.js` will flag it once `semantic.js` is added to the allowlist in Task 6.

- [ ] **Step 5: Create spacing, radii and elevation**

Create `src/theme/tokens/spacing.js`:

```javascript
/**
 * Spacing, radii, and elevation.
 *
 * Every elevation level pairs an Android `elevation` with the iOS `shadow*`
 * properties — a repo rule. `shadowColor` is injected per-theme in themes.js
 * so dark mode can use a deeper shadow.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 14,
  card: 22,
  pill: 999,
};

export const makeElevation = (shadowColor) => ({
  none: {
    shadowColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  raised: {
    shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
});
```

- [ ] **Step 6: Assemble the themes**

Create `src/theme/themes.js`:

```javascript
/**
 * Assembled theme objects consumed by ThemeContext and useThemedStyles.
 */

import { lightColors, darkColors } from './tokens/semantic.js';
import { spacing, radii, makeElevation } from './tokens/spacing.js';

export const lightTheme = {
  name: 'light',
  colors: lightColors,
  spacing,
  radii,
  elevation: makeElevation(lightColors.shadow),
};

export const darkTheme = {
  name: 'dark',
  colors: darkColors,
  spacing,
  radii,
  elevation: makeElevation(darkColors.shadow),
};

export const themes = { light: lightTheme, dark: darkTheme };
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest src/theme/__tests__/tokens.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 8: Parse-check the new files**

Run:
```bash
npx babel --presets module:@react-native/babel-preset \
  src/theme/tokens/palette.js src/theme/tokens/semantic.js \
  src/theme/tokens/spacing.js src/theme/themes.js -o /dev/null
```
Expected: no output, exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/theme/
git commit -m "feat(theme): add design tokens for light and dark themes"
```

---

### Task 3: Contrast validator

**Files:**
- Create: `scripts/check-contrast.js`
- Modify: `package.json` (add `check:contrast` script)
- Test: `src/theme/__tests__/contrast.test.js`

**Interfaces:**
- Consumes: `lightTheme` / `darkTheme` from Task 2.
- Produces: `contrastRatio(hexA, hexB) -> number` and `REQUIRED_PAIRS`, both exported from `scripts/check-contrast.js` for reuse by the test.

- [ ] **Step 1: Write the failing test**

Create `src/theme/__tests__/contrast.test.js`:

```javascript
const { contrastRatio, auditTheme } = require('../../../scripts/check-contrast');
const { lightTheme, darkTheme } = require('../themes');

describe('contrast', () => {
  it('computes known ratios correctly', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 1);
  });

  it('confirms white on brand orange is the documented failure', () => {
    expect(contrastRatio('#FFFFFF', '#f67c16')).toBeLessThan(3);
  });

  it('passes every required pair in the light theme', () => {
    expect(auditTheme(lightTheme)).toEqual([]);
  });

  it('passes every required pair in the dark theme', () => {
    expect(auditTheme(darkTheme)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/theme/__tests__/contrast.test.js`
Expected: FAIL — cannot find module `scripts/check-contrast`.

- [ ] **Step 3: Write the validator**

Create `scripts/check-contrast.js`:

```javascript
/**
 * WCAG AA contrast validator for the theme tokens.
 *
 * Run: npm run check:contrast
 *
 * Every foreground/background pair the UI actually renders must clear its
 * threshold: 4.5 for normal text, 3.0 for large text and UI component
 * boundaries. Values in src/theme/tokens/palette.js were chosen to satisfy
 * this list — if you change one, this script is what proves it still holds.
 */

const TEXT = 4.5;
const UI = 3.0;

const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminance = (hex) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrastRatio = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
};

// [foregroundToken, backgroundToken, threshold, label]
const REQUIRED_PAIRS = [
  ['textPrimary', 'bg', TEXT, 'body text on page background'],
  ['textPrimary', 'surface', TEXT, 'body text on card'],
  ['textPrimary', 'surfaceElevated', TEXT, 'body text on elevated card'],
  ['textSecondary', 'bg', TEXT, 'secondary text on page background'],
  ['textSecondary', 'surface', TEXT, 'secondary text on card'],
  ['textSecondary', 'surfaceElevated', TEXT, 'secondary text on elevated card'],
  ['textMuted', 'bg', TEXT, 'muted text on page background'],
  ['textMuted', 'surface', TEXT, 'muted text on card'],
  ['textMuted', 'surfaceElevated', TEXT, 'muted text on elevated card'],
  ['onBrandOrange', 'brandOrange', TEXT, 'label on an orange fill'],
  ['onBrandBlue', 'brandBlue', TEXT, 'label on a blue fill'],
  ['info', 'bg', TEXT, 'link/info text on page background'],
  ['info', 'surface', TEXT, 'link/info text on card'],
  ['success', 'surface', TEXT, 'success text on card'],
  ['warning', 'surface', TEXT, 'warning text on card'],
  ['danger', 'surface', TEXT, 'danger text on card'],
  ['success', 'successContainer', TEXT, 'success text on its tinted chip'],
  ['warning', 'warningContainer', TEXT, 'warning text on its tinted chip'],
  ['danger', 'dangerContainer', TEXT, 'danger text on its tinted chip'],
  ['info', 'infoContainer', TEXT, 'info text on its tinted chip'],
  ['borderStrong', 'surface', UI, 'input border against card'],
  ['borderStrong', 'bg', UI, 'input border against page background'],
];

/** Returns an array of failure objects; empty means the theme passes. */
const auditTheme = (theme) => {
  const failures = [];
  for (const [fg, bg, threshold, label] of REQUIRED_PAIRS) {
    const fgHex = theme.colors[fg];
    const bgHex = theme.colors[bg];
    if (!fgHex || !bgHex) {
      failures.push({ theme: theme.name, fg, bg, label, reason: 'missing token' });
      continue;
    }
    const ratio = contrastRatio(fgHex, bgHex);
    if (ratio < threshold) {
      failures.push({
        theme: theme.name,
        fg,
        bg,
        label,
        ratio: Number(ratio.toFixed(2)),
        required: threshold,
      });
    }
  }
  return failures;
};

module.exports = { contrastRatio, auditTheme, REQUIRED_PAIRS, TEXT, UI };

if (require.main === module) {
  // Plain require() loads these ES modules directly — Node >= 22.12 supports
  // require(esm). This is why every import inside src/theme/tokens/ and
  // src/theme/themes.js carries an explicit .js extension: Node's ESM resolver
  // rejects extensionless specifiers, while Metro accepts both.
  const { lightTheme, darkTheme } = require('../src/theme/themes.js');
  const failures = [...auditTheme(lightTheme), ...auditTheme(darkTheme)];
  if (failures.length) {
    console.error('Contrast FAILURES:\n');
    for (const f of failures) {
      console.error(
        `  [${f.theme}] ${f.label}: ${f.fg} on ${f.bg} = ` +
          `${f.ratio ?? '?'} (needs ${f.required ?? '-'}) ${f.reason || ''}`,
      );
    }
    process.exit(1);
  }
  console.log(
    `Contrast OK — ${REQUIRED_PAIRS.length} pairs x 2 themes all meet WCAG AA.`,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/theme/__tests__/contrast.test.js`
Expected: PASS, 4 tests. **If `auditTheme` returns failures, fix the offending value in `palette.js` and re-run — do not lower a threshold.**

- [ ] **Step 5: Add the npm script**

In `package.json`, add to `"scripts"`:

```json
"check:contrast": "node scripts/check-contrast.js"
```

- [ ] **Step 6: Verify the CLI path runs**

Run: `npm run check:contrast`
Expected: `Contrast OK — 22 pairs x 2 themes all meet WCAG AA.`

If it fails with `ERR_MODULE_NOT_FOUND` naming `palette` or `spacing`, an import inside
`src/theme/` is missing its `.js` extension. Add it — do **not** reach for `@babel/register`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-contrast.js src/theme/__tests__/contrast.test.js package.json package-lock.json
git commit -m "feat(theme): add WCAG contrast validator over all token pairs"
```

---

### Task 4: ThemeContext and useTheme

**Files:**
- Create: `src/theme/ThemeContext.jsx`
- Create: `src/theme/index.js`
- Test: `src/theme/__tests__/resolveTheme.test.js`

**Interfaces:**
- Consumes: `themes`, `lightTheme`, `darkTheme` from Task 2.
- Produces:
  - `resolveThemeName(mode, systemScheme) -> 'light' | 'dark'` — pure, exported for testing.
  - `THEME_MODE_KEY = 'app_theme_mode'`, `THEME_MODES = ['light', 'dark', 'system']`.
  - `<ThemeProvider>` component.
  - `useTheme() -> { theme, mode, setMode, isDark, isReady }`.
  - `useThemeColors() -> theme.colors`.
  - All re-exported from `src/theme/index.js`, which is the **only** import path screens may use.

- [ ] **Step 1: Write the failing test**

Create `src/theme/__tests__/resolveTheme.test.js`:

```javascript
const { resolveThemeName, THEME_MODES } = require('../ThemeContext');

describe('resolveThemeName', () => {
  it('honours an explicit light choice regardless of system', () => {
    expect(resolveThemeName('light', 'dark')).toBe('light');
    expect(resolveThemeName('light', 'light')).toBe('light');
  });

  it('honours an explicit dark choice regardless of system', () => {
    expect(resolveThemeName('dark', 'light')).toBe('dark');
    expect(resolveThemeName('dark', 'dark')).toBe('dark');
  });

  it('follows the system when mode is system', () => {
    expect(resolveThemeName('system', 'dark')).toBe('dark');
    expect(resolveThemeName('system', 'light')).toBe('light');
  });

  it('falls back to light when the system scheme is null', () => {
    expect(resolveThemeName('system', null)).toBe('light');
    expect(resolveThemeName('system', undefined)).toBe('light');
  });

  it('falls back to light for an unrecognised persisted mode', () => {
    expect(resolveThemeName('purple', 'dark')).toBe('dark');
    expect(resolveThemeName(null, null)).toBe('light');
  });

  it('exposes exactly three modes', () => {
    expect(THEME_MODES).toEqual(['light', 'dark', 'system']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/theme/__tests__/resolveTheme.test.js`
Expected: FAIL — cannot find module `../ThemeContext`.

- [ ] **Step 3: Write ThemeContext**

Create `src/theme/ThemeContext.jsx`:

```javascript
/**
 * Theme Context
 *
 * Owns the theme mode (light | dark | system), persists it, and subscribes to
 * the OS appearance when the mode is 'system'. A manual light/dark choice always
 * wins and is never overwritten by a system change.
 *
 * Modelled on LanguageContext deliberately, including the memoised value: every
 * themed component in the app consumes this context, so an inline object here
 * would hand all of them a new identity on each provider render — the whole-app
 * re-render amplifier diagnosed as the low-end-Android "text jitter" in
 * AUTH_STARTUP_LOGOUT_FIX.md. The value identity must change exactly when the
 * resolved theme changes, and no more often.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, lightTheme } from './themes.js';

export const THEME_MODE_KEY = 'app_theme_mode';
export const THEME_MODES = ['light', 'dark', 'system'];

/**
 * Pure resolution of the active theme name.
 * Exported separately so it can be unit-tested without React or native modules.
 */
export const resolveThemeName = (mode, systemScheme) => {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light';
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [mode, setModeState] = useState('system');
  const [systemScheme, setSystemScheme] = useState(
    () => Appearance.getColorScheme() || 'light',
  );
  const [isReady, setIsReady] = useState(false);

  // Load the persisted mode before first paint so there is no light-to-dark flash.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_MODE_KEY);
        if (!cancelled && saved && THEME_MODES.includes(saved)) {
          setModeState(saved);
        }
      } catch (e) {
        // Corrupt or unavailable storage — fall through to the 'system' default.
      }
      if (!cancelled) setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Track the OS appearance. Subscribed unconditionally so that switching back
  // to 'system' resolves correctly without waiting for the next OS change.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'light');
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback(async (next) => {
    if (!THEME_MODES.includes(next)) return;
    setModeState(next);
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, next);
    } catch (e) {
      // Persistence failure is non-fatal — the choice still applies this session.
    }
  }, []);

  const themeName = resolveThemeName(mode, systemScheme);
  const theme = themes[themeName] || lightTheme;

  const value = useMemo(
    () => ({
      theme,
      mode,
      setMode,
      isDark: themeName === 'dark',
      isReady,
    }),
    [theme, mode, setMode, themeName, isReady],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};

export const useThemeColors = () => useTheme().theme.colors;

export default ThemeContext;
```

- [ ] **Step 4: Create the public surface**

Create `src/theme/index.js`:

```javascript
/**
 * Public theme surface.
 *
 * Screens and components import from here and NOWHERE else inside src/theme.
 * That indirection is what allows the engine to be swapped later (for example to
 * react-native-unistyles) without touching consumers.
 */

export {
  ThemeProvider,
  useTheme,
  useThemeColors,
  resolveThemeName,
  THEME_MODES,
  THEME_MODE_KEY,
} from './ThemeContext';

export { default as useThemedStyles } from './useThemedStyles.js';
export { lightTheme, darkTheme, themes } from './themes.js';
```

> `useThemedStyles` does not exist yet — Task 5 creates it. Until then
> `src/theme/index.js` will fail to resolve that export. Do not import
> `src/theme/index.js` from anything before Task 5 is complete.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/theme/__tests__/resolveTheme.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/theme/ThemeContext.jsx src/theme/index.js src/theme/__tests__/resolveTheme.test.js
git commit -m "feat(theme): add ThemeContext with system, light and dark modes"
```

---

### Task 5: useThemedStyles

**Files:**
- Create: `src/theme/useThemedStyles.js`
- Test: `src/theme/__tests__/useThemedStyles.test.js`

**Interfaces:**
- Consumes: `useTheme()` from Task 4.
- Produces:
  - `default export useThemedStyles(makeStyles) -> styles` — the hook screens call.
  - `createStyleCache(makeStyles) -> (theme) => styles` — the pure, testable cache factory.

- [ ] **Step 1: Write the failing test**

Create `src/theme/__tests__/useThemedStyles.test.js`:

```javascript
const { createStyleCache } = require('../useThemedStyles');
const { lightTheme, darkTheme } = require('../themes');

describe('createStyleCache', () => {
  it('computes styles once per theme and reuses them', () => {
    const makeStyles = jest.fn((theme) => ({
      box: { backgroundColor: theme.colors.surface },
    }));
    const cached = createStyleCache(makeStyles);

    const a = cached(lightTheme);
    const b = cached(lightTheme);

    expect(makeStyles).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('computes separately for each theme but caches both', () => {
    const makeStyles = jest.fn((theme) => ({
      box: { backgroundColor: theme.colors.surface },
    }));
    const cached = createStyleCache(makeStyles);

    const light1 = cached(lightTheme);
    const dark1 = cached(darkTheme);
    const light2 = cached(lightTheme);
    const dark2 = cached(darkTheme);

    expect(makeStyles).toHaveBeenCalledTimes(2);
    expect(light1).toBe(light2);
    expect(dark1).toBe(dark2);
    expect(light1).not.toBe(dark1);
  });

  it('produces theme-appropriate values', () => {
    const cached = createStyleCache((theme) => ({
      box: { backgroundColor: theme.colors.surface },
    }));
    expect(cached(lightTheme).box.backgroundColor)
      .toBe(lightTheme.colors.surface);
    expect(cached(darkTheme).box.backgroundColor)
      .toBe(darkTheme.colors.surface);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/theme/__tests__/useThemedStyles.test.js`
Expected: FAIL — cannot find module `../useThemedStyles`.

- [ ] **Step 3: Write the hook**

Create `src/theme/useThemedStyles.js`:

```javascript
/**
 * useThemedStyles — theme-aware StyleSheet with zero per-render cost.
 *
 * Usage:
 *
 *   const makeStyles = (theme) => StyleSheet.create({
 *     card: { backgroundColor: theme.colors.surface },
 *   });
 *
 *   const MyScreen = () => {
 *     const styles = useThemedStyles(makeStyles);
 *     ...
 *   };
 *
 * `makeStyles` MUST be declared at module scope, not inline in the component.
 * Declared at module scope it runs at most once per theme for the process
 * lifetime; declared inline it would build a fresh cache every render, which is
 * exactly the allocation-per-render pattern this repo removed during the
 * low-end-Android jitter work.
 */

import { useMemo } from 'react';
import { useTheme } from './ThemeContext';

/**
 * Wraps a makeStyles function in a per-theme-name memo.
 * Pure and React-free so it can be unit-tested directly.
 */
export const createStyleCache = (makeStyles) => {
  const cache = new Map();
  return (theme) => {
    const key = theme.name;
    if (!cache.has(key)) {
      cache.set(key, makeStyles(theme));
    }
    return cache.get(key);
  };
};

const caches = new WeakMap();

const useThemedStyles = (makeStyles) => {
  const { theme } = useTheme();
  // One cache per makeStyles function, keyed weakly so unmounted modules can be
  // collected. The WeakMap lookup is O(1) and allocates nothing on the hot path.
  let cached = caches.get(makeStyles);
  if (!cached) {
    cached = createStyleCache(makeStyles);
    caches.set(makeStyles, cached);
  }
  return useMemo(() => cached(theme), [cached, theme]);
};

export default useThemedStyles;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/theme/__tests__/useThemedStyles.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the whole theme suite**

Run: `npx jest src/theme`
Expected: 4 suites, 19 tests, all passing.

- [ ] **Step 6: Commit**

```bash
git add src/theme/useThemedStyles.js src/theme/__tests__/useThemedStyles.test.js
git commit -m "feat(theme): add useThemedStyles with per-theme style caching"
```

---

### Task 6: Repository gates

**Files:**
- Create: `scripts/check-hex.js`
- Create: `scripts/migrated-files.json`
- Create: `scripts/check-i18n-parity.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime.
- Produces: npm scripts `test:unit`, `check:hex`, `check:i18n`, `verify`. Later phases append their migrated files to `scripts/migrated-files.json`.

- [ ] **Step 1: Create the migrated-files allowlist**

Create `scripts/migrated-files.json`. Only files listed here are hex-linted, so a phase opts its files in as it finishes them:

```json
{
  "comment": "Files fully migrated to theme tokens. check-hex.js fails on any raw hex literal in these. Each phase appends its files here as it completes them.",
  "exempt": [
    "src/theme/tokens/palette.js"
  ],
  "migrated": [
    "src/theme/tokens/semantic.js",
    "src/theme/tokens/spacing.js",
    "src/theme/themes.js",
    "src/theme/ThemeContext.jsx",
    "src/theme/useThemedStyles.js",
    "src/theme/index.js"
  ]
}
```

- [ ] **Step 2: Write the hex linter**

Create `scripts/check-hex.js`:

```javascript
/**
 * Fails if any file marked migrated still contains a raw colour literal.
 *
 * Run: npm run check:hex
 *
 * This is what stops finished phases from regressing. Only src/theme/tokens/
 * palette.js may contain hex.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'migrated-files.json'), 'utf8'),
);

// #RGB, #RRGGBB, #RRGGBBAA, plus rgb()/rgba() literals.
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGB = /\brgba?\s*\(/g;

let failed = false;

for (const rel of config.migrated) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`check:hex — listed file does not exist: ${rel}`);
    failed = true;
    continue;
  }
  const src = fs.readFileSync(abs, 'utf8');
  const hits = [
    ...(src.match(HEX) || []),
    ...(src.match(RGB) || []),
  ];
  if (hits.length) {
    console.error(`check:hex — raw colour literal(s) in ${rel}:`);
    src.split('\n').forEach((line, i) => {
      if (HEX.test(line) || RGB.test(line)) {
        console.error(`    ${i + 1}: ${line.trim()}`);
      }
      HEX.lastIndex = 0;
      RGB.lastIndex = 0;
    });
    failed = true;
  }
}

if (failed) {
  console.error(
    '\nMove the colour into src/theme/tokens/palette.js and reference it via a semantic token.',
  );
  process.exit(1);
}

console.log(
  `check:hex OK — ${config.migrated.length} migrated file(s) contain no raw colour literals.`,
);
```

- [ ] **Step 3: Write the i18n parity checker**

Create `scripts/check-i18n-parity.js`:

```javascript
/**
 * Verifies en/hi/mr are key-identical with identical %{var} placeholders.
 *
 * Run: npm run check:i18n
 *
 * Repo rule: the three locales must never drift. Baseline is 1959 keys each.
 */

// Plain require() loads these ES modules directly — Node >= 22.12 supports
// require(esm). Verified working against src/i18n/*.js as written.

const LOCALES = ['en', 'hi', 'mr'];

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? flatten(v, `${prefix}${k}.`)
      : [[`${prefix}${k}`, String(v)]],
  );

const placeholders = (s) =>
  (s.match(/%\{[^}]+\}/g) || []).sort().join(',');

const loaded = {};
for (const loc of LOCALES) {
  const mod = require(`../src/i18n/${loc}.js`);
  loaded[loc] = new Map(flatten(mod.default || mod));
}

let failed = false;
const base = loaded.en;

console.log(
  LOCALES.map((l) => `${l}=${loaded[l].size}`).join('  '),
);

for (const loc of LOCALES.slice(1)) {
  const other = loaded[loc];

  for (const key of base.keys()) {
    if (!other.has(key)) {
      console.error(`check:i18n — ${loc} is MISSING key: ${key}`);
      failed = true;
    }
  }
  for (const key of other.keys()) {
    if (!base.has(key)) {
      console.error(`check:i18n — ${loc} has EXTRA key not in en: ${key}`);
      failed = true;
    }
  }
  for (const [key, value] of base.entries()) {
    if (!other.has(key)) continue;
    const a = placeholders(value);
    const b = placeholders(other.get(key));
    if (a !== b) {
      console.error(
        `check:i18n — placeholder mismatch at ${key}: en has [${a}], ${loc} has [${b}]`,
      );
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`check:i18n OK — ${base.size} keys, identical across ${LOCALES.join('/')}.`);
```

- [ ] **Step 4: Add the npm scripts**

In `package.json`, the `"scripts"` block becomes:

```json
"scripts": {
  "android": "react-native run-android",
  "ios": "react-native run-ios",
  "lint": "eslint .",
  "start": "react-native start",
  "test": "jest",
  "test:unit": "jest src/theme src/features",
  "check:contrast": "node scripts/check-contrast.js",
  "check:hex": "node scripts/check-hex.js",
  "check:i18n": "node scripts/check-i18n-parity.js",
  "verify": "npm run check:i18n && npm run check:hex && npm run check:contrast && npm run test:unit"
}
```

> `test:unit` names `src/features` too — that directory arrives in Phase 3. Jest
> tolerates a path that matches nothing, so this is safe now and needs no edit later.

- [ ] **Step 5: Run each gate individually**

Run: `npm run check:i18n`
Expected: `en=1959  hi=1959  mr=1959` then `check:i18n OK — 1959 keys, identical across en/hi/mr.`

Run: `npm run check:hex`
Expected: `check:hex OK — 6 migrated file(s) contain no raw colour literals.`

> If this fails on `src/theme/tokens/semantic.js` because of `darkColors.shadow`,
> that is the expected catch flagged in Task 2 Step 4. Move `'#000000'` into
> `palette.js` as `dark.shadow` and reference it. This is the gate proving itself.

Run: `npm run check:contrast`
Expected: `Contrast OK — 22 pairs x 2 themes all meet WCAG AA.`

- [ ] **Step 6: Run the full verify chain**

Run: `npm run verify`
Expected: all four gates pass in sequence, exit 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/ package.json
git commit -m "feat(gates): add hex lint, i18n parity, and verify script"
```

---

### Task 7: Mount ThemeProvider and drive StatusBar

**Files:**
- Modify: `App.tsx` (imports near line 21; provider tree at 523-536; `StatusBar` at 470)

**Interfaces:**
- Consumes: `ThemeProvider`, `useTheme` from `src/theme`.
- Produces: a themed app root. Every later phase can call `useTheme()` from any screen.

- [ ] **Step 1: Add the import**

In `App.tsx`, immediately after the `LanguageProvider` import (line 21), add:

```typescript
import { ThemeProvider, useTheme } from './src/theme';
```

- [ ] **Step 2: Extract a theme-driven StatusBar**

`AppContent` currently hardcodes `barStyle="dark-content"` at line 470. Add this small component above `function AppContent()`:

```typescript
/**
 * StatusBar that follows the active theme. Dark backgrounds need light icons.
 * Kept as its own component so only it re-renders when the theme flips.
 */
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return (
    <StatusBar
      barStyle={isDark ? 'light-content' : 'dark-content'}
      backgroundColor="transparent"
      translucent
    />
  );
}
```

- [ ] **Step 3: Use it**

In `AppContent`, replace this line:

```typescript
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
```

with:

```typescript
        <ThemedStatusBar />
```

- [ ] **Step 4: Mount the provider**

In the default-exported `App`, wrap `LanguageProvider` so the tree reads:

```typescript
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
      <SafeAreaProvider>
      <ThemeProvider>
      <LanguageProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
      </LanguageProvider>
      </ThemeProvider>
      </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
```

`ThemeProvider` sits above `LanguageProvider` so that any provider below it, and every screen, can call `useTheme()`.

- [ ] **Step 5: Parse-check**

Run:
```bash
npx babel --presets module:@react-native/babel-preset --extensions .tsx App.tsx -o /dev/null
```
Expected: no output, exit 0.

- [ ] **Step 6: Confirm no visual change**

`ThemedStatusBar` resolves to `dark-content` whenever the theme is light, and the
default mode is `system` on a device that is almost certainly light. **No screen
consumes tokens yet**, so the app renders exactly as before. Confirm by inspection
that no other file was modified:

Run: `git diff --stat`
Expected: `App.tsx` only.

- [ ] **Step 7: Commit**

```bash
git add App.tsx
git commit -m "feat(theme): mount ThemeProvider and make StatusBar theme-driven"
```

---

### Task 8: Night launch background

**Files:**
- Create: `android/app/src/main/res/values-night/styles.xml`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks. Removes the cold-start light flash under system dark mode.

- [ ] **Step 1: Read the existing day styles**

Run: `cat android/app/src/main/res/values/styles.xml`
Expected: an `AppTheme` extending `Theme.AppCompat.DayNight.NoActionBar` with an `android:editTextBackground` item.

- [ ] **Step 2: Create the night variant**

Create `android/app/src/main/res/values-night/styles.xml`:

```xml
<resources>

    <!-- Night variant of AppTheme.
         The base theme already extends Theme.AppCompat.DayNight.NoActionBar, so
         Android resolves this automatically under system dark mode. Setting the
         window background here stops the cold-start light flash before the JS
         theme mounts. -->
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="android:editTextBackground">@drawable/rn_edit_text_material</item>
        <item name="android:windowBackground">@color/theme_night_background</item>
    </style>

</resources>
```

- [ ] **Step 3: Declare the colour**

Create `android/app/src/main/res/values-night/colors.xml`:

```xml
<resources>
    <!-- Must match darkColors.bg in src/theme/tokens/semantic.js (palette dark.base). -->
    <color name="theme_night_background">#0B1220</color>
</resources>
```

- [ ] **Step 4: Verify the XML parses**

Run:
```bash
python3 -c "import xml.dom.minidom as m; [m.parse(p) for p in ['android/app/src/main/res/values-night/styles.xml','android/app/src/main/res/values-night/colors.xml']]; print('XML OK')"
```
Expected: `XML OK`

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/res/values-night/
git commit -m "feat(theme): add night launch background for Android dark mode"
```

---

### Task 9: Delete confirmed-dead screens

**Files:**
- Delete: `src/screens/HomeScreen.jsx`
- Delete: `src/screens/DocumentVerificationScreen.jsx`
- Modify: `src/screens/index.js` (remove lines 35 and 53)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Removes 2,105 lines and 119 hex literals from the migration surface.

- [ ] **Step 1: Re-verify non-use — this is a precondition, not a formality**

Run:
```bash
grep -rnE "(^|[^A-Za-z])HomeScreen\b" src navigation App.tsx index.js __tests__ \
  --include="*.js" --include="*.jsx" --include="*.tsx" \
  | grep -vE "UserHomeScreen|ProviderHomeScreen"
```
Expected: exactly three lines — `src/screens/index.js:35`, and two inside `src/screens/HomeScreen.jsx` itself.

Run:
```bash
grep -rn "DocumentVerificationScreen" src navigation App.tsx index.js __tests__ \
  --include="*.js" --include="*.jsx" --include="*.tsx"
```
Expected: exactly three lines — `src/screens/index.js:53`, and two inside `src/screens/DocumentVerificationScreen.jsx` itself.

**If either search returns anything else, STOP and report it. Do not delete.**

- [ ] **Step 2: Confirm the route name survives**

The route `DocumentVerification` is registered in both navigators but resolves to
`ServiceApprovalsScreen`, not to the deleted file.

Run: `grep -n "DocumentVerification" navigation/RootNavigator.jsx`
Expected: two `name="DocumentVerification"` entries, each with
`component={ServiceApprovalsScreen}`.

- [ ] **Step 3: Delete the files**

```bash
git rm src/screens/HomeScreen.jsx src/screens/DocumentVerificationScreen.jsx
```

- [ ] **Step 4: Remove the barrel exports**

In `src/screens/index.js`, delete these two lines:

```javascript
export { default as HomeScreen } from './HomeScreen';
```

```javascript
export { default as DocumentVerificationScreen } from './DocumentVerificationScreen';
```

- [ ] **Step 5: Verify nothing dangles**

Run:
```bash
grep -rnE "(^|[^A-Za-z])HomeScreen\b" src navigation App.tsx \
  --include="*.js" --include="*.jsx" --include="*.tsx" \
  | grep -vE "UserHomeScreen|ProviderHomeScreen"
grep -rn "DocumentVerificationScreen" src navigation App.tsx \
  --include="*.js" --include="*.jsx" --include="*.tsx"
```
Expected: no output from either.

- [ ] **Step 6: Parse-check the barrel**

Run:
```bash
npx babel --presets module:@react-native/babel-preset src/screens/index.js -o /dev/null
```
Expected: no output, exit 0.

- [ ] **Step 7: Confirm RootNavigator still resolves every import it uses**

Run:
```bash
node -e "
const fs=require('fs');
const nav=fs.readFileSync('navigation/RootNavigator.jsx','utf8');
const barrel=fs.readFileSync('src/screens/index.js','utf8');
const m=nav.match(/import \{([^}]*)\} from '\.\.\/src\/screens';/);
const wanted=m[1].split(',').map(s=>s.trim()).filter(Boolean);
const missing=wanted.filter(n=>!new RegExp('as '+n+'\\\\s*\\\\}').test(barrel));
if(missing.length){console.error('MISSING FROM BARREL:',missing);process.exit(1);}
console.log('All '+wanted.length+' RootNavigator imports resolve.');
"
```
Expected: `All 28 RootNavigator imports resolve.`

> The `[^}]*` character class matters: `[\s\S]*?` matches from the first `import {`
> in the file (the `react-native` one) and swallows every import above the barrel.

- [ ] **Step 8: Run the full gate chain**

Run: `npm run verify`
Expected: all four gates pass.

- [ ] **Step 9: Commit**

```bash
git add -A src/screens/
git commit -m "chore(cleanup): delete unreachable HomeScreen and DocumentVerificationScreen

Both were exported from the screens barrel but never routed. RootNavigator
imports from that barrel and Metro does not tree-shake barrel re-exports, so
2105 unreachable lines were being compiled into the production bundle.

The DocumentVerification route name stays live in both navigators and
continues to resolve to ServiceApprovalsScreen."
```

---

### Task 10: Close out Phase 1

**Files:**
- Modify: `docs/VERIFICATION_AND_THEME_PHASES.md`

- [ ] **Step 1: Run the full gate chain one final time**

Run: `npm run verify`
Expected: exit 0, all four gates green.

- [ ] **Step 2: Lint against a baseline**

Run:
```bash
git stash && npx eslint . -f unix 2>&1 | tail -1 > /tmp/lint-before.txt
git stash pop && npx eslint . -f unix 2>&1 | tail -1 > /tmp/lint-after.txt
diff /tmp/lint-before.txt /tmp/lint-after.txt && echo "No new lint issues"
```
Expected: the counts match, or the after-count is lower. **Never compare against zero** — this repo lints against a baseline.

- [ ] **Step 3: Tick the phase board**

In `docs/VERIFICATION_AND_THEME_PHASES.md`, change:

```markdown
- [ ] Phase 1 — Theme engine, tokens, gates, dead-file deletion
```

to:

```markdown
- [x] Phase 1 — Theme engine, tokens, gates, dead-file deletion
```

- [ ] **Step 4: Commit**

```bash
git add docs/VERIFICATION_AND_THEME_PHASES.md
git commit -m "docs(phase1): mark theme foundation complete"
```

---

## What this plan deliberately does NOT do

State these plainly when reporting completion — they are scope boundaries, not oversights:

- **No screen is themed.** Not one existing screen imports `src/theme`. The app looks identical.
- **No Settings UI.** The Light/Dark/System control is Phase 3, gated on the Phase 2 mockup approval.
- **No i18n keys added.** All three locales stay at 1959.
- **`npm test` remains red.** `App.test.tsx` still fails on native modules. Use `npm run test:unit`.
- **Nothing is device-verified.** This environment cannot run the app.

## Next plans

Each is written when its predecessor lands, so it reflects the code as it actually is:

| Plan | Covers |
|---|---|
| `2026-XX-XX-verification-mockup.md` | Phase 2 — HTML mockup, light + dark, both Mapbox dark candidates. Owner approval gate. |
| `2026-XX-XX-verification-module.md` | Phase 3 — verification UI/state rework, defects V1–V6, Settings theme control |
| `2026-XX-XX-backend-verification-audit.md` | Phase 4 — read-only IDOR/race audit |
| `2026-XX-XX-theme-migration-chrome.md` | Phase 5 — shared chrome, `<Screen>` primitive |
| `2026-XX-XX-theme-migration-screens.md` | Phases 6–8 — user, auth, provider screens + Mapbox |
| `2026-XX-XX-theme-sweep.md` | Phase 9 — full sweep, device checklist |
