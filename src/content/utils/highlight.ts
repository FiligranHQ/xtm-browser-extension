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
  onHover?: (e: MouseEvent) => void;
  onLeave?: (e: MouseEvent) => void;
  onClick?: (e: MouseEvent) => void;
  onRightClick?: (e: MouseEvent) => void;
  onMouseDown?: (e: MouseEvent) => void;
  onMouseUp?: (e: MouseEvent) => void;
}

/**
 * Attach event handlers to a highlight element
 * Centralized helper to avoid code duplication
 */
export function attachHighlightEventHandlers(
  element: HTMLElement,
  handlers: HighlightEventHandlers
): void {
  const eventMap: Array<[keyof HighlightEventHandlers, string]> = [
    ['onHover', 'mouseenter'],
    ['onLeave', 'mouseleave'],
    ['onClick', 'click'],
    ['onMouseDown', 'mousedown'],
    ['onMouseUp', 'mouseup'],
    ['onRightClick', 'contextmenu'],
  ];
  
  for (const [handlerKey, eventName] of eventMap) {
    const handler = handlers[handlerKey];
    if (handler) {
      element.addEventListener(eventName, handler as EventListener, { capture: true });
    }
  }
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
    attachHighlightEventHandlers(highlight, options.handlers);
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
 * This is a convenience wrapper around findMatchPositionsWithBoundaries
 */
export function findMatchPositions(
  fullText: string,
  searchValue: string,
  nodeMap: NodeMapEntry[],
  options: { caseSensitive?: boolean; skipHighlighted?: boolean } = {}
): MatchPosition[] {
  return findMatchPositionsWithBoundaries(fullText, searchValue, nodeMap, {
    caseSensitive: options.caseSensitive,
    skipHighlighted: options.skipHighlighted,
    checkBoundaries: false,
  });
}

/**
 * Validate a match position and create a range for highlighting
 * Returns null if the match is invalid or should be skipped
 */
function validateMatchAndCreateRange(
  node: Text,
  localStart: number,
  localEnd: number
): Range | null {
  // Verify node is still valid and not already highlighted
  if (!node.parentNode || node.parentElement?.closest('.xtm-highlight')) {
    return null;
  }
  
  const currentNodeText = node.textContent || '';
  if (localEnd > currentNodeText.length) {
    return null;
  }
  
  // Ensure styles are injected if this node is in a Shadow DOM
  ensureStylesInShadowRoot(node);
  
  const range = document.createRange();
  range.setStart(node, localStart);
  range.setEnd(node, localEnd);
  
  if (range.toString().trim().length === 0) {
    return null;
  }
  
  return range;
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
      const range = validateMatchAndCreateRange(node, localStart, localEnd);
      if (!range) continue;
      
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
 * Extended match info with optional match length (for regex matches)
 */
export interface ExtendedMatchInfo extends MatchPosition {
  matchLength?: number;
}

/**
 * Configuration for creating a highlight element
 */
export interface HighlightConfig {
  className: string;
  dataAttributes: Record<string, string>;
  handlers?: HighlightEventHandlers;
}

/**
 * Apply highlights using a config factory pattern
 * More flexible version that supports both callback and config-based highlight creation
 * 
 * @param matches - Array of match positions to highlight
 * @param createConfig - Factory function that creates highlight config from match info
 * @param highlightsList - Array to push created highlights to (optional)
 * @returns Array of created highlight elements
 */
export function applyHighlightsWithConfig<T extends ExtendedMatchInfo>(
  matches: T[],
  createConfig: (match: T) => HighlightConfig | null,
  highlightsList?: HTMLElement[]
): HTMLElement[] {
  const createdHighlights: HTMLElement[] = [];
  
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const { node, localStart, localEnd } = match;
    
    try {
      const range = validateMatchAndCreateRange(node, localStart, localEnd);
      if (!range) continue;
      
      const config = createConfig(match);
      if (!config) continue;
      
      // Create highlight element from config
      const highlight = document.createElement('span');
      highlight.className = config.className;
      
      // Set data attributes
      Object.entries(config.dataAttributes).forEach(([key, value]) => {
        highlight.dataset[key] = value;
      });
      
      // Add event handlers
      if (config.handlers) {
        attachHighlightEventHandlers(highlight, config.handlers);
      }
      
      range.surroundContents(highlight);
      createdHighlights.push(highlight);
      if (highlightsList) {
        highlightsList.push(highlight);
      }
    } catch {
      // Range might cross node boundaries or node may have been modified
    }
  }
  
  return createdHighlights;
}

/**
 * Check if a character is a valid word boundary for highlighting
 * Only whitespace, sentence punctuation, or undefined (start/end of text) are valid.
 * 
 * IMPORTANT: Does NOT include '.', '-', '_', '[', ']' as boundaries because:
 * - '.', '-', '_' appear in identifiers (domains, hostnames)
 * - '[', ']' are used for defanging URLs (e.g., dl[.]software-update.org)
 * e.g., "Software" should NOT match in "dl[.]software-update.org"
 *       "Linux" should NOT match in "oaev-test-linux-01"
 */
function isValidHighlightBoundary(char: string | undefined): boolean {
  if (!char) return true; // undefined = start/end of text
  // Only whitespace and sentence-ending punctuation are valid boundaries
  // NOT: . - _ [ ] (these appear in identifiers/domains or defanged URLs)
  return /[\s,;:!?()"'<>/\\@#$%^&*+=|`~\n\r\t{}]/.test(char);
}

/**
 * Default word boundary checker - returns true if both sides are valid word boundaries
 * A valid word boundary is whitespace, sentence punctuation, or start/end of string.
 * 
 * Note: '.' '-' '_' are NOT considered valid boundaries to prevent false positives
 * in domains (dl.software-update.org) and identifiers (oaev-test-linux-01).
 */
export function isWordBoundary(
  charBefore: string | undefined, 
  charAfter: string | undefined,
  _fullText?: string,
  _matchEndPos?: number
): boolean {
  return isValidHighlightBoundary(charBefore) && isValidHighlightBoundary(charAfter);
}

/**
 * Options for finding match positions with boundary checking
 */
export interface FindMatchOptions {
  caseSensitive?: boolean;
  skipHighlighted?: boolean;
  checkBoundaries?: boolean;
  boundaryChecker?: (charBefore: string | undefined, charAfter: string | undefined, fullText?: string, matchEndPos?: number) => boolean;
}

/**
 * Find all occurrences of a search value with optional boundary checking
 * Enhanced version that supports word boundary validation
 */
export function findMatchPositionsWithBoundaries(
  fullText: string,
  searchValue: string,
  nodeMap: NodeMapEntry[],
  options: FindMatchOptions = {}
): MatchPosition[] {
  const { 
    caseSensitive = false, 
    skipHighlighted = true,
    checkBoundaries = false,
    boundaryChecker = isWordBoundary, // Use default word boundary checker
  } = options;
  
  if (!searchValue || searchValue.length < 2) return [];
  
  const searchText = caseSensitive ? searchValue : searchValue.toLowerCase();
  const textToSearch = caseSensitive ? fullText : fullText.toLowerCase();
  
  const matches: MatchPosition[] = [];
  let pos = 0;
  
  while ((pos = textToSearch.indexOf(searchText, pos)) !== -1) {
    const endPos = pos + searchValue.length;
    
    // Check word boundaries if required (now uses default boundary checker)
    // Pass fullText and endPos for MITRE sub-technique detection
    if (checkBoundaries) {
      const charBefore = pos > 0 ? fullText[pos - 1] : undefined;
      const charAfter = endPos < fullText.length ? fullText[endPos] : undefined;
      if (!boundaryChecker(charBefore, charAfter, fullText, endPos)) {
        pos++;
        continue;
      }
    }
    
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        // Skip if already highlighted - continue to check other nodes instead of breaking
        // This handles cases where the nodeMap may have stale highlighted nodes
        if (skipHighlighted && node.parentElement?.closest('.xtm-highlight')) {
          continue;
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
 * Collect matches using a regex pattern
 */
export function collectRegexMatches(
  fullText: string,
  pattern: RegExp,
  nodeMap: NodeMapEntry[],
  skipHighlighted = true
): ExtendedMatchInfo[] {
  const matches: ExtendedMatchInfo[] = [];
  
  let match;
  while ((match = pattern.exec(fullText)) !== null) {
    const pos = match.index;
    const matchLength = match[0].length;
    
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        // Skip if already highlighted - continue to check other nodes instead of breaking
        if (skipHighlighted && node.parentElement?.closest('.xtm-highlight')) continue;
        
        const nodeText = node.textContent || '';
        const localStart = pos - start;
        const localEnd = Math.min(localStart + matchLength, nodeText.length);
        
        if (localEnd <= nodeText.length) {
          matches.push({ pos, matchLength, node, localStart, localEnd });
        }
        break;
      }
    }
  }
  
  return matches;
}

