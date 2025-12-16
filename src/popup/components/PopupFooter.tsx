/**
 * PopupFooter Component
 * 
 * Footer section with connection status indicators
 */

import React from 'react';
import { Box, Typography, Divider, keyframes } from '@mui/material';
import type { ConnectionStatus } from '../types';

// Pulsing animation for connection indicator
const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(76, 175, 80, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
  }
`;

interface PopupFooterProps {
  status: ConnectionStatus;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}

export const PopupFooter: React.FC<PopupFooterProps> = ({ status, onClick }) => {
  const hasOpenCTI = status.opencti.some((p) => p.connected);
  const hasOpenAEV = status.openaev.some((p) => p.connected);
  const hasAnyOpenCTIConfigured = status.opencti.length > 0;
  const hasAnyOpenAEVConfigured = status.openaev.length > 0;

  return (
    <Box sx={{ mt: 'auto' }}>
      <Divider />
      <Box
        onClick={onClick}
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        {/* Connection Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* OpenCTI Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: hasOpenCTI
                  ? '#4caf50'
                  : hasAnyOpenCTIConfigured
                  ? '#f44336'
                  : '#9e9e9e',
                animation: hasOpenCTI ? `${pulse} 2s infinite` : undefined,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: hasOpenCTI
                  ? '#4caf50'
                  : hasAnyOpenCTIConfigured
                  ? '#f44336'
                  : '#9e9e9e',
                fontSize: 10,
                fontWeight: 500,
              }}
            >
              {hasOpenCTI
                ? `OCTI (${status.opencti.filter((p) => p.connected).length})`
                : hasAnyOpenCTIConfigured
                ? 'OCTI offline'
                : 'OCTI'}
            </Typography>
          </Box>
          {/* OpenAEV Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: hasOpenAEV
                  ? '#4caf50'
                  : hasAnyOpenAEVConfigured
                  ? '#f44336'
                  : '#9e9e9e',
                animation: hasOpenAEV ? `${pulse} 2s infinite` : undefined,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: hasOpenAEV
                  ? '#4caf50'
                  : hasAnyOpenAEVConfigured
                  ? '#f44336'
                  : '#9e9e9e',
                fontSize: 10,
                fontWeight: 500,
              }}
            >
              {hasOpenAEV
                ? `OAEV (${status.openaev.filter((p) => p.connected).length})`
                : hasAnyOpenAEVConfigured
                ? 'OAEV offline'
                : 'OAEV'}
            </Typography>
          </Box>
        </Box>
        {/* Version */}
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', opacity: 0.7, fontSize: 10 }}
        >
          v0.0.4 • Click for details
        </Typography>
      </Box>
    </Box>
  );
};

export default PopupFooter;

