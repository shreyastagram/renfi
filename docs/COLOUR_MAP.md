# Colour → Token Map

Census taken against **`v1.0.9`** on 2026-09-24, **before** any screen migration.
**3,329 colour occurrences · 373 distinct colours · 88 files.**

> This file is the contract for the migration phases. Do not invent a mapping at migration
> time — look it up here. If a colour is not listed, it is in the long tail (§4): decide per
> site, then **add it here** so the next phase inherits the decision.
>
> Supersedes the census taken against `5cfcd56` (3,080 / 364 / 77), which is obsolete.

---

## 1. Why a blind codemod would corrupt this app

**65 of 373 colours are multi-role** — the same hex serving different semantic jobs:

| Colour | as foreground | as surface | as border | as shadow |
|---|---|---|---|---|
| `#ffffff` | 174 | 108 | 11 | 0 |
| `#0f172a` | 55 | 4 | 0 | 56 |
| `#f67c16` | 40 | 17 | 12 | 17 |
| `#f1f5f9` | 0 | 76 | 30 | 0 |
| `#e2e8f0` | 1 | 20 | 61 | 0 |
| `#94a3b8` | 88 | 1 | 1 | 0 |

`#ffffff` alone needs three different tokens depending on where it sits. Migration is
therefore **per-site semantic judgement**, never find-and-replace.

**179 colours appear exactly once** — a long tail needing individual decisions.

## 2. The two neutral ramps

Tailwind **slate** (724) and Tailwind **gray** (373) are used interchangeably; **14 files
mix both internally**. Owner decision: **model both so light mode stays pixel-identical,
unify them in dark.**

Where they stay separate vs converge, by CIE76 dE against the slate step
(dE < 2.3 = below the just-noticeable-difference threshold):

| Step | dE | AA as text | Decision |
|---|---|---|---|
| 900 | 3.09 | both pass | **separate** |
| 800 | 2.81 | both pass | **separate** |
| 700 | 2.84 | both pass | **separate** |
| 500 | 5.99 | both **FAIL** (4.32 / 4.39) | **converge** — must change for AA anyway |
| 400 | 5.59 | both **FAIL** (2.33 / 2.31) | **converge** — must change for AA anyway |
| 300 | 3.74 | border/surface | **separate** |
| 200 | 2.47 | border/surface | **separate** |
| 100 | 1.46 | surface | **converge** — below JND |
| 50 | 0.61 | surface | **converge** — below JND |

## 3. Confirmed mappings

### Neutrals — slate ramp
| Colour | n | Token | Note |
|---|---|---|---|
| `#0f172a` | 142 | `textPrimary` / `shadow` / `onBrandOrange` | **role-dependent** |
| `#1e293b` | 63 | `textStrong` | |
| `#334155` | — | `textBody` | |
| `#475569` | — | `textSecondary` | |
| `#64748b` | 97 | `textSecondary` | **changes** — slate-500 fails AA at 4.32 |
| `#94a3b8` | 114 | `textMuted` | **changes** — slate-400 fails AA at 2.33 |
| `#cbd5e1` | — | `borderMedium` | |
| `#e2e8f0` | 93 | `border` | |
| `#f1f5f9` | 113 | `bg` / `surfaceSunken` | **role-dependent** |
| `#f8fafc` | — | `surfaceSunken` | |

### Neutrals — gray ramp
| Colour | n | Token | Note |
|---|---|---|---|
| `#111827` | — | `textPrimaryNeutral` | |
| `#1f2937` | 67 | `textStrongNeutral` | |
| `#374151` | — | `textBodyNeutral` | |
| `#6b7280` | 104 | `textSecondary` | **changes** — gray-500 fails AA at 4.39 |
| `#9ca3af` | — | `textMuted` | **changes** — gray-400 fails AA at 2.31 |
| `#d1d5db` | — | `borderMediumNeutral` | |
| `#e5e7eb` | — | `borderNeutral` | |
| `#f3f4f6` | — | `bg` | converged, dE 1.46 |
| `#f9fafb` | — | `surfaceSunken` | converged, dE 0.61 |

### White / black
| Colour | n | Token |
|---|---|---|
| `#ffffff` | 371 | `surface` / `textInverse` / `onBrandBlue` — **role-dependent** |
| `#fff` | 74 | same, shorthand |
| `#000` / `#000000` | 60+ | `shadow` |

