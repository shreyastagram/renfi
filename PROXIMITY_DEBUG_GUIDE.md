# 🔍 **DEBUGGING GUIDE: Distance & Proximity Issues**

## 🚨 **Issues to Debug**

1. **Distance showing as "unknown" in UI**
2. **Service providers receiving requests even when 1km+ away**

---

## 🔧 **Step 1: Check What Backend is Actually Sending**

### **Add Comprehensive Logging to ProviderDashboard**

Add this debug code to your `ProviderDashboard.jsx` file:

```jsx
// In ProviderDashboard.jsx - Replace the onServiceRequest listener
socketService.onServiceRequest((requestData) => {
  console.log('🔥 =================================');
  console.log('🔥 FULL INCOMING REQUEST DATA:');
  console.log('🔥 =================================');
  console.log('📩 Complete requestData object:', JSON.stringify(requestData, null, 2));
  
  // Check specific fields that should contain distance
  console.log('📍 requestData.distance:', requestData.distance);
  console.log('📍 requestData.userDistance:', requestData.userDistance);
  console.log('📍 requestData.searchRadius:', requestData.searchRadius);
  console.log('📍 requestData.location:', requestData.location);
  console.log('📍 requestData.userLocation:', requestData.userLocation);
  
  // Check if backend is sending any distance-related data
  const distanceFields = Object.keys(requestData).filter(key => 
    key.includes('distance') || key.includes('radius') || key.includes('km')
  );
  console.log('📊 Fields containing distance/radius/km:', distanceFields);
  
  // Log all available fields
  console.log('📋 All available fields:', Object.keys(requestData));
  console.log('🔥 =================================');
  
  // Rest of your existing code...
});
```

---

## 🔧 **Step 2: Check Backend Socket Event Name**

### **Problem**: Backend might be sending different event name

In your `utils/socket.js`, add debug logging:

```jsx
// In utils/socket.js - Add this to the onServiceRequest method
onServiceRequest(callback) {
  if (this.socket) {
    console.log('🔍 Setting up listener for: incomingServiceRequest');
    
    // Listen for the expected event
    this.socket.on('incomingServiceRequest', (data) => {
      console.log('✅ Received incomingServiceRequest event:', data);
      callback(data);
    });
    
    // DEBUGGING: Listen for other possible event names
    const possibleEvents = [
      'serviceRequest',
      'newServiceRequest', 
      'providerServiceRequest',
      'requestNotification'
    ];
    
    possibleEvents.forEach(eventName => {
      this.socket.on(eventName, (data) => {
        console.log(`🚨 Received unexpected event: ${eventName}`, data);
      });
    });
    
    // Listen for ALL events (debugging only)
    this.socket.onAny((eventName, data) => {
      console.log(`📻 ANY EVENT: ${eventName}`, data);
    });
  }
}
```

---

## 🔧 **Step 3: Verify Provider Location is Set**

### **Check if Provider Has Location Data**

Add this to your `ProviderDashboard.jsx` in the `fetchProviderProfile` function:

```jsx
// In fetchProviderProfile function
if (data.success) {
  setProviderProfile(data.data);
  console.log('✅ Provider profile loaded:', data.data);
  
  // 🔍 DEBUG: Check provider location
  console.log('🏠 =================================');
  console.log('🏠 PROVIDER LOCATION DEBUG:');
  console.log('🏠 =================================');
  console.log('📍 Provider location object:', data.data.location);
  console.log('📍 Provider latitude:', data.data.location?.latitude);
  console.log('📍 Provider longitude:', data.data.location?.longitude);
  console.log('📍 Provider address:', data.data.location?.address);
  console.log('📍 Location last updated:', data.data.location?.lastUpdated);
  console.log('🏠 =================================');
  
  // Check if location is valid
  if (!data.data.location?.latitude || !data.data.location?.longitude) {
    console.log('🚨 WARNING: Provider has no valid location data!');
    console.log('🚨 This provider should NOT receive distance-based requests!');
  }
  
  // Also update stored provider data
  await providerStorage.saveProviderData(data.data);
}
```

---

## 🔧 **Step 4: Check User Location Data Being Sent**

### **Verify User Location in Service Request**

Add this to your `context/AppContext.js` in the `sendServiceRequest` function:

```jsx
// In AppContext.js - sendServiceRequest function
const serviceRequest = {
  userId: userId,
  userLocation: {
    latitude: userLocation[1],
    longitude: userLocation[0],
  },
  // ... rest of fields
};

// 🔍 DEBUG: Log user location being sent
console.log('📤 =================================');
console.log('📤 USER LOCATION DEBUG:');
console.log('📤 =================================');
console.log('📍 userLocation array:', userLocation);
console.log('📍 Sending latitude:', userLocation[1]);
console.log('📍 Sending longitude:', userLocation[0]);
console.log('📍 Complete serviceRequest:', JSON.stringify(serviceRequest, null, 2));
console.log('📤 =================================');
```

---

## 🔧 **Step 5: Check Backend Configuration**

### **Questions for Backend Team**

Ask your backend developers to verify:

1. **Are proximity calculations enabled?**
   ```bash
   # Check backend logs for distance calculations
   grep -i "distance\|radius\|proximity" backend_logs.txt
   ```

2. **Is the backend using the new 1km configuration?**
   ```javascript
   // Backend should have this config
   DEFAULT_RADIUS_KM: 1  // NOT 15
   MAX_RADIUS_KM: 5      // NOT 50
   ```

3. **Are providers being filtered by distance?**
   ```javascript
   // Backend should only send requests to providers within search radius
   if (distance > currentSearchRadius) {
     console.log(`Provider too far: ${distance}km > ${currentSearchRadius}km`);
     continue; // Skip this provider
   }
   ```

---

## 🔧 **Step 6: Test Distance Calculation**

### **Add Manual Distance Check**

Add this test function to your `ProviderDashboard.jsx`:

```jsx
// Add this function to test distance calculation
const testDistanceCalculation = () => {
  // Example coordinates (you can replace with real ones)
  const userLat = 12.9716;    // User location
  const userLng = 77.5946;
  const providerLat = 12.9800; // Provider location (should be ~1km away)
  const providerLng = 77.6000;
  
  // Import your distance calculation function
  import { calculateDistance } from '../utils/locationUtils';
  
  const distance = calculateDistance(userLat, userLng, providerLat, providerLng);
  console.log('🧮 Manual distance calculation:', distance, 'km');
  
  if (distance > 1) {
    console.log('🚨 This provider should NOT receive the request (>1km)');
  } else {
    console.log('✅ This provider should receive the request (<1km)');
  }
};

// Call this function in useEffect for testing
useEffect(() => {
  testDistanceCalculation();
}, []);
```

---

## 🔧 **Step 7: Check Socket Connection**

### **Verify Provider Registration**

Add this debug to your `ProviderDashboard.jsx`:

```jsx
useEffect(() => {
  // ... existing code ...
  
  // 🔍 DEBUG: Check socket registration
  const socket = socketService.getSocket();
  if (socket) {
    socket.on('connect', () => {
      console.log('🔌 =================================');
      console.log('🔌 SOCKET CONNECTION DEBUG:');
      console.log('🔌 =================================');
      console.log('🔌 Socket ID:', socket.id);
      console.log('🔌 Connection status:', socketService.getConnectionStatus());
      
      // Check if provider is properly registered
      socket.emit('getProviderStatus', { providerId: providerProfile?.id }, (response) => {
        console.log('🔌 Provider registration status:', response);
      });
      console.log('🔌 =================================');
    });
  }
}, []);
```

---

## 🛠 **Expected Results from Debugging**

### **If Distance Shows "Unknown"**:
1. **Backend not sending distance data** → Check socket event name and data structure
2. **Backend not calculating distance** → Verify proximity algorithm is implemented
3. **Provider location missing** → Provider needs to set GPS coordinates

### **If Provider Gets Requests 1km+ Away**:
1. **Backend using old 15km radius** → Update backend configuration to 1km
2. **Backend not filtering by distance** → Implement proximity filtering
3. **Distance calculation error** → Check coordinate format and calculation method

---

## 🎯 **Quick Fix Checklist**

### **Frontend Fixes** (You can do):
- [ ] Add comprehensive logging (code above)
- [ ] Verify provider location is set in profile
- [ ] Check user location format being sent
- [ ] Test manual distance calculation

### **Backend Fixes** (Backend team needs to do):
- [ ] Update `DEFAULT_RADIUS_KM` from 15 to 1
- [ ] Implement distance filtering in provider selection
- [ ] Include distance data in socket events
- [ ] Test proximity algorithm with real coordinates

---

## 📞 **Next Steps**

1. **Add the debug logging code above**
2. **Test a service request and check console logs**
3. **Share the debug output with backend team**
4. **Verify provider has location set in their profile**
5. **Confirm backend is using 1km radius configuration**

The debug logs will show exactly what data is missing and help identify if it's a frontend display issue or backend proximity calculation issue!