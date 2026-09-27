/**
 * The auth screens must take their vertical rhythm from one place.
 *
 * Measured before this existed, across eleven screens styling the same three
 * elements:
 *
 *   brand -> title gap    10, 14, 18, 20
 *   title size            21, 22, 24
 *   subtitle size         13, 14
 *   header -> body gap    8, 20, 24, 28, 32
 *
 * No single screen was wrong, which is why it drifted — each was edited alone
 * and looked fine alone. It only reads as ill-organised when you move between
 * them and the same three things keep changing size and position.
 *
 * Same shape as the wordmark problem: one idea, many copies, owned by nobody.
 */
const fs = require('fs');
const path = require('path');

const SCREENS = [
  'UserTypeScreen', 'UnifiedUserAuthScreen', 'LoginScreen', 'RegisterScreen',
  'OTPVerifyScreen', 'OTPLoginScreen', 'ForgotPasswordScreen',
  'PhoneSignupScreen', 'PhoneNumberScreen', 'ProviderRegisterScreen',
];

const read = (n) =>
  fs.readFileSync(path.join(__dirname, '..', '..', 'screens', `${n}.jsx`), 'utf8');

/**
 * A literal number on one of the shared header properties.
 *
 * These styles are written BOTH single-line and multi-line across the
 * screens. The first version of this only matched the multi-line shape, so it
 * silently found nothing and passed on a screen with hardcoded sizes — the
 * check has to handle both or it is decoration.
 */
const styleBlock = (src, key) => {
  const start = new RegExp(`^  ${key}: \\{`, 'm').exec(src);
  if (!start) return null;
  const open = src.indexOf('{', start.index);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
};

const hardcoded = (src) => {
  const out = [];
  for (const key of ['brandName', 'logo', 'title', 'subtitle', 'header']) {
    const block = styleBlock(src, key);
    if (!block) continue;
    for (const prop of ['fontSize', 'marginBottom', 'lineHeight']) {
      const p = new RegExp(`${prop}: (\\d[\\d.]*)`).exec(block);
      if (p) out.push(`${key}.${prop} = ${p[1]}`);
    }
  }
  return out;
};

describe('auth screens share one vertical scale', () => {
  it.each(SCREENS)('%s takes its header rhythm from AUTH', (n) => {
    const src = read(n);
    expect(src).toMatch(/\bAUTH\b/);
    // Any literal left on those five styles is a screen inventing numbers again.
    expect(hardcoded(src)).toEqual([]);
  });

  it('the scale itself is a single definition', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'authLayout.js'), 'utf8');
    for (const k of ['brandGap', 'titleGap', 'headerGap', 'title', 'subtitle']) {
      expect(src).toMatch(new RegExp(`\\b${k}\\b`));
    }
  });
});
