/**
 * Container Type View Component
 *
 * Allows user to select container type for entity import.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { ChevronLeftOutlined } from '@mui/icons-material';
import { hexToRGB } from '../../shared/theme/colors';
import ItemIcon from '../../shared/components/ItemIcon';
import type { PanelMode, EntityData } from '../types';

// Container type definitions
const CONTAINER_TYPES = [
  { type: 'Report', color: '#4a148c', description: 'Threat intelligence report' },
  { type: 'Grouping', color: '#689f38', description: 'Group related objects' },
  { type: 'Case-Incident', color: '#ad1457', description: 'Security incident' },
  { type: 'Case-Rfi', color: '#0c5c98', description: 'Request for information' },
];

export interface ContainerTypeViewProps {
  mode: 'dark' | 'light';
  setPanelMode: (mode: PanelMode) => void;
  setContainerType: (type: string) => void;
  containerWorkflowOrigin: 'preview' | 'direct' | 'import' | null;
  openctiPlatformsCount: number;
  containerSteps: string[];
  entitiesToAdd: EntityData[];
}

export const ContainerTypeView: React.FC<ContainerTypeViewProps> = ({
  mode: _mode,
  setPanelMode,
  setContainerType,
  containerWorkflowOrigin,
  openctiPlatformsCount,
  containerSteps,
  entitiesToAdd,
}) => {
  // Determine if we should show back button
  // Show back if: coming from preview, or if multi-platform (can go back to platform select)
  const canGoBack = containerWorkflowOrigin === 'preview' || openctiPlatformsCount > 1;

  const handleBack = () => {
    if (openctiPlatformsCount > 1) {
      setPanelMode('platform-select' as PanelMode);
    } else if (containerWorkflowOrigin === 'preview') {
      setPanelMode('preview');
    }
    // If direct workflow with single platform, don't navigate (button won't be shown anyway)
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Stepper */}
      <Stepper activeStep={openctiPlatformsCount > 1 ? 1 : 0} sx={{ mb: 3 }}>
        {containerSteps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {canGoBack && (
          <IconButton size="small" onClick={handleBack}>
            <ChevronLeftOutlined />
          </IconButton>
        )}
        <Typography variant="h6" sx={{ fontSize: 16 }}>Select Container Type</Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
        {CONTAINER_TYPES.map((item) => (
          <Paper
            key={item.type}
            onClick={() => {
              setContainerType(item.type);
              setPanelMode('container-form');
            }}
            elevation={0}
            sx={{
              p: 2,
              cursor: 'pointer',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              '&:hover': {
                borderColor: item.color,
                bgcolor: hexToRGB(item.color, 0.08),
              },
            }}
          >
            <Box sx={{ mb: 1 }}>
              <ItemIcon type={item.type} color={item.color} size="medium" />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {item.type.replace(/-/g, ' ')}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>
              {item.description}
            </Typography>
          </Paper>
        ))}
      </Box>

      {entitiesToAdd.length > 0 && (
        <Alert severity="success" sx={{ mt: 2, borderRadius: 1 }}>
          {entitiesToAdd.length} entit{entitiesToAdd.length === 1 ? 'y' : 'ies'} will be added to this container
        </Alert>
      )}
    </Box>
  );
};

export default ContainerTypeView;
