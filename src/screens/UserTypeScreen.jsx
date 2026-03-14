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
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { FixhomiLogo } from '../components';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

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
  const { t, language, setLanguage, languages } = useLanguage();
  const [showLangPicker, setShowLangPicker] = React.useState(false);

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

  const currentLang = languages.find(l => l.code === language);

  return (
    <SafeAreaView style={styles.container}>
      {/* Language Selector - Top Right */}
      <TouchableOpacity
        style={styles.langButton}
        onPress={() => setShowLangPicker(true)}
        activeOpacity={0.7}
      >
        <MaterialIcon name="language" size={20} color={COLORS.primary} />
        <Text style={styles.langButtonText}>{currentLang?.nativeLabel || 'English'}</Text>
        <MaterialIcon name="arrow-drop-down" size={20} color={COLORS.primary} />
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <FixhomiLogo size={72} />
          </View>
          <Text style={styles.logo}>FixHomi</Text>
          <Text style={styles.title}>{t('userType.welcome')}</Text>
          <Text style={styles.subtitle}>
            {t('userType.chooseHow')}
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
              <Text style={styles.cardTitle}>{t('userType.needServices')}</Text>
              <Text style={styles.cardDescription}>
                {t('userType.needServicesDesc')}
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
              <Text style={styles.cardTitle}>{t('userType.provideServices')}</Text>
              <Text style={styles.cardDescription}>
                {t('userType.provideServicesDesc')}
              </Text>
            </View>
            <MaterialIcon name="chevron-right" size={24} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('userType.footer')}</Text>
        </View>
      </View>

      {/* Language Picker Modal */}
      <Modal
        visible={showLangPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLangPicker(false)}>
          <View style={styles.langModal}>
            <Text style={styles.langModalTitle}>{t('userType.selectLanguage')}</Text>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langOption,
                  language === lang.code && styles.langOptionActive,
                ]}
                onPress={() => {
                  setLanguage(lang.code);
                  setShowLangPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.langOptionText,
                  language === lang.code && styles.langOptionTextActive,
                ]}>
                  {lang.nativeLabel}
                </Text>
                <Text style={styles.langOptionSub}>{lang.label}</Text>
                {language === lang.code && (
                  <MaterialIcon name="check" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
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
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
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
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 8,
    marginRight: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  langButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langModal: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 320,
  },
  langModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 16,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  langOptionActive: {
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  langOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textDark,
    flex: 1,
  },
  langOptionTextActive: {
    color: COLORS.primary,
  },
  langOptionSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginRight: 8,
  },
});

export default UserTypeScreen;
