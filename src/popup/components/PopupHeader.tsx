/**
 * PopupHeader Component
 * 
 * Header section of the popup with logo and settings button
 */

import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { SettingsOutlined } from '@mui/icons-material';

interface PopupHeaderProps {
  logoSuffix: string;
  mode: 'dark' | 'light';
  onOpenSettings: () => void;
}

export const PopupHeader: React.FC<PopupHeaderProps> = ({
  logoSuffix,
  mode,
  onOpenSettings,
}) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      p: 2,
      pb: 1.5,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <img
        src={`../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`}
        alt="Filigran"
        width={32}
        height={32}
      />
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              fontSize: 18,
              color: mode === 'dark' ? '#ffffff' : 'text.primary',
            }}
          >
            Filigran Threat Management
          </Typography>
        </Box>
      </Box>
    </Box>
    <Tooltip title="Settings" arrow>
      <IconButton
        size="small"
        onClick={onOpenSettings}
        sx={{ color: 'primary.main' }}
      >
        <SettingsOutlined fontSize="small" />
      </IconButton>
    </Tooltip>
  </Box>
);

export default PopupHeader;

