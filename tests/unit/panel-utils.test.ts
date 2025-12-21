/**
 * Unit Tests for Panel Utility Functions
 * 
 * Tests CVSS helpers and marking helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  getCvssColor,
  getCvssChipStyle,
  getSeverityColor,
  getSeverityFromScore,
  formatCvssScore,
  formatEpssScore,
  formatEpssPercentile,
} from '../../src/panel/utils/cvss-helpers';
import {
  getMarkingColor,
  getMarkingChipStyle,
} from '../../src/panel/utils/marking-helpers';

// ============================================================================
// CVSS Helpers Tests
// ============================================================================

describe('CVSS Helpers', () => {
  describe('getCvssColor', () => {
    it('should return gray for undefined score', () => {
      expect(getCvssColor(undefined)).toBe('#607d8b');
    });

    it('should return gray for null score', () => {
      expect(getCvssColor(null as unknown as number)).toBe('#607d8b');
    });

    it('should return gray for score of 0', () => {
      expect(getCvssColor(0)).toBe('#607d8b');
    });

    it('should return green for low scores (0.1-3.9)', () => {
      expect(getCvssColor(1.0)).toBe('#4caf50');
      expect(getCvssColor(3.9)).toBe('#4caf50');
    });

    it('should return amber for medium scores (4.0-6.9)', () => {
      expect(getCvssColor(4.0)).toBe('#ffb74d');
      expect(getCvssColor(6.9)).toBe('#ffb74d');
    });

    it('should return orange for high scores (7.0-8.9)', () => {
      expect(getCvssColor(7.0)).toBe('#ff7043');
      expect(getCvssColor(8.9)).toBe('#ff7043');
    });

    it('should return red for critical scores (9.0+)', () => {
      expect(getCvssColor(9.0)).toBe('#ef5350');
      expect(getCvssColor(10.0)).toBe('#ef5350');
    });
  });

  describe('getCvssChipStyle', () => {
    it('should return chip style with correct bgcolor', () => {
      const style = getCvssChipStyle(9.5);
      expect(style).toHaveProperty('bgcolor', '#ef5350');
      expect(style).toHaveProperty('color', '#ffffff');
      expect(style).toHaveProperty('fontWeight', 700);
    });

    it('should handle undefined score', () => {
      const style = getCvssChipStyle(undefined);
      expect(style).toHaveProperty('bgcolor', '#607d8b');
    });
  });

  describe('getSeverityColor', () => {
    it('should return green for low severity', () => {
      const result = getSeverityColor('low');
      expect(result.bgcolor).toBe('#4caf50');
      expect(result.color).toBe('#ffffff');
    });

    it('should return blue for medium severity', () => {
      const result = getSeverityColor('medium');
      expect(result.bgcolor).toBe('#5c7bf5');
    });

    it('should return orange for high severity', () => {
      const result = getSeverityColor('high');
      expect(result.bgcolor).toBe('#ff9800');
    });

    it('should return red for critical severity', () => {
      const result = getSeverityColor('critical');
      expect(result.bgcolor).toBe('#ef5350');
    });

    it('should be case insensitive', () => {
      expect(getSeverityColor('LOW').bgcolor).toBe('#4caf50');
      expect(getSeverityColor('MEDIUM').bgcolor).toBe('#5c7bf5');
      expect(getSeverityColor('HIGH').bgcolor).toBe('#ff9800');
      expect(getSeverityColor('CRITICAL').bgcolor).toBe('#ef5350');
    });

    it('should return gray for unknown severity', () => {
      expect(getSeverityColor('unknown').bgcolor).toBe('#607d8b');
      expect(getSeverityColor(undefined).bgcolor).toBe('#607d8b');
    });
  });

  describe('getSeverityFromScore', () => {
    it('should return Unknown for undefined', () => {
      expect(getSeverityFromScore(undefined)).toBe('Unknown');
    });

    it('should return Unknown for null', () => {
      expect(getSeverityFromScore(null as unknown as number)).toBe('Unknown');
    });

    it('should return None for score of 0', () => {
      expect(getSeverityFromScore(0)).toBe('None');
    });

    it('should return Low for scores 0.1-3.9', () => {
      expect(getSeverityFromScore(1.0)).toBe('Low');
      expect(getSeverityFromScore(3.9)).toBe('Low');
    });

    it('should return Medium for scores 4.0-6.9', () => {
      expect(getSeverityFromScore(4.0)).toBe('Medium');
      expect(getSeverityFromScore(6.9)).toBe('Medium');
    });

    it('should return High for scores 7.0-8.9', () => {
      expect(getSeverityFromScore(7.0)).toBe('High');
      expect(getSeverityFromScore(8.9)).toBe('High');
    });

    it('should return Critical for scores 9.0+', () => {
      expect(getSeverityFromScore(9.0)).toBe('Critical');
      expect(getSeverityFromScore(10.0)).toBe('Critical');
    });
  });

  describe('formatCvssScore', () => {
    it('should return N/A for undefined', () => {
      expect(formatCvssScore(undefined)).toBe('N/A');
    });

    it('should return N/A for null', () => {
      expect(formatCvssScore(null as unknown as number)).toBe('N/A');
    });

    it('should format score to one decimal place', () => {
      expect(formatCvssScore(9.5)).toBe('9.5');
      expect(formatCvssScore(7.123)).toBe('7.1');
      expect(formatCvssScore(10)).toBe('10.0');
      expect(formatCvssScore(0)).toBe('0.0');
    });
  });

  describe('formatEpssScore', () => {
    it('should return N/A for undefined', () => {
      expect(formatEpssScore(undefined)).toBe('N/A');
    });

    it('should return N/A for null', () => {
      expect(formatEpssScore(null as unknown as number)).toBe('N/A');
    });

    it('should format as percentage', () => {
      expect(formatEpssScore(0.5)).toBe('50.00%');
      expect(formatEpssScore(0.01)).toBe('1.00%');
      expect(formatEpssScore(0.0001)).toBe('0.01%');
      expect(formatEpssScore(1)).toBe('100.00%');
    });
  });

  describe('formatEpssPercentile', () => {
    it('should return N/A for undefined', () => {
      expect(formatEpssPercentile(undefined)).toBe('N/A');
    });

    it('should return N/A for null', () => {
      expect(formatEpssPercentile(null as unknown as number)).toBe('N/A');
    });

    it('should format as percentage with one decimal', () => {
      expect(formatEpssPercentile(0.95)).toBe('95.0%');
      expect(formatEpssPercentile(0.999)).toBe('99.9%');
      expect(formatEpssPercentile(0.5)).toBe('50.0%');
    });
  });
});

// ============================================================================
// Marking Helpers Tests
// ============================================================================

describe('Marking Helpers', () => {
  describe('getMarkingColor', () => {
    it('should return white for undefined', () => {
      expect(getMarkingColor(undefined)).toBe('#ffffff');
    });

    it('should return red for TLP:RED', () => {
      expect(getMarkingColor('TLP:RED')).toBe('#c62828');
    });

    it('should return red for PAP:RED', () => {
      expect(getMarkingColor('PAP:RED')).toBe('#c62828');
    });

    it('should return red for CD markings', () => {
      expect(getMarkingColor('CD')).toBe('#c62828');
      expect(getMarkingColor('CD-SF')).toBe('#c62828');
    });

    it('should return red for DR markings', () => {
      expect(getMarkingColor('DR')).toBe('#c62828');
      expect(getMarkingColor('DR-SF')).toBe('#c62828');
    });

    it('should return orange for TLP:AMBER', () => {
      expect(getMarkingColor('TLP:AMBER')).toBe('#d84315');
      expect(getMarkingColor('TLP:AMBER+STRICT')).toBe('#d84315');
    });

    it('should return orange for PAP:AMBER', () => {
      expect(getMarkingColor('PAP:AMBER')).toBe('#d84315');
    });

    it('should return green for TLP:GREEN', () => {
      expect(getMarkingColor('TLP:GREEN')).toBe('#2e7d32');
    });

    it('should return green for PAP:GREEN', () => {
      expect(getMarkingColor('PAP:GREEN')).toBe('#2e7d32');
    });

    it('should return green for NP', () => {
      expect(getMarkingColor('NP')).toBe('#2e7d32');
    });

    it('should return white for TLP:CLEAR in dark mode', () => {
      expect(getMarkingColor('TLP:CLEAR', 'dark')).toBe('#ffffff');
    });

    it('should return dark for TLP:CLEAR in light mode', () => {
      expect(getMarkingColor('TLP:CLEAR', 'light')).toBe('#2b2b2b');
    });

    it('should handle TLP:WHITE same as TLP:CLEAR', () => {
      expect(getMarkingColor('TLP:WHITE', 'dark')).toBe('#ffffff');
      expect(getMarkingColor('TLP:WHITE', 'light')).toBe('#2b2b2b');
    });

    it('should return blue for SF', () => {
      expect(getMarkingColor('SF')).toBe('#283593');
    });

    it('should return white for unknown markings', () => {
      expect(getMarkingColor('UNKNOWN')).toBe('#ffffff');
    });
  });

  describe('getMarkingChipStyle', () => {
    it('should return style with bgcolor', () => {
      const style = getMarkingChipStyle('TLP:RED');
      expect(style.bgcolor).toBe('#c62828');
      expect(style.color).toBe('#ffffff');
      expect(style.fontWeight).toBe(600);
    });

    it('should have inverted text for clear markings in dark mode', () => {
      const style = getMarkingChipStyle('TLP:CLEAR', 'dark');
      expect(style.color).toBe('#000000');
    });

    it('should have white text for clear markings in light mode', () => {
      const style = getMarkingChipStyle('TLP:CLEAR', 'light');
      expect(style.color).toBe('#ffffff');
    });

    it('should handle PAP:CLEAR same as TLP:CLEAR', () => {
      const style = getMarkingChipStyle('PAP:CLEAR', 'dark');
      expect(style.color).toBe('#000000');
    });
  });
});

// Note: Description helper tests require DOM environment (jsdom) and are
// tested separately in integration tests

