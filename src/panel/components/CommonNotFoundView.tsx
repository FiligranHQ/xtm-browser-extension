/**
 * Not Found View Component
 *
 * Displays when an entity is not found in the platform.
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
} from '@mui/material';
import {
  AddOutlined,
  ChevronLeftOutlined,
} from '@mui/icons-material';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import ItemIcon from '../../shared/components/ItemIcon';
import type { EntityData, PanelMode } from '../types/panel-types';

export interface NotFoundViewProps {
  entity: EntityData | null;
  mode: 'dark' | 'light';
  entityFromScanResults: boolean;
  setEntityFromScanResults: (value: boolean) => void;
  setPanelMode: (mode: PanelMode) => void;
  setEntitiesToAdd: (entities: EntityData[]) => void;
  setAddFromNotFound: (fromNotFound: boolean) => void;
}

/**
 * View displayed when entity is not found in platform
 */
export const CommonNotFoundView: React.FC<NotFoundViewProps> = ({
  entity,
  mode,
  entityFromScanResults,
  setEntityFromScanResults,
  setPanelMode,
  setEntitiesToAdd,
  setAddFromNotFound,
}) => {
  if (!entity) return null;

  const type = entity.type || 'unknown';
  const color = itemColor(type, mode === 'dark');
  const value = entity.value || entity.name || 'Unknown';

  return (
    <Box sx={{ p: 2 }}>
      {/* Back to scan results button */}
      {entityFromScanResults && (
        <Box sx={{ mb: 1.5 }}>
          <Button
            size="small"
            startIcon={<ChevronLeftOutlined />}
            onClick={() => {
              setEntityFromScanResults(false);
              setPanelMode('scan-results');
            }}
            sx={{
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            Back to scan results
          </Button>
        </Box>
      )}

      <Alert severity="warning" sx={{ mb: 2, borderRadius: 1 }}>
        This entity was not found in OpenCTI
      </Alert>

      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.5,
          py: 0.5,
          mb: 2,
          borderRadius: 1,
          bgcolor: hexToRGB(color, 0.15),
          border: `1px solid ${hexToRGB(color, 0.3)}`,
        }}
      >
        <ItemIcon type={type} size="small" color={color} />
        <Typography variant="caption" sx={{ fontWeight: 600, color, textTransform: 'capitalize' }}>
          {type.replace(/-/g, ' ')}
        </Typography>
      </Box>

      <Typography variant="h6" sx={{ mb: 2, wordBreak: 'break-word' }}>
        {value}
      </Typography>

      <Button
        variant="contained"
        startIcon={<AddOutlined />}
        onClick={() => {
          setEntitiesToAdd([entity]);
          setAddFromNotFound(true);
          setPanelMode('add');
        }}
        fullWidth
      >
        Add to OpenCTI 
      </Button>
    </Box>
  );
};

export default CommonNotFoundView;
