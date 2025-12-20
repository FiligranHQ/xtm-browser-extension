/**
 * Scan Results Relationship Item Component
 * 
 * Renders a single relationship item in the scan results list.
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Tooltip,
  IconButton,
} from '@mui/material';
import { DeleteOutlined } from '@mui/icons-material';
import ItemIcon from '../../../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../../../shared/theme/colors';
import type { ScanResultEntity, ResolvedRelationship } from '../../types/panel-types';

interface ScanResultsRelationshipItemProps {
  relationship: ResolvedRelationship;
  index: number;
  mode: 'dark' | 'light';
  aiColors: { main: string; dark: string; light: string };
  scanResultsEntities: ScanResultEntity[];
  onDelete: (index: number) => void;
}

export const ScanResultsRelationshipItem: React.FC<ScanResultsRelationshipItemProps> = ({
  relationship: rel,
  index,
  mode,
  aiColors,
  scanResultsEntities,
  onDelete,
}) => {
  // Look up entities by value (more reliable) or fallback to index
  const fromEntity = rel.fromEntityValue 
    ? scanResultsEntities.find(e => (e.value || e.name) === rel.fromEntityValue)
    : scanResultsEntities[rel.fromIndex];
  const toEntity = rel.toEntityValue
    ? scanResultsEntities.find(e => (e.value || e.name) === rel.toEntityValue)
    : scanResultsEntities[rel.toIndex];

  if (!fromEntity || !toEntity) return null;

  const fromColor = fromEntity.discoveredByAI ? aiColors.main : itemColor(fromEntity.type, mode === 'dark');
  const toColor = toEntity.discoveredByAI ? aiColors.main : itemColor(toEntity.type, mode === 'dark');
  const confidenceColor = rel.confidence === 'high' ? 'success.main' : rel.confidence === 'medium' ? 'warning.main' : 'text.secondary';

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        mb: 0.75,
        bgcolor: hexToRGB(aiColors.main, 0.05),
        border: 1,
        borderColor: hexToRGB(aiColors.main, 0.2),
        borderRadius: 1,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* One-line relationship display */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
          {/* From entity */}
          <Tooltip title={fromEntity.type.replace(/-/g, ' ')} placement="top">
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              bgcolor: hexToRGB(fromColor, 0.15),
              borderRadius: 0.5,
              p: 0.3,
              flexShrink: 0,
            }}>
              <ItemIcon type={fromEntity.type} size="small" color={fromColor} />
            </Box>
          </Tooltip>
          <Typography 
            variant="caption" 
            sx={{ 
              fontWeight: 500, 
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: '0 1 auto',
            }}
          >
            {fromEntity.name || fromEntity.value}
          </Typography>
          
          {/* Relationship type */}
          <Chip
            label={rel.relationshipType}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              bgcolor: hexToRGB(aiColors.main, 0.2),
              color: aiColors.main,
              flexShrink: 0,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          
          {/* To entity */}
          <Tooltip title={toEntity.type.replace(/-/g, ' ')} placement="top">
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              bgcolor: hexToRGB(toColor, 0.15),
              borderRadius: 0.5,
              p: 0.3,
              flexShrink: 0,
            }}>
              <ItemIcon type={toEntity.type} size="small" color={toColor} />
            </Box>
          </Tooltip>
          <Typography 
            variant="caption" 
            sx={{ 
              fontWeight: 500, 
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: '0 1 auto',
            }}
          >
            {toEntity.name || toEntity.value}
          </Typography>
        </Box>
        
        {/* Reason */}
        <Tooltip title={rel.reason} placement="bottom-start">
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary', 
              display: 'block', 
              mt: 0.5,
              fontStyle: 'italic',
            }} 
            noWrap
          >
            {rel.reason}
          </Typography>
        </Tooltip>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        <Chip
          label={rel.confidence}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.6rem',
            color: confidenceColor,
            borderColor: confidenceColor,
          }}
          variant="outlined"
        />
        <IconButton
          size="small"
          onClick={() => onDelete(index)}
          sx={{
            p: 0.25,
            color: 'text.secondary',
            '&:hover': { color: 'error.main' },
          }}
        >
          <DeleteOutlined sx={{ fontSize: '0.9rem' }} />
        </IconButton>
      </Box>
    </Paper>
  );
};

export default ScanResultsRelationshipItem;

