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

import { type MessageHandler, successResponse, errorResponse } from './types';
import {
  getOpenCTIClients,
  getPrimaryOpenCTIClient,
  hasOpenCTIClients,
} from '../services/client-manager';
import { addEntityToOCTICache, type CachedOCTIEntity } from '../../shared/utils/storage';
import { refangIndicator } from '../../shared/detection/patterns';
import { loggers } from '../../shared/utils/logger';
import { ENTITY_FETCH_TIMEOUT_MS, SEARCH_TIMEOUT_MS, CONTAINER_FETCH_TIMEOUT_MS } from '../../shared/constants';

const log = loggers.background;

// List of OpenCTI types that should be cached
const CACHEABLE_OPENCTI_TYPES = [
  'Threat-Actor-Group', 'Threat-Actor-Individual', 'Intrusion-Set',
  'Campaign', 'Incident', 'Malware', 'Attack-Pattern', 'Sector',
  'Organization', 'Individual', 'Event', 'Country', 'Region',
  'City', 'Administrative-Area', 'Position'
];

/**
 * Helper to determine if entity type is an observable
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
          sendResponse({ success: true, data: { ...entity, _platformId: specificPlatformId } });
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
        sendResponse({ success: true, data: { ...found.entity, _platformId: found.platformId } });
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

    // Search across all OpenCTI platforms in parallel with timeout
    const clientsToSearch = platformId
      ? [[platformId, openCTIClients.get(platformId)] as const].filter(([_, c]) => c)
      : Array.from(openCTIClients.entries());

    const searchPromises = clientsToSearch.map(async ([pId, client]) => {
      if (!client) return { platformId: pId, results: [] };

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), SEARCH_TIMEOUT_MS)
        );
        const results = await Promise.race([client.globalSearch(cleanSearchTerm, types, limit), timeoutPromise]);
        return { platformId: pId, results: results.map((r: unknown) => ({ ...(r as object), _platformId: pId })) };
      } catch (e) {
        log.warn(`Search timeout/error for platform ${pId}:`, e);
        return { platformId: pId, results: [] };
      }
    });

    const searchResults = await Promise.all(searchPromises);
    const allResults = searchResults.flatMap(r => r.results);

    sendResponse(successResponse(allResults));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    });
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
  if (!hasOpenCTIClients()) {
    sendResponse(errorResponse('Not configured'));
    return;
  }

  const { platformId: labelsPlatformId } = (payload || {}) as { platformId?: string };
  const openCTIClients = getOpenCTIClients();

  try {
    if (labelsPlatformId) {
      const client = openCTIClients.get(labelsPlatformId);
      if (!client) {
        sendResponse(errorResponse('Platform not found'));
        return;
      }

      const labels = await client.fetchLabels();
      sendResponse({ success: true, data: labels.map(l => ({ ...l, _platformId: labelsPlatformId })) });
    } else {
      // Fetch from all platforms in parallel
      const fetchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), CONTAINER_FETCH_TIMEOUT_MS)
          );
          const labels = await Promise.race([client.fetchLabels(), timeoutPromise]);
          return { platformId: pId, labels, error: null };
        } catch (e) {
          log.warn(`Failed to fetch labels from platform ${pId}:`, e);
          return { platformId: pId, labels: [], error: e };
        }
      });

      const results = await Promise.all(fetchPromises);

      const allLabels: unknown[] = [];
      const seenIds = new Set<string>();
      for (const result of results) {
        for (const label of result.labels) {
          if (!seenIds.has(label.id)) {
            seenIds.add(label.id);
            allLabels.push({ ...label, _platformId: result.platformId });
          }
        }
      }

      sendResponse({ success: true, data: allLabels });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch labels',
    });
  }
};

/**
 * Fetch markings handler
 */
