# App Store & Play Store Submission Checklist — Fixhomi

---

## Progress Tracking

This document tracks all Apple App Store and Google Play Store submission tasks for the Fixhomi application.

**When working in a new Claude session, read this file first to understand which tasks are completed and which tasks remain.**

Work is scoped to these three directories only:
- `renfi/renfi/` — React Native mobile app
- `noefi/fixhomi-backend/` — Node.js backend (Express + MongoDB)
- `java_auth-fxmi/jarbac/` — Java Auth backend (Spring Boot + PostgreSQL)

**Last updated:** 2026-03-14
**Overall status:** NOT READY FOR SUBMISSION

---

## 1. Project Overview

**App name:** Fixhomi (internal codename: renfi)
**Type:** Home services marketplace (two roles: User/Customer and Provider/Service Professional)
**Tech stack:** React Native 0.81, Node.js/Express, Spring Boot 3.4.12
**Payments:** Razorpay (provider premium subscriptions)
**Auth:** Dual backend — Java Auth (JWT, OTP, verification) + Node.js (profiles, services)
**Maps:** Mapbox
**Push:** Firebase Cloud Messaging
**Identity verification:** Surepass/DigiLocker (Aadhaar)
**Image storage:** Cloudinary

---

## 2. Store Submission Readiness Status

| Area | iOS | Android | Notes |
|------|-----|---------|-------|
| Core functionality | Ready | Ready | All user/provider flows work |
| Authentication | Partial | Ready | iOS missing Sign in with Apple |
| Account deletion | Ready (in-app) | Partial | Android needs web-based deletion page |
| Privacy manifest | Ready | N/A | PrivacyInfo.xcprivacy exists |
| Permissions | Needs work | Needs work | Background location strings need fixing |
| Payments | Needs work | Needs wording | iOS: move to web-based; Android: reframe wording |
| Security | Needs work | Needs work | Cert pinning, ProGuard, console logs |
| Store metadata | Not started | Not started | Screenshots, descriptions, etc. |

---

## 3. Critical Blockers (Will cause guaranteed rejection)

### 3.1 Sign in with Apple — IMPLEMENTED (needs package install + testing)
- [ ] Install npm package and run pod install (see setup steps below)
- [ ] Add Sign in with Apple capability in Xcode (see setup steps below)
- [x] Create Apple Sign-In button on `src/screens/LoginScreen.jsx`
- [x] Create Apple Sign-In button on `src/screens/RegisterScreen.jsx`
- [x] Create Apple Sign-In button on `src/screens/ProviderRegisterScreen.jsx`
- [x] Add Apple OAuth endpoint in Java Auth backend (`POST /api/auth/oauth2/apple/mobile`)
- [x] Add `AppleAuthService.java` — verifies Apple identity tokens via Apple JWKS (RS256)
- [x] Add `AppleMobileAuthRequest.java` DTO
- [x] Add `/api/auth/oauth2/apple/mobile` to SecurityConfig public endpoints
- [x] Add `fixhomi.oauth.apple.bundle-id` config in `application.yaml`
- [x] Node.js backend: Reuses existing Google sync endpoints (DRY — no new code needed)
- [x] Add `appleAuthService.js` for React Native (`src/services/appleAuthService.js`)
- [x] Add `ENDPOINTS.OAUTH.APPLE_MOBILE` to `src/config/api.js`
- [ ] Set `APPLE_BUNDLE_ID` environment variable on Render (see setup steps below)
- [ ] Test full flow: sign up, sign in, profile sync
- [ ] Apple Developer portal: Services ID, Keys, Return URLs (user confirms this is done)

**Why:** Apple guideline 4.8 requires Sign in with Apple whenever any third-party social login (Google) is offered. This is one of the top rejection reasons.

**Files created:**
- `renfi/renfi/src/services/appleAuthService.js` (NEW)
- `java_auth-fxmi/jarbac/.../service/AppleAuthService.java` (NEW)
- `java_auth-fxmi/jarbac/.../dto/AppleMobileAuthRequest.java` (NEW)

**Files modified:**
- `renfi/renfi/src/screens/LoginScreen.jsx` — Apple button + handler + styles
- `renfi/renfi/src/screens/RegisterScreen.jsx` — Apple button + handler + styles
- `renfi/renfi/src/screens/ProviderRegisterScreen.jsx` — Apple button + handler + styles
- `renfi/renfi/src/config/api.js` — Added `OAUTH.APPLE_MOBILE` endpoint
- `java_auth-fxmi/jarbac/.../controller/OAuth2Controller.java` — Added Apple endpoint
- `java_auth-fxmi/jarbac/.../config/SecurityConfig.java` — Added Apple to public routes
- `java_auth-fxmi/jarbac/src/main/resources/application.yaml` — Added Apple config

#### Setup Steps — Where to Put Your Keys

**Step 1: Install the npm package (React Native)**
```bash
cd renfi/renfi
npm install @invertase/react-native-apple-authentication
cd ios && pod install && cd ..
```

