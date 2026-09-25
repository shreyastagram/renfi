const { lightTheme, darkTheme } = require('../themes');
const palette = require('../tokens/palette');

describe('palette hygiene', () => {
  // Regression guard: semanticDarkBorder was added to palette.js and never wired
  // into semantic.js, so the dark status-chip borders existed as dead code while
  // the mockup relied on them. Anything exported from palette must be consumed.
  it('has no orphaned exports — every palette group is consumed by the themes', () => {
    const consumed = new Set(
      [lightTheme, darkTheme].flatMap((t) => Object.values(t.colors)),
    );
    const orphans = Object.entries(palette)
      // Deliberately not theme tokens: vendor colours are fixed by a third
      // party, and category accents are identical in both themes by design.
      .filter(([name]) => ![
        'vendor', 'categoryAccent', 'iconAccent',
        'stableDark', 'stableEmergency', 'medal', 'brandTint',
      ].includes(name))
      .filter(([, group]) => {
        const values = typeof group === 'object' ? Object.values(group) : [group];
        return !values.some((v) => consumed.has(v));
      })
      .map(([name]) => name);

    expect(orphans).toEqual([]);
  });

  it('only contains usable colour values', () => {
    const valid = /^(#[0-9a-fA-F]{3,8}|transparent|rgba?\(.+\))$/;
    for (const theme of [lightTheme, darkTheme]) {
      for (const [key, value] of Object.entries(theme.colors)) {
        expect(`${theme.name}.${key}=${value}`).toMatch(
          new RegExp(`=${valid.source.slice(1, -1)}$`),
        );
      }
    }
  });
});

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
