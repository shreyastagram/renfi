# Android & React Native Performance Fixes — FixHomi App (renfi)

> **Created:** 2026-04-01
> **Problem:** Visible lag when switching between bottom tabs on Android APK builds, plus app-wide performance issues discovered during deep audit.
> **How to use:** Tell Claude to read this file and resolve items one by one. After each fix, update the status and add notes.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]`  | Not started |
| `[~]`  | In progress |
| `[x]`  | Resolved |
| `[—]`  | Decided not to fix (with reason) |

---

## Table of Contents

1. [Root Cause Summary](#1-root-cause-summary)
2. [Critical Fixes — Tab Lag (Do First)](#2-critical-fixes--tab-lag-do-first)
3. [Critical Fixes — App-Wide Re-Renders](#3-critical-fixes--app-wide-re-renders)
4. [Important Fixes — Background Waste](#4-important-fixes--background-waste)
5. [Important Fixes — List & Component Performance](#5-important-fixes--list--component-performance)
6. [Important Fixes — Image & Asset Performance](#6-important-fixes--image--asset-performance)
7. [Important Fixes — Network & Data Fetching](#7-important-fixes--network--data-fetching)
8. [Android-Specific Rendering Fixes](#8-android-specific-rendering-fixes)
9. [Startup & Bundle Optimization](#9-startup--bundle-optimization)
10. [Minor Fixes & Polish](#10-minor-fixes--polish)
11. [What NOT to Change (Already Good)](#11-what-not-to-change-already-good)
12. [Testing Checklist](#12-testing-checklist)
13. [Resolution Log](#13-resolution-log)
14. [Priority Order](#14-priority-order)

---

## 1. Root Cause Summary

When a user taps a bottom tab on Android, the following happens simultaneously:

1. Tab transition starts
2. The new screen's `useFocusEffect` fires **immediately** — triggering 3-5 API calls
3. FlatLists render ALL items at once (no render batching configured)
4. Socket listeners from ALL mounted tabs are active, triggering cascading API calls
5. A pulsing animation loop keeps running on the JS thread even when Home tab is not visible
6. Scroll event listeners fire at 125 events/second (8ms throttle)
7. AppContext re-renders the entire component tree on any state change (context value not memoized)

Beyond tab lag, the deep audit uncovered app-wide performance issues: unmemoized context, no image caching, inline style objects, missing React.memo on list items, large data fetches, and Android GPU overdraw from missing `overflow: 'hidden'`.

**Current tab navigator config** (`navigation/RootNavigator.jsx`):
- `freezeOnBlur: true` — already present (good)
- `animation: 'none'` — already present (good)
- Custom tab bar with `android_ripple={null}` — already present (good)

The navigator config is fine. The problems are inside screens, context, and components.

---

## 2. Critical Fixes — Tab Lag (Do First)

These three fixes together should eliminate the visible tab-switch lag.

### 2.1 `[ ]` Wrap All Tab Focus Fetches in InteractionManager

**Problem:** Every tab screen fires API calls the instant it receives focus. On Android, this blocks the JS thread during the tab transition, causing visible jank.

**Affected screens and their focus-triggered fetches:**

**ProviderHomeScreen.jsx** (lines ~701-725):
- `fetchStats()` — hits 3 endpoints in parallel (traditional, event, emergency service stats)
- `fetchVerificationData()` — verification dashboard API
- `refreshProfile()` — profile API from AppContext
- Total: 5+ API calls firing immediately on focus

**UserServiceHistoryScreen.jsx** (lines ~760-790):
- `fetchRequests()` or `debouncedRefresh()` on focus
- Sets up 30-second `setInterval` for auto-refresh
- Registers 4 socket listeners that each trigger `debouncedRefresh()`

**ProviderServiceHistoryScreen.jsx** (lines ~703-709):
- Same pattern as UserServiceHistoryScreen
- 30-second refresh interval + socket listeners + AppState listener

**SettingsScreen.jsx** (lines ~383-394):
- Auto-update version check on mount
- Preferences loading

**ProfileScreen.jsx** (lines ~326-336):
- Profile data loading
- OTP countdown timer setup

**Fix:** Wrap all focus-triggered data fetching in `InteractionManager.runAfterInteractions()`:

**Before:**
```javascript
useFocusEffect(
  useCallback(() => {
    fetchStats();
    fetchVerificationData();
    refreshProfile();
  }, [deps])
);
```

**After:**
```javascript
import { InteractionManager } from 'react-native';

useFocusEffect(
  useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchStats();
      fetchVerificationData();
      refreshProfile();
    });
    return () => task.cancel();
  }, [deps])
);
```

**Apply this pattern to ALL screens listed above.**

**Effort:** 30 minutes
**Impact:** HIGH — eliminates the primary source of jank
**Resolution notes:**
> _(fill in after fixing)_

---

### 2.2 `[ ]` Add FlatList Performance Props to History Screens

**Problem:** Both history screens use `Animated.FlatList` without Android-critical optimization props. Without these, Android renders ALL list items in the view hierarchy on mount.

**Files:**
- `src/screens/UserServiceHistoryScreen.jsx` (line ~1046)
- `src/screens/ProviderServiceHistoryScreen.jsx` (line ~1081)

**Add ALL of these props:**
```javascript
<Animated.FlatList
  // ... existing props ...
  removeClippedSubviews={true}        // Detaches off-screen views from native hierarchy
  maxToRenderPerBatch={10}            // Render 10 items per batch instead of all at once
  updateCellsBatchingPeriod={50}      // 50ms between batch renders
  initialNumToRender={8}              // Only render ~1 screen of items on mount
  windowSize={5}                      // Keep 5 screens worth (default 21 is way too many)
