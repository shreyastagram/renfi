# Fixhomi — Release Test Guide (v1.0.5)

**For:** Testers & Client
**Build:** 1.0.5 (Android versionCode 29 / iOS build 1)
**Date:** July 2026

---

## How to use this document

- Work through the sections in order. Each test has an **ID** (e.g. `A-3`) — mention this ID when reporting a problem.
- Fill the **Result** column with one of:
  - ✅ **Done** — worked exactly as described
  - ❌ **Failed** — did not work / app crashed / wrong behaviour
  - ⚠️ **Issue** — worked, but something looked off (write what in Remarks)
  - ⏭ **Skipped** — could not test (write why in Remarks)
- Use the **Remarks** column for anything: what you saw, what device, a screenshot reference, "wrong translation", "button too small" — anything at all.
- **Take a screenshot whenever you mark ❌ or ⚠️.** A screenshot with the test ID is worth more than a long description.

### Devices to test on (minimum)

| Device | Why it matters |
|---|---|
| One **older / cheaper Android phone** (small screen if possible) | Most providers use these. Several fixes in this release specifically target small screens. |
| One **newer Android phone** (Android 12+) | The tab bar has a "glass" blur effect that only appears on newer Androids. |
| One **iPhone** | iOS behaves differently for payments, date pickers, and the delete-account popup. |

### Languages to test

The app supports **English, Hindi, and Marathi**. A big part of this release is translation coverage, so:

> **Golden rule:** After finishing the English pass, switch the app to **Hindi** (Settings → Language) and repeat at least sections C, E, F, G, H, and J. Then spot-check a few screens in **Marathi**.
>
> **What a translation bug looks like:** either (a) text stays in English on a Hindi screen, or (b) you see strange bracketed text like `[missing "hi.something" translation]` — that second one is a serious bug, report it immediately with a screenshot.

### Things you may notice that are NOT bugs (do not report these)

1. **Your data is on a test server.** Bookings, accounts, and payments in this build do not touch the real production database. Feel free to create junk accounts.
2. **Technical log messages** may appear if a developer connects your phone to a computer. Ignore.
3. The **glass/blur effect on the bottom bar** is intentionally absent on older Androids (they get a clean solid bar instead). That is by design, not a bug.

---

## A. Install & First Launch

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| A-1 | Fresh install | Uninstall any old build, install this one, open it | App opens to the welcome screen with the hero illustration and "User / Provider" choice. No crash, no blank white screen. | | |
| A-2 | Hero image | Look at the illustration on the welcome screen | Image is fully visible, not stretched, not cut off at the sides. Check on the **small Android** especially. | | |
| A-3 | Language from the start | On first launch, change language before logging in (if the option is shown) | All welcome/auth screens follow the chosen language | | |
| A-4 | Kill & reopen | Force-close the app, reopen | Returns to where you were (login state remembered) — you are not logged out | | |

---

## B. Sign Up & Login

**Background for testers:** Users (customers) sign in with just a phone number and OTP ("one-tap"). Providers have a fuller registration. There is also a password-reset flow that can send the OTP to **email** — that email path had a text bug that was just fixed, so test it carefully.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| B-1 | User phone signup | Choose User → enter a phone number → enter the OTP | Logged in, welcome popup appears once. No error, no double popup. | | |
| B-2 | User re-login | Log out, log in again with the same number | Straight in after OTP. No "welcome" popup this second time. | | |
| B-3 | OTP resume after kill | Start signup, get to the OTP screen, force-close the app, reopen | You should be able to continue or restart cleanly — the app must NOT be stuck on a broken OTP screen | | |
| B-4 | Provider registration | Register a fresh provider account | Full flow completes; you land on the provider home screen | | |
| B-5 | Forgot password — **email** OTP | On provider login → Forgot Password → choose the **email** option | The screen must say "Enter the 6-digit OTP sent to \<your masked email\>" in the app's language. **If you see bracketed text like `[missing "..." translation]` — report immediately.** | | |
| B-6 | Forgot password — phone OTP | Same flow, choose phone | Same masked-number message; reset completes | | |
| B-7 | Hindi login pass | Switch to Hindi, log out, log in again | Every label, button, and error message on the auth screens is in Hindi | | |

