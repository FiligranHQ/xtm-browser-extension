/**
 * OpenCTI Message Handlers
 * 
 * Handles messages related to OpenCTI operations:
 * - Entity operations (GET_ENTITY_DETAILS, ADD_OBSERVABLE, CREATE_ENTITY)
 * - Container operations (CREATE_CONTAINER, FETCH_ENTITY_CONTAINERS)
 * - Search operations (SEARCH_ENTITIES)
 * - Labels, markings, vocabulary, identities
 * - Investigation/Workbench operations
 */

import { successResponse, errorResponse } from '../../shared/types/common';
import type { MessageHandler } from './types';
import {
  getOpenCTIClients,
  getPrimaryOpenCTIClient,
  hasOpenCTIClients,
} from '../services/client-manager';
import { addEntityToOCTICache, type CachedOCTIEntity } from '../../shared/utils/storage';
import { refangIndicator } from '../../shared/detection/patterns';
import { loggers } from '../../shared/utils/logger';
import { ENTITY_FETCH_TIMEOUT_MS, SEARCH_TIMEOUT_MS, CONTAINER_FETCH_TIMEOUT_MS } from '../../shared/constants';
import {
  checkClientsConfigured,
  getClientOrError,
  getTargetClient,
  getTargetClientOrError,
  fetchFromAllPlatforms,
  searchAcrossPlatforms,
  handleError,
} from './platform-utils';
import { isObservableType } from '../../shared/utils/entity';

const log = loggers.background;

// List of OpenCTI types that should be cached
const CACHEABLE_OPENCTI_TYPES = [
  'Threat-Actor-Group', 'Threat-Actor-Individual', 'Intrusion-Set',
  'Campaign', 'Incident', 'Malware', 'Attack-Pattern', 'Sector',
  'Organization', 'Individual', 'Event', 'Country', 'Region',
  'City', 'Administrative-Area', 'Position', 'Tool', 'Narrative',
  'Channel', 'System'
];

/**
 * Get entity details handler
 */
export const handleGetEntityDetails: MessageHandler = async (payload, sendResponse) => {
  if (!hasOpenCTIClients()) {
    sendResponse(errorResponse('Not configured'));
    return;
  }

  const { id, entityType, platformId: specificPlatformId } = payload as {
    id: string;
    entityType: string;
    platformId?: string;
  };

  try {
    const openCTIClients = getOpenCTIClients();
    
    if (specificPlatformId) {
      // Single platform request with timeout
      const client = openCTIClients.get(specificPlatformId);
      if (!client) {
        sendResponse(errorResponse('Platform not found'));
        return;
      }

      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ENTITY_FETCH_TIMEOUT_MS)
      );

      try {
        const entityPromise = isObservableType(entityType)
          ? client.getObservableById(id)
          : client.getSDOById(id);

        const entity = await Promise.race([entityPromise, timeoutPromise]);
        if (entity) {
          sendResponse({ success: true, data: { ...entity, platformId: specificPlatformId } });
        } else {
          sendResponse(errorResponse('Entity not found'));
        }
      } catch {
        log.debug(`Entity ${id} not found/timeout in platform ${specificPlatformId}`);
        sendResponse(errorResponse('Entity not found or timeout'));
      }
    } else {
      // Search all platforms in parallel
      const fetchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), ENTITY_FETCH_TIMEOUT_MS)
        );

        try {
          const entityPromise = isObservableType(entityType)
            ? client.getObservableById(id)
            : client.getSDOById(id);

          const entity = await Promise.race([entityPromise, timeoutPromise]);
          return { platformId: pId, entity };
        } catch {
          return { platformId: pId, entity: null };
        }
      });

      const results = await Promise.all(fetchPromises);
      const found = results.find(r => r.entity !== null);

      if (found && found.entity) {
        sendResponse({ success: true, data: { ...found.entity, platformId: found.platformId } });
      } else {
        sendResponse(errorResponse('Entity not found in any platform'));
      }
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get entity',
    });
  }
};

