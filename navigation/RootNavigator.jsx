import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext.js';

// Auth screens
import HomeScreen from '../screens/HomeScreen.jsx';
import UserLoginSignup from '../screens/UserLoginSignup.jsx';
import ProviderLoginSignup from '../screens/ProviderLoginSignup.jsx';
import PhoneVerificationScreen from '../screens/PhoneVerificationScreen.jsx';
import SignupVerificationScreen from '../screens/SignupVerificationScreen.jsx';
import VerifyEmailScreen from '../screens/VerifyEmailScreen.jsx';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen.jsx';
import ResetPasswordScreen from '../screens/ResetPasswordScreen.jsx';
import WelcomeScreen from '../screens/WelcomeScreen.jsx';

// Main screens - import from MainNavigator or directly
import MainNavigator from './MainNavigator.jsx';

const Stack = createNativeStackNavigator();

/**
 * RootNavigator - Production-grade navigation with proper deep linking support
 * 
 * ARCHITECTURE:
 * - Single Stack Navigator at root level for proper deep linking
 * - Deep link screens (ResetPassword, VerifyEmail) are at root level
 * - Conditional screen rendering based on auth state (React Navigation best practice)
 * - Welcome screen handled as initial route when not shown
 * 
 * DEEP LINKING:
 * - fixhomi://reset-password?token=xxx → ResetPassword screen
 * - fixhomi://verify-email?token=xxx → VerifyEmail screen
 */
const RootNavigator = () => {
  const { isAuthenticated, isAuthLoading, userType, isWelcomeShown, setIsWelcomeShown } = useApp();

  // Debug logging
  useEffect(() => {
    console.log('🚀 RootNavigator state:', {
      isAuthLoading,
      isAuthenticated, 
      userType, 
      isWelcomeShown
    });
  }, [isAuthLoading, isAuthenticated, userType, isWelcomeShown]);

  // Show loading while checking auth state
  if (isAuthLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Determine initial route based on auth state
  const getInitialRouteName = () => {
    if (isAuthenticated) return 'Main';
    if (!isWelcomeShown) return 'Welcome';
    return 'Home';
  };

  console.log('🎯 RootNavigator initialRouteName:', getInitialRouteName());

  // Use a key that changes with auth state to force navigator remount
  // This ensures proper navigation when auth state changes
  const navigatorKey = isAuthenticated ? 'authenticated' : 'unauthenticated';

  return (
    <Stack.Navigator
      key={navigatorKey}
      initialRouteName={getInitialRouteName()}
      screenOptions={{
        headerBackTitleVisible: false,
      }}
    >
      {/* ============================================
          CONDITIONAL SCREENS based on auth state
          These are rendered first to set the initial route correctly
          ============================================ */}
      
      {isAuthenticated ? (
        // ============================================
        // AUTHENTICATED: Show Main App
        // ============================================
        <Stack.Screen
          name="Main"
          component={MainNavigator}
          options={{ 
            headerShown: false,
            gestureEnabled: false, // Prevent swipe back to auth
            animationTypeForReplace: 'push',
          }}
        />
      ) : (
        // ============================================
        // NOT AUTHENTICATED: Show Auth Flow
        // ============================================
        <>
          {!isWelcomeShown && (
            <Stack.Screen
              name="Welcome"
              options={{ headerShown: false }}
            >
              {(props) => (
                <WelcomeScreen 
                  {...props}
                  onGetStarted={() => {
                    setIsWelcomeShown(true);
                    props.navigation.replace('Home');
                  }}
                />
              )}
            </Stack.Screen>
          )}
          
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="UserLoginSignup"
            component={UserLoginSignup}
            options={{ title: 'User Login/Signup' }}
          />
          <Stack.Screen
            name="ProviderLoginSignup"
            component={ProviderLoginSignup}
            options={{ title: 'Service Provider Login/Signup' }}
          />
          <Stack.Screen
            name="PhoneVerification"
            component={PhoneVerificationScreen}
            options={{ 
              title: 'Verify Phone',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="SignupVerification"
            component={SignupVerificationScreen}
            options={{ 
              title: 'Verify Account',
              headerBackVisible: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ 
              title: 'Forgot Password',
              headerBackTitle: 'Back',
            }}
          />
        </>
      )}

      {/* ============================================
          DEEP LINK SCREENS (Always available)
          These are accessible regardless of auth state for deep linking
          ============================================ */}
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ 
          title: 'Reset Password',
          headerShown: false,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="VerifyEmail"
        component={VerifyEmailScreen}
        options={{ 
          title: 'Verify Email',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default RootNavigator;