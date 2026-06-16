/**
 * AI Message Handlers
 *
 * Each handler forwards a payload to the matching XTM One agent and either
 * returns the structured response untouched or applies light post-processing
 * (entity deduplication, relationship index → value mapping).
 *
 * No prompt construction lives in the extension — XTM One owns prompts.
 */

import { getSettings } from '../../shared/utils/storage';
import { errorResponse, successResponse, type SendResponseFn } from '../../shared/types/common';
import { loggers } from '../../shared/utils/logger';
import { AIClient, isAIAvailable } from '../../shared/api/ai-client';
import type { AISettings } from '../../shared/types/ai';
import type {
  ContainerDescriptionRequest,
  ScenarioGenerationRequest,
  AtomicTestRequest,
  EntityDiscoveryRequest,
  RelationshipResolutionRequest,
  FullScenarioGenerationRequest,
  EmailGenerationRequest,
} from '../../shared/api/ai/types';
import type { MessageHandler } from './types';
import { executeAITask } from './ai-utils';

const log = loggers.background;

type SendResponse = SendResponseFn;

// ============================================================================
// Entity deduplication helpers
// ============================================================================

interface DetectedEntity {
  value?: string;
  name?: string;
  externalId?: string;
  aliases?: string[];
  type?: string;
}

/**
 * Build a Set of lowercase values from already-detected entities for efficient
 * lookup. Includes value, name, externalId, and all aliases.
 */
function buildAlreadyDetectedSet(alreadyDetectedList: DetectedEntity[]): Set<string> {
  const detectedValues = new Set<string>();
  for (const e of alreadyDetectedList) {
    if (e.value) detectedValues.add(e.value.toLowerCase());
    if (e.name) detectedValues.add(e.name.toLowerCase());
    if (e.externalId) detectedValues.add(e.externalId.toLowerCase());
    if (Array.isArray(e.aliases)) {
      for (const alias of e.aliases) {
        if (alias) detectedValues.add(alias.toLowerCase());
      }
    }
  }
  return detectedValues;
}

/** Filter entities that match any already-detected value or name. */
function filterNewEntities<T extends DetectedEntity>(entities: T[], alreadyDetectedSet: Set<string>): T[] {
  return entities.filter((e) => {
    const valueLC = (e.value || '').toLowerCase();
    const nameLC = (e.name || '').toLowerCase();
    return !alreadyDetectedSet.has(valueLC) && !alreadyDetectedSet.has(nameLC);
  });
}

// ============================================================================
// Connectivity handlers
// ============================================================================

/** AI_CHECK_STATUS — report whether the user has configured XTM One. */
export async function handleAICheckStatus(sendResponse: SendResponse): Promise<void> {
  const settings = await getSettings();
  const available = isAIAvailable(settings.ai);
  sendResponse({
    success: true,
    data: {
      available,
      enabled: available,
      provider: 'xtm-one',
    },
  });
}

/** AI_TEST_CONNECTION — probe the XTM One endpoint with the supplied credentials. */
export async function handleAITestConnection(
  payload: Pick<AISettings, 'xtmOneUrl' | 'apiToken'>,
  sendResponse: SendResponse,
): Promise<void> {
  if (!payload.xtmOneUrl || !payload.apiToken) {
    sendResponse(errorResponse('XTM One URL and API token are required'));
    return;
  }
  try {
    const client = new AIClient(payload);
    const result = await client.testConnection();
    if (result.success) {
      sendResponse(successResponse({
        message: result.data?.message ?? 'Connected to XTM One',
        user_email: result.data?.user_email,
        version: result.data?.version,
        enterprise_edition: result.data?.enterprise_edition,
      }));
    } else {
      sendResponse(errorResponse(result.error || 'Failed to connect to XTM One'));
    }
  } catch (error) {
    sendResponse(errorResponse(error instanceof Error ? error.message : 'Failed to test XTM One connection'));
  }
}

