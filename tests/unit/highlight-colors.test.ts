/**
 * Unit Tests for Highlight Color Utilities
 * 
 * Tests color determination for entity highlighting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the constants before importing the module
vi.mock('../../src/shared/constants', () => ({
  HIGHLIGHT_FOUND: {
    background: 'rgba(76, 175, 80, 0.3)',
    backgroundHover: 'rgba(76, 175, 80, 0.5)',
    outline: '#4CAF50',
    outlineHover: '#388E3C',
  },
  HIGHLIGHT_NOT_FOUND: {
    background: 'rgba(255, 152, 0, 0.3)',
    backgroundHover: 'rgba(255, 152, 0, 0.5)',
    outline: '#FF9800',
    outlineHover: '#F57C00',
  },
  HIGHLIGHT_AI_DISCOVERED: {
    background: 'rgba(156, 39, 176, 0.3)',
    backgroundHover: 'rgba(156, 39, 176, 0.5)',
    outline: '#9C27B0',
    outlineHover: '#7B1FA2',
  },
}));

import {
  getHighlightColors,
  getStatusIconColor,
  type EntityHighlightState,
} from '../../src/shared/utils/highlight-colors';

// ============================================================================
// Highlight Colors Tests
// ============================================================================

describe('Highlight Colors', () => {
  describe('getHighlightColors', () => {
    it('should return found colors for found entities', () => {
      const state: EntityHighlightState = { found: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe('rgba(76, 175, 80, 0.3)');
      expect(colors.outline).toBe('#4CAF50');
    });

    it('should return not-found colors for entities not found', () => {
      const state: EntityHighlightState = { found: false };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe('rgba(255, 152, 0, 0.3)');
      expect(colors.outline).toBe('#FF9800');
    });

    it('should return AI colors for AI-discovered entities', () => {
      const state: EntityHighlightState = { found: false, discoveredByAI: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe('rgba(156, 39, 176, 0.3)');
      expect(colors.outline).toBe('#9C27B0');
    });

    it('should prioritize AI-discovered over found status', () => {
      const state: EntityHighlightState = { found: true, discoveredByAI: true };
      const colors = getHighlightColors(state);
      
      // AI discovered takes precedence
      expect(colors.background).toBe('rgba(156, 39, 176, 0.3)');
    });

    it('should use hover colors when selected', () => {
      const state: EntityHighlightState = { found: true, isSelected: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe('rgba(76, 175, 80, 0.5)');
      expect(colors.outline).toBe('#388E3C');
    });

    it('should use hover colors when hovered', () => {
      const state: EntityHighlightState = { found: false, isHovered: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe('rgba(255, 152, 0, 0.5)');
      expect(colors.outline).toBe('#F57C00');
    });

    it('should use hover colors for AI entities when selected', () => {
      const state: EntityHighlightState = { found: false, discoveredByAI: true, isSelected: true };
      const colors = getHighlightColors(state);
      
      expect(colors.background).toBe('rgba(156, 39, 176, 0.5)');
      expect(colors.outline).toBe('#7B1FA2');
    });

    it('should handle both selected and hovered', () => {
      const state: EntityHighlightState = { found: true, isSelected: true, isHovered: true };
      const colors = getHighlightColors(state);
      
      // Both trigger hover state
      expect(colors.background).toBe('rgba(76, 175, 80, 0.5)');
    });
  });
});

// ============================================================================
// Status Icon Color Tests
// ============================================================================

describe('Status Icon Colors', () => {
  describe('getStatusIconColor', () => {
    it('should return found color for found entities', () => {
      const color = getStatusIconColor({ found: true });
      expect(color).toBe('#4CAF50');
    });

    it('should return not-found color for entities not found', () => {
      const color = getStatusIconColor({ found: false });
      expect(color).toBe('#FF9800');
    });

    it('should return AI color for AI-discovered entities', () => {
      const color = getStatusIconColor({ found: false, discoveredByAI: true });
      expect(color).toBe('#9C27B0');
    });

    it('should prioritize AI-discovered over found status', () => {
      const color = getStatusIconColor({ found: true, discoveredByAI: true });
      expect(color).toBe('#9C27B0');
    });
  });
});
