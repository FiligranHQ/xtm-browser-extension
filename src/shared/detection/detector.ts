/**
 * Observable and Entity Detection Engine
 * 
 * Scans text content to detect observables and threat intelligence entities.
 */

import { loggers } from '../utils/logger';

const log = loggers.detection;

import type {
  DetectedObservable,
  DetectedSDO,
  StixCyberObservable,
  StixDomainObject,
} from '../types';
import {
  OBSERVABLE_PATTERNS,
  CVE_CONFIG,
  SDO_SEARCH_TYPES,
  createNamePattern,
  refangIndicator,
  isDefanged,
  type PatternConfig,
} from './patterns';
import { OpenCTIClient } from '../api/opencti-client';
import {
  getAllCachedEntityNamesForMatching,
  getAllCachedOAEVEntityNamesForMatching,
  type CachedEntity,
  type CachedOAEVEntity,
} from '../utils/storage';

// ============================================================================
// Detection Result Types
// ============================================================================

export interface DetectionResult {
  observables: DetectedObservable[];
  sdos: DetectedSDO[];
  cves: DetectedSDO[];
  oaevEntities: DetectedOAEVEntity[];
  scanTime: number;
}

// OpenAEV Entity Detection
export interface DetectedOAEVEntity {
  type: 'Asset' | 'AssetGroup' | 'Team' | 'Player' | 'AttackPattern';
  name: string;
  value: string; // The matched text
  startIndex: number;
  endIndex: number;
  found: boolean;
  entityId?: string;
  platformId?: string;
}

// ============================================================================
// Detection Engine
// ============================================================================

export class DetectionEngine {
  private clients: Map<string, OpenCTIClient>;
  private primaryClient: OpenCTIClient | null;

  constructor(clients: Map<string, OpenCTIClient>) {
    this.clients = clients;
    // Get first client as primary
    const firstEntry = clients.entries().next().value;
    this.primaryClient = firstEntry ? firstEntry[1] : null;
  }

  /**
   * Add a client
   */
  addClient(platformId: string, client: OpenCTIClient): void {
    this.clients.set(platformId, client);
    if (!this.primaryClient) {
      this.primaryClient = client;
    }
  }

  /**
   * Load known entities from OpenCTI for name/alias matching
   */
  async loadKnownEntities(): Promise<void> {
    // This would ideally fetch a cached list of known threat actors,
    // malware, etc. For now, we'll do on-demand searches.
    // In a production version, you might want to implement caching
    // and periodic background updates.
  }

  /**
   * Scan text content for observables
   */
  detectObservables(text: string): DetectedObservable[] {
    const detected: DetectedObservable[] = [];
    const seenRanges = new Set<string>();

    // Sort patterns by priority
    const sortedPatterns = [...OBSERVABLE_PATTERNS].sort(
      (a, b) => b.priority - a.priority
    );

    for (const config of sortedPatterns) {
      const matches = this.findMatches(text, config);
      
      for (const match of matches) {
        // Check for overlapping ranges
        const rangeKey = `${match.startIndex}-${match.endIndex}`;
        if (seenRanges.has(rangeKey)) {
          continue;
        }

        // Check if this range overlaps with any existing detection
        const overlaps = detected.some(
          (d) =>
            (match.startIndex >= d.startIndex && match.startIndex < d.endIndex) ||
            (match.endIndex > d.startIndex && match.endIndex <= d.endIndex) ||
            (match.startIndex <= d.startIndex && match.endIndex >= d.endIndex)
        );

        if (!overlaps) {
          seenRanges.add(rangeKey);
          detected.push(match);
        }
      }
    }

    // Sort by position in text
    return detected.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Find all matches for a pattern
   */
  private findMatches(
    text: string,
    config: PatternConfig
  ): DetectedObservable[] {
    const matches: DetectedObservable[] = [];
    
    // Reset regex state
    const pattern = new RegExp(config.pattern.source, config.pattern.flags);
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[0];
      
      // Check if the value is defanged and get the refanged version
      const defanged = isDefanged(value);
      const refangedValue = defanged ? refangIndicator(value) : value;
      
      // Validate using the refanged value (the "real" indicator)
      if (config.validate && !config.validate(refangedValue)) {
        continue;
      }

      // Get surrounding context (up to 50 chars each side)
      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(text.length, match.index + value.length + 50);
      const context = text.slice(contextStart, contextEnd);

      matches.push({
        type: config.type,
        value, // Original value as found in text (may be defanged)
        refangedValue, // Clean value for cache/API lookups
        isDefanged: defanged,
        hashType: config.hashType,
        startIndex: match.index,
        endIndex: match.index + value.length,
        context,
        found: false, // Will be updated after API check
      });
    }

    return matches;
  }

