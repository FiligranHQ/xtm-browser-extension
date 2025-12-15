/**
 * Entity Type Badge Component
 * 
 * Displays a colored badge with icon and type name
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { hexToRGB } from '../../shared/theme/colors';

interface EntityTypeBadgeProps {
  type: string;
  color: string;
  icon: React.ReactNode;
}

/**
 * Entity type badge with icon
 */
export const EntityTypeBadge: React.FC<EntityTypeBadgeProps> = ({
  type,
  color,
  icon,
}) => {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        mb: 2,
        borderRadius: 1,
        bgcolor: hexToRGB(color, 0.2),
        border: `2px solid ${color}`,
      }}
    >
      {icon}
      <Typography 
        variant="body2" 
        sx={{ 
          fontWeight: 700, 
          color, 
          textTransform: 'capitalize', 
          letterSpacing: '0.5px' 
        }}
      >
        {type.replace(/-/g, ' ')}
      </Typography>
    </Box>
  );
};

export default EntityTypeBadge;

