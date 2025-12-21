/**
 * Marking Helpers
 * Utility functions for TLP/PAP marking colors
 */

/**
 * Get marking definition color (fallback when x_opencti_color is not present)
 */
export const getMarkingColor = (definition: string | undefined, mode: 'dark' | 'light' = 'dark'): string => {
  if (!definition) return '#ffffff';
  switch (definition) {
    case 'TLP:RED':
    case 'PAP:RED':
    case 'CD':
    case 'CD-SF':
    case 'DR':
    case 'DR-SF':
      return '#c62828';
    case 'TLP:AMBER':
    case 'TLP:AMBER+STRICT':
    case 'PAP:AMBER':
      return '#d84315';
    case 'TLP:GREEN':
    case 'PAP:GREEN':
    case 'NP':
      return '#2e7d32';
    case 'TLP:CLEAR':
    case 'TLP:WHITE':
    case 'PAP:CLEAR':
      return mode === 'dark' ? '#ffffff' : '#2b2b2b';
    case 'SF':
      return '#283593';
    default:
      return '#ffffff';
  }
};

/**
 * Get marking chip style for consistent display
 */
export const getMarkingChipStyle = (definition: string | undefined, mode: 'dark' | 'light' = 'dark'): { bgcolor: string; color: string; fontWeight: number } => {
  const bgcolor = getMarkingColor(definition, mode);
  const isClearMarking = definition === 'TLP:CLEAR' || definition === 'TLP:WHITE' || definition === 'PAP:CLEAR';
  const color = isClearMarking ? (mode === 'dark' ? '#000000' : '#ffffff') : '#ffffff';
  return { bgcolor, color, fontWeight: 600 };
};

