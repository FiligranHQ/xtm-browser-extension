/**
 * SetupForm Component
 * 
 * Setup form for configuring platform connections
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

interface SetupFormProps {
  platformType: 'opencti' | 'openaev';
  logoSuffix: string;
  url: string;
  onUrlChange: (value: string) => void;
  token: string;
  onTokenChange: (value: string) => void;
  showToken: boolean;
  onToggleShowToken: () => void;
  error: string | null;
  success: boolean;
  testing: boolean;
  onConnect: () => void;
  onSkip: () => void;
}

const platformInfo = {
  opencti: {
    name: 'OpenCTI',
    subtitle: 'Threat Intelligence Platform',
    placeholder: 'https://your-opencti.domain.com',
  },
  openaev: {
    name: 'OpenAEV',
    subtitle: 'Attack & Exposure Validation',
    placeholder: 'https://your-openaev.domain.com',
  },
};

export const SetupForm: React.FC<SetupFormProps> = ({
  platformType,
  logoSuffix,
  url,
  onUrlChange,
  token,
  onTokenChange,
  showToken,
  onToggleShowToken,
  error,
  success,
  testing,
  onConnect,
  onSkip,
}) => {
  const info = platformInfo[platformType];
  const logoPath = `../assets/logos/logo_${platformType}_${logoSuffix}_embleme_square.svg`;
  const fallbackLogoPath = `../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`;

  return (
    <Box sx={{ p: 2.5, flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <img
          src={logoPath}
          alt={info.name}
          width={28}
          height={28}
          onError={(e) => {
            (e.target as HTMLImageElement).src = fallbackLogoPath;
          }}
        />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Connect {info.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {info.subtitle}
          </Typography>
        </Box>
      </Box>

      <TextField
        label="Platform URL"
        placeholder={info.placeholder}
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
              <IconButton size="small" onClick={onToggleShowToken} edge="end">
                {showToken ? (
                  <VisibilityOffOutlined fontSize="small" />
                ) : (
                  <VisibilityOutlined fontSize="small" />
                )}
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
          disabled={!url.trim() || !token.trim() || testing}
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

export default SetupForm;

