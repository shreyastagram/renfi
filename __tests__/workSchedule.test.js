import {
  DAY_KEYS,
  hhmmToMinutes,
  formatTime12,
  getIstMoment,
  validateDay,
  computeHomeStatus,
  agoParts,
  summarizeWeek,
  buildDaysPatch,
} from '../src/utils/workSchedule';

const week = () => ({
  mon: { enabled: true, start: '10:00', end: '19:00' },
  tue: { enabled: true, start: '10:00', end: '19:00' },
  wed: { enabled: true, start: '10:00', end: '19:00' },
  thu: { enabled: true, start: '10:00', end: '19:00' },
  fri: { enabled: true, start: '10:00', end: '19:00' },
  sat: { enabled: true, start: '09:00', end: '17:00' },
  sun: { enabled: true, start: '09:00', end: '17:00' },
});

describe('time helpers', () => {
  test('DAY_KEYS order', () => {
    expect(DAY_KEYS).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  });
  test('hhmmToMinutes', () => {
    expect(hhmmToMinutes('10:00')).toBe(600);
    expect(hhmmToMinutes('24:00')).toBeNull();
  });
  test('formatTime12', () => {
    expect(formatTime12('00:00')).toBe('12:00 AM');
    expect(formatTime12('19:00')).toBe('7:00 PM');
    expect(formatTime12('09:05')).toBe('9:05 AM');
    expect(formatTime12('bad')).toBe('');
  });
  test('getIstMoment is independent of device timezone', () => {
    expect(getIstMoment(new Date('2026-09-14T05:30:00Z'))).toEqual({ dayKey: 'mon', minute: 660 });
    expect(getIstMoment(new Date('2026-09-14T18:45:00Z'))).toEqual({ dayKey: 'tue', minute: 15 });
  });
});

describe('validateDay', () => {
  test.each([
    [{ enabled: true, start: '10:00', end: '19:00' }, null],
    [{ enabled: true, start: '19:00', end: '10:00' }, 'END_BEFORE_START'],
    [{ enabled: true, start: '10:00', end: '10:00' }, 'END_BEFORE_START'],
    [{ enabled: true, start: '10:00', end: '10:20' }, 'TOO_SHORT'],
    [{ enabled: false, start: '19:00', end: '10:00' }, null], // a day off is not blocked by bad times
    [{ enabled: true, start: '', end: '10:00' }, 'INVALID'],
  ])('%j → %s', (day, code) => {
    expect(validateDay(day)).toBe(code);
  });
});

describe('computeHomeStatus', () => {
  const base = { days: week(), isAvailable: true, emergencyServicesEnabled: false, scheduleEnforced: true };
  const at = (dayKey, minute) => ({ dayKey, minute });

  test.each([
    ['toggle off wins', { isAvailable: false }, at('mon', 660), { kind: 'offline' }],
    ['rollout switch off', { scheduleEnforced: false }, at('mon', 1200), { kind: 'saved_not_enforced' }],
    ['Mon 11:00 within', {}, at('mon', 660), { kind: 'within', end: '19:00' }],
    ['Mon 08:30 before', {}, at('mon', 510), { kind: 'before', start: '10:00' }],
    ['Mon 20:00 after', {}, at('mon', 1200), { kind: 'after' }],
    ['night without opt-in', {}, at('mon', 1410), { kind: 'night_off' }],
    ['night with opt-in', { emergencyServicesEnabled: true }, at('tue', 60), { kind: 'night_on' }],
    ['hours running past 22:00 win over the night rule', { days: { ...week(), mon: { enabled: true, start: '08:00', end: '23:30' } } }, at('mon', 1350), { kind: 'within', end: '23:30' }],
    ['a day off stays off at night even with the opt-in', { emergencyServicesEnabled: true, days: { ...week(), sun: { enabled: false, start: '09:00', end: '17:00' } } }, at('sun', 1380), { kind: 'day_off' }],
  ])('%s', (_l, over, moment, expected) => {
    expect(computeHomeStatus({ ...base, ...over, moment })).toEqual(expected);
  });

  test('day off', () => {
    const days = week();
    days.sun.enabled = false;
    expect(computeHomeStatus({ ...base, days, moment: at('sun', 660) })).toEqual({ kind: 'day_off' });
  });

  test('missing schedule → loading-safe status', () => {
    expect(computeHomeStatus({ ...base, days: null, moment: at('mon', 660) })).toEqual({ kind: 'unknown' });
  });
});

describe('summarizeWeek', () => {
  test('groups consecutive identical days', () => {
    expect(summarizeWeek(week())).toEqual([
      { from: 'mon', to: 'fri', enabled: true, start: '10:00', end: '19:00' },
      { from: 'sat', to: 'sun', enabled: true, start: '09:00', end: '17:00' },
    ]);
  });
  test('day off breaks groups', () => {
    const days = week();
    days.wed.enabled = false;
    expect(summarizeWeek(days).map((g) => `${g.from}-${g.to}:${g.enabled}`)).toEqual([
      'mon-tue:true', 'wed-wed:false', 'thu-fri:true', 'sat-sun:true',
    ]);
  });
});

describe('buildDaysPatch', () => {
  const value = { enabled: true, start: '08:00', end: '14:00' };
  test('only this day', () => {
    expect(buildDaysPatch('tue', value, 'one')).toEqual({ tue: value });
  });
  test('weekdays', () => {
    expect(Object.keys(buildDaysPatch('tue', value, 'weekdays'))).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
  });
  test('every day', () => {
    expect(Object.keys(buildDaysPatch('sat', value, 'all'))).toEqual(DAY_KEYS);
  });
});

describe('agoParts', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  test.each([
    [null, null],
    ['2026-09-14T11:59:40Z', { unit: 'justNow', n: 0 }],
    ['2026-09-14T11:45:00Z', { unit: 'minutes', n: 15 }],
    ['2026-09-14T09:00:00Z', { unit: 'hours', n: 3 }],
    ['2026-09-12T12:00:00Z', { unit: 'days', n: 2 }],
    ['not-a-date', null],
  ])('%s', (input, expected) => {
    expect(agoParts(input, now)).toEqual(expected);
  });
});