  /**
   * Detect CVE references
   */
  detectCVEs(text: string): DetectedSDO[] {
    const detected: DetectedSDO[] = [];
    const pattern = new RegExp(CVE_CONFIG.pattern.source, CVE_CONFIG.pattern.flags);
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      detected.push({
        type: 'Vulnerability',
        name: match[0].toUpperCase(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        found: false,
      });
    }

    return detected;
  }

  /**
   * Search for known entity names in text
   */
  async detectSDOs(
    text: string,
    entityNames: string[]
  ): Promise<DetectedSDO[]> {
    const detected: DetectedSDO[] = [];

    for (const name of entityNames) {
      // Skip very short names to avoid false positives
      if (name.length < 3) continue;

      const pattern = createNamePattern(name);
      let match;

      while ((match = pattern.exec(text)) !== null) {
        detected.push({
          type: 'Intrusion-Set', // Will be updated when matched
          name,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          found: false,
        });
      }
    }

    return detected;
  }

  /**
   * Enrich detected observables with OpenCTI data (searches ALL platforms)
   * Returns the first match but also includes all platform matches for navigation
   */
  async enrichObservables(
    observables: DetectedObservable[]
  ): Promise<DetectedObservable[]> {
    const searchPromises = observables.map(async (obs) => {
      // Search across ALL platforms and collect all matches
      const platformMatches: Array<{ platformId: string; entityId: string; entityData: StixCyberObservable }> = [];
      
      // Use refanged value for lookups (OpenCTI stores clean values, not defanged)
      const searchValue = obs.refangedValue || obs.value;
      
      for (const [platformId, client] of this.clients) {
        try {
          let result: StixCyberObservable | null = null;

          if (obs.hashType) {
            result = await client.searchObservableByHash(
              searchValue,
              obs.hashType
            );
          } else {
            result = await client.searchObservableByValue(
              searchValue,
              obs.type
            );
          }

          if (result) {
            platformMatches.push({
              platformId,
              entityId: result.id,
              entityData: result,
            });
          }
        } catch (error) {
          // Continue to next platform
        }
      }
      
      // If found in at least one platform
      if (platformMatches.length > 0) {
        const firstMatch = platformMatches[0];
        return {
          ...obs,
          found: true,
          entityId: firstMatch.entityId,
          entityData: firstMatch.entityData,
          platformId: firstMatch.platformId,
          // Include all platform matches for multi-platform navigation
          platformMatches: platformMatches.length > 1 ? platformMatches : undefined,
        };
      }
      
      return obs;
    });

    return Promise.all(searchPromises);
  }

  /**
   * Enrich detected SDOs with OpenCTI data (searches ALL platforms)
   * Returns the first match but also includes all platform matches for navigation
   */
  async enrichSDOs(sdos: DetectedSDO[]): Promise<DetectedSDO[]> {
    // Deduplicate by name
    const uniqueNames = [...new Set(sdos.map((s) => s.name))];
    // Map name to ALL platform matches (not just first)
    const searchResults = new Map<string, Array<{ entity: StixDomainObject; platformId: string }>>();

    for (const name of uniqueNames) {
      const matches: Array<{ entity: StixDomainObject; platformId: string }> = [];
      
      // Search across ALL platforms
      for (const [platformId, client] of this.clients) {
        try {
          const result = await client.searchSDOByNameOrAlias(
            name,
            SDO_SEARCH_TYPES as unknown as string[]
          );
          if (result) {
            matches.push({ entity: result, platformId });
            // DON'T break - continue to check all platforms
          }
        } catch (error) {
          // Continue to next platform
        }
      }
      
      if (matches.length > 0) {
        searchResults.set(name.toLowerCase(), matches);
      }
    }

    return sdos.map((sdo) => {
      const matches = searchResults.get(sdo.name.toLowerCase());
      if (matches && matches.length > 0) {
        const firstMatch = matches[0];
        return {
          ...sdo,
          type: firstMatch.entity.entity_type as DetectedSDO['type'],
          found: true,
          entityId: firstMatch.entity.id,
          entityData: firstMatch.entity,
          platformId: firstMatch.platformId,
          // Include all platform matches for multi-platform navigation
          platformMatches: matches.length > 1 ? matches.map(m => ({
            platformId: m.platformId,
            entityId: m.entity.id,
            entityData: m.entity,
          })) : undefined,
        };
      }
      return sdo;
    });
  }

