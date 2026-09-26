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

/**
 * Genuine exceptions, each with a reason. Kept tiny on purpose: an allowlist is how
 * a gate stops meaning anything, so nothing goes in here that could be fixed instead.
 */
const EXEMPT = [
  // Apple's own system colours. white-on-systemBlue is 4.02 by Apple's spec and
  // systemRed is lower still; matching the platform matters more here than clearing
  // a bar Apple itself does not. Already recorded as an accepted exception.
  { ink: /onIosAccent|iosPlaceholder/, ground: /iosBlue|iosRed|overlay/ },
];
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
  // Capture the WHOLE right-hand side, not just `c.*`. A makeC key can point at a
  // theme token (`c.surface`), a palette group (`stableDark.heroSurface`,
  // `medal.gold`) or a literal. Only reading `c.*` left the rest unresolvable, so
  // those layers were skipped and their ink got graded against the page instead —
  // which reported a white title on a navy header as 1.10:1. False, and it would
  // have sent me "fixing" a dozen things that were correct.
  const alias = {};
  const m = /const makeC = \(c\) => \(\{([\s\S]*?)\n\}\);/.exec(src);
  if (m) for (const x of m[1].matchAll(/^\s*(\w+):\s*([^,\n]+),/gm)) alias[x[1]] = x[2].trim();
  // Legacy local palettes. Several files still say `const COLORS = {...}` or
  // `const BRAND = {...}` instead of makeC, and ~130 pairs were unreadable purely
  // because this did not look for them — leaving exactly the least-migrated files
  // as the checker's blind spot.
  for (const name of ['COLORS', 'BRAND']) {
    const lm = new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\};`).exec(src);
    if (!lm) continue;
    for (const x of lm[1].matchAll(/^\s*(\w+):\s*([^,\n]+),/gm)) alias[`${name}.${x[1]}`] = x[2].trim();
  }
  return alias;
};

const resolveExpr = (expr, alias, theme, depth = 0) => {
  if (!expr || depth > 4) return null;
  // a legacy palette reference resolves through the same alias map
  if (alias[expr]) return resolveExpr(alias[expr], alias, theme, depth + 1);
  let m = /^C\.(\w+)$/.exec(expr);
  if (m) {
    const rhs = alias[m[1]];
    if (!rhs) return null;
    const c = /^c\.(\w+)$/.exec(rhs);
    if (c) return theme.colors[c[1]] ?? null;
    // a palette group, a literal, or another expression — resolve it the same way
    return resolveExpr(rhs, alias, theme, depth + 1);
  }
  m = /^theme\.colors\.(\w+)$/.exec(expr);
  if (m) return theme.colors[m[1]] ?? null;
  m = /^(\w+)\.(\w+)$/.exec(expr);
  if (m && palette[m[1]] && typeof palette[m[1]] === 'object') return palette[m[1]][m[2]] ?? null;
  if (/^['"]/.test(expr)) return expr.slice(1, -1);
  return null;
};

// ── the walk ──────────────────────────────────────────────────────────────
const styleBlocks = (src) => {
  // Brace-counted, not line-matched. A style can be one line AND contain a nested
  // object — `acceptBtn: { ..., shadowOffset: { width: 0, height: 3 }, ... },` — and
  // a line-based reader silently dropped every one of those. That made the checker
  // walk past the BUTTON to the card behind it and report correct ink as broken.
  const out = {};
  const re = /^[ \t]{2,8}(\w+):\s*\{/gm;
  let m;
  while ((m = re.exec(src))) {
    let depth = 0;
    let k = m.index + m[0].length - 1; // at the opening brace
    const start = k + 1;
    for (; k < src.length; k += 1) {
      if (src[k] === '{') depth += 1;
      else if (src[k] === '}') { depth -= 1; if (depth === 0) break; }
    }
    out[m[1]] = src.slice(start, k);
    re.lastIndex = k;
  }
  return out;
};


const exprOf = (node, code) => code.slice(node.start, node.end);

/**
 * An absolutely-positioned filled sibling IS the background.
 *
 * SplashScreen paints its ground with `<View style={styles.bgBase} />`, where bgBase
 * is `{...StyleSheet.absoluteFillObject, backgroundColor: splash.dark}`. That is a
 * sibling, not an ancestor, so an ancestor-only walk saw no fill at all and graded
 * the footer against the page — reporting 2.02:1 on a screen that is actually fine.
 * Modelling the layer is the honest fix; exempting the screen would not be.
 */
const absoluteLayerFill = (el, code, blocks) => {
  for (const child of el.children || []) {
    if (child.type !== 'JSXElement') continue;
    const sp = child.openingElement.attributes.find((a) => a.name && a.name.name === 'style');
    if (!sp) continue;
    const txt = exprOf(sp.value, code);
    let body = '';
    for (const r of txt.matchAll(/(?:styles|s|detailStyles)\.(\w+)/g)) body += (blocks[r[1]] || '');
    body += txt;
    if (!/absoluteFill|position:\s*'absolute'/.test(body)) continue;
    const g = /backgroundColor:\s*([^,\n}]+)/.exec(body);
    if (g) return g[1].trim();
  }
  return null;
};

const fillFromStyleProp = (attr, code, blocks) => {
  // Last declared backgroundColor wins, mirroring how RN flattens a style array.
  if (!attr) return null;
  const txt = exprOf(attr.value, code);
  let found = null;
  for (const r of txt.matchAll(/(?:styles|s|detailStyles)\.(\w+)/g)) {
    // A conditional `cond && styles.xDisabled` is the LAST entry in the array, so
    // taking the last fill blindly grades every button in its disabled state — and
    // WCAG 1.4.3/1.4.11 exempt inactive controls anyway. Skip those layers so the
    // enabled fill, which is what the user normally sees, is the one graded.
    if (/disabled|inactive|readonly/i.test(r[1])) continue;
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
  const unparsed = [];
  const reasons = {};
  const why = (k) => { reasons[k] = (reasons[k]||0)+1; };
  let checked = 0, unresolved = 0;

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    let ast;
    try {
      ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'] });
    } catch { unparsed.push(path.relative(ROOT, file)); continue; }
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
          // The INK can belong to a disabled state even when the ground resolves to
          // the enabled fill (disabled fills are skipped above). WCAG exempts
          // inactive controls, and "fixing" one makes it look enabled — which is
          // exactly what this checker talked me into doing before I caught it.
          if (/\b(?:styles|s|detailStyles)\.\w*(?:Disabled|Inactive)\b/.test(txt)) return;
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
        let onGradient = false;
        let cur = p.parentPath;
        while (cur) {
          if (cur.isJSXElement()) {
            const op = cur.node.openingElement;
            // A LinearGradient paints a ground this checker cannot read (its colours
            // are a `colors={[...]}` prop, and which stop sits under the ink depends
            // on layout). Falling through to the page reported a back arrow on the
            // profile hero as 1.18:1 when it is deliberately the gradient's light
            // end. Mark it unresolvable instead of guessing.
            if (op.name.name === 'LinearGradient') {
              // Read the stops. If ink clears the WORST stop it clears the whole
              // gradient, so grading against that is rigorous rather than a guess.
              const cp = op.attributes.find((a) => a.name && a.name.name === 'colors');
              const stops = cp ? [...exprOf(cp.value, code).matchAll(/(?:'([^']+)'|([A-Za-z][\w.]*))/g)]
                .map((x) => x[1] || x[2]).filter((x) => x && x !== 'colors') : [];
              if (stops.length) { chain.push(...stops); if (!groundTag) groundTag = 'LinearGradient'; }
              else onGradient = true;
              break;
            }
            const sp = op.attributes.find((a) => a.name && a.name.name === 'style');
            const f = fillFromStyleProp(sp, code, blocks) || absoluteLayerFill(cur.node, code, blocks);
            if (f) {
              if (!groundTag) groundTag = op.name.name;
              chain.push(f);
            }
          }
          cur = cur.parentPath;
        }
        if (onGradient) { unresolved += 1; why('ground is a LinearGradient'); return; }
        // Nothing above it paints a fill, so what the user sees behind this ink IS
        // the page. Assuming that rather than skipping recovers 184 pairs — the
        // single largest blind spot — and it errs toward reporting in dark, where
        // the page is darker than a card.
        if (!chain.length) chain.push('theme.colors.bg');
        // An inline disabled fill — `[styles.btn, { backgroundColor: C.disabledFill }]`
        // — never gets a style NAME, so the name-based skip above cannot see it.
        // WCAG 1.4.3/1.4.11 exempt inactive controls either way.
        if (chain.some((c) => /disabled|inactive|readonly/i.test(c))) return;
        const groundExpr = chain[0];

        if (EXEMPT.some((e) => e.ink.test(inkExpr) && chain.some((c) => e.ground.test(c)))) return;
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
        if (!counted) { unresolved += 1; why(/^C\./.test(inkExpr) ? 'ink token not in makeC / not a colour' : 'ink is a prop, ternary or runtime value: '+inkExpr.slice(0,28)); }
      },
    });
  }
  return { failures, checked, unresolved, unparsed, reasons };
};

const { failures, checked, unresolved, unparsed, reasons } = run();
if (process.env.INK_WHY) {
  console.log('unresolvable, by cause:');
  Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,14).forEach(([k,v])=>console.log(String(v).padStart(6), k));
  process.exit(0);
}

// A file this cannot parse is a file it cannot check. Skipping quietly once hid two
// screens behind a duplicate-import error and made the light baseline read 94 when it
// was really 101 — a lower number that looked like progress.
if (unparsed.length) {
  console.error(`check:ink — ${unparsed.length} file(s) failed to parse and were NOT checked:`);
  unparsed.forEach((f) => console.error(`    ${f}`));
  process.exit(1);
}

// DARK must be zero. LIGHT carries a declining baseline: it is the app's pre-existing
// design language (brand orange on white is 2.69 and has been since v1.0.9), so it is
// reported and ratcheted rather than failed in one go — the owner has to see those
// changes, and 94 of them at once is not a review anyone can do.
const LIGHT_BASELINE = 103;
const dark = failures.filter((f) => f.theme === 'dark');
const light = failures.filter((f) => f.theme === 'light');

if (light.length > LIGHT_BASELINE) {
  console.error(
    `check:ink — light-mode failures rose from ${LIGHT_BASELINE} to ${light.length}.\n` +
    'The baseline only ever goes down. Fix the new one, or lower LIGHT_BASELINE if you\n' +
    'genuinely reduced it.',
  );
  process.exit(1);
}

if (dark.length) {
  console.error('check:ink — DARK ink painted on a ground it cannot be read against:\n');
  for (const f of dark) {
    console.error(`  ${f.rel}:${f.line}  <${f.tag}>`);
    console.error(`      ${f.ink}  on  ${f.ground}  = ${f.ratio} (needs ${f.min})`);
  }
  console.error(`\n${dark.length} dark failure(s). Dark mode is held at ZERO.`);
  process.exit(1);
}
console.log(
  `check:ink OK — dark 0, light ${light.length}/${LIGHT_BASELINE} baseline; ` +
  `${checked} pairs x 2 themes, ${unresolved} unresolvable and skipped.`,
);
process.exit(0);

// eslint-disable-next-line no-unreachable
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
