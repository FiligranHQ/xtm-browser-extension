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
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { ChevronLeftOutlined } from '@mui/icons-material';
import type { PanelMode, PlatformInfo, EntityData } from '../types';

export interface PlatformSelectViewProps {
  mode: 'dark' | 'light';
  setPanelMode: (mode: PanelMode) => void;
  openctiPlatforms: PlatformInfo[];
  selectedPlatformId: string;
  setSelectedPlatformId: (id: string) => void;
  setPlatformUrl: (url: string) => void;
  containerWorkflowOrigin: 'preview' | 'direct' | 'import' | null;
  setContainerWorkflowOrigin: (origin: 'preview' | 'direct' | 'import' | null) => void;
  containerSteps: string[];
  entitiesToAdd: EntityData[];
  handleAddEntities: () => void;
  logoSuffix: string;
}

export const CommonPlatformSelectView: React.FC<PlatformSelectViewProps> = ({
  mode,
  setPanelMode,
  openctiPlatforms,
  selectedPlatformId,
  setSelectedPlatformId,
  setPlatformUrl,
  containerWorkflowOrigin,
  setContainerWorkflowOrigin,
  containerSteps,
  entitiesToAdd,
  handleAddEntities,
  logoSuffix,
}) => {
  // Determine if back button should be shown
  // Show back if coming from preview mode (has entities selected) or from import workflow
  const showBackButton = (containerWorkflowOrigin === 'preview' || containerWorkflowOrigin === 'import') && entitiesToAdd.length > 0;
  const isImportWorkflow = containerWorkflowOrigin === 'import';

  return (
    <Box sx={{ p: 2 }}>
      {/* Stepper - only show for container creation, not import */}
      {!isImportWorkflow && (
        <Stepper activeStep={0} sx={{ mb: 3 }}>
          {containerSteps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      {/* Back button */}
      {showBackButton && (
        <Box sx={{ mb: 1.5 }}>
          <Button
            size="small"
            startIcon={<ChevronLeftOutlined />}
            onClick={() => setPanelMode('preview')}
            sx={{ 
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            Back to preview
          </Button>
        </Box>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6" sx={{ fontSize: 16 }}>Select Platform</Typography>
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {isImportWorkflow
          ? 'Choose which OpenCTI platform to import entities into:'
          : 'Choose which OpenCTI platform to create the container in:'
        }
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {openctiPlatforms.map((platform) => (
          <Paper
            key={platform.id}
            onClick={() => {
              setSelectedPlatformId(platform.id);
              setPlatformUrl(platform.url);
              if (isImportWorkflow) {
                // Import workflow - proceed with entity creation
                setContainerWorkflowOrigin(null);
                handleAddEntities();
              } else {
                // Container workflow - go to type selection
                setPanelMode('container-type');
              }
            }}
            elevation={0}
            sx={{
              p: 2,
              cursor: 'pointer',
              border: 2,
              borderColor: selectedPlatformId === platform.id ? 'primary.main' : 'divider',
              borderRadius: 1,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            <img
              src={typeof chrome !== 'undefined' && chrome.runtime?.getURL
                ? chrome.runtime.getURL(`assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`)
                : `../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`
              }
              alt="OpenCTI"
              style={{ width: 32, height: 32 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {platform.name}
                </Typography>
                {platform.isEnterprise !== undefined && (
                  <Box
                    sx={{
                      px: 0.5,
                      py: 0.1,
                      borderRadius: 0.5,
                      fontSize: '9px',
                      fontWeight: 700,
                      lineHeight: 1.3,
                      bgcolor: platform.isEnterprise
                        ? (mode === 'dark' ? '#00f1bd' : '#0c7e69')
                        : '#616161',
                      color: platform.isEnterprise ? '#000' : '#fff',
                    }}
                  >
                    {platform.isEnterprise ? 'EE' : 'CE'}
                  </Box>
                )}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                {platform.url} {platform.version ? `• v${platform.version}` : ''}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

export default CommonPlatformSelectView;
