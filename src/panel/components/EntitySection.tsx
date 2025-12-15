/**
 * Entity Section Component
 * 
 * Displays a labeled section of entity properties
 */

import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { formatDate, formatDateTime } from '../../shared/utils/formatters';

interface EntitySectionProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Section with a title label
 */
export const EntitySection: React.FC<EntitySectionProps> = ({
  title,
  children,
}) => {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography 
        variant="caption" 
        sx={{
          display: 'block',
          color: 'text.secondary',
          mb: 0.5,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
};

interface EntityTextProps {
  value: string | number | null | undefined;
  mode?: 'dark' | 'light';
}

/**
 * Text value display
 */
export const EntityText: React.FC<EntityTextProps> = ({ value, mode = 'light' }) => {
  if (value == null || value === '') return null;
  
  return (
    <Typography 
      variant="body2" 
      sx={{ 
        color: mode === 'dark' ? '#ffffff' : 'text.primary',
        lineHeight: 1.6,
      }}
    >
      {value}
    </Typography>
  );
};

interface EntityChipListProps {
  values: string[] | null | undefined;
  color?: string;
  bgColor?: string;
  variant?: 'filled' | 'outlined';
}

/**
 * List of chips for array values
 */
export const EntityChipList: React.FC<EntityChipListProps> = ({ 
  values, 
  color,
  bgColor,
  variant = 'filled',
}) => {
  if (!values || values.length === 0) return null;
  
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {values.map((value, i) => (
        <Chip 
          key={i} 
          label={value} 
          size="small" 
          variant={variant}
          sx={{ 
            bgcolor: bgColor || 'action.selected',
            color: color,
            fontWeight: color ? 500 : undefined,
            borderRadius: 1,
          }} 
        />
      ))}
    </Box>
  );
};

interface EntityDateProps {
  date: string | Date | null | undefined;
  showTime?: boolean;
}

/**
 * Date value display
 */
export const EntityDate: React.FC<EntityDateProps> = ({ date, showTime = true }) => {
  if (!date) return null;
  
  const formatted = showTime ? formatDateTime(date) : formatDate(date);
  
  return <EntityText value={formatted} />;
};

interface EntityLinkProps {
  url: string;
  label?: string;
}

/**
 * External link display
 */
export const EntityLink: React.FC<EntityLinkProps> = ({ url, label }) => {
  return (
    <Typography 
      component="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      variant="body2" 
      sx={{ 
        color: 'primary.main',
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'underline',
        },
      }}
    >
      {label || url}
    </Typography>
  );
};

export default EntitySection;

