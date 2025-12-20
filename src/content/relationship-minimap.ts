/**
 * Relationship Mini-Map
 * 
 * Displays a small graph visualization in the bottom-left corner showing
 * entities and their relationships. Clicking opens a larger dialog view.
 */

import { loggers } from '../shared/utils/logger';
import { getIconPath, getEntityColor } from '../shared/visualization/entity-icons';
import { calculateLayout } from '../shared/visualization/graph-layout';
import type { GraphNode, GraphEdge, RelationshipData, EntityData } from '../shared/visualization/graph-types';
import { 
  MINIMAP_STYLES, 
  DIALOG_STYLES, 
  GRAPH_NODE_STYLES,
  getGraphNodeStyle,
  getLineAnimationCSS,
} from '../shared/visualization/relationship-styles';

const log = loggers.content;

// ============================================================================
// State
// ============================================================================

let minimapContainer: HTMLDivElement | null = null;
let dialogContainer: HTMLDivElement | null = null;
let currentNodes: GraphNode[] = [];
let currentEdges: GraphEdge[] = [];

// ============================================================================
// SVG Generation
// ============================================================================

/**
 * Create SVG graph visualization
 */
function createGraphSVG(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  isExpanded: boolean
): string {
  // Use shared constants for consistent styling between web and PDF
  const style = getGraphNodeStyle(isExpanded);
  const { nodeRadius, fontSize, labelOffset, maxLabelLength, truncateLength, strokeWidth, edgeStrokeWidth } = style;
  
  // Calculate layout
  const layoutNodes = calculateLayout(nodes, edges, width, height);
  
  // Build SVG
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Defs for gradients and markers
  svg += `<defs>
    <marker id="arrow-mini" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#666"/>
    </marker>
    <filter id="glow-mini">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="shadow-mini">
      <feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
  </defs>`;
  
  // Draw edges
  for (const edge of edges) {
    const fromNode = layoutNodes.find(n => n.value.toLowerCase() === edge.from.toLowerCase());
    const toNode = layoutNodes.find(n => n.value.toLowerCase() === edge.to.toLowerCase());
    
    if (fromNode && toNode) {
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Shorten line to not overlap nodes
      const offsetRatio = nodeRadius / dist;
      const x1 = fromNode.x + dx * offsetRatio;
      const y1 = fromNode.y + dy * offsetRatio;
      const x2 = toNode.x - dx * offsetRatio;
      const y2 = toNode.y - dy * offsetRatio;
      
      // Calculate control point for curved edge
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const perpX = -dy / dist * GRAPH_NODE_STYLES.edgeCurveOffset;
      const perpY = dx / dist * GRAPH_NODE_STYLES.edgeCurveOffset;
      const ctrlX = midX + perpX;
      const ctrlY = midY + perpY;
      
      svg += `<path d="M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}" 
        fill="none" stroke="#666" stroke-width="${edgeStrokeWidth}" 
        stroke-opacity="${GRAPH_NODE_STYLES.edgeStrokeOpacity}" marker-end="url(#arrow-mini)"/>`;
      
      // Edge label for expanded view
      if (isExpanded) {
        const labelX = midX + perpX * 0.5;
        const labelY = midY + perpY * 0.5;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const rotateAngle = angle > 90 || angle < -90 ? angle + 180 : angle;
        
        svg += `<g transform="translate(${labelX}, ${labelY}) rotate(${rotateAngle})">
          <rect x="${GRAPH_NODE_STYLES.edgeLabelRectX}" y="${GRAPH_NODE_STYLES.edgeLabelRectY}" width="${GRAPH_NODE_STYLES.edgeLabelRectWidth}" height="${GRAPH_NODE_STYLES.edgeLabelRectHeight}" rx="3" fill="${GRAPH_NODE_STYLES.edgeLabelBgColor}" fill-opacity="${GRAPH_NODE_STYLES.edgeLabelBgOpacity}"/>
          <text x="0" y="3" text-anchor="middle" fill="#fff" font-size="${GRAPH_NODE_STYLES.edgeLabelFontSize}" font-family="sans-serif">${edge.type}</text>
        </g>`;
      }
    }
  }
  
  // Draw nodes
  for (const node of layoutNodes) {
    const iconPath = getIconPath(node.type);
    const iconScale = nodeRadius / 12;
    
    // Node circle with shadow
    svg += `<g filter="url(#shadow-mini)">
      <circle cx="${node.x}" cy="${node.y}" r="${nodeRadius}" fill="${node.color}" stroke="#fff" stroke-width="${strokeWidth}"/>
    </g>`;
    
    // Icon (scaled and centered)
    const iconSize = nodeRadius * 1.2;
    svg += `<g transform="translate(${node.x - iconSize/2}, ${node.y - iconSize/2}) scale(${iconScale})">
      <path d="${iconPath}" fill="#fff" fill-opacity="0.9"/>
    </g>`;
    
    // Label
    const labelText = node.value.length > maxLabelLength 
      ? node.value.substring(0, truncateLength) + '...' 
      : node.value;
    
    svg += `<text x="${node.x}" y="${node.y + labelOffset}" text-anchor="middle" 
      fill="${isExpanded ? '#333' : '#fff'}" font-size="${fontSize}" font-family="sans-serif" font-weight="500"
      ${isExpanded ? '' : 'filter="url(#shadow-mini)"'}>${labelText}</text>`;
  }
  
  svg += '</svg>';
  return svg;
}

