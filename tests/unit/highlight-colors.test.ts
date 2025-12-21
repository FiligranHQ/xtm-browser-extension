/**
 * Unit Tests for Highlight Color Utilities
 * 
 * Tests the highlight color determination logic used across web pages and PDFs.
 */

import { describe, it, expect } from 'vitest';
import {
  getHighlightColors,
  getStatusIconColor,
  type EntityHighlightState,
  type HighlightColors,
} from '../../src/shared/utils/highlight-colors';
import {
  HIGHLIGHT_FOUND,
  HIGHLIGHT_NOT_FOUND,
  HIGHLIGHT_AI_DISCOVERED,
} from '../../src/shared/constants';

// ============================================================================
// getHighlightColors Tests
// ============================================================================

describe('getHighlightColors', () => {
  describe('AI-discovered entities', () => {
    it('should return AI discovered colors when discoveredByAI is true', () => {
      const state: EntityHighlightState = { found: false, discoveredByAI: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_AI_DISCOVERED.background);
      expect(colors.outline).toBe(HIGHLIGHT_AI_DISCOVERED.outline);
    });

    it('should return AI discovered hover colors when selected', () => {
      const state: EntityHighlightState = { found: false, discoveredByAI: true, isSelected: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_AI_DISCOVERED.backgroundHover);
      expect(colors.outline).toBe(HIGHLIGHT_AI_DISCOVERED.outlineHover);
    });

    it('should return AI discovered hover colors when hovered', () => {
      const state: EntityHighlightState = { found: false, discoveredByAI: true, isHovered: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_AI_DISCOVERED.backgroundHover);
      expect(colors.outline).toBe(HIGHLIGHT_AI_DISCOVERED.outlineHover);
    });

    it('should prioritize AI discovered over found status', () => {
      const state: EntityHighlightState = { found: true, discoveredByAI: true };
      const colors = getHighlightColors(state);
      
      // AI discovered takes precedence
      expect(colors.background).toBe(HIGHLIGHT_AI_DISCOVERED.background);
      expect(colors.outline).toBe(HIGHLIGHT_AI_DISCOVERED.outline);
    });
  });

  describe('Found entities', () => {
    it('should return found colors when found is true', () => {
      const state: EntityHighlightState = { found: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_FOUND.background);
      expect(colors.outline).toBe(HIGHLIGHT_FOUND.outline);
    });

    it('should return found hover colors when selected', () => {
      const state: EntityHighlightState = { found: true, isSelected: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_FOUND.backgroundHover);
      expect(colors.outline).toBe(HIGHLIGHT_FOUND.outlineHover);
    });

    it('should return found hover colors when hovered', () => {
      const state: EntityHighlightState = { found: true, isHovered: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_FOUND.backgroundHover);
      expect(colors.outline).toBe(HIGHLIGHT_FOUND.outlineHover);
    });

    it('should return found hover colors when both selected and hovered', () => {
      const state: EntityHighlightState = { found: true, isSelected: true, isHovered: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_FOUND.backgroundHover);
      expect(colors.outline).toBe(HIGHLIGHT_FOUND.outlineHover);
    });
  });

  describe('Not found entities', () => {
    it('should return not found colors when found is false', () => {
      const state: EntityHighlightState = { found: false };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_NOT_FOUND.background);
      expect(colors.outline).toBe(HIGHLIGHT_NOT_FOUND.outline);
    });

    it('should return not found hover colors when selected', () => {
      const state: EntityHighlightState = { found: false, isSelected: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_NOT_FOUND.backgroundHover);
      expect(colors.outline).toBe(HIGHLIGHT_NOT_FOUND.outlineHover);
    });

    it('should return not found hover colors when hovered', () => {
      const state: EntityHighlightState = { found: false, isHovered: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_NOT_FOUND.backgroundHover);
      expect(colors.outline).toBe(HIGHLIGHT_NOT_FOUND.outlineHover);
    });
  });

  describe('Edge cases', () => {
    it('should handle state with all false values', () => {
      const state: EntityHighlightState = { 
        found: false, 
        discoveredByAI: false, 
        isSelected: false, 
        isHovered: false 
      };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_NOT_FOUND.background);
      expect(colors.outline).toBe(HIGHLIGHT_NOT_FOUND.outline);
    });

    it('should handle minimal state with only found property', () => {
      const stateFound: EntityHighlightState = { found: true };
      const stateNotFound: EntityHighlightState = { found: false };
      
      expect(getHighlightColors(stateFound).background).toBe(HIGHLIGHT_FOUND.background);
      expect(getHighlightColors(stateNotFound).background).toBe(HIGHLIGHT_NOT_FOUND.background);
    });

    it('should handle undefined optional properties', () => {
      const state: EntityHighlightState = { 
        found: true, 
        discoveredByAI: undefined, 
        isSelected: undefined, 
        isHovered: undefined 
      };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe(HIGHLIGHT_FOUND.background);
      expect(colors.outline).toBe(HIGHLIGHT_FOUND.outline);
    });
  });

  describe('Return type', () => {
    it('should return object with background and outline properties', () => {
      const state: EntityHighlightState = { found: true };
      const colors: HighlightColors = getHighlightColors(state);
      
      expect(colors).toHaveProperty('background');
      expect(colors).toHaveProperty('outline');
      expect(typeof colors.background).toBe('string');
      expect(typeof colors.outline).toBe('string');
    });
  });
});

