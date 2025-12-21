/**
 * Scan Types
 * 
 * Types for scan results used across the extension.
 * Provides a unified entity representation for panel and PDF scanner.
 */

// ============================================================================
// Platform Match Types
// ============================================================================

/**
 * Platform match with required fields for scan results
 * Extends PlatformMatch with additional required fields for UI
 */
export interface ScanResultPlatformMatch {
  platformId: string;
  /** Platform type - required for scan results (unlike PlatformMatch) */
  platformType: 'opencti' | 'openaev' | string;
  entityId?: string;
  entityData?: unknown;
  /** Entity type - required for scan results display */
  type: string;
}

// ============================================================================
// Scan Entity Types
// ============================================================================

/**
 * Unified scan result entity
 * Used by both panel scan results and PDF scanner
 * 
 * For UI components, `id` is required (generated client-side).
 * Use `RawScanEntity` for unprocessed scan results.
 */
export interface ScanResultEntity {
  /** Unique identifier for UI (generated client-side) */
  id: string;
  /** Entity type (e.g., 'IPv4-Addr', 'Malware', 'Asset') */
  type: string;
  /** Display name */
  name: string;
  /** Value (for observables - IP, domain, hash, etc.) */
  value?: string;
  /** Whether entity was found in any platform */
  found: boolean;
  /** Entity ID in the platform (if found) */
  entityId?: string;
  /** Platform instance ID */
  platformId?: string;
  /** Platform type (opencti, openaev, or custom) */
  platformType?: 'opencti' | 'openaev' | string;
  /** Full entity data from platform */
  entityData?: unknown;
  /** Matches across multiple platforms */
  platformMatches?: ScanResultPlatformMatch[];
  /** Whether discovered by AI (not regex) */
  discoveredByAI?: boolean;
  /** AI explanation for discovery */
  aiReason?: string;
  /** AI confidence level */
  aiConfidence?: 'high' | 'medium' | 'low';
  /** Matched strings from the page (name, aliases, etc.) */
  matchedStrings?: string[];
  /** Allow additional properties */
  [key: string]: unknown;
}

// ============================================================================
// Import Results
// ============================================================================

/**
 * Results from bulk entity import operation
 */
export interface ImportResults {
  success: boolean;
  total: number;
  created: Array<{ id: string; type: string; value: string }>;
  failed: Array<{ type: string; value: string; error?: string }>;
  platformName: string;
  platformUrl: string;
}

