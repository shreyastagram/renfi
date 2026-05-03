/* eslint-disable no-var */
declare var global: typeof globalThis & {
  onAuthExpired?: (() => void) | null;
  onEmailVerified?: (() => void) | null;
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, StatusBar, View, LogBox } from 'react-native';

// Suppress known Mapbox Fabric view recycling warning (harmless on both iOS & Android)
LogBox.ignoreLogs(['view: null found with tag']);
// Suppress Firebase v22 migration warnings (will fix in next major update)
LogBox.ignoreLogs(['This method is deprecated']);
import { NavigationContainer, NavigationContainerRef, ParamListBase } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { AppProvider, useApp } from './src/context/AppContext';
import { LocationProvider } from './src/context/LocationContext';
import { DialogProvider } from './src/context/DialogContext';
import { LanguageProvider } from './src/context/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RootNavigator, { linking as navLinking } from './navigation/RootNavigator';
import SplashScreen from './src/components/SplashScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import GlobalBanner from './src/components/GlobalBanner';
import AppUpdateModal from './src/components/AppUpdateModal';
import MaintenanceModal from './src/components/MaintenanceModal';
import { checkForAppUpdate } from './src/services/appUpdateService';
import {
  setupNotificationOpenedHandler,
  setupForegroundMessageListener,
  getAppInitialNotification
} from './src/services/fcmService';
import { configureGoogleSignIn } from './src/services/googleAuthService';
// In-app calling (demo branch) — CallKeep wiring kept on its own line so
// the existing FCM/Google imports stay untouched. Removable as a unit
// when the demo branch is retired.
import {
  setupCallKeep,
  registerCallKeepListeners,
  consumePendingIncomingCall,
  setPendingIncomingCall,
  displayIncomingCall,
  endCallNative,
  setCallActive,
} from './src/services/callKeepService';
import { acceptCall as acceptIacaxCall, rejectCall as rejectIacaxCall } from './src/services/callService';

// Suppress Mapbox view-tag unhandled promise rejections (Fabric race condition)
const originalHandler = (global as any).ErrorUtils?.getGlobalHandler?.();
if ((global as any).ErrorUtils) {
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    // Suppress Mapbox view recycling errors — harmless on both platforms
    const msg = error?.message || String(error || '');
    if (msg.includes('view: null found with tag') || msg.includes('not the correct type')) {
      return; // swallow silently
    }
    if (originalHandler) originalHandler(error, isFatal);
  });
}

// Crashlytics — graceful import so the app works before npm install
let crashlytics: any = null;
try {
  crashlytics = require('@react-native-firebase/crashlytics').default;
} catch (e) {
  // Package not installed yet
}

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

/**
 * Mask email for display (e.g., "te***@example.com")
 */
const maskEmailForDisplay = (email: string | null): string => {
  if (!email || !email.includes('@')) return '***';
  const atIndex = email.indexOf('@');
  if (atIndex <= 2) return '**' + email.substring(atIndex);
  return email.substring(0, 2) + '***' + email.substring(atIndex);
};

/**
 * Sanitize deep link URL for logging — strip tokens and sensitive params
 */
const sanitizeUrlForLog = (url: string | null): string => {
  if (!url) return '(none)';
  try {
    // Remove token, email, and other sensitive query params
    return url.replace(/([?&])(token|email|password|otp)=[^&]*/gi, '$1$2=[REDACTED]');
  } catch {
    return '(url)';
  }
};

// Deep linking configuration - using any to avoid complex nested type issues
const linking: any = {
  ...navLinking,
  // Custom function to handle deep links
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (__DEV__) {
      console.log('[DeepLink] Initial URL:', sanitizeUrlForLog(url));
    }

    if (url?.includes('email-verified')) {
      handleEmailVerifiedDeepLink(url);
    }

    // Handle referral deep links: fixhomi://ref/CODE or https://fixhomi.com/ref/CODE
    if (url) handleReferralDeepLink(url);

    // Don't pass aadhaar-verification to Navigation — handled by AadhaarVerificationModal
    if (url?.includes('aadhaar-verification')) {
      return null;
    }

    return url;
  },
  // Subscribe to incoming deep links while app is open
  subscribe(listener: (url: string) => void) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (__DEV__) {
        console.log('[DeepLink] Incoming URL:', sanitizeUrlForLog(url));
      }

      if (url?.includes('email-verified')) {
        handleEmailVerifiedDeepLink(url);
      }

      // Handle referral deep links
      if (url) handleReferralDeepLink(url);

      // Don't pass aadhaar-verification to Navigation — handled by AadhaarVerificationModal
      if (url?.includes('aadhaar-verification')) {
        return;
      }

      listener(url);
    });
    return () => subscription.remove();
  },
};