// ============================================================================
// Generation handlers — 1:1 with XTM One agents
// ============================================================================

export async function handleAIGenerateDescription(
  payload: ContainerDescriptionRequest,
  sendResponse: SendResponse,
): Promise<void> {
  await executeAITask(
    'AI_GENERATE_DESCRIPTION',
    payload,
    (client, req) => client.generateContainerDescription(req),
    sendResponse,
    {
      truncateField: 'pageContent',
      // Existing callers consumed `data` directly as the description string;
      // unwrap to preserve that shape.
      transform: (data) => (data && typeof data === 'object' && 'description' in data ? data.description : data),
    },
  );
}

export async function handleAIGenerateScenario(
  payload: ScenarioGenerationRequest,
  sendResponse: SendResponse,
): Promise<void> {
  await executeAITask(
    'AI_GENERATE_SCENARIO',
    payload,
    (client, req) => client.generateScenario(req),
    sendResponse,
    { truncateField: 'pageContent' },
  );
}

export async function handleAIGenerateFullScenario(
  payload: FullScenarioGenerationRequest,
  sendResponse: SendResponse,
): Promise<void> {
  log.debug('[AI_GENERATE_FULL_SCENARIO] Request:', {
    typeAffinity: payload.typeAffinity,
    numberOfInjects: payload.numberOfInjects,
    payloadAffinity: payload.payloadAffinity,
    tableTopDuration: payload.tableTopDuration,
    attackPatterns: payload.detectedAttackPatterns?.length || 0,
  });

  await executeAITask<FullScenarioGenerationRequest, { injects?: unknown[] } & Record<string, unknown>, unknown>(
    'AI_GENERATE_FULL_SCENARIO',
    payload,
    (client, req) => client.generateFullScenario(req) as ReturnType<typeof client.generateFullScenario>,
    sendResponse,
    {
      truncateField: 'pageContent',
      transform: (data) => {
        if (!data || !Array.isArray(data.injects)) {
          // The agent contract guarantees injects[]; surface a clear error if it is missing.
          throw new Error('XTM One scenario response is missing the injects array');
        }
        log.debug('[AI_GENERATE_FULL_SCENARIO] Received scenario with', data.injects.length, 'injects');
        return data;
      },
    },
  );
}

export async function handleAIGenerateAtomicTest(
  payload: AtomicTestRequest,
  sendResponse: SendResponse,
): Promise<void> {
  await executeAITask(
    'AI_GENERATE_ATOMIC_TEST',
    payload,
    (client, req) => client.generateAtomicTest(req),
    sendResponse,
    { truncateField: 'context' },
  );
}

export async function handleAIGenerateEmails(
  payload: EmailGenerationRequest,
  sendResponse: SendResponse,
): Promise<void> {
  log.debug('[AI_GENERATE_EMAILS] Request:', {
    attackPatterns: payload.attackPatterns?.map((ap) => ({ id: ap.id, name: ap.name, externalId: ap.externalId })),
  });

  await executeAITask<EmailGenerationRequest, { emails: Array<Record<string, unknown>> }, unknown>(
    'AI_GENERATE_EMAILS',
    payload,
    (client, req) => client.generateEmails(req),
    sendResponse,
    {
      truncateField: 'pageContent',
      transform: (data) => {
        if (!data || !Array.isArray(data.emails)) {
          throw new Error('XTM One email response is missing the emails array');
        }
        return data;
      },
    },
  );
}