/>
```

| Prop | Default | Recommended | Why |
|------|---------|-------------|-----|
| `removeClippedSubviews` | `false` | `true` | Most impactful single prop for Android. Removes off-screen views from native hierarchy. |
| `maxToRenderPerBatch` | `10` | `10` | Set explicitly. Controls items rendered per frame. |
| `updateCellsBatchingPeriod` | `50` | `50` | Time between batch renders. |
| `initialNumToRender` | `10` | `8` | Only render what fits on screen initially. |
| `windowSize` | `21` | `5` | Default keeps 10 screens in each direction — way too many. |

**Effort:** 15 minutes
**Impact:** HIGH — significantly reduces initial render time and memory on tab switch
**Resolution notes:**
> _(fill in after fixing)_

---

### 2.3 `[ ]` Increase scrollEventThrottle from 8 to 16

**Problem:** Both history screens fire **125 scroll events per second** across the JS bridge.

**Files:**
- `src/screens/UserServiceHistoryScreen.jsx` (line ~1046)
- `src/screens/ProviderServiceHistoryScreen.jsx` (line ~1081)

**Fix:** Change `scrollEventThrottle={8}` to `scrollEventThrottle={16}` (matches 60fps — one event per frame).

**Effort:** 5 minutes (2 line changes)
**Impact:** HIGH — halves JS bridge crossings during scroll
**Resolution notes:**
> _(fill in after fixing)_

---

## 3. Critical Fixes — App-Wide Re-Renders

These cause performance problems across the ENTIRE app, not just tabs.

### 3.1 `[ ]` Memoize AppContext Value Object

**Problem:** `src/context/AppContext.js` (lines ~276-350) creates a new context value object on every render. The value contains 20+ properties (isAuthenticated, user, profile, userType, etc.). Every state change in AppContext causes ALL consumers across the entire app to re-render — every screen, every component using `useApp()`.

**File:** `src/context/AppContext.js`

**Current (approximately):**
```javascript
const value = {
  isAuthenticated,
  isAuthLoading,
  user,
  userType,
  profile,
  // ... 20+ more values
  refreshProfile,
  login,
  logout,
  // ... functions
};

return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
```

**Fix:** Wrap in `useMemo`:
```javascript
const value = useMemo(() => ({
  isAuthenticated,
  isAuthLoading,
  user,
  userType,
  profile,
  // ... all values
  refreshProfile,
  login,
  logout,
  // ... all functions
}), [
  isAuthenticated,
  isAuthLoading,
  user,
  userType,
  profile,
  // ... all dependencies
  refreshProfile,
  login,
  logout,
]);

return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
```

**Also ensure:** All functions in the value (refreshProfile, login, logout, etc.) are wrapped in `useCallback` so the useMemo dependency array doesn't break.

**Effort:** 1-2 hours (need to audit all dependencies)
**Impact:** CRITICAL — prevents cascading re-renders across the entire app on any context state change
**Resolution notes:**
> _(fill in after fixing)_

---

### 3.2 `[ ]` Memoize TabIcon Component in RootNavigator

**Problem:** The TabIcon component in `navigation/RootNavigator.jsx` re-renders on every parent update. It receives profile picture URLs that are recalculated on every render, causing the tab bar icons (including profile avatar images) to re-render unnecessarily.

**File:** `navigation/RootNavigator.jsx` (lines ~223-224, 314-315)

**Fix:**
```javascript
// Memoize profile picture URL
const profilePicture = useMemo(
  () => profile?.profilePicture || user?.profilePicture,
  [profile?.profilePicture, user?.profilePicture]
);

// If TabIcon is a separate component, wrap it in React.memo
const TabIcon = React.memo(({ routeName, focused, profilePicture }) => {
  // ... icon rendering
});
```

**Effort:** 15 minutes
**Impact:** MEDIUM — prevents tab bar re-renders on every context change
**Resolution notes:**
> _(fill in after fixing)_

---

### 3.3 `[ ]` UserHomeScreen Has Too Many Individual useState Calls

**Problem:** `src/screens/UserHomeScreen.jsx` (lines ~327-340) has 15+ individual `useState` calls for related state. Each `setState` triggers a separate re-render. When multiple are called in sequence (e.g., during service creation flow), the screen re-renders 5-10 times in rapid succession.

**File:** `src/screens/UserHomeScreen.jsx`

**Current:**
```javascript
const [isDrawerOpen, setIsDrawerOpen] = useState(false);
const [step, setStep] = useState('select');
const [selectedService, setSelectedService] = useState(null);
const [selectedDateTime, setSelectedDateTime] = useState(null);
const [serviceLocation, setServiceLocation] = useState(null);
const [serviceDescription, setServiceDescription] = useState('');
const [createdRequest, setCreatedRequest] = useState(null);
const [providers, setProviders] = useState([]);
const [searchRadius, setSearchRadius] = useState(0);
const [creatingRequest, setCreatingRequest] = useState(false);
const [fetchingProviders, setFetchingProviders] = useState(false);
const [bookingProvider, setBookingProvider] = useState(null);
const [allProvidersRejected, setAllProvidersRejected] = useState(false);
// ... more
```

**Fix:** Consolidate related state into `useReducer`:
```javascript
const initialState = {
  step: 'select',
  selectedService: null,
  selectedDateTime: null,
  serviceLocation: null,
  serviceDescription: '',
  createdRequest: null,
  providers: [],
  searchRadius: 0,
  creatingRequest: false,
  fetchingProviders: false,
  bookingProvider: null,
  allProvidersRejected: false,
};

