/**
 * PlatformCard - Displays a single platform's connection status
 */

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { OpenInNewOutlined } from '@mui/icons-material';
import type { PlatformStatus } from '../types';

interface PlatformCardProps {
  platform: PlatformStatus;
  mode: 'dark' | 'light';
  defaultName: string;
  onOpen: (url: string) => void;
}

export const PlatformCard: React.FC<PlatformCardProps> = ({
  platform,
  mode,
  defaultName,
  onOpen,
}) => {
  const handleClick = () => {
    if (platform.url && platform.connected) {
      onOpen(platform.url);
    }
  };

  return (
    <Paper
      elevation={0}
      onClick={handleClick}
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        p: 1.5, 
        mb: 1, 
        borderRadius: 1,
        border: 1,
        borderColor: platform.connected ? 'success.main' : 'divider',
        opacity: platform.connected ? 1 : 0.6,
        cursor: platform.connected ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': platform.connected ? { borderColor: 'primary.main', bgcolor: 'action.hover' } : {},
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {platform.name || defaultName}
          </Typography>
          {platform.connected && (
            <Box
              sx={{
                px: 0.5,
                py: 0.1,
                borderRadius: 0.5,
                fontSize: '9px',
                fontWeight: 700,
                lineHeight: 1.3,
                bgcolor: platform.isEnterprise 
                  ? (mode === 'dark' ? '#00f1bd' : '#0c7e69') 
                  : '#616161',
                color: platform.isEnterprise ? '#000' : '#fff',
              }}
            >
              {platform.isEnterprise ? 'EE' : 'CE'}
            </Box>
          )}
        </Box>
        {platform.connected ? (
          <>
            <Typography variant="caption" sx={{ color: '#4caf50', display: 'block' }}>
              Connected {platform.version ? `• v${platform.version}` : ''}
            </Typography>
            {platform.userName && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {platform.userName}
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="caption" sx={{ color: '#f44336' }}>
            Not connected
          </Typography>
        )}
      </Box>
      {platform.connected && <OpenInNewOutlined fontSize="small" sx={{ color: 'text.secondary', ml: 1 }} />}
    </Paper>
  );
};

export default PlatformCard;

