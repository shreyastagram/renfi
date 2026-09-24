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

let failed = false;

for (const rel of config.migrated) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`check:hex — listed file does not exist: ${rel}`);
    failed = true;
    continue;
  }

  const lines = fs.readFileSync(abs, 'utf8').split('\n');
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
