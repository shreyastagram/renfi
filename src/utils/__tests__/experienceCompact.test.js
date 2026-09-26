/**
 * The stat strip shows ONE token, so the year figure has to be a real fraction
 * of the month count. The owner's point: 2 months is not 0.2 of a year, and 4
 * months is not 0.4 — 12 is not 10. These lock that arithmetic down.
 */
import { formatExperienceCompact } from '../experience';

// Minimal stand-in for i18n so the tests assert the NUMBER, not the wording.
const t = (key, o) => {
  const table = {
    'profile.newProvider': 'New',
    'experience.oneMonth': '1 mo',
    'experience.months': `${o?.n} mos`,
    'experience.oneYear': '1 yr',
    'experience.years': `${o?.n} yrs`,
  };
  return table[key] ?? key;
};

// A fixed "now" so these never drift with the calendar.
const NOW = new Date('2026-09-26T12:00:00Z');
const monthsAgo = (n) => {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() - n);
  return d;
};

describe('formatExperienceCompact', () => {
  it('turns 5 yrs 2 mos into 5.2 yrs, not 5.02', () => {
    // 62 months / 12 = 5.1666… -> 5.2
    expect(formatExperienceCompact(monthsAgo(62), null, t)).toBe('5.2 yrs');
  });

  it('treats 4 months as a third of a year, never 0.4', () => {
    // Under a year there is no fraction to show at all — whole months.
    expect(formatExperienceCompact(monthsAgo(4), null, t)).toBe('4 mos');
    // And 1 yr 4 mos is 16/12 = 1.33 -> 1.3, not 1.4
    expect(formatExperienceCompact(monthsAgo(16), null, t)).toBe('1.3 yrs');
  });

  it('drops a trailing .0 on whole years', () => {
    expect(formatExperienceCompact(monthsAgo(60), null, t)).toBe('5 yrs');
    expect(formatExperienceCompact(monthsAgo(24), null, t)).toBe('2 yrs');
  });

  it('uses the singular at exactly one year and one month', () => {
    expect(formatExperienceCompact(monthsAgo(12), null, t)).toBe('1 yr');
    expect(formatExperienceCompact(monthsAgo(1), null, t)).toBe('1 mo');
  });

  it('rounds to one decimal at the boundaries', () => {
    expect(formatExperienceCompact(monthsAgo(13), null, t)).toBe('1.1 yrs'); // 1.083
    expect(formatExperienceCompact(monthsAgo(18), null, t)).toBe('1.5 yrs');
    expect(formatExperienceCompact(monthsAgo(23), null, t)).toBe('1.9 yrs'); // 1.916
  });

  it('says New below one month', () => {
    expect(formatExperienceCompact(monthsAgo(0), null, t)).toBe('New');
  });

  it('falls back to the legacy value when there is no start date', () => {
    expect(formatExperienceCompact(null, '5 years', t)).toBe('5 yrs');
    expect(formatExperienceCompact(null, '6 months', t)).toBe('6 mos');
    expect(formatExperienceCompact(null, 3, t)).toBe('3 yrs');
  });

  it('returns null when there is nothing to show, so callers can hide the cell', () => {
    expect(formatExperienceCompact(null, null, t)).toBeNull();
    expect(formatExperienceCompact(null, 0, t)).toBeNull();
  });

  it('ignores a future start date rather than showing a negative', () => {
    const future = new Date(NOW);
    future.setFullYear(future.getFullYear() + 1);
    expect(formatExperienceCompact(future, null, t)).toBeNull();
  });
});
