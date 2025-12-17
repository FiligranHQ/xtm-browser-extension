/**
 * EmptyView - Displayed when no entity is selected
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { SearchOutlined } from '@mui/icons-material';

export const CommonEmptyView: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 300,
      color: 'text.secondary',
      textAlign: 'center',
      p: 3,
    }}
  >
    <SearchOutlined sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
    <Typography variant="body1" sx={{ mb: 1 }}>No entity selected</Typography>
    <Typography variant="body2">
      Click on a highlighted entity or use the search to get started.
    </Typography>
  </Box>
);

export default CommonEmptyView;