export const handleFetchMarkings: MessageHandler = async (payload, sendResponse) => {
  if (!hasOpenCTIClients()) {
    sendResponse(errorResponse('Not configured'));
    return;
  }

  const { platformId: markingsPlatformId } = (payload || {}) as { platformId?: string };
  const openCTIClients = getOpenCTIClients();

  try {
    if (markingsPlatformId) {
      const client = openCTIClients.get(markingsPlatformId);
      if (!client) {
        sendResponse(errorResponse('Platform not found'));
        return;
      }

      const markings = await client.fetchMarkingDefinitions();
      sendResponse({ success: true, data: markings.map(m => ({ ...m, _platformId: markingsPlatformId })) });
    } else {
      // Fetch from all platforms in parallel
      const fetchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), CONTAINER_FETCH_TIMEOUT_MS)
          );
          const markings = await Promise.race([client.fetchMarkingDefinitions(), timeoutPromise]);
          return { platformId: pId, markings, error: null };
        } catch (e) {
          log.warn(`Failed to fetch markings from platform ${pId}:`, e);
          return { platformId: pId, markings: [], error: e };
        }
      });

      const results = await Promise.all(fetchPromises);

      const allMarkings: unknown[] = [];
      const seenIds = new Set<string>();
      for (const result of results) {
        for (const marking of result.markings) {
          if (!seenIds.has(marking.id)) {
            seenIds.add(marking.id);
            allMarkings.push({ ...marking, _platformId: result.platformId });
          }
        }
      }

      sendResponse({ success: true, data: allMarkings });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch markings',
    });
  }
};

/**
 * Fetch vocabulary handler
 */
export const handleFetchVocabulary: MessageHandler = async (payload, sendResponse) => {
  if (!hasOpenCTIClients()) {
    sendResponse(errorResponse('Not configured'));
    return;
  }

  const { category, platformId: vocabPlatformId } = payload as { category: string; platformId?: string };
  const openCTIClients = getOpenCTIClients();

  try {
    const targetPlatformId = vocabPlatformId || openCTIClients.keys().next().value as string;
    const client = openCTIClients.get(targetPlatformId);

    if (!client) {
      sendResponse(errorResponse('Platform not found'));
      return;
    }

    const vocabulary = await client.fetchVocabulary(category);
    sendResponse(successResponse(vocabulary));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch vocabulary',
    });
  }
};

/**
 * Fetch identities handler
 */
export const handleFetchIdentities: MessageHandler = async (payload, sendResponse) => {
  if (!hasOpenCTIClients()) {
    sendResponse(errorResponse('Not configured'));
    return;
  }

  const { platformId: identityPlatformId } = (payload || {}) as { platformId?: string };
  const openCTIClients = getOpenCTIClients();

  try {
    const targetPlatformId = identityPlatformId || openCTIClients.keys().next().value as string;
    const client = openCTIClients.get(targetPlatformId);

    if (!client) {
      sendResponse(errorResponse('Platform not found'));
      return;
    }

    const identities = await client.fetchIdentities();
    sendResponse(successResponse(identities));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch identities',
    });
  }
};

/**
 * Fetch entity containers handler
 */
export const handleFetchEntityContainers: MessageHandler = async (payload, sendResponse) => {
  log.debug(' FETCH_ENTITY_CONTAINERS received:', payload);

  if (!hasOpenCTIClients()) {
    log.warn(' FETCH_ENTITY_CONTAINERS: No OpenCTI clients configured');
    sendResponse(errorResponse('Not configured'));
    return;
  }

  const { entityId, limit, platformId: specificPlatformId } = payload as {
    entityId: string;
    limit?: number;
    platformId?: string;
  };

  if (!entityId) {
    log.warn(' FETCH_ENTITY_CONTAINERS: No entityId provided');
    sendResponse(errorResponse('No entityId provided'));
    return;
  }

  const openCTIClients = getOpenCTIClients();

  try {
    const clientsToSearch = specificPlatformId
      ? [[specificPlatformId, openCTIClients.get(specificPlatformId)] as const].filter(([_, c]) => c)
      : Array.from(openCTIClients.entries());

    log.debug(' FETCH_ENTITY_CONTAINERS: Searching', clientsToSearch.length, 'platforms');

    const fetchPromises = clientsToSearch.map(async ([pId, client]) => {
      if (!client) return { platformId: pId, containers: [] };

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), CONTAINER_FETCH_TIMEOUT_MS)
        );
        const containers = await Promise.race([client.fetchContainersForEntity(entityId, limit), timeoutPromise]);
        log.debug(` FETCH_ENTITY_CONTAINERS: Found ${containers.length} containers in ${pId}`);
        return { platformId: pId, containers: containers.map((c: unknown) => ({ ...(c as object), _platformId: pId })) };
      } catch (e) {
        log.debug(`No containers/timeout for ${entityId} in platform ${pId}:`, e);
        return { platformId: pId, containers: [] };
      }
    });

    const results = await Promise.all(fetchPromises);
    const allContainers = results.flatMap(r => r.containers);

    log.debug(' FETCH_ENTITY_CONTAINERS: Total containers found:', allContainers.length);
    sendResponse(successResponse(allContainers));
  } catch (error) {
    log.error(' FETCH_ENTITY_CONTAINERS error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch containers',
    });
  }
};

