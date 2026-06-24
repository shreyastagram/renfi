# Phone-Signup — Device Test Plan

Covers the USER phone-number signup feature (Phase 2 UI) **and** the OTP-screen
polish applied on 2026-06-24. Run every section on **BOTH iOS and Android** —
the two platforms diverge on keyboard, autofill, and focus behavior, which is
exactly what several of these tests target.

> ⚠️ **`OTPVerifyScreen` is SHARED with the live phone *login*** (user + provider).
> The OTP changes improve login too — so **Section D (login regression) is mandatory**,
> not optional. A pass on signup alone is not enough.

---

## 0. Pre-test setup

- [ ] `renfi/src/config/environment.js` → `USE_DEV_STAGING = true` (app talks to `jauth-dev` / `noefix-dev`, the isolated dev env).
- [ ] On boot, Metro logs show `🚧 USE_DEV_STAGING=true … hitting DEV Render`. Confirm it's there.
- [ ] Rebuild clean: `npm start -- --reset-cache`, then `npm run ios` / `npm run android`.
- [ ] Have a **test phone you control** that is **NOT already a registered Fixhomi user** (dev DB is a prod copy). To reuse a number, free it on the `dev-phone-signup` Neon branch: `UPDATE users SET phone_number = NULL WHERE phone_number = '<10-digit>';`
- [ ] Know how to read the OTP: dev uses **real MSG91 SMS** → it arrives on the phone.

Device matrix — tick each platform as you complete the full plan:
- [ ] iOS (model: __________)
- [ ] Android (model: __________)

---

## A. Phone signup — happy path

- [ ] User register screen shows the **"Continue with phone number"** card (blue accent), alongside Manual / Google / Apple.
- [ ] Tap it → `PhoneSignupScreen` opens (name + phone fields).
- [ ] Enter a valid name + unregistered phone → tap **Send OTP** → lands on the OTP screen, masked phone shown (`****1234`).
- [ ] Real SMS arrives; enter the code → **Verify** → success → lands on **UserHome** (logged in).
- [ ] Backend sanity (optional, via dev DB): JAuth user has `email=null`, `isPhoneVerified=true`, `hasPassword=false`; Mongo profile `_id === userId`, no `email` field.

## B. Phone signup — validation & errors

- [ ] Empty name → **Send OTP** blocked with `fullNameRequired` message.
- [ ] Very long name (>limit) → `fullNameTooLong` message.
- [ ] Invalid/short phone → blocked by the phone field validation.
- [ ] **Already-registered** number → `Send OTP` returns the "already registered / please log in" message (not a crash).
- [ ] Wrong OTP → clear "invalid OTP" error; input clears and refocuses cell 1.
- [ ] Let the OTP **expire** (timer hits 0) → "code expired" state; Verify disabled; "request new OTP" shown.
- [ ] Trigger MSG91 rate limit (rapid resends) → "too many requests" message, no crash.

## C. OTP box behavior (the polish — test carefully on BOTH platforms)

- [ ] **Autofocus:** on arriving at the OTP screen, the keyboard opens automatically and cell 1 is active.
- [ ] **Active-cell highlight:** the focused cell shows a thicker orange border; **no blinking caret**, no flicker as you type.
- [ ] **Typing:** each digit advances focus to the next cell smoothly; no double characters, no jump.
- [ ] **SMS autofill:**
  - [ ] iOS: the code appears in the **QuickType bar** above the keyboard; tapping it fills all 6 cells.
  - [ ] Android: the code **auto-fills** all 6 cells from the SMS (autoComplete `sms-otp`).
