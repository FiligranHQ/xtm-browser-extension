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
  executor?: string; // Executor for command type (powershell, bash, etc.)
  subject?: string; // Email subject for table-top scenarios
  body?: string; // Email body for table-top scenarios
  dependsOn?: number; // Index of dependent inject
  delayMinutes?: number;
}

export interface FullScenarioGenerationRequest {
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
  scenarioName: string;
  typeAffinity: string; // ENDPOINT, CLOUD, WEB, TABLE-TOP
  platformAffinity?: string[]; // windows, linux, macos
  numberOfInjects: number; // Number of injects to generate
  payloadAffinity?: string; // For technical: powershell, bash, sh, cmd
  tableTopDuration?: number; // For table-top: duration in minutes
  emailLanguage?: string; // For table-top: language for email content
  additionalContext?: string; // Additional context from user
  detectedAttackPatterns?: Array<{ name: string; id?: string; description?: string }>;
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
  language?: string; // Language for email content (e.g., 'english', 'french', 'german')
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
// Relationship Resolution Types
// ============================================================================

export interface RelationshipResolutionRequest {
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
  /** Entities to find relationships between */
  entities: Array<{
    type: string;
    name: string;
    value?: string;
    /** Whether this entity already exists in OpenCTI */
    existsInPlatform: boolean;
    /** OpenCTI entity ID if it exists */
    octiEntityId?: string;
  }>;
}

export interface ResolvedRelationship {
  /** Index of the source entity in the entities array */
  fromIndex: number;
  /** Index of the target entity in the entities array */
  toIndex: number;
  /** STIX relationship type (e.g., 'uses', 'targets', 'indicates', 'related-to') */
  relationshipType: string;
  /** Confidence level: high, medium, low */
  confidence: 'high' | 'medium' | 'low';
  /** Explanation for why this relationship exists */
  reason: string;
  /** Text excerpt from the page supporting this relationship */
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
   * Generate full scenario with injects for OpenAEV (enhanced version)
   * Supports both technical scenarios with payloads and table-top scenarios with emails
   */
  async generateFullScenario(request: FullScenarioGenerationRequest): Promise<AIGenerationResponse> {
    const isTableTop = request.typeAffinity === 'TABLE-TOP';
    
    const systemPrompt = isTableTop
      ? `You are a cybersecurity simulation expert creating table-top exercises. Generate realistic incident simulation scenarios with email notifications that simulate real-world security scenarios for training purposes. Each inject should be an email notification that advances the scenario narrative. Output in JSON format only.`
      : `You are a cybersecurity adversary simulation expert. Generate realistic attack scenarios with executable payloads that simulate specific attack techniques. Commands must be SAFE, NON-DESTRUCTIVE, and reversible. Output in JSON format only.`;

    const hasAttackPatterns = request.detectedAttackPatterns && request.detectedAttackPatterns.length > 0;
    const attackPatternsInfo = hasAttackPatterns
      ? request.detectedAttackPatterns!.map(ap => 
          `- ${ap.name}${ap.id ? ` (${ap.id})` : ''}${ap.description ? `: ${ap.description.substring(0, 150)}` : ''}`
        ).join('\n')
      : 'None detected - analyze the page content to identify relevant threats and techniques';

    // Truncate page content
    const truncatedContent = request.pageContent.substring(0, 3000);
    const truncatedContext = request.additionalContext?.substring(0, 1000) || '';

    let prompt: string;
    
    const emailLanguage = request.emailLanguage || 'english';
    
    if (isTableTop) {
      prompt = `Generate a table-top security exercise scenario based on the following:

Scenario Name: ${request.scenarioName}
Type: Table-Top Exercise
Duration: ${request.tableTopDuration || 60} minutes
Number of Email Notifications: ${request.numberOfInjects}
EMAIL LANGUAGE: ${emailLanguage.toUpperCase()} - All email subjects and bodies MUST be written in ${emailLanguage}.

Source Intelligence:
- Page: ${request.pageTitle}
- URL: ${request.pageUrl}

${hasAttackPatterns ? `Detected Attack Patterns/TTPs:\n${attackPatternsInfo}` : `No specific attack patterns were detected on the page. Analyze the page content below to identify relevant threats, attack techniques, vulnerabilities, or security topics mentioned, and create a realistic scenario based on that content.`}

${truncatedContext ? `Additional Context:\n${truncatedContext}\n` : ''}
Page Content:
${truncatedContent}

Generate a JSON response with this structure:
{
  "name": "scenario name",
  "description": "detailed scenario description for the exercise",
  "subtitle": "short tagline describing the exercise theme",
  "category": "table-top",
  "injects": [
    {
      "title": "inject/email notification title",
      "description": "brief description of this notification",
      "type": "email",
      "subject": "[SIMULATION] realistic email subject line in ${emailLanguage}",
      "body": "Professional email body in ${emailLanguage} describing the simulated security event (2-4 sentences)",
      "delayMinutes": minutes from scenario start (0 for first, then spaced based on duration)
    }
  ]
}

Create exactly ${request.numberOfInjects} email notification injects that:
1. Build a coherent narrative progressing through the attack/incident
2. Are spaced appropriately across the ${request.tableTopDuration || 60} minute duration
3. ${hasAttackPatterns ? 'Reference the detected attack patterns where relevant' : 'Create realistic attack scenarios based on threats or techniques mentioned in the page content'}
4. Include realistic subject lines marked as [SIMULATION]
5. Have professional, contextual email bodies suitable for training
6. ALL EMAIL SUBJECTS AND BODIES MUST BE IN ${emailLanguage.toUpperCase()}`;
    } else {
      prompt = `Generate a technical adversary simulation scenario based on the following:

Scenario Name: ${request.scenarioName}
Type: ${request.typeAffinity}
Target Platforms: ${request.platformAffinity?.join(', ') || 'Windows, Linux'}
Payload Executor: ${request.payloadAffinity || 'powershell'}
Number of Injects: ${request.numberOfInjects}

Source Intelligence:
- Page: ${request.pageTitle}
- URL: ${request.pageUrl}

${hasAttackPatterns ? `Detected Attack Patterns/TTPs:\n${attackPatternsInfo}` : `No specific attack patterns were detected on the page. Analyze the page content below to identify relevant attack techniques, malware behaviors, threat actor TTPs, or security topics mentioned, and create a realistic simulation scenario based on that content.`}

${truncatedContext ? `Additional Context:\n${truncatedContext}\n` : ''}
Page Content:
${truncatedContent}

Generate a JSON response with this structure:
{
  "name": "scenario name",
  "description": "detailed scenario description",
  "subtitle": "short tagline",
  "category": "attack-scenario",
  "injects": [
    {
      "title": "inject title",
      "description": "what this step does and what it simulates",
      "type": "command",
      "executor": "${request.payloadAffinity || 'powershell'}",
      "content": "the actual command to execute (MUST be safe and non-destructive)",
      "delayMinutes": 0 for first inject, then 1 for each subsequent inject (1 minute spacing)
    }
  ]
}

Create exactly ${request.numberOfInjects} command injects that:
1. ${hasAttackPatterns ? 'Form a coherent attack chain based on the detected patterns' : 'Form a coherent attack chain based on threats or techniques identified from the page content'}
2. Are SAFE and NON-DESTRUCTIVE (simulation only)
3. Use ${request.payloadAffinity || 'powershell'} executor syntax
4. Produce observable artifacts for detection testing
5. Progress logically through attack phases (recon → access → persistence → etc.)
6. Each inject should have delayMinutes of 0 for the first, then 1 for each subsequent (1 minute apart)

IMPORTANT:
- Commands must be SAFE for testing environments
- Do NOT include actual malicious payloads
- Focus on simulation techniques that create detectable artifacts
- Use appropriate syntax for ${request.payloadAffinity || 'powershell'}`;
    }

    return this.generate({ prompt, systemPrompt, maxTokens: 4000, temperature: 0.7 });
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
    const language = request.language || 'english';
    const systemPrompt = `You are a cybersecurity simulation expert creating realistic phishing awareness and incident simulation emails. Generate professional, contextually appropriate email content that simulates real-world security scenarios for training purposes. Output in JSON format. Generate all email content in ${language}.`;

    const attackPatternsInfo = request.attackPatterns.map(ap => 
      `- ${ap.name}${ap.externalId ? ` (${ap.externalId})` : ''}${ap.killChainPhases?.length ? ` [${ap.killChainPhases.join(', ')}]` : ''}`
    ).join('\n');

    const prompt = `Generate realistic simulation email content for a table-top security exercise based on the following:

Scenario: ${request.scenarioName}
Source Intelligence:
- Page: ${request.pageTitle}
- URL: ${request.pageUrl}

LANGUAGE: Generate all email subjects and bodies in ${language.toUpperCase()}.

Attack Patterns to simulate:
${attackPatternsInfo}

Context from page:
${request.pageContent.substring(0, 2000)}

For EACH attack pattern listed above, generate an email that:
1. Has a realistic subject line that would be used in a real attack scenario (in ${language})
2. Has a body that describes the simulated threat/action in a professional security briefing format (in ${language})
3. Is appropriate for training/awareness purposes (marked as [SIMULATION])

IMPORTANT: You must generate exactly one email object for each attack pattern provided.
The attackPatternId in your response must be the EXACT "id" value I provided for each attack pattern (the UUID string, NOT the external ID like T1222).

Generate a JSON response with this structure:
{
  "emails": [
    {
      "attackPatternId": "copy the exact id value provided for each attack pattern",
      "subject": "[SIMULATION] Realistic email subject in ${language}",
      "body": "Professional email body in ${language} describing the simulated security event..."
    }
  ]
}

Keep email bodies concise (2-4 sentences) but informative. ALL CONTENT MUST BE IN ${language.toUpperCase()}.`;

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

  /**
   * Resolve STIX relationships between entities using AI
   * Based on the page context and the entities, suggests relevant relationships
   */
  async resolveRelationships(request: RelationshipResolutionRequest): Promise<AIGenerationResponse> {
    const systemPrompt = `You are an expert cybersecurity threat intelligence analyst specializing in STIX 2.1 data modeling. Your task is to identify PRECISE and RELEVANT relationships between threat intelligence entities based on contextual evidence from the page content.

CRITICAL REQUIREMENTS:
1. PRECISION: Only suggest relationships with clear evidence in the text - NEVER hallucinate or assume
2. RELEVANCE: Choose the most semantically accurate relationship type for each connection
3. SPECIFICITY: Prefer specific relationship types over generic ones (avoid "related-to" unless no other type fits)
4. EVIDENCE-BASED: Every relationship must be supported by explicit or strongly implied textual evidence
5. DIRECTION MATTERS: Relationships are directional - ensure from/to entities are correct

COMPLETE STIX 2.1 RELATIONSHIP TYPES (use the most precise type):

ATTACK & THREAT RELATIONSHIPS:
- "uses": Threat actors, intrusion sets, campaigns, or malware USE attack patterns, tools, malware, or infrastructure
- "targets": Threat actors, intrusion sets, campaigns, or malware TARGET identity (organizations, sectors, individuals), locations, or vulnerabilities
- "attributed-to": Intrusion sets or campaigns are ATTRIBUTED TO threat actors; threat actors ATTRIBUTED TO locations/countries
- "impersonates": Threat actors or campaigns IMPERSONATE identities (organizations, individuals)

MALWARE & TOOL RELATIONSHIPS:
- "delivers": Malware DELIVERS other malware (e.g., dropper delivers payload)
- "drops": Malware DROPS other malware or tools
- "downloads": Malware or tools DOWNLOAD files, other malware, or tools
- "exploits": Malware or tools EXPLOIT vulnerabilities
- "variant-of": Malware is a VARIANT OF another malware family
- "controls": Malware CONTROLS infrastructure
- "authored-by": Malware or tools AUTHORED BY threat actors or identities

INFRASTRUCTURE & OBSERVABLE RELATIONSHIPS:
- "communicates-with": Malware or tools COMMUNICATE WITH infrastructure (IPs, domains, URLs)
- "beacons-to": Malware BEACONS TO C2 infrastructure (specific periodic communication)
- "exfiltrates-to": Malware EXFILTRATES data TO infrastructure
- "hosts": Infrastructure HOSTS malware, tools, or other infrastructure
- "owns": Identity OWNS infrastructure
- "consists-of": Infrastructure CONSISTS OF other infrastructure components
- "resolves-to": Domain RESOLVES TO IP addresses

INDICATOR & DETECTION RELATIONSHIPS:
- "indicates": Indicators INDICATE malware, attack patterns, threat actors, campaigns, or intrusion sets
- "based-on": Indicators BASED ON observables (the observable evidence for the indicator)
- "derived-from": Objects DERIVED FROM other objects (analysis products)

DEFENSE & MITIGATION RELATIONSHIPS:
- "mitigates": Courses of action MITIGATE attack patterns, malware, vulnerabilities, or tools
- "remediates": Courses of action REMEDIATE vulnerabilities or malware
- "investigates": Identities (analysts) INVESTIGATE incidents, campaigns, or intrusion sets

LOCATION & IDENTITY RELATIONSHIPS:
- "located-at": Identities, threat actors, or infrastructure LOCATED AT locations
- "originates-from": Threat actors or malware ORIGINATE FROM locations/countries

GENERAL RELATIONSHIPS:
- "related-to": Use ONLY when no other relationship type accurately describes the connection
- "duplicate-of": Object is a DUPLICATE OF another object
- "part-of": Entity is PART OF another entity (e.g., sub-campaign)

ENTITY TYPE COMPATIBILITY GUIDE:
- Threat-Actor → uses → Malware, Tool, Attack-Pattern, Infrastructure
- Threat-Actor → targets → Identity, Location, Vulnerability, Sector
- Threat-Actor → attributed-to → Identity, Location
- Threat-Actor → located-at/originates-from → Location, Country
- Intrusion-Set → uses → Malware, Tool, Attack-Pattern
- Intrusion-Set → targets → Identity, Location, Sector
- Intrusion-Set → attributed-to → Threat-Actor
- Campaign → uses → Malware, Tool, Attack-Pattern, Infrastructure
- Campaign → targets → Identity, Location, Vulnerability, Sector
- Campaign → attributed-to → Threat-Actor, Intrusion-Set
- Malware → uses → Attack-Pattern, Tool
- Malware → targets → Identity, Sector, Vulnerability
- Malware → communicates-with/beacons-to → IPv4-Addr, IPv6-Addr, Domain-Name, Url
- Malware → exploits → Vulnerability
- Malware → drops/delivers/downloads → Malware, Tool
- Malware → variant-of → Malware
- Tool → targets → Identity, Location, Vulnerability
- Tool → uses → Attack-Pattern
- Indicator → indicates → Malware, Attack-Pattern, Threat-Actor, Campaign, Intrusion-Set, Tool
- Indicator → based-on → Observable (IP, Domain, Hash, etc.)
- Attack-Pattern → targets → Identity, Location, Vulnerability
- Vulnerability → has → Course-of-Action (mitigation)
- Infrastructure → hosts → Malware, Tool
- Infrastructure → communicates-with → Infrastructure
- Domain-Name → resolves-to → IPv4-Addr, IPv6-Addr
- Observable ↔ Observable → related-to (only when contextually linked in the same attack/incident)

Output ONLY valid JSON, no markdown, no explanation.`;

    // Build the entity list with indices and types for better context
    const entityList = request.entities.map((e, index) => 
      `[${index}] ${e.type}: "${e.value || e.name}"${e.existsInPlatform ? ' (exists in OpenCTI)' : ' (new)'}`
    ).join('\n');

    const prompt = `Analyze the page content and identify PRECISE STIX 2.1 relationships between the entities listed below.

PAGE TITLE: ${request.pageTitle}
PAGE URL: ${request.pageUrl}

ENTITIES (use index numbers in your response):
${entityList}

PAGE CONTENT:
${request.pageContent.substring(0, 10000)}

INSTRUCTIONS:
1. Carefully read the page content for evidence of relationships between the listed entities
2. For each relationship found, select the MOST PRECISE relationship type from STIX 2.1
3. Ensure the direction (from → to) is semantically correct
4. Only include relationships with clear textual evidence
5. Provide a specific reason citing the evidence
6. Include the exact text excerpt that supports the relationship

Return JSON in this EXACT format:
{
  "relationships": [
    {
      "fromIndex": 0,
      "toIndex": 1,
      "relationshipType": "uses",
      "confidence": "high",
      "reason": "The article explicitly states APT29 deployed SUNBURST in the SolarWinds attack",
      "excerpt": "APT29 deployed the SUNBURST backdoor through compromised SolarWinds updates"
    }
  ]
}

CONFIDENCE LEVELS:
- "high": Explicit statement in text (e.g., "APT29 uses Cobalt Strike")
- "medium": Strongly implied by context (e.g., malware and C2 IP mentioned together in attack description)
- "low": Reasonable inference from overall context (use sparingly)

CRITICAL: 
- Prefer specific relationship types over "related-to"
- Verify entity type compatibility before suggesting a relationship
- Direction matters: "Malware uses Attack-Pattern" NOT "Attack-Pattern uses Malware"
- If no confident relationships exist, return: {"relationships": []}

Quality over quantity - only include relationships you are confident about.`;

    return this.generate({ prompt, systemPrompt, maxTokens: 4000, temperature: 0.2 });
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
    console.error('[parseAIJsonResponse] Invalid content: null or not a string');
    return null;
  }
  
  // Trim whitespace
  let trimmed = content.trim();
  
  if (!trimmed) {
    console.error('[parseAIJsonResponse] Empty content after trimming');
    return null;
  }
  
  // Remove markdown code block markers if present
  // Handle both ```json ... ``` and ``` ... ``` formats
  // Also handle cases where closing ``` might be missing (truncated responses)
  if (trimmed.startsWith('```json')) {
    trimmed = trimmed.slice(7); // Remove ```json
  } else if (trimmed.startsWith('```')) {
    trimmed = trimmed.slice(3); // Remove ```
  }
  
  // Remove closing ``` if present (could be at end or with trailing whitespace)
  trimmed = trimmed.replace(/```\s*$/, '');
  
  trimmed = trimmed.trim();
  
  // Attempt multiple parsing strategies
  const strategies = [
    // Strategy 1: Direct parse of trimmed content
    () => JSON.parse(trimmed),
    
    // Strategy 2: Extract from markdown code block (greedy)
    () => {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*)```/);
      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1].trim());
      }
      throw new Error('No markdown code block found');
    },
    
    // Strategy 3: Extract from markdown code block WITHOUT closing (truncated)
    () => {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*)/);
      if (jsonMatch && jsonMatch[1]) {
        const jsonContent = jsonMatch[1].trim().replace(/```\s*$/, '').trim();
        return JSON.parse(jsonContent);
      }
      throw new Error('No markdown code block found');
    },
    
    // Strategy 4: Find balanced JSON object from trimmed
    () => {
      const jsonStr = extractBalancedJson(trimmed);
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
      throw new Error('No balanced JSON found');
    },
    
    // Strategy 5: Find balanced JSON object from original content
    () => {
      const jsonStr = extractBalancedJson(content);
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
      throw new Error('No balanced JSON found in original');
    },
    
    // Strategy 6: Greedy match for JSON object
    () => {
      const jsonObjectMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        return JSON.parse(jsonObjectMatch[0]);
      }
      throw new Error('No JSON object found');
    },
    
    // Strategy 7: Find JSON array
    () => {
      const jsonArrayMatch = trimmed.match(/\[[\s\S]*\]/);
      if (jsonArrayMatch) {
        return JSON.parse(jsonArrayMatch[0]);
      }
      throw new Error('No JSON array found');
    },
    
    // Strategy 8: Try to fix common JSON issues (trailing commas, etc.)
    () => {
      let fixed = trimmed;
      // Remove trailing commas before } or ]
      fixed = fixed.replace(/,\s*([\]}])/g, '$1');
      // Try to parse fixed content
      return JSON.parse(fixed);
    },
    
    // Strategy 9: Try to find balanced JSON after fixing
    () => {
      let fixed = trimmed;
      fixed = fixed.replace(/,\s*([\]}])/g, '$1');
      const jsonStr = extractBalancedJson(fixed);
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
      throw new Error('No balanced JSON found after fixing');
    },
    
    // Strategy 10: Try to complete truncated JSON
    () => {
      const completed = tryCompleteJson(trimmed);
      if (completed) {
        return JSON.parse(completed);
      }
      throw new Error('Could not complete truncated JSON');
    },
  ];
  
  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      if (result !== null && result !== undefined) {
        return result as T;
      }
    } catch {
      // Continue to next strategy
    }
  }
  
  // Log the content for debugging if all strategies failed
  console.error('[parseAIJsonResponse] All parsing strategies failed. Content preview:', 
    trimmed.substring(0, 500) + (trimmed.length > 500 ? '...' : ''));
  
  return null;
}

/**
 * Try to complete truncated JSON by adding missing closing brackets
 */
function tryCompleteJson(content: string): string | null {
  // Count open and close braces/brackets
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      else if (char === '[') bracketCount++;
      else if (char === ']') bracketCount--;
    }
  }
  
  // If we have unclosed structures, try to close them
  if (braceCount > 0 || bracketCount > 0) {
    let completed = content;
    
    // If we're in a string, close it first
    if (inString) {
      completed += '"';
    }
    
    // Remove any trailing incomplete key-value or comma
    completed = completed.replace(/,\s*$/, '');
    completed = completed.replace(/,\s*"[^"]*$/, '');
    completed = completed.replace(/:\s*$/, ': null');
    completed = completed.replace(/:\s*"[^"]*$/, ': ""');
    
    // Close brackets and braces
    for (let i = 0; i < bracketCount; i++) {
      completed += ']';
    }
    for (let i = 0; i < braceCount; i++) {
      completed += '}';
    }
    
    return completed;
  }
  
  return null;
}

/**
 * Extract balanced JSON from a string by counting braces
 * Handles cases where the JSON might be truncated or have extra content after
 */
function extractBalancedJson(content: string): string | null {
  const startIndex = content.indexOf('{');
  if (startIndex === -1) return null;
  
  let depth = 0;
  let inString = false;
  let escaped = false;
  
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return content.substring(startIndex, i + 1);
        }
      }
    }
  }
  
  // If we reach here, the JSON is incomplete
  // Return null to indicate parsing failure
  return null;
}
