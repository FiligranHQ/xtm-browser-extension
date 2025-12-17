/**
 * About Tab Component
 * Information about the extension and reset settings
 */
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  Divider,
} from '@mui/material';
import {
  DescriptionOutlined,
  PublicOutlined,
  DeleteOutlined,
  GitHub,
} from '@mui/icons-material';

interface AboutTabProps {
  mode: 'dark' | 'light';
  onResetAllSettings: () => void;
}

const AboutTab: React.FC<AboutTabProps> = ({
  mode,
  onResetAllSettings,
}) => {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>About</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Filigran Threat Management Extension
      </Typography>

      <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 2 }}>
          <img
            src={`../assets/logos/logo_filigran_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
            alt="Filigran"
            width={40}
            height={40}
          />
          <Box sx={{ textAlign: 'left' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              Filigran
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Threat Management
            </Typography>
          </Box>
          <Chip label="v0.0.5" size="small" sx={{ ml: 1 }} />
        </Box>

        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 400, mx: 'auto' }}>
          A powerful browser extension for threat intelligence scanning with OpenCTI and attack surface validation with OpenAEV.
        </Typography>

        <Divider sx={{ my: 3 }} />

        {/* Links as horizontal tiles */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, textAlign: 'left' }}>Links</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
          <Paper
            component="a"
            href="https://github.com/FiligranHQ/xtm-browser-extension/tree/main/docs"
            target="_blank"
            elevation={0}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              textDecoration: 'none',
              transition: 'all 0.2s',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.main',
                transform: 'translateY(-2px)',
                boxShadow: 2,
              },
            }}
          >
            <DescriptionOutlined sx={{ fontSize: 28, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Documentation
            </Typography>
          </Paper>
          <Paper
            component="a"
            href="https://github.com/FiligranHQ/xtm-browser-extension"
            target="_blank"
            elevation={0}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              textDecoration: 'none',
              transition: 'all 0.2s',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.main',
                transform: 'translateY(-2px)',
                boxShadow: 2,
              },
            }}
          >
            <GitHub sx={{ fontSize: 28, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              GitHub
            </Typography>
          </Paper>
          <Paper
            component="a"
            href="https://filigran.io"
            target="_blank"
            elevation={0}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              textDecoration: 'none',
              transition: 'all 0.2s',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.main',
                transform: 'translateY(-2px)',
                boxShadow: 2,
              },
            }}
          >
            <PublicOutlined sx={{ fontSize: 28, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Filigran.io
            </Typography>
          </Paper>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          © 2025 Filigran. Licensed under Apache 2.0.
        </Typography>
      </Paper>

      {/* Reset All Settings */}
      <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Reset Settings</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Clear all settings and connections to start fresh
        </Typography>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlined />}
          onClick={onResetAllSettings}
        >
          Reset All Settings
        </Button>
      </Paper>
    </Box>
  );
};

export default AboutTab;