export async function handleAIDiscoverEntities(
  payload: EntityDiscoveryRequest,
  sendResponse: SendResponse,
): Promise<void> {
  log.debug('[AI_DISCOVER_ENTITIES] Request:', {
    pageTitle: payload.pageTitle,
    alreadyDetectedCount: payload.alreadyDetected?.length || 0,
    contentLength: payload.pageContent?.length || 0,
  });

  await executeAITask<EntityDiscoveryRequest, { entities: Array<DetectedEntity & Record<string, unknown>> }, { entities: unknown[] }>(
    'AI_DISCOVER_ENTITIES',
    payload,
    (client, req) => client.discoverEntities(req),
    sendResponse,
    {
      truncateField: 'pageContent',
      transform: (data) => {
        const rawEntities = Array.isArray(data?.entities) ? data.entities : [];
        const alreadyDetectedSet = buildAlreadyDetectedSet(payload.alreadyDetected || []);
        const newEntities = filterNewEntities(rawEntities, alreadyDetectedSet);
        log.info(`AI discovered ${newEntities.length} new entities (${rawEntities.length} raw, ${(payload.alreadyDetected || []).length} already detected)`);
        return { entities: newEntities };
      },
    },
  );
}

export async function handleAIResolveRelationships(
  payload: RelationshipResolutionRequest,
  sendResponse: SendResponse,
): Promise<void> {
  log.debug('[AI_RESOLVE_RELATIONSHIPS] Request:', {
    pageTitle: payload.pageTitle,
    entityCount: payload.entities?.length || 0,
    contentLength: payload.pageContent?.length || 0,
  });

  type RawRelationship = {
    fromIndex: number;
    toIndex: number;
    relationshipType: string;
    confidence?: 'high' | 'medium' | 'low';
    reason?: string;
    excerpt?: string;
  };

  await executeAITask<RelationshipResolutionRequest, { relationships: RawRelationship[] }, { relationships: unknown[] }>(
    'AI_RESOLVE_RELATIONSHIPS',
    payload,
    (client, req) => client.resolveRelationships(req) as ReturnType<typeof client.resolveRelationships> as Promise<import('../../shared/api/ai-client').XtmOneTaskResponse<{ relationships: RawRelationship[] }>>,
    sendResponse,
    {
      truncateField: 'pageContent',
      transform: (data) => {
        const raw = Array.isArray(data?.relationships) ? data.relationships : [];
        const entityCount = payload.entities.length;
        const valid = raw
          .filter((r) =>
            r.fromIndex >= 0 && r.fromIndex < entityCount &&
            r.toIndex >= 0 && r.toIndex < entityCount &&
            r.fromIndex !== r.toIndex &&
            typeof r.relationshipType === 'string' && r.relationshipType.length > 0,
          )
          .map((r) => {
            const fromEntity = payload.entities[r.fromIndex];
            const toEntity = payload.entities[r.toIndex];
            return {
              ...r,
              fromEntityValue: fromEntity?.value || fromEntity?.name || '',
              toEntityValue: toEntity?.value || toEntity?.name || '',
            };
          })
          .filter((r) => r.fromEntityValue && r.toEntityValue);
        log.info(`AI resolved ${valid.length} relationships (${raw.length} raw)`);
        return { relationships: valid };
      },
    },
  );
}

/**
 * AI_SCAN_ALL — one shot entity discovery + relationship resolution.
 *
 * Delegated to a dedicated XTM One agent (`scan-all`). Indices in the agent
 * response cover the combined list [already detected entities..., new entities...].
 */