---

## C. Bottom Tab Bar (the floating "glass" bar)

**Background:** The bottom navigation is a floating rounded pill. On newer phones it has a frosted-glass look. It **adapts its text/icon colour** when a dark section of a page scrolls underneath it, and the highlight "lens" **glides** between tabs.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| C-1 | Basic look | Log in as User, look at the bottom bar | Floating pill, evenly spaced icons+labels, nothing cut off, no white corner artifacts | | |
| C-2 | Gliding highlight | Tap each tab slowly, then quickly | The highlight slides smoothly to the tab you tapped (slight stretch while moving is intentional). No flicker, no jumping. | | |
| C-3 | Labels translated | Switch to Hindi, look at the bar | Tab names (Home / History / Settings / Profile — and Jobs for providers) appear **in Hindi**, and change immediately when you switch language | | |
| C-4 | Adaptive colour | As Provider, scroll the home screen so the orange "PRO TIP" card passes under the bar | Bar text/icons smoothly turn light while the dark/colored card is underneath, then back. No sudden hard flip, no invisible text. | | |
| C-5 | Keyboard | Open any screen with a text field, tap into it | The bar disappears while the keyboard is up and returns after — it must never sit on top of the keyboard | | |
| C-6 | Booking flow hide | As User, start booking a service until you reach the screen with the big "Create Request" button at the bottom | The floating bar is hidden there so it does not cover the button | | |
| C-7 | Navigation styles (Android) | Test with gesture navigation AND with 3-button navigation (change in phone settings) | Bar sits correctly above the system area in both modes, not overlapping, not floating too high | | |
| C-8 | Old Android | Repeat C-1..C-5 on the older Android | Bar is solid (no blur) but everything else works the same | | |

---

## D. Home Screens (User & Provider)

