/**
 * Unit Tests for Formatter Utilities
 * 
 * Tests common formatting functions.
 */

import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatNumberCompact,
} from '../../src/shared/utils/formatters';

// ============================================================================
// Date Formatting Tests
// ============================================================================

describe('Date Formatting', () => {
  describe('formatDate', () => {
    it('should format Date objects', () => {
      const date = new Date('2024-03-15');
      const result = formatDate(date);
      expect(result).toContain('2024');
      expect(result).toContain('15');
    });

    it('should format date strings', () => {
      const result = formatDate('2024-03-15T12:00:00Z');
      expect(result).toContain('2024');
    });

    it('should handle null', () => {
      expect(formatDate(null)).toBe('');
    });

    it('should handle undefined', () => {
      expect(formatDate(undefined)).toBe('');
    });

    it('should handle empty string', () => {
      expect(formatDate('')).toBe('');
    });

    it('should handle invalid date strings gracefully', () => {
      const result = formatDate('not-a-date');
      // Should not throw, returns something (either parsed or the original string)
      expect(typeof result).toBe('string');
    });
  });

  describe('formatDateTime', () => {
    it('should format Date objects with time', () => {
      const date = new Date('2024-03-15T14:30:00Z');
      const result = formatDateTime(date);
      expect(result).toContain('2024');
      // Time part may vary by locale, just check it's not empty
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format date strings with time', () => {
      const result = formatDateTime('2024-03-15T14:30:00Z');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle null', () => {
      expect(formatDateTime(null)).toBe('');
    });

    it('should handle undefined', () => {
      expect(formatDateTime(undefined)).toBe('');
    });
  });
});

// ============================================================================
// Number Formatting Tests
// ============================================================================

describe('Number Formatting', () => {
  describe('formatNumber', () => {
    it('should format numbers with thousands separator', () => {
      // Result depends on locale, but should be a string with the number
      const result = formatNumber(1234567);
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('567');
    });

    it('should handle small numbers', () => {
      expect(formatNumber(42)).toContain('42');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toContain('0');
    });

    it('should handle negative numbers', () => {
      const result = formatNumber(-1234);
      expect(result).toContain('-');
      // Result may have locale-specific formatting like -1,234
      expect(result.replace(/,/g, '')).toContain('1234');
    });

    it('should handle null', () => {
      expect(formatNumber(null)).toBe('');
    });

    it('should handle undefined', () => {
      expect(formatNumber(undefined)).toBe('');
    });
  });

  describe('formatNumberCompact', () => {
    it('should not use compact notation for small numbers', () => {
      expect(formatNumberCompact(1234)).not.toContain('K');
      expect(formatNumberCompact(9999)).not.toContain('K');
    });

    it('should use K suffix for thousands', () => {
      expect(formatNumberCompact(10000)).toBe('10K');
      expect(formatNumberCompact(12500)).toBe('12.5K');
      expect(formatNumberCompact(999000)).toBe('999K');
    });

    it('should use M suffix for millions', () => {
      expect(formatNumberCompact(1000000)).toBe('1M');
      expect(formatNumberCompact(1500000)).toBe('1.5M');
      expect(formatNumberCompact(12345678)).toBe('12.3M');
    });

    it('should use B suffix for billions', () => {
      expect(formatNumberCompact(1000000000)).toBe('1B');
      expect(formatNumberCompact(2500000000)).toBe('2.5B');
    });

    it('should remove trailing zeros', () => {
      expect(formatNumberCompact(10000)).toBe('10K');
      expect(formatNumberCompact(20000)).toBe('20K');
    });

    it('should respect custom threshold', () => {
      expect(formatNumberCompact(5000, { threshold: 1000 })).toBe('5K');
      expect(formatNumberCompact(5000, { threshold: 10000 })).not.toContain('K');
    });

    it('should respect custom decimals', () => {
      expect(formatNumberCompact(12345, { decimals: 2 })).toBe('12.35K');
      expect(formatNumberCompact(12345, { decimals: 0 })).toBe('12K');
    });

    it('should handle negative numbers', () => {
      expect(formatNumberCompact(-10000)).toBe('-10K');
      expect(formatNumberCompact(-1000000)).toBe('-1M');
    });

    it('should handle null', () => {
      expect(formatNumberCompact(null)).toBe('');
    });

    it('should handle undefined', () => {
      expect(formatNumberCompact(undefined)).toBe('');
    });

    it('should handle zero', () => {
      expect(formatNumberCompact(0)).toContain('0');
    });
  });
});
