/**
 * Marking Helpers
 * Utility functions for TLP/PAP marking colors
 */

import {
  MARKING_COLORS,
  MARKING_CLEAR_COLORS,
  TEXT_COLORS,
} from '../../shared/constants';

/**
 * Get marking definition color (fallback when x_opencti_color is not present)
 */
export const getMarkingColor = (definition: string | undefined, mode: 'dark' | 'light' = 'dark'): string => {
  if (!definition) return MARKING_COLORS.default;
  switch (definition) {
    case 'TLP:RED':
    case 'PAP:RED':
    case 'CD':
    case 'CD-SF':
    case 'DR':
    case 'DR-SF':
      return MARKING_COLORS.red;
    case 'TLP:AMBER':
    case 'TLP:AMBER+STRICT':
    case 'PAP:AMBER':
      return MARKING_COLORS.amber;
    case 'TLP:GREEN':
    case 'PAP:GREEN':
    case 'NP':
      return MARKING_COLORS.green;
    case 'TLP:CLEAR':
    case 'TLP:WHITE':
    case 'PAP:CLEAR':
      return mode === 'dark' ? MARKING_CLEAR_COLORS.dark.bgcolor : MARKING_CLEAR_COLORS.light.bgcolor;
    case 'SF':
      return MARKING_COLORS.blue;
    default:
      return MARKING_COLORS.default;
  }
};

/**
 * Get marking chip style for consistent display
 */
export const getMarkingChipStyle = (definition: string | undefined, mode: 'dark' | 'light' = 'dark'): { bgcolor: string; color: string; fontWeight: number } => {
  const bgcolor = getMarkingColor(definition, mode);
  const isClearMarking = definition === 'TLP:CLEAR' || definition === 'TLP:WHITE' || definition === 'PAP:CLEAR';
  const color = isClearMarking 
    ? (mode === 'dark' ? MARKING_CLEAR_COLORS.dark.color : MARKING_CLEAR_COLORS.light.color) 
    : TEXT_COLORS.onDark;
  return { bgcolor, color, fontWeight: 600 };
};
