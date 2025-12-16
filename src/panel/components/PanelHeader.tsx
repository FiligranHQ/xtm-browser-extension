/**
 * PanelHeader - Header component for the panel
 */

import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { CloseOutlined } from '@mui/icons-material';

interface PanelHeaderProps {
  mode: 'dark' | 'light';
  onClose: () => void;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ mode, onClose }) => {
  const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';
  
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <img
          src={`../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`}
          alt="XTM"
          width={28}
          height={28}
        />
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: 20, color: mode === 'dark' ? '#ffffff' : '#1a1a2e' }}>
            Filigran Threat Management
          </Typography>
        </Box>
      </Box>
      <IconButton size="small" onClick={onClose} sx={{ color: mode === 'dark' ? '#ffffff' : 'text.primary' }}>
        <CloseOutlined fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default PanelHeader;
