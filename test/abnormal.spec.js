import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Code from '../src/Code.js';
import { truncateToWeightedLength, replaceNewlines } from '../src/Code.js';

// Abnormal-case tests: deformed values that can arrive from outside the
// process (the ?t= query parameter is user-controlled text; the exported
// helpers are also the unit surface every caller relies on). JSON can
// produce values whose toString is not a function, lone surrogates via
// \u escapes, and wrong-typed fields — the helpers must degrade, not throw.

const hasLoneSurrogate = (s) =>
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

describe('replaceNewlines — abnormal inputs', () => {
  it('reads non-string truthy inputs as empty instead of throwing', () => {
    // (42).replace / ({}).replace is not a function on the original code.
    expect(replaceNewlines(42)).toBe('');
    expect(replaceNewlines(true)).toBe('');
    expect(replaceNewlines({})).toBe('');
    expect(replaceNewlines(['a\nb'])).toBe('');
  });

  it('reads an unstringifiable object as empty instead of throwing', () => {
    // Producible via JSON.parse('{"toString":[]}')-shaped payloads.
    expect(replaceNewlines({ toString: [] })).toBe('');
  });

  it('keeps falsy inputs empty', () => {
    expect(replaceNewlines(0)).toBe('');
    expect(replaceNewlines(false)).toBe('');
    expect(replaceNewlines(undefined)).toBe('');
  });

  it('does not fold a lone \\r (pinned: only \\n and \\r\\n are line breaks here)', () => {
    expect(replaceNewlines('a\rb')).toBe('a\rb');
  });

  it('passes control characters and NUL through unchanged (pinned)', () => {
    expect(replaceNewlines('a\u0000b\tc')).toBe('a\u0000b\tc');
  });

  it('passes astral characters and combining marks through unchanged', () => {
    expect(replaceNewlines('🎉が')).toBe('🎉が');
  });
});

describe('truncateToWeightedLength — abnormal inputs', () => {
  it('never splits a surrogate pair at the limit', () => {
    // 39 full-width chars weigh 39 * 1.65 = 64.35. The emoji weighs
    // 1.65 per code unit: the original code took the high surrogate
    // (66.0 <= 66.0001) and dropped the low one, emitting a lone
    // surrogate that makes encodeURIComponent throw URIError.
    const input = 'あ'.repeat(39) + '🎉' + 'あ';
    const out = truncateToWeightedLength(input, 66);
    expect(hasLoneSurrogate(out)).toBe(false);
    expect(out).toBe('あ'.repeat(39));
    expect(() => encodeURIComponent(out)).not.toThrow();
  });

  it('drops a pair that only half-fits at a small limit', () => {
    // One emoji weighs 3.3 in total; at limit 1.65 the original code
    // emitted just the high surrogate.
    const out = truncateToWeightedLength('🎉', 1.65);
    expect(out).toBe('');
  });

  it('takes a pair whole when it exactly fits', () => {
    expect(truncateToWeightedLength('🎉', 3.3)).toBe('🎉');
  });

  it('reads a string limit as 0 instead of leaking text past it', () => {
    // '3' + 0.0001 concatenates to '30.0001' on the original code, so a
    // limit of '3' silently behaved like 30 and returned everything.
    expect(truncateToWeightedLength('abcdefghij', '3')).toBe('');
  });

  it('reads a boolean limit as 0 instead of 1', () => {
    // true + 0.0001 === 1.0001 on the original code, returning 'a'.
    expect(truncateToWeightedLength('abcdefghij', true)).toBe('');
  });

  it('reads NaN / null / undefined / object limits as 0', () => {
    expect(truncateToWeightedLength('abcdefghij', NaN)).toBe('');
    expect(truncateToWeightedLength('abcdefghij', null)).toBe('');
    expect(truncateToWeightedLength('abcdefghij', undefined)).toBe('');
    expect(truncateToWeightedLength('abcdefghij', {})).toBe('');
  });

  it('keeps numeric limit semantics: Infinity returns everything, <= 0 nothing', () => {
    expect(truncateToWeightedLength('abcdefghij', Infinity)).toBe('abcdefghij');
    expect(truncateToWeightedLength('abcdefghij', 0)).toBe('');
    expect(truncateToWeightedLength('abcdefghij', -3)).toBe('');
  });

  it('reads non-string inputs as empty', () => {
    expect(truncateToWeightedLength(42, 66)).toBe('');
    expect(truncateToWeightedLength(true, 66)).toBe('');
    expect(truncateToWeightedLength({}, 66)).toBe('');
    expect(truncateToWeightedLength({ toString: [] }, 66)).toBe('');
    // An array leaked its element as a "character" on the original code.
    expect(truncateToWeightedLength(['ab'], 66)).toBe('');
  });

  it('passes a lone surrogate already in the input through unrepaired (pinned)', () => {
    // Truncation cannot invent the missing half; callers receive the
    // input domain decision documented in the property suite.
    expect(truncateToWeightedLength('a\ud800b', 66)).toBe('a\ud800b');
  });

  it('truncates a very long string at the limit', () => {
    const out = truncateToWeightedLength('a'.repeat(100000), 66);
    expect(out).toBe('a'.repeat(66));
  });
});

