/**
 * AI Configuration Types
 * 
 * Types related to AI features and providers
 */

/**
 * Supported AI providers
 */
export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'xtm-one';

/**
 * AI model information
 */
export interface AIModelInfo {
  id: string;
  name: string;
  description?: string;
}

/**
 * AI settings configuration
 */
export interface AISettings {
  enabled?: boolean; // Deprecated: now computed from provider + apiKey + model
  provider?: AIProvider;
  apiKey?: string;
  // Model selection (optional, uses provider defaults if not set)
  model?: string;
  // Cached available models from the provider API
  availableModels?: AIModelInfo[];
  // Connection test result
  connectionTested?: boolean;
}

/**
 * Platform affinity options for scenario generation (matching OpenAEV/OpenCTI)
 */
export const PLATFORM_AFFINITIES = [
  { value: 'windows', label: 'Windows' },
  { value: 'linux', label: 'Linux' },
  { value: 'macos', label: 'macOS' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'network', label: 'Network' },
  { value: 'containers', label: 'Containers' },
  { value: 'office-365', label: 'Office 365' },
  { value: 'azure-ad', label: 'Azure AD' },
  { value: 'google-workspace', label: 'Google Workspace' },
  { value: 'saas', label: 'SaaS' },
  { value: 'iaas', label: 'IaaS' },
  { value: 'pre', label: 'PRE' },
] as const;

/**
 * Type affinity options for scenario generation
 */
export const TYPE_AFFINITIES = [
  { value: 'attack-scenario', label: 'Attack Scenario' },
  { value: 'incident-response', label: 'Incident Response' },
  { value: 'detection-validation', label: 'Detection Validation' },
  { value: 'threat-hunting', label: 'Threat Hunting' },
  { value: 'red-team', label: 'Red Team Exercise' },
  { value: 'purple-team', label: 'Purple Team Exercise' },
  { value: 'tabletop', label: 'Tabletop Exercise' },
  { value: 'crisis-management', label: 'Crisis Management' },
] as const;

