import { initialWorkScheduleState, workScheduleReducer as reduce } from '../src/context/workScheduleReducer';

const view = (monStart = '10:00') => ({
  workSchedule: {
    source: 'default',
    days: {
      mon: { enabled: true, start: monStart, end: '19:00' },
      tue: { enabled: true, start: '10:00', end: '19:00' },
    },
  },
  scheduleEnforced: true,
});

const loaded = (v = view()) => reduce(
  reduce(initialWorkScheduleState, { type: 'LOAD_START', seq: 1 }),
  { type: 'LOAD_SUCCESS', seq: 1, view: v },
);

test('load lifecycle', () => {
  const s1 = reduce(initialWorkScheduleState, { type: 'LOAD_START', seq: 1 });
  expect(s1).toMatchObject({ loading: true, error: null });
  const s2 = reduce(s1, { type: 'LOAD_SUCCESS', seq: 1, view: view() });
  expect(s2).toMatchObject({ loading: false, view: view(), loadedAt: expect.any(Number) });
});

test('keeps showing the last good schedule when a refresh fails', () => {
  const s = reduce(reduce(loaded(), { type: 'LOAD_START', seq: 2 }), { type: 'LOAD_FAILURE', seq: 2, error: { code: 'NO_INTERNET' } });
  expect(s.view).toEqual(view());
  expect(s.error).toEqual({ code: 'NO_INTERNET' });
  expect(s.loading).toBe(false);
});

test('ignores stale load responses', () => {
  let s = reduce(loaded(), { type: 'LOAD_START', seq: 2 });
  s = reduce(s, { type: 'LOAD_START', seq: 3 });
  s = reduce(s, { type: 'LOAD_SUCCESS', seq: 2, view: view('06:00') });
  expect(s.view.workSchedule.days.mon.start).toBe('10:00');
  expect(s.loading).toBe(true);
});

test('optimistic save applies the patch immediately and marks custom', () => {
  const s = reduce(loaded(), { type: 'SAVE_START', key: 'mon', patch: { mon: { enabled: false, start: '10:00', end: '19:00' } } });
  expect(s.view.workSchedule.days.mon.enabled).toBe(false);
  expect(s.view.workSchedule.days.tue.enabled).toBe(true);
  expect(s.view.workSchedule.source).toBe('custom');
  expect(s.saving).toBe('mon');
});

test('a refresh landing during a save does not overwrite the optimistic edit', () => {
  let s = reduce(loaded(), { type: 'SAVE_START', key: 'mon', patch: { mon: { enabled: false, start: '10:00', end: '19:00' } } });
  s = reduce(s, { type: 'LOAD_START', seq: 2 });
  s = reduce(s, { type: 'LOAD_SUCCESS', seq: 2, view: view() });
  expect(s.view.workSchedule.days.mon.enabled).toBe(false);
});

test('save success replaces with the server view', () => {
  let s = reduce(loaded(), { type: 'SAVE_START', key: 'mon', patch: { mon: { enabled: true, start: '08:00', end: '19:00' } } });
  s = reduce(s, { type: 'SAVE_SUCCESS', view: view('08:00') });
  expect(s).toMatchObject({ saving: null, view: view('08:00') });
});

test('save failure rolls back to the snapshot', () => {
  let s = reduce(loaded(), { type: 'SAVE_START', key: 'mon', patch: { mon: { enabled: false, start: '10:00', end: '19:00' } } });
  s = reduce(s, { type: 'SAVE_FAILURE' });
  expect(s.view).toEqual(view());
  expect(s.saving).toBeNull();
});

test('CLEAR on logout', () => {
  expect(reduce(loaded(), { type: 'CLEAR' })).toEqual(initialWorkScheduleState);
});
