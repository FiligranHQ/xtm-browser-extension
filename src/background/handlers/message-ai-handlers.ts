/**
 * AI Message Handlers - Extracted from background/index.ts
 * 
 * These handlers process AI-related messages.
 * They are called directly from the main message handler switch statement.
 */

import { getSettings } from '../../shared/utils/storage';
import { successResponse, errorResponse } from '../../shared/utils/messaging';
import { loggers } from '../../shared/utils/logger';
import {
  AIClient,
  isAIAvailable,
  parseAIJsonResponse,
  type ContainerDescriptionRequest,
  type ScenarioGenerationRequest,
  type AtomicTestRequest,
  type EntityDiscoveryRequest,
  type RelationshipResolutionRequest,
} from '../../shared/api/ai-client';

const log = loggers.background;

type SendResponse = (response: unknown) => void;

/**
 * AI_CHECK_STATUS handler
 */
export async function handleAICheckStatus(
  sendResponse: SendResponse
): Promise<void> {
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
}

/**
 * AI_TEST_AND_FETCH_MODELS handler
 */
export async function handleAITestAndFetchModels(
  payload: { provider: string; apiKey: string },
  sendResponse: SendResponse
): Promise<void> {
  try {
    const aiClient = new AIClient({
      enabled: true,
      provider: payload.provider as 'openai' | 'anthropic' | 'gemini',
      apiKey: payload.apiKey,
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
}

/**
 * AI_GENERATE_DESCRIPTION handler
 */
export async function handleAIGenerateDescription(
  payload: ContainerDescriptionRequest,
  sendResponse: SendResponse
): Promise<void> {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }
  
  try {
    const aiClient = new AIClient(settings.ai!);
    const response = await aiClient.generateContainerDescription(payload);
    sendResponse({ success: response.success, data: response.content, error: response.error });
  } catch (error) {
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'AI generation failed' 
    });
  }
}

/**
 * AI_GENERATE_SCENARIO handler
 */
export async function handleAIGenerateScenario(
  payload: ScenarioGenerationRequest,
  sendResponse: SendResponse
): Promise<void> {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }
  
  try {
    const aiClient = new AIClient(settings.ai!);
    const response = await aiClient.generateScenario(payload);
    
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
}

/**
 * AI_GENERATE_FULL_SCENARIO handler
 */
export interface FullScenarioRequest {
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
}

export async function handleAIGenerateFullScenario(
  payload: FullScenarioRequest,
  sendResponse: SendResponse
): Promise<void> {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }
  
  try {
    const aiClient = new AIClient(settings.ai!);
    const request = { ...payload };
    
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
}

/**
 * AI_GENERATE_ATOMIC_TEST handler
 */
