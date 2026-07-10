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

/**
 * Icon mapping for service types and common icons
 */
const ICON_MAP = {
  // Service Types — rich detailed icons
  electrician: { family: 'MaterialCommunityIcons', name: 'lightning-bolt', color: '#F59E0B' },
  plumber: { family: 'MaterialCommunityIcons', name: 'water-pump', color: '#3B82F6' },
  carpenter: { family: 'MaterialCommunityIcons', name: 'hand-saw', color: '#8B5CF6' },
  painter: { family: 'MaterialCommunityIcons', name: 'brush-variant', color: '#EC4899' },
  ac_repair: { family: 'MaterialCommunityIcons', name: 'hvac', color: '#06B6D4' },
  electronics_technician: { family: 'MaterialCommunityIcons', name: 'monitor-cellphone', color: '#6366F1' },
  solar_repairing: { family: 'MaterialCommunityIcons', name: 'solar-power', color: '#EAB308' },
  driver: { family: 'MaterialCommunityIcons', name: 'steering', color: '#14B8A6' },
  welder: { family: 'MaterialCommunityIcons', name: 'soldering-iron', color: '#EF4444' },
  salon: { family: 'MaterialCommunityIcons', name: 'hair-dryer', color: '#F472B6' },
  vehicle_cleaning: { family: 'MaterialCommunityIcons', name: 'spray-bottle', color: '#0EA5E9' },
  mason_tiler: { family: 'MaterialCommunityIcons', name: 'shovel', color: '#78716C' },
  // Event Services
  photographer: { family: 'MaterialCommunityIcons', name: 'camera', color: '#8B5CF6' },
  influencer: { family: 'MaterialCommunityIcons', name: 'account-star', color: '#EC4899' },
  // Emergency Services
  snake_catcher: { family: 'MaterialCommunityIcons', name: 'snake', color: '#10B981' },
  private_ambulance: { family: 'MaterialCommunityIcons', name: 'ambulance', color: '#EF4444' },
  mortuary_van: { family: 'MaterialCommunityIcons', name: 'car-emergency', color: '#6B7280' },
  
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
  pending: { family: 'MaterialCommunityIcons', name: 'clock-outline', color: '#F59E0B' },
  accepted: { family: 'Ionicons', name: 'checkmark-circle', color: '#3B82F6' },
  'in-progress': { family: 'MaterialCommunityIcons', name: 'progress-wrench', color: '#8B5CF6' },
  completed: { family: 'Ionicons', name: 'checkmark-done-circle', color: '#10B981' },
  cancelled: { family: 'Ionicons', name: 'close-circle', color: '#EF4444' },
  rejected: { family: 'Ionicons', name: 'close-circle-outline', color: '#EF4444' },
  
  // Verification
  verified: { family: 'Ionicons', name: 'checkmark-circle', color: '#10B981' },
  unverified: { family: 'Ionicons', name: 'alert-circle', color: '#F59E0B' },
  warning: { family: 'Ionicons', name: 'warning', color: '#F59E0B' },
  verified_user: { family: 'MaterialIcons', name: 'verified-user', color: '#10B981' },
  shield: { family: 'MaterialIcons', name: 'shield', color: '#3B82F6' },
  
  // Actions
  call: { family: 'Feather', name: 'phone-call', color: '#10B981' },
  directions: { family: 'MaterialIcons', name: 'directions', color: '#3B82F6' },
  track: { family: 'MaterialCommunityIcons', name: 'map-marker-radius', color: '#8B5CF6' },
  navigate: { family: 'MaterialCommunityIcons', name: 'navigation', color: '#3B82F6' },
  chatbox: { family: 'Ionicons', name: 'chatbox-outline', color: '#F67C16' },
  sms: { family: 'MaterialCommunityIcons', name: 'message-text-outline', color: '#F67C16' },
  chat: { family: 'Ionicons', name: 'chatbubble-outline', color: '#3B82F6' },
  
  // Misc
  calendar: { family: 'Feather', name: 'calendar' },
  clock: { family: 'Feather', name: 'clock' },
  star: { family: 'FontAwesome', name: 'star', color: '#F59E0B' },
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
  cancel: { family: 'MaterialIcons', name: 'cancel', color: '#EF4444' },
  arrow_back: { family: 'Ionicons', name: 'arrow-back' },
  'chevron-right': { family: 'Ionicons', name: 'chevron-forward' },
  'chevron-down': { family: 'Ionicons', name: 'chevron-down' },
  check: { family: 'Feather', name: 'check' },
  check_circle: { family: 'Ionicons', name: 'checkmark-circle' },
  briefcase: { family: 'Feather', name: 'briefcase' },
  wallet: { family: 'Ionicons', name: 'wallet-outline' },
  'clipboard-list': { family: 'MaterialCommunityIcons', name: 'clipboard-list' },
  
  // Location
  my_location: { family: 'MaterialIcons', name: 'my-location', color: '#3B82F6' },
  other_location: { family: 'MaterialIcons', name: 'add-location-alt', color: '#8B5CF6' },
  search_location: { family: 'MaterialIcons', name: 'search', color: '#6B7280' },
  gps: { family: 'MaterialIcons', name: 'gps-fixed', color: '#3B82F6' },
  
  // Live tracking
  live: { family: 'MaterialCommunityIcons', name: 'broadcast', color: '#EF4444' },
  online: { family: 'MaterialCommunityIcons', name: 'circle', color: '#10B981' },
  offline: { family: 'MaterialCommunityIcons', name: 'circle-outline', color: '#9CA3AF' },
  
  // Additional UI icons
  'open-in-new': { family: 'MaterialIcons', name: 'open-in-new' },
  'arrow-left': { family: 'Feather', name: 'arrow-left' },
  inbox: { family: 'MaterialCommunityIcons', name: 'inbox' },
  'close-circle': { family: 'Ionicons', name: 'close-circle', color: '#EF4444' },
  'check-circle': { family: 'Ionicons', name: 'checkmark-circle', color: '#10B981' },
  wrench: { family: 'MaterialCommunityIcons', name: 'wrench' },
  'truck-fast': { family: 'MaterialCommunityIcons', name: 'truck-fast' },
  'map-marker-check': { family: 'MaterialCommunityIcons', name: 'map-marker-check' },
  heart: { family: 'Ionicons', name: 'heart', color: '#EF4444' },
  pin: { family: 'Ionicons', name: 'location', color: '#EF4444' },
  touch: { family: 'MaterialCommunityIcons', name: 'gesture-tap' },
  'zoom-in': { family: 'Feather', name: 'maximize-2' },
  'currency-rupee': { family: 'MaterialCommunityIcons', name: 'currency-inr' },
  checklist: { family: 'MaterialCommunityIcons', name: 'clipboard-list' },
  close_circle: { family: 'Ionicons', name: 'close-circle', color: '#EF4444' },
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
  // Check if name is in ICON_MAP
  const iconConfig = ICON_MAP[name];
  
  let IconComponent;
  let iconName;
  let iconColor;
  
  if (iconConfig) {
    IconComponent = getIconComponent(iconConfig.family);
    iconName = iconConfig.name;
    iconColor = color || iconConfig.color || '#374151';
  } else {
    // Use direct icon name
    IconComponent = getIconComponent(family || 'MaterialIcons');
    iconName = name;
    iconColor = color || '#374151';
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
// Custom SVG icons for service cards (rich illustrations)
import ElectricianIcon from '../assets/serviceIcons/ElectricianIcon';
import PlumberIcon from '../assets/serviceIcons/PlumberIcon';
import ElectronicsIcon from '../assets/serviceIcons/ElectronicsIcon';
import CarpenterIcon from '../assets/serviceIcons/CarpenterIcon';
import PainterIcon from '../assets/serviceIcons/PainterIcon';
import SolarIcon from '../assets/serviceIcons/SolarIcon';
import WelderIcon from '../assets/serviceIcons/WelderIcon';
import SalonIcon from '../assets/serviceIcons/SalonIcon';
import VehicleCleaningIcon from '../assets/serviceIcons/VehicleCleaningIcon';
import MasonTilerIcon from '../assets/serviceIcons/MasonTilerIcon';
import DriverIcon from '../assets/serviceIcons/DriverIcon';
import AcRepairIcon from '../assets/serviceIcons/AcRepairIcon';
import EmergencyIcon from '../assets/serviceIcons/EmergencyIcon';
import AmbulanceIcon from '../assets/serviceIcons/AmbulanceIcon';
import SnakeCatcherIcon from '../assets/serviceIcons/SnakeCatcherIcon';
import MortuaryVanIcon from '../assets/serviceIcons/MortuaryVanIcon';
import PhotographerIcon from '../assets/serviceIcons/PhotographerIcon';
import InfluencerIcon from '../assets/serviceIcons/InfluencerIcon';

const CUSTOM_SVG_ICONS = {
  electrician: ElectricianIcon,
  plumber: PlumberIcon,
  electronics_technician: ElectronicsIcon,
  carpenter: CarpenterIcon,
  painter: PainterIcon,
  solar_repairing: SolarIcon,
  welder: WelderIcon,
  salon: SalonIcon,
  vehicle_cleaning: VehicleCleaningIcon,
  mason_tiler: MasonTilerIcon,
  driver: DriverIcon,
  ac_repair: AcRepairIcon,
  emergency: EmergencyIcon,
  private_ambulance: AmbulanceIcon,
  snake_catcher: SnakeCatcherIcon,
  mortuary_van: MortuaryVanIcon,
  photographer: PhotographerIcon,
  influencer: InfluencerIcon,
};

// 3D rendered icons (soft-3D squircle tiles exported from the Fixhomi Figma
// icon system). Preferred over the flat SVG illustrations; the SVGs remain as
// fallback for any service type without a 3D render.
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
  const iconType = type || serviceType;

  // Prefer the 3D rendered icon, then custom SVG (unless explicitly disabled)
  if (useSvg !== false) {
    const icon3d = ICON_3D[iconType];
    if (icon3d) {
      // Exported tiles have the rounded-squircle corners baked in (transparent
      // corners), so a plain Image at the requested size fits any container.
      return <Image source={icon3d} style={[{ width: size, height: size }, style]} resizeMode="contain" />;
    }
    const SvgIcon = CUSTOM_SVG_ICONS[iconType];
    if (SvgIcon) {
      return <SvgIcon size={size} />;
    }
  }

  const iconConfig = ICON_MAP[iconType] || ICON_MAP.electrician;
  const iconColor = color || iconConfig.color || '#6B7280';
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
