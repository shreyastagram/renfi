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
 * @version 8.0.0 - Added Emergency, Event, Favorites screens
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Dimensions, Pressable, Image } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../src/context/AppContext';
import { LocationSharingProvider } from '../src/context/LocationSharingContext';

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
  AccountSecurityScreen,
  VerificationScreen,
  EmailVerifyHandlerScreen,
  CreateServiceRequestScreen,
  ProviderServiceHistoryScreen,
  UserServiceHistoryScreen,
  ServiceRequestDetailScreen,
  DocumentVerificationScreen,
  ServiceApprovalsScreen,
  LiveTrackingScreen,
  ForgotPasswordScreen,
  ChangePasswordScreen,
  EmergencyServicesScreen,
  EventServicesScreen,
  FavoritesScreen,
  PortfolioEditScreen,
  SubscriptionScreen,
  VerificationDashboardScreen,
  InsuranceScreen,
  ReferralScreen,
  PSAContactsScreen,
  PSATriggerScreen,
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
        },
      },
      // Direct deep link handlers (accessible regardless of auth state)
      EmailVerifyHandler: {
        path: 'auth/email-verify',
        parse: {
          token: (token) => token,
        },
      },
      // Email verified callback from web page
      EmailVerified: {
        path: 'email-verified',
        parse: {
          email: (email) => decodeURIComponent(email || ''),
          status: (status) => status,
          message: (message) => decodeURIComponent(message || ''),
        },
      },
      // Note: aadhaar-verification deep links are handled by AadhaarVerificationModal
      // via Linking.addEventListener — NOT by React Navigation
    },
  },
};

/**
 * Tab Icon Component - Unified styling for both User and Provider tabs
 * Uses proper icon families with consistent sizing
 */
const VERIFIED_BLUE = '#2b76bc';

const TabIcon = React.memo(({ focused, iconFamily, iconName, focusedIconName, label, profilePicture }) => {
  const activeColor = VERIFIED_BLUE;
  const inactiveColor = BRAND.gray;
  const color = focused ? activeColor : inactiveColor;
  const currentIcon = focused && focusedIconName ? focusedIconName : iconName;
  const iconSize = 24;

  const renderIcon = () => {
    // Profile picture avatar for Profile tab
    if (profilePicture) {
      const uri = typeof profilePicture === 'string' ? profilePicture : profilePicture?.url;
      if (uri) {
        return (
          <View style={[styles.tabAvatar, focused && styles.tabAvatarFocused]}>
            <Image source={{ uri }} style={styles.tabAvatarImg} />
          </View>
        );
      }
    }
    switch (iconFamily) {
      case 'MaterialCommunityIcons':
        return <MaterialCommunityIcons name={currentIcon} size={iconSize} color={color} />;
      case 'Ionicons':
        return <Ionicons name={currentIcon} size={iconSize} color={color} />;
      default:
        return <MaterialCommunityIcons name={currentIcon} size={iconSize} color={color} />;
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
});

/**
 * Shared Tab Bar Styles - Production Grade
 *
 * iOS: insets.bottom is ~34 on Face ID devices, 0 on older.
 *      We use the full inset so the bar extends into the home indicator area
 *      but keep the tab content above it.
 * Android gesture nav: insets.bottom is 0 — small fixed padding.
 * Android 3-button nav: insets.bottom is ~48 — we need padding above the buttons.
 */
const getTabBarStyle = (insets) => {
  let bottomPadding;

  if (Platform.OS === 'ios') {
    // iOS home indicator is ~34px but we only need enough to clear it
    // Not the full inset — that creates too much white space
    bottomPadding = insets.bottom > 0 ? Math.min(insets.bottom, 20) : 4;
  } else {
    // Android: insets.bottom > 0 means 3-button/2-button nav bar is present
    // insets.bottom === 0 means gesture navigation (no bar)
    bottomPadding = insets.bottom > 0 ? insets.bottom : 8;
  }

  return {
    height: 56 + bottomPadding,
    paddingTop: 8,
    paddingBottom: bottomPadding,
    paddingHorizontal: 8,
    backgroundColor: BRAND.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 12,
      },
    }),
  };
};

/**
 * User Tab Navigator - Clean Production Tab Bar
 */
const UserTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { user, profile } = useApp();
  const profilePicture = useMemo(() => profile?.profilePicture || user?.profilePicture, [profile?.profilePicture, user?.profilePicture]);

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: getTabBarStyle(insets),
        tabBarHideOnKeyboard: true,
        freezeOnBlur: true,
        animation: 'none',
        tabBarButton: (props) => (
          <Pressable {...props} android_ripple={null} />
        ),
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={UserHomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              iconFamily="MaterialCommunityIcons"
              iconName="home-variant-outline"
              focusedIconName="home-variant"
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
              iconName="clipboard-text-clock-outline"
              focusedIconName="clipboard-text-clock"
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
              focusedIconName="settings"
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
              iconFamily="MaterialCommunityIcons"
              iconName="account-circle-outline"
              focusedIconName="account-circle"
              label="Profile"
              profilePicture={profilePicture}
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
  const { user, profile } = useApp();
  const profilePicture = useMemo(() => profile?.profilePicture || user?.profilePicture, [profile?.profilePicture, user?.profilePicture]);

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: getTabBarStyle(insets),
        tabBarHideOnKeyboard: true,
        freezeOnBlur: true,
        animation: 'none',
        tabBarButton: (props) => (
          <Pressable {...props} android_ripple={null} />
        ),
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={ProviderHomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              iconFamily="MaterialCommunityIcons"
              iconName="home-variant-outline"
              focusedIconName="home-variant"
              label="Home"
            />
          ),
        }}
      />
      <Tab.Screen
        name="JobsTab"
        component={ProviderServiceHistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              iconFamily="MaterialCommunityIcons"
              iconName="hammer-wrench"
              focusedIconName="hammer-wrench"
              label="Jobs"
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
              focusedIconName="settings"
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
              iconFamily="MaterialCommunityIcons"
              iconName="account-circle-outline"
              focusedIconName="account-circle"
              label="Profile"
              profilePicture={profilePicture}
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
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
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
      <Stack.Screen 
        name="ChangePassword" 
        component={ChangePasswordScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="AccountSecurity" 
        component={AccountSecurityScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="EmergencyServices" 
        component={EmergencyServicesScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="EventServices" 
        component={EventServicesScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Favorites" 
        component={FavoritesScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="PortfolioEdit"
        component={PortfolioEditScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ReferralScreen"
        component={ReferralScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="PSAContacts"
        component={PSAContactsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="PSATrigger"
        component={PSATriggerScreen}
        options={{ animation: 'slide_from_bottom' }}
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
        component={ProviderServiceHistoryScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ProviderRequests"
        component={ProviderServiceHistoryScreen}
        options={{ animation: 'slide_from_right' }}
        initialParams={{ tab: 'pending' }}
      />
      <Stack.Screen
        name="ProviderServiceHistory"
        component={ProviderServiceHistoryScreen}
        options={{ animation: 'slide_from_right' }}
        initialParams={{ tab: 'completed' }}
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
      <Stack.Screen 
        name="ChangePassword" 
        component={ChangePasswordScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="AccountSecurity" 
        component={AccountSecurityScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="PortfolioEdit" 
        component={PortfolioEditScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Subscription" 
        component={SubscriptionScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="VerificationDashboard"
        component={VerificationDashboardScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Insurance"
        component={InsuranceScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ReferralScreen"
        component={ReferralScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="PSAContacts"
        component={PSAContactsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="PSATrigger"
        component={PSATriggerScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      {/* Emergency helpline numbers — same screen Users use; opened in
       * numbers-only mode from the Provider Home "Emergency Numbers" entry. */}
      <Stack.Screen
        name="EmergencyServices"
        component={EmergencyServicesScreen}
        options={{ animation: 'slide_from_right' }}
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
  // LocationSharingProvider wraps the entire provider session so the GPS
  // watcher + socket listeners stay alive regardless of screen navigation.
  if (userType === 'provider') {
    return (
      <LocationSharingProvider>
        <ProviderMainNavigator />
      </LocationSharingProvider>
    );
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
    width: (SCREEN_WIDTH - 16) / 4,
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
  tabAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: BRAND.gray,
    overflow: 'hidden',
  },
  tabAvatarFocused: {
    borderColor: VERIFIED_BLUE,
    borderWidth: 2,
  },
  tabAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
  },
});

export default RootNavigator;
