/**
 * User Auth Screen
 * 
 * Combined Login/Register screen for users
 * Shows login by default with option to switch to register
 * 
 * @version 1.0.0
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import UserRegisterScreen from './UserRegisterScreen';

const UserAuthScreen = ({ navigation }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(true); // Start with register for now

  const handleRegistrationSuccess = (userData) => {
    console.log('✅ [UserAuthScreen] Registration successful:', userData.userId);
    // Navigation will be handled by AppContext auth state change
  };

  // For now, only showing register screen as per requirements
  // Login will be added later
  return (
    <UserRegisterScreen 
      navigation={navigation}
      onSuccess={handleRegistrationSuccess}
      onSwitchToLogin={() => {
        console.log('Switch to login requested');
        // Will implement login later
        alert('Login functionality coming soon!');
      }}
    />
  );
};

export default UserAuthScreen;