**Step 2: Xcode — Add Sign in with Apple capability**
1. Open `ios/renfi.xcworkspace` in Xcode
2. Select the `renfi` target in the left sidebar
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability** button (top left)
5. Search for and add **Sign in with Apple**
6. Make sure the correct Team and Bundle Identifier are selected

**Step 3: Java Auth Backend — Set environment variable on Render**
Go to your **Render dashboard** → `jauth` service → **Environment** → add:
```
APPLE_BUNDLE_ID=com.renfi
```
This is your iOS app's bundle identifier. The backend validates the `aud` claim in Apple's JWT against this value. If it doesn't match, the token is rejected.

**Optional** (only if you later add web-based Apple Sign-In):
```
APPLE_SERVICE_ID=com.fixhomi.web
```

**Step 4: That's it — no API key needed**
Unlike Google OAuth, Apple Sign-In for mobile does **not** require a client secret or API key on the backend:
- Apple identity tokens are **RS256 JWTs** signed by Apple's private key
- The backend verifies them using Apple's **public keys** fetched automatically from `https://appleid.apple.com/auth/keys`
- We validate: **signature** (RSA), **issuer** (`https://appleid.apple.com`), **audience** (`com.renfi`), **expiry**
- Public keys are cached for 24 hours and auto-refreshed on rotation

#### How It Works (Same as Google, Different Verification)

| Step | Google | Apple |
|------|--------|-------|
| 1. User taps button | Google Sign-In SDK | `@invertase/react-native-apple-authentication` |
| 2. Get token | Google ID token (HS256) | Apple identity token (RS256 JWT) |
| 3. Send to backend | `POST /api/auth/oauth2/google/mobile` | `POST /api/auth/oauth2/apple/mobile` |
| 4. Backend verifies | Google's `GoogleIdTokenVerifier` | Apple's JWKS public keys |
| 5. Find/create user | `userRepository.findByEmail()` | `userRepository.findByEmail()` |
| 6. Role conflict check | Same error codes | Same error codes |
| 7. Return tokens | `LoginResponse` (JWT + refresh) | `LoginResponse` (JWT + refresh) |
| 8. Frontend stores tokens | `handleAuthSuccess()` | `handleAuthSuccess()` |
| 9. Sync to MongoDB | `/api/auth/google/sync-user` | `/api/auth/google/sync-user` (reused) |

#### Apple-Specific Gotchas

1. **Name + email only on first sign-in:** Apple provides the user's name and email ONLY the first time they sign in. If the app crashes or the data is lost before saving, the user must go to Settings → Apple ID → Password & Security → Sign in with Apple → Fixhomi → Stop Using → then re-sign-in to get name/email again.
2. **"Hide My Email" relay addresses:** Users can choose to hide their real email. Apple generates a relay address like `abc123@privaterelay.appleid.com`. This relay email is stable and forwards to their real email. Treat it as their permanent email.
3. **iOS 13+ only:** Apple Sign-In requires iOS 13 or later. The button is only shown on iOS (`Platform.OS === 'ios'`).
4. **Button shows only on iOS:** The `{Platform.OS === 'ios' && ...}` guard ensures the button never appears on Android, avoiding import crashes.

#### Security Protections

| Attack Vector | Protection |
|--------------|------------|
| Token forgery | RS256 signature verified against Apple's JWKS public keys |
| Token replay | Expiry checked; Apple tokens are short-lived (~10 min) |
| Audience spoofing | `aud` claim must match `APPLE_BUNDLE_ID` exactly |
| Issuer spoofing | `iss` must be `https://appleid.apple.com` |
| Role escalation | Server forces `USER` role regardless of client request |
| Email enumeration | Login/signup modes return structured errors, not raw data |
| Key rotation | Apple public keys cached 24h, auto-refreshed on miss |
| MITM on key fetch | HTTPS to `appleid.apple.com` with JDK trust store |

---

### 3.2 Certificate Pinning — DONE
- [x] Generated real SHA-256 pin hash for `noefix.onrender.com`: `IX2/a47sFHkF9jewioc5OzEDzS0dNQjNMCX8PCQ26Pg=`
- [x] Generated real SHA-256 pin hash for `jauth.onrender.com`: `IX2/a47sFHkF9jewioc5OzEDzS0dNQjNMCX8PCQ26Pg=` (same Render infra)
- [x] Replaced both placeholders in `network_security_config.xml`
- [x] Backup pin retained: Let's Encrypt ISRG Root X1 `C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=`
- [ ] Test release build connects to both backends