// ============================================================================
// UI Components
// ============================================================================

/**
 * Create the mini-map container
 */
function createMinimap(): HTMLDivElement {
  if (minimapContainer && document.body.contains(minimapContainer)) {
    return minimapContainer;
  }
  
  const existing = document.getElementById('xtm-relationship-minimap');
  if (existing) existing.remove();
  
  const container = document.createElement('div');
  container.id = 'xtm-relationship-minimap';
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    width: ${MINIMAP_STYLES.width}px;
    height: ${MINIMAP_STYLES.height}px;
    background: linear-gradient(135deg, ${MINIMAP_STYLES.bgStart} 0%, ${MINIMAP_STYLES.bgEnd} 100%);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
    z-index: 2147483644;
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    opacity: 0;
    transform: translateY(20px);
    animation: xtm-minimap-appear 0.3s ease forwards;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 6px 10px;
    background: rgba(156, 39, 176, ${MINIMAP_STYLES.accentBgOpacity});
    border-bottom: 1px solid rgba(156, 39, 176, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 10px;
    font-weight: 600;
    color: ${MINIMAP_STYLES.accentColor};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  header.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/>
    </svg>
    Graph Overview
  `;
  container.appendChild(header);
  
  // Graph container
  const graphContainer = document.createElement('div');
  graphContainer.id = 'xtm-minimap-graph';
  graphContainer.style.cssText = `
    width: 100%;
    height: calc(100% - ${MINIMAP_STYLES.headerHeight}px);
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  container.appendChild(graphContainer);
  
  // Hover effect
  container.addEventListener('mouseenter', () => {
    container.style.transform = 'scale(1.02)';
    container.style.boxShadow = '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(156, 39, 176, 0.3)';
  });
  container.addEventListener('mouseleave', () => {
    container.style.transform = 'scale(1)';
    container.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)';
  });
  
  // Click to expand
  container.addEventListener('click', () => {
    showExpandedGraph();
  });
  
  document.body.appendChild(container);
  minimapContainer = container;
  
  // Add animation styles
  ensureMinimapStyles();
  
  return container;
}

/**
 * Create the expanded graph dialog
 */
