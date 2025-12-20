/**
 * Highlighting Module
 * Handles creating, managing, and interacting with highlights on the page.
 */

import { loggers } from '../shared/utils/logger';
import type { DetectedObservable } from '../shared/types/observables';
import type { DetectedOCTIEntity } from '../shared/types/opencti';
import type { ScanResultPayload } from '../shared/types/messages';
import { getTextNodes } from '../shared/detection/text-utils';
import {
  createPrefixedType,
  type PlatformType,
} from '../shared/platform/registry';
import { HIGHLIGHT_STYLES } from './styles';

const log = loggers.content;

// Track shadow roots that have had styles injected
const styledShadowRoots = new WeakSet<ShadowRoot>();

/**
 * Ensure highlight styles are injected into a shadow root
 * This is necessary because Shadow DOM has style encapsulation
 */
function ensureStylesInShadowRoot(node: Node): void {
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
        log.debug('Injected highlight styles into shadow root');
      }
      return;
    }
    current = current.parentNode;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface HighlightMeta {
  type: string;
  found: boolean;
  data: DetectedObservable | DetectedOCTIEntity;
  isOpenCTIEntity?: boolean; // Flag to indicate if this is an OpenCTI entity (can be added via AI discovery)
  foundInPlatforms?: Array<{
    platformType: string;
    type: string;
    found: boolean;
    data: unknown;
  }>;
}

// OpenCTI Types - these are detected from platform cache
// When not found, they can be added via AI discovery feature
const OPENCTI_TYPES_SET = new Set([
  'Intrusion-Set',
  'Malware',
  'Threat-Actor',
  'Threat-Actor-Group',
  'Threat-Actor-Individual',
  'Attack-Pattern',
  'Campaign',
  'Incident',
  'Vulnerability',
  'Tool',
  'Infrastructure',
  'Sector',
  'Organization',
  'Individual',
  'Event',
  'Country',
  'Region',
  'City',
  'Administrative-Area',
  'Position',
  'Report',
  'Note',
  'Grouping',
  'Case-Incident',
  'Case-Rfi',
  'Case-Rft',
  'Feedback',
]);

export interface NodeMapEntry {
  node: Text;
  start: number;
  end: number;
}

// ============================================================================
// State
// ============================================================================

let highlights: HTMLElement[] = [];

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get current highlights array
 */
export function getHighlights(): HTMLElement[] {
  return highlights;
}

/**
 * Add a highlight to the tracked array
 */
export function addHighlight(el: HTMLElement): void {
  highlights.push(el);
}

/**
 * Clear all highlights from the page
 */
export function clearHighlights(): void {
  highlights.forEach((el) => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent || ''), el);
      parent.normalize();
    }
  });
  highlights = [];
}

/**
 * Build a node map for text matching
 * Note: We join text nodes WITHOUT spaces to enable matching entities
 * that span multiple text nodes (e.g., CVE-2021-44228 split across elements).
 * The offset calculation must match the join method.
 */
export function buildNodeMap(textNodes: Text[]): { nodeMap: NodeMapEntry[]; fullText: string } {
  let offset = 0;
  const nodeMap: NodeMapEntry[] = [];
  
  textNodes.forEach((node) => {
    const text = node.textContent || '';
    nodeMap.push({
      node,
      start: offset,
      end: offset + text.length,
    });
    offset += text.length; // No +1 - join without spaces for accurate matching
  });
  
  // Join without spaces to allow matching entities that span text nodes
  const fullText = textNodes.map((n) => n.textContent).join('');
  
  return { nodeMap, fullText };
}

/**
 * Check if a character is a valid word boundary
 */
