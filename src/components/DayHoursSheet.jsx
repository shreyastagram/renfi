/**
 * DayHoursSheet — edit one day's working hours.
 *
 * Opened from the Home card's week strip and from the Work Hours screen.
 * Local draft state; the parent saves (optimistically) and closes.
 * Validation mirrors the backend so the provider sees the problem before saving.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Switch, ActivityIndicator, ScrollView } from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import TimePickerField from './TimePickerField';
import { useLanguage } from '../context/LanguageContext';
import { validateDay } from '../utils/workSchedule';

const COLORS = {
  white: '#FFFFFF',
  dark: '#0F172A',
  text: '#1E293B',
  muted: '#64748B',
  line: '#F1F5F9',
  primary: '#f67c16',
  secondary: '#2b76bc',
  danger: '#DC2626',
  scrim: 'rgba(15, 23, 42, 0.45)',
};

const ERROR_KEYS = {
  END_BEFORE_START: 'workHours.errEndBeforeStart',
  TOO_SHORT: 'workHours.errTooShort',
  INVALID: 'workHours.errInvalid',
};

const TARGETS = ['one', 'weekdays', 'all'];

const DayHoursSheet = ({ visible, dayKey, initial, saving = false, onClose, onSave }) => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(initial);
  const [openField, setOpenField] = useState(null);
  const [target, setTarget] = useState('one');

  // Reset the draft whenever a (different) day is opened.
  useEffect(() => {
    if (visible) {
      setDraft(initial);
      setOpenField(null);
      setTarget('one');
    }
  }, [visible, dayKey, initial]);

  const dayName = dayKey ? t(`workHours.days.${dayKey}`) : '';
  const errorCode = useMemo(() => (draft ? validateDay(draft) : null), [draft]);

  const setEnabled = useCallback((enabled) => setDraft((d) => ({ ...d, enabled })), []);
  const setStart = useCallback((start) => setDraft((d) => ({ ...d, start })), []);
  const setEnd = useCallback((end) => setDraft((d) => ({ ...d, end })), []);

  const handleSave = useCallback(() => {
    if (errorCode || !draft) return;
    onSave(draft, target);
  }, [draft, errorCode, target, onSave]);

  if (!visible || !draft) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.scrim}>
        <TouchableOpacity style={styles.scrimTap} onPress={saving ? undefined : onClose} accessibilityLabel={t('workHours.cancel')} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{dayName}</Text>
            <Text style={styles.subtitle}>{t('workHours.sheetSubtitle')}</Text>

            <View style={styles.workRow}>
              <Text style={styles.workRowText}>{t('workHours.iWorkOn', { day: dayName })}</Text>
              <Switch
                value={draft.enabled}
                onValueChange={setEnabled}
                disabled={saving}
                trackColor={{ false: '#E2E8F0', true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            <View style={styles.times}>
              <TimePickerField
                label={t('workHours.start')}
                value={draft.start}
                onChange={setStart}
                disabled={!draft.enabled || saving}
                isOpen={openField === 'start'}
                onOpen={() => setOpenField('start')}
                onClose={() => setOpenField(null)}
                testID="work-hours-start"
              />
              <View style={styles.gap} />
              <TimePickerField
                label={t('workHours.end')}
                value={draft.end}
                onChange={setEnd}
                disabled={!draft.enabled || saving}
                isOpen={openField === 'end'}
                onOpen={() => setOpenField('end')}
                onClose={() => setOpenField(null)}
                testID="work-hours-end"
              />
            </View>

            {!!errorCode && <Text style={styles.error}>{t(ERROR_KEYS[errorCode])}</Text>}

            <Text style={styles.applyLabel}>{t('workHours.applyTo')}</Text>
            <View style={styles.seg}>
              {TARGETS.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.segBtn, target === key && styles.segBtnOn]}
                  onPress={() => setTarget(key)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityState={{ selected: target === key }}
                >
                  <Text style={[styles.segText, target === key && styles.segTextOn]}>
                    {key === 'one' ? t('workHours.applyOne', { day: dayName }) : t(`workHours.apply${key === 'weekdays' ? 'Weekdays' : 'All'}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.save, (!!errorCode || saving) && styles.saveDisabled]}
              onPress={handleSave}
              disabled={!!errorCode || saving}
              accessibilityRole="button"
            >
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveText}>{t('workHours.save')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={saving} accessibilityRole="button">
              <Text style={styles.cancelText}>{t('workHours.cancel')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: COLORS.scrim, justifyContent: 'flex-end' },
  scrimTap: { flex: 1 },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 26,
    maxHeight: '88%',
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.dark },
  subtitle: { fontSize: 13, color: COLORS.muted, marginTop: 2, marginBottom: 14 },
  workRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  workRowText: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 10 },
  times: { flexDirection: 'row', alignItems: 'flex-start' },
  gap: { width: 10 },
  error: { color: COLORS.danger, fontSize: 13, fontWeight: '600', marginTop: 10 },
  applyLabel: { fontSize: 12.5, fontWeight: '700', color: COLORS.muted, marginTop: 16, marginBottom: 8 },
  seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segBtn: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  segBtnOn: { borderColor: COLORS.secondary, backgroundColor: '#EFF6FF' },
  segText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  segTextOn: { color: COLORS.secondary },
  save: {
    height: 52, borderRadius: 14, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 18,
  },
  saveDisabled: { opacity: 0.45 },
  saveText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  cancelText: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
});

export default React.memo(DayHoursSheet);
