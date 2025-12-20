/**
 * Platform Helpers
 * Consolidated utility functions for platform-related operations in the panel.
 * 
 * Includes:
 * - AI theme colors
 * - Platform icons and colors
 */

import React from 'react';
import { ComputerOutlined } from '@mui/icons-material';
import { MicrosoftWindows, Linux, Apple, Android } from 'mdi-material-ui';
import { THEME_DARK_AI } from '../../shared/theme/theme-dark';
import { THEME_LIGHT_AI } from '../../shared/theme/theme-light';

// ============================================================================
// AI Theme Colors
// ============================================================================

/**
 * Get AI color palette based on theme mode.
 * Returns the AI accent colors (purple theme) for consistent AI-related UI elements.
 */
export const getAiColor = (mode: 'dark' | 'light') => {
  return mode === 'dark' ? THEME_DARK_AI : THEME_LIGHT_AI;
};

// ============================================================================
// Platform Icons & Colors
// ============================================================================

/**
 * Get platform icon component (Windows, Linux, macOS, Android, etc.)
 */
export const getPlatformIcon = (platform: string, size: 'small' | 'medium' = 'small'): React.ReactElement => {
  const iconSize = size === 'small' ? 14 : 18;
  const platformLower = platform.toLowerCase();
  const iconProps = { sx: { fontSize: iconSize } };
  
  switch (platformLower) {
    case 'windows':
      return React.createElement(MicrosoftWindows, iconProps);
    case 'linux':
      return React.createElement(Linux, iconProps);
    case 'macos':
    case 'darwin':
      return React.createElement(Apple, iconProps);
    case 'android':
      return React.createElement(Android, iconProps);
    default:
      return React.createElement(ComputerOutlined, iconProps);
  }
};

/**
 * Get platform color for OS-specific styling
 */
export const getPlatformColor = (platform: string): string => {
  const platformLower = platform.toLowerCase();
  switch (platformLower) {
    case 'windows':
      return '#0078d4';
    case 'linux':
      return '#f57c00';
    case 'macos':
    case 'darwin':
      return '#7b1fa2';
    case 'android':
      return '#3ddc84';
    case 'ios':
      return '#a2aaad';
    case 'browser':
      return '#4285f4';
    default:
      return '#757575';
  }
};

/**
 * Get platform type color for OpenCTI/OpenAEV/OpenGRC chips and badges
 * Colors are chosen to be distinct from status colors (green=found, amber=new)
 * and from the primary theme color (blue/cyan)
 */
export const getPlatformTypeColor = (platformType: 'opencti' | 'openaev' | 'opengrc' | string): string => {
  switch (platformType) {
    case 'opencti':
      return '#5c6bc0'; // Indigo - distinct from green (found) and amber (new)
    case 'openaev':
      return '#e91e63'; // Pink - distinct from primary blue
    case 'opengrc':
      return '#ff9800'; // Orange
    default:
      return '#757575';
  }
};

// Note: For Filigran platform display (OpenCTI/OpenAEV names, logo paths),
// use the functions from '../../shared/platform/registry' directly
// Note: For platform sorting (sortPlatformResults), use the hook from useEntityState

// ============================================================================
// Platform Selection Flow Utilities
// ============================================================================

import type { PlatformInfo, PanelMode } from '../types/panel-types';

/**
 * Result of platform selection flow decision.
 * Used to determine which panel mode to navigate to and which platform to select.
 */
export interface PlatformSelectionResult {
  /** The panel mode to navigate to */
  panelMode: PanelMode;
  /** The platform to auto-select (if only one platform available) */
  selectedPlatform?: PlatformInfo;
}

/**
 * Determines the navigation flow for platform selection.
 * 
 * This consolidates the common pattern:
 * - If multiple platforms: go to platform-select
 * - If single platform: auto-select it and go to target mode
 * - If no platforms: go to target mode (will show error/empty state)
 * 
 * @param platforms - Array of available platforms to choose from
 * @param targetMode - The panel mode to navigate to after platform selection
 * @returns Object containing the panelMode to set and optional platform to auto-select
 * 
 * @example
 * ```tsx
 * const result = getPlatformSelectionFlow(openctiPlatforms, 'container-type');
 * if (result.selectedPlatform) {
 *   setSelectedPlatformId(result.selectedPlatform.id);
 *   setPlatformUrl(result.selectedPlatform.url);
 * }
 * setPanelMode(result.panelMode);
 * ```
 */
export function getPlatformSelectionFlow(
  platforms: PlatformInfo[],
  targetMode: PanelMode
): PlatformSelectionResult {
  if (platforms.length > 1) {
    return { panelMode: 'platform-select' };
  }
  
  if (platforms.length === 1) {
    return {
      panelMode: targetMode,
      selectedPlatform: platforms[0],
    };
  }
  
  // No platforms - proceed to target mode (component should handle this case)
  return { panelMode: targetMode };
}

/**
 * Applies the platform selection flow result.
 * Convenience function that handles setting platform state and navigation.
 * 
 * @param result - The result from getPlatformSelectionFlow
 * @param setSelectedPlatformId - State setter for platform ID
 * @param setPlatformUrl - State setter for platform URL
 * @param setPanelMode - State setter for panel mode
 */
export function applyPlatformSelectionFlow(
  result: PlatformSelectionResult,
  setSelectedPlatformId: (id: string) => void,
  setPlatformUrl: (url: string) => void,
  setPanelMode: (mode: PanelMode) => void
): void {
  if (result.selectedPlatform) {
    setSelectedPlatformId(result.selectedPlatform.id);
    setPlatformUrl(result.selectedPlatform.url);
  }
  setPanelMode(result.panelMode);
}