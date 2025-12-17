/**
 * Constants and type definitions for the Options page
 */

// Observable types that can be detected - sorted alphabetically by label
export const OBSERVABLE_TYPES = [
  { value: 'Bank-Account', label: 'Bank Accounts (IBAN)' },
  { value: 'Cryptocurrency-Wallet', label: 'Cryptocurrency Wallets' },
  { value: 'Domain-Name', label: 'Domain Names' },
  { value: 'Email-Addr', label: 'Email Addresses' },
  { value: 'StixFile', label: 'File Hashes (MD5, SHA1, SHA256)' },
  { value: 'Hostname', label: 'Hostnames' },
  { value: 'IPv4-Addr', label: 'IPv4 Addresses' },
  { value: 'IPv6-Addr', label: 'IPv6 Addresses' },
  { value: 'Mac-Addr', label: 'MAC Addresses' },
  { value: 'Phone-Number', label: 'Phone Numbers' },
  { value: 'Url', label: 'URLs' },
  { value: 'User-Agent', label: 'User Agents' },
];

// Entity types that can be detected - sorted alphabetically by label
// These match the entity types that are cached for detection (see storage.ts SDOCache)
export const ENTITY_TYPES = [
  { value: 'Administrative-Area', label: 'Administrative Areas' },
  { value: 'Attack-Pattern', label: 'Attack Patterns' },
  { value: 'Campaign', label: 'Campaigns' },
  { value: 'City', label: 'Cities' },
  { value: 'Country', label: 'Countries' },
  { value: 'Event', label: 'Events' },
  { value: 'Incident', label: 'Incidents' },
  { value: 'Individual', label: 'Individuals' },
  { value: 'Intrusion-Set', label: 'Intrusion Sets' },
  { value: 'Malware', label: 'Malware' },
  { value: 'Organization', label: 'Organizations' },
  { value: 'Position', label: 'Positions' },
  { value: 'Region', label: 'Regions' },
  { value: 'Sector', label: 'Sectors' },
  { value: 'Threat-Actor-Group', label: 'Threat Actor Groups' },
  { value: 'Threat-Actor-Individual', label: 'Threat Actor Individuals' },
];

// ============================================================================
// Platform Entity Types Configuration
// When adding a new platform, add its entity types constant here
// ============================================================================

// OpenAEV entity types - sorted alphabetically by label
export const OAEV_ENTITY_TYPES = [
  { value: 'AssetGroup', label: 'Asset Groups' },
  { value: 'Asset', label: 'Assets (Endpoints)' },
  { value: 'AttackPattern', label: 'Attack Patterns' },
  { value: 'Finding', label: 'Findings' },
  { value: 'Player', label: 'People' },
  { value: 'Team', label: 'Teams' },
];

// All platform entity type configurations - keyed by platform type
export const PLATFORM_ENTITY_TYPES: Record<string, Array<{ value: string; label: string }>> = {
  openaev: OAEV_ENTITY_TYPES,
};

export const DEFAULT_DETECTION = {
  entityTypes: ENTITY_TYPES.map(e => e.value),
  observableTypes: OBSERVABLE_TYPES.map(o => o.value),
  platformEntityTypes: {
    openaev: OAEV_ENTITY_TYPES.map(o => o.value),
  },
};

// Settings navigation tabs - add new platform tabs here when integrating new platforms
export type TabType = 'opencti' | 'openaev' | 'detection' | 'ai' | 'appearance' | 'about';
// When adding new platform: type TabType = 'opencti' | 'openaev' | 'opengrc' | 'detection' | ...;

// Cache stats type
export interface CacheStats {
  total: number;
  age: number;
  byPlatform?: Array<{
    platformId: string;
    platformName: string;
    total: number;
    age: number;
    byType: Record<string, number>;
  }>;
  oaevByPlatform?: Array<{
    platformId: string;
    platformName: string;
    total: number;
    age: number;
    byType: Record<string, number>;
  }>;
  oaevTotal?: number;
  isRefreshing?: boolean;
}

// Test result type
export interface TestResult {
  type: 'success' | 'error';
  message: string;
}

// Snackbar state type
export interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
}

// AI test result type
export interface AITestResult {
  success: boolean;
  message: string;
}

// Available model type
export interface AvailableModel {
  id: string;
  name: string;
  description?: string;
}

