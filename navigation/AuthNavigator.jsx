import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen.jsx';
import UserLoginSignup from '../screens/UserLoginSignup.jsx';
import ProviderLoginSignup from '../screens/ProviderLoginSignup.jsx';

const Stack = createNativeStackNavigator();

const AuthNavigator = () => {
  return (
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
    </Stack.Navigator>
  );
};

export default AuthNavigator;