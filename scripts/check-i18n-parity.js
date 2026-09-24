/**
 * Verifies en/hi/mr are key-identical with identical %{var} placeholders.
 *
 * Run: npm run check:i18n
 *
 * Repo rule: the three locales must never drift. Baseline is 1959 keys each.
 */

// Plain require() loads these ES modules directly — Node >= 22.12 supports
// require(esm). Verified working against src/i18n/*.js as written.

const LOCALES = ['en', 'hi', 'mr'];

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? flatten(v, `${prefix}${k}.`)
      : [[`${prefix}${k}`, String(v)]],
  );

const placeholders = (s) => (s.match(/%\{[^}]+\}/g) || []).sort().join(',');

const loaded = {};
for (const loc of LOCALES) {
  const mod = require(`../src/i18n/${loc}.js`);
  loaded[loc] = new Map(flatten(mod.default || mod));
}

let failed = false;
const base = loaded.en;

console.log(LOCALES.map((l) => `${l}=${loaded[l].size}`).join('  '));

for (const loc of LOCALES.slice(1)) {
  const other = loaded[loc];

  for (const key of base.keys()) {
    if (!other.has(key)) {
      console.error(`check:i18n — ${loc} is MISSING key: ${key}`);
      failed = true;
    }
  }
  for (const key of other.keys()) {
    if (!base.has(key)) {
      console.error(`check:i18n — ${loc} has EXTRA key not in en: ${key}`);
      failed = true;
    }
  }
  for (const [key, value] of base.entries()) {
    if (!other.has(key)) continue;
    const a = placeholders(value);
    const b = placeholders(other.get(key));
    if (a !== b) {
      console.error(
        `check:i18n — placeholder mismatch at ${key}: en has [${a}], ${loc} has [${b}]`,
      );
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(
  `check:i18n OK — ${base.size} keys, identical across ${LOCALES.join('/')}.`,
);