export async function handleAIGenerateAtomicTest(
  payload: AtomicTestRequest,
  sendResponse: SendResponse
): Promise<void> {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }
  
  try {
    const aiClient = new AIClient(settings.ai!);
    const request = { ...payload };
    
    // Log context size for debugging
    const contextLength = request.context?.length || 0;
    log.debug('[AI_GENERATE_ATOMIC_TEST] Context length:', contextLength);
    
    // Safeguard: Truncate very large contexts to prevent AI failures
    const MAX_CONTEXT_LENGTH = 8000;
    if (request.context && request.context.length > MAX_CONTEXT_LENGTH) {
      log.warn(`[AI_GENERATE_ATOMIC_TEST] Context too large (${request.context.length} chars), truncating to ${MAX_CONTEXT_LENGTH}`);
      request.context = request.context.substring(0, MAX_CONTEXT_LENGTH) + '\n\n[Content truncated due to size]';
    }
    
    const response = await aiClient.generateAtomicTest(request);
    
    log.debug('[AI_GENERATE_ATOMIC_TEST] AI response success:', response.success, 'content length:', response.content?.length || 0);
    
    if (response.success && response.content) {
      const atomicTest = parseAIJsonResponse(response.content);
      
      // Safeguard: Check if parsing was successful
      if (!atomicTest) {
        log.error('[AI_GENERATE_ATOMIC_TEST] Failed to parse AI response as JSON. Raw content (first 1000 chars):', response.content.substring(0, 1000));
        // Provide more context about what was received
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
}

/**
 * AI_GENERATE_EMAILS handler
 */
export interface EmailGenerationRequest {
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
}

export async function handleAIGenerateEmails(
  payload: EmailGenerationRequest,
  sendResponse: SendResponse
): Promise<void> {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }
  
  try {
    const aiClient = new AIClient(settings.ai!);
    
    log.debug(' AI_GENERATE_EMAILS request:', {
      attackPatterns: payload.attackPatterns?.map(ap => ({ id: ap.id, name: ap.name, externalId: ap.externalId })),
    });
    
    const response = await aiClient.generateEmails(payload);
    
    log.debug(' AI raw response success:', response.success);
    log.debug(' AI raw response content (first 500 chars):', response.content?.substring(0, 500));
    
    if (response.success && response.content) {
      const parsed = parseAIJsonResponse<{ emails: Array<{ attackPatternId: string; subject: string; body: string }> }>(response.content);
      log.debug(' Parsed AI response:', parsed);
      
      if (!parsed || !parsed.emails || !Array.isArray(parsed.emails)) {
        log.error(' AI response parsing failed or invalid structure. Content:', response.content.substring(0, 1000));
        const contentPreview = response.content.substring(0, 200);
        const hasEmails = response.content.includes('"emails"');
        sendResponse({ 
          success: false, 
          error: `AI response parsing failed. ${hasEmails ? 'Found "emails" but array is invalid.' : 'Missing "emails" array.'} Preview: "${contentPreview}..."` 
        });
        return;
      }
      
      // The parsed response should be { emails: [...] }
      // We send the whole object so response.data.emails works in the panel
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
}

/**
 * AI_DISCOVER_ENTITIES handler
 */
export async function handleAIDiscoverEntities(
  payload: EntityDiscoveryRequest,
  sendResponse: SendResponse
): Promise<void> {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }
  
  try {
    const aiClient = new AIClient(settings.ai!);
    
    log.debug('AI_DISCOVER_ENTITIES request:', {
      pageTitle: payload.pageTitle,
      alreadyDetectedCount: payload.alreadyDetected?.length || 0,
      contentLength: payload.pageContent?.length || 0,
    });
    
    const response = await aiClient.discoverEntities(payload);
    
    log.debug('AI discovery response success:', response.success);
    
    if (response.success && response.content) {
      const parsed = parseAIJsonResponse<{ entities: Array<{
        type: string;
        name: string;
        value: string;
        reason: string;
        confidence: 'high' | 'medium' | 'low';
        excerpt?: string;
      }> }>(response.content);
      
      log.debug('Parsed AI discovery response:', parsed);
      
      if (!parsed || !parsed.entities || !Array.isArray(parsed.entities)) {
        log.warn('AI discovery returned invalid structure, returning empty');
        sendResponse(successResponse({ entities: [] }));
        return;
      }
      
      // Filter out entities that were already detected (double-check)
      // Include both value/name AND external IDs (like T1059.001) for comprehensive matching
      const alreadyDetectedValues = new Set<string>();
      const alreadyDetectedList = payload.alreadyDetected || [];
      alreadyDetectedList.forEach(e => {
        // Add value and name (lowercase)
        if (e.value) alreadyDetectedValues.add(e.value.toLowerCase());
        if (e.name) alreadyDetectedValues.add(e.name.toLowerCase());
        // Also add external ID if present (e.g., T1059.001 for attack patterns)
        if (e.externalId) alreadyDetectedValues.add(e.externalId.toLowerCase());
      });
      
      const newEntities = parsed.entities.filter(e => {
        const valueLC = (e.value || '').toLowerCase();
        const nameLC = (e.name || '').toLowerCase();
        // Entity is new if neither value nor name matches any already detected value
        return !alreadyDetectedValues.has(valueLC) && !alreadyDetectedValues.has(nameLC);
      });
      
      log.info(`AI discovered ${newEntities.length} new entities (${parsed.entities.length} raw, ${alreadyDetectedList.length} already detected)`);
      
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
}

/**
 * AI_RESOLVE_RELATIONSHIPS handler
 */
export async function handleAIResolveRelationships(
  payload: RelationshipResolutionRequest,
  sendResponse: SendResponse
): Promise<void> {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }
  
  try {
    const aiClient = new AIClient(settings.ai!);
    
    log.debug('AI_RESOLVE_RELATIONSHIPS request:', {
      pageTitle: payload.pageTitle,
      entityCount: payload.entities?.length || 0,
      contentLength: payload.pageContent?.length || 0,
    });
    
    const response = await aiClient.resolveRelationships(payload);
    
    log.debug('AI relationship resolution response success:', response.success);
    
    if (response.success && response.content) {
      const parsed = parseAIJsonResponse<{ relationships: Array<{
        fromIndex: number;
        toIndex: number;
        relationshipType: string;
        confidence: 'high' | 'medium' | 'low';
        reason: string;
        excerpt?: string;
      }> }>(response.content);
      
      log.debug('Parsed AI relationship response:', parsed);
      
      if (!parsed || !parsed.relationships || !Array.isArray(parsed.relationships)) {
        log.warn('AI relationship resolution returned invalid structure, returning empty');
        sendResponse(successResponse({ relationships: [] }));
        return;
      }
      
      // Validate indices are within bounds
      const entityCount = payload.entities.length;
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
}
