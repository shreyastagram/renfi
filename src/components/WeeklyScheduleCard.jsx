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
import { useThemedStyles, useThemeColors } from '../theme';

// Card text may grow with accessibility font size, but not enough to break the
// 7-column week strip on 320dp phones.
const MAX_FONT_SCALE = 1.25;

const makeC = (c) => ({
  primary: c.brandOrange,
  secondary: c.brandBlue,
  white: c.surface,
  dark: c.textPrimary,
  muted: c.textMuted,
  text: c.textSecondary,
  // The shipped hairline was #F1F5F9 -- exactly `bg` in light, a recessed seam on a
  // dark surface.
  hairline: c.bg,
  line: c.border,
  sunken: c.surfaceSunken,
  warning: c.warning,
  warningBg: c.warningContainer,
  warningLine: c.warningBorder,
  danger: c.danger,
});

// Availability status tones. Each keeps its HUE family but takes the accessible
// token from it. `fg` was already #475569 for the neutral states -- exactly
// textSecondary -- so those are unchanged.
const makeStatusStyle = (c) => ({
  within: { bg: c.successContainer, fg: c.success, dot: c.success },
  night_on: { bg: c.successContainer, fg: c.success, dot: c.success },
  before: { bg: c.warningContainer, fg: c.warning, dot: c.warning },
  after: { bg: c.warningContainer, fg: c.warning, dot: c.warning },
  day_off: { bg: c.bg, fg: c.textSecondary, dot: c.textMuted },
  night_off: { bg: c.bg, fg: c.textSecondary, dot: c.textMuted },
  offline: { bg: c.bg, fg: c.textSecondary, dot: c.textMuted },
  saved_not_enforced: { bg: c.infoContainer, fg: c.info, dot: c.altBlueSky },
  no_days: { bg: c.dangerContainer, fg: c.danger, dot: c.danger },
  unknown: { bg: c.bg, fg: c.textSecondary, dot: c.borderMedium },
});

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
  availabilityKnown = true,
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
  const styles = useThemedStyles(makeStyles);
  const themeColors = useThemeColors();
  const C = makeC(themeColors);
  const STATUS_STYLE = makeStatusStyle(themeColors);
  const { t } = useLanguage();
  const moment = useIstMoment(focused, days);

  const status = useMemo(
    () => computeHomeStatus({ days, isAvailable, availabilityKnown, emergencyServicesEnabled, scheduleEnforced, moment }),
    [days, isAvailable, availabilityKnown, emergencyServicesEnabled, scheduleEnforced, moment],
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
                <Icon name="clock" size={20} color={C.primary} />
              </View>
              <View style={styles.todayTextWrap}>
                <Text style={styles.todayLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {t('workHours.today', { day: t(`workHours.days.${moment.dayKey}`) })}
                </Text>
                {loading && !days ? (
                  <ActivityIndicator size="small" color={C.muted} style={styles.todayLoader} />
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
              <Icon name="location" size={13} color={C.muted} />
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

const makeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 10, gap: 8 },
  sectionTitle: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  editWeek: { fontSize: 13, fontWeight: '700', color: C.secondary },
  card: {
    backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.hairline,
    padding: 14, marginBottom: 16,
  },
  todayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  todayIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.warningBg, alignItems: 'center', justifyContent: 'center' },
  todayTextWrap: { flex: 1, minWidth: 0 },
  todayLabel: { fontSize: 12, fontWeight: '600', color: C.text },
  todayValue: { fontSize: 17, fontWeight: '800', color: C.dark, letterSpacing: -0.3, marginTop: 1 },
  todayValueOff: { color: C.text, fontWeight: '700' },
  todayLoader: { alignSelf: 'flex-start', marginTop: 4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', marginTop: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  week: { flexDirection: 'row', gap: 4, marginTop: 14 },
  chip: { flex: 1, minWidth: 0, borderWidth: 1.5, borderColor: C.warningLine, backgroundColor: C.warningBg, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 2, alignItems: 'center' },
  chipOff: { backgroundColor: C.sunken, borderColor: C.line },
  chipToday: { borderColor: C.primary, borderWidth: 2 },
  chipLetter: { fontSize: 13, fontWeight: '800', color: C.warning },
  chipHours: { fontSize: 10, fontWeight: '600', color: C.warning, marginTop: 1 },
  // a11y: C.muted (#94A3B8) on the off-chip (#F8FAFC) is 2.45:1 and fails.
  // The chip is a live TouchableOpacity even when off, so the WCAG exemption for
  // disabled controls does not apply. #5B6878 is 5.43:1 and is the value the
  // theme's textMuted token already uses; this becomes that token in the
  // provider-screen migration phase.
  chipTextOff: { color: C.muted },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.hairline },
  locationText: { flex: 1, fontSize: 12.5, color: C.text },
  locationAction: { fontSize: 12.5, fontWeight: '700', color: C.secondary },
  errorBox: { paddingVertical: 6, gap: 6 },
  errorText: { fontSize: 13, color: C.danger, fontWeight: '600' },
  retry: { fontSize: 13, fontWeight: '700', color: C.secondary },
  });
};

export default React.memo(WeeklyScheduleCard);
