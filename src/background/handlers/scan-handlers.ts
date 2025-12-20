/**
 * Scan Message Handlers
 * 
 * Handles page scanning for entities across platforms.
 */

import { loggers } from '../../shared/utils/logger';
import { DetectionEngine } from '../../shared/detection/detector';
import { getSettings, getAllCachedOAEVEntityNamesForMatching, getMultiPlatformOAEVCache } from '../../shared/utils/storage';
import { successResponse, errorResponse, type SendResponseFn } from '../../shared/types/common';
import { isValidBoundary } from '../../shared/detection/matching';
import type { DetectedObservable } from '../../shared/types/observables';
import type { DetectedOCTIEntity } from '../../shared/types/opencti';
import type { ScanResultPayload } from '../../shared/types/messages';

const log = loggers.background;

/**
 * Dependency container for scan handlers
 */
export interface ScanHandlerDependencies {
  getDetectionEngine: () => DetectionEngine | null;
  getOpenAEVClients: () => Map<string, unknown>;
}

/**
 * Handle SCAN_PAGE - OpenCTI entities only
 */
export async function handleScanPage(
  payload: { content: string; url: string },
  sendResponse: SendResponseFn,
  deps: ScanHandlerDependencies
): Promise<void> {
  const detectionEngine = deps.getDetectionEngine();
  
  if (!detectionEngine) {
    sendResponse(errorResponse('OpenCTI not configured'));
    return;
  }
  
  try {
    // Get detection settings BEFORE scan to determine vulnerability detection scope
    const settings = await getSettings();
    const disabledObservableTypes = settings.detection?.disabledObservableTypes || [];
    const disabledOpenCTITypes = settings.detection?.disabledOpenCTITypes || [];
    const disabledOpenAEVTypes = settings.detection?.disabledOpenAEVTypes || [];
    
    // Determine vulnerability/CVE detection settings per platform
    const vulnSettings = {
      enabledForOpenCTI: !disabledOpenCTITypes.includes('Vulnerability'),
      enabledForOpenAEV: !disabledOpenAEVTypes.includes('Vulnerability'),
    };
    
    const result = await detectionEngine.scan(payload.content, [], vulnSettings);
    
    // Filter - exclude disabled types (empty = all enabled)
    const filteredObservables = result.observables.filter(obs => 
      !disabledObservableTypes.includes(obs.type)
    );
    const filteredOpenctiEntities = result.openctiEntities.filter(entity => 
      !disabledOpenCTITypes.includes(entity.type)
    );
    
    const scanResult: ScanResultPayload = {
      observables: filteredObservables,
      openctiEntities: filteredOpenctiEntities,
      cves: result.cves, // CVEs already filtered by vulnSettings
      openaevEntities: [],
      scanTime: result.scanTime,
      url: payload.url,
    };
    
    sendResponse(successResponse(scanResult));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Scan failed',
    });
  }
}

/**
 * Handle SCAN_OAEV - OpenAEV entities only
 */
export async function handleScanOAEV(
  payload: { content: string; url: string; includeAttackPatterns?: boolean },
  sendResponse: SendResponseFn
): Promise<void> {
  try {
    const oaevEntityMap = await getAllCachedOAEVEntityNamesForMatching();
    
    // Debug: Log cache contents
    const oaevCache = await getMultiPlatformOAEVCache();
    log.debug('SCAN_OAEV: OpenAEV cache platforms:', Object.keys(oaevCache.platforms));
    
    const includeAttackPatterns = payload.includeAttackPatterns === true;
    log.debug(`SCAN_OAEV: Searching for ${oaevEntityMap.size} cached OpenAEV entities (includeAttackPatterns: ${includeAttackPatterns})`);
    
    const openaevEntities = scanForOAEVEntities(
      payload.content,
      oaevEntityMap,
      includeAttackPatterns
    );
    
    const scanResult = {
      openaevEntities,
      scanTime: 0,
      url: payload.url,
    };
    
    sendResponse(successResponse(scanResult));
  } catch (error) {
    log.error('SCAN_OAEV error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'OpenAEV scan failed',
    });
  }
}

