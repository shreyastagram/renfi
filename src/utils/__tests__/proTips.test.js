/**
 * The constraints the owner set for this copy, enforced rather than trusted:
 * a character limit so the card never grows, no emoji, and no repeats.
 */
import { PRO_TIPS, pickProTip } from '../proTips';

const MAX = 110;
// Pictographs, dingbats, emoji modifiers, variation selectors, ZWJ.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{FE0F}\u{200D}\u{2600}-\u{27BF}]/u;

describe('the tip set', () => {
  it('has fifty tips', () => {
    expect(PRO_TIPS).toHaveLength(50);
  });

  it('keeps every tip inside the character limit', () => {
    const over = PRO_TIPS.filter((t) => t.length > MAX);
    expect(over).toEqual([]);
  });

  it('contains no emoji', () => {
    const withEmoji = PRO_TIPS.filter((t) => EMOJI.test(t));
    expect(withEmoji).toEqual([]);
  });

  it('has no duplicates', () => {
    expect(new Set(PRO_TIPS).size).toBe(PRO_TIPS.length);
  });

  it('is all complete sentences', () => {
    const bad = PRO_TIPS.filter((t) => !/^[A-Z]/.test(t) || !/[.!?]$/.test(t));
    expect(bad).toEqual([]);
  });

  it('is not all about the app', () => {
    // The owner asked for tips "not just about the app". If most of them say
    // Fixhomi or profile or request, the card is an advert.
    const appish = PRO_TIPS.filter((t) => /profile|request|verif|online|rating|booking/i.test(t));
    expect(appish.length).toBeLessThan(PRO_TIPS.length / 2);
  });
});

describe('picking', () => {
  it('is stable for a given seed, so the card does not flicker on re-render', () => {
    expect(pickProTip(7)).toBe(pickProTip(7));
  });

  it('rotates as the seed advances', () => {
    const seen = new Set(Array.from({ length: 50 }, (_, i) => pickProTip(i)));
    expect(seen.size).toBe(50);
  });

  it('wraps rather than running off the end', () => {
    expect(pickProTip(50)).toBe(pickProTip(0));
    expect(pickProTip(123456)).toBeDefined();
  });

  it('survives a negative seed', () => {
    expect(PRO_TIPS).toContain(pickProTip(-3));
  });
});
