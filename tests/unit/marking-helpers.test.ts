/**
 * Unit Tests for Marking Helpers
 * 
 * Tests utility functions for TLP/PAP marking colors.
 */

import { describe, it, expect } from 'vitest';
import {
  getMarkingColor,
  getMarkingChipStyle,
} from '../../src/panel/utils/marking-helpers';

// ============================================================================
// getMarkingColor Tests
// ============================================================================

describe('getMarkingColor', () => {
  describe('TLP markings', () => {
    it('should return red for TLP:RED', () => {
      expect(getMarkingColor('TLP:RED')).toBe('#c62828');
    });

    it('should return orange for TLP:AMBER', () => {
      expect(getMarkingColor('TLP:AMBER')).toBe('#d84315');
    });

    it('should return orange for TLP:AMBER+STRICT', () => {
      expect(getMarkingColor('TLP:AMBER+STRICT')).toBe('#d84315');
    });

    it('should return green for TLP:GREEN', () => {
      expect(getMarkingColor('TLP:GREEN')).toBe('#2e7d32');
    });

    it('should return white for TLP:CLEAR in dark mode', () => {
      expect(getMarkingColor('TLP:CLEAR', 'dark')).toBe('#ffffff');
    });

    it('should return dark color for TLP:CLEAR in light mode', () => {
      expect(getMarkingColor('TLP:CLEAR', 'light')).toBe('#2b2b2b');
    });

    it('should return white for TLP:WHITE in dark mode', () => {
      expect(getMarkingColor('TLP:WHITE', 'dark')).toBe('#ffffff');
    });

    it('should return dark color for TLP:WHITE in light mode', () => {
      expect(getMarkingColor('TLP:WHITE', 'light')).toBe('#2b2b2b');
    });
  });

  describe('PAP markings', () => {
    it('should return red for PAP:RED', () => {
      expect(getMarkingColor('PAP:RED')).toBe('#c62828');
    });

    it('should return orange for PAP:AMBER', () => {
      expect(getMarkingColor('PAP:AMBER')).toBe('#d84315');
    });

    it('should return green for PAP:GREEN', () => {
      expect(getMarkingColor('PAP:GREEN')).toBe('#2e7d32');
    });

    it('should return white for PAP:CLEAR in dark mode', () => {
      expect(getMarkingColor('PAP:CLEAR', 'dark')).toBe('#ffffff');
    });

    it('should return dark color for PAP:CLEAR in light mode', () => {
      expect(getMarkingColor('PAP:CLEAR', 'light')).toBe('#2b2b2b');
    });
  });

  describe('Classification markings', () => {
    it('should return red for CD', () => {
      expect(getMarkingColor('CD')).toBe('#c62828');
    });

    it('should return red for CD-SF', () => {
      expect(getMarkingColor('CD-SF')).toBe('#c62828');
    });

    it('should return red for DR', () => {
      expect(getMarkingColor('DR')).toBe('#c62828');
    });

    it('should return red for DR-SF', () => {
      expect(getMarkingColor('DR-SF')).toBe('#c62828');
    });

    it('should return green for NP', () => {
      expect(getMarkingColor('NP')).toBe('#2e7d32');
    });

    it('should return blue for SF', () => {
      expect(getMarkingColor('SF')).toBe('#283593');
    });
  });

  describe('Edge cases', () => {
    it('should return white for undefined definition', () => {
      expect(getMarkingColor(undefined)).toBe('#ffffff');
    });

    it('should return white for unknown marking', () => {
      expect(getMarkingColor('UNKNOWN')).toBe('#ffffff');
    });

    it('should return white for empty string', () => {
      expect(getMarkingColor('')).toBe('#ffffff');
    });

    it('should default to dark mode', () => {
      expect(getMarkingColor('TLP:CLEAR')).toBe('#ffffff');
    });
  });
});

// ============================================================================
// getMarkingChipStyle Tests
// ============================================================================

