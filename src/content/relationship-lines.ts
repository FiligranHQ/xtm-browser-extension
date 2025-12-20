/**
 * Relationship Lines Overlay for Web Pages
 * 
 * Draws beautiful curved lines between highlighted entities to visualize relationships.
 * Uses vanilla DOM manipulation (no React) for content script compatibility.
 */

import { loggers } from '../shared/utils/logger';
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
import type { RelationshipData, Point } from '../shared/visualization/graph-types';

const log = loggers.content;

// ============================================================================
// State
// ============================================================================

let svgOverlay: SVGSVGElement | null = null;
let currentRelationships: RelationshipData[] = [];
let resizeObserver: ResizeObserver | null = null;
let scrollHandler: (() => void) | null = null;

// ============================================================================
// Helper Functions
// ============================================================================

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

  // Add arrow marker definition
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  
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
  arrowPath.setAttribute('fill', LINE_STYLES.color);
  arrowPath.setAttribute('fill-opacity', String(LINE_STYLES.opacity));
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  
  svgOverlay.appendChild(defs);

  return svgOverlay;
}

/**
 * Find the best highlight element for an entity value
 */
function findHighlightElement(value: string): HTMLElement | null {
  const normalizedValue = value.toLowerCase().trim();
  const allHighlights = document.querySelectorAll('.xtm-highlight');
  const candidates: HTMLElement[] = [];
  
  for (const h of allHighlights) {
    const el = h as HTMLElement;
    
    // Try data-value attribute
    const dataValue = el.getAttribute('data-value') || '';
    if (dataValue.toLowerCase() === normalizedValue) {
      candidates.push(el);
      continue;
    }
    
    // Try text content
    const textContent = el.textContent?.toLowerCase().trim() || '';
    if (textContent === normalizedValue) {
      candidates.push(el);
      continue;
    }
    
    // Try data-entity-value attribute
    const entityValue = el.getAttribute('data-entity-value') || '';
    if (entityValue.toLowerCase() === normalizedValue) {
      candidates.push(el);
      continue;
    }
    
    // Try parsing data-entity JSON
    const entityJson = el.getAttribute('data-entity');
    if (entityJson) {
      try {
        const entity = JSON.parse(entityJson);
        const entityName = (entity.name || '').toLowerCase();
        const entityVal = (entity.value || '').toLowerCase();
        if (entityName === normalizedValue || entityVal === normalizedValue) {
          candidates.push(el);
          continue;
        }
        // Check aliases
        if (entity.aliases && Array.isArray(entity.aliases)) {
          const aliasMatch = entity.aliases.some((alias: string) => 
            alias.toLowerCase() === normalizedValue
          );
          if (aliasMatch) {
            candidates.push(el);
            continue;
          }
        }
      } catch {
        // JSON parse error, skip
      }
    }
    
    // Partial match as fallback
    if (normalizedValue.length >= 3 && (
      dataValue.toLowerCase().includes(normalizedValue) ||
      normalizedValue.includes(dataValue.toLowerCase()) ||
      textContent.includes(normalizedValue) ||
      normalizedValue.includes(textContent)
    )) {
      candidates.push(el);
    }
  }
  
  if (candidates.length === 0) {
    log.debug(`No highlight found for: ${value}`);
    return null;
  }
  
  // Find the most visible candidate
  let bestHighlight: HTMLElement | null = null;
  let bestScore = -1;
  
  for (const h of candidates) {
    const rect = h.getBoundingClientRect();
    const inViewport = rect.top >= 0 && rect.top <= window.innerHeight;
    const score = inViewport ? rect.width * rect.height + 1000 : rect.width * rect.height;
    
    if (score > bestScore) {
      bestScore = score;
      bestHighlight = h;
    }
  }
  
  return bestHighlight || candidates[0];
}

/**
 * Get the center point of an element
 */
