/**
 * On an auth screen the primary action must survive the keyboard.
 *
 * WHY THIS EXISTS
 *
 * LoginScreen shipped a KeyboardAvoidingView wrapping a plain View. That is
 * only half the job: the view is pushed up, but if the content is taller than
 * what remains there is nothing to scroll, so the sign-in button sat under the
 * keyboard with no way to reach it. Every other auth screen already had the
 * ScrollView; that one was the outlier, and an outlier is invisible until
 * someone opens that exact screen on that exact phone.
 *
 * The three pieces that make it work together:
 *   KeyboardAvoidingView   moves the content up
 *   ScrollView             lets the user reach what is still covered
 *   keyboardShouldPersistTaps="handled"
 *                          lets the first tap hit the button instead of being
 *                          swallowed dismissing the keyboard
 */
const fs = require('fs');
const path = require('path');

// Screens that take typed input, or whose primary action sits below content.
const TYPED = [
  'LoginScreen', 'RegisterScreen', 'OTPVerifyScreen', 'OTPLoginScreen',
  'ForgotPasswordScreen', 'PhoneSignupScreen', 'PhoneNumberScreen',
  'ProviderRegisterScreen', 'ChangePasswordScreen',
];

const read = (n) =>
  fs.readFileSync(path.join(__dirname, '..', '..', 'screens', `${n}.jsx`), 'utf8');

describe('auth screens keep their action above the keyboard', () => {
  it.each(TYPED)('%s avoids the keyboard AND can scroll', (n) => {
    const src = read(n);
    expect(src).toMatch(/KeyboardAvoidingView/);
    // A KAV with nothing scrollable inside cannot rescue a covered button.
    expect(src).toMatch(/<ScrollView/);
  });

  it.each(TYPED)('%s lets the first tap reach the button', (n) => {
    // Without this the first tap only dismisses the keyboard, which reads as
    // the button being broken.
    expect(read(n)).toMatch(/keyboardShouldPersistTaps/);
  });

  it.each(TYPED)('%s lets short content centre rather than cluster', (n) => {
    // flexGrow alone still pins content to the top of a tall screen — it needs
    // justifyContent too. AUTH.contentContainer carries both, so a screen may
    // satisfy this either by spelling them out or by using the shared rule.
    const src = read(n);
    const spelledOut = /flexGrow/.test(src) && /justifyContent/.test(src);
    const shared = /AUTH\.contentContainer/.test(src);
    expect(spelledOut || shared).toBe(true);
  });
});
