/**
 * InlineFieldCollectorModal
 *
 * A lightweight bottom-sheet that collects a single REQUIRED, non-optional
 * profile field (currently: name) INLINE during the booking flow — instead of
 * routing the user away to the Profile screen (which loses their selected
 * service and breaks the flow). Modeled on the app's own PhoneChangeModal for
 * keyboard / safe-area / low-RAM handling, and on VerificationScreen's
 * add-value editor for the input + Save UX.
 *
 * Rendered once at app root by ProfileCompletionProvider and opened imperatively
 * via `collectRequiredField(field)`. On a successful save it persists to Java
 * Auth + Mongo (via updateProfileWithAutoSync) so the value reflects app-wide,
 * then resolves true so the pending booking can continue with the SAME
 * selection. Cancel / backdrop / hardware-back resolve false (booking does not
 * proceed). A failed save keeps the sheet open with an inline retry message.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

const BRAND = {
  primary: '#f67c16',
  text: '#0F172A',
  sub: '#64748B',
  border: '#E2E8F0',
  inputBg: '#F8FAFC',
  danger: '#DC2626',
  white: '#FFFFFF',
  sheet: '#FFFFFF',
  backdrop: 'rgba(15,23,42,0.45)',
};

/**
 * Per-field config — extensible beyond `name` (e.g. a future required field).
 * `toUpdates` returns BOTH `name` and `fullName` so the Mongo mirror (`name`)
 * and Java Auth (`fullName`) both receive the value regardless of which key the
 * sync layer reads.
 */
const FIELDS = {
  name: {
    icon: 'badge',
    maxLength: 100,
    autoCapitalize: 'words',
    keyboardType: 'default',
    getInitial: (user, profile) =>
      (profile?.name || profile?.fullName || user?.fullName || '').toString(),
    isValid: (v) => {
      const t = (v || '').trim();
      return t.length >= 2 && t.length <= 100;
    },
    toUpdates: (v) => ({ name: (v || '').trim(), fullName: (v || '').trim() }),
  },
};

const InlineFieldCollectorModal = ({ field = 'name', bottomInset = 0, onDone }) => {
  const { user, profile, updateProfileWithAutoSync } = useApp();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const cfg = FIELDS[field] || FIELDS.name;

  const inputRef = useRef(null);
  const busyRef = useRef(false); // reentry guard across renders
  const [value, setValue] = useState(() => cfg.getInitial(user, profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // useSafeAreaInsets is unreliable inside an RN Modal (separate window); use
  // the parent-provided inset, fall back to the modal's own reading, then a
  // small floor — same approach as PhoneChangeModal.
  const safeBottom = Math.max(bottomInset || 0, insets.bottom || 0, 20);

  // Focus after the modal settles — autoFocus is unreliable in an RN Modal on
  // iOS (focus fires before present completes).
  useEffect(() => {
    const id = setTimeout(
      () => inputRef.current?.focus(),
      Platform.OS === 'ios' ? 350 : 60
    );
    return () => clearTimeout(id);
  }, []);

  const labels = useMemo(
    () => ({
      title: t('userHome.completeNameTitle') || 'Add your name',
      subtitle:
        t('userHome.completeNameSub') ||
        'Providers see this so they know who they’re helping. You only need to do this once — it saves to your profile.',
      placeholder: t('profile.fullNamePlaceholder') || 'Your full name',
      save: t('userHome.saveContinue') || 'Save & continue',
      cancel: t('common.cancel') || 'Cancel',
      invalid: t('profile.invalidNameMsg') || 'Please enter your full name (2–100 characters).',
      failed:
        t('userHome.saveFailed') ||
        'Couldn’t save. Please check your connection and try again.',
    }),
    [t]
  );

  const close = useCallback(
    (ok) => {
      if (busyRef.current) return; // never dismiss mid-save
      onDone?.(!!ok);
    },
    [onDone]
  );

  const handleSave = useCallback(async () => {
    if (busyRef.current) return;
    if (!cfg.isValid(value)) {
      setError(labels.invalid);
      return;
    }
    setError('');
    busyRef.current = true;
    setSaving(true);
    let ok = false;
    try {
      if (typeof updateProfileWithAutoSync === 'function') {
        const result = await updateProfileWithAutoSync(cfg.toUpdates(value));
        ok = !!result?.success;
      }
      if (!ok) setError(labels.failed);
    } catch (e) {
      setError(labels.failed);
    } finally {
      // ALWAYS clear busy/saving so the sheet can never get stuck (even on the
      // "session missing" edge path).
      busyRef.current = false;
      setSaving(false);
    }
    // Continue the booking only on a confirmed save (state already reset above).
    if (ok) onDone?.(true);
  }, [cfg, value, updateProfileWithAutoSync, onDone, labels]);

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => close(false)}
    >
      <KeyboardAvoidingView style={s.flex} behavior="padding">
        <Pressable
          style={s.backdrop}
          onPress={() => close(false)}
          accessibilityRole="button"
          accessibilityLabel={labels.cancel}
        />
        <View style={[s.sheet, { paddingBottom: safeBottom + 12 }]}>
          <View style={s.handle} />

          <View style={s.headerRow}>
            <View style={s.iconWrap}>
              <MaterialIcon name={cfg.icon} size={20} color={BRAND.primary} />
            </View>
            <Text style={s.title}>{labels.title}</Text>
            <TouchableOpacity
              onPress={() => close(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={labels.cancel}
            >
              <MaterialIcon name="close" size={22} color={BRAND.sub} />
            </TouchableOpacity>
          </View>

          <Text style={s.subtitle}>{labels.subtitle}</Text>

          <TextInput
            ref={inputRef}
            style={[s.input, error ? s.inputError : null]}
            value={value}
            onChangeText={(txt) => {
              setValue(txt);
              if (error) setError('');
            }}
            placeholder={labels.placeholder}
            placeholderTextColor="#9CA3AF"
            autoCapitalize={cfg.autoCapitalize}
            keyboardType={cfg.keyboardType}
            maxLength={cfg.maxLength}
            editable={!saving}
            returnKeyType="done"
            onSubmitEditing={handleSave}
            accessibilityLabel={labels.title}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.cta, saving ? s.ctaDisabled : null]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={labels.save}
          >
            {saving ? (
              <ActivityIndicator color={BRAND.white} />
            ) : (
              <Text style={s.ctaText}>{labels.save}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f67c1620',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: BRAND.text },
  subtitle: { fontSize: 13.5, lineHeight: 19, color: BRAND.sub, marginTop: 12, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: BRAND.text,
    backgroundColor: BRAND.inputBg,
  },
  inputError: { borderColor: BRAND.danger },
  error: { color: BRAND.danger, fontSize: 12.5, marginTop: 8 },
  cta: {
    marginTop: 18,
    backgroundColor: BRAND.primary,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: BRAND.white, fontSize: 16, fontWeight: '700' },
});

export default React.memo(InlineFieldCollectorModal);
