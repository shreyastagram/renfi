# FixHomi Location Tracking Guide

## Overview

This document explains the location tracking system in FixHomi and how the settings affect provider visibility and customer experience.

The system uses a **two-tier architecture**:
- **Foreground**: Socket.IO real-time updates via `socketService.js` (10-second interval)
- **Background / Killed**: TransistorSoft `react-native-background-geolocation` HTTP POSTs to the backend (50m distance filter, 60s heartbeat)

---

## Provider Settings (Settings Screen)

### 1. Available for Work Toggle

**Location:** Settings -> Availability -> "Available for Work"

**What it controls:**
- `isAvailable` field in Provider document (MongoDB)

**When ENABLED:**
- Provider appears in nearby provider searches
- Provider is listed for their service categories
- Provider can receive new booking requests
- Provider shows on customer's map when searching

**When DISABLED:**
- Provider is HIDDEN from all customer searches
- Provider cannot receive new booking requests
- Existing/active bookings are NOT affected
- Provider can still complete in-progress jobs

**Database Impact:**
```javascript
Provider.isAvailable = true/false
Provider.isOnline = true/false     // synced with isAvailable
Provider.lastOnline = Date
```

**API Endpoint:**
```
PATCH /api/provider/:providerId/online
Body: { isOnline: true/false }
```

**Side Effects:**
- Sets `currentLocation.lastUpdated` to NOW when going online (critical for 30-minute staleness gate)
- Returns `visibilityWarnings` if provider is missing verification, premium status, documents, etc.

---

### 2. Live Location Tracking Toggle

**Location:** Settings -> Availability -> "Live Location Tracking"

**What it controls:**
- `locationTracking.enabled` field in Provider document
- Whether real-time GPS updates are sent to the server

**When ENABLED:**
- Location updates every 10 seconds (foreground via Socket.IO)
- `geoLocation` field is updated for $geoNear queries
- Customers can see provider approaching on map
- Accurate ETA calculations
- Provider appears in proximity-based searches
- Uses GPS which may affect battery life

**When DISABLED:**
- No real-time location updates
- Customers cannot track provider arrival
- Only last known location is used
- ETA may be less accurate
- May not appear in very precise proximity searches

**Database Impact:**
```javascript
Provider.locationTracking = {
  enabled: true/false,
  updateInterval: 30000,  // 30 seconds (model default)
  minDistance: 50          // 50 meters
}

Provider.geoLocation = {
  type: "Point",
  coordinates: [longitude, latitude]  // GeoJSON format
}

Provider.currentLocation = {
  lat: number,
  lng: number,
  accuracy: number,
  lastUpdated: Date
}
```

---

## How Location Updates Work

### 1. Initial Registration
When a provider registers, their location is captured from:
- Device GPS (if permission granted)
- Address geocoding (fallback)

### 2. App Launch (Provider Home)
When provider opens the app:
1. Location tracking starts automatically (if `locationTracking.enabled` OR no location exists yet)
2. GPS position is obtained
3. Location is sent to server via:
   - Socket.IO (real-time, primary)
   - REST API (persistence fallback)

### 3. Foreground Updates (Socket.IO)
While provider is using the app:
- Location updates every **10 seconds** via `Geolocation.watchPosition()`
- Emits `provider:location:update` event via Socket.IO
- Falls back to REST API `PUT /api/auth/provider/location` if socket disconnected
- Updates both `geoLocation` (for searches) and `currentLocation` (for display)

**Files:** `src/services/socketService.js`

