/**
 * Google Sign-In Button Component
 * 
 * A production-ready, reusable button for Google Sign-In.
 * Handles loading states, errors, and provides consistent styling.
 * 
 * @component
 */

import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Image,
  Alert,
} from 'react-native';
import googleAuthService from '../src/services/googleAuthService';

// Google "G" logo as base64 (official colors)
const GOOGLE_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAApgAAAKYB3X3/OAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANUSURBVEiJtZZPbBtFFMZ/M7ubXdtdb1xSFyeilBapySVU8h8OoFaooFSqiihIVIpQBKci6KEg9Q6H9kovIHoCIVQJJCKE1ENFjnAgcaSGC6rEnxBwA04Tx43t2FnvDAfjkNibxgHxnWb2e/u992teleeli/Lf2FPv5cvlC1LbXvP4LwmfNjKWy9l/6CNRZ4BL/nrwhw89S3q0TLqZRRTQ0VHV5r/O3/R/6+a1bLKjOmgP2Aqq9f1vJZ1Xqh6vB9ZWLdMzmfzKOzpflWHcz3NVL3X6w6L/f51H/3l/nfvKB2kc3i1Lbm1e0PNFP3Y/8Hl0KjFsQfPi7X0ywW8wvAZU+nv9MNZ0rz+S71LF5bLhZ3D8kzWFLvb7e7c3rvHE8DjQf0LsXb3k7a6K3q38hnPTH6s0DxKxLNXl43kzm2vJXNjXjLpV3vYf0xJPnL+5TiLdyfe3v7l1Nn7hVu6vL4DFPTXfHKULxXF6yfs8sV3Zy7b7u7uzk5P7F6fvr61LVl0+u3u7u7u7u7uxl7Xq7e7u7s5u1+u3u7u7u7u7e7u/9l/Pd/e3d3d3d3d3d3d3d3d3d3d3d3d3d3d3Zubnf+xbrldrv7u7u7u7u7u7u7u7s5O1+u3u7u7u7u7e7u7u7u7u7u7u7u7u7u7u7ubm539sW65Xa7+7u7u7u7u7u7u7u7OTtfrt7u7u7u7u3u7u7u7u7u7u7u7u7u7u7u7m5u9/bFuuV2u/u7u7u7u7u7u7u7u7k7X67e7u7u7u7t7u7u7u7u7u7u7u7u7u7u7u5ubvf2xbrldrv7u7u7u7u7u7u7uzs5u1+u3u7u7u7u7e7u7u7u7u7u7u7u7u7u7u7ubm539sW65Xa7+7u7u7u7u7u7u7Ozm7X67e7u7u7u7t7u7u7u7u7u7u7u7u7u7u7ubm739sW65Xa7e7u7u7u7u7u7Ozk7X67e7u7u7u7u3u7u7u7u7u7u7u7u7u7u5ubvf2xbrldrt7u7u7u7u7u7s7OTtfrt7u7u7u7u7e7u7u7u7u7u7u7u7u7u7m5u9/bFuuV2u3u7u7u7u7u7Ozs5u1+u3u7u7u7u3u7v/ZfyVfKt/KV8n/5Pv1X/5X/1f/lf/Vf+V/9V/5X/1X/lf/Vf+Vb+Vb+Vb+VX/1X/lW/lW/lW/la/lW/lW/la+A/4H8Hwxyzdf3EEAAAAASUVORk5CYII=';

const GoogleSignInButton = ({
  onSuccess,
  onError,
  userType = 'user',
  title = 'Continue with Google',
  style,
  textStyle,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);

  // Check Google Sign-In availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      const available = await googleAuthService.isAvailable();
      setIsAvailable(available);
      
      // Initialize if available
      if (available) {
        await googleAuthService.initialize();
      }
    };
    
    checkAvailability();
  }, []);

  const handlePress = async () => {
    if (loading || disabled || !isAvailable) return;
    
    setLoading(true);
    
    try {
      console.log('🔘 [GoogleButton] Button pressed, starting sign-in...');
      
      const response = await googleAuthService.signIn({ userType });
      
      console.log('✅ [GoogleButton] Sign-in successful');
      
      if (onSuccess) {
        onSuccess(response);
      }
    } catch (error) {
      console.error('❌ [GoogleButton] Sign-in error:', error.message);
      
      // Don't show error for user cancellation
      if (error.message !== 'Sign-in cancelled') {
        if (onError) {
          onError(error);
        } else {
          Alert.alert('Sign-In Failed', error.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isAvailable) {
    return null; // Don't render if Google Sign-In is not available
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        style,
        (loading || disabled) && styles.buttonDisabled,
      ]}
      onPress={handlePress}
      disabled={loading || disabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#4285F4" />
      ) : (
        <View style={styles.content}>
          <Image
            source={{ uri: GOOGLE_LOGO }}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.text, textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#DADCE0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  text: {
    color: '#3C4043',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.25,
  },
});

export default GoogleSignInButton;
