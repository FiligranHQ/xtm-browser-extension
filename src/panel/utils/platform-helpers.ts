/**
 * Platform Helper Functions
 * 
 * Utilities for working with platform icons, colors, and multi-platform operations.
 */

import React from 'react';
import { MicrosoftWindows, Linux, Apple, Android } from 'mdi-material-ui';
import { ComputerOutlined } from '@mui/icons-material';
import type { PlatformInfo } from '../types';
// MultiPlatformResult imported for type reference but not currently used in all functions

/**
 * Get platform icon component based on platform name
 */
export const getPlatformIcon = (
  platform: string, 
  size: 'small' | 'medium' = 'small'
): React.ReactElement => {
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
 * Get platform color based on platform name
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
 * Sort multi-platform results with OpenCTI platforms first
 * OpenCTI is the knowledge base reference, so it should always be displayed first
 */
export const sortPlatformResults = <T extends { platformId: string }>(
  results: T[],
  availablePlatforms: PlatformInfo[]
): T[] => {
  return [...results].sort((a, b) => {
    const platformA = availablePlatforms.find(p => p.id === a.platformId);
    const platformB = availablePlatforms.find(p => p.id === b.platformId);
    const typeA = platformA?.type || 'opencti';
    const typeB = platformB?.type || 'opencti';
    
    // OpenCTI platforms should come before OpenAEV (and other platforms)
    if (typeA === 'opencti' && typeB !== 'opencti') return -1;
    if (typeA !== 'opencti' && typeB === 'opencti') return 1;
    
    // Within the same platform type, maintain original order (stable sort)
    return 0;
  });
};

/**
 * Get platform logo path based on platform type
 */
export const getPlatformLogoPath = (
  platformType: 'opencti' | 'openaev',
  logoSuffix: string
): string => {
  return `../assets/logos/logo_${platformType}_${logoSuffix}_embleme_square.svg`;
};

/**
 * Get platform display name
 */
export const getPlatformDisplayName = (platformType: 'opencti' | 'openaev'): string => {
  return platformType === 'openaev' ? 'OpenAEV' : 'OpenCTI';
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