/**
 * Search entities handler
 */
export const handleSearchEntities: MessageHandler = async (payload, sendResponse) => {
  if (!hasOpenCTIClients()) {
    sendResponse(errorResponse('Not configured'));
    return;
  }

  const { searchTerm, types, limit, platformId } = payload as {
    searchTerm: string;
    types?: string[];
    limit?: number;
    platformId?: string;
  };

  try {
    const openCTIClients = getOpenCTIClients();
    // Refang search term in case user searches for defanged indicator
    const cleanSearchTerm = refangIndicator(searchTerm);

    // Search across all OpenCTI platforms in parallel with timeout using shared utility
    const allResults = await searchAcrossPlatforms(
      openCTIClients,
      platformId,
      (client) => client.globalSearch(cleanSearchTerm, types, limit),
      SEARCH_TIMEOUT_MS,
      'Global search'
    );

    sendResponse(successResponse(allResults));
  } catch (error) {
    handleError(error, sendResponse, 'Search failed');
  }
};

/**
 * Create entity handler
 */
export const handleCreateEntity: MessageHandler = async (payload, sendResponse) => {
  const entityPayload = payload as {
    type: string;
    value: string;
    name?: string;
    platformId?: string;
  };

  const openCTIClients = getOpenCTIClients();
  const targetPlatformId = entityPayload.platformId || openCTIClients.keys().next().value as string | undefined;
  const targetClient = targetPlatformId ? openCTIClients.get(targetPlatformId) : getPrimaryOpenCTIClient();

  if (!targetClient) {
    sendResponse(errorResponse('No OpenCTI platform configured'));
    return;
  }

  try {
    // Refang the value before creating (OpenCTI stores clean values)
    const cleanValue = refangIndicator(entityPayload.value);
    // Use createEntity which handles both SDOs and SCOs
    const created = await targetClient.createEntity({
      type: entityPayload.type,
      value: cleanValue,
      name: entityPayload.name || cleanValue,
    });
    sendResponse(successResponse(created));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create entity',
    });
  }
};

/**
 * Create observables bulk handler
 */
export const handleCreateObservablesBulk: MessageHandler = async (payload, sendResponse) => {
  if (!hasOpenCTIClients()) {
    sendResponse(errorResponse('Not configured'));
    return;
  }

  const { entities, platformId } = payload as {
    entities: Array<{ type: string; value?: string; name?: string }>;
    platformId?: string;
  };

  const openCTIClients = getOpenCTIClients();
  const targetPlatformId = platformId || (openCTIClients.keys().next().value as string);
  const client = openCTIClients.get(targetPlatformId);
  
  if (!client) {
    sendResponse(errorResponse('Platform not found'));
    return;
  }

  try {
    const results = await Promise.all(
      entities.map(async (e) => {
        const value = e.value ? refangIndicator(e.value) : undefined;
        const name = e.name || e.value;

        const created = await client.createEntity({
          type: e.type,
          value,
          name,
        });

        // Add created entities to cache
        if (created?.id && created?.entity_type && CACHEABLE_OPENCTI_TYPES.includes(created.entity_type)) {
          const cachedEntity: CachedOCTIEntity = {
            id: created.id,
            name: created.name || name || '',
            aliases: created.aliases,
            x_mitre_id: created.x_mitre_id,
            type: created.entity_type,
            platformId: targetPlatformId,
          };

          await addEntityToOCTICache(cachedEntity, targetPlatformId);
          log.debug(`Added ${created.entity_type} "${cachedEntity.name}" to cache`);
        }

        return created;
      })
    );
    sendResponse(successResponse(results));
  } catch (error) {
    log.error('[CREATE_OBSERVABLES_BULK] Error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create entities',
    });
  }
};

/**
 * Fetch labels handler
 */
