/**
 * The wordmark is Fixhomi — "Fix" blue, "homi" orange, one capital.
 *
 * Ten screens and four components were each hand-rolling
 * `<Text style={styles.brandName}>FixHomi</Text>`: camel-case, one colour,
 * positive tracking. That is a different word in a different voice, and it
 * drifted because nothing owned it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(f);
    return /\.jsx?$/.test(f) ? [f] : [];
  });

describe('the Fixhomi wordmark', () => {
  it('is never hand-rolled as a plain Text', () => {
    const offenders = walk(ROOT)
      .filter((f) => !f.endsWith('FixhomiWordmark.jsx'))
      .filter((f) => />FixHomi</.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('spells the brand with one capital and splits the colour', () => {
    const src = fs.readFileSync(path.join(ROOT, 'components', 'FixhomiWordmark.jsx'), 'utf8');
    expect(src).toMatch(/>Fix</);
    expect(src).toMatch(/>homi</);
    expect(src).toMatch(/fix: \{ color: c\.brandBlue \}/);
    expect(src).toMatch(/homi: \{ color: c\.brandOrange \}/);
  });

  it('is tracked in, not out', () => {
    // +0.3 pulls a heavy word apart; the reference mark is set tight.
    const src = fs.readFileSync(path.join(ROOT, 'components', 'FixhomiWordmark.jsx'), 'utf8');
    const m = /letterSpacing: (-?[\d.]+)/.exec(src);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBeLessThan(0);
  });

  it('ships no custom font', () => {
    // The owner's rule is that everything must work identically on iOS and
    // Android and not break on older devices. The app meets that by using the
    // system face; a bundled font would be the thing that breaks it.
    const withFont = walk(ROOT)
      .filter((f) => /fontFamily:\s*['"](?!monospace)/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));
    expect(withFont).toEqual([]);
  });
});
