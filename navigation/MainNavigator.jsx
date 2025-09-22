import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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

// Wrapper component that has access to navigation context
const ScreenWrapper = ({ children, userType, userData, onLogout }) => {
  const navigation = useNavigation();
  
  const handleNavigate = (screenName, params = {}) => {
    console.log('🚀 ScreenWrapper: handleNavigate called with:', { screenName, params });
    console.log('🚀 ScreenWrapper: userType:', userType);
    try {
      navigation.navigate(screenName, params);
      console.log('🚀 ScreenWrapper: Navigation executed successfully to:', screenName);
    } catch (error) {
      console.error('🚀 ScreenWrapper: Navigation error:', error);
    }
  };

  return (
    <>
      {children}
      <FloatingWidget
        onLogout={onLogout}
        userType={userType}
        userName={userData?.name || userData?.fullName}
        onNavigate={handleNavigate}
      />
    </>
  );
};

const MainNavigator = () => {
  const { userType, userData, logout } = useApp();

  // Debug: Add a useEffect to see when MainNavigator renders
  React.useEffect(() => {
    console.log('🔧 MainNavigator mounted - userType:', userType);
  }, [userType]);

  const handleLogout = () => {
    logout();
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
      >
        {/* ALL User screens - always registered */}
        <Stack.Screen name="UserLocation">
          {(props) => (
            <ScreenWrapper userType={userType} userData={userData} onLogout={handleLogout}>
              <UserLocationScreen {...props} />
            </ScreenWrapper>
          )}
        </Stack.Screen>
        <Stack.Screen name="ServiceSelection">
          {(props) => (
            <ScreenWrapper userType={userType} userData={userData} onLogout={handleLogout}>
              <ServiceSelectionScreen {...props} />
            </ScreenWrapper>
          )}
        </Stack.Screen>
        <Stack.Screen name="BookServices">
          {(props) => (
            <ScreenWrapper userType={userType} userData={userData} onLogout={handleLogout}>
              <BookServicesScreen {...props} />
            </ScreenWrapper>
          )}
        </Stack.Screen>
        <Stack.Screen name="UserProfile">
          {(props) => (
            <ScreenWrapper userType={userType} userData={userData} onLogout={handleLogout}>
              <UserProfileScreen {...props} />
            </ScreenWrapper>
          )}
        </Stack.Screen>
        <Stack.Screen name="ManageAccount">
          {(props) => (
            <ScreenWrapper userType={userType} userData={userData} onLogout={handleLogout}>
              <ManageAccountScreen {...props} />
            </ScreenWrapper>
          )}
        </Stack.Screen>

        {/* ALL Provider screens - always registered */}
        <Stack.Screen name="ProviderDashboard">
          {(props) => (
            <ScreenWrapper userType={userType} userData={userData} onLogout={handleLogout}>
              <ProviderDashboard {...props} />
            </ScreenWrapper>
          )}
        </Stack.Screen>
        <Stack.Screen name="ProviderProfile">
          {(props) => (
            <ScreenWrapper userType={userType} userData={userData} onLogout={handleLogout}>
              <ProviderProfileScreen {...props} />
            </ScreenWrapper>
          )}
        </Stack.Screen>
        <Stack.Screen name="ProviderHistory">
          {(props) => (
            <ScreenWrapper userType={userType} userData={userData} onLogout={handleLogout}>
              <ProviderHistoryScreen {...props} />
            </ScreenWrapper>
          )}
        </Stack.Screen>
        <Stack.Screen name="ProviderProfileSetup">
          {(props) => (
            <ScreenWrapper userType={userType} userData={userData} onLogout={handleLogout}>
              <ProviderProfileSetup {...props} />
            </ScreenWrapper>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </SafeAreaProvider>
  );
};

export default MainNavigator;