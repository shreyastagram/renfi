# iOS Development Guide — Fixhomi (React Native)

> Last updated: 2026-03-20
> Environment: macOS 26.2 Tahoe, Xcode 26.2, React Native 0.84.1

---

## 1. Environment Setup (From Scratch)

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| macOS | 26.x Tahoe | Xcode 26.x comes bundled |
| Xcode | 26.2+ | Install from Mac App Store |
| Node.js | 25.x+ | via `nvm` or Homebrew |
| Ruby | 3.3.7 | via `rbenv` (system Ruby 2.6 is too old) |
| CocoaPods | 1.16.2+ | via `gem install cocoapods` |
| Homebrew | latest | `/opt/homebrew/bin/brew` |

### Step-by-step

```bash
# 1. Install rbenv + Ruby (REQUIRED — system Ruby 2.6 breaks pod install)
brew install rbenv ruby-build
echo 'eval "$(rbenv init - zsh)"' >> ~/.zshrc
source ~/.zshrc
rbenv install 3.3.7
rbenv global 3.3.7   # or use `rbenv local 3.3.7` inside the project

# 2. Install CocoaPods and Bundler under the new Ruby
gem install cocoapods bundler

# 3. Clone and install JS dependencies
cd renfi/renfi
npm install

# 4. Install iOS native dependencies
cd ios
pod install --repo-update
cd ..

# 5. Start Metro bundler
npm start

# 6. Run on simulator
npm run ios

# 7. Run on physical device (connected via USB)
npx react-native run-ios --udid "<DEVICE_UDID>"
# Find UDID with: xcrun devicectl list devices
```

### Physical Device — First Run

If the app installs but won't launch with a "code signature not trusted" error:
1. On iPhone: **Settings → General → VPN & Device Management**
2. Tap your developer certificate → **Trust**

---

## 2. Key Versions & Compatibility

The reason we upgraded from RN 0.81 → 0.84 is that **RN 0.81 does not support Xcode 17+ / macOS 26**. RN 0.84.1 is the first stable version with full Xcode 26 support.

