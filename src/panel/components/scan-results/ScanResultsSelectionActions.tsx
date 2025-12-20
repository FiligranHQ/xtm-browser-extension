/**
 * Scan Results Selection Actions Component
 * 
 * Renders selection controls for select all/deselect all and import buttons.
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
} from '@mui/material';
import {
  CheckBoxOutlined,
  CheckBoxOutlineBlankOutlined,
  ArrowForwardOutlined,
} from '@mui/icons-material';
import type { ScanResultEntity } from '../../types/panel-types';

interface ScanResultsSelectionActionsProps {
  filteredScanResultsEntities: ScanResultEntity[];
  selectedScanItems: Set<string>;
  setSelectedScanItems: (items: Set<string>) => void;
  onImportSelected: () => void;
}

// Check if entity is selectable for OpenCTI import (not oaev-* type)
const isSelectableForOpenCTI = (entity: ScanResultEntity): boolean => {
  return !entity.type.startsWith('oaev-');
};

// Check if entity is found in OpenCTI
const isFoundInOpenCTI = (entity: ScanResultEntity): boolean => {
  if (entity.found) {
    if (entity.platformMatches && entity.platformMatches.length > 0) {
      return entity.platformMatches.some(pm => pm.platformType === 'opencti');
    }
    return entity.platformType === 'opencti' || !entity.platformType;
  }
  return false;
};

export const ScanResultsSelectionActions: React.FC<ScanResultsSelectionActionsProps> = ({
  filteredScanResultsEntities,
  selectedScanItems,
  setSelectedScanItems,
  onImportSelected,
}) => {
  const selectableEntities = filteredScanResultsEntities.filter(e => isSelectableForOpenCTI(e));
  const selectableValues = selectableEntities.map(e => e.value || e.name);
  const selectedCount = selectableValues.filter(v => selectedScanItems.has(v)).length;
  const allSelected = selectedCount === selectableEntities.length && selectableEntities.length > 0;
  const hasSelectableEntities = selectableEntities.length > 0;

  const selectedNewCount = selectableEntities.filter(e => {
    const entityValue = e.value || e.name;
    return selectedScanItems.has(entityValue) && !isFoundInOpenCTI(e);
  }).length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      window.parent.postMessage({ type: 'XTM_DESELECT_ALL' }, '*');
      setSelectedScanItems(new Set());
    } else {
      window.parent.postMessage({ type: 'XTM_SELECT_ALL', values: selectableValues }, '*');
      setSelectedScanItems(new Set(selectableValues));
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1, minWidth: 0 }}>
        {selectedCount > 0
          ? `${selectedCount} sel.${selectedNewCount > 0 ? ` (${selectedNewCount} new)` : ''}`
          : `${selectableEntities.length} available`
        }
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
        <Button
          size="small"
          variant="outlined"
          disabled={!hasSelectableEntities}
          onClick={handleToggleSelectAll}
          startIcon={allSelected ? <CheckBoxOutlined /> : <CheckBoxOutlineBlankOutlined />}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            py: 0.25,
            minWidth: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </Button>
        {selectedCount > 0 && (
          <Button
            size="small"
            variant="contained"
            onClick={onImportSelected}
            startIcon={<ArrowForwardOutlined />}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              py: 0.25,
              minWidth: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            Import ({selectedCount})
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default ScanResultsSelectionActions;

