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
        'stableDark', 'stableEmergency', 'medal', 'brandTint', 'mapRoute',
    'mapOverlay',
    'premium',
    'heroGradient',
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

  // UserHomeScreen and ServiceRequestDetailScreen tint the brand colours by string
  // concatenation -- `C.secondary + '10'` -- which only produces a valid colour if
  // the base is a 6-digit hex. Pointing either token at an rgba() value would make
  // those tints silently invalid rather than throw, so the shape is asserted here.
  it('keeps alpha-concatenated brand tokens as 6-digit hex in both themes', () => {
    for (const theme of [lightTheme, darkTheme]) {
      for (const key of ['brandOrange', 'brandBlue']) {
        expect(theme.colors[key]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  // Regression guard. On dark surfaces the *Fill tokens cannot be low-alpha washes,
  // so they were pointed at the matching *Container value — which made a tinted chip
  // identical to the tinted card it sits on (the warning bar's icon wrap). A fill and
  // its container must always be a visible step apart.
  it('keeps every semantic fill distinct from its container', () => {
    const hues = ['success', 'warning', 'danger', 'info', 'accentViolet'];
    for (const theme of [lightTheme, darkTheme]) {
      for (const hue of hues) {
        const container = theme.colors[`${hue}Container`];
        const fill = theme.colors[`${hue}Fill`];
        expect(container).toBeDefined();
        expect(fill).toBeDefined();
        expect(fill).not.toBe(container);
      }
    }
  });

  // Regression guard for a real bug. The four *Border tokens were 'transparent'
  // in light mode on the theory that a light chip reads fine on its fill alone.
  // But every consumer — Alert's four variants, the tracking screen's address
  // bar, the event screen's venue buttons — sets `borderWidth: 1` without
  // branching on theme, so the token being transparent silently erased a
  // hairline that existed at v1.0.9. A border token must always draw something.
  it('never resolves a border or line token to transparent', () => {
    for (const theme of [lightTheme, darkTheme]) {
      const hairlines = Object.keys(theme.colors).filter((k) =>
        /(Border|Line)$/.test(k),
      );
      expect(hairlines.length).toBeGreaterThan(0);
      for (const key of hairlines) {
        expect(theme.colors[key]).not.toBe('transparent');
        // A zero-alpha rgba is transparent by another spelling.
        expect(String(theme.colors[key])).not.toMatch(/,\s*0\s*\)$/);
      }
    }
  });
});
