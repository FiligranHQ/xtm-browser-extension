/**
 * Graph Types
 * 
 * Shared type definitions for graph visualizations.
 * Used by relationship minimaps and graph components.
 */

/**
 * A node in the graph visualization
 */
export interface GraphNode {
  /** Unique identifier (usually lowercase value) */
  id: string;
  /** Display value */
  value: string;
  /** Entity type */
  type: string;
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Node color */
  color: string;
}

/**
 * An edge in the graph visualization
 */
export interface GraphEdge {
  /** Source node value */
  from: string;
  /** Target node value */
  to: string;
  /** Relationship type label */
  type: string;
}

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
 * Entity data for graph visualization
 */
export interface EntityData {
  /** Entity value/name */
  value: string;
  /** Entity type */
  type: string;
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

