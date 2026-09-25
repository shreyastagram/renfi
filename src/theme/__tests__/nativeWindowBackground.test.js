/**
 * The native cold-start window background must match the JS theme.
 *
 * WHY THIS EXISTS
 *
 * Android paints `android:windowBackground` before the JS bundle mounts. If that
 * colour does not match the theme the app is about to render, the user sees a flash
 * of the wrong colour on every cold start — white on a dark theme is the ugly case.
 *
 * The two values live in XML, far from the tokens, and the original file carried a
 * comment saying "if these drift apart the app flashes the wrong colour" with nothing
 * enforcing it. This is that enforcement.
 *
 * The same pair also caused a release-build failure: the night colour existed only in
 * values-night, which Android lint rejects as MissingDefaultResource because a colour
 * reachable by name from a non-night configuration can crash. Hence the assertion that
 * BOTH folders declare it.
 */

const fs = require('fs');
const path = require('path');

const { lightTheme, darkTheme } = require('../themes');

const RES = path.resolve(__dirname, '../../../android/app/src/main/res');
const NAME = 'theme_window_background';

const readColor = (folder) => {
  const file = path.join(RES, folder, 'colors.xml');
  expect(fs.existsSync(file)).toBe(true);
  const xml = fs.readFileSync(file, 'utf8');
  const m = xml.match(new RegExp(`<color name="${NAME}">\\s*(#[0-9a-fA-F]{6,8})\\s*</color>`));
  expect(m).not.toBeNull();
  return m[1].toUpperCase();
};

describe('native window background', () => {
  it('is declared in the BASE values folder, not only in values-night', () => {
    // Android lint (MissingDefaultResource) fails the release build otherwise.
    expect(fs.existsSync(path.join(RES, 'values', 'colors.xml'))).toBe(true);
    expect(readColor('values')).toBeTruthy();
  });

  it('matches lightColors.bg in the base folder', () => {
    expect(readColor('values')).toBe(lightTheme.colors.bg.toUpperCase());
  });

  it('matches darkColors.bg in values-night', () => {
    expect(readColor('values-night')).toBe(darkTheme.colors.bg.toUpperCase());
  });

  it('is referenced by both themes, so neither flashes the platform default', () => {
    for (const folder of ['values', 'values-night']) {
      const styles = fs.readFileSync(path.join(RES, folder, 'styles.xml'), 'utf8');
      expect(styles).toContain(`android:windowBackground">@color/${NAME}<`);
    }
  });
});
