/**
 * AI Configuration Types
 *
 * The extension routes every AI feature through XTM One. There is no BYOK
 * (Bring Your Own Key) mode and no direct LLM provider integration.
 */

// ============================================================================
// AI Settings
// ============================================================================

export interface AISettings {
  /** XTM One base URL (e.g. https://xtm.company.com). Trailing slash tolerated. */
  xtmOneUrl?: string;
  /** XTM One Personal Access Token (starts with "fcp-"). */
  apiToken?: string;
  /** True once a successful connection test against XTM One has been performed. */
  connectionTested?: boolean;
  /** Maximum output tokens forwarded to XTM One (default: 10000). */
  maxTokens?: number;
  /** Maximum page content length in characters before truncation (default: 50000). */
  maxContentLength?: number;
}

// Default AI settings values
export const AI_DEFAULTS = {
  maxTokens: 10000,
  maxContentLength: 50000,
};