export function isValidWordBoundary(char: string | undefined): boolean {
  if (!char || char === '') return true;
  if (/[\s,;:!?()[\]"'<>/\\@#$%^&*+=|`~\n\r\t.]/.test(char)) return true;
  return !/[a-zA-Z0-9]/.test(char);
}

// ============================================================================
// Scan Results Highlighting
// ============================================================================

/**
 * Highlight scan results on the page
 */
export function highlightResults(
  results: ScanResultPayload,
  handlers: {
    onHover: (e: MouseEvent) => void;
    onLeave: () => void;
    onClick: (e: MouseEvent) => void;
    onRightClick: (e: MouseEvent) => void;
    onMouseDown: (e: MouseEvent) => void;
    onMouseUp: (e: MouseEvent) => void;
  }
): void {
  // Build initial node map - will be rebuilt after each entity type to handle DOM modifications
  let textNodes = getTextNodes(document.body);
  let { nodeMap, fullText } = buildNodeMap(textNodes);
  
  // Build a map of values to their platform findings
  const valueToPlatformEntities: Map<string, {
    platformType: string;
    type: string;
    found: boolean;
    data: unknown;
  }[]> = new Map();
  
  // Collect OpenCTI observables by value
  for (const obs of results.observables) {
    if (obs.found) {
      const valueLower = obs.value.toLowerCase();
      if (!valueToPlatformEntities.has(valueLower)) {
        valueToPlatformEntities.set(valueLower, []);
      }
      valueToPlatformEntities.get(valueLower)!.push({
        platformType: 'opencti',
        type: obs.type,
        found: true,
        data: obs,
      });
    }
  }
  
  // Collect OpenCTI entities by name
  for (const octiEntity of results.openctiEntities) {
    if (octiEntity.found) {
      const valueLower = octiEntity.name.toLowerCase();
      if (!valueToPlatformEntities.has(valueLower)) {
        valueToPlatformEntities.set(valueLower, []);
      }
      valueToPlatformEntities.get(valueLower)!.push({
        platformType: 'opencti',
        type: octiEntity.type,
        found: true,
        data: octiEntity,
      });
    }
  }
  
  // Collect platform entities
  if (results.openaevEntities) {
    for (const entity of results.openaevEntities) {
      const valueLower = entity.name.toLowerCase();
      if (!valueToPlatformEntities.has(valueLower)) {
        valueToPlatformEntities.set(valueLower, []);
      }
      const platformType = (entity.platformType || 'openaev') as PlatformType;
      valueToPlatformEntities.get(valueLower)!.push({
        platformType,
        type: createPrefixedType(entity.type, platformType),
        found: entity.found,
        data: entity,
      });
    }
  }
  
  // Helper to find platform matches including substrings
  const findPlatformMatchesWithSubstrings = (valueLower: string) => {
    const matches: Array<{ platformType: string; type: string; found: boolean; data: unknown }> = [];
    
    const exactMatches = valueToPlatformEntities.get(valueLower);
    if (exactMatches) {
      matches.push(...exactMatches.filter(p => p.platformType !== 'opencti' && p.found));
    }
    
    for (const [key, entities] of valueToPlatformEntities) {
      if (key !== valueLower && key.includes(valueLower)) {
        matches.push(...entities.filter(p => p.platformType !== 'opencti' && p.found));
      }
    }
    
    for (const [key, entities] of valueToPlatformEntities) {
      if (key !== valueLower && valueLower.includes(key) && key.length >= 4) {
        matches.push(...entities.filter(p => p.platformType !== 'opencti' && p.found));
      }
    }
    
    return matches;
  };
  
  // Highlight observables
  for (const obs of results.observables) {
    const valueLower = obs.value.toLowerCase();
    const otherPlatformMatches = findPlatformMatchesWithSubstrings(valueLower);
    
    highlightInText(fullText, obs.value, nodeMap, {
      type: obs.type,
      found: obs.found,
      data: obs,
      foundInPlatforms: otherPlatformMatches.length > 0 ? otherPlatformMatches : undefined,
    }, handlers);
  }
  
  // Highlight OpenCTI entities (can be added via AI discovery when not found)
  for (const octiEntity of results.openctiEntities) {
    const textToHighlight = (octiEntity as { matchedValue?: string }).matchedValue || octiEntity.name;
    const valueLower = octiEntity.name.toLowerCase();
    const otherPlatformMatches = findPlatformMatchesWithSubstrings(valueLower);
    
    highlightInText(fullText, textToHighlight, nodeMap, {
      type: octiEntity.type,
      found: octiEntity.found,
      data: octiEntity,
      isOpenCTIEntity: true, // OpenCTI entities can be added via AI discovery
      foundInPlatforms: otherPlatformMatches.length > 0 ? otherPlatformMatches : undefined,
    }, handlers);
  }
  
  // Highlight CVEs (Vulnerability entities)
  // CVEs are detected via regex and enriched across both OpenCTI and OpenAEV platforms
  // They are handled separately from cached entities because they use pattern-based detection
  // CVEs need special handling because the same CVE might appear with different dash characters
  // (e.g., U+002D hyphen-minus vs U+2011 non-breaking hyphen) in different locations on the page
  // 
  // IMPORTANT: Rebuild nodeMap before processing CVEs because previous highlighting
  // (observables, OpenCTI entities) may have modified the DOM, invalidating the original nodeMap.
  // Without this rebuild, CVEs that appear in the same text nodes as previously highlighted
  // entities would fail to be highlighted.
  if (results.cves && results.cves.length > 0) {
    textNodes = getTextNodes(document.body);
    ({ nodeMap, fullText } = buildNodeMap(textNodes));
    
    for (const cve of results.cves) {
      // Build foundInPlatforms from platformMatches for multi-platform display
      const cvePlatformMatches = cve.platformMatches || [];
      const foundInPlatforms = cvePlatformMatches.map((pm: { type?: string; platformType?: string; entityId?: string; platformId?: string; entityData?: unknown }) => ({
        type: pm.type || 'Vulnerability',
        platformType: pm.platformType || 'opencti',
        found: true, // platformMatches only contain found platforms
        data: {
          entityId: pm.entityId,
          platformId: pm.platformId,
          platformType: pm.platformType || 'opencti',
          type: pm.type || 'Vulnerability',
          entityData: pm.entityData,
        },
      }));
      
      // Use flexible CVE highlighting that matches any dash variant
      highlightCVEInText(fullText, cve.name, nodeMap, {
        type: cve.type,
        found: cve.found,
        data: cve,
        isOpenCTIEntity: true, // Flag for AI discovery feature (can add to OpenCTI if not found)
        foundInPlatforms: foundInPlatforms.length > 0 ? foundInPlatforms : undefined,
      }, handlers);
    }
  }
  
  // Highlight platform entities
  // Rebuild nodeMap as CVE highlighting may have modified the DOM
  if (results.openaevEntities && results.openaevEntities.length > 0) {
    textNodes = getTextNodes(document.body);
    ({ nodeMap, fullText } = buildNodeMap(textNodes));
    
    for (const entity of results.openaevEntities) {
      const entityPlatformType = (entity.platformType || 'openaev') as PlatformType;
      const prefixedType = createPrefixedType(entity.type, entityPlatformType);
      const textToHighlight = entity.value || entity.name;
      highlightInText(fullText, textToHighlight, nodeMap, {
        type: prefixedType,
        found: entity.found,
        data: entity as unknown as DetectedOCTIEntity,
      }, handlers);
    }
  }
}

// All dash-like characters that might be used in CVEs
// This includes: hyphen-minus, hyphen, non-breaking hyphen, figure dash, en dash, em dash,
// horizontal bar, minus sign, soft hyphen, small hyphen-minus, fullwidth hyphen-minus
// Also handles zero-width characters that may be inserted by web rendering:
// - Zero-width space \u200B
// - Zero-width non-joiner \u200C
// - Zero-width joiner \u200D
// - Word joiner \u2060
// - Zero-width no-break space (BOM) \uFEFF

/**
 * Create a regex pattern for a CVE that matches any dash variant and invisible characters
 * Converts "CVE-2025-66478" to a pattern that matches CVE with any dash character
 * Also allows optional whitespace and zero-width chars around dashes (for web content)
 */
function createFlexibleCVEPattern(cveName: string): RegExp {
  // CVE name format: CVE-YYYY-NNNNN
  // Extract the parts: CVE, year, sequence number
  const match = cveName.match(/^CVE[^\d]*(\d{4})[^\d]*(\d{4,7})$/i);
  if (!match) {
    // Fallback: create pattern that matches the CVE with flexible dashes
    const parts = cveName.match(/CVE[^\d]*(\d+)[^\d]*(\d+)/i);
    if (parts) {
      const [, y, s] = parts;
      const dashClass = `[\\-\\u002D\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2212\\u00AD\\uFE63\\uFF0D]`;
      const invisibleClass = `[\\s\\u200B\\u200C\\u200D\\u2060\\uFEFF]*`;
      return new RegExp(`CVE${invisibleClass}${dashClass}${invisibleClass}${y}${invisibleClass}${dashClass}${invisibleClass}${s}`, 'gi');
    }
    return new RegExp(cveName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  }
  
  const [, year, seq] = match;
  // Build pattern: CVE + optional invisible + any dash + optional invisible + year + ...
  // Use character class with all dash variants and invisible characters
  const dashClass = `[\\-\\u002D\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2212\\u00AD\\uFE63\\uFF0D]`;
  const invisibleClass = `[\\s\\u200B\\u200C\\u200D\\u2060\\uFEFF]*`;
  const pattern = `CVE${invisibleClass}${dashClass}${invisibleClass}${year}${invisibleClass}${dashClass}${invisibleClass}${seq}`;
  return new RegExp(pattern, 'gi');
}

/**
 * Highlight CVE in text with flexible dash matching
 * CVEs might appear with different dash characters (U+002D, U+2011, etc.) in different locations
 * This function uses a regex to match any dash variant
 */
function highlightCVEInText(
  fullText: string,
  cveName: string,
  nodeMap: NodeMapEntry[],
  meta: HighlightMeta,
  handlers: {
    onHover: (e: MouseEvent) => void;
    onLeave: () => void;
    onClick: (e: MouseEvent) => void;
    onRightClick: (e: MouseEvent) => void;
    onMouseDown: (e: MouseEvent) => void;
    onMouseUp: (e: MouseEvent) => void;
  }
): void {
  if (!cveName || cveName.length < 2) return;
  
  const cvePattern = createFlexibleCVEPattern(cveName);
  
  // First pass: collect all match positions using regex
  interface MatchInfo {
    pos: number;
    matchLength: number;
    node: Text;
    localStart: number;
    localEnd: number;
  }
  const matchesToHighlight: MatchInfo[] = [];
  
  let match;
  while ((match = cvePattern.exec(fullText)) !== null) {
    const pos = match.index;
    const matchLength = match[0].length;
    
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        // Skip if already highlighted
        if (node.parentElement?.closest('.xtm-highlight')) {
          break;
        }
        
        const nodeText = node.textContent || '';
        const localStart = pos - start;
        const localEnd = Math.min(localStart + matchLength, nodeText.length);
        
        if (localEnd <= nodeText.length) {
          matchesToHighlight.push({ pos, matchLength, node, localStart, localEnd });
        }
        break;
      }
    }
  }
  
  // Second pass: highlight in REVERSE order
  for (let i = matchesToHighlight.length - 1; i >= 0; i--) {
    const { node, localStart, localEnd } = matchesToHighlight[i];
    
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
      
      const highlight = document.createElement('span');
      highlight.className = 'xtm-highlight';
      
      // Determine if this is an OpenCTI entity (check flag or type)
      const isOpenCTIEntity = meta.isOpenCTIEntity || OPENCTI_TYPES_SET.has(meta.type);
      
      if (meta.found) {
        highlight.classList.add('xtm-found');
      } else if (isOpenCTIEntity) {
        highlight.classList.add('xtm-entity-not-addable');
      } else {
        highlight.classList.add('xtm-not-found');
      }
      
      highlight.dataset.type = meta.type;
      highlight.dataset.value = cveName; // Use normalized CVE name
      highlight.dataset.found = String(meta.found);
      highlight.dataset.entity = JSON.stringify(meta.data);
      
      // Check for mixed state
      const hasMixedState = !meta.found && meta.foundInPlatforms && meta.foundInPlatforms.length > 0;
      if (hasMixedState) {
        highlight.dataset.mixedState = 'true';
        highlight.dataset.platformEntities = JSON.stringify(meta.foundInPlatforms);
        highlight.classList.add('xtm-mixed-state');
      }
      
      // Store platform entities for multi-platform navigation
      if (meta.found && meta.foundInPlatforms && meta.foundInPlatforms.length > 0) {
        highlight.dataset.multiPlatform = 'true';
        highlight.dataset.platformEntities = JSON.stringify(meta.foundInPlatforms);
      }
      
      highlight.addEventListener('mouseenter', handlers.onHover, { capture: true });
      highlight.addEventListener('mouseleave', handlers.onLeave, { capture: true });
      highlight.addEventListener('click', handlers.onClick, { capture: true });
      highlight.addEventListener('mousedown', handlers.onMouseDown, { capture: true });
      highlight.addEventListener('mouseup', handlers.onMouseUp, { capture: true });
      highlight.addEventListener('contextmenu', handlers.onRightClick, { capture: true });
      
      range.surroundContents(highlight);
      highlights.push(highlight);
    } catch {
      // Range might cross node boundaries or node may have been modified
    }
  }
}

