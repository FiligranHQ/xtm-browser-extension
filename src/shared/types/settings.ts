/**
 * Settings and Configuration Types
 * 
 * Types for extension configuration, platform settings, and detection settings.
 */

import { PlatformType } from '../platform/registry';
import type { AISettings } from './ai';

// ============================================================================
// Platform Configuration
// ============================================================================

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
  type?: PlatformType;
}

// ============================================================================
// Detection Settings
// ============================================================================

export interface DetectionSettings {
  disabledObservableTypes?: string[];
  disabledOpenCTITypes?: string[];
  disabledOpenAEVTypes?: string[];
}

// ============================================================================
// Extension Settings
// ============================================================================

export interface ExtensionSettings {
  openctiPlatforms: PlatformConfig[];
  openaevPlatforms: PlatformConfig[];
  opengrcPlatforms?: PlatformConfig[];
  theme: 'light' | 'dark' | 'auto';
  autoScan: boolean;
  highlightColor?: string;
  showNotifications: boolean;
  /** Enable browser native split screen panel instead of floating panel */
  splitScreenMode?: boolean;
  detection?: DetectionSettings;
  ai?: AISettings;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  openctiPlatforms: [],
  openaevPlatforms: [],
  theme: 'dark',
  autoScan: false,
  showNotifications: true,
  splitScreenMode: false,
  detection: {
    disabledObservableTypes: [],
    disabledOpenCTITypes: [],
    disabledOpenAEVTypes: [],
  },
  ai: {},
};
