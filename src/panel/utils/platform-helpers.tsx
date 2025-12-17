/**
 * Platform Helpers
 * Consolidated utility functions for platform-related operations in the panel.
 * 
 * Includes:
 * - AI theme colors
 * - Platform icons and colors
 * - Platform sorting and filtering
 */

import React from 'react';
import { ComputerOutlined } from '@mui/icons-material';
import { MicrosoftWindows, Linux, Apple, Android } from 'mdi-material-ui';
import { THEME_DARK_AI } from '../../shared/theme/ThemeDark';
import { THEME_LIGHT_AI } from '../../shared/theme/ThemeLight';
import type { MultiPlatformResult, PlatformInfo } from '../types';

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
 */
export const getPlatformTypeColor = (platformType: 'opencti' | 'openaev' | 'opengrc' | string): string => {
  switch (platformType) {
    case 'opencti':
      return '#0fbcff';
    case 'openaev':
      return '#ff9800';
    case 'opengrc':
      return '#4caf50';
    default:
      return '#757575';
  }
};

// ============================================================================
// Platform Sorting & Filtering
// ============================================================================

/**
 * Sort multi-platform results with OpenCTI platforms first.
 * OpenCTI is the knowledge base reference, so it should always be displayed first.
 */
export const sortPlatformResults = (results: MultiPlatformResult[]): MultiPlatformResult[] => {
  return [...results].sort((a, b) => {
    const aIsOpenCTI = a.entity._platformType === 'opencti' || !a.entity._platformType;
    const bIsOpenCTI = b.entity._platformType === 'opencti' || !b.entity._platformType;
    if (aIsOpenCTI && !bIsOpenCTI) return -1;
    if (!aIsOpenCTI && bIsOpenCTI) return 1;
    return 0;
  });
};

/**
 * Filter platforms by type
 */
export const filterPlatformsByType = (
  platforms: PlatformInfo[],
  type: 'opencti' | 'openaev'
): PlatformInfo[] => {
  return platforms.filter(p => p.type === type);
};

/**
 * Check if any platform has Enterprise Edition
 */
export const hasEnterprisePlatform = (platforms: PlatformInfo[]): boolean => {
  return platforms.some(p => p.isEnterprise);
};

// ============================================================================
// Platform Display
// ============================================================================

import { 
  getPlatformName as getRegistryPlatformName,
  getPlatformLogoName,
  type PlatformType 
} from '../../shared/platform/registry';

/**
 * Get platform display name
 * @deprecated Use getPlatformName from registry instead
 */
export const getPlatformDisplayName = (platformType: PlatformType | string): string => {
  return getRegistryPlatformName(platformType);
};

/**
 * Format platform name for display
 */
export const formatPlatformName = (platformType: PlatformType | string): string => {
  return getRegistryPlatformName(platformType);
};

/**
 * Get platform logo path based on platform type and theme
 */
export const getPlatformLogoPath = (
  platformType: PlatformType | string,
  themeSuffix: string
): string => {
  const logoName = getPlatformLogoName(platformType);
  return `../assets/logos/logo_${logoName}_${themeSuffix}_embleme_square.svg`;
};