/**
 * Create a highlight in text
 * Collects all match positions first, then highlights in reverse order
 * to avoid DOM modifications invalidating subsequent match positions
 */
function highlightInText(
  fullText: string,
  searchValue: string,
  nodeMap: NodeMapEntry[],
  meta: HighlightMeta,
  handlers: {
    onHover: (e: MouseEvent) => void;
    onLeave: () => void;
    onClick: (e: MouseEvent) => void;
    onRightClick: (e: MouseEvent) => void;
    onMouseDown: (e: MouseEvent) => void;
    onMouseUp: (e: MouseEvent) => void;
  }
): void {
  if (!searchValue || searchValue.length < 2) return;
  
  const searchLower = searchValue.toLowerCase();
  const fullTextLower = fullText.toLowerCase();
  
  // First pass: collect all match positions
  interface MatchInfo {
    pos: number;
    node: Text;
    localStart: number;
    localEnd: number;
  }
  const matchesToHighlight: MatchInfo[] = [];
  
  let pos = 0;
  while ((pos = fullTextLower.indexOf(searchLower, pos)) !== -1) {
    const endPos = pos + searchValue.length;
    
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        // Skip if already highlighted
        if (node.parentElement?.closest('.xtm-highlight')) {
          break;
        }
        
        const nodeText = node.textContent || '';
        const localStart = pos - start;
        const localEnd = Math.min(localStart + searchValue.length, nodeText.length);
        
        const textToHighlight = nodeText.substring(localStart, localEnd);
        if (!textToHighlight || textToHighlight.toLowerCase() !== searchLower.substring(0, textToHighlight.length)) {
          break;
        }
        
        if (localEnd <= nodeText.length && textToHighlight.length > 0) {
          matchesToHighlight.push({ pos, node, localStart, localEnd });
        }
        break;
      }
    }
    
    pos = endPos;
  }
  
  // Second pass: highlight in REVERSE order to avoid DOM modifications
  // invalidating positions of earlier matches
  for (let i = matchesToHighlight.length - 1; i >= 0; i--) {
    const { node, localStart, localEnd } = matchesToHighlight[i];
    
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
      
      const highlight = document.createElement('span');
      highlight.className = 'xtm-highlight';
      
      // Determine if this is an OpenCTI entity (check flag or type)
      const isOpenCTIEntity = meta.isOpenCTIEntity || OPENCTI_TYPES_SET.has(meta.type);
      
      if (meta.found) {
        // Found in platform = green
        highlight.classList.add('xtm-found');
      } else if (isOpenCTIEntity) {
        // OpenCTI entity not found = gray (can be added via AI discovery)
        highlight.classList.add('xtm-entity-not-addable');
      } else {
        // Observable not found = amber (can be added directly)
        highlight.classList.add('xtm-not-found');
      }
      
      highlight.dataset.type = meta.type;
      highlight.dataset.value = searchValue;
      highlight.dataset.found = String(meta.found);
      highlight.dataset.entity = JSON.stringify(meta.data);
      
      // Check for mixed state: not found in main platform but found in other platforms
      const hasMixedState = !meta.found && meta.foundInPlatforms && meta.foundInPlatforms.length > 0;
      if (hasMixedState) {
        highlight.dataset.mixedState = 'true';
        highlight.dataset.platformEntities = JSON.stringify(meta.foundInPlatforms);
        // Add mixed state styling - amber with green indicator
        highlight.classList.add('xtm-mixed-state');
      }
      
      // Store platform entities for multi-platform navigation (when found)
      if (meta.found && meta.foundInPlatforms && meta.foundInPlatforms.length > 0) {
        highlight.dataset.multiPlatform = 'true';
        highlight.dataset.platformEntities = JSON.stringify(meta.foundInPlatforms);
      }
      
      highlight.addEventListener('mouseenter', handlers.onHover, { capture: true });
      highlight.addEventListener('mouseleave', handlers.onLeave, { capture: true });
      highlight.addEventListener('click', handlers.onClick, { capture: true });
      highlight.addEventListener('mousedown', handlers.onMouseDown, { capture: true });
      highlight.addEventListener('mouseup', handlers.onMouseUp, { capture: true });
      highlight.addEventListener('contextmenu', handlers.onRightClick, { capture: true });
      
      range.surroundContents(highlight);
      highlights.push(highlight);
    } catch {
      // Range might cross node boundaries or node may have been modified
    }
  }
}

