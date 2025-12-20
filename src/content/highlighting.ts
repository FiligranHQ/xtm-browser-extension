/**
 * Highlighting Module
 * Handles creating, managing, and interacting with highlights on the page.
 */

import type { DetectedObservable } from '../shared/types/observables';
import type { DetectedOCTIEntity } from '../shared/types/opencti';
import type { ScanResultPayload } from '../shared/types/messages';
import { getTextNodes } from '../shared/detection/text-extraction';
import {
  createPrefixedType,
  type PlatformType,
} from '../shared/platform/registry';
import { ensureStylesInShadowRoot, type NodeMapEntry } from './utils/highlight';
import { escapeRegex, isValidBoundary } from '../shared/detection/matching';

// ============================================================================
// Types
// ============================================================================

export interface HighlightMeta {
  type: string;
  found: boolean;
  data: DetectedObservable | DetectedOCTIEntity;
  isOpenCTIEntity?: boolean;
  foundInPlatforms?: Array<{
    platformType: string;
    type: string;
    found: boolean;
    data: unknown;
  }>;
}

/** Configuration for highlight element creation */
interface HighlightConfig {
  className: string;
  dataAttributes: Record<string, string>;
  handlers?: HighlightHandlers;
}

/** Standard event handlers for highlights */
interface HighlightHandlers {
  onHover?: (e: MouseEvent) => void;
  onLeave?: (e: MouseEvent) => void;
  onClick?: (e: MouseEvent) => void;
  onRightClick?: (e: MouseEvent) => void;
  onMouseDown?: (e: MouseEvent) => void;
  onMouseUp?: (e: MouseEvent) => void;
}

/** Match information for highlight positioning */
interface MatchInfo {
  node: Text;
  localStart: number;
  localEnd: number;
  pos?: number;
  matchLength?: number;
}

// OpenCTI Types - these are detected from platform cache
const OPENCTI_TYPES_SET = new Set([
  'Intrusion-Set', 'Malware', 'Threat-Actor-Group', 'Threat-Actor-Individual',
  'Attack-Pattern', 'Campaign', 'Incident', 'Vulnerability', 'Tool',
  'Infrastructure', 'Narrative', 'Channel', 'System', 'Sector',
  'Organization', 'Individual', 'Event', 'Country', 'Region',
  'City', 'Administrative-Area', 'Position', 'Report', 'Note',
  'Grouping', 'Case-Incident', 'Case-Rfi', 'Case-Rft', 'Feedback',
]);


// ============================================================================
// State
// ============================================================================

let highlights: HTMLElement[] = [];

// ============================================================================
// Core Functions
// ============================================================================

export function getHighlights(): HTMLElement[] {
  return highlights;
}

export function addHighlight(el: HTMLElement): void {
  highlights.push(el);
}

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
 */
export function buildNodeMap(textNodes: Text[]): { nodeMap: NodeMapEntry[]; fullText: string } {
  let offset = 0;
  const nodeMap: NodeMapEntry[] = [];
  
  textNodes.forEach((node) => {
    const text = node.textContent || '';
    nodeMap.push({ node, start: offset, end: offset + text.length });
    offset += text.length;
  });
  
  const fullText = textNodes.map((n) => n.textContent).join('');
  return { nodeMap, fullText };
}

// ============================================================================
// Generic Highlight Infrastructure
// ============================================================================

/**
 * Create a highlight element with standard configuration
 */
function createHighlightElement(config: HighlightConfig): HTMLSpanElement {
  const highlight = document.createElement('span');
  highlight.className = config.className;
  
  for (const [key, value] of Object.entries(config.dataAttributes)) {
    highlight.dataset[key] = value;
  }
  
  if (config.handlers) {
    const h = config.handlers;
    if (h.onHover) highlight.addEventListener('mouseenter', h.onHover, { capture: true });
    if (h.onLeave) highlight.addEventListener('mouseleave', h.onLeave, { capture: true });
    if (h.onClick) highlight.addEventListener('click', h.onClick, { capture: true });
    if (h.onRightClick) highlight.addEventListener('contextmenu', h.onRightClick, { capture: true });
    if (h.onMouseDown) highlight.addEventListener('mousedown', h.onMouseDown, { capture: true });
    if (h.onMouseUp) highlight.addEventListener('mouseup', h.onMouseUp, { capture: true });
  }
  
  return highlight;
}

/**
 * Collect text matches using string search (case-insensitive)
 */
