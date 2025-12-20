/**
 * Graph Types
 * 
 * Shared type definitions for relationship line visualizations.
 */

/**
 * Relationship data from AI analysis
 */
export interface RelationshipData {
  /** Source entity value */
  fromValue: string;
  /** Target entity value */
  toValue: string;
  /** Type of relationship */
  relationshipType: string;
  /** Confidence level */
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * Highlight position for relationship line connections
 */
export interface HighlightPosition {
  /** Entity value */
  entityValue: string;
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Width of highlight */
  width: number;
  /** Height of highlight */
  height: number;
}

/**
 * Point coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Control points for bezier curves
 */
export interface ControlPoints {
  cp1: Point;
  cp2: Point;
}