export const handleFetchLabels: MessageHandler = async (payload, sendResponse) => {
  const openCTIClients = getOpenCTIClients();
  if (!checkClientsConfigured(openCTIClients, sendResponse)) return;

  const { platformId } = (payload || {}) as { platformId?: string };

  try {
    if (platformId) {
      const client = getClientOrError(openCTIClients, platformId, sendResponse);
      if (!client) return;
      
      const labels = await client.fetchLabels();
      sendResponse(successResponse(labels.map(l => ({ ...l, platformId }))));
    } else {
      const { results } = await fetchFromAllPlatforms(
        openCTIClients,
        (client) => client.fetchLabels(),
        CONTAINER_FETCH_TIMEOUT_MS,
        '[Labels]'
      );
      sendResponse(successResponse(results));
    }
  } catch (error) {
    handleError(error, sendResponse, 'Failed to fetch labels');
  }
};

/**
 * Search labels handler (with pagination)
 */
export const handleSearchLabels: MessageHandler = async (payload, sendResponse) => {
  const openCTIClients = getOpenCTIClients();
  if (!checkClientsConfigured(openCTIClients, sendResponse)) return;

  const { search, first, platformId } = (payload || {}) as { 
    search?: string; 
    first?: number;
    platformId?: string;
  };

  try {
    const target = getTargetClientOrError(openCTIClients, platformId, sendResponse);
    if (!target) return;

    const labels = await target.client.searchLabels(search || '', first || 10);
    sendResponse(successResponse(labels.map(l => ({ ...l, platformId: target.platformId }))));
  } catch (error) {
    handleError(error, sendResponse, 'Failed to search labels');
  }
};

/**
 * Create label handler
 */
export const handleCreateLabel: MessageHandler = async (payload, sendResponse) => {
  const openCTIClients = getOpenCTIClients();
  if (!checkClientsConfigured(openCTIClients, sendResponse)) return;

  const { value, color, platformId } = (payload || {}) as { 
    value: string; 
    color: string;
    platformId?: string;
  };
  
  if (!value) {
    sendResponse(errorResponse('Label value is required'));
    return;
  }

  try {
    const target = getTargetClientOrError(openCTIClients, platformId, sendResponse);
    if (!target) return;

    const label = await target.client.createLabel(value, color || '#000000');
    sendResponse(successResponse({ ...label, platformId: target.platformId }));
  } catch (error) {
    handleError(error, sendResponse, 'Failed to create label');
  }
};

/**
 * Fetch markings handler
 */
export const handleFetchMarkings: MessageHandler = async (payload, sendResponse) => {
  const openCTIClients = getOpenCTIClients();
  if (!checkClientsConfigured(openCTIClients, sendResponse)) return;

  const { platformId } = (payload || {}) as { platformId?: string };

  try {
    if (platformId) {
      const client = getClientOrError(openCTIClients, platformId, sendResponse);
      if (!client) return;
      
      const markings = await client.fetchMarkingDefinitions();
      sendResponse(successResponse(markings.map(m => ({ ...m, platformId }))));
    } else {
      const { results } = await fetchFromAllPlatforms(
        openCTIClients,
        (client) => client.fetchMarkingDefinitions(),
        CONTAINER_FETCH_TIMEOUT_MS,
        '[Markings]'
      );
      sendResponse(successResponse(results));
    }
  } catch (error) {
    handleError(error, sendResponse, 'Failed to fetch markings');
  }
};

/**
 * Fetch vocabulary handler
 */
export const handleFetchVocabulary: MessageHandler = async (payload, sendResponse) => {
  const openCTIClients = getOpenCTIClients();
  if (!checkClientsConfigured(openCTIClients, sendResponse)) return;

  const { category, platformId } = payload as { category: string; platformId?: string };

  try {
    const { client } = getTargetClient(openCTIClients, platformId);
    if (!client) {
      sendResponse(errorResponse('Platform not found'));
      return;
    }

    const vocabulary = await client.fetchVocabulary(category);
    sendResponse(successResponse(vocabulary));
  } catch (error) {
    handleError(error, sendResponse, 'Failed to fetch vocabulary');
  }
};

