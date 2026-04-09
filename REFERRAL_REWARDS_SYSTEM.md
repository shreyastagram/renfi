# Fixhomi Referral & Rewards System — Implementation Guide

## Purpose

This document is the single source of truth for building the Referral & Rewards system. Read this at the start of any session to understand what's built, what's pending, and the design decisions.

---

## Finalized Decisions

| Question | Decision |
|----------|----------|
| Where does Refer & Earn live? | Settings screen → "Refer & Earn" section → opens ReferralScreen |
| Referral code input | Optional field at bottom of registration form, pre-filled from deep link |
| Cycle 1 start date | April 1, 2026 (Indian financial year) |
| Cycle schedule | C1: Apr 1 – Jul 31, C2: Aug 1 – Nov 30, C3: Dec 1 – Mar 31 |
| Annual mega prize display | "Exciting prizes" — no specific amount shown |
| Prize distribution | Manual by admin (software shows results, admin handles payment offline) |
| Cross-type referrals | Allowed — user can refer provider and vice versa |
| Leaderboards | SEPARATE — users see user leaderboard, providers see provider leaderboard, admin sees both |
| Who sees Refer & Earn? | Both users AND providers |
| Service completion points | Every completed service = 250 to user + 250 to provider (not tied to referral, general engagement) |
| Server constraints | Render paid plan ($25/mo) — must be efficient, no heavy cron jobs or real-time aggregations |

---

## Business Rules Summary

| Event | Points | When Credited |
|-------|--------|---------------|
| New user registers via referral link | 50 to referrer + 50 to new user | On successful account creation |
| Service completed (any type) | 250 to user (SU) + 250 to provider (SP) | After service completion (post-verification) |

- Applies to ALL service types: traditional, emergency, event
- Both SPs and SUs participate
- Points are non-transferable, cannot be exchanged for cash
- Cross-type referrals allowed (provider can refer a user and vice versa)

### Cycles & Rankings
- **Cycle**: 4 months, aligned to Indian financial year
- **C1**: Apr 1 – Jul 31 | **C2**: Aug 1 – Nov 30 | **C3**: Dec 1 – Mar 31
- At cycle end: cycle leaderboard resets, points carry into yearly competition
- **Cycle prizes**: 1st = Rs5000, 2nd = Rs3000, 3rd = Rs1000
- **Annual prize**: "Exciting prizes" for top yearly performer
- Rankings show masked name only (no personal details)
- **Separate leaderboards**: Users ranked among users, providers among providers

### Fraud Rules
- Self-referral blocked (same email or phone)
- Max 10 referral registrations per referrer per day
- Duplicate accounts blocked (existing email/phone uniqueness checks)
- Admin can manually adjust/deduct points
- Idempotency keys prevent double-crediting on retries

---

## Architecture Overview

### New Files to Create

**Backend** (`noefi/fixhomi-backend/`):
```
models/
  pointsLedger.js          — Append-only point transactions (one doc per event)
  rewardCycle.js           — Cycle definitions + cached leaderboard (top 50 per type)

controllers/
  referralController.js    — Code gen, registration referral, point crediting, leaderboard

routes/
  referralRoutes.js        — All referral API endpoints
```

**Frontend** (`renfi/renfi/src/`):
```
screens/
  ReferralScreen.jsx       — Full Refer & Earn hub (share, stats, leaderboard, history)

services/
  referralService.js       — API calls for referral system
```

**Admin** (`temp_admin/src/`):
```
pages/
  ReferralDashboard.jsx    — Stats, both leaderboards, fraud flags, prize management
```

### Files to Modify (minimal, additive only)