const [state, dispatch] = useReducer(serviceRequestReducer, initialState);
```

This batches all state updates into a single re-render per dispatch.

**Effort:** 2-3 hours (refactor, but high payoff)
**Impact:** MEDIUM-HIGH — reduces re-renders during the service booking flow
**Resolution notes:**
> _(fill in after fixing)_

---

## 4. Important Fixes — Background Waste

### 4.1 `[ ]` Move Socket Listeners into useFocusEffect

**Problem:** Socket listeners registered on mount (useEffect) stay active even when the tab is not focused. `freezeOnBlur` freezes renders but does NOT stop socket callbacks. One socket event triggers API calls from ALL mounted tabs simultaneously.

**Files:**
- `src/screens/ProviderHomeScreen.jsx` (lines ~866-878) — 4 socket listeners
- `src/screens/UserServiceHistoryScreen.jsx` (lines ~776-784) — 4 socket listeners
- `src/screens/ProviderServiceHistoryScreen.jsx` — similar pattern

**Fix:** Move from `useEffect` to `useFocusEffect`:
```javascript
useFocusEffect(
  useCallback(() => {
    socketService.on('request:accepted', handleRefresh);
    socketService.on('request:completed', handleRefresh);
    socketService.on('request:status', handleRefresh);
    socketService.on('provider:assigned', handleRefresh);
    return () => {
      socketService.off('request:accepted', handleRefresh);
      socketService.off('request:completed', handleRefresh);
      socketService.off('request:status', handleRefresh);
      socketService.off('provider:assigned', handleRefresh);
    };
  }, [handleRefresh])
);
```

**Important:** `handleRefresh` must be wrapped in `useCallback`.

**Effort:** 1 hour
**Impact:** MEDIUM-HIGH — prevents cascading API calls from background tabs
**Resolution notes:**
> _(fill in after fixing)_

---

### 4.2 `[ ]` Stop Pulsing Animation on Tab Blur

**Problem:** `ProviderHomeScreen.jsx` (lines ~136-197) runs an `Animated.loop()` continuously. `freezeOnBlur` does NOT stop running Animated loops — the animation keeps ticking on the JS thread even when the user is on another tab.

**File:** `src/screens/ProviderHomeScreen.jsx`

**Fix:** Use `useFocusEffect` and stop on cleanup:
```javascript
useFocusEffect(
  useCallback(() => {
    let anim;
    if (isOnline) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      );
      anim.start();
    }
    return () => {
      if (anim) anim.stop();
      pulseAnim.setValue(0);
    };
  }, [isOnline])
);
```

**Effort:** 15 minutes
**Impact:** MEDIUM — frees JS thread when Home tab is not active
**Resolution notes:**
> _(fill in after fixing)_

---

### 4.3 `[ ]` Clean Up setInterval on Tab Blur

**Problem:** History screens set up a 30-second `setInterval` for auto-refresh on mount. This keeps firing when the user is on a different tab.

**Files:**
- `src/screens/UserServiceHistoryScreen.jsx` (lines ~760-790)
- `src/screens/ProviderServiceHistoryScreen.jsx` (lines ~703-709)

**Fix:** Move interval into `useFocusEffect`:
```javascript
useFocusEffect(
  useCallback(() => {
    const interval = setInterval(() => debouncedRefresh(), 30000);
    return () => clearInterval(interval);
  }, [debouncedRefresh])
);
```

**Effort:** 30 minutes
**Impact:** MEDIUM — stops unnecessary background API polling
**Resolution notes:**
> _(fill in after fixing)_

---

### 4.4 `[ ]` LocationSharingContext Has Multiple Always-Running Intervals

**Problem:** `src/context/LocationSharingContext.jsx` runs a 30-second health check interval and a 60-second resync interval continuously, even when no active location sharing session exists.

**File:** `src/context/LocationSharingContext.jsx`

**Fix:** Only start intervals when there is an active sharing session. Clear them when sharing stops.

**Effort:** 30 minutes
**Impact:** MEDIUM — reduces background CPU and network usage
**Resolution notes:**
> _(fill in after fixing)_

---

## 5. Important Fixes — List & Component Performance

### 5.1 `[ ]` Wrap RequestCard in React.memo

**Problem:** The `RequestCard` component in both history screens is NOT wrapped in `React.memo()`. It contains heavy JSX (animations, SVG backgrounds, conditional rendering). On a list with 20-50 items, ANY parent state change causes ALL visible cards to re-render.

**Files:**
- RequestCard in `src/screens/UserServiceHistoryScreen.jsx` (lines ~159-290)
- RequestCard in `src/screens/ProviderServiceHistoryScreen.jsx`

**Fix:**
```javascript
const RequestCard = React.memo(({ request, onPress, onCancel, ... }) => {
  // ... existing component code
}, (prevProps, nextProps) => {
  return prevProps.request._id === nextProps.request._id &&
         prevProps.request.status === nextProps.request.status &&
         prevProps.ratingStatus === nextProps.ratingStatus;
});
```

**Effort:** 30 minutes
**Impact:** HIGH — eliminates unnecessary re-renders of all list items
**Resolution notes:**
> _(fill in after fixing)_

---

### 5.2 `[ ]` Replace Inline Functions in FlatList renderItem

**Problem:** Inline arrow functions in `renderItem` create new function references on every render, which breaks `React.memo` on child components (even if you add it per 5.1).

**Files:**
- `src/screens/UserServiceHistoryScreen.jsx` (lines ~1062-1074)
- `src/screens/ProviderServiceHistoryScreen.jsx`

**Current:**
```javascript
renderItem={({ item }) => (
  <RequestCard
    onPress={() => handleViewDetails(item)}    // NEW function every render
    onCancel={() => handleCancel(item)}         // NEW function every render
    onCallProvider={() => handleCallProvider(item)}
  />
)}
```

**Fix:** Extract `renderItem` as a `useCallback` and use item ID for callbacks:
```javascript
const handleViewDetails = useCallback((item) => {
  navigation.navigate('Details', { id: item._id });
}, [navigation]);

