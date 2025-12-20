/**
 * Line Geometry Utilities
 * 
 * Pure calculation functions for relationship line drawing.
 * Shared between content script (vanilla DOM) and PDF viewer (React).
 */

import type { Point } from './graph-types';
import { LABEL_STYLES } from './relationship-styles';

// ============================================================================
// Constants
// ============================================================================

/** Minimum distance between points to draw a line */
export const MIN_LINE_DISTANCE = 20;

/** Factor to adjust endpoints toward highlight edges (0-1) */
export const ENDPOINT_ADJUSTMENT_FACTOR = 0.8;

// ============================================================================
// Geometry Calculations
// ============================================================================

/**
 * Calculate the distance between two points
 */
export function calculateDistance(start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate unit vector from start to end
 */
export function calculateUnitVector(start: Point, end: Point): Point {
  const distance = calculateDistance(start, end);
  if (distance === 0) return { x: 0, y: 0 };
  return {
    x: (end.x - start.x) / distance,
    y: (end.y - start.y) / distance,
  };
}

/**
 * Adjust line endpoints to start/end at the edge of highlights
 * rather than at their centers
 */
export function adjustEndpoints(
  start: Point,
  end: Point,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number
): { adjustedStart: Point; adjustedEnd: Point } | null {
  const distance = calculateDistance(start, end);
  
  if (distance < MIN_LINE_DISTANCE) {
    return null; // Too close, skip drawing
  }
  
  const unit = calculateUnitVector(start, end);
  
  return {
    adjustedStart: {
      x: start.x + (fromWidth / 2) * unit.x * ENDPOINT_ADJUSTMENT_FACTOR,
      y: start.y + (fromHeight / 2) * unit.y * ENDPOINT_ADJUSTMENT_FACTOR,
    },
    adjustedEnd: {
      x: end.x - (toWidth / 2) * unit.x * ENDPOINT_ADJUSTMENT_FACTOR,
      y: end.y - (toHeight / 2) * unit.y * ENDPOINT_ADJUSTMENT_FACTOR,
    },
  };
}

// ============================================================================
// Label Calculations
// ============================================================================

/**
 * Calculate label dimensions based on text content
 */
export function calculateLabelDimensions(labelText: string): { width: number; height: number } {
  return {
    width: labelText.length * (LABEL_STYLES.fontSize * 0.6) + LABEL_STYLES.padding * 2,
    height: LABEL_STYLES.fontSize + LABEL_STYLES.padding * 2,
  };
}

// ============================================================================
// SVG Path Generation
// ============================================================================

/**
 * Generate a quadratic bezier curve path string
 */
export function generateCurvePath(start: Point, control: Point, end: Point): string {
  return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
}