/**
 * Scan text for OpenAEV entities
 * Supports multiple entities with the same name but different types
 */
export function scanForOAEVEntities(
  content: string,
  entityMap: Map<string, { id: string; name: string; type: string; platformId: string }[]>,
  includeAttackPatterns: boolean
): ScanResultPayload['openaevEntities'] {
  const openaevEntities: ScanResultPayload['openaevEntities'] = [];
  const originalText = content;
  const textLower = originalText.toLowerCase();
  const seenEntities = new Set<string>();
  const seenRanges = new Set<string>();
  
  // Sort by name length (longest first) to match longer names before substrings
  const sortedEntities = Array.from(entityMap.entries()).sort((a, b) => b[0].length - a[0].length);
  
  for (const [nameLower, entities] of sortedEntities) {
    // Skip short names
    if (nameLower.length < 4) continue;
    
    // Use indexOf for simple, reliable matching (case-insensitive)
    let searchStart = 0;
    let matchIndex = textLower.indexOf(nameLower, searchStart);
    
    while (matchIndex !== -1) {
      const endIndex = matchIndex + nameLower.length;
      
      // Check character boundaries to ensure exact word match
      const charBefore = matchIndex > 0 ? originalText[matchIndex - 1] : '';
      const charAfter = endIndex < originalText.length ? originalText[endIndex] : '';
      
      // Valid boundary: whitespace, punctuation, or start/end of string
      const beforeOk = isValidBoundary(charBefore) || !/[a-zA-Z0-9]/.test(charBefore);
      const afterOk = isValidBoundary(charAfter) || !/[a-zA-Z0-9]/.test(charAfter);
      
      if (beforeOk && afterOk) {
        // For parent MITRE techniques (e.g., T1566), skip if followed by a dot
        const isParentMitreId = /^t[as]?\d{4}$/i.test(nameLower);
        if (isParentMitreId && charAfter === '.') {
          searchStart = matchIndex + 1;
          matchIndex = textLower.indexOf(nameLower, searchStart);
          continue;
        }
        
        // Check for overlapping ranges
        const rangeKey = `${matchIndex}-${endIndex}`;
        let hasOverlap = false;
        for (const existingRange of seenRanges) {
          const [existStart, existEnd] = existingRange.split('-').map(Number);
          if (!(endIndex <= existStart || matchIndex >= existEnd)) {
            hasOverlap = true;
            break;
          }
        }
        
        if (!hasOverlap) {
          const matchedText = originalText.substring(matchIndex, endIndex);
          
          // Add ALL entities with this name (supports multiple types)
          for (const entity of entities) {
            // Skip AttackPatterns unless explicitly requested
            if (entity.type === 'AttackPattern' && !includeAttackPatterns) continue;
            // Skip already seen entities
            if (seenEntities.has(entity.id)) continue;
            
            log.debug(`SCAN_OAEV: Found "${entity.name}" (${entity.type}) at position ${matchIndex}`);
            
            openaevEntities.push({
              platformType: 'openaev',
              type: entity.type as 'Asset' | 'AssetGroup' | 'Team' | 'Player' | 'AttackPattern',
              name: entity.name,
              value: matchedText,
              startIndex: matchIndex,
              endIndex: endIndex,
              found: true,
              entityId: entity.id,
              platformId: entity.platformId,
              entityData: entity,
            });
            
            seenEntities.add(entity.id);
          }
          
          seenRanges.add(rangeKey);
          break; // Only first text match per name
        }
      }
      
      searchStart = matchIndex + 1;
      matchIndex = textLower.indexOf(nameLower, searchStart);
    }
  }
  
  return openaevEntities;
}

/**
 * Merge scan results from multiple sources
 */
export function mergeScanResults(
  openCTIResult: ScanResultPayload,
  oaevEntities: ScanResultPayload['openaevEntities']
): ScanResultPayload {
  return {
    ...openCTIResult,
    openaevEntities: [
      ...(openCTIResult.openaevEntities || []),
      ...(oaevEntities || []),
    ],
  };
}