const renderItem = useCallback(({ item }) => (
  <RequestCard
    request={item}
    onPress={handleViewDetails}
    onCancel={handleCancel}
    onCallProvider={handleCallProvider}
  />
), [handleViewDetails, handleCancel, handleCallProvider]);
```

Then inside `RequestCard`, call `onPress(request)` instead of relying on the closure.

**Effort:** 1 hour
**Impact:** HIGH — makes React.memo actually work on list items
**Resolution notes:**
> _(fill in after fixing)_

---

### 5.3 `[ ]` Memoize StatPill SVG Component in History Screens

**Problem:** The `StatPill` component renders inline SVG graphics in the FlatList header. It re-creates the SVG on every parent re-render (API refresh, socket event, pull-to-refresh).

**File:** `src/screens/UserServiceHistoryScreen.jsx` (lines ~143-156)

**Fix:** Wrap in `React.memo`:
```javascript
const StatPill = React.memo(({ value, label, color, bgColor }) => (
  <View style={[styles.statPill, { backgroundColor: bgColor }]}>
    <View style={styles.statSvgBg}>
      <Svg ...>
        {/* SVG content */}
      </Svg>
    </View>
    {/* value/label */}
  </View>
));
```

**Effort:** 10 minutes
**Impact:** LOW-MEDIUM — prevents SVG re-creation on list refreshes
**Resolution notes:**
> _(fill in after fixing)_

---

### 5.4 `[ ]` Memoize DateTimePicker Generated Options

**Problem:** `src/components/DateTimePicker.jsx` generates 14+ quick date options and 32 time slots on every render without memoization.

**File:** `src/components/DateTimePicker.jsx`

**Fix:**
```javascript
const quickDateOptions = useMemo(() => generateQuickDateOptions(), []);
const timeSlots = useMemo(() => generateTimeSlots(), []);
```

**Effort:** 10 minutes
**Impact:** LOW-MEDIUM — prevents recalculation of static data on every render
**Resolution notes:**
> _(fill in after fixing)_

---

### 5.5 `[ ]` Add keyExtractor to All FlatLists

**Problem:** FlatLists without explicit `keyExtractor` fall back to array index as key, causing full re-renders on data changes.

**Files to check:** All screens with FlatList/Animated.FlatList.

**Fix:**
```javascript
keyExtractor={useCallback((item) => item._id?.toString(), [])}
```

**Effort:** 15 minutes
**Impact:** LOW — ensures efficient list diffing
**Resolution notes:**
> _(fill in after fixing)_

---

## 6. Important Fixes — Image & Asset Performance

### 6.1 `[ ]` Install and Use react-native-fast-image for All Network Images

**Problem:** The app uses React Native's built-in `Image` component for all network images (profile pictures, provider avatars, etc.). The built-in `Image` has NO disk caching on Android — images re-download on every mount, every app restart, and every list scroll that recycles a cell.

**Affected areas:**
- `src/screens/UserHomeScreen.jsx` — provider avatar images in list (10-20 per screen)
- `src/screens/ProfileScreen.jsx` — profile picture
- `src/components/GlobalBanner.jsx` — person picture
- `src/components/DrawerMenu.jsx` — profile picture + footer logo
- `navigation/RootNavigator.jsx` — profile picture in tab bar
- All modal components showing avatars

**Fix:**
```bash
npm install react-native-fast-image
cd ios && pod install  # iOS only
```

Replace:
```javascript
<Image source={{ uri: profileUrl }} style={styles.avatar} />
```

With:
```javascript
import FastImage from 'react-native-fast-image';

<FastImage
  source={{ uri: profileUrl, priority: FastImage.priority.normal }}
  style={styles.avatar}
  resizeMode={FastImage.resizeMode.cover}
/>
```

**Effort:** 2-3 hours (replace across all files)
**Impact:** MEDIUM-HIGH — eliminates image re-downloads, reduces network traffic, smoother list scrolling
**Resolution notes:**
> _(fill in after fixing)_

---

### 6.2 `[ ]` Optimize fixhomi_logo.jpg Asset Size

**Problem:** `src/assets/fixhomi_logo.jpg` is **186KB**. If loaded via `require()`, it gets embedded in the JS bundle. This adds to startup parse time and memory.

**File:** `src/assets/fixhomi_logo.jpg`

**Fix options:**
- **Option A:** Compress to <50KB using TinyPNG or similar (maintain visual quality)
- **Option B:** Convert to WebP format (30-50% smaller than JPEG at same quality)
- **Option C:** Load from CDN/Cloudinary instead of bundling

**Effort:** 15 minutes
**Impact:** LOW-MEDIUM — reduces bundle parse time and memory
**Resolution notes:**
> _(fill in after fixing)_

---

### 6.3 `[ ]` Add Cloudinary Image Transformations for Thumbnails

**Problem:** Profile pictures and provider avatars are loaded at full resolution from Cloudinary, even when displayed at 26x26px or 40x40px. A 1MB profile photo is downloaded for a tiny avatar.

**Files:** All screens that display `profilePicture.url` from Cloudinary.

**Fix:** Add Cloudinary URL transformations:
```javascript
const getThumbnail = (url, size = 80) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/w_${size},h_${size},c_fill,f_auto,q_auto/`);
};

// Usage
<FastImage source={{ uri: getThumbnail(provider.profilePicture?.url, 80) }} />
```

