/**
 * AI Feature Message Handlers
 * 
 * Handles messages related to AI operations:
 * - Description generation
 * - Entity discovery
 * - Relationship resolution
 * - Scenario and atomic test generation
 * - Email generation
 */

import { type MessageHandler, successResponse, errorResponse } from './types';
import { getSettings } from '../../shared/utils/storage';
import {
  AIClient,
  type ContainerDescriptionRequest,
  type ScenarioGenerationRequest,
  type EntityDiscoveryRequest,
  type RelationshipResolutionRequest,
  type AtomicTestRequest,
} from '../../shared/api/ai-client';
import { loggers } from '../../shared/utils/logger';

const log = loggers.background;

/**
 * Check if AI is available
 */
function isAIAvailable(aiSettings?: { provider?: string; apiKey?: string; model?: string }): boolean {
  return !!(aiSettings?.provider && aiSettings?.apiKey && aiSettings?.model);
}

/**
 * Parse AI JSON response, handling markdown code blocks
 */
function parseAIJsonResponse<T>(content: string): T | null {
  try {
    // First try direct JSON parse
    return JSON.parse(content) as T;
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as T;
      } catch {
        log.warn('Failed to parse JSON from markdown code block');
      }
    }
    
    // Try to find JSON object or array in the content
    const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        return JSON.parse(jsonObjectMatch[0]) as T;
      } catch {
        log.warn('Failed to parse JSON object from content');
      }
    }
    
    return null;
  }
}

/**
 * Check AI status handler
 */
export const handleAICheckStatus: MessageHandler = async (_payload, sendResponse) => {
  const settings = await getSettings();
  const available = isAIAvailable(settings.ai);
  sendResponse({
    success: true,
    data: {
      available,
      provider: settings.ai?.provider,
      enabled: available,
    }
  });
};

/**
 * Test AI connection and fetch models handler
 */
export const handleAITestAndFetchModels: MessageHandler = async (payload, sendResponse) => {
  const { provider, apiKey } = payload as { provider: string; apiKey: string };

  try {
    const aiClient = new AIClient({
      enabled: true,
      provider: provider as 'openai' | 'anthropic' | 'gemini',
      apiKey,
    });

    const result = await aiClient.testConnectionAndFetchModels();

    if (result.success) {
      sendResponse({
        success: true,
        data: {
          models: result.models,
        }
      });
    } else {
      sendResponse({ success: false, error: result.error });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test AI connection',
    });
  }
};

/**
 * Generate description handler
 */
export const handleAIGenerateDescription: MessageHandler = async (payload, sendResponse) => {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }

  try {
    const aiClient = new AIClient(settings.ai!);
    const request = payload as ContainerDescriptionRequest;
    const response = await aiClient.generateContainerDescription(request);
    sendResponse({ success: response.success, data: response.content, error: response.error });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'AI generation failed'
    });
  }
};

/**
 * Generate scenario handler
 */
export const handleAIGenerateScenario: MessageHandler = async (payload, sendResponse) => {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }

  try {
    const aiClient = new AIClient(settings.ai!);
    const request = payload as ScenarioGenerationRequest;
    const response = await aiClient.generateScenario(request);

    if (response.success && response.content) {
      const scenario = parseAIJsonResponse(response.content);
      sendResponse(successResponse(scenario));
    } else {
      sendResponse({ success: false, error: response.error || 'Failed to parse scenario' });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'AI generation failed'
    });
  }
};

/**
 * Generate full scenario handler
 */
