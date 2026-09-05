/**
 * SupportSheet
 *
 * A polished bottom-sheet for Help & Support — replaces the old text-only
 * "orange button" dialog. Shows WhatsApp and Email as iconized action rows
 * (recognizable brand glyphs, tinted circles) and "Visit Support Page" as a
 * plain text link (no icon, per product spec).
 *
 * Rendered once at app root by SupportProvider and opened imperatively via
 * `useSupport().openSupport(userType)`. Same URLs / analytics as the previous
 * flow (single source: utils/helpSupport.js SUPPORT_LINKS), plus a
 * "WhatsApp not available" fallback. Styled to match InlineFieldCollectorModal
 * for a cohesive design language; handles iOS/Android + safe-area like the
 * app's other modals. Vector glyphs (not images) → negligible memory on
 * low-RAM devices.
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  Linking,
} from 'react-native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { Analytics, EV } from '../services/analytics';
import { SUPPORT_LINKS } from '../utils/helpSupport';

const WHATSAPP_GREEN = '#25D366';
const BRAND = {
  primary: '#f67c16',
  emailBlue: '#2b76bc',
  text: '#0F172A',
  sub: '#64748B',
  border: '#EEF2F6',
  white: '#FFFFFF',
  sheet: '#FFFFFF',
  chevron: '#CBD5E1',
  backdrop: 'rgba(15,23,42,0.45)',
};

const SupportSheet = ({ userType, bottomInset = 0, onClose }) => {
  const { dialog } = useDialog();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(bottomInset || 0, insets.bottom || 0, 20);
  const ev = userType === 'provider' ? EV.SUPPORT_CONTACTED : EV.CUSTOMER_SUPPORT_CONTACTED;

  const labels = useMemo(
    () => ({
      title: t('support.title') || 'Help & Support',
      subtitle: t('support.subtitle') || 'How would you like to reach us?',
      whatsapp: t('support.whatsapp') || 'WhatsApp',
      whatsappSub: t('support.whatsappSub') || 'Chat with our team',
      email: t('support.email') || 'Email',
      web: t('support.visitPage') || 'Visit Support Page',
      cancel: t('common.cancel') || 'Cancel',
      emailUs: t('support.emailUs') || 'Email Us',
      waMissing:
        t('support.whatsappMissing') ||
        'WhatsApp isn’t available on this device. Please email us instead.',
    }),
    [t]
  );

  const openWhatsApp = useCallback(async () => {
    Analytics.track(ev, { role: userType, channel: 'whatsapp' });
    try {
      const supported = await Linking.canOpenURL(SUPPORT_LINKS.WHATSAPP_URL);
      if (supported) {
        await Linking.openURL(SUPPORT_LINKS.WHATSAPP_URL);
      } else {
        dialog(labels.whatsapp, labels.waMissing);
      }
    } catch (e) {
      dialog(labels.whatsapp, labels.waMissing);
    }
    onClose?.();
  }, [ev, userType, dialog, labels, onClose]);

  const openEmail = useCallback(() => {
    Analytics.track(ev, { role: userType, channel: 'email' });
    Linking.openURL(`mailto:${SUPPORT_LINKS.SUPPORT_EMAIL}`).catch(() =>
      dialog(labels.emailUs, SUPPORT_LINKS.SUPPORT_EMAIL)
    );
    onClose?.();
  }, [ev, userType, dialog, labels, onClose]);

  const openWeb = useCallback(() => {
    Analytics.track(ev, { role: userType, channel: 'web' });
    Linking.openURL(SUPPORT_LINKS.SUPPORT_PAGE).catch(() => {});
    onClose?.();
  }, [ev, userType, onClose]);

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.flex}>
        <Pressable
          style={s.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={labels.cancel}
        />
        <View style={[s.sheet, { paddingBottom: safeBottom + 12 }]}>
          <View style={s.handle} />

          <View style={s.headerRow}>
            <Text style={s.title}>{labels.title}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={labels.cancel}
            >
              <MaterialIcon name="close" size={22} color={BRAND.sub} />
            </TouchableOpacity>
          </View>
          <Text style={s.subtitle}>{labels.subtitle}</Text>

          {/* WhatsApp — brand glyph in a tinted circle */}
          <TouchableOpacity
            style={s.row}
            onPress={openWhatsApp}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={labels.whatsapp}
          >
            <View style={[s.iconCircle, { backgroundColor: WHATSAPP_GREEN + '1A' }]}>
              <MaterialCommunityIcon name="whatsapp" size={24} color={WHATSAPP_GREEN} />
            </View>
            <View style={s.rowTextWrap}>
              <Text style={s.rowTitle}>{labels.whatsapp}</Text>
              <Text style={s.rowSub}>{labels.whatsappSub}</Text>
            </View>
            <MaterialIcon name="chevron-right" size={22} color={BRAND.chevron} />
          </TouchableOpacity>

          {/* Email — envelope glyph in a tinted circle */}
          <TouchableOpacity
            style={s.row}
            onPress={openEmail}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={labels.email}
          >
            <View style={[s.iconCircle, { backgroundColor: BRAND.emailBlue + '1A' }]}>
              <MaterialCommunityIcon name="email-outline" size={22} color={BRAND.emailBlue} />
            </View>
            <View style={s.rowTextWrap}>
              <Text style={s.rowTitle}>{labels.email}</Text>
              <Text style={s.rowSub}>{SUPPORT_LINKS.SUPPORT_EMAIL}</Text>
            </View>
            <MaterialIcon name="chevron-right" size={22} color={BRAND.chevron} />
          </TouchableOpacity>

          {/* Visit Support Page — plain text link, no icon (per spec) */}
          <TouchableOpacity
            style={s.webRow}
            onPress={openWeb}
            activeOpacity={0.6}
            accessibilityRole="link"
            accessibilityLabel={labels.web}
          >
            <Text style={s.webText}>{labels.web}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: BRAND.backdrop },
  sheet: {
    backgroundColor: BRAND.sheet,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: BRAND.text },
  subtitle: { fontSize: 13.5, lineHeight: 19, color: BRAND.sub, marginTop: 8, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: BRAND.text },
  rowSub: { fontSize: 12.5, color: BRAND.sub, marginTop: 2 },
  webRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  webText: { fontSize: 14, fontWeight: '600', color: BRAND.primary },
});

export default React.memo(SupportSheet);
