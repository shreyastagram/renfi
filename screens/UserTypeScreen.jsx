/**
 * User Type Selection Screen
 * 
 * First screen users see after splash - choose between User or Provider
 * 
 * @version 1.0.0
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';

const UserTypeScreen = ({ navigation }) => {
  const handleUserSelect = () => {
    console.log('👤 User type selected: User');
    navigation.navigate('UserAuth');
  };

  const handleProviderSelect = () => {
    console.log('👤 User type selected: Provider');
    // For now, show alert. Provider flow will be implemented later
    alert('Provider registration coming soon!');
    // navigation.navigate('ProviderAuth');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <Text style={styles.logo}>FixHomi</Text>
        <Text style={styles.subtitle}>Your Home Services Partner</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.description}>
          How would you like to use FixHomi?
        </Text>

        <View style={styles.optionsContainer}>
          {/* User Option */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleUserSelect}
            activeOpacity={0.8}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🏠</Text>
            </View>
            <Text style={styles.optionTitle}>I need services</Text>
            <Text style={styles.optionDescription}>
              Find professionals for home repairs, cleaning, and more
            </Text>
          </TouchableOpacity>

          {/* Provider Option */}
          <TouchableOpacity
            style={[styles.optionCard, styles.providerCard]}
            onPress={handleProviderSelect}
            activeOpacity={0.8}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔧</Text>
            </View>
            <Text style={styles.optionTitle}>I provide services</Text>
            <Text style={styles.optionDescription}>
              Join as a service provider and grow your business
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          By continuing, you agree to our Terms of Service
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  providerCard: {
    borderColor: '#E2E8F0',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  icon: {
    fontSize: 28,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

export default UserTypeScreen;
