/**
 * i18n Configuration
 *
 * Centralized internationalization setup using i18n-js.
 * Supports English, Hindi, and Marathi.
 */

import { I18n } from 'i18n-js';
import en from './en';
import hi from './hi';
import mr from './mr';

const i18n = new I18n({
  en,
  hi,
  mr,
});

i18n.defaultLocale = 'en';
i18n.locale = 'en';
i18n.enableFallback = true;

export default i18n;