function collectStringMatches(
  fullText: string,
  searchValue: string,
  nodeMap: NodeMapEntry[],
  options: { checkBoundaries?: boolean } = {}
): MatchInfo[] {
  if (!searchValue || searchValue.length < 2) return [];
  
  const matchesToHighlight: MatchInfo[] = [];
  const searchLower = searchValue.toLowerCase();
  const fullTextLower = fullText.toLowerCase();
  
  let pos = 0;
  while ((pos = fullTextLower.indexOf(searchLower, pos)) !== -1) {
    const endPos = pos + searchValue.length;
    
    // Boundary check if requested
    if (options.checkBoundaries) {
      const charBefore = pos > 0 ? fullText[pos - 1] : undefined;
      const charAfter = endPos < fullText.length ? fullText[endPos] : undefined;
      if (!isValidBoundary(charBefore) || !isValidBoundary(charAfter)) {
        pos++;
        continue;
      }
    }
    
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        if (node.parentElement?.closest('.xtm-highlight')) break;
        
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
  
  return matchesToHighlight;
}

/**
 * Collect text matches using regex pattern
 */
function collectRegexMatches(
  fullText: string,
  pattern: RegExp,
  nodeMap: NodeMapEntry[]
): MatchInfo[] {
  const matchesToHighlight: MatchInfo[] = [];
  
  let match;
  while ((match = pattern.exec(fullText)) !== null) {
    const pos = match.index;
    const matchLength = match[0].length;
    
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        if (node.parentElement?.closest('.xtm-highlight')) break;
        
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
  
  return matchesToHighlight;
}

/**
 * Apply highlights in reverse order to avoid DOM invalidation
 */
function applyHighlightsInReverse(
  matches: MatchInfo[],
  createConfig: (match: MatchInfo) => HighlightConfig | null
): HTMLElement[] {
  const createdHighlights: HTMLElement[] = [];
  
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const { node, localStart, localEnd } = match;
    
    try {
      if (!node.parentNode || node.parentElement?.closest('.xtm-highlight')) continue;
      
      const currentNodeText = node.textContent || '';
      if (localEnd > currentNodeText.length) continue;
      
      ensureStylesInShadowRoot(node);
      
      const range = document.createRange();
      range.setStart(node, localStart);
      range.setEnd(node, localEnd);
      
      if (range.toString().trim().length === 0) continue;
      
      const config = createConfig(match);
      if (!config) continue;
      
      const highlight = createHighlightElement(config);
      range.surroundContents(highlight);
      highlights.push(highlight);
      createdHighlights.push(highlight);
    } catch {
      // Range might cross node boundaries or node may have been modified
    }
  }
  
  return createdHighlights;
}

// ============================================================================
// CVE Pattern Helpers
// ============================================================================

/**
 * Create a regex pattern for a CVE that matches any dash variant
 */
function createFlexibleCVEPattern(cveName: string): RegExp {
  const match = cveName.match(/^CVE[^\d]*(\d{4})[^\d]*(\d{4,7})$/i);
  if (!match) {
    const parts = cveName.match(/CVE[^\d]*(\d+)[^\d]*(\d+)/i);
    if (parts) {
      const [, y, s] = parts;
      const dashClass = `[\\-\\u002D\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2212\\u00AD\\uFE63\\uFF0D]`;
      const invisibleClass = `[\\s\\u200B\\u200C\\u200D\\u2060\\uFEFF]*`;
      return new RegExp(`CVE${invisibleClass}${dashClass}${invisibleClass}${y}${invisibleClass}${dashClass}${invisibleClass}${s}`, 'gi');
    }
    return new RegExp(escapeRegex(cveName), 'gi');
  }
  
  const [, year, seq] = match;
  const dashClass = `[\\-\\u002D\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015\\u2212\\u00AD\\uFE63\\uFF0D]`;
  const invisibleClass = `[\\s\\u200B\\u200C\\u200D\\u2060\\uFEFF]*`;
  return new RegExp(`CVE${invisibleClass}${dashClass}${invisibleClass}${year}${invisibleClass}${dashClass}${invisibleClass}${seq}`, 'gi');
}

// ============================================================================
// Scan Results Highlighting
// ============================================================================

/**
 * Get highlight class based on meta state
 */
function getHighlightStateClass(meta: HighlightMeta): string {
  const isOpenCTIEntity = meta.isOpenCTIEntity || OPENCTI_TYPES_SET.has(meta.type);
  
  if (meta.found) return 'xtm-found';
  if (isOpenCTIEntity) return 'xtm-entity-not-addable';
  return 'xtm-not-found';
}

/**
 * Create highlight config for scan results
 */
function createScanResultHighlightConfig(
  meta: HighlightMeta,
  value: string,
  handlers: HighlightHandlers
): HighlightConfig {
  const stateClass = getHighlightStateClass(meta);
  const hasMixedState = !meta.found && meta.foundInPlatforms && meta.foundInPlatforms.length > 0;
  
  const classes = ['xtm-highlight', stateClass];
  if (hasMixedState) classes.push('xtm-mixed-state');
  
  const dataAttributes: Record<string, string> = {
    type: meta.type,
    value,
    found: String(meta.found),
    entity: JSON.stringify(meta.data),
  };
  
  if (hasMixedState && meta.foundInPlatforms) {
    dataAttributes.mixedState = 'true';
    dataAttributes.platformEntities = JSON.stringify(meta.foundInPlatforms);
  }
  
  if (meta.found && meta.foundInPlatforms && meta.foundInPlatforms.length > 0) {
    dataAttributes.multiPlatform = 'true';
    dataAttributes.platformEntities = JSON.stringify(meta.foundInPlatforms);
  }
  
  return {
    className: classes.join(' '),
    dataAttributes,
    handlers,
  };
}

/**
 * Highlight scan results on the page
 */
export function highlightResults(
  results: ScanResultPayload,
  handlers: HighlightHandlers
): void {
  let textNodes = getTextNodes(document.body);
  let { nodeMap, fullText } = buildNodeMap(textNodes);
  
  // Build platform entities map
  const valueToPlatformEntities = buildPlatformEntitiesMap(results);
  
  const findPlatformMatches = (valueLower: string) => {
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
    const otherPlatformMatches = findPlatformMatches(valueLower);
    const meta: HighlightMeta = {
      type: obs.type,
      found: obs.found,
      data: obs,
      foundInPlatforms: otherPlatformMatches.length > 0 ? otherPlatformMatches : undefined,
    };
    
    const matches = collectStringMatches(fullText, obs.value, nodeMap);
    applyHighlightsInReverse(matches, () => createScanResultHighlightConfig(meta, obs.value, handlers));
  }
  
  // Highlight OpenCTI entities
  for (const octiEntity of results.openctiEntities) {
    const textToHighlight = (octiEntity as { matchedValue?: string }).matchedValue || octiEntity.name;
    const valueLower = octiEntity.name.toLowerCase();
    const otherPlatformMatches = findPlatformMatches(valueLower);
    const meta: HighlightMeta = {
      type: octiEntity.type,
      found: octiEntity.found,
      data: octiEntity,
      isOpenCTIEntity: true,
      foundInPlatforms: otherPlatformMatches.length > 0 ? otherPlatformMatches : undefined,
    };
    
    const matches = collectStringMatches(fullText, textToHighlight, nodeMap);
    applyHighlightsInReverse(matches, () => createScanResultHighlightConfig(meta, textToHighlight, handlers));
  }
  
  // Highlight CVEs - rebuild nodeMap after previous highlights
  if (results.cves && results.cves.length > 0) {
    textNodes = getTextNodes(document.body);
    ({ nodeMap, fullText } = buildNodeMap(textNodes));
    
    for (const cve of results.cves) {
      const cvePlatformMatches = (cve.platformMatches || []).map((pm: { type?: string; platformType?: string; entityId?: string; platformId?: string; entityData?: unknown }) => ({
        type: pm.type || 'Vulnerability',
        platformType: pm.platformType || 'opencti',
        found: true,
        data: {
          entityId: pm.entityId,
          platformId: pm.platformId,
          platformType: pm.platformType || 'opencti',
          type: pm.type || 'Vulnerability',
          entityData: pm.entityData,
        },
      }));
      
      const meta: HighlightMeta = {
        type: cve.type,
        found: cve.found,
        data: cve,
        isOpenCTIEntity: true,
        foundInPlatforms: cvePlatformMatches.length > 0 ? cvePlatformMatches : undefined,
      };
      
      const cvePattern = createFlexibleCVEPattern(cve.name);
      const matches = collectRegexMatches(fullText, cvePattern, nodeMap);
      applyHighlightsInReverse(matches, () => createScanResultHighlightConfig(meta, cve.name, handlers));
    }
  }
  
  // Highlight OpenAEV entities - rebuild nodeMap
  if (results.openaevEntities && results.openaevEntities.length > 0) {
    textNodes = getTextNodes(document.body);
    ({ nodeMap, fullText } = buildNodeMap(textNodes));
    
    for (const entity of results.openaevEntities) {
      const entityPlatformType = (entity.platformType || 'openaev') as PlatformType;
      const prefixedType = createPrefixedType(entity.type, entityPlatformType);
      const textToHighlight = entity.value || entity.name;
      const meta: HighlightMeta = {
        type: prefixedType,
        found: entity.found,
        data: entity as unknown as DetectedOCTIEntity,
      };
      
      const matches = collectStringMatches(fullText, textToHighlight, nodeMap);
      applyHighlightsInReverse(matches, () => createScanResultHighlightConfig(meta, textToHighlight, handlers));
    }
  }
}

/**
 * Build a map of values to their platform findings
 */
function buildPlatformEntitiesMap(results: ScanResultPayload): Map<string, Array<{
  platformType: string;
  type: string;
  found: boolean;
  data: unknown;
}>> {
  const map = new Map<string, Array<{ platformType: string; type: string; found: boolean; data: unknown }>>();
  
  for (const obs of results.observables) {
    if (obs.found) {
      const valueLower = obs.value.toLowerCase();
      if (!map.has(valueLower)) map.set(valueLower, []);
      map.get(valueLower)!.push({ platformType: 'opencti', type: obs.type, found: true, data: obs });
    }
  }
  
  for (const entity of results.openctiEntities) {
    if (entity.found) {
      const valueLower = entity.name.toLowerCase();
      if (!map.has(valueLower)) map.set(valueLower, []);
      map.get(valueLower)!.push({ platformType: 'opencti', type: entity.type, found: true, data: entity });
    }
  }
  
  if (results.openaevEntities) {
    for (const entity of results.openaevEntities) {
      const valueLower = entity.name.toLowerCase();
      if (!map.has(valueLower)) map.set(valueLower, []);
      const platformType = (entity.platformType || 'openaev') as PlatformType;
      map.get(valueLower)!.push({
        platformType,
        type: createPrefixedType(entity.type, platformType),
        found: entity.found,
        data: entity,
      });
    }
  }
  
  return map;
}

// ============================================================================
// Investigation Highlighting
// ============================================================================

/**
 * Create highlight config for investigation mode
 */
function createInvestigationHighlightConfig(
  entityType: string,
  entityValue: string,
  entityId?: string,
  platformId?: string,
  onHighlightClick?: (highlight: HTMLElement) => void
): HighlightConfig {
  return {
    className: 'xtm-highlight xtm-investigation',
    dataAttributes: {
      entityId: entityId || '',
      platformId: platformId || '',
      entityType,
      entityValue,
    },
    handlers: onHighlightClick ? {
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        const target = e.currentTarget as HTMLElement;
        onHighlightClick(target);
      },
    } : undefined,
  };
}