/**
 * Handle SCAN_ALL - unified scan across all platforms
 */
export async function handleScanAll(
  payload: { content: string; url: string },
  sendResponse: SendResponseFn,
  deps: ScanHandlerDependencies
): Promise<void> {
  const detectionEngine = deps.getDetectionEngine();
  
  try {
    log.info(`SCAN_ALL: Starting unified scan across all configured platforms...`);
    
    // Get detection settings to determine vulnerability detection scope
    const settings = await getSettings();
    const disabledOpenCTITypes = settings.detection?.disabledOpenCTITypes || [];
    const disabledOpenAEVTypes = settings.detection?.disabledOpenAEVTypes || [];
    
    // Determine vulnerability/CVE detection settings per platform
    const vulnSettings = {
      enabledForOpenCTI: !disabledOpenCTITypes.includes('Vulnerability'),
      enabledForOpenAEV: !disabledOpenAEVTypes.includes('Vulnerability'),
    };
    
    // Initialize results
    let openctiResult: { observables: DetectedObservable[]; openctiEntities: DetectedOCTIEntity[]; cves: DetectedOCTIEntity[] } = {
      observables: [],
      openctiEntities: [],
      cves: [],
    };
    
    // 1. Scan OpenCTI
    if (detectionEngine) {
      try {
        const octiResult = await detectionEngine.scan(payload.content, [], vulnSettings);
        openctiResult = {
          observables: octiResult.observables || [],
          openctiEntities: octiResult.openctiEntities || [],
          cves: octiResult.cves || [],
        };
        log.debug(`SCAN_ALL: OpenCTI found ${openctiResult.observables.length} observables, ${openctiResult.openctiEntities.length} OpenCTI entities`);
      } catch (octiError) {
        log.warn('SCAN_ALL: OpenCTI scan failed:', octiError);
      }
    }
    
    // 2. Scan OpenAEV using existing helper
    let openaevEntities: ScanResultPayload['openaevEntities'] = [];
    try {
      const oaevEntityMap = await getAllCachedOAEVEntityNamesForMatching();
      
      if (oaevEntityMap.size > 0) {
        // Use the existing helper - include all entity types
        openaevEntities = scanForOAEVEntities(payload.content, oaevEntityMap, true);
        log.debug(`SCAN_ALL: OpenAEV found ${openaevEntities?.length || 0} entities`);
      }
    } catch (oaevError) {
      log.warn('SCAN_ALL: OpenAEV scan failed:', oaevError);
    }
    
    // Filter results using detection settings (reuse settings from earlier)
    const disabledObservableTypes = settings.detection?.disabledObservableTypes || [];
    
    // Filter results
    const filteredObservables = openctiResult.observables.filter(obs => 
      !disabledObservableTypes.includes(obs.type)
    );
    const filteredOpenctiEntities = openctiResult.openctiEntities.filter(entity => 
      !disabledOpenCTITypes.includes(entity.type)
    );
    const filteredOpenaevEntities = (openaevEntities || []).filter(entity => 
      !disabledOpenAEVTypes.includes(entity.type)
    );
    
    const scanResult: ScanResultPayload = {
      observables: filteredObservables,
      openctiEntities: filteredOpenctiEntities,
      cves: openctiResult.cves,
      openaevEntities: filteredOpenaevEntities,
      scanTime: 0,
      url: payload.url,
    };
    
    const totalFound = 
      scanResult.observables.filter(o => o.found).length +
      scanResult.openctiEntities.filter(s => s.found).length +
      (scanResult.openaevEntities?.length || 0);
    log.info(`SCAN_ALL: Unified scan complete. Found: ${totalFound} entities`);
    
    sendResponse(successResponse(scanResult));
  } catch (error) {
    log.error('SCAN_ALL error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unified scan failed',
    });
  }
}

/**
 * Registry of scan handlers
 */
export const scanHandlers = {
  SCAN_PAGE: handleScanPage,
  SCAN_OAEV: handleScanOAEV,
  SCAN_ALL: handleScanAll,
};

