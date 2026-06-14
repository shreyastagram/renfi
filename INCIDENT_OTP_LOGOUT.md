# Incident — "Auto-logout + OTP flow rejected" (2026-06-14)

> Task work (Tasks 3–6 in `TASKS_TRACKER.md`) is HALTED for this. Tasks 1 & 2 stay done.

## Symptom (reported)
Many users auto-logged-out (owner not affected); jauth logs appear to "reject the OTP flow."

## Log analysis (jauth, 11:16–15:09 IST 2026-06-14)

The OTP rejections fall into **two expected buckets — not a broken OTP flow:**

1. **`Phone OTP requested for non-existent phone … No account found. Please sign up first.`**
   (e.g. ****8712, ****9741, ****5439, ****1143, ****5657, ****7001, ****3327)
   → `findByPhoneNumber` returns empty = that phone isn't registered. In the logs these are
   immediately followed by the **same person signing up** (Google auto-register / manual
   register) and then verifying that phone. So these are **new users who tried login before
   signup** (or Google-only users whose phone isn't linked) — correct rejection, not a bug.

2. **`Phone OTP verification failed: No pending login. Please request a new OTP.`**
   (e.g. ****9351 at 14:59 & 15:00, right after a SUCCESSFUL login at 14:57:22)
   → The OTP is single-use; `findLatestValidOtpByPhone` returns null once consumed/expired.
   This is a **re-submit of an already-used OTP**, not a flow failure.

**The OTP flow itself is working** — there are multiple SUCCESSFUL logins in the same window:
- 14:57:22 phone ****9351 → logged in `hr2789418@gmail.com`
- 15:08:33 phone ****2497 → logged in `borkarshreyas123@gmail.com`
OTPs are sent (MSG91 "OTP SMS sent successfully") and verified. Send + verify both normalize
via `User.normalizePhoneNumber` and the entity `@PrePersist` also normalizes, so the
store-key (`sendPhoneLoginOtp`) and lookup-key (`verifyPhoneLoginOtp`) are consistent.

## Conclusion (current)
- **No new bug in the OTP backend flow.** Rejections are expected (login-before-signup,
  Google-only-without-phone, re-used OTP).
- **The real problem = the auto-logouts**, which is the **same issue already diagnosed in
  `AUTH_STARTUP_LOGOUT_FIX.md`**:
  - **Cohort A** (transient-refresh on cold start) — fix is **written/committed but NOT yet
    released to users** (it's a *client* change; users are still on the old build 1.0.4/22).
    So users keep getting logged out until a new app build ships.
  - **Cohort B** (`ACCOUNT_DELETED` stale/abandoned-account tokens) — separate, smaller.
- Logged-out **Google-registered** users who then try **phone** OTP login get "no account
  found" because their phone may not be linked — they should use Google login. This *looks*
  like an OTP rejection but is an onboarding/path mismatch.

## One thing to VERIFY (only real risk to rule out)
At 14:57:22, phone **+919***9351** OTP login resolved to **hr2789418@gmail.com**. This is
correct **iff 9351 is hr2789418's registered phone**. Confirm in Neon:
```sql
SELECT id, email, phone_number FROM users WHERE phone_number LIKE '%9351';
```
- If it returns `hr2789418@gmail.com` → no bug (phone belongs to that user).
- If it returns a DIFFERENT email → **critical cross-account login bug** (escalate).

## Recommended action
1. **Ship the app build** containing the Cohort-A startup-refresh fix — that's what actually
   stops the recurring auto-logouts. (Already coded; just not in users' hands.)
2. Run the verification SQL above to rule out the 9351→hr2789418 cross-account case.
3. (Optional, separate) Cohort-B hardening already noted in `AUTH_STARTUP_LOGOUT_FIX.md`.

## Status
- [x] Logs analyzed · [x] OTP send/verify code reviewed · [x] Incident documented
- [x] **9351 check — CLEAN (no cross-account bug).** Query returned two numbers sharing the
  last 4 digits: `9307769351` = hr2789418 (starts 9 → matches the `+919***9351` log) and
  `7263069351` = tekamkunal (starts 7 → unrelated). The OTP login resolved to the correct
  owner. The `%9351` LIKE just matched both by suffix.
- [ ] Awaiting: release of the Cohort-A startup-refresh fix (the actual cure).

## FINAL VERDICT
**No new bug.** OTP flow is healthy; cross-account login ruled out. The auto-logouts are the
already-diagnosed **Cohort A (transient-refresh on cold start)** whose fix is **coded but not
yet shipped to users**. **Action = release the app build with that fix.** No further backend
change required for this incident. Resume Tasks 3–6 after the release decision.
