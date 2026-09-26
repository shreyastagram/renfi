/**
 * These tests exist because of a specific past regression: phones with older,
 * smaller RAM showed "no network connection" while their internet was working.
 * Every case below is a shape that must NOT produce a false offline.
 */
import {
  reportReachable,
  reportUnreachable,
  isOffline,
  subscribeToNetwork,
  __resetNetworkStatus,
} from '../networkStatus';

const T = 1_700_000_000_000; // fixed clock; these must not drift with real time

beforeEach(() => __resetNetworkStatus());

describe('going offline — conservative', () => {
  it('stays online after a single network failure', () => {
    // A lone timeout is the most common event on a cold Render dyno.
    reportUnreachable(T);
    expect(isOffline()).toBe(false);
  });

  it('goes offline after two failures with no success between them', () => {
    reportUnreachable(T);
    reportUnreachable(T + 1000);
    expect(isOffline()).toBe(true);
  });

  it('never goes offline from a cold start, however long it takes', () => {
    // No success has EVER been recorded, so the grace window cannot apply —
    // this is the genuine "opened the app with the radio off" case.
    reportUnreachable(T);
    reportUnreachable(T + 30_000);
    expect(isOffline()).toBe(true);
  });
});

describe('the low-RAM false positive', () => {
  it('ignores failures that land just after a success', () => {
    // The shape on a slow device: several requests in flight, one returns,
    // the others time out because the phone is busy, not because it is offline.
    reportReachable(T);
    reportUnreachable(T + 500);
    reportUnreachable(T + 900);
    reportUnreachable(T + 3000);
    expect(isOffline()).toBe(false);
  });

  it('still goes offline once the grace window has genuinely elapsed', () => {
    reportReachable(T);
    reportUnreachable(T + 9000); // past GRACE_MS
    reportUnreachable(T + 10_000);
    expect(isOffline()).toBe(true);
  });

  it('a success resets the failure count, so slow bursts never accumulate', () => {
    reportUnreachable(T);
    reportReachable(T + 100);
    reportUnreachable(T + 20_000); // clear of the grace window
    expect(isOffline()).toBe(false); // count restarted, one failure is not enough
  });
});

describe('recovering — immediate and unconditional', () => {
  it('clears the moment anything succeeds', () => {
    reportUnreachable(T);
    reportUnreachable(T + 1000);
    expect(isOffline()).toBe(true);

    reportReachable(T + 2000);
    expect(isOffline()).toBe(false);
  });

  it('cannot get stuck offline while requests are succeeding', () => {
    reportUnreachable(T);
    reportUnreachable(T + 1000);
    for (let i = 0; i < 5; i += 1) reportReachable(T + 2000 + i * 100);
    expect(isOffline()).toBe(false);
  });
});

describe('subscribers', () => {
  it('fires immediately with the current value', () => {
    const seen = [];
    subscribeToNetwork((v) => seen.push(v));
    expect(seen).toEqual([false]);
  });

  it('notifies on transition only, not on every report', () => {
    const seen = [];
    subscribeToNetwork((v) => seen.push(v));
    reportUnreachable(T);
    reportUnreachable(T + 1000); // -> offline
    reportUnreachable(T + 2000); // still offline, no new event
    reportReachable(T + 3000); // -> online
    expect(seen).toEqual([false, true, false]);
  });

  it('unsubscribes cleanly', () => {
    const seen = [];
    const off = subscribeToNetwork((v) => seen.push(v));
    off();
    reportUnreachable(T);
    reportUnreachable(T + 1000);
    expect(seen).toEqual([false]);
  });

  it('one throwing subscriber does not stop the others', () => {
    const seen = [];
    subscribeToNetwork(() => { throw new Error('bad subscriber'); });
    subscribeToNetwork((v) => seen.push(v));
    reportUnreachable(T);
    reportUnreachable(T + 1000);
    expect(seen).toEqual([false, true]);
  });
});
