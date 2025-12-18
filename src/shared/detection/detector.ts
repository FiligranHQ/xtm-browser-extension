/**
 * Observable and Entity Detection Engine
 * 
 * Scans text content to detect observables and threat intelligence entities.
 */

import { loggers } from '../utils/logger';
import type {
  DetectedObservable,
  DetectedOCTIEntity,
  OCTIStixCyberObservable,
  OCTIStixDomainObject,
  EnrichmentMatch,
  EnrichmentPlatformType,
  ObservableType,
} from '../types';
import type { DetectedOAEVEntity } from '../types/openaev';
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
import { OpenAEVClient } from '../api/openaev-client';
import {
  getAllCachedOCTIEntityNamesForMatching,
  getAllCachedOAEVEntityNamesForMatching,
} from '../utils/storage';

const log = loggers.detection;

// ============================================================================
// Detection Result Types
// ============================================================================

export interface DetectionResult {
  observables: DetectedObservable[];
  openctiEntities: DetectedOCTIEntity[];
  cves: DetectedOCTIEntity[];
  openaevEntities: DetectedOAEVEntity[];
  scanTime: number;
}

/**
 * Settings for vulnerability/CVE detection
 * Controls which platforms should search for CVEs
 */
export interface VulnerabilityDetectionSettings {
  /** Whether to search OpenCTI platforms for CVEs */
  enabledForOpenCTI: boolean;
  /** Whether to search OpenAEV platforms for CVEs */
  enabledForOpenAEV: boolean;
}

// ============================================================================
// Detection Engine
// ============================================================================

export class DetectionEngine {
  private clients: Map<string, OpenCTIClient>;
  private oaevClients: Map<string, OpenAEVClient>;
  private primaryClient: OpenCTIClient | null;

  constructor(clients: Map<string, OpenCTIClient>, oaevClients?: Map<string, OpenAEVClient>) {
    this.clients = clients;
    this.oaevClients = oaevClients || new Map();
    // Get first client as primary
    const firstEntry = clients.entries().next().value;
    this.primaryClient = firstEntry ? firstEntry[1] : null;
  }

  /**
   * Set OpenAEV clients for multi-platform enrichment
   */
  setOAEVClients(clients: Map<string, OpenAEVClient>): void {
    this.oaevClients = clients;
  }