// ============================================================================
// Investigation Highlighting
// ============================================================================

/**
 * Highlight results for investigation mode
 */
export function highlightResultsForInvestigation(
  results: ScanResultPayload,
  onHighlightClick: (highlight: HTMLElement) => void
): void {
  const textNodes = getTextNodes(document.body);
  const { nodeMap, fullText } = buildNodeMap(textNodes);
  
  for (const obs of results.observables) {
    highlightForInvestigation(
      fullText,
      obs.value,
      nodeMap,
      obs.type,
      obs.entityId,
      obs.platformId || (obs as { platformId?: string }).platformId,
      onHighlightClick
    );
  }
  
  for (const octiEntity of results.openctiEntities) {
    highlightForInvestigation(
      fullText,
      octiEntity.name,
      nodeMap,
      octiEntity.type,
      octiEntity.entityId,
      octiEntity.platformId || (octiEntity as { platformId?: string }).platformId,
      onHighlightClick
    );
  }
  
  // Investigation mode is OpenCTI-only - no OpenAEV entity highlighting
  
  // Highlight CVEs (Vulnerability entities) - these are detected via regex
  // CVEs need flexible dash matching because the same CVE might appear with different
  // dash characters (U+002D vs U+2011 etc.) in different locations on the page
  if (results.cves) {
    for (const cve of results.cves) {
      highlightCVEForInvestigation(
        fullText,
        cve.name,
        nodeMap,
        cve.type || 'Vulnerability',
        cve.entityId,
        cve.platformId,
        onHighlightClick
      );
    }
  }
}

