/**
 * Unit Tests for Formatters
 * 
 * Tests formatting utilities for dates, numbers, and HTML.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatNumberCompact,
  escapeHtml,
} from '../../src/shared/utils/formatters';

// ============================================================================
// formatDate Tests
// ============================================================================

describe('formatDate', () => {
  it('should format Date object', () => {
    const date = new Date('2024-03-15');
    const formatted = formatDate(date);
    // Format depends on locale, but should contain year, month, day
    expect(formatted).toBeTruthy();
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('should format ISO date string', () => {
    const formatted = formatDate('2024-03-15');
    expect(formatted).toBeTruthy();
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('should format ISO datetime string', () => {
    const formatted = formatDate('2024-03-15T10:30:00Z');
    expect(formatted).toBeTruthy();
  });

  it('should return empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('should return empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(formatDate('')).toBe('');
  });

  it('should handle invalid date gracefully', () => {
    const result = formatDate('not-a-date');
    // Should return something (either formatted "Invalid Date" or the original string)
    expect(typeof result).toBe('string');
  });
});

// ============================================================================
// formatDateTime Tests
// ============================================================================

describe('formatDateTime', () => {
  it('should format Date object with time', () => {
    const date = new Date('2024-03-15T10:30:00');
    const formatted = formatDateTime(date);
    expect(formatted).toBeTruthy();
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('should format ISO datetime string', () => {
    const formatted = formatDateTime('2024-03-15T10:30:00Z');
    expect(formatted).toBeTruthy();
  });

  it('should return empty string for undefined', () => {
    expect(formatDateTime(undefined)).toBe('');
  });

  it('should return empty string for null', () => {
    expect(formatDateTime(null)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(formatDateTime('')).toBe('');
  });

  it('should handle invalid date gracefully', () => {
    const result = formatDateTime('invalid');
    expect(typeof result).toBe('string');
  });
});

// ============================================================================
// formatNumber Tests
// ============================================================================

describe('formatNumber', () => {
  it('should format positive integers', () => {
    const formatted = formatNumber(1234567);
    // Should contain the number (locale-dependent formatting)
    expect(formatted).toBeTruthy();
    expect(formatted).toContain('1');
  });

  it('should format zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should format negative numbers', () => {
    const formatted = formatNumber(-1234);
    expect(formatted).toBeTruthy();
    expect(formatted).toContain('1');
  });

  it('should format decimal numbers', () => {
    const formatted = formatNumber(1234.56);
    expect(formatted).toBeTruthy();
  });

  it('should return empty string for undefined', () => {
    expect(formatNumber(undefined)).toBe('');
  });

  it('should return empty string for null', () => {
    expect(formatNumber(null)).toBe('');
  });
});

// ============================================================================
// formatNumberCompact Tests
// ============================================================================

describe('formatNumberCompact', () => {
  it('should format small numbers normally', () => {
    expect(formatNumberCompact(100)).toBeTruthy();
    expect(formatNumberCompact(1000)).toBeTruthy();
    expect(formatNumberCompact(9999)).toBeTruthy();
  });

  it('should use K suffix for thousands', () => {
    expect(formatNumberCompact(10000)).toBe('10K');
    expect(formatNumberCompact(15000)).toBe('15K');
    expect(formatNumberCompact(100000)).toBe('100K');
    expect(formatNumberCompact(999000)).toBe('999K');
  });

  it('should use M suffix for millions', () => {
    expect(formatNumberCompact(1000000)).toBe('1M');
    expect(formatNumberCompact(1500000)).toBe('1.5M');
    expect(formatNumberCompact(10000000)).toBe('10M');
    expect(formatNumberCompact(999000000)).toBe('999M');
  });

  it('should use B suffix for billions', () => {
    expect(formatNumberCompact(1000000000)).toBe('1B');
    expect(formatNumberCompact(1500000000)).toBe('1.5B');
    expect(formatNumberCompact(10000000000)).toBe('10B');
  });

  it('should handle negative numbers', () => {
    expect(formatNumberCompact(-10000)).toBe('-10K');
    expect(formatNumberCompact(-1000000)).toBe('-1M');
    expect(formatNumberCompact(-1000000000)).toBe('-1B');
  });

  it('should respect custom threshold', () => {
    expect(formatNumberCompact(5000, { threshold: 1000 })).toBe('5K');
    expect(formatNumberCompact(5000, { threshold: 10000 })).toBeTruthy();
    expect(formatNumberCompact(5000, { threshold: 10000 })).not.toBe('5K');
  });

  it('should respect custom decimals', () => {
    expect(formatNumberCompact(12500, { decimals: 2 })).toBe('12.5K');
    expect(formatNumberCompact(12345, { decimals: 2 })).toBe('12.35K');
    expect(formatNumberCompact(12000, { decimals: 0 })).toBe('12K');
  });

  it('should remove trailing zeros', () => {
    expect(formatNumberCompact(10000)).toBe('10K');
    expect(formatNumberCompact(100000)).toBe('100K');
    expect(formatNumberCompact(1000000)).toBe('1M');
  });

  it('should return empty string for undefined', () => {
    expect(formatNumberCompact(undefined)).toBe('');
  });

  it('should return empty string for null', () => {
    expect(formatNumberCompact(null)).toBe('');
  });

  it('should handle zero', () => {
    expect(formatNumberCompact(0)).toBe('0');
  });
});

// ============================================================================
// escapeHtml Tests
// ============================================================================

describe('escapeHtml', () => {
  // Note: escapeHtml uses document.createElement which may not be available in all Node.js environments
  // These tests assume jsdom or similar DOM implementation is available
  
  // Since we're in a Node.js test environment without DOM, let's create a mock
  beforeEach(() => {
    // Mock document.createElement for the test
    const mockElement = {
      textContent: '',
      get innerHTML() {
        // Simple escaping implementation
        return this.textContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      },
    };
    
    // Check if document exists and has createElement
    if (typeof document === 'undefined') {
      // @ts-expect-error - mocking global
      globalThis.document = {
        createElement: vi.fn(() => mockElement),
      };
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should escape < and > characters', () => {
    const escaped = escapeHtml('<script>alert("xss")</script>');
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;');
    expect(escaped).toContain('&gt;');
  });

  it('should escape & character', () => {
    const escaped = escapeHtml('foo & bar');
    expect(escaped).toContain('&amp;');
  });

  it('should escape quotes', () => {
    const escaped = escapeHtml('say "hello"');
    expect(escaped).toContain('&quot;');
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should not modify safe text', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
    expect(escapeHtml('abc123')).toBe('abc123');
  });

  it('should handle text with only special characters', () => {
    const escaped = escapeHtml('<>&"\'');
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).toBeTruthy();
  });

  it('should escape HTML attributes', () => {
    const escaped = escapeHtml('onclick="alert(1)"');
    expect(escaped).not.toContain('onclick="');
    expect(escaped).toContain('&quot;');
  });

  it('should handle newlines and special whitespace', () => {
    const input = 'line1\nline2\ttab';
    const escaped = escapeHtml(input);
    // Newlines and tabs should be preserved (they're not HTML special chars)
    expect(escaped).toContain('\n');
    expect(escaped).toContain('\t');
  });
});

