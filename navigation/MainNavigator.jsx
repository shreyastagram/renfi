import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext.js';
import CustomHeader from '../components/CustomHeader.jsx';
import FloatingWidget from '../components/FloatingWidget.jsx';

// User Screens
import UserProfileScreen from '../screens/UserProfileScreen.jsx';
import BookServicesScreen from '../screens/BookServicesScreen.jsx';
import ServiceSelectionScreen from '../screens/ServiceSelectionScreen.jsx';
import UserLocationScreen from '../screens/UserLocationScreen.jsx';
import ManageAccountScreen from '../screens/ManageAccountScreen.jsx';

// Provider Screens
import ProviderProfileScreen from '../screens/ProviderProfileScreen.jsx';
import ProviderDashboard from '../screens/ProviderDashboard.jsx';
import ProviderHistoryScreen from '../screens/ProviderHistoryScreen.jsx';
import ProviderProfileSetup from '../screens/ProviderProfileSetup.jsx';

const Stack = createNativeStackNavigator();

const MainNavigator = () => {
  const { userType, userData, logout } = useApp();
  const navigationRef = React.useRef(null);

  // Debug: Add a useEffect to see when MainNavigator renders
  React.useEffect(() => {
    console.log('🔧 MainNavigator mounted - userType:', userType);
  }, [userType]);

  const handleLogout = () => {
    logout();
  };

  const handleNavigate = (screenName) => {
    if (navigationRef.current) {
      navigationRef.current.navigate(screenName);
    }
  };

  const getInitialRouteName = () => {
    if (userType === 'user') {
      return 'UserLocation';
    } else if (userType === 'provider') {
      // Check if provider profile is complete (needs name, phone, and service categories)
      const hasRequiredFields = userData && 
                               (userData.name || userData.fullName) && 
                               userData.phone && 
                               userData.serviceCategories && 
                               userData.serviceCategories.length > 0;
      
      if (hasRequiredFields) {
        return 'ProviderDashboard';
      } else {
        console.log('🔧 Provider profile incomplete, going to setup:', {
          name: userData?.name || userData?.fullName,
          phone: userData?.phone,
          serviceCategories: userData?.serviceCategories?.length || 0
        });
        return 'ProviderProfileSetup';
      }
    }
    return 'UserLocation';
  };

  return (
    <SafeAreaProvider>
      <Stack.Navigator
        initialRouteName={getInitialRouteName()}
        screenOptions={{ 
          headerShown: true,
          header: (props) => {
            console.log('🎯 Default header rendering for:', props.route.name);
            return (
              <CustomHeader
                title={props.route.name === 'UserLocation' ? 'Set Your Location' : 
                       props.route.name === 'ServiceSelection' ? 'Select Service' :
                       props.route.name === 'BookServices' ? 'Book Our Services' :
                       props.route.name === 'UserProfile' ? 'User Profile' :
                       props.route.name === 'ManageAccount' ? 'Manage Account' :
                       props.route.name === 'ProviderDashboard' ? 'Provider Dashboard' :
                       props.route.name === 'ProviderProfile' ? 'Provider Profile' :
                       props.route.name === 'ProviderHistory' ? 'Service History' :
                       props.route.name === 'ProviderProfileSetup' ? 'Profile Setup' : 'Renfi'}
              />
            );
          }
        }}
        ref={navigationRef}
      >
        {userType === 'user' ? (
          // User screens
          <>
            <Stack.Screen name="UserLocation" component={UserLocationScreen} />
            <Stack.Screen name="ServiceSelection" component={ServiceSelectionScreen} />
            <Stack.Screen name="BookServices" component={BookServicesScreen} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
            <Stack.Screen name="ManageAccount" component={ManageAccountScreen} />
          </>
        ) : (
          // Provider screens
          <>
            <Stack.Screen name="ProviderDashboard" component={ProviderDashboard} />
            <Stack.Screen name="ProviderProfile" component={ProviderProfileScreen} />
            <Stack.Screen name="ProviderHistory" component={ProviderHistoryScreen} />
            <Stack.Screen name="ProviderProfileSetup" component={ProviderProfileSetup} />
          </>
        )}
      </Stack.Navigator>
      
      <FloatingWidget
        onLogout={handleLogout}
        userType={userType}
        userName={userData?.name || userData?.fullName}
        onNavigate={handleNavigate}
      />
    </SafeAreaProvider>
  );
};

export default MainNavigator;