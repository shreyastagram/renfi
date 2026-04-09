/**
 * Premium Drawer Menu Component
 *
 * Dark hero header with decorative circles, glowing avatar ring,
 * large touch-target menu items with colored icon circles,
 * danger-styled logout, and version footer.
 *
 * @version 5.0.0
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Linking,
  Image,
  ScrollView,
  Platform,
  Easing,
  StatusBar
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const FIXHOMI_LOGO = require('../assets/fixhomi_logo.jpg');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 330);

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  heroBg: '#0F172A',
  white: '#FFFFFF',
  surface: '#FBFCFE',
  backdrop: 'rgba(15,23,42,0.6)',
  danger: '#EF4444',
  dangerBg: 'rgba(239,68,68,0.08)',
  dangerBorder: 'rgba(239,68,68,0.15)',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  divider: '#E2E8F0',
  iconBg: '#F1F5F9',
};

// Unified icon color — all menu icons use the same brand secondary
const MENU_ICON_COLOR = BRAND.secondary;

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

const AnimatedMenuItem = React.memo(({ item, index, onPress, isReady, isActive }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

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

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 0.97,
      damping: 15,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      damping: 15,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  if (item.type === 'divider') {
    return <Animated.View key={item.id} style={[styles.divider, { opacity }]} />;
  }

  const accentColor = item.accent ? '#DC2626' : null;
  const iconColor = item.danger ? BRAND.danger : accentColor || (isActive ? BRAND.secondary : BRAND.textSecondary);
  const iconBgColor = item.danger
    ? BRAND.dangerBg
    : item.accent
      ? 'rgba(220,38,38,0.08)'
      : isActive
        ? `${BRAND.secondary}15`
        : BRAND.iconBg;

  return (
    <Animated.View style={{ transform: [{ translateX }, { scale: pressAnim }], opacity }}>
      <TouchableOpacity
        style={[styles.menuItem, item.danger && styles.menuItemDanger, item.accent && styles.menuItemAccent, isActive && styles.menuItemActive]}
        onPress={() => onPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        {isActive && <View style={styles.activeIndicator} />}
        <View style={[styles.menuIconContainer, { backgroundColor: iconBgColor }]}>
          {item.iconGlyph ? (
            <MaterialCommunityIcons name={item.iconGlyph} size={22} color={iconColor} />
          ) : (
            <Icon name={item.iconName} size={20} color={iconColor} />
          )}
        </View>
        <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger, item.accent && styles.menuLabelAccent, isActive && styles.menuLabelActive]}>{item.label}</Text>
        {!item.danger && <MaterialCommunityIcons name="chevron-right" size={18} color={isActive ? BRAND.secondary : BRAND.textMuted} style={{ marginLeft: 'auto' }} />}
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
  activeTab = 'home',
}) => {
  const insets = useSafeAreaInsets();
  const { dialog } = useDialog();
  const { t, language, setLanguage, languages } = useLanguage();

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
  const onCloseCallbackRef = useRef(null);

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
        // Fire any pending callback after drawer fully closed
        if (onCloseCallbackRef.current) {
          const cb = onCloseCallbackRef.current;
          onCloseCallbackRef.current = null;
          // Small delay to ensure modal is unmounted before showing dialog
          setTimeout(cb, 50);
        }
      });
    }
  }, [visible]);

  // ── Menu items ──
  const menuItems = useMemo(() => {
    if (isProvider) {
      return [
        { id: 'home', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'view-dashboard-outline', label: t('drawer.dashboard'), screen: 'Home' },
        { id: 'jobs', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'hammer-wrench', label: t('drawer.myJobs'), tab: 'JobsTab' },
        { id: 'div1', type: 'divider' },
        { id: 'referral', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'gift-outline', label: 'Refer & Earn', screen: 'ReferralScreen' },
        { id: 'rsas', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'clipboard-check-outline', label: 'Service Approvals', screen: 'DocumentVerification' },
        { id: 'subscription', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'diamond-stone', label: 'Professional Tools', screen: 'Subscription' },
        { id: 'psa', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'shield-alert-outline', label: 'Personal Safety', screen: 'PSAContacts', accent: true },
        { id: 'div2', type: 'divider' },
        { id: 'language', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'translate', label: t('drawer.language') || 'Language', action: 'language' },
        { id: 'settings', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'cog-outline', label: t('drawer.settings'), screen: 'Settings' },
        { id: 'help', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'lifebuoy', label: t('drawer.helpSupport'), action: 'help' },
        { id: 'div3', type: 'divider' },
        { id: 'logout', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'logout-variant', label: t('drawer.logout'), action: 'logout', danger: true },
      ];
    }
    return [
      { id: 'home', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'home-variant-outline', label: t('drawer.home'), screen: 'Home' },
      { id: 'history', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'clipboard-text-clock-outline', label: t('drawer.serviceHistory'), screen: 'UserServiceHistory' },
      { id: 'div1', type: 'divider' },
      { id: 'referral', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'gift-outline', label: 'Refer & Earn', screen: 'ReferralScreen' },
      { id: 'psa', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'shield-alert-outline', label: 'Personal Safety', screen: 'PSAContacts', accent: true },
      { id: 'div2', type: 'divider' },
      { id: 'language', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'translate', label: t('drawer.language') || 'Language', action: 'language' },
      { id: 'settings', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'cog-outline', label: t('drawer.settings'), screen: 'Settings' },
      { id: 'help', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'lifebuoy', label: t('drawer.helpSupport'), action: 'help' },
      { id: 'div3', type: 'divider' },
      { id: 'logout', iconFamily: 'MaterialCommunityIcons', iconGlyph: 'logout-variant', label: t('drawer.logout'), action: 'logout', danger: true },
    ];
  }, [isProvider, t]);

  // ── Handlers ──
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleMenuPress = useCallback((item) => {
    if (item.action === 'logout') {
      onCloseCallbackRef.current = () => {
        dialog(t('drawer.logout'), t('drawer.logoutConfirm'), [
          { text: t('drawer.cancel'), style: 'cancel' },
          { text: t('drawer.logout'), style: 'destructive', onPress: onLogout },
        ]);
      };
      onClose();
      return;
    }

    if (item.action === 'language') {
      onCloseCallbackRef.current = () => {
        const options = languages.map(lang => ({
          text: `${lang.nativeLabel} (${lang.label})${language === lang.code ? ' ✓' : ''}`,
          onPress: () => setLanguage(lang.code),
        }));
        options.push({ text: t('common.cancel') || 'Cancel', style: 'cancel' });
        dialog(t('drawer.language') || 'Language', t('drawer.selectLanguage') || 'Choose your preferred language', options);
      };
      onClose();
      return;
    }

    if (item.action === 'help') {
      onCloseCallbackRef.current = () => dialog(
        'Help & Support',
        'How would you like to reach us?',
        [
          { text: 'WhatsApp', onPress: () => Linking.openURL('https://wa.me/918446385312') },
          { text: 'Email', onPress: () => Linking.openURL('mailto:contact@fixhomi.com').catch(() => dialog('Email Us', 'contact@fixhomi.com')) },
          { text: 'Visit Support Page', onPress: () => Linking.openURL('https://fixhomi.com/support') },
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        ]
      );
      onClose();
      return;
    }

    onClose();
    if (item.tab) {
      setTimeout(() => {
        const tabNavigator = userType === 'provider' ? 'ProviderTabs' : 'UserTabs';
        navigation.navigate(tabNavigator, { screen: item.tab });
      }, 300);
    } else if (item.screen) {
      setTimeout(() => {
        const tabNavigator = userType === 'provider' ? 'ProviderTabs' : 'UserTabs';
        if (item.screen === 'Home') {
          navigation.navigate(tabNavigator, { screen: 'HomeTab' });
        } else if (item.screen === 'Settings') {
          navigation.navigate(tabNavigator, { screen: 'SettingsTab' });
        } else if (item.screen === 'UserServiceHistory') {
          navigation.navigate(tabNavigator, { screen: 'HistoryTab' });
        } else {
          navigation.navigate(item.screen);
        }
      }, 300);
    }
  }, [onClose, userType, navigation, onLogout, t, dialog]);

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
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
        </TouchableWithoutFeedback>

        {/* Safe area cover — dark overlay above drawer to cover map bleed */}
        <Animated.View style={[styles.safeAreaCover, { height: safeTop, transform: [{ translateX: slideAnim }] }]} />

        {/* Drawer Panel */}
        <Animated.View style={[styles.drawer, { top: safeTop, transform: [{ translateX: slideAnim }] }]}>

          {/* ─── Dark Hero Header ─── */}
          <Animated.View style={{ opacity: contentAnim, transform: [{ scale: headerScale }] }}>
            <TouchableOpacity
              style={styles.header}
              onPress={handleProfilePress}
              activeOpacity={0.85}
            >
              {/* Decorative circles (SubscriptionScreen style) */}
              <View style={styles.decorCircle1} />
              <View style={styles.decorCircle2} />
              <View style={styles.decorCircle3} />

              {/* Avatar with glowing ring */}
              <View style={styles.avatarCenter}>
                <View style={[styles.glowRing, isProvider ? styles.glowRingProvider : styles.glowRingUser]}>
                  {profileUrl ? (
                    <Image source={{ uri: profileUrl }} style={styles.headerAvatar} />
                  ) : (
                    <View style={[styles.headerAvatarFallback, isProvider && styles.headerAvatarFallbackProv]}>
                      <Text style={styles.headerInitials}>{getInitials(user?.fullName)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.onlineDot} />
              </View>

              {/* Name */}
              <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
                {user?.fullName || 'User'}
              </Text>

              {/* Email */}
              <Text style={styles.userEmail} numberOfLines={1} ellipsizeMode="tail">
                {user?.email || user?.phone || ''}
              </Text>

              {/* Badges */}
              <View style={styles.badgeRow}>
                <View style={[styles.typeBadge, isProvider && styles.typeBadgeProv]}>
                  <Icon
                    name={isProvider ? 'provider' : 'home'}
                    size={10}
                    color={BRAND.white}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.typeBadgeText}>{isProvider ? t('drawer.provider') : t('drawer.user')}</Text>
                </View>
                {isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Icon name="check-circle" size={10} color="#86EFAC" style={{ marginRight: 3 }} />
                    <Text style={styles.verifiedText}>{t('drawer.verified')}</Text>
                  </View>
                )}
              </View>

              {/* View Profile link */}
              <View style={styles.viewProfileRow}>
                <Text style={styles.viewProfileText}>{t('drawer.viewProfile')}</Text>
                <Icon name="chevron-right" size={14} color="rgba(255,255,255,0.55)" />
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
                isActive={item.id === activeTab}
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
            <TouchableOpacity
              style={styles.footerTouchable}
              onPress={() => {
                onClose();
                setTimeout(() => {
                  const { checkForAppUpdate } = require('../services/appUpdateService');
                  checkForAppUpdate?.().then(result => {
                    if (result?.updateAvailable) {
                      dialog('Update Available', `Version ${result.latestVersion} is available.`, [
                        { text: 'Update', onPress: () => Linking.openURL(result.storeUrl || 'https://play.google.com/store/apps/details?id=com.fixhomi.app') },
                        { text: 'Later', style: 'cancel' },
                      ]);
                    } else {
                      dialog('Up to Date', 'You are on the latest version.');
                    }
                  }).catch(() => dialog('Up to Date', 'You are on the latest version.'));
                }, 300);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.footerLogoWrap}>
                <Image source={FIXHOMI_LOGO} style={styles.footerLogo} />
              </View>
              <Text style={styles.footerVersion}>v1.0.2 — Tap to check for updates</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ─── Menu Button ───
  menuButton: {
    width: 48,
    height: 48,
    backgroundColor: BRAND.white,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.14,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  menuLine: {
    width: 20,
    height: 2.2,
    backgroundColor: BRAND.heroBg,
    borderRadius: 1.5,
    marginVertical: 2,
  },
  menuLineMiddle: {
    width: 14,
  },

  // ─── Avatar Button ───
  avatarButton: {
    width: 42,
    height: 42,
    backgroundColor: BRAND.secondary,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(43,118,188,0.25)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.secondary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  avatarButtonProvider: {
    backgroundColor: BRAND.primary,
    borderColor: 'rgba(246,124,22,0.25)',
  },
  avatarText: { color: BRAND.white, fontSize: 16, fontWeight: '700' },
  avatarImage: { width: 42, height: 42, borderRadius: 21 },

  // ─── Container & Backdrop ───
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND.backdrop,
  },
  safeAreaCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: BRAND.heroBg,
    zIndex: 12,
  },

  // ─── Drawer ───
  drawer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: BRAND.surface,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 10, height: 0 },
        shadowOpacity: 0.22,
        shadowRadius: 44,
      },
      android: {
        elevation: 24,
      },
    }),
  },

  // ─── Dark Hero Header ───
  header: {
    backgroundColor: BRAND.heroBg,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },

  decorCircle1: {
    position: 'absolute',
    top: -50,
    right: -35,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(246,124,22,0.08)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(43,118,188,0.08)',
  },
  decorCircle3: {
    position: 'absolute',
    top: 30,
    left: '40%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  avatarCenter: {
    position: 'relative',
    marginBottom: 14,
  },
  glowRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  glowRingUser: {
    borderColor: 'rgba(43,118,188,0.6)',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.secondary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  glowRingProvider: {
    borderColor: 'rgba(246,124,22,0.6)',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  headerAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BRAND.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarFallbackProv: {
    backgroundColor: BRAND.primary,
  },
  headerInitials: {
    color: BRAND.white,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2.5,
    borderColor: BRAND.heroBg,
  },

  userName: {
    color: BRAND.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    maxWidth: '90%',
  },
  userEmail: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: '90%',
  },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(43,118,188,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeProv: {
    backgroundColor: 'rgba(246,124,22,0.25)',
  },
  typeBadgeText: {
    color: BRAND.white,
    fontSize: 11,
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    color: '#DCFCE7',
    fontSize: 10.5,
    fontWeight: '700',
  },

  viewProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  viewProfileText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12.5,
    fontWeight: '500',
    marginRight: 4,
  },

  // ─── Menu ───
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  menuItemActive: {
    backgroundColor: '#EFF6FF',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: BRAND.secondary,
  },
  menuLabelActive: {
    color: BRAND.secondary,
    fontWeight: '700',
  },
  menuItemDanger: {
    backgroundColor: BRAND.dangerBg,
    borderWidth: 1,
    borderColor: BRAND.dangerBorder,
    marginTop: 4,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BRAND.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: {
    fontSize: 15,
    color: BRAND.textPrimary,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  menuLabelDanger: {
    color: BRAND.danger,
    fontWeight: '700',
  },
  menuItemAccent: {
    backgroundColor: 'rgba(220,38,38,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.12)',
  },
  menuLabelAccent: {
    color: '#991B1B',
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BRAND.divider,
    marginVertical: 8,
    marginHorizontal: 28,
  },

  // ─── Footer ───
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND.divider,
    gap: 4,
  },
  footerLogoWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  footerLogo: {
    width: 30,
    height: 30,
  },
  footerTouchable: {
    alignItems: 'center', gap: 4,
  },
  footerVersion: {
    fontSize: 10.5,
    color: BRAND.textMuted,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});

export default DrawerMenu;
