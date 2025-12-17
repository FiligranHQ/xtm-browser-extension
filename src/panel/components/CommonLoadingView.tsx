/**
 * LoadingView - Displayed when loading data
 */

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingViewProps {
  message?: string;
}

export const CommonLoadingView: React.FC<LoadingViewProps> = ({ message = 'Loading...' }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 200,
    }}
  >
    <CircularProgress size={40} />
    <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
      {message}
    </Typography>
  </Box>
);

export default CommonLoadingView;
