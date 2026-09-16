/**
 * Work Availability Screen — full weekly schedule management.
 *
 * Reached from Settings ("Work Hours") and from the Home card ("Edit week").
 * The schedule itself lives in WorkScheduleContext, so edits made here are
 * instantly reflected on Home without another fetch.
 *
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import TouchableOpacity from '../components/TouchableOpacity';
import { Icon } from '../components';
import DayHoursSheet from '../components/DayHoursSheet';
import { useLanguage } from '../context/LanguageContext';
import { useDialog } from '../context/DialogContext';
import { useWorkSchedule } from '../context/WorkScheduleContext';
import { useApp } from '../context/AppContext';
import { DAY_KEYS, buildDaysPatch, formatTime12, getIstMoment, scheduleErrorKey } from '../utils/workSchedule';

const COLORS = {
  dark: '#0F172A',
  background: '#F1F5F9',
  white: '#FFFFFF',
  primary: '#f67c16',
  secondary: '#2b76bc',
  text: '#1E293B',
  muted: '#64748B',
  light: '#94A3B8',
  line: '#F1F5F9',
};

const WorkAvailabilityScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const { dialog } = useDialog();
  const { profile, user } = useApp();
  const { days, loading, error, saving, refresh, saveDays, resetToDefault } = useWorkSchedule();
  const [editingDay, setEditingDay] = useState(null);

  // Re-evaluated on every focus/render (O(1)), so the TODAY badge is right after midnight.
  const isFocused = useIsFocused();
  const todayKey = useMemo(() => getIstMoment().dayKey, [isFocused, days]); // eslint-disable-line react-hooks/exhaustive-deps
  const allDaysOff = !!days && DAY_KEYS.every((key) => !days[key]?.enabled);
  const emergencyEnabled = (profile?.emergencyServicesEnabled ?? user?.emergencyServicesEnabled) === true;

  const handleSaveDay = useCallback(async (value, target) => {
    const dayKey = editingDay;
    setEditingDay(null);
    const result = await saveDays(buildDaysPatch(dayKey, value, target), dayKey);
    if (!result.success) {
      dialog(t('workHours.title'), t(scheduleErrorKey(result.error)));
    }
  }, [editingDay, saveDays, dialog, t]);

  const handleToggleDay = useCallback(async (dayKey) => {
    const day = days?.[dayKey];
    if (!day || saving) return;
    const result = await saveDays({ [dayKey]: { ...day, enabled: !day.enabled } }, dayKey);
    if (!result.success) {
      dialog(t('workHours.title'), t(scheduleErrorKey(result.error)));
    }
  }, [days, saving, saveDays, dialog, t]);

  const handleReset = useCallback(() => {
    dialog(t('workHours.resetConfirmTitle'), t('workHours.resetConfirmMsg'), [
      { text: t('workHours.cancel'), style: 'cancel' },
      {
        text: t('workHours.resetConfirmYes'),
        onPress: async () => {
          const result = await resetToDefault();
          if (!result.success) dialog(t('workHours.title'), t(scheduleErrorKey(result.error)));
        },
      },
    ]);
  }, [dialog, resetToDefault, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Icon name="back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('workHours.title')}</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && !!days} onRefresh={() => refresh({ force: true })} tintColor={COLORS.primary} />}
      >
        <Text style={styles.intro}>{t('workHours.screenIntro')}</Text>

        {allDaysOff && (
          <View style={styles.noDaysBanner}>
            <Text style={styles.noDaysText}>{t('workHours.noDaysBanner')}</Text>
          </View>
        )}

        {loading && !days && <ActivityIndicator color={COLORS.primary} style={styles.loader} />}

        {!!error && !days && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{t('workHours.loadFailed')}</Text>
            <TouchableOpacity onPress={() => refresh({ force: true })} accessibilityRole="button">
              <Text style={styles.retry}>{t('workHours.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!!days && DAY_KEYS.map((key) => {
          const day = days[key];
          const busy = saving === key;
          return (
            <TouchableOpacity
              key={key}
              style={styles.dayCard}
              onPress={() => setEditingDay(key)}
              disabled={!!saving}
              accessibilityRole="button"
              accessibilityLabel={`${t(`workHours.days.${key}`)}, ${day.enabled ? t('workHours.range', { start: formatTime12(day.start), end: formatTime12(day.end) }) : t('workHours.dayOff')}`}
            >
              <View style={styles.dayTextWrap}>
                <View style={styles.dayNameRow}>
                  <Text style={[styles.dayName, !day.enabled && styles.dayNameOff]}>{t(`workHours.days.${key}`)}</Text>
                  {key === todayKey && (
                    <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>{t('workHours.todayBadge')}</Text></View>
                  )}
                </View>
                <Text style={styles.dayHours}>
                  {day.enabled ? t('workHours.range', { start: formatTime12(day.start), end: formatTime12(day.end) }) : t('workHours.dayOff')}
                </Text>
              </View>
              {busy ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Switch
                  value={day.enabled}
                  onValueChange={() => handleToggleDay(key)}
                  disabled={!!saving}
                  trackColor={{ false: '#E2E8F0', true: COLORS.primary }}
                  thumbColor={COLORS.white}
                  accessibilityLabel={t('workHours.iWorkOn', { day: t(`workHours.days.${key}`) })}
                />
              )}
            </TouchableOpacity>
          );
        })}

        {!!days && (
          <>
            <View style={styles.nightNote}>
              <Icon name="clock" size={16} color="#4F46E5" />
              <Text style={styles.nightNoteText}>
                {t('workHours.nightNote', { state: emergencyEnabled ? t('workHours.on') : t('workHours.off') })}
              </Text>
            </View>

            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} disabled={!!saving} accessibilityRole="button">
              {saving === 'reset'
                ? <ActivityIndicator size="small" color={COLORS.muted} />
                : <Text style={styles.resetText}>{t('workHours.resetDefault')}</Text>}
            </TouchableOpacity>
            <Text style={styles.footnote}>{t('workHours.defaultFootnote')}</Text>
          </>
        )}
      </ScrollView>

      <DayHoursSheet
        visible={!!editingDay}
        dayKey={editingDay}
        initial={editingDay ? days?.[editingDay] : null}
        saving={!!saving}
        onClose={() => setEditingDay(null)}
        onSave={handleSaveDay}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: COLORS.dark,
  },
  back: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },
  content: { padding: 18, paddingBottom: 40 },
  intro: { fontSize: 13.5, color: COLORS.muted, lineHeight: 20, marginBottom: 14 },
  loader: { marginTop: 24 },
  noDaysBanner: { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  noDaysText: { fontSize: 13, color: '#B91C1C', fontWeight: '600', lineHeight: 18 },
  errorBox: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, gap: 8 },
  errorText: { fontSize: 13.5, color: '#B91C1C', fontWeight: '600' },
  retry: { fontSize: 13.5, fontWeight: '700', color: COLORS.secondary },
  dayCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10,
  },
  dayTextWrap: { flex: 1 },
  dayNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayName: { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  dayNameOff: { color: COLORS.muted },
  todayBadge: { backgroundColor: '#FFF4EA', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  todayBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase' },
  dayHours: { fontSize: 13.5, color: COLORS.muted, marginTop: 2 },
  nightNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EEF2FF', borderRadius: 16, padding: 14, marginTop: 6, marginBottom: 14,
  },
  nightNoteText: { flex: 1, fontSize: 13, color: '#3730A3', lineHeight: 18 },
  resetBtn: {
    borderWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  resetText: { fontSize: 14, fontWeight: '700', color: COLORS.muted },
  footnote: { textAlign: 'center', fontSize: 12, color: COLORS.light, marginTop: 10 },
});

export default WorkAvailabilityScreen;
