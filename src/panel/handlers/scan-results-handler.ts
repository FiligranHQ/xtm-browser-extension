/**
 * Scan Results Handler
 * 
 * Handles processing of scan results from the content script.
 */

import {
  prefixEntityType,
} from '../../shared/platform/registry';
import {
  getOAEVEntityId,
} from '../../shared/utils/entity';
import type { ScanResultEntity, ScanResultPlatformMatch } from '../types/panel-types';
import type { DetectedObservable } from '../../shared/types/observables';
import type { DetectedOCTIEntity } from '../../shared/types/opencti';
import type { DetectedOAEVEntity } from '../../shared/types/openaev';

/**
 * Process scan results payload and return normalized entities
 */
export function processScanResults(payload: {
  observables?: DetectedObservable[];
  openctiEntities?: DetectedOCTIEntity[];
  cves?: DetectedOCTIEntity[];
  openaevEntities?: DetectedOAEVEntity[];
  aiDiscoveredEntities?: Array<{
    id: string;
    type: string;
    name: string;
    value: string;
    aiReason?: string;
    aiConfidence?: 'high' | 'medium' | 'low';
  }>;
  pageContent?: string;
  pageTitle?: string;
  pageUrl?: string;
}): {
  entities: ScanResultEntity[];
  pageContent?: string;
  pageTitle?: string;
  pageUrl?: string;
} {
  // Map to group entities by their normalized name/value (case-insensitive)
  const entityMap = new Map<string, ScanResultEntity>();
  
  // Helper to normalize key for grouping
  const getGroupKey = (name: string): string => {
    return (name || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  };
  
  // Helper to add entity or merge with existing entry
  const addOrMergeEntity = (entity: ScanResultEntity, matchedString?: string) => {
    const groupKey = getGroupKey(entity.name);
    
    // Only create a platform match if the entity was FOUND on this platform
    const platformMatch: ScanResultPlatformMatch | null = entity.found ? {
      platformId: entity.platformId || '',
      platformType: entity.platformType || 'opencti',
      entityId: entity.entityId,
      entityData: entity.entityData,
      type: entity.type,
    } : null;
    
    const existing = entityMap.get(groupKey);
    if (existing) {
      // Merge: add this platform to existing entry ONLY if found
      if (entity.found && platformMatch) {
        if (!existing.platformMatches) {
          existing.platformMatches = [];
        }
        // Check for exact duplicate: same platform, same type, same entity ID
        // This allows multiple entity types (e.g., Phishing as Malware AND Attack Pattern) on the same platform
        const isDuplicate = existing.platformMatches.some(pm => 
          pm.platformId === platformMatch.platformId && 
          pm.platformType === platformMatch.platformType &&
          pm.type === platformMatch.type &&
          pm.entityId === platformMatch.entityId
        );
        if (!isDuplicate) {
          existing.platformMatches.push(platformMatch);
        }
        existing.found = true;
      }
      // Merge matched strings
      if (matchedString) {
        if (!existing.matchedStrings) {
          existing.matchedStrings = [];
        }
        // Add if not already present (case-insensitive check)
        const matchLower = matchedString.toLowerCase();
        if (!existing.matchedStrings.some(s => s.toLowerCase() === matchLower)) {
          existing.matchedStrings.push(matchedString);
        }
      }
    } else {
      // New entry - use provided platformMatches if available, otherwise create from single platform
      const initialMatches = entity.platformMatches && entity.platformMatches.length > 0
        ? entity.platformMatches
        : (platformMatch ? [platformMatch] : []);
      // Initialize matchedStrings with the provided matchedString if any
      const initialMatchedStrings = matchedString ? [matchedString] : [];
      entityMap.set(groupKey, {
        ...entity,
        platformMatches: initialMatches,
        matchedStrings: initialMatchedStrings.length > 0 ? initialMatchedStrings : undefined,
      });
    }
  };
  
  // Add OpenCTI observables
  if (payload.observables) {
    for (const obs of payload.observables) {
      // For observables, the matched string is the value itself
      addOrMergeEntity({
        id: obs.entityId || `obs-${obs.value}`,
        type: obs.type,
        name: obs.value,
        value: obs.value,
        found: obs.found,
        entityId: obs.entityId,
        platformId: obs.platformId,
        platformType: 'opencti',
        entityData: obs,
      }, obs.value);
    }
  }
  
  // Add OpenCTI entities
  if (payload.openctiEntities) {
    for (const entity of payload.openctiEntities) {
      // Use matchedValue if different from name (e.g., matched via alias)
      const matchedStr = entity.matchedValue || entity.name;
      addOrMergeEntity({
        id: entity.entityId || `entity-${entity.name}`,
        type: entity.type,
        name: entity.name,
        value: entity.name,
        found: entity.found,
        entityId: entity.entityId,
        platformId: entity.platformId,
        platformType: 'opencti',
        entityData: entity,
      }, matchedStr);
    }
  }
  
  // Add CVEs - CVEs can be found in both OpenCTI and OpenAEV platforms
  if (payload.cves) {
    for (const cve of payload.cves) {
      // Convert DetectedOCTIEntity platformMatches to ScanResultPlatformMatch[]
      const platformMatches: ScanResultPlatformMatch[] | undefined = cve.platformMatches?.map(pm => ({
        platformId: pm.platformId || '',
        platformType: (pm.platformType || 'opencti') as 'opencti' | 'openaev',
        entityId: pm.entityId,
        entityData: pm.entityData,
        type: pm.type || 'Vulnerability',
      }));
      
      // Determine platform type from first platformMatch if available
      const firstPlatformType = platformMatches?.[0]?.platformType || 'opencti';
      
      // For CVEs, the matched string is the CVE name itself (e.g., CVE-2024-1234)
      const matchedStr = cve.matchedValue || cve.name;
      
      addOrMergeEntity({
        id: cve.entityId || `cve-${cve.name}`,
        type: 'Vulnerability',
        name: cve.name,
        value: cve.name,
        found: cve.found,
        entityId: cve.entityId,
        platformId: cve.platformId,
        platformType: firstPlatformType,
        entityData: cve,
        // Pass the multi-platform matches if present
        platformMatches,
      }, matchedStr);
    }
  }
  
  // Add OpenAEV entities
  if (payload.openaevEntities) {
    for (const entity of payload.openaevEntities) {
      const platformType = entity.platformType || 'openaev';
      const entityType = entity.type || '';
      const oaevEntityId = entity.entityId || (platformType === 'openaev' && entity.entityData
        ? getOAEVEntityId(entity.entityData, entityType)
        : '') || '';
      // Use matchedValue if available, otherwise the value or name
      const matchedStr = (entity as any).matchedValue || entity.value || entity.name;
      addOrMergeEntity({
        id: oaevEntityId || `${platformType}-${entity.name}`,
        type: prefixEntityType(entityType, platformType as 'opencti' | 'openaev' | 'opengrc'),
        name: entity.name,
        value: entity.value || entity.name,
        found: entity.found ?? true,
        entityId: oaevEntityId,
        platformId: entity.platformId,
        platformType: platformType as 'opencti' | 'openaev',
        entityData: entity,
      }, matchedStr);
    }
  }
  
  // Get entities from map
  const entities = Array.from(entityMap.values());
  
  // Add AI-discovered entities (persisted from previous AI discovery)
  // These are stored separately and don't go through deduplication
  if (payload.aiDiscoveredEntities) {
    for (const aiEntity of payload.aiDiscoveredEntities) {
      entities.push({
        id: aiEntity.id,
        type: aiEntity.type,
        name: aiEntity.name,
        value: aiEntity.value,
        found: false,
        discoveredByAI: true,
        aiReason: aiEntity.aiReason,
        aiConfidence: aiEntity.aiConfidence,
      });
    }
  }
  
  return {
    entities,
    pageContent: payload.pageContent,
    pageTitle: payload.pageTitle,
    pageUrl: payload.pageUrl,
  };
}

