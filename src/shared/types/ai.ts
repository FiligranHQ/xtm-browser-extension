/**
 * AI Configuration Types
 * 
 * Types for AI provider configuration, model selection, and scenario generation.
 */

// ============================================================================
// AI Provider Types
// ============================================================================

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'custom' | 'xtm-one';

export interface AIModelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface AISettings {
  provider?: AIProvider;
  apiKey?: string;
  model?: string;
  availableModels?: AIModelInfo[];
  connectionTested?: boolean;
  /** Custom OpenAI-compatible endpoint URL (only used when provider is 'custom') */
  customBaseUrl?: string;
}

