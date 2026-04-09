# Infrastructure Analysis — Pre-Launch Review

> **Created:** 2026-04-07
> **Context:** App is preparing for city-level launch in Yavatmal. Expected 100-200 providers + 200-400 users.
> **Purpose:** This document captures findings from a code analysis session. Some estimates may be inaccurate — verify each claim by reading the actual code and checking Render/MongoDB/Upstash pricing pages before making decisions.
> **How to use:** Tell Claude to read this file, verify each finding against the actual codebase, and then implement Redis caching + any other changes needed.

---

## Current Infrastructure (Verify on Render/Neon/Atlas dashboards)

| Component | Service | Plan | Notes |
|-----------|---------|------|-------|
| Node.js Backend | Render | Starter (~$25/mo?) | Business logic, MongoDB, Socket.IO |
| Java Auth Backend | Render | Starter (~$25/mo?) | Auth, JWT, OTP, PostgreSQL |
| MongoDB | Atlas | Unknown — check dashboard | Main data store |
| PostgreSQL | Neon | Unknown — check dashboard | Java Auth DB |
| Redis | None currently | — | Not yet integrated |

**Action needed:** Verify actual plan names, costs, and specs on each provider's dashboard before making upgrade decisions.

---

## Findings: API Call Frequency (Verify in Code)

The following endpoints were identified as the most frequently called. **Verify each by reading the actual controller function** — line numbers may have shifted.

### Highest Frequency: Background Location Update
- **Endpoint:** `POST /api/provider/location-update`
- **Controller:** `noefi/fixhomi-backend/controllers/backgroundLocationController.js`
- **Claimed frequency:** Every 10-50 seconds per active provider
- **Claimed DB queries per call:** 4-7 (update provider + find active requests across 3 service collections + batch update locations)
- **Concern:** At 150 providers, this could be 600-6,300 MongoDB queries/min from this endpoint alone
- **Index status:** A compound index on `{ providerId, status, 'locationSharing.enabled' }` was added to all 3 service models during this session. **Verify these indexes exist in the actual model files.**

### High Frequency: Live Tracking Poll (User Side)
- **Verify:** How does `LiveTrackingScreen.jsx` fetch provider location? Does it poll a REST endpoint or listen to Socket.IO?
- **Check:** `src/screens/LiveTrackingScreen.jsx` — look for fetch intervals, socket listeners
- **Concern:** If users poll REST every 2-15 seconds, that's significant DB read load

### Medium Frequency: Stats/Jobs Refresh
- **Endpoint:** `GET /api/traditional-services/:providerId/requests`
- **Controller:** `traditionalServiceController.js` → `getProviderRequests`
- **Claimed DB queries:** 5 per call (provider lookup + count + paginated find + user batch + stats aggregation)
- **Called when:** Tab focus (with 30s staleness guard on Home, 15s on Jobs), socket events, auto-refresh every 60s

### Medium Frequency: Profile Refresh
- **Endpoint:** `GET /api/auth/provider/profile/:id` + `GET /api/users/me` (Java Auth)
- **Claimed frequency:** Every 30s (staleness guard was added during this session)
- **Verify:** Check that `ProfileScreen.jsx` has the `profileLastRefreshRef` staleness guard

---

## Findings: MongoDB Connection Pool

- **File:** `noefi/fixhomi-backend/config/db.js`
- **Changed during this session:** `maxPoolSize` from 10 to 20, `minPoolSize` from 2 to 3
- **Verify:** Read the file to confirm current values
- **Note:** MongoDB Atlas plan connection limits vary by tier — verify your plan's max connections before increasing further

---

## Findings: Missing Indexes (Added During This Session)

The following indexes were added to speed up the background location controller's queries. **Verify they exist in the model files:**

1. `noefi/fixhomi-backend/models/traditionalService.js` — should have `{ providerId: 1, status: 1, 'locationSharing.enabled': 1 }`
2. `noefi/fixhomi-backend/models/eventServices.js` — same index
3. `noefi/fixhomi-backend/models/emergencyService.js` — same index

**Important:** These indexes are defined in the schema but only get created when the server connects to MongoDB. After deploying, verify indexes exist in Atlas by running `db.traditionalservices.getIndexes()` in the Atlas shell.

---

## Redis Integration Plan (NOT YET IMPLEMENTED)

### Why Redis Was Recommended

The background location endpoint writes to MongoDB on every call (every 10-50s per provider). Users polling for live location also read from MongoDB. Redis would serve as a cache layer:

- **Write path:** Location update → write to Redis (fast) + write to MongoDB (persistence, can be batched/debounced)
- **Read path:** Live tracking poll → read from Redis (sub-millisecond) instead of MongoDB

### What Should Go Into Redis (Verify Need By Reading Code)

| Data | Currently Stored In | Proposed Redis Key | TTL | Verify In |
|------|--------------------|--------------------|-----|-----------|
| Provider live location (lat/lng/timestamp) | MongoDB `provider.currentLocation` | `loc:provider:{id}` hash | 5 min | backgroundLocationController.js |
| Active request IDs per provider | Queried from 3 collections per location update | `active_reqs:{providerId}` set | 60s | backgroundLocationController.js |
| Referral daily rate limit counts | In-memory Map (lost on restart) | `ref_limit:{referrerId}:{date}` | 24h | referralController.js |
| Leaderboard top 50 | MongoDB RewardCycle document | `leaderboard:{cycleId}:{userType}` | 5 min | referralController.js / rewardCycle.js |

