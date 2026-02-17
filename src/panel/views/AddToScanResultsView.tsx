/**
 * Add To Scan Results View Component
 *
 * Allows user to add selected text as a new entity to the scan results.
 * This is useful for manually adding entities that were not detected during scanning.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Autocomplete,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  AddOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { SELECTABLE_ENTITY_TYPES } from '../../shared/constants';
import type { PanelMode } from '../types/panel-types';

export interface AddToScanResultsViewProps {
  setPanelMode: (mode: PanelMode) => void;
  addToScanResultsText: string;
  setAddToScanResultsText: (text: string) => void;
  addToScanResultsEntityType: string;
  setAddToScanResultsEntityType: (type: string) => void;
  handleAddToScanResults: () => void;
  hasScanResults: boolean;
}

export const AddToScanResultsView: React.FC<AddToScanResultsViewProps> = ({
  setPanelMode,
  addToScanResultsText,
  setAddToScanResultsText,
  addToScanResultsEntityType,
  setAddToScanResultsEntityType,
  handleAddToScanResults,
  hasScanResults,
}) => {
  const handleClose = () => {
    setAddToScanResultsText('');
    setAddToScanResultsEntityType('');
    if (hasScanResults) {
      setPanelMode('scan-results');
    } else {
      setPanelMode('empty');
    }
  };

  const handleAdd = () => {
    handleAddToScanResults();
    // After adding, go to scan results
    setPanelMode('scan-results');
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Back button */}
      <Box sx={{ mb: 1.5 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={handleClose}
          sx={{ 
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {hasScanResults ? 'Back to scan results' : 'Back to actions'}
        </Button>
      </Box>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6" sx={{ fontSize: 16 }}>Add to scan results</Typography>
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Add selected text as a new entity to the scan results. You can then include it when creating a container or adding to OpenCTI.
      </Typography>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <TextField
          label="Entity Value"
          value={addToScanResultsText}
          onChange={(e) => setAddToScanResultsText(e.target.value)}
          fullWidth
          multiline
          minRows={1}
          maxRows={4}
          size="small"
          helperText="You can edit this text before adding"
        />
      </Paper>

      <Autocomplete
        options={SELECTABLE_ENTITY_TYPES}
        getOptionLabel={(option) => option.label}
        value={SELECTABLE_ENTITY_TYPES.find(t => t.value === addToScanResultsEntityType) || null}
        onChange={(_, newValue) => setAddToScanResultsEntityType(newValue?.value || '')}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Entity Type"
            size="small"
            required
            helperText="Select the type of entity this text represents"
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ItemIcon type={option.value} size="small" />
            <Typography variant="body2">{option.label}</Typography>
          </Box>
        )}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={!addToScanResultsText || !addToScanResultsEntityType}
          fullWidth
          startIcon={<AddOutlined />}
        >
          Add to scan results
        </Button>
        <Button variant="outlined" onClick={handleClose}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
};

export default AddToScanResultsView;

