/**
 * AI Client - Unified interface for AI providers (OpenAI, Anthropic, Gemini)
 *
 * Provides AI-powered features for:
 * - Container description generation
 * - Scenario generation
 * - On-the-fly atomic testing
 */

import type { AIProvider, AISettings } from '../types';

export type {
  AIGenerationRequest,
  AIGenerationResponse,
  ContainerDescriptionRequest,
  ScenarioGenerationRequest,
  GeneratedScenario,
  GeneratedInject,
  FullScenarioGenerationRequest,
  AtomicTestRequest,
  GeneratedAtomicTest,
  EmailGenerationRequest,
  GeneratedEmail,
  EntityDiscoveryRequest,
  DiscoveredEntity,
  RelationshipResolutionRequest,
  ResolvedRelationship,
} from './ai/types';

// Import types for internal use
import type {
  AIGenerationRequest,
  AIGenerationResponse,
  ContainerDescriptionRequest,
  ScenarioGenerationRequest,
  FullScenarioGenerationRequest,
  AtomicTestRequest,
  EmailGenerationRequest,
  EntityDiscoveryRequest,
  RelationshipResolutionRequest,
} from './ai/types';

// Import prompts
import {
  SYSTEM_PROMPTS,
  buildContainerDescriptionPrompt,
  buildScenarioPrompt,
  buildFullScenarioPrompt,
  buildAtomicTestPrompt,
  buildEmailGenerationPrompt,
  buildEmailGenerationSystemPrompt,
  buildEntityDiscoveryPrompt,
  buildRelationshipResolutionPrompt,
} from './ai/prompts';

// ============================================================================
// Constants
// ============================================================================

const BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
} as const;

const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-5.2',
  anthropic: 'claude-sonnet-4-5',
  gemini: 'gemini-2.5-flash-lite',
  'xtm-one': '',
};

const MAX_MODELS = 20;

// ============================================================================
// AI Client Class
// ============================================================================

export class AIClient {
  private provider: AIProvider;
  private apiKey: string;
  private model?: string;

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

  private getModel(): string {
    return this.model || DEFAULT_MODELS[this.provider] || '';
  }

  // ==========================================================================
  // Model Discovery
  // ==========================================================================

