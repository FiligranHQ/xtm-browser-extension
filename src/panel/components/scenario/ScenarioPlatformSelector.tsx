/**
 * Scenario Platform Selector
 * 
 * Component for selecting an OpenAEV platform when creating a scenario.
 * Shows available platforms with attack pattern counts.
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
} from '@mui/material';
import {
  ChevronLeftOutlined,
} from '@mui/icons-material';
import type { PlatformInfo, PanelMode } from '../../types/panel-types';

interface ScenarioPlatformSelectorProps {
  mode: 'dark' | 'light';
  openaevPlatforms: PlatformInfo[];
  openaevLogoPath: string;
  scenarioRawAttackPatterns: Array<{ platformId?: string }>;
  onSelectPlatform: (platformId: string) => void;
  setPanelMode: React.Dispatch<React.SetStateAction<PanelMode>>;
}

export const ScenarioPlatformSelector: React.FC<ScenarioPlatformSelectorProps> = ({
  openaevPlatforms,
  openaevLogoPath,
  scenarioRawAttackPatterns,
  onSelectPlatform,
  setPanelMode,
}) => {
  // Count attack patterns per platform
  const patternCountByPlatform = new Map<string, number>();
  for (const ap of scenarioRawAttackPatterns) {
    if (ap.platformId) {
      patternCountByPlatform.set(ap.platformId, (patternCountByPlatform.get(ap.platformId) || 0) + 1);
    }
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Back to actions button */}
      <Box sx={{ mb: 1.5 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={() => setPanelMode('empty')}
          sx={{ 
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          Back to actions
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
        <Typography variant="h6" sx={{ fontSize: 16, flex: 1, fontWeight: 600 }}>Create Scenario</Typography>
      </Box>
      
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Select OpenAEV platform to create the scenario:
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {openaevPlatforms.map((platform) => {
          const patternCount = patternCountByPlatform.get(platform.id) || 0;
          return (
            <Paper
              key={platform.id}
              onClick={() => onSelectPlatform(platform.id)}
              elevation={0}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 2,
                cursor: 'pointer',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
              }}
            >
              <img src={openaevLogoPath} alt="OpenAEV" style={{ width: 24, height: 24 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {platform.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {new URL(platform.url).hostname}
                </Typography>
              </Box>
              {patternCount > 0 && (
                <Chip 
                  label={`${patternCount} pattern${patternCount !== 1 ? 's' : ''}`} 
                  size="small"
                  sx={{ height: 20, fontSize: 11 }}
                />
              )}
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
};

export default ScenarioPlatformSelector;

