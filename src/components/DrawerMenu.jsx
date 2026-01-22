/**
 * Shared Drawer Menu Component
 * 
 * Uber/Ola style hamburger drawer menu
 * Used across all screens in the app
 * 
 * @version 1.0.0
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
 * Menu Button Component (Hamburger)
 */
export const MenuButton = ({ onPress, style }) => (
  <TouchableOpacity 
    style={[styles.menuButton, style]} 
    onPress={onPress} 
    activeOpacity={0.8}
  >
    <View style={styles.menuLine} />
    <View style={[styles.menuLine, styles.menuLineMiddle]} />
    <View style={styles.menuLine} />
  </TouchableOpacity>
);

/**
 * Avatar Button (User initials - navigates to profile)
 */
export const AvatarButton = ({ name, onPress, style, isProvider }) => (
  <TouchableOpacity 
    style={[
      styles.avatarButton, 
      isProvider && styles.avatarButtonProvider,
      style
    ]} 
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={styles.avatarText}>{getInitials(name)}</Text>
  </TouchableOpacity>
);

/**
 * Drawer Menu Component
 */
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
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SCREEN_WIDTH * 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Define menu items based on user type
  const getMenuItems = () => {
    const isProvider = userType === 'provider';
    
    if (isProvider) {
      return [
        { id: 'home', iconName: 'home', label: 'Dashboard', screen: 'Home' },
        { id: 'requests', iconName: 'clipboard-list', label: 'Service Requests', screen: 'ProviderRequests' },
        { id: 'history', iconName: 'history', label: 'Service History', screen: 'ProviderServiceHistory' },
        { id: 'divider1', type: 'divider' },
        { id: 'settings', iconName: 'settings', label: 'Settings', screen: 'Settings' },
        { id: 'earnings', iconName: 'wallet', label: 'Earnings', action: 'earnings' },
        { id: 'help', iconName: 'help', label: 'Help & Support', action: 'help' },
        { id: 'divider2', type: 'divider' },
        { id: 'logout', iconName: 'logout', label: 'Logout', action: 'logout', danger: true },
      ];
    }
    
    return [
      { id: 'home', iconName: 'home', label: 'Home', screen: 'Home' },
      { id: 'history', iconName: 'history', label: 'Service History', screen: 'UserServiceHistory' },
      { id: 'divider1', type: 'divider' },
      { id: 'help', iconName: 'help', label: 'Help & Support', action: 'help' },
      { id: 'about', iconName: 'info', label: 'About FixHomi', action: 'about' },
      { id: 'divider2', type: 'divider' },
      { id: 'logout', iconName: 'logout', label: 'Logout', action: 'logout', danger: true },
    ];
  };

  const handleMenuPress = (item) => {
    onClose();
    
    if (item.screen) {
      setTimeout(() => {
        // For users with tab navigation, Home navigates to HomeTab within UserTabs
        if (item.screen === 'Home' && userType === 'user') {
          navigation.navigate('UserTabs', { screen: 'HomeTab' });
        } else {
          navigation.navigate(item.screen);
        }
      }, 300);
    } else if (item.action === 'logout') {
      setTimeout(() => {
        Alert.alert(
          'Logout',
          'Are you sure you want to logout?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: onLogout },
          ]
        );
      }, 300);
    } else if (item.action === 'help') {
      Linking.openURL('mailto:support@fixhomi.com');
    } else if (item.action === 'earnings') {
      Alert.alert('Coming Soon', 'Earnings feature will be available soon!');
    } else if (item.action === 'about') {
      Alert.alert('FixHomi', 'Your trusted home services partner.\n\nVersion 1.0.0');
    }
  };

  const handleProfilePress = () => {
    onClose();
    setTimeout(() => navigation.navigate('Profile'), 300);
  };

  if (!visible) return null;

  const isProvider = userType === 'provider';
  const menuItems = getMenuItems();

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          onPress={onClose} 
          activeOpacity={1} 
        />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          { 
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Profile Header */}
        <TouchableOpacity 
          style={[
            styles.header,
            isProvider && styles.headerProvider,
          ]}
          onPress={handleProfilePress}
          activeOpacity={0.9}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>
              {getInitials(user?.fullName)}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.fullName || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
            {/* Verification Badge */}
            <View style={styles.badgeRow}>
              <View style={[
                styles.badge,
                isProvider && styles.badgeProvider,
              ]}>
                <Text style={styles.badgeText}>
                  {isProvider ? 'Provider' : 'User'}
                </Text>
              </View>
              {!isVerified && (
                <View style={styles.unverifiedBadge}>
                  <Text style={styles.unverifiedText}>Not Verified</Text>
                </View>
              )}
            </View>
          </View>
          <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* Menu Items */}
        <View style={styles.menuContent}>
          {menuItems.map((item) => {
            if (item.type === 'divider') {
              return <View key={item.id} style={styles.divider} />;
            }
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={() => handleMenuPress(item)}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconContainer}>
                  <Icon 
                    name={item.iconName} 
                    size={22} 
                    color={item.danger ? '#EF4444' : '#374151'} 
                  />
                </View>
                <Text style={[
                  styles.menuLabel, 
                  item.danger && styles.menuLabelDanger
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer */}
        <Text style={styles.version}>FixHomi v1.0.0</Text>
      </Animated.View>
    </Modal>
  );
};

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
    shadowOpacity: 0.15,
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
    backgroundColor: '#2563EB',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarButtonProvider: {
    backgroundColor: '#F59E0B',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Drawer
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.8,
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: '#2563EB',
  },
  headerProvider: {
    backgroundColor: '#F59E0B',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  userEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeProvider: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  unverifiedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unverifiedText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600',
  },
  headerArrow: {
    color: '#FFFFFF',
    fontSize: 28,
    opacity: 0.7,
  },

  // Menu Content
  menuContent: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  menuLabelDanger: {
    color: '#EF4444',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
    marginHorizontal: 20,
  },

  // Footer
  version: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    paddingBottom: 24,
  },
});

export default DrawerMenu;
