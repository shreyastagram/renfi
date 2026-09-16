/**
 * WeeklyScheduleCard — the Work Hours card on Provider Home.
 *
 * Quick view + quick edit: today's hours, whether customers can find the
 * provider right now, a tappable week strip, and the age of their last
 * location fix. Memoized and fed primitive props, because ProviderHomeScreen
 * re-renders on every useApp()/useLocation() change.
 *
 * The status clock sleeps until the next moment the status can change (see
 * useIstMoment) and only runs while the screen is focused.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import { Icon } from './index';
import { useLanguage } from '../context/LanguageContext';
import {
  DAY_KEYS, agoParts, computeHomeStatus, formatTime12, getIstMoment, msUntilNextStatusChange,
} from '../utils/workSchedule';

// Card text may grow with accessibility font size, but not enough to break the
// 7-column week strip on 320dp phones.
const MAX_FONT_SCALE = 1.25;

const BRAND = { primary: '#f67c16', secondary: '#2b76bc', white: '#FFFFFF', dark: '#0F172A', muted: '#94A3B8', text: '#64748B' };

const STATUS_STYLE = {
  within: { bg: '#ECFDF5', fg: '#047857', dot: '#10B981' },
  night_on: { bg: '#ECFDF5', fg: '#047857', dot: '#10B981' },
  before: { bg: '#FFF7ED', fg: '#B45309', dot: '#F59E0B' },
  after: { bg: '#FFF7ED', fg: '#B45309', dot: '#F59E0B' },
  day_off: { bg: '#F1F5F9', fg: '#475569', dot: '#94A3B8' },
  night_off: { bg: '#F1F5F9', fg: '#475569', dot: '#94A3B8' },
  offline: { bg: '#F1F5F9', fg: '#475569', dot: '#94A3B8' },
  saved_not_enforced: { bg: '#EFF6FF', fg: '#1D4ED8', dot: '#3B82F6' },
  no_days: { bg: '#FEF2F2', fg: '#B91C1C', dot: '#EF4444' },
  unknown: { bg: '#F1F5F9', fg: '#475569', dot: '#CBD5E1' },
};

const STATUS_KEY = {
  within: 'workHours.statusWithin',
  before: 'workHours.statusBefore',
  after: 'workHours.statusAfter',
  day_off: 'workHours.statusDayOff',
  offline: 'workHours.statusOffline',
  night_on: 'workHours.statusNightOn',
  night_off: 'workHours.statusNightOff',
  saved_not_enforced: 'workHours.statusSaved',
  no_days: 'workHours.statusNoDays',
  unknown: 'workHours.statusLoading',
};

/**
 * Live IST moment that only updates when the status could actually change
 * (hours start/end, 07:00/22:00, midnight) — a handful of re-renders a day
 * instead of one per minute. Paused while the screen is not focused.
 */
function useIstMoment(active, days) {
  const [moment, setMoment] = useState(() => getIstMoment());
  useEffect(() => {
    if (!active) return undefined;
    let timer;
    const tick = () => {
      setMoment((prev) => {
        const next = getIstMoment();
        return prev.dayKey === next.dayKey && prev.minute === next.minute ? prev : next;
      });
      timer = setTimeout(tick, msUntilNextStatusChange(days));
    };
    tick();
    return () => clearTimeout(timer);
  }, [active, days]);
  return moment;
}