/**
 * Fetch identities handler
 */
export const handleFetchIdentities: MessageHandler = async (payload, sendResponse) => {
  const openCTIClients = getOpenCTIClients();
  if (!checkClientsConfigured(openCTIClients, sendResponse)) return;

  const { platformId } = (payload || {}) as { platformId?: string };

  try {
    const { client } = getTargetClient(openCTIClients, platformId);
    if (!client) {
      sendResponse(errorResponse('Platform not found'));
      return;
    }

    const identities = await client.fetchIdentities();
    sendResponse(successResponse(identities));
  } catch (error) {
    handleError(error, sendResponse, 'Failed to fetch identities');
  }
};

/**
 * Search identities handler (with limit and search)
 */
export const handleSearchIdentities: MessageHandler = async (payload, sendResponse) => {
  const openCTIClients = getOpenCTIClients();
  if (!checkClientsConfigured(openCTIClients, sendResponse)) return;

  const { search, first, platformId } = (payload || {}) as { 
    search?: string; 
    first?: number;
    platformId?: string;
  };

  try {
    const target = getTargetClientOrError(openCTIClients, platformId, sendResponse);
    if (!target) return;

    const identities = await target.client.searchIdentities(search || '', first || 50);
    sendResponse(successResponse(identities.map(i => ({ ...i, platformId: target.platformId }))));
  } catch (error) {
    handleError(error, sendResponse, 'Failed to search identities');
  }
};

/**
 * Create identity handler (Organization or Individual)
 */
export const handleCreateIdentity: MessageHandler = async (payload, sendResponse) => {
  const openCTIClients = getOpenCTIClients();
  if (!checkClientsConfigured(openCTIClients, sendResponse)) return;

  const { name, entityType, platformId } = (payload || {}) as { 
    name: string; 
    entityType: 'Organization' | 'Individual';
    platformId?: string;
  };
  
  if (!name) {
    sendResponse(errorResponse('Identity name is required'));
    return;
  }

  if (!entityType || !['Organization', 'Individual'].includes(entityType)) {
    sendResponse(errorResponse('Invalid entity type. Must be Organization or Individual'));
    return;
  }

  try {
    const target = getTargetClientOrError(openCTIClients, platformId, sendResponse);
    if (!target) return;

    const identity = entityType === 'Organization' 
      ? await target.client.createOrganization(name)
      : await target.client.createIndividual(name);
      
    sendResponse(successResponse({ ...identity, platformId: target.platformId }));
  } catch (error) {
    handleError(error, sendResponse, 'Failed to create identity');
  }
};

/**
 * Fetch entity containers handler
 */
export const handleFetchEntityContainers: MessageHandler = async (payload, sendResponse) => {
  log.debug('FETCH_ENTITY_CONTAINERS received:', payload);

  const openCTIClients = getOpenCTIClients();
  if (!checkClientsConfigured(openCTIClients, sendResponse)) {
    log.warn('FETCH_ENTITY_CONTAINERS: No OpenCTI clients configured');
    return;
  }

  const { entityId, limit, platformId } = payload as {
    entityId: string;
    limit?: number;
    platformId?: string;
  };

  if (!entityId) {
    log.warn('FETCH_ENTITY_CONTAINERS: No entityId provided');
    sendResponse(errorResponse('No entityId provided'));
    return;
  }

  try {
    const results = await searchAcrossPlatforms(
      openCTIClients,
      platformId,
      (client) => client.fetchContainersForEntity(entityId, limit),
      CONTAINER_FETCH_TIMEOUT_MS,
      '[Containers]'
    );
    
    log.debug('FETCH_ENTITY_CONTAINERS: Total containers found:', results.length);
    sendResponse(successResponse(results));
  } catch (error) {
    log.error('FETCH_ENTITY_CONTAINERS error:', error);
    handleError(error, sendResponse, 'Failed to fetch containers');
  }
};