  /**
   * Enrich CVEs with OpenCTI data (searches all platforms)
   */
  async enrichCVEs(cves: DetectedSDO[]): Promise<DetectedSDO[]> {
    // Deduplicate by name
    const uniqueCVEs = [...new Set(cves.map((c) => c.name))];
    const searchResults = new Map<string, { entity: StixDomainObject; platformId: string }>();

    for (const cve of uniqueCVEs) {
      // Search across all platforms
      for (const [platformId, client] of this.clients) {
        try {
          const result = await client.searchSDOByNameOrAlias(cve, [
            'Vulnerability',
          ]);
          if (result) {
            searchResults.set(cve.toUpperCase(), { entity: result, platformId });
            break; // Found, no need to search other platforms
          }
        } catch (error) {
          // Continue to next platform
        }
      }
    }

    return cves.map((cve) => {
      const result = searchResults.get(cve.name.toUpperCase());
      if (result) {
        return {
          ...cve,
          found: true,
          entityId: result.entity.id,
          entityData: result.entity,
          platformId: result.platformId,
        };
      }
      return cve;
    });
  }

  /**
   * Detect SDOs using cached entity names
   */
  async detectSDOsFromCache(text: string): Promise<DetectedSDO[]> {
    const detected: DetectedSDO[] = [];
    const seenEntities = new Set<string>(); // Avoid duplicates
    const seenRanges = new Set<string>(); // Avoid overlapping highlights
    
    // Get cached entity map
    const entityMap = await getAllCachedEntityNamesForMatching();
    
    if (entityMap.size === 0) {
      log.debug(' No cached entities available for SDO detection');
      return detected;
    }
    
    log.debug(`Searching for ${entityMap.size} cached entity names/aliases`);
    
    // Sort by name length (longest first) to match longer names before substrings
    const sortedEntities = Array.from(entityMap.entries()).sort((a, b) => b[0].length - a[0].length);
    
    // For each cached entity name/alias, check if it exists in the text
    for (const [nameLower, entity] of sortedEntities) {
      // Skip very short names (< 3 chars) to avoid false positives
      if (nameLower.length < 3) continue;
      
      // Skip if we already found this entity
      if (seenEntities.has(entity.id)) continue;
      
      // Escape special regex characters in the name
      const escapedName = nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Use word boundary \b for simple alphanumeric names
      // For names with special chars, do a simple case-insensitive substring search
      const hasSpecialChars = /[.\-_]/.test(nameLower);
      
      let regex: RegExp;
      if (hasSpecialChars) {
        // For names with special characters, use lookahead/lookbehind or simple indexOf
        // We'll use a simpler approach: match the exact string, then verify boundaries manually
        regex = new RegExp(escapedName, 'gi');
      } else {
        // For simple alphanumeric names, use word boundaries
        regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
      }
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        const matchedText = match[0];
        if (!matchedText || matchedText.toLowerCase() !== nameLower) continue;
        
        const startIndex = match.index;
        const endIndex = startIndex + matchedText.length;
        
        // For names with special chars, verify boundaries manually
        if (hasSpecialChars) {
          const charBefore = startIndex > 0 ? text[startIndex - 1] : ' ';
          const charAfter = endIndex < text.length ? text[endIndex] : ' ';
          
          // Check if surrounded by word-boundary characters (not alphanumeric)
          const isValidBoundary = (c: string) => /[\s,;:!?()[\]"'<>\/\\@#$%^&*+=|`~\n\r\t]/.test(c) || c === '';
          if (!isValidBoundary(charBefore) && /[a-zA-Z0-9]/.test(charBefore)) continue;
          if (!isValidBoundary(charAfter) && /[a-zA-Z0-9]/.test(charAfter)) continue;
        }
        
        // Check for overlapping ranges
        const rangeKey = `${startIndex}-${endIndex}`;
        let hasOverlap = false;
        for (const existingRange of seenRanges) {
          const [existStart, existEnd] = existingRange.split('-').map(Number);
          if (!(endIndex <= existStart || startIndex >= existEnd)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) continue;
        
        detected.push({
          type: entity.type as DetectedSDO['type'],
          name: entity.name, // Use canonical name from cache
          startIndex,
          endIndex,
          found: true, // Already know it's in the cache
          entityId: entity.id,
          platformId: entity.platformId, // Include platform ID for multi-platform support
          entityData: {
            id: entity.id,
            entity_type: entity.type,
            name: entity.name,
            aliases: entity.aliases,
          } as unknown as StixDomainObject,
        });
        
        seenEntities.add(entity.id);
        seenRanges.add(rangeKey);
        break; // Only detect first occurrence per entity
      }
    }
    
    log.debug(`Found ${detected.length} SDOs from cache`);
    return detected;
  }

  /**
   * Detect OpenAEV entities using cached entity names
   */
  async detectOAEVEntitiesFromCache(text: string): Promise<DetectedOAEVEntity[]> {
    const detected: DetectedOAEVEntity[] = [];
    const seenEntities = new Set<string>();
    const seenRanges = new Set<string>();
    
    // Get cached OpenAEV entity map
    const entityMap = await getAllCachedOAEVEntityNamesForMatching();
    
    if (entityMap.size === 0) {
      log.debug(' No cached OpenAEV entities available for detection');
      return detected;
    }
    
    log.debug(`Searching for ${entityMap.size} cached OpenAEV entity names/aliases`);
    
    // Sort by name length (longest first) to match longer names before substrings
    const sortedEntities = Array.from(entityMap.entries()).sort((a, b) => b[0].length - a[0].length);
    
    for (const [nameLower, entity] of sortedEntities) {
      // Skip very short names (except for MITRE IDs which are 4+ chars like T1059)
      const isMitreId = /^t\d{4}(\.\d{3})?$/i.test(nameLower);
      if (nameLower.length < 4) continue;
      
      // Skip if we already found this entity
      if (seenEntities.has(entity.id)) continue;
      
      // Escape special regex characters in the name
      const escapedName = nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Determine matching strategy based on content type
      const hasSpecialChars = /[.\-_@]/.test(nameLower);
      const isIpAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(nameLower);
      const isMacAddress = /^([0-9a-f]{2}[:\-]){5}[0-9a-f]{2}$/i.test(nameLower);
      
      let regex: RegExp;
      if (isIpAddress || isMacAddress) {
        // IP and MAC addresses: match exactly with word boundaries or punctuation boundaries
        // Use lookahead/lookbehind simulation for IPs
        regex = new RegExp(`(?<![\\w.])${escapedName}(?![\\w.])`, 'gi');
      } else if (isMitreId) {
        // MITRE IDs (T1059, T1059.001): require exact word boundaries
        regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
      } else if (hasSpecialChars) {
        // Names with special characters: simple match, verify boundaries later
        regex = new RegExp(escapedName, 'gi');
      } else {
        // Normal names: use word boundaries for exact word match
        regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
      }
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        const matchedText = match[0];
        if (!matchedText || matchedText.toLowerCase() !== nameLower) continue;
        
        const startIndex = match.index;
        const endIndex = startIndex + matchedText.length;
        
        // For names with special chars (but not IPs/MACs/MITRE IDs), verify boundaries manually
        if (hasSpecialChars && !isIpAddress && !isMacAddress && !isMitreId) {
          const charBefore = startIndex > 0 ? text[startIndex - 1] : ' ';
          const charAfter = endIndex < text.length ? text[endIndex] : ' ';
          
          const isValidBoundary = (c: string) => /[\s,;:!?()[\]"'<>\/\\@#$%^&*+=|`~\n\r\t]/.test(c) || c === '';
          if (!isValidBoundary(charBefore) && /[a-zA-Z0-9]/.test(charBefore)) continue;
          if (!isValidBoundary(charAfter) && /[a-zA-Z0-9]/.test(charAfter)) continue;
        }
        
        // Check for overlapping ranges
        const rangeKey = `${startIndex}-${endIndex}`;
        let hasOverlap = false;
        for (const existingRange of seenRanges) {
          const [existStart, existEnd] = existingRange.split('-').map(Number);
          if (!(endIndex <= existStart || startIndex >= existEnd)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) continue;
        
        detected.push({
          type: entity.type,
          name: entity.name,
          value: matchedText,
          startIndex,
          endIndex,
          found: true,
          entityId: entity.id,
          platformId: entity.platformId,
        });
        
        seenEntities.add(entity.id);
        seenRanges.add(rangeKey);
        break; // Only detect first occurrence per entity
      }
    }
    
    log.debug(`Found ${detected.length} OpenAEV entities from cache`);
    return detected;
  }

  /**
   * Full scan of text content
   */
  async scan(
    text: string,
    knownEntityNames: string[] = []
  ): Promise<DetectionResult> {
    const startTime = performance.now();

    // Detect all observables
    const observables = this.detectObservables(text);
    
    // Detect CVEs
    const cves = this.detectCVEs(text);
    
    // Detect SDOs from cache first (fast, offline)
    const cachedSDOs = await this.detectSDOsFromCache(text);
    
    // Detect OpenAEV entities from cache
    const oaevEntities = await this.detectOAEVEntitiesFromCache(text);
    
    // Also detect from provided entity names (fallback/additional)
    let additionalSDOs: DetectedSDO[] = [];
    if (knownEntityNames.length > 0) {
      additionalSDOs = await this.detectSDOs(text, knownEntityNames);
    }
    
    // Merge SDOs, preferring cached ones
    const allSDOs = [...cachedSDOs];
    const seenNames = new Set(cachedSDOs.map(s => s.name.toLowerCase()));
    for (const sdo of additionalSDOs) {
      if (!seenNames.has(sdo.name.toLowerCase())) {
        allSDOs.push(sdo);
        seenNames.add(sdo.name.toLowerCase());
      }
    }

    // Enrich observables and CVEs with OpenCTI data
    // SDOs from cache are already enriched
    const [enrichedObservables, enrichedCVEs] = await Promise.all([
      this.enrichObservables(observables),
      this.enrichCVEs(cves),
    ]);
    
    // For SDOs not from cache, enrich them
    const sdosToEnrich = allSDOs.filter(s => !s.found);
    const enrichedSDOsFromAPI = sdosToEnrich.length > 0 
      ? await this.enrichSDOs(sdosToEnrich)
      : [];
    
    // Merge all SDOs
    const finalSDOs = allSDOs.map(sdo => {
      if (sdo.found) return sdo;
      const enriched = enrichedSDOsFromAPI.find(e => e.name.toLowerCase() === sdo.name.toLowerCase());
      return enriched || sdo;
    });

    const scanTime = performance.now() - startTime;

    return {
      observables: enrichedObservables,
      sdos: finalSDOs,
      cves: enrichedCVEs,
      oaevEntities,
      scanTime,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract clean text from HTML
 */
export function extractTextFromHTML(html: string): string {
  // Create a temporary element to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Remove script and style elements
  const scripts = doc.querySelectorAll('script, style, noscript');
  scripts.forEach((el) => el.remove());
  
  // Get text content
  return doc.body.textContent || '';
}

/**
 * Get text nodes from a DOM element for highlighting
 */
export function getTextNodes(element: Node): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip empty nodes and nodes in scripts/styles
        if (!node.textContent?.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (
          parent &&
          ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(
            parent.tagName
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  return textNodes;
}

/**
 * Normalize whitespace in text for matching
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

