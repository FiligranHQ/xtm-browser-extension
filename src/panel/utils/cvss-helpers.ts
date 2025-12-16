/**
 * CVSS Helper Functions
 * 
 * Utilities for CVSS score display and styling.
 */

import type { SxProps } from '@mui/material';

/**
 * Get color for CVSS score - optimized for visibility in both modes
 */
export const getCvssColor = (score: number | undefined): string => {
  if (score === undefined || score === null) return '#607d8b';
  if (score === 0) return '#607d8b';
  if (score <= 3.9) return '#4caf50'; // Green - Low
  if (score <= 6.9) return '#ffb74d'; // Amber - Medium (lighter for dark mode)
  if (score <= 8.9) return '#ff7043'; // Orange - High
  return '#ef5350'; // Red - Critical
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
    color: '#ffffff',
    border: 'none',
    '& .MuiChip-icon': { color: '#ffffff' },
  };
};

/**
 * Get severity color and text style
 */
export const getSeverityColor = (severity: string | undefined): { bgcolor: string; color: string } => {
  switch (severity?.toLowerCase()) {
    case 'low':
      return { bgcolor: '#4caf50', color: '#ffffff' };
    case 'medium':
      return { bgcolor: '#5c7bf5', color: '#ffffff' };
    case 'high':
      return { bgcolor: '#ff9800', color: '#ffffff' };
    case 'critical':
      return { bgcolor: '#ef5350', color: '#ffffff' };
    default:
      return { bgcolor: '#607d8b', color: '#ffffff' };
  }
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
 * Format EPSS percentile
 */
export const formatEpssPercentile = (percentile: number | undefined): string => {
  if (percentile === undefined || percentile === null) return 'N/A';
  return `${(percentile * 100).toFixed(1)}%`;
};