### Brand
| Colour | n | Token |
|---|---|---|
| `#f67c16` | 137 | `brandOrange` — **fill only, never text or icon on light**; use `onBrandOrange` |
| `#2b76bc` | 85 | `brandBlue` |
| `#1e5f9e` | — | `info` |

### Non-brand blues — kept distinct (brand-consistency debt)
`#2563eb` → `altBlueIndigo` · `#3b82f6` → `altBlueSky` · `#007aff` → `altBlueIos`

### Categorical violet — scoped, not expanded
`#7c3aed` / `#8b5cf6` → `accentViolet` · `#f3e8ff` / `#ede9fe` → `accentVioletContainer`

### Semantic
| Colour | Token |
|---|---|
| `#10b981` `#16a34a` `#15803d` | `success` |
| `#ef4444` (85) `#dc2626` `#b91c1c` | `danger` |
| `#f59e0b` `#d97706` `#b45309` `#92400e` `#c2410c` | `warning` |
| `#eff6ff` (63) | `infoContainer` |
| `#fef2f2` `#fee2e2` `#fecaca` | `dangerContainer` |
| `#fff7ed` `#fef3c7` `#fffbeb` | `warningContainer` |
| `#ecfdf5` `#f0fdf4` `#bbf7d0` | `successContainer` |

## 4. NEW since the last census — Working Hours (121 occurrences)

Shipped in 1.0.9, live in production. **Not covered by the previous analysis.**

| File | Colours |
|---|---|
| `WeeklyScheduleCard.jsx` | 46 |
| `ProviderHomeTopRow.jsx` | 31 |
| `WorkAvailabilityScreen.jsx` | 20 |
| `DayHoursSheet.jsx` | 14 |
| `TimePickerField.jsx` | 10 |

Three constraints that must be honoured, all verified in the code:

1. **`TimePickerField.jsx:94` hardcodes `themeVariant="light"`.** Without it the iOS wheel is
   invisible in system dark mode on a white sheet. When the sheet becomes theme-aware, the
   wheel and the sheet must flip **together** — removing one without the other reintroduces
   the bug it was patched around.
2. **The status colours in `WeeklyScheduleCard` carry meaning** (green/amber/grey/blue/red).
   Each needs a deliberate dark pair. **Do not invert.**
3. **`ProviderHomeTopRow` and `WeeklyScheduleCard` are `React.memo` with primitive props
   on purpose** — `ProviderHomeScreen` re-renders often. Theme injection must not allocate
   new style objects per render. Use module-scope `makeStyles` + `useThemedStyles`.

## 5. Long tail — decide per site, then record here

- **Translucent scrims** (~50 × `rgba(255,255,255,0.08–0.7)`, plus `rgba(0,0,0,0.04)` and
  `rgba(15,23,42,0.5–0.6)`) need `overlayOnDark` / `overlayOnLight` tokens whose base and
  alpha flip with the theme — **not** a colour map. A white 12% overlay is right on a dark
  hero and wrong on a light surface in dark mode.
  **The website hit this exact trap:** tokens that flip with the theme must never be used on
  surfaces that stay dark in both themes. Use dedicated stable tokens there.
- **`#4285F4` is Google brand blue** — recorded under `palette.vendor`, **never themed**.
  Theming it breaks sign-in brand compliance. Audit for an Apple equivalent too.
- **12 service-category accents** in `UserHomeScreen` — **no changes needed**, all clear 3:1
  on the dark surface. Six sit below 3:1 on white today (Solar 1.92, Electrician 2.15, AC
  2.43, Driver 2.49, Salon 2.65, Vehicle Clean 2.77); not a WCAG failure since each icon
  sits above its text label, but dark mode renders them *better* than light does.
  Note the comment above `SERVICE_CATEGORIES` claims "no rainbow" while `SERVICE_COLORS`
  below it is a twelve-hue rainbow — **the comment is stale, not the code.**
- **iOS system greys** `#f2f2f7`, `#f5f5f7`, `#fafbfc`, and short-form `#333` / `#666` in
  `CreateServiceRequestScreen` — map to the nearest surface/text token per site.
- **120 occurrences sit in two unreachable files** (`DocumentVerificationScreen.jsx` 73,
  `HomeScreen.jsx` 47). Re-verify non-use and delete before migrating, rather than theming
  dead code.

## 6. Regenerating this census

Walk `src/` and `navigation/` for `.js/.jsx/.ts/.tsx`, match
`#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)`, and capture the property name immediately preceding
each match to derive its semantic role.