### 4. Background Updates (TransistorSoft)
When app is backgrounded or in killed state:
- Uses `react-native-background-geolocation` v5.0.5
- HTTP POSTs to `POST /api/provider/location-update`
- 50-meter distance filter (won't POST if moved <50m)
- 60-second heartbeat interval
- Automatic JWT token refresh (synced back to Keychain via `onAuthorization` callback)
- Rate limited: 1 update per 5 seconds on backend

**Files:** `src/services/backgroundLocationService.js`, `index.js` (headless task)

### 5. Per-Request Location Sharing
During active service requests:
- `LocationSharingContext.jsx` manages per-request tracking lifecycle
- One shared GPS watcher fans out to multiple active requests simultaneously
- Emits `request:location:update` via Socket.IO (foreground)
- TransistorSoft HTTP POST includes per-request broadcast (background)
- Health check every 30 seconds restarts watcher if dead
- Periodic resync every 60 seconds catches missed status changes

**Files:** `src/context/LocationSharingContext.jsx`

---

## Platform Support Matrix

| Scenario | Android | iOS |
|----------|---------|-----|
| **Foreground** (app open) | Socket.IO, 10s interval | Socket.IO, 10s interval |
| **Background** (app minimized) | TransistorSoft HTTP POST | TransistorSoft HTTP POST |
| **Killed** (app swiped from recents) | See Samsung note below | `UIBackgroundModes: location` in Info.plist |
| **After reboot** | `startOnBoot: true` | Requires user to reopen app |

### Android Killed-State Support
- `enableHeadless: true` — registers headless JS task in `index.js`
- `stopOnTerminate: false` — native service persists after app kill
- `startOnBoot: true` — restarts tracking after device reboot
- `ACCESS_BACKGROUND_LOCATION` permission in AndroidManifest.xml
- Foreground service declarations with `foregroundServiceType="location"`
- TransistorSoft license key in AndroidManifest.xml

**Headless Task Events** (`index.js` lines 21-43):
- `location` — auto HTTP POST by TransistorSoft
- `http` — handle HTTP response codes
- `authorization` — token refresh in killed state
- `terminate` — app was terminated

### Samsung / OEM Behavior (Important)
Samsung One UI (and Xiaomi MIUI, Oppo ColorOS) does NOT kill the app when users swipe from recents — the process stays alive in the background. This means:
- **Swipe from recents** → app stays alive → Socket.IO continues → this is GOOD for tracking
- **OS memory pressure kill** → `stopOnTerminate: false` keeps native service → TransistorSoft takes over
- **ADB force-stop** (`adb shell am force-stop`) → kills EVERYTHING including native service → tracking stops until app reopens (not a real-world scenario)
- **Requires "Allow all the time" location permission** — without it, Android blocks location access for background-started foreground services
- **Battery optimization** should be disabled for the app (Settings → Apps → Fixhomi → Battery → Unrestricted)

### iOS Killed-State Support
- `UIBackgroundModes: [location, fetch, processing]` in Info.plist
- `pausesLocationUpdatesAutomatically: false` — continuous tracking
- `showsBackgroundLocationIndicator: true` — blue bar shown
- `NSLocationAlwaysAndWhenInUseUsageDescription` permission
- TransistorSoft license key in Info.plist
- Note: iOS may still throttle updates during low-power mode

### Permission Flow
1. Request "When in Use" permission first
2. Then request "Always Allow" for background/killed support
3. If "Always" denied, app still works in foreground + background (via foreground service)
4. Android: battery optimization dialog shown after permission grant
5. OEM-specific (Xiaomi/Samsung/Oppo): aggressive battery optimization may kill services

---

## Database Fields Explained

### Provider Document Structure

```javascript
{
  // Availability
  isAvailable: Boolean,        // Can receive new bookings
  isOnline: Boolean,           // Currently active in app
  lastOnline: Date,            // Last time provider went online

  // Legacy location format
  location: {
    latitude: Number,
    longitude: Number,
    address: String,
    lastUpdated: Date
  },

  // GeoJSON format for $geoNear queries (CRITICAL for nearby search)
  geoLocation: {
    type: "Point",
    coordinates: [longitude, latitude]  // Note: [lng, lat] order!
  },

  // Real-time tracking
  currentLocation: {
    lat: Number,
    lng: Number,
    accuracy: Number,          // GPS accuracy in meters
    lastUpdated: Date          // CRITICAL: 30-min staleness gate in search
  },

  // Tracking settings
  locationTracking: {
    enabled: Boolean,
    updateInterval: Number,    // ms between updates (default 30000)
    minDistance: Number         // min meters to trigger update (default 50)
  },

  // Location history
  locationHistory: [{
    lat: Number,
    lng: Number,
    accuracy: Number,
    timestamp: Date
  }]
}
```

---

## Nearby Provider Search

When a customer searches for nearby providers:

```javascript
// MongoDB $geoNear query (traditionalServiceController.js)
Provider.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [customerLng, customerLat] },
      distanceField: "distance",
      maxDistance: radius,  // Progressive: 2km, 5km, 10km, 15km, 20km
      spherical: true,
      key: "geoLocation",
      query: providerMatchQuery
    }
  }
])
```

**ALL requirements for provider to appear in searches:**
1. `isAvailable: { $ne: false }` — must be available for work
2. `isFullyVerified: true` — phone + email + Aadhaar verified
3. `isPremium: true` — must have premium subscription (traditional services)
4. `documentVerification.canReceiveRequests: true` — documents approved
5. `verifiedServiceCategories` includes the requested service
6. `geoLocation` must be set with valid GeoJSON coordinates
7. Within the search radius (progressive expansion)
8. `currentLocation.lastUpdated` within last **30 minutes** (staleness gate)
9. `isDeleted: { $ne: true }`
10. Not in `excludedIds` (already assigned/rejected providers)

---

## Socket Events

### Provider -> Server (Foreground)
```javascript
// General location update
socket.emit('provider:location:update', {
  providerId: string,
  latitude: number,
  longitude: number,
  accuracy: number,
  timestamp: number
});

// Per-request location update
socket.emit('request:location:update', {
  requestId: string,
  providerId: string,
  latitude: number,
  longitude: number,
  accuracy: number,
  timestamp: number
});
```

### Server -> Customer
```javascript
// Provider location broadcast (per-request room)
socket.emit('request:provider:location', {
  requestId: string,
  providerId: string,
  latitude: number,
  longitude: number,
  accuracy: number,
  timestamp: Date,
  eta: number  // minutes
});

// Also emitted to user:{userId} room for reliability
```

---

## REST Endpoints

### Foreground Fallback
```
PUT /api/auth/provider/location
Body: { providerId, latitude, longitude, address? }
Updates: location, geoLocation, currentLocation, lastOnline
Does NOT change: isOnline, isAvailable
```

### Background Location (TransistorSoft)
```
POST /api/provider/location-update
Auth: Bearer JWT (auto-refreshed by TransistorSoft)
Body: TransistorSoft location payload
Rate limit: 1 per 5 seconds per provider
Validates: timestamp (<5 min old), coordinates
Updates: currentLocation, geoLocation, isOnline, lastOnline
Side effect: Broadcasts to all active request rooms via Socket.IO
```

### Availability Toggle
```
PATCH /api/provider/:providerId/online
Body: { isOnline: true/false }
Updates: isOnline, isAvailable, lastOnline, currentLocation.lastUpdated
Returns: visibilityWarnings[], searchReady boolean
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/services/socketService.js` | Foreground Socket.IO location tracking (10s interval) |
| `src/services/backgroundLocationService.js` | TransistorSoft config, start/stop, token sync |
| `src/context/LocationSharingContext.jsx` | Per-request tracking lifecycle, health checks, permission flow |
| `src/utils/permissions.js` | Background location permission requests (iOS + Android) |
| `index.js` | Android headless task registration (killed-state) |
| `ios/renfi/Info.plist` | `UIBackgroundModes`, license key, location permissions |
| `android/app/src/main/AndroidManifest.xml` | Background permission, foreground service, license key |
| Backend: `controllers/backgroundLocationController.js` | Background POST handler, rate limiting, request broadcast |
| Backend: `controllers/authController.js` | REST fallback PUT handler |
| Backend: `controllers/providerController.js` | Availability toggle handler |
| Backend: `socketServer.js` | Socket.IO event handlers for location broadcasts |

---

## Troubleshooting

### Provider not appearing in searches

1. **Check isAvailable:**
   ```javascript
   db.providers.findOne({email: "provider@email.com"}, {isAvailable: 1, isOnline: 1})
   ```

2. **Check geoLocation:**
   ```javascript
   db.providers.findOne({email: "provider@email.com"}, {geoLocation: 1, currentLocation: 1})
   ```
   - Must have valid coordinates
   - Format must be `{ type: "Point", coordinates: [lng, lat] }`

3. **Check staleness (30-minute gate):**
   ```javascript
   db.providers.findOne({email: "provider@email.com"}, {"currentLocation.lastUpdated": 1})
   // Must be within last 30 minutes
   ```

4. **Check verification & premium:**
   ```javascript
   db.providers.findOne({email: "provider@email.com"}, {
     isFullyVerified: 1,
     isPremium: 1,
     "documentVerification.canReceiveRequests": 1,
     verifiedServiceCategories: 1
   })
   ```

5. **Check geospatial index:**
   ```javascript
   db.providers.getIndexes()
   // Should see: { "geoLocation": "2dsphere" }
   ```

### Location not updating

1. **Check location permission:** Ensure app has "Always Allow" for killed-state
2. **Check GPS:** Device GPS must be enabled
3. **Check network:** Server must be reachable
4. **Check TransistorSoft logs:** `BackgroundGeolocation.logger.getLog()` for background issues
5. **Check rate limiting:** Backend allows 1 update per 5 seconds per provider
6. **Check token expiry:** Background service auto-refreshes JWT, but check Keychain sync

### Battery drain concerns

- Foreground tracking uses GPS every 10 seconds
- Background tracking uses 50m distance filter (reduces updates)
- 60-second heartbeat in background
- Consider disabling tracking when not actively working
- Android: battery optimization may kill foreground service on some OEMs (Xiaomi, Samsung, Oppo)
- iOS: low-power mode may throttle updates

---

## Best Practices for Providers

1. **Keep "Available for Work" ON** when actively looking for jobs
2. **Keep "Live Location Tracking" ON** when en route to customer
3. **Turn OFF tracking** when on break to save battery
4. **Ensure GPS is enabled** for accurate location
5. **Allow "Always" location permission** for uninterrupted tracking (even when app is closed)
6. **Disable battery optimization** (Android) for reliable background tracking

---

## Bugs Fixed (April 2026 Testing Session)

### Bug 1: TransistorSoft never started during normal app flow
**Symptom:** `[BGLocation]` logs never appeared during normal usage. Foreground Socket.IO worked but background tracking never kicked in.
**Root Cause:** `LocationSharingContext.resumeTracking()` only starts TransistorSoft for requests with `locationSharing.enabled: true`. The flow was working but there was a timing issue with token reads.
**Fix:** Added diagnostic logging to `LocationSharingContext.resumeTracking()` which confirmed the flow works when requests have location sharing enabled. TransistorSoft starts correctly via `startBackgroundWithPermission()`.
**Status:** FIXED

### Bug 2: Unmount cleanup killed TransistorSoft on app kill (CRITICAL)
**Symptom:** When app was swiped from recents, Metro logs showed `[BGLocation] Stopped — no active requests` immediately followed by `[Headless] App terminated, tracking continues`. Backend received no background POSTs after kill.
**Root Cause:** `LocationSharingContext` had `stopAllBackgroundTracking()` in its `useEffect` cleanup:
```javascript
// BEFORE (broken):
useEffect(() => {
  return () => {
    stopAllBackgroundTracking(); // Killed native service on unmount!
  };
}, []);
```
When React unmounts on app kill, this cleanup runs BEFORE the process dies, calling `BackgroundGeolocation.stop()` and killing the native service.
**Fix:** Removed `stopAllBackgroundTracking()` from unmount cleanup. Instead, background tracking stops on logout via a `useEffect` that watches `isProvider`/`providerId` state changes:
```javascript
// AFTER (fixed):
useEffect(() => {
  return () => {
    // DO NOT stop TransistorSoft here — app kill triggers unmount
    // stopOnTerminate:false handles the kill case natively
  };
}, []);

// Separate effect: stop on logout only
useEffect(() => {
  if (wasProvider && (!isProvider || !providerId)) {
    stopAllBackgroundTracking(); // Only on actual logout
  }
}, [isProvider, providerId]);
```
**File:** `src/context/LocationSharingContext.jsx`
**Status:** FIXED

### Bug 3: iOS missing UIBackgroundModes
**Symptom:** iOS would not resume background location tracking after app kill.
**Root Cause:** `ios/renfi/Info.plist` was missing the `UIBackgroundModes` key.
**Fix:** Added to Info.plist:
```xml
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
  <string>fetch</string>
  <string>processing</string>
</array>
```
**File:** `ios/renfi/Info.plist`
**Status:** FIXED (needs iOS rebuild + test)

### Bug 4: Android background FGS location access denied
**Symptom:** `adb logcat` showed `Foreground service started from background can not have location/camera/microphone access` after app kill + geofence trigger.
**Root Cause:** Android 12+ requires `ACCESS_BACKGROUND_LOCATION` **runtime permission** (not just manifest declaration). The user had "Allow only while using the app" instead of "Allow all the time."
**Fix:** User must grant "Allow all the time" in Settings → Apps → Fixhomi → Permissions → Location. The app already prompts for this via `requestBackgroundLocationPermission()` in `permissions.js`, but if dismissed, it must be set manually.
**Status:** FIXED (permission-level, no code change needed)

---

## Testing Checklist (Real-World Walk Test)

### What to verify with real GPS movement:

**Backend logs to watch for:**
```
[BackgroundLocation] Received from provider X | source: background | coords: lat,lng
[BackgroundLocation] OK — provider X | N active request(s) updated | source: background
```

**Step-by-step:**
1. Open app as provider → confirm `[BGLocation] Started — tracking N request(s)` in Metro
2. Keep app open, walk 100m → confirm coordinates change in backend logs (Socket.IO)
3. Minimize app (home button) → walk 100m → confirm `[BackgroundLocation] Received... source: background` in backend
4. Swipe from recents → walk 100m → check if backend still receives posts (Samsung keeps process alive)
5. Wait 5+ minutes with app swiped → check if posts continue
6. Reopen app → confirm `[LocationSharingCtx] resumeTracking` picks up where it left off

**ADB commands for debugging:**
```bash
# Check if app process is alive after swipe
adb shell ps | grep renfi

# Force kill (simulates OS memory pressure kill)
adb shell am force-stop com.renfi

# Watch TransistorSoft native logs
adb logcat | grep -iE "TSLocationManager|transistor|BackgroundGeolocation"

# Check for location access denial
adb logcat | grep -i "can not have location"
```

**What NOT to use for testing:**
- Mock location apps don't reliably trigger TransistorSoft's native geofence after app kill
- Emulator static GPS won't trigger `distanceFilter: 50` — need real movement
- `adb shell am force-stop` is not a real-world scenario — real users swipe from recents

---

## Dev Test Screen

A temporary diagnostic screen exists at `src/screens/BGLocationTest.jsx` accessible from Settings → Developer Tools → "BG Location Test". **Remove before production release.**

Buttons:
1. **Tokens** — reads JWT from Keychain
2. **GPS** — gets current position
3. **Direct POST** — bypasses TransistorSoft, hits backend directly (key connectivity test)
4. **Start BG** — starts TransistorSoft with fake request ID
5. **BG State** — reads TransistorSoft internal state
6. **Force Loc** — forces TransistorSoft GPS + HTTP POST
7. **Stop BG** — stops TransistorSoft

Navigation: Added to `ProviderMainNavigator` in `navigation/RootNavigator.jsx` and `SettingsScreen.jsx` (Developer Tools section).

---

## Version History

- **v1.0.0** - Initial location tracking implementation
- **v1.1.0** - Added GeoJSON support for $geoNear
- **v1.2.0** - Added currentLocation for real-time display
- **v1.3.0** - Added Socket.IO integration
- **v1.4.0** - Added REST API fallback for persistence
- **v1.5.0** - Added TransistorSoft background-geolocation (foreground + background + killed state)
- **v1.6.0** - Added per-request location sharing via LocationSharingContext
- **v1.7.0** - Added iOS UIBackgroundModes for killed-state support
- **v1.8.0** - Fixed unmount cleanup killing TransistorSoft on app kill (Bug #2)
- **v1.9.0** - Added BGLocationTest diagnostic screen
- **v1.10.0** - Added diagnostic logging to LocationSharingContext (temporary)
