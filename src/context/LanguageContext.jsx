/**
 * Language Context
 *
 * Manages app language state with AsyncStorage persistence.
 * Provides useLanguage() hook and t() translation function.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

const LANGUAGE_KEY = 'app_language';

const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
];

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState('en');
  const [isReady, setIsReady] = useState(false);

  // Load saved language on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (saved && ['en', 'hi', 'mr'].includes(saved)) {
          i18n.locale = saved;
          setLanguageState(saved);
        }
      } catch (e) {
        console.log('[Language] Error loading saved language:', e);
      }
      setIsReady(true);
    };
    loadLanguage();
  }, []);

  const setLanguage = useCallback(async (code) => {
    try {
      i18n.locale = code;
      setLanguageState(code);
      await AsyncStorage.setItem(LANGUAGE_KEY, code);
    } catch (e) {
      console.log('[Language] Error saving language:', e);
    }
  }, []);

  const t = useCallback((key, options) => {
    return i18n.t(key, options);
  }, [language]); // re-create when language changes so consumers re-render

  const value = {
    language,
    setLanguage,
    t,
    languages: LANGUAGES,
    isReady,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
};

export default LanguageContext;