- [ ] **Paste:** copy a 6-digit code, long-press cell 1, paste → distributes across all 6 cells.
- [ ] **Backspace:** delete a filled cell → it clears and focus steps back **in one press** (test especially on Android).
- [ ] **Backspace on empty cell** → focus steps back without deleting anything unexpected.
- [ ] **Double-tap Verify** quickly → only **one** verification fires (no duplicate request / double navigation).
- [ ] **Keyboard dismiss:** on successful verify the keyboard closes cleanly before the next screen.
- [ ] **Timer:** countdown ticks smoothly, digits don't shift width (no flicker). Background the app ~20s, return → timer reflects real elapsed time.
- [ ] **Resend:** disabled during the 30s cooldown, then enabled; resend sends a fresh SMS and resets the timer.
- [ ] **Small-screen / keyboard:** on a small device, the boxes + Verify + Resend are all reachable (scrolls if needed, nothing clipped under the keyboard).

## D. Phone LOGIN regression — MANDATORY (shared OTP screen)

- [ ] **User** phone login (existing `OTPLoginScreen` → OTP) still works end-to-end on a registered user.
- [ ] **Provider** phone login still works end-to-end (the same OTP screen is used).
- [ ] All Section C behaviors also hold on the **login** OTP screen (autofocus, autofill, backspace, no flicker).
- [ ] Logging in from the **wrong** screen (e.g. a provider account via the user flow) still shows the role-mismatch message correctly.

## E. Provider regression — must be UNTOUCHED

- [ ] Provider register screen looks **identical** to before — **no** "Continue with phone" card.
- [ ] Provider manual / Google / Apple register + login all behave as before.

## F. Theme / visual polish

- [ ] Phone card uses blue `#2563EB`; Manual orange, Google rainbow, Apple black — all distinct and aligned.
- [ ] `PhoneSignupScreen` matches the other user-auth screens (orange brand header, card spacing, button style).
- [ ] OTP screen is brand-orange (filled cells, timer, resend) — consistent with login.
- [ ] No layout jumps, overlapping text, or cut-off elements on small and large devices.

## G. Internationalization (en / hi / mr)

For **each** language (switch in app settings):
- [ ] `RegisterChoice` phone card title + subtitle translated.
- [ ] `PhoneSignupScreen` title, subtitle, info, field labels/placeholders, validation messages translated.
- [ ] OTP screen strings translated (enter OTP, timer/expired, resend, info line, error messages).
- [ ] No raw English leaking on Hindi/Marathi (including the back-button screen-reader label).

## H. Null-email user — post-signup app usage

Using the phone-only account created in Section A:
- [ ] **Profile / Settings** screens render with **no email** gracefully (blank or "add email", not `null`, no crash).
- [ ] User can **create a booking** end-to-end (bookings require phone-verified only).
- [ ] Push notifications register (FCM token saved) after login.
- [ ] Log out and **phone-login** back into the same account works.

## I. Accessibility (quick pass)

- [ ] Screen reader reads the phone card and back button with localized labels.
- [ ] Touch targets feel comfortable (cards, back button, OTP cells).

---

## Pre-RELEASE checklist (before the prod store build)

- [ ] `environment.js` → **`USE_DEV_STAGING = false`** (back to real prod URLs). Confirm Metro no longer logs the dev warning.
- [ ] Do **not** commit `environment.js` with `USE_DEV_STAGING = true`.
- [ ] Prod backend rollout done first (see `java_auth-fxmi/jarbac/PHONE_SIGNUP_PLAN.md` §12): run the one-line Postgres `ALTER … DROP NOT NULL`, deploy both backends, smoke-test.
- [ ] Re-run Sections A, C, D against **prod** with a throwaway number before submitting to the stores.
- [ ] Remove/clean any throwaway prod test users created during the prod smoke.

---

## Sign-off

| Section | iOS | Android | Notes |
|---|---|---|---|
| A Signup happy path | ☐ | ☐ | |
| B Validation/errors | ☐ | ☐ | |
| C OTP box behavior | ☐ | ☐ | |
| D Login regression | ☐ | ☐ | |
| E Provider untouched | ☐ | ☐ | |
| F Theme/visual | ☐ | ☐ | |
| G i18n (en/hi/mr) | ☐ | ☐ | |
| H Null-email usage | ☐ | ☐ | |
| I Accessibility | ☐ | ☐ | |
