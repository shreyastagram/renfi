import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { AppState } from 'react-native';
import socketService from './socket';
import { LocationPermissions } from './locationPermissions';

class LiveLocationService {
  constructor() {
    this.locationInterval = null;
    this.isTracking = false;
    this.providerId = null;
    this.updateInterval = 30000; // 30 seconds default
    this.lastKnownLocation = null;
    this.appState = AppState.currentState;
    
    // Listen for app state changes
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  handleAppStateChange = (nextAppState) => {
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('📱 App became active - resuming location tracking');
      if (this.isTracking && this.providerId) {
        this.startTracking(this.providerId);
      }
    } else if (nextAppState.match(/inactive|background/)) {
      console.log('📱 App went to background - continuing location tracking');
      // Continue tracking in background for service providers
    }
    this.appState = nextAppState;
  };

  async startTracking(providerId) {
    if (!providerId) {
      console.error('❌ Cannot start tracking: No provider ID');
      return false;
    }

    // Check location permissions first
    const hasPermission = await LocationPermissions.ensureLocationPermission();
    if (!hasPermission) {
      console.error('❌ Cannot start tracking: Location permission denied');
      return false;
    }

    console.log(`🎯 Starting live location tracking for provider: ${providerId}`);
    
    this.providerId = providerId;
    this.isTracking = true;
    
    // Store tracking state
    await AsyncStorage.setItem('isLocationTracking', 'true');
    await AsyncStorage.setItem('trackingProviderId', providerId);
    
    // Get initial location immediately
    await this.updateLocation();
    
    // Set up periodic updates
    this.locationInterval = setInterval(() => {
      this.updateLocation();
    }, this.updateInterval);
    
    console.log(`✅ Location tracking started - updates every ${this.updateInterval/1000}s`);
    return true;
  }

  async stopTracking() {
    console.log('🛑 Stopping live location tracking');
    
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
    
    this.isTracking = false;
    this.providerId = null;
    
    // Clear stored tracking state
    await AsyncStorage.removeItem('isLocationTracking');
    await AsyncStorage.removeItem('trackingProviderId');
    
    // Notify backend that provider stopped location sharing
    if (socketService.getSocket()) {
      socketService.getSocket().emit('providerLocationStop', {
        providerId: this.providerId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('✅ Location tracking stopped');
  }

  async updateLocation() {
    if (!this.isTracking || !this.providerId) {
      return;
    }

    try {
      const position = await this.getCurrentPosition();
      const newLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString(),
        speed: position.coords.speed || 0,
        heading: position.coords.heading || 0
      };

      // Check if location changed significantly (> 10 meters)
      if (this.hasLocationChanged(newLocation)) {
        console.log(`📍 Location updated for provider ${this.providerId}:`, 
                   `${newLocation.lat.toFixed(6)}, ${newLocation.lng.toFixed(6)} (±${Math.round(newLocation.accuracy)}m)`);
        
        // Send location update via socket
        this.sendLocationUpdate(newLocation);
        
        // Store last known location
        this.lastKnownLocation = newLocation;
        await AsyncStorage.setItem('lastKnownLocation', JSON.stringify(newLocation));
      } else {
        console.log('📍 Location unchanged, skipping update');
      }
      
    } catch (error) {
      console.error('❌ Location update failed:', error);
      
      // If GPS fails, try to use last known location with timestamp update
      if (this.lastKnownLocation) {
        console.log('📍 Using last known location');
        this.sendLocationUpdate({
          ...this.lastKnownLocation,
          timestamp: new Date().toISOString(),
          isStale: true
        });
      }
    }
  }

  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
          distanceFilter: 5 // Only update if moved 5+ meters
        }
      );
    });
  }

  hasLocationChanged(newLocation) {
    if (!this.lastKnownLocation) return true;
    
    const distance = this.calculateDistance(
      this.lastKnownLocation.lat, this.lastKnownLocation.lng,
      newLocation.lat, newLocation.lng
    );
    
    // Update if moved more than 10 meters or accuracy improved significantly
    return distance > 0.01 || // 10 meters
           (newLocation.accuracy < this.lastKnownLocation.accuracy * 0.7);
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  sendLocationUpdate(locationData) {
    const payload = {
      providerId: this.providerId,
      ...locationData,
      appState: this.appState
    };

    console.log('📤 Sending location update:', payload);

    if (socketService.getSocket() && socketService.getConnectionStatus()) {
      socketService.getSocket().emit('providerLocationUpdate', payload);
    } else {
      console.warn('⚠️ Socket not connected, queueing location update');
      // Could implement offline queue here
    }
  }

  // Adjust update frequency based on movement
  setUpdateInterval(intervalMs) {
    if (intervalMs < 10000) intervalMs = 10000; // Minimum 10 seconds
    if (intervalMs > 300000) intervalMs = 300000; // Maximum 5 minutes
    
    this.updateInterval = intervalMs;
    
    if (this.isTracking) {
      // Restart with new interval
      this.stopTracking();
      this.startTracking(this.providerId);
    }
    
    console.log(`⏱️ Location update interval changed to ${intervalMs/1000}s`);
  }

  // Get current tracking status
  getTrackingStatus() {
    return {
      isTracking: this.isTracking,
      providerId: this.providerId,
      updateInterval: this.updateInterval,
      lastLocation: this.lastKnownLocation,
      appState: this.appState
    };
  }

  // Resume tracking on app restart
  async resumeTrackingIfNeeded() {
    try {
      const wasTracking = await AsyncStorage.getItem('isLocationTracking');
      const savedProviderId = await AsyncStorage.getItem('trackingProviderId');
      
      if (wasTracking === 'true' && savedProviderId) {
        console.log('🔄 Resuming location tracking from previous session');
        await this.startTracking(savedProviderId);
        
        // Load last known location
        const lastLocationStr = await AsyncStorage.getItem('lastKnownLocation');
        if (lastLocationStr) {
          this.lastKnownLocation = JSON.parse(lastLocationStr);
        }
      }
    } catch (error) {
      console.error('❌ Failed to resume location tracking:', error);
    }
  }
}

// Create singleton instance
const liveLocationService = new LiveLocationService();

export default liveLocationService;