import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';

export class LocationPermissions {
  static async requestLocationPermission() {
    if (Platform.OS === 'ios') {
      // iOS permissions are handled by Info.plist and automatically requested
      return true;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs access to your location to match you with nearby service requests.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('✅ Location permission granted');
        return true;
      } else {
        console.log('❌ Location permission denied');
        this.showPermissionDeniedAlert();
        return false;
      }
    } catch (err) {
      console.error('❌ Location permission error:', err);
      return false;
    }
  }

  static async checkLocationPermission() {
    if (Platform.OS === 'ios') {
      return true; // iOS handles this differently
    }

    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted;
    } catch (err) {
      console.error('❌ Error checking location permission:', err);
      return false;
    }
  }

  static showPermissionDeniedAlert() {
    Alert.alert(
      'Location Permission Required',
      'We need location access to match you with nearby services. Please enable location permissions in your device settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  }

  static async ensureLocationPermission() {
    const hasPermission = await this.checkLocationPermission();
    
    if (!hasPermission) {
      return await this.requestLocationPermission();
    }
    
    return true;
  }
}