| File | Change |
|------|--------|
| `models/user.js` | Add `referralCode`, `referredBy` fields |
| `models/provider.js` | Add `referralCode`, `referredBy` fields |
| `controllers/authController.js` | Pass `referralCode` to point crediting on register |
| `controllers/googleAuthController.js` | Pass `referralCode` on Google/Apple sync |
| `controllers/traditionalServiceController.js` | Call `creditServicePoints()` on completion |
| `controllers/emergencyServicesController.js` | Call `creditServicePoints()` on completion |
| `controllers/eventServicesController.js` | Call `creditServicePoints()` on completion |
| `screens/RegisterScreen.jsx` | Add optional referral code field |
| `screens/ProviderRegisterScreen.jsx` | Add optional referral code field |
| `screens/SettingsScreen.jsx` | Add "Refer & Earn" ActionRow |
| `navigation/RootNavigator.jsx` | Add ReferralScreen + deep link for `ref/:code` |
| `App.tsx` | Handle referral deep link → store code in AsyncStorage |
| `temp_admin/src/App.jsx` | Add ReferralDashboard route |
| `temp_admin/src/components/Layout.jsx` | Add sidebar link |

---

## Database Design

### 1. User/Provider Model Additions (embedded, no new collection)

```javascript
// Add to BOTH user.js and provider.js:
referralCode: {
  type: String,
  unique: true,
  sparse: true,       // Allows null for existing users
  index: true,
  maxlength: 12
},
referredBy: {
  code: String,
  referrerId: mongoose.Schema.Types.Mixed,
  referrerType: { type: String, enum: ['user', 'provider'] },
  registeredAt: Date,
  pointsCredited: { type: Boolean, default: false }
}
```

**Code format**: `FX` + 3 uppercase name chars + 5 random alphanumeric = `FXSHR8K2M4`
- 36^5 = ~60M combinations per 3-char prefix
- URL-safe, human-readable, short enough to type manually

### 2. Points Ledger (`pointsLedger.js`) — Append-Only, No Updates

```javascript
{
  userId: Mixed,         // Who earned points
  userType: 'user' | 'provider',
  type: 'referral_bonus' | 'referral_welcome' | 'service_completion' | 'admin_adjustment',
  points: Number,        // Always positive
  referenceId: String,   // requestId or referralCode
  referenceType: String, // 'traditional_service' | 'emergency_service' | 'event_service' | 'referral' | 'admin'
  description: String,   // "Service completed: Electrician repair"
  cycleId: String,       // "2026-C1"
  idempotencyKey: String // Unique, prevents doubles
}
```

**Indexes** (all compound for efficiency):
- `{ cycleId: 1, userType: 1, userId: 1 }` — user's cycle balance
- `{ userId: 1, createdAt: -1 }` — user's history (paginated)
- `{ idempotencyKey: 1 }` — unique, sparse

### 3. Reward Cycle (`rewardCycle.js`) — Lightweight Cache

```javascript
{
  cycleId: String,       // "2026-C1" (unique)
  year: Number,
  cycleNumber: 1 | 2 | 3,
  startDate: Date,
  endDate: Date,
  status: 'active' | 'completed' | 'upcoming',
  
  // Cached top 50 per user type (refreshed on-demand, NOT via cron)
  userLeaderboard: [{ rank, userId, displayName, totalPoints }],
  providerLeaderboard: [{ rank, userId, displayName, totalPoints }],
  leaderboardUpdatedAt: Date,

  // Winners (set by admin manually)
  userWinners: [{ rank, userId, prize, awardedAt }],
  providerWinners: [{ rank, userId, prize, awardedAt }]
}
```

**No cron job for leaderboard refresh**. Instead:
- Leaderboard refreshes when someone views it AND cache is >5 minutes old
- Single aggregation query, limited to top 50, takes <100ms with proper indexes
- Admin can force refresh

---

## Referral Link Flow — Complete

### Link Format
```
Web:  https://fixhomi.com/ref/FXSHR8K2M4
App:  fixhomi://ref/FXSHR8K2M4
```

### Deep Link Handling (App.tsx)
```
1. App receives deep link: fixhomi://ref/CODE
2. If user is logged in → show toast "You already have an account" → ignore
3. If not logged in → store CODE in AsyncStorage key "pendingReferralCode"
4. User navigates to registration → code auto-fills referral field
5. On successful registration → backend processes code → clear AsyncStorage
```