/**
 * Highlight results for investigation mode
 */
export function highlightResultsForInvestigation(
  results: ScanResultPayload,
  onHighlightClick: (highlight: HTMLElement) => void
): void {
  const textNodes = getTextNodes(document.body);
  const { nodeMap, fullText } = buildNodeMap(textNodes);
  
  // Highlight observables
  for (const obs of results.observables) {
    const matches = collectStringMatches(fullText, obs.value, nodeMap);
    applyHighlightsInReverse(matches, () => 
      createInvestigationHighlightConfig(obs.type, obs.value, obs.entityId, obs.platformId || (obs as { platformId?: string }).platformId, onHighlightClick)
    );
  }
  
  // Highlight OpenCTI entities
  for (const entity of results.openctiEntities) {
    const matches = collectStringMatches(fullText, entity.name, nodeMap);
    applyHighlightsInReverse(matches, () => 
      createInvestigationHighlightConfig(entity.type, entity.name, entity.entityId, entity.platformId || (entity as { platformId?: string }).platformId, onHighlightClick)
    );
  }
  
  // Highlight CVEs with flexible dash matching
  if (results.cves) {
    for (const cve of results.cves) {
      const cvePattern = createFlexibleCVEPattern(cve.name);
      const matches = collectRegexMatches(fullText, cvePattern, nodeMap);
      applyHighlightsInReverse(matches, () => 
        createInvestigationHighlightConfig(cve.type || 'Vulnerability', cve.name, cve.entityId, cve.platformId, onHighlightClick)
      );
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
  const matches = collectStringMatches(fullText, searchValue, nodeMap, { checkBoundaries: true });
  
  applyHighlightsInReverse(matches, () => {
    const typeClass = target.type === 'attack-pattern' ? 'xtm-atomic-attack-pattern' : 'xtm-atomic-domain';
    return {
      className: `xtm-highlight xtm-atomic-testing ${typeClass}`,
      dataAttributes: {
        value: target.value,
        type: target.type,
      },
    };
  });
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
 */
function highlightInTextForScenario(
  fullText: string,
  searchValue: string,
  nodeMap: NodeMapEntry[],
  attackPattern: { id: string; name: string }
): void {
  const matches = collectStringMatches(fullText, searchValue, nodeMap, { checkBoundaries: true });
  
  applyHighlightsInReverse(matches, () => ({
    className: 'xtm-highlight xtm-scenario',
    dataAttributes: {
      value: attackPattern.name,
      type: 'attack-pattern',
      entityId: attackPattern.id,
    },
  }));
}

// ============================================================================
// AI Entity Highlighting
// ============================================================================

export interface HighlightAIResult {
  highlightedCount: number;
  highlightedEntities: Array<{ type: string; value: string; name: string }>;
  failedEntities: Array<{ type: string; value: string; name: string }>;
}

/**
 * Highlight AI-discovered entities on the page
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
    
    const matches = collectStringMatches(fullText, searchValue, nodeMap);
    
    if (matches.length === 0) {
      failedEntities.push(entity);
      continue;
    }
    
    const created = applyHighlightsInReverse(matches, () => ({
      className: 'xtm-highlight xtm-ai-discovered',
      dataAttributes: {
        type: entity.type,
        value: searchValue,
        aiDiscovered: 'true',
      },
      handlers: {
        onClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onPanelReopen) onPanelReopen();
          onToggleSelection(e.currentTarget as HTMLElement, searchValue);
        },
      },
    }));
    
    if (created.length > 0) {
      highlightedCount += created.length;
      highlightedEntities.push(entity);
      
      // Set title attribute
      for (const h of created) {
        h.setAttribute('title', `AI Discovered: ${entity.type.replace(/-/g, ' ')}`);
      }
    } else {
      failedEntities.push(entity);
    }
  }
  
  return { highlightedCount, highlightedEntities, failedEntities };
}

// ============================================================================
// Scroll and Flash Utilities
// ============================================================================

function scrollToAndFlashHighlight(highlight: HTMLElement): void {
  setTimeout(() => {
    highlight.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    
    setTimeout(() => {
      const rect = highlight.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      
      if (Math.abs(elementCenter - viewportCenter) > 100) {
        const absoluteTop = window.scrollY + rect.top;
        const scrollTarget = Math.max(0, absoluteTop - viewportCenter + (rect.height / 2));
        window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
      }
    }, 300);
    
    setTimeout(() => {
      highlight.classList.add('xtm-flash');
      setTimeout(() => highlight.classList.remove('xtm-flash'), 3000);
    }, 300);
  }, 50);
}

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

export function scrollToHighlightByValue(value: string | string[]): boolean {
  const valuesToTry = Array.isArray(value) ? value : [value];
  const validValues = valuesToTry.filter(v => v && v.trim());
  if (validValues.length === 0) return false;
  
  const allHighlights = document.querySelectorAll('.xtm-highlight') as NodeListOf<HTMLElement>;
  
  // First pass: exact match
  for (const searchValue of validValues) {
    const normalizedValue = searchValue.toLowerCase().trim();
    
    for (const highlight of allHighlights) {
      const entityValue = highlight.dataset.entityValue?.toLowerCase().trim();
      const dataValue = highlight.dataset.value?.toLowerCase().trim();
      const textContent = highlight.textContent?.toLowerCase().trim();
      
      if (entityValue === normalizedValue || dataValue === normalizedValue || textContent === normalizedValue) {
        scrollToAndFlashHighlight(highlight);
        return true;
      }
    }
  }
  
  // Second pass: partial match
  for (const searchValue of validValues) {
    const normalizedValue = searchValue.toLowerCase().trim();
    
    for (const highlight of allHighlights) {
      const textContent = highlight.textContent?.toLowerCase().trim() || '';
      if (textContent.includes(normalizedValue) || normalizedValue.includes(textContent)) {
        scrollToAndFlashHighlight(highlight);
        return true;
      }
    }
  }
  
  return false;
}
