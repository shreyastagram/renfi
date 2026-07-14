# Phone Signup + Add-Email — Test Guide

This is split into **Part A — Scenario tests** (anyone can do these just by using the
app; no code or database knowledge needed) and **Part B — Technical checks** (need a
developer + access to the server/database).

**Before testing:** install the **latest test build** (it must be the freshly rebuilt
one — older builds are missing several fixes). You'll get real OTP/emails, and the
first tap after the app sits idle may be slow (the test server waking up — not a bug).
Use a phone number / email you control, and **delete the test account when done.**

---

# PART A — Scenario tests (no code needed) ✅ for the owner

Mark each ✅ pass / ❌ fail. If ❌, note what you saw.

## 1. Sign up with a phone number
- [ ] Open the app → choose **User** → on the register screen you see a **"Continue with phone number"** option.
- [ ] Tap it → enter your name + phone number → tap to get the code.
- [ ] You receive an **OTP by SMS** → enter it → you land on the **Home** screen, logged in.

## 2. The OTP screen feels right
- [ ] When the code screen opens, the keyboard comes up automatically.
- [ ] Typing the code is smooth — **no flickering**, the active box is clearly highlighted.
- [ ] On Android, the SMS code can **auto-fill**; on iPhone it appears above the keyboard to tap.
- [ ] Pressing back/delete removes a digit and moves back one box.
- [ ] There's a **resend timer**; "Resend" works after it runs out.
- [ ] Tapping "Verify" twice quickly does **not** cause a double login or error.

## 3. Errors are handled gracefully
- [ ] Empty name or a bad phone number → a clear message, it doesn't proceed.
- [ ] Using a number that's **already registered** → a clear "already registered, please log in" message (no crash).
- [ ] Entering a **wrong OTP** → a clear "invalid code" message, you can retry.

## 4. Log out → log back in (this was a bug — confirm it's fixed)
- [ ] After signing in with phone, **log out**.
- [ ] Choose **User** again → you should see the **login screen** (phone/email), **NOT** the OTP code screen.
  *(Previously it wrongly jumped straight to the OTP screen.)*
- [ ] Log back in with your phone (existing login) → works.

## 5. Add an email after signing up (new feature)
- [ ] As a phone user (no email yet), go to **Profile** → tap **Verify** on the email row (or the "add/change your phone or email" note in Edit).
- [ ] You're taken to a screen where you can **type an email** → save it.
- [ ] You receive a **verification email** — check it looks **professional and on-brand** (orange FixHomi header, clean layout — not a plain/cheap template).
- [ ] Tap the link in the email → it opens a **success page** (not a "service suspended" / broken page).
- [ ] Come back to the app → Profile now shows your email as **verified**.

## 6. Email survives leaving the app
- [ ] Add an email → leave the app to open the email link → return to the app (even if the phone closed the app in the background) → Profile shows the email **verified**. Nothing is lost.

## 7. Change the email ( For future update )
- [ ] From Profile, go to add/change email again → enter a **different** email → save.
- [ ] The old email is replaced, it shows **not verified**, and a **new** verification email arrives.

## 8. The app still works without an email
- [ ] A phone-only user can browse, **see service providers**, and **book a service** normally (email isn't required for that).

## 9. Providers are unaffected
- [ ] Go through the **Provider** sign-up screen → it looks exactly as before, with **no** "Continue with phone number" option.
- [ ] Provider login/registration behaves as it always did.

## 10. Look & feel
- [ ] The phone screens match the app's style (colors, spacing, buttons) — nothing looks out of place.
- [ ] Switch the app language to **Hindi** and **Marathi** → all the new screens/messages are translated (no stray English).

---

# PART B — Technical checks (developer + server/DB access) 🛠️

These confirm the parts the owner can't see from the app. Full commands + queries are in
**`PHONE_SIGNUP_TEST_PLAN.md` Section J**. Summary of what must pass:

## B1. Server returns the RIGHT error codes (a 502 bug was fixed)
Hit `POST https://noefix-dev.onrender.com/api/user/email/:userId` (logged-in token) and confirm:
- Success → **200** · duplicate email → **409** · rapid resend → **429** · bad email → **400** · no token → **401** · someone else's id → **403**.
- **None should return 502** (before the fix, 409/429/400 all wrongly returned 502).

## B2. Data lands in BOTH databases (consistency)
After adding an email for a user:
- **Postgres (Neon dev branch):** `SELECT id, email, is_email_verified FROM users WHERE id = <id>;` → email set, `is_email_verified = false` (→ `true` after the link is clicked).
- **Mongo (dev cluster):** `db.users.findOne({ _id: "<id>" }, { email: 1 })` → same email mirrored. *(Mongo intentionally does NOT store the verified flag for users — that lives only in the auth service.)*

## B3. Environment sanity (one-time, already done — re-verify if issues)
- Dev Postgres `users` id sequence is bumped (new signups get ids in the **1,000,000+** range, so they don't collide with the Mongo copy).
- Dev Mongo `users` email index is **`unique: true, sparse: true`** (`db.users.getIndexes()`).
- `jauth-dev` env `FIXHOMI_BASE_URL = https://jauth-dev.onrender.com` (so verify links work).

---

## Notes for whoever distributes the build
- This is a **dev/test** build pointed at the test servers — accounts created here are **test data**, not production.
- Real SMS + real emails are sent, so use your own number/email and clean up afterward.
- Before any **production** release build, the `USE_DEV_STAGING` flag must be set back to `false`, and the pre-prod security items (tracker §13) addressed.
