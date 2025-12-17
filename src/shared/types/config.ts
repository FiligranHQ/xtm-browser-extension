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
 * Detection settings for scanning
 * Uses "disabled" arrays (empty = all enabled by default)
 * 
 * Types are organized as:
 * - Observable Types: IPs, domains, hashes, etc.
 * - OpenCTI Types: Threat Actors, Malware, etc.
 * - OpenAEV Types: Assets, Teams, Players, etc.
 */
export interface DetectionSettings {
  /** Observable Types to EXCLUDE from detection */
  disabledObservableTypes?: string[];
  /** OpenCTI Types to EXCLUDE from detection */
  disabledOpenCTITypes?: string[];
  /** OpenAEV Types to EXCLUDE from detection */
  disabledOpenAEVTypes?: string[];
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
    // Empty disabled arrays = all types enabled by default
    disabledObservableTypes: [],
    disabledOpenCTITypes: [],
    disabledOpenAEVTypes: [],
  },
  ai: {
    // AI settings - no default provider/key
  },
};

// Import AISettings type (circular import prevention via forward reference)
import type { AISettings } from './ai';

