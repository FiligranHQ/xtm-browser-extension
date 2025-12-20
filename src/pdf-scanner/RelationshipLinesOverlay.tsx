/**
 * Relationship Lines Overlay for PDF Viewer
 * 
 * Renders SVG lines between highlighted entities to visualize relationships.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  calculateCurveControlPoints,
  calculateLabelRotation,
  getPointOnBezier,
} from '../shared/visualization/graph-layout';
import { LINE_STYLES, LABEL_STYLES } from '../shared/visualization/relationship-styles';
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
        // Calculate positions relative to the visible viewport
        const fromX = fromPos.x + fromPos.width / 2 - scrollLeft;
        const fromY = fromPos.y + fromPos.height / 2 - scrollTop;
        const toX = toPos.x + toPos.width / 2 - scrollLeft;
        const toY = toPos.y + toPos.height / 2 - scrollTop;

        // Adjust endpoints to be at edge of highlights
        const dx = toX - fromX;
        const dy = toY - fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 20) return null;

        const unitX = dx / distance;
        const unitY = dy / distance;

        const adjustedFromX = fromX + (fromPos.width / 2) * unitX * 0.8;
        const adjustedFromY = fromY + (fromPos.height / 2) * unitY * 0.8;
        const adjustedToX = toX - (toPos.width / 2) * unitX * 0.8;
        const adjustedToY = toY - (toPos.height / 2) * unitY * 0.8;

        const start: Point = { x: adjustedFromX, y: adjustedFromY };
        const end: Point = { x: adjustedToX, y: adjustedToY };

        const { cp1: cp } = calculateCurveControlPoints(start, end, index, LINE_STYLES.curveOffset);

        // Calculate midpoint on curve
        const mid = getPointOnBezier(start, cp, end, 0.5);
        const rotation = calculateLabelRotation(start, end);

        // Label dimensions
        const labelText = relationship.relationshipType;
        const textWidth = labelText.length * (LABEL_STYLES.fontSize * 0.6) + LABEL_STYLES.padding * 2;
        const textHeight = LABEL_STYLES.fontSize + LABEL_STYLES.padding * 2;

        const pathD = `M ${start.x} ${start.y} Q ${cp.x} ${cp.y} ${end.x} ${end.y}`;

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
                animation: `pdf-draw-line 0.6s ease-out forwards`,
                animationDelay: `${index * 0.1}s`,
              }}
            />

            {/* Label group */}
            <g
              transform={`translate(${mid.x}, ${mid.y}) rotate(${rotation})`}
              style={{
                opacity: 1,
                animation: `pdf-fade-in 0.3s ease-out forwards`,
                animationDelay: `${index * 0.1 + 0.3}s`,
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

      <style>
        {`
          @keyframes pdf-draw-line {
            from {
              stroke-dashoffset: 1000;
            }
            to {
              stroke-dashoffset: 0;
            }
          }

          @keyframes pdf-fade-in {
            from {
              opacity: 0;
              transform: scale(0.8);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
    </svg>
  );
};

export default RelationshipLinesOverlay;
