/**
 * Every key a StatSegments segment passes must be one the screen's filter
 * switch actually handles.
 *
 * WHY THIS EXISTS
 *
 * The two history screens use different vocabularies. The provider's switch
 * has `case 'active'`; the user's has `case 'accepted'` and no 'active' at
 * all. Wiring the count row to the filter, I passed 'active' to both — so on
 * the user screen the segment fell through to the default branch, which does
 * `r.status === 'active'`, and no record has that status. Tapping Active
 * emptied the list.
 *
 * Nothing catches this. It parses, it type-checks, the key is a valid string,
 * and the failure is an empty list rather than an error — which looks exactly
 * like "you have no active bookings".
 *
 * Read from source because the alternative is mounting two 1500-line screens
 * with a full navigation tree to assert one string contract.
 */
const fs = require('fs');
const path = require('path');

const read = (f) =>
  fs.readFileSync(path.join(__dirname, '..', '..', 'screens', f), 'utf8');

/**
 * The keys the screen's filter can actually act on:
 *   - every explicit `case` in the switch, and
 *   - every real status value, because the default branch does
 *     `r.status === activeFilter`, which is a legitimate match for a status.
 * A key that is neither is the bug: it silently filters to nothing.
 */
const handledKeys = (src) => {
  const start = src.indexOf('switch (activeFilter)');
  const open = src.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  const body = src.slice(open, end);
  const keys = new Set([...body.matchAll(/case '([\w-]+)':/g)].map((m) => m[1]));

  // Status values the default branch can match, read from the status config.
  // The DEFINITION, not the first usage — both screens build it in a
  // makeStatusConfig/makeStatusMap factory.
  const at = src.search(/const makeStatus(?:Config|Map) = /);
  const cfg = at >= 0 ? src.slice(at) : '';
  for (const m of cfg.slice(0, 2500).matchAll(/^\s+'?([\w-]+)'?: \{ (?:label|labelKey):/gm)) keys.add(m[1]);
  return keys;
};

/** The keys the count row hands back to setActiveFilter. */
const segmentKeys = (src) => {
  const i = src.indexOf('<StatSegments');
  const block = src.slice(i, src.indexOf('/>', i));
  return [...block.matchAll(/\{ key: '([\w-]+)'/g)].map((m) => m[1]);
};

describe.each([
  ['UserServiceHistoryScreen.jsx'],
  ['ProviderServiceHistoryScreen.jsx'],
])('%s', (file) => {
  const src = read(file);

  it('hands the filter only keys its own switch handles', () => {
    const handled = handledKeys(src);
    const unhandled = segmentKeys(src).filter((k) => !handled.has(k));
    expect(unhandled).toEqual([]);
  });

  it('has segments at all, so the test cannot pass vacuously', () => {
    expect(segmentKeys(src).length).toBeGreaterThan(2);
  });

  it('reads its counts from the list, not from fetch-time state', () => {
    // stats is only written inside the fetch, so it goes stale the moment a
    // booking is created or cancelled in-session — one active service, zero
    // on the segment.
    expect(src).toMatch(/const liveStats = useMemo/);
    expect(src).not.toMatch(/value: stats\./);
  });
});