/**
 * Handle referral deep link — store code in AsyncStorage for registration.
 * Formats: fixhomi://ref/CODE or https://fixhomi.com/ref/CODE
 */
const handleReferralDeepLink = (url: string) => {
  try {
    // Match /ref/CODE in the URL
    const match = url.match(/\/ref\/([A-Za-z0-9]+)/);
    if (!match) return;

    const code = match[1].toUpperCase();
    if (code.length < 6 || code.length > 12) return;

    console.log('[DeepLink] Referral code captured:', code);
    AsyncStorage.setItem('pendingReferralCode', code).catch(() => {});
  } catch {
    // Silent fail — don't break deep link flow
  }
};

/**
 * Handle email verified deep link - show alert and refresh user state
 */
const handleEmailVerifiedDeepLink = (url: string) => {
  try {
    const getParam = (paramName: string): string | null => {
      const match = url.match(new RegExp(`[?&]${paramName}=([^&]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    };

    const status = getParam('status');
    const email = getParam('email');
    const message = getParam('message');

    if (status === 'success') {
      const masked = maskEmailForDisplay(email);
      Alert.alert(
        'Email Verified!',
        `Your email ${masked} has been successfully verified. You now have full access to all features.`,
        [{ text: 'OK', style: 'default' }]
      );
      // Trigger verification status refresh via global callback set by AppContext
      if (typeof (global as any).onEmailVerified === 'function') {
        (global as any).onEmailVerified();
      }
    } else if (status === 'error') {
      Alert.alert(
        'Verification Failed',
        message || 'The verification link may have expired. Please request a new verification email from Settings.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  } catch (err) {
    console.error('[EmailVerified] Error parsing deep link:', err);
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

    case 'INCOMING_CALL':
      // Foreground arrival of an in-app call. Background-state arrivals
      // are already handled by index.js's FCM handler (which displays
      // the native CallKeep ring); this branch covers the case where
      // the app is open when the push lands and presents our own
      // in-app incoming-call UI.
      if (data.callId) {
        navigate('IncomingCall', {
          callId: data.callId,
          roomName: data.roomName,
          callerId: data.callerId,
          callerName: data.callerName,
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

/**
 * Inner app content — rendered inside AppProvider so it can access useApp()
 */
function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [maintenanceInfo, setMaintenanceInfo] = useState<any>(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const { markInitialLoadComplete, user, userType, isAuthenticated } = useApp();

  // Set Crashlytics user context when auth state changes
  // Only send non-PII identifiers — no email, no name
  useEffect(() => {
    if (crashlytics && isAuthenticated && user) {
      try {
        const u = user as any;
        const userId = String(u?.mongoId ?? u?._id ?? '');
        if (userId) {
          crashlytics().setUserId(userId);
        }
        crashlytics().setAttributes({
          userType: userType || 'unknown',
        });
      } catch (e) {
        // Crashlytics not available
      }
    }
  }, [isAuthenticated, user, userType]);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
    // Notify AppContext that splash is done — enables aggressive account checks
    markInitialLoadComplete();
  }, [markInitialLoadComplete]);

  // Shared version/maintenance check — runs on launch and on foreground resume
  const runVersionCheck = useCallback(() => {
    (checkForAppUpdate() as Promise<any>).then((info) => {
      if (info) {
        if (info.maintenance) {
          setMaintenanceInfo(info);
          setShowMaintenanceModal(true);
          setShowUpdateModal(false);
        } else {
          setMaintenanceInfo(null);
          setShowMaintenanceModal(false);
          setUpdateInfo(info);
          setShowUpdateModal(true);
        }
      } else {
        // No update/maintenance — clear any active modals
        setMaintenanceInfo(null);
        setShowMaintenanceModal(false);
      }
    });
  }, []);

  useEffect(() => {
    // Check on launch
    runVersionCheck();

    // Re-check when app returns from background
    const subscription = AppState.addEventListener('change', (nextState: string) => {
      if (nextState === 'active') {
        runVersionCheck();
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

    // In-app calling (demo branch): foreground arrivals of an
    // INCOMING_CALL push need to surface the ring UI immediately —
    // this is the WhatsApp / Signal pattern, NOT the default FCM
    // banner-then-tap. Other notification types still go through the
    // existing tap-driven flow via setupNotificationOpenedHandler.
    const unsubscribeForeground = setupForegroundMessageListener((remoteMessage: any) => {
      const data = remoteMessage?.data || {};
      if (data.type !== 'INCOMING_CALL' || !data.callId) return;
      // WhatsApp-style: route directly to the in-app IncomingCallScreen.
      // No native CallKeep ring (looks like a real phone call, registers
      // an "in call" status with Android Telecom even before answer).
      // The IncomingCallScreen owns its own accept/reject buttons and
      // calls iacax /accept | /reject directly.
      setPendingIncomingCall({
        callId: data.callId,
        roomName: data.roomName,
        callerId: data.callerId,
        callerName: data.callerName,
        calleeType: data.calleeType,
      });
      navigate('IncomingCall', {
        callId: data.callId,
        roomName: data.roomName,
        callerId: data.callerId,
        callerName: data.callerName,
      });
    });

    // In-app calling (demo branch): boot CallKeep and bridge native
    // ring-UI events into our navigation. answerCall fires when the
    // user taps Accept on the lockscreen ring (background path); we
    // call /accept on iacax and route to InCall. endCall covers both
    // explicit Reject taps and the OS auto-end when the user leaves
    // the lockscreen UI without answering.
    setupCallKeep();
    const unsubscribeCallKeep = registerCallKeepListeners({
      onAnswer: async (callUUID: string) => {
        const pending = await consumePendingIncomingCall();
        try {
          const res = await acceptIacaxCall(callUUID);
          // CRITICAL: transition the native call from RINGING to ACTIVE
          // so Android's Telecom service unmutes the microphone. Without
          // this, LiveKit connects but no audio flows in either direction.
          setCallActive(callUUID);
          navigate('InCall', {
            callId: res.callId,
            roomName: res.roomName,
            token: res.token,
            livekitUrl: res.livekitUrl,
            mode: 'incoming',
            otherPartyId: pending?.callerId,
            otherPartyName: pending?.callerName || 'Incoming call',
          });
        } catch (err: any) {
          console.warn('[CallKeep] accept failed:', err?.parsed?.code || err?.message);
          endCallNative(callUUID);
        }
      },
      onEnd: async (callUUID: string) => {
        await consumePendingIncomingCall();
        try {
          await rejectIacaxCall(callUUID, 'declined');
        } catch (err: any) {
          // The call may already be terminated server-side (timeout,
          // caller cancelled). Best-effort.
          console.log('[CallKeep] reject noop:', err?.parsed?.code || err?.message);
        }
      },
    });

    return () => {
      subscription.remove();
      if (unsubscribe) {
        unsubscribe();
      }
      unsubscribeForeground?.();
      unsubscribeCallKeep?.();
    };
  }, [runVersionCheck]);

  return (
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

        {/* Maintenance Modal — blocks app when maintenance is active */}
        <MaintenanceModal
          visible={showMaintenanceModal && !showSplash}
          info={maintenanceInfo}
        />

        {/* App Update Modal — shown above everything when update needed */}
        <AppUpdateModal
          visible={showUpdateModal && !showSplash && !showMaintenanceModal}
          updateInfo={updateInfo}
          onDismiss={() => setShowUpdateModal(false)}
        />

        {/* Splash Screen - shows on app launch */}
        <SplashScreen
          visible={showSplash}
          onFinish={handleSplashFinish}
        />
      </View>
      </DialogProvider>
    </LocationProvider>
  );
}

export default function App() {
  useEffect(() => {
    // Configure Google Sign-In on app start
    configureGoogleSignIn();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
      <SafeAreaProvider>
      <LanguageProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
      </LanguageProvider>
      </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
