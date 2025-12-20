/**
 * Relationship Lines Overlay
 * 
 * Draws beautiful curved lines between highlighted entities to visualize relationships.
 */

import { loggers } from '../shared/utils/logger';

const log = loggers.content;

// Constants for styling
const LINE_COLOR = '#9c27b0'; // Purple (AI accent color)
const LINE_WIDTH = 2;
const LINE_OPACITY = 0.7;
const LABEL_BG_COLOR = '#9c27b0';
const LABEL_TEXT_COLOR = '#ffffff';
const LABEL_FONT_SIZE = 10;
const LABEL_PADDING = 4;
const CURVE_OFFSET = 40; // Base curve offset for bezier

interface RelationshipLine {
  fromValue: string;
  toValue: string;
  relationshipType: string;
  confidence?: 'high' | 'medium' | 'low';
}

let svgOverlay: SVGSVGElement | null = null;
let currentRelationships: RelationshipLine[] = [];
let resizeObserver: ResizeObserver | null = null;
let scrollHandler: (() => void) | null = null;

/**
 * Create or get the SVG overlay element
 */
function getOrCreateSvgOverlay(): SVGSVGElement {
  if (svgOverlay && document.body.contains(svgOverlay)) {
    return svgOverlay;
  }

  // Remove any existing overlay
  const existing = document.getElementById('xtm-relationship-lines');
  if (existing) existing.remove();

  svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgOverlay.id = 'xtm-relationship-lines';
  svgOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483645;
    overflow: visible;
  `;
  document.body.appendChild(svgOverlay);

  // Add gradient definition for nicer lines
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  
  // Arrow marker for line direction
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'xtm-arrowhead');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '3.5');
  marker.setAttribute('orient', 'auto');
  marker.setAttribute('markerUnits', 'strokeWidth');
  
  const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  arrowPath.setAttribute('points', '0 0, 10 3.5, 0 7');
  arrowPath.setAttribute('fill', LINE_COLOR);
  arrowPath.setAttribute('fill-opacity', String(LINE_OPACITY));
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  
  svgOverlay.appendChild(defs);

  return svgOverlay;
}

/**
 * Find the best highlight element for an entity value
 */
function findHighlightElement(value: string): HTMLElement | null {
  // Try exact match first
  const highlights = document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`);
  
  if (highlights.length === 0) {
    // Try case-insensitive search
    const allHighlights = document.querySelectorAll('.xtm-highlight');
    for (const h of allHighlights) {
      const hValue = (h as HTMLElement).getAttribute('data-value') || '';
      if (hValue.toLowerCase() === value.toLowerCase()) {
        return h as HTMLElement;
      }
    }
    return null;
  }
  
  // If multiple, find the most visible one
  let bestHighlight: HTMLElement | null = null;
  let bestScore = -1;
  
  highlights.forEach(h => {
    const rect = h.getBoundingClientRect();
    const inViewport = rect.top >= 0 && rect.top <= window.innerHeight;
    const score = inViewport ? rect.width * rect.height : 0;
    
    if (score > bestScore) {
      bestScore = score;
      bestHighlight = h as HTMLElement;
    }
  });
  
  return bestHighlight || (highlights[0] as HTMLElement);
}

/**
 * Get the center point of an element
 */
function getElementCenter(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Calculate control points for a smooth bezier curve
 */
function calculateCurveControlPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  index: number
): { cp1: { x: number; y: number }; cp2: { x: number; y: number } } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Perpendicular direction for curve offset
  const perpX = -dy / distance;
  const perpY = dx / distance;
  
  // Vary curve based on index and distance
  const curveMultiplier = Math.min(distance * 0.3, CURVE_OFFSET);
  const offset = curveMultiplier * (1 + (index % 3) * 0.3); // Alternate curve directions
  const sign = index % 2 === 0 ? 1 : -1;
  
  // For close elements, use more curve; for far elements, use less
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  
  // Control points offset perpendicular to the line
  const cp1 = {
    x: midX + perpX * offset * sign,
    y: midY + perpY * offset * sign,
  };
  
  const cp2 = {
    x: midX + perpX * offset * sign,
    y: midY + perpY * offset * sign,
  };
  
  return { cp1, cp2 };
}

/**
 * Calculate the angle of the line at the midpoint for label rotation
 */