describe('getMarkingChipStyle', () => {
  describe('Red markings', () => {
    it('should return correct style for TLP:RED', () => {
      const style = getMarkingChipStyle('TLP:RED');
      expect(style).toEqual({
        bgcolor: '#c62828',
        color: '#ffffff',
        fontWeight: 600,
      });
    });

    it('should return correct style for PAP:RED', () => {
      const style = getMarkingChipStyle('PAP:RED');
      expect(style).toEqual({
        bgcolor: '#c62828',
        color: '#ffffff',
        fontWeight: 600,
      });
    });
  });

  describe('Amber markings', () => {
    it('should return correct style for TLP:AMBER', () => {
      const style = getMarkingChipStyle('TLP:AMBER');
      expect(style).toEqual({
        bgcolor: '#d84315',
        color: '#ffffff',
        fontWeight: 600,
      });
    });

    it('should return correct style for TLP:AMBER+STRICT', () => {
      const style = getMarkingChipStyle('TLP:AMBER+STRICT');
      expect(style).toEqual({
        bgcolor: '#d84315',
        color: '#ffffff',
        fontWeight: 600,
      });
    });
  });

  describe('Green markings', () => {
    it('should return correct style for TLP:GREEN', () => {
      const style = getMarkingChipStyle('TLP:GREEN');
      expect(style).toEqual({
        bgcolor: '#2e7d32',
        color: '#ffffff',
        fontWeight: 600,
      });
    });

    it('should return correct style for PAP:GREEN', () => {
      const style = getMarkingChipStyle('PAP:GREEN');
      expect(style).toEqual({
        bgcolor: '#2e7d32',
        color: '#ffffff',
        fontWeight: 600,
      });
    });
  });

  describe('Clear/White markings - dark mode', () => {
    it('should return white background with black text for TLP:CLEAR in dark mode', () => {
      const style = getMarkingChipStyle('TLP:CLEAR', 'dark');
      expect(style).toEqual({
        bgcolor: '#ffffff',
        color: '#000000',
        fontWeight: 600,
      });
    });

    it('should return white background with black text for TLP:WHITE in dark mode', () => {
      const style = getMarkingChipStyle('TLP:WHITE', 'dark');
      expect(style).toEqual({
        bgcolor: '#ffffff',
        color: '#000000',
        fontWeight: 600,
      });
    });

    it('should return white background with black text for PAP:CLEAR in dark mode', () => {
      const style = getMarkingChipStyle('PAP:CLEAR', 'dark');
      expect(style).toEqual({
        bgcolor: '#ffffff',
        color: '#000000',
        fontWeight: 600,
      });
    });
  });

  describe('Clear/White markings - light mode', () => {
    it('should return dark background with white text for TLP:CLEAR in light mode', () => {
      const style = getMarkingChipStyle('TLP:CLEAR', 'light');
      expect(style).toEqual({
        bgcolor: '#2b2b2b',
        color: '#ffffff',
        fontWeight: 600,
      });
    });

    it('should return dark background with white text for TLP:WHITE in light mode', () => {
      const style = getMarkingChipStyle('TLP:WHITE', 'light');
      expect(style).toEqual({
        bgcolor: '#2b2b2b',
        color: '#ffffff',
        fontWeight: 600,
      });
    });
  });

  describe('Default mode', () => {
    it('should default to dark mode', () => {
      const style = getMarkingChipStyle('TLP:CLEAR');
      expect(style.bgcolor).toBe('#ffffff');
      expect(style.color).toBe('#000000');
    });
  });

  describe('Unknown markings', () => {
    it('should return white background for undefined', () => {
      const style = getMarkingChipStyle(undefined);
      expect(style).toEqual({
        bgcolor: '#ffffff',
        color: '#ffffff',
        fontWeight: 600,
      });
    });

    it('should return white background for unknown marking', () => {
      const style = getMarkingChipStyle('UNKNOWN');
      expect(style).toEqual({
        bgcolor: '#ffffff',
        color: '#ffffff',
        fontWeight: 600,
      });
    });
  });

  describe('Font weight', () => {
    it('should always have fontWeight of 600', () => {
      expect(getMarkingChipStyle('TLP:RED').fontWeight).toBe(600);
      expect(getMarkingChipStyle('TLP:AMBER').fontWeight).toBe(600);
      expect(getMarkingChipStyle('TLP:GREEN').fontWeight).toBe(600);
      expect(getMarkingChipStyle('TLP:CLEAR').fontWeight).toBe(600);
      expect(getMarkingChipStyle(undefined).fontWeight).toBe(600);
    });
  });
});

