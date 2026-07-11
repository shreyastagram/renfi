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

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Pressable, Image, Animated, Keyboard } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import { House, History, Wrench, Settings, CircleUserRound } from 'lucide-react-native';
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
 * Tab Icon Component — modern lucide icons with an animated soft pill
 * highlight behind the active tab (Material 3 style). Accent color follows
 * the role: blue for users, orange for providers.
 */
const VERIFIED_BLUE = '#2b76bc';

// Lucide icon per tab key — crisp geometric line icons
const TAB_ICONS = {
  home: House,
  history: History,
  jobs: Wrench,
  settings: Settings,
  profile: CircleUserRound,
};

// The active highlight is now the GLIDING GLASS LENS in FloatingTabBar —
// TabIcon only renders the icon/avatar + label with focus color changes.
const TabIcon = React.memo(({ focused, icon, label, accent = VERIFIED_BLUE, profilePicture }) => {
  const color = focused ? accent : BRAND.gray;
  const IconCmp = TAB_ICONS[icon] || House;

  // Profile tab shows the avatar when a picture exists
  const avatarUri = profilePicture
    ? (typeof profilePicture === 'string' ? profilePicture : profilePicture?.url)
    : null;

  return (
    <View style={styles.tabIconWrapper}>
      <View style={styles.tabPillSlot}>
        {avatarUri ? (
          <View style={[styles.tabAvatar, focused && { borderColor: accent, borderWidth: 2 }]}>
            <Image source={{ uri: avatarUri }} style={styles.tabAvatarImg} />
          </View>
        ) : (
          <IconCmp size={22} color={color} strokeWidth={focused ? 2.4 : 1.9} />
        )}
      </View>
      <Text
        style={[styles.tabLabelText, { color }, focused && styles.tabLabelActive]}
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {label}
      </Text>
    </View>
  );
});

/**
 * Floating Pill Tab Bar — custom tabBar (React Navigation first-class API).
 *
 * Why custom: bottom-tabs v7 gives tabBarIcon a fixed ~28px wrapper and
 * absolutely centers the icon over it, so a taller icon+label block can never
 * be vertically balanced through tabBarStyle alone. A custom bar also removes
 * every docked surface behind the pill (no corner artifacts) and lets screen
 * content scroll behind it, reinforcing the floating effect.
 *
 * Insets: bottom offset = safe-area bottom + breathing room, so the pill
 * clears the iOS home indicator, Android gesture hint, and Android
 * 3-button nav bars alike (Samsung/Redmi/Vivo/Oppo/Pixel).
 */
// Tinted liquid-glass palette (approved mockup): light brand wash over real
// blur, brand-tinted gliding lens, specular edge + outer hairline so the bar
// separates cleanly even on pure-white screens (Settings).
const GLASS = {
  user: {
    tint: Platform.OS === 'ios' ? 'rgba(230, 240, 250, 0.38)' : 'rgba(237, 244, 251, 0.84)',
    lensBg: 'rgba(43, 118, 188, 0.14)',
    lensBorder: 'rgba(43, 118, 188, 0.22)',
    fallback: '#EDF4FB',
  },
  provider: {
    tint: Platform.OS === 'ios' ? 'rgba(253, 240, 229, 0.42)' : 'rgba(252, 242, 233, 0.84)',
    lensBg: 'rgba(246, 124, 22, 0.15)',
    lensBorder: 'rgba(246, 124, 22, 0.24)',
    fallback: '#FCF2E9',
  },
};

const LENS_INSET_X = 5; // horizontal gap between lens and item edge

const FloatingTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const routeCount = state.routes.length;

  // Role from route shape (JobsTab exists only in the provider navigator)
  const glass = state.routes.some((r) => r.name === 'JobsTab') ? GLASS.provider : GLASS.user;

  // ── Gliding glass lens ──
  // Animate the tab INDEX (0..N-1) with a spring; translateX is interpolated
  // from it. A brief squash-stretch runs in parallel for the watery feel.
  // All native-driver — never touches the JS thread mid-glide.
  const [barWidth, setBarWidth] = useState(0);
  const lensIndex = useRef(new Animated.Value(state.index)).current;
  const stretch = useRef(new Animated.Value(0)).current; // 0 = round, 1 = stretched
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      // First layout: place the lens without animating
      mountedRef.current = true;
      lensIndex.setValue(state.index);
      return;
    }
    Animated.parallel([
      Animated.spring(lensIndex, {
        toValue: state.index,
        useNativeDriver: true,
        stiffness: 180,
        damping: 16,
        mass: 1,
      }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.spring(stretch, { toValue: 0, useNativeDriver: true, stiffness: 240, damping: 13 }),
      ]),
    ]).start();
  }, [state.index, lensIndex, stretch]);

  // Hide while the keyboard is open (custom bars must handle this themselves)
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (keyboardVisible) {
    return null;
  }

  // Standard React Navigation contract: a screen can hide the bar with
  // navigation.setOptions({ tabBarStyle: { display: 'none' } }) — used by
  // flows with their own bottom CTA (e.g. UserHome booking sheet, whose
  // Create Request button the floating pill would otherwise cover).
  const focusedOptions = descriptors[state.routes[state.index].key]?.options;
  if (focusedOptions?.tabBarStyle?.display === 'none') {
    return null;
  }

  // Gesture nav (inset 0) → 16px float; home indicator / 3-button nav →
  // sit 6px above the system area.
  const bottomOffset = Math.max(insets.bottom + 6, 16);

  // Lens geometry — items span the full bar width (no side padding), so the
  // lens for tab i sits at i*itemW + LENS_INSET_X and is itemW − 2*inset wide.
  const itemW = barWidth > 0 ? barWidth / routeCount : 0;
  const lensW = Math.max(itemW - LENS_INSET_X * 2, 0);
  const lensTranslate = lensIndex.interpolate({
    inputRange: [0, Math.max(routeCount - 1, 1)],
    outputRange: [LENS_INSET_X, (routeCount - 1) * itemW + LENS_INSET_X],
  });
  const lensScaleX = stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const lensScaleY = stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] });

  return (
    <View pointerEvents="box-none" style={[styles.floatWrap, { bottom: bottomOffset }]}>
      {/* Outer layer carries the shadow (must not clip) */}
      <View style={styles.floatShadow}>
        {/* Inner layer clips the glass stack to the capsule */}
        <View
          style={[styles.floatPill, { backgroundColor: glass.fallback }]}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        >
          {/* Real frosted blur (iOS: UIVisualEffectView; Android: blur impl) */}
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="light"
            blurAmount={22}
            reducedTransparencyFallbackColor={glass.fallback}
          />
          {/* Brand tint wash over the blur */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: glass.tint }]} />

          {/* Gliding glass lens — spans the full icon+label block, centered */}
          {barWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.lens,
                {
                  width: lensW,
                  backgroundColor: glass.lensBg,
                  borderColor: glass.lensBorder,
                  transform: [
                    { translateX: lensTranslate },
                    { scaleX: lensScaleX },
                    { scaleY: lensScaleY },
                  ],
                },
              ]}
            />
          )}


          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.floatItem}
                android_ripple={null}
              >
                {options.tabBarIcon?.({ focused, color: BRAND.gray, size: 24 })}
              </Pressable>
            );
          })}
        </View>
        {/* Outer hairline — separates the bar from pure-white screens */}
        <View pointerEvents="none" style={styles.pillRing} />
      </View>
    </View>
  );
};

const renderFloatingTabBar = (props) => <FloatingTabBar {...props} />;

/**
 * User Tab Navigator - Clean Production Tab Bar
 */
const UserTabNavigator = () => {
  const { user, profile } = useApp();
  const profilePicture = useMemo(() => profile?.profilePicture || user?.profilePicture, [profile?.profilePicture, user?.profilePicture]);

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      backBehavior="initialRoute"
      tabBar={renderFloatingTabBar}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        animation: 'none',
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={UserHomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="home" label="Home" accent={VERIFIED_BLUE} />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={UserServiceHistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="history" label="History" accent={VERIFIED_BLUE} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="settings" label="Settings" accent={VERIFIED_BLUE} />
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
              icon="profile"
              label="Profile"
              accent={VERIFIED_BLUE}
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
  const { user, profile } = useApp();
  const profilePicture = useMemo(() => profile?.profilePicture || user?.profilePicture, [profile?.profilePicture, user?.profilePicture]);

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      backBehavior="initialRoute"
      tabBar={renderFloatingTabBar}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        animation: 'none',
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={ProviderHomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="home" label="Home" accent={BRAND.orange} />
          ),
        }}
      />
      <Tab.Screen
        name="JobsTab"
        component={ProviderServiceHistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="jobs" label="Jobs" accent={BRAND.orange} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="settings" label="Settings" accent={BRAND.orange} />
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
              icon="profile"
              label="Profile"
              accent={BRAND.orange}
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
  
  // Floating liquid-glass tab bar
  floatWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  // Shadow layer — separate from the clipping layer (iOS shadows are killed
  // by overflow:'hidden'; Android elevation needs an unclipped outline)
  floatShadow: {
    width: '100%',
    borderRadius: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 28,
      },
      android: {
        elevation: 14,
      },
    }),
  },
  // Clip layer — the glass stack (blur → tint → lens → specular → tabs)
  floatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  // Gliding glass lens — full height of the icon+label block, centered
  lens: {
    position: 'absolute',
    top: 7,
    bottom: 7,
    left: 0,
    borderRadius: 25,
    borderWidth: 1,
  },
  // Very thin dark edge with depth — no white rim; the tinted glass flows
  // right into the border, iOS-style
  pillRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.22)',
  },
  floatItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab item content — icon + label as ONE centered block; the gliding lens
  // (not a per-icon bubble) provides the highlight, so the whole block sits
  // dead-center inside it.
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fixed-height slot so icons and avatars align across tabs
  tabPillSlot: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabelText: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  tabAvatar: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    borderWidth: 1.5,
    borderColor: BRAND.gray,
    overflow: 'hidden',
  },
  tabAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12.5,
  },
});

export default RootNavigator;
