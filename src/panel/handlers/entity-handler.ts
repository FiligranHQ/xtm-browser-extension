/**
 * Entity Handler
 * 
 * Handles processing of entity data for multi-platform display.
 * Extracts pure data transformation logic from App.tsx.
 */

import { parsePrefixedType } from '../../shared/platform/registry';
import type { EntityData, MultiPlatformResult, PlatformInfo } from '../types/panel-types';
import type { ScanResultPlatformMatch } from '../../shared/types/scan';

/**
 * Payload for showing an entity in the panel
 */
export interface ShowEntityPayload {
  entityData?: {
    id?: string;
    entity_type?: string;
    name?: string;
    platformMatches?: ScanResultPlatformMatch[];
    [key: string]: unknown;
  };
  entityId?: string;
  id?: string;
  type?: string;
  entity_type?: string;
  name?: string;
  value?: string;
  platformId?: string;
  platformMatches?: ScanResultPlatformMatch[];
  existsInPlatform?: boolean;
  fromScanResults?: boolean;
  scanResults?: unknown;
}

/**
 * Result of processing entity payload
 */
export interface ProcessedEntityResult {
  entityId: string | undefined;
  entityType: string | undefined;
  platformId: string | undefined;
  multiPlatformResults: MultiPlatformResult[];
  initialEntity: EntityData;
  existsInPlatform: boolean;
  isNonDefaultPlatform: boolean;
  platformType: 'opencti' | 'openaev';
}

/**
 * Build multi-platform results from platform matches
 */
export function buildMultiPlatformResults(
  payload: ShowEntityPayload,
  platformMatches: ScanResultPlatformMatch[] | undefined,
  availablePlatforms: PlatformInfo[],
  entityType: string | undefined
): MultiPlatformResult[] {
  if (!platformMatches || platformMatches.length === 0) {
    return [];
  }

  const results: MultiPlatformResult[] = [];

  for (const match of platformMatches) {
    // Try to find platform by ID first, then fall back to platformType match
    let platform = availablePlatforms.find(p => p.id === match.platformId);
    if (!platform && match.platformType) {
      // Fall back to finding any platform of the same type
      platform = availablePlatforms.find(p => p.type === match.platformType);
    }

    const matchPlatformType = match.platformType || platform?.type || 'opencti';
    // Access entityData properties safely with type assertion
    const entityData = match.entityData as Record<string, unknown> | undefined;
    const matchType = match.type || (entityData?.entity_type as string) || payload?.type || entityType || '';
    const cleanType = matchType.replace(/^oaev-/, '');
    const displayType = matchPlatformType === 'openaev' && !matchType.startsWith('oaev-') 
      ? `oaev-${cleanType}` 
      : matchType;

    // Use the found platform's ID if available
    const resolvedPlatformId = platform?.id || match.platformId;

    results.push({
      platformId: resolvedPlatformId,
      platformName: platform?.name || match.platformId,
      entity: {
        ...payload,
        id: match.entityId,
        entityId: match.entityId,
        type: displayType,
        entity_type: cleanType,
        name: payload?.name || payload?.value || (entityData?.name as string),
        value: payload?.value || payload?.name,
        existsInPlatform: true,
        platformId: resolvedPlatformId,
        platformType: matchPlatformType,
        isNonDefaultPlatform: matchPlatformType !== 'opencti',
        entityData: { 
          ...(match.entityData || payload?.entityData || {}), 
          entity_type: cleanType 
        },
      } as EntityData,
    });
  }

  return results;
}

/**
 * Process entity payload and return normalized data for panel display.
 * Note: Caller should sort multiPlatformResults using sortPlatformResults from useEntityState hook.
 */
export function processEntityPayload(
  payload: ShowEntityPayload,
  availablePlatforms: PlatformInfo[]
): ProcessedEntityResult {
  const entityId = payload?.entityData?.id || payload?.entityId || payload?.id;
  const entityType = payload?.entityData?.entity_type || payload?.type || payload?.entity_type;
  const platformId = payload?.platformId;
  const platformMatches = payload?.platformMatches || payload?.entityData?.platformMatches;

  // Build multi-platform results
  let multiPlatformResults: MultiPlatformResult[] = [];

  if (platformMatches && platformMatches.length > 0) {
    multiPlatformResults = buildMultiPlatformResults(
      payload,
      platformMatches,
      availablePlatforms,
      entityType
    );
    // Note: Sorting should be done by caller using sortPlatformResults from useEntityState
  } else if (platformId) {
    const platform = availablePlatforms.find(p => p.id === platformId);
    multiPlatformResults = [{
      platformId,
      platformName: platform?.name || platformId,
      entity: { ...payload, platformId } as EntityData,
    }];
  }

  // Determine platform type for initial entity
  const parsedType = entityType ? parsePrefixedType(entityType) : null;
  const isNonDefaultPlatform = parsedType !== null;
  const platformType = (parsedType?.platformType || 'opencti') as 'opencti' | 'openaev';

  // Set initial entity
  const initialEntity = multiPlatformResults[0]?.entity || {
    ...payload,
    platformType,
    isNonDefaultPlatform,
  } as EntityData;

  const existsInPlatform = payload?.existsInPlatform || multiPlatformResults.length > 0;

  return {
    entityId,
    entityType,
    platformId,
    multiPlatformResults,
    initialEntity,
    existsInPlatform,
    isNonDefaultPlatform,
    platformType,
  };
}

