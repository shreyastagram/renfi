/**
 * Root Navigator
 * 
 * Main navigation structure for the app
 * Handles auth state and navigation between screens
 * Includes deep linking for email verification
 * Routes to different home screens based on user type
 * 
 * User: Bottom Tab Navigation (Home, History, Settings, Profile)
 * Provider: Bottom Tab Navigation (Home, Jobs, Settings, Profile)
 * 
 * @version 7.0.0 - Production Grade with Provider Tab Navigation
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../src/context/AppContext';

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
  ProviderJobsScreen,
  UserServiceHistoryScreen,
  ServiceRequestDetailScreen,
  DocumentVerificationScreen,
  ServiceApprovalsScreen,
  LiveTrackingScreen,
} from '../src/screens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Brand Colors
const BRAND = {
  primary: '#2563EB',
  secondary: '#7C3AED',
  orange: '#F67C16',
  white: '#FFFFFF',
  gray: '#9CA3AF',
  grayLight: '#F3F4F6',
  border: '#E5E7EB',
  text: '#1F2937',
};

// Screen dimensions
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
 * Tab Icon Component - Unified styling for both User and Provider tabs
 * Uses proper icon families with consistent sizing
 */
const TabIcon = ({ focused, iconFamily, iconName, label, isProvider = false }) => {
  const activeColor = isProvider ? BRAND.secondary : BRAND.primary;
  const inactiveColor = BRAND.gray;
  const color = focused ? activeColor : inactiveColor;
  
  // Render icon based on family
  const renderIcon = () => {
    const iconSize = 22;
    
    switch (iconFamily) {
      case 'MaterialCommunityIcons':
        return <MaterialCommunityIcons name={iconName} size={iconSize} color={color} />;
      case 'Feather':
        return <Feather name={iconName} size={iconSize} color={color} />;
      case 'Ionicons':
        return <Ionicons name={iconName} size={iconSize} color={color} />;
      default:
        return <Feather name={iconName} size={iconSize} color={color} />;
    }
  };

  return (
    <View style={styles.tabIconWrapper}>
      {renderIcon()}
      <Text 
        style={[
          styles.tabLabelText,
          { color },
          focused && styles.tabLabelActive,
        ]}
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {label}
      </Text>
    </View>
  );
};

/**
 * Shared Tab Bar Styles - Production Grade
 */
const getTabBarStyle = (insets, isProvider = false) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: 65 + (Platform.OS === 'ios' ? insets.bottom : 0),
  paddingTop: 10,
  paddingBottom: Platform.OS === 'ios' ? insets.bottom : 12,
  paddingHorizontal: 8,
  backgroundColor: BRAND.white,
  borderTopWidth: 1,
  borderTopColor: BRAND.border,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 16,
});

/**
 * User Tab Navigator - Clean Production Tab Bar
 */
const UserTabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: getTabBarStyle(insets, false),
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={UserHomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconFamily="Feather" 
              iconName="home" 
              label="Home" 
            />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={UserServiceHistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconFamily="MaterialCommunityIcons" 
              iconName="history" 
              label="History" 
            />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconFamily="Ionicons" 
              iconName="settings-outline" 
              label="Settings" 
            />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconFamily="Feather" 
              iconName="user" 
              label="Profile" 
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * Provider Tab Navigator - Clean Production Tab Bar
 * Provider-specific workflow with Jobs, History integration
 */
const ProviderTabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: getTabBarStyle(insets, true),
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={ProviderHomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconFamily="Feather" 
              iconName="home" 
              label="Home" 
              isProvider={true}
            />
          ),
        }}
      />
      <Tab.Screen
        name="JobsTab"
        component={ProviderJobsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconFamily="MaterialCommunityIcons" 
              iconName="briefcase-outline" 
              label="Jobs" 
              isProvider={true}
            />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconFamily="Ionicons" 
              iconName="settings-outline" 
              label="Settings" 
              isProvider={true}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconFamily="Feather" 
              iconName="user" 
              label="Profile" 
              isProvider={true}
            />
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
        name="DocumentVerification" 
        component={ServiceApprovalsScreen}
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
        name="LiveTracking" 
        component={LiveTrackingScreen}
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
 * Provider Main Navigator - For authenticated providers with bottom tabs
 */
const ProviderMainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ProviderTabs" component={ProviderTabNavigator} />
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
        name="DocumentVerification" 
        component={ServiceApprovalsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Verification" 
        component={VerificationScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="ProviderJobs" 
        component={ProviderJobsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      {/* Legacy routes - redirect to unified ProviderJobs */}
      <Stack.Screen 
        name="ProviderRequests" 
        component={ProviderJobsScreen}
        options={{ animation: 'slide_from_right' }}
        initialParams={{ tab: 'requests' }}
      />
      <Stack.Screen 
        name="ProviderServiceHistory" 
        component={ProviderJobsScreen}
        options={{ animation: 'slide_from_right' }}
        initialParams={{ tab: 'history' }}
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
      <ActivityIndicator size="large" color={BRAND.primary} />
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
  // Loading Screen
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND.white,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  
  // Tab Bar Styles - Production Grade
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: (SCREEN_WIDTH - 16) / 4, // Equal distribution for 4 tabs
    paddingTop: 2,
  },
  tabLabelText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '600',
  },
});

export default RootNavigator;
