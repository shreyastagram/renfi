# Profile Screen Redesign — Design Spec

**Date:** 2026-07-09
**Branch:** `feature/profile-redesign` (off `feature/phone-signup-users-ui` @ ff759cd)
**Scope:** `src/screens/ProfileScreen.jsx` (serves both User and Provider), plus i18n string additions. **Frontend only — no backend/DB changes.**

---

## 1. Goal & Non-Goals

### Goal
Replace the current "stack of 5–6 heavy shadowed cards" profile with a **flat, sectioned, LinkedIn-style layout** that:
- Shows **all existing profile data in view mode** (no data hidden behind Edit — the provider "Working since" date is the headline example).
- **Segregates data into logical sections** (rating/jobs/experience out of "Personal Info").
- Moves editing **inline, per-section** (no global top-bar Edit button).
- Is modern, sleek, and smooth on **both iOS and Android**, with **navigation gestures and buttons** intact.

### Non-Goals
- **No new data fields.** Presentation only. Every value shown already exists in the schema and is already fetched.
- **No backend / DB / API changes.** All saves use the existing update services.
- No redesign of downstream screens (DocumentVerification, PortfolioEdit, Subscription, Favorites, SavedAddresses) — only how they're linked from Profile.

---

## 2. Current State (as-is)

- One 4,136-line `ProfileScreen.jsx`, branching on `userType` (`isProvider`).
- View mode = vertical stack of white shadowed cards: Hero → "Personal Info" (name, address, city, pincode, **rating, experience, services, portfolio all mixed in**) → "Verification" → Saved Addresses / Favorites (user) → Premium (provider) → "Account" (User ID + Member Since).
- A single `isEditing` boolean flips the whole "Personal Info" area into one big form (name, phone, location, experience picker, categories). **"Working since" month/year only appears here.**
- Global Edit/Discard button in the top app bar.
- Save path: `handleSave` → `performSave(userId)` → `updateUserProfile` / `updateProviderProfile` (Node/Mongo), with name/phone synced to Java Auth first.

### Confirmed data availability (already fetched by `profileService`)
Common: `fullName`, `email`, `phone`, `isPhoneVerified`, `isEmailVerified`, `profilePicture.url`, `address`, `city`, `pincode`, `createdAt`.
Provider extra: `verifiedServiceCategories`, `serviceCategories` (pending), `experience` / `experienceStartDate`, `bio`, `portfolioLinks`, `specializations`, `portfolioGallery`, Aadhaar (`aadhaarStatus`), premium (`premiumStatus`), **`ratings.average` + `ratings.total`**, **`stats.completedRequests`**.

`bio` schema: `provider.js:336` → `bio: { type: String, default: "", maxlength: 1000 }`. Persisted by `authController.js:2663-2664`. Editable today only via PortfolioEditScreen (photographer/influencer). **Existing users have `bio: ""` — no migration, no breakage.**

---

## 3. New Layout

### 3.1 Shared "section" visual system (replaces cards)
- One continuous white canvas. **No floating shadowed cards.**
- A **section** = bold dark title (~16px) + optional right-side affordance (edit pencil or link) + content rows.
- Sections separated by a **thin 9px grey band** (`#F4F6FA` with hairline borders), not shadows.
- **Detail row** = small 36px light-grey icon tile + uppercase muted label + dark value + optional right slot (verified badge / verify button). Much lighter than today's 42px colored tiles.

### 3.2 Hero (both roles, flat)
- **Immersive header that bleeds into the status bar** (replaces the old white app-bar + gap that wasted the top third):
  - A **vertical `LinearGradient`** fills from the very top of the screen (behind the status bar) down through the nav row and banner. Stops go **soft→rich**: a light brand tint at the top (~0–15%) so the OS clock/battery stay legible with **dark** status-bar icons, deepening to the rich brand color where the avatar overlaps. Provider = orange (`#FFF3EA → #FBDDC5 → #f6851f → #EA580C`), User = blue (`#E9F2FB → #CBE1F5 → #3a86cf → #1e5f9e`).
  - Top padding = `useSafeAreaInsets().top` so the soft zone is exactly the device's status-bar height (short/tall Android status bars, punch-holes, iOS notch/Dynamic Island). `StatusBar` translucent + `dark-content`; Android `setBackgroundColor('transparent')` (already done in this screen).
  - Nav row (back chip `rgba(255,255,255,0.55)` + dark "Profile" title) sits on the soft tint. The header **scrolls with content** (no sticky bar); dark status-bar icons remain readable over the white content beneath once scrolled.
  - Flowing SVG art (existing `react-native-svg` banner art) overlays the rich lower band.