describe('doGet — abnormal titles', () => {
  const mockFile = {
    makeCopy: vi.fn().mockReturnThis(),
    getId: vi.fn().mockReturnValue('mock-temp-id'),
    setTrashed: vi.fn(),
    getParents: vi.fn().mockReturnValue({ hasNext: () => false, next: () => null }),
  };
  const mockSlide = { replaceAllText: vi.fn() };
  const mockPresentation = {
    getSlides: vi.fn().mockReturnValue([mockSlide]),
    saveAndClose: vi.fn(),
  };
  const mockBlob = {
    setName: vi.fn().mockReturnThis(),
    getBytes: vi.fn().mockReturnValue([1, 2, 3]),
  };
  const mockOutput = { setMimeType: vi.fn().mockReturnThis() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('DriveApp', { getFileById: vi.fn().mockReturnValue(mockFile) });
    vi.stubGlobal('SlidesApp', { openById: vi.fn().mockReturnValue(mockPresentation) });
    vi.stubGlobal('ScriptApp', { getOAuthToken: vi.fn().mockReturnValue('mock-token') });
    vi.stubGlobal('UrlFetchApp', { fetch: vi.fn().mockReturnValue({ getBlob: vi.fn().mockReturnValue(mockBlob) }) });
    vi.stubGlobal('Utilities', {
      base64Encode: vi.fn().mockReturnValue('mock-base64'),
      computeDigest: vi.fn().mockReturnValue([1, 2, 3]),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
    });
    vi.stubGlobal('ContentService', {
      createTextOutput: vi.fn().mockReturnValue(mockOutput),
      MimeType: { TEXT: 'TEXT_MIME_TYPE', JSON: 'JSON_MIME_TYPE' },
    });
    vi.stubGlobal('console', { error: vi.fn() });
  });

  it('hands the renderer a title with no lone surrogate for an emoji title at the limit', () => {
    const t = 'あ'.repeat(39) + '🎉' + 'あ';
    Code.doGet({ parameter: { t } });
    const rendered = mockSlide.replaceAllText.mock.calls[0][1];
    expect(hasLoneSurrogate(rendered)).toBe(false);
    expect(rendered).toBe('あ'.repeat(39));
  });

  it('passes markup-looking titles verbatim (Slides replaceAllText is plain text, no escaping surface)', () => {
    const t = '<b>&"{{title}}"';
    Code.doGet({ parameter: { t } });
    expect(mockSlide.replaceAllText).toHaveBeenCalledWith('{{title}}', t);
  });

  it('uses the default title for an empty t parameter', () => {
    Code.doGet({ parameter: { t: '' } });
    expect(mockSlide.replaceAllText).toHaveBeenCalledWith('{{title}}', 'No Title');
  });

  it('turns a newline-only title into spaces, as before', () => {
    Code.doGet({ parameter: { t: '\n\n' } });
    expect(mockSlide.replaceAllText).toHaveBeenCalledWith('{{title}}', '  ');
  });
});
