/**
 * Add View Component
 * 
 * Form for manually adding an entity.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  AddOutlined,
  CloseOutlined,
} from '@mui/icons-material';
import type { PanelMode, PlatformInfo } from '../types';
import { loggers } from '../../shared/utils/logger';

const log = loggers.panel;

// Observable type options
const OBSERVABLE_TYPES = [
  { value: 'ipv4-addr', label: 'IPv4 Address' },
  { value: 'ipv6-addr', label: 'IPv6 Address' },
  { value: 'domain-name', label: 'Domain Name' },
  { value: 'hostname', label: 'Hostname' },
  { value: 'url', label: 'URL' },
  { value: 'email-addr', label: 'Email Address' },
  { value: 'mac-addr', label: 'MAC Address' },
  { value: 'file', label: 'File (Hash)' },
  { value: 'cryptocurrency-wallet', label: 'Cryptocurrency Wallet' },
  { value: 'user-agent', label: 'User Agent' },
];

export interface AddViewProps {
  mode: 'dark' | 'light';
  setPanelMode: (mode: PanelMode) => void;
  setEntity: (entity: any) => void;
  openctiPlatforms: PlatformInfo[];
  selectedPlatformId: string;
  setSelectedPlatformId: (id: string) => void;
  handleClose: () => void;
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
  }) => void;
}

export const AddView: React.FC<AddViewProps> = ({
  mode: _mode,
  setPanelMode,
  setEntity,
  openctiPlatforms,
  selectedPlatformId,
  setSelectedPlatformId,
  handleClose,
  showToast,
}) => {
  const [observableType, setObservableType] = useState('ipv4-addr');
  const [observableValue, setObservableValue] = useState('');
  const [creating, setCreating] = useState(false);

  // Handle create observable
  const handleCreate = async () => {
    const value = observableValue.trim();
    if (!value) {
      showToast({ type: 'warning', message: 'Please enter a value' });
      return;
    }

    const platformId = selectedPlatformId || (openctiPlatforms.length === 1 ? openctiPlatforms[0].id : '');
    if (!platformId) {
      showToast({ type: 'warning', message: 'Please select a platform' });
      return;
    }

    setCreating(true);

    try {
      const response = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'CREATE_OBSERVABLE',
            payload: {
              type: observableType,
              value,
              platformId,
            },
          },
          resolve
        );
      });

      setCreating(false);

      if (response?.success && response.data) {
        showToast({ type: 'success', message: 'Observable created successfully' });
        setEntity({
          ...response.data,
          _platformId: platformId,
          _platformType: 'opencti',
        });
        setPanelMode('entity');
      } else {
        showToast({ type: 'error', message: response?.error || 'Failed to create observable' });
      }
    } catch (error) {
      log.error('Create observable error:', error);
      setCreating(false);
      showToast({ type: 'error', message: 'Failed to create observable' });
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <AddOutlined sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ flex: 1 }}>
          Add Observable
        </Typography>
        <Button
          size="small"
          onClick={handleClose}
          startIcon={<CloseOutlined />}
          sx={{ color: 'text.secondary' }}
        >
          Cancel
        </Button>
      </Box>

      {/* Platform selector (if multiple platforms) */}
      {openctiPlatforms.length > 1 && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Platform</InputLabel>
          <Select
            value={selectedPlatformId || ''}
            label="Platform"
            onChange={(e) => setSelectedPlatformId(e.target.value)}
          >
            {openctiPlatforms.map((platform) => (
              <MenuItem key={platform.id} value={platform.id}>
                {platform.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Observable type selector */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Observable Type</InputLabel>
        <Select
          value={observableType}
          label="Observable Type"
          onChange={(e) => setObservableType(e.target.value)}
        >
          {OBSERVABLE_TYPES.map((type) => (
            <MenuItem key={type.value} value={type.value}>
              {type.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Value input */}
      <TextField
        fullWidth
        label="Value"
        value={observableValue}
        onChange={(e) => setObservableValue(e.target.value)}
        placeholder={getPlaceholder(observableType)}
        multiline={observableType === 'user-agent'}
        rows={observableType === 'user-agent' ? 2 : 1}
        sx={{ mb: 3 }}
      />

      {/* Create button */}
      <Button
        variant="contained"
        fullWidth
        onClick={handleCreate}
        disabled={creating || !observableValue.trim()}
        startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <AddOutlined />}
      >
        {creating ? 'Creating...' : 'Create Observable'}
      </Button>
    </Box>
  );
};

// Helper to get placeholder based on type
const getPlaceholder = (type: string): string => {
  switch (type) {
    case 'ipv4-addr':
      return 'e.g., 192.168.1.1';
    case 'ipv6-addr':
      return 'e.g., 2001:0db8:85a3::8a2e:0370:7334';
    case 'domain-name':
      return 'e.g., example.com';
    case 'hostname':
      return 'e.g., mail.example.com';
    case 'url':
      return 'e.g., https://example.com/path';
    case 'email-addr':
      return 'e.g., user@example.com';
    case 'mac-addr':
      return 'e.g., 00:1A:2B:3C:4D:5E';
    case 'file':
      return 'e.g., d41d8cd98f00b204e9800998ecf8427e';
    case 'cryptocurrency-wallet':
      return 'e.g., 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
    case 'user-agent':
      return 'e.g., Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...';
    default:
      return 'Enter value';
  }
};

export default AddView;

