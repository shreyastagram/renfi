/**
 * Provider Auth Screen
 * 
 * Container screen for provider authentication
 * Handles switching between Login, Register, and OTP flows
 * 
 * @version 2.0.0
 */

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import ProviderRegisterScreen from './ProviderRegisterScreen';
import LoginScreen from './LoginScreen';
import OTPLoginScreen from './OTPLoginScreen';
import OTPVerifyScreen from './OTPVerifyScreen';
import usePersistedAuthFlow, { AUTH_MODES } from '../hooks/usePersistedAuthFlow';

/**
 * ProviderAuthScreen Component
 * Manages the provider authentication flow
 * 
 * @param {Object} props - Navigation props
 */
const ProviderAuthScreen = ({ navigation }) => {
  const { t } = useLanguage();
  // OTP step persists across an OS process kill (Issue 2) so a user who leaves
  // to read the SMS OTP returns to the OTP box instead of starting over.
  const { authMode, setAuthMode, otpData, setOtpData } = usePersistedAuthFlow('provider');

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
          <ProviderRegisterScreen 
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
            userType="provider"
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
            userType="provider"
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
            userType="provider"
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

export default ProviderAuthScreen;
