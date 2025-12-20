/**
 * Relationship Styles
 * 
 * Shared styling constants for relationship lines.
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
 * Animation timing constants
 */
export const ANIMATION_STYLES = {
  /** Line draw animation duration in seconds */
  lineDrawDuration: 0.6,
  /** Fade in animation duration in seconds */
  fadeInDuration: 0.3,
  /** Delay between consecutive lines in seconds */
  staggerDelay: 0.1,
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
