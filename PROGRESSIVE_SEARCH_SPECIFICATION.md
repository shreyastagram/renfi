# 🎯 **COMPLETE DATA SPECIFICATION: Progressive Proximity Search (30s Intervals)**

## 📋 **Overview**
This document specifies the exact data structures, timing logic, and API requirements for the **progressive proximity search** system with 30-second intervals per kilometer.

---

## ⏱️ **Progressive Search Timeline**

### **Search Phases & Timing**:
```
Phase 1: 0-30s   → Search within 1km radius
Phase 2: 30-60s  → Expand search to 2km radius  
Phase 3: 60-90s  → Expand search to 3km radius
Phase 4: 90-120s → Final search within 4km radius
After 120s       → Timeout: "No providers found"
```

### **Frontend Timer Logic**:
```javascript
// Current Implementation
const timer = setInterval(() => {
  const elapsed = Math.floor((Date.now() - searchStartTime) / 1000);
  const newPhase = Math.floor(elapsed / 30) + 1; // Every 30 seconds
  
  // Phase 1: 0-29s = Phase 1 (1km)
  // Phase 2: 30-59s = Phase 2 (2km)  
  // Phase 3: 60-89s = Phase 3 (3km)
  // Phase 4: 90-119s = Phase 4 (4km)
  // >= 120s = Timeout
}, 1000);
```

---

## 📤 **FRONTEND → BACKEND: Service Request Data**

### **1. Initial Service Request**
**Event**: `serviceRequest`
**Sent by**: User (ServiceSelectionScreen)
**Triggered**: When user clicks "Find Nearby [Service]" button

```json
{
  "userId": "670e1234567890abcdef5678",
  "userLocation": {
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "serviceType": "painter",
  "serviceName": "Painter", 
  "serviceIcon": "🎨",
  "serviceDescription": "Wall painting, touch-ups, decorations",
  "description": "I need Painter service - Wall painting, touch-ups, decorations",
  "requestId": "req_1726920600000_xyz789",
  "timestamp": "2025-09-21T10:30:00.000Z"
}
```

**Expected Backend Behavior**:
1. Receive service request
2. Start Phase 1: Search within 1km radius
3. Send immediate confirmation to user
4. Notify qualifying providers within 1km
5. Wait 30 seconds, then expand to 2km if no responses
6. Continue until Phase 4 (4km) or providers found
7. Timeout after 120 seconds if no providers

---

## 📥 **BACKEND → FRONTEND: Response Data Structures**

### **2. Service Request Confirmation (Immediate)**
**Event**: `serviceRequestConfirmed`
**Sent to**: User who made request
**Timing**: Immediately after receiving service request

```json
{
  "requestId": "req_1726920600000_xyz789",
  "message": "Starting search for painter providers within 1km radius",
  "providerCount": 0,
  "searchRadius": 1,
  "serviceType": "painter",
  "nearestDistance": null,
  "searchPhase": 1,
  "maxPhases": 4,
  "phaseTimeLimit": 30,
  "totalTimeLimit": 120,
  "status": "searching"
}
```

### **3. Search Phase Updates (Every 30 seconds)**
**Event**: `searchPhaseUpdate`  
**Sent to**: User who made request
**Timing**: Every 30 seconds during search

```json
{
  "requestId": "req_1726920600000_xyz789",
  "searchPhase": 2,
  "searchRadius": 2,
  "elapsedTime": 30,
  "message": "Expanding search to 2km radius - no providers found within 1km",
  "providerCount": 0,
  "status": "searching"
}
```

### **4. Providers Found Update**
**Event**: `providersFound`
**Sent to**: User who made request  
**Timing**: When providers are found in any phase

```json
{
  "requestId": "req_1726920600000_xyz789",
  "searchPhase": 2,
  "searchRadius": 2,
  "elapsedTime": 45,
  "message": "Found 3 painter providers within 2km radius",
  "providerCount": 3,
  "nearestDistance": 1.3,
  "status": "providers_found",
  "providersNotified": [
    {
      "providerId": "670e1234567890abcdef1234",
      "distance": 1.3,
      "providerName": "John's Painting Services"
    },
    {
      "providerId": "670e1234567890abcdef1235", 
      "distance": 1.7,
      "providerName": "Expert Painters Co"
    },
    {
      "providerId": "670e1234567890abcdef1236",
      "distance": 1.9,
      "providerName": "Color Masters"
    }
  ]
}
```

### **5. Search Timeout**
**Event**: `searchTimeout`
**Sent to**: User who made request
**Timing**: After 120 seconds with no providers found

```json
{
  "requestId": "req_1726920600000_xyz789",
  "searchPhase": 4,
  "searchRadius": 4,
  "elapsedTime": 120,
  "message": "No painter providers found within 4km search area after 2 minutes",
  "providerCount": 0,
  "status": "timeout",
  "finalSearchRadius": 4,
  "totalSearchTime": 120
}
```

---

## 📥 **BACKEND → PROVIDERS: Notification Data**

