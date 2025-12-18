/**
 * Observable and Entity Detection Engine
 * 
 * Scans text content to detect observables and threat intelligence entities.
 */

import { loggers } from '../utils/logger';
import type {
  DetectedObservable,
  DetectedSDO,
  DetectedPlatformEntity,
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
import {
  createMatchingRegex,
  hasValidBoundaries,
  hasOverlappingRange,
  createRangeKey,
  isParentMitreId,
  needsManualBoundaryCheck,
} from './matching';
import { OpenCTIClient } from '../api/opencti-client';
import {
  getAllCachedEntityNamesForMatching,
  getAllCachedOAEVEntityNamesForMatching,
} from '../utils/storage';

// Re-export utilities for backwards compatibility
export { extractTextFromHTML, getTextNodes, normalizeText } from './text-utils';

const log = loggers.detection;

// ============================================================================
// Detection Result Types
// ============================================================================

export interface DetectionResult {
  observables: DetectedObservable[];
  openctiEntities: DetectedSDO[];
  cves: DetectedSDO[];
  openaevEntities: DetectedPlatformEntity[];
  scanTime: number;
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
  }

  /**
   * Scan text content for observables
   */
  detectObservables(text: string): DetectedObservable[] {
    const detected: DetectedObservable[] = [];
    const seenRanges = new Set<string>();
    const seenRefangedValues = new Map<string, DetectedObservable>(); // Track by refanged value + type

    // Sort patterns by priority
    const sortedPatterns = [...OBSERVABLE_PATTERNS].sort(
      (a, b) => b.priority - a.priority
    );

    for (const config of sortedPatterns) {
      const matches = this.findMatches(text, config);
      
      for (const match of matches) {
        // Check for overlapping ranges
        const rangeKey = createRangeKey(match.startIndex, match.endIndex);
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

        if (overlaps) {
          continue;
        }

        // Deduplicate by refanged value + type (same indicator, different representation)
        // Keep the non-defanged version if both exist (cleaner for display)
        const dedupeKey = `${match.type}:${(match.refangedValue || match.value).toLowerCase()}`;
        const existingByValue = seenRefangedValues.get(dedupeKey);
        
        if (existingByValue) {
          // If existing is defanged but new one isn't, replace with the non-defanged version
          if (existingByValue.isDefanged && !match.isDefanged) {
            const existingIndex = detected.indexOf(existingByValue);
            if (existingIndex !== -1) {
              detected.splice(existingIndex, 1);
              seenRanges.delete(createRangeKey(existingByValue.startIndex, existingByValue.endIndex));
            }
            seenRanges.add(rangeKey);
            seenRefangedValues.set(dedupeKey, match);
            detected.push(match);
          }
          // Otherwise skip (keep the first/non-defanged occurrence)
          continue;
        }

        seenRanges.add(rangeKey);
        seenRefangedValues.set(dedupeKey, match);
        detected.push(match);
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
      // Normalize various dash characters to standard hyphen for consistent lookup
      const normalizedName = match[0].toUpperCase().replace(/[\u2010\u2011\u2012\u2013]/g, '-');
      detected.push({
        type: 'Vulnerability',
        name: normalizedName,
        matchedValue: match[0], // Keep original for highlighting
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
  async detectSDOs(text: string, entityNames: string[]): Promise<DetectedSDO[]> {
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
   */
  async enrichObservables(observables: DetectedObservable[]): Promise<DetectedObservable[]> {
    const searchPromises = observables.map(async (obs) => {
      const platformMatches: Array<{ platformId: string; entityId: string; entityData: StixCyberObservable }> = [];
      const searchValue = obs.refangedValue || obs.value;
      
      for (const [platformId, client] of this.clients) {
        try {
          let result: StixCyberObservable | null = null;

          if (obs.hashType) {
            result = await client.searchObservableByHash(searchValue, obs.hashType);
          } else {
            result = await client.searchObservableByValue(searchValue, obs.type);
          }

          if (result) {
            platformMatches.push({ platformId, entityId: result.id, entityData: result });
          }
        } catch {
          // Continue to next platform
        }
      }
      
      if (platformMatches.length > 0) {
        const firstMatch = platformMatches[0];
        return {
          ...obs,
          found: true,
          entityId: firstMatch.entityId,
          entityData: firstMatch.entityData,
          platformId: firstMatch.platformId,
          platformMatches: platformMatches.length > 1 ? platformMatches : undefined,
        };
      }
      
      return obs;
    });

    return Promise.all(searchPromises);
  }

  /**
   * Enrich detected SDOs with OpenCTI data (searches ALL platforms)
   */
  async enrichSDOs(sdos: DetectedSDO[]): Promise<DetectedSDO[]> {
    const uniqueNames = [...new Set(sdos.map((s) => s.name))];
    const searchResults = new Map<string, Array<{ entity: StixDomainObject; platformId: string }>>();

    for (const name of uniqueNames) {
      const matches: Array<{ entity: StixDomainObject; platformId: string }> = [];
      
      for (const [platformId, client] of this.clients) {
        try {
          const result = await client.searchSDOByNameOrAlias(
            name,
            SDO_SEARCH_TYPES as unknown as string[]
          );
          if (result) {
            matches.push({ entity: result, platformId });
          }
        } catch {
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
    const uniqueCVEs = [...new Set(cves.map((c) => c.name))];
    const searchResults = new Map<string, { entity: StixDomainObject; platformId: string }>();

    for (const cve of uniqueCVEs) {
      for (const [platformId, client] of this.clients) {
        try {
          const result = await client.searchSDOByNameOrAlias(cve, ['Vulnerability']);
          if (result) {
            searchResults.set(cve.toUpperCase(), { entity: result, platformId });
            break; // Found, no need to search other platforms
          }
        } catch {
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
    const seenEntities = new Set<string>();
    const seenRanges = new Set<string>();
    
    const entityMap = await getAllCachedEntityNamesForMatching();
    
    if (entityMap.size === 0) {
      log.debug(' No cached entities available for SDO detection');
      return detected;
    }
    
    log.debug(`Searching for ${entityMap.size} cached entity names/aliases`);
    
    // Sort by name length (longest first) to match longer names before substrings
    const sortedEntities = Array.from(entityMap.entries()).sort((a, b) => b[0].length - a[0].length);
    
    for (const [nameLower, entity] of sortedEntities) {
      // Skip very short names (< 3 chars) to avoid false positives
      if (nameLower.length < 3) continue;
      
      // Skip if we already found this entity
      if (seenEntities.has(entity.id)) continue;
      
      const regex = createMatchingRegex(nameLower);
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        const matchedText = match[0];
        if (!matchedText || matchedText.toLowerCase() !== nameLower) continue;
        
        const startIndex = match.index;
        const endIndex = startIndex + matchedText.length;
        
        // For parent MITRE techniques, skip if followed by a dot (part of sub-technique)
        if (isParentMitreId(nameLower)) {
          const charAfter = endIndex < text.length ? text[endIndex] : '';
          if (charAfter === '.') continue;
        }
        
        // For names with special chars (but not IPs/MACs/MITRE IDs), verify boundaries manually
        if (needsManualBoundaryCheck(nameLower)) {
          if (!hasValidBoundaries(text, startIndex, endIndex)) continue;
        }
        
        // Check for overlapping ranges
        const rangeKey = createRangeKey(startIndex, endIndex);
        if (hasOverlappingRange(startIndex, endIndex, seenRanges)) continue;
        
        detected.push({
          type: entity.type as DetectedSDO['type'],
          name: entity.name,
          matchedValue: matchedText !== entity.name ? matchedText : undefined,
          startIndex,
          endIndex,
          found: true,
          entityId: entity.id,
          platformId: entity.platformId,
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
   * Detect platform entities (OpenAEV, etc.) using cached entity names
   */
  async detectPlatformEntitiesFromCache(text: string): Promise<DetectedPlatformEntity[]> {
    const detected: DetectedPlatformEntity[] = [];
    const seenEntities = new Set<string>();
    const seenRanges = new Set<string>();
    
    const entityMap = await getAllCachedOAEVEntityNamesForMatching();
    
    if (entityMap.size === 0) {
      log.debug(' No cached platform entities available for detection');
      return detected;
    }
    
    log.debug(`Searching for ${entityMap.size} cached platform entity names/aliases`);
    
    // Sort by name length (longest first) to match longer names before substrings
    const sortedEntities = Array.from(entityMap.entries()).sort((a, b) => b[0].length - a[0].length);
    
    for (const [nameLower, entity] of sortedEntities) {
      // Skip very short names (except for MITRE IDs which are 4+ chars)
      if (nameLower.length < 4) continue;
      
      // Skip if we already found this entity
      if (seenEntities.has(entity.id)) continue;
      
      const regex = createMatchingRegex(nameLower);
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        const matchedText = match[0];
        if (!matchedText || matchedText.toLowerCase() !== nameLower) continue;
        
        const startIndex = match.index;
        const endIndex = startIndex + matchedText.length;
        
        // For parent MITRE techniques, skip if followed by a dot (part of sub-technique)
        if (isParentMitreId(nameLower)) {
          const charAfter = endIndex < text.length ? text[endIndex] : '';
          if (charAfter === '.') continue;
        }
        
        // For names with special chars (but not IPs/MACs/MITRE IDs), verify boundaries manually
        if (needsManualBoundaryCheck(nameLower)) {
          if (!hasValidBoundaries(text, startIndex, endIndex)) continue;
        }
        
        // Check for overlapping ranges
        const rangeKey = createRangeKey(startIndex, endIndex);
        if (hasOverlappingRange(startIndex, endIndex, seenRanges)) continue;
        
        detected.push({
          platformType: 'openaev',
          type: entity.type,
          name: entity.name,
          value: matchedText,
          startIndex,
          endIndex,
          found: true,
          entityId: entity.id,
          platformId: entity.platformId,
          entityData: entity,
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
  async scan(text: string, knownEntityNames: string[] = []): Promise<DetectionResult> {
    const startTime = performance.now();

    // Detect all observables
    const observables = this.detectObservables(text);
    
    // Detect CVEs
    const cves = this.detectCVEs(text);
    
    // Detect SDOs from cache first (fast, offline)
    const cachedSDOs = await this.detectSDOsFromCache(text);
    
    // Detect OpenAEV entities from cache
    const openaevEntities = await this.detectPlatformEntitiesFromCache(text);
    
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
      openctiEntities: finalSDOs,
      cves: enrichedCVEs,
      openaevEntities,
      scanTime,
    };
  }
}
