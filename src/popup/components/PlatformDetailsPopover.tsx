/**
 * PlatformDetailsPopover - Shows detailed platform connection information
 */

import React from 'react';
import { Box, Typography, Divider, Popover } from '@mui/material';
import { PlatformCard } from './PlatformCard';
import { EXTENSION_VERSION } from '../../shared/constants';
import type { ConnectionStatus } from '../types';

interface PlatformDetailsPopoverProps {
  anchorEl: HTMLElement | null;
  status: ConnectionStatus;
  mode: 'dark' | 'light';
  logoSuffix: string;
  onClose: () => void;
  onOpenPlatform: (url: string) => void;
}

export const PlatformDetailsPopover: React.FC<PlatformDetailsPopoverProps> = ({
  anchorEl,
  status,
  mode,
  logoSuffix,
  onClose,
  onOpenPlatform,
}) => {
  const hasAnyOpenCTIConfigured = status.opencti.length > 0;
  const hasAnyOpenAEVConfigured = status.openaev.length > 0;

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'center',
      }}
      transformOrigin={{
        vertical: 'bottom',
        horizontal: 'center',
      }}
    >
      <Box sx={{ p: 2, minWidth: 380 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
          Connected Platforms
        </Typography>
        
        {/* OpenCTI Platforms */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <img
              src={`../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`}
              alt="OpenCTI"
              width={18}
              height={18}
            />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              OpenCTI
            </Typography>
            {hasAnyOpenCTIConfigured && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                ({status.opencti.filter(p => p.connected).length}/{status.opencti.length} connected)
              </Typography>
            )}
          </Box>
          {status.opencti.length > 0 ? (
            status.opencti.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                mode={mode}
                defaultName="OpenCTI"
                onOpen={onOpenPlatform}
              />
            ))
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 0.5 }}>
              No platforms configured
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* OpenAEV Platforms */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <img
              src={`../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`}
              alt="OpenAEV"
              width={18}
              height={18}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`;
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              OpenAEV
            </Typography>
            {hasAnyOpenAEVConfigured && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                ({status.openaev.filter(p => p.connected).length}/{status.openaev.length} connected)
              </Typography>
            )}
          </Box>
          {status.openaev.length > 0 ? (
            status.openaev.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                mode={mode}
                defaultName="OpenAEV"
                onOpen={onOpenPlatform}
              />
            ))
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 0.5 }}>
              No platforms configured
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            XTM Browser Extension v{EXTENSION_VERSION}
          </Typography>
          <Typography
            component="a"
            href="https://filigran.io"
            target="_blank"
            variant="caption"
            sx={{ 
              color: 'primary.main', 
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            filigran.io
          </Typography>
        </Box>
      </Box>
    </Popover>
  );
};

export default PlatformDetailsPopover;

