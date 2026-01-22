/**
 * User Type Selection Screen
 * 
 * First screen shown to unauthenticated users
 * Allows selection between User and Provider roles
 * 
 * @version 1.1.0
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';

// Brand colors
const COLORS = {
  primary: '#f67c16',      // Orange - User theme
  secondary: '#2b76bc',    // Blue - Provider theme
  background: '#faf7f7',
  white: '#FFFFFF',
  textDark: '#111827',
  textMuted: '#6B7280',
};

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
          <View style={styles.logoContainer}>
            <MaterialIcon name="home-repair-service" size={40} color={COLORS.primary} />
          </View>
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
            <View style={styles.iconContainer}>
              <MaterialIcon name="person" size={36} color={COLORS.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>I need services</Text>
              <Text style={styles.cardDescription}>
                Find and book home services from trusted professionals
              </Text>
            </View>
            <MaterialIcon name="chevron-right" size={24} color={COLORS.primary} />
          </TouchableOpacity>

          {/* Provider Card */}
          <TouchableOpacity
            style={[styles.card, styles.cardSecondary]}
            onPress={() => handleSelect('provider')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.iconContainerSecondary]}>
              <MaterialIcon name="build" size={36} color={COLORS.secondary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>I provide services</Text>
              <Text style={styles.cardDescription}>
                Offer your skills and grow your business with FixHomi
              </Text>
            </View>
            <MaterialIcon name="chevron-right" size={24} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Your trusted home services partner</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardSecondary: {
    borderColor: COLORS.secondary,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconContainerSecondary: {
    backgroundColor: `${COLORS.secondary}15`,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});

export default UserTypeScreen;
