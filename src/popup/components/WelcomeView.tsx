/**
 * WelcomeView Component
 * 
 * Welcome splash when no platforms are configured
 */

import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { ChevronRightOutlined } from '@mui/icons-material';

interface WelcomeViewProps {
  logoSuffix: string;
  onGetStarted: () => void;
  onOpenSettings: () => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  logoSuffix,
  onGetStarted,
  onOpenSettings,
}) => (
  <Box
    sx={{
      p: 3,
      textAlign: 'center',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}
  >
    <Box sx={{ mb: 2 }}>
      <img
        src={`../assets/logos/logo_filigran_${logoSuffix}_full-with-text_rectangle.svg`}
        alt="Filigran"
        width={150}
        style={{ opacity: 0.9 }}
      />
    </Box>
    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
      Welcome to XTM
    </Typography>
    <Typography
      variant="body2"
      sx={{ color: 'text.secondary', mb: 3, lineHeight: 1.6 }}
    >
      Connect to your platforms to start scanning pages for threats.
    </Typography>
    <Button
      variant="contained"
      endIcon={<ChevronRightOutlined />}
      onClick={onGetStarted}
      sx={{ borderRadius: 1, mb: 1.5 }}
      fullWidth
    >
      Get Started
    </Button>
    <Button
      variant="text"
      size="small"
      onClick={onOpenSettings}
      sx={{ color: 'text.secondary' }}
    >
      Advanced Settings
    </Button>
  </Box>
);

export default WelcomeView;

