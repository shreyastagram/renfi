/**
 * Premium Drawer Menu Component
 * 
 * Ultra-smooth animated sidebar with glossy glass feel
 * Silky spring animations, staggered menu items, profile picture support
 * 
 * @version 4.0.0
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Linking,
  Alert,
  Image,
  ScrollView,
  Platform,
  Easing,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';

const FIXHOMI_LOGO = require('../assets/fixhomi_logo.jpg');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 330);

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  background: '#faf7f7',
  white: '#FFFFFF',
};

// Custom easing curves for ultra-smooth feel
const EASE_OUT_EXPO = Easing.bezier(0.19, 1, 0.22, 1);
const EASE_IN_EXPO = Easing.bezier(0.95, 0.05, 0.795, 0.035);

/**
 * Get user initials from name
 */
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Get profile picture URL — handles both string and object formats
 */
const getProfilePicUrl = (profilePicture) => {
  if (!profilePicture) return null;
  if (typeof profilePicture === 'string') return profilePicture;
  if (profilePicture.url) return profilePicture.url;
  return null;
};

// ─── Animated Hamburger Menu Button ────────────────────────────────────────────

export const MenuButton = ({ onPress, style, isOpen }) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: isOpen ? 1 : 0,
      damping: 18,
      stiffness: 140,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  const topRotate = animValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });
  const bottomRotate = animValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-45deg'] });
  const middleOpacity = animValue.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: 'clamp' });
  const topY = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const bottomY = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <TouchableOpacity style={[styles.menuButton, style]} onPress={onPress} activeOpacity={0.75}>
      <Animated.View style={[styles.menuLine, { transform: [{ translateY: topY }, { rotate: topRotate }] }]} />
      <Animated.View style={[styles.menuLine, styles.menuLineMiddle, { opacity: middleOpacity }]} />
      <Animated.View style={[styles.menuLine, { transform: [{ translateY: bottomY }, { rotate: bottomRotate }] }]} />
    </TouchableOpacity>
  );
};

// ─── Avatar Button ─────────────────────────────────────────────────────────────

