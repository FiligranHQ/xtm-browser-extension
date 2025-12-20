/**
 * Types for the popup UI
 */

import type { PlatformType } from '../shared/platform/registry';

/**
 * Connection status for a single platform instance
 */
export interface PlatformStatus {
  id: string;
  name: string;
  url: string;
  connected: boolean;
  version?: string;
  userName?: string;
  isEnterprise?: boolean;
  /** Platform type for identification */
  platformType?: PlatformType;
}

/**
 * Connection status organized by platform type
 * When adding a new platform, add its key here
 */
export interface ConnectionStatus {
  opencti: PlatformStatus[];
  openaev: PlatformStatus[];
  // Add new platforms here as they are integrated:
  // opengrc: PlatformStatus[];
}

/**
 * Setup wizard step
 */
export type SetupStep = 'welcome' | 'opencti' | 'openaev' | 'complete';

/**
 * Props for platform setup form
 */
export interface PlatformSetupFormProps {
  platformType: 'opencti' | 'openaev';
  logoSuffix: string;
  url: string;
  token: string;
  showToken: boolean;
  testing: boolean;
  error: string | null;
  success: boolean;
  onUrlChange: (url: string) => void;
  onTokenChange: (token: string) => void;
  onToggleShowToken: () => void;
  onConnect: () => void;
  onSkip: () => void;
}

/**
 * Props for the welcome screen
 */
export interface WelcomeScreenProps {
  logoSuffix: string;
  onGetStarted: () => void;
  onOpenSettings: () => void;
}

/**
 * Props for the EE trial dialog
 */
export interface EETrialDialogProps {
  open: boolean;
  mode: 'dark' | 'light';
  onClose: () => void;
  onStartTrial: () => void;
}
