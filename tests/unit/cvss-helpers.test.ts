/**
 * Unit Tests for CVSS Helper Functions
 * 
 * Tests utilities for CVSS score display and styling.
 */

import { describe, it, expect } from 'vitest';
import {
  getCvssColor,
  getSeverityFromScore,
  formatCvssScore,
  formatEpssScore,
  formatEpssPercentile,
  getCvssChipStyle,
  getSeverityColor,
} from '../../src/panel/utils/cvss-helpers';

// ============================================================================
// getCvssColor Tests
// ============================================================================

describe('getCvssColor', () => {
  it('should return grey for undefined score', () => {
    expect(getCvssColor(undefined)).toBe('#607d8b');
  });

  it('should return grey for null score', () => {
    expect(getCvssColor(null as unknown as number)).toBe('#607d8b');
  });

  it('should return grey for zero score', () => {
    expect(getCvssColor(0)).toBe('#607d8b');
  });

  it('should return green for low severity (0.1-3.9)', () => {
    expect(getCvssColor(0.1)).toBe('#4caf50');
    expect(getCvssColor(1.5)).toBe('#4caf50');
    expect(getCvssColor(3.9)).toBe('#4caf50');
  });

  it('should return amber for medium severity (4.0-6.9)', () => {
    expect(getCvssColor(4.0)).toBe('#ffb74d');
    expect(getCvssColor(5.5)).toBe('#ffb74d');
    expect(getCvssColor(6.9)).toBe('#ffb74d');
  });

  it('should return orange for high severity (7.0-8.9)', () => {
    expect(getCvssColor(7.0)).toBe('#ff7043');
    expect(getCvssColor(8.0)).toBe('#ff7043');
    expect(getCvssColor(8.9)).toBe('#ff7043');
  });

  it('should return red for critical severity (9.0-10.0)', () => {
    expect(getCvssColor(9.0)).toBe('#ef5350');
    expect(getCvssColor(9.5)).toBe('#ef5350');
    expect(getCvssColor(10.0)).toBe('#ef5350');
  });
});

// ============================================================================
// getSeverityFromScore Tests
// ============================================================================

describe('getSeverityFromScore', () => {
  it('should return Unknown for undefined score', () => {
    expect(getSeverityFromScore(undefined)).toBe('Unknown');
  });

  it('should return Unknown for null score', () => {
    expect(getSeverityFromScore(null as unknown as number)).toBe('Unknown');
  });

  it('should return None for zero score', () => {
    expect(getSeverityFromScore(0)).toBe('None');
  });

  it('should return Low for scores 0.1-3.9', () => {
    expect(getSeverityFromScore(0.1)).toBe('Low');
    expect(getSeverityFromScore(2.0)).toBe('Low');
    expect(getSeverityFromScore(3.9)).toBe('Low');
  });

  it('should return Medium for scores 4.0-6.9', () => {
    expect(getSeverityFromScore(4.0)).toBe('Medium');
    expect(getSeverityFromScore(5.5)).toBe('Medium');
    expect(getSeverityFromScore(6.9)).toBe('Medium');
  });

  it('should return High for scores 7.0-8.9', () => {
    expect(getSeverityFromScore(7.0)).toBe('High');
    expect(getSeverityFromScore(8.0)).toBe('High');
    expect(getSeverityFromScore(8.9)).toBe('High');
  });

  it('should return Critical for scores 9.0-10.0', () => {
    expect(getSeverityFromScore(9.0)).toBe('Critical');
    expect(getSeverityFromScore(9.5)).toBe('Critical');
    expect(getSeverityFromScore(10.0)).toBe('Critical');
  });
});

// ============================================================================
// formatCvssScore Tests
// ============================================================================

describe('formatCvssScore', () => {
  it('should return N/A for undefined score', () => {
    expect(formatCvssScore(undefined)).toBe('N/A');
  });

  it('should return N/A for null score', () => {
    expect(formatCvssScore(null as unknown as number)).toBe('N/A');
  });

  it('should format score with one decimal place', () => {
    expect(formatCvssScore(0)).toBe('0.0');
    expect(formatCvssScore(5)).toBe('5.0');
    expect(formatCvssScore(7.5)).toBe('7.5');
    expect(formatCvssScore(9.99)).toBe('10.0');
    expect(formatCvssScore(10)).toBe('10.0');
  });

  it('should round appropriately', () => {
    expect(formatCvssScore(7.54)).toBe('7.5');
    expect(formatCvssScore(7.55)).toBe('7.5'); // JavaScript's toFixed uses banker's rounding
    expect(formatCvssScore(7.56)).toBe('7.6');
  });
});

// ============================================================================
// formatEpssScore Tests
// ============================================================================

