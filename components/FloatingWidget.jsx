import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  Platform
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const WIDGET_SIZE = 60;

const FloatingWidget = ({ 
  onLogout, 
  userType, 
  userName,
  onNavigate 
}) => {
  // Debug: Check if onNavigate is available
  useEffect(() => {
    console.log('🔧 FloatingWidget: Component mounted with props:', {
      userType,
      userName,
      onNavigate: typeof onNavigate,
      onLogout: typeof onLogout
    });
  }, [onNavigate, userType]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const translateX = useRef(new Animated.Value(screenWidth - WIDGET_SIZE - 20)).current;
  const translateY = useRef(new Animated.Value(screenHeight / 2)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.3)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the widget
  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(pulse, 3000); // Pulse every 3 seconds
      });
    };
    pulse();
  }, []);

  // Define menu items based on userType with proper error handling
  const menuItems = React.useMemo(() => {
    console.log('🔧 FloatingWidget: Creating menu items for userType:', userType);
    
    if (userType === 'user') {
      return [
        { 
          label: 'Home', 
          action: () => {
            console.log('🔗 FloatingWidget: User - Navigating to UserLocation');
            if (onNavigate) {
              onNavigate('UserLocation');
            } else {
              console.error('🔗 FloatingWidget: onNavigate function not available');
            }
          }, 
          icon: '🏠' 
        },
        { 
          label: 'Book Services', 
          action: () => {
            console.log('🔗 FloatingWidget: User - Navigating to ServiceSelection');
            if (onNavigate) {
              onNavigate('ServiceSelection');
            } else {
              console.error('🔗 FloatingWidget: onNavigate function not available');
            }
          }, 
          icon: '📅' 
        },
        { 
          label: 'Profile', 
          action: () => {
            console.log('🔗 FloatingWidget: User - Navigating to UserProfile');
            if (onNavigate) {
              onNavigate('UserProfile');
            } else {
              console.error('🔗 FloatingWidget: onNavigate function not available');
            }
          }, 
          icon: '👤' 
        },
        { 
          label: 'Manage Account', 
          action: () => {
            console.log('🔗 FloatingWidget: User - Navigating to UserProfile with edit=true');
            if (onNavigate) {
              onNavigate('UserProfile', { edit: true });
            } else {
              console.error('🔗 FloatingWidget: onNavigate function not available');
            }
          }, 
          icon: '⚙️' 
        },
      ];
    } else if (userType === 'provider') {
      return [
        { 
          label: 'Dashboard', 
          action: () => {
            console.log('🔗 FloatingWidget: Provider - Navigating to ProviderDashboard');
            console.log('🔗 FloatingWidget: Provider - onNavigate function available:', !!onNavigate);
            if (onNavigate) {
              try {
                onNavigate('ProviderDashboard');
                console.log('🔗 FloatingWidget: Provider - Dashboard navigation successful');
              } catch (error) {
                console.error('🔗 FloatingWidget: Provider - Dashboard navigation error:', error);
              }
            } else {
              console.error('🔗 FloatingWidget: Provider - onNavigate function not available');
            }
          }, 
          icon: '📊' 
        },
        { 
          label: 'Profile', 
          action: () => {
            console.log('🔗 FloatingWidget: Provider - Navigating to ProviderProfileSetup with isEditing=true');
            if (onNavigate) {
              try {
                onNavigate('ProviderProfileSetup', { isEditing: true });
                console.log('🔗 FloatingWidget: Provider - Profile navigation successful');
              } catch (error) {
                console.error('🔗 FloatingWidget: Provider - Profile navigation error:', error);
              }
            } else {
              console.error('🔗 FloatingWidget: Provider - onNavigate function not available');
            }
          }, 
          icon: '👤' 
        },
        { 
          label: 'History', 
          action: () => {
            console.log('🔗 FloatingWidget: Provider - Navigating to ProviderHistory');
            if (onNavigate) {
              try {
                onNavigate('ProviderHistory');
                console.log('🔗 FloatingWidget: Provider - History navigation successful');
              } catch (error) {
                console.error('🔗 FloatingWidget: Provider - History navigation error:', error);
              }
            } else {
              console.error('🔗 FloatingWidget: Provider - onNavigate function not available');
            }
          }, 
          icon: '📋' 
        },
      ];
    } else {
      console.warn('🔧 FloatingWidget: Unknown userType:', userType);
      return [];
    }
  }, [userType, onNavigate]);

  console.log('🔧 FloatingWidget: Final menuItems length:', menuItems.length);
  console.log('🔧 FloatingWidget: Menu items for userType', userType, ':', menuItems.map(item => item.label));

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.state === State.END) {
      // Snap to edges
      const finalX = event.nativeEvent.absoluteX > screenWidth / 2 
        ? screenWidth - WIDGET_SIZE - 20 
        : 20;
      
      let finalY = event.nativeEvent.absoluteY;
      if (finalY < 100) finalY = 100;
      if (finalY > screenHeight - WIDGET_SIZE - 100) finalY = screenHeight - WIDGET_SIZE - 100;

      Animated.parallel([
        Animated.spring(translateX, {
          toValue: finalX,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.spring(translateY, {
          toValue: finalY,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    }
  };

  const toggleMenu = () => {
    if (isMenuOpen) {
      // Close menu
      Animated.parallel([
        Animated.timing(menuOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(menuScale, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setIsMenuOpen(false));
    } else {
      // Open menu
      setIsMenuOpen(true);
      Animated.parallel([
        Animated.timing(menuOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(menuScale, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleMenuItemPress = (item) => {
    console.log('🔗 FloatingWidget: Menu item pressed:', item.label);
    console.log('🔗 FloatingWidget: Current userType:', userType);
    console.log('🔗 FloatingWidget: onNavigate available:', !!onNavigate);
    
    if (!onNavigate) {
      console.error('🔗 FloatingWidget: onNavigate function not provided!');
      return;
    }
    
    try {
      item.action();
      console.log('🔗 FloatingWidget: Navigation action executed successfully for:', item.label);
    } catch (error) {
      console.error('🔗 FloatingWidget: Error executing navigation action for', item.label, ':', error);
    }
    
    toggleMenu();
  };

  return (
    <>
      {/* Floating Widget */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.widget,
            {
              transform: [
                { translateX: translateX },
                { translateY: translateY },
                { scale: pulseAnim },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.widgetButton}
            onPress={toggleMenu}
            activeOpacity={0.8}
          >
            <View style={styles.gridIcon}>
              <View style={[styles.dot, styles.dot1]} />
              <View style={[styles.dot, styles.dot2]} />
              <View style={[styles.dot, styles.dot3]} />
              <View style={[styles.dot, styles.dot4]} />
              <View style={[styles.dot, styles.dot5]} />
              <View style={[styles.dot, styles.dot6]} />
              <View style={[styles.dot, styles.dot7]} />
              <View style={[styles.dot, styles.dot8]} />
              <View style={[styles.dot, styles.dot9]} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>

      {/* Menu Modal */}
      {isMenuOpen && (
        <Modal
          visible={isMenuOpen}
          transparent={true}
          animationType="none"
          onRequestClose={toggleMenu}
        >
          <TouchableWithoutFeedback onPress={toggleMenu}>
            <View style={styles.menuOverlay}>
              <Animated.View
                style={[
                  styles.menuContainer,
                  {
                    opacity: menuOpacity,
                    transform: [{ scale: menuScale }],
                  },
                ]}
              >
                {/* User Info Header */}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {userName || (userType === 'user' ? 'User' : 'Provider')}
                  </Text>
                  <Text style={styles.userType}>
                    {userType === 'user' ? 'Customer' : 'Service Provider'}
                  </Text>
                </View>

                {/* Menu Items List */}
                <View style={styles.menuItemsList}>
                  {menuItems.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.menuItem}
                      onPress={() => handleMenuItemPress(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuItemIcon}>
                        <Text style={styles.menuIcon}>{item.icon}</Text>
                      </View>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={() => {
                    onLogout();
                    toggleMenu();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.logoutIconContainer}>
                    <Text style={styles.logoutIcon}>🚪</Text>
                  </View>
                  <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  widget: {
    position: 'absolute',
    width: WIDGET_SIZE,
    height: WIDGET_SIZE,
    zIndex: 9999,
  },
  widgetButton: {
    width: WIDGET_SIZE,
    height: WIDGET_SIZE,
    borderRadius: WIDGET_SIZE / 2,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  gridIcon: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  dot1: { top: 2, left: 2 },
  dot2: { top: 2, left: 10 },
  dot3: { top: 2, right: 2 },
  dot4: { top: 10, left: 2 },
  dot5: { top: 10, left: 10 },
  dot6: { top: 10, right: 2 },
  dot7: { bottom: 2, left: 2 },
  dot8: { bottom: 2, left: 10 },
  dot9: { bottom: 2, right: 2 },
  widgetIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 0,
    width: '90%',
    maxWidth: 320,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  userInfo: {
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginBottom: 0,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userType: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  menuItemsList: {
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  chevron: {
    fontSize: 20,
    color: '#ccc',
    fontWeight: '300',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: '#FF6B6B',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginTop: 10,
  },
  logoutIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  logoutIcon: {
    fontSize: 20,
    color: '#fff',
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default FloatingWidget;