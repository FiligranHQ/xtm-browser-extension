/**
 * Empty View Component
 * 
 * Displays when no entity is selected.
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { TravelExploreOutlined } from '@mui/icons-material';

interface EmptyViewProps {
  mode: 'dark' | 'light';
}

/**
 * Empty state view with scan prompt
 */
export const EmptyView: React.FC<EmptyViewProps> = ({ mode }) => {
  const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        p: 3,
        gap: 2,
      }}
    >
      <img
        src={`../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`}
        alt="XTM"
        width={64}
        height={64}
        style={{ opacity: 0.6 }}
      />
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 1, color: 'text.secondary' }}>
          Ready to Scan
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 280, lineHeight: 1.5 }}>
          Click the extension icon and select "Scan Page" to detect threat intelligence on this page.
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          mt: 1,
          px: 2,
          py: 1,
          borderRadius: 1,
          bgcolor: 'action.hover',
        }}
      >
        <TravelExploreOutlined sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Or use right-click → "Scan page for threats"
        </Typography>
      </Box>
    </Box>
  );
};

export default EmptyView;

