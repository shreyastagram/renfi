/**
 * A `const`/`let` must not be READ during render above its own declaration.
 *
 * WHY THIS EXISTS
 *
 * `const` bindings are hoisted but left uninitialised — the temporal dead zone.
 * Reading one above its declaration throws at RUNTIME:
 *
 *   const InsuranceScreen = () => {
 *     const STATUS_MAP = makeStatusMap(C);   // throws
 *     const C = makeC(useThemeColors());
 *
 *   ReferenceError: Cannot access 'C' before initialization
 *
 * That shipped, and the Insurance screen could never open — it threw the
 * instant it mounted, every time, and the error boundary turned it into a
 * generic "Something went wrong. The app encountered an unexpected error."
 *
 * Nothing caught it. The file parses. eslint's own no-use-before-define is not
 * enabled, and enabling it is not the answer: it reports every
 * `onPress={() => handleThing()}` whose handler is declared lower down, which
 * is both the dominant React idiom and perfectly safe, because the closure runs
 * long after initialisation. Turning it on produced 10 reports in this one file
 * of which exactly one was real.
 *
 * So this checks only the dangerous shape: a read that happens SYNCHRONOUSLY in
 * the same statement list, not one deferred inside a nested function. No flow
 * analysis, no heuristics, and therefore no false positives.
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverseModule = require('@babel/traverse');

const traverse = traverseModule.default || traverseModule;
const ROOT = path.resolve(__dirname, '..');

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return ['node_modules', '__tests__'].includes(e.name) ? [] : walk(f);
    return /\.jsx?$/.test(f) ? [f] : [];
  });

const offenders = [];
const unparsed = [];
let scanned = 0;

for (const file of [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'navigation'))]) {
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
    });
  } catch (e) {
    unparsed.push(`${path.relative(ROOT, file)} — ${e.message.split('\n')[0]}`);
    continue;
  }
  scanned += 1;

  // For every block of statements, note where each const/let is declared, then
  // look for reads that sit in an EARLIER statement of that same block.
  traverse(ast, {
    'BlockStatement|Program': (blockPath) => {
      const body = blockPath.get('body');
      const declaredAt = new Map(); // name -> statement index

      body.forEach((stmt, i) => {
        if (!stmt.isVariableDeclaration() || stmt.node.kind === 'var') return;
        stmt.node.declarations.forEach((d) => {
          if (d.id.type === 'Identifier') declaredAt.set(d.id.name, i);
        });
      });
      if (!declaredAt.size) return;

      body.forEach((stmt, i) => {
        stmt.traverse({
          // A read inside a nested function is deferred — it runs after the
          // whole block has initialised. Only same-tick reads can throw.
          Function: (p) => p.skip(),
          Identifier: (p) => {
            if (!p.isReferencedIdentifier()) return;
            const name = p.node.name;
            const at = declaredAt.get(name);
            if (at === undefined || at <= i) return;
            // The declarator's own id is not a read of itself.
            if (p.scope.getBinding(name)?.scope !== blockPath.scope) return;
            offenders.push({
              rel: path.relative(ROOT, file),
              line: p.node.loc.start.line,
              name,
              declLine: body[at].node.loc.start.line,
            });
          },
        });
      });
    },
  });
}

if (unparsed.length) {
  console.error(`check:tdz — ${unparsed.length} file(s) failed to parse and were NOT checked:`);
  unparsed.forEach((f) => console.error(`    ${f}`));
  process.exit(1);
}

if (offenders.length) {
  console.error('check:tdz — value read during render, above its own declaration:\n');
  for (const o of offenders) {
    console.error(`  ${o.rel}:${o.line}`);
    console.error(`      reads '${o.name}', which is declared below on line ${o.declLine}`);
    console.error(`      -> ReferenceError: Cannot access '${o.name}' before initialization`);
  }
  console.error(`\n${offenders.length} temporal dead zone read(s). Each one throws on every render.`);
  process.exit(1);
}
console.log(`check:tdz OK — ${scanned} file(s); no value read above its own declaration.`);
