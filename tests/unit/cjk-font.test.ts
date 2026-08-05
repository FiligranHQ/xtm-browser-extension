/**
 * Unit Tests for CJK Font Utilities
 *
 * Tests `needsCJKFont` detection for various Unicode ranges
 * and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { needsCJKFont } from '../../src/shared/extraction/cjk-font';

describe('needsCJKFont', () => {
  describe('detects CJK characters', () => {
    it.each([
      ['Japanese Hiragana', 'こんにちは'],
      ['Japanese Katakana', 'カタカナ'],
      ['CJK Unified Ideographs (Chinese)', '你好世界'],
      ['Korean Hangul syllables', '안녕하세요'],
      ['Korean Jamo', '\u1100\u1161'], // 가
      ['CJK punctuation', '〇〒〠'],
      ['CJK Compatibility Ideographs', '\uF900\uFA0E'],
      ['Bopomofo', '\u3100\u3105'],
      ['Mixed Latin + CJK', 'Hello 世界'],
      ['CJK Extension B (surrogate pair)', '\u{20000}'],
    ])('%s: "%s"', (_label, input) => {
      expect(needsCJKFont(input)).toBe(true);
    });
  });

  describe('returns false for non-CJK text', () => {
    it.each([
      ['ASCII', 'Hello World'],
      ['Latin extended', 'café résumé naïve'],
      ['Cyrillic', 'Привет мир'],
      ['Arabic', 'مرحبا بالعالم'],
      ['Thai', 'สวัสดีชาวโลก'],
      ['Emoji', '🎉🚀💡'],
      ['empty string', ''],
      ['numbers and symbols', '123 !@# $%^&*()'],
    ])('%s: "%s"', (_label, input) => {
      expect(needsCJKFont(input)).toBe(false);
    });
  });
});
