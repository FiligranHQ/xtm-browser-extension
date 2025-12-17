/**
 * Highlighting Module
 * Handles creating, managing, and interacting with highlights on the page.
 */

import { loggers } from '../shared/utils/logger';
import type { DetectedObservable, DetectedSDO, ScanResultPayload } from '../shared/types';
import { getTextNodes } from '../shared/detection/detector';
import {
  createPrefixedType,
  type PlatformType,
} from '../shared/platform';

const log = loggers.content;

// ============================================================================
// Types
// ============================================================================

export interface HighlightMeta {
  type: string;
  found: boolean;
  data: DetectedObservable | DetectedSDO;
  isOpenCTIEntity?: boolean; // Flag to indicate if this is an OpenCTI entity (can be added via AI discovery)
  foundInPlatforms?: Array<{
    platformType: string;
    type: string;
    found: boolean;
    data: unknown;
  }>;
}

// OpenCTI entity types - these are detected from platform cache
// When not found, they can be added via AI discovery feature
const OPENCTI_ENTITY_TYPES = new Set([
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
  const textNodes = getTextNodes(document.body);
  const { nodeMap, fullText } = buildNodeMap(textNodes);
  
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
  
  // Collect OpenCTI SDOs by name
  for (const sdo of results.sdos) {
    if (sdo.found) {
      const valueLower = sdo.name.toLowerCase();
      if (!valueToPlatformEntities.has(valueLower)) {
        valueToPlatformEntities.set(valueLower, []);
      }
      valueToPlatformEntities.get(valueLower)!.push({
        platformType: 'opencti',
        type: sdo.type,
        found: true,
        data: sdo,
      });
    }
  }
  
  // Collect platform entities
  if (results.platformEntities) {
    for (const entity of results.platformEntities) {
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
  for (const sdo of results.sdos) {
    const textToHighlight = (sdo as { matchedValue?: string }).matchedValue || sdo.name;
    const valueLower = sdo.name.toLowerCase();
    const otherPlatformMatches = findPlatformMatchesWithSubstrings(valueLower);
    
    highlightInText(fullText, textToHighlight, nodeMap, {
      type: sdo.type,
      found: sdo.found,
      data: sdo,
      isOpenCTIEntity: true, // OpenCTI entities can be added via AI discovery
      foundInPlatforms: otherPlatformMatches.length > 0 ? otherPlatformMatches : undefined,
    }, handlers);
  }
  
  // Highlight CVEs (OpenCTI Vulnerability entities, can be added via AI discovery)
  if (results.cves) {
    for (const cve of results.cves) {
      const textToHighlight = (cve as { matchedValue?: string }).matchedValue || cve.name;
      highlightInText(fullText, textToHighlight, nodeMap, {
        type: cve.type,
        found: cve.found,
        data: cve,
        isOpenCTIEntity: true, // CVEs are OpenCTI entities, can be added via AI discovery
      }, handlers);
    }
  }
  
  // Highlight platform entities
  if (results.platformEntities) {
    for (const entity of results.platformEntities) {
      const entityPlatformType = (entity.platformType || 'openaev') as PlatformType;
      const prefixedType = createPrefixedType(entity.type, entityPlatformType);
      const textToHighlight = entity.value || entity.name;
      highlightInText(fullText, textToHighlight, nodeMap, {
        type: prefixedType,
        found: entity.found,
        data: entity as unknown as DetectedSDO,
      }, handlers);
    }
  }
}

/**
 * Create a highlight in text
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
  let pos = 0;
  let highlightedCount = 0;
  const maxHighlightsPerValue = 1;
  
  while ((pos = fullText.toLowerCase().indexOf(searchLower, pos)) !== -1 && highlightedCount < maxHighlightsPerValue) {
    const endPos = pos + searchValue.length;
    
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
          try {
            const range = document.createRange();
            range.setStart(node, localStart);
            range.setEnd(node, localEnd);
            
            if (range.toString().trim().length === 0) {
              break;
            }
            
            const highlight = document.createElement('span');
            highlight.className = 'xtm-highlight';
            
            // Determine if this is an OpenCTI entity (check flag or type)
            const isOpenCTIEntity = meta.isOpenCTIEntity || OPENCTI_ENTITY_TYPES.has(meta.type);
            
            if (meta.found) {
              // Found in platform = green
              highlight.classList.add('xtm-found');
            } else if (isOpenCTIEntity) {
              // OpenCTI entity not found = gray (can be added via AI discovery)
              highlight.classList.add('xtm-sdo-not-addable');
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
            
            highlight.addEventListener('mouseenter', handlers.onHover);
            highlight.addEventListener('mouseleave', handlers.onLeave);
            highlight.addEventListener('click', handlers.onClick, { capture: true });
            highlight.addEventListener('mousedown', handlers.onMouseDown, { capture: true });
            highlight.addEventListener('mouseup', handlers.onMouseUp, { capture: true });
            highlight.addEventListener('contextmenu', handlers.onRightClick);
            
            range.surroundContents(highlight);
            highlights.push(highlight);
            highlightedCount++;
          } catch (e) {
            // Range might cross node boundaries
          }
        }
        break;
      }
    }
    
    pos = endPos;
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
      obs.platformId || (obs as { _platformId?: string })._platformId,
      onHighlightClick
    );
  }
  
  for (const sdo of results.sdos) {
    highlightForInvestigation(
      fullText,
      sdo.name,
      nodeMap,
      sdo.type,
      sdo.entityId,
      sdo.platformId || (sdo as { _platformId?: string })._platformId,
      onHighlightClick
    );
  }
  
  if (results.platformEntities) {
    for (const e of results.platformEntities) {
      const prefixedType = createPrefixedType(e.type, 'openaev');
      highlightForInvestigation(
        fullText,
        e.name,
        nodeMap,
        prefixedType,
        e.entityId,
        e.platformId,
        onHighlightClick
      );
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
  const pos = fullText.toLowerCase().indexOf(searchLower);
  if (pos === -1) return;
  
  for (const { node, start, end } of nodeMap) {
    if (pos >= start && pos < end) {
      if (node.parentElement?.closest('.xtm-highlight')) break;
      
      const nodeText = node.textContent || '';
      const localStart = pos - start;
      const localEnd = Math.min(localStart + searchValue.length, nodeText.length);
      if (localEnd > nodeText.length) break;
      
      try {
        const range = document.createRange();
        range.setStart(node, localStart);
        range.setEnd(node, localEnd);
        if (range.toString().trim().length === 0) break;
        
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
      break;
    }
  }
}

// ============================================================================
// Atomic Testing & Scenario Highlighting
// ============================================================================

/**
 * Highlight for atomic testing mode
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
  let pos = 0;
  let highlightedCount = 0;
  const maxHighlightsPerValue = 5;
  
  while ((pos = fullTextLower.indexOf(searchLower, pos)) !== -1 && highlightedCount < maxHighlightsPerValue) {
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
          try {
            const range = document.createRange();
            range.setStart(node, localStart);
            range.setEnd(node, localEnd);
            
            if (range.toString().trim().length === 0) {
              break;
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
            highlightedCount++;
          } catch { /* Range might cross node boundaries */ }
        }
        break;
      }
    }
    
    pos = endPos;
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

