"""Shared mechanics for migrating a screen onto theme tokens.

Written after doing this by hand nine times. Every step here encodes a mistake I
actually made and had to back out:

  - insert_theme_import  : anchors on a COMPLETE import statement. Inserting by line
                           index split a multi-line import twice.
  - to_factory           : converts `const x = StyleSheet.create({` and closes with
                           `});` — not `}));`, which broke a React.memo file.
  - wire                 : finds the line where the BODY opens (`=> {`), not the
                           declaration line, which for a multi-line destructured
                           parameter list ends in `({` and put hooks inside the params.
  - to_block_body        : converts a concise arrow, and closes `React.memo(...)` with
                           `});` while a plain arrow closes with `};`.
  - drop_unused          : removes hooks a component turned out not to need, which
                           otherwise show up as new no-unused-vars diagnostics.

Nothing here decides a colour. The caller supplies the token mapping; this only moves
code around, and every step asserts its anchor so a wrong guess fails loudly instead
of corrupting the file.
"""
import re


def read(path):
    return open(path).read()


def write(path, src):
    open(path, 'w').write(src)


def replace_block(src, opener, replacement, closer='};'):
    """Replace a top-level `const NAME = {` block, including its closer."""
    assert src.count(opener) == 1, f'{opener!r} appears {src.count(opener)}x'
    i = src.index(opener)
    e = src.index('\n' + closer, i)
    return src[:i] + replacement + src[e + 1 + len(closer):]


def insert_theme_import(src, names, rel='../theme', search_lines=90):
    """Insert an import anchored on a COMPLETE statement, never a line index."""
    lines = src.split('\n')
    candidates = [
        k for k, l in enumerate(lines[:search_lines])
        if (l.startswith('import ') and l.rstrip().endswith(';'))
        or l.startswith("} from '")
    ]
    assert candidates, 'no complete import statement found'
    j = max(candidates)
    imp = ['import {'] + [f'  {n},' for n in names] + [f"}} from '{rel}';"]
    lines[j + 1:j + 1] = imp
    return '\n'.join(lines)


def to_factory(src, sheet_name, factory_name, extra_decls=()):
    """`const sheet = StyleSheet.create({...});` -> a (theme) => factory."""
    head = f'const {sheet_name} = StyleSheet.create({{'
    assert src.count(head) == 1, f'{sheet_name}: {src.count(head)} matches'
    i = src.index(head)
    e = src.index('\n});', i)
    decls = '\n'.join(['  const C = makeC(theme.colors);'] + list(extra_decls))
    return (
        src[:i]
        + f'const {factory_name} = (theme) => {{\n{decls}\n  return StyleSheet.create({{'
        + src[i + len(head):e]
        + '\n  });\n};'
        + src[e + 4:]
    )


def wire(src, decl_prefix, hooks):
    """Insert hooks after the line where the component BODY opens."""
    lines = src.split('\n')
    i = next((k for k, l in enumerate(lines) if l.startswith(decl_prefix)), None)
    assert i is not None, f'not found: {decl_prefix!r}'
    j = i
    limit = i + 60
    while not lines[j].rstrip().endswith('=> {'):
        j += 1
        assert j < limit, f'body opener not found for {decl_prefix!r}'
    lines[j + 1:j + 1] = [f'  {h}' for h in hooks]
    return '\n'.join(lines)


def to_block_body(src, name, hooks):
    """Concise arrow (`=> (`) -> block body, so it can hold hooks."""
    lines = src.split('\n')
    i = next((k for k, l in enumerate(lines) if l.startswith(f'const {name} = ')), None)
    assert i is not None, f'not found: {name}'
    j = i
    while not lines[j].rstrip().endswith('=> ('):
        j += 1
        assert j < i + 40, f'{name}: no concise body opener'
    k = j + 1
    while lines[k] not in (');', '));'):
        k += 1
        assert k < j + 400, f'{name}: no concise body closer'
    # `));` closes React.memo(arrow) -> `});`; `);` closes a plain arrow -> `};`
    closer = '});' if lines[k] == '));' else '};'
    body = ['  ' + x if x else x for x in lines[j + 1:k]]
    lines[i:k + 1] = (
        lines[i:j] + [lines[j][:-1] + '{'] + [f'  {h}' for h in hooks]
        + ['  return ('] + body + ['  );', closer]
    )
    return '\n'.join(lines)


def drop_unused(path, hook_lines=None):
    """Remove inserted hooks whose variable is never used in their component."""
    hook_lines = hook_lines or {
        '  const C = makeC(useThemeColors());': r'\bC\.',
        '  const { isDark } = useTheme();': r'\bisDark\b',
    }
    lines = read(path).split('\n')
    dropped = []
    for i, l in enumerate(lines):
        if l not in hook_lines:
            continue
        pat = hook_lines[l]
        start = max(k for k in range(i) if re.match(r'^(export )?const [A-Z]', lines[k]))
        end = next(
            (k for k in range(i + 1, len(lines))
             if re.match(r'^(export )?const [A-Z]', lines[k])),
            len(lines),
        )
        body = '\n'.join(lines[start:end])
        hits = len(re.findall(pat, body)) - (1 if pat == r'\bisDark\b' else 0)
        if hits <= 0:
            dropped.append((i, lines[start].split(' = ')[0]))
    for i, _ in sorted(dropped, reverse=True):
        del lines[i]
    write(path, '\n'.join(lines))
    return dropped


def apply_rules(src, rules, require_all=True):
    """Longest-pattern-first, so a wrapping pattern is consumed before its substring."""
    missing = []
    for old in sorted(rules, key=len, reverse=True):
        if src.count(old) == 0:
            missing.append(old)
            continue
        src = src.replace(old, rules[old])
    if require_all:
        assert not missing, 'patterns not found: ' + repr(missing[:6])
    return src, missing


def leftovers(path, skip_comments=True):
    """Colour literals still present, excluding comments."""
    out = []
    for i, l in enumerate(read(path).split('\n'), 1):
        if skip_comments and l.strip().startswith(('*', '//')):
            continue
        if re.search(r'#[0-9a-fA-F]{3,8}\b|rgba?\([0-9]', l):
            out.append((i, l.strip()[:100]))
    return out
