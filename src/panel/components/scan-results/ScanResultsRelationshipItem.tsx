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
import type { ScanResultEntity, EntityData, ResolvedRelationship } from '../../types/panel-types';

// Generic entity type that works with both ScanResultEntity and EntityData
type RelationshipEntity = ScanResultEntity | EntityData;

interface ScanResultsRelationshipItemProps {
  relationship: ResolvedRelationship;
  index: number;
  mode: 'dark' | 'light';
  aiColors: { main: string; dark: string; light: string };
  /** Entities array - can be ScanResultEntity[] or EntityData[] */
  entities: RelationshipEntity[];
  onDelete: (index: number) => void;
  /** Compact mode for smaller display (used in preview view) */
  compact?: boolean;
}

export const ScanResultsRelationshipItem: React.FC<ScanResultsRelationshipItemProps> = ({
  relationship: rel,
  index,
  mode,
  aiColors,
  entities,
  onDelete,
  compact = false,
}) => {
  // Look up entities by value (more reliable) or fallback to index
  const fromEntity = rel.fromEntityValue 
    ? entities.find(e => (e.value || e.name) === rel.fromEntityValue)
    : entities[rel.fromIndex];
  const toEntity = rel.toEntityValue
    ? entities.find(e => (e.value || e.name) === rel.toEntityValue)
    : entities[rel.toIndex];

  if (!fromEntity || !toEntity) return null;

  // Handle discoveredByAI which may not exist on EntityData
  const fromDiscoveredByAI = 'discoveredByAI' in fromEntity && fromEntity.discoveredByAI;
  const toDiscoveredByAI = 'discoveredByAI' in toEntity && toEntity.discoveredByAI;
  
  const fromColor = fromDiscoveredByAI ? aiColors.main : itemColor(fromEntity.type, mode === 'dark');
  const toColor = toDiscoveredByAI ? aiColors.main : itemColor(toEntity.type, mode === 'dark');
  const confidenceColor = rel.confidence === 'high' ? 'success.main' : rel.confidence === 'medium' ? 'warning.main' : 'text.secondary';

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 0.75 : 1,
        p: compact ? 0.75 : 1,
        mb: compact ? 0.5 : 0.75,
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
          <Tooltip title={fromEntity.type?.replace(/-/g, ' ') || ''} placement="top">
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              bgcolor: hexToRGB(fromColor, 0.15),
              borderRadius: 0.5,
              p: compact ? 0.25 : 0.3,
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
              fontSize: compact ? '0.7rem' : undefined,
            }}
          >
            {fromEntity.name || fromEntity.value}
          </Typography>
          
          {/* Relationship type */}
          <Chip
            label={rel.relationshipType}
            size="small"
            sx={{
              height: compact ? 16 : 18,
              fontSize: compact ? '0.6rem' : '0.65rem',
              bgcolor: hexToRGB(aiColors.main, 0.2),
              color: aiColors.main,
              flexShrink: 0,
              '& .MuiChip-label': { px: compact ? 0.5 : 0.75 },
            }}
          />
          
          {/* To entity */}
          <Tooltip title={toEntity.type?.replace(/-/g, ' ') || ''} placement="top">
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              bgcolor: hexToRGB(toColor, 0.15),
              borderRadius: 0.5,
              p: compact ? 0.25 : 0.3,
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
              fontSize: compact ? '0.7rem' : undefined,
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
              mt: compact ? 0.25 : 0.5,
              fontStyle: 'italic',
              fontSize: compact ? '0.65rem' : undefined,
            }} 
            noWrap
          >
            {rel.reason}
          </Typography>
        </Tooltip>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: compact ? 0.25 : 0.5, flexShrink: 0 }}>
        <Chip
          label={rel.confidence}
          size="small"
          sx={{
            height: compact ? 16 : 18,
            fontSize: compact ? '0.55rem' : '0.6rem',
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
          <DeleteOutlined sx={{ fontSize: compact ? '0.85rem' : '0.9rem' }} />
        </IconButton>
      </Box>
    </Paper>
  );
};

export default ScanResultsRelationshipItem;

