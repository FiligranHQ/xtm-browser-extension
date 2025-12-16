/**
 * Loading View Component
 * 
 * Displays a centered loading spinner.
 */

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingViewProps {
  message?: string;
}

/**
 * Loading view with centered spinner
 */
export const LoadingView: React.FC<LoadingViewProps> = ({ message }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        minHeight: 200,
        gap: 2,
      }}
    >
      <CircularProgress size={40} />
      {message && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingView;

