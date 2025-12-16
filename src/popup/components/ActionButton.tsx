/**
 * ActionButton Component
 * 
 * Reusable action button for popup menu items
 */

import React from 'react';
import { Paper, Box, Typography, Tooltip } from '@mui/material';
import type { ActionButtonProps } from '../types';

export const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  subtitle,
  tooltip,
  onClick,
  color,
  disabled,
  compact = false,
}) => (
  <Tooltip title={tooltip} arrow>
    <Paper
      onClick={disabled ? undefined : onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 0.25 : 0.5,
        p: compact ? 1 : 1.5,
        width: '100%',
        height: compact ? 72 : 100,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        border: `1px solid ${color}50`,
        borderRadius: 1,
        transition: 'all 0.2s ease',
        '&:hover': disabled
          ? {}
          : {
              transform: 'translateY(-2px)',
              boxShadow: `0 4px 12px ${color}30`,
              borderColor: color,
            },
      }}
    >
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, fontSize: compact ? 14 : 15, lineHeight: 1.2 }}
      >
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: compact ? 11 : 12,
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {subtitle}
      </Typography>
    </Paper>
  </Tooltip>
);

export default ActionButton;

