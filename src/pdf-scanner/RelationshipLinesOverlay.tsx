/**
 * Relationship Lines Overlay for PDF Viewer
 * 
 * Renders SVG lines between highlighted entities to visualize relationships.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

// Constants for styling
const LINE_COLOR = '#9c27b0'; // Purple (AI accent color)
const LINE_WIDTH = 2;
const LINE_OPACITY = 0.7;
const LABEL_BG_COLOR = '#9c27b0';
const LABEL_TEXT_COLOR = '#ffffff';
const LABEL_FONT_SIZE = 10;
const LABEL_PADDING = 4;
const CURVE_OFFSET = 40;

interface RelationshipData {
  fromValue: string;
  toValue: string;
  relationshipType: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface HighlightPosition {
  entityValue: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  relationships: RelationshipData[];
  containerRef: React.RefObject<HTMLElement>;
  highlightPositions: Map<string, HighlightPosition[]>;
}

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
    // Return the first visible position
    return visiblePositions[0];
  }
  
  // If none visible, return the first position
  return positions[0];
}

/**
 * Calculate control point for bezier curve
 */
function calculateControlPoint(
  start: { x: number; y: number },
  end: { x: number; y: number },
  index: number
): { x: number; y: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < 20) return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  
  // Perpendicular direction
  const perpX = -dy / distance;
  const perpY = dx / distance;
  
  // Curve offset
  const curveMultiplier = Math.min(distance * 0.3, CURVE_OFFSET);
  const offset = curveMultiplier * (1 + (index % 3) * 0.3);
  const sign = index % 2 === 0 ? 1 : -1;
  
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  
  return {
    x: midX + perpX * offset * sign,
    y: midY + perpY * offset * sign,
  };
}

/**
 * Calculate rotation angle for label
 */
function calculateLabelRotation(start: { x: number; y: number }, end: { x: number; y: number }): number {
  const tangentX = end.x - start.x;
  const tangentY = end.y - start.y;
  
  let angle = Math.atan2(tangentY, tangentX) * (180 / Math.PI);
  
  // Keep text readable
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  
  return angle;
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
            fill={LINE_COLOR}
            fillOpacity={LINE_OPACITY}
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
        
        const start = { x: adjustedFromX, y: adjustedFromY };
        const end = { x: adjustedToX, y: adjustedToY };
        
        const cp = calculateControlPoint(start, end, index);
        
        // Calculate midpoint on curve
        const t = 0.5;
        const midX = Math.pow(1 - t, 2) * start.x + 2 * (1 - t) * t * cp.x + Math.pow(t, 2) * end.x;
        const midY = Math.pow(1 - t, 2) * start.y + 2 * (1 - t) * t * cp.y + Math.pow(t, 2) * end.y;
        
        const rotation = calculateLabelRotation(start, end);
        
        // Label dimensions
        const labelText = relationship.relationshipType;
        const textWidth = labelText.length * (LABEL_FONT_SIZE * 0.6) + LABEL_PADDING * 2;
        const textHeight = LABEL_FONT_SIZE + LABEL_PADDING * 2;
        
        const pathD = `M ${start.x} ${start.y} Q ${cp.x} ${cp.y} ${end.x} ${end.y}`;
        
        return (
          <g key={`rel-${index}`}>
            {/* Main path */}
            <path
              d={pathD}
              fill="none"
              stroke={LINE_COLOR}
              strokeWidth={LINE_WIDTH}
              strokeOpacity={LINE_OPACITY}
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
              transform={`translate(${midX}, ${midY}) rotate(${rotation})`}
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
                rx={3}
                ry={3}
                fill={LABEL_BG_COLOR}
                fillOpacity={0.9}
                style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
              />
              
              {/* Label text */}
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill={LABEL_TEXT_COLOR}
                fontSize={LABEL_FONT_SIZE}
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