- Type badge top-right of the rich band — **icon + label properly inline-aligned** (fixes the "icon in the middle of the text" bug).
- Avatar **top-left**, overlapping the banner (−44px, negative margin), with camera overlay (existing upload flow).
- **Edit pencil** button top-right of the hero (opens identity mini-editor). Replaces the top-bar button.
- Name + PRO badge (provider premium) → headline (provider: top services / user: "Customer") → location line (`city`).
- **Provider stat strip** (LinkedIn "connections" analogue): `Jobs done | Rating (n reviews) | Experience` using `stats.completedRequests`, `ratings.average`+`ratings.total`, computed experience. Cells hidden/"New" when zero.
- Verification chips row (phone / email / KYC), reflecting real flags.

### 3.3 Provider sections (in order)
1. **About** — `bio`. Empty state (existing users) = dashed "Add a short intro…" prompt → opens About editor.
2. **Services** — verified chips + pending chips; "Add more" → `DocumentVerification`.
3. **Experience** — "Working since {Month Year}" + "≈ X yrs Y mos"; rating + jobs sub-row. Edit pencil → Experience editor. **This surfaces the previously-hidden data.**
4. **Portfolio** — photographer/influencer only: links + specializations + gallery. "Edit" → `PortfolioEdit`.
5. **Premium** — **dark gradient promo strip** (gold crown, ACTIVE/days-left/priority/boosted, or Go-Premium CTA) → `Subscription`. Kept prominent per decision.
6. **Verification** — Phone / Email / Aadhaar rows with existing verify actions (OTP box, Aadhaar modal).
7. **Footer** — "Member since {Month Year}" only. **No User ID.**

### 3.4 User sections (in order)
1. **Contact & location** — phone, email, address, city, pincode. Edit pencil → Contact editor.
2. **Verification** — Phone (+ OTP), Email verify.
3. **Saved addresses** — row link → addresses modal.
4. **Favourites** — row link → `Favorites`.
5. **Footer** — "Member since". No User ID.

---

## 4. Per-Section Inline Editing (the interaction model)

Replace the single `isEditing` boolean with `editingSection` state:
`null | 'identity' | 'contact' | 'experience' | 'about'`.

- Only one section edits at a time. Tapping a pencil sets `editingSection`; the section swaps its read-only content for a compact inline editor with **Save** / **Cancel**.
- Editors and their fields:
  - **identity** (hero): `fullName` (locked if Aadhaar name-locked), `phone` (with change warning + PhoneInput). Photo upload stays always-available via the avatar camera.
  - **contact** (user): `address` (AddressAutocomplete), `city` (CityAutocomplete), `pincode`, + "Detect my location". (Phone lives in identity; email via verification flow.)
  - **experience** (provider): "Working since" month/year picker (`experienceStartDate`).
  - **about** (provider): `bio` multiline (maxLength 1000, char counter).
- **Save = partial update.** Each editor submits only its own fields through a shared `saveProfileFields(fields)` helper that wraps the existing `updateUserProfile` / `updateProviderProfile`. Name/phone→Java-Auth sync fires **only** when those fields are present. On success: update context (`refreshProfile`), collapse the editor. Validation reuses current rules (name, phone, pincode).
- Services/Portfolio remain **navigations** (DocumentVerification / PortfolioEdit), not inline editors.

### Why per-section (vs one form)
Long-term maintainable, matches LinkedIn UX, smaller writes, only-changed-section re-render, and each editor is independently testable. The shared save helper keeps the Java-Auth sync + validation logic in one place (no duplication).

---