function calculateLabelRotation(
  start: { x: number; y: number },
  end: { x: number; y: number },
  cp: { x: number; y: number }
): number {
  // At midpoint of bezier, calculate tangent angle
  // For quadratic bezier: B'(0.5) = 2*(1-0.5)*(cp-start) + 2*0.5*(end-cp)
  const tangentX = (end.x - start.x);
  const tangentY = (end.y - start.y);
  
  let angle = Math.atan2(tangentY, tangentX) * (180 / Math.PI);
  
  // Keep text readable (not upside down)
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  
  return angle;
}

/**
 * Draw a single relationship line
 */
function drawRelationshipLine(
  svg: SVGSVGElement,
  fromEl: HTMLElement,
  toEl: HTMLElement,
  relationship: RelationshipLine,
  index: number
): void {
  const start = getElementCenter(fromEl);
  const end = getElementCenter(toEl);
  
  // Calculate offset for line endpoints to not overlap highlights
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  
  // Adjust start and end to be at the edge of highlights
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < 20) return; // Too close, skip
  
  const unitX = dx / distance;
  const unitY = dy / distance;
  
  // Move start point to edge of fromEl
  const startOffsetX = (fromRect.width / 2) * unitX;
  const startOffsetY = (fromRect.height / 2) * unitY;
  const adjustedStart = {
    x: start.x + startOffsetX * 0.8,
    y: start.y + startOffsetY * 0.8,
  };
  
  // Move end point to edge of toEl
  const endOffsetX = (toRect.width / 2) * unitX;
  const endOffsetY = (toRect.height / 2) * unitY;
  const adjustedEnd = {
    x: end.x - endOffsetX * 0.8,
    y: end.y - endOffsetY * 0.8,
  };
  
  // Calculate curve control points
  const { cp1 } = calculateCurveControlPoints(adjustedStart, adjustedEnd, index);
  
  // Create group for this relationship
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.classList.add('xtm-relationship-line');
  group.setAttribute('data-from', relationship.fromValue);
  group.setAttribute('data-to', relationship.toValue);
  
  // Draw the curved line using quadratic bezier
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const d = `M ${adjustedStart.x} ${adjustedStart.y} Q ${cp1.x} ${cp1.y} ${adjustedEnd.x} ${adjustedEnd.y}`;
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', LINE_COLOR);
  path.setAttribute('stroke-width', String(LINE_WIDTH));
  path.setAttribute('stroke-opacity', String(LINE_OPACITY));
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('marker-end', 'url(#xtm-arrowhead)');
  
  // Add subtle animation
  path.style.cssText = `
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
    animation: xtm-draw-line 0.6s ease-out forwards;
    animation-delay: ${index * 0.1}s;
  `;
  
  group.appendChild(path);
  
  // Calculate midpoint on the curve for label placement
  // For quadratic bezier: B(0.5) = (1-0.5)²*start + 2*(1-0.5)*0.5*cp + 0.5²*end
  const t = 0.5;
  const midX = Math.pow(1 - t, 2) * adjustedStart.x + 2 * (1 - t) * t * cp1.x + Math.pow(t, 2) * adjustedEnd.x;
  const midY = Math.pow(1 - t, 2) * adjustedStart.y + 2 * (1 - t) * t * cp1.y + Math.pow(t, 2) * adjustedEnd.y;
  
  // Calculate rotation angle for the label
  const rotation = calculateLabelRotation(adjustedStart, adjustedEnd, cp1);
  
  // Create label background
  const labelText = relationship.relationshipType;
  const textWidth = labelText.length * (LABEL_FONT_SIZE * 0.6) + LABEL_PADDING * 2;
  const textHeight = LABEL_FONT_SIZE + LABEL_PADDING * 2;
  
  const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  labelGroup.setAttribute('transform', `translate(${midX}, ${midY}) rotate(${rotation})`);
  
  // Label background rectangle
  const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  labelBg.setAttribute('x', String(-textWidth / 2));
  labelBg.setAttribute('y', String(-textHeight / 2));
  labelBg.setAttribute('width', String(textWidth));
  labelBg.setAttribute('height', String(textHeight));
  labelBg.setAttribute('rx', '3');
  labelBg.setAttribute('ry', '3');
  labelBg.setAttribute('fill', LABEL_BG_COLOR);
  labelBg.setAttribute('fill-opacity', '0.9');
  
  // Add subtle shadow
  labelBg.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))';
  
  labelGroup.appendChild(labelBg);
  
  // Label text
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '0');
  text.setAttribute('y', '0');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('fill', LABEL_TEXT_COLOR);
  text.setAttribute('font-size', String(LABEL_FONT_SIZE));
  text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
  text.setAttribute('font-weight', '500');
  text.textContent = labelText;
  
  labelGroup.appendChild(text);
  
  // Add fade-in animation to label
  labelGroup.style.cssText = `
    opacity: 0;
    animation: xtm-fade-in 0.3s ease-out forwards;
    animation-delay: ${index * 0.1 + 0.3}s;
  `;
  
  group.appendChild(labelGroup);
  svg.appendChild(group);
}

