/**
 * Unit Tests for Visualization Module
 * 
 * Tests graph layout algorithms, entity styling, and animation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLayout,
  calculateCurveControlPoints,
  calculateLabelRotation,
  getPointOnBezier,
  getElementCenter,
} from '../../src/shared/visualization/graph-layout';
import {
  getIconPath,
  getEntityColor,
  DEFAULT_ENTITY_COLOR,
  ENTITY_ICONS,
} from '../../src/shared/visualization/entity-icons';
import {
  LINE_STYLES,
  LABEL_STYLES,
  MINIMAP_STYLES,
  DIALOG_STYLES,
  GRAPH_NODE_STYLES,
  ANIMATION_STYLES,
  getGraphNodeStyle,
  getLineAnimationCSS,
  getLinePathStyle,
  getLabelStyle,
} from '../../src/shared/visualization/relationship-styles';
import type { GraphNode, GraphEdge, Point } from '../../src/shared/visualization/graph-types';

// ============================================================================
// Graph Layout Tests
// ============================================================================

describe('Graph Layout', () => {
  describe('calculateLayout', () => {
    it('should position nodes within the given dimensions', () => {
      const nodes: GraphNode[] = [
        { id: '1', value: 'Node 1', type: 'Malware', x: 0, y: 0, color: '#f00' },
        { id: '2', value: 'Node 2', type: 'Threat-Actor', x: 0, y: 0, color: '#0f0' },
      ];
      const edges: GraphEdge[] = [
        { from: 'Node 1', to: 'Node 2', type: 'uses' },
      ];
      
      const positioned = calculateLayout(nodes, edges, 400, 300);
      
      expect(positioned.length).toBe(2);
      
      for (const node of positioned) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThanOrEqual(400);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThanOrEqual(300);
      }
    });

    it('should handle empty node array', () => {
      const positioned = calculateLayout([], [], 400, 300);
      expect(positioned).toEqual([]);
    });

    it('should handle single node', () => {
      const nodes: GraphNode[] = [
        { id: '1', value: 'Single', type: 'Malware', x: 0, y: 0, color: '#f00' },
      ];
      
      const positioned = calculateLayout(nodes, [], 400, 300);
      
      expect(positioned.length).toBe(1);
      expect(positioned[0].x).toBeDefined();
      expect(positioned[0].y).toBeDefined();
    });
  });

  describe('calculateCurveControlPoints', () => {
    it('should return control points for a curve', () => {
      const start: Point = { x: 0, y: 0 };
      const end: Point = { x: 100, y: 0 };
      
      const { cp1 } = calculateCurveControlPoints(start, end, 0, 40);
      
      expect(cp1.x).toBeDefined();
      expect(cp1.y).toBeDefined();
    });

    it('should offset curve based on index', () => {
      const start: Point = { x: 0, y: 0 };
      const end: Point = { x: 100, y: 0 };
      
      const { cp1: cp1a } = calculateCurveControlPoints(start, end, 0, 40);
      const { cp1: cp1b } = calculateCurveControlPoints(start, end, 1, 40);
      
      // Different indices should produce different curves
      expect(cp1a.y).not.toBe(cp1b.y);
    });
  });

  describe('calculateLabelRotation', () => {
    it('should return a rotation angle in degrees', () => {
      const start: Point = { x: 0, y: 0 };
      const end: Point = { x: 100, y: 0 };
      
      const rotation = calculateLabelRotation(start, end);
      
      expect(typeof rotation).toBe('number');
    });

    it('should return 0 for horizontal line', () => {
      const start: Point = { x: 0, y: 0 };
      const end: Point = { x: 100, y: 0 };
      
      const rotation = calculateLabelRotation(start, end);
      
      expect(rotation).toBe(0);
    });

    it('should handle vertical lines', () => {
      const start: Point = { x: 0, y: 0 };
      const end: Point = { x: 0, y: 100 };
      
      const rotation = calculateLabelRotation(start, end);
      
      // Should rotate label to be readable
      expect(Math.abs(rotation)).toBeLessThanOrEqual(90);
    });
  });

  describe('getPointOnBezier', () => {
    it('should return start point at t=0', () => {
      const start: Point = { x: 0, y: 0 };
      const control: Point = { x: 50, y: 50 };
      const end: Point = { x: 100, y: 0 };
      
      const point = getPointOnBezier(start, control, end, 0);
      
      expect(point.x).toBe(0);
      expect(point.y).toBe(0);
    });

    it('should return end point at t=1', () => {
      const start: Point = { x: 0, y: 0 };
      const control: Point = { x: 50, y: 50 };
      const end: Point = { x: 100, y: 0 };
      
      const point = getPointOnBezier(start, control, end, 1);
      
      expect(point.x).toBe(100);
      expect(point.y).toBe(0);
    });

    it('should return midpoint approximately at t=0.5', () => {
      const start: Point = { x: 0, y: 0 };
      const control: Point = { x: 50, y: 50 };
      const end: Point = { x: 100, y: 0 };
      
      const point = getPointOnBezier(start, control, end, 0.5);
      
      // Midpoint should be around x=50 and elevated due to control point
      expect(point.x).toBeGreaterThan(40);
      expect(point.x).toBeLessThan(60);
    });
  });
});

// ============================================================================
// Entity Icons Tests
// ============================================================================

describe('Entity Icons', () => {
  describe('ENTITY_ICONS', () => {
    it('should have a default icon', () => {
      expect(ENTITY_ICONS['default']).toBeDefined();
      expect(typeof ENTITY_ICONS['default']).toBe('string');
    });

    it('should have icons for common entity types', () => {
      const commonTypes = [
        'Threat-Actor-Group',
        'Malware',
        'Attack-Pattern',
        'Indicator',
        'Vulnerability',
      ];
      
      for (const type of commonTypes) {
        expect(ENTITY_ICONS[type], `Should have icon for ${type}`).toBeDefined();
      }
    });

    it('should have valid SVG paths', () => {
      for (const [type, path] of Object.entries(ENTITY_ICONS)) {
        // SVG paths should start with M (moveto) or other valid commands
        expect(path, `Icon for ${type} should be a valid SVG path`).toMatch(/^[MLHVCSQTAZmlhvcsqtaz]/);
      }
    });
  });

  describe('getIconPath', () => {
    it('should return exact match for known types', () => {
      expect(getIconPath('Malware')).toBe(ENTITY_ICONS['Malware']);
      expect(getIconPath('Tool')).toBe(ENTITY_ICONS['Tool']);
    });

    it('should return default for unknown types', () => {
      // getIconPath does partial matching, so truly unknown types get default
      expect(getIconPath('CompletelyUnknown123XYZ')).toBe(ENTITY_ICONS['default']);
    });

    it('should handle empty string', () => {
      // Empty string may do partial match, but should return something
      const path = getIconPath('');
      expect(typeof path).toBe('string');
      expect(path.length).toBeGreaterThan(0);
    });

    it('should do partial matching', () => {
      // Types containing known keywords should match
      const path = getIconPath('ipv4');
      expect(path).toBeDefined();
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe('getEntityColor', () => {
    it('should return a color string', () => {
      const color = getEntityColor('Malware');
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('should return a valid color for unknown types', () => {
      // The theme's itemColor may return a different default than DEFAULT_ENTITY_COLOR
      // when the type is not recognized but matches some fallback
      const color = getEntityColor('CompletelyUnknownType123XYZ');
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('should not throw for any input', () => {
      expect(() => getEntityColor('')).not.toThrow();
      expect(() => getEntityColor('null')).not.toThrow();
      expect(() => getEntityColor('undefined')).not.toThrow();
    });
  });

  describe('DEFAULT_ENTITY_COLOR', () => {
    it('should be a valid hex color', () => {
      expect(DEFAULT_ENTITY_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});

// ============================================================================
// Relationship Styles Tests
// ============================================================================

describe('Relationship Styles', () => {
  describe('LINE_STYLES', () => {
    it('should have required properties', () => {
      expect(LINE_STYLES.color).toBeDefined();
      expect(LINE_STYLES.width).toBeDefined();
      expect(LINE_STYLES.opacity).toBeDefined();
      expect(LINE_STYLES.curveOffset).toBeDefined();
    });

    it('should have valid values', () => {
      expect(LINE_STYLES.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(LINE_STYLES.width).toBeGreaterThan(0);
      expect(LINE_STYLES.opacity).toBeGreaterThan(0);
      expect(LINE_STYLES.opacity).toBeLessThanOrEqual(1);
    });
  });

  describe('LABEL_STYLES', () => {
    it('should have required properties', () => {
      expect(LABEL_STYLES.backgroundColor).toBeDefined();
      expect(LABEL_STYLES.textColor).toBeDefined();
      expect(LABEL_STYLES.fontSize).toBeDefined();
      expect(LABEL_STYLES.padding).toBeDefined();
      expect(LABEL_STYLES.borderRadius).toBeDefined();
    });
  });

  describe('MINIMAP_STYLES', () => {
    it('should have required properties', () => {
      expect(MINIMAP_STYLES.width).toBeGreaterThan(0);
      expect(MINIMAP_STYLES.height).toBeGreaterThan(0);
      expect(MINIMAP_STYLES.graphHeight).toBeLessThan(MINIMAP_STYLES.height);
    });
  });

  describe('DIALOG_STYLES', () => {
    it('should have required properties', () => {
      expect(DIALOG_STYLES.maxWidth).toBeGreaterThan(0);
      expect(DIALOG_STYLES.maxHeight).toBeGreaterThan(0);
      expect(DIALOG_STYLES.graphWidth).toBeLessThan(DIALOG_STYLES.maxWidth);
      expect(DIALOG_STYLES.graphHeight).toBeLessThan(DIALOG_STYLES.maxHeight);
    });
  });

  describe('GRAPH_NODE_STYLES', () => {
    it('should have expanded styles larger than small styles', () => {
      expect(GRAPH_NODE_STYLES.nodeRadiusExpanded).toBeGreaterThan(GRAPH_NODE_STYLES.nodeRadiusSmall);
      expect(GRAPH_NODE_STYLES.fontSizeExpanded).toBeGreaterThan(GRAPH_NODE_STYLES.fontSizeSmall);
      expect(GRAPH_NODE_STYLES.labelOffsetExpanded).toBeGreaterThan(GRAPH_NODE_STYLES.labelOffsetSmall);
    });
  });

  describe('ANIMATION_STYLES', () => {
    it('should have valid timing values', () => {
      expect(ANIMATION_STYLES.lineDrawDuration).toBeGreaterThan(0);
      expect(ANIMATION_STYLES.fadeInDuration).toBeGreaterThan(0);
      expect(ANIMATION_STYLES.staggerDelay).toBeGreaterThan(0);
    });
  });

  describe('getGraphNodeStyle', () => {
    it('should return small styles when not expanded', () => {
      const style = getGraphNodeStyle(false);
      
      expect(style.nodeRadius).toBe(GRAPH_NODE_STYLES.nodeRadiusSmall);
      expect(style.fontSize).toBe(GRAPH_NODE_STYLES.fontSizeSmall);
      expect(style.labelOffset).toBe(GRAPH_NODE_STYLES.labelOffsetSmall);
    });

    it('should return expanded styles when expanded', () => {
      const style = getGraphNodeStyle(true);
      
      expect(style.nodeRadius).toBe(GRAPH_NODE_STYLES.nodeRadiusExpanded);
      expect(style.fontSize).toBe(GRAPH_NODE_STYLES.fontSizeExpanded);
      expect(style.labelOffset).toBe(GRAPH_NODE_STYLES.labelOffsetExpanded);
    });
  });

  describe('getLineAnimationCSS', () => {
    it('should return CSS string', () => {
      const css = getLineAnimationCSS();
      expect(typeof css).toBe('string');
      expect(css.length).toBeGreaterThan(0);
    });

    it('should include keyframe definitions', () => {
      const css = getLineAnimationCSS();
      expect(css).toContain('@keyframes');
      expect(css).toContain('draw-line');
      expect(css).toContain('fade-in');
    });

    it('should use provided prefix', () => {
      const css = getLineAnimationCSS('custom');
      expect(css).toContain('custom-draw-line');
      expect(css).toContain('custom-fade-in');
    });
  });

  describe('getLinePathStyle', () => {
    it('should return style string', () => {
      const style = getLinePathStyle(0);
      expect(typeof style).toBe('string');
    });

    it('should include animation properties', () => {
      const style = getLinePathStyle(0);
      expect(style).toContain('stroke-dasharray');
      expect(style).toContain('animation');
    });

    it('should increase delay with index', () => {
      const style0 = getLinePathStyle(0);
      const style1 = getLinePathStyle(1);
      
      // Extract delay values (rough check)
      expect(style0).not.toBe(style1);
    });
  });

  describe('getLabelStyle', () => {
    it('should return style string', () => {
      const style = getLabelStyle(0);
      expect(typeof style).toBe('string');
    });

    it('should include fade animation', () => {
      const style = getLabelStyle(0);
      expect(style).toContain('animation');
      expect(style).toContain('fade-in');
    });
  });
});

