/**
 * Icon Component
 * 
 * Unified icon component using react-native-vector-icons
 * Provides consistent icons across the app
 * 
 * @version 1.0.0
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Feather from 'react-native-vector-icons/Feather';
import { categoryAccent, iconAccent, useThemeColors } from '../theme';

/**
 * Icon mapping for service types and common icons
 */
const ICON_MAP = {
  // Service Types — rich detailed icons
  electrician: { family: 'MaterialCommunityIcons', name: 'lightning-bolt', color: categoryAccent.electrician },
  plumber: { family: 'MaterialCommunityIcons', name: 'water-pump', color: categoryAccent.plumber },
  carpenter: { family: 'MaterialCommunityIcons', name: 'hand-saw', color: categoryAccent.carpenter },
  painter: { family: 'MaterialCommunityIcons', name: 'brush-variant', color: categoryAccent.painter },
  ac_repair: { family: 'MaterialCommunityIcons', name: 'hvac', color: categoryAccent.ac_repair },
  electronics_technician: { family: 'MaterialCommunityIcons', name: 'monitor-cellphone', color: categoryAccent.electronics_technician },
  solar_repairing: { family: 'MaterialCommunityIcons', name: 'solar-power', color: categoryAccent.solar_repairing },
  driver: { family: 'MaterialCommunityIcons', name: 'steering', color: categoryAccent.driver },
  welder: { family: 'MaterialCommunityIcons', name: 'soldering-iron', color: categoryAccent.welder },
  salon: { family: 'MaterialCommunityIcons', name: 'hair-dryer', color: categoryAccent.salon },
  vehicle_cleaning: { family: 'MaterialCommunityIcons', name: 'spray-bottle', color: categoryAccent.vehicle_cleaning },
  mason_tiler: { family: 'MaterialCommunityIcons', name: 'shovel', color: categoryAccent.mason_tiler },
  // Event Services
  photographer: { family: 'MaterialCommunityIcons', name: 'camera', color: iconAccent.photographer },
  influencer: { family: 'MaterialCommunityIcons', name: 'account-star', color: iconAccent.influencer },
  // Emergency Services
  snake_catcher: { family: 'MaterialCommunityIcons', name: 'snake', color: iconAccent.snake_catcher },
  private_ambulance: { family: 'MaterialCommunityIcons', name: 'ambulance', color: iconAccent.private_ambulance },
  mortuary_van: { family: 'MaterialCommunityIcons', name: 'car-emergency', color: iconAccent.mortuary_van },
  
  // Navigation & Actions
  back: { family: 'Ionicons', name: 'arrow-back' },
  close: { family: 'Ionicons', name: 'close' },
  menu: { family: 'Ionicons', name: 'menu' },
  settings: { family: 'Ionicons', name: 'settings-outline' },
  edit: { family: 'Feather', name: 'edit-2' },
  save: { family: 'Feather', name: 'check' },
  delete: { family: 'Feather', name: 'trash-2' },
  add: { family: 'Ionicons', name: 'add' },
  refresh: { family: 'Ionicons', name: 'refresh' },
  
  // User & Profile
  user: { family: 'Feather', name: 'user' },
  provider: { family: 'MaterialCommunityIcons', name: 'account-hard-hat' },
  phone: { family: 'Feather', name: 'phone' },
  email: { family: 'Feather', name: 'mail' },
  location: { family: 'Ionicons', name: 'location' },
  home: { family: 'Feather', name: 'home' },
  address: { family: 'Feather', name: 'map-pin' },
  
  // Status
  pending: { family: 'MaterialCommunityIcons', name: 'clock-outline', color: iconAccent.pending },
  accepted: { family: 'Ionicons', name: 'checkmark-circle', color: iconAccent.accepted },
  'in-progress': { family: 'MaterialCommunityIcons', name: 'progress-wrench', color: iconAccent['in-progress'] },
  completed: { family: 'Ionicons', name: 'checkmark-done-circle', color: iconAccent.completed },
  cancelled: { family: 'Ionicons', name: 'close-circle', color: iconAccent.cancelled },
  rejected: { family: 'Ionicons', name: 'close-circle-outline', color: iconAccent.rejected },
  
  // Verification
  verified: { family: 'Ionicons', name: 'checkmark-circle', color: iconAccent.verified },
  unverified: { family: 'Ionicons', name: 'alert-circle', color: iconAccent.unverified },
  warning: { family: 'Ionicons', name: 'warning', color: iconAccent.warning },
  verified_user: { family: 'MaterialIcons', name: 'verified-user', color: iconAccent.verified_user },
  shield: { family: 'MaterialIcons', name: 'shield', color: iconAccent.shield },
  
  // Actions
  call: { family: 'Feather', name: 'phone-call', color: iconAccent.call },
  directions: { family: 'MaterialIcons', name: 'directions', color: iconAccent.directions },
  track: { family: 'MaterialCommunityIcons', name: 'map-marker-radius', color: iconAccent.track },
  navigate: { family: 'MaterialCommunityIcons', name: 'navigation', color: iconAccent.navigate },
  chatbox: { family: 'Ionicons', name: 'chatbox-outline', color: iconAccent.chatbox },
  sms: { family: 'MaterialCommunityIcons', name: 'message-text-outline', color: iconAccent.sms },
  chat: { family: 'Ionicons', name: 'chatbubble-outline', color: iconAccent.chat },
  
  // Misc
  calendar: { family: 'Feather', name: 'calendar' },
  clock: { family: 'Feather', name: 'clock' },
  star: { family: 'FontAwesome', name: 'star', color: iconAccent.star },
  star_outline: { family: 'FontAwesome', name: 'star-o' },
  history: { family: 'MaterialIcons', name: 'history' },
  otp: { family: 'MaterialCommunityIcons', name: 'lock-outline' },
  copy: { family: 'Feather', name: 'copy' },
  logout: { family: 'Feather', name: 'log-out' },
  help: { family: 'Feather', name: 'help-circle' },
  info: { family: 'Feather', name: 'info' },
  download: { family: 'Feather', name: 'download' },
  document: { family: 'Feather', name: 'file-text' },
  notification: { family: 'Ionicons', name: 'notifications-outline' },
  services: { family: 'MaterialCommunityIcons', name: 'toolbox' },
  search: { family: 'Feather', name: 'search' },
  map: { family: 'Feather', name: 'map' },
  'map-pin': { family: 'Feather', name: 'map-pin' },
  cancel: { family: 'MaterialIcons', name: 'cancel', color: iconAccent.cancel },
  arrow_back: { family: 'Ionicons', name: 'arrow-back' },
  'chevron-right': { family: 'Ionicons', name: 'chevron-forward' },
  'chevron-down': { family: 'Ionicons', name: 'chevron-down' },
  check: { family: 'Feather', name: 'check' },
  check_circle: { family: 'Ionicons', name: 'checkmark-circle' },
  briefcase: { family: 'Feather', name: 'briefcase' },
  wallet: { family: 'Ionicons', name: 'wallet-outline' },
  'clipboard-list': { family: 'MaterialCommunityIcons', name: 'clipboard-list' },
  
  // Location
  my_location: { family: 'MaterialIcons', name: 'my-location', color: iconAccent.my_location },
  other_location: { family: 'MaterialIcons', name: 'add-location-alt', color: iconAccent.other_location },
  search_location: { family: 'MaterialIcons', name: 'search', color: iconAccent.search_location },
  gps: { family: 'MaterialIcons', name: 'gps-fixed', color: iconAccent.gps },
  
  // Live tracking
  live: { family: 'MaterialCommunityIcons', name: 'broadcast', color: iconAccent.live },
  online: { family: 'MaterialCommunityIcons', name: 'circle', color: iconAccent.online },
  offline: { family: 'MaterialCommunityIcons', name: 'circle-outline', color: iconAccent.offline },
  
  // Additional UI icons
  'open-in-new': { family: 'MaterialIcons', name: 'open-in-new' },
  'arrow-left': { family: 'Feather', name: 'arrow-left' },
  inbox: { family: 'MaterialCommunityIcons', name: 'inbox' },
  'close-circle': { family: 'Ionicons', name: 'close-circle', color: iconAccent['close-circle'] },
  'check-circle': { family: 'Ionicons', name: 'checkmark-circle', color: iconAccent['check-circle'] },
  wrench: { family: 'MaterialCommunityIcons', name: 'wrench' },
  'truck-fast': { family: 'MaterialCommunityIcons', name: 'truck-fast' },
  'map-marker-check': { family: 'MaterialCommunityIcons', name: 'map-marker-check' },
  heart: { family: 'Ionicons', name: 'heart', color: iconAccent.heart },
  pin: { family: 'Ionicons', name: 'location', color: iconAccent.pin },
  touch: { family: 'MaterialCommunityIcons', name: 'gesture-tap' },
  'zoom-in': { family: 'Feather', name: 'maximize-2' },
  'currency-rupee': { family: 'MaterialCommunityIcons', name: 'currency-inr' },
  checklist: { family: 'MaterialCommunityIcons', name: 'clipboard-list' },
  close_circle: { family: 'Ionicons', name: 'close-circle', color: iconAccent.close_circle },
  check_circle_outline: { family: 'Ionicons', name: 'checkmark-circle-outline' },
  'navigate-outline': { family: 'Ionicons', name: 'navigate-outline' },
  lock: { family: 'MaterialCommunityIcons', name: 'lock-outline' },
  timer: { family: 'MaterialCommunityIcons', name: 'timer-outline' },
  celebration: { family: 'MaterialIcons', name: 'celebration' },
  description: { family: 'MaterialIcons', name: 'description' },
  place: { family: 'MaterialIcons', name: 'place' },
  block: { family: 'MaterialIcons', name: 'block' },
  error: { family: 'MaterialIcons', name: 'error' },
  favorite: { family: 'MaterialIcons', name: 'favorite' },
  'favorite-border': { family: 'MaterialIcons', name: 'favorite-border' },
  'filter-outline': { family: 'MaterialCommunityIcons', name: 'filter-outline' },
  'filter-off-outline': { family: 'MaterialCommunityIcons', name: 'filter-off-outline' },
  filter: { family: 'MaterialCommunityIcons', name: 'filter-outline' },
  list: { family: 'Feather', name: 'list' },
  mail: { family: 'Feather', name: 'mail' },
};

