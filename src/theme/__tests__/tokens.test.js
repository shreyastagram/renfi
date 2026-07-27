const { lightTheme, darkTheme } = require('../themes');

describe('theme tokens', () => {
  it('exposes matching key sets for light and dark', () => {
    expect(Object.keys(lightTheme.colors).sort())
      .toEqual(Object.keys(darkTheme.colors).sort());
  });

  it('names each theme', () => {
    expect(lightTheme.name).toBe('light');
    expect(darkTheme.name).toBe('dark');
  });

  it('preserves the Fixhomi brand orange unchanged in both themes', () => {
    expect(lightTheme.colors.brandOrange).toBe('#f67c16');
    expect(darkTheme.colors.brandOrange).toBe('#f67c16');
  });

  it('never puts white on brand orange', () => {
    expect(lightTheme.colors.onBrandOrange).not.toBe('#FFFFFF');
    expect(darkTheme.colors.onBrandOrange).not.toBe('#FFFFFF');
  });

  it('exposes spacing, radii and elevation on both themes', () => {
    for (const theme of [lightTheme, darkTheme]) {
      expect(typeof theme.spacing.md).toBe('number');
      expect(typeof theme.radii.card).toBe('number');
      expect(theme.elevation.card).toHaveProperty('elevation');
    }
  });

  it('pairs every elevation with iOS shadow properties', () => {
    for (const level of Object.values(lightTheme.elevation)) {
      expect(level).toHaveProperty('shadowColor');
      expect(level).toHaveProperty('shadowOffset');
      expect(level).toHaveProperty('shadowOpacity');
      expect(level).toHaveProperty('shadowRadius');
      expect(level).toHaveProperty('elevation');
    }
  });
});
