/**
 * Platform Helpers
 * Utility functions for platform-related operations in the panel
 */

import React from 'react';
import {
  ComputerOutlined,
} from '@mui/icons-material';
import { MicrosoftWindows, Linux, Apple, Android } from 'mdi-material-ui';
import { THEME_DARK_AI } from '../../shared/theme/ThemeDark';
import { THEME_LIGHT_AI } from '../../shared/theme/ThemeLight';
import type { MultiPlatformResult } from '../types';

/**
 * Get AI color based on theme mode
 */
export const getAiColor = (mode: 'dark' | 'light') => {
  return mode === 'dark' ? THEME_DARK_AI : THEME_LIGHT_AI;
};

/**
 * Get platform icon component
 */
export const getPlatformIcon = (platform: string, size: 'small' | 'medium' = 'small') => {
  const iconSize = size === 'small' ? 14 : 18;
  const platformLower = platform.toLowerCase();
  
  switch (platformLower) {
    case 'windows':
      return <MicrosoftWindows sx={{ fontSize: iconSize }} />;
    case 'linux':
      return <Linux sx={{ fontSize: iconSize }} />;
    case 'macos':
    case 'darwin':
      return <Apple sx={{ fontSize: iconSize }} />;
    case 'android':
      return <Android sx={{ fontSize: iconSize }} />;
    default:
      return <ComputerOutlined sx={{ fontSize: iconSize }} />;
  }
};

/**
 * Get platform color
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
 * Sort platform results - OpenCTI platforms first (knowledge base reference)
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
 * Get platform type color for chips/badges
 */
export const getPlatformTypeColor = (platformType: 'opencti' | 'openaev' | string): string => {
  switch (platformType) {
    case 'opencti':
      return '#0fbcff';
    case 'openaev':
      return '#ff9800';
    default:
      return '#757575';
  }
};

/**
 * Format platform name for display
 */
export const formatPlatformName = (platformType: 'opencti' | 'openaev' | string): string => {
  switch (platformType) {
    case 'opencti':
      return 'OpenCTI';
    case 'openaev':
      return 'OpenAEV';
    default:
      return platformType;
  }
};