describe('formatEpssScore', () => {
  it('should return N/A for undefined score', () => {
    expect(formatEpssScore(undefined)).toBe('N/A');
  });

  it('should return N/A for null score', () => {
    expect(formatEpssScore(null as unknown as number)).toBe('N/A');
  });

  it('should format score as percentage with two decimal places', () => {
    expect(formatEpssScore(0)).toBe('0.00%');
    expect(formatEpssScore(0.5)).toBe('50.00%');
    expect(formatEpssScore(1)).toBe('100.00%');
    expect(formatEpssScore(0.123)).toBe('12.30%');
    expect(formatEpssScore(0.1234)).toBe('12.34%');
  });

  it('should handle small decimal values', () => {
    expect(formatEpssScore(0.0001)).toBe('0.01%');
    expect(formatEpssScore(0.00001)).toBe('0.00%');
  });
});

// ============================================================================
// formatEpssPercentile Tests
// ============================================================================

describe('formatEpssPercentile', () => {
  it('should return N/A for undefined percentile', () => {
    expect(formatEpssPercentile(undefined)).toBe('N/A');
  });

  it('should return N/A for null percentile', () => {
    expect(formatEpssPercentile(null as unknown as number)).toBe('N/A');
  });

  it('should format percentile as percentage with one decimal place', () => {
    expect(formatEpssPercentile(0)).toBe('0.0%');
    expect(formatEpssPercentile(0.5)).toBe('50.0%');
    expect(formatEpssPercentile(1)).toBe('100.0%');
    expect(formatEpssPercentile(0.123)).toBe('12.3%');
    expect(formatEpssPercentile(0.9876)).toBe('98.8%');
  });
});

// ============================================================================
// getCvssChipStyle Tests
// ============================================================================

describe('getCvssChipStyle', () => {
  it('should return style object with correct properties', () => {
    const style = getCvssChipStyle(7.5);
    
    expect(style).toHaveProperty('fontWeight', 700);
    expect(style).toHaveProperty('fontSize', 14);
    expect(style).toHaveProperty('height', 34);
    expect(style).toHaveProperty('color', '#ffffff');
    expect(style).toHaveProperty('border', 'none');
    expect(style).toHaveProperty('bgcolor');
  });

  it('should use severity color for background', () => {
    const lowStyle = getCvssChipStyle(2.0);
    const highStyle = getCvssChipStyle(8.0);
    const criticalStyle = getCvssChipStyle(9.5);
    
    expect(lowStyle.bgcolor).toBe('#4caf50');
    expect(highStyle.bgcolor).toBe('#ff7043');
    expect(criticalStyle.bgcolor).toBe('#ef5350');
  });

  it('should handle undefined score', () => {
    const style = getCvssChipStyle(undefined);
    
    expect(style.bgcolor).toBe('#607d8b');
    expect(style.color).toBe('#ffffff');
  });

  it('should have icon color style', () => {
    const style = getCvssChipStyle(5.0);
    
    expect(style).toHaveProperty('& .MuiChip-icon');
    expect((style as Record<string, { color: string }>)['& .MuiChip-icon'].color).toBe('#ffffff');
  });
});

// ============================================================================
// getSeverityColor Tests
// ============================================================================

describe('getSeverityColor', () => {
  it('should return correct colors for low severity', () => {
    const colors = getSeverityColor('low');
    expect(colors).toEqual({ bgcolor: '#4caf50', color: '#ffffff' });
  });

  it('should return correct colors for medium severity', () => {
    const colors = getSeverityColor('medium');
    expect(colors).toEqual({ bgcolor: '#5c7bf5', color: '#ffffff' });
  });

  it('should return correct colors for high severity', () => {
    const colors = getSeverityColor('high');
    expect(colors).toEqual({ bgcolor: '#ff9800', color: '#ffffff' });
  });

  it('should return correct colors for critical severity', () => {
    const colors = getSeverityColor('critical');
    expect(colors).toEqual({ bgcolor: '#ef5350', color: '#ffffff' });
  });

  it('should be case insensitive', () => {
    expect(getSeverityColor('LOW')).toEqual({ bgcolor: '#4caf50', color: '#ffffff' });
    expect(getSeverityColor('MEDIUM')).toEqual({ bgcolor: '#5c7bf5', color: '#ffffff' });
    expect(getSeverityColor('HIGH')).toEqual({ bgcolor: '#ff9800', color: '#ffffff' });
    expect(getSeverityColor('CRITICAL')).toEqual({ bgcolor: '#ef5350', color: '#ffffff' });
    expect(getSeverityColor('Critical')).toEqual({ bgcolor: '#ef5350', color: '#ffffff' });
  });

  it('should return default grey for unknown severity', () => {
    expect(getSeverityColor('unknown')).toEqual({ bgcolor: '#607d8b', color: '#ffffff' });
    expect(getSeverityColor('invalid')).toEqual({ bgcolor: '#607d8b', color: '#ffffff' });
    expect(getSeverityColor('')).toEqual({ bgcolor: '#607d8b', color: '#ffffff' });
  });

  it('should return default grey for undefined severity', () => {
    const colors = getSeverityColor(undefined);
    expect(colors).toEqual({ bgcolor: '#607d8b', color: '#ffffff' });
  });
});

