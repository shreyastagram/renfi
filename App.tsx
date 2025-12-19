import React, { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider } from './context/AppContext.js';
import RootNavigator from './navigation/RootNavigator.jsx';

// Navigation reference for deep linking
const navigationRef = React.createRef<NavigationContainerRef<any>>();

// Deep linking configuration
const linking = {
  prefixes: ['fixhomi://', 'https://fixhomi.com'],
  config: {
    screens: {
      // These screens need to be accessible via deep link
      // The path parsing handles the token parameter
      ResetPassword: {
        path: 'reset-password',
        parse: {
          token: (token: string) => token,
        },
      },
      VerifyEmail: {
        path: 'verify-email', 
        parse: {
          token: (token: string) => token,
        },
      },
    },
  },
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

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <NavigationContainer 
          ref={navigationRef}
          linking={linking}
          onStateChange={(state) => {
            console.log('📍 [Navigation] State changed:', state?.routes?.[state?.index ?? 0]?.name);
          }}
        >
          <RootNavigator />
        </NavigationContainer>
      </AppProvider>
    </GestureHandlerRootView>
  );
}

// Export navigation ref for use outside components
export { navigationRef };
