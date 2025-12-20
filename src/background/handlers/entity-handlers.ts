/**
 * Entity Message Handlers
 * 
 * Handles entity-related operations across platforms.
 */

import { successResponse, errorResponse, type SendResponseFn } from '../../shared/types/common';
import { ENTITY_FETCH_TIMEOUT_MS } from '../../shared/constants';
import type { OpenCTIClient } from '../../shared/api/opencti-client';
import type { OpenAEVClient } from '../../shared/api/openaev-client';
import type { PlatformType } from '../../shared/platform/registry';

/**
 * Dependency container for entity handlers
 */
export interface EntityHandlerDependencies {
  getOpenCTIClients: () => Map<string, OpenCTIClient>;
  getOpenAEVClients: () => Map<string, OpenAEVClient>;
}

/**
 * Payload for GET_ENTITY_DETAILS
 */
export interface GetEntityDetailsPayload {
  id: string;
  entityType: string;
  platformId?: string;
  platformType?: PlatformType;
}


/**
 * Handle GET_ENTITY_DETAILS - unified entity details for all platforms
 */
export async function handleGetEntityDetails(
  payload: GetEntityDetailsPayload,
  sendResponse: SendResponseFn,
  deps: EntityHandlerDependencies
): Promise<void> {
  const { id, entityType, platformId: specificPlatformId, platformType } = payload;
  const targetPlatformType = platformType || 'opencti';
  const openCTIClients = deps.getOpenCTIClients();
  const openAEVClients = deps.getOpenAEVClients();

  try {
    switch (targetPlatformType) {
      case 'opencti': {
        if (openCTIClients.size === 0) {
          sendResponse(errorResponse('OpenCTI not configured'));
          break;
        }

        // If a specific platform is requested, use that
        // Otherwise, search all platforms in PARALLEL with timeout
        if (specificPlatformId) {
          const client = openCTIClients.get(specificPlatformId);
          if (!client) {
            sendResponse(errorResponse('Platform not found'));
            break;
          }

          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), ENTITY_FETCH_TIMEOUT_MS)
          );

          try {
            let entityPromise;
            if (isObservableType(entityType)) {
              entityPromise = client.getObservableById(id);
            } else {
              entityPromise = client.getSDOById(id);
            }

            const entity = await Promise.race([entityPromise, timeoutPromise]);
            if (entity) {
              sendResponse(successResponse({ ...entity, platformId: specificPlatformId, platformType: 'opencti' }));
            } else {
              sendResponse(errorResponse('Entity not found'));
            }
          } catch {
            sendResponse(errorResponse('Entity not found or timeout'));
          }
        } else {
          // Search all OpenCTI platforms in PARALLEL
          const fetchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
            const timeoutPromise = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), ENTITY_FETCH_TIMEOUT_MS)
            );

            try {
              let entityPromise;
              if (isObservableType(entityType)) {
                entityPromise = client.getObservableById(id);
              } else {
                entityPromise = client.getSDOById(id);
              }

              const entity = await Promise.race([entityPromise, timeoutPromise]);
              return { platformId: pId, entity };
            } catch {
              return { platformId: pId, entity: null };
            }
          });

          const results = await Promise.all(fetchPromises);
          const found = results.find(r => r.entity !== null);

          if (found && found.entity) {
            sendResponse(successResponse({ ...found.entity, platformId: found.platformId, platformType: 'opencti' }));
          } else {
            sendResponse(errorResponse('Entity not found in any OpenCTI platform'));
          }
        }
        break;
      }

      case 'openaev': {
        if (!specificPlatformId) {
          sendResponse(errorResponse('platformId is required for OpenAEV'));
          break;
        }

        const oaevClient = openAEVClients.get(specificPlatformId);
        if (!oaevClient) {
          sendResponse(errorResponse('OpenAEV platform not found'));
          break;
        }

        const oaevTimeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), ENTITY_FETCH_TIMEOUT_MS)
        );

        // Ensure caches are populated for resolution
        await oaevClient.ensureTagsCached();

        // For AttackPattern entities, also cache kill chain phases and attack patterns
        const normalizedEntityType = entityType.replace(/^oaev-/, '');
        if (normalizedEntityType === 'AttackPattern') {
          await Promise.all([
            oaevClient.ensureKillChainPhasesCached(),
            oaevClient.ensureAttackPatternsCached(),
          ]);
        }

        const oaevEntity = await Promise.race([
          oaevClient.getEntityById(id, entityType),
          oaevTimeoutPromise
        ]) as Record<string, unknown> | null;

        if (oaevEntity) {
          // Resolve tags if present (convert IDs to labels)
          resolveOAEVEntityTags(oaevEntity, oaevClient);

          // For AttackPattern: resolve kill chain phase IDs and parent technique ID
          if (normalizedEntityType === 'AttackPattern') {
            resolveOAEVAttackPatternDetails(oaevEntity, oaevClient);
          }

          sendResponse(successResponse({
            ...oaevEntity,
            platformId: specificPlatformId,
            platformType: 'openaev',
            _entityType: entityType,
          }));
        } else {
          sendResponse(errorResponse('Entity not found'));
        }
        break;
      }

      default:
        sendResponse(errorResponse(`Unsupported platform type: ${targetPlatformType}`));
    }
  } catch (error) {
    sendResponse(errorResponse(error instanceof Error ? error.message : 'Failed to get entity'));
  }
}


// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if entity type is an observable type
 */
function isObservableType(entityType: string): boolean {
  return (
    entityType.includes('Addr') ||
    entityType.includes('Domain') ||
    entityType.includes('Url') ||
    entityType.includes('File') ||
    entityType.includes('Email') ||
    entityType.includes('Mac') ||
    entityType.includes('Observable')
  );
}

/**
 * Resolve tag IDs to labels for OpenAEV entities
 */
function resolveOAEVEntityTags(entity: Record<string, unknown>, client: OpenAEVClient): void {
  const tagFields = [
    'asset_tags',
    'endpoint_tags',
    'team_tags',
    'asset_group_tags',
    'scenario_tags',
    'exercise_tags',
  ];

  for (const field of tagFields) {
    const tags = entity[field];
    if (tags && Array.isArray(tags)) {
      entity[`${field}_resolved`] = client.resolveTagIds(tags as string[]);
    }
  }
}

/**
 * Resolve attack pattern-specific details for OpenAEV entities
 */
function resolveOAEVAttackPatternDetails(entity: Record<string, unknown>, client: OpenAEVClient): void {
  if (entity.attack_pattern_kill_chain_phases && Array.isArray(entity.attack_pattern_kill_chain_phases)) {
    entity.attack_pattern_kill_chain_phases_resolved = client.resolveKillChainPhaseIds(
      entity.attack_pattern_kill_chain_phases as string[]
    );
  }
  if (entity.attack_pattern_parent) {
    entity.attack_pattern_parent_resolved = client.resolveAttackPatternId(
      entity.attack_pattern_parent as string
    );
  }
}

