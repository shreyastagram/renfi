/**
 * Root Navigator
 * 
 * Main navigation structure for the app
 * Handles auth state and navigation between screens
 * Includes deep linking for email verification
 * Routes to different home screens based on user type
 * 
 * User: Bottom Tab Navigation (Home, History, Settings, Profile)
 * Provider: Stack Navigation (same as before)
 * 
 * @version 6.0.0
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../src/context/AppContext';
import { Icon } from '../src/components';

// Screens from src folder
import { 
  UserTypeScreen, 
  UserAuthScreen,
  ProviderAuthScreen, 
  HomeScreen,
  UserHomeScreen,
  ProviderHomeScreen,
  ProfileScreen,
  SettingsScreen,
  VerificationScreen,
  EmailVerifyHandlerScreen,
  CreateServiceRequestScreen,
  ProviderRequestsScreen,
  ProviderServiceHistoryScreen,
  UserServiceHistoryScreen,
  ServiceRequestDetailScreen,
} from '../src/screens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Deep linking configuration
 */
export const linking = {
  prefixes: ['fixhomi://', 'https://fixhomi.com'],
  config: {
    screens: {
      // Auth screens
      Auth: {
        screens: {
          UserType: 'user-type',
          UserAuth: 'user-auth',
          ProviderAuth: 'provider-auth',
        },
      },
      // Main app screens
      Main: {
        screens: {
          Home: 'home',
          Verification: 'verification/:type?',
          CreateServiceRequest: 'create-service-request',
          ProviderRequests: 'provider-requests',
          EmailVerifyHandler: {
            path: 'auth/email-verify',
            parse: {
              token: (token) => token,
            },
          },
        },
      },
      // Direct deep link handlers
      EmailVerifyHandler: {
        path: 'auth/email-verify',
        parse: {
          token: (token) => token,
        },
      },
    },
  },
};

/**
 * Custom Tab Bar Icon
 */
const TabBarIcon = ({ focused, iconName, label }) => {
  const color = focused ? '#2563EB' : '#9CA3AF';
  
  return (
    <View style={styles.tabIconContainer}>
      <Icon name={iconName} size={24} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </View>
  );
};

/**
 * User Tab Navigator - Instagram-style bottom tabs
 */
const UserTabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 60 + (Platform.OS === 'ios' ? insets.bottom : 0),
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={UserHomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} iconName="home" label="Home" />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={UserServiceHistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} iconName="history" label="History" />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} iconName="settings" label="Settings" />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} iconName="user" label="Profile" />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * Auth Navigator - Screens for non-authenticated users
 */
const AuthNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="UserType" component={UserTypeScreen} />
      <Stack.Screen name="UserAuth" component={UserAuthScreen} />
      <Stack.Screen name="ProviderAuth" component={ProviderAuthScreen} />
    </Stack.Navigator>
  );
};

/**
 * User Main Navigator - For authenticated users with bottom tabs
 */
const UserMainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="UserTabs" component={UserTabNavigator} />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Verification" 
        component={VerificationScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="CreateServiceRequest" 
        component={CreateServiceRequestScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="UserServiceHistory" 
        component={UserServiceHistoryScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="ServiceRequestDetail" 
        component={ServiceRequestDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="EmailVerifyHandler" 
        component={EmailVerifyHandlerScreen}
        options={{ animation: 'fade' }}
      />
    </Stack.Navigator>
  );
};

/**
 * Provider Main Navigator - Screens for authenticated providers
 */
const ProviderMainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home" component={ProviderHomeScreen} />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Verification" 
        component={VerificationScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="ProviderRequests" 
        component={ProviderRequestsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="ProviderServiceHistory" 
        component={ProviderServiceHistoryScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="ServiceRequestDetail" 
        component={ServiceRequestDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="EmailVerifyHandler" 
        component={EmailVerifyHandlerScreen}
        options={{ animation: 'fade' }}
      />
    </Stack.Navigator>
  );
};

/**
 * Loading Screen - Shown while checking auth status
 */
const LoadingScreen = () => {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
};

/**
 * Root Navigator Component
 */
const RootNavigator = () => {
  const { isAuthenticated, isAuthLoading, userType } = useApp();

  // Show loading while checking auth status
  if (isAuthLoading) {
    return <LoadingScreen />;
  }

  // Show auth screens if not authenticated
  if (!isAuthenticated) {
    return <AuthNavigator />;
  }

  // Route to appropriate navigator based on user type
  if (userType === 'provider') {
    return <ProviderMainNavigator />;
  }
  
  return <UserMainNavigator />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default RootNavigator;
