/**
 * Highlight Utilities
 * 
 * Common utilities for creating and managing highlights across different contexts
 * (regular scan, investigation, atomic testing, scenarios, AI discovery).
 */

import { HIGHLIGHT_STYLES } from '../styles';

// Track shadow roots that have had styles injected
const styledShadowRoots = new WeakSet<ShadowRoot>();

/**
 * Ensure highlight styles are injected into a shadow root
 * This is necessary because Shadow DOM has style encapsulation
 */
export function ensureStylesInShadowRoot(node: Node): void {
  // Find the shadow root this node belongs to, if any
  let current: Node | null = node;
  while (current) {
    if (current instanceof ShadowRoot) {
      if (!styledShadowRoots.has(current)) {
        // Inject styles into this shadow root
        const styleEl = document.createElement('style');
        styleEl.setAttribute('data-xtm-highlight-styles', 'true');
        styleEl.textContent = HIGHLIGHT_STYLES;
        current.appendChild(styleEl);
        styledShadowRoots.add(current);
      }
      return;
    }
    current = current.parentNode;
  }
}

/**
 * Event handlers type for highlight interactions
 */
export interface HighlightEventHandlers {
  onHover: (e: MouseEvent) => void;
  onLeave: (e: MouseEvent) => void;
  onClick: (e: MouseEvent) => void;
  onRightClick: (e: MouseEvent) => void;
  onMouseDown: (e: MouseEvent) => void;
  onMouseUp: (e: MouseEvent) => void;
}

/**
 * Node map entry for text node tracking
 */
export interface NodeMapEntry {
  node: Text;
  start: number;
  end: number;
}

/**
 * Options for creating a highlight element
 */
export interface CreateHighlightOptions {
  type: string;
  value: string;
  found: boolean;
  entity: unknown;
  className?: string;
  additionalClasses?: string[];
  dataAttributes?: Record<string, string>;
  handlers?: HighlightEventHandlers;
}

/**
 * Create a highlight span element with the specified options
 */
export function createHighlightElement(options: CreateHighlightOptions): HTMLSpanElement {
  const highlight = document.createElement('span');
  highlight.className = options.className || 'xtm-highlight';
  
  // Add additional classes
  if (options.additionalClasses) {
    options.additionalClasses.forEach(cls => highlight.classList.add(cls));
  }
  
  // Set data attributes
  highlight.dataset.type = options.type;
  highlight.dataset.value = options.value;
  highlight.dataset.found = String(options.found);
  highlight.dataset.entity = JSON.stringify(options.entity);
  
  // Add any custom data attributes
  if (options.dataAttributes) {
    Object.entries(options.dataAttributes).forEach(([key, value]) => {
      highlight.dataset[key] = value;
    });
  }
  
  // Add event handlers
  if (options.handlers) {
    highlight.addEventListener('mouseenter', options.handlers.onHover, { capture: true });
    highlight.addEventListener('mouseleave', options.handlers.onLeave, { capture: true });
    highlight.addEventListener('click', options.handlers.onClick, { capture: true });
    highlight.addEventListener('mousedown', options.handlers.onMouseDown, { capture: true });
    highlight.addEventListener('mouseup', options.handlers.onMouseUp, { capture: true });
    highlight.addEventListener('contextmenu', options.handlers.onRightClick, { capture: true });
  }
  
  return highlight;
}

/**
 * Match position information for highlighting
 */
export interface MatchPosition {
  pos: number;
  node: Text;
  localStart: number;
  localEnd: number;
}

/**
 * Find all occurrences of a search value in the text and collect match positions
 */
export function findMatchPositions(
  fullText: string,
  searchValue: string,
  nodeMap: NodeMapEntry[],
  options: { caseSensitive?: boolean; skipHighlighted?: boolean } = {}
): MatchPosition[] {
  const { caseSensitive = false, skipHighlighted = true } = options;
  
  if (!searchValue || searchValue.length < 2) return [];
  
  const searchText = caseSensitive ? searchValue : searchValue.toLowerCase();
  const textToSearch = caseSensitive ? fullText : fullText.toLowerCase();
  
  const matches: MatchPosition[] = [];
  let pos = 0;
  
  while ((pos = textToSearch.indexOf(searchText, pos)) !== -1) {
    const endPos = pos + searchValue.length;
    
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        // Skip if already highlighted
        if (skipHighlighted && node.parentElement?.closest('.xtm-highlight')) {
          break;
        }
        
        const nodeText = node.textContent || '';
        const localStart = pos - start;
        const localEnd = Math.min(localStart + searchValue.length, nodeText.length);
        
        const textToHighlight = nodeText.substring(localStart, localEnd);
        const expectedText = caseSensitive 
          ? searchValue.substring(0, textToHighlight.length)
          : searchValue.substring(0, textToHighlight.length).toLowerCase();
        const actualText = caseSensitive 
          ? textToHighlight 
          : textToHighlight.toLowerCase();
          
        if (!textToHighlight || actualText !== expectedText) {
          break;
        }
        
        if (localEnd <= nodeText.length && textToHighlight.length > 0) {
          matches.push({ pos, node, localStart, localEnd });
        }
        break;
      }
    }
    
    pos = endPos;
  }
  
  return matches;
}

/**
 * Apply highlights in reverse order to avoid DOM position invalidation
 */
export function applyHighlightsInReverse(
  matches: MatchPosition[],
  createHighlight: (node: Text, localStart: number, localEnd: number) => HTMLSpanElement | null,
  highlightsList: HTMLElement[]
): void {
  for (let i = matches.length - 1; i >= 0; i--) {
    const { node, localStart, localEnd } = matches[i];
    
    try {
      // Verify node is still valid and not already highlighted
      if (!node.parentNode || node.parentElement?.closest('.xtm-highlight')) {
        continue;
      }
      
      const currentNodeText = node.textContent || '';
      if (localEnd > currentNodeText.length) {
        continue;
      }
      
      // Ensure styles are injected if this node is in a Shadow DOM
      ensureStylesInShadowRoot(node);
      
      const range = document.createRange();
      range.setStart(node, localStart);
      range.setEnd(node, localEnd);
      
      if (range.toString().trim().length === 0) {
        continue;
      }
      
      const highlight = createHighlight(node, localStart, localEnd);
      if (highlight) {
        range.surroundContents(highlight);
        highlightsList.push(highlight);
      }
    } catch {
      // Range might cross node boundaries or node may have been modified
    }
  }
}

/**
 * Scroll to a highlight element with a flash animation
 */
export function scrollToAndFlashHighlight(highlight: HTMLElement): void {
  // Scroll to center the highlight in viewport
  highlight.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center',
  });
  
  // Add glow effect
  highlight.classList.add('xtm-glow');
  
  // Remove glow after animation completes
  setTimeout(() => {
    highlight.classList.remove('xtm-glow');
  }, 3000);
}

/**
 * Check if a character is a valid word boundary for exact matching
 */
export function isValidWordBoundary(char: string | undefined): boolean {
  if (!char) return true;
  // Word boundaries are: whitespace, punctuation, start/end of string
  return /[\s.,;:!?'"()[\]{}<>/\\|@#$%^&*+=~`\-_]/.test(char);
}

