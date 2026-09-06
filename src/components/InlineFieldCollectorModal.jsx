/**
 * InlineFieldCollectorModal
 *
 * A sleek bottom-sheet that collects a single REQUIRED, non-optional profile
 * field (currently: name) INLINE during booking — instead of routing to the
 * Profile screen (which loses the selected service). Modeled on PhoneChangeModal
 * for keyboard / safe-area / low-RAM handling.
 *
 * Rendered once at app root by ProfileCompletionProvider and opened imperatively
 * via `collectRequiredField(field)`. On save it persists via
 * updateProfileWithAutoSync (Java Auth / Neon + Mongo — now retried through cold
 * starts), shows a brief "Saved" confirmation, then resolves true so the booking
 * continues with the SAME selection. Cancel / backdrop / back resolve false. A
 * genuine failure keeps the sheet open with an inline retry message.
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
  success: '#16A34A',
  white: '#FFFFFF',
  sheet: '#FFFFFF',
  backdrop: 'rgba(15,23,42,0.45)',
};

// Per-field config — extensible beyond `name`. `toUpdates` returns BOTH `name`
// and `fullName` so the Mongo mirror and Java Auth (Neon) both receive it.
const FIELDS = {
  name: {
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
    // Server-side confirmation: the required field is now present on the profile.
    isSaved: (profileData) =>
      ((profileData?.name || profileData?.fullName || '').trim().length >= 2),
  },
};

const InlineFieldCollectorModal = ({ field = 'name', bottomInset = 0, onDone }) => {
  const { user, profile, userType, updateProfileWithAutoSync, refreshProfile } = useApp();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const cfg = FIELDS[field] || FIELDS.name;

  const inputRef = useRef(null);
  const busyRef = useRef(false); // reentry / dismiss guard
  const [value, setValue] = useState(() => cfg.getInitial(user, profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const safeBottom = Math.max(bottomInset || 0, insets.bottom || 0, 20);

  useEffect(() => {
    const id = setTimeout(
      () => inputRef.current?.focus(),
      Platform.OS === 'ios' ? 350 : 60
    );
    return () => clearTimeout(id);
  }, []);

  const labels = useMemo(
    () => ({
      title: t('userHome.completeNameTitle') || 'What’s your name?',
      subtitle:
        t('userHome.completeNameSub') ||
        'We’ll show this to the professional so they know who they’re helping. Saved to your profile — you only do this once.',
      placeholder: t('profile.fullNamePlaceholder') || 'Your full name',
      save: t('userHome.saveContinue') || 'Save & continue',
      saved: t('userHome.saveSuccess') || 'Saved',
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
      if (busyRef.current) return; // never dismiss mid-save or during confirmation
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
      // A slow/cold backend can time out the CLIENT after the SERVER already
      // saved. Before declaring failure, verify against the server — if the
      // value is now persisted, treat it as success (no false "couldn't save").
      if (!ok && typeof refreshProfile === 'function') {
        try {
          const uid = user?.mongoId || user?._id;
          const fresh = await refreshProfile(userType, uid, { force: true });
          if (fresh && cfg.isSaved(fresh)) ok = true;
        } catch (verifyErr) {
          /* verification also failed — keep ok = false */
        }
      }
      if (!ok) setError(labels.failed);
    } catch (e) {
      setError(labels.failed);
    } finally {
      setSaving(false);
    }
    if (ok) {
      // Keep busyRef=true so the backdrop can't dismiss during the confirmation.
      setSaved(true);
      setTimeout(() => onDone?.(true), 850);
    } else {
      busyRef.current = false;
    }
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
        <View style={[s.sheet, { paddingBottom: safeBottom + 14 }]}>
          <View style={s.handle} />

          {saved ? (
            <View style={s.successWrap}>
              <View style={s.successCircle}>
                <MaterialIcon name="check" size={30} color={BRAND.white} />
              </View>
              <Text style={s.successText}>{labels.saved}</Text>
            </View>
          ) : (
            <>
              <View style={s.headerRow}>
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
            </>
          )}
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 18,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: BRAND.text, letterSpacing: -0.3, paddingRight: 12 },
  subtitle: { fontSize: 14, lineHeight: 20, color: BRAND.sub, marginTop: 8, marginBottom: 18 },
  input: {
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 15 : 11,
    fontSize: 16.5,
    color: BRAND.text,
    backgroundColor: BRAND.inputBg,
  },
  inputError: { borderColor: BRAND.danger },
  error: { color: BRAND.danger, fontSize: 13, marginTop: 8, marginLeft: 2 },
  cta: {
    marginTop: 18,
    backgroundColor: BRAND.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: BRAND.white, fontSize: 16.5, fontWeight: '700' },
  successWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 26 },
  successCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successText: { fontSize: 17, fontWeight: '700', color: BRAND.text },
});

export default React.memo(InlineFieldCollectorModal);
