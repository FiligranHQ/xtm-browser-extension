/**
 * Unit Tests for Formatters
 * 
 * Tests formatting utility functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatNumberCompact,
} from '../../src/shared/utils/formatters';

// ============================================================================
// Date Formatting Tests
// ============================================================================

describe('formatDate', () => {
  it('should format a valid date string', () => {
    const result = formatDate('2024-01-15T10:30:00Z');
    expect(result).toBeTruthy();
    // The exact format depends on locale, but it should contain 2024
    expect(result).toContain('2024');
  });

  it('should format a Date object', () => {
    const date = new Date('2024-06-20');
    const result = formatDate(date);
    expect(result).toBeTruthy();
    expect(result).toContain('2024');
  });

  it('should return empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('should handle invalid date strings gracefully', () => {
    const result = formatDate('not-a-date');
    // Should either return empty or the string itself
    expect(typeof result).toBe('string');
  });
});

describe('formatDateTime', () => {
  it('should format a valid date string with time', () => {
    const result = formatDateTime('2024-01-15T10:30:00Z');
    expect(result).toBeTruthy();
    expect(result).toContain('2024');
  });

  it('should format a Date object with time', () => {
    const date = new Date('2024-06-20T14:45:00');
    const result = formatDateTime(date);
    expect(result).toBeTruthy();
    expect(result).toContain('2024');
  });

  it('should return empty string for null', () => {
    expect(formatDateTime(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(formatDateTime(undefined)).toBe('');
  });
});

// ============================================================================
// Number Formatting Tests
// ============================================================================

describe('formatNumber', () => {
  it('should format numbers with thousands separator', () => {
    const result = formatNumber(1234567);
    // The format depends on locale, but should include separators
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(6); // Should have separators
  });

  it('should format small numbers', () => {
    expect(formatNumber(123)).toBe('123');
  });

  it('should format zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should return empty string for null', () => {
    expect(formatNumber(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(formatNumber(undefined)).toBe('');
  });

  it('should handle negative numbers', () => {
    const result = formatNumber(-1234);
    expect(result).toContain('-');
  });
});

describe('formatNumberCompact', () => {
  it('should format numbers below threshold normally', () => {
    expect(formatNumberCompact(1234)).toBe('1,234');
    expect(formatNumberCompact(9999)).toBe('9,999');
  });

  it('should format numbers at or above threshold with K suffix', () => {
    const result = formatNumberCompact(12500);
    expect(result).toBe('12.5K');
  });

  it('should format millions with M suffix', () => {
    const result = formatNumberCompact(1500000);
    expect(result).toBe('1.5M');
  });

  it('should format billions with B suffix', () => {
    const result = formatNumberCompact(2500000000);
    expect(result).toBe('2.5B');
  });

  it('should respect custom threshold option', () => {
    expect(formatNumberCompact(5000, { threshold: 10000 })).toBe('5,000');
    expect(formatNumberCompact(5000, { threshold: 1000 })).toBe('5K');
  });

  it('should respect custom decimals option', () => {
    expect(formatNumberCompact(12345, { threshold: 10000, decimals: 2 })).toBe('12.35K');
    expect(formatNumberCompact(12345, { threshold: 10000, decimals: 0 })).toBe('12K');
  });

  it('should remove trailing zeros', () => {
    expect(formatNumberCompact(10000)).toBe('10K');
    expect(formatNumberCompact(20000000)).toBe('20M');
  });

  it('should return empty string for null', () => {
    expect(formatNumberCompact(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(formatNumberCompact(undefined)).toBe('');
  });

  it('should handle negative numbers', () => {
    expect(formatNumberCompact(-15000)).toBe('-15K');
  });
});

