/**
 * OpenCTI Tab Component
 * Configuration for OpenCTI platform connections
 */
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Divider,
} from '@mui/material';
import {
  AddOutlined,
  LinkOffOutlined,
} from '@mui/icons-material';
import type { PlatformConfig, ExtensionSettings } from '../../shared/types';
import type { TestResult } from '../constants';
import PlatformCard from './PlatformCard';

interface OpenCTITabProps {
  settings: ExtensionSettings;
  showTokens: { [key: string]: boolean };
  testing: { [key: string]: boolean };
  testResults: { [key: string]: TestResult };
  testedPlatforms: Set<string>;
  onToggleTokenVisibility: (key: string) => void;
  onUpdatePlatform: (type: 'opencti' | 'openaev', index: number, updates: Partial<PlatformConfig>) => void;
  onRemovePlatform: (type: 'opencti' | 'openaev', index: number) => void;
  onTestConnection: (type: 'opencti' | 'openaev', platformId: string) => void;
  onAddPlatform: (type: 'opencti' | 'openaev') => void;
  onRemoveAll: () => void;
  onSave: () => void;
  isSaveDisabled: boolean;
}

const OpenCTITab: React.FC<OpenCTITabProps> = ({
  settings,
  showTokens,
  testing,
  testResults,
  testedPlatforms,
  onToggleTokenVisibility,
  onUpdatePlatform,
  onRemovePlatform,
  onTestConnection,
  onAddPlatform,
  onRemoveAll,
  onSave,
  isSaveDisabled,
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>OpenCTI Platforms</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Configure one or more OpenCTI platform connections for threat intelligence
      </Typography>

      <Box sx={{ flex: 1 }}>
        {settings.openctiPlatforms.map((platform, index) => {
          const key = `opencti-${platform.id}`;
          return (
            <PlatformCard
              key={platform.id}
              platform={platform}
              type="opencti"
              index={index}
              showToken={showTokens[key] || false}
              isTesting={testing[key] || false}
              testResult={testResults[key]}
              isTested={testedPlatforms.has(key)}
              onToggleTokenVisibility={() => onToggleTokenVisibility(key)}
              onUpdate={(updates) => onUpdatePlatform('opencti', index, updates)}
              onRemove={() => onRemovePlatform('opencti', index)}
              onTestConnection={() => onTestConnection('opencti', platform.id)}
            />
          );
        })}

        <Button
          variant="outlined"
          startIcon={<AddOutlined />}
          onClick={() => onAddPlatform('opencti')}
          sx={{ mt: 1, mb: 3 }}
        >
          Add OpenCTI Platform
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          variant="outlined"
          color="error"
          startIcon={<LinkOffOutlined />}
          onClick={onRemoveAll}
          disabled={settings.openctiPlatforms.length === 0}
        >
          Remove All
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={isSaveDisabled}
        >
          Save Settings
        </Button>
      </Box>
    </Box>
  );
};

export default OpenCTITab;

