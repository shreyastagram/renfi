/**
 * User Type Selection Screen
 * 
 * First screen shown to unauthenticated users
 * Allows selection between User and Provider roles
 * 
 * @version 1.0.0
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useApp } from '../context/AppContext';

/**
 * UserTypeScreen Component
 * 
 * @param {Object} props - Navigation props
 */
const UserTypeScreen = ({ navigation }) => {
  const { selectUserType } = useApp();

  /**
   * Handle user type selection
   * @param {string} type - 'user' or 'provider'
   */
  const handleSelect = async (type) => {
    await selectUserType(type);
    
    if (type === 'user') {
      navigation.navigate('UserAuth');
    } else {
      navigation.navigate('ProviderAuth');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>FixHomi</Text>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>
            Choose how you want to use FixHomi
          </Text>
        </View>

        {/* Selection Cards */}
        <View style={styles.cardsContainer}>
          {/* User Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleSelect('user')}
            activeOpacity={0.7}
          >
            <Text style={styles.cardIcon}>👤</Text>
            <Text style={styles.cardTitle}>I need services</Text>
            <Text style={styles.cardDescription}>
              Find and book home services from trusted professionals
            </Text>
          </TouchableOpacity>

          {/* Provider Card */}
          <TouchableOpacity
            style={[styles.card, styles.cardSecondary]}
            onPress={() => handleSelect('provider')}
            activeOpacity={0.7}
          >
            <Text style={styles.cardIcon}>🔧</Text>
            <Text style={styles.cardTitle}>I provide services</Text>
            <Text style={styles.cardDescription}>
              Offer your skills and grow your business with FixHomi
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563EB',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 24,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  cardSecondary: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  cardIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});

export default UserTypeScreen;