This tells Cloudinary to resize server-side before sending. A 26x26 avatar fetches ~2KB instead of ~500KB.

**Effort:** 1 hour (create helper + apply across screens)
**Impact:** MEDIUM-HIGH — massive reduction in network transfer and image decode time
**Resolution notes:**
> _(fill in after fixing)_

---

## 7. Important Fixes — Network & Data Fetching

### 7.1 `[ ]` History Screen Fetches 500 Records for Stats

**Problem:** `UserServiceHistoryScreen.jsx` (lines ~660-688) fetches up to 500 records just to calculate stats (Total, Active, Done counts). Each record includes nested provider details, location, etc. — potentially a 1MB+ payload.

**File:** `src/screens/UserServiceHistoryScreen.jsx`

**Current:**
```javascript
if ((traditionalResult.count || 0) > PAGE_SIZE) {
  getUserRequests(userId, { limit: 500, page: 1 }).then(allResult => {
    // ... stats calculation from 500 full objects
  });
}
```

**Fix options:**
- **Option A (frontend):** Only fetch stats counts, not full objects. Add a lightweight backend endpoint that returns `{ total, pending, active, completed, cancelled }`.
- **Option B (quick):** Calculate stats from the count returned by the paginated API, not by fetching all records. The backend already returns `count` in the response.

**Effort:** Option B: 30 minutes. Option A: 1-2 hours (needs backend endpoint).
**Impact:** MEDIUM-HIGH — eliminates large payload on history screen mount
**Resolution notes:**
> _(fill in after fixing)_

---

### 7.2 `[ ]` Rating Status Check Fires N API Calls for N Completed Requests

**Problem:** `UserServiceHistoryScreen.jsx` (lines ~713-726) calls `checkRatingStatus()` for every completed request in the list. If 50 requests are completed, 50 parallel API calls fire.

**File:** `src/screens/UserServiceHistoryScreen.jsx`

**Current:**
```javascript
const completed = allRequests.filter(r => r.status === 'completed');
await Promise.all(completed.map(async (req) => {
  statuses[req._id] = await checkRatingStatus(req._id); // Individual API call per request
}));
```

**Fix options:**
- **Option A (backend):** Add a batch endpoint: `POST /api/ratings/check-batch` that accepts an array of request IDs and returns all statuses in one call.
- **Option B (quick):** Cache rating statuses in AsyncStorage so they don't re-fetch on every mount. Once a request is rated, its status never changes.

**Effort:** Option B: 1 hour. Option A: 2-3 hours (needs backend work).
**Impact:** MEDIUM — eliminates N API calls on history screen, especially for active users
**Resolution notes:**
> _(fill in after fixing)_

---

### 7.3 `[ ]` Duplicate Profile Fetches on Cold Start

**Problem:** `AppContext.js` has a stale-while-revalidate pattern with `profileLastFetched` ref, but on cold start (`profile` is null), multiple screens independently call `refreshProfile()` before the first fetch completes. Result: 2-3 duplicate profile API calls.

**File:** `src/context/AppContext.js`

**Fix:** Add an in-flight promise guard:
```javascript
const profileFetchPromise = useRef(null);

const refreshProfile = useCallback(async (force = false) => {
  // If already fetching, return the existing promise
  if (profileFetchPromise.current) return profileFetchPromise.current;

  if (!force && profile && (Date.now() - profileLastFetched.current) < STALE_THRESHOLD) {
    return profile;
  }

  profileFetchPromise.current = fetchProfileFromAPI()
    .finally(() => { profileFetchPromise.current = null; });

  return profileFetchPromise.current;
}, [profile]);
```

**Effort:** 30 minutes
**Impact:** LOW-MEDIUM — eliminates duplicate API calls on app startup
**Resolution notes:**
> _(fill in after fixing)_

---

### 7.4 `[ ]` Socket Reconnection Re-subscribes Without Deduplication Guard

**Problem:** `src/services/socketService.js` (lines ~91-109) re-subscribes to all rooms on reconnect. If `subscribedRooms` and `activeTrackingRequests` overlap, duplicate `request:subscribe` events fire for the same request IDs.

**File:** `src/services/socketService.js`

**Fix:** Deduplicate room IDs before re-subscribing:
```javascript
socket.on('connect', () => {
  const allRooms = new Set([...subscribedRooms, ...activeTrackingRequests.keys()]);
  allRooms.forEach((requestId) => {
    socket.emit('request:subscribe', { requestId });
  });
});
```

**Effort:** 15 minutes
**Impact:** LOW — prevents duplicate socket subscriptions on reconnect
**Resolution notes:**
> _(fill in after fixing)_

---

## 8. Android-Specific Rendering Fixes

