/**
 * AI Message Handlers
 *
 * Handles AI-related messages from the extension.
 * Uses the AIClient for generation and parseAIJsonResponse for parsing.
 */

import { getSettings } from '../../shared/utils/storage';
import { successResponse, errorResponse } from '../../shared/utils/messaging';
import { loggers } from '../../shared/utils/logger';
import {
  AIClient,
  isAIAvailable,
  type ContainerDescriptionRequest,
  type ScenarioGenerationRequest,
  type AtomicTestRequest,
  type EntityDiscoveryRequest,
  type RelationshipResolutionRequest,
} from '../../shared/api/ai-client';
import { parseAIJsonResponse } from '../../shared/api/ai/json-parser';
import type { SendResponseFn, MessageHandler } from './types';

const log = loggers.background;

type SendResponse = SendResponseFn;

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
      // Include name, value, aliases, and external IDs for comprehensive matching
      const alreadyDetectedValues = new Set<string>();
      const alreadyDetectedList = payload.alreadyDetected || [];
      alreadyDetectedList.forEach(e => {
        // Add value and name (lowercase)
        if (e.value) alreadyDetectedValues.add(e.value.toLowerCase());
        if (e.name) alreadyDetectedValues.add(e.name.toLowerCase());
        // Add external ID if present (e.g., T1059.001 for attack patterns)
        if (e.externalId) alreadyDetectedValues.add(e.externalId.toLowerCase());
        // Add all aliases (alternative names for the same entity)
        if (e.aliases && Array.isArray(e.aliases)) {
          e.aliases.forEach((alias: string) => {
            if (alias) alreadyDetectedValues.add(alias.toLowerCase());
          });
        }
      });
      
      const newEntities = parsed.entities.filter(e => {
        const valueLC = (e.value || '').toLowerCase();
        const nameLC = (e.name || '').toLowerCase();
        // Entity is new if neither value nor name matches any already detected value/name/alias/externalId
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
      
      // Validate indices are within bounds and enrich with entity values
      const entityCount = payload.entities.length;
      const validRelationships = parsed.relationships
        .filter(r => 
          r.fromIndex >= 0 && r.fromIndex < entityCount &&
          r.toIndex >= 0 && r.toIndex < entityCount &&
          r.fromIndex !== r.toIndex &&
          r.relationshipType && typeof r.relationshipType === 'string'
        )
        .map(r => {
          const fromEntity = payload.entities[r.fromIndex];
          const toEntity = payload.entities[r.toIndex];
          return {
            ...r,
            fromEntityValue: fromEntity?.value || fromEntity?.name || '',
            toEntityValue: toEntity?.value || toEntity?.name || '',
          };
        })
        // Filter out relationships where we couldn't resolve entity values
        .filter(r => r.fromEntityValue && r.toEntityValue);
      
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

/**
 * AI_SCAN_ALL handler - discovers both entities and relationships in one call
 */
export async function handleAIScanAll(
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
    
    log.debug('AI_SCAN_ALL request:', {
      pageTitle: payload.pageTitle,
      alreadyDetectedCount: payload.alreadyDetected?.length || 0,
      contentLength: payload.pageContent?.length || 0,
    });
    
    // Build a combined prompt for both entity discovery and relationship resolution
    const alreadyDetectedList = payload.alreadyDetected || [];
    const entitiesContext = alreadyDetectedList.length > 0
      ? `\n\nALREADY DETECTED ENTITIES (indices 0 to ${alreadyDetectedList.length - 1}):\n${alreadyDetectedList.map((e, idx) => `[${idx}] ${e.type}: ${e.value || e.name}`).join('\n')}`
      : '\n\nNo entities detected yet - you need to discover ALL entities from scratch.';
    
    // Build example that matches the current indexing context
    const exampleStartIdx = alreadyDetectedList.length;
    const relationshipExample = alreadyDetectedList.length > 0
      ? `{
      "fromIndex": ${exampleStartIdx + 1},
      "toIndex": ${exampleStartIdx},
      "relationshipType": "targets",
      "confidence": "high",
      "reason": "The article states APT29 has been targeting financial sector"
    }`
      : `{
      "fromIndex": 1,
      "toIndex": 0,
      "relationshipType": "targets",
      "confidence": "high",
      "reason": "The article states APT29 has been targeting financial sector"
    }`;

    const indexingExplanation = alreadyDetectedList.length > 0
      ? `IMPORTANT - INDEX NUMBERING:
- Already detected entities use indices 0 to ${alreadyDetectedList.length - 1} (as shown above)
- NEW entities you discover use indices starting at ${alreadyDetectedList.length}
- In your response, your FIRST new entity = index ${alreadyDetectedList.length}, SECOND = index ${alreadyDetectedList.length + 1}, etc.
- Relationships can reference BOTH already detected entities AND new entities using their respective indices`
      : `For relationships, use the indices of the entities you discover (first entity = index 0, second = index 1, etc).`;

    const combinedPrompt = `Analyze this content thoroughly for cyber threat intelligence.

PAGE TITLE: ${payload.pageTitle}
PAGE URL: ${payload.pageUrl}
${entitiesContext}

=== YOUR TASK ===

1. DISCOVER all relevant entities from the content (excluding any already listed above)
2. IDENTIFY relationships between ALL entities (both already detected and newly discovered)

=== ENTITY TYPES TO EXTRACT ===

THREAT ENTITIES:
- Intrusion-Set: APT groups and tracked threat activity clusters (e.g., APT29, APT28, Lazarus Group, FIN7, Cozy Bear, Fancy Bear, Midnight Blizzard). Use this for any group tracked with an APT number or codename.
- Threat-Actor-Group: ONLY for real-world organizations/groups that exist (e.g., Russian GRU, Chinese MSS, North Korean RGB, Anonymous). These are the actual entities behind intrusion sets.
- Threat-Actor-Individual: ONLY for real-world individuals with known identities
- Campaign: Named attack campaigns (e.g., SolarWinds, Operation Aurora)
- Malware: Named malware families (e.g., Emotet, TrickBot, Cobalt Strike, SUNBURST)
- Tool: Hacking/security tools (e.g., Mimikatz, Metasploit)
- Attack-Pattern: MITRE ATT&CK techniques (e.g., T1055, T1566)
- Vulnerability: CVE identifiers (e.g., CVE-2024-1234)
- Narrative: Named disinformation/misinformation narratives
- Channel: Communication channels used for malicious purposes (e.g., Telegram groups, Discord servers, forums)

CONTEXT ENTITIES (IMPORTANT - don't skip these):
- Sector: Industries mentioned (e.g., Financial Services, Healthcare, Energy, Government, Defense, Manufacturing)
- Organization: Companies, agencies (e.g., Microsoft, CISA, specific victim organizations)
- System: IT systems, platforms, security platforms when targeted or relevant
- Country: Countries (e.g., Russia, China, United States, Iran, North Korea)
- Region: Geographic regions (e.g., Eastern Europe, Middle East, Asia-Pacific)
- City: Cities mentioned
- Software: Software products (e.g., Microsoft Exchange, VMware ESXi)

OBSERVABLES (if present):
- Domain-Name, IPv4-Addr, IPv6-Addr, Url, Email-Addr, File (hashes), Hostname

=== RELATIONSHIP TYPES ===
Use STIX types: targets, uses, indicates, attributed-to, related-to, located-at, part-of, exploits, delivers, drops, communicates-with, originates-from

${indexingExplanation}

=== RULES ===
1. Extract ALL named entities from the content - be thorough
2. Do NOT include entities already listed above (check carefully by value)
3. Do NOT include OpenAEV-only types: Team, AssetGroup, Asset, Player
4. For each relationship, explain WHY based on the content
5. Include relationships between already-detected entities too (using their indices 0 to ${alreadyDetectedList.length - 1})

=== PAGE CONTENT ===
${payload.pageContent.substring(0, 15000)}

=== RESPONSE FORMAT ===
Return JSON only:
{
  "entities": [
    {
      "type": "Sector",
      "value": "Financial Services",
      "reason": "Article discusses attacks targeting financial institutions",
      "confidence": "high"
    },
    {
      "type": "Intrusion-Set",
      "value": "APT29",
      "reason": "Main threat activity cluster discussed in the article",
      "confidence": "high"
    }
  ],
  "relationships": [
    ${relationshipExample}
  ]
}

If the content has no CTI entities, return: {"entities": [], "relationships": []}`;

    const response = await aiClient.generate({
      systemPrompt: 'You are a cyber threat intelligence analyst. Extract entities and their relationships from the provided content. Return valid JSON only.',
      prompt: combinedPrompt,
    });
    
    log.debug('AI scan all response success:', response.success);
    
    if (response.success && response.content) {
      const parsed = parseAIJsonResponse<{
        entities: Array<{
          type: string;
          value: string;
          reason?: string;
          confidence?: 'high' | 'medium' | 'low';
        }>;
        relationships: Array<{
          fromIndex: number;
          toIndex: number;
          relationshipType: string;
          confidence: 'high' | 'medium' | 'low';
          reason: string;
        }>;
      }>(response.content);
      
      log.debug('Parsed AI scan all response:', parsed);
      
      const entities = parsed?.entities || [];
      const relationships = parsed?.relationships || [];
      
      // Build combined entity list for index lookup:
      // Indices [0, alreadyDetectedList.length) = already detected entities
      // Indices [alreadyDetectedList.length, ...] = new entities from AI (before filtering)
      const combinedEntities: Array<{ value: string; type: string }> = [
        ...alreadyDetectedList.map(e => ({ value: e.value || e.name || '', type: e.type })),
        ...entities.map(e => ({ value: e.value || '', type: e.type })),
      ];
      
      // Filter out entities that were already detected
      const alreadyDetectedValues = new Set<string>();
      alreadyDetectedList.forEach(e => {
        if (e.value) alreadyDetectedValues.add(e.value.toLowerCase());
        if (e.name) alreadyDetectedValues.add(e.name.toLowerCase());
        if (e.externalId) alreadyDetectedValues.add(e.externalId.toLowerCase());
        if (e.aliases && Array.isArray(e.aliases)) {
          e.aliases.forEach((alias: string) => {
            if (alias) alreadyDetectedValues.add(alias.toLowerCase());
          });
        }
      });
      
      const newEntities = entities.filter(e => {
        const valueLC = (e.value || '').toLowerCase();
        return !alreadyDetectedValues.has(valueLC);
      });
      
      // Convert relationship indices to entity values using the combined list
      // This ensures relationships are correct even if entities are filtered out
      const totalCombinedCount = combinedEntities.length;
      const validRelationships = relationships
        .filter(r => 
          r.fromIndex >= 0 && r.fromIndex < totalCombinedCount &&
          r.toIndex >= 0 && r.toIndex < totalCombinedCount &&
          r.fromIndex !== r.toIndex &&
          r.relationshipType && typeof r.relationshipType === 'string'
        )
        .map(r => {
          const fromEntity = combinedEntities[r.fromIndex];
          const toEntity = combinedEntities[r.toIndex];
          return {
            ...r,
            fromEntityValue: fromEntity?.value || '',
            toEntityValue: toEntity?.value || '',
          };
        })
        // Filter out relationships where we couldn't resolve entity values
        .filter(r => r.fromEntityValue && r.toEntityValue);
      
      log.info(`AI scan all: ${newEntities.length} new entities, ${validRelationships.length} relationships`);
      
      sendResponse(successResponse({ 
        entities: newEntities,
        relationships: validRelationships,
      }));
    } else {
      log.error('AI scan all failed:', response.error);
      sendResponse({ success: false, error: response.error || 'Failed to scan' });
    }
  } catch (error) {
    log.error('AI scan all exception:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'AI scan failed' 
    });
  }
}

// ============================================================================
// Handler Registry Export (for message dispatcher pattern)
// ============================================================================

/**
 * AI handlers registry for the message dispatcher pattern.
 * Wraps the typed handlers to match the generic MessageHandler signature.
 */
export const aiHandlers: Record<string, MessageHandler> = {
  AI_CHECK_STATUS: async (_payload, sendResponse) => {
    await handleAICheckStatus(sendResponse);
  },
  AI_TEST_AND_FETCH_MODELS: async (payload, sendResponse) => {
    await handleAITestAndFetchModels(payload as { provider: string; apiKey: string }, sendResponse);
  },
  AI_GENERATE_DESCRIPTION: async (payload, sendResponse) => {
    await handleAIGenerateDescription(payload as ContainerDescriptionRequest, sendResponse);
  },
  AI_GENERATE_SCENARIO: async (payload, sendResponse) => {
    await handleAIGenerateScenario(payload as ScenarioGenerationRequest, sendResponse);
  },
  AI_GENERATE_FULL_SCENARIO: async (payload, sendResponse) => {
    await handleAIGenerateFullScenario(payload as FullScenarioRequest, sendResponse);
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
