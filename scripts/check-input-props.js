/**
 * Every <TextInput> must set the colours the PLATFORM would otherwise pick.
 *
 * WHY THIS EXISTS
 *
 * Two TextInput props fall back to a platform default rather than to anything
 * the theme controls:
 *
 *   placeholderTextColor  - a platform grey. On a dark surface it is close to
 *                           unreadable, and it does not move with the theme.
 *   selectionColor        - the caret and the selection highlight. On Android
 *                           this comes from the theme's colorAccent, which the
 *                           app sets to brand orange. On iOS there is no such
 *                           hook: it is the system blue, #007AFF.
 *
 * So an input with no selectionColor has an ORANGE caret on Android and a BLUE
 * one on iOS, in the same build, on the same screen. 40 of the app's 42 inputs
 * were in that state. Nothing else can see it: the caret is drawn by the OS, so
 * check:ink has no element to grade and check:hex has no literal to find.
 *
 * placeholderTextColor was already at 100% when this gate was written. It is
 * asserted anyway — the expensive failure is the one that regresses quietly
 * after someone adds the twenty-first input.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(f);
    return /\.jsx?$/.test(f) ? [f] : [];
  });

// Read one JSX element's source, brace-aware so nested {...} props don't end it.
const elementAt = (src, start) => {
  let depth = 0;
  for (let j = start; j < src.length; j += 1) {
    const ch = src[j];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return src.slice(start, j + 1);
  }
  return src.slice(start);
};

const missing = { selectionColor: [], placeholderTextColor: [] };
let total = 0;

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/<TextInput\b/g)) {
    const el = elementAt(src, m.index);
    const line = src.slice(0, m.index).split('\n').length;
    const rel = `${path.relative(ROOT, file)}:${line}`;
    total += 1;
    if (!el.includes('selectionColor')) missing.selectionColor.push(rel);
    // Only inputs that actually show a placeholder need its colour.
    if (el.includes('placeholder=') && !el.includes('placeholderTextColor')) {
      missing.placeholderTextColor.push(rel);
    }
  }
}

const fail = Object.entries(missing).filter(([, v]) => v.length);
if (fail.length) {
  console.error('check:input — <TextInput> relying on a platform colour default:\n');
  for (const [prop, sites] of fail) {
    console.error(`  ${prop} missing on ${sites.length}:`);
    sites.forEach((s) => console.error(`      ${s}`));
    if (prop === 'selectionColor') {
      console.error('      -> orange caret on Android, system blue on iOS, same build.');
    } else {
      console.error('      -> a platform grey that does not follow the theme.');
    }
  }
  process.exit(1);
}
console.log(`check:input OK — ${total} <TextInput>; selection and placeholder colours all explicit.`);