/**
 * Highlight CVE for investigation mode with flexible dash matching
 */
function highlightCVEForInvestigation(
  fullText: string,
  cveName: string,
  nodeMap: NodeMapEntry[],
  entityType: string,
  entityId?: string,
  platformId?: string,
  onHighlightClick?: (highlight: HTMLElement) => void
): void {
  if (!cveName || cveName.length < 2) return;
  
  const cvePattern = createFlexibleCVEPattern(cveName);
  
  // First pass: collect all match positions using regex
  interface MatchInfo {
    matchLength: number;
    node: Text;
    localStart: number;
    localEnd: number;
  }
  const matchesToHighlight: MatchInfo[] = [];
  
  let match;
  while ((match = cvePattern.exec(fullText)) !== null) {
    const pos = match.index;
    const matchLength = match[0].length;
    
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        if (node.parentElement?.closest('.xtm-highlight')) {
          break;
        }
        
        const nodeText = node.textContent || '';
        const localStart = pos - start;
        const localEnd = Math.min(localStart + matchLength, nodeText.length);
        
        if (localEnd <= nodeText.length) {
          matchesToHighlight.push({ matchLength, node, localStart, localEnd });
        }
        break;
      }
    }
  }
  
  // Second pass: highlight in REVERSE order
  for (let i = matchesToHighlight.length - 1; i >= 0; i--) {
    const { node, localStart, localEnd } = matchesToHighlight[i];
    
    try {
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
      if (range.toString().trim().length === 0) continue;
      
      const highlight = document.createElement('span');
      highlight.className = 'xtm-highlight xtm-investigation';
      highlight.dataset.entityId = entityId || '';
      highlight.dataset.platformId = platformId || '';
      highlight.dataset.entityType = entityType;
      highlight.dataset.entityValue = cveName;
      
      if (onHighlightClick) {
        highlight.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          onHighlightClick(highlight);
        });
      }
      
      range.surroundContents(highlight);
      highlights.push(highlight);
    } catch {
      // Range might cross node boundaries or node may have been modified
    }
  }
}