function createExpandedDialog(): HTMLDivElement {
  if (dialogContainer && document.body.contains(dialogContainer)) {
    return dialogContainer;
  }
  
  const existing = document.getElementById('xtm-relationship-dialog');
  if (existing) existing.remove();
  
  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'xtm-relationship-dialog-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 2147483646;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;
  
  // Dialog
  const dialog = document.createElement('div');
  dialog.id = 'xtm-relationship-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.9);
    width: min(${DIALOG_STYLES.maxWidth}px, 90vw);
    height: min(${DIALOG_STYLES.maxHeight}px, 80vh);
    background: linear-gradient(135deg, ${MINIMAP_STYLES.bgStart} 0%, ${MINIMAP_STYLES.bgEnd} 100%);
    border-radius: 16px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1);
    z-index: 2147483647;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px 20px;
    background: rgba(156, 39, 176, 0.15);
    border-bottom: 1px solid rgba(156, 39, 176, 0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="${MINIMAP_STYLES.accentColor}">
        <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/>
      </svg>
      <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 600; color: #fff;">
        Entity Relationship Graph
      </span>
      <span id="xtm-dialog-stats" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: ${MINIMAP_STYLES.accentColor}; margin-left: 8px;">
      </span>
    </div>
  `;
  
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    width: 32px;
    height: 32px;
    border: none;
    background: rgba(255,255,255,0.1);
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  `;
  closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'rgba(255,255,255,0.2)';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'rgba(255,255,255,0.1)';
  });
  closeBtn.addEventListener('click', hideExpandedGraph);
  header.appendChild(closeBtn);
  dialog.appendChild(header);
  
  // Graph container
  const graphContainer = document.createElement('div');
  graphContainer.id = 'xtm-dialog-graph';
  graphContainer.style.cssText = `
    width: 100%;
    height: calc(100% - 56px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(ellipse at center, rgba(156, 39, 176, 0.05) 0%, transparent 70%);
  `;
  dialog.appendChild(graphContainer);
  
  // Legend
  const legend = document.createElement('div');
  legend.id = 'xtm-dialog-legend';
  legend.style.cssText = `
    position: absolute;
    bottom: 16px;
    right: 16px;
    background: rgba(0,0,0,0.6);
    border-radius: 8px;
    padding: 10px 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 10px;
    color: #fff;
    max-width: 200px;
  `;
  dialog.appendChild(legend);
  
  // Close on backdrop click
  backdrop.addEventListener('click', hideExpandedGraph);
  
  // Close on Escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideExpandedGraph();
      window.removeEventListener('keydown', handleEscape);
    }
  };
  window.addEventListener('keydown', handleEscape);
  
  document.body.appendChild(backdrop);
  document.body.appendChild(dialog);
  dialogContainer = dialog;
  
  // Animate in
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    dialog.style.opacity = '1';
    dialog.style.transform = 'translate(-50%, -50%) scale(1)';
  });
  
  return dialog;
}

/**
 * Show the expanded graph dialog
 */
function showExpandedGraph(): void {
  const dialog = createExpandedDialog();
  const graphContainer = dialog.querySelector('#xtm-dialog-graph') as HTMLDivElement;
  const statsSpan = dialog.querySelector('#xtm-dialog-stats') as HTMLSpanElement;
  const legendDiv = dialog.querySelector('#xtm-dialog-legend') as HTMLDivElement;
  
  if (graphContainer && currentNodes.length > 0) {
    const width = graphContainer.clientWidth || DIALOG_STYLES.graphWidth;
    const height = graphContainer.clientHeight || DIALOG_STYLES.graphHeight;
    
    graphContainer.innerHTML = createGraphSVG(currentNodes, currentEdges, width, height, true);
    
    // Update stats
    if (statsSpan) {
      statsSpan.textContent = `${currentNodes.length} entities • ${currentEdges.length} relationships`;
    }
    
    // Build legend
    if (legendDiv) {
      const types = new Map<string, string>();
      currentNodes.forEach(n => types.set(n.type, n.color));
      
      let legendHtml = `<div style="font-weight: 600; margin-bottom: 6px; color: ${MINIMAP_STYLES.accentColor};">Entity Types</div>`;
      types.forEach((color, type) => {
        legendHtml += `<div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></div>
          <span>${type}</span>
        </div>`;
      });
      legendDiv.innerHTML = legendHtml;
    }
  }
}

