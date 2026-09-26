/**
 * V5 — the rules that decide whether "Link sent" is still true.
 *
 * Every case here is a way the badge could lie: claiming mail is on its way to an
 * address it was never sent to, or long after the link died.
 */

const {
  isPending,
  markSent,
  readPending,
  clearPending,
  PENDING_TTL_MS,
} = require('../emailVerificationPending');

const NOW = 1_700_000_000_000;
const rec = (over = {}) => ({ email: 'a@b.com', sentAt: NOW, ...over });

describe('isPending', () => {
  it('is true right after a send', () => {
    expect(isPending(rec(), 'a@b.com', NOW)).toBe(true);
  });

  it('is true just inside the TTL', () => {
    expect(isPending(rec(), 'a@b.com', NOW + PENDING_TTL_MS - 1000)).toBe(true);
  });

  it('expires once the link is no longer worth chasing', () => {
    expect(isPending(rec(), 'a@b.com', NOW + PENDING_TTL_MS + 1)).toBe(false);
  });

  it('does not carry over to a DIFFERENT address', () => {
    // The user changed their email: the old link is irrelevant and the row must
    // offer Verify again rather than claim mail is coming.
    expect(isPending(rec(), 'new@b.com', NOW)).toBe(false);
  });

  it('matches the address case-insensitively', () => {
    expect(isPending(rec({ email: 'A@B.com' }), 'a@b.com', NOW)).toBe(true);
  });

  it('survives a clock that moved backwards', () => {
    // A link probably IS in flight; the worse failure is sending the user to a
    // button the backend will rate-limit.
    expect(isPending(rec(), 'a@b.com', NOW - 60_000)).toBe(true);
  });

  it('is false for nothing stored, or a corrupt record', () => {
    expect(isPending(null, 'a@b.com', NOW)).toBe(false);
    expect(isPending({}, 'a@b.com', NOW)).toBe(false);
    expect(isPending(rec({ sentAt: 'yesterday' }), 'a@b.com', NOW)).toBe(false);
    expect(isPending(rec({ sentAt: NaN }), 'a@b.com', NOW)).toBe(false);
  });

  it('is false when the row has no address yet', () => {
    expect(isPending(rec(), '', NOW)).toBe(false);
    expect(isPending(rec(), undefined, NOW)).toBe(false);
  });
});

describe('storage round-trip', () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  beforeEach(() => AsyncStorage.clear());

  it('remembers a send and forgets it on clear', async () => {
    await markSent('u1', 'a@b.com', NOW);
    await expect(readPending('u1', 'a@b.com', NOW)).resolves.toBe(true);
    await clearPending('u1');
    await expect(readPending('u1', 'a@b.com', NOW)).resolves.toBe(false);
  });

  it('keeps users separate', async () => {
    await markSent('u1', 'a@b.com', NOW);
    await expect(readPending('u2', 'a@b.com', NOW)).resolves.toBe(false);
  });

  it('never throws on unparseable storage', async () => {
    await AsyncStorage.setItem('emailVerifyPending:u1', 'not json');
    await expect(readPending('u1', 'a@b.com', NOW)).resolves.toBe(false);
  });

  it('is a no-op without a user id, rather than writing a junk key', async () => {
    await markSent(null, 'a@b.com', NOW);
    await expect(AsyncStorage.getItem('emailVerifyPending:null')).resolves.toBeNull();
  });
});