**Note:** Both backends are on Render and share the same certificate. Pin expiration set to 2027-01-01. If Render rotates certs, the backup pin (Let's Encrypt root) will keep the app working.

**Why:** Placeholder pin hashes will cause the Android release build to fail ALL HTTPS connections to your backends. The app will not work at all.

**File:** `renfi/renfi/android/app/src/main/res/xml/network_security_config.xml`

**How to generate:**
```bash
openssl s_client -connect noefix.onrender.com:443 2>/dev/null | \
  openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64

openssl s_client -connect jauth.onrender.com:443 2>/dev/null | \
  openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

---

### 3.3 Export Compliance Declaration — DONE
- [x] Added `<key>ITSAppUsesNonExemptEncryption</key><false/>` to `ios/renfi/Info.plist`

**File:** `renfi/renfi/ios/renfi/Info.plist`

---

### 3.4 Web-Based Account Deletion — IMPLEMENTED (needs env vars + deployment)
- [x] Create web page at `/delete-account` in `flapage/codespaces-nextjs/my-project/`
- [x] Multi-step flow: identify (email/phone) → OTP verify → confirm intent → deletion OTP → done
- [x] Server-side API proxy routes (backend URLs never exposed to browser)
- [x] Rate limiting, origin validation, input sanitization
- [x] Reuses same Java Auth APIs as mobile app (OTP login + account deletion)
- [x] Reuses same Node.js cleanup endpoint
- [ ] Set environment variables on deployment (see setup below)
- [ ] Deploy the website and verify `https://fixhomi.com/delete-account` works
- [ ] Link the URL in Google Play Console → App Content → Data Safety → "Delete Account URL"
- [ ] Test full flow: email OTP login → confirm deletion → deletion OTP → account deleted

**Why:** Google Play requires BOTH an in-app deletion option AND a web-accessible deletion URL. The app has in-app deletion (SettingsScreen.jsx lines 804-914). The web page is now implemented.

**Files created:**
- `flapage/.../app/delete-account/page.js` — Page with header/footer/metadata
- `flapage/.../app/delete-account/DeleteAccountFlow.js` — 5-step client component
- `flapage/.../app/api/delete-account/send-otp/route.js` — Proxy to Java Auth OTP send
- `flapage/.../app/api/delete-account/verify-otp/route.js` — Proxy to Java Auth OTP verify
- `flapage/.../app/api/delete-account/confirm/route.js` — Proxy to Java Auth delete + Node.js cleanup
- `flapage/.../lib/deleteAccountSecurity.js` — Rate limiting, validation, CSRF protection

**Environment variables needed (set on your deployment platform):**
```
JAVA_AUTH_URL=https://jauth.onrender.com
NODE_BACKEND_URL=https://noefix.onrender.com
```

**Security layers:**
1. Origin validation (CSRF) — only requests from fixhomi.com accepted
2. Rate limiting per IP + identifier — 3 OTP sends per 5 min, 5 verify attempts per 5 min
3. Input sanitization — email/phone validated, text stripped of HTML/JS
4. Server-side proxy — Java Auth and Node.js URLs never exposed to browser
5. OTP verification — two separate OTPs (login + deletion) for defense in depth
6. Tokens in memory only — never stored in localStorage or cookies
7. Navigation warning — browser warns before leaving during active flow
8. Backend validation — same Java Auth timing-safe OTP comparison as mobile app

---

## 4. High Priority Issues

### 4.1 App Display Name — DONE
- [x] Updated `app.json` → `displayName` to "Fixhomi" (internal `name` stays "renfi")
- [x] Updated `android/app/src/main/res/values/strings.xml` → `app_name` to "Fixhomi"
- [x] Updated `ios/renfi/Info.plist` → `CFBundleDisplayName` to "Fixhomi"
- [ ] Verify the change on both platforms after rebuild

**Note:** `applicationId` stays `com.renfi`, iOS bundle identifier unchanged. Only display name changed.

---

### 4.2 ProGuard/R8 — DONE
- [x] Set `enableProguardInReleaseBuilds = true` in `android/app/build.gradle`
- [x] Added ProGuard rules for React Native (Hermes), Razorpay, Mapbox, Firebase, OkHttp, Gson in `proguard-rules.pro` (59 lines)
- [ ] Build release APK/AAB and test all screens work
- [ ] Test payment flow works with ProGuard enabled
- [ ] Test map rendering works with ProGuard enabled

---

### 4.3 Background Location Permission — DONE
- [x] Updated `NSLocationWhenInUseUsageDescription` — specific: "Fixhomi uses your location to find nearby service providers and show them on the map so you can connect with local professionals."
- [x] Updated `NSLocationAlwaysAndWhenInUseUsageDescription` — distinct provider-specific message: "Service providers need background location access to share their live position with customers during active service visits, enabling real-time arrival tracking."
- [ ] Only request "Always" permission for provider role; users should only get "When In Use" (runtime logic)
- [ ] Prepare Google Play background location declaration form with demo video

**Note:** iOS Podfile still includes `LocationAlways` (needed for provider live tracking). Android `AndroidManifest.xml` does NOT declare `ACCESS_BACKGROUND_LOCATION` — provider location tracking on Android uses foreground service only.

---

### 4.4 Subscription Strategy — Platform-Specific — IMPLEMENTED

#### Android (Keep Razorpay, Reframe Wording) — DONE

- [x] Change "Premium Plan" → "Pro Business Plan" in all 3 i18n files
- [x] Change "Subscribe Now" → "Activate Professional Tools" in all 3 i18n files
- [x] Change "Premium Badge" → "Verified Business Badge" in all 3 i18n files
- [x] Change "Premium Benefits" → "Professional Tools & Features" in all 3 i18n files
- [x] Change "Unlock Premium" → "Upgrade to Professional Tools" in all 3 i18n files
- [x] Update SubscriptionScreen.jsx hardcoded strings (ActiveStatusCard, UpgradeCard)
- [x] Update SubscriptionScreen.jsx header comment
- [x] Update Razorpay checkout description in subscriptionService.js
- [x] Update scattered "Premium" references across all i18n files (visibility notes, welcome messages, etc.)
- [ ] Update Play Store description to frame as "professional business tools for service providers"
- [ ] In Play Store Data Safety form: declare payment info as "collected but not stored, processed by third-party provider (Razorpay) for service provider business tools"

#### iOS (Move to Web-Based Subscription) — DONE (app-side)

- [x] On iOS SubscriptionScreen: `Platform.OS === 'ios'` check redirects to `handleWebSubscribe()`
- [x] `handleWebSubscribe()` shows dialog explaining redirect, then opens `fixhomi.com/subscribe` in browser
- [x] Add disclosure text below subscribe button on iOS: "Secure payment via Razorpay on fixhomi.com"
- [x] Use `Platform.OS` check — Razorpay on Android, web link on iOS
- [x] Added i18n keys for web subscribe flow (all 3 languages)
- [x] No pricing differences mentioned anywhere — identical UI, different checkout method
- [x] Build unified manage-account page at `/manage-account` (in flapage) with OTP login → dashboard → upgrade or delete
- [x] Web Razorpay checkout via `checkout.js` SDK, proxied through Next.js server routes
- [x] `/delete-account` redirects to `/manage-account` (Google Play URL still works)
- [x] Provider role check — only SERVICE_PROVIDER users see "Upgrade to Professional Tools"
- [x] Payment verified server-side by Node.js backend (HMAC signature)
- [ ] Deploy website and verify `https://fixhomi.com/manage-account` works
- [ ] App detects subscription activation via pull-to-refresh after returning from web

**Files modified:**
- `renfi/renfi/src/screens/SubscriptionScreen.jsx` — iOS web redirect, hardcoded text changes, web payment note
- `renfi/renfi/src/services/subscriptionService.js` — Razorpay description/name updated
- `renfi/renfi/src/i18n/en.js` — All subscription strings + scattered references
- `renfi/renfi/src/i18n/hi.js` — All subscription strings + scattered references
- `renfi/renfi/src/i18n/mr.js` — All subscription strings + scattered references

---

### 4.5 Privacy Policy & Terms of Service — IMPLEMENTED

- [x] Created `/privacy` page in flapage website — 10 sections covering data collection, usage, sharing, security, rights, retention, children's privacy
- [x] Created `/terms` page in flapage website — Section A (Platform Usage, 12 clauses) + Section B (Provider Insurance, 8 clauses)
- [x] Privacy policy lists all data collected (name, email, phone, address, location, photos, payment, device ID)
- [x] Privacy policy names all third-party services: Razorpay, Firebase, Mapbox, Cloudinary, Surepass/DigiLocker, Google, Apple
- [x] Terms specify minimum age requirement (18+)
- [x] Both pages publicly accessible without login
- [x] Legal links added to website Footer component
- [x] All policy URLs consistent across mobile app and website (`https://fixhomi.com/privacy`, `https://fixhomi.com/terms`)
- [x] Added terms acceptance checkbox to RegisterScreen (user signup)
- [x] Added terms acceptance checkbox to ProviderRegisterScreen (provider signup)
- [x] Submit + Google/Apple signup disabled until terms accepted
- [x] Google/Apple handlers show warning if terms not checked
- [x] Added `legalAcceptance` schema fields to User model (termsAccepted, termsAcceptedAt, termsVersion, privacyAccepted, privacyAcceptedAt, privacyVersion)
- [x] Added `legalAcceptance` schema fields to Provider model (same fields)
- [x] Added `POST /api/auth/accept-policies` endpoint with: authenticateToken + strictRateLimiter + idempotency check + server-controlled version
- [x] Added `legal_acceptance` step to provider verification dashboard (between service approval and professional tools)
- [x] Verification dashboard shows Accept dialog with Read Terms / Accept buttons
- [x] Once accepted, cannot be re-accepted (idempotent) — revocation requires contacting support
- [x] Added i18n keys for terms acceptance flow
- [ ] Deploy website and verify pages load at `https://fixhomi.com/privacy` and `https://fixhomi.com/terms`

**Security measures:**
- `authenticateToken` middleware on accept-policies endpoint
- `strictRateLimiter` prevents abuse
- Policy version is **server-controlled** (not user-supplied) to prevent tampering
- Idempotency: already-accepted returns success without modification
- Acceptance is **immutable** — no endpoint to unset it, must contact support

**Files created:** `flapage/.../app/privacy/page.js`, `flapage/.../app/terms/page.js`
**Files modified:** `user.js`, `provider.js`, `authRoutes.js`, `verificationHelper.js`, `RegisterScreen.jsx`, `ProviderRegisterScreen.jsx`, `VerificationDashboardScreen.jsx`, `en.js`, `Footer.js`

---

### 4.6 Version Numbering
- [ ] Reset `versionName` to "1.0.0" in `android/app/build.gradle` (currently "1.23")
- [ ] Reset `versionCode` to 1 in `android/app/build.gradle` (currently 24)
- [ ] Update iOS version in Xcode to 1.0.0 with build number 1

**Why:** Version 1.23 with build 24 suggests a long pre-release history. First store submission should be 1.0.0.

---

## 5. Medium Priority Issues

### 5.1 Strip Production Console Logs — DONE
- [x] Installed `babel-plugin-transform-remove-console` (`npm install --save-dev`)
- [x] Added to `babel.config.js` under `env.production.plugins`
- [x] ALL `console.log`, `console.warn`, `console.error` calls are automatically stripped from production builds by Babel
- [x] This covers all files: aadhaarService.js, subscriptionService.js, googleAuthService.js, mapbox.js, environment.js, and every other file

**How it works:** The Babel plugin runs during the Metro bundler's production build (`NODE_ENV=production`). It removes every `console.*` call from the JS bundle. No manual `__DEV__` gating needed — the plugin handles everything at compile time. Debug builds (`__DEV__`) still show all logs.

**Files modified:** `babel.config.js`, `package.json` (new devDependency)

---

### 5.2 Privacy Manifest — Verify Third-Party SDK Coverage
- [ ] After `pod install`, verify Firebase SDK includes its own privacy manifest
- [ ] Verify Mapbox SDK includes its own privacy manifest
- [ ] Verify `react-native-keychain` includes privacy manifest
- [ ] Verify `@react-native-google-signin/google-signin` includes privacy manifest
- [ ] Check for any missing required reason API declarations
- [ ] Run: `grep -r NSPrivacyAccessedAPITypes ios/Pods/` to audit

**Why:** Apple rejects apps where third-party SDKs use required-reason APIs without declaring them in their own privacy manifests.

**File:** `renfi/renfi/ios/renfi/PrivacyInfo.xcprivacy` (app-level manifest exists and is correct)

---

### 5.3 AAB Format for Google Play
- [ ] Build Android App Bundle: `cd android && ./gradlew bundleRelease`
- [ ] Verify the AAB is generated at `android/app/build/outputs/bundle/release/`
- [ ] Test AAB with `bundletool` before uploading

**Why:** Google Play no longer accepts APKs for new apps. AAB is mandatory.

---

### 5.4 Play App Signing Enrollment
- [ ] Create Google Play Developer account (if not done)
- [ ] Enroll in Play App Signing before first AAB upload
- [ ] Upload app signing key or let Google generate one

**Why:** Mandatory for all new apps on Google Play.

---

### 5.5 Google Play Closed Testing (If New Account)
- [ ] Check if developer account was created after November 13, 2023
- [ ] If yes: create closed testing track in Play Console
- [ ] Recruit minimum 12 testers
- [ ] Run closed test for minimum 14 consecutive days
- [ ] After testing period: submit production access request (takes ~7 days to review)

**Why:** New personal developer accounts must complete closed testing before gaining production access.

---

### 5.6 Accessibility Labels
- [ ] Add `accessibilityLabel` to all interactive elements (buttons, inputs, toggles) across key screens
- [ ] Priority screens: LoginScreen, RegisterScreen, UserHomeScreen, ProviderHomeScreen, SettingsScreen, SubscriptionScreen
- [ ] Test with VoiceOver (iOS) and TalkBack (Android)

**Why:** Both stores increasingly test for screen reader support. While not an immediate rejection, it's becoming expected. Apple's Human Interface Guidelines strongly recommend it.

---

### 5.7 Mapbox Token Protection
- [ ] Restrict Mapbox token to specific bundle IDs in Mapbox Console (com.renfi for Android, iOS bundle ID)
- [ ] Verify token in `.env` is the production token (not test)
- [ ] Remove hardcoded fallback token in `src/config/mapbox.js:32` — use only the `.env` value
- [ ] Note: The same token is also hardcoded in `android/app/src/main/res/values/strings.xml:3` as `mapbox_access_token`

**Current token:** `pk.eyJ1IjoiZml4aG9taSIsImEiOiJjbWY2Zjg1MTUwMnhmMm1zNnQxaTdkcmtnIn0.AtF-wG4vaenzSf0Ff9aYBg`
**Appears in 3 places:** `.env:1`, `src/config/mapbox.js:32`, `android/.../strings.xml:3`

**File:** `renfi/renfi/src/config/mapbox.js`

---

### 5.8 Data Export Endpoint (GDPR Right to Portability)
- [ ] Add `GET /api/user/:userId/export` endpoint in Node.js backend
- [ ] Add `GET /api/provider/:providerId/export` endpoint in Node.js backend
- [ ] Return all stored user data as JSON (profile, addresses, service history, preferences)
- [ ] Add "Download My Data" option in SettingsScreen

**Why:** GDPR Article 20 requires data portability for EU users. Both stores increasingly expect this capability.

**Files:**
- `noefi/fixhomi-backend/routes/` (new endpoint)
- `noefi/fixhomi-backend/controllers/userController.js`
- `renfi/renfi/src/screens/SettingsScreen.jsx`

---

## 6. Low Priority Improvements

### 6.1 Error Boundaries
- [ ] Add React error boundary component wrapping all screen navigators
- [ ] Show user-friendly "Something went wrong" screen instead of white screen on crash
- [ ] Currently only `ProfileScreen.jsx` has an error boundary

---

### 6.2 Support URL / Contact Info
- [ ] Add support email or help desk URL to SettingsScreen
- [ ] Include support URL in both store listings (required field)

---

### 6.3 Firebase Crashlytics
- [ ] Add `@react-native-firebase/crashlytics` for production crash monitoring
- [ ] Configure crash reporting in `App.tsx`

---

### 6.4 Google API Key Restrictions
- [ ] In Firebase Console: restrict `google-services.json` API key to Android package `com.renfi` + release SHA-1 certificate
- [ ] iOS: `GoogleService-Info.plist` does NOT exist on disk (correctly excluded by `.gitignore`). Ensure it is added at build time or via Xcode before building for iOS. Without it, Firebase/FCM will not work on iOS.

**File:** `renfi/renfi/android/app/google-services.json` (exists locally, gitignored via `**/ google-services.json`)

**Note:** Both `google-services.json` and `GoogleService-Info.plist` are in `.gitignore` (lines 77-78). The Android file exists locally but is not tracked. Ensure CI/CD or build scripts inject these files.

---

### 6.5 Hardcoded WiFi IP
- [ ] Verified: `LOCAL_MACHINE_IP = '192.168.29.71'` in `src/config/api.js:73` is only used in `__DEV__` mode (line 79 gates it). It also appears in `src/config/environment.js:66`. Both are safe — production builds use `PRODUCTION_CONFIG` URLs only. No action required unless you want to clean up the source.

---

### 6.6 Consent Tracking
- [ ] Record timestamp + version of terms/privacy policy accepted at registration
- [ ] Store in both Java Auth and MongoDB user records
- [ ] This supports GDPR consent audit trail

---

### 6.7 Admin Audit Logging
- [ ] Add audit log for admin actions (user deletion, provider deletion, status changes)
- [ ] Create AdminAuditLog model in Node.js backend
- [ ] Log: admin ID, action, target ID, timestamp, reason

**File:** `noefi/fixhomi-backend/` (new model + middleware)

---

## 7. Store Listing Preparation

### 7.1 Apple App Store Listing
- [ ] App name: "Fixhomi" (verify availability)
- [ ] Subtitle: (30 chars max, e.g., "Home Services, Simplified")
- [ ] Category: Primary — Lifestyle; Secondary — Utilities
- [ ] Age rating: Complete updated questionnaire (deadline was Jan 31, 2026)
- [ ] Privacy policy URL: `https://fixhomi.com/privacy`
- [ ] Support URL: (add support email/page)
- [ ] App description (4,000 chars max)
- [ ] Keywords (100 chars, comma-separated)
- [ ] Screenshots: iPhone 6.9" (required), iPhone 6.7" (required), iPad (if universal)
- [ ] App icon: 1024x1024 PNG (no transparency, no rounded corners)
- [ ] App preview video (optional but recommended)
- [ ] What's New text for version 1.0

### 7.2 Google Play Store Listing
- [ ] App name: "Fixhomi" (50 chars max)
- [ ] Short description (80 chars max)
- [ ] Full description (4,000 chars max)
- [ ] Category: House & Home or Lifestyle
- [ ] Content rating: Complete IARC questionnaire
- [ ] Privacy policy URL: `https://fixhomi.com/privacy`
- [ ] App icon: 512x512 PNG
- [ ] Feature graphic: 1024x500 PNG
- [ ] Screenshots: minimum 2, up to 8 per device type
- [ ] Phone screenshots (required)
- [ ] 7-inch tablet screenshots (recommended)
- [ ] 10-inch tablet screenshots (recommended)
- [ ] Complete Data Safety form (see Section 10)

---

## 8. Testing & Review Preparation

### 8.1 Pre-Submission Testing
- [ ] Test complete user signup → service request → completion flow
- [ ] Test complete provider signup → verification → accept job → completion flow
- [ ] Test account deletion flow end-to-end (both user and provider)
- [ ] Test payment/subscription flow (Razorpay)
- [ ] Test push notifications in all states (foreground, background, quit)
- [ ] Test deep links (email verification, password reset)
- [ ] Test on minimum iOS version supported
- [ ] Test on Android API 24 (minimum) and API 36 (target)
- [ ] Test with airplane mode / no network
- [ ] Test with location permission denied
- [ ] Test with notification permission denied
- [ ] Test with camera permission denied

### 8.2 Reviewer Test Accounts
Prepare these before submission — both stores may ask for demo credentials.

**User (Customer) Test Account:**
```
Email: (create a test account)
Password: (set a test password)
Phone: (verified test number)
Notes: Has completed service requests in history
```

**Provider (Service Professional) Test Account:**
```
Email: (create a test account)
Password: (set a test password)
Phone: (verified test number)
Notes: Has approved services, can receive requests, has transaction history
```

**Important for Apple Review:**
- [ ] Create test accounts before submission
- [ ] Ensure test accounts work in production environment
- [ ] Document any special setup needed (e.g., location must be in India)
- [ ] If location-dependent: provide specific coordinates or city that has providers

### 8.3 Review Notes for Apple
Include these in the "Notes for Reviewer" field in App Store Connect:

```
Fixhomi is a home services marketplace connecting customers with verified
service professionals in India.

TEST ACCOUNTS:
User: [email] / [password]
Provider: [email] / [password]

LOCATION: The app requires location in India to find nearby providers.
For testing, use a location in Pune, Maharashtra, India.

PAYMENT: Provider subscriptions use Razorpay (India's payment gateway).
The subscription provides professional business tools for service providers
(visibility boost, verified badge, analytics) to support their real-world
home service business.

AADHAAR VERIFICATION: Provider identity verification uses India's DigiLocker
(government digital identity system). This requires a real Indian Aadhaar
number and cannot be tested with dummy data. Test provider account has
already completed verification.

ACCOUNT DELETION: Available in Settings > Delete Account. Requires OTP
verification to the registered phone number.
```

### 8.4 Review Notes for Google Play
```
Business model: Fixhomi is a marketplace for home services (plumbing,
electrical, cleaning, etc.). Customers find and book verified local
service professionals.

Provider Professional Tools: Service providers can activate Professional
Tools (business visibility, verified badge, performance analytics) via
Razorpay payment gateway. This is a B2B professional service that supports
providers' real-world home service businesses, similar to how marketplace
platforms charge sellers for business tools.

Payments are for real-world service provider business tools, processed
through Razorpay (India's leading payment gateway), which is standard for
India-based marketplace applications.
```

---

## 9. Final Pre-Submission Checklist

Run through this checklist after all tasks above are complete:

### Code & Build
- [ ] All critical blockers (Section 3) resolved
- [ ] All high priority issues (Section 4) resolved
- [ ] Release build runs without crashes on iOS
- [ ] Release build runs without crashes on Android
- [ ] No console.log statements in production build
- [ ] ProGuard enabled and tested
- [ ] Certificate pinning uses real hashes
- [ ] Version set to 1.0.0

### Store Configuration
- [ ] Apple Developer account active with valid membership
- [ ] Google Play Developer account active
- [ ] App Store Connect app record created
- [ ] Google Play Console app record created
- [ ] Play App Signing enrolled
- [ ] Closed testing completed (if required)

### Legal & Privacy
- [ ] Privacy policy live at `https://fixhomi.com/privacy`
- [ ] Terms of service live at `https://fixhomi.com/terms`
- [ ] Account deletion works (in-app + web for Google)
- [ ] Sign in with Apple implemented
- [ ] Data Safety form completed (Google Play)
- [ ] App Privacy Details completed (Apple)
- [ ] Export compliance answered
- [ ] Age rating questionnaire completed

### Assets
- [ ] App icon uploaded (both stores)
- [ ] Screenshots uploaded (both stores)
- [ ] Feature graphic uploaded (Google Play)
- [ ] Store descriptions written (both stores)
- [ ] Test accounts prepared

### Submit
- [ ] Upload iOS build to App Store Connect via Xcode or Transporter
- [ ] Upload Android AAB to Google Play Console
- [ ] Fill in reviewer notes with test account credentials
- [ ] Submit for review

---

## 10. Data Collected (For Privacy Forms)

Use this list when completing Apple App Privacy Details and Google Play Data Safety form:

| Data Type | Collected | Linked to User | Used for Tracking | Purpose |
|-----------|-----------|----------------|-------------------|---------|
| Name | Yes | Yes | No | Account profile |
| Email | Yes | Yes | No | Account, verification |
| Phone number | Yes | Yes | No | Account, OTP verification |
| Physical address | Yes | Yes | No | Service delivery location |
| Precise location | Yes | Yes | No | Provider matching, live tracking |
| Photos | Yes | Yes | No | Profile picture, documents |
| Payment info | Collected by Razorpay | No (not stored) | No | Subscription payment |
| User ID | Yes | Yes | No | Account identification |
| Device ID (FCM token) | Yes | Yes | No | Push notifications |
| Crash data | No (unless Crashlytics added) | — | — | — |
| Performance data | No | — | — | — |
| Browsing history | No | — | — | — |
| Contacts | No | — | — | — |
| Health data | No | — | — | — |

**Third-party SDKs that handle data:**
- Firebase (FCM token, analytics if enabled)
- Razorpay (payment info — processed, not stored by app)
- Mapbox (location for map rendering)
- Cloudinary (uploaded images)
- Surepass/DigiLocker (Aadhaar verification — only status stored, no Aadhaar number)

---

## 11. Verified — No Issues Found

These items were checked and confirmed to be correct:

- [x] **App icons (Android):** Real Fixhomi branded PNG icons exist at all densities (mdpi through xxxhdpi) — house + "Fix" logo, not React Native defaults
- [x] **App Transport Security (iOS):** `NSAllowsArbitraryLoads = false`, `NSAllowsLocalNetworking = false` in Info.plist (lines 30-33) — strict HTTPS enforced
- [x] **Token storage:** Tokens stored in React Native Keychain (secure), non-sensitive user data in AsyncStorage — verified in `src/utils/storage.js`
- [x] **`.env` gitignored:** `.env` is in `.gitignore` (line 71) — Mapbox token not committed to git
- [x] **Firebase configs gitignored:** Both `google-services.json` and `GoogleService-Info.plist` in `.gitignore` (lines 77-78)
- [x] **`api.js` debug logs:** Lines 140-156 are correctly gated with `if (__DEV__)` — no production leak
- [x] **WiFi IP:** `LOCAL_MACHINE_IP` only used in `__DEV__` mode (gated at line 79 of api.js)
- [x] **Deep links configured:** `fixhomi://` scheme in both AndroidManifest.xml (line 50) and Info.plist (line 74)
- [x] **Account deletion (in-app):** Implemented with OTP verification in SettingsScreen.jsx
- [x] **Privacy manifest:** `PrivacyInfo.xcprivacy` exists with correct API reason declarations (FileTimestamp, UserDefaults, SystemBootTime) and 8 data type declarations
- [x] **targetSdkVersion:** 36 (exceeds Google Play's required 35)
- [x] **minSdkVersion:** 24 (Android 7.0 — reasonable minimum)
- [x] **Hermes engine:** Enabled (good for performance and bytecode compilation)
- [x] **Cleartext traffic blocked:** `network_security_config.xml` has `cleartextTrafficPermitted="false"` (line 18)
- [x] **resetPremium dev button:** Gated behind `__DEV__` (SubscriptionScreen.jsx line 691) — will not appear in production
- [x] **Release keystore gitignored:** `.gitignore` has `*.keystore` (line 35), `release.keystore` not tracked
- [x] **Signing config:** Release signing loads from `local.properties` (gitignored) with fallback to env vars
- [x] **Aadhaar compliance:** No Aadhaar number stored — only verification status + uniqueness_id via DigiLocker

---

## 12. File Reference

Key files that need modification (quick reference):

| File | What Needs Changing | Section |
|------|-------------------|---------|
| `renfi/renfi/ios/renfi/Info.plist` | Display name (line 8), location strings (lines 36-38), add encryption declaration | 3.3, 4.1, 4.3 |
| `renfi/renfi/android/app/src/main/res/xml/network_security_config.xml` | Replace placeholder cert pin hashes (lines 40, 51) | 3.2 |
| `renfi/renfi/android/app/build.gradle` | Enable ProGuard (line 71), version numbers (lines 96-97) | 4.2, 4.6 |
| `renfi/renfi/android/app/src/main/res/values/strings.xml` | App name (line 2) | 4.1 |
| `renfi/renfi/app.json` | Display name (line 3) | 4.1 |
| `renfi/renfi/src/screens/LoginScreen.jsx` | Add Sign in with Apple button | 3.1 |
| `renfi/renfi/src/screens/RegisterScreen.jsx` | Add Sign in with Apple button | 3.1 |
| `renfi/renfi/src/screens/ProviderRegisterScreen.jsx` | Add Sign in with Apple button | 3.1 |
| `renfi/renfi/src/screens/SubscriptionScreen.jsx` | iOS web-based payment, wording changes | 4.4 |
| `renfi/renfi/src/services/subscriptionService.js` | Platform-specific payment logic, strip console logs | 4.4, 5.1 |
| `renfi/renfi/src/services/aadhaarService.js` | Strip 20+ ungated console.log statements (lines 38-96) | 5.1 |
| `renfi/renfi/src/services/googleAuthService.js` | Strip 30+ ungated console.log statements (logs emails, IDs) | 5.1 |
| `renfi/renfi/src/config/mapbox.js` | Remove hardcoded token fallback (line 32), strip console logs | 5.1, 5.7 |
| `renfi/renfi/src/config/environment.js` | Strip ungated console.log (lines 106-108) | 5.1 |
| `renfi/renfi/ios/Podfile` | May need to remove `LocationAlways` if not needed (line 20) | 4.3 |
| `renfi/renfi/android/app/src/main/AndroidManifest.xml` | May need `ACCESS_BACKGROUND_LOCATION` for provider tracking | 4.3 |
| `renfi/renfi/src/i18n/en.js` | Subscription wording changes | 4.4 |
| `renfi/renfi/src/i18n/hi.js` | Subscription wording changes | 4.4 |
| `renfi/renfi/src/i18n/mr.js` | Subscription wording changes | 4.4 |
| `noefi/fixhomi-backend/` | Data export endpoint, Apple OAuth sync | 3.1, 5.8 |
| `java_auth-fxmi/jarbac/` | Apple OAuth controller/service | 3.1 |