### Web Redirect (Next.js)
```
1. User clicks https://fixhomi.com/ref/FXSHR8K2M4
2. Next.js page at /app/ref/[code]/page.js renders:
   - Fixhomi branding + "You've been invited!"
   - Referral code displayed prominently: FXSHR8K2M4
   - "Download Fixhomi" → Play Store / App Store buttons
   - "Already have the app?" → tries fixhomi://ref/CODE deep link
3. No cookies needed — code is visible, user types it during registration
```

### Share Message
```
"Join Fixhomi - India's home services app! 🏠

Use my referral code FXSHR8K2M4 to get 50 bonus points when you sign up!

Download now: https://fixhomi.com/ref/FXSHR8K2M4"
```

---

## API Endpoints

### User/Provider Routes (`/api/referral/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/my-code` | authenticateToken | Get or generate referral code |
| GET | `/my-stats` | authenticateToken | Points balance (cycle + yearly) + rank |
| GET | `/my-history?page=1&limit=20` | authenticateToken | Point transactions (paginated) |
| GET | `/my-referrals` | authenticateToken | People I referred (count + list) |
| GET | `/validate-code/:code` | Public | Check if code is valid (registration flow) |
| GET | `/leaderboard/cycle` | authenticateToken | Current cycle top 50 (user or provider based on caller) + my rank |
| GET | `/leaderboard/yearly` | authenticateToken | Yearly top 50 + my rank |
| GET | `/cycle-info` | authenticateToken | Current cycle dates, days remaining |

### Admin Routes (`/api/referral/admin/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dashboard` | authenticateAdmin | Overview stats |
| GET | `/leaderboard/:cycleId/:userType` | authenticateAdmin | Full leaderboard (user or provider) |
| GET | `/user/:userId/history` | authenticateAdmin | User's full point history |
| POST | `/adjust-points` | authenticateAdmin (super) | Manual adjustment with reason |
| POST | `/award-prizes/:cycleId` | authenticateAdmin (super) | Mark winners |
| POST | `/refresh-leaderboard/:cycleId` | authenticateAdmin | Force cache refresh |

---

## Point Crediting Logic

### On Registration (referral)
```
Called from: authController.register / providerRegister / googleAuthController.syncUser / syncProvider
Input: newUserId, newUserType, referralCode

1. If no referralCode → skip (no error)
2. Lookup code in User collection, then Provider collection
3. If not found → skip (registration succeeds without referral)
4. If referrer.email === newUser.email OR referrer.phone === newUser.phone → skip (self-referral)
5. Get current cycleId
6. Insert ledger entry for referrer: 50 points, idempotencyKey = "ref:{newUserId}:referrer"
7. Insert ledger entry for new user: 50 points, idempotencyKey = "ref:{newUserId}:welcome"
8. Update newUser.referredBy = { code, referrerId, referrerType, registeredAt, pointsCredited: true }
9. Send push notification to referrer (async, non-blocking)
```

### On Service Completion
```
Called from: traditionalServiceController / emergencyServicesController / eventServicesController
When: Service status changes to 'completed'
Input: requestId, userId, providerId, serviceCategory

1. Get current cycleId
2. Insert ledger for user: 250 points, idempotencyKey = "svc:{requestId}:user:{userId}"
3. Insert ledger for provider: 250 points, idempotencyKey = "svc:{requestId}:prov:{providerId}"
4. Both inserts use insertOne with unique index — duplicates silently fail (no error thrown)
```

### Cycle Determination
```javascript
function getCurrentCycleId() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  // Financial year: Apr-Jul = C1, Aug-Nov = C2, Dec-Mar = C3
  if (month >= 4 && month <= 7) return `${year}-C1`;
  if (month >= 8 && month <= 11) return `${year}-C2`;
  // Dec-Mar: C3 belongs to the financial year starting previous April
  // Dec 2026 - Mar 2027 = FY 2026-27 = "2026-C3"
  if (month >= 12) return `${year}-C3`;
  return `${year - 1}-C3`; // Jan-Mar belongs to previous year's C3
}
```

