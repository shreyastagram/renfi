/**
 * Help & Support dialog — single source of truth.
 *
 * The identical dialog is opened from Settings and from the support-agent
 * icon on Home + service-booked-detail screens. Keep this the ONLY definition
 * so the copies never drift.
 */
import { Linking } from 'react-native';
import { Analytics, EV } from '../services/analytics';

const WHATSAPP_URL = 'https://wa.me/918446385312';
const SUPPORT_EMAIL = 'contact@fixhomi.com';
const SUPPORT_PAGE = 'https://fixhomi.com/support';

/**
 * Show the Help & Support choice dialog.
 * @param {Function} dialog   from useDialog()
 * @param {string}   userType 'user' | 'provider' (for analytics role)
 */
export const showHelpSupport = (dialog, userType) => {
  const ev = userType === 'provider' ? EV.SUPPORT_CONTACTED : EV.CUSTOMER_SUPPORT_CONTACTED;
  dialog(
    'Help & Support',
    'How would you like to reach us?',
    [
      {
        text: 'WhatsApp',
        onPress: () => {
          Analytics.track(ev, { role: userType, channel: 'whatsapp' });
          Linking.openURL(WHATSAPP_URL);
        },
      },
      {
        text: 'Email',
        onPress: () => {
          Analytics.track(ev, { role: userType, channel: 'email' });
          Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => dialog('Email Us', SUPPORT_EMAIL));
        },
      },
      {
        text: 'Visit Support Page',
        onPress: () => {
          Analytics.track(ev, { role: userType, channel: 'web' });
          Linking.openURL(SUPPORT_PAGE);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
};
