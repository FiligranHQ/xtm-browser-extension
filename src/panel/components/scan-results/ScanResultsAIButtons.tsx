/**
 * Scan Results AI Buttons Component
 * 
 * Renders AI discovery buttons for entities, relationships, and scan all.
 */

import React from 'react';
import {
  Box,
  Button,
  IconButton,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  AutoAwesomeOutlined,
  PlaylistAddCheckOutlined,
} from '@mui/icons-material';
import { hexToRGB } from '../../../shared/theme/colors';
import type { PlatformInfo, PanelAIState } from '../../types/panel-types';
import type { ScanResultEntity } from '../../../shared/types/scan';

interface ScanResultsAIButtonsProps {
  aiSettings: PanelAIState;
  aiColors: { main: string; dark: string; light: string };
  availablePlatforms: PlatformInfo[];
  scanResultsEntities: ScanResultEntity[];
  aiDiscoveringEntities: boolean;
  aiResolvingRelationships: boolean;
  scanAllRunning: boolean;
  onDiscoverEntities: () => void;
  onDiscoverRelationships: () => void;
  onScanAll: () => void;
}

export const ScanResultsAIButtons: React.FC<ScanResultsAIButtonsProps> = ({
  aiSettings,
  aiColors,
  availablePlatforms,
  scanResultsEntities,
  aiDiscoveringEntities,
  aiResolvingRelationships,
  scanAllRunning,
  onDiscoverEntities,
  onDiscoverRelationships,
  onScanAll,
}) => {
  const hasEnterprisePlatform = availablePlatforms.some(p => p.isEnterprise);
  // Count OpenCTI-eligible entities (not oaev-* types)
  const octiEligibleEntities = scanResultsEntities.filter(e => !e.type.startsWith('oaev-'));
  
  const isEntitiesButtonDisabled = aiDiscoveringEntities || aiResolvingRelationships || !aiSettings.available || !hasEnterprisePlatform;
  const isRelationshipsButtonDisabled = aiResolvingRelationships || aiDiscoveringEntities || !aiSettings.available || !hasEnterprisePlatform || octiEligibleEntities.length < 2;
  const isScanAllDisabled = aiDiscoveringEntities || aiResolvingRelationships || !aiSettings.available || !hasEnterprisePlatform;

  let entitiesToolipMessage = 'Use AI to find additional entities';
  if (aiDiscoveringEntities) {
    entitiesToolipMessage = 'Analyzing page content...';
  } else if (!aiSettings.available) {
    entitiesToolipMessage = 'AI is not configured. Go to Settings → Agentic AI to enable.';
  } else if (!hasEnterprisePlatform) {
    entitiesToolipMessage = 'Requires at least one Enterprise Edition platform';
  }

  let relationshipsTooltipMessage = 'Use AI to discover relationships between entities';
  if (aiResolvingRelationships) {
    relationshipsTooltipMessage = 'Analyzing relationships...';
  } else if (!aiSettings.available) {
    relationshipsTooltipMessage = 'AI is not configured. Go to Settings → Agentic AI to enable.';
  } else if (!hasEnterprisePlatform) {
    relationshipsTooltipMessage = 'Requires at least one Enterprise Edition platform';
  } else if (octiEligibleEntities.length < 2) {
    relationshipsTooltipMessage = 'Need at least 2 OpenCTI entities to discover relationships';
  }

  let scanAllTooltipMessage = 'Use AI to discover both entities and relationships at once';
  if (aiDiscoveringEntities || aiResolvingRelationships) {
    scanAllTooltipMessage = 'Analyzing...';
  } else if (!aiSettings.available) {
    scanAllTooltipMessage = 'AI is not configured. Go to Settings → Agentic AI to enable.';
  } else if (!hasEnterprisePlatform) {
    scanAllTooltipMessage = 'Requires at least one Enterprise Edition platform';
  }

  const buttonSx = {
    textTransform: 'none',
    fontSize: '0.75rem',
    py: 0.6,
    px: 1,
    borderColor: aiColors.main,
    color: aiColors.main,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    '& .MuiButton-startIcon': {
      marginRight: 0.5,
      flexShrink: 0,
    },
    '&:hover': {
      borderColor: aiColors.dark,
      bgcolor: hexToRGB(aiColors.main, 0.08),
    },
    '&.Mui-disabled': {
      borderColor: hexToRGB(aiColors.main, 0.3),
      color: hexToRGB(aiColors.main, 0.5),
    },
  };

  return (
    <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'stretch' }}>
      <Tooltip title={entitiesToolipMessage} placement="top">
        <span style={{ flex: 1, minWidth: 0 }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={onDiscoverEntities}
            disabled={isEntitiesButtonDisabled}
            startIcon={aiDiscoveringEntities ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeOutlined sx={{ fontSize: '1rem' }} />}
            sx={buttonSx}
          >
            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {aiDiscoveringEntities ? 'Scanning...' : 'Entities (AI)'}
            </Box>
          </Button>
        </span>
      </Tooltip>
      <Tooltip title={relationshipsTooltipMessage} placement="top">
        <span style={{ flex: 1, minWidth: 0 }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={onDiscoverRelationships}
            disabled={isRelationshipsButtonDisabled}
            startIcon={aiResolvingRelationships ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeOutlined sx={{ fontSize: '1rem' }} />}
            sx={buttonSx}
          >
            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {aiResolvingRelationships ? 'Scanning...' : 'Relations (AI)'}
            </Box>
          </Button>
        </span>
      </Tooltip>
      <Tooltip title={scanAllTooltipMessage} placement="top">
        <span style={{ display: 'flex' }}>
          <IconButton
            onClick={onScanAll}
            disabled={isScanAllDisabled}
            sx={{
              border: 1,
              borderColor: aiColors.main,
              color: aiColors.main,
              borderRadius: 1,
              px: 1,
              py: 0.6,
              '&:hover': {
                borderColor: aiColors.dark,
                bgcolor: hexToRGB(aiColors.main, 0.08),
              },
              '&.Mui-disabled': {
                borderColor: hexToRGB(aiColors.main, 0.3),
                color: hexToRGB(aiColors.main, 0.5),
              },
            }}
          >
            {scanAllRunning ? <CircularProgress size={14} color="inherit" /> : <PlaylistAddCheckOutlined sx={{ fontSize: '1.1rem' }} />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};

export default ScanResultsAIButtons;

