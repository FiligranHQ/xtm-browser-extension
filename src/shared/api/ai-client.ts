/**
 * AI Client - Unified interface for AI providers (OpenAI, Anthropic, Gemini)
 * 
 * Provides AI-powered features for:
 * - Container description generation
 * - Scenario generation
 * - On-the-fly atomic testing
 */

import type { AIProvider, AISettings } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface AIGenerationRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIGenerationResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export interface ContainerDescriptionRequest {
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
  containerType: string;
  containerName: string;
  detectedEntities?: string[];
  detectedObservables?: string[];
}

export interface ScenarioGenerationRequest {
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
  scenarioName: string;
  typeAffinity?: string;
  platformAffinity?: string[];
  detectedAttackPatterns?: Array<{ name: string; id?: string; description?: string }>;
  detectedDomains?: string[];
  detectedHostnames?: string[];
  detectedEmails?: string[];
}

export interface GeneratedScenario {
  name: string;
  description: string;
  subtitle?: string;
  category?: string;
  injects: GeneratedInject[];
}

export interface GeneratedInject {
  title: string;
  description: string;
  type: string; // e.g., 'email', 'manual', 'command'
  content?: string; // Command content for executable injects
  dependsOn?: number; // Index of dependent inject
  delayMinutes?: number;
}

export interface AtomicTestRequest {
  attackPattern: {
    name: string;
    id?: string;
    description?: string;
    mitrePlatforms?: string[];
  };
  targetPlatform: string; // windows, linux, macos
  context?: string; // Additional context from page
}

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

export interface GeneratedEmail {
  attackPatternId: string;
  subject: string;
  body: string;
}

export interface GeneratedAtomicTest {
  name: string;
  description: string;
  executor: string; // powershell, bash, sh, cmd
  command: string;
  cleanupCommand?: string;
  prerequisites?: string[];
}

export interface EntityDiscoveryRequest {
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
  /** Already detected entities (known or unknown) - to avoid duplicates */
  alreadyDetected: Array<{
    type: string;
    name: string;
    value?: string;
    found: boolean;
    /** External ID for attack patterns (e.g., T1562.001) */
    externalId?: string;
  }>;
}

export interface DiscoveredEntity {
  /** Entity type (e.g., 'IPv4-Addr', 'Domain-Name', 'Malware', 'Threat-Actor-Group') */
  type: string;
  /** Display name or identifier */
  name: string;
  /** The actual value as found in the page (for observables) */
  value: string;
  /** Why this entity is relevant - brief explanation */
  reason: string;
  /** Confidence level: high, medium, low */
  confidence: 'high' | 'medium' | 'low';
  /** The exact text excerpt from the page where this was found */
  excerpt?: string;
}

// ============================================================================
// AI Client Class
// ============================================================================

