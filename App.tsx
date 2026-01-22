import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider } from './src/context/AppContext';
import { LocationProvider } from './src/context/LocationContext';
import RootNavigator, { linking as navLinking } from './navigation/RootNavigator';
import SplashScreen from './src/components/SplashScreen';
import { 
  setupNotificationOpenedHandler, 
  getAppInitialNotification 
} from './src/services/fcmService';

// Navigation reference for deep linking and notification handling
export const navigationRef = React.createRef<NavigationContainerRef<any>>();

/**
 * Navigate to a screen (can be called from anywhere)
 */
export const navigate = (name: string, params?: object) => {
  if (navigationRef.current?.isReady()) {
    navigationRef.current?.navigate(name as never, params as never);
  } else {
    console.warn('[Navigation] Navigator not ready yet');
  }
};

// Deep linking configuration
const linking = {
  ...navLinking,
  // Custom function to handle deep links
  async getInitialURL() {
    // Check if app was opened via deep link
    const url = await Linking.getInitialURL();
    console.log('🔗 [DeepLink] Initial URL:', url);
    return url;
  },
  // Subscribe to incoming deep links while app is open
  subscribe(listener: (url: string) => void) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('🔗 [DeepLink] Incoming URL:', url);
      listener(url);
    });
    return () => subscription.remove();
  },
};

/**
 * Handle notification data and navigate to appropriate screen
 */
const handleNotificationData = (remoteMessage: any) => {
  console.log('📩 [FCM] Processing notification for navigation:', remoteMessage);
  
  const data = remoteMessage?.data;
  if (!data) {
    console.log('📩 [FCM] No data in notification');
    return;
  }

  // Extract notification type and relevant data
  const { type, requestId, providerId, userId, distance, serviceType } = data;
  
  console.log('📩 [FCM] Notification data:', { type, requestId, distance, serviceType });

  // Navigate based on notification type
  switch (type) {
    case 'new_request':
    case 'NEW_SERVICE_REQUEST':
      // Provider received a new service request
      if (requestId) {
        navigate('ServiceRequestDetail', { 
          requestId, 
          distance: distance ? parseFloat(distance) : undefined,
          fromNotification: true 
        });
      } else {
        navigate('ProviderRequests');
      }
      break;
      
    case 'request_accepted':
    case 'PROVIDER_ACCEPTED':
      // User's request was accepted by a provider
      if (requestId) {
        navigate('ServiceRequestDetail', { 
          requestId, 
          providerId,
          fromNotification: true 
        });
      }
      break;
      
    case 'request_completed':
    case 'SERVICE_COMPLETED':
      // Service was completed
      if (requestId) {
        navigate('ServiceRequestDetail', { 
          requestId,
          fromNotification: true 
        });
      }
      break;
      
    case 'provider_arrived':
    case 'PROVIDER_ARRIVED':
      // Provider has arrived
      if (requestId) {
        navigate('ServiceRequestDetail', { 
          requestId,
          fromNotification: true 
        });
      }
      break;
      
    default:
      console.log('📩 [FCM] Unknown notification type:', type);
      // If we have a requestId, navigate to details anyway
      if (requestId) {
        navigate('ServiceRequestDetail', { 
          requestId,
          fromNotification: true 
        });
      }
  }
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Set up notification opened handler (when app is in background)
    const unsubscribe = setupNotificationOpenedHandler((remoteMessage) => {
      console.log('📩 [FCM] App opened via notification tap');
      handleNotificationData(remoteMessage);
    });

    // Check if app was opened from a notification when it was closed
    const checkInitialNotification = async () => {
      const initialNotification = await getAppInitialNotification();
      if (initialNotification) {
        console.log('📩 [FCM] App opened from quit state via notification');
        // Delay navigation slightly to ensure navigator is ready
        setTimeout(() => {
          handleNotificationData(initialNotification);
        }, 1000);
      }
    };
    
    checkInitialNotification();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <LocationProvider>
          <View style={{ flex: 1 }}>
            <NavigationContainer 
              ref={navigationRef}
              linking={linking}
              onStateChange={(state) => {
                console.log('📍 [Navigation] State changed:', state?.routes?.[state?.index ?? 0]?.name);
              }}
            >
              <RootNavigator />
            </NavigationContainer>
            
            {/* Splash Screen - shows on app launch */}
            <SplashScreen 
              visible={showSplash} 
              onFinish={() => setShowSplash(false)} 
            />
          </View>
        </LocationProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