export async function handleAIScanAll(
  payload: EntityDiscoveryRequest,
  sendResponse: SendResponse,
): Promise<void> {
  log.debug('[AI_SCAN_ALL] Request:', {
    pageTitle: payload.pageTitle,
    alreadyDetectedCount: payload.alreadyDetected?.length || 0,
    contentLength: payload.pageContent?.length || 0,
  });

  type RawEntity = DetectedEntity & Record<string, unknown>;
  type RawRelationship = {
    fromIndex: number;
    toIndex: number;
    relationshipType: string;
    confidence?: 'high' | 'medium' | 'low';
    reason?: string;
  };

  await executeAITask<
    EntityDiscoveryRequest,
    { entities: RawEntity[]; relationships: RawRelationship[] },
    { entities: unknown[]; relationships: unknown[] }
  >(
    'AI_SCAN_ALL',
    payload,
    (client, req) => client.scanAll(req) as ReturnType<typeof client.scanAll> as Promise<import('../../shared/api/ai-client').XtmOneTaskResponse<{ entities: RawEntity[]; relationships: RawRelationship[] }>>,
    sendResponse,
    {
      truncateField: 'pageContent',
      transform: (data) => {
        const alreadyDetectedList = payload.alreadyDetected || [];
        const entities = Array.isArray(data?.entities) ? data.entities : [];
        const relationships = Array.isArray(data?.relationships) ? data.relationships : [];

        // Combined list: [already detected..., new entities...]. Relationships from
        // XTM One reference indices in this combined space.
        const combinedEntities: Array<{ value: string; type: string }> = [
          ...alreadyDetectedList.map((e) => ({ value: e.value || e.name || '', type: e.type || '' })),
          ...entities.map((e) => ({ value: (e.value as string) || (e.name as string) || '', type: (e.type as string) || '' })),
        ];

        const alreadyDetectedSet = buildAlreadyDetectedSet(alreadyDetectedList);
        const newEntities = filterNewEntities(entities, alreadyDetectedSet);

        const totalCombinedCount = combinedEntities.length;
        const validRelationships = relationships
          .filter((r) =>
            r.fromIndex >= 0 && r.fromIndex < totalCombinedCount &&
            r.toIndex >= 0 && r.toIndex < totalCombinedCount &&
            r.fromIndex !== r.toIndex &&
            typeof r.relationshipType === 'string' && r.relationshipType.length > 0,
          )
          .map((r) => {
            const fromEntity = combinedEntities[r.fromIndex];
            const toEntity = combinedEntities[r.toIndex];
            return {
              ...r,
              fromEntityValue: fromEntity?.value || '',
              toEntityValue: toEntity?.value || '',
            };
          })
          .filter((r) => r.fromEntityValue && r.toEntityValue);

        log.info(`AI scan all: ${newEntities.length} new entities, ${validRelationships.length} relationships`);
        return { entities: newEntities, relationships: validRelationships };
      },
    },
  );
}

// ============================================================================
// Handler Registry Export (for message dispatcher pattern)
// ============================================================================

export const aiHandlers: Record<string, MessageHandler> = {
  AI_CHECK_STATUS: async (_payload, sendResponse) => {
    await handleAICheckStatus(sendResponse);
  },
  AI_TEST_CONNECTION: async (payload, sendResponse) => {
    await handleAITestConnection(payload as Pick<AISettings, 'xtmOneUrl' | 'apiToken'>, sendResponse);
  },
  AI_GENERATE_DESCRIPTION: async (payload, sendResponse) => {
    await handleAIGenerateDescription(payload as ContainerDescriptionRequest, sendResponse);
  },
  AI_GENERATE_SCENARIO: async (payload, sendResponse) => {
    await handleAIGenerateScenario(payload as ScenarioGenerationRequest, sendResponse);
  },
  AI_GENERATE_FULL_SCENARIO: async (payload, sendResponse) => {
    await handleAIGenerateFullScenario(payload as FullScenarioGenerationRequest, sendResponse);
  },
  AI_GENERATE_ATOMIC_TEST: async (payload, sendResponse) => {
    await handleAIGenerateAtomicTest(payload as AtomicTestRequest, sendResponse);
  },
  AI_GENERATE_EMAILS: async (payload, sendResponse) => {
    await handleAIGenerateEmails(payload as EmailGenerationRequest, sendResponse);
  },
  AI_DISCOVER_ENTITIES: async (payload, sendResponse) => {
    await handleAIDiscoverEntities(payload as EntityDiscoveryRequest, sendResponse);
  },
  AI_RESOLVE_RELATIONSHIPS: async (payload, sendResponse) => {
    await handleAIResolveRelationships(payload as RelationshipResolutionRequest, sendResponse);
  },
  AI_SCAN_ALL: async (payload, sendResponse) => {
    await handleAIScanAll(payload as EntityDiscoveryRequest, sendResponse);
  },
};
