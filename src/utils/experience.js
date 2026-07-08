/**
 * Experience Formatting Utilities (LinkedIn-style)
 *
 * Providers store a "Working since" date (experienceStartDate). The elapsed
 * experience is computed on the CLIENT so it stays accurate forever without
 * the provider ever updating it ("5 yrs 3 mos" style, month granularity).
 *
 * Backward compatibility: providers who never set a start date still have
 * the legacy `experience` value (a number of years like "5" or a string
 * like "5 years" / "6 months"). When experienceStartDate is present it WINS;
 * otherwise the legacy value is shown; if neither exists, null is returned
 * so callers can hide the experience line cleanly.
 */

import i18n from '../i18n';

/** Default translator — falls back to the app-wide i18n instance so the
 *  helper is localized even when a caller doesn't pass `t`. */
const defaultT = (key, options) => i18n.t(key, options);

/**
 * Compute whole elapsed months between a start date and now.
 * Returns null if the date is invalid or in the future.
 */
export const monthsSince = (startDate, now = new Date()) => {
  if (!startDate) return null;
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  if (isNaN(start.getTime()) || start > now) return null;

  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  // Don't count the current month until the same day-of-month has passed
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
};

/** Build the localized duration string from a total month count. */
const formatMonthsDuration = (totalMonths, t) => {
  if (totalMonths < 1) return t('experience.justStarted');

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];

  if (years > 0) {
    parts.push(years === 1 ? t('experience.oneYear') : t('experience.years', { n: years }));
  }
  if (months > 0) {
    parts.push(months === 1 ? t('experience.oneMonth') : t('experience.months', { n: months }));
  }
  return parts.join(' ');
};

/**
 * Parse the legacy experience value into { n, unit } or null.
 * Accepts numbers (5), numeric strings ("5"), or strings like
 * "5 years" / "6 months". Zero/empty values return null.
 */
const parseLegacyExperience = (legacy) => {
  if (legacy === null || legacy === undefined || legacy === '') return null;
  const str = String(legacy).trim();
  const n = parseInt(str.replace(/[^0-9]/g, ''), 10);
  if (isNaN(n) || n <= 0) return null;
  const unit = /month/i.test(str) ? 'months' : 'years';
  return { n, unit };
};

/**
 * Format a provider's experience for display.
 *
 * @param {Date|string|null} startDate - experienceStartDate (wins when set)
 * @param {string|number|null} legacyExperience - legacy years value ("5 years", 5, "5")
 * @param {Function} [t] - translation function; defaults to the app i18n instance
 * @returns {string|null} e.g. "5 yrs 3 mos", "8 mos", "1 yr", "Just started",
 *                        "5 yrs" (legacy), or null when nothing to show
 */
export const formatExperience = (startDate, legacyExperience, t = defaultT) => {
  const totalMonths = monthsSince(startDate);
  if (totalMonths !== null) {
    return formatMonthsDuration(totalMonths, t);
  }

  // Legacy fallback — providers who never set a start date
  const legacy = parseLegacyExperience(legacyExperience);
  if (!legacy) return null;
  if (legacy.unit === 'months') {
    return legacy.n === 1 ? t('experience.oneMonth') : t('experience.months', { n: legacy.n });
  }
  return legacy.n === 1 ? t('experience.oneYear') : t('experience.years', { n: legacy.n });
};

/**
 * Format a date as "Mar 2021" for the month+year picker field.
 */
export const formatMonthYear = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

/** Earliest selectable "Working since" date (60 years ago). */
export const minExperienceStartDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 60);
  return d;
};

export default { formatExperience, formatMonthYear, monthsSince, minExperienceStartDate };