**Background:** Service icons are new 3-D style tiles. Both home screens end with a full-width brand artwork footer (like Ola's). Icon size was just fixed for small screens.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| D-1 | 3-D service icons | User home: look at all service cards | Colourful 3-D tiles, sharp, **not clipped at the edges** — check the small Android carefully, the rounded tile must be fully inside its card | | |
| D-2 | Coming-soon services | Tap a service marked "Coming Soon" | Friendly popup, no booking starts | | |
| D-3 | Brand footer (User) | Scroll the user home to the very bottom | Full-width artwork, edge to edge, correct proportions (not zoomed/stretched), gently fades into the page at its top edge, the "#FIX WITH FIXHOMI" text readable | | |
| D-4 | Brand footer (Provider) | Same on provider home | Same expectations | | |
| D-5 | Footer on iPhone | Repeat D-3 on iOS | Same look; no gap between footer and screen bottom | | |
| D-6 | Emergency & Events icons | Open Emergency services and Events screens | 3-D icons appear there too, consistent sizing | | |

---

## E. Provider Home

**Background:** Several texts on this screen were just translated (they used to be English-only) and a wrong number in the bonus popup was fixed.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| E-1 | Online/Offline toggle | Toggle availability on and off | Status changes, subtitle text updates, no flashing back and forth | | |
| E-2 | ACTIVE JOBS section | With at least one accepted job, view the "ACTIVE JOBS (Recent 3)" section | Job cards show customer name, service, date; **Directions / Call / Details** buttons work (Directions opens maps, Call opens dialer) | | |
| E-3 | ACTIVE JOBS in Hindi | Switch to Hindi, view the same section | Section title, the "(Recent 3)" tag, empty-state message, and the three buttons are all in Hindi | | |
| E-4 | Empty state | With no active jobs | "No active services right now" (translated) with an inbox icon | | |
| E-5 | Stats row | Check Active / Completed / Rating numbers | Numbers match reality; the "Active" label is translated in Hindi/Marathi | | |
| E-6 | First-approval bonus popup | (Needs a provider whose first service just got approved) A congratulations popup appears | After closing it, Profile should show the premium gift — days left should be about **180 days (6 months)**, NOT 60 | | |

---

## F. Premium / Subscription (IMPORTANT — three different states)

**Background — read this first:** Premium costs ₹299/month, BUT every provider gets their **first 6 months free, automatically, when their first service is approved**. The subscription screen therefore shows one of three different designs depending on the provider:

- **State A — "The gift ahead":** provider has NO approved service yet. Dark navy card with gold accents saying the first 6 months are free, price shown as ~~₹299~~ **₹0**, a 3-step journey ("Get verified → 6 months free → then your choice"), and the main button says **"Get Verified — Unlock 6 Months Free"** and takes you to document verification (NOT to payment — paying would do nothing for them yet).
- **State B — "Gift running":** provider's free 6 months are active right now. Same rich card but showing **free days remaining**; in the journey, **both step 1 AND step 2 show ticked**. No payment is requested.
- **State C — "Gift finished":** the free months are over. Steel-blue tinted card saying the free months are complete, and a normal **"Continue Premium — ₹299/month"** payment button.

You will need different test accounts to see each state. Ask the developer to prepare one account per state if needed.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| F-1 | State A look | New provider (nothing approved) → Settings/Profile → Premium | Navy/gold card, strikethrough ₹299 → ₹0, "then ₹299/month" clearly written, "No payment details needed today", 3-step journey with only step 1 ticked | | |
| F-2 | State A button | Tap the main button | Says "Get Verified — Unlock 6 Months Free" and opens **document verification**, not a payment screen | | |
| F-3 | State A plan card | Look at the plan list below | The monthly plan shows a navy/gold **LAUNCH OFFER** ribbon, ₹299 struck through, ₹0, "per month" reads naturally (not "/per month") | | |
| F-4 | State B look | Provider with the free bonus active → Premium | Card shows **how many free days remain**; journey steps 1 **and** 2 both ticked; no payment button pushed on them | | |
| F-5 | State C look | Provider whose bonus ended → Premium | Blue-tinted card: free months complete; button "Continue Premium — ₹299/month"; NO "6 months free" promises anywhere on this screen | | |
| F-6 | Paid & active | Provider who paid ₹299 and is active | Green/normal "active" status card with days left and renew option | | |
| F-7 | **No contradictions across screens** | For the SAME account, compare what Profile, Settings row, and the Premium screen say | They must agree. Example of a bug: Profile promises "6 MONTHS FREE" but the Premium screen says the free months are finished. | | |
| F-8 | Profile premium card variants | Check the Profile premium card for a state-A provider and a state-C provider | State A: gold "6 MONTHS FREE" chip + free-months text. State C: **no** free chip; text about priority listing at ₹299/month instead | | |
| F-9 | Offline / bad network | Open the Premium screen in **airplane mode** (or very poor signal) | You should see a "failed to load" screen with a **Retry** button — NOT a screen inviting you to pay. Turn network back on, tap Retry → normal screen loads. | | |
| F-10 | Wording check (for client) | Read all premium screens carefully | Nowhere should any payment company be named; "no automatic renewal" wording present; every ₹0 mention is accompanied by "then ₹299/month" | | |
| F-11 | Premium in Hindi & Marathi | Repeat F-1..F-5 in Hindi, spot-check Marathi | All premium texts translated, prices formatted correctly, nothing overflowing off the card | | |
| F-12 | iOS payment note | On iPhone, state C, select a plan | A note explains payment completes on the website (iOS pays via web). This note must NOT appear in state A under the "Get Verified" button. | | |
| F-13 | **Bonus cannot be overwritten by paying** | Provider with the free bonus ACTIVE (state B): try every way to reach a payment (deep links, going back and forth, old screens) and if you ever see a pay button, tap it | The server must refuse with a message like "Your premium is active for another N days" — the provider's free months must NEVER be replaced by a 28-day paid plan. If any path lets the payment start, report immediately with steps. | | |
| F-14 | Bonus popup shows only once | Get the "Welcome Premium" congratulations popup, close it, then force-close and reopen the app several times | The congratulations popup does NOT appear again on later launches | | |

---

## G. Verification Dashboard (provider)

**Background:** A bug was just fixed here — accepting the Terms used to show a success message immediately followed by a false error.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| G-1 | Accept Terms & Privacy | On the verification dashboard, tap the Terms/Privacy step → Accept | ONE success message only. The step turns to done/accepted right away. **If you see a success message AND an error message together, or the step stays "Pending" — report it (this was the old bug).** | | |
| G-2 | Steps status | Review all verification steps | Statuses match reality (done / pending); progress count correct | | |
| G-3 | Premium step wording | Read the premium step description | Matches the 6-months-free offer, in the app's language | | |
| G-4 | After phone re-verify | Re-verify your phone, come back | Dashboard reflects it without a long delay | | |

---

## H. Settings

**Background:** The account-deletion flow (required by Google Play) was English-only — it is now fully translated, on both the iOS-style and Android-style popups. Update-check dialogs and Refer & Earn were also translated.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| H-1 | Premium row subtitle | Check the Premium row for: a new provider / an expired-bonus provider / an active premium provider | Three different subtitles: free-offer text / renew text (₹299) / "Active…" text. Never "active" for someone whose premium has expired. | | |
| H-2 | Refer & Earn | Find the Refer & Earn section | Title, row, and subtitle translated in Hindi/Marathi; opens the referral screen | | |
| H-3 | Language modal | Open Settings → Language | The popup title itself is translated; choosing a language changes the whole app instantly, including the bottom tab bar | | |
| H-4 | Check for updates | Tap "check for updates" (if visible) | "Up to Date" or "Update Available" dialog — translated, with the version number filled in (no `%{version}` placeholder text visible!) | | |
| H-5 | **Account deletion — full flow in HINDI** | Switch to Hindi → Settings → Delete Account → request OTP → enter wrong OTP → then correct OTP | Every popup and message in Hindi: the OTP prompt, "Incorrect OTP", the reason box, Resend, the final confirmation. This is a Google-compliance flow — it must be fully understandable in Hindi. | | |
| H-6 | Account deletion — cancel | Start deletion, then Cancel | Popup closes, nothing deleted, you can continue using the app | | |
| H-7 | Deletion rate-limit | Request the deletion OTP several times quickly | A polite "Please Wait / too many attempts" message (translated), not a crash | | |
| H-8 | Sign out | Log out | Brief "Signing out…" overlay (translated), then the welcome screen | | |
| H-9 | App version | Check the version shown in Settings | Says 1.0.5 | | |

---

## I. Profile (User & Provider)

**Background:** The profile was redesigned earlier in this release (flat sections, edit-in-place). The premium cards and a few remaining labels were just translated.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| I-1 | Sections layout | Open Profile (both roles) | Flat modern sections (About, Services, Experience, Portfolio for provider; Contact for user), gradient header, no giant white gaps | | |
| I-2 | Inline editing | Edit one field in each section and save | Only that section enters edit mode; save works; value persists after app restart | | |
| I-3 | Experience date | Provider: check "Working since" | Correct date from your registration/selection | | |
| I-4 | Premium ACTIVE card translated | Premium-active provider, app in Hindi | The whole green/premium status card — "ACTIVE" badge, title, "Days Left / Priority / Boosted", "Manage Subscription" — is in Hindi | | |
| I-5 | Saved Providers row | User profile → Saved Providers | Title/subtitle translated; opens favorites | | |
| I-6 | Photo permission denied | Deny photo access, then try changing the profile photo | Translated error message about permissions (not an English "Error" popup on a Hindi phone) | | |
| I-7 | Member since footer | Scroll to the profile bottom | Brand logo above "Member since …" | | |

---

## J. History / Bookings (User & Provider)

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| J-1 | User history stats | Open History tab as User | Total / Active / Done counters — labels translated in Hindi/Marathi | | |
| J-2 | Provider jobs stats | Open Jobs tab as Provider | Total / Active counters translated | | |
| J-3 | EVENT badge | Find an event-type booking in either list | The "EVENT" tag on the card is translated (Hindi: इवेंट, Marathi: इव्हेंट) | | |
| J-4 | Load more | Scroll a long history list to the bottom | "Loading more…" text (translated) then more items | | |
| J-5 | Cancelled request (provider) | As provider, open/accept a request the customer has just cancelled | A proper "Request Cancelled" dialog in the app's language. **Bracketed `[missing …]` text here = report immediately (this was a real bug that was fixed).** | | |

---

## K. Booking Flow (User)

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| K-1 | Full booking | Pick a service → follow the flow → Create Request | Request created; appears in History; provider side receives it | | |
| K-2 | Unverified user gate | With a user whose phone is NOT verified, try to book | Popup asking to verify first, with "Verify Now" leading to Profile | | |
| K-3 | GPS off | Turn location off, try to book | Popup offering to open location settings | | |
| K-4 | Bottom bar during booking | During the flow | Tab bar hidden on the screen with the bottom "Create Request" button (same as C-6) | | |
| K-5 | Live tracking | After a provider accepts, open tracking | Map shows provider location updating | | |

---

## L. Network & Stability (edge cases)

**Background for testers:** our servers "sleep" when unused and take ~30 seconds to wake up ("cold start"). The app is designed to handle this gracefully — these tests check exactly that.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| L-1 | Cold start patience | First open of the day, log in | May take longer, but must NOT log you out or show wrong data. A loading shimmer is fine. | | |
| L-2 | Airplane-mode Premium | (Same as F-9) | Retry screen, never a false "not subscribed" state | | |
| L-3 | Airplane-mode browsing | Turn on airplane mode, move around the app | Friendly errors/empty states; **no crashes**; recovered automatically when network returns | | |
| L-4 | Token expiry | Leave the app unused for a day+, reopen | Still logged in (token refreshes silently) — you should NOT have to log in daily | | |
| L-5 | Notifications | Send a booking to a provider whose app is closed | Push notification arrives; tapping it opens the right screen | | |

---

## N. Booking Verification Gate (SECURITY — read carefully)

**Background:** Booking is supposed to require a **verified phone number**. Today this
is checked **only inside the app**, and the check is deliberately skipped for a moment
right after login while your profile is still downloading. A server-side check is being
prepared separately; until it is deployed, test N-3/N-4 may "succeed" in slipping a
booking through — **record exactly what happens either way**, because these two tests
tell us whether the server fix is live.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| N-1 | Unverified user, normal speed | Sign up with **Google** (no phone added), wait ~10 seconds on the home screen, then tap a service | "Verification required" popup with a Verify Now button. Booking must NOT start. | | |
| N-2 | Verify then book | Verify your phone from Profile, then book | Booking proceeds normally | | |
| N-3 | **The race** — unverified + instant tap | Fresh Google signup (no phone). The MOMENT the home screen appears, tap a service as fast as you can. Repeat 5 times (log out/in between). | **Expected once the server fix is live:** even if the app popup doesn't appear, the booking is rejected with a "complete your profile" message. **If the booking goes through and appears in History → report with the account email + time.** | | |
| N-4 | Unverified + broken profile load | Google signup with no phone. Turn airplane mode ON for ~30s right after login (so the profile fails to load), turn it back on, then tap a service **without** restarting the app | Same expectation as N-3: the booking must not silently succeed for an unverified account | | |
| N-5 | Server message readability | If you get blocked by the server in N-3/N-4 | The error shown in the app should be understandable ("complete your profile / verify phone"), not a raw technical error | | |

---

## O. Phone number — add / change / verify (NEW flow, both roles)

**Background:** Phone editing moved out of the top "name" block into the **Contact & Location**
section, for both users and providers, and now works like the email flow: you enter a number,
get an OTP, and the number is saved **only after** the OTP is verified. The key rule: **your old
number keeps working until the new one is verified** — a half-finished change never leaves you
unverified. There is no longer any "Not set" error dialog, and admins can no longer change anyone's
phone.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| O-1 | Where the phone lives | Open Profile → Contact & Location (both roles) | Phone appears here as a row. It is NO longer in the top name/edit block. | | |
| O-2 | Add (no number yet) | Account with no phone (e.g. Google signup) → tap the phone row's **Add** | A sheet opens: enter number → Send OTP → enter code → Verify & Save. On success the number shows with a ✓ and you can book. No "error" dialog for the empty state. | | |
| O-3 | Change a verified number | Verified user → phone row → **Change** → enter a DIFFERENT number → OTP → verify | New number saved and shown verified. Every screen (profile header, verification pill, settings) updates immediately without an app restart. | | |
| O-4 | **Old number stays until verified** | Start a change to a new number, get the OTP screen, then CLOSE the sheet without entering the OTP. Now try to book / check your profile. | Your ORIGINAL number is still there and still verified — booking still works. The unverified new number was NOT saved anywhere. | | |
| O-5 | **Changed number cannot book until verified** | Change to a new number but abandon before verifying (as O-4). Confirm the account still reflects the OLD verified number, not a new unverified one. | The account is never left in a "new unverified number" state. You should never be able to book on an unverified number. | | |
| O-6 | Wrong OTP | In the change flow, enter a wrong code | Clear "invalid OTP" message, input shakes, you can retry; nothing changes on the account. | | |
| O-7 | Resend + change number | On the OTP screen, wait for the timer, tap **Resend code**; also try **Change number** to go back | Resend works after the countdown; "Change number" returns to the entry step. | | |
| O-8 | Number already in use | Try to change to a number that is already verified on another account | Friendly error that the number is in use; your account is unchanged. | | |
| O-9 | Provider parity | Repeat O-2..O-6 as a PROVIDER | Identical behaviour. Also confirm: after changing a provider's phone, opening the verification dashboard does NOT silently re-mark the new number verified (it must stay unverified until OTP). | | |
| O-10 | Language | Do the whole flow in Hindi and Marathi | Every label, subtitle, button and message translated; number/timer values render correctly. | | |
| O-11 | Booking gate end-to-end | Change to a new number, DON'T verify, then attempt a booking | Blocked (verification required). Then verify the number and book again → allowed. | | |

## M. Final language sweep (client sign-off)

Do this last, once everything above passes.

| ID | Test | Steps | What you should see | Result | Remarks |
|---|---|---|---|---|---|
| M-1 | Hindi full pass | Set Hindi. Walk every main screen: login, both homes, booking, history, profile, settings, premium, verification | No English sentences left on main screens (single technical words like "OTP" are acceptable); no `[missing …]` text; no text overflowing buttons/cards | | |
| M-2 | Marathi spot check | Set Marathi. Check: premium screen, settings, delete-account popup, tab bar, provider home | Same standards as M-1 | | |
| M-3 | Numbers & prices | In Hindi/Marathi, check every place showing ₹299, ₹0, dates, or day counts | Real values shown — never raw placeholders like `%{price}` or `%{date}` | | |
| M-4 | Language switching live | Switch language while on the Premium screen, then on Home | Screen texts update without needing an app restart | | |

---

## Reporting summary

When you finish, please send back:

1. This file with the **Result** and **Remarks** columns filled.
2. Screenshots for every ❌ / ⚠️, named with the test ID (e.g. `F-7_profile_vs_premium.png`).
3. Your device list: phone model, Android/iOS version, and which language pass you did on it.

**Thank you!** 🙏