/**
 * Hide the expanded graph dialog
 */
function hideExpandedGraph(): void {
  const backdrop = document.getElementById('xtm-relationship-dialog-backdrop');
  const dialog = document.getElementById('xtm-relationship-dialog');
  
  if (backdrop) {
    backdrop.style.opacity = '0';
    setTimeout(() => backdrop.remove(), 200);
  }
  
  if (dialog) {
    dialog.style.opacity = '0';
    dialog.style.transform = 'translate(-50%, -50%) scale(0.9)';
    setTimeout(() => dialog.remove(), 200);
  }
  
  dialogContainer = null;
}

/**
 * Add animation styles
 */
function ensureMinimapStyles(): void {
  const styleId = 'xtm-minimap-styles';
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes xtm-minimap-appear {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    ${getLineAnimationCSS('xtm')}
  `;
  document.head.appendChild(style);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Update the mini-map with entities and relationships
 */
export function updateMinimap(entities: EntityData[], relationships: RelationshipData[]): void {
  log.info('[Minimap] updateMinimap called with', entities.length, 'entities and', relationships.length, 'relationships');
  
  if (entities.length === 0 && relationships.length === 0) {
    log.info('[Minimap] No entities or relationships, clearing minimap');
    clearMinimap();
    return;
  }
  
  // Build nodes from entities
  const nodeMap = new Map<string, GraphNode>();
  
  entities.forEach(entity => {
    const key = entity.value.toLowerCase();
    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        id: key,
        value: entity.value,
        type: entity.type,
        x: 0,
        y: 0,
        color: getEntityColor(entity.type),
      });
    }
  });
  
  // Build edges and ensure all relationship endpoints have nodes
  const edges: GraphEdge[] = [];
  
  relationships.forEach(rel => {
    const fromKey = rel.fromValue.toLowerCase();
    const toKey = rel.toValue.toLowerCase();
    
    // Add nodes for relationship endpoints if not already present
    if (!nodeMap.has(fromKey)) {
      nodeMap.set(fromKey, {
        id: fromKey,
        value: rel.fromValue,
        type: 'Unknown',
        x: 0,
        y: 0,
        color: '#666',
      });
    }
    
    if (!nodeMap.has(toKey)) {
      nodeMap.set(toKey, {
        id: toKey,
        value: rel.toValue,
        type: 'Unknown',
        x: 0,
        y: 0,
        color: '#666',
      });
    }
    
    edges.push({
      from: rel.fromValue,
      to: rel.toValue,
      type: rel.relationshipType,
    });
  });
  
  currentNodes = Array.from(nodeMap.values());
  currentEdges = edges;
  
  // Create/update minimap
  log.info('[Minimap] Creating minimap container with', currentNodes.length, 'nodes and', currentEdges.length, 'edges');
  const container = createMinimap();
  const graphContainer = container.querySelector('#xtm-minimap-graph') as HTMLDivElement;
  
  if (graphContainer) {
    const svg = createGraphSVG(currentNodes, currentEdges, MINIMAP_STYLES.width, MINIMAP_STYLES.graphHeight, false);
    graphContainer.innerHTML = svg;
    log.info('[Minimap] Minimap created and SVG rendered');
  } else {
    log.warn('[Minimap] Graph container not found in minimap');
  }
}

/**
 * Clear the mini-map
 */
export function clearMinimap(): void {
  log.debug('Clearing minimap');
  
  currentNodes = [];
  currentEdges = [];
  
  if (minimapContainer) {
    minimapContainer.style.opacity = '0';
    minimapContainer.style.transform = 'translateY(20px)';
    setTimeout(() => {
      minimapContainer?.remove();
      minimapContainer = null;
    }, 300);
  }
  
  hideExpandedGraph();
  
  const styleEl = document.getElementById('xtm-minimap-styles');
  if (styleEl) styleEl.remove();
}

/**
 * Check if minimap is visible
 */
export function isMinimapVisible(): boolean {
  return minimapContainer !== null && document.body.contains(minimapContainer);
}
