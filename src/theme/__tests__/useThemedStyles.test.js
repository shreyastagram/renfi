const { createStyleCache } = require('../createStyleCache');
const { lightTheme, darkTheme } = require('../themes');

describe('createStyleCache', () => {
  it('computes styles once per theme and reuses them', () => {
    const makeStyles = jest.fn((theme) => ({
      box: { backgroundColor: theme.colors.surface },
    }));
    const cached = createStyleCache(makeStyles);

    const a = cached(lightTheme);
    const b = cached(lightTheme);

    expect(makeStyles).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('computes separately for each theme but caches both', () => {
    const makeStyles = jest.fn((theme) => ({
      box: { backgroundColor: theme.colors.surface },
    }));
    const cached = createStyleCache(makeStyles);

    const light1 = cached(lightTheme);
    const dark1 = cached(darkTheme);
    const light2 = cached(lightTheme);
    const dark2 = cached(darkTheme);

    expect(makeStyles).toHaveBeenCalledTimes(2);
    expect(light1).toBe(light2);
    expect(dark1).toBe(dark2);
    expect(light1).not.toBe(dark1);
  });

  it('produces theme-appropriate values', () => {
    const cached = createStyleCache((theme) => ({
      box: { backgroundColor: theme.colors.surface },
    }));
    expect(cached(lightTheme).box.backgroundColor)
      .toBe(lightTheme.colors.surface);
    expect(cached(darkTheme).box.backgroundColor)
      .toBe(darkTheme.colors.surface);
  });
});
