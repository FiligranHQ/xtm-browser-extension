/**
 * Scan Message Handlers
 * 
 * Handles page scanning for entities across platforms.
 */

import { loggers } from '../../shared/utils/logger';
import { DetectionEngine } from '../../shared/detection/detector';
import { getSettings } from '../../shared/utils/storage';
import { successResponse, errorResponse } from '../../shared/utils/messaging';
import type { ScanResultPayload } from '../../shared/types';
import type { SendResponseFn } from './types';

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
    const result = await detectionEngine.scan(payload.content);
    const settings = await getSettings();
    
    const enabledObservableTypes = settings.detection?.observableTypes || [];
    const enabledEntityTypes = settings.detection?.entityTypes || [];
    
    // Filter by enabled types
    const filteredObservables = result.observables.filter(obs => 
      enabledObservableTypes.includes(obs.type)
    );
    const filteredSdos = result.sdos.filter(sdo => 
      enabledEntityTypes.includes(sdo.type)
    );
    
    const scanResult: ScanResultPayload = {
      observables: filteredObservables,
      sdos: filteredSdos,
      cves: result.cves,
      platformEntities: [],
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
    const { getAllCachedOAEVEntityNamesForMatching, getMultiPlatformOAEVCache } = await import('../../shared/utils/storage');
    const oaevEntityMap = await getAllCachedOAEVEntityNamesForMatching();
    
    // Debug: Log cache contents
    const oaevCache = await getMultiPlatformOAEVCache();
    log.debug('SCAN_OAEV: OpenAEV cache platforms:', Object.keys(oaevCache.platforms));
    
    const includeAttackPatterns = payload.includeAttackPatterns === true;
    log.debug(`SCAN_OAEV: Searching for ${oaevEntityMap.size} cached OpenAEV entities (includeAttackPatterns: ${includeAttackPatterns})`);
    
    const platformEntities = scanForOAEVEntities(
      payload.content,
      oaevEntityMap,
      includeAttackPatterns
    );
    
    const scanResult = {
      platformEntities,
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
 */
export function scanForOAEVEntities(
  content: string,
  entityMap: Map<string, { id: string; name: string; type: string; platformId: string }>,
  includeAttackPatterns: boolean
): ScanResultPayload['platformEntities'] {
  const platformEntities: ScanResultPayload['platformEntities'] = [];
  const originalText = content;
  const textLower = originalText.toLowerCase();
  const seenEntities = new Set<string>();
  const seenRanges = new Set<string>();
  
  // Sort by name length (longest first) to match longer names before substrings
  const sortedEntities = Array.from(entityMap.entries()).sort((a, b) => b[0].length - a[0].length);
  
  for (const [nameLower, entity] of sortedEntities) {
    // Skip AttackPatterns unless explicitly requested
    if (entity.type === 'AttackPattern' && !includeAttackPatterns) continue;
    
    // Skip short names and already seen entities
    if (nameLower.length < 4 || seenEntities.has(entity.id)) continue;
    
    // Use indexOf for simple, reliable matching (case-insensitive)
    let searchStart = 0;
    let matchIndex = textLower.indexOf(nameLower, searchStart);
    
    while (matchIndex !== -1) {
      const endIndex = matchIndex + nameLower.length;
      
      // Check character boundaries to ensure exact word match
      const charBefore = matchIndex > 0 ? originalText[matchIndex - 1] : ' ';
      const charAfter = endIndex < originalText.length ? originalText[endIndex] : ' ';
      
      // Valid boundary: whitespace, punctuation, or start/end of string
      const isValidBoundary = (c: string) => 
        /[\s,;:!?()[\]"'<>/\\@#$%^&*+=|`~\n\r\t]/.test(c) || c === '';
      
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
          log.debug(`SCAN_OAEV: Found "${entity.name}" (${entity.type}) at position ${matchIndex}`);
          
          platformEntities.push({
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
          seenRanges.add(rangeKey);
          break; // Only first match per entity
        }
      }
      
      searchStart = matchIndex + 1;
      matchIndex = textLower.indexOf(nameLower, searchStart);
    }
  }
  
  return platformEntities;
}

/**
 * Merge scan results from multiple sources
 */
export function mergeScanResults(
  openCTIResult: ScanResultPayload,
  oaevEntities: ScanResultPayload['platformEntities']
): ScanResultPayload {
  return {
    ...openCTIResult,
    platformEntities: [
      ...(openCTIResult.platformEntities || []),
      ...(oaevEntities || []),
    ],
  };
}

/**
 * Registry of scan handlers
 */
export const scanHandlers = {
  SCAN_PAGE: handleScanPage,
  SCAN_OAEV: handleScanOAEV,
};

