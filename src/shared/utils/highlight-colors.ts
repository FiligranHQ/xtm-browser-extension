/**
 * Highlight Color Utilities
 * 
 * Shared utility for determining highlight colors based on entity state.
 * Used by both web page highlighting (content script) and PDF viewer highlighting.
 */

import {
  HIGHLIGHT_FOUND,
  HIGHLIGHT_NOT_FOUND,
  HIGHLIGHT_AI_DISCOVERED,
} from '../constants';

/**
 * Entity state for highlight color determination
 */
export interface EntityHighlightState {
  /** Whether the entity was found in any platform */
  found: boolean;
  /** Whether the entity was discovered by AI */
  discoveredByAI?: boolean;
  /** Whether the entity is currently selected */
  isSelected?: boolean;
  /** Whether the entity is being hovered */
  isHovered?: boolean;
}

/**
 * Result of highlight color calculation
 */
export interface HighlightColors {
  /** Background color (with alpha) */
  background: string;
  /** Outline/border color */
  outline: string;
}

/**
 * Get highlight colors based on entity state
 * Centralized logic for consistent highlighting across web pages and PDFs
 * 
 * Color scheme:
 * - Green: Entity found in platform
 * - Orange/Amber: Entity not found (can be added)
 * - Purple: AI-discovered entity
 * - Selection adds hover effect (darker background)
 */
export function getHighlightColors(state: EntityHighlightState): HighlightColors {
  const { found, discoveredByAI, isSelected, isHovered } = state;
  const useHover = isSelected || isHovered;
  
  if (discoveredByAI) {
    return {
      background: useHover ? HIGHLIGHT_AI_DISCOVERED.backgroundHover : HIGHLIGHT_AI_DISCOVERED.background,
      outline: useHover ? HIGHLIGHT_AI_DISCOVERED.outlineHover : HIGHLIGHT_AI_DISCOVERED.outline,
    };
  }
  
  if (found) {
    return {
      background: useHover ? HIGHLIGHT_FOUND.backgroundHover : HIGHLIGHT_FOUND.background,
      outline: useHover ? HIGHLIGHT_FOUND.outlineHover : HIGHLIGHT_FOUND.outline,
    };
  }
  
  // Not found
  return {
    background: useHover ? HIGHLIGHT_NOT_FOUND.backgroundHover : HIGHLIGHT_NOT_FOUND.background,
    outline: useHover ? HIGHLIGHT_NOT_FOUND.outlineHover : HIGHLIGHT_NOT_FOUND.outline,
  };
}

/**
 * Get icon color for entity status indicator
 * Used for drawing status icons (checkmark, info, sparkle)
 */
export function getStatusIconColor(state: { found: boolean; discoveredByAI?: boolean }): string {
  if (state.discoveredByAI) {
    return HIGHLIGHT_AI_DISCOVERED.outline;
  }
  if (state.found) {
    return HIGHLIGHT_FOUND.outline;
  }
  return HIGHLIGHT_NOT_FOUND.outline;
}