function highlightForInvestigation(
  fullText: string,
  searchValue: string,
  nodeMap: NodeMapEntry[],
  entityType: string,
  entityId?: string,
  platformId?: string,
  onHighlightClick?: (highlight: HTMLElement) => void
): void {
  if (!searchValue || searchValue.length < 2) return;
  
  const searchLower = searchValue.toLowerCase();
  const fullTextLower = fullText.toLowerCase();
  
  // First pass: collect all match positions
  interface MatchInfo {
    node: Text;
    localStart: number;
    localEnd: number;
  }
  const matchesToHighlight: MatchInfo[] = [];
  
  let pos = 0;
  while ((pos = fullTextLower.indexOf(searchLower, pos)) !== -1) {
    const endPos = pos + searchValue.length;
    
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        if (node.parentElement?.closest('.xtm-highlight')) {
          break;
        }
        
        const nodeText = node.textContent || '';
        const localStart = pos - start;
        const localEnd = Math.min(localStart + searchValue.length, nodeText.length);
        
        if (localEnd <= nodeText.length) {
          matchesToHighlight.push({ node, localStart, localEnd });
        }
        break;
      }
    }
    
    pos = endPos;
  }
  
  // Second pass: highlight in REVERSE order
  for (let i = matchesToHighlight.length - 1; i >= 0; i--) {
    const { node, localStart, localEnd } = matchesToHighlight[i];
    
    try {
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
      if (range.toString().trim().length === 0) continue;
      
      const highlight = document.createElement('span');
      highlight.className = 'xtm-highlight xtm-investigation';
      highlight.dataset.entityId = entityId || '';
      highlight.dataset.platformId = platformId || '';
      highlight.dataset.entityType = entityType;
      highlight.dataset.entityValue = searchValue;
      
      if (onHighlightClick) {
        highlight.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onHighlightClick(highlight);
        });
      }
      
      range.surroundContents(highlight);
      highlights.push(highlight);
    } catch { /* ignore */ }
  }
}

// ============================================================================
// Atomic Testing & Scenario Highlighting
// ============================================================================

/**
 * Highlight for atomic testing mode
 * Uses two-pass reverse-order approach to handle multiple occurrences
 */
export function highlightForAtomicTesting(
  fullText: string,
  searchValue: string,
  nodeMap: NodeMapEntry[],
  target: { type: string; value: string; name: string; entityId?: string; platformId?: string; data: unknown }
): void {
  if (!searchValue || searchValue.length < 2) return;
  
  const searchLower = searchValue.toLowerCase();
  const fullTextLower = fullText.toLowerCase();
  
  // First pass: collect all match positions
  interface MatchInfo {
    node: Text;
    localStart: number;
    localEnd: number;
  }
  const matchesToHighlight: MatchInfo[] = [];
  
  let pos = 0;
  while ((pos = fullTextLower.indexOf(searchLower, pos)) !== -1) {
    const endPos = pos + searchValue.length;
    
    const charBefore = pos > 0 ? fullText[pos - 1] : undefined;
    const charAfter = endPos < fullText.length ? fullText[endPos] : undefined;
    
    if (!isValidWordBoundary(charBefore) || !isValidWordBoundary(charAfter)) {
      pos++;
      continue;
    }
    
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        if (node.parentElement?.closest('.xtm-highlight')) {
          break;
        }
        
        const nodeText = node.textContent || '';
        const localStart = pos - start;
        const localEnd = Math.min(localStart + searchValue.length, nodeText.length);
        
        const textToHighlight = nodeText.substring(localStart, localEnd);
        if (!textToHighlight || textToHighlight.toLowerCase() !== searchLower.substring(0, textToHighlight.length)) {
          break;
        }
        
        if (localEnd <= nodeText.length && textToHighlight.length > 0) {
          matchesToHighlight.push({ node, localStart, localEnd });
        }
        break;
      }
    }
    
    pos = endPos;
  }
  
  // Second pass: highlight in REVERSE order
  for (let i = matchesToHighlight.length - 1; i >= 0; i--) {
    const { node, localStart, localEnd } = matchesToHighlight[i];
    
    try {
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
      
      const highlight = document.createElement('span');
      const typeClass = target.type === 'attack-pattern' 
        ? 'xtm-atomic-attack-pattern' 
        : 'xtm-atomic-domain';
      highlight.className = `xtm-highlight xtm-atomic-testing ${typeClass}`;
      highlight.dataset.value = target.value;
      highlight.dataset.type = target.type;
      
      range.surroundContents(highlight);
      highlights.push(highlight);
    } catch { /* Range might cross node boundaries */ }
  }
}

