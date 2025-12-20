/**
 * Scan Results Entity Item Component
 * 
 * Renders a single entity item in the scan results list with full details.
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Checkbox,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  ChevronRightOutlined,
  LayersOutlined,
  GpsFixedOutlined,
  InfoOutlined,
  AutoAwesomeOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../../../shared/theme/colors';
import type { ScanResultEntity } from '../../types/panel-types';
import { getCanonicalTypeName } from '../../../shared/platform/registry';
import { sendToContentScript } from '../../utils/content-messaging';
import { isFoundInOpenCTI, getUniqueTypesFromMatches } from '../../utils/scan-results-helpers';

interface ScanResultsEntityItemProps {
  entity: ScanResultEntity;
  index: number;
  mode: 'dark' | 'light';
  aiColors: { main: string; dark: string; light: string };
  isSelected: boolean;
  isSelectable: boolean;
  onEntityClick: (entity: ScanResultEntity) => void;
  onToggleSelection: (entityValue: string) => void;
}

// Format type name for display
const formatTypeName = (type: string): string => {
  return getCanonicalTypeName(type);
};

export const ScanResultsEntityItem: React.FC<ScanResultsEntityItemProps> = ({
  entity,
  index,
  mode,
  aiColors,
  isSelected,
  isSelectable,
  onEntityClick,
  onToggleSelection,
}) => {
  const entityColor = entity.discoveredByAI ? aiColors.main : itemColor(entity.type, mode === 'dark');
  const { types: uniqueTypes, hasMultipleTypes } = getUniqueTypesFromMatches(entity);
  const primaryType = uniqueTypes[0] || entity.type;
  const displayType = formatTypeName(primaryType);

  const octiCount = entity.platformMatches?.filter(pm => pm.platformType === 'opencti').length || 0;
  const oaevCount = entity.platformMatches?.filter(pm => pm.platformType === 'openaev').length || 0;

  const entityValue = entity.value || entity.name;

  const borderColor = entity.discoveredByAI
    ? aiColors.main
    : (entity.found ? 'success.main' : 'warning.main');

  const multiTypeTooltip = hasMultipleTypes
    ? `Multiple types: ${uniqueTypes.map(t => formatTypeName(t)).join(', ')}`
    : '';

  const hasMatchedStrings = entity.matchedStrings && entity.matchedStrings.length > 0;
  const matchedStringsTooltip = hasMatchedStrings ? (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
        Matched in page:
      </Typography>
      {entity.matchedStrings!.map((str, idx) => (
        <Box 
          key={idx} 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5,
            py: 0.25,
            '&:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' },
          }}
        >
          <Box 
            sx={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              bgcolor: entity.found ? 'success.main' : 'warning.main',
              flexShrink: 0,
            }} 
          />
          <Typography 
            variant="caption" 
            sx={{ 
              fontFamily: 'monospace',
              wordBreak: 'break-word',
            }}
          >
            "{str}"
          </Typography>
        </Box>
      ))}
    </Box>
  ) : (entity.found ? 'Entity found in platform' : (entity.discoveredByAI ? 'Discovered by AI' : 'New entity not in platform'));

  const handleScrollToHighlight = (e: React.MouseEvent) => {
    e.stopPropagation();
    const primaryValue = entity.value || entity.name;
    const allValues = entity.matchedStrings 
      ? [primaryValue, ...entity.matchedStrings.filter(s => s.toLowerCase() !== primaryValue.toLowerCase())]
      : [primaryValue];
    sendToContentScript({ 
      type: 'XTM_SCROLL_TO_HIGHLIGHT', 
      payload: { value: allValues } 
    });
  };

  return (
    <Paper
      key={entity.id + '-' + index}
      elevation={0}
      onClick={() => onEntityClick(entity)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        mb: 0.75,
        bgcolor: isSelected
          ? hexToRGB('#1976d2', 0.08)
          : (entity.discoveredByAI ? hexToRGB(aiColors.main, 0.05) : 'background.paper'),
        border: 1,
        borderColor: isSelected ? 'primary.main' : borderColor,
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'all 0.15s',
        borderLeftWidth: 3,
        '&:hover': {
          bgcolor: isSelected
            ? hexToRGB('#1976d2', 0.12)
            : (entity.discoveredByAI ? hexToRGB(aiColors.main, 0.1) : 'action.hover'),
          boxShadow: 1,
        },
      }}
    >
      {/* Checkbox for entities selectable for OpenCTI */}
      {isSelectable && (
        <Checkbox
          checked={isSelected}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection(entityValue);
          }}
          size="small"
          sx={{
            p: 0.25,
            '&.Mui-checked': { color: entity.discoveredByAI ? aiColors.main : (isFoundInOpenCTI(entity) ? 'success.main' : 'primary.main') },
          }}
        />
      )}
      
      {/* Entity icon */}
      {hasMultipleTypes ? (
        <Tooltip title={multiTypeTooltip} placement="top">
          <Box sx={{ position: 'relative', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ItemIcon type={primaryType} size="small" color={entityColor} />
            <LayersOutlined 
              sx={{ 
                position: 'absolute', 
                bottom: -2, 
                right: -4, 
                fontSize: 12, 
                color: 'primary.main',
                bgcolor: 'background.paper',
                borderRadius: '50%',
              }} 
            />
          </Box>
        </Tooltip>
      ) : (
        <ItemIcon type={entity.type} size="small" color={entityColor} />
      )}

      {/* Entity info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word', fontSize: '0.85rem' }}>
          {entity.name || entity.value}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
          {/* Type display - compact for multi-type */}
          {hasMultipleTypes ? (
            <Tooltip title={multiTypeTooltip} placement="top">
              <Chip
                icon={<LayersOutlined sx={{ fontSize: '0.65rem !important' }} />}
                label={`${uniqueTypes.length} types`}
                size="small"
                color="primary"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  '& .MuiChip-label': { px: 0.5 },
                  '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
                }}
              />
            </Tooltip>
          ) : (
            <Typography variant="caption" sx={{ color: entity.discoveredByAI ? aiColors.main : 'text.secondary', fontSize: '0.7rem' }}>
              {displayType}
            </Typography>
          )}
          
          {/* Show AI indicator for AI-discovered entities */}
          {entity.discoveredByAI && (
            <Tooltip title={entity.aiReason || 'Detected by AI analysis'} placement="top">
              <Chip
                icon={<AutoAwesomeOutlined sx={{ fontSize: '0.65rem !important' }} />}
                label="AI"
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  bgcolor: hexToRGB(aiColors.main, 0.2),
                  color: aiColors.main,
                  '& .MuiChip-label': { px: 0.4 },
                  '& .MuiChip-icon': { ml: 0.4, mr: -0.25 },
                }}
              />
            </Tooltip>
          )}
          
          {/* Show compact platform badges */}
          {!entity.discoveredByAI && (octiCount > 0 || oaevCount > 0) && (
            <>
              {octiCount > 0 && (
                <Chip
                  label={octiCount > 1 ? `OCTI (${octiCount})` : 'OCTI'}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.6rem',
                    bgcolor: hexToRGB('#5c6bc0', 0.15),
                    color: '#5c6bc0',
                    fontWeight: octiCount > 1 ? 600 : 400,
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />
              )}
              {oaevCount > 0 && (
                <Chip
                  label={oaevCount > 1 ? `OAEV (${oaevCount})` : 'OAEV'}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.6rem',
                    bgcolor: hexToRGB('#e91e63', 0.15),
                    color: '#e91e63',
                    fontWeight: oaevCount > 1 ? 600 : 400,
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />
              )}
            </>
          )}
        </Box>
      </Box>
      
      {/* Status chip with matched strings tooltip */}
      <Tooltip 
        title={matchedStringsTooltip} 
        placement="left"
        arrow
        slotProps={{
          tooltip: {
            sx: {
              bgcolor: 'background.paper',
              color: 'text.primary',
              boxShadow: 3,
              border: '1px solid',
              borderColor: 'divider',
              maxWidth: 280,
              '& .MuiTooltip-arrow': {
                color: 'background.paper',
                '&::before': {
                  border: '1px solid',
                  borderColor: 'divider',
                },
              },
            },
          },
        }}
      >
        <Chip
          icon={hasMatchedStrings ? <InfoOutlined sx={{ fontSize: '0.85rem !important' }} /> : undefined}
          label={entity.found ? 'Found' : (entity.discoveredByAI ? 'AI' : 'New')}
          size="small"
          variant="outlined"
          sx={{
            minWidth: hasMatchedStrings ? 65 : 50,
            cursor: 'help',
            borderColor: entity.discoveredByAI ? aiColors.main : undefined,
            color: entity.discoveredByAI ? aiColors.main : undefined,
            '& .MuiChip-icon': { 
              ml: 0.5, 
              mr: -0.25,
              color: 'inherit',
            },
          }}
          color={entity.found ? 'success' : (entity.discoveredByAI ? undefined : 'warning')}
        />
      </Tooltip>
      
      {/* Scroll to highlight button */}
      <Tooltip title="Scroll to highlight on page" placement="top">
        <Box
          onClick={handleScrollToHighlight}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            cursor: 'pointer',
            transition: 'all 0.15s',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <GpsFixedOutlined sx={{ color: 'text.secondary', fontSize: 16 }} />
        </Box>
      </Tooltip>
      
      <ChevronRightOutlined sx={{ color: 'text.secondary', fontSize: 18 }} />
    </Paper>
  );
};

export default ScanResultsEntityItem;
