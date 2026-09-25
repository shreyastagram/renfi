"""Compare eslint output before/after a theme migration.

eslint pretty-prints an inline-style object across MULTIPLE LINES when it contains a
literal, and on one line when it contains an identifier. A naive line-based reader
therefore reports the same warning as both "removed" (multi-line) and "added"
(single-line). Reassemble each record first, then normalise.
"""
import re, sys
from collections import Counter

REC = re.compile(r'^.*\.(?:jsx|js|tsx):\d+:\d+: ')

def records(path):
    out, cur = [], None
    for raw in open(path):
        line = raw.rstrip('\n')
        if REC.match(line):
            if cur is not None:
                out.append(cur)
            cur = REC.sub('', line)
        elif cur is not None and line.strip() and not re.match(r'^\d+ problems?$', line.strip()):
            cur += ' ' + line.strip()
    if cur is not None:
        out.append(cur)
    return out

def norm(path):
    out = []
    for r in records(path):
        r = re.sub(r'line \d+ column \d+', 'line N col N', r)
        r = re.sub(r'at line \d+', 'at line N', r)
        r = re.sub(r"'#[0-9a-fA-F]{3,8}'", 'LIT', r)
        r = re.sub(r'"[^"]*#[0-9a-fA-F]{3,8}[^"]*"', 'LIT', r)
        r = re.sub(r"'rgba?\([^)]*\)'", 'LIT', r)
        r = re.sub(r'[A-Za-z]*[Cc]olor:\s*LIT,?\s*', '', r)
        r = re.sub(r',\s*\}', ' }', r)
        r = re.sub(r'\{\s*,\s*', '{ ', r)
        r = re.sub(r'\{\s*\}', '{ }', r)
        r = re.sub(r'\s+', ' ', r).strip()
        out.append(r)
    return Counter(out)

b, n = norm(sys.argv[1]), norm(sys.argv[2])
print(f'  baseline={sum(b.values())}  now={sum(n.values())}')
new = n - b
print('  NEW diagnostics:', 'NONE' if not new else '')
for k, v in new.items():
    print(f'    +{v}x {k[:110]}')
print(f'  removed: {sum((b - n).values())}')
