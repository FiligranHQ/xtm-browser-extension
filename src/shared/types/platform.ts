/**
 * Multi-Platform Types
 * 
 * Types for cross-platform entity matching and enrichment.
 */

import type { OCTIStixCyberObservable, OCTIStixDomainObject } from './opencti';

// ============================================================================
// Platform Match Types
// ============================================================================

export interface PlatformMatch {
  platformId: string;
  entityId: string;
  entityData?: OCTIStixCyberObservable | OCTIStixDomainObject | Record<string, unknown>;
  platformType?: 'opencti' | 'openaev' | string;
  type?: string;
}

// ============================================================================
// Enrichment Types
// ============================================================================

export type EnrichmentPlatformType = 'opencti' | 'openaev';

export interface EnrichmentMatch {
  platformId: string;
  platformType: EnrichmentPlatformType;
  entityId: string;
  entityType: string;
  entityData: Record<string, unknown>;
}
