/**
 * Add View Component
 *
 * Displays entities to be created in OpenCTI and provides confirmation.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
} from '@mui/material';
import { ChevronLeftOutlined } from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import type { PanelMode, EntityData } from '../types/panel-types';

export interface AddViewProps {
  setPanelMode: (mode: PanelMode) => void;
  entitiesToAdd: EntityData[];
  handleAddEntities: () => void;
  submitting: boolean;
  addFromNotFound: boolean;
  setAddFromNotFound: (fromNotFound: boolean) => void;
}

export const OCTIAddView: React.FC<AddViewProps> = ({
  setPanelMode,
  entitiesToAdd,
  handleAddEntities,
  submitting,
  addFromNotFound,
  setAddFromNotFound,
}) => {
  // Handle back navigation to entity overview
  const handleBackToEntity = () => {
    setAddFromNotFound(false);
    setPanelMode('not-found');
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Back to entity overview link */}
      {addFromNotFound && (
        <Box sx={{ mb: 1.5 }}>
          <Button
            size="small"
            startIcon={<ChevronLeftOutlined />}
            onClick={handleBackToEntity}
            sx={{
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            Back to entity overview
          </Button>
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>Add to OpenCTI</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        The following entities will be created:
      </Typography>

      <Box sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
        {entitiesToAdd.map((e, i) => (
          <Paper
            key={i}
            elevation={0}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              mb: 1,
              bgcolor: 'background.paper',
              borderRadius: 1,
            }}
          >
            <ItemIcon type={e.type} size="small" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                {e.value || e.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                {e.type?.replace(/-/g, ' ')}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          onClick={handleAddEntities}
          disabled={submitting}
          fullWidth
        >
          {submitting ? 'Creating...' : 'Create Entities'}
        </Button>
        <Button variant="outlined" onClick={() => {
          setAddFromNotFound(false);
          setPanelMode('empty');
        }}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
};

export default OCTIAddView;