const WeeklyScheduleCard = ({
  days,
  isAvailable,
  emergencyServicesEnabled,
  scheduleEnforced,
  lastLocationAt,
  loading,
  error,
  focused = true,
  updatingLocation = false,
  onPressDay,
  onPressEditWeek,
  onUpdateLocation,
  onRetry,
}) => {
  const { t } = useLanguage();
  const moment = useIstMoment(focused, days);

  const status = useMemo(
    () => computeHomeStatus({ days, isAvailable, emergencyServicesEnabled, scheduleEnforced, moment }),
    [days, isAvailable, emergencyServicesEnabled, scheduleEnforced, moment],
  );
  const today = days ? days[moment.dayKey] : null;
  const tone = STATUS_STYLE[status.kind] || STATUS_STYLE.unknown;
  const statusText = t(STATUS_KEY[status.kind], {
    time: status.start ? formatTime12(status.start) : '',
  });

  const ago = useMemo(() => agoParts(lastLocationAt), [lastLocationAt]);
  const locationText = ago
    ? t('workHours.locationUpdated', { ago: t(`workHours.ago.${ago.unit}`, { n: ago.n }) })
    : t('workHours.locationNever');

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{t('workHours.sectionTitle')}</Text>
        <TouchableOpacity onPress={onPressEditWeek} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.editWeek} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{t('workHours.editWeek')} ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {error && !days ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{t('workHours.loadFailed')}</Text>
            <TouchableOpacity onPress={onRetry} accessibilityRole="button">
              <Text style={styles.retry}>{t('workHours.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.todayRow}>
              <View style={styles.todayIcon}>
                <Icon name="clock" size={20} color={BRAND.primary} />
              </View>
              <View style={styles.todayTextWrap}>
                <Text style={styles.todayLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {t('workHours.today', { day: t(`workHours.days.${moment.dayKey}`) })}
                </Text>
                {loading && !days ? (
                  <ActivityIndicator size="small" color={BRAND.muted} style={styles.todayLoader} />
                ) : (
                  <Text
                    style={[styles.todayValue, !today?.enabled && styles.todayValueOff]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}
                  >
                    {today?.enabled
                      ? t('workHours.range', { start: formatTime12(today.start), end: formatTime12(today.end) })
                      : t('workHours.dayOff')}
                  </Text>
                )}
              </View>
            </View>

            <View style={[styles.status, { backgroundColor: tone.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
              <Text style={[styles.statusText, { color: tone.fg }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{statusText}</Text>
            </View>

            <View style={styles.week}>
              {DAY_KEYS.map((key) => {
                const day = days?.[key];
                const on = !!day?.enabled;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, !on && styles.chipOff, key === moment.dayKey && styles.chipToday]}
                    onPress={() => onPressDay(key)}
                    disabled={!days}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(`workHours.days.${key}`)}: ${on ? t('workHours.range', { start: formatTime12(day.start), end: formatTime12(day.end) }) : t('workHours.dayOff')}`}
                  >
                    <Text
                      style={[styles.chipLetter, !on && styles.chipTextOff]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.15}
                    >
                      {t(`workHours.dayLetters.${key}`)}
                    </Text>
                    {/* Narrowest case ~34dp per chip (320dp phone): shrink rather than clip */}
                    <Text
                      style={[styles.chipHours, !on && styles.chipTextOff]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                      maxFontSizeMultiplier={1.15}
                    >
                      {on ? `${shortHour(day.start)}–${shortHour(day.end)}` : t('workHours.off')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.locationRow}>
              <Icon name="location" size={13} color={BRAND.muted} />
              <Text style={styles.locationText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{locationText}</Text>
              <TouchableOpacity onPress={onUpdateLocation} disabled={updatingLocation} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.locationAction} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {updatingLocation ? t('workHours.updating') : t('workHours.updateNow')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

/** "10:00" → "10", "09:30" → "9:30" — the chips are narrow on 360-wide phones. */
function shortHour(hhmm) {
  const [h, m] = String(hhmm || '').split(':');
  const hour = Number(h) % 12 === 0 ? 12 : Number(h) % 12;
  return m === '00' ? `${hour}` : `${hour}:${m}`;
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 10, gap: 8 },
  sectionTitle: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  editWeek: { fontSize: 13, fontWeight: '700', color: BRAND.secondary },
  card: {
    backgroundColor: BRAND.white, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9',
    padding: 14, marginBottom: 16,
  },
  todayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  todayIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF4EA', alignItems: 'center', justifyContent: 'center' },
  todayTextWrap: { flex: 1, minWidth: 0 },
  todayLabel: { fontSize: 12, fontWeight: '600', color: BRAND.text },
  todayValue: { fontSize: 17, fontWeight: '800', color: BRAND.dark, letterSpacing: -0.3, marginTop: 1 },
  todayValueOff: { color: BRAND.text, fontWeight: '700' },
  todayLoader: { alignSelf: 'flex-start', marginTop: 4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', marginTop: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  week: { flexDirection: 'row', gap: 4, marginTop: 14 },
  chip: { flex: 1, minWidth: 0, borderWidth: 1.5, borderColor: '#FED7AA', backgroundColor: '#FFF7ED', borderRadius: 12, paddingVertical: 7, paddingHorizontal: 2, alignItems: 'center' },
  chipOff: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  chipToday: { borderColor: BRAND.primary, borderWidth: 2 },
  chipLetter: { fontSize: 13, fontWeight: '800', color: '#C2410C' },
  chipHours: { fontSize: 10, fontWeight: '600', color: '#9A3412', marginTop: 1 },
  chipTextOff: { color: BRAND.muted },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  locationText: { flex: 1, fontSize: 12.5, color: BRAND.text },
  locationAction: { fontSize: 12.5, fontWeight: '700', color: BRAND.secondary },
  errorBox: { paddingVertical: 6, gap: 6 },
  errorText: { fontSize: 13, color: '#B91C1C', fontWeight: '600' },
  retry: { fontSize: 13, fontWeight: '700', color: BRAND.secondary },
});

export default React.memo(WeeklyScheduleCard);