export const handleAIGenerateFullScenario: MessageHandler = async (payload, sendResponse) => {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }

  try {
    const aiClient = new AIClient(settings.ai!);
    const request = payload as {
      pageTitle: string;
      pageUrl: string;
      pageContent: string;
      scenarioName: string;
      typeAffinity: string;
      platformAffinity?: string[];
      numberOfInjects: number;
      payloadAffinity?: string;
      tableTopDuration?: number;
      additionalContext?: string;
      detectedAttackPatterns?: Array<{ name: string; id?: string; description?: string }>;
    };

    log.debug('[AI_GENERATE_FULL_SCENARIO] Request:', {
      typeAffinity: request.typeAffinity,
      numberOfInjects: request.numberOfInjects,
      payloadAffinity: request.payloadAffinity,
      tableTopDuration: request.tableTopDuration,
      attackPatterns: request.detectedAttackPatterns?.length || 0,
    });

    // Truncate page content if too large
    const MAX_CONTENT_LENGTH = 6000;
    if (request.pageContent && request.pageContent.length > MAX_CONTENT_LENGTH) {
      log.warn(`[AI_GENERATE_FULL_SCENARIO] Page content too large (${request.pageContent.length} chars), truncating`);
      request.pageContent = request.pageContent.substring(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated due to size]';
    }

    const response = await aiClient.generateFullScenario(request);

    log.debug('[AI_GENERATE_FULL_SCENARIO] AI response success:', response.success);

    if (response.success && response.content) {
      const scenario = parseAIJsonResponse<{
        name?: string;
        description?: string;
        subtitle?: string;
        category?: string;
        injects?: Array<{
          title: string;
          description: string;
          type: string;
          content?: string;
          executor?: string;
          subject?: string;
          body?: string;
          delayMinutes?: number;
        }>;
      }>(response.content);

      if (!scenario) {
        log.error('[AI_GENERATE_FULL_SCENARIO] Failed to parse AI response. Raw (first 1000):', response.content.substring(0, 1000));
        const contentPreview = response.content.substring(0, 200);
        const hasJson = response.content.includes('{') && response.content.includes('}');
        sendResponse({
          success: false,
          error: `AI response parsing failed. ${hasJson ? 'JSON found but malformed.' : 'No JSON structure detected.'} Preview: "${contentPreview}..."`
        });
      } else if (!scenario.injects || !Array.isArray(scenario.injects)) {
        log.error('[AI_GENERATE_FULL_SCENARIO] Parsed scenario missing injects array:', scenario);
        sendResponse({
          success: false,
          error: 'AI generated scenario but injects array is missing. Please try again.'
        });
      } else {
        log.debug('[AI_GENERATE_FULL_SCENARIO] Parsed scenario with', scenario.injects.length, 'injects');
        sendResponse(successResponse(scenario));
      }
    } else {
      log.error('[AI_GENERATE_FULL_SCENARIO] AI generation failed:', response.error);
      sendResponse({ success: false, error: response.error || 'AI failed to generate scenario' });
    }
  } catch (error) {
    log.error('[AI_GENERATE_FULL_SCENARIO] Exception:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'AI generation failed unexpectedly'
    });
  }
};

/**
 * Generate atomic test handler
 */
export const handleAIGenerateAtomicTest: MessageHandler = async (payload, sendResponse) => {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }

  try {
    const aiClient = new AIClient(settings.ai!);
    const request = payload as AtomicTestRequest;

    // Log context size for debugging
    const contextLength = request.context?.length || 0;
    log.debug('[AI_GENERATE_ATOMIC_TEST] Context length:', contextLength);

    // Safeguard: Truncate very large contexts
    const MAX_CONTEXT_LENGTH = 8000;
    if (request.context && request.context.length > MAX_CONTEXT_LENGTH) {
      log.warn(`[AI_GENERATE_ATOMIC_TEST] Context too large (${request.context.length} chars), truncating`);
      request.context = request.context.substring(0, MAX_CONTEXT_LENGTH) + '\n\n[Content truncated due to size]';
    }

    const response = await aiClient.generateAtomicTest(request);

    log.debug('[AI_GENERATE_ATOMIC_TEST] AI response success:', response.success, 'content length:', response.content?.length || 0);

    if (response.success && response.content) {
      const atomicTest = parseAIJsonResponse(response.content);

      if (!atomicTest) {
        log.error('[AI_GENERATE_ATOMIC_TEST] Failed to parse AI response. Raw (first 1000 chars):', response.content.substring(0, 1000));
        const contentPreview = response.content.substring(0, 200);
        const hasJson = response.content.includes('{') && response.content.includes('}');
        sendResponse({
          success: false,
          error: `AI response parsing failed. ${hasJson ? 'JSON found but malformed.' : 'No JSON structure detected.'} Preview: "${contentPreview}..."`
        });
      } else {
        log.debug('[AI_GENERATE_ATOMIC_TEST] Parsed atomic test:', atomicTest);
        sendResponse({ success: true, data: atomicTest });
      }
    } else {
      log.error('[AI_GENERATE_ATOMIC_TEST] AI generation failed:', response.error);
      sendResponse({ success: false, error: response.error || 'AI failed to generate content' });
    }
  } catch (error) {
    log.error('[AI_GENERATE_ATOMIC_TEST] Exception:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'AI generation failed unexpectedly'
    });
  }
};