export class AIClient {
  private provider: AIProvider;
  private apiKey: string;
  private model?: string;
  private baseUrls = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
  };

  // Default models for each provider (fallback if none selected)
  private static readonly DEFAULT_MODELS: Record<AIProvider, string> = {
    openai: 'gpt-5.2',
    anthropic: 'claude-sonnet-4-5',
    gemini: 'gemini-2.5-flash-lite',
    'xtm-one': '',
  };

  constructor(settings: AISettings) {
    if (!settings.provider || !settings.apiKey) {
      throw new Error('AI provider and API key are required');
    }
    if (settings.provider === 'xtm-one') {
      throw new Error('XTM One is not yet available');
    }
    this.provider = settings.provider;
    this.apiKey = settings.apiKey;
    this.model = settings.model;
  }

  /**
   * Get the model to use for generation
   */
  private getModel(): string {
    return this.model || AIClient.DEFAULT_MODELS[this.provider] || '';
  }

  private static readonly MAX_MODELS = 20;

  /**
   * Test connection and fetch available models from the provider
   * Returns raw data from APIs, sorted by creation date, limited to 20 models
   */
  async testConnectionAndFetchModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; description?: string; created?: number }>;
    error?: string;
  }> {
    try {
      switch (this.provider) {
        case 'openai':
          return await this.fetchOpenAIModels();
        case 'anthropic':
          return await this.fetchAnthropicModels();
        case 'gemini':
          return await this.fetchGeminiModels();
        default:
          return { success: false, error: 'Unknown AI provider' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch models',
      };
    }
  }

  /**
   * Fetch available models from OpenAI
   * API: GET /v1/models
   * https://platform.openai.com/docs/api-reference/models/list
   */
  private async fetchOpenAIModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; description?: string; created?: number }>;
    error?: string;
  }> {
    const response = await fetch(`${this.baseUrls.openai}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Get all models, sort by created date (newest first), limit to MAX_MODELS
    const models = (data.data || [])
      .sort((a: { created: number }, b: { created: number }) => (b.created || 0) - (a.created || 0))
      .slice(0, AIClient.MAX_MODELS)
      .map((m: { id: string; created?: number; owned_by?: string }) => ({
        id: m.id,
        name: m.id,
        description: m.owned_by ? `Owned by: ${m.owned_by}` : undefined,
        created: m.created,
      }));

    return { success: true, models };
  }

  /**
   * Fetch available models from Anthropic
   * API: GET /v1/models
   * https://docs.anthropic.com/en/api/models-list
   */
  private async fetchAnthropicModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; description?: string; created?: number }>;
    error?: string;
  }> {
    const response = await fetch(`${this.baseUrls.anthropic}/models`, {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Get all models, sort by created_at date (newest first), limit to MAX_MODELS
    // Anthropic returns { data: [...] } with models having created_at as ISO string
    const models = (data.data || [])
      .sort((a: { created_at?: string }, b: { created_at?: string }) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, AIClient.MAX_MODELS)
      .map((m: { id: string; display_name?: string; created_at?: string }) => ({
        id: m.id,
        name: m.display_name || m.id,
        created: m.created_at ? Math.floor(new Date(m.created_at).getTime() / 1000) : undefined,
      }));

    return { success: true, models };
  }

  /**
   * Fetch available models from Google Gemini
   * API: GET /v1beta/models
   * https://ai.google.dev/api/models#method:-models.list
   */
  private async fetchGeminiModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; description?: string; created?: number }>;
    error?: string;
  }> {
    const response = await fetch(
      `${this.baseUrls.gemini}/models?key=${this.apiKey}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 400) {
        throw new Error('Invalid API key');
      }
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Get all models, limit to MAX_MODELS (Gemini doesn't have created_at, sort by name)
    const models = (data.models || [])
      .slice(0, AIClient.MAX_MODELS)
      .map((m: { name: string; displayName?: string; description?: string }) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name.replace('models/', ''),
        description: m.description?.substring(0, 100),
      }));

    return { success: true, models };
  }

  /**
   * Generate content using the configured AI provider
   */
  async generate(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    try {
      switch (this.provider) {
        case 'openai':
          return await this.generateOpenAI(request);
        case 'anthropic':
          return await this.generateAnthropic(request);
        case 'gemini':
          return await this.generateGemini(request);
        default:
          return { success: false, error: 'Unknown AI provider' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'AI generation failed' 
      };
    }
  }

  /**
   * Generate container description
   */
  async generateContainerDescription(request: ContainerDescriptionRequest): Promise<AIGenerationResponse> {
    const systemPrompt = `You are a cybersecurity analyst assistant. Generate concise, professional descriptions for threat intelligence containers (reports, groupings, notes). Focus on the key findings, threats, and relevance. Keep the description between 2-4 paragraphs.`;

    const prompt = `Generate a description for a ${request.containerType} container in a threat intelligence platform.

Container Name: ${request.containerName}
Source Page: ${request.pageTitle}
URL: ${request.pageUrl}

${request.detectedEntities?.length ? `Detected Threat Entities: ${request.detectedEntities.join(', ')}` : ''}
${request.detectedObservables?.length ? `Detected Indicators: ${request.detectedObservables.join(', ')}` : ''}

Page Content Summary:
${request.pageContent.substring(0, 3000)}

Please generate a professional description that:
1. Summarizes the main topic/threat covered
2. Highlights key entities and indicators found
3. Provides context on the relevance and potential impact
4. Uses appropriate threat intelligence terminology`;

    return this.generate({ prompt, systemPrompt, maxTokens: 1000 });
  }

  /**
   * Generate scenario with injects for OpenAEV
   */
  async generateScenario(request: ScenarioGenerationRequest): Promise<AIGenerationResponse> {
    const systemPrompt = `You are a cybersecurity simulation expert. Generate realistic adversary simulation scenarios with specific injects (actions/steps) for security testing. Each inject should be actionable and time-sequenced. Output in JSON format.`;

    const attackPatternsInfo = request.detectedAttackPatterns?.map(ap => 
      `- ${ap.name}${ap.id ? ` (${ap.id})` : ''}${ap.description ? `: ${ap.description.substring(0, 200)}` : ''}`
    ).join('\n') || 'None detected';

    const prompt = `Generate a security simulation scenario based on the following information:

Scenario Name: ${request.scenarioName}
Type: ${request.typeAffinity || 'attack-scenario'}
Target Platforms: ${request.platformAffinity?.join(', ') || 'Windows, Linux'}

Source Intelligence:
- Page: ${request.pageTitle}
- URL: ${request.pageUrl}

Detected Attack Patterns/TTPs:
${attackPatternsInfo}

${request.detectedDomains?.length ? `Detected Domains: ${request.detectedDomains.join(', ')}` : ''}
${request.detectedHostnames?.length ? `Detected Hostnames: ${request.detectedHostnames.join(', ')}` : ''}
${request.detectedEmails?.length ? `Detected Emails: ${request.detectedEmails.join(', ')}` : ''}

Page Content:
${request.pageContent.substring(0, 2500)}

Generate a JSON response with this structure:
{
  "name": "scenario name",
  "description": "detailed scenario description",
  "subtitle": "short tagline",
  "category": "attack-scenario|incident-response|detection-validation|red-team|purple-team",
  "injects": [
    {
      "title": "inject title",
      "description": "what this step does",
      "type": "email|manual|command",
      "content": "for command type: the actual command to execute",
      "delayMinutes": 0,
      "dependsOn": null or index of previous inject
    }
  ]
}

Create 5-10 realistic injects that simulate the attack chain described, with appropriate timing and dependencies.`;

    return this.generate({ prompt, systemPrompt, maxTokens: 2500, temperature: 0.7 });
  }

  /**
   * Generate on-the-fly atomic test
   */
  async generateAtomicTest(request: AtomicTestRequest): Promise<AIGenerationResponse> {
    const systemPrompt = `You are an expert in adversary simulation and atomic testing (like Atomic Red Team). Generate safe, reversible test commands that simulate specific attack techniques. Always include cleanup commands. Output in JSON format only - no markdown, no explanations, just valid JSON.`;

    // Truncate context to reasonable size to prevent token limits
    const MAX_CONTEXT_LENGTH = 4000;
    const truncatedContext = request.context 
      ? (request.context.length > MAX_CONTEXT_LENGTH 
          ? request.context.substring(0, MAX_CONTEXT_LENGTH) + '...[truncated]' 
          : request.context)
      : '';
    
    const truncatedDescription = request.attackPattern.description
      ? (request.attackPattern.description.length > 1000
          ? request.attackPattern.description.substring(0, 1000) + '...[truncated]'
          : request.attackPattern.description)
      : '';

    const prompt = `Generate an atomic test for the following attack technique:

Attack Pattern: ${request.attackPattern.name}
${request.attackPattern.id ? `MITRE ID: ${request.attackPattern.id}` : ''}
${truncatedDescription ? `Description: ${truncatedDescription}` : ''}
Target Platform: ${request.targetPlatform}
${request.attackPattern.mitrePlatforms?.length ? `Supported Platforms: ${request.attackPattern.mitrePlatforms.join(', ')}` : ''}

${truncatedContext ? `Additional Context:\n${truncatedContext}` : ''}

Generate a JSON response with this structure:
{
  "name": "test name",
  "description": "what this test does and what it validates",
  "executor": "${request.targetPlatform === 'windows' ? 'powershell' : 'bash'}",
  "command": "the command to execute (must be safe for testing)",
  "cleanupCommand": "command to reverse any changes",
  "prerequisites": ["any required tools or conditions"]
}

Important:
- Commands must be SAFE and NON-DESTRUCTIVE
- Must be reversible with cleanup
- Should produce observable artifacts for detection testing
- Use appropriate executor for ${request.targetPlatform}
- Return ONLY valid JSON, no markdown code blocks or additional text`;

    return this.generate({ prompt, systemPrompt, maxTokens: 1000, temperature: 0.5 });
  }

  /**
   * Generate email content for table-top scenarios
   */
  async generateEmails(request: EmailGenerationRequest): Promise<AIGenerationResponse> {
    const systemPrompt = `You are a cybersecurity simulation expert creating realistic phishing awareness and incident simulation emails. Generate professional, contextually appropriate email content that simulates real-world security scenarios for training purposes. Output in JSON format.`;

    const attackPatternsInfo = request.attackPatterns.map(ap => 
      `- ${ap.name}${ap.externalId ? ` (${ap.externalId})` : ''}${ap.killChainPhases?.length ? ` [${ap.killChainPhases.join(', ')}]` : ''}`
    ).join('\n');

    const prompt = `Generate realistic simulation email content for a table-top security exercise based on the following:

Scenario: ${request.scenarioName}
Source Intelligence:
- Page: ${request.pageTitle}
- URL: ${request.pageUrl}

Attack Patterns to simulate:
${attackPatternsInfo}

Context from page:
${request.pageContent.substring(0, 2000)}

For EACH attack pattern listed above, generate an email that:
1. Has a realistic subject line that would be used in a real attack scenario
2. Has a body that describes the simulated threat/action in a professional security briefing format
3. Is appropriate for training/awareness purposes (marked as [SIMULATION])

IMPORTANT: You must generate exactly one email object for each attack pattern provided.
The attackPatternId in your response must be the EXACT "id" value I provided for each attack pattern (the UUID string, NOT the external ID like T1222).

Generate a JSON response with this structure:
{
  "emails": [
    {
      "attackPatternId": "copy the exact id value provided for each attack pattern",
      "subject": "[SIMULATION] Realistic email subject",
      "body": "Professional email body describing the simulated security event..."
    }
  ]
}

Keep email bodies concise (2-4 sentences) but informative.`;

    return this.generate({ prompt, systemPrompt, maxTokens: 2000, temperature: 0.7 });
  }

  /**
   * Discover additional entities from page content using AI
   * This helps find entities that regex patterns might miss
   */
  async discoverEntities(request: EntityDiscoveryRequest): Promise<AIGenerationResponse> {
    const systemPrompt = `You are a cybersecurity threat intelligence analyst expert at extracting indicators of compromise (IOCs) and threat intelligence entities from text. Your task is to identify relevant cybersecurity entities that may have been missed by automated regex-based detection.

IMPORTANT RULES:
1. Only extract entities that are EXPLICITLY mentioned in the text - never hallucinate or infer
2. Return ONLY entities you are confident about - it's better to return nothing than to make up entities
3. The entity value must be an EXACT match to text in the page content
4. Do not return entities that are already in the "already detected" list
5. Focus on cybersecurity-relevant entities for threat intelligence platforms

ENTITY TYPES YOU CAN DETECT:
- IPv4-Addr: IPv4 addresses (e.g., 192.168.1.1)
- IPv6-Addr: IPv6 addresses
- Domain-Name: Domain names (e.g., malicious-domain.com)
- Hostname: Hostnames including subdomains
- Url: Full URLs
- Email-Addr: Email addresses
- StixFile: File hashes (MD5, SHA1, SHA256, SHA512)
- Mac-Addr: MAC addresses
- Cryptocurrency-Wallet: Bitcoin/Ethereum/crypto wallet addresses
- Bank-Account: IBAN numbers
- Phone-Number: Phone numbers
- User-Agent: Browser/HTTP user agent strings
- Malware: Malware names/families
- Threat-Actor-Group: Threat actor group names (APT groups, cybercrime groups)
- Threat-Actor-Individual: Individual threat actor names
- Intrusion-Set: Intrusion set names
- Campaign: Campaign names
- Attack-Pattern: Attack technique names (not MITRE IDs, but technique names)
- Vulnerability: CVE identifiers (CVE-XXXX-XXXXX)
- Tool: Hacking tools, utilities
- Country: Country names relevant to threats
- Sector: Industry sectors being targeted

Output ONLY valid JSON, no additional text.`;

    // Build a summary of already detected entities
    // Include external IDs for attack patterns (e.g., T1562.001) to prevent AI from re-detecting them
    const alreadyDetectedSummary = request.alreadyDetected.length > 0
      ? request.alreadyDetected.map(e => {
          const parts = [`- ${e.type}: ${e.value || e.name}`];
          // Add external ID if available (for attack patterns like T1562.001)
          if (e.externalId && e.externalId !== e.value && e.externalId !== e.name) {
            parts.push(` (also known as: ${e.externalId})`);
          }
          return parts.join('');
        }).join('\n')
      : 'None detected yet';

    const prompt = `Analyze the following page content and extract any cybersecurity entities that are NOT already in the detected list.

PAGE TITLE: ${request.pageTitle}
PAGE URL: ${request.pageUrl}

ALREADY DETECTED ENTITIES (do NOT include these):
${alreadyDetectedSummary}

PAGE CONTENT:
${request.pageContent.substring(0, 6000)}

Extract any additional cybersecurity-relevant entities that were missed. Only include entities you find EXPLICITLY in the text above.

Return JSON in this EXACT format:
{
  "entities": [
    {
      "type": "Entity-Type",
      "name": "Display name",
      "value": "exact value as it appears in text",
      "reason": "Brief explanation of why this is relevant",
      "confidence": "high|medium|low",
      "excerpt": "Short text excerpt where this was found"
    }
  ]
}

If no additional entities are found, return: {"entities": []}

Remember: Only include entities that are EXPLICITLY mentioned in the page content. Do not hallucinate or infer entities.`;

    return this.generate({ prompt, systemPrompt, maxTokens: 2000, temperature: 0.3 });
  }

  // ============================================================================
  // Provider-specific implementations
  // ============================================================================

  private async generateOpenAI(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const modelToUse = this.getModel();
    const response = await fetch(`${this.baseUrls.openai}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt },
        ],
        max_tokens: request.maxTokens || 1500,
        temperature: request.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.choices?.[0]?.message?.content || '',
    };
  }

  private async generateAnthropic(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const modelToUse = this.getModel();
    const response = await fetch(`${this.baseUrls.anthropic}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: modelToUse,
        max_tokens: request.maxTokens || 1500,
        system: request.systemPrompt,
        messages: [
          { role: 'user', content: request.prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.content?.[0]?.text || '',
    };
  }

  private async generateGemini(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const modelToUse = this.getModel();
    const response = await fetch(
      `${this.baseUrls.gemini}/models/${modelToUse}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: request.systemPrompt ? `${request.systemPrompt}\n\n${request.prompt}` : request.prompt },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: request.maxTokens || 1500,
            temperature: request.temperature || 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if AI is configured and available
 */
export function isAIAvailable(settings?: AISettings): boolean {
  return !!(settings?.enabled && settings?.provider && settings?.apiKey);
}

/**
 * Parse JSON from AI response (handles markdown code blocks and various edge cases)
 */
export function parseAIJsonResponse<T>(content: string): T | null {
  if (!content || typeof content !== 'string') {
    return null;
  }
  
  // Trim whitespace
  const trimmed = content.trim();
  
  if (!trimmed) {
    return null;
  }
  
  try {
    // Try direct JSON parse first
    return JSON.parse(trimmed);
  } catch {
    // Try to extract JSON from markdown code block (```json ... ``` or ``` ... ```)
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Continue to other methods
      }
    }
    
    // Try to find JSON object in the response (starts with { and ends with })
    const jsonObjectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        return JSON.parse(jsonObjectMatch[0]);
      } catch {
        // Continue to other methods
      }
    }
    
    // Try to find JSON array in the response (starts with [ and ends with ])
    const jsonArrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      try {
        return JSON.parse(jsonArrayMatch[0]);
      } catch {
        // Fall through to return null
      }
    }
    
    return null;
  }
}
