/**
 * Platform Card Component
 * Reusable card for configuring OpenCTI and OpenAEV platform connections
 */
import React from 'react';
import {
  Box,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Alert,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  VisibilityOutlined,
  VisibilityOffOutlined,
  CheckOutlined,
  DeleteOutlined,
} from '@mui/icons-material';
import type { PlatformConfig } from '../../shared/types';
import type { TestResult } from '../constants';

interface PlatformCardProps {
  platform: PlatformConfig;
  type: 'opencti' | 'openaev';
  index: number;
  showToken: boolean;
  isTesting: boolean;
  testResult?: TestResult;
  isTested: boolean;
  onToggleTokenVisibility: () => void;
  onUpdate: (updates: Partial<PlatformConfig>) => void;
  onRemove: () => void;
  onTestConnection: () => void;
}

const PlatformCard: React.FC<PlatformCardProps> = ({
  platform,
  type,
  showToken,
  isTesting,
  testResult,
  isTested,
  onToggleTokenVisibility,
  onUpdate,
  onRemove,
  onTestConnection,
}) => {
  // Platform name is only shown after it has been tested (auto-resolved from remote)
  const isDefaultName = platform.name === 'New OpenCTI' || 
                       platform.name === 'New OpenAEV' ||
                       platform.name === 'OpenCTI' ||
                       platform.name === 'OpenAEV' ||
                       !platform.name;
  const showNameField = isTested || !isDefaultName;

  return (
    <Card variant="outlined" sx={{ mb: 2, borderRadius: 1 }}>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Platform Name - only shown after testing or if customized */}
          {showNameField && (
            <TextField
              label="Platform Name"
              size="small"
              value={platform.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              fullWidth
              helperText="Auto-resolved from platform. You can customize it."
            />
          )}
          <TextField
            label="URL"
            size="small"
            placeholder={type === 'opencti' ? 'https://opencti.example.com' : 'https://openaev.example.com'}
            value={platform.url}
            onChange={(e) => onUpdate({ url: e.target.value })}
            fullWidth
          />
          <TextField
            label="API Token"
            size="small"
            type={showToken ? 'text' : 'password'}
            value={platform.apiToken}
            onChange={(e) => onUpdate({ apiToken: e.target.value })}
            fullWidth
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={onToggleTokenVisibility} edge="end" size="small">
                      {showToken ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {testResult && (
            <Alert severity={testResult.type} sx={{ borderRadius: 1, py: 0 }}>
              {testResult.message}
            </Alert>
          )}
        </Box>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0, mt: 2.5, justifyContent: 'space-between' }}>
        <Button
          size="small"
          variant="outlined"
          onClick={onTestConnection}
          disabled={isTesting || !platform.url || !platform.apiToken}
          startIcon={<CheckOutlined />}
        >
          {isTesting ? 'Testing...' : 'Test'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          onClick={onRemove}
          startIcon={<DeleteOutlined />}
        >
          Remove
        </Button>
      </CardActions>
    </Card>
  );
};

export default PlatformCard;

