/**
 * V2 — a partial jauth response must not downgrade a verified user.
 *
 * The identity tests are not style points: this runs on every app foreground, and
 * returning a fresh object when nothing changed is what caused the jobs-screen reload
 * loop and the dashboard churn on low-end devices.
 */

const { mergeVerificationFields } = require('../mergeVerificationFields');

const VERIFIED = {
  email: 'a@b.com',
  fullName: 'Ravi Kumar',
  phone: '9876543210',
  isEmailVerified: true,
  isPhoneVerified: true,
  isActive: true,
  role: 'PROVIDER',
  hasPassword: true,
};

const FULL_RESPONSE = {
  email: 'a@b.com',
  fullName: 'Ravi Kumar',
  phoneNumber: '9876543210',
  isEmailVerified: true,
  isPhoneVerified: true,
  isActive: true,
  role: 'PROVIDER',
  hasPassword: true,
};

describe('absent is not false', () => {
  it('keeps isEmailVerified when the response omits it', () => {
    const out = mergeVerificationFields(VERIFIED, { ...FULL_RESPONSE, isEmailVerified: undefined });
    expect(out.isEmailVerified).toBe(true);
  });

  it('keeps isPhoneVerified when the response omits it', () => {
    const out = mergeVerificationFields(VERIFIED, { ...FULL_RESPONSE, isPhoneVerified: undefined });
    expect(out.isPhoneVerified).toBe(true);
  });

  it('keeps a deactivated account deactivated when isActive is omitted', () => {
    // The old default was `?? true`, which would silently reactivate.
    const out = mergeVerificationFields(
      { ...VERIFIED, isActive: false },
      { ...FULL_RESPONSE, isActive: undefined },
    );
    expect(out.isActive).toBe(false);
  });

  it('survives a response that carries only the fields it knows', () => {
    const out = mergeVerificationFields(VERIFIED, { email: 'a@b.com' });
    expect(out.isEmailVerified).toBe(true);
    expect(out.isPhoneVerified).toBe(true);
    expect(out.fullName).toBe('Ravi Kumar');
  });
});

describe('an explicit value from the server still wins', () => {
  it('honours an explicit false — a genuine un-verification is not ignored', () => {
    const out = mergeVerificationFields(VERIFIED, { ...FULL_RESPONSE, isEmailVerified: false });
    expect(out.isEmailVerified).toBe(false);
  });

  it('honours an explicit isActive false', () => {
    const out = mergeVerificationFields(VERIFIED, { ...FULL_RESPONSE, isActive: false });
    expect(out.isActive).toBe(false);
  });

  it('defaults to false when neither side knows', () => {
    const out = mergeVerificationFields(null, { email: 'new@b.com' });
    expect(out.isEmailVerified).toBe(false);
    expect(out.isPhoneVerified).toBe(false);
    expect(out.isActive).toBe(true);
  });
});

describe('object identity', () => {
  it('returns prev ITSELF when the response changes nothing', () => {
    expect(mergeVerificationFields(VERIFIED, FULL_RESPONSE)).toBe(VERIFIED);
  });

  it('still returns prev itself when the response omits everything', () => {
    // The regression risk in the fix: falling back to prev must not build a new object.
    expect(mergeVerificationFields(VERIFIED, {})).toBe(VERIFIED);
  });

  it('returns a NEW object when something actually changed', () => {
    const out = mergeVerificationFields(VERIFIED, { ...FULL_RESPONSE, isPhoneVerified: false });
    expect(out).not.toBe(VERIFIED);
    expect(out.isPhoneVerified).toBe(false);
  });

  it('maps phoneNumber onto phone', () => {
    const out = mergeVerificationFields(VERIFIED, { ...FULL_RESPONSE, phoneNumber: '9000000000' });
    expect(out.phone).toBe('9000000000');
  });

  it('preserves unrelated keys on prev', () => {
    const out = mergeVerificationFields(
      { ...VERIFIED, mongoId: 'abc123', isAvailable: true },
      { ...FULL_RESPONSE, fullName: 'Ravi K' },
    );
    expect(out.mongoId).toBe('abc123');
    expect(out.isAvailable).toBe(true);
  });
});