/**
 * Get icon component based on family
 */
const getIconComponent = (family) => {
  switch (family) {
    case 'MaterialCommunityIcons':
      return MaterialCommunityIcons;
    case 'Ionicons':
      return Ionicons;
    case 'FontAwesome':
      return FontAwesome;
    case 'Feather':
      return Feather;
    case 'MaterialIcons':
    default:
      return MaterialIcons;
  }
};

/**
 * Icon Component
 * 
 * @param {string} name - Icon name from ICON_MAP or direct icon name
 * @param {number} size - Icon size (default: 24)
 * @param {string} color - Icon color (overrides ICON_MAP color)
 * @param {string} family - Icon family (when not using ICON_MAP)
 * @param {Object} style - Additional styles
 * @param {Object} containerStyle - Container styles
 */
const Icon = ({ 
  name, 
  size = 24, 
  color, 
  family,
  style,
  containerStyle,
}) => {
  // The no-match fallback DOES sit on a themed surface, unlike the identity
  // colours in ICON_MAP, so it must follow the theme or it goes near-invisible
  // on a near-black background.
  const { textBodyNeutral } = useThemeColors();

  // Check if name is in ICON_MAP
  const iconConfig = ICON_MAP[name];
  
  let IconComponent;
  let iconName;
  let iconColor;
  
  if (iconConfig) {
    IconComponent = getIconComponent(iconConfig.family);
    iconName = iconConfig.name;
    iconColor = color || iconConfig.color || textBodyNeutral;
  } else {
    // Use direct icon name
    IconComponent = getIconComponent(family || 'MaterialIcons');
    iconName = name;
    iconColor = color || textBodyNeutral;
  }
  
  if (containerStyle) {
    return (
      <View style={containerStyle}>
        <IconComponent name={iconName} size={size} color={iconColor} style={style} />
      </View>
    );
  }
  
  return <IconComponent name={iconName} size={size} color={iconColor} style={style} />;
};

