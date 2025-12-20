/**
 * Graph Layout Algorithm
 * 
 * Force-directed layout algorithm for positioning graph nodes.
 * Shared between DOM-based and React-based graph visualizations.
 */

import type { GraphNode, GraphEdge, Point, ControlPoints } from './graph-types';

/**
 * Layout configuration options
 */
export interface LayoutConfig {
  /** Number of force simulation iterations */
  iterations?: number;
  /** Repulsion force between nodes */
  repulsion?: number;
  /** Attraction force along edges */
  attraction?: number;
  /** Padding from container edges */
  padding?: number;
}

const DEFAULT_CONFIG: Required<LayoutConfig> = {
  iterations: 50,
  repulsion: 1000,
  attraction: 0.05,
  padding: 30,
};

/**
 * Calculate force-directed layout positions for nodes
 * 
 * @param nodes - Array of graph nodes to position
 * @param edges - Array of edges connecting nodes
 * @param width - Container width
 * @param height - Container height
 * @param config - Optional layout configuration
 * @returns Nodes with updated x/y positions
 */
export function calculateLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  config?: LayoutConfig
): GraphNode[] {
  const result = nodes.map(n => ({ ...n }));
  const nodeCount = result.length;
  
  if (nodeCount === 0) return result;
  
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;
  
  // Initial circular placement
  result.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
    node.x = centerX + radius * Math.cos(angle);
    node.y = centerY + radius * Math.sin(angle);
  });
  
  // Force-directed simulation
  for (let iter = 0; iter < cfg.iterations; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dx = result[j].x - result[i].x;
        const dy = result[j].y - result[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = cfg.repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        result[i].x -= fx;
        result[i].y -= fy;
        result[j].x += fx;
        result[j].y += fy;
      }
    }
    
    // Attraction along edges
    for (const edge of edges) {
      const fromNode = result.find(n => n.value.toLowerCase() === edge.from.toLowerCase());
      const toNode = result.find(n => n.value.toLowerCase() === edge.to.toLowerCase());
      
      if (fromNode && toNode) {
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * cfg.attraction;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        fromNode.x += fx;
        fromNode.y += fy;
        toNode.x -= fx;
        toNode.y -= fy;
      }
    }
    
    // Keep nodes within bounds
    for (const node of result) {
      node.x = Math.max(cfg.padding, Math.min(width - cfg.padding, node.x));
      node.y = Math.max(cfg.padding, Math.min(height - cfg.padding, node.y));
    }
  }
  
  return result;
}

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

/**
 * Get the center point of an element
 * 
 * @param rect - Element bounding rectangle
 * @returns Center point
 */
export function getElementCenter(rect: { left: number; top: number; width: number; height: number }): Point {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