  /**
   * Get all available platform clients for enrichment
   */
  getAvailablePlatforms(): { opencti: string[]; openaev: string[] } {
    return {
      opencti: Array.from(this.clients.keys()),
      openaev: Array.from(this.oaevClients.keys()),
    };
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
  detectCVEs(text: string): DetectedOCTIEntity[] {
    const detected: DetectedOCTIEntity[] = [];
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
   * Search for known OpenCTI entity names in text
   */
  async detectOCTIEntitiesFromNames(text: string, entityNames: string[]): Promise<DetectedOCTIEntity[]> {
    const detected: DetectedOCTIEntity[] = [];

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
      const platformMatches: Array<{ platformId: string; entityId: string; entityData: OCTIStixCyberObservable }> = [];
      const searchValue = obs.refangedValue || obs.value;
      
      for (const [platformId, client] of this.clients) {
        try {
          let result: OCTIStixCyberObservable | null = null;

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
   * Enrich detected OpenCTI entities with data from OpenCTI API (searches ALL platforms)
   */
  async enrichOCTIEntities(entities: DetectedOCTIEntity[]): Promise<DetectedOCTIEntity[]> {
    const uniqueNames = [...new Set(entities.map((e) => e.name))];
    const searchResults = new Map<string, Array<{ entity: OCTIStixDomainObject; platformId: string }>>();

    for (const name of uniqueNames) {
      const matches: Array<{ entity: OCTIStixDomainObject; platformId: string }> = [];
      
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

    return entities.map((entity) => {
      const matches = searchResults.get(entity.name.toLowerCase());
      if (matches && matches.length > 0) {
        const firstMatch = matches[0];
        return {
          ...entity,
          type: firstMatch.entity.entity_type as DetectedOCTIEntity['type'],
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
      return entity;
    });
  }

  // ============================================================================
  // Multi-Platform Enrichment Infrastructure
  // ============================================================================
  // Generic enrichment system that supports CVE/Vulnerability enrichment now
  // and is designed to support Observable enrichment in OpenAEV in the future.

  /**
   * Search for a vulnerability/CVE across all platforms
   * @param cveId - The CVE identifier (e.g., CVE-2024-1234)
   * @param vulnSettings - Settings controlling which platforms to search
   * @returns Array of enrichment matches from all platforms
   */
  private async searchVulnerabilityAcrossPlatforms(
    cveId: string,
    vulnSettings: VulnerabilityDetectionSettings = { enabledForOpenCTI: true, enabledForOpenAEV: true }
  ): Promise<EnrichmentMatch[]> {
    const matches: EnrichmentMatch[] = [];

    // Search OpenCTI platforms (only if enabled)
    if (vulnSettings.enabledForOpenCTI) {
      for (const [platformId, client] of this.clients) {
        try {
          const result = await client.searchSDOByNameOrAlias(cveId, ['Vulnerability']);
          if (result) {
            log.debug(`[Enrichment] Found ${cveId} in OpenCTI platform ${platformId}`);
            matches.push({
              platformId,
              platformType: 'opencti',
              entityId: result.id,
              entityType: 'Vulnerability',
              entityData: result as unknown as Record<string, unknown>,
            });
          }
        } catch (error) {
          log.debug(`[Enrichment] Error searching ${cveId} in OpenCTI ${platformId}:`, error);
        }
      }
    }

    // Search OpenAEV platforms (only if enabled)
    if (vulnSettings.enabledForOpenAEV) {
      for (const [platformId, client] of this.oaevClients) {
        try {
          log.debug(`[Enrichment] Searching ${cveId} in OpenAEV platform ${platformId}...`);
          const result = await client.getVulnerabilityByExternalId(cveId);
          if (result) {
            log.debug(`[Enrichment] Found ${cveId} in OpenAEV platform ${platformId}`);
            matches.push({
              platformId,
              platformType: 'openaev',
              entityId: result.vulnerability_id,
              entityType: 'oaev-Vulnerability',
              entityData: {
                id: result.vulnerability_id,
                entity_type: 'oaev-Vulnerability',
                name: result.vulnerability_external_id,
                description: result.vulnerability_description,
                x_opencti_cvss_base_score: result.vulnerability_cvss_v31,
                vulnerability_vuln_status: result.vulnerability_vuln_status,
                vulnerability_cisa_vulnerability_name: result.vulnerability_cisa_vulnerability_name,
                vulnerability_remediation: result.vulnerability_remediation,
                vulnerability_reference_urls: result.vulnerability_reference_urls,
              },
            });
          } else {
            log.debug(`[Enrichment] ${cveId} not found in OpenAEV platform ${platformId}`);
          }
        } catch (error) {
          log.debug(`[Enrichment] Error searching ${cveId} in OpenAEV ${platformId}:`, error);
        }
      }
    }

    return matches;
  }

  /**
   * Search for an observable across all platforms
   * Currently only implemented for OpenCTI, OpenAEV support coming soon.
   * 
   * @param observableValue - The observable value (e.g., IP address, domain)
   * @param observableType - The type of observable (e.g., 'IPv4-Addr', 'Domain-Name')
   * @returns Array of enrichment matches from all platforms
   * 
   * @internal This method is prepared for future multi-platform observable enrichment.
   * Currently observables are enriched via the existing enrichObservables() method.
   */
  private async searchObservableAcrossPlatforms(
    observableValue: string, 
    observableType: string
  ): Promise<EnrichmentMatch[]> {
    const matches: EnrichmentMatch[] = [];

    // Search OpenCTI platforms
    for (const [platformId, client] of this.clients) {
      try {
        const result = await client.searchObservableByValue(observableValue, observableType as ObservableType);
        if (result) {
          log.debug(`[Enrichment] Found observable ${observableValue} in OpenCTI platform ${platformId}`);
          matches.push({
            platformId,
            platformType: 'opencti',
            entityId: result.id,
            entityType: observableType,
            entityData: result as unknown as Record<string, unknown>,
          });
        }
      } catch (error) {
        log.debug(`[Enrichment] Error searching observable ${observableValue} in OpenCTI ${platformId}:`, error);
      }
    }

    // TODO: Search OpenAEV platforms for observables (Findings)
    // When OpenAEV adds observable/finding search by value, implement here:
    // for (const [platformId, client] of this.oaevClients) {
    //   const result = await client.searchFindingByValue(observableValue);
    //   if (result) matches.push({ platformId, platformType: 'openaev', ... });
    // }

    return matches;
  }

  /**
   * Convert enrichment matches to the PlatformMatch format used in DetectedOCTIEntity
   */
  private enrichmentMatchesToPlatformMatches(matches: EnrichmentMatch[]): Array<{
    platformId: string;
    platformType: EnrichmentPlatformType;
    entityId: string;
    entityData: Record<string, unknown>;
    type: string;
  }> {
    return matches.map(m => ({
      platformId: m.platformId,
      platformType: m.platformType,
      entityId: m.entityId,
      entityData: m.entityData,
      type: m.entityType,
    }));
  }

  /**
   * Enrich CVEs/Vulnerabilities with data from OpenCTI and/or OpenAEV platforms
   * Supports multi-platform matches (CVE found in both platforms)
   * @param cves - Detected CVEs to enrich
   * @param vulnSettings - Settings controlling which platforms to search
   */
  async enrichCVEs(
    cves: DetectedOCTIEntity[],
    vulnSettings: VulnerabilityDetectionSettings = { enabledForOpenCTI: true, enabledForOpenAEV: true }
  ): Promise<DetectedOCTIEntity[]> {
    // If vulnerability detection is disabled for all platforms, return as-is
    if (!vulnSettings.enabledForOpenCTI && !vulnSettings.enabledForOpenAEV) {
      log.debug('[CVE Enrichment] Vulnerability detection disabled for all platforms, skipping enrichment');
      return cves;
    }

    const uniqueCVEs = [...new Set(cves.map((c) => c.name))];
    const searchResults = new Map<string, EnrichmentMatch[]>();

    const octiCount = vulnSettings.enabledForOpenCTI ? this.clients.size : 0;
    const oaevCount = vulnSettings.enabledForOpenAEV ? this.oaevClients.size : 0;
    log.info(`[CVE Enrichment] Enriching ${uniqueCVEs.length} CVEs across ${octiCount} OpenCTI and ${oaevCount} OpenAEV clients`);
    
    // Log available platforms for debugging
    if (vulnSettings.enabledForOpenAEV && this.oaevClients.size > 0) {
      for (const [platformId] of this.oaevClients) {
        log.info(`[CVE Enrichment] OpenAEV client available: ${platformId}`);
      }
    } else if (vulnSettings.enabledForOpenAEV) {
      log.warn('[CVE Enrichment] No OpenAEV clients available for CVE enrichment!');
    }

    // Search each CVE across enabled platforms
    for (const cve of uniqueCVEs) {
      const matches = await this.searchVulnerabilityAcrossPlatforms(cve, vulnSettings);
      if (matches.length > 0) {
        searchResults.set(cve.toUpperCase(), matches);
        log.info(`[CVE Enrichment] ${cve}: Found in ${matches.length} platform(s)`);
      }
    }

    // Apply enrichment results to the detected CVEs
    return cves.map((cve) => {
      const matches = searchResults.get(cve.name.toUpperCase());
      if (matches && matches.length > 0) {
        const firstMatch = matches[0];
        return {
          ...cve,
          found: true,
          entityId: firstMatch.entityId,
          entityData: firstMatch.entityData as unknown as OCTIStixDomainObject,
          platformId: firstMatch.platformId,
          platformMatches: this.enrichmentMatchesToPlatformMatches(matches),
        };
      }
      return cve;
    });
  }

  /**
   * Future: Enrich observables across all platforms using multi-platform infrastructure
   * 
   * This method is prepared for when OpenAEV adds observable/finding search.
   * Currently, the existing enrichObservables() method handles OpenCTI-only enrichment.
   * 
   * @internal Reserved for future multi-platform observable enrichment
   */
  async enrichObservablesMultiPlatform(observables: DetectedObservable[]): Promise<DetectedObservable[]> {
    const uniqueObservables = new Map<string, { type: string; value: string }>();
    for (const obs of observables) {
      const key = `${obs.type}:${obs.refangedValue || obs.value}`;
      if (!uniqueObservables.has(key)) {
        uniqueObservables.set(key, { type: obs.type, value: obs.refangedValue || obs.value });
      }
    }

    const searchResults = new Map<string, EnrichmentMatch[]>();

    log.info(`[Observable Enrichment] Enriching ${uniqueObservables.size} unique observables across all platforms`);

    // Search each observable across all platforms
    for (const [key, { type, value }] of uniqueObservables) {
      const matches = await this.searchObservableAcrossPlatforms(value, type);
      if (matches.length > 0) {
        searchResults.set(key, matches);
        log.debug(`[Observable Enrichment] ${value}: Found in ${matches.length} platform(s)`);
      }
    }

    // Apply enrichment results to the detected observables
    return observables.map((obs) => {
      const key = `${obs.type}:${obs.refangedValue || obs.value}`;
      const matches = searchResults.get(key);
      if (matches && matches.length > 0) {
        const firstMatch = matches[0];
        return {
          ...obs,
          found: true,
          entityId: firstMatch.entityId,
          entityData: firstMatch.entityData as unknown as OCTIStixCyberObservable,
          platformId: firstMatch.platformId,
          platformMatches: this.enrichmentMatchesToPlatformMatches(matches),
        };
      }
      return obs;
    });
  }

  /**
   * Detect OpenCTI entities using cached entity names
   * Now supports multiple entities with the same name but different types
   * (e.g., "Phishing" as both Malware and Attack Pattern)
   */
  async detectOCTIEntitiesFromCache(text: string): Promise<DetectedOCTIEntity[]> {
    const detected: DetectedOCTIEntity[] = [];
    const seenEntities = new Set<string>();
    const seenRanges = new Set<string>();
    
    const entityMap = await getAllCachedOCTIEntityNamesForMatching();
    
    if (entityMap.size === 0) {
      log.debug('No cached entities available for OpenCTI entity detection');
      return detected;
    }
    
    log.debug(`Searching for ${entityMap.size} cached entity names/aliases`);
    
    // Sort by name length (longest first) to match longer names before substrings
    const sortedEntities = Array.from(entityMap.entries()).sort((a, b) => b[0].length - a[0].length);
    
    for (const [nameLower, entities] of sortedEntities) {
      // Skip very short names (< 3 chars) to avoid false positives
      if (nameLower.length < 3) continue;
      
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
        
        // Add ALL entities with this name (supports multiple types like Malware + Attack Pattern)
        for (const entity of entities) {
          // Skip if we already found this specific entity
          if (seenEntities.has(entity.id)) continue;
          
          detected.push({
            type: entity.type as DetectedOCTIEntity['type'],
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
            } as unknown as OCTIStixDomainObject,
          });
          
          seenEntities.add(entity.id);
        }
        
        seenRanges.add(rangeKey);
        break; // Only detect first text occurrence per name
      }
    }
    
    log.debug(`Found ${detected.length} OpenCTI entities from cache`);
    return detected;
  }

  /**
   * Detect OpenAEV entities using cached entity names
   * Now supports multiple entities with the same name but different types
   */
  async detectOAEVEntitiesFromCache(text: string): Promise<DetectedOAEVEntity[]> {
    const detected: DetectedOAEVEntity[] = [];
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
    
    for (const [nameLower, entities] of sortedEntities) {
      // Skip very short names (except for MITRE IDs which are 4+ chars)
      if (nameLower.length < 4) continue;
      
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
        
        // Add ALL entities with this name (supports multiple types)
        for (const entity of entities) {
          // Skip if we already found this specific entity
          if (seenEntities.has(entity.id)) continue;
          
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
        }
        
        seenRanges.add(rangeKey);
        break; // Only detect first text occurrence per name
      }
    }
    
    log.debug(`Found ${detected.length} OpenAEV entities from cache`);
    return detected;
  }

  /**
   * Full scan of text content
   * @param text - Text content to scan
   * @param knownEntityNames - Optional array of known entity names to search for
   * @param vulnSettings - Optional settings for vulnerability/CVE detection
   */
  async scan(
    text: string,
    knownEntityNames: string[] = [],
    vulnSettings: VulnerabilityDetectionSettings = { enabledForOpenCTI: true, enabledForOpenAEV: true }
  ): Promise<DetectionResult> {
    const startTime = performance.now();

    // Detect all observables
    const observables = this.detectObservables(text);
    
    // Detect CVEs - only if vulnerability detection is enabled for at least one platform
    const vulnEnabled = vulnSettings.enabledForOpenCTI || vulnSettings.enabledForOpenAEV;
    const cves = vulnEnabled ? this.detectCVEs(text) : [];
    if (!vulnEnabled) {
      log.debug('[Scan] CVE detection skipped - Vulnerability disabled for all platforms');
    }
    
    // Detect OpenCTI entities from cache first (fast, offline)
    const cachedOCTIEntities = await this.detectOCTIEntitiesFromCache(text);
    
    // Detect OpenAEV entities from cache
    const openaevEntities = await this.detectOAEVEntitiesFromCache(text);
    
    // Also detect from provided entity names (fallback/additional)
    let additionalOCTIEntities: DetectedOCTIEntity[] = [];
    if (knownEntityNames.length > 0) {
      additionalOCTIEntities = await this.detectOCTIEntitiesFromNames(text, knownEntityNames);
    }
    
    // Merge OCTI entities, preferring cached ones
    const allOCTIEntities = [...cachedOCTIEntities];
    const seenNames = new Set(cachedOCTIEntities.map(e => e.name.toLowerCase()));
    for (const entity of additionalOCTIEntities) {
      if (!seenNames.has(entity.name.toLowerCase())) {
        allOCTIEntities.push(entity);
        seenNames.add(entity.name.toLowerCase());
      }
    }

    // Enrich observables (OpenCTI) and CVEs (OpenCTI and/or OpenAEV based on settings)
    const [enrichedObservables, enrichedCVEs] = await Promise.all([
      this.enrichObservables(observables),
      vulnEnabled ? this.enrichCVEs(cves, vulnSettings) : Promise.resolve([]),
    ]);
    
    // For OCTI entities not from cache, enrich them
    const octiEntitiesToEnrich = allOCTIEntities.filter(e => !e.found);
    const enrichedOCTIEntitiesFromAPI = octiEntitiesToEnrich.length > 0 
      ? await this.enrichOCTIEntities(octiEntitiesToEnrich)
      : [];
    
    // Merge all OCTI entities
    const finalOCTIEntities = allOCTIEntities.map(entity => {
      if (entity.found) return entity;
      const enriched = enrichedOCTIEntitiesFromAPI.find(e => e.name.toLowerCase() === entity.name.toLowerCase());
      return enriched || entity;
    });

    const scanTime = performance.now() - startTime;

    return {
      observables: enrichedObservables,
      openctiEntities: finalOCTIEntities,
      cves: enrichedCVEs,
      openaevEntities,
      scanTime,
    };
  }
}
