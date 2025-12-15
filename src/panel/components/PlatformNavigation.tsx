/**
 * Platform Navigation Component
 * 
 * Displays platform indicator with navigation arrows for multi-platform entities
 */

import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { ChevronLeftOutlined, ChevronRightOutlined } from '@mui/icons-material';

interface PlatformNavigationProps {
  currentIndex: number;
  totalPlatforms: number;
  platformName: string;
  platformType: 'opencti' | 'openaev';
  logoSuffix: string;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * Platform navigation bar with arrows
 */
export const PlatformNavigation: React.FC<PlatformNavigationProps> = ({
  currentIndex,
  totalPlatforms,
  platformName,
  platformType,
  logoSuffix,
  onPrevious,
  onNext,
}) => {
  const hasMultiple = totalPlatforms > 1;
  const logoName = platformType === 'openaev' ? 'openaev' : 'opencti';
  
  const logoSrc = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL(`assets/logos/logo_${logoName}_${logoSuffix}_embleme_square.svg`)
    : `../assets/logos/logo_${logoName}_${logoSuffix}_embleme_square.svg`;

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: hasMultiple ? 'space-between' : 'center',
        mb: 2, 
        p: 1, 
        bgcolor: 'action.hover',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
      }}
    >
      {hasMultiple ? (
        <>
          <IconButton 
            size="small" 
            onClick={onPrevious} 
            disabled={currentIndex === 0}
            sx={{ opacity: currentIndex === 0 ? 0.3 : 1 }}
          >
            <ChevronLeftOutlined />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img
              src={logoSrc}
              alt={platformType === 'openaev' ? 'OpenAEV' : 'OpenCTI'}
              width={18}
              height={18}
            />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {platformName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              ({currentIndex + 1}/{totalPlatforms})
            </Typography>
          </Box>
          <IconButton 
            size="small" 
            onClick={onNext} 
            disabled={currentIndex === totalPlatforms - 1}
            sx={{ opacity: currentIndex === totalPlatforms - 1 ? 0.3 : 1 }}
          >
            <ChevronRightOutlined />
          </IconButton>
        </>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <img
            src={logoSrc}
            alt={platformType === 'openaev' ? 'OpenAEV' : 'OpenCTI'}
            width={18}
            height={18}
          />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {platformName}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default PlatformNavigation;