/**
 * Service Icon - Specific for service types with background
 * Supports both 'type' and 'serviceType' props for flexibility
 */
// 3D rendered icons (soft-3D squircle tiles exported from the Fixhomi Figma
// icon system). Every service type has a 3D render; unknown types fall back
// to the ICON_MAP vector below.
const ICON_3D = {
  electrician: require('../assets/serviceIcons/3d/electrician.png'),
  plumber: require('../assets/serviceIcons/3d/plumber.png'),
  electronics_technician: require('../assets/serviceIcons/3d/electronics_technician.png'),
  carpenter: require('../assets/serviceIcons/3d/carpenter.png'),
  painter: require('../assets/serviceIcons/3d/painter.png'),
  solar_repairing: require('../assets/serviceIcons/3d/solar_repairing.png'),
  welder: require('../assets/serviceIcons/3d/welder.png'),
  salon: require('../assets/serviceIcons/3d/salon.png'),
  vehicle_cleaning: require('../assets/serviceIcons/3d/vehicle_cleaning.png'),
  mason_tiler: require('../assets/serviceIcons/3d/mason_tiler.png'),
  driver: require('../assets/serviceIcons/3d/driver.png'),
  ac_repair: require('../assets/serviceIcons/3d/ac_repair.png'),
  emergency: require('../assets/serviceIcons/3d/emergency.png'),
  private_ambulance: require('../assets/serviceIcons/3d/private_ambulance.png'),
  snake_catcher: require('../assets/serviceIcons/3d/snake_catcher.png'),
  mortuary_van: require('../assets/serviceIcons/3d/mortuary_van.png'),
  photographer: require('../assets/serviceIcons/3d/photographer.png'),
  influencer: require('../assets/serviceIcons/3d/influencer.png'),
  events: require('../assets/serviceIcons/3d/events.png'),
  favorites: require('../assets/serviceIcons/3d/favorites.png'),
};

