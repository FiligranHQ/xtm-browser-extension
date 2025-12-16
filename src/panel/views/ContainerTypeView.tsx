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
  Button,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  ChevronRightOutlined,
  DescriptionOutlined,
  ArticleOutlined,
  BugReportOutlined,
  AssessmentOutlined,
  GroupWorkOutlined,
} from '@mui/icons-material';
import { hexToRGB } from '../../shared/theme/colors';
import type { PanelMode } from '../types';

// Container type definitions
const CONTAINER_TYPES = [
  {
    id: 'report',
    name: 'Report',
    description: 'A threat intelligence report',
    icon: DescriptionOutlined,
    color: '#4caf50',
  },
  {
    id: 'note',
    name: 'Note',
    description: 'A simple analyst note',
    icon: ArticleOutlined,
    color: '#2196f3',
  },
  {
    id: 'case-incident',
    name: 'Incident Response',
    description: 'An incident response case',
    icon: BugReportOutlined,
    color: '#f44336',
  },
  {
    id: 'case-rfi',
    name: 'Request for Information',
    description: 'A request for information case',
    icon: AssessmentOutlined,
    color: '#ff9800',
  },
  {
    id: 'grouping',
    name: 'Grouping',
    description: 'A logical grouping of entities',
    icon: GroupWorkOutlined,
    color: '#9c27b0',
  },
];

export interface ContainerTypeViewProps {
  mode: 'dark' | 'light';
  setPanelMode: (mode: PanelMode) => void;
  setContainerType: (type: string) => void;
  containerWorkflowOrigin: 'preview' | 'direct' | 'import' | null;
  availablePlatformsCount: number;
}

export const ContainerTypeView: React.FC<ContainerTypeViewProps> = ({
  mode: _mode,
  setPanelMode,
  setContainerType,
  containerWorkflowOrigin,
  availablePlatformsCount,
}) => {
  const handleBack = () => {
    // Determine where to go back based on workflow origin
    if (containerWorkflowOrigin === 'preview') {
      setPanelMode('preview');
    } else if (availablePlatformsCount > 1) {
      setPanelMode('platform-select');
    } else {
      setPanelMode('scan-results');
    }
  };

  const handleSelectType = (typeId: string) => {
    setContainerType(typeId);
    setPanelMode('container-form');
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
        Select Container Type
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Choose the type of container to create for your entities
      </Typography>

      {/* Container type options */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {CONTAINER_TYPES.map((containerType) => {
          const Icon = containerType.icon;
          
          return (
            <Paper
              key={containerType.id}
              elevation={0}
              onClick={() => handleSelectType(containerType.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                cursor: 'pointer',
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
                transition: 'all 0.15s',
                '&:hover': {
                  bgcolor: hexToRGB(containerType.color, 0.08),
                  borderColor: containerType.color,
                },
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: 1,
                  bgcolor: hexToRGB(containerType.color, 0.15),
                  flexShrink: 0,
                }}
              >
                <Icon sx={{ color: containerType.color, fontSize: 24 }} />
              </Box>
              
              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {containerType.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {containerType.description}
                </Typography>
              </Box>
              
              <ChevronRightOutlined sx={{ color: 'text.secondary' }} />
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
};

export default ContainerTypeView;

