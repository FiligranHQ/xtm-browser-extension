/**
 * Graph Layout Utilities
 * 
 * Helper functions for calculating bezier curves and positions
 * for relationship line visualizations.
 */

import type { Point, ControlPoints } from './graph-types';

/**
 * Calculate control points for a smooth bezier curve between two points
 * 
 * @param start - Starting point
 * @param end - Ending point
 * @param index - Index for alternating curve direction
 * @param curveOffset - Base curve offset (default: 40)
 * @returns Control points for quadratic bezier
 */
export function calculateCurveControlPoints(
  start: Point,
  end: Point,
  index: number,
  curveOffset = 40
): ControlPoints {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < 20) {
    // Too close, return midpoint
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return { cp1: mid, cp2: mid };
  }
  
  // Perpendicular direction for curve offset
  const perpX = -dy / distance;
  const perpY = dx / distance;
  
  // Vary curve based on index and distance
  const curveMultiplier = Math.min(distance * 0.3, curveOffset);
  const offset = curveMultiplier * (1 + (index % 3) * 0.3);
  const sign = index % 2 === 0 ? 1 : -1;
  
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  
  // Control points offset perpendicular to the line
  const cp = {
    x: midX + perpX * offset * sign,
    y: midY + perpY * offset * sign,
  };
  
  return { cp1: cp, cp2: cp };
}

/**
 * Calculate the angle for a label on a bezier curve
 * Ensures text is always readable (not upside down)
 * 
 * @param start - Starting point
 * @param end - Ending point
 * @returns Rotation angle in degrees
 */
export function calculateLabelRotation(start: Point, end: Point): number {
  const tangentX = end.x - start.x;
  const tangentY = end.y - start.y;
  
  let angle = Math.atan2(tangentY, tangentX) * (180 / Math.PI);
  
  // Keep text readable (not upside down)
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  
  return angle;
}

/**
 * Calculate a point on a quadratic bezier curve
 * 
 * @param start - Starting point
 * @param control - Control point
 * @param end - Ending point
 * @param t - Parameter (0 to 1)
 * @returns Point on the curve
 */
export function getPointOnBezier(start: Point, control: Point, end: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
    y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
  };
}