/**
 * Highlight attack patterns for scenario mode
 */
export function highlightScenarioAttackPatterns(
  attackPatterns: Array<{ id: string; name: string; externalId?: string }>
): void {
  const textNodes = getTextNodes(document.body);
  const { nodeMap, fullText } = buildNodeMap(textNodes);
  
  for (const ap of attackPatterns) {
    highlightInTextForScenario(fullText, ap.name, nodeMap, ap);
    if (ap.externalId && ap.externalId !== ap.name) {
      highlightInTextForScenario(fullText, ap.externalId, nodeMap, ap);
    }
  }
}

/**
 * Highlight text for scenario mode
 * Uses two-pass reverse-order approach to handle multiple occurrences
 */
function highlightInTextForScenario(
  fullText: string,
  searchValue: string,
  nodeMap: NodeMapEntry[],
  attackPattern: { id: string; name: string }
): void {
  if (!searchValue || searchValue.length < 2) return;
  
  const searchLower = searchValue.toLowerCase();
  const fullTextLower = fullText.toLowerCase();
  
  // First pass: collect all match positions
  interface MatchInfo {
    node: Text;
    localStart: number;
    localEnd: number;
  }
  const matchesToHighlight: MatchInfo[] = [];
  
  let pos = 0;
  while ((pos = fullTextLower.indexOf(searchLower, pos)) !== -1) {
    const endPos = pos + searchValue.length;
    
    const charBefore = pos > 0 ? fullText[pos - 1] : undefined;
    const charAfter = endPos < fullText.length ? fullText[endPos] : undefined;
    
    if (!isValidWordBoundary(charBefore) || !isValidWordBoundary(charAfter)) {
      pos++;
      continue;
    }
    
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        if (node.parentElement?.closest('.xtm-highlight')) {
          break;
        }
        
        const nodeText = node.textContent || '';
        const localStart = pos - start;
        const localEnd = Math.min(localStart + searchValue.length, nodeText.length);
        
        const textToHighlight = nodeText.substring(localStart, localEnd);
        if (!textToHighlight || textToHighlight.toLowerCase() !== searchLower.substring(0, textToHighlight.length)) {
          break;
        }
        
        if (localEnd <= nodeText.length && textToHighlight.length > 0) {
          matchesToHighlight.push({ node, localStart, localEnd });
        }
        break;
      }
    }
    
    pos = endPos;
  }
  
  // Second pass: highlight in REVERSE order
  for (let i = matchesToHighlight.length - 1; i >= 0; i--) {
    const { node, localStart, localEnd } = matchesToHighlight[i];
    
    try {
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
      
      const highlight = document.createElement('span');
      highlight.className = 'xtm-highlight xtm-scenario';
      highlight.dataset.value = attackPattern.name;
      highlight.dataset.type = 'attack-pattern';
      highlight.dataset.entityId = attackPattern.id;
      
      range.surroundContents(highlight);
      highlights.push(highlight);
    } catch { /* Range might cross node boundaries */ }
  }
}

// ============================================================================
// AI Entity Highlighting
// ============================================================================

/**
 * Result of highlighting AI entities
 */
export interface HighlightAIResult {
  highlightedCount: number;
  highlightedEntities: Array<{ type: string; value: string; name: string }>;
  failedEntities: Array<{ type: string; value: string; name: string }>;
}

/**
 * Highlight AI-discovered entities on the page
 * Returns which entities were successfully highlighted vs which failed (not found in visible DOM)
 * @param entities - Array of entities to highlight
 * @param onToggleSelection - Callback when entity selection is toggled
 * @param onPanelReopen - Optional callback to re-open panel if it's hidden (called before selection toggle)
 */
