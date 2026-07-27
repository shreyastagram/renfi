# Colour → Token Map

Generated from a full census of the app on 2026-07-27, **before** any screen migration.
Census: **3,080 colour occurrences, 364 distinct colours, 77 files.**

> This file is the contract for Phases 5–8. Do not invent a mapping at migration time —
> look it up here. If a colour is not listed, it is in the long tail (§4): decide per site,
> then **add it here** so the next phase inherits the decision.

---

## 1. Why a blind codemod would corrupt this app

**64 of 364 colours are multi-role** — the same hex serving different semantic jobs:

| Colour | as foreground | as surface | as border | as shadow |
|---|---|---|---|---|
| `#ffffff` | 164 | 100 | 11 | 0 |
| `#0f172a` | 53 | 4 | 0 | 56 |
| `#f67c16` | 39 | 17 | 11 | 17 |
| `#f1f5f9` | 0 | 71 | 28 | 0 |
| `#e2e8f0` | 1 | 17 | 56 | 0 |

`#ffffff` alone needs three different tokens depending on where it sits. Migration is
therefore **per-site semantic judgement**, never find-and-replace.

## 2. The two neutral ramps

The app uses Tailwind **slate** (669) and Tailwind **gray** (321) interchangeably;
13 files mix both internally. Decision (owner, 2026-07-27): **model both so light mode
stays pixel-identical, unify them in dark.**

Where the ramps stay separate vs converge, measured by CIE76 dE against the slate step
(dE < 2.3 = below the just-noticeable-difference threshold):

| Step | dE | AA as text | Decision |
|---|---|---|---|
| 900 | 3.09 | both pass | **separate** — visible and accessible |
| 800 | 2.81 | both pass | **separate** |
| 700 | 2.84 | both pass | **separate** |
| 500 | 5.99 | both **FAIL** (4.32 / 4.39) | **converge** — must change for AA anyway |
| 400 | 5.59 | both **FAIL** (2.33 / 2.31) | **converge** — must change for AA anyway |
| 300 | 3.74 | border/surface | **separate** |
| 200 | 2.47 | border/surface | **separate** |
| 100 | 1.46 | surface | **converge** — below JND |
| 50 | 0.61 | surface | **converge** — below JND |

## 3. Confirmed mappings (76% of all occurrences)

### Neutrals — slate ramp
| Colour | n | Token | Note |
|---|---|---|---|
| `#0f172a` | 134 | `textPrimary` / `shadow` / `onBrandOrange` | **role-dependent** |
| `#1e293b` | 61 | `textStrong` | |
| `#334155` | 5 | `textBody` | |
| `#475569` | 11 | `textSecondary` | |
| `#64748b` | 90 | `textSecondary` | **changes** — slate-500 fails AA at 4.32 |
| `#94a3b8` | 108 | `textMuted` | **changes** — slate-400 fails AA at 2.33 |
| `#cbd5e1` | 24 | `borderMedium` | |
| `#e2e8f0` | 83 | `border` | |
| `#f1f5f9` | 104 | `bg` / `surfaceSunken` | **role-dependent** |
| `#f8fafc` | 49 | `surfaceSunken` | |

### Neutrals — gray ramp
| Colour | n | Token | Note |
|---|---|---|---|
| `#111827` | 6 | `textPrimaryNeutral` | |
| `#1f2937` | 54 | `textStrongNeutral` | |
| `#374151` | 28 | `textBodyNeutral` | |
| `#6b7280` | 86 | `textSecondary` | **changes** — gray-500 fails AA at 4.39 |
| `#9ca3af` | 53 | `textMuted` | **changes** — gray-400 fails AA at 2.31 |
| `#d1d5db` | 21 | `borderMediumNeutral` | |
| `#e5e7eb` | 33 | `borderNeutral` | |
| `#f3f4f6` | 28 | `bg` | converged, dE 1.46 |
| `#f9fafb` | 12 | `surfaceSunken` | converged, dE 0.61 |

### White / black
| Colour | n | Token |
|---|---|---|
| `#ffffff` | 343 | `surface` / `textInverse` / `onBrandBlue` — **role-dependent** |
| `#fff` | 74 | same, shorthand |
| `#000` / `#000000` | 71 | `shadow` |

### Brand
| Colour | n | Token |
|---|---|---|
| `#f67c16` | 127 | `brandOrange` — **never carries white text**, use `onBrandOrange` |
| `#2b76bc` | 79 | `brandBlue` |
| `#1e5f9e` | 3 | `info` |

### Non-brand blues — kept distinct (owner decision, brand-consistency debt)
| Colour | n | Token |
|---|---|---|
| `#2563eb` | 38 | `altBlueIndigo` |
| `#3b82f6` | 33 | `altBlueSky` |
| `#007aff` | 16 | `altBlueIos` (iOS system blue) |

### Semantic
| Colour | n | Token |
|---|---|---|
| `#10b981` `#16a34a` `#15803d` | 54/24/– | `success` |
| `#ef4444` `#dc2626` `#b91c1c` | 76/47/– | `danger` |
| `#f59e0b` `#d97706` `#b45309` `#92400e` `#c2410c` | 53/18/–/23/– | `warning` |
| `#eff6ff` | 54 | `infoContainer` |
| `#fef2f2` `#fee2e2` `#fecaca` | 44/27/19 | `dangerContainer` |
| `#fff7ed` `#fef3c7` `#fffbeb` | 38/25/18 | `warningContainer` |
| `#ecfdf5` `#f0fdf4` `#bbf7d0` | 20/–/– | `successContainer` |

## 4. Long tail — 734 occurrences, 314 colours, decide per site

Four groups need a decision **before** Phase 5, not during it:

### 4.1 An undeclared purple/violet accent (~42 occurrences)
`#7c3aed` (16), `#8b5cf6` (11), `#f3e8ff` (8), `#ede9fe` (7).
Used in `ServiceRequestDetailScreen`, `ProfileScreen`, `ProviderDetailsModal`, `Icon`,
`PortfolioEditScreen`. **There is no purple token.** Either add an `accentViolet` +
`accentVioletContainer` pair, or map to an existing semantic. **Owner decision required.**

### 4.2 Third-party brand colours — MUST NOT be themed
`#4285f4` (9) is **Google brand blue** in `UnifiedUserAuthScreen`, `LoginScreen`,
`RegisterChoice`. Google's brand guidelines fix this colour; theming it would break
sign-in button compliance. Treat as an asset constant, exempt from the hex lint.
Audit for Apple sign-in equivalents at the same time.

### 4.3 Translucent scrims — need inversion logic, not a colour map
~50 occurrences of `rgba(255,255,255,0.08 … 0.7)` used as glass/highlight overlays on
dark hero surfaces, plus `rgba(0,0,0,0.04)` and `rgba(15,23,42,0.5 … 0.6)` scrims, plus
brand tints `rgba(246,124,22,0.06 / 0.08)`.
A white 12% overlay on a light surface in dark mode is wrong — these need explicit
`overlayOnDark` / `overlayOnLight` tokens whose alpha and base flip with the theme.

### 4.4 iOS system greys
`#f2f2f7`, `#f5f5f7`, `#fafbfc`, plus short-form `#333` / `#666` in
`CreateServiceRequestScreen`. Map to the nearest surface/text token per site.

## 5. Regenerating this census

The census script lives in the session scratchpad, not the repo. To rebuild: walk
`src/` and `navigation/` for `.js/.jsx/.ts/.tsx`, match
`#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)`, and capture the property name immediately
preceding each match to derive its semantic role.