/**
 * Generate emails handler
 */
export const handleAIGenerateEmails: MessageHandler = async (payload, sendResponse) => {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }

  try {
    const aiClient = new AIClient(settings.ai!);
    const request = payload as {
      pageTitle: string;
      pageUrl: string;
      pageContent: string;
      scenarioName: string;
      attackPatterns: Array<{
        id: string;
        name: string;
        externalId?: string;
        killChainPhases?: string[];
      }>;
    };

    log.debug(' AI_GENERATE_EMAILS request:', {
      attackPatterns: request.attackPatterns?.map(ap => ({ id: ap.id, name: ap.name, externalId: ap.externalId })),
    });

    const response = await aiClient.generateEmails(request);

    log.debug(' AI raw response success:', response.success);
    log.debug(' AI raw response content (first 500 chars):', response.content?.substring(0, 500));

    if (response.success && response.content) {
      const parsed = parseAIJsonResponse<{ emails: Array<{ attackPatternId: string; subject: string; body: string }> }>(response.content);
      log.debug(' Parsed AI response:', parsed);

      if (!parsed || !parsed.emails || !Array.isArray(parsed.emails)) {
        log.error(' AI response parsing failed. Content:', response.content.substring(0, 1000));
        const contentPreview = response.content.substring(0, 200);
        const hasEmails = response.content.includes('"emails"');
        sendResponse({
          success: false,
          error: `AI response parsing failed. ${hasEmails ? 'Found "emails" but array is invalid.' : 'Missing "emails" array.'} Preview: "${contentPreview}..."`
        });
        return;
      }

      sendResponse(successResponse(parsed));
    } else {
      log.error(' AI email generation failed:', response.error);
      sendResponse({ success: false, error: response.error || 'Failed to parse emails' });
    }
  } catch (error) {
    log.error(' AI email generation exception:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'AI generation failed'
    });
  }
};

/**
 * Discover entities handler
 */
export const handleAIDiscoverEntities: MessageHandler = async (payload, sendResponse) => {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }

  try {
    const aiClient = new AIClient(settings.ai!);
    const request = payload as EntityDiscoveryRequest;

    log.debug('AI_DISCOVER_ENTITIES request:', {
      pageTitle: request.pageTitle,
      alreadyDetectedCount: request.alreadyDetected?.length || 0,
      contentLength: request.pageContent?.length || 0,
    });

    const response = await aiClient.discoverEntities(request);

    log.debug('AI discovery response success:', response.success);

    if (response.success && response.content) {
      const parsed = parseAIJsonResponse<{
        entities: Array<{
          type: string;
          name: string;
          value: string;
          reason: string;
          confidence: 'high' | 'medium' | 'low';
          excerpt?: string;
        }>
      }>(response.content);

      log.debug('Parsed AI discovery response:', parsed);

      if (!parsed || !parsed.entities || !Array.isArray(parsed.entities)) {
        log.warn('AI discovery returned invalid structure, returning empty');
        sendResponse(successResponse({ entities: [] }));
        return;
      }

      // Filter out entities that were already detected
      const alreadyDetectedValues = new Set<string>();
      request.alreadyDetected.forEach(e => {
        if (e.value) alreadyDetectedValues.add(e.value.toLowerCase());
        if (e.name) alreadyDetectedValues.add(e.name.toLowerCase());
        if (e.externalId) alreadyDetectedValues.add(e.externalId.toLowerCase());
      });

      const newEntities = parsed.entities.filter(e => {
        const valueLC = (e.value || '').toLowerCase();
        const nameLC = (e.name || '').toLowerCase();
        return !alreadyDetectedValues.has(valueLC) && !alreadyDetectedValues.has(nameLC);
      });

      log.info(`AI discovered ${newEntities.length} new entities (${parsed.entities.length} raw, ${request.alreadyDetected.length} already detected)`);

      sendResponse(successResponse({ entities: newEntities }));
    } else {
      log.error('AI entity discovery failed:', response.error);
      sendResponse({ success: false, error: response.error || 'Failed to discover entities' });
    }
  } catch (error) {
    log.error('AI entity discovery exception:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'AI discovery failed'
    });
  }
};

