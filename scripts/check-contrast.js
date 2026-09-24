/**
 * WCAG AA contrast validator for the theme tokens.
 *
 * Run: npm run check:contrast
 *
 * Every foreground/background pair the UI actually renders must clear its
 * threshold: 4.5 for normal text, 3.0 for large text and UI component
 * boundaries. Values in src/theme/tokens/palette.js were chosen to satisfy
 * this list — if you change one, this script is what proves it still holds.
 */

const TEXT = 4.5;
const UI = 3.0;

const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminance = (hex) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrastRatio = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
};

// [foregroundToken, backgroundToken, threshold, label]
const REQUIRED_PAIRS = [
  ['textPrimary', 'bg', TEXT, 'body text on page background'],
  ['textPrimary', 'surface', TEXT, 'body text on card'],
  ['textPrimary', 'surfaceElevated', TEXT, 'body text on elevated card'],
  ['textPrimaryNeutral', 'bg', TEXT, 'gray-ramp primary text on page background'],
  ['textPrimaryNeutral', 'surface', TEXT, 'gray-ramp primary text on card'],
  ['textStrong', 'bg', TEXT, 'strong text on page background'],
  ['textStrong', 'surface', TEXT, 'strong text on card'],
  ['textStrongNeutral', 'bg', TEXT, 'gray-ramp strong text on page background'],
  ['textStrongNeutral', 'surface', TEXT, 'gray-ramp strong text on card'],
  ['textBody', 'bg', TEXT, 'body text on page background'],
  ['textBody', 'surface', TEXT, 'body text on card'],
  ['textBodyNeutral', 'bg', TEXT, 'gray-ramp body text on page background'],
  ['textBodyNeutral', 'surface', TEXT, 'gray-ramp body text on card'],
  ['textSecondary', 'bg', TEXT, 'secondary text on page background'],
  ['textSecondary', 'surface', TEXT, 'secondary text on card'],
  ['textSecondary', 'surfaceElevated', TEXT, 'secondary text on elevated card'],
  ['textMuted', 'bg', TEXT, 'muted text on page background'],
  ['textMuted', 'surface', TEXT, 'muted text on card'],
  ['textMuted', 'surfaceElevated', TEXT, 'muted text on elevated card'],
  ['onBrandOrange', 'brandOrange', TEXT, 'label on an orange fill'],
  ['onBrandBlue', 'brandBlue', TEXT, 'label on a blue fill'],
  ['info', 'bg', TEXT, 'link/info text on page background'],
  ['info', 'surface', TEXT, 'link/info text on card'],
  ['success', 'surface', TEXT, 'success text on card'],
  ['warning', 'surface', TEXT, 'warning text on card'],
  ['danger', 'surface', TEXT, 'danger text on card'],
  ['success', 'successContainer', TEXT, 'success text on its tinted chip'],
  ['warning', 'warningContainer', TEXT, 'warning text on its tinted chip'],
  ['danger', 'dangerContainer', TEXT, 'danger text on its tinted chip'],
  ['info', 'infoContainer', TEXT, 'info text on its tinted chip'],
  ['accentViolet', 'surface', TEXT, 'violet category accent on card'],
  ['accentViolet', 'bg', TEXT, 'violet category accent on page background'],
  ['accentViolet', 'accentVioletContainer', TEXT, 'violet accent on its tinted chip'],
  ['borderStrong', 'surface', UI, 'input border against card'],
  ['borderStrong', 'bg', UI, 'input border against page background'],
];

/** Returns an array of failure objects; empty means the theme passes. */
const auditTheme = (theme) => {
  const failures = [];
  for (const [fg, bg, threshold, label] of REQUIRED_PAIRS) {
    const fgHex = theme.colors[fg];
    const bgHex = theme.colors[bg];
    if (!fgHex || !bgHex) {
      failures.push({ theme: theme.name, fg, bg, label, reason: 'missing token' });
      continue;
    }
    const ratio = contrastRatio(fgHex, bgHex);
    if (ratio < threshold) {
      failures.push({
        theme: theme.name,
        fg,
        bg,
        label,
        ratio: Number(ratio.toFixed(2)),
        required: threshold,
      });
    }
  }
  return failures;
};

module.exports = { contrastRatio, auditTheme, REQUIRED_PAIRS, TEXT, UI };

if (require.main === module) {
  // Plain require() loads these ES modules directly — Node >= 22.12 supports
  // require(esm). This is why every import inside src/theme/tokens/ and
  // src/theme/themes.js carries an explicit .js extension: Node's ESM resolver
  // rejects extensionless specifiers, while Metro accepts both.
  const { lightTheme, darkTheme } = require('../src/theme/themes.js');
  const failures = [...auditTheme(lightTheme), ...auditTheme(darkTheme)];
  if (failures.length) {
    console.error('Contrast FAILURES:\n');
    for (const f of failures) {
      console.error(
        `  [${f.theme}] ${f.label}: ${f.fg} on ${f.bg} = ` +
          `${f.ratio ?? '?'} (needs ${f.required ?? '-'}) ${f.reason || ''}`,
      );
    }
    process.exit(1);
  }
  console.log(
    `Contrast OK — ${REQUIRED_PAIRS.length} pairs x 2 themes all meet WCAG AA.`,
  );
}
