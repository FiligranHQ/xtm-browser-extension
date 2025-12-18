/**
 * PlatformSetupForm - Reusable form for setting up platform connections
 */

import React from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Alert,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  VisibilityOutlined,
  VisibilityOffOutlined,
  SkipNextOutlined,
} from '@mui/icons-material';
import { isDefaultPlatform, type PlatformType } from '../../shared/platform/registry';
import type { PlatformSetupFormProps } from '../types';

const PLATFORM_CONFIG = {
  opencti: {
    name: 'OpenCTI',
    subtitle: 'Cyber Threat Intelligence',
    placeholder: 'https://your-opencti.domain.com',
    logoPrefix: 'opencti',
  },
  openaev: {
    name: 'OpenAEV',
    subtitle: 'Adversarial Exposure Validation',
    placeholder: 'https://your-openaev.domain.com',
    logoPrefix: 'openaev',
  },
} as const;

export const PlatformSetupForm: React.FC<PlatformSetupFormProps> = ({
  platformType,
  logoSuffix,
  url,
  token,
  showToken,
  testing,
  error,
  success,
  onUrlChange,
  onTokenChange,
  onToggleShowToken,
  onConnect,
  onSkip,
}) => {
  const config = PLATFORM_CONFIG[platformType];
  const isDisabled = !url.trim() || !token.trim() || testing;

  return (
    <Box sx={{ p: 2.5, flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <img
          src={`../assets/logos/logo_${config.logoPrefix}_${logoSuffix}_embleme_square.svg`}
          alt={config.name}
          width={28}
          height={28}
          onError={!isDefaultPlatform(platformType as PlatformType) ? (e) => {
            // Fallback to Filigran logo for non-default platforms
            (e.target as HTMLImageElement).src = `../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`;
          } : undefined}
        />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Connect {config.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {config.subtitle}
          </Typography>
        </Box>
      </Box>

      <TextField
        label="Platform URL"
        placeholder={config.placeholder}
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      <TextField
        label="API Token"
        placeholder="Enter your API token"
        type={showToken ? 'text' : 'password'}
        value={token}
        onChange={(e) => onTokenChange(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={onToggleShowToken}
                edge="end"
              >
                {showToken ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 1 }}>
          Connected successfully!
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button
          variant="contained"
          onClick={onConnect}
          disabled={isDisabled}
          startIcon={testing ? <CircularProgress size={16} /> : undefined}
          sx={{ flex: 1, borderRadius: 1 }}
        >
          {testing ? 'Testing...' : 'Connect'}
        </Button>
        <Button
          variant="outlined"
          onClick={onSkip}
          startIcon={<SkipNextOutlined />}
          sx={{ borderRadius: 1 }}
        >
          Skip
        </Button>
      </Box>
    </Box>
  );
};

export default PlatformSetupForm;