---

## Leaderboard Strategy (Server-Efficient)

### No Cron Jobs. Lazy Refresh Only.

```
User requests leaderboard
  → Check rewardCycle.leaderboardUpdatedAt
  → If >5 minutes old OR null:
      → Run aggregation (top 50 for their userType)
      → Save to rewardCycle cache
      → Return cached data
  → If <5 minutes old:
      → Return cached data directly (no DB query)
```

### Aggregation Query (runs at most once per 5 min per userType)

```javascript
PointsLedger.aggregate([
  { $match: { cycleId, userType } },
  { $group: { _id: '$userId', totalPoints: { $sum: '$points' } } },
  { $sort: { totalPoints: -1 } },
  { $limit: 50 }
])
```

With index `{ cycleId: 1, userType: 1, userId: 1 }`, this scans only relevant documents. For 10,000 users with ~50 entries each = 500K docs → aggregation takes <200ms.

### User's Own Rank (always fresh, single-user query)

```javascript
// Fast: aggregates only ONE user's documents
const myPoints = await PointsLedger.aggregate([
  { $match: { cycleId, userId: myId } },
  { $group: { _id: null, total: { $sum: '$points' } } }
]);

// Count users with more points (for rank)
const rank = await PointsLedger.aggregate([
  { $match: { cycleId, userType: myType } },
  { $group: { _id: '$userId', total: { $sum: '$points' } } },
  { $match: { total: { $gt: myPoints } } },
  { $count: 'above' }
]);
// rank = above + 1
```

This is 2 queries but each is fast with the compound index.

---

## Frontend — ReferralScreen.jsx (Modern UI)

### Layout (single scrollable screen with sections)

```
┌─────────────────────────────────┐
│  ← Refer & Earn                 │
├─────────────────────────────────┤
│  ┌─────────────────────────┐    │
│  │  YOUR REFERRAL CODE     │    │
│  │  ┌─────────────────┐   │    │
│  │  │  FXSHR8K2M4     │   │    │  ← Gradient card, tap to copy
│  │  └─────────────────┘   │    │
│  │  [📋 Copy]  [📤 Share] │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌──────┐  ┌──────┐  ┌──────┐  │
│  │ 350  │  │ #12  │  │  7   │  │  ← Stats row
│  │Points│  │ Rank │  │Refs  │  │
│  └──────┘  └──────┘  └──────┘  │
│                                 │
│  Leaderboard           See All >│
│  ┌─────────────────────────┐    │
│  │ 🥇 Shr*** B    1,250   │    │
│  │ 🥈 Ram*** K      980   │    │
│  │ 🥉 Pri*** S      750   │    │
│  │  4  Ank*** P      620   │    │
│  │  5  Vik*** R      500   │    │
│  │ ─── Your Rank ────────  │    │  ← Highlighted row
│  │ 12  You          350   │    │
│  └─────────────────────────┘    │
│                                 │
│  How It Works                   │
│  ┌─────────────────────────┐    │
│  │ 1. Share your code      │    │
│  │ 2. Friend registers     │    │
│  │ 3. Both earn 50 pts     │    │
│  │ 4. Complete services    │    │
│  │    = 250 pts each       │    │
│  └─────────────────────────┘    │
│                                 │
│  Recent Activity                │
│  ┌─────────────────────────┐    │
│  │ +250  Service completed │    │
│  │ +50   Raj joined via..  │    │
│  │ +250  Service completed │    │
│  └─────────────────────────┘    │
│                                 │
│  Cycle: Apr 1 – Jul 31, 2026   │
│  ████████████░░ 67 days left    │
│                                 │
│  Prizes                         │
│  🥇 ₹5,000  🥈 ₹3,000  🥉 ₹1,000│
│  + Exciting annual prizes!      │
└─────────────────────────────────┘
```

