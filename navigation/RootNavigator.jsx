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
import { View, Text, StyleSheet, ActivityIndicator, Platform, Pressable, Image, Animated, Keyboard, Dimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import { House, History, Wrench, Settings, CircleUserRound } from 'lucide-react-native';
import { setBarRect, subscribeTone } from '../src/components/tabBarTone';
import { useApp } from '../src/context/AppContext';
import { useLanguage } from '../src/context/LanguageContext';
import { LocationSharingProvider } from '../src/context/LocationSharingContext';

// Screens from src folder
import { 
  UserTypeScreen, 
  UserAuthScreen,
  ProviderAuthScreen,
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
  orange: '#F67C16',
  white: '#FFFFFF',
  gray: '#9CA3AF',
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

// The active highlight is the GLIDING GLASS LENS in FloatingTabBar.
// TabIcon renders icon/avatar + label for one TONE ('light' | 'dark') —
// the bar crossfades a light row and a dark row for the adaptive flip.
// Labels carry an adaptive halo (Apple's own legibility mechanism: soft
// glow that's invisible on flat backgrounds, decisive on busy imagery).
const TabIcon = React.memo(({ focused, icon, label, accent = VERIFIED_BLUE, profilePicture, tone = 'light' }) => {
  const dark = tone === 'dark';
  const color = dark
    ? (focused ? '#FFFFFF' : 'rgba(255,255,255,0.78)')
    : (focused ? accent : '#5F6774');
  const IconCmp = TAB_ICONS[icon] || House;

  // Arrival micro-bounce — the icon pops when its tab becomes active
  // (timed to land as the lens settles). Light row only; the dark overlay
  // row mirrors colors, not motion.
  const pop = useRef(new Animated.Value(1)).current;
  const prevFocused = useRef(focused);
  useEffect(() => {
    if (focused && !prevFocused.current && !dark) {
      Animated.sequence([
        Animated.delay(160),
        Animated.spring(pop, { toValue: 1.18, useNativeDriver: true, stiffness: 400, damping: 10 }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, stiffness: 300, damping: 12 }),
      ]).start();
    }
    prevFocused.current = focused;
  }, [focused, dark, pop]);

  // Profile tab shows the avatar when a picture exists
  const avatarUri = profilePicture
    ? (typeof profilePicture === 'string' ? profilePicture : profilePicture?.url)
    : null;

  return (
    <View style={styles.tabIconWrapper}>
      <Animated.View style={[styles.tabPillSlot, { transform: [{ scale: pop }] }]}>
        {avatarUri ? (
          <View style={[styles.tabAvatar, focused && { borderColor: dark ? '#FFFFFF' : accent, borderWidth: 2 }]}>
            <Image source={{ uri: avatarUri }} style={styles.tabAvatarImg} />
          </View>
        ) : (
          <IconCmp size={22} color={color} strokeWidth={focused ? 2.4 : 1.9} />
        )}
      </Animated.View>
      <Text
        style={[
          styles.tabLabelText,
          dark ? styles.tabLabelHaloDark : styles.tabLabelHaloLight,
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
// Liquid-glass material (final approved mockup): CLEAR glass — low blur,
// near-invisible brand tint; legibility comes from the adaptive halo on
// labels + the dark-variant flip, not from frosting.
// Android < 12 (API 31): BlurView is skipped (OEM perf varies on old
// devices) and the tint alone carries the surface — same edges, no blur.
const SUPPORTS_BLUR = Platform.OS === 'ios' || Number(Platform.Version) >= 31;

const GLASS = {
  user: {
    tint: SUPPORTS_BLUR ? 'rgba(235, 243, 250, 0.16)' : 'rgba(237, 244, 251, 0.88)',
    lensBg: 'rgba(43, 118, 188, 0.12)',
    lensBorder: 'rgba(43, 118, 188, 0.20)',
    fallback: '#EDF4FB',
  },
  provider: {
    tint: SUPPORTS_BLUR ? 'rgba(253, 242, 232, 0.18)' : 'rgba(252, 242, 233, 0.88)',
    lensBg: 'rgba(246, 124, 22, 0.13)',
    lensBorder: 'rgba(246, 124, 22, 0.22)',
    fallback: '#FCF2E9',
  },
};

// Dark variant — strong enough (0.55) that white text is guaranteed
// readable even when the bar half-overlaps a dark surface.
const DARK_TINT = 'rgba(18, 24, 34, 0.55)';
const DARK_LENS_BG = 'rgba(255, 255, 255, 0.16)';
const DARK_LENS_BORDER = 'rgba(255, 255, 255, 0.26)';

const LENS_INSET_X = 5; // horizontal gap between lens and item edge
const BAR_HEIGHT = 64;

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
  const energy = useRef(new Animated.Value(1)).current; // touch-down "gains energy"
  const dirOffset = useRef(new Animated.Value(0)).current; // ± px: gel-stretch toward travel direction
  const prevIndexRef = useRef(state.index);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      // First layout: place the lens without animating
      mountedRef.current = true;
      lensIndex.setValue(state.index);
      prevIndexRef.current = state.index;
      return;
    }
    // Direction of travel — the stretch anchors the trailing edge (liquid
    // pulled toward the target). RN transforms scale about the center, so
    // the anchor is emulated with a small translate correction.
    const dir = Math.sign(state.index - prevIndexRef.current) || 0;
    prevIndexRef.current = state.index;
    const lensWNow = barWidth > 0 ? barWidth / routeCount - LENS_INSET_X * 2 : 0;
    dirOffset.setValue(dir * lensWNow * 0.08);

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
  }, [state.index, lensIndex, stretch, dirOffset, barWidth, routeCount]);

  // ── Adaptive tone (iOS light/dark flip) ──
  // TabBarDarkZone components report dark coverage of the bar; hysteresis
  // (dark ≥30%, light ≤15%) prevents boundary flicker; a 350ms native-driver
  // crossfade drives the dark tint layer, dark tab row, dark lens and ring.
  const toneAnim = useRef(new Animated.Value(0)).current;
  const toneDarkRef = useRef(false);
  useEffect(() => {
    const unsub = subscribeTone((frac) => {
      const isDark = toneDarkRef.current;
      if (!isDark && frac >= 0.3) {
        toneDarkRef.current = true;
        Animated.timing(toneAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      } else if (isDark && frac <= 0.15) {
        toneDarkRef.current = false;
        Animated.timing(toneAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start();
      }
    });
    return unsub;
  }, [toneAnim]);

  // Touch-down energy — the lens swells instantly under the finger
  const onItemPressIn = () => {
    Animated.spring(energy, { toValue: 1.06, useNativeDriver: true, stiffness: 400, damping: 20 }).start();
  };
  const onItemPressOut = () => {
    Animated.spring(energy, { toValue: 1, useNativeDriver: true, stiffness: 300, damping: 18 }).start();
  };

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
  // flatten() so array-form or registered styles hide the bar too, matching the stock tab bar
  if (StyleSheet.flatten(focusedOptions?.tabBarStyle)?.display === 'none') {
    return null;
  }

  // Gesture nav (inset 0) → 16px float; home indicator / 3-button nav →
  // sit 6px above the system area.
  const bottomOffset = Math.max(insets.bottom + 6, 16);

  // Publish the bar's window rect so TabBarDarkZone can compute coverage
  const windowH = Dimensions.get('window').height;
  setBarRect({ top: windowH - bottomOffset - BAR_HEIGHT, bottom: windowH - bottomOffset });

  // Lens geometry — items span the full bar width (no side padding), so the
  // lens for tab i sits at i*itemW + LENS_INSET_X and is itemW − 2*inset wide.
  const itemW = barWidth > 0 ? barWidth / routeCount : 0;
  const lensW = Math.max(itemW - LENS_INSET_X * 2, 0);
  const lensTranslate = lensIndex.interpolate({
    inputRange: [0, Math.max(routeCount - 1, 1)],
    outputRange: [LENS_INSET_X, (routeCount - 1) * itemW + LENS_INSET_X],
  });
  // Base translate + directional gel-stretch correction (anchors trailing edge)
  const lensX = Animated.add(lensTranslate, Animated.multiply(stretch, dirOffset));
  const lensScaleX = Animated.multiply(
    stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }),
    energy
  );
  const lensScaleY = Animated.multiply(
    stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }),
    energy
  );
  // In-flight "energized" glow — brightens while stretching, calms on settle
  const glideGlow = stretch.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] });

  const renderTabs = (tone) =>
    state.routes.map((route, index) => {
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

      if (tone === 'dark') {
        // Non-interactive mirror row — crossfaded in over dark content
        return (
          <View key={route.key} style={styles.floatItem} pointerEvents="none">
            {options.tabBarIcon?.({ focused, color: BRAND.gray, size: 24, tone: 'dark' })}
          </View>
        );
      }
      return (
        <Pressable
          key={route.key}
          accessibilityRole="button"
          accessibilityState={focused ? { selected: true } : {}}
          accessibilityLabel={options.tabBarAccessibilityLabel}
          testID={options.tabBarButtonTestID}
          onPress={onPress}
          onPressIn={onItemPressIn}
          onPressOut={onItemPressOut}
          onLongPress={onLongPress}
          style={styles.floatItem}
          android_ripple={null}
        >
          {options.tabBarIcon?.({ focused, color: BRAND.gray, size: 24, tone: 'light' })}
        </Pressable>
      );
    });

  return (
    <View pointerEvents="box-none" style={[styles.floatWrap, { bottom: bottomOffset }]}>
      {/* Outer layer carries the shadow (must not clip) */}
      <View style={styles.floatShadow}>
        {/* Inner layer clips the glass stack to the capsule */}
        <View
          style={[styles.floatPill, { backgroundColor: SUPPORTS_BLUR ? 'transparent' : glass.fallback }]}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        >
          {/* Real clear-glass blur (low amount — Liquid Glass, not frosted).
              Skipped on Android < 12: tint alone carries the surface. */}
          {SUPPORTS_BLUR && (
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType="light"
              blurAmount={8}
              reducedTransparencyFallbackColor={glass.fallback}
            />
          )}
          {/* Brand tint wash (light variant) */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: glass.tint }]} />
          {/* Dark variant tint — crossfaded in when dark content is under the bar */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: DARK_TINT, opacity: toneAnim }]}
          />

          {/* Gliding glass lens — spans the full icon+label block, centered */}
          {barWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.lens,
                {
                  width: lensW,
                  transform: [{ translateX: lensX }, { scaleX: lensScaleX }, { scaleY: lensScaleY }],
                },
              ]}
            >
              {/* light + dark lens skins, crossfaded with the tone */}
              <View style={[styles.lensSkin, { backgroundColor: glass.lensBg, borderColor: glass.lensBorder }]} />
              <Animated.View
                style={[styles.lensSkin, { backgroundColor: DARK_LENS_BG, borderColor: DARK_LENS_BORDER, opacity: toneAnim }]}
              />
              {/* in-flight energized glow */}
              <Animated.View style={[styles.lensSkin, styles.lensGlow, { opacity: glideGlow }]} />
            </Animated.View>
          )}

          {/* Interactive light row */}
          {renderTabs('light')}
          {/* Dark mirror row — crossfades over it when the material flips */}
          <Animated.View pointerEvents="none" style={[styles.darkRow, { opacity: toneAnim }]}>
            {renderTabs('dark')}
          </Animated.View>
        </View>
        {/* Depth hairlines — dark edge in light mode, light edge in dark mode */}
        <View pointerEvents="none" style={styles.pillRing} />
        <Animated.View pointerEvents="none" style={[styles.pillRing, styles.pillRingDark, { opacity: toneAnim }]} />
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
  const { t } = useLanguage();
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
          tabBarIcon: ({ focused, tone }) => (
            <TabIcon focused={focused} tone={tone} icon="home" label={t('nav.home')} accent={VERIFIED_BLUE} />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={UserServiceHistoryScreen}
        options={{
          tabBarIcon: ({ focused, tone }) => (
            <TabIcon focused={focused} tone={tone} icon="history" label={t('nav.history')} accent={VERIFIED_BLUE} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused, tone }) => (
            <TabIcon focused={focused} tone={tone} icon="settings" label={t('nav.settings')} accent={VERIFIED_BLUE} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused, tone }) => (
            <TabIcon
              tone={tone}
              focused={focused}
              icon="profile"
              label={t('nav.profile')}
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
  const { t } = useLanguage();
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
          tabBarIcon: ({ focused, tone }) => (
            <TabIcon focused={focused} tone={tone} icon="home" label={t('nav.home')} accent={BRAND.orange} />
          ),
        }}
      />
      <Tab.Screen
        name="JobsTab"
        component={ProviderServiceHistoryScreen}
        options={{
          tabBarIcon: ({ focused, tone }) => (
            <TabIcon focused={focused} tone={tone} icon="jobs" label={t('nav.jobs')} accent={BRAND.orange} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused, tone }) => (
            <TabIcon focused={focused} tone={tone} icon="settings" label={t('nav.settings')} accent={BRAND.orange} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused, tone }) => (
            <TabIcon
              tone={tone}
              focused={focused}
              icon="profile"
              label={t('nav.profile')}
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
  // Clip layer — the glass stack (blur → tint → lens → tabs)
  floatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  // Gliding glass lens — full height of the icon+label block, centered.
  // Colors live on the crossfaded skins, not the shell.
  lens: {
    position: 'absolute',
    top: 7,
    bottom: 7,
    left: 0,
    borderRadius: 25,
  },
  lensSkin: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  lensGlow: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 0,
  },
  // Dark mirror of the tab row — crossfaded in over dark content
  darkRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Very thin dark edge with depth — no white rim; the tinted glass flows
  // right into the border, iOS-style
  pillRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.22)',
  },
  pillRingDark: {
    borderColor: 'rgba(255,255,255,0.22)',
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
  // Adaptive halos — Apple's legibility mechanism: invisible on flat
  // backgrounds, decisive on busy imagery behind the clear glass
  tabLabelHaloLight: {
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  tabLabelHaloDark: {
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
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
