import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen.jsx';
import UserLoginSignup from '../screens/UserLoginSignup.jsx';
import ProviderLoginSignup from '../screens/ProviderLoginSignup.jsx';
import PhoneVerificationScreen from '../screens/PhoneVerificationScreen.jsx';
import SignupVerificationScreen from '../screens/SignupVerificationScreen.jsx';
import VerifyEmailScreen from '../screens/VerifyEmailScreen.jsx';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen.jsx';
import ResetPasswordScreen from '../screens/ResetPasswordScreen.jsx';

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
      <Stack.Screen
        name="PhoneVerification"
        component={PhoneVerificationScreen}
        options={{ 
          title: 'Verify Phone',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="SignupVerification"
        component={SignupVerificationScreen}
        options={{ 
          title: 'Verify Account',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="VerifyEmail"
        component={VerifyEmailScreen}
        options={{ 
          title: 'Verify Email',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ 
          title: 'Forgot Password',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ 
          title: 'Reset Password',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;