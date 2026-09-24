const { contrastRatio, auditTheme } = require('../../../scripts/check-contrast');
const { lightTheme, darkTheme } = require('../themes');

describe('contrast', () => {
  it('computes known ratios correctly', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 1);
  });

  it('confirms white on brand orange is the documented failure', () => {
    expect(contrastRatio('#FFFFFF', '#f67c16')).toBeLessThan(3);
  });

  it('passes every required pair in the light theme', () => {
    expect(auditTheme(lightTheme)).toEqual([]);
  });

  it('passes every required pair in the dark theme', () => {
    expect(auditTheme(darkTheme)).toEqual([]);
  });
});
