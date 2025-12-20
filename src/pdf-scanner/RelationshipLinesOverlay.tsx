/**
 * Relationship Lines Overlay for PDF Viewer
 * 
 * Renders SVG lines between highlighted entities to visualize relationships.
 * Uses React for declarative rendering within the PDF viewer iframe.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  calculateCurveControlPoints,
  calculateLabelRotation,
  getPointOnBezier,
} from '../shared/visualization/graph-layout';
import {
  adjustEndpoints,
  calculateLabelDimensions,
  generateCurvePath,
} from '../shared/visualization/line-geometry';
import { LINE_STYLES, LABEL_STYLES, ANIMATION_STYLES, getLineAnimationCSS } from '../shared/visualization/relationship-styles';
import type { RelationshipData, HighlightPosition, Point } from '../shared/visualization/graph-types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the best position for an entity (prefer visible ones)
 */
function getBestPosition(
  positions: HighlightPosition[] | undefined,
  containerRect: DOMRect,
  scrollTop: number
): HighlightPosition | null {
  if (!positions || positions.length === 0) return null;

  // Find positions that are visible in the viewport
  const visiblePositions = positions.filter(pos => {
    const absY = pos.y - scrollTop;
    return absY >= 0 && absY <= containerRect.height;
  });

  if (visiblePositions.length > 0) {
    return visiblePositions[0];
  }

  return positions[0];
}

// ============================================================================
// Component
// ============================================================================

interface Props {
  relationships: RelationshipData[];
  containerRef: React.RefObject<HTMLElement | null>;
  highlightPositions: Map<string, HighlightPosition[]>;
}

export const RelationshipLinesOverlay: React.FC<Props> = ({
  relationships,
  containerRef,
  highlightPositions,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [, setUpdateTrigger] = useState(0);

  // Force update when scroll or resize happens
  const handleUpdate = useCallback(() => {
    setUpdateTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate);

    return () => {
      container.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [containerRef, handleUpdate]);

  if (relationships.length === 0 || !containerRef.current) {
    return null;
  }

  const container = containerRef.current;
  const containerRect = container.getBoundingClientRect();
  const scrollTop = container.scrollTop;
  const scrollLeft = container.scrollLeft;

  // Build line data
  const lines: Array<{
    fromPos: HighlightPosition;
    toPos: HighlightPosition;
    relationship: RelationshipData;
    index: number;
  }> = [];

  relationships.forEach((rel, index) => {
    const fromPositions = highlightPositions.get(rel.fromValue.toLowerCase());
    const toPositions = highlightPositions.get(rel.toValue.toLowerCase());

    const fromPos = getBestPosition(fromPositions, containerRect, scrollTop);
    const toPos = getBestPosition(toPositions, containerRect, scrollTop);

    if (fromPos && toPos) {
      lines.push({ fromPos, toPos, relationship: rel, index });
    }
  });

  if (lines.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
        overflow: 'visible',
      }}
    >
      <defs>
        <marker
          id="pdf-arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill={LINE_STYLES.color}
            fillOpacity={LINE_STYLES.opacity}
          />
        </marker>

        {/* Glow filter for lines */}
        <filter id="pdf-line-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {lines.map(({ fromPos, toPos, relationship, index }) => {
        // Calculate center positions relative to the visible viewport
        const fromCenter: Point = {
          x: fromPos.x + fromPos.width / 2 - scrollLeft,
          y: fromPos.y + fromPos.height / 2 - scrollTop,
        };
        const toCenter: Point = {
          x: toPos.x + toPos.width / 2 - scrollLeft,
          y: toPos.y + toPos.height / 2 - scrollTop,
        };

        // Adjust endpoints to be at edge of highlights
        const adjusted = adjustEndpoints(
          fromCenter, toCenter,
          fromPos.width, fromPos.height,
          toPos.width, toPos.height
        );

        if (!adjusted) return null; // Too close, skip

        const { adjustedStart: start, adjustedEnd: end } = adjusted;

        const { cp1: cp } = calculateCurveControlPoints(start, end, index, LINE_STYLES.curveOffset);

        // Calculate midpoint on curve
        const mid = getPointOnBezier(start, cp, end, 0.5);
        const rotation = calculateLabelRotation(start, end);

        // Label dimensions
        const labelText = relationship.relationshipType;
        const { width: textWidth, height: textHeight } = calculateLabelDimensions(labelText);

        const pathD = generateCurvePath(start, cp, end);

        return (
          <g key={`rel-${index}`}>
            {/* Main path */}
            <path
              d={pathD}
              fill="none"
              stroke={LINE_STYLES.color}
              strokeWidth={LINE_STYLES.width}
              strokeOpacity={LINE_STYLES.opacity}
              strokeLinecap="round"
              markerEnd="url(#pdf-arrowhead)"
              filter="url(#pdf-line-glow)"
              style={{
                strokeDasharray: 1000,
                strokeDashoffset: 0,
                animation: `pdf-draw-line ${ANIMATION_STYLES.lineDrawDuration}s ease-out forwards`,
                animationDelay: `${index * ANIMATION_STYLES.staggerDelay}s`,
              }}
            />

            {/* Label group */}
            <g
              transform={`translate(${mid.x}, ${mid.y}) rotate(${rotation})`}
              style={{
                opacity: 1,
                animation: `pdf-fade-in ${ANIMATION_STYLES.fadeInDuration}s ease-out forwards`,
                animationDelay: `${index * ANIMATION_STYLES.staggerDelay + ANIMATION_STYLES.fadeInDuration}s`,
              }}
            >
              {/* Label background */}
              <rect
                x={-textWidth / 2}
                y={-textHeight / 2}
                width={textWidth}
                height={textHeight}
                rx={LABEL_STYLES.borderRadius}
                ry={LABEL_STYLES.borderRadius}
                fill={LABEL_STYLES.backgroundColor}
                fillOpacity={0.9}
                style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
              />

              {/* Label text */}
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill={LABEL_STYLES.textColor}
                fontSize={LABEL_STYLES.fontSize}
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontWeight={500}
              >
                {labelText}
              </text>
            </g>
          </g>
        );
      })}

      <style>{getLineAnimationCSS('pdf')}</style>
    </svg>
  );
};

export default RelationshipLinesOverlay;