/**
 * Find containers by URL handler
 */
export const handleFindContainersByUrl: MessageHandler = async (payload, sendResponse) => {
  if (!hasOpenCTIClients()) {
    sendResponse(successResponse([]));
    return;
  }

  const { url } = payload as { url: string };
  const openCTIClients = getOpenCTIClients();

  try {
    const searchPromises = Array.from(openCTIClients.entries()).map(async ([pId, client]) => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), CONTAINER_FETCH_TIMEOUT_MS)
        );
        const containers = await Promise.race([
          client.findContainersByExternalReferenceUrl(url),
          timeoutPromise
        ]);
        return { platformId: pId, containers: containers.map((c: unknown) => ({ ...(c as object), _platformId: pId })) };
      } catch {
        log.debug(`No containers found/timeout for URL in platform ${pId}`);
        return { platformId: pId, containers: [] };
      }
    });

    const results = await Promise.all(searchPromises);
    const allContainers = results.flatMap(r => r.containers);

    sendResponse(successResponse(allContainers));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search containers',
    });
  }
};

/**
 * Create workbench/investigation handler
 */
export const handleCreateWorkbench: MessageHandler = async (payload, sendResponse) => {
  if (!hasOpenCTIClients()) {
    sendResponse(errorResponse('Not configured'));
    return;
  }

  const { name, description, entityIds, platformId } = payload as {
    name: string;
    description?: string;
    entityIds: string[];
    platformId?: string;
  };

  const openCTIClients = getOpenCTIClients();

  try {
    const targetPlatformId = platformId || openCTIClients.keys().next().value as string;
    const client = openCTIClients.get(targetPlatformId);

    if (!client) {
      sendResponse(errorResponse('Platform not found'));
      return;
    }

    const investigation = await client.createInvestigation({
      name,
      description: description || `Investigation created from XTM Browser Extension with ${entityIds.length} entities`,
      investigated_entities_ids: entityIds,
    });

    const url = client.getInvestigationUrl(investigation.id);

    sendResponse({
      success: true,
      data: {
        ...investigation,
        url,
        _platformId: targetPlatformId,
      },
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create workbench',
    });
  }
};

/**
 * Get labels and markings handler
 */
export const handleGetLabelsAndMarkings: MessageHandler = async (_payload, sendResponse) => {
  if (!hasOpenCTIClients()) {
    sendResponse(errorResponse('Not configured'));
    return;
  }

  const openCTIClients = getOpenCTIClients();

  try {
    const allLabels: unknown[] = [];
    const allMarkings: unknown[] = [];
    const seenLabelIds = new Set<string>();
    const seenMarkingIds = new Set<string>();

    for (const [pId, client] of openCTIClients) {
      try {
        const [labels, markings] = await Promise.all([
          client.fetchLabels(),
          client.fetchMarkingDefinitions(),
        ]);
        
        for (const label of labels) {
          if (!seenLabelIds.has(label.id)) {
            seenLabelIds.add(label.id);
            allLabels.push({ ...label, _platformId: pId });
          }
        }
        for (const marking of markings) {
          if (!seenMarkingIds.has(marking.id)) {
            seenMarkingIds.add(marking.id);
            allMarkings.push({ ...marking, _platformId: pId });
          }
        }
      } catch (e) {
        log.warn(`Failed to fetch labels/markings from platform ${pId}:`, e);
      }
    }

    sendResponse({ success: true, data: { labels: allLabels, markings: allMarkings } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch labels/markings',
    });
  }
};

/**
 * Export all OpenCTI handlers
 */
export const openctiHandlers: Record<string, MessageHandler> = {
  // Note: GET_ENTITY_DETAILS and SEARCH_PLATFORM are now unified handlers in background/index.ts
  // These individual handlers are kept for potential direct use
  CREATE_ENTITY: handleCreateEntity,
  CREATE_OBSERVABLES_BULK: handleCreateObservablesBulk,
  FETCH_LABELS: handleFetchLabels,
  FETCH_MARKINGS: handleFetchMarkings,
  FETCH_VOCABULARY: handleFetchVocabulary,
  FETCH_IDENTITIES: handleFetchIdentities,
  FETCH_ENTITY_CONTAINERS: handleFetchEntityContainers,
  FIND_CONTAINERS_BY_URL: handleFindContainersByUrl,
  CREATE_WORKBENCH: handleCreateWorkbench,
  GET_LABELS_AND_MARKINGS: handleGetLabelsAndMarkings,
};

