/**
 * Appearance Tab Component
 * Configuration for theme and visual settings
 */
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Divider,
} from '@mui/material';
import {
  LightModeOutlined,
  DarkModeOutlined,
  RestartAltOutlined,
} from '@mui/icons-material';
import type { ExtensionSettings } from '../../shared/types/settings';

interface AppearanceTabProps {
  settings: ExtensionSettings;
  onSetTheme: (theme: 'auto' | 'dark' | 'light') => void;
  onResetAppearance: () => void;
  onSave: () => void;
}

const AppearanceTab: React.FC<AppearanceTabProps> = ({
  settings,
  onSetTheme,
  onResetAppearance,
  onSave,
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Appearance</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Customize the extension's appearance
      </Typography>

      <Box sx={{ flex: 1 }}>
        <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Theme</Typography>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            {[
              { value: 'dark', label: 'Dark', icon: <DarkModeOutlined /> },
              { value: 'light', label: 'Light', icon: <LightModeOutlined /> },
            ].map((item) => (
              <Paper
                key={item.value}
                onClick={() => onSetTheme(item.value as 'dark' | 'light')}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  p: 2,
                  cursor: 'pointer',
                  border: 2,
                  borderColor: settings.theme === item.value ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  bgcolor: settings.theme === item.value ? 'action.selected' : 'transparent',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: item.value === 'dark' ? '#1a1a2e' : '#e8e8e8',
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {item.label}
                </Typography>
              </Paper>
            ))}
          </Box>
          
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 2, display: 'block' }}>
            Choose your preferred color theme for the extension panel.
          </Typography>
        </Paper>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          variant="outlined"
          color="warning"
          startIcon={<RestartAltOutlined />}
          onClick={onResetAppearance}
        >
          Reset to Default
        </Button>
        <Button variant="contained" onClick={onSave}>
          Save Appearance
        </Button>
      </Box>
    </Box>
  );
};

export default AppearanceTab;