### 8.1 `[ ]` Add overflow: 'hidden' to All Rounded Corner Views

**Problem:** On Android, views with `borderRadius` but without `overflow: 'hidden'` cause the GPU to render content outside the rounded corners. This is called "GPU overdraw" — invisible pixels that the GPU still processes. On screens with many rounded elements (avatar rings, cards, buttons), this compounds into visible jank.

**Affected components (examples):**
- Avatar ring views in provider cards (`UserHomeScreen.jsx`, list items)
- RequestCard containers in history screens
- Button components with borderRadius
- Modal containers

**Fix:** Add `overflow: 'hidden'` to all styles that have `borderRadius`:
```javascript
providerAvatarRing: {
  width: 26,
  height: 26,
  borderRadius: 13,
  borderWidth: 1.5,
  overflow: 'hidden',  // ADD THIS
},
```

**How to find all instances:**
Search for `borderRadius` in all `.jsx` and `.js` files. For each, verify `overflow: 'hidden'` is present. Add it where missing.

**Effort:** 1-2 hours (many files, but mechanical changes)
**Impact:** MEDIUM — reduces GPU overdraw on Android, smoother scrolling
**Resolution notes:**
> _(fill in after fixing)_

---

### 8.2 `[ ]` Migrate Inline Styles to StyleSheet.create

**Problem:** The codebase has ~86 inline styles (`style={{ ... }}`) vs ~31 `StyleSheet.create()` usages — a 74% inline ratio. Every inline style object creates a new JavaScript object on every render. React Native cannot optimize or cache these. On Android, this causes extra work on both the JS thread (object creation) and the native thread (style recalculation).

**Worst offenders (check these first):**
- Components inside FlatList `renderItem` — inline styles here multiply by list length
- Components inside `map()` loops
- Frequently re-rendered components (anything consuming context)

**Fix:** Move inline styles to `StyleSheet.create()` at the bottom of each file. For dynamic values, use array syntax:
```javascript
// Before (new object every render):
<View style={{ backgroundColor: isActive ? '#10B981' : '#ccc', borderRadius: 8 }}>

// After (cached + dynamic):
<View style={[styles.statusBadge, isActive && styles.statusBadgeActive]}>

// In StyleSheet:
const styles = StyleSheet.create({
  statusBadge: { borderRadius: 8, backgroundColor: '#ccc' },
  statusBadgeActive: { backgroundColor: '#10B981' },
});
```

**Effort:** 3-4 hours (many files, do incrementally — prioritize list items and frequently rendered components first)
**Impact:** MEDIUM — reduces JS object creation and native style recalculation
**Resolution notes:**
> _(fill in after fixing)_

---

### 8.3 `[ ]` Avoid Combining elevation and shadow Styles

**Problem:** Some components use both iOS `shadow*` properties and Android `elevation` together. While `Platform.select` separates them correctly in `RootNavigator.jsx`, verify this pattern is consistent across all components. Using both on Android (shadow + elevation) is expensive.

**File to verify:** `navigation/RootNavigator.jsx` (lines ~204-214) — this one is correct. Check other components.

**Pattern that's correct:**
```javascript
...Platform.select({
  ios: { shadowColor: '#000', shadowOffset: {...}, shadowOpacity: 0.06, shadowRadius: 8 },
  android: { elevation: 12 },
})
```

**Pattern that's problematic (if found):**
```javascript
// Both on all platforms — expensive on Android:
{ shadowColor: '#000', shadowOpacity: 0.1, elevation: 5 }
```

**Effort:** 30 minutes (audit + fix)
**Impact:** LOW-MEDIUM — reduces Android GPU work for shadowed views
**Resolution notes:**
> _(fill in after fixing)_

---

## 9. Startup & Bundle Optimization

### 9.1 `[ ]` Replace App-Level SplashScreen with Native Splash

**Problem:** The splash screen is implemented as a React component (`src/components/SplashScreen.jsx`), not a native splash screen. This means:
1. User sees a blank white screen while the JS bundle loads (300-1500ms depending on Hermes/JSC)
2. Then React mounts and renders the SplashScreen component (another 500-1000ms of animation)
3. Total: 1-3 seconds of blank screen before anything is visible

A native splash screen shows instantly (from the first frame the app opens).

**File:** `src/components/SplashScreen.jsx`

**Fix:** Add `react-native-bootsplash` (or `expo-splash-screen` if using Expo):
```bash
npm install react-native-bootsplash
```

This renders a native XML layout (Android) / Storyboard (iOS) that shows instantly while JS loads. The React SplashScreen component can remain as a transition animation after the native splash.

**Effort:** 2-3 hours (native config for both platforms)
**Impact:** HIGH — eliminates the blank screen on cold start, perceived startup is instant
**Resolution notes:**
> _(fill in after fixing)_

---

### 9.2 `[ ]` Verify Hermes Engine is Enabled

**Problem:** Hermes provides 20-40% faster startup and 30% smaller bundle than JSC. The Android build config references `hermesEnabled` but it needs verification.

**File:** `android/app/build.gradle` (line ~136-140)

**Check:** Run this in the app:
```javascript
const isHermes = () => !!global.HermesInternal;
console.log('Hermes enabled:', isHermes());
```

If Hermes is NOT enabled, enable it in `android/gradle.properties`:
```properties
hermesEnabled=true
```

**Effort:** 15 minutes to verify, 30 minutes if needs enabling + rebuild
**Impact:** HIGH — significantly faster app startup on Android
**Resolution notes:**
> _(fill in after fixing)_

