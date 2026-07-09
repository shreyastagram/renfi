/**
 * User Type Selection Screen
 * 
 * First screen shown to unauthenticated users
 * Allows selection between User and Provider roles
 * 
 * @version 1.1.0
 */

import React from 'react';
import {  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Image,
  useWindowDimensions
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import TouchableOpacity from '../components/TouchableOpacity';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { FixhomiLogo } from '../components';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import useExitConfirmation from '../hooks/useExitConfirmation';

const COLORS = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  background: '#FFFFFF',
  cardBg: '#FAFBFC',
  white: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  muted: '#94A3B8',
  border: '#E2E8F0',
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
  const { height: windowHeight } = useWindowDimensions();

  // Cap hero height so logo + cards + footer still fit on short screens
  const heroHeight = Math.min(Math.round(windowHeight * 0.28), 258);

  // Show "Exit App?" confirmation on Android back button press
  useExitConfirmation();

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
    <LinearGradient
      colors={['#FFF1E5', '#FFFFFF', '#E9F1FA']}
      locations={[0, 0.52, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      {/* Soft brand-color glows — plain Views, cheap on low-end devices */}
      <View pointerEvents="none" style={styles.glowPrimary} />
      <View pointerEvents="none" style={styles.glowSecondary} />

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

        {/* Hero Illustration */}
        <Image
          source={require('../assets/hero_home_services.png')}
          style={[styles.heroImage, { height: heroHeight, width: Math.round(heroHeight * 1.25) }]}
          resizeMode="contain"
          accessible={false}
        />

        {/* Selection Cards */}
        <View style={styles.cardsContainer}>
          {/* User Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleSelect('user')}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <MaterialIcon name="person-outline" size={30} color={COLORS.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{t('userType.needServices')}</Text>
              <Text style={styles.cardDescription}>
                {t('userType.needServicesDesc')}
              </Text>
            </View>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
            </View>
          </TouchableOpacity>

          {/* Provider Card */}
          <TouchableOpacity
            style={[styles.card, styles.cardSecondary]}
            onPress={() => handleSelect('provider')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.iconContainerSecondary]}>
              <MaterialIcon name="handyman" size={30} color={COLORS.secondary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{t('userType.provideServices')}</Text>
              <Text style={styles.cardDescription}>
                {t('userType.provideServicesDesc')}
              </Text>
            </View>
            <View style={[styles.chevron, styles.chevronSecondary]}>
              <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
            </View>
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
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  // ── Layout ──
  gradient: { flex: 1 },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },

  // ── Background glows (user orange + provider blue mixing) ──
  glowPrimary: {
    position: 'absolute', top: -70, right: -70,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(246,124,22,0.07)',
  },
  glowSecondary: {
    position: 'absolute', bottom: -80, left: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(43,118,188,0.07)',
  },

  // ── Header ──
  header: { alignItems: 'center', marginBottom: 12 },
  logoContainer: {
    width: 80, height: 80, borderRadius: 22, backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 18 },
      android: { elevation: 6 },
    }),
  },
  logo: { fontSize: 24, fontWeight: '800', color: COLORS.primary, marginBottom: 6, letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: 12 },

  // ── Hero Illustration ──
  // Edges are alpha-feathered in the asset itself so it melts into the gradient
  heroImage: {
    alignSelf: 'center',
    marginBottom: 10,
  },

  // ── Cards ──
  cardsContainer: { gap: 14 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 18,
    borderWidth: 1.5, borderColor: 'rgba(246,124,22,0.2)',
    flexDirection: 'row', alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  cardSecondary: { borderColor: 'rgba(43,118,188,0.2)' },
  iconContainer: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(246,124,22,0.08)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  iconContainerSecondary: { backgroundColor: 'rgba(43,118,188,0.08)' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  cardDescription: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  chevron: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(246,124,22,0.06)',
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  chevronSecondary: { backgroundColor: 'rgba(43,118,188,0.06)' },

  // ── Footer ──
  footer: { marginTop: 24, alignItems: 'center' },
  footerText: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 19 },

  // ── Language Button ──
  langButton: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end',
    marginTop: 6, marginRight: 16,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border,
  },
  langButtonText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginHorizontal: 4 },

  // ── Language Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  langModal: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 24, width: '82%', maxWidth: 320,
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 },
      android: { elevation: 10 },
    }),
  },
  langModalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16, textAlign: 'center' },
  langOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  langOptionActive: {
    backgroundColor: 'rgba(246,124,22,0.06)', borderWidth: 1, borderColor: 'rgba(246,124,22,0.3)',
  },
  langOptionText: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  langOptionTextActive: { color: COLORS.primary },
  langOptionSub: { fontSize: 12, color: COLORS.muted, marginRight: 8 },
});

export default UserTypeScreen;
