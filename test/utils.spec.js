import { describe, it, expect } from 'vitest';
import { getWeightedLength, truncateToWeightedLength, replaceNewlines } from '../src/Code.js';

describe('Utility functions', () => {
  describe('getWeightedLength', () => {
    it('should return 0 for empty string', () => {
      expect(getWeightedLength('')).toBe(0);
      expect(getWeightedLength(null)).toBe(0);
    });

    it('should count ASCII characters as 1.0', () => {
      expect(getWeightedLength('abc')).toBe(3);
    });

    it('should count half-width Katakana as 1.0', () => {
      expect(getWeightedLength('ｱｲｳ')).toBe(3);
    });

    it('should count full-width characters as 1.65', () => {
      expect(getWeightedLength('あいう')).toBe(1.65 * 3);
    });

    it('should handle mixed characters', () => {
      expect(getWeightedLength('aｱあ')).toBe(1 + 1 + 1.65);
    });
  });

  describe('truncateToWeightedLength', () => {
    it('should return empty string for empty input', () => {
      expect(truncateToWeightedLength('', 10)).toBe('');
      expect(truncateToWeightedLength(null, 10)).toBe('');
    });

    it('should not truncate if within weight', () => {
      expect(truncateToWeightedLength('abc', 10)).toBe('abc');
    });

    it('should truncate ASCII characters', () => {
      expect(truncateToWeightedLength('abcdefghij', 5)).toBe('abcde');
    });

    it('should truncate full-width characters', () => {
      // 1.65 * 3 = 4.95 <= 5
      // 1.65 * 4 = 6.6 > 5
      expect(truncateToWeightedLength('あいうえお', 5)).toBe('あいう');
    });

    it('should handle mixed characters during truncation', () => {
      // 'a' (1) + 'あ' (1.65) = 2.65
      // 2.65 + 'b' (1) = 3.65
      // 3.65 + 'い' (1.65) = 5.3 > 5
      expect(truncateToWeightedLength('aあbい', 5)).toBe('aあb');
    });

    it('should handle epsilon for floating point comparison', () => {
        // 1.65 * 2 = 3.3
        expect(truncateToWeightedLength('ああ', 3.3)).toBe('ああ');
    });
  });

  describe('replaceNewlines', () => {
    it('should return empty string for empty input', () => {
      expect(replaceNewlines('')).toBe('');
      expect(replaceNewlines(null)).toBe('');
    });

    it('should replace \n with space', () => {
      expect(replaceNewlines('a\nb')).toBe('a b');
    });

    it('should replace \r\n with space', () => {
      expect(replaceNewlines('a\r\nb')).toBe('a b');
    });

    it('should replace multiple newlines', () => {
      expect(replaceNewlines('a\nb\nc')).toBe('a b c');
    });
  });
});