### Redis Service Options (VERIFY CURRENT PRICING)

| Service | Claimed Price | Check URL |
|---------|--------------|-----------|
| Upstash Redis | Free tier = 10K commands/day, Pro ~$10/mo | https://upstash.com/pricing |
| Redis Cloud | Free = 30MB, Paid ~$5/mo | https://redis.com/pricing |
| Render Redis | May not be available | https://render.com/pricing |

### Implementation Scope

- **Backend only** — no frontend changes needed
- **New file:** `noefi/fixhomi-backend/config/redis.js` (connection setup)
- **Modified:** `backgroundLocationController.js` (write to Redis, cache active request IDs)
- **Modified:** Whatever endpoint serves live tracking data to users (read from Redis)
- **Package:** `ioredis` or `@upstash/redis` (verify which is better for the chosen service)

---

## Queue System Assessment (BullMQ / Kafka)

### Current State
- Push notifications use fire-and-forget pattern (`.catch(() => {})`)
- OTP emails use fire-and-forget
- Referral point crediting is fire-and-forget
- No message queue exists

### Assessment (Verify by Load Testing)
- **Kafka:** Almost certainly overkill for this scale. Kafka is designed for 100K+ events/second.
- **BullMQ:** Could help for push notifications and OTP emails if they start failing silently. Uses Redis as its backing store (so if Redis is added, BullMQ comes free).
- **Current approach:** Fire-and-forget works at launch scale but provides no retry or guaranteed delivery.

### When to Add BullMQ
- When push notifications start failing (monitor FCM error rates)
- When you add features needing guaranteed delivery (payment webhooks, scheduled reminders)
- Since BullMQ uses Redis, adding it later is low-effort if Redis is already in place

---

## MongoDB Atlas Plan Decision (VERIFY CURRENT PRICING)

| Plan | Claimed Price | Claimed Specs | Check URL |
|------|--------------|---------------|-----------|
| M0 (Free) | $0 | 512MB, 500 connections, shared | https://www.mongodb.com/pricing |
| M2 | ~$9/mo | 2GB, 500 connections, shared | Same |
| M5 | ~$25/mo | 5GB, 500 connections, shared | Same |
| M10 | ~$57/mo | 10GB, 1500 connections, dedicated | Same |

**Factors to consider:**
- How much data do you have now? Check Atlas dashboard.
- How many connections are being used? Check Atlas metrics.
- Are queries slow? Check Atlas Performance Advisor.
- Shared vs dedicated: shared clusters can have noisy-neighbor issues under load

---

## Performance Optimizations Done in This Session

The following changes were made. **Verify each exists in the codebase:**

### Frontend (React Native)
1. **InteractionManager** — focus fetches deferred on ProviderHomeScreen, UserServiceHistoryScreen, ProviderServiceHistoryScreen, ProfileScreen
2. **Socket listeners in useFocusEffect** — prevents background tabs from triggering API calls (3 screens)
3. **TabIcon React.memo** — prevents tab bar re-renders
4. **StatPill React.memo** — prevents SVG re-creation in history screens
5. **DateTimePicker useMemo** — prevents recalculating date/time options every render
6. **FlatList renderItem useCallback** — prevents breaking React.memo on list items
7. **Auto-refresh interval** — increased from 30s to 60s on both history screens
8. **ProfileScreen staleness guard** — 30s check before calling refreshProfile
9. **ProviderServiceHistory focus guard** — 15s staleness check on tab return
10. **PulsingDot paused prop** — animation stops when Home tab is not focused
11. **No limit:500 fetch** — removed 500-record stats fetch, uses backend count instead
12. **Rating batch** — checks 5 at a time instead of N parallel calls

### Backend (Node.js)
13. **locationSharing.enabled index** — added to traditionalService, eventService, emergencyService
14. **maxPoolSize 10→20** — increased MongoDB connection pool

---

## What Still Needs to Be Done

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | Implement Redis caching for live location | HIGH | 2-3 hours |
| 2 | Verify MongoDB Atlas plan is sufficient | HIGH | 15 min (check dashboard) |
| 3 | Verify all indexes exist in production | HIGH | 15 min (Atlas shell) |
| 4 | Load test with autocannon or k6 | MEDIUM | 1-2 hours |
| 5 | Monitor Render metrics after launch | MEDIUM | Ongoing |
| 6 | Add BullMQ for push notifications (if needed) | LOW | 2 hours (after Redis is in place) |
| 7 | Verify Render plan specs match assumptions | HIGH | 10 min (check pricing page) |

---

## Important Disclaimers

- **Pricing:** All prices mentioned are from training data (up to May 2025) and may be outdated. Check each provider's current pricing page.
- **Specs:** Render, MongoDB, Upstash specs may have changed. Verify before making purchasing decisions.
- **Query counts:** The "queries per request" counts were estimated by reading code. Verify with MongoDB Atlas profiler or `explain()` in production.
- **RPS estimates:** The "100-300 RPS" capacity estimate for Render's $25 plan is based on community benchmarks, not official specs. Run your own load test.
- **Connection pool:** Increasing maxPoolSize is safe as long as it stays below your Atlas plan's connection limit. Check your current plan's limit.
- **This analysis was done in a very long session** — some findings may be based on stale code reads. Always re-read the actual file before implementing changes based on line numbers in this document.
