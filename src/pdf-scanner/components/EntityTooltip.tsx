/**
 * EntityTooltip Component
 * 
 * Displays a tooltip with entity details on hover
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { getPlatformName } from '../../shared/platform/registry';
import type { HoveredEntityState } from '../types';

interface EntityTooltipProps {
  hoveredEntity: HoveredEntityState;
}

export function EntityTooltip({ hoveredEntity }: EntityTooltipProps) {
  const { entity, x, y } = hoveredEntity;
  
  const entityValue = 'value' in entity && entity.value 
    ? entity.value 
    : 'name' in entity && entity.name
      ? entity.name
      : '';

  const statusColor = entity.discoveredByAI 
    ? '#9c27b0' 
    : entity.found 
      ? '#00c853' 
      : '#ffa726';

  const statusText = entity.discoveredByAI 
    ? '✨ AI Discovered' 
    : entity.found 
      ? `✓ Found in ${getPlatformName(entity.platformType || 'opencti')}` 
      : 'ℹ Not found';

  return (
    <Box
      sx={{
        position: 'fixed',
        left: x + 10,
        top: y + 10,
        bgcolor: '#070d19',
        color: 'white',
        p: 1.5,
        borderRadius: 1,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
        maxWidth: 320,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Entity type badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography
          variant="caption"
          sx={{
            color: '#0fbcff',
            fontWeight: 600,
            textTransform: 'uppercase',
            fontSize: 10,
            letterSpacing: 0.5,
            bgcolor: 'rgba(15, 188, 255, 0.15)',
            px: 1,
            py: 0.25,
            borderRadius: 0.5,
          }}
        >
          {entity.type}
        </Typography>
      </Box>

      {/* Entity value */}
      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>
        {entityValue}
      </Typography>

      {/* Status indicator */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          mt: 1,
          pt: 1,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          color: statusColor,
          fontSize: 12,
        }}
      >
        {statusText}
      </Box>

      {/* AI confidence for AI-discovered entities */}
      {entity.discoveredByAI && entity.aiConfidence && (
        <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary', display: 'block' }}>
          Confidence: {entity.aiConfidence}
        </Typography>
      )}

      {/* AI reason for AI-discovered entities */}
      {entity.discoveredByAI && entity.aiReason && (
        <Typography 
          variant="caption" 
          sx={{ 
            mt: 0.5, 
            color: 'text.secondary', 
            display: 'block',
            fontStyle: 'italic',
            opacity: 0.8,
          }}
        >
          {entity.aiReason}
        </Typography>
      )}
    </Box>
  );
}

