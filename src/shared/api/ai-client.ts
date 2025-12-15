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

export interface GeneratedAtomicTest {
  name: string;
  description: string;
  executor: string; // powershell, bash, sh, cmd
  command: string;
  cleanupCommand?: string;
  prerequisites?: string[];
}

// ============================================================================
// AI Client Class
// ============================================================================

export class AIClient {
  private provider: AIProvider;
  private apiKey: string;
  private baseUrls = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
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
  }

  /**
   * Test connection and fetch available models from the provider
   */
  async testConnectionAndFetchModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; description?: string }>;
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
   */
  private async fetchOpenAIModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; description?: string }>;
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
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Filter to only include chat models (GPT models)
    const chatModels = (data.data || [])
      .filter((m: { id: string }) => 
        m.id.includes('gpt-4') || 
        m.id.includes('gpt-3.5') || 
        m.id.includes('o1') ||
        m.id.includes('o3')
      )
      .map((m: { id: string }) => ({
        id: m.id,
        name: this.formatOpenAIModelName(m.id),
        description: this.getOpenAIModelDescription(m.id),
      }))
      .sort((a: { id: string }, b: { id: string }) => {
        // Sort by model family and version (newest first)
        const order = ['o3', 'o1', 'gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5'];
        for (const prefix of order) {
          if (a.id.includes(prefix) && !b.id.includes(prefix)) return -1;
          if (!a.id.includes(prefix) && b.id.includes(prefix)) return 1;
        }
        return b.id.localeCompare(a.id);
      });

    return { success: true, models: chatModels };
  }

  private formatOpenAIModelName(id: string): string {
    if (id.includes('gpt-4o')) return 'GPT-4o' + (id.includes('mini') ? ' Mini' : '');
    if (id.includes('gpt-4-turbo')) return 'GPT-4 Turbo';
    if (id.includes('gpt-4')) return 'GPT-4';
    if (id.includes('gpt-3.5-turbo')) return 'GPT-3.5 Turbo';
    if (id.includes('o1-preview')) return 'o1 Preview';
    if (id.includes('o1-mini')) return 'o1 Mini';
    if (id.includes('o1')) return 'o1';
    if (id.includes('o3-mini')) return 'o3 Mini';
    if (id.includes('o3')) return 'o3';
    return id;
  }

  private getOpenAIModelDescription(id: string): string {
    if (id.includes('gpt-4o')) return 'Most capable and fast multimodal model';
    if (id.includes('gpt-4-turbo')) return 'High intelligence with vision capabilities';
    if (id.includes('gpt-4')) return 'Advanced reasoning model';
    if (id.includes('gpt-3.5-turbo')) return 'Fast and cost-effective';
    if (id.includes('o1') || id.includes('o3')) return 'Advanced reasoning model';
    return '';
  }

  /**
   * Fetch available models from Anthropic
   * Note: Anthropic doesn't have a models list API, so we return known models
   */
  private async fetchAnthropicModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; description?: string }>;
    error?: string;
  }> {
    // Test the API key by making a minimal request
    const response = await fetch(`${this.baseUrls.anthropic}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Check for auth errors specifically
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    // Return known Anthropic models (they don't have a models list API)
    const models = [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest balanced model' },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'Extended thinking model' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Fast and intelligent' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest model' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful model' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Balanced performance' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fast and compact' },
    ];

    return { success: true, models };
  }

  /**
   * Fetch available models from Google Gemini
   */
  private async fetchGeminiModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; description?: string }>;
    error?: string;
  }> {
    const response = await fetch(
      `${this.baseUrls.gemini}/models?key=${this.apiKey}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Filter to only include generative models
    const generativeModels = (data.models || [])
      .filter((m: { name: string; supportedGenerationMethods?: string[] }) => 
        m.supportedGenerationMethods?.includes('generateContent') &&
        (m.name.includes('gemini-2') || m.name.includes('gemini-1.5') || m.name.includes('gemini-pro'))
      )
      .map((m: { name: string; displayName?: string; description?: string }) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name.replace('models/', ''),
        description: m.description?.substring(0, 100),
      }))
      .sort((a: { id: string }, b: { id: string }) => {
        // Sort by version (newest first)
        if (a.id.includes('gemini-2') && !b.id.includes('gemini-2')) return -1;
        if (!a.id.includes('gemini-2') && b.id.includes('gemini-2')) return 1;
        return b.id.localeCompare(a.id);
      });

    return { success: true, models: generativeModels };
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
    const systemPrompt = `You are an expert in adversary simulation and atomic testing (like Atomic Red Team). Generate safe, reversible test commands that simulate specific attack techniques. Always include cleanup commands. Output in JSON format.`;

    const prompt = `Generate an atomic test for the following attack technique:

Attack Pattern: ${request.attackPattern.name}
${request.attackPattern.id ? `MITRE ID: ${request.attackPattern.id}` : ''}
${request.attackPattern.description ? `Description: ${request.attackPattern.description.substring(0, 500)}` : ''}
Target Platform: ${request.targetPlatform}
${request.attackPattern.mitrePlatforms?.length ? `Supported Platforms: ${request.attackPattern.mitrePlatforms.join(', ')}` : ''}

${request.context ? `Additional Context:\n${request.context.substring(0, 500)}` : ''}

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
- Use appropriate executor for ${request.targetPlatform}`;

    return this.generate({ prompt, systemPrompt, maxTokens: 1000, temperature: 0.5 });
  }

  // ============================================================================
  // Provider-specific implementations
  // ============================================================================

  private async generateOpenAI(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const response = await fetch(`${this.baseUrls.openai}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
    const response = await fetch(`${this.baseUrls.anthropic}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
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
    const response = await fetch(
      `${this.baseUrls.gemini}/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
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
 * Parse JSON from AI response (handles markdown code blocks)
 */
export function parseAIJsonResponse<T>(content: string): T | null {
  try {
    // Try direct JSON parse first
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        return null;
      }
    }
    return null;
  }
}