/**
 * Add CSS animations for line drawing
 */
function ensureAnimationStyles(): void {
  const styleId = 'xtm-relationship-line-styles';
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes xtm-draw-line {
      to {
        stroke-dashoffset: 0;
      }
    }
    
    @keyframes xtm-fade-in {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    .xtm-relationship-line {
      transition: opacity 0.2s ease-out;
    }
    
    .xtm-relationship-line:hover {
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Update all relationship lines (called on scroll/resize)
 */
function updateLines(): void {
  if (!svgOverlay || currentRelationships.length === 0) return;
  
  // Clear existing lines
  const existingLines = svgOverlay.querySelectorAll('.xtm-relationship-line');
  existingLines.forEach(line => line.remove());
  
  // Redraw all lines
  currentRelationships.forEach((rel, index) => {
    const fromEl = findHighlightElement(rel.fromValue);
    const toEl = findHighlightElement(rel.toValue);
    
    if (fromEl && toEl) {
      drawRelationshipLine(svgOverlay!, fromEl, toEl, rel, index);
    }
  });
}

/**
 * Setup scroll and resize handlers
 */
function setupEventHandlers(): void {
  // Remove existing handlers
  cleanupEventHandlers();
  
  // Throttled update function
  let rafId: number | null = null;
  const throttledUpdate = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      updateLines();
      rafId = null;
    });
  };
  
  // Scroll handler
  scrollHandler = throttledUpdate;
  window.addEventListener('scroll', scrollHandler, { passive: true });
  document.addEventListener('scroll', scrollHandler, { passive: true, capture: true });
  
  // Resize observer for container changes
  resizeObserver = new ResizeObserver(throttledUpdate);
  resizeObserver.observe(document.body);
}

/**
 * Cleanup event handlers
 */
function cleanupEventHandlers(): void {
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler);
    document.removeEventListener('scroll', scrollHandler, { capture: true });
    scrollHandler = null;
  }
  
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

/**
 * Draw relationship lines on the page
 */
export function drawRelationshipLines(relationships: RelationshipLine[]): void {
  log.debug('Drawing relationship lines:', relationships.length);
  
  if (!relationships || relationships.length === 0) {
    clearRelationshipLines();
    return;
  }
  
  currentRelationships = relationships;
  
  ensureAnimationStyles();
  const svg = getOrCreateSvgOverlay();
  
  // Clear existing lines
  const existingLines = svg.querySelectorAll('.xtm-relationship-line');
  existingLines.forEach(line => line.remove());
  
  // Draw each relationship
  relationships.forEach((rel, index) => {
    const fromEl = findHighlightElement(rel.fromValue);
    const toEl = findHighlightElement(rel.toValue);
    
    if (fromEl && toEl) {
      drawRelationshipLine(svg, fromEl, toEl, rel, index);
    } else {
      log.debug(`Could not find highlights for relationship: ${rel.fromValue} -> ${rel.toValue}`);
    }
  });
  
  setupEventHandlers();
}

/**
 * Clear all relationship lines
 */
export function clearRelationshipLines(): void {
  log.debug('Clearing relationship lines');
  
  currentRelationships = [];
  cleanupEventHandlers();
  
  if (svgOverlay) {
    svgOverlay.remove();
    svgOverlay = null;
  }
  
  const styleEl = document.getElementById('xtm-relationship-line-styles');
  if (styleEl) styleEl.remove();
}

/**
 * Check if relationship lines are currently displayed
 */
export function hasRelationshipLines(): boolean {
  return currentRelationships.length > 0;
}

