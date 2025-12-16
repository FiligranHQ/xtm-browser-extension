/**
 * Add Selection View Component
 *
 * Allows user to add selected text as an entity to OpenCTI.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Autocomplete,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  AddOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import type { PanelMode, PlatformInfo } from '../types';

// Available observable types for manual selection - sorted alphabetically by label
const OBSERVABLE_TYPES = [
  { value: 'Attack-Pattern', label: 'Attack Pattern (MITRE)' },
  { value: 'Campaign', label: 'Campaign' },
  { value: 'Domain-Name', label: 'Domain Name' },
  { value: 'Email-Addr', label: 'Email Address' },
  { value: 'StixFile', label: 'File Hash' },
  { value: 'Hostname', label: 'Hostname' },
  { value: 'Intrusion-Set', label: 'Intrusion Set' },
  { value: 'IPv4-Addr', label: 'IPv4 Address' },
  { value: 'IPv6-Addr', label: 'IPv6 Address' },
  { value: 'Malware', label: 'Malware' },
  { value: 'Threat-Actor', label: 'Threat Actor' },
  { value: 'Tool', label: 'Tool' },
  { value: 'Url', label: 'URL' },
  { value: 'Vulnerability', label: 'Vulnerability (CVE)' },
];

export interface AddSelectionViewProps {
  setPanelMode: (mode: PanelMode) => void;
  addSelectionText: string;
  setAddSelectionText: (text: string) => void;
  addSelectionEntityType: string;
  setAddSelectionEntityType: (type: string) => void;
  addSelectionFromContextMenu: boolean;
  setAddSelectionFromContextMenu: (fromContext: boolean) => void;
  addingSelection: boolean;
  handleAddSelection: () => void;
  openctiPlatforms: PlatformInfo[];
}

export const AddSelectionView: React.FC<AddSelectionViewProps> = ({
  setPanelMode,
  addSelectionText,
  setAddSelectionText,
  addSelectionEntityType,
  setAddSelectionEntityType,
  addSelectionFromContextMenu,
  setAddSelectionFromContextMenu,
  addingSelection,
  handleAddSelection,
  openctiPlatforms,
}) => {
  const handleCloseAddSelection = () => {
    setPanelMode('empty');
    setAddSelectionText('');
    setAddSelectionFromContextMenu(false);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {!addSelectionFromContextMenu && (
          <IconButton size="small" onClick={handleCloseAddSelection}>
            <ChevronLeftOutlined />
          </IconButton>
        )}
        <Typography variant="h6" sx={{ fontSize: 16 }}>Add to OpenCTI</Typography>
      </Box>

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
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
          Selected Text
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
          {addSelectionText}
        </Typography>
      </Paper>

      <Autocomplete
        options={OBSERVABLE_TYPES}
        getOptionLabel={(option) => option.label}
        value={OBSERVABLE_TYPES.find(t => t.value === addSelectionEntityType) || null}
        onChange={(_, newValue) => setAddSelectionEntityType(newValue?.value || '')}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Entity Type"
            size="small"
            required
            helperText={addSelectionEntityType ? 'Type auto-detected from value' : 'Select the entity type'}
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

      {openctiPlatforms.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No OpenCTI platform configured. Please configure one in settings.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          onClick={handleAddSelection}
          disabled={!addSelectionText || !addSelectionEntityType || addingSelection || openctiPlatforms.length === 0}
          fullWidth
          endIcon={addingSelection ? <CircularProgress size={16} color="inherit" /> : <AddOutlined />}
        >
          {addingSelection ? 'Adding...' : 'Add to OpenCTI'}
        </Button>
        <Button variant="outlined" onClick={handleCloseAddSelection}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
};

export default AddSelectionView;

