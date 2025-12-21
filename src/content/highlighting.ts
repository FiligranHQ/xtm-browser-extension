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
import {
  findMatchPositionsWithBoundaries,
  collectRegexMatches as sharedCollectRegexMatches,
  applyHighlightsWithConfig,
  type NodeMapEntry,
  type HighlightConfig,
  type HighlightEventHandlers,
  type ExtendedMatchInfo,
} from './utils/highlight';
import { escapeRegex } from '../shared/detection/matching';
import { generateDefangedVariants } from '../shared/detection/patterns';

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
// Search Value Generation (uses shared defanging utilities)
// ============================================================================

/**
 * Get all text values to search for from an observable
 * Uses the shared generateDefangedVariants utility for consistency
 */
function getSearchValuesForObservable(obs: { value: string; refangedValue?: string; isDefanged?: boolean }): string[] {
  const values: string[] = [];
  
  // Primary: Use value field (text as found in document)
  if (obs.value) {
    values.push(obs.value);
  }
  
  // Also try refangedValue if different (for cross-referencing)
  if (obs.refangedValue && obs.refangedValue !== obs.value) {
    values.push(obs.refangedValue);
  }
  
  // CRITICAL: If the observable value is NOT defanged (clean form),
  // also generate and search for defanged patterns.
  // This handles the case where detection deduplication chose the clean version
  // but the page has defanged text that we need to highlight.
  const valueToDefang = obs.value || obs.refangedValue;
  if (valueToDefang && !obs.isDefanged) {
    const defangedPatterns = generateDefangedVariants(valueToDefang);
    for (const pattern of defangedPatterns) {
      if (!values.includes(pattern)) {
        values.push(pattern);
      }
    }
  }
  
  return values;
}

/**
 * Get all text variants to highlight for an OpenCTI entity
 * For attack patterns, this includes name, aliases, and x_mitre_id
 */
function getEntityTextVariants(entity: DetectedOCTIEntity): string[] {
  const variants: string[] = [];
  
  // Primary: matched text or name
  const primary = (entity as { matchedValue?: string }).matchedValue || entity.name;
  if (primary) {
    variants.push(primary);
  }
  
  // Add name if different from matched value
  if (entity.name && !variants.includes(entity.name)) {
    variants.push(entity.name);
  }
  
  // Add aliases (which may include x_mitre_id for attack patterns)
  if (entity.aliases) {
    for (const alias of entity.aliases) {
      if (alias && !variants.includes(alias)) {
        variants.push(alias);
      }
    }
  }
  
  // Check entityData for x_mitre_id (for attack patterns from cache)
  const entityData = entity.entityData as { x_mitre_id?: string } | undefined;
  if (entityData?.x_mitre_id && !variants.includes(entityData.x_mitre_id)) {
    variants.push(entityData.x_mitre_id);
  }
  
  return variants;
}

/**
 * Get all text variants to highlight for an OpenAEV entity
 * For attack patterns, this includes name, value, external_id, and aliases
 */
function getOpenAEVEntityTextVariants(entity: {
  name: string;
  value?: string;
  type: string;
  entityData?: Record<string, unknown>;
}): string[] {
  const variants: string[] = [];
  
  // Primary: value or name
  const primary = entity.value || entity.name;
  if (primary) {
    variants.push(primary);
  }
  
  // Add name if different from value
  if (entity.name && !variants.includes(entity.name)) {
    variants.push(entity.name);
  }
  
  // Add aliases from entityData (which includes external IDs for attack patterns)
  const entityData = entity.entityData;
  if (entityData?.aliases && Array.isArray(entityData.aliases)) {
    for (const alias of entityData.aliases) {
      if (alias && typeof alias === 'string' && !variants.includes(alias)) {
        variants.push(alias);
      }
    }
  }
  
  // For AttackPattern entities, also check attack_pattern_external_id directly
  if (entity.type === 'AttackPattern' || entity.type === 'oaev-AttackPattern') {
    const externalId = entityData?.attack_pattern_external_id as string | undefined;
    if (externalId && !variants.includes(externalId)) {
      variants.push(externalId);
    }
  }
  
  return variants;
}

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
 * Collect text matches using string search (case-insensitive)
 * Delegates to the shared utility function
 */
function collectStringMatches(
  fullText: string,
  searchValue: string,
  nodeMap: NodeMapEntry[],
  options: { checkBoundaries?: boolean } = {}
): ExtendedMatchInfo[] {
  return findMatchPositionsWithBoundaries(fullText, searchValue, nodeMap, {
    caseSensitive: false,
    skipHighlighted: true,
    checkBoundaries: options.checkBoundaries ?? false,
  });
}

/**
 * Collect text matches using regex pattern
 * Delegates to the shared utility function
 */
function collectRegexMatches(
  fullText: string,
  pattern: RegExp,
  nodeMap: NodeMapEntry[]
): ExtendedMatchInfo[] {
  return sharedCollectRegexMatches(fullText, pattern, nodeMap, true);
}

/**
 * Apply highlights in reverse order to avoid DOM invalidation
 * Delegates to shared applyHighlightsWithConfig utility
 */
