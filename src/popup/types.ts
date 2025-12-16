/**
 * Popup Types
 * 
 * Type definitions for the popup component
 */

import type { PlatformType } from '../shared/platform';

/**
 * Platform status for connection display
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
 * Setup wizard step types
 */
export type SetupStep = 'welcome' | 'opencti' | 'openaev' | 'complete';

/**
 * Action button props
 */
export interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  tooltip: string;
  onClick: () => void;
  color: string;
  disabled?: boolean;
  compact?: boolean;
}

