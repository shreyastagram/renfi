# FixHomi Location Tracking Guide

## Overview

This document explains the location tracking system in FixHomi and how the settings affect provider visibility and customer experience.

---

## Provider Settings (Settings Screen)

### 1. Available for Work Toggle

**Location:** Settings → Availability → "Available for Work"

**What it controls:**
- `isAvailable` field in Provider document (MongoDB)

**When ENABLED:**
- ✅ Provider appears in nearby provider searches
- ✅ Provider is listed for their service categories
- ✅ Provider can receive new booking requests
- ✅ Provider shows on customer's map when searching

**When DISABLED:**
- ❌ Provider is HIDDEN from all customer searches
- ❌ Provider cannot receive new booking requests
- ⚠️ Existing/active bookings are NOT affected
- ⚠️ Provider can still complete in-progress jobs

**Database Impact:**
```javascript
Provider.isAvailable = true/false
```

**API Endpoint:**
```
POST /api/provider/online-status
Body: { isOnline: true/false }
```

---

### 2. Live Location Tracking Toggle

**Location:** Settings → Availability → "Live Location Tracking"

**What it controls:**
- `locationTracking.enabled` field in Provider document
- Whether real-time GPS updates are sent to the server

**When ENABLED:**
- ✅ Location updates every 30 seconds (configurable)
- ✅ `geoLocation` field is updated for $geoNear queries
- ✅ Customers can see provider approaching on map
- ✅ Accurate ETA calculations
- ✅ Provider appears in proximity-based searches
- ⚠️ Uses GPS which may affect battery life

**When DISABLED:**
- ❌ No real-time location updates
- ❌ Customers cannot track provider arrival
- ⚠️ Only last known location is used
- ⚠️ ETA may be less accurate
- ⚠️ May not appear in very precise proximity searches

**Database Impact:**
```javascript
Provider.locationTracking = {
  enabled: true/false,
  updateInterval: 30000,  // 30 seconds
  minDistance: 50         // 50 meters
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
1. Location tracking starts automatically
2. GPS position is obtained
3. Location is sent to server via:
   - Socket.IO (real-time)
   - REST API (persistence fallback)

### 3. Real-Time Updates
While provider is using the app:
- Location updates every 30 seconds
- Uses `Geolocation.watchPosition()` for accurate tracking
- Updates both `geoLocation` (for searches) and `currentLocation` (for display)

### 4. Background Updates
When app is in background:
- Uses `react-native-background-geolocation` (if configured)
- May be limited by OS battery optimization
- Fallback to significant location changes

---

## Database Fields Explained

### Provider Document Structure

```javascript
{
  // Availability
  isAvailable: Boolean,        // Can receive new bookings
  isOnline: Boolean,           // Currently active in app
  
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
    lastUpdated: Date
  },
  
  // Tracking settings
  locationTracking: {
    enabled: Boolean,
    updateInterval: Number,    // ms between updates
    minDistance: Number        // min meters to trigger update
  }
}
```

---

## Nearby Provider Search

When a customer searches for nearby providers:

```javascript
// MongoDB $geoNear query
Provider.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [customerLng, customerLat] },
      distanceField: "distance",
      maxDistance: 10000,  // 10km radius
      spherical: true,
      query: {
        isAvailable: true,
        isActive: true,
        serviceCategories: { $in: [selectedService] }
      }
    }
  }
])
```

**Requirements for provider to appear:**
1. ✅ `isAvailable: true`
2. ✅ `isActive: true`
3. ✅ `geoLocation` must be set with valid coordinates
4. ✅ Within the search radius
5. ✅ Matching service category

---

## Troubleshooting

### Provider not appearing in searches

1. **Check isAvailable:**
   ```javascript
   db.providers.findOne({email: "provider@email.com"}, {isAvailable: 1})
   ```

2. **Check geoLocation:**
   ```javascript
   db.providers.findOne({email: "provider@email.com"}, {geoLocation: 1})
   ```
   - Must have valid coordinates
   - Format must be `{ type: "Point", coordinates: [lng, lat] }`

3. **Check geospatial index:**
   ```javascript
   db.providers.getIndexes()
   // Should see: { "geoLocation": "2dsphere" }
   ```

### Location not updating

1. **Check location permission:** Ensure app has location permission
2. **Check GPS:** Device GPS must be enabled
3. **Check network:** Server must be reachable
4. **Check logs:** Look for location update errors in console

### Battery drain concerns

- Location tracking uses GPS which can affect battery
- Consider disabling tracking when not actively working
- Background tracking has higher battery impact

---

## Socket Events

### Provider → Server
```javascript
// Location update
socket.emit('providerLocationUpdate', {
  providerId: string,
  location: {
    lat: number,
    lng: number,
    accuracy: number
  }
});
```

### Server → Customer
```javascript
// Provider location broadcast
socket.emit('providerLocationUpdate', {
  providerId: string,
  location: {
    lat: number,
    lng: number,
    accuracy: number,
    timestamp: Date
  },
  eta: number  // minutes
});
```

---

## Best Practices for Providers

1. **Keep "Available for Work" ON** when actively looking for jobs
2. **Keep "Live Location Tracking" ON** when en route to customer
3. **Turn OFF tracking** when on break to save battery
4. **Ensure GPS is enabled** for accurate location
5. **Allow background location** for uninterrupted tracking

---

## Version History

- **v1.0.0** - Initial location tracking implementation
- **v1.1.0** - Added GeoJSON support for $geoNear
- **v1.2.0** - Added currentLocation for real-time display
- **v1.3.0** - Added Socket.IO integration
- **v1.4.0** - Added REST API fallback for persistence
