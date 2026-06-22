/**
 * User Auth Screen
 * 
 * Container screen for user authentication
 * Handles switching between Login, Register, and OTP flows
 * 
 * @version 2.0.0
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import RegisterScreen from './RegisterScreen';
import LoginScreen from './LoginScreen';
import OTPLoginScreen from './OTPLoginScreen';
import OTPVerifyScreen from './OTPVerifyScreen';
import PhoneSignupScreen from './PhoneSignupScreen';
import usePersistedAuthFlow, { AUTH_MODES } from '../hooks/usePersistedAuthFlow';

/**
 * UserAuthScreen Component
 * Manages the user authentication flow
 * 
 * @param {Object} props - Navigation props
 */
const UserAuthScreen = ({ navigation }) => {
  const { t } = useLanguage();
  // OTP step persists across an OS process kill (Issue 2) so a user who leaves
  // to read the SMS OTP returns to the OTP box instead of starting over.
  const { authMode, setAuthMode, otpData, setOtpData } = usePersistedAuthFlow('user');
  // Carry T&C + referral from RegisterChoice through PhoneSignupScreen into the
  // OTP_VERIFY call (NoeFix's verifyPhoneSignupAndSync requires both flags).
  const [phoneSignupExtras, setPhoneSignupExtras] = useState(null);

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
   * Handle back from OTP verify. Returns to the OTP entry step appropriate
   * for the flow that started it — signup goes back to PhoneSignupScreen,
   * login goes back to OTPLoginScreen.
   */
  const handleOtpVerifyBack = useCallback(() => {
    if (otpData?.context === 'signup') {
      setAuthMode(AUTH_MODES.PHONE_SIGNUP);
    } else {
      setAuthMode(AUTH_MODES.OTP_LOGIN);
    }
    setOtpData(null);
  }, [otpData]);

  /**
   * Switch to phone-signup entry from RegisterScreen. Stashes T&C + referral
   * for forwarding into verifyPhoneSignupAndSync at verify time.
   */
  const handleSwitchToPhoneSignup = useCallback((extras) => {
    setPhoneSignupExtras(extras || {});
    setAuthMode(AUTH_MODES.PHONE_SIGNUP);
  }, []);

  /**
   * Back from PhoneSignupScreen returns to the register choice.
   */
  const handlePhoneSignupBack = useCallback(() => {
    setAuthMode(AUTH_MODES.REGISTER);
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
            onSwitchToPhoneSignup={handleSwitchToPhoneSignup}
          />
        );

      case AUTH_MODES.PHONE_SIGNUP:
        return (
          <PhoneSignupScreen
            onOtpSent={handleOtpSent}
            onBack={handlePhoneSignupBack}
            signupExtras={phoneSignupExtras || {}}
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
            // Signup-only extras — undefined for login flows so OTPVerifyScreen
            // falls back to its existing phone/email login behaviour.
            context={otpData?.context || 'login'}
            fullName={otpData?.fullName}
            signupExtras={otpData?.signupExtras}
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