  async testConnectionAndFetchModels(): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; description?: string; created?: number }>;
    error?: string;
  }> {
    try {
      switch (this.provider) {
        case 'openai': return await this.fetchOpenAIModels();
        case 'anthropic': return await this.fetchAnthropicModels();
        case 'gemini': return await this.fetchGeminiModels();
        default: return { success: false, error: 'Unknown AI provider' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch models' };
    }
  }

  private async fetchOpenAIModels() {
    const response = await fetch(`${BASE_URLS.openai}/models`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) throw new Error('Invalid API key');
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const models = (data.data || [])
      .sort((a: { created: number }, b: { created: number }) => (b.created || 0) - (a.created || 0))
      .slice(0, MAX_MODELS)
      .map((m: { id: string; created?: number; owned_by?: string }) => ({
        id: m.id,
        name: m.id,
        description: m.owned_by ? `Owned by: ${m.owned_by}` : undefined,
        created: m.created,
      }));

    return { success: true, models };
  }

  private async fetchAnthropicModels() {
    const response = await fetch(`${BASE_URLS.anthropic}/models`, {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) throw new Error('Invalid API key');
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const models = (data.data || [])
      .sort((a: { created_at?: string }, b: { created_at?: string }) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, MAX_MODELS)
      .map((m: { id: string; display_name?: string; created_at?: string }) => ({
        id: m.id,
        name: m.display_name || m.id,
        created: m.created_at ? Math.floor(new Date(m.created_at).getTime() / 1000) : undefined,
      }));

    return { success: true, models };
  }

  private async fetchGeminiModels() {
    const response = await fetch(`${BASE_URLS.gemini}/models?key=${this.apiKey}`, { method: 'GET' });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 400) throw new Error('Invalid API key');
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const models = (data.models || [])
      .slice(0, MAX_MODELS)
      .map((m: { name: string; displayName?: string; description?: string }) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name.replace('models/', ''),
        description: m.description?.substring(0, 100),
      }));

    return { success: true, models };
  }

  // ==========================================================================
  // Core Generation
  // ==========================================================================

  async generate(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    try {
      switch (this.provider) {
        case 'openai': return await this.generateOpenAI(request);
        case 'anthropic': return await this.generateAnthropic(request);
        case 'gemini': return await this.generateGemini(request);
        default: return { success: false, error: 'Unknown AI provider' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'AI generation failed' };
    }
  }

  // ==========================================================================
  // Feature-Specific Generation Methods
  // ==========================================================================

  async generateContainerDescription(request: ContainerDescriptionRequest): Promise<AIGenerationResponse> {
    return this.generate({
      prompt: buildContainerDescriptionPrompt(request),
      systemPrompt: SYSTEM_PROMPTS.containerDescription,
      maxTokens: 1000,
    });
  }

  async generateScenario(request: ScenarioGenerationRequest): Promise<AIGenerationResponse> {
    return this.generate({
      prompt: buildScenarioPrompt(request),
      systemPrompt: SYSTEM_PROMPTS.scenarioGeneration,
      maxTokens: 2500,
      temperature: 0.7,
    });
  }

  async generateFullScenario(request: FullScenarioGenerationRequest): Promise<AIGenerationResponse> {
    const { systemPrompt, prompt } = buildFullScenarioPrompt(request);
    return this.generate({
      prompt,
      systemPrompt,
      maxTokens: 4000,
      temperature: 0.7,
    });
  }

  async generateAtomicTest(request: AtomicTestRequest): Promise<AIGenerationResponse> {
    return this.generate({
      prompt: buildAtomicTestPrompt(request),
      systemPrompt: SYSTEM_PROMPTS.atomicTest,
      maxTokens: 1000,
      temperature: 0.5,
    });
  }

  async generateEmails(request: EmailGenerationRequest): Promise<AIGenerationResponse> {
    return this.generate({
      prompt: buildEmailGenerationPrompt(request),
      systemPrompt: buildEmailGenerationSystemPrompt(request.language),
      maxTokens: 2000,
      temperature: 0.7,
    });
  }

  async discoverEntities(request: EntityDiscoveryRequest): Promise<AIGenerationResponse> {
    return this.generate({
      prompt: buildEntityDiscoveryPrompt(request),
      systemPrompt: SYSTEM_PROMPTS.entityDiscovery,
      maxTokens: 2000,
      temperature: 0.3,
    });
  }

  async resolveRelationships(request: RelationshipResolutionRequest): Promise<AIGenerationResponse> {
    return this.generate({
      prompt: buildRelationshipResolutionPrompt(request),
      systemPrompt: SYSTEM_PROMPTS.relationshipResolution,
      maxTokens: 4000,
      temperature: 0.2,
    });
  }

  // ==========================================================================
  // Provider-Specific Implementations
  // ==========================================================================

  private async generateOpenAI(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const response = await fetch(`${BASE_URLS.openai}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.getModel(),
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
    return { success: true, content: data.choices?.[0]?.message?.content || '' };
  }

  private async generateAnthropic(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const response = await fetch(`${BASE_URLS.anthropic}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.getModel(),
        max_tokens: request.maxTokens || 1500,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, content: data.content?.[0]?.text || '' };
  }

  private async generateGemini(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const response = await fetch(
      `${BASE_URLS.gemini}/models/${this.getModel()}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: request.systemPrompt ? `${request.systemPrompt}\n\n${request.prompt}` : request.prompt }] }],
          generationConfig: { maxOutputTokens: request.maxTokens || 1500, temperature: request.temperature || 0.7 },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, content: data.candidates?.[0]?.content?.parts?.[0]?.text || '' };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if AI is configured and available
 */
export function isAIAvailable(settings?: AISettings): boolean {
  return !!(settings?.provider && settings?.apiKey && settings?.model);
}
