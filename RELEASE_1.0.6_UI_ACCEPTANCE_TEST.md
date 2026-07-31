# 1.0.6 — UI Acceptance Test (single sitting, ~45 min)

**If every box below passes → GO for release.** Any ❌ in steps 1–22 → STOP and report the step number.

**Setup:** Redmi 12 (or similar budget Android) with the release build as PROVIDER.
A second phone as USER. iPhone for the last section. Fresh install on all.

## Part 1 — Login & staying logged in (Provider phone)

- [ ] 1. Install → sign up / log in with phone OTP → you land on the provider home.
- [ ] 2. Swipe-kill the app from recents → reopen. You are STILL logged in (no login screen, not even for a second).
- [ ] 3. Open the Jobs tab → swipe-kill → reopen. Logged in AND the app returns you to (or near) where you were.
- [ ] 4. Turn on airplane mode → open the app. It opens with your data and does NOT log you out. Turn radio back on → app recovers by itself.
- [ ] 5. Logout → login screen appears cleanly. Log back in — works. (Leave the app logged in overnight; open it tomorrow morning: still logged in — record this next day.)

## Part 2 — Location truth (Provider phone, this is the big one)

- [ ] 6. In phone Settings, remove the app's location permission. Open the app → when the dialog appears choose **"Approximate"** (NOT precise). The home map shows "Getting your location…" then your position. It must NEVER say "Enable location".
- [ ] 7. Now turn the phone's location switch fully OFF → app correctly shows "Location is off" with an Enable button → tap it → you land in Settings.
- [ ] 8. Turn location ON in Settings → return to the app (do NOT restart it) → the map recovers on its own within ~30 seconds.
- [ ] 9. Background and reopen the app 5 times in a row → no false "Location is Turned Off" popups appear.

## Part 3 — Provider home stability (Redmi 12 focus)

- [ ] 10. Stay on the provider home for 3 minutes, background/foreground twice. The Online/Offline pad stays steady — it must NOT cycle online → spinner → online → spinner.
- [ ] 11. Toggle Offline → Online → Offline: instant each time. Kill and reopen: the state you left is the state you see.
- [ ] 12. Watch the phone's status bar and navigation bar during 2 minutes of use: no blinking/flickering of the system bars.
- [ ] 13. Loading placeholders on this phone look like STATIC grey blocks (no moving light sweep) — that is correct on this device. Pull-to-refresh in airplane mode: the spinner ENDS within ~30s.

## Part 4 — Jobs & Profile (Provider phone)

- [ ] 14. Open the Jobs tab and just watch for 2 minutes: it loads ONCE (skeleton → list) and then stays put. The "My Jobs" header and list must never blank out and reload in a loop.
- [ ] 15. Switch tabs away and back: the list refreshes without the whole screen going blank.
- [ ] 16. Open Profile: your name/email appear promptly. If the network is slow, the screen still fills in BY ITSELF within ~30s — never an endless grey shimmer screen.
- [ ] 17. Edit your profile name/photo → save → kill app → reopen → change persisted.

## Part 5 — End-to-end with the User phone (both devices)

- [ ] 18. User phone: sign up, grant location, book a service near the provider.
- [ ] 19. Provider phone: within seconds ONE banner + ONE vibration; the request appears. "View Details" opens the right request.
- [ ] 20. Provider accepts → user phone shows Accepted promptly. Complete the job with the customer's OTP → both sides show completed.
- [ ] 21. Kill the provider app fully → user books again → provider taps the push notification → the app opens directly on that request, still logged in.
- [ ] 22. User History: cancel a request → status updates; "Find new provider" on another request resumes the provider search on home.

## Part 6 — iPhone smoke (~5 min)

- [ ] 23. Login → home → make one booking → jobs/history → profile → logout: all work.
- [ ] 24. The tab bar / notification banner / dialogs show the frosted-glass blur (iOS keeps blur — only Android is flat).
- [ ] 25. Location permission "While Using" → map works; background/foreground → still logged in.

**GO / NO-GO:** all of 1–22 pass on Android + 23–25 pass on iPhone → RELEASE.
Step 5's overnight check and a provider left open overnight receiving a morning
booking (socket re-auth) can complete in parallel with rollout day 1.