| Package | Version | Why this version |
|---------|---------|------------------|
| react-native | 0.84.1 | Xcode 26/macOS 26 support |
| react | 19.2.3 | Required peer dep for RN 0.84 |
| @react-native-firebase/* | 23.8.3 | Compatible with RN 0.84 |
| @react-native-community/cli | 20.1.2 | Matches RN 0.84 |
| @react-native/babel-preset | 0.84.1 | Must match RN version |
| @react-native/metro-config | 0.84.1 | Must match RN version |
| Ruby | 3.3.7 | macOS 26 system Ruby (2.6) can't run CocoaPods |

---

## 3. Critical Files Modified During Upgrade

### `ios/renfi/AppDelegate.swift`
- RN 0.84 regenerated this file with a new `RCTReactNativeFactory` pattern
- **`FirebaseApp.configure()` MUST be called before `startReactNative`** — without it, the JS bundle crashes with `No Firebase App '[DEFAULT]' has been created`
- If this file ever gets regenerated again (future RN upgrades), re-add `import FirebaseCore` and `FirebaseApp.configure()`

### `ios/renfi.xcodeproj/project.pbxproj`
- `GoogleService-Info.plist` was added to the Xcode project build phases — it existed on disk but wasn't being copied into the app bundle
- If you ever recreate the Xcode project, ensure this file is included in the **Copy Bundle Resources** build phase

### `.ruby-version`
- Set to `3.3.7` at project root so `rbenv` auto-switches

---

## 4. Known Issues & Gotchas

### Build Warnings (Non-blocking)
- Several pods show `IPHONEOS_DEPLOYMENT_TARGET` warnings (set to 9.0/10.0/11.0 but minimum is 12.0). These are from third-party pods and don't affect the build. They'll resolve as pods release updates.
- Hermes/ReactNativeDependencies script phase warnings about "will be run during every build" — cosmetic, doesn't affect functionality.

### Firebase Initialization Order
- `setupBackgroundMessageHandler()` in `index.js` uses `require('@react-native-firebase/messaging').default` which calls `getApp()` internally
- This only works if `FirebaseApp.configure()` runs in native code BEFORE the JS bundle loads
- If you see `No Firebase App '[DEFAULT]'` — check `AppDelegate.swift` first

### React Native New Architecture
- `RCTNewArchEnabled` is set to `true` in `Info.plist`
- RN 0.84 uses the new architecture by default (TurboModules, Fabric)
- Most popular libraries support it, but if a new native dependency causes crashes, check if it has New Architecture support

### Device Name Encoding
- The physical device name ("Prachi's Iphone") has special characters that break `--device` flag
- Always use `--udid` instead: `npx react-native run-ios --udid "00008150-00064CD602EA401C"`

### Metro Port Conflict
- If Metro is already running, you'll get `EADDRINUSE: address already in use :::8081`
- Kill it: `lsof -ti:8081 | xargs kill -9` then restart

---

## 5. App Store Submission Checklist

### Before Submitting for Review

#### Bundle Identifier & Signing
- [ ] Current bundle ID is `org.reactjs.native.example.renfi` — **CHANGE THIS** to `com.shreyashborkar.fixhomi` (or your production bundle ID) before submitting. The default template ID will be rejected.
- [ ] Verify `DEVELOPMENT_TEAM` (2KY94SMHN6) has an active Apple Developer Program membership
- [ ] Ensure you have a **Distribution Certificate** (not just Development) and a matching **Provisioning Profile**
- [ ] Set build configuration to **Release** (not Debug)

#### Version & Build Numbers
- [ ] `MARKETING_VERSION` is currently `1.0.0` — set to your desired version
- [ ] `CURRENT_PROJECT_VERSION` is currently `1` — increment for each new upload to App Store Connect
- [ ] These must be unique per upload — App Store Connect rejects duplicate version+build combinations

#### Privacy & Permissions
- [ ] All permission descriptions in `Info.plist` are user-friendly (Camera, Location, Photo Library — already done)
- [ ] `NSAppTransportSecurity` is configured correctly (no `NSAllowsArbitraryLoads` — good)
- [ ] `ITSAppUsesNonExemptEncryption` is set to `false` — correct if you only use HTTPS (standard encryption)
- [ ] If you use background location (`LocationAlways`), you MUST explain why in App Store Connect under "Location" in the App Privacy section. Apple rejects apps that request Always location without strong justification.

#### Firebase & Push Notifications
- [ ] `GoogleService-Info.plist` has the correct `BUNDLE_ID` matching your production bundle ID
- [ ] APNs key or certificate is uploaded to Firebase Console (required for push notifications on production)
- [ ] Test push notifications on a physical device with Release build before submitting

#### App Store Connect
- [ ] Screenshots for all required device sizes (6.9", 6.7", 6.5", 5.5" — or let Xcode auto-generate)
- [ ] App icon: 1024x1024 PNG without alpha channel
- [ ] Privacy Policy URL (required)
- [ ] If the app has login, provide a demo account in the review notes
- [ ] Declare all data collection in the App Privacy section (location, device info, push token, etc.)

#### Build & Archive
```bash
# Create a release build
cd ios
xcodebuild -workspace renfi.xcworkspace \
  -scheme renfi \
  -configuration Release \
  -sdk iphoneos \
  -archivePath build/renfi.xcarchive \
  archive

# Or use Xcode: Product → Archive
# Then: Window → Organizer → Distribute App
```

#### Things That Will Get You Rejected
1. **Template bundle ID** (`org.reactjs.native.example.*`) — must use your own
2. **Requesting Always Location without justification** — provide a clear reason
3. **Missing privacy policy** — required for all apps
4. **Debug build artifacts** — ensure no Metro bundler references in Release
5. **Crashlytics dSYM upload** — configure in build phases for crash reporting to work in production
6. **Console logs in production** — the `babel-plugin-transform-remove-console` is in devDependencies (already configured)

---

## 6. Useful Commands Reference

```bash
# List connected physical devices
xcrun devicectl list devices

# List available simulators
xcrun simctl list devices available

# Run on specific simulator
npx react-native run-ios --simulator="iPhone 17 Pro"

# Run on physical device
npx react-native run-ios --udid "<DEVICE_UDID>"

# Clean build (when things go wrong)
cd ios && rm -rf build Pods Podfile.lock
pod install --repo-update
cd .. && npx react-native run-ios

# Reset Metro cache
npx react-native start --reset-cache

# Check Ruby version (must be 3.3.7, NOT 2.6)
ruby -v

# Check pod version
pod --version
```

---

## 7. Upgrade Path Notes

When upgrading React Native in the future:
1. Always check [react-native-community/upgrade-helper](https://react-native-community.github.io/upgrade-helper/) for diff between versions
2. After upgrade, **immediately check `AppDelegate.swift`** — RN regenerates it and will remove `FirebaseApp.configure()`
3. After upgrade, verify `GoogleService-Info.plist` is still in the Xcode project's Copy Bundle Resources
4. Run `pod install --repo-update` after every RN upgrade
5. Test on **physical device** — simulator can mask signing and permission issues
