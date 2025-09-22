import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext.js';
import AuthNavigator from './AuthNavigator.jsx';
import MainNavigator from './MainNavigator.jsx';

const RootNavigator = () => {
  const { isAuthenticated, isAuthLoading, userType } = useApp();

  // Debug logging
  React.useEffect(() => {
    console.log('🚀 RootNavigator state - isAuthLoading:', isAuthLoading, 'isAuthenticated:', isAuthenticated, 'userType:', userType);
  }, [isAuthLoading, isAuthenticated, userType]);

  if (isAuthLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  console.log('🚀 RootNavigator rendering:', isAuthenticated ? 'MainNavigator' : 'AuthNavigator');
  return isAuthenticated ? <MainNavigator /> : <AuthNavigator />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default RootNavigator;