### Design System
- Gradient header card (brand blue → purple) for referral code
- Glass-morphism stat cards
- Animated rank indicators (gold/silver/bronze)
- Progress bar for cycle countdown
- Consistent with existing app styling (BRAND.primary = #2563EB)

---

## Admin — ReferralDashboard.jsx

```
┌──────────────────────────────────────────────┐
│  Referral & Rewards Dashboard                │
├──────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐    │
│  │  127 │  │45,200│  │  89  │  │   2  │    │
│  │Refs  │  │Points│  │Active│  │Flags │    │
│  │total │  │issued│  │users │  │fraud │    │
│  └──────┘  └──────┘  └──────┘  └──────┘    │
│                                              │
│  [User Leaderboard] [Provider Leaderboard]   │  ← Tab switch
│  ┌──────────────────────────────────────┐    │
│  │ Rank │ Name          │ Points │ Refs │    │
│  │  1   │ Shreyash B    │ 1,250  │  12  │    │  ← Admin sees real names
│  │  2   │ Ramesh K      │   980  │   8  │    │
│  │  3   │ Priya S       │   750  │   5  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  Cycle: 2026-C1 (Apr 1 – Jul 31)            │
│  [Award Prizes] [Refresh Leaderboard]        │
│                                              │
│  Recent Referrals                            │
│  ┌──────────────────────────────────────┐    │
│  │ Referrer      │ New User   │ Date    │    │
│  │ Shreyash (P)  │ Raj (U)    │ Apr 5   │    │
│  │ Priya (U)     │ Meena (U)  │ Apr 4   │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

---

## Edge Cases — Complete List

### Registration Flow
| Edge Case | Handling |
|-----------|----------|
| Clicks link, app not installed | Web page shows code + store links |
| Clicks link, already logged in | Toast: "You already have an account" |
| Clicks own link | Self-referral check: same email/phone → skip silently |
| Clicks link A then link B | Last code wins (AsyncStorage overwrite) |
| Abandons registration, returns later | Code persists in AsyncStorage |
| Types wrong code manually | "Invalid code" error, can retry or skip |
| Code belongs to deactivated account | "This code is no longer valid" |
| Google/Apple OAuth with referral | AsyncStorage code sent in sync payload |
| Network error during point credit | Registration succeeds; points skipped (try-catch) |
| Same phone registers twice | Existing duplicate prevention handles this |

### Points & Leaderboard
| Edge Case | Handling |
|-----------|----------|
| Double-tap complete service | Idempotency key: unique index on `svc:{requestId}:user:{userId}` |
| Service cancelled after completion | Not possible — completion is final in existing flow |
| Cycle boundary (service completes Apr 30 11:59 PM) | Server timestamp determines cycle |
| User has 0 points | Doesn't appear on leaderboard (only users with >0 points shown) |
| Tie in points | Same rank, ordered by earliest point earned |
| 10,000+ users | Aggregation limited to top 50, cached 5 min, compound index |
| Admin deducts points below 0 | Minimum 0 enforced in aggregation (points always positive in ledger, admin_adjustment can have description "deduction" but is still tracked) |

### Referral Abuse
| Edge Case | Handling |
|-----------|----------|
| Creates fake accounts for referral points | Velocity check: max 10 referrals/day per referrer |
| Same device, multiple accounts | Existing phone/email uniqueness handles this |
| VPN + new email to game system | KYC requirement for prize eligibility |
| Bot creating accounts | Rate limiting on registration endpoint (already exists) |

---

## Implementation Order

### Phase 1: Backend Models & Core Logic
1. `models/pointsLedger.js` — schema + indexes
2. `models/rewardCycle.js` — schema + cycle helpers
3. Add `referralCode` + `referredBy` to User and Provider models
4. `controllers/referralController.js` — code gen, point credit, leaderboard, stats
5. `routes/referralRoutes.js` — all endpoints
6. Seed first cycle document: `2026-C1` (Apr 1 – Jul 31)

### Phase 2: Integration Hooks
7. `authController.js` — pass referralCode on user/provider registration
8. `googleAuthController.js` — pass referralCode on Google/Apple sync
9. `traditionalServiceController.js` — call creditServicePoints on completion
10. `emergencyServicesController.js` — same
11. `eventServicesController.js` — same

### Phase 3: Frontend
12. `services/referralService.js` — API calls
13. `screens/ReferralScreen.jsx` — full Refer & Earn screen
14. `screens/SettingsScreen.jsx` — add "Refer & Earn" ActionRow
15. `navigation/RootNavigator.jsx` — add screen + deep link
16. `App.tsx` — handle referral deep link → AsyncStorage
17. `RegisterScreen.jsx` — add optional referral code field
18. `ProviderRegisterScreen.jsx` — add optional referral code field
19. Google/Apple OAuth screens — send stored referral code

### Phase 4: Admin
20. `temp_admin/src/pages/ReferralDashboard.jsx` — full admin view
21. `temp_admin/src/App.jsx` + `Layout.jsx` — routing + sidebar

### Phase 5: Web & Polish
22. Next.js referral landing page (`/ref/[code]`)
23. Share functionality (WhatsApp, SMS, copy)
24. Push notifications for referral events

---

## Progress Tracker

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | pointsLedger.js model | DONE | Append-only, idempotency keys, compound indexes, cycle helpers |
| 2 | rewardCycle.js model | DONE | Lazy leaderboard cache, auto-create cycle, maskName helper |
| 3 | User/Provider referral fields | DONE | referralCode (unique sparse) + referredBy block on both models |
| 4 | referralController.js | DONE | Code gen, validate, processReferral, creditServicePoints, stats, leaderboard, admin ops |
| 5 | referralRoutes.js | DONE | 8 user routes + 5 admin routes, registered in server.js |
| 6 | Seed cycle 2026-C1 | DONE | Auto-created on first getOrCreateCurrentCycle() call |
| 7 | authController integration | DONE | User + Provider register extract `referralCode`, call `processReferral()` after creation |
| 8 | googleAuthController integration | DONE | syncGoogleUser + syncGoogleProvider extract `referralCode`, call `processReferral()` |
| 9 | traditionalService completion hook | DONE | `creditServicePoints()` called after `completeService()` |
| 10 | emergencyService completion hook | DONE | `creditServicePoints()` called after `markCompleted()` |
| 11 | eventService completion hook | DONE | `creditServicePoints()` called after `markCompleted()` |
| 12 | referralService.js (frontend) | DONE | 8 API functions matching all backend endpoints |
| 13 | ReferralScreen.jsx | DONE | Full screen: code card, stats, leaderboard, history, cycle progress, prizes |
| 14 | SettingsScreen "Refer & Earn" | DONE | ActionRow added for both users and providers |
| 15 | RootNavigator + deep link | DONE | Added to both UserMainNavigator and ProviderMainNavigator |
| 16 | App.tsx deep link handler | DONE | handleReferralDeepLink() stores code in AsyncStorage |
| 17 | RegisterScreen referral field | DONE | Input field + AsyncStorage load + passed to registerUser + Google sync |
| 18 | ProviderRegisterScreen referral field | DONE | Input field + AsyncStorage load + passed to registerProvider + Google sync |
| 19 | OAuth referral code pass-through | DONE | googleAuthService sync functions pass referralCode in payload |
| 20 | Admin ReferralDashboard.jsx | DONE | Stats cards, tab leaderboard (user/provider), refresh, prizes section |
| 21 | Admin routing + sidebar | DONE | Route at /referrals, trophy icon in sidebar nav |
| 22 | Next.js referral page | DONE | `/ref/[code]` dynamic page with OG tags, store links, deep link, how-it-works |
| 23 | Share functionality | DONE | Built into ReferralScreen (Share.share + Clipboard) |
| 24 | Push notifications | DEFERRED | Can add later — not blocking launch |
