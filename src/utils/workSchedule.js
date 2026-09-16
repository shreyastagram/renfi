/**
 * Work Availability — pure helpers (no React, no network).
 *
 * The backend owns defaults and eligibility; these helpers only format,
 * validate before saving, and describe the provider's current situation on
 * the Home card. Rules mirror noefix utils/workAvailability (IST, same-day
 * slots, start inclusive / end exclusive, 22:00–07:00 night window).
 */

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const IST_OFFSET_MINUTES = 330;
const NIGHT_START = 22 * 60;
const NIGHT_END = 7 * 60;
const MIN_SLOT_MINUTES = 30;

export function hhmmToMinutes(value) {
  const m = typeof value === 'string' ? value.match(HHMM) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function minutesToHhmm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "19:00" → "7:00 PM" (empty string for invalid input). */
export function formatTime12(hhmm) {
  const mins = hhmmToMinutes(hhmm);
  if (mins === null) return '';
  const h24 = Math.floor(mins / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mins % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** Current IST day + minute, regardless of the device timezone. */
export function getIstMoment(date = new Date()) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  return {
    dayKey: DAY_KEYS[(shifted.getUTCDay() + 6) % 7],
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** Local Date whose clock shows the given "HH:mm" (for the native time picker). */
export function hhmmToPickerDate(hhmm) {
  const mins = hhmmToMinutes(hhmm) ?? 600;
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

export function pickerDateToHhmm(date) {
  return minutesToHhmm(date.getHours() * 60 + date.getMinutes());
}

/** @returns {null|'INVALID'|'END_BEFORE_START'|'TOO_SHORT'} */
export function validateDay(day) {
  if (!day || day.enabled !== true) return null;
  const start = hhmmToMinutes(day.start);
  const end = hhmmToMinutes(day.end);
  if (start === null || end === null) return 'INVALID';
  if (end <= start) return 'END_BEFORE_START';
  if (end - start < MIN_SLOT_MINUTES) return 'TOO_SHORT';
  return null;
}

const isNight = (minute) => minute >= NIGHT_START || minute < NIGHT_END;

/**
 * What the Home card tells the provider right now.
 * @returns {{kind: 'unknown'|'offline'|'saved_not_enforced'|'night_on'|'night_off'|'day_off'|'within'|'before'|'after', start?: string, end?: string}}
 */
export function computeHomeStatus({ days, isAvailable, emergencyServicesEnabled, scheduleEnforced, moment }) {
  if (!isAvailable) return { kind: 'offline' };
  if (!days) return { kind: 'unknown' };
  if (!scheduleEnforced) return { kind: 'saved_not_enforced' };
  const day = days[moment.dayKey];
  if (!day || !day.enabled) return { kind: 'day_off' };
  const start = hhmmToMinutes(day.start);
  const end = hhmmToMinutes(day.end);
  if (moment.minute >= start && moment.minute < end) return { kind: 'within', end: day.end };
  // Inside 22:00–07:00 the Night Emergency opt-in is an ALTERNATIVE to the
  // configured hours (it never overrides a day off or later hours) — mirrors
  // noefix utils/workAvailability/eligibility.js.
  if (isNight(moment.minute)) return { kind: emergencyServicesEnabled ? 'night_on' : 'night_off' };
  if (moment.minute < start) return { kind: 'before', start: day.start };
  return { kind: 'after' };
}

/**
 * Relative age for "last seen" lines, as parts for i18n:
 * @returns {null | {unit: 'justNow'|'minutes'|'hours'|'days', n: number}}
 */
export function agoParts(date, now = new Date()) {
  if (!date) return null;
  const ms = now.getTime() - new Date(date).getTime();
  if (Number.isNaN(ms)) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return { unit: 'justNow', n: 0 };
  if (minutes < 60) return { unit: 'minutes', n: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: 'hours', n: hours };
  return { unit: 'days', n: Math.floor(hours / 24) };
}

const sameHours = (a, b) => a.enabled === b.enabled && (!a.enabled || (a.start === b.start && a.end === b.end));

/** Consecutive days with the same hours → [{from, to, enabled, start, end}]. */
export function summarizeWeek(days) {
  if (!days) return [];
  const groups = [];
  for (const key of DAY_KEYS) {
    const d = days[key];
    if (!d) continue;
    const last = groups[groups.length - 1];
    if (last && sameHours(last, d)) last.to = key;
    else groups.push({ from: key, to: key, enabled: d.enabled, start: d.start, end: d.end });
  }
  return groups;
}

/**
 * PATCH body `days` for a sheet save.
 * @param {'one'|'weekdays'|'all'} target
 */
export function buildDaysPatch(dayKey, value, target = 'one') {
  const keys = target === 'all' ? DAY_KEYS : target === 'weekdays' ? WEEKDAY_KEYS : [dayKey];
  const clean = { enabled: value.enabled, start: value.start, end: value.end };
  return Object.fromEntries(keys.map((k) => [k, { ...clean }]));
}