---

### 9.3 `[ ]` Audit Duplicate Map Libraries

**Problem:** `package.json` includes BOTH:
- `@rnmapbox/maps` (v10.1.42) — Mapbox GL (~15MB uncompressed)
- `react-native-maps` (v1.26.1) — Google Maps

Both compile into the bundle. If only one is actually used, the other adds ~5-15MB to the APK for nothing.

**Fix:** Check which map library is actually imported in the codebase. Remove the unused one.

**How to check:**
```bash
# Search for Mapbox imports
grep -r "rnmapbox/maps" src/
# Search for react-native-maps imports
grep -r "react-native-maps" src/
```

**Effort:** 30 minutes
**Impact:** MEDIUM — reduces APK size by 5-15MB if one is unused
**Resolution notes:**
> _(fill in after fixing)_

---

### 9.4 `[ ]` Add console.log Removal for Production Builds

**Problem:** Hundreds of `console.log` statements throughout the codebase. In production, these still execute — serializing objects and crossing the JS bridge. On Android, this adds measurable overhead.

**Fix:** Add `babel-plugin-transform-remove-console` to production builds:
```bash
npm install --save-dev babel-plugin-transform-remove-console
```

In `babel.config.js`:
```javascript
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    production: {
      plugins: ['transform-remove-console'],
    },
  },
};
```

**Effort:** 15 minutes
**Impact:** MEDIUM — removes all console.log overhead in release builds
**Resolution notes:**
> _(fill in after fixing)_

---

## 10. Minor Fixes & Polish

### 10.1 `[ ]` Memoize DrawerMenu Menu Items