### **6. Service Request to Provider**
**Event**: `incomingServiceRequest`
**Sent to**: Each qualifying provider
**Timing**: When provider falls within current search radius

```json
{
  "requestId": "req_1726920600000_xyz789",
  "userId": "670e1234567890abcdef5678",
  "serviceType": "painter",
  "serviceName": "Painter",
  "serviceIcon": "🎨", 
  "serviceDescription": "Wall painting, touch-ups, decorations",
  "description": "I need Painter service - Wall painting, touch-ups, decorations",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "urgency": "medium",
  "status": "pending",
  "timestamp": "2025-09-21T10:30:00.000Z",
  "providerId": "670e1234567890abcdef1234",
  "distance": 1.3,
  "searchRadius": 2,
  "searchPhase": 2,
  "userDistance": "1.3km away",
  "estimatedTravelTime": "4min drive",
  "priority": "high"
}
```

---

## 📤 **PROVIDERS → BACKEND: Response Data**

### **7. Provider Response**
**Event**: `providerResponse`
**Sent by**: Provider (ProviderDashboard)
**Triggered**: When provider accepts/rejects request

```json
{
  "requestId": "req_1726920600000_xyz789",
  "providerId": "670e1234567890abcdef1234",
  "response": "accept",
  "estimatedTime": "45 minutes",
  "message": "I can help with your painting needs",
  "providerInfo": {
    "name": "John's Painting Services",
    "phone": "+1234567890",
    "rating": 4.8,
    "experience": "8+ years",
    "specialties": ["Interior painting", "Exterior painting", "Touch-ups"]
  },
  "location": {
    "latitude": 12.9800,
    "longitude": 77.6000
  },
  "timestamp": "2025-09-21T10:32:00.000Z"
}
```

---

## 📥 **BACKEND → USER: Provider Response**

### **8. Provider Acceptance**
**Event**: `providerResponse`
**Sent to**: User who made request
**Timing**: When any provider accepts the request

```json
{
  "requestId": "req_1726920600000_xyz789",
  "providerId": "670e1234567890abcdef1234",
  "response": "accept",
  "estimatedTime": "45 minutes",
  "status": "accepted",
  "providerName": "John's Painting Services",
  "providerPhone": "+1234567890",
  "providerRating": 4.8,
  "providerExperience": "8+ years",
  "distance": 1.3,
  "userDistance": "1.3km away",
  "estimatedTravelTime": "4min drive",
  "timestamp": "2025-09-21T10:32:00.000Z",
  "providerInfo": {
    "id": "670e1234567890abcdef1234",
    "name": "John's Painting Services", 
    "phone": "+1234567890",
    "rating": 4.8,
    "experience": "8+ years",
    "specialties": ["Interior painting", "Exterior painting", "Touch-ups"],
    "location": {
      "latitude": 12.9800,
      "longitude": 77.6000
    }
  },
  "acceptanceTime": "2025-09-21T10:32:00.000Z",
  "searchPhaseWhenAccepted": 2,
  "searchElapsedTime": 45
}
```

---

## 🔄 **BACKEND ALGORITHM: Progressive Search Logic**

### **Required Backend Implementation**:

```javascript
// Backend Progressive Search Algorithm
class ProgressiveProximitySearch {
  constructor() {
    this.PHASE_DURATION = 30000; // 30 seconds per phase
    this.MAX_PHASES = 4;
    this.MAX_SEARCH_TIME = 120000; // 2 minutes total
    this.PHASE_RADII = [1, 2, 3, 4]; // km per phase
  }
  
  async startSearch(serviceRequest) {
    const { userId, userLocation, serviceType, requestId } = serviceRequest;
    let currentPhase = 1;
    let searchStartTime = Date.now();
    
    // Send immediate confirmation
    this.sendToUser(userId, 'serviceRequestConfirmed', {
      requestId,
      searchPhase: 1,
      searchRadius: 1,
      message: `Starting search for ${serviceType} providers within 1km radius`,
      providerCount: 0,
      status: 'searching'
    });
    
    // Start progressive search
    const searchTimer = setInterval(async () => {
      const elapsed = Date.now() - searchStartTime;
      const newPhase = Math.floor(elapsed / this.PHASE_DURATION) + 1;
      
      if (newPhase > currentPhase && newPhase <= this.MAX_PHASES) {
        currentPhase = newPhase;
        const searchRadius = this.PHASE_RADII[currentPhase - 1];
        
        console.log(`🔍 Phase ${currentPhase}: Searching within ${searchRadius}km`);
        
        // Find providers in current radius
        const providers = await this.findProvidersInRadius(
          userLocation, 
          serviceType, 
          searchRadius
        );
        
        if (providers.length > 0) {
          // Found providers - notify them and user
          this.notifyProviders(providers, serviceRequest, currentPhase);
          this.sendToUser(userId, 'providersFound', {
            requestId,
            searchPhase: currentPhase,
            searchRadius,
            providerCount: providers.length,
            nearestDistance: providers[0].distance,
            status: 'providers_found'
          });
          
          clearInterval(searchTimer);
          return;
        } else {
          // No providers found - send phase update
          this.sendToUser(userId, 'searchPhaseUpdate', {
            requestId,
            searchPhase: currentPhase,
            searchRadius,
            elapsedTime: Math.floor(elapsed / 1000),
            message: `Expanding search to ${searchRadius}km radius`,
            status: 'searching'
          });
        }
      }
      
      // Check for timeout
      if (elapsed >= this.MAX_SEARCH_TIME) {
        console.log('⏰ Search timeout reached');
        this.sendToUser(userId, 'searchTimeout', {
          requestId,
          searchPhase: currentPhase,
          searchRadius: this.PHASE_RADII[currentPhase - 1],
          elapsedTime: Math.floor(elapsed / 1000),
          message: `No ${serviceType} providers found within 4km after 2 minutes`,
          status: 'timeout'
        });
        
        clearInterval(searchTimer);
      }
    }, 5000); // Check every 5 seconds
  }
  
  async findProvidersInRadius(userLocation, serviceType, radiusKm) {
    const providers = await Provider.find({
      serviceCategories: serviceType,
      isAvailable: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [userLocation.longitude, userLocation.latitude]
          },
          $maxDistance: radiusKm * 1000 // Convert km to meters
        }
      }
    }).limit(10);
    
    // Calculate exact distances
    return providers.map(provider => ({
      ...provider.toObject(),
      distance: this.calculateDistance(
        userLocation.latitude,
        userLocation.longitude, 
        provider.location.latitude,
        provider.location.longitude
      )
    })).sort((a, b) => a.distance - b.distance);
  }
  
  notifyProviders(providers, serviceRequest, searchPhase) {
    providers.forEach(provider => {
      const notification = {
        ...serviceRequest,
        providerId: provider._id,
        distance: provider.distance,
        userDistance: `${provider.distance.toFixed(1)}km away`,
        searchPhase,
        searchRadius: this.PHASE_RADII[searchPhase - 1],
        priority: this.calculatePriority(provider.distance)
      };
      
      this.sendToProvider(provider._id, 'incomingServiceRequest', notification);
    });
  }
  
  calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula implementation
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  calculatePriority(distance) {
    if (distance <= 0.5) return 'urgent';
    if (distance <= 1) return 'high';
    if (distance <= 2) return 'medium';
    return 'low';
  }
}
```

---

## 🎨 **FRONTEND UI UPDATES**

### **Progressive Search Display**:
```jsx
// ServiceSelectionScreen shows:
Phase 1/4 • 15s elapsed
Searching within 1km radius...
[●○○○] Progress dots
Next expansion in 15s
```

### **Success Messages**:
```jsx
// Based on which phase found providers:
Phase 1: "🏆 Excellent - Found 3 providers within 1km!"
Phase 2: "✨ Good - Found 2 providers within 2km" 
Phase 3: "📍 Found 1 provider within 3km"
Phase 4: "🔍 Found 1 provider in expanded 4km search"
Timeout: "❌ No providers found within 4km after 2 minutes"
```

---

## 🔧 **BACKEND CONFIGURATION**

### **Required Settings**:
```javascript
const PROGRESSIVE_SEARCH_CONFIG = {
  PHASE_DURATION_SECONDS: 30,
  MAX_PHASES: 4,
  PHASE_RADII_KM: [1, 2, 3, 4],
  MAX_SEARCH_TIME_SECONDS: 120,
  MAX_PROVIDERS_PER_PHASE: 10,
  CHECK_INTERVAL_SECONDS: 5
};
```

---

## ✅ **EXPECTED FRONTEND BEHAVIOR**

### **User Experience Flow**:
1. User clicks "🎯 Find Nearby Painters"
2. Shows "Phase 1/4 • Searching within 1km..."
3. Timer counts 0-30s with progress bar
4. If no providers: "Phase 2/4 • Expanding to 2km..."
5. Continues until providers found or 120s timeout
6. Shows provider acceptance with distance info

### **Provider Experience Flow**:
1. Provider gets notification: "🚨 URGENT: 0.8km away"
2. Shows distance, travel time, search phase
3. Provider can accept/reject with response time
4. Gets provider details and contact info on acceptance

---

## 📊 **TESTING SCENARIOS**

### **Test Case 1: Immediate Success**
- Provider exists within 1km
- Should find in Phase 1 (0-30s)
- User sees "Excellent proximity match"

### **Test Case 2: Phase 2 Success**  
- No providers in 1km, found in 2km
- Should find in Phase 2 (30-60s)
- User sees "Good proximity match"

### **Test Case 3: Timeout**
- No providers within 4km
- Should timeout after 120s
- User sees "No providers found" message

### **Test Case 4: Multiple Providers**
- 3 providers at different distances (0.5km, 1.2km, 2.1km)
- All should be notified when search radius includes them
- Should be sorted by distance (closest first)

This specification ensures the progressive search works exactly as intended with proper timing, data flow, and user experience! 🎯