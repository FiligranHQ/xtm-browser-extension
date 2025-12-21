/**
 * Hook for entity display utilities
 */

import { useMemo } from 'react';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import {
  isObservableType,
  isIndicatorType,
  isVulnerabilityType,
  getOAEVEntityColor,
} from '../../shared/utils/entity';
import { TEXT_COLORS } from '../../shared/constants';
import type { PlatformType } from '../../shared/platform/registry';

export interface EntityDisplayInfo {
  color: string;
  isObservable: boolean;
  isIndicator: boolean;
  isVulnerability: boolean;
  displayType: string;
}

/**
 * Get display information for an entity based on its type
 */
export function useEntityDisplay(
  type: string,
  platformType: PlatformType = 'opencti'
): EntityDisplayInfo {
  return useMemo(() => {
    // For OpenAEV entities, use platform-specific colors
    if (platformType === 'openaev') {
      const oaevType = type.replace('oaev-', '');
      return {
        color: getOAEVEntityColor(oaevType),
        isObservable: false,
        isIndicator: false,
        isVulnerability: false,
        displayType: oaevType.replace(/([A-Z])/g, ' $1').trim(),
      };
    }

    // For OpenCTI entities
    const isObservable = isObservableType(type);
    const isIndicator = isIndicatorType(type);
    const isVulnerability = isVulnerabilityType(type);
    const color = itemColor(type);
    const displayType = type.replace(/-/g, ' ');

    return {
      color,
      isObservable,
      isIndicator,
      isVulnerability,
      displayType,
    };
  }, [type, platformType]);
}

/**
 * Generate background color with transparency
 */
export function useEntityBackground(color: string, opacity: number = 0.2): string {
  return useMemo(() => hexToRGB(color, opacity), [color, opacity]);
}

/**
 * Common section title style
 */
export const sectionTitleStyle = {
  display: 'block',
  color: 'text.secondary',
  mb: 0.5,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

/**
 * Common content text style
 */
export function useContentTextStyle(mode: 'dark' | 'light') {
  return useMemo(() => ({
    color: mode === 'dark' ? TEXT_COLORS.primaryDark : 'text.primary',
    lineHeight: 1.6,
  }), [mode]);
}

/**
 * Get logo suffix based on theme mode
 */
export function useLogoSuffix(mode: 'dark' | 'light'): string {
  return mode === 'dark' ? 'dark-theme' : 'light-theme';
}

