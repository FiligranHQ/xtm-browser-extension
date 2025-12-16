/**
 * Platform Select View Component
 * 
 * Allows user to select a platform for container creation or entity import.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  ChevronRightOutlined,
  CheckCircleOutlined,
} from '@mui/icons-material';
import { hexToRGB } from '../../shared/theme/colors';
import type { PanelMode, PlatformInfo } from '../types';

export interface PlatformSelectViewProps {
  mode: 'dark' | 'light';
  setPanelMode: (mode: PanelMode) => void;
  openctiPlatforms: PlatformInfo[];
  selectedPlatformId: string;
  setSelectedPlatformId: (id: string) => void;
  setPlatformUrl: (url: string) => void;
  containerWorkflowOrigin: 'preview' | 'direct' | 'import' | null;
  logoSuffix: string;
}

export const PlatformSelectView: React.FC<PlatformSelectViewProps> = ({
  mode: _mode,
  setPanelMode,
  openctiPlatforms,
  selectedPlatformId,
  setSelectedPlatformId,
  setPlatformUrl,
  containerWorkflowOrigin,
  logoSuffix,
}) => {
  const handleBack = () => {
    if (containerWorkflowOrigin === 'preview' || containerWorkflowOrigin === 'import') {
      setPanelMode('preview');
    } else {
      setPanelMode('scan-results');
    }
  };

  const handleSelectPlatform = (platform: PlatformInfo) => {
    setSelectedPlatformId(platform.id);
    setPlatformUrl(platform.url);
    
    // Navigate based on workflow origin
    if (containerWorkflowOrigin === 'import') {
      // Import without container flow - just select platform
      setPanelMode('preview');
    } else {
      // Container creation flow
      setPanelMode('container-type');
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Back button */}
      <Box sx={{ mb: 1.5 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={handleBack}
          sx={{
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          Back
        </Button>
      </Box>

      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Select Platform
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Choose the OpenCTI platform for your {containerWorkflowOrigin === 'import' ? 'import' : 'container'}
      </Typography>

      {/* Platform options */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {openctiPlatforms.map((platform) => {
          const isSelected = platform.id === selectedPlatformId;
          
          return (
            <Paper
              key={platform.id}
              elevation={0}
              onClick={() => handleSelectPlatform(platform)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                cursor: 'pointer',
                borderRadius: 1,
                border: 2,
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? hexToRGB('#1976d2', 0.05) : 'transparent',
                transition: 'all 0.15s',
                '&:hover': {
                  bgcolor: isSelected ? hexToRGB('#1976d2', 0.08) : 'action.hover',
                  borderColor: isSelected ? 'primary.main' : 'primary.light',
                },
              }}
            >
              {/* Platform logo */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  flexShrink: 0,
                }}
              >
                <img
                  src={typeof chrome !== 'undefined' && chrome.runtime?.getURL
                    ? chrome.runtime.getURL(`assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`)
                    : `../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`
                  }
                  alt="OpenCTI"
                  width={28}
                  height={28}
                />
              </Box>
              
              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {platform.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                  {platform.url}
                </Typography>
                {platform.isEnterprise && (
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 500 }}>
                    Enterprise Edition
                  </Typography>
                )}
              </Box>
              
              {isSelected ? (
                <CheckCircleOutlined sx={{ color: 'primary.main' }} />
              ) : (
                <ChevronRightOutlined sx={{ color: 'text.secondary' }} />
              )}
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
};

export default PlatformSelectView;