export function highlightAIEntities(
  entities: Array<{ type: string; value: string; name: string }>,
  onToggleSelection: (highlight: HTMLElement, searchValue: string) => void,
  onPanelReopen?: () => void
): HighlightAIResult {
  const textNodes = getTextNodes(document.body);
  const { nodeMap, fullText } = buildNodeMap(textNodes);
  
  let highlightedCount = 0;
  const highlightedEntities: Array<{ type: string; value: string; name: string }> = [];
  const failedEntities: Array<{ type: string; value: string; name: string }> = [];
  
  for (const entity of entities) {
    const searchValue = entity.value || entity.name;
    if (!searchValue) {
      failedEntities.push(entity);
      continue;
    }
    
    const searchLower = searchValue.toLowerCase();
    const fullTextLower = fullText.toLowerCase();
    
    // First pass: collect all match positions for this entity
    interface MatchInfo {
      node: Text;
      localStart: number;
      localEnd: number;
    }
    const matchesToHighlight: MatchInfo[] = [];
    
    let pos = 0;
    while ((pos = fullTextLower.indexOf(searchLower, pos)) !== -1) {
      const endPos = pos + searchValue.length;
      
      for (const { node, start, end } of nodeMap) {
        if (pos >= start && pos < end) {
          // Skip if already highlighted
          if (node.parentElement?.closest('.xtm-highlight')) {
            break;
          }
          
          const nodeText = node.textContent || '';
          const localStart = pos - start;
          const localEnd = Math.min(localStart + searchValue.length, nodeText.length);
          
          if (localEnd <= nodeText.length) {
            matchesToHighlight.push({ node, localStart, localEnd });
          }
          break;
        }
      }
      
      pos = endPos;
    }
    
    let entityHighlighted = false;
    
    // Second pass: highlight in REVERSE order
    for (let i = matchesToHighlight.length - 1; i >= 0; i--) {
      const { node, localStart, localEnd } = matchesToHighlight[i];
      
      try {
        // Verify node is still valid
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
        
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'xtm-highlight xtm-ai-discovered';
        highlightSpan.setAttribute('data-type', entity.type);
        highlightSpan.setAttribute('data-value', searchValue);
        highlightSpan.setAttribute('data-ai-discovered', 'true');
        highlightSpan.setAttribute('title', `AI Discovered: ${entity.type.replace(/-/g, ' ')}`);
        
        range.surroundContents(highlightSpan);
        highlights.push(highlightSpan);
        highlightedCount++;
        entityHighlighted = true;
        
        highlightSpan.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Re-open panel if needed before toggling selection
          if (onPanelReopen) {
            onPanelReopen();
          }
          onToggleSelection(highlightSpan, searchValue);
        });
      } catch {
        log.debug(' Could not highlight AI entity (range issue):', searchValue);
      }
    }
    
    if (entityHighlighted) {
      highlightedEntities.push(entity);
    } else {
      failedEntities.push(entity);
    }
  }
  
  return { highlightedCount, highlightedEntities, failedEntities };
}

/**
 * Scroll to and flash a highlight element
 */
function scrollToAndFlashHighlight(highlight: HTMLElement): void {
  setTimeout(() => {
    highlight.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'nearest'
    });
    
    setTimeout(() => {
      const rect = highlight.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      
      if (Math.abs(elementCenter - viewportCenter) > 100) {
        const absoluteTop = window.scrollY + rect.top;
        const scrollTarget = Math.max(0, absoluteTop - viewportCenter + (rect.height / 2));
        window.scrollTo({
          top: scrollTarget,
          behavior: 'smooth'
        });
      }
    }, 300);
    
    setTimeout(() => {
      highlight.classList.add('xtm-flash');
      setTimeout(() => {
        highlight.classList.remove('xtm-flash');
      }, 3000);
    }, 300);
  }, 50);
}

/**
 * Scroll to the first highlight on the page
 */
export function scrollToFirstHighlight(event?: MouseEvent): void {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  const firstHighlight = document.querySelector('.xtm-highlight') as HTMLElement;
  if (firstHighlight) {
    scrollToAndFlashHighlight(firstHighlight);
  }
}

/**
 * Scroll to a specific highlight by entity value/name
 */
/**
 * Scroll to a highlight by value
 * Accepts either a single value or an array of values to try (e.g., entity name + matched strings)
 */
export function scrollToHighlightByValue(value: string | string[]): boolean {
  // Convert to array for uniform handling
  const valuesToTry = Array.isArray(value) ? value : [value];
  
  // Filter out empty values
  const validValues = valuesToTry.filter(v => v && v.trim());
  if (validValues.length === 0) return false;
  
  // Find all highlights
  const highlights = document.querySelectorAll('.xtm-highlight') as NodeListOf<HTMLElement>;
  
  // Try each value in order
  for (const searchValue of validValues) {
    const normalizedValue = searchValue.toLowerCase().trim();
    
    // First pass: exact match on attributes or text content
    for (const highlight of highlights) {
      const entityValue = highlight.dataset.entityValue?.toLowerCase().trim();
      const dataValue = highlight.dataset.value?.toLowerCase().trim();
      const textContent = highlight.textContent?.toLowerCase().trim();
      
      if (entityValue === normalizedValue || dataValue === normalizedValue || textContent === normalizedValue) {
        scrollToAndFlashHighlight(highlight);
        return true;
      }
    }
  }
  
  // Second pass: partial match on text content (try all values)
  for (const searchValue of validValues) {
    const normalizedValue = searchValue.toLowerCase().trim();
    
    for (const highlight of highlights) {
      const textContent = highlight.textContent?.toLowerCase().trim() || '';
      if (textContent.includes(normalizedValue) || normalizedValue.includes(textContent)) {
        scrollToAndFlashHighlight(highlight);
        return true;
      }
    }
  }
  
  return false;
}