function applyHighlightsInReverse(
  matches: ExtendedMatchInfo[],
  createConfig: (match: ExtendedMatchInfo) => HighlightConfig | null
): HTMLElement[] {
  return applyHighlightsWithConfig(matches, createConfig, highlights);
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
  handlers: HighlightEventHandlers
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
  handlers: HighlightEventHandlers
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
  // IMPORTANT: Collect ALL matches first, then apply highlights
  // This prevents nodeMap from becoming stale when searching for multiple patterns
  const observableMatches: Array<{
    matches: ExtendedMatchInfo[];
    meta: HighlightMeta;
    searchValue: string;
  }> = [];
  
  for (const obs of results.observables) {
    const valueLower = obs.value.toLowerCase();
    const otherPlatformMatches = findPlatformMatches(valueLower);
    const meta: HighlightMeta = {
      type: obs.type,
      found: obs.found,
      data: obs,
      foundInPlatforms: otherPlatformMatches.length > 0 ? otherPlatformMatches : undefined,
    };
    
    // Search for all possible forms of the observable (clean + defanged patterns)
    // This handles cases where deduplication chose clean version but page has defanged text
    const searchValues = getSearchValuesForObservable(obs);
    for (const searchValue of searchValues) {
      const matches = collectStringMatches(fullText, searchValue, nodeMap);
      if (matches.length > 0) {
        observableMatches.push({ matches, meta, searchValue });
      }
    }
  }
  
  // Now apply all highlights (in reverse to preserve positions)
  for (const { matches, meta, searchValue } of observableMatches) {
    applyHighlightsInReverse(matches, () => createScanResultHighlightConfig(meta, searchValue, handlers));
  }
  
  // Highlight OpenCTI entities - rebuild nodeMap after observable highlights
  // IMPORTANT: Observable highlights modify the DOM, so we need fresh text nodes
  if (results.openctiEntities.length > 0) {
    textNodes = getTextNodes(document.body);
    ({ nodeMap, fullText } = buildNodeMap(textNodes));
    
    // IMPORTANT: Collect ALL OpenCTI entity matches first, then apply highlights
    // This prevents nodeMap from becoming stale when highlighting multiple entities
    const octiMatches: Array<{
      matches: ExtendedMatchInfo[];
      meta: HighlightMeta;
      entityName: string;
    }> = [];
    
    for (const octiEntity of results.openctiEntities) {
      const valueLower = octiEntity.name.toLowerCase();
      const otherPlatformMatches = findPlatformMatches(valueLower);
      const meta: HighlightMeta = {
        type: octiEntity.type,
        found: octiEntity.found,
        data: octiEntity,
        isOpenCTIEntity: true,
        foundInPlatforms: otherPlatformMatches.length > 0 ? otherPlatformMatches : undefined,
      };
      
      // Collect all text variants to highlight for this entity
      // This ensures both name and external ID (x_mitre_id) are highlighted for attack patterns
      const textsToHighlight = getEntityTextVariants(octiEntity);
      const allMatches: ExtendedMatchInfo[] = [];
      for (const text of textsToHighlight) {
        allMatches.push(...collectStringMatches(fullText, text, nodeMap));
      }
      if (allMatches.length > 0) {
        octiMatches.push({ matches: allMatches, meta, entityName: octiEntity.name });
      }
    }
    
    // Now apply all OpenCTI entity highlights
    for (const { matches, meta, entityName } of octiMatches) {
      applyHighlightsInReverse(matches, () => createScanResultHighlightConfig(meta, entityName, handlers));
    }
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
    
    // IMPORTANT: Collect ALL OpenAEV entity matches first, then apply highlights
    const oaevMatches: Array<{
      matches: ExtendedMatchInfo[];
      meta: HighlightMeta;
      entityName: string;
    }> = [];
    
    for (const entity of results.openaevEntities) {
      const entityPlatformType = (entity.platformType || 'openaev') as PlatformType;
      const prefixedType = createPrefixedType(entity.type, entityPlatformType);
      const meta: HighlightMeta = {
        type: prefixedType,
        found: entity.found,
        data: entity as unknown as DetectedOCTIEntity,
      };
      
      // Collect all text variants to highlight for this entity
      // This ensures both name and external ID are highlighted for attack patterns
      const textsToHighlight = getOpenAEVEntityTextVariants(entity);
      const allMatches: ExtendedMatchInfo[] = [];
      for (const text of textsToHighlight) {
        allMatches.push(...collectStringMatches(fullText, text, nodeMap));
      }
      if (allMatches.length > 0) {
        oaevMatches.push({ matches: allMatches, meta, entityName: entity.name });
      }
    }
    
    // Now apply all OpenAEV entity highlights
    for (const { matches, meta, entityName } of oaevMatches) {
      applyHighlightsInReverse(matches, () => createScanResultHighlightConfig(meta, entityName, handlers));
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
  // IMPORTANT: Collect ALL matches first, then apply highlights
  // This prevents nodeMap from becoming stale when searching for multiple patterns
  const observableMatches: Array<{
    matches: ExtendedMatchInfo[];
    obs: typeof results.observables[0];
    searchValue: string;
  }> = [];
  
  for (const obs of results.observables) {
    // Search for all possible forms of the observable (clean + defanged patterns)
    const searchValues = getSearchValuesForObservable(obs);
    for (const searchValue of searchValues) {
      const matches = collectStringMatches(fullText, searchValue, nodeMap);
      if (matches.length > 0) {
        observableMatches.push({ matches, obs, searchValue });
      }
    }
  }
  
  // Now apply all highlights
  for (const { matches, obs, searchValue } of observableMatches) {
    applyHighlightsInReverse(matches, () => 
      createInvestigationHighlightConfig(obs.type, searchValue, obs.entityId, obs.platformId || (obs as { platformId?: string }).platformId, onHighlightClick)
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
