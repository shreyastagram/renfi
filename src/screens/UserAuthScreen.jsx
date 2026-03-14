/**
 * User Auth Screen
 * 
 * Container screen for user authentication
 * Handles switching between Login, Register, and OTP flows
 * 
 * @version 2.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import RegisterScreen from './RegisterScreen';
import LoginScreen from './LoginScreen';
import OTPLoginScreen from './OTPLoginScreen';
import OTPVerifyScreen from './OTPVerifyScreen';

/**
 * Auth modes
 */
const AUTH_MODES = {
  LOGIN: 'login',
  REGISTER: 'register',
  OTP_LOGIN: 'otp_login',
  OTP_VERIFY: 'otp_verify',
};

/**
 * UserAuthScreen Component
 * Manages the user authentication flow
 * 
 * @param {Object} props - Navigation props
 */
const UserAuthScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [authMode, setAuthMode] = useState(AUTH_MODES.LOGIN);
  const [otpData, setOtpData] = useState(null);

  /**
   * Switch to login mode
   */
  const handleSwitchToLogin = useCallback(() => {
    setAuthMode(AUTH_MODES.LOGIN);
  }, []);

  /**
   * Switch to register mode
   */
  const handleSwitchToRegister = useCallback(() => {
    setAuthMode(AUTH_MODES.REGISTER);
  }, []);

  /**
   * Switch to OTP login mode
   */
  const handleSwitchToOtp = useCallback(() => {
    setAuthMode(AUTH_MODES.OTP_LOGIN);
  }, []);

  /**
   * Handle OTP sent - switch to verify mode
   */
  const handleOtpSent = useCallback((data) => {
    setOtpData(data);
    setAuthMode(AUTH_MODES.OTP_VERIFY);
  }, []);

  /**
   * Handle back from OTP verify
   */
  const handleOtpVerifyBack = useCallback(() => {
    setAuthMode(AUTH_MODES.OTP_LOGIN);
    setOtpData(null);
  }, []);

  /**
   * Render current auth screen based on mode
   */
  const renderAuthScreen = () => {
    switch (authMode) {
      case AUTH_MODES.REGISTER:
        return (
          <RegisterScreen 
            navigation={navigation}
            onSwitchToLogin={handleSwitchToLogin}
          />
        );
        
      case AUTH_MODES.OTP_LOGIN:
        return (
          <OTPLoginScreen
            navigation={navigation}
            onSwitchToPassword={handleSwitchToLogin}
            onOtpSent={handleOtpSent}
            userType="user"
          />
        );
        
      case AUTH_MODES.OTP_VERIFY:
        return (
          <OTPVerifyScreen
            navigation={navigation}
            method={otpData?.method}
            identifier={otpData?.identifier}
            maskedValue={otpData?.maskedValue}
            expiresInMinutes={otpData?.expiresInMinutes}
            userType="user"
            onBack={handleOtpVerifyBack}
          />
        );
        
      case AUTH_MODES.LOGIN:
      default:
        return (
          <LoginScreen
            navigation={navigation}
            onSwitchToRegister={handleSwitchToRegister}
            onSwitchToOtp={handleSwitchToOtp}
            userType="user"
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderAuthScreen()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export default UserAuthScreen;