/**
 * Resolve relationships handler
 */
export const handleAIResolveRelationships: MessageHandler = async (payload, sendResponse) => {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }

  try {
    const aiClient = new AIClient(settings.ai!);
    const request = payload as RelationshipResolutionRequest;

    log.debug('AI_RESOLVE_RELATIONSHIPS request:', {
      pageTitle: request.pageTitle,
      entityCount: request.entities?.length || 0,
      contentLength: request.pageContent?.length || 0,
    });

    const response = await aiClient.resolveRelationships(request);

    log.debug('AI relationship resolution response success:', response.success);

    if (response.success && response.content) {
      const parsed = parseAIJsonResponse<{
        relationships: Array<{
          fromIndex: number;
          toIndex: number;
          relationshipType: string;
          confidence: 'high' | 'medium' | 'low';
          reason: string;
          excerpt?: string;
        }>
      }>(response.content);

      log.debug('Parsed AI relationship response:', parsed);

      if (!parsed || !parsed.relationships || !Array.isArray(parsed.relationships)) {
        log.warn('AI relationship resolution returned invalid structure, returning empty');
        sendResponse(successResponse({ relationships: [] }));
        return;
      }

      // Validate indices are within bounds
      const entityCount = request.entities.length;
      const validRelationships = parsed.relationships.filter(r =>
        r.fromIndex >= 0 && r.fromIndex < entityCount &&
        r.toIndex >= 0 && r.toIndex < entityCount &&
        r.fromIndex !== r.toIndex &&
        r.relationshipType && typeof r.relationshipType === 'string'
      );

      log.info(`AI resolved ${validRelationships.length} relationships (${parsed.relationships.length} raw)`);

      sendResponse(successResponse({ relationships: validRelationships }));
    } else {
      log.error('AI relationship resolution failed:', response.error);
      sendResponse({ success: false, error: response.error || 'Failed to resolve relationships' });
    }
  } catch (error) {
    log.error('AI relationship resolution exception:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'AI relationship resolution failed'
    });
  }
};

/**
 * Export all AI handlers
 */
export const aiHandlers: Record<string, MessageHandler> = {
  AI_CHECK_STATUS: handleAICheckStatus,
  AI_TEST_AND_FETCH_MODELS: handleAITestAndFetchModels,
  AI_GENERATE_DESCRIPTION: handleAIGenerateDescription,
  AI_GENERATE_SCENARIO: handleAIGenerateScenario,
  AI_GENERATE_FULL_SCENARIO: handleAIGenerateFullScenario,
  AI_GENERATE_ATOMIC_TEST: handleAIGenerateAtomicTest,
  AI_GENERATE_EMAILS: handleAIGenerateEmails,
  AI_DISCOVER_ENTITIES: handleAIDiscoverEntities,
  AI_RESOLVE_RELATIONSHIPS: handleAIResolveRelationships,
};