export const ServiceIcon = ({ type, serviceType, size = 24, color, backgroundColor, style, useSvg }) => {
  // Same reasoning as Icon: the no-match fallback sits on a themed surface.
  const { textSecondary: fallbackInk } = useThemeColors();
  const iconType = type || serviceType;

  // Prefer the 3D rendered icon (unless explicitly disabled)
  if (useSvg !== false) {
    const icon3d = ICON_3D[iconType];
    if (icon3d) {
      // Exported tiles have the rounded-squircle corners baked in (transparent
      // corners), so a plain Image at the requested size fits any container.
      return <Image source={icon3d} style={[{ width: size, height: size }, style]} resizeMode="contain" />;
    }
  }


  const iconConfig = ICON_MAP[iconType] || ICON_MAP.electrician;
  const iconColor = color || iconConfig.color || fallbackInk;
  const bgColor = backgroundColor || `${iconColor}20`;

  return (
    <View style={[styles.serviceIconContainer, { backgroundColor: bgColor, width: size * 1.8, height: size * 1.8, borderRadius: size * 0.9 }, style]}>
      <Icon name={iconType} size={size} color={iconColor} />
    </View>
  );
};

/**
 * Status Icon - For request status display
 */
export const StatusIcon = ({ status, size = 16 }) => {
  return <Icon name={status} size={size} />;
};

const styles = StyleSheet.create({
  serviceIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Icon;
