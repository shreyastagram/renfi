import ManageAccountScreen from './screens/ManageAccountScreen.jsx';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/HomeScreen.jsx';
import UserLoginSignup from './screens/UserLoginSignup.jsx';
import ProviderLoginSignup from './screens/ProviderLoginSignup.jsx';
import UserProfileScreen from './screens/UserProfileScreen.jsx';
import BookServicesScreen from './screens/BookServicesScreen.jsx';
import ProviderProfileScreen from './screens/ProviderProfileScreen.jsx';
import MapScreen from './screens/MapScreen.jsx';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="UserLoginSignup"
          component={UserLoginSignup}
          options={{ title: 'User Login/Signup' }}
        />
        <Stack.Screen
          name="ProviderLoginSignup"
          component={ProviderLoginSignup}
          options={{ title: 'Service Provider Login/Signup' }}
        />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{ title: 'User Profile' }}
        />
        <Stack.Screen
          name="BookServices"
          component={BookServicesScreen}
          options={{ title: 'Book Our Services' }}
        />
        <Stack.Screen
          name="ProviderProfile"
          component={ProviderProfileScreen}
          options={{ title: 'Provider Profile' }}
        />
        <Stack.Screen
          name="ManageAccount"
          component={ManageAccountScreen}
          options={{ title: 'Manage Account' }}
        />
        <Stack.Screen
          name="MapScreen"
          component={MapScreen}
          options={{ title: 'Map' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
