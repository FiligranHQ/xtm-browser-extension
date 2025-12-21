/**
 * CVSS Helper Functions
 * 
 * Utilities for CVSS score display and styling.
 */

import type { SxProps } from '@mui/material';
import {
  CVSS_COLORS,
  SEVERITY_COLORS,
  TEXT_COLORS,
} from '../../shared/constants';

/**
 * Get color for CVSS score - optimized for visibility in both modes
 */
export const getCvssColor = (score: number | undefined): string => {
  if (score === undefined || score === null) return CVSS_COLORS.unknown;
  if (score === 0) return CVSS_COLORS.unknown;
  if (score <= 3.9) return CVSS_COLORS.low;
  if (score <= 6.9) return CVSS_COLORS.medium;
  if (score <= 8.9) return CVSS_COLORS.high;
  return CVSS_COLORS.critical;
};

/**
 * Get severity label from CVSS score
 */
export const getSeverityFromScore = (score: number | undefined): string => {
  if (score === undefined || score === null) return 'Unknown';
  if (score === 0) return 'None';
  if (score <= 3.9) return 'Low';
  if (score <= 6.9) return 'Medium';
  if (score <= 8.9) return 'High';
  return 'Critical';
};

/**
 * Format CVSS score for display
 */
export const formatCvssScore = (score: number | undefined): string => {
  if (score === undefined || score === null) return 'N/A';
  return score.toFixed(1);
};

/**
 * Format EPSS score as percentage
 */
export const formatEpssScore = (score: number | undefined): string => {
  if (score === undefined || score === null) return 'N/A';
  return `${(score * 100).toFixed(2)}%`;
};

/**
 * Format EPSS percentile as percentage
 */
export const formatEpssPercentile = (percentile: number | undefined): string => {
  if (percentile === undefined || percentile === null) return 'N/A';
  return `${(percentile * 100).toFixed(1)}%`;
};

/**
 * Get CVSS chip style for high visibility
 */
export const getCvssChipStyle = (score: number | undefined): SxProps => {
  const color = getCvssColor(score);
  return {
    fontWeight: 700,
    fontSize: 14,
    height: 34,
    bgcolor: color,
    color: TEXT_COLORS.onDark,
    border: 'none',
    '& .MuiChip-icon': { color: TEXT_COLORS.onDark },
  };
};

/**
 * Get severity color and text style
 */
export const getSeverityColor = (severity: string | undefined): { bgcolor: string; color: string } => {
  switch (severity?.toLowerCase()) {
    case 'low':
      return SEVERITY_COLORS.low;
    case 'medium':
      return SEVERITY_COLORS.medium;
    case 'high':
      return SEVERITY_COLORS.high;
    case 'critical':
      return SEVERITY_COLORS.critical;
    default:
      return SEVERITY_COLORS.unknown;
  }
};