/**
 * Find containers by URL handler
 */
export const handleFindContainersByUrl: MessageHandler = async (payload, sendResponse) => {
  const openCTIClients = getOpenCTIClients();
  if (openCTIClients.size === 0) {
    sendResponse(successResponse([])); // No error, just no containers
    return;
  }

  const { url } = payload as { url: string };

  try {
    const results = await searchAcrossPlatforms(
      openCTIClients,
      undefined,
      (client) => client.findContainersByExternalReferenceUrl(url),
      CONTAINER_FETCH_TIMEOUT_MS,
      '[ContainersByURL]'
    );
    sendResponse(successResponse(results));
  } catch (error) {
    handleError(error, sendResponse, 'Failed to search containers');
  }
};

/**
 * Create workbench/investigation handler
 */
export const handleCreateWorkbench: MessageHandler = async (payload, sendResponse) => {
  const openCTIClients = getOpenCTIClients();
  if (!checkClientsConfigured(openCTIClients, sendResponse)) return;

  const { name, description, entityIds, platformId } = payload as {
    name: string;
    description?: string;
    entityIds: string[];
    platformId?: string;
  };

  try {
    const target = getTargetClientOrError(openCTIClients, platformId, sendResponse);
    if (!target) return;

    const investigation = await target.client.createInvestigation({
      name,
      description: description || `Investigation created from XTM Browser Extension with ${entityIds.length} entities`,
      investigated_entities_ids: entityIds,
    });

    const url = target.client.getInvestigationUrl(investigation.id);
    sendResponse(successResponse({ ...investigation, url, platformId: target.platformId }));
  } catch (error) {
    handleError(error, sendResponse, 'Failed to create workbench');
  }
};

/**
 * Get labels and markings handler
 */
export const handleGetLabelsAndMarkings: MessageHandler = async (_payload, sendResponse) => {
  const openCTIClients = getOpenCTIClients();
  if (!checkClientsConfigured(openCTIClients, sendResponse)) return;

  try {
    const [labelsResult, markingsResult] = await Promise.all([
      fetchFromAllPlatforms(openCTIClients, (c) => c.fetchLabels(), CONTAINER_FETCH_TIMEOUT_MS, '[Labels]'),
      fetchFromAllPlatforms(openCTIClients, (c) => c.fetchMarkingDefinitions(), CONTAINER_FETCH_TIMEOUT_MS, '[Markings]'),
    ]);

    sendResponse(successResponse({ labels: labelsResult.results, markings: markingsResult.results }));
  } catch (error) {
    handleError(error, sendResponse, 'Failed to fetch labels/markings');
  }
};

/**
 * Export all OpenCTI handlers
 */
export const openctiHandlers: Record<string, MessageHandler> = {
  CREATE_ENTITY: handleCreateEntity,
  CREATE_OBSERVABLES_BULK: handleCreateObservablesBulk,
  FETCH_LABELS: handleFetchLabels,
  SEARCH_LABELS: handleSearchLabels,
  CREATE_LABEL: handleCreateLabel,
  FETCH_MARKINGS: handleFetchMarkings,
  FETCH_VOCABULARY: handleFetchVocabulary,
  FETCH_IDENTITIES: handleFetchIdentities,
  SEARCH_IDENTITIES: handleSearchIdentities,
  CREATE_IDENTITY: handleCreateIdentity,
  FETCH_ENTITY_CONTAINERS: handleFetchEntityContainers,
  FIND_CONTAINERS_BY_URL: handleFindContainersByUrl,
  CREATE_WORKBENCH: handleCreateWorkbench,
  GET_LABELS_AND_MARKINGS: handleGetLabelsAndMarkings,
};