**Problem:** `src/components/DrawerMenu.jsx` uses `useMemo` for `menuItems` but the dependency includes `t()` from LanguageContext. Every language context change (even if language doesn't change) recreates 8+ AnimatedMenuItem components.

**Fix:** Ensure `t` function reference is stable in LanguageContext, or extract menu item labels into a separate memoized array.

**Effort:** 20 minutes
**Impact:** LOW
**Resolution notes:**
> _(fill in after fixing)_

---

### 10.2 `[ ]` Modal Components Memoize Callbacks

**Problem:** Modal components like `AppleEmailCollectionModal`, `CancellationReasonModal`, and `AadhaarVerificationModal` have event handlers (`handleSendOtp`, `handleResendOtp`, `handleVerifyOtp`) that are not wrapped in `useCallback`.

**Fix:** Wrap all modal handlers in `useCallback`.

**Effort:** 1 hour (across all modals)
**Impact:** LOW — modals render less frequently, but good practice
**Resolution notes:**
> _(fill in after fixing)_

---

### 10.3 `[ ]` LiveTrackingScreen GPS Polling is Too Aggressive

**Problem:** `src/screens/LiveTrackingScreen.jsx` polls GPS at 2-second intervals. For a tracking screen that shows a provider moving on a map, 5-10 second intervals are sufficient and reduce battery drain + CPU usage.

**File:** `src/screens/LiveTrackingScreen.jsx`

**Fix:** Increase polling interval to 5-10 seconds. Also ensure polling stops when the screen is not focused or the app is backgrounded.

**Effort:** 15 minutes
**Impact:** LOW — reduces battery drain on tracking screen
**Resolution notes:**
> _(fill in after fixing)_

---

### 10.4 `[ ]` Duplicate Location Delivery (Socket.IO + HTTP)

**Problem:** `src/services/backgroundLocationService.js` has `autoSync: true` and `batchSync: false`, meaning every location update is POSTed via HTTP immediately. But the main app also sends location via Socket.IO. The backend receives and processes both, even though only one is needed.

**File:** `src/services/backgroundLocationService.js`

**Fix:** When the app is in the foreground and Socket.IO is connected, disable HTTP autoSync. Only use HTTP for background location when the socket is disconnected.

**Effort:** 30 minutes
**Impact:** LOW — reduces duplicate network traffic
**Resolution notes:**
> _(fill in after fixing)_

---

## 11. What NOT to Change (Already Good)

These are already well-implemented. Do not refactor:

- **Tab navigator config** — `freezeOnBlur: true`, `animation: 'none'`, no ripple. Correct.
- **LocationContext** — properly memoized with `useMemo()`, smart 2-stage GPS, 10s reverse geocode throttle
- **DialogContext** — lightweight, minimal re-render surface
- **ProGuard/R8** — enabled for release builds, 135-line config preserving native modules correctly
- **Socket.IO service** — reconnection handling, room management, listener registry pattern
- **Cloudinary signed uploads** — files never touch the device's JS thread
- **useNativeDriver: true** — consistently used across animations (offloads to native thread)
- **Firebase Crashlytics** — properly configured with mapping upload disabled for privacy

---

## 12. Testing Checklist

After applying fixes, test on an **Android APK (release build)** — not debug:

```bash
cd android && ./gradlew assembleRelease
```

### Tab Navigation
- `[ ]` Tap Home → History → Home rapidly (5+ times) — no lag or stutter
- `[ ]` Tap each tab in sequence (Home → History → Settings → Profile → Home) — smooth
- `[ ]` On History tab, scroll a long list, then switch to Home — no freeze
- `[ ]` Leave app in background 1 min, return, switch tabs — still smooth
- `[ ]` Provider online (pulsing dot), switch to History and back — no jank

### Data Loading
- `[ ]` Data still loads correctly after InteractionManager changes (no missing data)
- `[ ]` Socket events still update the correct screen when focused
- `[ ]` Pull-to-refresh works on all list screens
- `[ ]` Rating status loads correctly on history screen

### Scrolling
- `[ ]` Scroll long history list (20+ items) — no jank or dropped frames
- `[ ]` Fast scroll + stop — no blank cells visible
- `[ ]` Scroll header collapse/expand animation is smooth

### Images
- `[ ]` Profile pictures load on first visit and are cached on revisit (if FastImage added)
- `[ ]` Provider avatars in lists don't flicker during scroll
- `[ ]` Tab bar profile icon doesn't flicker on context changes

### Startup
- `[ ]` Cold start shows splash instantly (if native splash added)
- `[ ]` No blank white screen before app content appears
- `[ ]` Verify Hermes is enabled: `global.HermesInternal` is truthy

### General
- `[ ]` Test on mid-range Android (not flagship) — acceptable performance
- `[ ]` No memory warnings after 10+ minutes of use
- `[ ]` Background battery usage is reasonable

---

## 13. Resolution Log

| Date | Item | What Was Done | Verified On Device |
|------|------|---------------|--------------------|
| — | — | — | — |

---

## 14. Priority Order

### Phase 1 — Eliminate Tab Lag (50 minutes)
1. [2.1](#21----wrap-all-tab-focus-fetches-in-interactionmanager) — InteractionManager on focus fetches (30 min)
2. [2.2](#22----add-flatlist-performance-props-to-history-screens) — FlatList optimization props (15 min)
3. [2.3](#23----increase-scrolleventthrottle-from-8-to-16) — Scroll throttle fix (5 min)

### Phase 2 — Fix App-Wide Re-Renders (2-3 hours)
4. [3.1](#31----memoize-appcontext-value-object) — Memoize AppContext value (1-2 hr)
5. [5.1](#51----wrap-requestcard-in-reactmemo) — Memoize RequestCard (30 min)
6. [5.2](#52----replace-inline-functions-in-flatlist-renderitem) — Fix inline functions in renderItem (1 hr)
7. [3.2](#32----memoize-tabicon-component-in-rootnavigator) — Memoize TabIcon (15 min)

### Phase 3 — Stop Background Waste (2 hours)
8. [4.1](#41----move-socket-listeners-into-usefocuseffect) — Socket listeners to useFocusEffect (1 hr)
9. [4.2](#42----stop-pulsing-animation-on-tab-blur) — Stop animation on blur (15 min)
10. [4.3](#43----clean-up-setinterval-on-tab-blur) — Clean up intervals on blur (30 min)
11. [4.4](#44----locationsharingcontext-has-multiple-always-running-intervals) — LocationSharing intervals (30 min)

### Phase 4 — Image Performance (3-4 hours)
12. [6.1](#61----install-and-use-react-native-fast-image-for-all-network-images) — Install FastImage (2-3 hr)
13. [6.3](#63----add-cloudinary-image-transformations-for-thumbnails) — Cloudinary thumbnails (1 hr)
14. [6.2](#62----optimize-fixhomi_logojpg-asset-size) — Optimize logo asset (15 min)

### Phase 5 — Network Optimization (2-3 hours)
15. [7.1](#71----history-screen-fetches-500-records-for-stats) — Fix 500-record fetch (30 min - 2 hr)
16. [7.2](#72----rating-status-check-fires-n-api-calls-for-n-completed-requests) — Batch rating checks (1-2 hr)
17. [7.3](#73----duplicate-profile-fetches-on-cold-start) — Deduplicate profile fetch (30 min)
18. [7.4](#74----socket-reconnection-re-subscribes-without-deduplication-guard) — Socket reconnect dedup (15 min)

### Phase 6 — Android GPU & Rendering (2-3 hours)
19. [8.1](#81----add-overflow-hidden-to-all-rounded-corner-views) — overflow: hidden (1-2 hr)
20. [8.2](#82----migrate-inline-styles-to-stylesheetcreate) — StyleSheet migration (3-4 hr, do incrementally)
21. [8.3](#83----avoid-combining-elevation-and-shadow-styles) — Shadow audit (30 min)

### Phase 7 — Startup & Bundle (3-4 hours)
22. [9.1](#91----replace-app-level-splashscreen-with-native-splash) — Native splash screen (2-3 hr)
23. [9.2](#92----verify-hermes-engine-is-enabled) — Verify Hermes (15 min)
24. [9.3](#93----audit-duplicate-map-libraries) — Remove unused map lib (30 min)
25. [9.4](#94----add-consolelog-removal-for-production-builds) — Remove console.log in prod (15 min)

### Phase 8 — Polish (2 hours)
26. [3.3](#33----userhomescreen-has-too-many-individual-usestate-calls) — useReducer refactor (2-3 hr)
27. [5.3](#53----memoize-statpill-svg-component-in-history-screens) — Memoize StatPill (10 min)
28. [5.4](#54----memoize-datetimepicker-generated-options) — Memoize DateTimePicker (10 min)
29. [5.5](#55----add-keyextractor-to-all-flatlists) — keyExtractor (15 min)
30. [10.1](#101----memoize-drawermenu-menu-items) — DrawerMenu memoize (20 min)
31. [10.2](#102----modal-components-memoize-callbacks) — Modal callbacks (1 hr)
32. [10.3](#103----livetrackingscreen-gps-polling-is-too-aggressive) — GPS polling (15 min)
33. [10.4](#104----duplicate-location-delivery-socketio--http) — Deduplicate location (30 min)
