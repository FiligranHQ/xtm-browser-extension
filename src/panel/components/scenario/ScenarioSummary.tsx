/**
 * Scenario Summary
 * 
 * Component for displaying a summary of selected injects in scenario creation.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import { LockPattern } from 'mdi-material-ui';

interface SelectedInject {
  attackPatternId: string;
  attackPatternName: string;
  contractId: string;
  contractLabel: string;
  delayMinutes: number;
}

interface ScenarioSummaryProps {
  selectedInjects: SelectedInject[];
  scenarioInjectSpacing: number;
  isTableTop: boolean;
}

export const ScenarioSummary: React.FC<ScenarioSummaryProps> = ({
  selectedInjects,
  scenarioInjectSpacing,
  isTableTop,
}) => {
  return (
    <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, mb: 2, flexShrink: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {isTableTop 
          ? `${selectedInjects.length} email notification${selectedInjects.length !== 1 ? 's' : ''} selected`
          : `${selectedInjects.length} inject${selectedInjects.length !== 1 ? 's' : ''} selected`
        }
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Total scenario duration: ~{selectedInjects.length > 0 ? (selectedInjects.length - 1) * scenarioInjectSpacing : 0} minutes
      </Typography>
    </Box>
  );
};

interface ScenarioInjectTimelineProps {
  selectedInjects: SelectedInject[];
  isTableTop: boolean;
}

export const ScenarioInjectTimeline: React.FC<ScenarioInjectTimelineProps> = ({
  selectedInjects,
  isTableTop,
}) => {
  if (selectedInjects.length === 0) return null;

  return (
    <Box sx={{ flexShrink: 0 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        {isTableTop ? 'Email Timeline' : 'Inject Timeline'}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {selectedInjects.map((inject, index) => (
          <Paper
            key={inject.attackPatternId}
            elevation={0}
            sx={{
              p: 1,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={`#${index + 1}`} size="small" sx={{ height: 18, fontSize: 10 }} />
              <LockPattern sx={{ fontSize: 16, color: '#d4e157' }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>{inject.attackPatternName}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>{inject.contractLabel}</Typography>
              </Box>
              <Chip label={`+${inject.delayMinutes}m`} size="small" sx={{ height: 18, fontSize: 10 }} />
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

export default ScenarioSummary;

