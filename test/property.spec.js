import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { truncateToWeightedLength, replaceNewlines } from '../src/Code.js';

// Property-based tests over the text helpers. Titles arrive from the
// ogp-png front end as user-typed text, so the generator alphabet covers
// what a title can contain: ASCII, full-width, halfwidth katakana,
// astral characters (whole code points — a textarea value is always
// well-formed, so lone surrogates are NOT generated; the one documented
// exception is pinned in the abnormal suite), combining marks, controls
// and newlines.

const TITLE_PIECES = [
  'a', 'Z', '0', ' ', 'あ', 'ん', 'ｱ', 'ﾝ', '🎉', '𐮷',
  '́', '​', '\n', '\r\n', '\t', '\u0000',
];
const titleString = (maxLength = 60) =>
  fc.array(fc.constantFrom(...TITLE_PIECES), { maxLength }).map((parts) => parts.join(''));

const unitWeight = (code) =>
  (code >= 0x0000 && code <= 0x007f) || (code >= 0xff61 && code <= 0xff9f) ? 1 : 1.65;
// Weight of one code point, accumulated exactly as the implementation
// accumulates it (per code unit, in order), so float comparisons agree.
const codePointWeight = (cp) => {
  let w = 0;
  for (let i = 0; i < cp.length; i++) w += unitWeight(cp.charCodeAt(i));
  return w;
};
const totalWeight = (s) => {
  let w = 0;
  for (const cp of s) w += codePointWeight(cp);
  return w;
};
const hasLoneSurrogate = (s) =>
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

describe('truncateToWeightedLength — properties', () => {
  it('never throws, returns a code-point prefix of the input, and never splits a surrogate pair', () => {
    fc.assert(
      fc.property(titleString(), fc.double({ min: 0, max: 200, noNaN: true }), (s, limit) => {
        const out = truncateToWeightedLength(s, limit);
        expect(typeof out).toBe('string');
        expect(s.startsWith(out)).toBe(true);
        expect(hasLoneSurrogate(out)).toBe(false);
        // The practical consequence: the rendered title can always be
        // URI-encoded (the original code threw URIError here).
        expect(() => encodeURIComponent(out)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('respects the weighted limit and is maximal (the next code point never fits)', () => {
    fc.assert(
      fc.property(titleString(), fc.double({ min: 0, max: 200, noNaN: true }), (s, limit) => {
        const out = truncateToWeightedLength(s, limit);
        expect(totalWeight(out)).toBeLessThanOrEqual(limit + 0.0001);
        if (out !== s) {
          const next = String.fromCodePoint(s.codePointAt(out.length));
          expect(totalWeight(out) + codePointWeight(next)).toBeGreaterThan(limit + 0.0001);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('never splits a surrogate pair at limits near the pair boundary', () => {
    // Targeted at the boundary window: n full-width chars (1.65 each)
    // followed by one astral char (1.65 + 1.65). A limit landing in
    // [n*1.65 + 1.65, n*1.65 + 3.3) makes a code-unit loop keep only
    // the high surrogate.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 40 }),
        // Integer hundredths: fc.double over [0, 3.3] generates mostly
        // denormal-tiny magnitudes and would almost never land in the
        // [1.65, 3.3) split window.
        fc.integer({ min: 0, max: 330 }).map((v) => v / 100),
        (n, offset) => {
          const s = 'あ'.repeat(n) + '🎉';
          const out = truncateToWeightedLength(s, n * 1.65 + offset);
          expect(hasLoneSurrogate(out)).toBe(false);
          expect(s.startsWith(out)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('is the identity at a sufficient limit and idempotent', () => {
    fc.assert(
      fc.property(titleString(), fc.double({ min: 0, max: 200, noNaN: true }), (s, limit) => {
        expect(truncateToWeightedLength(s, 100000)).toBe(s);
        const once = truncateToWeightedLength(s, limit);
        expect(truncateToWeightedLength(once, limit)).toBe(once);
      }),
      { numRuns: 100 }
    );
  });

  it('never throws and returns a string for arbitrary JSON-domain inputs and limits', () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.jsonValue(), (value, limit) => {
        const out = truncateToWeightedLength(value, limit);
        expect(typeof out).toBe('string');
        if (typeof value !== 'string') expect(out).toBe('');
      }),
      { numRuns: 100 }
    );
  });
});

describe('replaceNewlines — properties', () => {
  it('removes every \\n, folds \\r\\n, never grows the string, and is idempotent', () => {
    fc.assert(
      fc.property(titleString(), (s) => {
        const out = replaceNewlines(s);
        expect(out.includes('\n')).toBe(false);
        expect(out.length).toBeLessThanOrEqual(s.length);
        expect(replaceNewlines(out)).toBe(out);
        if (!s.includes('\n')) expect(out).toBe(s);
      }),
      { numRuns: 100 }
    );
  });

  it('never throws and returns a string for arbitrary JSON-domain inputs', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const out = replaceNewlines(value);
        expect(typeof out).toBe('string');
        if (typeof value !== 'string') expect(out).toBe('');
      }),
      { numRuns: 100 }
    );
  });
});
