/**
 * Configuration Types
 * 
 * Types related to platform and extension configuration
 */

import { PlatformType } from '../platform/registry';

/**
 * Platform configuration for a single instance
 */
export interface PlatformConfig {
  id: string;
  name: string;
  url: string;
  apiToken: string;
  enabled: boolean;
  lastConnected?: string;
  platformName?: string;
  platformVersion?: string;
  isEnterprise?: boolean;
  /** Platform type for identification */
  type?: PlatformType;
}

/**
 * Detection settings for entity scanning
 * Platform-agnostic - uses string arrays for entity type configuration
 */
export interface DetectionSettings {
  /** OpenCTI SDO entity types to detect */
  entityTypes?: string[];
  /** OpenCTI observable types to detect */
  observableTypes?: string[];
  /** Entity types to detect by platform (keyed by platform type, e.g., 'openaev') */
  platformEntityTypes?: Record<string, string[]>;
}

/**
 * Extension settings
 */
export interface ExtensionSettings {
  // Multi-platform support - keyed by platform type
  // Each platform type has its own array of configured instances
  openctiPlatforms: PlatformConfig[];
  openaevPlatforms: PlatformConfig[];
  opengrcPlatforms?: PlatformConfig[]; // Future platform
  theme: 'light' | 'dark' | 'auto';
  autoScan: boolean;
  highlightColor?: string;
  showNotifications: boolean;
  detection?: DetectionSettings;
  // AI configuration (available only with EE platforms)
  ai?: AISettings;
}

/**
 * Default extension settings
 */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  openctiPlatforms: [],
  openaevPlatforms: [],
  theme: 'dark',
  autoScan: false,
  showNotifications: true,
  detection: {
    // Entity types match the SDO cache structure (storage.ts SDOCache)
    entityTypes: [
      'Administrative-Area', 'Attack-Pattern', 'Campaign', 'City', 'Country', 'Event',
      'Incident', 'Individual', 'Intrusion-Set', 'Malware', 'Organization',
      'Position', 'Region', 'Sector', 'Threat-Actor-Group', 'Threat-Actor-Individual'
    ],
    observableTypes: [
      'Bank-Account', 'Cryptocurrency-Wallet', 'Domain-Name', 'Email-Addr',
      'Hostname', 'IPv4-Addr', 'IPv6-Addr', 'Mac-Addr', 'Phone-Number',
      'StixFile', 'Url', 'User-Agent'
    ],
    platformEntityTypes: {
      openaev: ['Asset', 'AssetGroup', 'AttackPattern', 'Player', 'Team', 'Finding'],
    },
  },
  ai: {
    // AI settings - no default provider/key
  },
};

// Import AISettings type (circular import prevention via forward reference)
import type { AISettings } from './ai';

