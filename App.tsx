import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, StatusBar, View } from 'react-native';
import { NavigationContainer, NavigationContainerRef, ParamListBase } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { AppProvider } from './src/context/AppContext';
import { LocationProvider } from './src/context/LocationContext';
import { DialogProvider } from './src/context/DialogContext';
import RootNavigator, { linking as navLinking } from './navigation/RootNavigator';
import SplashScreen from './src/components/SplashScreen';
import GlobalBanner from './src/components/GlobalBanner';
import AppUpdateModal from './src/components/AppUpdateModal';
import { checkForAppUpdate } from './src/services/appUpdateService';
import {
  setupNotificationOpenedHandler,
  getAppInitialNotification
} from './src/services/fcmService';
import { configureGoogleSignIn } from './src/services/googleAuthService';

// Navigation reference for deep linking and notification handling
export const navigationRef = React.createRef<NavigationContainerRef<ParamListBase>>();

/**
 * Navigate to a screen (can be called from anywhere)
 */
export const navigate = (name: string, params?: object) => {
  if (navigationRef.current?.isReady()) {
    (navigationRef.current as any)?.navigate(name, params);
  } else {
    console.warn('[Navigation] Navigator not ready yet');
  }
};

// Deep linking configuration - using any to avoid complex nested type issues
const linking: any = {
  ...navLinking,
  // Custom function to handle deep links
  async getInitialURL() {
    // Check if app was opened via deep link
    const url = await Linking.getInitialURL();
    console.log('🔗 [DeepLink] Initial URL:', url);
    
    // Handle email verification deep link
    if (url?.includes('email-verified')) {
      handleEmailVerifiedDeepLink(url);
    }
    
    return url;
  },
  // Subscribe to incoming deep links while app is open
  subscribe(listener: (url: string) => void) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('🔗 [DeepLink] Incoming URL:', url);
      
      // Handle email verification deep link
      if (url?.includes('email-verified')) {
        handleEmailVerifiedDeepLink(url);
      }
      
      listener(url);
    });
    return () => subscription.remove();
  },
};

/**
 * Handle email verified deep link - show alert and refresh user state
 */
const handleEmailVerifiedDeepLink = (url: string) => {
  try {
    // Parse URL parameters manually since React Native URLSearchParams is limited
    const getParam = (paramName: string): string | null => {
      const match = url.match(new RegExp(`[?&]${paramName}=([^&]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    };
    
    const status = getParam('status');
    const email = getParam('email');
    const message = getParam('message');
    
    console.log('📧 [EmailVerified] Status:', status, 'Email:', email);
    
    if (status === 'success') {
      Alert.alert(
        '✅ Email Verified!',
        `Your email ${email || ''} has been successfully verified. You now have full access to all features.`,
        [{ text: 'OK', style: 'default' }]
      );
    } else if (status === 'error') {
      Alert.alert(
        '❌ Verification Failed',
        message || 'The verification link may have expired. Please request a new verification email from Settings.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  } catch (err) {
    console.error('📧 [EmailVerified] Error parsing deep link:', err);
  }
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
    case 'NEW_JOB_REQUEST':
      // Provider received a new service request
      if (requestId) {
        navigate('ServiceRequestDetail', { 
          requestId, 
          distance: distance ? parseFloat(String(distance)) : undefined,
          fromNotification: true 
        });
      } else {
        navigate('ProviderRequests');
      }
      break;
      
    case 'request_accepted':
    case 'PROVIDER_ACCEPTED':
    case 'REQUEST_ACCEPTED':
      // User's request was accepted by a provider
      if (requestId) {
        navigate('ServiceRequestDetail', { 
          requestId, 
          providerId,
          fromNotification: true 
        });
      }
      break;
      
    case 'REQUEST_REJECTED':
      // Provider rejected user's request
      navigate('UserServiceHistory');
      break;
      
    case 'REQUEST_CANCELLED':
      // Request was cancelled by user or provider
      navigate('UserServiceHistory');
      break;
      
    case 'request_completed':
    case 'SERVICE_COMPLETED':
    case 'REQUEST_COMPLETED':
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
      
    case 'APP_UPDATE':
      // App update notification — will be handled by version check on next launch
      console.log('📩 [FCM] App update notification received');
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
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    // Configure Google Sign-In on app start
    configureGoogleSignIn();

    // Check for app updates on launch
    checkForAppUpdate().then((info) => {
      if (info) {
        setUpdateInfo(info);
        setShowUpdateModal(true);
      }
    });

    // Set up notification opened handler (when app is in background)
    const unsubscribe = setupNotificationOpenedHandler((remoteMessage: any) => {
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
      <SafeAreaProvider>
      <AppProvider>
        <LocationProvider>
          <DialogProvider>
          <View style={{ flex: 1 }}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            <NavigationContainer
              ref={navigationRef}
              linking={linking}
              onStateChange={(state) => {
                console.log('📍 [Navigation] State changed:', state?.routes?.[state?.index ?? 0]?.name);
              }}
            >
              <RootNavigator />
              {/* Global notification banner — overlays all screens */}
              <GlobalBanner />
            </NavigationContainer>

            {/* App Update Modal — shown above everything when update needed */}
            <AppUpdateModal
              visible={showUpdateModal && !showSplash}
              updateInfo={updateInfo}
              onDismiss={() => setShowUpdateModal(false)}
            />

            {/* Splash Screen - shows on app launch */}
            <SplashScreen
              visible={showSplash}
              onFinish={() => setShowSplash(false)}
            />
          </View>
          </DialogProvider>
        </LocationProvider>
      </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
