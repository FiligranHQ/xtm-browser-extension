/**
 * Constants and type definitions for the Options page
 * 
 * Naming convention:
 * - OBSERVABLE_TYPES: Observable types (IPs, domains, hashes, etc.)
 * - OPENCTI_TYPES: OpenCTI entity types (Threat Actors, Malware, etc.)
 * - OPENAEV_TYPES: OpenAEV entity types (Assets, Teams, Players, etc.)
 */

// Observable Types - sorted alphabetically by label
export const OBSERVABLE_TYPES = [
  { value: 'Bank-Account', label: 'Bank Accounts (IBAN)' },
  { value: 'Cryptocurrency-Wallet', label: 'Cryptocurrency Wallets' },
  { value: 'Domain-Name', label: 'Domain Names' },
  { value: 'Email-Addr', label: 'Email Addresses' },
  { value: 'StixFile', label: 'Files (hashes, file names)' },
  { value: 'Hostname', label: 'Hostnames' },
  { value: 'IPv4-Addr', label: 'IPv4 Addresses' },
  { value: 'IPv6-Addr', label: 'IPv6 Addresses' },
  { value: 'Mac-Addr', label: 'MAC Addresses' },
  { value: 'Phone-Number', label: 'Phone Numbers' },
  { value: 'Url', label: 'URLs' },
  { value: 'User-Agent', label: 'User Agents' },
];

// OpenCTI Types - sorted alphabetically by label
export const OPENCTI_TYPES = [
  { value: 'Administrative-Area', label: 'Administrative Areas' },
  { value: 'Attack-Pattern', label: 'Attack Patterns' },
  { value: 'Campaign', label: 'Campaigns' },
  { value: 'Channel', label: 'Channels' },
  { value: 'City', label: 'Cities' },
  { value: 'Country', label: 'Countries' },
  { value: 'Event', label: 'Events' },
  { value: 'Incident', label: 'Incidents' },
  { value: 'Individual', label: 'Individuals' },
  { value: 'Intrusion-Set', label: 'Intrusion Sets' },
  { value: 'Malware', label: 'Malware' },
  { value: 'Narrative', label: 'Narratives' },
  { value: 'Organization', label: 'Organizations' },
  { value: 'Position', label: 'Positions' },
  { value: 'Region', label: 'Regions' },
  { value: 'Sector', label: 'Sectors' },
  { value: 'System', label: 'Systems' },
  { value: 'Threat-Actor-Group', label: 'Threat Actor Groups' },
  { value: 'Threat-Actor-Individual', label: 'Threat Actor Individuals' },
  { value: 'Tool', label: 'Tools' },
  { value: 'Vulnerability', label: 'Vulnerabilities (CVE)' },
];

// OpenAEV Types - sorted alphabetically by label
export const OPENAEV_TYPES = [
  { value: 'AssetGroup', label: 'Asset Groups' },
  { value: 'Asset', label: 'Assets (Endpoints)' },
  { value: 'AttackPattern', label: 'Attack Patterns' },
  { value: 'Finding', label: 'Findings' },
  { value: 'Player', label: 'People' },
  { value: 'Team', label: 'Teams' },
  { value: 'Vulnerability', label: 'Vulnerabilities (CVE)' },
];

export const DEFAULT_DETECTION = {
  // Empty disabled arrays = all types enabled by default
  disabledObservableTypes: [] as string[],
  disabledOpenCTITypes: [] as string[],
  disabledOpenAEVTypes: [] as string[],
};

// Settings navigation tabs - add new platform tabs here when integrating new platforms
export type TabType = 'opencti' | 'openaev' | 'detection' | 'ai' | 'appearance' | 'about';
// When adding new platform: type TabType = 'opencti' | 'openaev' | 'opengrc' | 'detection' | ...;

// Platform cache stats sub-type
export interface PlatformCacheStats {
  platformId: string;
  platformName: string;
  total: number;
  age: number;
  byType: Record<string, number>;
}

// Cache stats type
export interface CacheStats {
  total: number;
  age: number;
  byPlatform?: PlatformCacheStats[];
  oaevByPlatform?: PlatformCacheStats[];
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