// ============================================================================
// getStatusIconColor Tests
// ============================================================================

describe('getStatusIconColor', () => {
  describe('AI-discovered entities', () => {
    it('should return AI discovered outline color when discoveredByAI is true', () => {
      const state = { found: false, discoveredByAI: true };
      const color = getStatusIconColor(state);
      
      expect(color).toBe(HIGHLIGHT_AI_DISCOVERED.outline);
    });

    it('should prioritize AI discovered over found status', () => {
      const state = { found: true, discoveredByAI: true };
      const color = getStatusIconColor(state);
      
      expect(color).toBe(HIGHLIGHT_AI_DISCOVERED.outline);
    });
  });

  describe('Found entities', () => {
    it('should return found outline color when found is true', () => {
      const state = { found: true };
      const color = getStatusIconColor(state);
      
      expect(color).toBe(HIGHLIGHT_FOUND.outline);
    });

    it('should return found outline color when found is true and discoveredByAI is false', () => {
      const state = { found: true, discoveredByAI: false };
      const color = getStatusIconColor(state);
      
      expect(color).toBe(HIGHLIGHT_FOUND.outline);
    });
  });

  describe('Not found entities', () => {
    it('should return not found outline color when found is false', () => {
      const state = { found: false };
      const color = getStatusIconColor(state);
      
      expect(color).toBe(HIGHLIGHT_NOT_FOUND.outline);
    });

    it('should return not found outline color when found is false and discoveredByAI is false', () => {
      const state = { found: false, discoveredByAI: false };
      const color = getStatusIconColor(state);
      
      expect(color).toBe(HIGHLIGHT_NOT_FOUND.outline);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined discoveredByAI', () => {
      const stateFound = { found: true, discoveredByAI: undefined };
      const stateNotFound = { found: false, discoveredByAI: undefined };
      
      expect(getStatusIconColor(stateFound)).toBe(HIGHLIGHT_FOUND.outline);
      expect(getStatusIconColor(stateNotFound)).toBe(HIGHLIGHT_NOT_FOUND.outline);
    });

    it('should return string color value', () => {
      const state = { found: true };
      const color = getStatusIconColor(state);
      
      expect(typeof color).toBe('string');
      // Should be a valid CSS color (starts with # for hex or is a named color)
      expect(color.length).toBeGreaterThan(0);
    });
  });
});

