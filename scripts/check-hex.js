/**
 * Fails if any file marked migrated still contains a raw colour literal.
 *
 * Run: npm run check:hex
 *
 * This is what stops finished phases from regressing. Only
 * src/theme/tokens/palette.js may contain colour literals.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'migrated-files.json'), 'utf8'),
);

// Non-global on purpose: a /g regex carries lastIndex between .test() calls,
// which silently skips every other match when reused in a loop.
const HEX_LINE = /#[0-9a-fA-F]{3,8}\b/;
const RGB_LINE = /\brgba?\s*\(/;

/**
 * Blank out comments before scanning.
 *
 * Explanatory comments legitimately quote hex values and contrast ratios —
 * "white on #f67c16 is 2.69:1" is documentation, not a colour literal. Flagging
 * those made the gate fire on its own explanatory notes. Only real code counts.
 *
 * Replaces comment bodies with spaces rather than deleting them, so reported
 * line numbers still line up with the file.
 */
const stripComments = (src) => {
  let out = '';
  let i = 0;
  let inBlock = false;
  let inLine = false;
  let inStr = null;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (inBlock) {
      if (ch === '*' && next === '/') { inBlock = false; out += '  '; i += 2; continue; }
      out += ch === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }
    if (inLine) {
      if (ch === '\n') { inLine = false; out += '\n'; i += 1; continue; }
      out += ' ';
      i += 1;
      continue;
    }
    if (inStr) {
      if (ch === '\\') { out += '  '; i += 2; continue; }
      if (ch === inStr) inStr = null;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') { inBlock = true; out += '  '; i += 2; continue; }
    if (ch === '/' && next === '/') { inLine = true; out += '  '; i += 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; out += ch; i += 1; continue; }
    out += ch;
    i += 1;
  }
  return out;
};

let failed = false;

for (const rel of config.migrated) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`check:hex — listed file does not exist: ${rel}`);
    failed = true;
    continue;
  }

  const lines = stripComments(fs.readFileSync(abs, 'utf8')).split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (HEX_LINE.test(line) || RGB_LINE.test(line)) {
      hits.push(`    ${i + 1}: ${line.trim()}`);
    }
  });

  if (hits.length) {
    console.error(`check:hex — raw colour literal(s) in ${rel}:`);
    hits.forEach((h) => console.error(h));
    failed = true;
  }
}

if (failed) {
  console.error(
    '\nMove the colour into src/theme/tokens/palette.js and reference it via a semantic token.',
  );
  process.exit(1);
}

console.log(
  `check:hex OK — ${config.migrated.length} migrated file(s) contain no raw colour literals.`,
);
