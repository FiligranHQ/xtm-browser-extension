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
 * Get marking definition background color for chips
 */
export const getMarkingChipStyle = (definition: string | undefined, mode: 'dark' | 'light' = 'dark') => {
  const color = getMarkingColor(definition, mode);
  const isClear = definition === 'TLP:CLEAR' || definition === 'TLP:WHITE' || definition === 'PAP:CLEAR';
  
  return {
    bgcolor: color,
    color: isClear ? (mode === 'dark' ? '#000000' : '#ffffff') : '#ffffff',
    fontWeight: 600,
    fontSize: '0.75rem',
  };
};

