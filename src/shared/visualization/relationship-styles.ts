/**
 * Relationship Styles
 * 
 * Shared styling constants for relationship lines and graph visualizations.
 */

/**
 * Line styling constants
 */
export const LINE_STYLES = {
  /** Primary line color (purple/AI accent) */
  color: '#9c27b0',
  /** Line stroke width */
  width: 2,
  /** Line opacity */
  opacity: 0.7,
  /** Base curve offset for bezier */
  curveOffset: 40,
} as const;

/**
 * Label styling constants
 */
export const LABEL_STYLES = {
  /** Label background color */
  backgroundColor: '#9c27b0',
  /** Label text color */
  textColor: '#ffffff',
  /** Label font size in pixels */
  fontSize: 10,
  /** Label padding in pixels */
  padding: 4,
  /** Label border radius */
  borderRadius: 3,
} as const;

/**
 * Minimap styling constants
 */
export const MINIMAP_STYLES = {
  /** Minimap width */
  width: 180,
  /** Minimap height */
  height: 140,
  /** Minimap graph height (excluding header) */
  graphHeight: 112,
  /** Header height */
  headerHeight: 28,
  /** Background gradient start color */
  bgStart: '#1a1a2e',
  /** Background gradient end color */
  bgEnd: '#16213e',
  /** Accent color for header */
  accentColor: '#ce93d8',
  /** Accent background opacity */
  accentBgOpacity: 0.2,
} as const;

/**
 * Dialog styling constants
 */
export const DIALOG_STYLES = {
  /** Dialog max width */
  maxWidth: 800,
  /** Dialog max height */
  maxHeight: 600,
  /** Graph area width */
  graphWidth: 760,
  /** Graph area height */
  graphHeight: 480,
} as const;

/**
 * Graph node styling constants (used in minimap visualizations)
 * These ensure consistent appearance between web page and PDF viewer.
 */
export const GRAPH_NODE_STYLES = {
  /** Node radius when minimap is collapsed */
  nodeRadiusSmall: 8,
  /** Node radius when minimap is expanded */
  nodeRadiusExpanded: 18,
  /** Font size for labels when collapsed */
  fontSizeSmall: 6,
  /** Font size for labels when expanded */
  fontSizeExpanded: 11,
  /** Label offset from node center when collapsed */
  labelOffsetSmall: 14,
  /** Label offset from node center when expanded */
  labelOffsetExpanded: 28,
  /** Max label length when collapsed */
  maxLabelLengthSmall: 10,
  /** Max label length when expanded */
  maxLabelLengthExpanded: 20,
  /** Truncated label suffix length when collapsed */
  truncateLengthSmall: 7,
  /** Truncated label suffix length when expanded */
  truncateLengthExpanded: 17,
  /** Node stroke width when collapsed */
  strokeWidthSmall: 1,
  /** Node stroke width when expanded */
  strokeWidthExpanded: 2,
  /** Edge stroke width when collapsed */
  edgeStrokeWidthSmall: 1,
  /** Edge stroke width when expanded */
  edgeStrokeWidthExpanded: 1.5,
  /** Curve perpendicular offset for edges */
  edgeCurveOffset: 20,
  /** Edge stroke opacity */
  edgeStrokeOpacity: 0.6,
  /** Edge label background color (expanded view) */
  edgeLabelBgColor: '#333',
  /** Edge label background opacity */
  edgeLabelBgOpacity: 0.9,
  /** Edge label rect dimensions (expanded) */
  edgeLabelRectWidth: 60,
  edgeLabelRectHeight: 14,
  edgeLabelRectX: -30,
  edgeLabelRectY: -8,
  /** Edge label font size */
  edgeLabelFontSize: 8,
} as const;

/**
 * Get graph node styling based on expanded state
 */
export function getGraphNodeStyle(isExpanded: boolean) {
  return {
    nodeRadius: isExpanded ? GRAPH_NODE_STYLES.nodeRadiusExpanded : GRAPH_NODE_STYLES.nodeRadiusSmall,
    fontSize: isExpanded ? GRAPH_NODE_STYLES.fontSizeExpanded : GRAPH_NODE_STYLES.fontSizeSmall,
    labelOffset: isExpanded ? GRAPH_NODE_STYLES.labelOffsetExpanded : GRAPH_NODE_STYLES.labelOffsetSmall,
    maxLabelLength: isExpanded ? GRAPH_NODE_STYLES.maxLabelLengthExpanded : GRAPH_NODE_STYLES.maxLabelLengthSmall,
    truncateLength: isExpanded ? GRAPH_NODE_STYLES.truncateLengthExpanded : GRAPH_NODE_STYLES.truncateLengthSmall,
    strokeWidth: isExpanded ? GRAPH_NODE_STYLES.strokeWidthExpanded : GRAPH_NODE_STYLES.strokeWidthSmall,
    edgeStrokeWidth: isExpanded ? GRAPH_NODE_STYLES.edgeStrokeWidthExpanded : GRAPH_NODE_STYLES.edgeStrokeWidthSmall,
  };
}

/**
 * Animation timing constants
 */
export const ANIMATION_STYLES = {
  /** Line draw animation duration in seconds */
  lineDrawDuration: 0.6,
  /** Fade in animation duration in seconds */
  fadeInDuration: 0.3,
  /** Delay between consecutive lines in seconds */
  staggerDelay: 0.1,
  /** Appear animation duration in seconds */
  appearDuration: 0.3,
} as const;

/**
 * Generate CSS keyframes for line drawing animation
 */
export function getLineAnimationCSS(prefix = 'xtm'): string {
  return `
    @keyframes ${prefix}-draw-line {
      from {
        stroke-dashoffset: 1000;
      }
      to {
        stroke-dashoffset: 0;
      }
    }
    
    @keyframes ${prefix}-fade-in {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    @keyframes ${prefix}-appear {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
}

/**
 * Generate inline style for animated line path
 */
export function getLinePathStyle(index: number): string {
  return `
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
    animation: xtm-draw-line ${ANIMATION_STYLES.lineDrawDuration}s ease-out forwards;
    animation-delay: ${index * ANIMATION_STYLES.staggerDelay}s;
  `;
}

/**
 * Generate inline style for animated label
 */
export function getLabelStyle(index: number): string {
  const delay = index * ANIMATION_STYLES.staggerDelay + ANIMATION_STYLES.fadeInDuration;
  return `
    opacity: 0;
    animation: xtm-fade-in ${ANIMATION_STYLES.fadeInDuration}s ease-out forwards;
    animation-delay: ${delay}s;
  `;
}