function getElementCenter(el: HTMLElement): Point {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

// ============================================================================
// Drawing Functions
// ============================================================================

/**
 * Draw a single relationship line
 */
function drawRelationshipLine(
  svg: SVGSVGElement,
  fromEl: HTMLElement,
  toEl: HTMLElement,
  relationship: RelationshipData,
  index: number
): void {
  const start = getElementCenter(fromEl);
  const end = getElementCenter(toEl);
  
  // Get element dimensions
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  
  // Adjust endpoints to edges of highlights
  const adjusted = adjustEndpoints(
    start, end,
    fromRect.width, fromRect.height,
    toRect.width, toRect.height
  );
  
  if (!adjusted) return; // Too close, skip
  
  const { adjustedStart, adjustedEnd } = adjusted;
  
  // Calculate curve control points
  const { cp1 } = calculateCurveControlPoints(adjustedStart, adjustedEnd, index, LINE_STYLES.curveOffset);
  
  // Create group for this relationship
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.classList.add('xtm-relationship-line');
  group.setAttribute('data-from', relationship.fromValue);
  group.setAttribute('data-to', relationship.toValue);
  
  // Draw the curved line
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', generateCurvePath(adjustedStart, cp1, adjustedEnd));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', LINE_STYLES.color);
  path.setAttribute('stroke-width', String(LINE_STYLES.width));
  path.setAttribute('stroke-opacity', String(LINE_STYLES.opacity));
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('marker-end', 'url(#xtm-arrowhead)');
  
  // Add animation
  path.style.cssText = `
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
    animation: xtm-draw-line ${ANIMATION_STYLES.lineDrawDuration}s ease-out forwards;
    animation-delay: ${index * ANIMATION_STYLES.staggerDelay}s;
  `;
  
  group.appendChild(path);
  
  // Calculate midpoint on curve for label
  const mid = getPointOnBezier(adjustedStart, cp1, adjustedEnd, 0.5);
  const rotation = calculateLabelRotation(adjustedStart, adjustedEnd);
  
  // Create label
  const labelText = relationship.relationshipType;
  const { width: textWidth, height: textHeight } = calculateLabelDimensions(labelText);
  
  const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  labelGroup.setAttribute('transform', `translate(${mid.x}, ${mid.y}) rotate(${rotation})`);
  
  // Label background
  const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  labelBg.setAttribute('x', String(-textWidth / 2));
  labelBg.setAttribute('y', String(-textHeight / 2));
  labelBg.setAttribute('width', String(textWidth));
  labelBg.setAttribute('height', String(textHeight));
  labelBg.setAttribute('rx', String(LABEL_STYLES.borderRadius));
  labelBg.setAttribute('ry', String(LABEL_STYLES.borderRadius));
  labelBg.setAttribute('fill', LABEL_STYLES.backgroundColor);
  labelBg.setAttribute('fill-opacity', '0.9');
  labelBg.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))';
  
  labelGroup.appendChild(labelBg);
  
  // Label text
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '0');
  text.setAttribute('y', '0');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('fill', LABEL_STYLES.textColor);
  text.setAttribute('font-size', String(LABEL_STYLES.fontSize));
  text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
  text.setAttribute('font-weight', '500');
  text.textContent = labelText;
  
  labelGroup.appendChild(text);
  
  // Add fade-in animation to label
  labelGroup.style.cssText = `
    opacity: 0;
    animation: xtm-fade-in ${ANIMATION_STYLES.fadeInDuration}s ease-out forwards;
    animation-delay: ${index * ANIMATION_STYLES.staggerDelay + ANIMATION_STYLES.fadeInDuration}s;
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
    ${getLineAnimationCSS('xtm')}
    
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
  
  // Resize observer
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

// ============================================================================
// Public API
// ============================================================================

/**
 * Draw relationship lines on the page
 */
export function drawRelationshipLines(relationships: RelationshipData[]): void {
  log.info('[RelationshipLines] Drawing relationship lines:', relationships.length);
  
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
  
  // Log available highlights for debugging
  const allHighlights = document.querySelectorAll('.xtm-highlight');
  log.info(`[RelationshipLines] Found ${allHighlights.length} highlights on page`);
  
  let drawnCount = 0;
  let failedCount = 0;
  
  // Draw each relationship
  relationships.forEach((rel, index) => {
    const fromEl = findHighlightElement(rel.fromValue);
    const toEl = findHighlightElement(rel.toValue);
    
    if (fromEl && toEl) {
      drawRelationshipLine(svg, fromEl, toEl, rel, index);
      drawnCount++;
    } else {
      failedCount++;
      log.warn(`[RelationshipLines] Could not find highlights for: "${rel.fromValue}" -> "${rel.toValue}"`);
    }
  });
  
  log.info(`[RelationshipLines] Drew ${drawnCount} lines, failed ${failedCount}`);
  
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

