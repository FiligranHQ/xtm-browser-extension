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
import { THEME_DARK_AI } from '../../shared/theme/theme-dark';
import { THEME_LIGHT_AI } from '../../shared/theme/theme-light';
import type { MultiPlatformResult, PlatformInfo } from '../types/panel-types';

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

// ============================================================================
// Platform Sorting & Filtering
// ============================================================================

/**
 * Sort multi-platform results with OpenCTI platforms first.
 * OpenCTI is the knowledge base reference, so it should always be displayed first.
 */
export const sortPlatformResults = (results: MultiPlatformResult[]): MultiPlatformResult[] => {
  return [...results].sort((a, b) => {
    const aIsOpenCTI = a.entity.platformType === 'opencti' || !a.entity.platformType;
    const bIsOpenCTI = b.entity.platformType === 'opencti' || !b.entity.platformType;
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

// Note: For Filigran platform display (OpenCTI/OpenAEV names, logo paths),
// use the functions from '../../shared/platform/registry' directly