function highlightInTextForScenario(
  fullText: string,
  searchValue: string,
  nodeMap: NodeMapEntry[],
  attackPattern: { id: string; name: string }
): void {
  if (!searchValue || searchValue.length < 2) return;
  
  const searchLower = searchValue.toLowerCase();
  const fullTextLower = fullText.toLowerCase();
  let pos = 0;
  let highlightedCount = 0;
  const maxHighlightsPerValue = 5;
  
  while ((pos = fullTextLower.indexOf(searchLower, pos)) !== -1 && highlightedCount < maxHighlightsPerValue) {
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
          try {
            const range = document.createRange();
            range.setStart(node, localStart);
            range.setEnd(node, localEnd);
            
            if (range.toString().trim().length === 0) {
              break;
            }
            
            const highlight = document.createElement('span');
            highlight.className = 'xtm-highlight xtm-scenario';
            highlight.dataset.value = attackPattern.name;
            highlight.dataset.type = 'attack-pattern';
            highlight.dataset.entityId = attackPattern.id;
            
            range.surroundContents(highlight);
            highlights.push(highlight);
            highlightedCount++;
          } catch { /* Range might cross node boundaries */ }
        }
        break;
      }
    }
    
    pos = endPos;
  }
}

// ============================================================================
// AI Entity Highlighting
// ============================================================================

/**
 * Highlight AI-discovered entities on the page
 */
export function highlightAIEntities(
  entities: Array<{ type: string; value: string; name: string }>,
  onToggleSelection: (highlight: HTMLElement, searchValue: string) => void
): number {
  const textNodes = getTextNodes(document.body);
  let highlightedCount = 0;
  
  for (const entity of entities) {
    const searchValue = entity.value || entity.name;
    if (!searchValue) continue;
    
    for (const node of textNodes) {
      const text = node.textContent || '';
      const lowerText = text.toLowerCase();
      const lowerSearch = searchValue.toLowerCase();
      
      let searchIndex = 0;
      while (true) {
        const index = lowerText.indexOf(lowerSearch, searchIndex);
        if (index === -1) break;
        
        const parent = node.parentElement;
        if (parent?.classList.contains('xtm-highlight')) {
          searchIndex = index + lowerSearch.length;
          continue;
        }
        
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + searchValue.length);
        
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'xtm-highlight xtm-ai-discovered';
        highlightSpan.setAttribute('data-type', entity.type);
        highlightSpan.setAttribute('data-value', searchValue);
        highlightSpan.setAttribute('data-ai-discovered', 'true');
        highlightSpan.setAttribute('title', `AI Discovered: ${entity.type.replace(/-/g, ' ')}`);
        
        try {
          range.surroundContents(highlightSpan);
          highlightedCount++;
          
          highlightSpan.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelection(highlightSpan, searchValue);
          });
        } catch {
          log.debug(' Could not highlight AI entity (range issue):', searchValue);
        }
        
        break;
      }
    }
  }
  
  return highlightedCount;
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
    setTimeout(() => {
      firstHighlight.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
      
      setTimeout(() => {
        const rect = firstHighlight.getBoundingClientRect();
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
        firstHighlight.classList.add('xtm-flash');
        setTimeout(() => {
          firstHighlight.classList.remove('xtm-flash');
        }, 1500);
      }, 500);
    }, 50);
  }
}

