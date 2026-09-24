const { resolveThemeName, THEME_MODES } = require('../resolveThemeName');

describe('resolveThemeName', () => {
  it('honours an explicit light choice regardless of system', () => {
    expect(resolveThemeName('light', 'dark')).toBe('light');
    expect(resolveThemeName('light', 'light')).toBe('light');
  });

  it('honours an explicit dark choice regardless of system', () => {
    expect(resolveThemeName('dark', 'light')).toBe('dark');
    expect(resolveThemeName('dark', 'dark')).toBe('dark');
  });

  it('follows the system when mode is system', () => {
    expect(resolveThemeName('system', 'dark')).toBe('dark');
    expect(resolveThemeName('system', 'light')).toBe('light');
  });

  it('falls back to light when the system scheme is null', () => {
    expect(resolveThemeName('system', null)).toBe('light');
    expect(resolveThemeName('system', undefined)).toBe('light');
  });

  it('falls back to light for an unrecognised persisted mode', () => {
    expect(resolveThemeName('purple', 'dark')).toBe('dark');
    expect(resolveThemeName(null, null)).toBe('light');
  });

  it('exposes exactly three modes', () => {
    expect(THEME_MODES).toEqual(['light', 'dark', 'system']);
  });
});
