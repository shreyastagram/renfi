/**
 * Every ink graded against the ground it is ACTUALLY painted on.
 *
 * WHY THIS EXISTS, AND WHY IT IS A PARSER
 *
 * `check:contrast` grades the 41+ token pairs it is told about. It cannot see a
 * correct token used in the wrong place, and that is where every real dark-mode bug
 * in this project came from: white ink mapped onto `onBrandOrange` and painted on a
 * photo lightbox (1.18:1), a brand panel mapped onto `textPrimary` so it inverted
 * (1.00:1), a switch thumb equal to its own track (1.00:1).
 *
 * I first tried to find these with regex walkers. They mis-attributed the ground
 * three separate times — reading a footer instead of the button inside it, missing
 * props spread over several lines, and picking the wrong member of a style array.
 * Each time the wrong answer was confident and plausible. So this parses the JSX and
 * walks the real element tree instead.
 *
 * WHAT IT CHECKS
 *
 * For every <Text>, icon and <ActivityIndicator>: resolve its colour, walk up the JSX
 * ancestors to the nearest element that declares a backgroundColor, resolve that too,
 * and grade the pair in BOTH themes. A text pair must clear 4.5; an icon or spinner
 * is a UI component and must clear 3.
 *
 * WHAT IT DELIBERATELY SKIPS
 *
 * Anything it cannot resolve with certainty — a colour from a prop, a ternary on
 * runtime state, a ground that never appears. Those are reported as `unresolved` and
 * NOT failed, because a gate that guesses is worse than no gate: it trains people to
 * add allowlist entries. The count is printed so the blind spot stays visible.
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverseMod = require('@babel/traverse');

const traverse = traverseMod.default || traverseMod;
const ROOT = path.resolve(__dirname, '..');
const { lightTheme, darkTheme } = require('../src/theme/themes.js');
const palette = require('../src/theme/tokens/palette.js');

const TEXT_MIN = 4.5;
const UI_MIN = 3.0;

const ICONS = new Set(['MaterialIcon', 'MaterialCommunityIcon', 'Icon', 'Ionicons', 'Feather', 'ActivityIndicator']);
const TEXTS = new Set(['Text']);

// ── colour maths ──────────────────────────────────────────────────────────
const parseColor = (v) => {
  if (typeof v !== 'string') return null;
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = /^#([0-9a-f]{3})$/i.exec(v);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1);
  m = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
};
const over = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = (c) => {
  const s = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ── resolving a source expression to a colour, per theme ──────────────────
const build = (src) => {
  const alias = {};
  const m = /const makeC = \(c\) => \(\{([\s\S]*?)\n\}\);/.exec(src);
  if (m) for (const x of m[1].matchAll(/(\w+):\s*c\.(\w+)/g)) alias[x[1]] = x[2];
  return alias;
};

const resolveExpr = (expr, alias, theme) => {
  if (!expr) return null;
  let m = /^C\.(\w+)$/.exec(expr);
  if (m) { const t = alias[m[1]]; return t ? theme.colors[t] ?? null : null; }
  m = /^theme\.colors\.(\w+)$/.exec(expr);
  if (m) return theme.colors[m[1]] ?? null;
  m = /^(\w+)\.(\w+)$/.exec(expr);
  if (m && palette[m[1]] && typeof palette[m[1]] === 'object') return palette[m[1]][m[2]] ?? null;
  if (/^['"]/.test(expr)) return expr.slice(1, -1);
  return null;
};

// ── the walk ──────────────────────────────────────────────────────────────
const styleBlocks = (src) => {
  // name -> body text, for both multi-line and single-line style entries
  const out = {};
  let st = null, buf = [];
  for (const l of src.split('\n')) {
    const open = /^\s{2,8}(\w+): \{\s*$/.exec(l);
    const one = /^\s{2,8}(\w+): \{(.*)\},?\s*$/.exec(l);
    if (open) { if (st) out[st] = buf.join('\n'); st = open[1]; buf = []; }
    else if (one && st === null) out[one[1]] = one[2];
    else if (st !== null) {
      if (/^\s{2,8}\},?\s*$/.test(l)) { out[st] = buf.join('\n'); st = null; buf = []; }
      else buf.push(l);
    }
  }
  if (st) out[st] = buf.join('\n');
  return out;
};

const exprOf = (node, code) => code.slice(node.start, node.end);

const fillFromStyleProp = (attr, code, blocks) => {
  // Last declared backgroundColor wins, mirroring how RN flattens a style array.
  if (!attr) return null;
  const txt = exprOf(attr.value, code);
  let found = null;
  for (const r of txt.matchAll(/(?:styles|s|detailStyles)\.(\w+)/g)) {
    const b = blocks[r[1]];
    if (!b) continue;
    const g = /backgroundColor:\s*([^,\n}]+)/.exec(b);
    if (g) found = g[1].trim();
  }
  for (const r of txt.matchAll(/backgroundColor:\s*([^,\n}]+)/g)) found = r[1].trim();
  return found;
};

const run = () => {
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(f); }
      else if (f.endsWith('.jsx')) files.push(f);
    }
  })(path.join(ROOT, 'src'));

  const failures = [];
  let checked = 0, unresolved = 0;

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    let ast;
    try {
      ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'] });
    } catch { continue; }
    const alias = build(code);
    const blocks = styleBlocks(code);
    const rel = path.relative(ROOT, file);

    traverse(ast, {
      JSXOpeningElement(p) {
        const nameNode = p.node.name;
        const tag = nameNode.type === 'JSXIdentifier' ? nameNode.name : null;
        if (!tag || (!ICONS.has(tag) && !TEXTS.has(tag))) return;

        // the ink
        let inkExpr = null;
        if (TEXTS.has(tag)) {
          const sp = p.node.attributes.find((a) => a.name && a.name.name === 'style');
          if (!sp) return;
          const txt = exprOf(sp.value, code);
          for (const r of txt.matchAll(/(?:styles|s|detailStyles)\.(\w+)/g)) {
            const b = blocks[r[1]];
            if (!b) continue;
            const g = /(?:^|[\s{,])color:\s*([^,\n}]+)/.exec(b);
            if (g) inkExpr = g[1].trim();
          }
          const inline = /(?:^|[\s{,])color:\s*([^,\n}]+)/.exec(txt);
          if (inline) inkExpr = inline[1].trim();
        } else {
          const cp = p.node.attributes.find((a) => a.name && a.name.name === 'color');
          if (!cp) return;
          inkExpr = exprOf(cp.value, code).replace(/^\{|\}$/g, '').trim();
        }
        if (!inkExpr) return;

        // The ground is a STACK, not a single fill. A translucent fill shows what
        // is under it, so grading ink against `rgba(239,68,68,0.08)` alone says a
        // red icon on a pale red chip is 1.72:1 when it is really ~6.5 once the
        // chip is composited over the white card. Collect every ancestor fill and
        // flatten them bottom-up.
        const chain = [];
        let groundTag = null;
        let cur = p.parentPath;
        while (cur) {
          if (cur.isJSXElement()) {
            const op = cur.node.openingElement;
            const sp = op.attributes.find((a) => a.name && a.name.name === 'style');
            const f = fillFromStyleProp(sp, code, blocks);
            if (f) {
              if (!groundTag) groundTag = op.name.name;
              chain.push(f);
            }
          }
          cur = cur.parentPath;
        }
        if (!chain.length) { unresolved += 1; return; }
        const groundExpr = chain[0];

        const min = TEXTS.has(tag) ? TEXT_MIN : UI_MIN;
        let counted = false;
        for (const [tn, theme] of [['light', lightTheme], ['dark', darkTheme]]) {
          const i = parseColor(resolveExpr(inkExpr, alias, theme));
          // Flatten outermost -> innermost, starting from the page.
          let g = parseColor(theme.colors.bg);
          let anyResolved = false;
          for (let k = chain.length - 1; k >= 0; k -= 1) {
            const layer = parseColor(resolveExpr(chain[k], alias, theme));
            if (!layer) continue;
            anyResolved = true;
            g = layer[3] < 1 ? over(layer, g) : layer;
          }
          if (!i || !anyResolved) continue;
          if (!counted) { checked += 1; counted = true; }
          const composed = i[3] < 1 ? over(i, g) : i;
          const r = ratio(composed, g);
          if (r < min) {
            failures.push({ rel, line: p.node.loc.start.line, tag, ink: inkExpr, ground: `${groundTag}:${groundExpr}`, theme: tn, ratio: r.toFixed(2), min });
          }
        }
        if (!counted) unresolved += 1;
      },
    });
  }
  return { failures, checked, unresolved };
};

const { failures, checked, unresolved } = run();

if (failures.length) {
  console.error('check:ink — ink painted on a ground it cannot be read against:\n');
  for (const f of failures) {
    console.error(`  [${f.theme}] ${f.rel}:${f.line}  <${f.tag}>`);
    console.error(`      ${f.ink}  on  ${f.ground}  = ${f.ratio} (needs ${f.min})`);
  }
  console.error(`\n${failures.length} failure(s). ${checked} pairs resolved, ${unresolved} could not be resolved and were skipped.`);
  process.exit(1);
}
console.log(`check:ink OK — ${checked} ink/ground pairs x 2 themes; ${unresolved} unresolvable and skipped.`);
