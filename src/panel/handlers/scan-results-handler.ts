/**
 * Scan Results Handler
 * 
 * Handles processing of scan results from the content script.
 */

import {
  prefixEntityType,
} from '../../shared/platform';
import {
  getOAEVEntityId,
} from '../../shared/utils/entity';
import type { ScanResultEntity, ScanResultPlatformMatch } from '../types';

/**
 * Process scan results payload and return normalized entities
 */
export function processScanResults(payload: {
  observables?: any[];
  sdos?: any[];
  cves?: any[];
  platformEntities?: any[];
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
  const addOrMergeEntity = (entity: ScanResultEntity) => {
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
        const isDuplicate = existing.platformMatches.some(pm => 
          pm.platformId === platformMatch.platformId && pm.platformType === platformMatch.platformType
        );
        if (!isDuplicate) {
          existing.platformMatches.push(platformMatch);
        }
        existing.found = true;
      }
    } else {
      // New entry
      entityMap.set(groupKey, {
        ...entity,
        platformMatches: platformMatch ? [platformMatch] : [],
      });
    }
  };
  
  // Add OpenCTI observables
  if (payload.observables) {
    for (const obs of payload.observables) {
      addOrMergeEntity({
        id: obs.entityId || obs.id || `obs-${obs.value}`,
        type: obs.type,
        name: obs.value,
        value: obs.value,
        found: obs.found,
        entityId: obs.entityId,
        platformId: obs.platformId,
        platformType: 'opencti',
        entityData: obs,
      });
    }
  }
  
  // Add OpenCTI SDOs
  if (payload.sdos) {
    for (const sdo of payload.sdos) {
      addOrMergeEntity({
        id: sdo.entityId || sdo.id || `sdo-${sdo.name}`,
        type: sdo.type,
        name: sdo.name,
        value: sdo.name,
        found: sdo.found,
        entityId: sdo.entityId,
        platformId: sdo.platformId,
        platformType: 'opencti',
        entityData: sdo,
      });
    }
  }
  
  // Add CVEs
  if (payload.cves) {
    for (const cve of payload.cves) {
      addOrMergeEntity({
        id: cve.entityId || cve.id || `cve-${cve.name}`,
        type: 'Vulnerability',
        name: cve.name,
        value: cve.name,
        found: cve.found,
        entityId: cve.entityId,
        platformId: cve.platformId,
        platformType: 'opencti',
        entityData: cve,
      });
    }
  }
  
  // Add OpenAEV entities
  if (payload.platformEntities) {
    for (const entity of payload.platformEntities) {
      const platformType = entity.platformType || 'openaev';
      const entityType = entity.type || '';
      const oaevEntityId = entity.entityId || (platformType === 'openaev' 
        ? getOAEVEntityId(entity.entityData || entity, entityType)
        : entity.id) || '';
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
      });
    }
  }
  
  return {
    entities: Array.from(entityMap.values()),
    pageContent: payload.pageContent,
    pageTitle: payload.pageTitle,
    pageUrl: payload.pageUrl,
  };
}

/**
 * Helper function to check if entity is selectable for OpenCTI
 */
export function isEntitySelectable(entity: ScanResultEntity): boolean {
  // OpenAEV-specific types can't be added to OpenCTI containers
  if (entity.type.startsWith('oaev-')) return false;
  return true;
}

/**
 * Helper function to check if entity already exists in OpenCTI
 */
export function isFoundInOpenCTI(entity: ScanResultEntity): boolean {
  const octiCount = entity.platformMatches?.filter(pm => pm.platformType === 'opencti').length || 0;
  return octiCount > 0;
}