export const AvatarButton = ({ name, onPress, style, isProvider, profilePicture }) => {
  const profileUrl = getProfilePicUrl(profilePicture);
  return (
    <TouchableOpacity
      style={[styles.avatarButton, isProvider && styles.avatarButtonProvider, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {profileUrl ? (
        <Image source={{ uri: profileUrl }} style={styles.avatarImage} />
      ) : (
        <Text style={styles.avatarText}>{getInitials(name)}</Text>
      )}
    </TouchableOpacity>
  );
};

// ─── Animated Menu Item ────────────────────────────────────────────────────────

const AnimatedMenuItem = React.memo(({ item, index, onPress, isReady }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isReady) {
      Animated.spring(anim, {
        toValue: 1,
        delay: index * 25,
        damping: 18,
        stiffness: 180,
        mass: 0.7,
        useNativeDriver: true,
      }).start();
    } else {
      anim.setValue(0);
    }
  }, [isReady]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] });
  const opacity = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 1] });

  if (item.type === 'divider') {
    return <Animated.View key={item.id} style={[styles.divider, { opacity }]} />;
  }

  return (
    <Animated.View style={{ transform: [{ translateX }], opacity }}>
      <TouchableOpacity style={styles.menuItem} onPress={() => onPress(item)} activeOpacity={0.55}>
        <View style={[styles.menuIconContainer, item.danger && styles.menuIconDanger]}>
          <Icon name={item.iconName} size={19} color={item.danger ? '#EF4444' : '#475569'} />
        </View>
        <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>{item.label}</Text>
        {!item.danger && <Icon name="chevron-right" size={15} color="#CBD5E1" style={{ marginLeft: 'auto' }} />}
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Premium Drawer Menu ───────────────────────────────────────────────────────

export const DrawerMenu = ({
  visible,
  onClose,
  user,
  userType,
  navigation,
  onLogout,
  isVerified = true,
}) => {
  const insets = useSafeAreaInsets();

  // StatusBar.currentHeight is reliable on Android even inside Modals.
  // insets.top returns 0 inside statusBarTranslucent Modals on Android.
  const safeTop = Platform.OS === 'android'
    ? (StatusBar.currentHeight || 0)
    : insets.top;
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const [menuReady, setMenuReady] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const profileUrl = getProfilePicUrl(user?.profilePicture);
  const isProvider = userType === 'provider';

  // ── Open / Close animations ──
  useEffect(() => {
    if (visible) {
      setIsAnimating(true);
      // Pre-set content visible so it travels WITH the drawer — no blank board
      contentAnim.setValue(1);
      setMenuReady(true);

      // Everything slides in together — drawer, backdrop, content all at once
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 200,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isAnimating) {
      // Close: everything exits together — no content-first disappear
      setMenuReady(false);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -DRAWER_WIDTH,
          damping: 24,
          stiffness: 260,
          mass: 0.85,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(contentAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsAnimating(false);
      });
    }
  }, [visible]);

  // ── Menu items ──
  const menuItems = useMemo(() => {
    if (isProvider) {
      return [
        { id: 'home', iconName: 'home', label: 'Dashboard', screen: 'Home' },
        { id: 'requests', iconName: 'clipboard-list', label: 'Service Requests', screen: 'ProviderRequests' },
        { id: 'history', iconName: 'history', label: 'Service History', screen: 'ProviderServiceHistory' },
        { id: 'div1', type: 'divider' },
        { id: 'settings', iconName: 'settings', label: 'Settings', screen: 'Settings' },
        { id: 'earnings', iconName: 'wallet', label: 'Earnings', action: 'earnings' },
        { id: 'help', iconName: 'help', label: 'Help & Support', action: 'help' },
        { id: 'div2', type: 'divider' },
        { id: 'logout', iconName: 'logout', label: 'Logout', action: 'logout', danger: true },
      ];
    }
    return [
      { id: 'home', iconName: 'home', label: 'Home', screen: 'Home' },
      { id: 'history', iconName: 'history', label: 'Service History', screen: 'UserServiceHistory' },
      { id: 'div1', type: 'divider' },
      { id: 'settings', iconName: 'settings', label: 'Settings', screen: 'Settings' },
      { id: 'help', iconName: 'help', label: 'Help & Support', action: 'help' },
      { id: 'about', iconName: 'info', label: 'About FixHomi', action: 'about' },
      { id: 'div2', type: 'divider' },
      { id: 'logout', iconName: 'logout', label: 'Logout', action: 'logout', danger: true },
    ];
  }, [isProvider]);

  // ── Handlers ──
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleMenuPress = useCallback((item) => {
    onClose();
    if (item.screen) {
      setTimeout(() => {
        if (item.screen === 'Home' && userType === 'user') {
          navigation.navigate('UserTabs', { screen: 'HomeTab' });
        } else {
          navigation.navigate(item.screen);
        }
      }, 300);
    } else if (item.action === 'logout') {
      setTimeout(() => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: onLogout },
        ]);
      }, 300);
    } else if (item.action === 'help') {
      Linking.openURL('mailto:support@fixhomi.com');
    } else if (item.action === 'earnings') {
      Alert.alert('Coming Soon', 'Earnings feature will be available soon!');
    } else if (item.action === 'about') {
      Alert.alert('FixHomi', 'Your trusted home services partner.\n\nVersion 1.5\n\n© 2026 FixHomi. All rights reserved.');
    }
  }, [onClose, userType, navigation, onLogout]);

  const handleProfilePress = useCallback(() => {
    onClose();
    setTimeout(() => navigation.navigate('Profile'), 300);
  }, [onClose, navigation]);

  if (!visible && !isAnimating) return null;

  // Interpolations
  const headerScale = contentAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const footerOpacity = contentAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const footerTranslateY = contentAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <Modal
      transparent
      visible={visible || isAnimating}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop — tap anywhere outside to close */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
        </TouchableWithoutFeedback>

        {/* Drawer Panel — top offset below status bar, stretches to bottom */}
        <Animated.View style={[styles.drawer, { top: safeTop, transform: [{ translateX: slideAnim }] }]}>
          
          {/* ─── Profile Header ─── */}
          <Animated.View style={{ opacity: contentAnim, transform: [{ scale: headerScale }] }}>
            <TouchableOpacity
              style={[
                styles.header,
                isProvider ? styles.headerProvider : styles.headerUser,
              ]}
              onPress={handleProfilePress}
              activeOpacity={0.85}
            >
              {/* Decorative glass circles */}
              <View style={styles.decorCircle1} />
              <View style={styles.decorCircle2} />
              <View style={styles.decorCircle3} />

              <View style={styles.headerRow}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  {profileUrl ? (
                    <Image source={{ uri: profileUrl }} style={styles.headerAvatar} />
                  ) : (
                    <View style={[styles.headerAvatarFallback, isProvider && styles.headerAvatarFallbackProv]}>
                      <Text style={styles.headerInitials}>{getInitials(user?.fullName)}</Text>
                    </View>
                  )}
                  <View style={styles.onlineDot} />
                </View>

                {/* User Info */}
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user?.fullName || 'User'}
                  </Text>
                  <Text style={styles.userSub} numberOfLines={1}>
                    {user?.email || user?.phone || ''}
                  </Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.typeBadge, isProvider && styles.typeBadgeProv]}>
                      <Icon
                        name={isProvider ? 'provider' : 'home'}
                        size={10}
                        color={BRAND.white}
                        style={{ marginRight: 3 }}
                      />
                      <Text style={styles.typeBadgeText}>{isProvider ? 'Provider' : 'User'}</Text>
                    </View>
                    {isVerified && (
                      <View style={styles.verifiedBadge}>
                        <Icon name="check-circle" size={10} color="#86EFAC" style={{ marginRight: 2 }} />
                        <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* View Profile link */}
              <View style={styles.viewProfileRow}>
                <Text style={styles.viewProfileText}>View Profile</Text>
                <Icon name="chevron-right" size={14} color="rgba(255,255,255,0.7)" />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ─── Menu Items ─── */}
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {menuItems.map((item, index) => (
              <AnimatedMenuItem
                key={item.id}
                item={item}
                index={index}
                onPress={handleMenuPress}
                isReady={menuReady}
              />
            ))}
          </ScrollView>

          {/* ─── Footer ─── */}
          <Animated.View
            style={[
              styles.footer,
              {
                opacity: footerOpacity,
                transform: [{ translateY: footerTranslateY }],
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <View style={styles.footerLogoWrap}>
              <Image source={FIXHOMI_LOGO} style={styles.footerLogo} />
            </View>
            <Text style={styles.footerBrand}>FixHomi</Text>
            <Text style={styles.footerTagline}>v1.5 · Fix Your Home, Anytime</Text>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Menu Button
  menuButton: {
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  menuLine: {
    width: 20,
    height: 2,
    backgroundColor: '#1F2937',
    borderRadius: 1,
    marginVertical: 2,
  },
  menuLineMiddle: {
    width: 16,
  },

  // Avatar Button
  avatarButton: {
    width: 40,
    height: 40,
    backgroundColor: BRAND.secondary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  avatarButtonProvider: { backgroundColor: BRAND.primary },
  avatarText: { color: BRAND.white, fontSize: 16, fontWeight: '700' },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },

  // Container & Backdrop
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },

  // Drawer — top set inline via safeTop (StatusBar.currentHeight on Android)
  drawer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#FBFCFE',
    overflow: 'hidden',
    // Glossy shadow
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 24,
  },

  // ─── Header ───
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  headerUser: { backgroundColor: BRAND.secondary },
  headerProvider: { backgroundColor: BRAND.primary },

  decorCircle1: {
    position: 'absolute',
    top: -40,
    right: -25,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -15,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  decorCircle3: {
    position: 'absolute',
    top: 20,
    left: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  headerAvatarFallback: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  headerAvatarFallbackProv: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  headerInitials: {
    color: BRAND.white,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 1,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2.5,
    borderColor: BRAND.white,
  },

  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    color: BRAND.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  userSub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12.5,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  typeBadgeProv: {
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  typeBadgeText: {
    color: BRAND.white,
    fontSize: 10.5,
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.22)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  verifiedText: {
    color: '#DCFCE7',
    fontSize: 10,
    fontWeight: '700',
  },

  viewProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  viewProfileText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12.5,
    fontWeight: '500',
    marginRight: 3,
  },

  // ─── Menu ───
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  menuIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  menuIconDanger: {
    backgroundColor: '#FEF2F2',
  },
  menuLabel: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  menuLabelDanger: {
    color: '#EF4444',
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
    marginHorizontal: 20,
  },

  // ─── Footer ───
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    gap: 3,
  },
  footerLogoWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 2,
    shadowColor: BRAND.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  footerLogo: {
    width: 36,
    height: 36,
  },
  footerBrand: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.4,
  },
  footerTagline: {
    fontSize: 10.5,
    color: '#9CA3AF',
  },
});

export default DrawerMenu;
