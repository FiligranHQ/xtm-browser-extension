/**
 * Unit Tests for Visualization Module
 * 
 * Tests graph layout algorithms and animation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCurveControlPoints,
  calculateLabelRotation,
  getPointOnBezier,
} from '../../src/shared/visualization/graph-layout';
import {
  LINE_STYLES,
  LABEL_STYLES,
  ANIMATION_STYLES,
  getLineAnimationCSS,
  getLinePathStyle,
  getLabelStyle,
} from '../../src/shared/visualization/relationship-styles';
import type { Point } from '../../src/shared/visualization/graph-types';

// ============================================================================
// Graph Layout Tests
// ============================================================================

describe('Graph Layout', () => {
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

  describe('ANIMATION_STYLES', () => {
    it('should have valid timing values', () => {
      expect(ANIMATION_STYLES.lineDrawDuration).toBeGreaterThan(0);
      expect(ANIMATION_STYLES.fadeInDuration).toBeGreaterThan(0);
      expect(ANIMATION_STYLES.staggerDelay).toBeGreaterThan(0);
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
