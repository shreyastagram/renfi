# FixHomi — Developer Recovery & Onboarding (Detailed)

> **Who this is for:** a **new developer joining**, or **you (owner) on a new / repaired Mac**.
> It explains, in plain language, **which secret files you need, why each one matters, what breaks
> if it's lost, where to get it, and exactly where to put it** so the app builds and releases again.
>
> **Use alongside:** Admin Panel → **Docs Guide** (all accounts, dashboards, infra, billing) and
> `TASKS_TRACKER.md` (work history/status).
>
> Last updated: 2026-06-15.

---

## 1. The golden rule (read this first)
A `git clone` only gives you the **public skeleton** of the project. The **secrets** — the Android
signing key, its passwords, and a few config files — are **deliberately kept OUT of Git** (so they
can't leak). They live in exactly two safe places:

1. **The build machine** (the Mac that currently builds the app), and
2. **The encrypted backup vault:** Google Drive → **Fixhomi → Keys & Secrets**.

To make the app build and release, you must **copy these secret files back into the cloned project
at the exact paths** below. If they are ever lost **with no backup**, you can lose the ability to
update the app — so backups are not optional.

### Where everything lives (quick map)
| Thing | Where |
|---|---|
| Source code | GitHub repos — **TBD** (created & handed over when work is complete) |
| Secret files (encrypted) | Google Drive → **Fixhomi → Keys & Secrets** |
| Passwords (keystore, backup, etc.) | Team **password manager** (Bitwarden / 1Password) |
| All accounts, dashboards, billing | Admin Panel → **Docs Guide** |

---

## 2. The secret files — one by one (what / why / if lost / get / place)

### 2.1 `release.keystore` — the Android signing key  ⭐ MOST IMPORTANT
- **What it is:** a unique cryptographic key that "signs" every Android build, proving the app
  genuinely comes from FixHomi.
- **Why you need it:** Google Play only accepts an update if it's signed with the **same key** as
  the very first upload. Every future Android release must use this exact file.
- **If you lose it:**
  - If **Play App Signing is enabled** (very likely — default since 2021): recoverable — you can
    ask Google to reset the upload key. Slow and stressful, but possible.
  - If it is a **legacy self-managed key**: **you can NEVER update the app again.** You'd have to
    publish a brand-new app with a new package name and **lose all users, installs, and reviews.**
  - ➡️ Either way: **back it up. Do not rely on one machine.**
- **Where to get it:** open `FixhomiKeys.dmg` (or `FixhomiKeys.zip`) from the vault using the
  **backup password** (in the password manager), and extract `release.keystore`.
- **Where to place it:** `renfi/android/app/release.keystore`
- **Verify it's the right one:**
  ```bash
  keytool -list -v -keystore release.keystore
  ```
  Confirm **Alias = `fixhomi-release`** and that **SHA1 / SHA256 match** the values recorded in the
  Admin Docs Guide → *Signing Keys & Backups*.

### 2.2 `local.properties` — keystore passwords + Android SDK path
- **What it is:** a local-only config file holding (a) where your Android SDK is installed, and
  (b) the **passwords** that unlock the keystore.
- **Why you need it:** the build reads `KEYSTORE_PASSWORD` and `KEY_PASSWORD` from here to open the
  keystore. **A keystore without its passwords is useless** — so this is as important as the key.
- **If you lose it:** recreate the file from the template below — but you **must know the passwords**
  (from the password manager). If the passwords are also lost, the keystore can never be opened.
- **Where to get it:** recreate it; copy the password values from the password manager.
- **Where to place it:** `renfi/android/local.properties`
- **Template:**
  ```properties
  sdk.dir=/Users/<your-mac-username>/Library/Android/sdk
  KEYSTORE_PASSWORD=<from password manager>
  KEY_PASSWORD=<from password manager>
  ```
  (The key alias `fixhomi-release` is already set in `android/app/build.gradle`.)

### 2.3 `.env` (and `.env.production`) — app environment secrets
- **What it is:** environment variables the app uses (API tokens/keys — e.g. the Mapbox token, and
  any other keys listed in `.env.example`).
- **Why you need it:** the app reads these at build/run time. Missing values → features break (maps,
  etc.) or the build fails.
- **If you lose it:** restore from the vault. The **names** of every required variable are in
  `renfi/.env.example` (that file IS in Git) — but the **values** are secret and only in the vault.
- **Where to place it:** `renfi/.env` (and `renfi/.env.production` if used).

### 2.4 `google-services.json` — Firebase config (Android)
- **What it is:** the Firebase setup file for the Android app (push notifications, App Distribution,
  analytics/Crashlytics).
- **Why you need it:** the Android build needs it; without it, Firebase features break or the build
  fails.
- **If you lose it:** re-download it (it's not catastrophic — it can be regenerated).
- **Where to get it:** Firebase console → project **fixhomi-f6382** (account `fixhomi.team@gmail.com`)
  → Project settings → *Your apps* → Android app → **download `google-services.json`**. Or the vault.
- **Where to place it:** `renfi/android/app/google-services.json`

### 2.5 `GoogleService-Info.plist` — Firebase config (iOS)
- **What it is:** the same as above, for the iOS app.
- **Why / if lost:** same — needed for the iOS build; re-downloadable.
- **Where to get it:** Firebase console → project **fixhomi-f6382** → Project settings → *Your apps*
  → iOS app → **download `GoogleService-Info.plist`**. Or the vault.
- **Where to place it:** `renfi/ios/<AppName>/GoogleService-Info.plist` (and make sure it's added to
  the Xcode project/target).

### 2.6 iOS signing — protect the ACCOUNT, not a file
- **What it is:** the Apple distribution certificate + provisioning profiles used to sign iOS builds.
- **Why it's different:** these are **regenerable**. You do **not** need to hoard a file — you need
  **access to the Apple Developer account** (`contact@fixhomi.com`) and its **2FA**.
- **If lost:** in Xcode, sign in with that Apple ID and let **Automatic signing** recreate them; or
  log in to developer.apple.com → Certificates → revoke old, create a new **Apple Distribution**
  certificate.
- ⚠️ The only hard-to-recover iOS scenario is **losing the Apple ID itself or its 2FA** — keep both
  safe.

---

## 3. Step-by-step: from zero to a working build

### Step A — Install tools
- Node.js (LTS) + npm/yarn · JDK 17 (gives you `keytool`) · Android Studio + Android SDK
- (Mac, for iOS) Xcode + Command Line Tools, CocoaPods, Watchman
- Exact React Native / package versions: see `renfi/package.json` (don't upgrade blindly).

### Step B — Get the code
Clone the repos (URLs **TBD**): `renfi` (app), `noefix` (Node backend), `jauth` (Java auth),
`temp_admin` (admin panel).

### Step C — Restore the secret files (Section 2)
Put each file back at its exact path:
| File | Restore to |
|---|---|
| `release.keystore` | `renfi/android/app/release.keystore` |
| `local.properties` | `renfi/android/local.properties` |
| `.env` / `.env.production` | `renfi/.env` |
| `google-services.json` | `renfi/android/app/google-services.json` |
| `GoogleService-Info.plist` | `renfi/ios/<App>/GoogleService-Info.plist` |

### Step D — Install dependencies
```bash
cd renfi
npm install            # or: yarn
cd ios && pod install && cd ..   # Mac / iOS only
```

### Step E — Run (development)
```bash
npx react-native run-android          # Android device/emulator
# iOS: open ios/<App>.xcworkspace in Xcode → select your team → Run
```

### Step F — Build a release
**Android** (keystore + `local.properties` must be in place):
```bash
cd android
./gradlew bundleRelease     # AAB for Play Store  (or assembleRelease for an APK)
```
Bump `versionCode` (must always increase) + `versionName` in `android/app/build.gradle`, then
upload the `.aab` in Play Console (`contact@fixhomi.com`).

**iOS:** Xcode → Product → **Archive** → distribute to **App Store Connect** (`contact@fixhomi.com`).
Bump **Version** + **Build** (build must be unique) before archiving.

> Minimum-version / force-update prompts are controlled in **Admin Panel → App Version** (per
> platform). Backends and the admin panel deploy on their own (Render / Netlify) — an app rebuild
> only ships app-side changes.

---

## 4. Importance & recoverability — at a glance
| File / asset | Severity if lost | Recoverable? |
|---|---|---|
| `release.keystore` + its passwords | 🔴 Critical | Only if Play App Signing is on (Google reset). Otherwise **never** — back it up! |
| `local.properties` passwords | 🔴 Critical | Only from the password manager — without them the keystore can't open |
| `.env` / `.env.production` | 🟠 High | From the vault (values) / `.env.example` (names) |
| `google-services.json` | 🟡 Medium | Re-download from Firebase console |
| `GoogleService-Info.plist` | 🟡 Medium | Re-download from Firebase console |
| iOS distribution cert | 🟢 Low | Regenerate via Apple Developer account (protect the Apple ID + 2FA) |

---

## 5. How NOT to lose them (backup discipline)
- **Back up the FULL set**, not just the keystore: `release.keystore`, `local.properties` (or its
  passwords), `.env`/`.env.production`, `google-services.json`, `GoogleService-Info.plist`.
- **Two copies, two places:** the encrypted vault (Google Drive → Fixhomi → Keys & Secrets) **and**
  the password manager.
- **Encrypt** anything in cloud storage (e.g. `FixhomiKeys.dmg` / `.zip`); **never** upload raw
  secret files.
- **Keep passwords separate** from the files they unlock (passwords in the password manager only).
- **Never commit** any of these to Git (they're already gitignored — keep it that way).
- **On any change** (new keystore, rotated secret, new API key): update the vault **and** the Admin
  Docs Guide / this file immediately.

---

## 6. References
- **Accounts, dashboards, billing, infra:** Admin Panel → **Docs Guide**
- **Signing key details + recovery:** Docs Guide → **Signing Keys & Backups**
- **Work status / history:** `TASKS_TRACKER.md`
- **Secret vault:** Google Drive → Fixhomi → Keys & Secrets
- **Passwords:** team password manager