## 5. iOS / Gestures / Routes (must-preserve checklist)
- Keep `navigation.goBack()` and the **iOS swipe-back gesture** working (screen stays a normal stack child; don't intercept the left edge; inline editors use in-place Views, not modals that block the gesture).
- Preserve every route target exactly: `DocumentVerification`, `PortfolioEdit`, `Subscription`, `Favorites`, `Verification` (email), addresses modal, Aadhaar modal.
- Preserve `KeyboardAvoidingView` (iOS `padding`), `useSafeAreaInsets`, `DateTimePicker` iOS spinner + Done button, `react-native-image-picker`, SMS OTP autofill props.
- Keep `useFocusEffect` refresh, AppState resume refresh, status-bar handling.
- No new native deps.

---

## 6. Performance
- Partial `$set` writes; Java-Auth sync only on name/phone change.
- No new fetches; existing SWR caches (aadhaar/premium) unchanged.
- Memoized row/section components; only the actively-edited section re-renders.
- Net: lighter than the current monolithic-form approach on server, DB, and client.

---

## 7. Implementation Notes
- **No new dependencies.** Header gradient uses `react-native-linear-gradient` (already imported in `UserHomeScreen`/`LoginScreen`/etc.); banner art uses `react-native-svg` (already used in this screen). No web-only techniques — the mockup's `backdrop-filter` is replaced by a solid translucent color (`@react-native-community/blur` available if true blur is ever wanted). `aspectRatio`, `flexWrap`, negative margins, `overflow:'hidden'` rounding, and `Platform.select` shadows are all standard RN.
- All strings via i18n (`en.js`, `hi.js`, `mr.js`) — add keys for new section titles / About empty-state / stat labels, reusing existing keys where present (`experience.workingSince`, `profile.*`).
- Add new sub-components inside ProfileScreen: `ProfileSection`, `DetailRow`, `StatStrip`, `SectionEditorShell`, plus the four inline editors.
- New styles appended to the existing `StyleSheet`; retire now-unused card styles (leave shared ones).
- Keep `formatExperience` / `formatMonthYear` usage for Experience.

---

## 8. Test Plan (post-build QA checklist)

### Provider — view
- [ ] Working-since date visible **without** entering edit; correct "≈ X yrs Y mos".
- [ ] Stat strip shows jobs / rating(reviews) / experience; new provider (all zero) degrades gracefully.
- [ ] Services: verified vs pending chips correct; "Add more" → DocumentVerification.
- [ ] About shows bio; empty bio → "Add a short intro" prompt.
- [ ] Portfolio only for photographer/influencer; gallery viewer opens; "Edit" → PortfolioEdit.
- [ ] Premium: active (days left) vs inactive (Go Premium) → Subscription; loading shimmer.
- [ ] Verification: phone/email/Aadhaar statuses; OTP box; Aadhaar modal; name-lock notice.
- [ ] No User ID anywhere; footer shows Member since.

### User — view
- [ ] Contact & location shows all of phone/email/address/city/pincode.
- [ ] Verification: phone OTP flow; email verify → Verification screen.
- [ ] Saved addresses modal opens (incl. deep-link `scrollToAddresses`); Favourites → Favorites.

### Editing (per-section)
- [ ] Each pencil opens only its section; Cancel restores original values.
- [ ] identity: name save syncs to Java Auth; Aadhaar-locked name is read-only; phone-change warning + re-verify prompt.
- [ ] contact: Address/City autocomplete fills fields; Detect-my-location; pincode 6-digit.
- [ ] experience: month/year picker (iOS spinner + Done, Android calendar), clear button, save.
- [ ] about: 1000-char limit, counter, save persists, reload shows it.
- [ ] Duplicate phone → 409 handled; no-changes → no-op; offline → error dialog, no data loss.
- [ ] Only-changed-fields sent (verify in network log); Java-Auth NOT called when editing about/experience/contact-without-phone.

### Cross-cutting / iOS
- [ ] iOS swipe-back works from profile and while a section editor is open.
- [ ] Android hardware back + gesture back.
- [ ] Keyboard doesn't cover inputs (iOS); safe-area top/bottom correct on notch devices.
- [ ] Profile picture upload (camera + gallery) + view photo modal.
- [ ] Pull-to-refresh; focus refresh; resume refresh.
- [ ] hi / mr / en all render (no raw i18n keys, no overflow/clipping).
- [ ] Backward compat: user created before `bio` existed loads fine (empty About).

---

## 9. Risks & Mitigations
- **Refactor of edit flow** (single→per-section) is the main risk → mitigate by centralizing save/validation in one shared helper and reusing existing `performSave` logic; keep field-level behavior identical.
- **Gesture regressions on iOS** → inline editors are in-place Views, not full-screen modals; manual swipe-back test in checklist.
- **i18n gaps** → add keys to all three locale files in the same change.
